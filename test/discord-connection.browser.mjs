import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { privacy } from './fixtures.mjs';

// One isolated loopback context. Never talks to Discord, university or a real member.
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const session = `passport-discord-${process.pid}`;
const id = '00000000-0000-4000-8000-000000000020';
const token = 'synthetic-discord-token';
const account = { discordId: '123456789012345678', username: 'synthetic.member', displayName: '합성 Discord 회원' };
const future = () => new Date(Date.now() + 300_000).toISOString();
let state;
function reset(options = {}) {
  state = { authenticated: false, enabled: true, active: true, linked: false, expired: false, expireConfirm: false, roleStatus: 'pending',
    expiresAt: future(), starts: [], confirms: [], inspectReads: 0, legacyWrites: 0, ...options };
}
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const json = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
  const body = async () => { let value = ''; for await (const part of request) value += part; return JSON.parse(value); };
  if (url.pathname === '/v1/privacy') return json(200, privacy);
  if (url.pathname === '/v1/auth/session') return json(200, { authenticated: state.authenticated, authMode: 'university', features: { discordLinking: state.enabled }, csrfToken: state.authenticated ? 'synthetic-auth-csrf' : 'synthetic-anon-csrf' });
  if (url.pathname === '/v1/me') return json(200, {
    id: '00000000-0000-4000-8000-000000000001', displayName: '합성 학교 회원', identityProvider: 'usaint', department: '가상 학과', academicStatus: 'ENROLLED',
    universityVerifiedAt: new Date().toISOString(), universityVerifiedUntil: future(), accessSuspended: false,
    membership: { status: state.active ? 'active' : 'inactive', effectiveStatus: state.active ? 'active' : 'revoked', roleLabel: '가상 회원', verifiedUntil: future() },
    minecraft: null,
    discordConnection: state.linked ? { ...account, linkedAt: new Date().toISOString(), roleStatus: state.roleStatus, roleUpdatedAt: null } : null,
    csrfToken: 'synthetic-auth-csrf',
  });
  if (url.pathname === '/v1/me/servers') return json(200, { servers: state.active ? [{ id: 'fixture', label: '가상 회원 서버' }] : [] });
  if (url.pathname === `/v1/discord/link-sessions/${id}/inspect`) {
    state.inspectReads++; assert.equal(request.method, 'POST'); assert.equal((await body()).token, token); assert.equal(url.search, '');
    if (!state.enabled) return json(503, { code: 'discord_not_configured' });
    if (state.expired) return json(410, { code: 'discord_link_expired' });
    return json(200, { id, ...account, status: state.linked ? 'linked' : 'pending', expiresAt: state.expiresAt });
  }
  if (url.pathname === `/v1/discord/link-sessions/${id}/web-confirm`) {
    state.confirms.push(await body()); assert.equal(request.headers['x-csrf-token'], 'synthetic-auth-csrf');
    if (state.expireConfirm) { state.authenticated = false; return json(401, { code: 'session_required' }); }
    if (!state.active) return json(403, { code: 'membership_required' });
    state.linked = true;
    return json(200, { id, status: 'linked', expiresAt: state.expiresAt });
  }
  if (url.pathname === '/v1/auth/university/start') {
    state.starts.push({ body: await body(), csrf: request.headers['x-csrf-token'] });
    return json(503, { code: 'university_provider_not_configured' });
  }
  if (url.pathname === '/v1/me/discord-id') { state.legacyWrites++; return json(410, { code: 'removed' }); }
  const requested = path.resolve(dist, `.${url.pathname === '/' || url.pathname.startsWith('/discord/link/') ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, { code: 'not_found' });
  try {
    const data = await readFile(requested);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'" }); response.end(data);
  } catch { json(404, { code: 'not_found' }); }
});
const browser = async (...args) => (await run('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async (expression) => { let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async (expression) => { for (let n = 0; n < 16; n++) if (await inspect(expression)) return; assert.fail('Expected Discord state not observed'); };
const open = async (url) => { await browser('open', 'about:blank'); await browser('open', url); await browser('wait', '--load', 'networkidle'); };
const click = (name) => browser('find', 'role', 'button', 'click', '--name', name);
const consent = () => browser('find', 'role', 'checkbox', 'check', '--name', '개인정보 수집·이용에 동의합니다.');

test('bot-proven Discord linking and applied role status', { timeout: 180_000 }, async (t) => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/discord/link/${id}#token=${token}`;
  try {
    await t.test('anonymous link shows bot identity and sends explicit consent with only Discord context', async () => {
      reset(); await open(url); await browser('set', 'viewport', '390', '844');
      assert.ok((await browser('snapshot', '-i')).includes('동의하고 학교 계정으로 연결'));
      assert.equal(await inspect('Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog]"))'), false);
      assert.equal(await browser('errors'), ''); await browser('console');
      assert.equal(await inspect("document.body.textContent.includes('@synthetic.member')"), true);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      assert.equal(await inspect('location.hash + location.search'), '');
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0);
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await inspect("[...document.fonts].some(f => f.family.includes('Pretendard') && f.status === 'loaded')"), true);
      await browser('screenshot', '/tmp/passport-web-discord-login-mobile.png');
      await consent(); await click('동의하고 학교 계정으로 연결');
      await until("document.body.textContent.includes('학교 로그인을 잠시 사용할 수 없습니다')");
      assert.deepEqual(state.starts, [{ body: { consent: { accepted: true, version: privacy.version }, discordLink: { id, token } }, csrf: 'synthetic-anon-csrf' }]);
    });
    await t.test('signed-in confirmation is explicit, connection precedes role delivery, and status refresh stops at granted', async () => {
      reset({ authenticated: true }); await open(url); await browser('set', 'viewport', '1440', '900');
      assert.equal(await inspect('document.querySelector(".discord-confirm .primary").disabled'), true);
      assert.equal(await inspect('document.querySelector("#discord-id") === null'), true);
      await consent(); await click('동의하고 이 Discord 계정 연결');
      await until("document.body.textContent.includes('역할 처리 대기')");
      assert.equal(await inspect("document.body.textContent.includes('역할 지급 완료')"), false);
      assert.deepEqual(state.confirms, [{ token, consent: { accepted: true, version: privacy.version } }]);
      assert.equal(await inspect("document.body.textContent.includes('연결 해제나 계정 변경은 소모임 관리자')"), true);
      state.roleStatus = 'granted'; await until("document.body.textContent.includes('역할 지급 완료')");
      assert.equal(state.legacyWrites, 0);
      await browser('screenshot', '/tmp/passport-web-discord-connected-desktop.png');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".app-sidebar")).width'), '216px');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".topbar")).height'), '64px');
    });
    await t.test('failed or revoked role never hides a verified account or claims role success, including an expired callback link', async () => {
      reset({ authenticated: true, linked: true, roleStatus: 'failed', expired: true });
      await open(`${origin}/discord/link/${id}?discord_link_error=unknown-sensitive-value#token=${token}`);
      assert.equal(await inspect("document.body.textContent.includes('합성 학교 회원')"), true);
      assert.equal(await inspect("document.body.textContent.includes('@synthetic.member')"), true);
      assert.equal(await inspect("document.body.textContent.includes('계정 연결은 완료됐지만')"), true);
      assert.equal(await inspect("document.body.textContent.includes('역할 지급 완료')"), false);
      assert.equal(await inspect("document.body.textContent.includes('unknown-sensitive-value')"), false);
      assert.equal(await inspect('location.hash + location.search'), '');
      state.roleStatus = 'revoked'; await click('새로고침');
      await until("document.body.textContent.includes('역할 회수됨')");
      assert.equal(await inspect("document.body.textContent.includes('계정 연결은 유지')"), true);
      assert.equal(state.confirms.length, 0);
    });
    await t.test('inactive membership, expired link and missing token do not expose a connection action', async () => {
      reset({ authenticated: true, active: false }); await open(url);
      assert.equal(await inspect('document.querySelector(".discord-confirm") === null'), true);
      assert.equal(state.confirms.length, 0);
      reset({ expired: true }); await open(url);
      assert.equal(await inspect("document.body.textContent.includes('봇') && document.body.textContent.includes('만료')"), true);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      assert.equal(await inspect("document.body.textContent.includes('/passport')"), false);
      reset(); await open(`${origin}/discord/link/${id}`);
      assert.equal(state.inspectReads, 0);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
    });
    await t.test('401 confirmation clears school profile and recovers with a fresh anonymous CSRF', async () => {
      reset({ authenticated: true, expireConfirm: true }); await open(url);
      await consent(); await click('동의하고 이 Discord 계정 연결');
      await until("document.body.textContent.includes('로그인이 만료되었습니다')");
      assert.equal(await inspect("document.body.textContent.includes('합성 학교 회원')"), false);
      assert.equal(await inspect('document.querySelector("input[type=checkbox]").checked'), false);
      await consent(); await click('동의하고 학교 계정으로 연결');
      await until("document.body.textContent.includes('학교 로그인을 잠시 사용할 수 없습니다')");
      assert.equal(state.starts[0].csrf, 'synthetic-anon-csrf');
      assert.equal(state.legacyWrites, 0);
      assert.equal(await browser('errors'), '');
    });
    await t.test('disabled bot integration cannot start a new link while an existing verified connection remains visible', async () => {
      reset({ authenticated: true, enabled: false }); await open(origin);
      await click('Discord 연결');
      assert.equal(await inspect("document.body.textContent.includes('Discord 연동 준비 중')"), true);
      assert.equal(await inspect('document.querySelector(".discord-confirm") === null'), true);
      state.linked = true; state.roleStatus = 'failed'; await click('새로고침');
      await until("document.body.textContent.includes('@synthetic.member')");
      assert.equal(await inspect("document.body.textContent.includes('역할 처리 확인 필요')"), true);
      reset({ enabled: false }); await open(url);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      assert.equal(state.starts.length, 0);
    });
  } finally {
    await browser('close').catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
});
