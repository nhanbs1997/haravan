import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { saveLogin, callbackHandler, safeError } from './haravan-login.mjs';

let records = { '111': { name: 'Existing shop' } };
let writes = 0;
const auth = { exists: async () => true, read: async () => structuredClone(records),
  write: async value => { records = structuredClone(value); writes++; } };
const tokens = { access_token: 'synthetic-test-value', claims: () => ({ orgid: '222' }) };
const client = { callback: async () => tokens };
assert.equal(await saveLogin({ client, auth, expectedOrg: '222' }), '222');
assert.equal(records['111'].name, 'Existing shop');
await assert.rejects(saveLogin({ client, auth, expectedOrg: '333' }), /Wrong organization/);
assert.equal(writes, 1);
await assert.rejects(saveLogin({ client: { callback: async () => ({}) }, auth }), /Missing access/);
await assert.rejects(saveLogin({ client, auth: { ...auth, write: async () => { throw new Error('Disk denied'); } } }), /Disk denied/);
assert.equal(safeError({ jwt: 'private-test-value', message: 'private-test-value' }), 'LOGIN_FAILED');
assert.equal(safeError({ now: 100, nbf: 133 }), 'CLOCK_SKEW');

const events = [];
const handler = callbackHandler({ callbackPath: '/install/callback',
  complete: async () => { events.push('saved'); return '222'; },
  finish: error => { assert.equal(error, null); events.push('finished'); } });
const response = { writeHead(status) { events.push(status); return this; }, end(text, done) { events.push('response'); done?.(); } };
await handler({ url: '/favicon.ico', method: 'GET' }, response);
assert.deepEqual(events, [404, 'response']);
events.length = 0;
await handler({ url: '/install/callback?code=test', method: 'GET' }, response);
assert.deepEqual(events, ['saved', 200, 'response', 'finished']);
console.log('PASS: session persistence, wrong org, missing token, write failure, redaction, callback ordering');

// Exercise the actual installed validator with synthetic signed tokens only.
if (process.argv[2]) {
  const require = createRequire(join(process.argv[2], 'package.json'));
  const { Issuer, custom } = require('openid-client');
  const issuer = new Issuer({ issuer: 'https://example.test' });
  const secret = 'synthetic-test-secret-at-least-32-characters';
  const validator = new issuer.Client({ client_id: 'test', client_secret: secret });
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (skew, overrides = {}) => {
    const data = `${encode({ alg: 'HS256' })}.${encode({ iss: issuer.issuer,
      sub: 'test', aud: 'test', iat: now, nbf: now + skew, exp: now + 300, ...overrides })}`;
    return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
  };
  validator[custom.clock_tolerance] = 30;
  await assert.rejects(validator.validateJWT(jwt(33), 'HS256'), /not active yet/);
  validator[custom.clock_tolerance] = 60;
  await validator.validateJWT(jwt(33), 'HS256');
  await assert.rejects(validator.validateJWT(jwt(120), 'HS256'), /not active yet/);
  await assert.rejects(validator.validateJWT(jwt(0, { exp: now - 120 }), 'HS256'), /expired/);
  await assert.rejects(validator.validateJWT(jwt(0, { iss: 'https://wrong.test' }), 'HS256'), /unexpected iss/);
  const valid = jwt(0);
  await assert.rejects(validator.validateJWT(valid.slice(0, valid.lastIndexOf('.') + 1) + 'invalid', 'HS256'));
  console.log('PASS: original 33s failure reproduced; 60s tolerance succeeds; large skew, expired, wrong issuer and bad signature rejected');
}
