import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

test('central recycle view, protected purge, revision guards, retention and audit', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE global_settings(id text primary key,recycle_retention_days integer);
      INSERT INTO global_settings VALUES('default',3);
      CREATE TABLE activity_logs(user_id uuid,username text,action text,module text,record_id uuid,details jsonb);
      CREATE SCHEMA cron;
      CREATE TABLE cron.job(jobname text primary key,schedule text,command text);
      CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$
        INSERT INTO cron.job VALUES($1,$2,$3) ON CONFLICT(jobname) DO UPDATE SET schedule=$2,command=$3 RETURNING 1::bigint
      $$;`);
    const sql = async file => readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
    await db.exec(await sql('20260927_vendor_job_tracking.sql'));
    await db.exec(await sql('20260928_vendor_job_repair_and_master_recycle.sql'));
    const migration = (await sql('20260929_vendor_job_deleted_records.sql')).replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', '');
    await db.exec(migration); await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM cron.job')).rows.length, 1);
    const master = async (kind, name, capabilities = []) => (await db.query('SELECT vjt_save_master($1,null,$2) r', [kind, { name, capabilities }])).rows[0].r.after;
    const life = async (kind, row, action) => (await db.query('SELECT vjt_master_lifecycle($1,$2,$3,$4) r', [kind, row.id, action, row.revision])).rows[0].r.after;
    const purge = (kind, row) => db.query('SELECT vjt_purge_master($1,$2,$3)', [kind, row.id, row.revision]);
    const job = await master('jobs', 'Print');
    let vendor = await master('vendors', 'ABC', [job.id]);
    await assert.rejects(purge('vendors', vendor), /Only records/);
    vendor = await life('vendors', vendor, 'delete');
    await assert.rejects(purge('vendors', { ...vendor, revision: 1 }), /changed/);
    const jobDeleted = await life('jobs', job, 'delete');
    await assert.rejects(purge('jobs', jobDeleted), /capabilities/);
    const view = (await db.query("SELECT record FROM vjt_deleted_records WHERE kind='vendors'")).rows[0].record;
    assert.equal(view.capability_names, 'Print');
    assert.equal(view.purge_blocked, false);
    vendor = await life('vendors', vendor, 'restore');
    vendor = await life('vendors', vendor, 'delete');
    await purge('vendors', vendor);
    assert.equal((await db.query('SELECT * FROM vjt_vendor_capabilities')).rows.length, 0);
    await purge('jobs', jobDeleted);

    const print = await master('jobs', 'Printing');
    const supplier = await master('vendors', 'History vendor', [print.id]);
    const paper = await master('papers', 'Art');
    const card = (await db.query("SELECT vjt_mutate('create',null,$1) r", [{ quantity: 10, paper_type_id: paper.id, vendor_id: supplier.id, job_type_id: print.id }])).rows[0].r.after;
    await db.query("SELECT vjt_mutate('delete',$1,$2)", [card.id, { revision: card.revision }]);
    const deletedSupplier = await life('vendors', supplier, 'delete');
    await life('jobs', print, 'delete'); await life('papers', paper, 'delete');
    await assert.rejects(purge('vendors', deletedSupplier), /history/);
    const recent = await master('papers', 'Recent'); await life('papers', recent, 'delete');
    for (const table of ['vjt_job_cards', 'vjt_vendors', 'vjt_job_types', 'vjt_paper_types']) {
      await db.query(`UPDATE ${table} SET deleted_at=now()-interval '4 days' WHERE deleted_at IS NOT NULL AND id<>$1`, [recent.id]);
    }
    assert.equal((await db.query('SELECT vjt_purge_expired() n')).rows[0].n, 4);
    assert.equal((await db.query('SELECT * FROM vjt_stages')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM activity_logs')).rows.length, 4);
    assert.equal((await db.query('SELECT * FROM vjt_deleted_records')).rows.length, 1);
    await db.exec("UPDATE global_settings SET recycle_retention_days=5; UPDATE vjt_paper_types SET deleted_at=now()-interval '4 days' WHERE deleted_at IS NOT NULL;");
    assert.equal((await db.query('SELECT vjt_purge_expired() n')).rows[0].n, 0);
    await db.exec('UPDATE global_settings SET recycle_retention_days=2');
    assert.equal((await db.query('SELECT vjt_purge_expired() n')).rows[0].n, 1);
  } finally { await db.close(); }
});
