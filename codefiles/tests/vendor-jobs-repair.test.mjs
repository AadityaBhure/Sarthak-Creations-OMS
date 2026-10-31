import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const sql = async (name) =>
  readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
for (const state of ['initial', 'partial', 'workflow'])
  test(
    'repair and master lifecycle from ' + state,
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
        await db.exec(await sql('20260927_vendor_job_tracking.sql'));
        if (state === 'partial')
          await db.exec(
            'CREATE TABLE vjt_completed_intervals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_card_id uuid NOT NULL REFERENCES vjt_job_cards(id) ON DELETE CASCADE,completed_at timestamptz NOT NULL,reopened_at timestamptz NOT NULL);',
          );
        if (state === 'workflow')
          await db.exec(await sql('20260928_vendor_job_workflow.sql'));
        const repair = await sql(
          '20260928_vendor_job_repair_and_master_recycle.sql',
        );
        await db.exec(repair);
        await db.exec(repair);
        assert.equal(
          (await db.query('SELECT vjt_schema_version() version')).rows[0]
            .version,
          3,
        );
        assert.equal(
          (await db.query('SELECT vjt_entry_defaults() r')).rows[0].r
            .job_card_number,
          'JB0001',
        );
        const master = async (kind, name) =>
          (
            await db.query('SELECT vjt_save_master($1,null,$2::jsonb) r', [
              kind,
              JSON.stringify({ name }),
            ])
          ).rows[0].r.after;
        const mutate = async (action, id, data) =>
          (
            await db.query('SELECT vjt_mutate($1,$2,$3::jsonb) r', [
              action,
              id,
              JSON.stringify(data),
            ])
          ).rows[0].r.after;
        const life = async (kind, row, action) =>
          (
            await db.query('SELECT vjt_master_lifecycle($1,$2,$3,$4) r', [
              kind,
              row.id,
              action,
              row.revision,
            ])
          ).rows[0].r.after;
        let vendor = await master('vendors', 'A'),
          job = await master('jobs', 'Print'),
          paper = await master('papers', 'Paper'),
          other = await master('vendors', 'B');
        const input = {
          quantity: 20,
          vendor_id: vendor.id,
          job_type_id: job.id,
          paper_type_id: paper.id,
        };
        let card = await mutate('create', null, input);
        card = await mutate('save', card.id, {
          revision: card.revision,
          vendor_id: other.id,
          job_type_id: job.id,
        });
        for (const [kind, row] of [
          ['vendors', vendor],
          ['vendors', other],
          ['jobs', job],
          ['papers', paper],
        ])
          await assert.rejects(life(kind, row, 'delete'), /Active Jobs/);
        card = await mutate('complete', card.id, { revision: card.revision });
        vendor = await life('vendors', vendor, 'delete');
        job = await life('jobs', job, 'delete');
        paper = await life('papers', paper, 'delete');
        const read = (
          await db.query('SELECT * FROM vjt_tracking WHERE id=$1', [card.id])
        ).rows[0];
        assert.equal(read.stages.length, 2);
        assert.equal(read.stages[0].vendor_name, 'A');
        assert.equal(read.paper_type, 'Paper');
        await assert.rejects(mutate('create', null, input), /Recycle Bin/);
        await assert.rejects(
          mutate('reopen', card.id, { revision: card.revision }),
          /Recycle Bin/,
        );
        await assert.rejects(
          db.query('SELECT vjt_save_master($1,$2,$3::jsonb)', [
            'vendors',
            vendor.id,
            JSON.stringify({ name: 'bad edit', revision: vendor.revision }),
          ]),
          /Recycle Bin/,
        );
        await assert.rejects(
          life('vendors', { ...vendor, revision: 1 }, 'restore'),
          (e) => e.code === '40001',
        );
        vendor = await life('vendors', vendor, 'restore');
        job = await life('jobs', job, 'restore');
        paper = await life('papers', paper, 'restore');
        card = await mutate('reopen', card.id, { revision: card.revision });
        assert.equal(card.status, 'Active');
        card = await mutate('delete', card.id, { revision: card.revision });
        vendor = await life('vendors', vendor, 'delete');
        await assert.rejects(
          mutate('restore', card.id, { revision: card.revision }),
          /Recycle Bin/,
        );
        vendor = await life('vendors', vendor, 'restore');
        card = await mutate('restore', card.id, { revision: card.revision });
        assert.equal(card.stages.length, 2);
        const unused = await master('papers', 'Unused');
        await db.exec('SET ROLE service_role');
        await life('papers', unused, 'delete');
        await db.exec('RESET ROLE; SET ROLE anon');
        await assert.rejects(life('vendors', vendor, 'delete'));
      } finally {
        await db.close();
      }
    },
  );
