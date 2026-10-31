import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateMutation, filterExpression } from '../lib/vendor-jobs/domain.mjs';

test('four statuses are accepted by save and filtering', () => {
  for (const status of ['Active', 'Hold', 'Completed', 'Canceled']) {
    assert.doesNotThrow(() => validateMutation('save', { revision: 1, status }));
    assert.equal(filterExpression([{ column: 'status', operator: 'eq', value: status }]), `status.eq."${status}"`);
  }
  assert.throws(() => validateMutation('save', { revision: 1, status: 'Other' }));
});

test('Hold, cancellation, reopen, elapsed time, revisions, numbering and recycle lifecycle', { skip: !process.env.PGLITE_MODULE }, async () => {
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
    for (const file of ['20260927_vendor_job_tracking.sql', '20260928_vendor_job_repair_and_master_recycle.sql', '20260929_vendor_job_deleted_records.sql', '20261028_order_numbering.sql', '20261028_vendor_job_details.sql']) {
      await db.exec((await sql(file)).replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', ''));
    }
    const master = async kind => (await db.query('SELECT vjt_save_master($1,null,$2) r', [kind, { name: kind }])).rows[0].r.after.id;
    const vendor = await master('vendors'), job = await master('jobs'), paper = await master('papers');
    const input = { quantity: 30, vendor_id: vendor, job_type_id: job, paper_type_id: paper, job_title: 'Keep this title' };
    const mutate = async (action, id, data) => (await db.query('SELECT vjt_mutate_details($1,$2,$3) r', [action, id, data])).rows[0].r;
    let card = (await mutate('create', null, input)).after;
    const migration = await sql('20261029_vendor_job_statuses.sql');
    await db.exec(migration); await db.exec(migration);
    await db.exec('SET ROLE service_role');
    const reload = async () => (await db.query('SELECT * FROM vjt_tracking WHERE id=$1', [card.id])).rows[0];
    const stages = card.stages;
    await db.query("UPDATE vjt_job_cards SET created_at=now()-interval '10 days 12 hours' WHERE id=$1", [card.id]);
    await db.query("UPDATE vjt_stages SET started_at=now()-interval '9 days 12 hours' WHERE job_card_id=$1", [card.id]);
    card = (await mutate('save', card.id, { revision: card.revision, status: 'Hold' })).after;
    assert.equal(card.status, 'Hold'); assert.equal(card.total_days, 10); assert.equal(card.days_at_current_job, 9);
    assert.equal(card.completed_at, null); assert.equal(card.canceled_at, null);
    assert.equal((await db.query('SELECT count(*)::integer n FROM vjt_completed_intervals')).rows[0].n, 0);
    assert.equal(card.stages[0].id, stages[0].id);
    await assert.rejects(db.query("SELECT vjt_master_lifecycle('papers',$1,'delete',1)", [paper]), /Active/);
    await assert.rejects(db.query("SELECT vjt_master_lifecycle('vendors',$1,'delete',1)", [vendor]), /Active/);
    await assert.rejects(mutate('create', null, { ...input, job_card_number: card.job_card_number }), /already exists/);
    assert.notEqual((await db.query('SELECT vjt_entry_defaults() r')).rows[0].r.job_card_number, card.job_card_number);
    card = (await mutate('save', card.id, { revision: card.revision, job_title: 'Hold title', quantity: 60 })).after;
    assert.equal(card.status, 'Hold'); assert.equal(card.job_title, 'Hold title');
    await assert.rejects(mutate('save', card.id, { revision: card.revision, status: 'Canceled', quantity: -1 }), /constraint/);
    assert.equal((await reload()).status, 'Hold');
    const revision = card.revision;
    card = (await mutate('save', card.id, { revision, status: 'Canceled' })).after;
    assert.equal(card.status, 'Canceled'); assert.ok(card.canceled_at); assert.equal(card.completed_at, null);
    await assert.rejects(mutate('save', card.id, { revision, status: 'Active' }), /changed/);
    await assert.rejects(mutate('save', card.id, { revision: card.revision, quantity: 9 }), /read-only/);
    await assert.rejects(mutate('save', card.id, { revision: card.revision, job_title: 'blocked' }), /reopen/);
    await assert.rejects(mutate('save', card.id, { revision: card.revision, status: 'Hold' }), /Active/);
    await db.query("UPDATE vjt_job_cards SET canceled_at=now()-interval '2 days' WHERE id=$1", [card.id]);
    card = await reload();
    assert.equal(card.total_days, 8); assert.equal(card.days_at_current_job, 7);
    const duplicate = (await mutate('create', null, { ...input, job_card_number: card.job_card_number })).after;
    await assert.rejects(mutate('reopen', card.id, { revision: card.revision }), /already exists/);
    card = (await mutate('save', card.id, { revision: card.revision, status: 'Active', confirm_duplicate: true })).after;
    assert.equal(card.canceled_at, null); assert.equal(card.total_days, 8); assert.equal(card.days_at_current_job, 7);
    assert.equal(card.serial_number, 1); assert.equal(duplicate.serial_number, 2);
    assert.equal((await db.query('SELECT count(*)::integer n FROM vjt_completed_intervals')).rows[0].n, 1);
    card = (await mutate('save', card.id, { revision: card.revision, status: 'Hold' })).after;
    card = (await mutate('delete', card.id, { revision: card.revision })).after;
    card = (await mutate('restore', card.id, { revision: card.revision })).after;
    assert.equal(card.status, 'Hold');
    card = (await mutate('complete', card.id, { revision: card.revision })).after;
    assert.equal(card.status, 'Completed'); assert.ok(card.completed_at); assert.equal(card.canceled_at, null);
    card = (await mutate('reopen', card.id, { revision: card.revision, confirm_duplicate: true })).after;
    card = (await mutate('save', card.id, { revision: card.revision, status: 'Canceled' })).after;
    card = (await mutate('delete', card.id, { revision: card.revision })).after;
    const deleted = (await db.query("SELECT record FROM vjt_deleted_records WHERE kind='cards' AND id=$1", [card.id])).rows[0].record;
    assert.equal(deleted.status, 'Canceled'); assert.equal(deleted.job_title, 'Hold title'); assert.ok(deleted.canceled_at);
    card = (await mutate('restore', card.id, { revision: card.revision })).after;
    assert.equal(card.status, 'Canceled'); assert.equal(card.serial_number, 1);
    await db.query('UPDATE vjt_vendors SET deleted_at=now() WHERE id=$1', [vendor]);
    await assert.rejects(mutate('reopen', card.id, { revision: card.revision, confirm_duplicate: true }), /master/);
    await db.exec('RESET ROLE'); await db.exec(migration);
    assert.equal((await reload()).status, 'Canceled');
    assert.equal((await db.query('SELECT vjt_schema_version() n')).rows[0].n, 5);
  } finally { await db.close(); }
});
