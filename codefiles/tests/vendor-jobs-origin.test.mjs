import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAllowedOrigin } from '../lib/vendor-jobs/request-origin.mjs';

test('browser host is checked instead of the Next.js bind address', () => {
  const request = (origin, host = 'localhost:3000', method = 'POST') => new Request('http://0.0.0.0:3000/api/vendor-jobs/search', { method, headers: { origin, host } });
  assert.equal(hasAllowedOrigin(request('http://localhost:3000')), true);
  assert.equal(hasAllowedOrigin(request('http://127.0.0.1:3000', '127.0.0.1:3000')), true);
  assert.equal(hasAllowedOrigin(request('http://192.168.1.3:3000', '192.168.1.3:3000')), true);
  for (const origin of ['http://evil.example', 'http://localhost:4000', 'https://localhost:3000', 'null', 'invalid']) {
    assert.equal(hasAllowedOrigin(request(origin)), false, origin);
  }
  assert.equal(hasAllowedOrigin(request('http://evil.example', 'localhost:3000', 'PATCH')), false);
  assert.equal(hasAllowedOrigin(new Request('https://oms.example/api', { method: 'POST', headers: { origin: 'https://oms.example' } })), true);
});
