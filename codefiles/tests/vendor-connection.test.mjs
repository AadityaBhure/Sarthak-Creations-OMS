import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionError } from '../lib/vendor-jobs/connection-error.mjs';
test('Supabase transport errors produce useful messages without exposing raw details', () => {
  assert.match(connectionError({ message: 'TypeError: fetch failed', details: 'getaddrinfo ENOTFOUND private-host' }), /could not be resolved/);
  assert.doesNotMatch(connectionError({ details: 'ENOTFOUND private-host' }), /private-host/);
  assert.match(connectionError({ message: 'TypeError: fetch failed' }), /connection failed/);
  assert.equal(connectionError({ code: '23505', message: 'duplicate value' }), null);
});
