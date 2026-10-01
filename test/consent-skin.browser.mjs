import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { privacy, skin } from './fixtures.mjs';

// Separate loopback browser context. Only synthetic identities, terms and pixels.
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const session = `passport-consent-skin-${process.pid}`;
const id = '00000000-0000-4000-8000-000000000010';
const token = 'synthetic-link-token';
const future = () => new Date(Date.now() + 3_600_000).toISOString();
let state;
function reset(options = {}) {
  state = { authenticated: false, notice: privacy, privacyFails: false, skin, skinFails: false,
    startBodies: [], confirmBodies: [], webConfirmed: false, linked: false, rejectVersion: false, expiresAt: future(), ...options };
}
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  const body = async () => { let text = ''; for await (const part of request) text += part; return JSON.parse(text); };
  if (url.pathname === '/v1/privacy') return state.privacyFails ? json(503, { code: 'unavailable' }) : json(200, state.notice);
  if (url.pathname === '/v1/auth/session') return json(200, { authenticated: state.authenticated, authMode: 'university', csrfToken: 'synthetic-csrf' });
  if (url.pathname === '/v1/me') return json(200, {
    id: '00000000-0000-4000-8000-000000000001', displayName: '합성 테스트 회원', identityProvider: 'usaint', department: '가상 학과',
    academicStatus: 'ENROLLED', universityVerifiedAt: new Date().toISOString(), universityVerifiedUntil: future(), accessSuspended: false,
    membership: { status: 'active', effectiveStatus: 'active', roleLabel: 'Overworld 회원', verifiedUntil: future() },
    minecraft: state.linked ? { uuid: '00000000-0000-4000-8000-000000000002', name: 'SyntheticPlayer' } : null,
    discordConnection: null, csrfToken: 'synthetic-csrf',
  });
  if (url.pathname === '/v1/me/servers') return json(200, { servers: [{ id: 'fixture_lobby', label: '가상 로비' }, { id: 'fixture_survival', label: '가상 야생 서버' }] });
  if (url.pathname.endsWith('/inspect')) {
    assert.equal(request.method, 'POST'); assert.equal((await body()).token, token);
    return json(200, { id, minecraftName: 'SyntheticPlayer', minecraftUuid: '00000000-0000-4000-8000-000000000002',
      status: state.linked ? 'linked' : 'pending', expiresAt: state.expiresAt, webConfirmed: state.webConfirmed, gameConfirmed: state.linked });
  }
  if (url.pathname.endsWith('/skin') || url.pathname === '/v1/me/minecraft-skin') {
    if (url.pathname.endsWith('/skin')) {
      assert.equal(request.headers['x-csrf-token'], 'synthetic-csrf'); assert.equal((await body()).token, token); assert.equal(url.search, '');
    }
    return state.skinFails ? json(503, { code: 'unavailable' }) : json(200, state.skin);
  }
  if (url.pathname === '/v1/auth/university/start' || url.pathname.endsWith('/web-confirm')) {
    assert.equal(request.headers['x-csrf-token'], 'synthetic-csrf');
    const value = await body();
    if (url.pathname.endsWith('/start')) state.startBodies.push(value); else state.confirmBodies.push(value);
    if (state.rejectVersion) { state.notice = { ...privacy, version: 'next-test-version' }; return json(409, { code: 'consent_version_mismatch' }); }
    if (url.pathname.endsWith('/start')) return json(503, { code: 'university_provider_not_configured' });
    state.webConfirmed = true;
    return json(200, { id, status: 'pending', expiresAt: state.expiresAt });
  }
  const requested = path.resolve(dist, `.${url.pathname === '/' || url.pathname.startsWith('/link/') ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, { code: 'not_found' });
  try {
    const content = await readFile(requested);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Content-Security-Policy': csp }); response.end(content);
  } catch { json(404, { code: 'not_found' }); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', session, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async (expression) => { let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async (expression) => { for (let n = 0; n < 12; n++) { if (await inspect(expression)) return; await new Promise(resolve => setTimeout(resolve, 500)); } assert.fail('Expected browser state not observed'); };
const consent = () => browser('find', 'role', 'checkbox', 'check', '--name', '개인정보 수집·이용에 동의합니다.');
const click = (name) => browser('find', 'role', 'button', 'click', '--name', name);
const open = async (url) => { await browser('open', 'about:blank'); await browser('open', url); await browser('wait', '--load', 'networkidle'); };

test('explicit consent and local skin rendering', { timeout: 240_000 }, async (t) => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const linkUrl = `${origin}/link/${id}#token=${token}`;
  try {
    await t.test('login shows target before unchecked consent, sends exact consent and link, keeps pixels local', async () => {
      reset(); await open(linkUrl); await browser('set', 'viewport', '1440', '900');
      const snapshot = await browser('snapshot', '-i');
      assert.ok(snapshot.includes('동의하고 학교 계정으로 연결'));
      assert.equal(await inspect('Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog]"))'), false);
      assert.equal(await browser('errors'), ''); await browser('console');
      await until('Boolean(document.querySelector("canvas.skin-visible"))');
      assert.equal(await inspect('document.querySelector("input[type=checkbox]").checked'), false);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      assert.equal(state.startBodies.length, 0);
      assert.equal(await inspect('location.hash'), '');
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0);
      assert.equal(await inspect('document.querySelector(".privacy-purpose").textContent'), privacy.purpose);
      await browser('find', 'text', '수집 항목과 보관 안내 보기', 'click');
      for (const expected of [...privacy.items, privacy.retention, privacy.withdrawal]) assert.equal(await inspect(`document.querySelector('.privacy-details').textContent.includes(${JSON.stringify(expected)})`), true);
      await browser('find', 'text', '수집 항목과 보관 안내 보기', 'click');
      await browser('screenshot', '/tmp/passport-web-consent-login-desktop.png');
      await browser('set', 'viewport', '390', '844'); await browser('screenshot', '/tmp/passport-web-consent-login-mobile.png');
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await inspect("[...document.fonts].some(f => f.family.includes('Pretendard') && f.status === 'loaded')"), true);
      assert.equal(await inspect("performance.getEntriesByType('resource').filter(e => !e.name.startsWith(location.origin + '/') && !e.name.startsWith('data:')).length"), 0);
      assert.equal(await inspect('document.querySelectorAll("[style]").length'), 0);
      await consent(); await click('동의하고 학교 계정으로 연결');
      await until("document.body.textContent.includes('학교 로그인을 잠시 사용할 수 없습니다')");
      assert.deepEqual(state.startBodies, [{ consent: { accepted: true, version: privacy.version }, link: { id, token } }]);
    });
    await t.test('root login requires consent without inventing a link', async () => {
      reset({ skin: { dataUrl: null, model: null } }); await open(origin);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      await consent(); await click('동의하고 학교 계정으로 로그인');
      await until("document.body.textContent.includes('학교 로그인을 잠시 사용할 수 없습니다')");
      assert.deepEqual(state.startBodies, [{ consent: { accepted: true, version: privacy.version } }]);
    });
    await t.test('missing notice blocks and retry recovers; cosmetic skin failure never blocks consent', async () => {
      reset({ privacyFails: true, skinFails: true }); await open(linkUrl);
      assert.equal(await inspect('document.querySelector("input[type=checkbox]") === null'), true);
      assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), true);
      assert.equal(await inspect('Boolean(document.querySelector(".skin-placeholder"))'), true);
      state.privacyFails = false; await click('안내 다시 불러오기');
      await until('Boolean(document.querySelector("input[type=checkbox]"))');
      assert.equal(await inspect('document.querySelector("input[type=checkbox]").checked'), false);
      await consent(); assert.equal(await inspect('document.querySelector(".login-actions .primary").disabled'), false);
      assert.equal(state.startBodies.length, 0);
    });
    await t.test('signed-in connection consent refreshes after version mismatch and never auto resubmits', async () => {
      reset({ authenticated: true, rejectVersion: true }); await open(linkUrl);
      await until('Boolean(document.querySelector("canvas.skin-visible"))');
      assert.equal(await inspect('document.querySelector(".connection-confirm .primary").disabled'), true);
      await consent(); await click('동의하고 이 Minecraft 계정 연결');
      await until("document.body.textContent.includes('개인정보 안내가 변경되었습니다')");
      assert.equal(state.confirmBodies.length, 1);
      assert.equal(await inspect('document.querySelector("input[type=checkbox]").checked'), false);
      assert.equal(await inspect('document.querySelector(".connection-confirm .primary").disabled'), true);
      state.rejectVersion = false; await consent(); await click('동의하고 이 Minecraft 계정 연결');
      await until("document.body.textContent.includes('게임 접속을 확인하고 있어요')");
      assert.deepEqual(state.confirmBodies[1], { token, consent: { accepted: true, version: 'next-test-version' } });
      assert.equal(await inspect('document.querySelector("input[type=checkbox]") === null'), true);
    });
    await t.test('callback linking failure preserves school session and never echoes query text or external skin URL', async () => {
      reset({ authenticated: true, skin: { dataUrl: 'https://avatar.invalid/never-request', model: 'classic' } });
      await open(`${origin}/link/${id}?link_error=unknown-sensitive-value#token=${token}`);
      assert.equal(await inspect('location.search + location.hash'), '');
      assert.equal(await inspect("document.body.textContent.includes('합성 테스트 회원')"), true);
      assert.equal(await inspect("document.body.textContent.includes('아래 연결 상태를 확인하고 다시 시도')"), true);
      assert.equal(await inspect("document.body.textContent.includes('unknown-sensitive-value')"), false);
      assert.equal(await inspect('Boolean(document.querySelector(".skin-placeholder"))'), true);
      assert.equal(await inspect("performance.getEntriesByType('resource').some(e => e.name.includes('avatar.invalid'))"), false);
      assert.equal(state.confirmBodies.length, 0);
      await consent(); await click('동의하고 이 Minecraft 계정 연결');
      await until("document.body.textContent.includes('게임 접속을 확인하고 있어요')");
      assert.equal(await inspect("document.body.textContent.includes('아래 연결 상태를 확인하고 다시 시도')"), false);
    });
    await t.test('callback with web confirmation needs no second checkbox or command, and dashboard renders linked skin', async () => {
      reset({ authenticated: true, webConfirmed: true }); await open(linkUrl);
      assert.equal(await inspect('document.querySelector("input[type=checkbox]") === null'), true);
      assert.equal(await inspect("document.body.textContent.includes('/passport confirm')"), false);
      state.linked = true;
      await until("document.body.textContent.includes('계정 연결이 완료되었습니다')");
      assert.equal(state.confirmBodies.length, 0);
      await open(origin); await browser('set', 'viewport', '1440', '1000');
      await until('Boolean(document.querySelector("canvas.skin-visible"))');
      assert.equal(await inspect('document.querySelector("canvas").width'), 160);
      assert.equal(await inspect('document.querySelector("canvas").getContext("2d").getImageData(50, 10, 1, 1).data[3]'), 255);
      await browser('snapshot', '-i'); await browser('screenshot', '/tmp/passport-web-skin-dashboard-desktop.png');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".app-sidebar")).width'), '216px');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".topbar")).height'), '64px');
      await browser('set', 'viewport', '390', '844'); await browser('screenshot', '/tmp/passport-web-skin-dashboard-mobile.png');
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await inspect("performance.getEntriesByType('resource').filter(e => !e.name.startsWith(location.origin + '/') && !e.name.startsWith('data:')).length"), 0);
      assert.equal(await browser('errors'), '');
    });
  } finally {
    await browser('close').catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
});
