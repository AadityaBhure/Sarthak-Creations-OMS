// Run against a local production server configured with the test JWT_SECRET.
// All data endpoints are mocked; no real business records are read or written.
import { pathToFileURL } from 'node:url';
import { SignJWT } from 'jose';
import assert from 'node:assert/strict';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const base = process.env.TEST_BASE_URL || 'http://localhost:3102';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Local test servers only');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const token = await new SignJWT({ role: 'admin', username: 'Test only' })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('10m')
  .sign(new TextEncoder().encode('vendor-job-local-test-secret'));
await context.addCookies([{ name: 'session', value: token, url: base }]);
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const masters = {
  products: [{ id: id(6), name: 'Carton' }],
  vendors: [
    {
      id: id(1),
      name: 'Vendor A',
      address: 'Mumbai',
      concerned_persons: 'A, B',
      concerned_contacts: '123, 456',
      capabilities: [id(3)],
      revision: 1,
    },
    { id: id(2), name: 'Sarthak Creations', capabilities: [], revision: 1 },
  ],
  jobs: [
    { id: id(3), name: 'Printing', revision: 1 },
    { id: id(4), name: 'Packaging', revision: 1 },
  ],
  papers: [{ id: id(5), name: 'Art Paper', revision: 1 }],
};
let record = {
  serial_number: 1,
  job_title: 'Existing title',
  product_type_id: id(6),
  product_type: 'Carton',
  id: id(10),
  job_card_number: 'JB0001',
  created_at: '2026-09-01T09:00:00.123456Z',
  quantity: 5000,
  paper_type_id: id(5),
  paper_type: 'Art Paper',
  remarks: 'Test batch',
  status: 'Active',
  revision: 1,
  completed_at: null,
  deleted_at: null,
  current_vendor: 'Vendor A',
  current_vendor_id: id(1),
  current_job: 'Printing',
  current_job_id: id(3),
  total_days: 26,
  days_at_current_job: 26,
  vendor_history: 'Vendor A — Printing',
  stages: [
    {
      id: id(11),
      vendor_id: id(1),
      job_type_id: id(3),
      position: 1,
      started_at: '2026-09-01T09:00:00.123456Z',
      vendor_name: 'Vendor A',
      job_name: 'Printing',
    },
  ],
};
const calls = [];
let duplicateWarned = false;
let defaultsFail = false;
await context.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  const input = route.request().postDataJSON();
  const fulfill = (data, status = 200) => route.fulfill({ status, json: data });
  if (path === '/api/settings') return fulfill({ default_pagination: 50 });
  if (path === '/api/vendor-jobs/deleted') {
    const kind = new URL(route.request().url()).searchParams.get('kind');
    return fulfill(kind === 'cards' ? (record.deleted_at ? [record] : []) : masters[kind].filter(r => r.deleted_at));
  }
  if (path === '/api/vendor-jobs/masters')
    return fulfill(
      Object.fromEntries(
        Object.entries(masters).map(([key, rows]) => [
          key,
          new URL(route.request().url()).searchParams.get('includeDeleted') ===
          'true'
            ? rows
            : rows.filter((r) => !r.deleted_at),
        ]),
      ),
    );
  if (path === '/api/vendor-jobs/search') {
    const matches =
      input.statusContext === 'deleted'
        ? record.deleted_at
        : !record.deleted_at &&
          (input.statusContext === 'active' ? ['Active', 'Hold'].includes(record.status)
            : record.status === (input.statusContext === 'canceled' ? 'Canceled' : 'Completed'));
    return fulfill({
      data: matches ? [record] : [],
      meta: { totalRowCount: matches ? 1 : 0 },
    });
  }
  if (path === '/api/quick-views') return fulfill([]);
  if (path === '/api/vendor-jobs/cards' && route.request().method() === 'GET')
    if (defaultsFail)
      return fulfill(
        {
          error: 'Run 20260928_vendor_job_repair_and_master_recycle.sql',
          code: 'SETUP_REQUIRED',
        },
        503,
      );
    else
      return fulfill({
        job_card_number: 'JB0002',
        created_at: '2026-09-28T09:00:00Z',
      });
  calls.push({ path, input });
  if (path === '/api/vendor-jobs/cards')
    return fulfill({ ...record, job_card_number: 'JB0002' }, 201);
  if (path.startsWith('/api/vendor-jobs/masters/')) {
    const parts = path.split('/');
    const row = masters[parts[4]]?.find((r) => r.id === parts[5]);
    if (row) {
      row.deleted_at =
        input.action === 'delete' ? '2026-09-28T12:00:00Z' : null;
      row.revision++;
    }
    return fulfill({ record: row, success: true });
  }
  if (path === `/api/vendor-jobs/cards/${record.id}`) {
    if (
      input.action === 'save' &&
      input.job_card_number === 'JB0005' &&
      !input.confirm_duplicate
    ) {
      duplicateWarned = true;
      return fulfill(
        {
          error:
            'Job Card Number JB0005 already exists. Do you want to continue?',
          code: 'DUPLICATE_NUMBER',
        },
        409,
      );
    }
    if (input.action === 'save')
      record = { ...record, ...input, ...(input.status === 'Canceled' ? { canceled_at: '2026-10-29T09:00:00Z' } : {}), revision: record.revision + 1 };
    if (input.action === 'complete')
      record = {
        ...record,
        status: 'Completed',
        completed_at: '2026-09-27T09:00:00Z',
        revision: record.revision + 1,
      };
    if (input.action === 'delete')
      record = {
        ...record,
        deleted_at: '2026-09-27T09:00:00Z',
        revision: record.revision + 1,
      };
    if (input.action === 'restore')
      record = { ...record, deleted_at: null, revision: record.revision + 1 };
    return fulfill({ record, success: true });
  }
  return fulfill({ error: 'Unexpected test request' }, 500);
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const select = async (label, name) => {
  await page.getByRole('combobox', { name: label, exact: true }).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
};
try {
  await page.goto(base + '/vendor-jobs/active');
  await page
    .getByRole('combobox', { name: 'Current Vendor JB0001', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Update Progress', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator('td')
      .getByRole('button', { name: 'Mark Completed', exact: true })
      .count(),
    0,
  );
  await select('Current Vendor JB0001', 'Sarthak Creations');
  await select('Current Job JB0001', 'Packaging');
  assert.equal(calls.length, 0);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  assert.equal(calls.length, 0);
  await select('Current Vendor JB0001', 'Sarthak Creations');
  await select('Current Job JB0001', 'Packaging');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page
    .getByRole('button', { name: /Save Changes/ })
    .waitFor({ state: 'hidden' });
  assert.ok(
    calls.some(
      (c) =>
        c.input.action === 'save' &&
        c.input.vendor_id === id(2) &&
        c.input.job_type_id === id(4),
    ),
  );
  await page.getByRole('checkbox', { name: 'Editable', exact: true }).check();
  await page.getByRole('textbox', { name: 'Job Title JB0001', exact: true }).fill('Wedding boxes');
  await select('Product Type JB0001', 'Carton');
  await page
    .getByRole('textbox', { name: 'Job Card Number JB0001', exact: true })
    .fill('JB0005');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByRole('button', { name: 'Continue Anyway' }).click();
  await page
    .getByRole('textbox', { name: 'Job Card Number JB0005', exact: true })
    .waitFor();
  assert.ok(duplicateWarned);
  assert.ok(calls.some(c => c.input.job_title === 'Wedding boxes' && c.input.product_type_id === id(6)));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = ''; for await (const chunk of stream) csv += chunk.toString();
  assert.ok(csv.includes('Job Title') && csv.includes('Product Type') && csv.includes('Wedding boxes') && csv.includes('Carton'));
  await page
    .getByRole('button', { name: 'Edit Sequence', exact: true })
    .click();
  await select('Stage 1 Job', 'Packaging');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.ok(
    !(
      'started_at' in
      calls.find((c) => c.input.action === 'sequence').input.stages[0]
    ),
  );
  const stageCount = record.stages.length;
  await select('Status JB0005', 'Hold');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByRole('button', { name: /Save Changes/ }).waitFor({ state: 'hidden' });
  assert.equal(record.status, 'Hold');
  assert.equal(record.stages.length, stageCount);
  await page.getByRole('combobox', { name: 'Status JB0005', exact: true }).waitFor();
  await select('Status JB0005', 'Cancel Job');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByText('No Job Cards found matching filters.').waitFor();
  await page.goto(base + '/vendor-jobs/canceled');
  await page.getByRole('columnheader', { name: 'Canceled On', exact: true }).waitFor();
  await page.getByText(/Durations stop at cancellation/).waitFor();
  await page.getByRole('cell', { name: /29\/10\/2026/ }).waitFor();
  await page.getByRole('cell', { name: 'Wedding boxes', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Carton', exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Editable', exact: true }).count(), 0);
  await page.screenshot({ path: process.env.TEMP + '/vendor-jobs-canceled.png', fullPage: true });
  const canceledDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const canceledDownload = await canceledDownloadPromise;
  const canceledStream = await canceledDownload.createReadStream();
  let canceledCSV = ''; for await (const chunk of canceledStream) canceledCSV += chunk.toString();
  assert.ok(canceledCSV.includes('Canceled') && canceledCSV.includes('Wedding boxes'));
  await select('Status JB0005', 'Send to Active');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByText('No Job Cards found matching filters.').waitFor();
  assert.equal(record.serial_number, 1);
  await page.goto(base + '/vendor-jobs/active');
  await select('Status JB0005', 'Mark Completed');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByText('No Job Cards found matching filters.').waitFor();
  await page.goto(base + '/vendor-jobs/completed');
  await page.getByRole('cell', { name: 'Wedding boxes', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Carton', exact: true }).waitFor();
  await select('Status JB0005', 'Send to Active');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await page.getByText('No Job Cards found matching filters.').waitFor();
  assert.equal(record.status, 'Active');
  await page.goto(base + '/vendor-jobs/new');
  await page
    .getByRole('textbox', { name: 'Job Card Number', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Job Card Number', exact: true })
      .inputValue(),
    'JB0002',
  );
  assert.equal(
    await page.getByLabel('Date of Entry', { exact: true }).inputValue(),
    '2026-09-28',
  );
  await page
    .getByRole('textbox', { name: 'Job Card Number', exact: true })
    .fill('CUSTOM');
  await page.getByLabel('Date of Entry', { exact: true }).fill('2026-09-01');
  await select('Vendor', 'Vendor A');
  await select('Job Type', 'Printing');
  await select('Paper Type', 'Art Paper');
  await page.getByRole('textbox', { name: 'Job Title', exact: true }).fill('New wedding batch');
  await select('Product Type', 'Carton');
  await page
    .getByRole('textbox', { name: 'Quantity', exact: true })
    .fill('12000');
  await page.screenshot({
    path: process.env.TEMP + '/vendor-jobs-entry.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save & Add Another' }).click();
  await page.getByText('JB0002 created.').waitFor();
  const created = calls.find((c) => c.path === '/api/vendor-jobs/cards').input;
  assert.equal(created.job_card_number, 'CUSTOM');
  assert.equal(created.quantity, 12000);
  assert.equal(created.job_title, 'New wedding batch');
  assert.equal(created.product_type_id, id(6));
  assert.equal(await page.getByRole('textbox', { name: 'Job Title', exact: true }).inputValue(), '');
  assert.equal(created.created_at, '2026-08-31T18:30:00.000Z');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  for (const [kind, name] of [
    ['vendors', 'Vendor A'],
    ['jobs', 'Printing'],
    ['papers', 'Art Paper'],
  ]) {
    await page.goto(base + '/vendor-jobs/masters/' + kind);
    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await page
      .locator('.modal-overlay')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Deleted Records (1)', exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: 'Deleted Records (1)', exact: true })
      .click();
    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Restore', exact: true })
      .click();
    await page
      .locator('.modal-overlay')
      .getByRole('button', { name: 'Restore', exact: true })
      .click();
    await page.getByText('Recycle Bin is empty for this category.', { exact: true }).waitFor();
    await page.goto(base + `/vendor-jobs/masters/${kind}`);
    await page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Delete', exact: true })
      .waitFor();
  }
  defaultsFail = true;
  await page.goto(base + '/vendor-jobs/new');
  await page.getByRole('button', { name: 'Retry loading form' }).waitFor();
  assert.equal(
    await page.getByText('Loading form data...', { exact: true }).count(),
    0,
  );
  defaultsFail = false;
  await page.getByRole('button', { name: 'Retry loading form' }).click();
  await page
    .getByRole('textbox', { name: 'Job Card Number', exact: true })
    .waitFor();
  await page.goto(base + '/vendor-jobs/active');
  await page
    .getByRole('combobox', { name: 'Status JB0005', exact: true })
    .waitFor();
  await page.screenshot({
    path: process.env.TEMP + '/vendor-jobs-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Toggle light/dark mode' }).click();
  await page.screenshot({
    path: process.env.TEMP + '/vendor-jobs-dark.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.screenshot({
    path: process.env.TEMP + '/vendor-jobs-mobile.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: Hold, cancellation, reopening, CSV export, inline workflow, entry, recycle bins, setup-error retry, desktop/dark/mobile.',
  );
} finally {
  await browser.close();
}
