import { test } from 'node:test';
import { privacy } from './fixtures.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Browser regression against loopback-only synthetic responses. Never logs in to
// a school, contacts the deployed API, or changes an actual member.
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sessionName = `passport-expiry-regression-${process.pid}`;
const future = () => new Date(Date.now() + 3_600_000).toISOString();
let authenticated = true;
let expireProfile = false;
let sessionReads = 0;
let nextLoginCsrf = null;
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const json = (status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  if (url.pathname === '/v1/privacy') return json(200, privacy);
  if (url.pathname.endsWith('/skin') || url.pathname === '/v1/me/minecraft-skin') return json(200, { dataUrl: null, model: null });
  if (url.pathname === '/v1/auth/session') {
    sessionReads++;
    return json(200, { authenticated, authMode: 'university', csrfToken: authenticated ? 'synthetic-old-csrf' : 'synthetic-new-csrf' });
  }
  if (url.pathname === '/v1/me' && expireProfile) { expireProfile = false; authenticated = false; return json(401, { code: 'session_required' }); }
  if (url.pathname === '/v1/me') return json(200, {
    id: '00000000-0000-4000-8000-000000000001', displayName: '회귀 테스트 회원', identityProvider: 'usaint',
    department: '가상 학과', academicStatus: 'ENROLLED', universityVerifiedAt: new Date().toISOString(),
    universityVerifiedUntil: future(), accessSuspended: false,
    membership: { status: 'active', effectiveStatus: 'active', roleLabel: '가상 회원', verifiedUntil: future() },
    minecraft: { uuid: '00000000-0000-4000-8000-000000000002', name: 'RegressionOnly' },
    discordConnection: null,
    csrfToken: 'synthetic-old-csrf',
  });
  if (url.pathname === '/v1/me/servers') return json(200, { servers: [{ id: 'fixture', label: '회귀 테스트 서버' }] });
  if (url.pathname === '/v1/auth/logout') {
    authenticated = false;
    return json(401, { code: 'session_required' });
  }
  if (url.pathname === '/v1/auth/university/start') {
    nextLoginCsrf = request.headers['x-csrf-token'];
    return json(503, { code: 'university_provider_not_configured' });
  }
  const requested = path.resolve(dist, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, { code: 'not_found' });
  try {
    const content = await readFile(requested);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type });
    response.end(content);
  } catch { json(404, { code: 'not_found' }); }
});
const browser = async (...args) => {
  const result = await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', sessionName, ...args], { timeout: 30_000, maxBuffer: 1_000_000 });
  return result.stdout.trim();
};
const inspect = async (expression) => {
  let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`));
  if (typeof value === 'string') value = JSON.parse(value);
  return value;
};

test('401 profile refresh and logout remove private portal state and acquire a fresh login CSRF', { timeout: 120_000 }, async (t) => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const action of ['profile-refresh', 'logout']) {
      await t.test(action, async () => {
        authenticated = true;
        sessionReads = 0;
        nextLoginCsrf = null;
        await browser('open', origin);
        await browser('wait', '--load', 'networkidle');
        assert.equal(await inspect("document.body.textContent.includes('회귀 테스트 회원')"), true);
        if (action === 'profile-refresh') {
          expireProfile = true;
          await browser('find', 'role', 'button', 'click', '--name', '새로고침');
        } else {
          await browser('find', 'role', 'button', 'click', '--name', '로그아웃');
        }
        await browser('wait', '--load', 'networkidle');
        const state = await inspect(`({
          loginVisible: [...document.querySelectorAll('button')].some(button => button.textContent.includes('동의하고 학교 계정으로') && button.disabled),
          privateDataRemoved: !['회귀 테스트 회원','회귀 테스트 서버','RegressionOnly','123456789012345678','234567890123456789'].some(value => document.body.textContent.includes(value) || [...document.querySelectorAll('input')].some(input => input.value.includes(value))),
          expiryNotice: document.body.textContent.includes('로그인이 만료되었습니다'),
          storageEmpty: localStorage.length === 0 && sessionStorage.length === 0
        })`);
        assert.deepEqual(state, { loginVisible: true, privateDataRemoved: true, expiryNotice: true, storageEmpty: true });
        assert.ok(sessionReads >= 2, 'refreshes anonymous session after rejection');
        await browser('find', 'role', 'checkbox', 'check', '--name', '개인정보 수집·이용에 동의합니다.');
        await browser('find', 'role', 'button', 'click', '--name', '동의하고 학교 계정으로 로그인');
        await browser('wait', '--load', 'networkidle');
        assert.equal(nextLoginCsrf, 'synthetic-new-csrf', 'never reuses profile CSRF for the next login');
        assert.equal(await browser('errors'), '');
      });
    }
  } finally {
    await browser('close').catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
});
