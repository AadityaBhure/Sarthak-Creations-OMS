import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImport, saveImport } from '../lib/vendor-jobs/import.mjs';

const jobs = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Printing' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Lamination', deleted_at: '2026-01-01' },
];

test('vendor import resolves active capabilities and preserves contact text', () => {
  const { records, skippedRows } = prepareImport('vendors', [
    { name: ' ABC ', job_capabilities: ' PRINTING ; printing; ', concerned_contacts: '+91 0123456789; 0012345' },
    { name: 'No capabilities' },
  ], [], jobs);
  assert.equal(skippedRows.length, 0);
  assert.equal(records[0].data.name, 'ABC');
  assert.deepEqual(records[0].data.capabilities, [jobs[0].id]);
  assert.equal(records[0].data.concerned_contacts, '+91 0123456789; 0012345');
  assert.deepEqual(records[1].data.capabilities, []);
});

test('missing or deleted capabilities require confirmation and skip whole vendor', () => {
  const rows = [{ name: 'Invalid', job_capabilities: 'Printing; Lamination; Cutting' }, { name: 'Valid' }];
  assert.equal(prepareImport('vendors', rows, [], jobs).requiresConfirmation, true);
  const plan = prepareImport('vendors', rows, [], jobs, true);
  assert.equal(plan.records.length, 1);
  assert.equal(plan.records[0].data.name, 'Valid');
  assert.match(plan.skippedRows[0].reason, /lamination; cutting/);
});

test('paper import rejects duplicates, recycled records, empty and oversized names', () => {
  const plan = prepareImport('papers', [
    { name: 'Art' }, { name: ' art ' }, { name: 'DELETED' }, { name: 'Existing' },
    { name: '' }, { name: 'x'.repeat(201) }, null,
  ], [{ name: 'Deleted', deleted_at: '2026-01-01' }, { name: 'Existing' }]);
  assert.equal(plan.records.length, 1);
  assert.equal(plan.skippedRows.length, 6);
  assert.match(plan.skippedRows[1].reason, /Recycle Bin/);
  assert.throws(() => prepareImport('jobs', [{ name: 'Test' }], []));
  assert.throws(() => prepareImport('papers', [], []));
});

test('imports over 200 rows report actual saves, audit them, and continue after row failures', async () => {
  const plan = prepareImport('papers', Array.from({ length: 205 }, (_, i) => ({ name: `Paper ${i}` })), []);
  const audited = [];
  const result = await saveImport(plan, async data => {
    if (data.name === 'Paper 5') throw { code: '23505' };
    if (data.name === 'Paper 201') throw { code: '23503' };
    return { after: data };
  }, async saved => audited.push(saved.after.name));
  assert.equal(result.inserted, 203);
  assert.equal(result.skipped, 2);
  assert.equal(audited.length, 203);
  assert.equal(result.insertedRows.at(-1).name, 'Paper 204');
  assert.match(result.skippedRows[0].reason, /Duplicate/);
});
