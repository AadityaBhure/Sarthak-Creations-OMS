import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ledgerQuery } from '../lib/vendor-jobs/ledger.mjs';

test('ledger queries validate vendor scope, pagination, sorting and stage filters', () => {
  const q = ledgerQuery({ filters: [{ column: 'stage_number', operator: 'gte', value: 2 }, { column: 'job_title', operator: 'ilike', value: 'Gift' }] });
  assert.equal(q.expression, 'and(stage_number.gte.2,job_title.ilike."%Gift%")');
  assert.equal(q.includeDeleted, false);
  assert.equal(q.sort.column, 'stage_started_at');
  assert.match(ledgerQuery({ filters: [{ column: 'stage_started_at', operator: 'eq', value: '2026-10-29' }] }).expression, /2026-10-28T18:30:00.000Z/);
  for (const input of [null, [], { vendorId: 'bad' }, { page: 0 }, { limit: 1000 }, { includeDeleted: 'true' }, { sort: { column: 'secret', direction: 'asc' } }, { filters: [{ column: 'current_vendor_id', operator: 'eq', value: 'bad' }] }]) assert.throws(() => ledgerQuery(input));
});

test('ledger backfills saved visits, preserves repeat visits, follows corrections and recycle lifecycle', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  const sql = file => readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE product_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
      CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz DEFAULT now(),date_of_entry date);
      CREATE TABLE deleted_orders(LIKE orders INCLUDING DEFAULTS);
      CREATE TABLE global_settings(id text primary key,recycle_retention_days integer);
      CREATE TABLE activity_logs(user_id uuid,username text,action text,module text,record_id uuid,details jsonb);
      CREATE SCHEMA cron; CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
      GRANT ALL ON product_types TO service_role;`);
    for (const file of ['20260927_vendor_job_tracking.sql', '20260928_vendor_job_repair_and_master_recycle.sql', '20260929_vendor_job_deleted_records.sql', '20261028_order_numbering.sql', '20261028_vendor_job_details.sql', '20261029_vendor_job_statuses.sql']) await db.exec((await sql(file)).replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', ''));
    const master = async (kind, name) => (await db.query('SELECT vjt_save_master($1,null,$2) r', [kind, { name }])).rows[0].r.after.id;
    const a = await master('vendors', 'Vendor A'), b = await master('vendors', 'Vendor B');
    const print = await master('jobs', 'Printing'), cut = await master('jobs', 'Cutting'), paper = await master('papers', 'Art');
    const mutate = async (action, id, data) => (await db.query('SELECT vjt_mutate_details($1,$2,$3) r', [action, id, data])).rows[0].r.after;
    let card = await mutate('create', null, { quantity: 500, vendor_id: a, job_type_id: print, paper_type_id: paper, job_title: 'Gift boxes' });
    card = await mutate('save', card.id, { revision: card.revision, vendor_id: b, job_type_id: cut });
    card = await mutate('save', card.id, { revision: card.revision, vendor_id: a, job_type_id: cut });
    const migration = await sql('20261029_vendor_ledger.sql');
    await db.exec(migration); await db.exec(migration);
    await db.exec('SET ROLE service_role');
    const visits = async () => (await db.query('SELECT * FROM vjt_vendor_ledger ORDER BY stage_number')).rows;
    let rows = await visits();
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => [r.vendor, r.job_type]), [['Vendor A', 'Printing'], ['Vendor B', 'Cutting'], ['Vendor A', 'Cutting']]);
    assert.equal(new Set(rows.map(r => r.id)).size, 3);
    assert.ok(rows.every(r => r.serial_number === 1 && r.job_title === 'Gift boxes' && r.quantity === 500));
    assert.equal((await db.query('SELECT count(*)::integer n FROM vjt_vendor_ledger WHERE vendor_id=$1', [a])).rows[0].n, 2);
    card = await mutate('save', card.id, { revision: card.revision, vendor_id: a, job_type_id: cut });
    assert.equal((await visits()).length, 3);
    for (const status of ['Hold', 'Active', 'Completed', 'Active', 'Canceled']) {
      card = await mutate('save', card.id, { revision: card.revision, status });
      assert.ok((await visits()).every(r => r.status === status));
    }
    await db.query('SELECT vjt_master_lifecycle($1,$2,$3,1)', ['vendors', b, 'delete']);
    assert.equal((await visits())[1].vendor, 'Vendor B');
    card = await mutate('delete', card.id, { revision: card.revision });
    assert.equal((await db.query('SELECT count(*)::integer n FROM vjt_vendor_ledger WHERE deleted_at IS NULL')).rows[0].n, 0);
    assert.equal((await visits()).length, 3);
    card = await mutate('restore', card.id, { revision: card.revision });
    await db.query('SELECT vjt_master_lifecycle($1,$2,$3,2)', ['vendors', b, 'restore']);
    card = await mutate('reopen', card.id, { revision: card.revision });
    const stages = card.stages.slice(0, 2).map(s => ({ id: s.id, vendor_id: s.vendor_id, job_type_id: s.job_type_id }));
    stages[0].job_type_id = cut;
    card = await mutate('sequence', card.id, { revision: card.revision, stages });
    rows = await visits(); assert.equal(rows.length, 2); assert.equal(rows[0].job_type, 'Cutting');
    card = await mutate('delete', card.id, { revision: card.revision });
    await mutate('purge', card.id, { revision: card.revision });
    assert.equal((await visits()).length, 0);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM vjt_vendor_ledger'), /permission denied/);
  } finally { await db.close(); }
});
