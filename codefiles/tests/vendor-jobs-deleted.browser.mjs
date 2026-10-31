// Local server with test JWT secret; all data requests are mocked.
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = 'http://localhost:3104';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const token = await new SignJWT({ role: 'admin', username: 'Test only' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode('vendor-job-local-test-secret'));
  await context.addCookies([{ name: 'session', value: token, url: base }]);
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const row = (n, name) => ({ id: id(n), name, deleted_at: new Date().toISOString(), revision: 2 });
  const data = {
    vendors: [{ ...row(1, 'Sarthak Creations'), address: 'Mumbai', concerned_persons: 'Rahul', concerned_contacts: '+91 0123456789', capability_names: 'Printing', purge_blocked: true }],
    jobs: [row(2, 'Printing')],
    papers: Array.from({ length: 55 }, (_, i) => row(100 + i, `Paper ${i}`)),
    cards: [{ ...row(3, ''), job_card_number: 'JB0001', job_title: 'Archived gift boxes', product_type: 'Carton', created_at: new Date().toISOString(), paper_type: 'Art', quantity: 10, current_vendor: 'Sarthak Creations', current_job: 'Printing', status: 'Active', remarks: 'Test', vendor_history: 'Sarthak Creations — Printing' }],
  };
  const calls = [];
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/settings') return route.fulfill({ json: { recycle_retention_days: 7 } });
    if (url.pathname === '/api/vendor-jobs/deleted') return route.fulfill({ json: data[url.searchParams.get('kind')] });
    if (url.pathname === '/api/vendor-jobs/masters') return route.fulfill({ json: { vendors: data.vendors.map(r => ({...r, capabilities: []})), jobs: data.jobs, papers: data.papers } });
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON(); calls.push({ path: url.pathname, input });
      const kind = url.pathname.includes('/cards/') ? 'cards' : url.pathname.split('/')[4];
      const recordId = url.pathname.split('/').at(-1);
      data[kind] = data[kind].filter(r => r.id !== recordId);
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/vendor-jobs/deleted');
  await page.getByText('Sarthak Creations', { exact: true }).waitFor();
  assert.match(await page.locator('.masters-page').innerText(), /kept for 7 days/);
  assert.match(await page.locator('tbody').innerText(), /Protected: in use/);
  await page.screenshot({ path: process.env.TEMP + '/vjt-deleted-vendors.png', fullPage: true });
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.locator('.modal-content').getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByText('Recycle Bin is empty for this category.').waitFor();
  assert.equal(calls[0].input.action, 'restore');
  await page.getByRole('button', { name: 'Paper Types', exact: true }).click();
  await page.getByText('Paper 0', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();
  await page.getByText('Paper 50', { exact: true }).waitFor();
  await page.getByLabel('Select Paper 50', { exact: true }).check();
  await page.getByLabel('Select Paper 51', { exact: true }).check();
  await page.getByRole('button', { name: 'Restore Selected', exact: true }).click();
  await page.getByRole('button', { name: 'Restore All', exact: true }).click();
  await page.getByText('Showing 51 to 53 of 53', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Job Cards', exact: true }).click();
  await page.getByText('JB0001', { exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Archived gift boxes', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Carton', exact: true }).waitFor();
  await page.screenshot({ path: process.env.TEMP + '/vjt-deleted-cards.png', fullPage: true });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Forever', exact: true }).click();
  await page.getByText('Recycle Bin is empty for this category.').waitFor();
  assert.equal(calls.at(-1).input.action, 'purge');
  await page.goto(base + '/vendor-jobs/masters/jobs');
  await page.getByRole('button', { name: 'Deleted Records (1)', exact: true }).click();
  await page.getByText('Printing', { exact: true }).waitFor();
  assert.match(page.url(), /deleted\?tab=jobs/);
  assert.deepEqual(errors, []);
  console.log('PASS: tabs, fields, retention, restore, pagination, bulk restore, permanent delete, and master navigation');
} finally { await browser.close(); }
