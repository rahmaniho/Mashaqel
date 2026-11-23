/**
 * آزمون هویت سازمانی SSO/OIDC (فاز ۱۳) با یک IdP شبیه‌سازی‌شده واقعی.
 * شامل Discovery، JWKS، مجوز با PKCE، صدور ID Token امضاشده RS256 و تبادل کد یک‌بارمصرف.
 *
 * اجرا: npm run test:sso
 */

import assert from 'node:assert/strict';
import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp, verifyIdToken } from '../server/server.mjs';

const CLIENT_ID = 'mashaqel-test-client';
const CLIENT_SECRET = 'test-secret';
const REDIRECT_URI = '';

const keypair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKeypair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...keypair.publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };

const idp = { server: null, base: '', codes: new Map() };

function signIdToken(claims, privateKey = keypair.privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function startIdp() {
  idp.server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const json = (status, payload) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(payload));
    };
    if (url.pathname === '/.well-known/openid-configuration') {
      json(200, {
        issuer: idp.base,
        authorization_endpoint: `${idp.base}/authorize`,
        token_endpoint: `${idp.base}/token`,
        jwks_uri: `${idp.base}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
      return;
    }
    if (url.pathname === '/jwks') {
      json(200, { keys: [jwk] });
      return;
    }
    if (url.pathname === '/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? '';
      const state = url.searchParams.get('state') ?? '';
      if (url.searchParams.get('client_id') !== CLIENT_ID || !redirectUri.startsWith('http')) {
        json(400, { error: 'invalid_request' });
        return;
      }
      if (url.searchParams.get('code_challenge_method') !== 'S256' || !url.searchParams.get('code_challenge')) {
        json(400, { error: 'pkce_required' });
        return;
      }
      const code = randomBytes(12).toString('hex');
      idp.codes.set(code, {
        nonce: url.searchParams.get('nonce') ?? '',
        challenge: url.searchParams.get('code_challenge') ?? '',
        redirectUri,
        email: url.searchParams.get('email') ?? 'user@example.com',
        name: url.searchParams.get('name') ?? 'کاربر سازمانی',
        sub: url.searchParams.get('sub') ?? `sub-${code}`,
        tamper: url.searchParams.get('tamper') === '1',
        verified: url.searchParams.get('verified') !== '0',
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', state);
      response.writeHead(302, { location: target.toString() });
      response.end();
      return;
    }
    if (url.pathname === '/token' && request.method === 'POST') {
      const body = new URLSearchParams(await readBody(request));
      const entry = idp.codes.get(body.get('code') ?? '');
      if (!entry) {
        json(400, { error: 'invalid_grant' });
        return;
      }
      idp.codes.delete(body.get('code'));
      const verifier = body.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (challenge !== entry.challenge || body.get('client_secret') !== CLIENT_SECRET) {
        json(400, { error: 'invalid_grant' });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const token = signIdToken(
        {
          iss: idp.base,
          aud: CLIENT_ID,
          sub: entry.sub,
          email: entry.email,
          email_verified: entry.verified,
          name: entry.name,
          nonce: entry.nonce,
          iat: now,
          exp: now + 300,
        },
        entry.tamper ? wrongKeypair.privateKey : keypair.privateKey,
      );
      json(200, { access_token: randomBytes(16).toString('hex'), token_type: 'Bearer', id_token: token, expires_in: 300 });
      return;
    }
    json(404, { error: 'not_found' });
  });
  await new Promise((resolve) => idp.server.listen(0, '127.0.0.1', resolve));
  idp.base = `http://127.0.0.1:${idp.server.address().port}`;
}

async function reservePort() {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

let app;
let base;
let ssoOnlyApp;
let ssoOnlyBase;
let plainApp;
let plainBase;

const oidcConfig = (apiBase, overrides = {}) => ({
  issuer: idp.base,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: `${apiBase}/api/auth/sso/callback`,
  appUrl: 'https://app.example/',
  scope: 'openid email profile',
  defaultRole: 'VIEWER',
  adminEmails: ['boss@example.com'],
  label: 'ورود سازمانی آزمون',
  localLogin: true,
  ...overrides,
});

async function listenApp(options) {
  const instance = createApp(options);
  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  return { instance, base: `http://127.0.0.1:${instance.server.address().port}` };
}

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, body: payload, location: response.headers.get('location') };
}

/** اجرای کامل مسیر ورود سازمانی تا دریافت توکن نشست. */
async function loginViaSso({ email = 'user@example.com', name = 'کاربر سازمانی', sub, tamper = false, verified = true } = {}) {
  const start = await call('/api/auth/sso/start?redirect=/jobs');
  assert.equal(start.status, 302, `start: ${JSON.stringify(start.body)}`);
  const authorizeUrl = new URL(start.location);
  authorizeUrl.searchParams.set('email', email);
  authorizeUrl.searchParams.set('name', name);
  if (sub) authorizeUrl.searchParams.set('sub', sub);
  if (tamper) authorizeUrl.searchParams.set('tamper', '1');
  if (!verified) authorizeUrl.searchParams.set('verified', '0');
  const authorized = await fetch(authorizeUrl, { redirect: 'manual' });
  assert.equal(authorized.status, 302);
  const callbackUrl = authorized.headers.get('location');
  const callback = await call(new URL(callbackUrl).pathname + new URL(callbackUrl).search);
  return { start, authorizeUrl, callback, callbackUrl };
}

async function exchangeCode(code) {
  return call('/api/auth/sso/exchange', { method: 'POST', body: { code } });
}

before(async () => {
  await startIdp();
  const port = await reservePort();
  const apiBase = `http://127.0.0.1:${port}`;
  app = createApp({ dbPath: ':memory:', corsOrigin: '*', oidc: oidcConfig(apiBase) });
  await new Promise((resolve) => app.server.listen(port, '127.0.0.1', resolve));
  base = apiBase;

  const only = await listenApp({ dbPath: ':memory:', corsOrigin: '*', oidc: oidcConfig('http://127.0.0.1:1', { localLogin: false }) });
  ssoOnlyApp = only.instance;
  ssoOnlyBase = only.base;

  const plain = await listenApp({ dbPath: ':memory:', corsOrigin: '*', oidc: null });
  plainApp = plain.instance;
  plainBase = plain.base;
});

after(async () => {
  await new Promise((resolve) => app.server.close(resolve));
  await new Promise((resolve) => ssoOnlyApp.server.close(resolve));
  await new Promise((resolve) => plainApp.server.close(resolve));
  await new Promise((resolve) => idp.server.close(resolve));
});

describe('SSO — وضعیت و ورود سازمانی', () => {
  it('نصب بدون پیکربندی، SSO را غیرفعال نشان می‌دهد', async () => {
    const response = await fetch(`${plainBase}/api/auth/sso/status`);
    const status = await response.json();
    assert.equal(status.enabled, false);
    assert.equal(status.localLogin, true);
    const start = await fetch(`${plainBase}/api/auth/sso/start`, { redirect: 'manual' });
    assert.equal(start.status, 404);
  });

  it('وضعیت SSO فعال و نام ارائه‌دهنده', async () => {
    const status = await call('/api/auth/sso/status');
    assert.equal(status.body.enabled, true);
    assert.equal(status.body.provider, 'ورود سازمانی آزمون');
    assert.equal(status.body.localLogin, true);
  });

  it('شروع ورود: پارامترهای استاندارد OIDC و PKCE', async () => {
    const start = await call('/api/auth/sso/start?redirect=/jobs');
    assert.equal(start.status, 302);
    const url = new URL(start.location);
    assert.equal(url.pathname, '/authorize');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
    assert.equal(url.searchParams.get('redirect_uri'), `${base}/api/auth/sso/callback`);
    assert.equal(url.searchParams.get('scope'), 'openid email profile');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.match(url.searchParams.get('state') ?? '', /^[a-f0-9]{48}$/);
    assert.match(url.searchParams.get('nonce') ?? '', /^[a-f0-9]{32}$/);
    assert.match(url.searchParams.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43}$/);
  });

  it('ورود کامل: کد یک‌بارمصرف، توکن نشست و کاربر ایجادشده', async () => {
    const { callback } = await loginViaSso({ email: 'first.user@example.com', name: 'کاربر نخست' });
    assert.equal(callback.status, 302);
    const redirect = new URL(callback.location);
    assert.equal(redirect.origin + redirect.pathname, 'https://app.example/');
    assert.equal(redirect.searchParams.get('next'), '/jobs');
    const code = redirect.searchParams.get('sso');
    assert.ok(code && code.length === 64);

    const exchange = await exchangeCode(code);
    assert.equal(exchange.status, 200);
    assert.ok(exchange.body.token.length >= 64);
    assert.equal(exchange.body.user.username, 'first.user');
    assert.equal(exchange.body.user.role, 'VIEWER');
    assert.equal(exchange.body.user.fullName, 'کاربر نخست');

    const me = await call('/api/auth/me', { token: exchange.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, 'first.user');
  });

  it('کد یک‌بارمصرف قابل استفاده دوباره نیست', async () => {
    const { callback } = await loginViaSso({ email: 'repeat.user@example.com' });
    const code = new URL(callback.location).searchParams.get('sso');
    assert.equal((await exchangeCode(code)).status, 200);
    assert.equal((await exchangeCode(code)).status, 400);
  });

  it('ورود دوباره همان هویت، کاربر تکراری نمی‌سازد', async () => {
    const first = await loginViaSso({ email: 'stable.user@example.com', name: 'کاربر پایدار', sub: 'sub-stable' });
    const firstExchange = await exchangeCode(new URL(first.callback.location).searchParams.get('sso'));
    const second = await loginViaSso({ email: 'stable.user@example.com', name: 'کاربر پایدار', sub: 'sub-stable' });
    const secondExchange = await exchangeCode(new URL(second.callback.location).searchParams.get('sso'));
    assert.equal(firstExchange.body.user.id, secondExchange.body.user.id);
    const list = await call('/api/users', { token: secondExchange.body.token });
    // نقش VIEWER به فهرست کاربران دسترسی ندارد
    assert.equal(list.status, 403);
  });

  it('ایمیل مدیر سازمانی نقش ADMIN می‌گیرد', async () => {
    const { callback } = await loginViaSso({ email: 'boss@example.com', name: 'مدیر سازمان' });
    const exchange = await exchangeCode(new URL(callback.location).searchParams.get('sso'));
    assert.equal(exchange.status, 200);
    assert.equal(exchange.body.user.role, 'ADMIN');
    const users = await call('/api/users', { token: exchange.body.token });
    assert.equal(users.status, 200);
    assert.ok(users.body.users.some((user) => user.username === 'boss'));
  });

  it('نام کاربری تکراری با پسوند یکتا می‌شود', async () => {
    const first = await loginViaSso({ email: 'dup@one.example', sub: 'sub-dup-1' });
    const second = await loginViaSso({ email: 'dup@two.example', sub: 'sub-dup-2' });
    const a = await exchangeCode(new URL(first.callback.location).searchParams.get('sso'));
    const b = await exchangeCode(new URL(second.callback.location).searchParams.get('sso'));
    assert.equal(a.body.user.username, 'dup');
    assert.equal(b.body.user.username, 'dup-1');
  });

  it('امضای دستکاری‌شده رد می‌شود', async () => {
    const { callback } = await loginViaSso({ email: 'tamper@example.com', tamper: true });
    assert.equal(callback.status, 401);
    assert.equal(callback.body.error, 'SSO_TOKEN');
  });

  it('ایمیل تأییدنشده پذیرفته نمی‌شود', async () => {
    const { callback } = await loginViaSso({ email: 'unverified@example.com', verified: false });
    assert.equal(callback.status, 403);
    assert.equal(callback.body.error, 'SSO_EMAIL');
  });

  it('state تکراری یا نامعتبر رد می‌شود', async () => {
    const replay = await call('/api/auth/sso/callback?code=abc&state=deadbeef');
    assert.equal(replay.status, 400);
    assert.equal(replay.body.error, 'SSO_STATE');
    const missing = await call('/api/auth/sso/callback?state=abc');
    assert.equal(missing.status, 400);
  });

  it('کد ورود منقضی‌شده رد می‌شود', async () => {
    const { callback } = await loginViaSso({ email: 'expired.code@example.com' });
    const code = new URL(callback.location).searchParams.get('sso');
    const { createHash } = await import('node:crypto');
    app.db
      .prepare('UPDATE sso_codes SET expires_at = ? WHERE code_hash = ?')
      .run(new Date(Date.now() - 1000).toISOString(), createHash('sha256').update(code).digest('hex'));
    const exchange = await exchangeCode(code);
    assert.equal(exchange.status, 400);
    assert.equal(exchange.body.error, 'SSO_STATE');
  });
});

describe('SSO — حالت فقط سازمانی و اعتبارسنجی توکن', () => {
  it('با غیرفعال‌بودن ورود محلی، ورود رمزی رد می‌شود', async () => {
    const response = await fetch(`${ssoOnlyBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'anyone', password: 'Whatever@1405' }),
    });
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, 'SSO_ONLY');
    const status = await (await fetch(`${ssoOnlyBase}/api/auth/sso/status`)).json();
    assert.equal(status.localLogin, false);
  });

  it('verifyIdToken: alg غیر RS256 رد می‌شود', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'x', iss: idp.base, aud: CLIENT_ID, exp: 9999999999 })).toString('base64url');
    assert.throws(() => verifyIdToken(`${header}.${payload}.`, { keys: [jwk] }, { issuer: idp.base, clientId: CLIENT_ID }), /الگوریتم/);
  });

  it('verifyIdToken: مخاطب، انقضا و nonce بررسی می‌شوند', () => {
    const now = Math.floor(Date.now() / 1000);
    const make = (claims) => signIdToken({ iss: idp.base, aud: CLIENT_ID, sub: 'unit', iat: now, exp: now + 60, ...claims });
    const jwks = { keys: [jwk] };
    assert.ok(verifyIdToken(make({ nonce: 'n1' }), jwks, { issuer: idp.base, clientId: CLIENT_ID, nonce: 'n1' }).sub === 'unit');
    assert.throws(() => verifyIdToken(make({ aud: 'other' }), jwks, { clientId: CLIENT_ID }), /مخاطب/);
    assert.throws(() => verifyIdToken(make({ exp: now - 5 }), jwks, { clientId: CLIENT_ID }), /منقضی/);
    assert.throws(() => verifyIdToken(make({ nonce: 'a' }), jwks, { clientId: CLIENT_ID, nonce: 'b' }), /nonce/);
    assert.throws(() => verifyIdToken(make({}), { keys: [] }, { clientId: CLIENT_ID }), /کلید/);
  });
});
