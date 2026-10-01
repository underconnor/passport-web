import { emptyStats } from './fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { privacy } from './fixtures.mjs';

// Synthetic loopback only: no real school, Minecraft, Discord or deployment session.
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const session = `passport-membership-${process.pid}`;
const id = '00000000-0000-4000-8000-000000000020';
const token = 'synthetic-link-token';
const future = () => new Date(Date.now() + 300_000).toISOString();
const past = () => new Date(Date.now() - 10_000).toISOString();
const universityServer = { id: 'university', label: '합성 학교 서버' };
let state;
function reset(options = {}) {
  state = { authenticated: true, failAnonymousSession: false, member: true, rosterExpired: false, schoolExpired: false, suspended: false, rosterSuspended: false,
    servers: [{ id: 'member', label: '합성 회원 서버' }], failServers: false, linked: false, holdCompletion: false,
    meReads: 0, confirms: [], unexpected: [], release: null, ...options };
}
function profile() {
  return {
    id: '00000000-0000-4000-8000-000000000001', displayName: '합성 사용자', identityProvider: 'usaint', department: '가상 학과', academicStatus: 'ENROLLED',
    universityVerifiedAt: new Date().toISOString(), universityVerifiedUntil: state.schoolExpired ? past() : future(), accessSuspended: state.suspended,
    membership: { status: state.rosterSuspended ? 'suspended' : state.member ? 'active' : 'inactive', effectiveStatus: state.rosterSuspended || state.suspended ? 'suspended' : !state.member ? 'revoked' : state.rosterExpired ? 'stale' : 'active', roleLabel: state.member ? '회원' : '', verifiedUntil: state.rosterExpired ? past() : future() },
    minecraft: state.linked ? { uuid: id, name: 'SyntheticPlayer' } : null, discordConnection: null, csrfToken: 'synthetic-csrf',
  };
}
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const json = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
  const body = async () => { let value = ''; for await (const part of request) value += part; return JSON.parse(value); };
  if (url.pathname === '/v1/privacy') return json(200, privacy);
  if (url.pathname === '/v1/auth/session' && !state.authenticated && state.failAnonymousSession) return json(503, { code: 'temporarily_unavailable' });
  if (url.pathname === '/v1/auth/logout') { state.authenticated = false; response.writeHead(204); response.end(); return; }
  if (url.pathname === '/v1/auth/session') return json(200, { authenticated: state.authenticated, authMode: 'university', features: { discordLinking: true }, csrfToken: 'synthetic-csrf' });
  if (url.pathname === '/v1/me') {
    state.meReads++;
    if (state.holdCompletion && state.meReads === 2) { const old = profile(); let released = false; state.release = () => { if (!released) { released = true; json(200, old); } }; return; }
    return json(200, profile());
  }
  if (url.pathname === '/v1/me/stats') return json(200, emptyStats);
  if (url.pathname === '/v1/me/servers') return state.failServers ? json(503, { code: 'temporarily_unavailable' }) : json(200, { servers: state.servers });
  if (url.pathname.endsWith('/skin') || url.pathname === '/v1/me/minecraft-skin') return json(200, { dataUrl: null, model: null });
  if (url.pathname === `/v1/link-sessions/${id}/inspect`) return json(200, { id, minecraftName: 'SyntheticPlayer', minecraftUuid: id, status: state.linked ? 'linked' : 'pending', expiresAt: future(), webConfirmed: state.linked, gameConfirmed: state.linked });
  if (url.pathname === `/v1/link-sessions/${id}/web-confirm`) {
    state.confirms.push(await body()); assert.equal(request.headers['x-csrf-token'], 'synthetic-csrf');
    state.linked = true; return json(200, { id, status: 'linked', expiresAt: future() });
  }
  if (url.pathname === `/v1/discord/link-sessions/${id}/inspect`) return json(200, { id, discordId: '123456789012345678', username: 'synthetic.member', displayName: '합성 Discord 계정', status: 'pending', expiresAt: future() });
  if (url.pathname.startsWith('/v1/')) { state.unexpected.push(url.pathname); return json(404, { code: 'not_found' }); }
  const requested = path.resolve(dist, `.${url.pathname === '/' || url.pathname.includes('/link/') ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, { code: 'not_found' });
  try {
    const data = await readFile(requested);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'" }); response.end(data);
  } catch { json(404, { code: 'not_found' }); }
});
const browser = async (...args) => (await run(process.env.PASSPORT_AGENT_BROWSER || 'npx', [...(process.env.PASSPORT_AGENT_BROWSER ? [] : ['--yes', 'agent-browser@0.38.1']), '--session', session, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async (expression) => { let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`)); if (typeof value === 'string') value = JSON.parse(value); return value; };
const until = async (expression) => { for (let n = 0; n < 16; n++) { if (await inspect(expression)) return; await new Promise(resolve => setTimeout(resolve, 500)); } assert.fail('Expected membership/server state not observed'); };
const open = async (url, idle = true) => { await browser('open', 'about:blank'); await browser('open', url); if (idle) await browser('wait', '--load', 'networkidle'); };
const click = (name) => browser('find', 'role', 'button', 'click', '--name', name);
const serverNames = () => inspect('[...document.querySelectorAll(".server-list h3")].map(item => item.textContent)');
const empty = () => inspect('document.querySelector("[aria-labelledby=servers-heading] .empty-state h3")?.textContent');

test('club membership and school server permissions stay independent', { timeout: 240_000 }, async (t) => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const linkUrl = `${origin}/link/${id}#token=${token}`;
  try {
    await t.test('member status is prominent and only returned servers appear without per-server permission labels', async () => {
      reset(); await open(origin); await browser('set', 'viewport', '1440', '900');
      assert.ok((await browser('snapshot', '-i')).includes('접속 서버'));
      assert.equal(await inspect('Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog]"))'), false);
      assert.equal(await browser('errors'), ''); await browser('console');
      assert.equal(await inspect('document.querySelector(".membership-label").textContent'), 'Overworld 소모임 회원입니다.');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".membership-symbol.is-member")).backgroundColor'), 'rgb(232, 244, 235)');
      assert.equal(await inspect('document.querySelector(".membership-school strong").textContent'), 'u-SAINT 인증 완료');
      assert.deepEqual(await serverNames(), ['합성 회원 서버']);
      assert.equal(await inspect('document.querySelector(".minecraft-link-notice strong").textContent'), 'Minecraft 계정이 연결되지 않았어요');
      assert.equal(await inspect('document.querySelector(".server-connection strong").textContent'), 'overworld.flyjung.kr');
      assert.equal(await inspect('Boolean(document.querySelector(".minecraft-link-notice").compareDocumentPosition(document.querySelector("#servers-heading")) & Node.DOCUMENT_POSITION_FOLLOWING)'), true);
      assert.equal(await inspect('document.querySelector(".server-list").textContent.includes("허용됨")'), false);
      assert.equal(await inspect("[...document.fonts].some(f => f.family.includes('Pretendard') && f.status === 'loaded')"), true);
      assert.equal(await inspect('getComputedStyle(document.querySelector(".app-sidebar")).width'), '216px');
      assert.equal(await inspect('getComputedStyle(document.querySelector(".topbar")).height'), '64px');
      await browser('screenshot', '/tmp/passport-web-membership-desktop.png');
    });
    await t.test('server address is prominent and copy feedback does not change the allowed vertical list', async () => {
      const second = { id: 'second', label: '합성 건축 서버' };
      reset({ servers: [{ id: 'member', label: '합성 회원 서버' }, second] }); await open(origin); await browser('set', 'viewport', '1440', '900');
      await browser('screenshot', '/tmp/passport-server-ux-member-desktop.png');
      await click('접속 서버');
      assert.equal(await inspect('document.querySelector(".server-connection strong").textContent'), 'overworld.flyjung.kr');
      assert.ok(await inspect('parseFloat(getComputedStyle(document.querySelector(".server-connection strong")).fontSize) >= 28'));
      assert.equal(await inspect('getComputedStyle(document.querySelector(".server-list")).flexDirection'), 'column');
      const rows = await inspect('[...document.querySelectorAll(".server-list li")].map(item => ({ top: item.getBoundingClientRect().top, left: item.getBoundingClientRect().left, bottom: item.getBoundingClientRect().bottom }))');
      assert.equal(rows[0].left, rows[1].left); assert.ok(rows[1].top >= rows[0].bottom);
      // Stub only the browser clipboard boundary; no personal data or system clipboard is read.
      await browser('eval', 'Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { window.copiedServerAddress = value; } } })');
      await click('주소 복사'); await until('document.querySelector(".server-copy-feedback").textContent === "서버 주소를 복사했습니다."');
      assert.equal(await inspect('window.copiedServerAddress'), 'overworld.flyjung.kr');
      await browser('eval', 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
      await browser('set', 'viewport', '1439', '899'); await browser('set', 'viewport', '1440', '900');
      await browser('snapshot', '-i');
      await browser('screenshot', '/tmp/passport-server-ux-servers-desktop.png');
      await browser('eval', 'Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new DOMException("denied", "NotAllowedError"); } } })');
      await browser('click', '.server-address-heading button');
      await until('document.querySelector(".server-copy-feedback").textContent.includes("복사할 수 없습니다.")');
      assert.deepEqual(await serverNames(), ['합성 회원 서버', second.label]);
      await browser('set', 'viewport', '390', '844');
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await inspect('getComputedStyle(document.querySelector(".server-list")).flexDirection'), 'column');
      await browser('eval', 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
      await browser('screenshot', '/tmp/passport-server-ux-servers-mobile.png', '--full');
      reset({ servers: [], member: false }); await open(origin); await click('접속 서버');
      assert.equal(await inspect('document.querySelector(".server-connection strong").textContent'), 'overworld.flyjung.kr');
      assert.equal(await empty(), '접속 가능한 서버가 없습니다');
      assert.deepEqual(await serverNames(), []);
      await browser('set', 'viewport', '389', '843'); await browser('set', 'viewport', '390', '844');
      await browser('snapshot', '-i');
      await browser('screenshot', '/tmp/passport-server-ux-no-access-mobile.png', '--full');
    });
    await t.test('nonmember sees a returned university server and can link Minecraft and school-verified Discord linking is available', async () => {
      reset({ member: false, servers: [universityServer] }); await open(origin); await browser('set', 'viewport', '390', '844');
      assert.equal(await inspect('document.querySelector(".membership-label").textContent'), '소모임 비회원');
      assert.deepEqual(await serverNames(), [universityServer.label]);
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      await browser('screenshot', '/tmp/passport-web-nonmember-mobile.png');
      await open(linkUrl);
      assert.equal(await inspect('Boolean(document.querySelector(".connection-confirm"))'), true);
      await browser('find', 'role', 'checkbox', 'check', '--name', '개인정보 수집·이용에 동의합니다.');
      await click('동의하고 이 Minecraft 계정 연결');
      await until("document.body.textContent.includes('passport 시스템 등록 완료')");
      assert.equal(await inspect('document.querySelector(".minecraft-link-notice") === null'), true);
      assert.deepEqual(state.confirms, [{ token, consent: { accepted: true, version: privacy.version } }]);
      await open(`${origin}/discord/link/${id}#token=${token}`);
      assert.equal(await inspect('Boolean(document.querySelector(".discord-confirm"))'), true);
      assert.equal(await inspect('document.querySelector(".discord-confirm .primary").disabled'), true);
    });
    await t.test('member and nonmember without servers see the exact empty state and cannot start a Minecraft confirmation', async () => {
      for (const member of [true, false]) {
        reset({ member, servers: [] }); await open(origin);
        assert.equal(await empty(), '접속 가능한 서버가 없습니다'); assert.deepEqual(await serverNames(), []);
        if (member) { await browser('set', 'viewport', '1440', '900'); await browser('screenshot', '/tmp/passport-web-empty-servers-desktop.png'); }
        await open(linkUrl);
        assert.equal(await inspect('document.querySelector(".connection-confirm") === null'), true);
        assert.equal(await inspect("document.body.textContent.includes('접속 가능한 서버가 없어 게임 계정을 연결할 수 없습니다')"), true);
        assert.equal(state.confirms.length, 0);
      }
    });
    await t.test('stale roster does not suppress a university server or block eligible Minecraft linking', async () => {
      reset({ rosterExpired: true, servers: [universityServer] }); await open(origin);
      assert.equal(await inspect('document.querySelector(".membership-label").textContent'), '회원 확인 갱신 대기');
      assert.equal(await inspect('document.querySelector(".membership-school strong").textContent'), 'u-SAINT 인증 완료');
      assert.deepEqual(await serverNames(), [universityServer.label]);
      await open(linkUrl); assert.equal(await inspect('Boolean(document.querySelector(".connection-confirm"))'), true);
    });
    await t.test('school expiry and both suspension sources prevent new linking while school and membership stay separately visible', async () => {
      for (const options of [{ schoolExpired: true }, { suspended: true }, { suspended: true, member: false }, { rosterSuspended: true }]) {
        reset({ ...options, servers: [] }); await open(origin);
        assert.equal(await empty(), '접속 가능한 서버가 없습니다');
        if (options.schoolExpired) {
          assert.equal(await inspect('document.querySelector(".membership-label").textContent'), 'Overworld 소모임 회원입니다.');
          assert.equal(await inspect('document.querySelector(".membership-school strong").textContent'), '유효기간 만료');
        } else {
          assert.equal(await inspect('Boolean(document.querySelector(".membership-restriction"))'), true);
          assert.equal(await inspect('document.querySelector(".membership-label").textContent'), options.rosterSuspended ? '회원 이용 정지' : options.member === false ? '소모임 비회원' : 'Overworld 소모임 회원입니다.');
        }
        await open(linkUrl); assert.equal(await inspect('document.querySelector(".connection-confirm") === null'), true);
        assert.equal(state.confirms.length, 0);
      }
    });
    await t.test('refresh removes revoked servers and a failed refresh never presents old permissions as current', async () => {
      reset(); await open(origin); assert.deepEqual(await serverNames(), ['합성 회원 서버']);
      state.servers = []; await click('새로고침'); await until('document.querySelector("[aria-labelledby=servers-heading] .empty-state h3")?.textContent === "접속 가능한 서버가 없습니다"');
      assert.deepEqual(await serverNames(), []);
      state.servers = [universityServer]; await click('새로고침'); await until('Boolean(document.querySelector(".server-list"))');
      state.failServers = true; await click('새로고침'); await until('document.querySelector("[aria-labelledby=servers-heading] .empty-state h3")?.textContent === "접속 권한을 확인하지 못했습니다"');
      assert.deepEqual(await serverNames(), []);
      assert.notEqual(await empty(), '접속 가능한 서버가 없습니다');
      state.failServers = false; state.servers = []; await click('새로고침'); await until('document.querySelector("[aria-labelledby=servers-heading] .empty-state h3")?.textContent === "접속 가능한 서버가 없습니다"');
      assert.deepEqual(state.unexpected, []);
    });
    await t.test('late completion refresh cannot resurrect a server revoked by a newer explicit refresh', async () => {
      reset({ linked: true, holdCompletion: true }); await open(linkUrl, false);
      await click('내 계정'); await until('Boolean(document.querySelector(".server-list"))');
      assert.equal(typeof state.release, 'function');
      state.servers = []; await click('새로고침'); await until('document.querySelector("[aria-labelledby=servers-heading] .empty-state h3")?.textContent === "접속 가능한 서버가 없습니다"');
      state.release(); state.release = null; await browser('wait', '--load', 'networkidle');
      assert.deepEqual(await serverNames(), []); assert.equal(await empty(), '접속 가능한 서버가 없습니다');
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0);
      assert.equal(await browser('errors'), '');
    });
    await t.test('successful logout clears private data even if anonymous refresh fails and an older account response arrives', async () => {
      reset({ linked: true, holdCompletion: true, failAnonymousSession: true }); await open(linkUrl, false);
      await until('Boolean(document.querySelector(".app-shell")) || Boolean(document.querySelector(".app-sidebar"))');
      assert.equal(typeof state.release, 'function');
      await click('로그아웃'); await until('Boolean(document.querySelector(".login-card"))');
      assert.equal(await inspect("['합성 사용자', 'SyntheticPlayer', '합성 회원 서버'].some(value => document.body.textContent.includes(value))"), false);
      state.release(); state.release = null; await browser('wait', '--load', 'networkidle');
      assert.equal(await inspect('Boolean(document.querySelector(".login-card"))'), true);
      assert.equal(await inspect("['합성 사용자', 'SyntheticPlayer', '합성 회원 서버'].some(value => document.body.textContent.includes(value))"), false);
      assert.equal(await browser('errors'), '');
    });
  } finally {
    state.release?.(); await browser('close').catch(() => {}); await new Promise(resolve => server.close(resolve));
  }
});
