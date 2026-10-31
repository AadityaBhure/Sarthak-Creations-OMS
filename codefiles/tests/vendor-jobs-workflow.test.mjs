import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateMutation } from '../lib/vendor-jobs/domain.mjs';
test('entry overrides and staged progress validation', () => {
  const id = '00000000-0000-0000-0000-000000000001';
  assert.doesNotThrow(() =>
    validateMutation('create', {
      quantity: 1,
      paper_type_id: id,
      vendor_id: id,
      job_type_id: id,
      job_card_number: 'CUSTOM',
      created_at: '2020-01-01T00:00:00Z',
    }),
  );
  assert.throws(() =>
    validateMutation('create', {
      quantity: 1,
      paper_type_id: id,
      vendor_id: id,
      job_type_id: id,
      job_card_number: 'CUSTOM',
      expected_number: 'JB0001',
    }),
  );
  assert.throws(() => validateMutation('save', { revision: 1, vendor_id: id }));
  assert.doesNotThrow(() =>
    validateMutation('save', { revision: 1, status: 'Active' }),
  );
});
test(
  'incremental migration: entry, atomic inline saves, reissues and paused durations',
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const { PGlite } = await import(
      pathToFileURL(process.env.PGLITE_MODULE).href
    );
    const db = new PGlite();
    try {
      await db.exec(
        'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;',
      );
      for (const file of [
        '20260927_vendor_job_tracking.sql',
        '20260928_vendor_job_workflow.sql',
      ])
        await db.exec(
          await readFile(
            new URL('../supabase/migrations/' + file, import.meta.url),
            'utf8',
          ),
        );
      const rpc = async (action, id, data = {}) =>
        (
          await db.query('SELECT vjt_mutate($1,$2,$3::jsonb) r', [
            action,
            id,
            JSON.stringify(data),
          ])
        ).rows[0].r.after;
      const read = async (id) =>
        (await db.query('SELECT * FROM vjt_tracking WHERE id=$1', [id]))
          .rows[0];
      const master = async (kind, name) =>
        (
          await db.query('SELECT vjt_save_master($1,null,$2::jsonb) r', [
            kind,
            JSON.stringify({ name }),
          ])
        ).rows[0].r.after.id;
      const vendor = await master('vendors', 'A'),
        otherVendor = await master('vendors', 'B'),
        job = await master('jobs', 'Printing'),
        paper = await master('papers', 'Paper');
      const input = {
        quantity: 100,
        vendor_id: vendor,
        job_type_id: job,
        paper_type_id: paper,
      };
      const defaults = (await db.query('SELECT vjt_entry_defaults() r')).rows[0]
        .r;
      assert.equal(defaults.job_card_number, 'JB0001');
      let a = await rpc('create', null, {
        ...input,
        job_card_number: 'CUSTOM',
        created_at: '2020-01-01T00:00:00+05:30',
      });
      assert.equal(
        new Date(a.created_at).toISOString(),
        '2019-12-31T18:30:00.000Z',
      );
      assert.equal(
        (await db.query('SELECT last_number::int n FROM vjt_number_counter'))
          .rows[0].n,
        0,
      );
      await assert.rejects(
        rpc('create', null, { ...input, job_card_number: 'CUSTOM' }),
        (e) => e.code === 'P0002',
      );
      const duplicate = await rpc('create', null, {
        ...input,
        job_card_number: 'CUSTOM',
        confirm_duplicate: true,
      });
      assert.notEqual(a.id, duplicate.id);
      const generated = await rpc('create', null, {
        ...input,
        expected_number: 'JB0001',
      });
      assert.equal(generated.job_card_number, 'JB0001');
      await assert.rejects(
        rpc('create', null, { ...input, expected_number: 'JB0001' }),
        (e) => e.code === 'P0003',
      );
      assert.equal(
        (await db.query('SELECT last_number::int n FROM vjt_number_counter'))
          .rows[0].n,
        1,
      );
      // Both dropdowns produce ONE new stage, with completion in the same transaction.
      a = await rpc('save', a.id, {
        revision: a.revision,
        vendor_id: otherVendor,
        job_type_id: job,
        status: 'Completed',
      });
      assert.equal(a.stages.length, 2);
      assert.equal(a.status, 'Completed');
      assert.equal(a.current_vendor_id, otherVendor);
      await rpc('complete', duplicate.id, { revision: duplicate.revision });
      const reissued = await rpc('create', null, {
        ...input,
        job_card_number: 'CUSTOM',
      });
      assert.equal(reissued.job_card_number, 'CUSTOM');
      await assert.rejects(
        rpc('save', a.id, { revision: a.revision, status: 'Active' }),
        (e) => e.code === 'P0002',
      );
      a = await rpc('save', a.id, {
        revision: a.revision,
        status: 'Active',
        confirm_duplicate: true,
      });
      assert.equal(a.completed_at, null);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM vjt_completed_intervals WHERE job_card_id=$1',
            [a.id],
          )
        ).rows[0].n,
        1,
      );
      // Failed field + stage save rolls back every part and preserves the revision.
      const invalid = '00000000-0000-0000-0000-000000000099';
      await assert.rejects(
        rpc('save', a.id, {
          revision: a.revision,
          remarks: 'must roll back',
          vendor_id: invalid,
          job_type_id: job,
        }),
      );
      assert.equal((await read(a.id)).remarks, '');
      assert.equal((await read(a.id)).revision, a.revision);
      a = await rpc('save', a.id, {
        revision: a.revision,
        vendor_id: otherVendor,
        job_type_id: job,
      });
      assert.equal(a.stages.length, 2);
      // Stable clock in one transaction; two completed intervals total five days.
      await db.exec('BEGIN');
      await db.query(
        'DELETE FROM vjt_completed_intervals WHERE job_card_id=$1',
        [a.id],
      );
      await db.query(
        "UPDATE vjt_job_cards SET created_at=now()-interval '20 days' WHERE id=$1",
        [a.id],
      );
      await db.query(
        "UPDATE vjt_stages SET started_at=now()-interval '10 days' WHERE job_card_id=$1 AND position=2",
        [a.id],
      );
      await db.query(
        "INSERT INTO vjt_completed_intervals(job_card_id,completed_at,reopened_at) VALUES($1,now()-interval '15 days',now()-interval '12 days')",
        [a.id],
      );
      a = await rpc('complete', a.id, { revision: a.revision });
      await db.query(
        "UPDATE vjt_job_cards SET completed_at=now()-interval '2 days' WHERE id=$1",
        [a.id],
      );
      a = await rpc('reopen', a.id, {
        revision: a.revision,
        confirm_duplicate: true,
      });
      assert.equal(a.total_days, 15);
      assert.equal(a.days_at_current_job, 8);
      a = await rpc('complete', a.id, { revision: a.revision });
      assert.equal(a.total_days, 15);
      assert.equal(a.days_at_current_job, 8);
      a = await rpc('delete', a.id, { revision: a.revision });
      a = await rpc('restore', a.id, { revision: a.revision });
      assert.equal(a.total_days, 15);
      a = await rpc('delete', a.id, { revision: a.revision });
      await rpc('purge', a.id, { revision: a.revision });
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM vjt_completed_intervals WHERE job_card_id=$1',
            [a.id],
          )
        ).rows[0].n,
        0,
      );
      await db.exec('COMMIT; SET ROLE service_role');
      await rpc('create', null, input);
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(db.query('SELECT vjt_entry_defaults()'));
    } finally {
      await db.close();
    }
  },
);
