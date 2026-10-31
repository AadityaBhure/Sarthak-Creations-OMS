// Mock-only browser validation. Start a local server with JWT_SECRET=vendor-job-local-test-secret.
import { pathToFileURL } from 'node:url';
import { SignJWT } from 'jose';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.TEST_BASE_URL || 'http://localhost:3104';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local servers only');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  context.setDefaultTimeout(12000);
  const token = await new SignJWT({ role: 'admin', username: 'Test only' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode('vendor-job-local-test-secret'));
  await context.addCookies([{ name: 'session', value: token, url: base }]);
  const calls = [];
  let next = 10;
  let row = { id: 'test-order', serial_number: 7, order_number: null, po_number: 'PO-TEST', date_of_entry: '2026-10-28', quantity: 5, status: 'Design Confirmed', clients: { name: 'Test Client' }, product_names: { name: 'Test Product' }, product_types: { name: 'Test Type' } };
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    const reply = (data, status = 200) => route.fulfill({ status, json: data });
    if (path === '/api/settings') return reply({ status_options: ['Design Confirmed', 'Completed'], default_pagination: 50 });
    if (path === '/api/orders/defaults') return reply({ order_number: next });
    if (path === '/api/clients') return reply([{ id: 'c', name: 'Test Client' }]);
    if (path === '/api/product-names') return reply([{ id: 'p', name: 'Test Product', client_id: 'c' }]);
    if (path === '/api/product-types') return reply([{ id: 't', name: 'Test Type' }]);
    if (path === '/api/orders/search') return reply({ data: [row], meta: { totalRowCount: 1 } });
    if ((path === '/api/orders' && route.request().method() === 'POST') || path === '/api/orders/test-order') {
      calls.push(body);
      if (!body.confirm_duplicate) return reply({ code: 'DUPLICATE_ORDER_NUMBER', error: 'Order Number 10 has already been used. Continue with this duplicate number?' }, 409);
      if (path === '/api/orders') next = 11;
      else row = { ...row, ...body };
      return reply({ ...row, ...body });
    }
    return reply([]);
  });
  // Block external Supabase realtime connections in this mock-only run.
  await context.routeWebSocket(/supabase/, socket => socket.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/orders/new');
  await page.getByLabel('Order Number', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Order Number"]')?.value === '10');
  assert.equal(await page.getByLabel('Serial Number', { exact: true }).getAttribute('readonly'), '');
  await page.getByPlaceholder('Enter PO Num').fill('PO-TEST');
  await page.getByRole('combobox').nth(0).fill('Test Client');
  await page.getByRole('option', { name: 'Test Client', exact: true }).click();
  await page.getByRole('combobox').nth(1).fill('Test Product');
  await page.getByRole('option', { name: 'Test Product', exact: true }).click();
  await page.getByRole('combobox').nth(2).fill('Test Type');
  await page.getByRole('option', { name: 'Test Type', exact: true }).click();
  await page.getByPlaceholder('Enter qty').fill('5');
  await page.getByRole('button', { name: 'Save & Add Another', exact: true }).click();
  await page.getByText('Duplicate Order Number', { exact: true }).waitFor();
  await page.locator('.modal-overlay').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expected_order_number, 10);
  assert.equal(calls[0].confirm_duplicate, false);
  await page.getByRole('button', { name: 'Save & Add Another', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Anyway', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Order Number"]')?.value === '11');
  assert.equal(calls.at(-1).confirm_duplicate, true);
  assert.equal('serial_number' in calls.at(-1), false);
  for (const path of ['/orders', '/orders/completed']) {
    await page.goto(base + path);
    await page.getByRole('columnheader', { name: 'Serial Number' }).waitFor();
    await page.getByRole('columnheader', { name: /^Order Number/ }).waitFor();
    await page.getByText('Editable', { exact: true }).click();
    await page.getByLabel('Order Number PO-TEST', { exact: true }).fill(path === '/orders' ? '10' : '12');
    await page.getByRole('button', { name: /Save Changes/ }).click();
    await page.getByRole('button', { name: 'Continue Anyway', exact: true }).click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Saving...')));
    assert.equal(calls.at(-1).confirm_duplicate, true);
    assert.equal('serial_number' in calls.at(-1), false);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: numbering form, duplicate cancel/confirm, next suggestion, and active/completed edits');
} finally { await browser.close(); }
