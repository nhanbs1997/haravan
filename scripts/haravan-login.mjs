import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Never include raw OAuth errors: they may contain codes, tokens or headers.
export function safeError(error) {
  if (Number.isFinite(error?.nbf) && Number.isFinite(error?.now)) return 'CLOCK_SKEW';
  const allowed = new Set(['EADDRINUSE', 'EACCES', 'ENOTFOUND', 'ETIMEDOUT',
    'ECONNRESET', 'access_denied', 'invalid_grant', 'invalid_client']);
  const code = [error?.code, error?.error].find(value => allowed.has(value));
  return code || 'LOGIN_FAILED';
}

export async function saveLogin({ client, redirectUri, params, checks, auth, expectedOrg }) {
  const tokens = await client.callback(redirectUri, params, checks);
  if (!tokens?.access_token) throw new Error('Missing access token');
  const claims = tokens.claims();
  const org = String(claims.orgid ?? '');
  if (!/^\d+$/.test(org)) throw new Error('Missing organization');
  if (expectedOrg && org !== expectedOrg) {
    const error = new Error('Wrong organization');
    error.actualOrg = org;
    throw error;
  }
  const records = await auth.exists() ? await auth.read() : {};
  records[org] = { ...claims, access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  await auth.write(records);
  const saved = await auth.read();
  if (saved[org]?.access_token !== tokens.access_token) throw new Error('Session was not saved');
  return org;
}

export function callbackHandler({ callbackPath, complete, finish }) {
  let processing = false;
  return async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== callbackPath || request.method !== 'GET') {
      response.writeHead(404).end('Not found');
      return;
    }
    if (processing) { response.writeHead(409).end('Login is being processed'); return; }
    processing = true;
    try {
      const org = await complete(Object.fromEntries(url.searchParams));
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Đã lưu phiên Haravan cho Organization ${org}. Có thể đóng tab này.`);
      finish(null, org);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Chưa đăng nhập thành công. Xem thông báo trong terminal.');
      finish(error);
    }
  };
}

async function main(cliRoot, expectedOrg) {
  const load = path => import(pathToFileURL(join(cliRoot, 'dist', path)).href);
  const [{ getOpenID }, { DOTFILE }, { default: config }] = await Promise.all([
    load('helper/auth.js'), load('helper/dotfile.js'), load('config/app-config.js'),
  ]);
  const require = createRequire(join(cliRoot, 'package.json'));
  const open = require('open');
  const { custom } = require('openid-client');
  const oidc = await getOpenID();
  if (!oidc) throw new Error('Cannot discover authentication service');
  // CLI's 30-second tolerance rejects tokens when the local clock lags by 33s.
  // Keep a bounded allowance; signature, issuer, nonce and expiry checks remain active.
  oidc.client[custom.clock_tolerance] = 60;
  const redirect = new URL(config.install_callback_url);
  if (redirect.hostname !== 'localhost' || redirect.protocol !== 'http:') {
    throw new Error('Unsupported callback configuration');
  }
  const state = randomBytes(32).toString('hex');
  const authorizationUrl = oidc.client.authorizationUrl({
    scope: config.scope_install.join(' '), redirect_uri: redirect.href,
    response_mode: config.response_mode?.join(' '), response_type: config.response_types.join(' '),
    nonce: oidc.nonce, state, prompt: 'login',
  });
  let timer;
  let server;
  try {
    const org = await new Promise((accept, reject) => {
      const finish = (error, org) => error ? reject(error) : accept(org);
      server = createServer(callbackHandler({
        callbackPath: redirect.pathname, finish,
        complete: params => saveLogin({ client: oidc.client, redirectUri: redirect.href,
          params, checks: { nonce: oidc.nonce, state }, auth: DOTFILE.AUTH(false), expectedOrg }),
      }));
      server.on('error', reject);
      timer = setTimeout(() => reject(Object.assign(new Error('Login timed out'), { code: 'ETIMEDOUT' })), 300000);
      server.listen(Number(redirect.port), () => {
        console.log('Đang mở đăng nhập Haravan. Chờ callback và lưu phiên hoàn tất...');
        open(authorizationUrl).catch(reject);
      });
    });
    console.log(`Đã lưu và xác minh phiên Organization ${org}.`);
  } finally {
    clearTimeout(timer);
    server?.close();
    server?.closeAllConnections();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2], process.argv[3]).catch(error => {
    if (error.actualOrg) {
      console.error(`Đã cấp quyền cho Organization ${error.actualOrg}, nhưng cần ${process.argv[3]}. Hãy đăng nhập tài khoản của đúng shop.`);
    } else {
      console.error(`Không lưu được phiên Haravan (${safeError(error)}).`);
      if (safeError(error) === 'CLOCK_SKEW') {
        console.error('Đồng hồ máy lệch quá 60 giây. Đồng bộ giờ Windows rồi đăng nhập lại.');
      } else {
        console.error('Nếu cổng 3300 đang bận, đóng tiến trình login cũ rồi thử lại. Nếu cấp quyền thất bại, đăng nhập lại đúng shop.');
      }
    }
    process.exitCode = 1;
  });
}
