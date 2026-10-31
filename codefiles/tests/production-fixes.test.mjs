import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { readExportTable, EXPORT_TABLES } from '../lib/database-export.mjs';

function database(rows, cap = 100, failAt = Infinity) {
  return { from() { return { select() { return this; }, order() { return this; },
    async range(start, end) {
      return start >= failAt ? { error: { message: 'offline' } } :
        { data: rows.slice(start, Math.min(end + 1, start + cap)), count: rows.length };
    } }; } };
}
test('export reads beyond server row caps and rejects partial failures', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  assert.deepEqual(await readExportTable(database(rows), 'orders', ['id']), rows);
  await assert.rejects(readExportTable(database(rows, 100, 200), 'orders', ['id']), /Could not export/);
  assert.ok(EXPORT_TABLES.some(([name]) => name === 'vjt_stages'));
  assert.ok(!EXPORT_TABLES.some(([name]) => name === 'completed_orders'));
});
test('export rejects a changing row count', async () => {
  let calls = 0;
  const db = { from() { return { select() { return this; }, order() { return this; },
    async range() { return { data: [{ id: calls++ }], count: calls === 1 ? 3 : 4 }; }
  }; } };
  await assert.rejects(readExportTable(db, 'orders', ['id']), /changed during export/);
});
test('updated XLSX retains supported spreadsheet import formats and text contacts', () => {
  const values = [['Vendor Name', 'Contact'], ['Sarthak Creations', '00123456789']];
  for (const bookType of ['xlsx', 'biff8', 'csv']) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(values), 'Vendors');
    const binary = XLSX.write(book, { type: 'binary', bookType });
    const parsed = XLSX.read(binary, { type: 'binary', raw: true });
    assert.deepEqual(XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]], { header: 1 }), values);
  }
});
async function loadWithMocks(path, prelude) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  return import(`data:text/javascript;base64,${Buffer.from(prelude + source).toString('base64')}`);
}
test('admin guard rejects anonymous and ordinary users, permits admin', async () => {
  const { requireAdmin } = await loadWithMocks('../lib/require-admin.js', `
    const cookies = async () => ({ get: () => ({ value: 'test-token' }) });
    const verifyToken = async () => globalThis.testSession;
  `);
  try {
    globalThis.testSession = null;
    assert.equal((await requireAdmin()).status, 401);
    globalThis.testSession = { role: 'executive' };
    assert.equal((await requireAdmin()).status, 403);
    globalThis.testSession = { role: 'admin' };
    assert.equal(await requireAdmin(), null);
  } finally { delete globalThis.testSession; }
});
test('cron denies missing/wrong secret and reports database failure', async () => {
  const previous = process.env.CRON_SECRET;
  const { GET } = await loadWithMocks('../app/api/keepalive/route.js', `
    const createServerClient = () => ({ from: () => ({ select: () => ({ limit: async () => ({ error: globalThis.cronError }) }) }) });
  `);
  const request = (value) => new Request('http://localhost/api/keepalive', { headers: value ? { authorization: value } : {} });
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(request('Bearer undefined'))).status, 401);
    process.env.CRON_SECRET = 'test-cron-secret';
    assert.equal((await GET(request())).status, 401);
    assert.equal((await GET(request('Bearer wrong'))).status, 401);
    assert.equal((await GET(request('Bearer test-cron-secret'))).status, 200);
    globalThis.cronError = { message: 'database unavailable' };
    assert.equal((await GET(request('Bearer test-cron-secret'))).status, 500);
  } finally {
    delete globalThis.cronError;
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('sensitive handlers reject requests before reading input or accessing the database', async () => {
  const routes = {
    'settings': ['POST'], 'executives': ['POST'], 'executives/[id]': ['PATCH', 'DELETE'],
    'trash/[table]': ['GET', 'DELETE'], 'trash/[table]/restore': ['POST'],
    'trash/[table]/bulk': ['POST'], 'logs/cleanup': ['GET'],
    'orders/migrate-status': ['POST'], 'export-database': ['GET'],
  };
  for (const [path, methods] of Object.entries(routes)) {
    const route = await loadWithMocks(`../app/api/${path}/route.js`, `
      const requireAdmin = async () => new Response('Forbidden', { status: 403 });
      const createServerClient = () => { throw new Error('Database must not be reached'); };
    `);
    for (const method of methods) {
      assert.equal((await route[method]({}, { params: Promise.resolve({}) })).status, 403, `${path} ${method}`);
    }
  }
});
