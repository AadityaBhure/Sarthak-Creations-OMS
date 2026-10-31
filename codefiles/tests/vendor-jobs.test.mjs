import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  validateMutation,
  validateMaster,
  filterExpression,
} from '../lib/vendor-jobs/domain.mjs';

const uuid = '00000000-0000-0000-0000-000000000001';
test('validation enforces approved fields and withholds deferred actions', () => {
  assert.doesNotThrow(() => validateMutation('reopen', { revision: 1 }));
  assert.throws(() =>
    validateMutation('update', { revision: 1, completed_at: '2026-01-01' }),
  );
  assert.throws(() =>
    validateMutation('create', {
      quantity: 0,
      paper_type_id: uuid,
      vendor_id: uuid,
      job_type_id: uuid,
    }),
  );
  assert.throws(() =>
    validateMutation('sequence', { revision: 1, stages: [] }),
  );
  assert.doesNotThrow(() =>
    validateMutation('sequence', {
      revision: 1,
      stages: [
        {
          vendor_id: uuid,
          job_type_id: uuid,
          started_at: '2030-01-01T00:00:00Z',
        },
        {
          vendor_id: uuid,
          job_type_id: uuid,
          started_at: '2020-01-01T00:00:00Z',
        },
      ],
    }),
  );
  assert.throws(() =>
    validateMaster('vendors', {
      name: 'A',
      capabilities: [],
      remarks: 'unapproved',
    }),
  );
});

test('filters preserve AND/OR groups, IST calendar dates and quoted text', () => {
  assert.equal(
    filterExpression([
      { column: 'quantity', operator: 'gte', value: 100, logic: 'and' },
      { column: 'quantity', operator: 'lte', value: 500, logic: 'or' },
      { column: 'status', operator: 'eq', value: 'Active' },
    ]),
    'and(quantity.gte.100,quantity.lte.500),status.eq."Active"',
  );
  assert.equal(
    filterExpression([
      { column: 'created_at', operator: 'eq', value: '2026-09-27' },
    ]),
    'and(created_at.gte."2026-09-26T18:30:00.000Z",created_at.lt."2026-09-27T18:30:00.000Z")',
  );
  assert.equal(
    filterExpression([{ column: 'remarks', operator: 'eq', value: 'a,b)"x' }]),
    'remarks.eq."a,b)\\"x"',
  );
  assert.throws(() =>
    filterExpression([{ column: 'id', operator: 'eq', value: uuid }]),
  );
  assert.throws(() =>
    filterExpression([
      { column: 'quantity', operator: 'between', value: 5, valueTo: 2 },
    ]),
  );
});

// PGLITE_MODULE points to a temporary @electric-sql/pglite installation;
// this integration suite never connects to Supabase or the production database.
test(
  'PostgreSQL migration and complete Job Card lifecycle',
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
      await db.exec(
        await readFile(
          new URL(
            '../supabase/migrations/20260927_vendor_job_tracking.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const master = async (kind, data, id = null) =>
        (
          await db.query('SELECT vjt_save_master($1,$2,$3::jsonb) AS result', [
            kind,
            id,
            JSON.stringify(data),
          ])
        ).rows[0].result;
      const mutate = async (action, id, data = {}) =>
        (
          await db.query('SELECT vjt_mutate($1,$2,$3::jsonb) AS result', [
            action,
            id,
            JSON.stringify(data),
          ])
        ).rows[0].result;
      const read = async (id) =>
        (await db.query('SELECT * FROM vjt_tracking WHERE id=$1', [id]))
          .rows[0];
      const job = (await master('jobs', { name: 'Printing' })).after;
      const paper = (await master('papers', { name: 'Art paper' })).after;
      const vendor = (
        await master('vendors', {
          name: 'Vendor A',
          capabilities: [job.id],
          concerned_persons: 'A, B',
          concerned_contacts: '123, 456',
        })
      ).after;
      const secondVendor = (
        await master('vendors', { name: 'Vendor B', capabilities: [] })
      ).after;
      const input = {
        quantity: 100,
        paper_type_id: paper.id,
        vendor_id: vendor.id,
        job_type_id: job.id,
      };
      let first = (await mutate('create', null, input)).after;
      assert.equal(first.job_card_number, 'JB0001');
      assert.equal(first.stages.length, 1);
      const firstId = first.id;
      first = (
        await mutate('update', first.id, {
          revision: first.revision,
          job_card_number: 'JB0003',
        })
      ).after;
      let second = (await mutate('create', null, input)).after;
      assert.equal(second.job_card_number, 'JB0002');
      const third = (await mutate('create', null, input)).after;
      assert.equal(third.job_card_number, 'JB0004');
      await assert.rejects(
        mutate('update', second.id, {
          revision: second.revision,
          job_card_number: 'JB0003',
        }),
        (e) => e.code === 'P0002',
      );
      second = (
        await mutate('update', second.id, {
          revision: second.revision,
          job_card_number: 'JB0003',
          confirm_duplicate: true,
        })
      ).after;
      assert.notEqual(second.id, first.id);
      await assert.rejects(
        mutate('update', first.id, { revision: 1, remarks: 'stale' }),
        (e) => e.code === '40001',
      );
      const counterBefore = (
        await db.query('SELECT last_number FROM vjt_number_counter')
      ).rows[0].last_number;
      await assert.rejects(
        mutate('create', null, { ...input, vendor_id: uuid }),
      );
      assert.equal(
        (await db.query('SELECT last_number FROM vjt_number_counter')).rows[0]
          .last_number,
        counterBefore,
      );
      assert.equal(
        (await db.query('SELECT count(*)::int n FROM vjt_job_cards')).rows[0].n,
        3,
      );
      first = (
        await mutate('progress', first.id, {
          revision: first.revision,
          vendor_id: secondVendor.id,
          job_type_id: job.id,
        })
      ).after;
      assert.equal(first.current_vendor_id, secondVendor.id);
      const originalStamp = first.stages[0].started_at;
      const sequence = [
        {
          id: first.stages[1].id,
          vendor_id: secondVendor.id,
          job_type_id: job.id,
          started_at: '2030-01-01T00:00:00Z',
        },
        { id: first.stages[0].id, vendor_id: vendor.id, job_type_id: job.id },
      ];
      first = (
        await mutate('sequence', first.id, {
          revision: first.revision,
          stages: sequence,
        })
      ).after;
      assert.equal(first.current_vendor_id, vendor.id);
      assert.equal(first.stages[1].started_at, originalStamp);
      assert.deepEqual(
        first.stages.map((s) => s.position),
        [1, 2],
      );
      const wrongStage = { ...sequence[0], id: second.stages[0].id };
      await assert.rejects(
        mutate('sequence', first.id, {
          revision: first.revision,
          stages: [wrongStage],
        }),
      );
      assert.equal((await read(first.id)).stages.length, 2);
      first = (
        await mutate('sequence', first.id, {
          revision: first.revision,
          stages: [sequence[1], { vendor_id: vendor.id, job_type_id: job.id }],
        })
      ).after;
      assert.equal(first.stages.length, 2);
      assert.equal(first.stages[0].started_at, originalStamp);
      await master(
        'vendors',
        { ...vendor, name: 'Renamed Vendor', capabilities: [job.id] },
        vendor.id,
      );
      assert.equal((await read(first.id)).current_vendor, 'Renamed Vendor');
      first = (await mutate('complete', first.id, { revision: first.revision }))
        .after;
      assert.equal(first.status, 'Completed');
      assert.ok(first.completed_at);
      for (const action of [
        'update',
        'progress',
        'sequence',
        'complete',
        'reopen',
      ]) {
        await assert.rejects(
          mutate(action, first.id, {
            revision: first.revision,
            ...input,
            stages: sequence,
          }),
        );
      }
      const frozen = [
        first.total_days,
        first.days_at_current_job,
        first.completed_at,
      ];
      first = (await mutate('delete', first.id, { revision: first.revision }))
        .after;
      assert.ok(first.deleted_at);
      assert.equal(first.stages.length, 2);
      first = (await mutate('restore', first.id, { revision: first.revision }))
        .after;
      assert.equal(first.deleted_at, null);
      assert.equal(first.status, 'Completed');
      assert.deepEqual(
        [first.total_days, first.days_at_current_job, first.completed_at],
        frozen,
      );
      await assert.rejects(
        db.query('DELETE FROM vjt_vendors WHERE id=$1', [vendor.id]),
      );
      await assert.rejects(
        mutate('purge', first.id, { revision: first.revision }),
      );
      first = (await mutate('delete', first.id, { revision: first.revision }))
        .after;
      await mutate('purge', first.id, { revision: first.revision });
      assert.equal(await read(firstId), undefined);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM vjt_stages WHERE job_card_id=$1',
            [firstId],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM vjt_vendors WHERE id=$1',
            [vendor.id],
          )
        ).rows[0].n,
        1,
      );
      await db.exec('SET ROLE anon');
      await assert.rejects(db.query('SELECT * FROM vjt_tracking'));
      await assert.rejects(mutate('create', null, input));
      await db.exec('RESET ROLE; SET ROLE service_role');
      assert.equal(
        (await db.query('SELECT count(*)::int n FROM vjt_tracking')).rows[0].n,
        2,
      );
    } finally {
      await db.close();
    }
  },
);
