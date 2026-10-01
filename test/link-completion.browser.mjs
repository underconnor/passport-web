import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Loopback-only synthetic API. No school, Minecraft, or deployed member requests.
const run = promisify(execFile);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const browserSession = `passport-link-regression-${process.pid}`;
const linkId = '00000000-0000-4000-8000-000000000010';
const future = () => new Date(Date.now() + 3_600_000).toISOString();
let state;
function reset(mode) {
  state = { mode, authenticated: true, webConfirmed: false, linked: false, gameConnected: false,
    inspectReads: 0, authReads: 0, profileReads: 0, serverReads: 0, confirmations: 0, gameWrites: 0, csrf: null };
}
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (url.pathname === '/v1/auth/session') {
    state.authReads++;
    return json(200, { authenticated: state.authenticated, authMode: 'university', csrfToken: state.authenticated ? 'synthetic-csrf' : 'synthetic-fresh-csrf' });
  }
  if (url.pathname === '/v1/me') {
    state.profileReads++;
    return json(200, { id: '00000000-0000-4000-8000-000000000001', displayName: '자동 연결 테스트 회원', identityProvider: 'usaint',
      department: '가상 학과', academicStatus: 'ENROLLED', universityVerifiedAt: new Date().toISOString(), universityVerifiedUntil: future(), accessSuspended: false,
      membership: { status: 'active', effectiveStatus: 'active', roleLabel: '가상 회원', verifiedUntil: future() },
      minecraft: state.linked ? { uuid: '00000000-0000-4000-8000-000000000002', name: 'SyntheticPlayer' } : null,
      discordReference: { id: '123456789012345678', verificationStatus: 'self_reported', updatedAt: new Date().toISOString() }, csrfToken: 'synthetic-csrf' });
  }
  if (url.pathname === '/v1/me/servers') { state.serverReads++; return json(200, { servers: [{ id: 'fixture_lobby', label: '가상 로비' }] }); }
  if (url.pathname.endsWith('/inspect')) {
    state.inspectReads++;
    assert.equal(request.method, 'POST');
    assert.ok(request.headers['x-csrf-token']);
    let input = ''; for await (const chunk of request) input += chunk;
    assert.equal(JSON.parse(input).token, 'synthetic-link-token');
    assert.equal(url.search, '');
    if (state.mode === 'expired-session' && state.authenticated && state.inspectReads > 1) {
      state.authenticated = false; return json(401, { code: 'session_required' });
    }
    if (state.webConfirmed && state.gameConnected) state.linked = true;
    return json(200, { id: linkId, minecraftUuid: '00000000-0000-4000-8000-000000000002', minecraftName: 'SyntheticPlayer',
      status: state.linked ? 'linked' : 'pending', expiresAt: expiry,
      webConfirmed: state.webConfirmed, gameConfirmed: state.linked });
  }
  if (url.pathname.endsWith('/web-confirm')) {
    state.confirmations++; state.webConfirmed = true;
    if (state.mode === 'immediate') state.linked = true;
    return json(200, { id: linkId, status: state.linked ? 'linked' : 'pending', expiresAt: expiry });
  }
  if (url.pathname.endsWith('/game-confirm')) { state.gameWrites++; return json(403, { code: 'forbidden' }); }
  if (url.pathname === '/v1/auth/university/start') {
    state.csrf = request.headers['x-csrf-token']; return json(503, { code: 'university_provider_not_configured' });
  }
  const requested = path.resolve(dist, `.${url.pathname.startsWith('/link/') ? '/index.html' : url.pathname}`);
  if (!requested.startsWith(dist)) return json(404, { code: 'not_found' });
  try {
    const content = await readFile(requested);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(requested)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type }); response.end(content);
  } catch { json(404, { code: 'not_found' }); }
});
let expiry;
const browser = async (...args) => (await run('npx', ['--yes', 'agent-browser@0.38.1', '--session', browserSession, ...args], { timeout: 30_000, maxBuffer: 1_000_000 })).stdout.trim();
const inspect = async (expression) => {
  let value = JSON.parse(await browser('eval', `JSON.stringify(${expression})`));
  if (typeof value === 'string') value = JSON.parse(value); return value;
};
const until = async (expression) => { for (let n = 0; n < 12; n++) { if (await inspect(expression)) return; } assert.fail('Expected browser state was not observed'); };

test('link completion updates automatically without commands or losing unrelated edits', { timeout: 180_000 }, async (t) => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/link/${linkId}#token=synthetic-link-token`;
  try {
    await t.test('pending then linked via automatic inspect', async () => {
      reset('poll'); expiry = new Date(Date.now() + 300_000).toISOString();
      await browser('open', url); await browser('wait', '--load', 'networkidle');
      await browser('set', 'viewport', '1440', '900');
      const snapshot = await browser('snapshot', '-i');
      assert.ok(snapshot.includes('내 계정으로 연결 확인'));
      assert.equal(await inspect('Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog]"))'), false);
      assert.equal(await browser('errors'), '');
      assert.equal(await inspect('location.hash'), '');
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0);
      await browser('find', 'role', 'button', 'click', '--name', '내 계정으로 연결 확인');
      await until("document.body.textContent.includes('게임 접속을 확인하고 있어요')");
      assert.equal(await inspect("document.body.textContent.includes('/passport confirm')"), false);
      await browser('screenshot', '/tmp/passport-web-auto-pending.png');
      await browser('find', 'role', 'button', 'click', '--name', 'Discord ID');
      await browser('find', 'label', '사용자 ID', 'fill', '234567890123456789');
      state.gameConnected = true;
      await until("document.querySelector('#discord-id')?.value === '234567890123456789'");
      // Each browser round-trip allows the real 2s poll to run; wait for profile fetch too.
      for (let n = 0; n < 12 && state.profileReads < 2; n++) await inspect('document.body.textContent.length');
      assert.equal(state.profileReads, 2); assert.equal(state.serverReads, 2); assert.equal(state.authReads, 1);
      assert.equal(await inspect("document.querySelector('#discord-id').value"), '234567890123456789');
      await browser('find', 'role', 'button', 'click', '--name', 'Minecraft 연결');
      await until("document.body.textContent.includes('계정 연결이 완료되었습니다. 게임에 접속 중이면')");
      const count = state.inspectReads;
      await browser('screenshot', '/tmp/passport-web-auto-linked-desktop.png');
      await browser('set', 'viewport', '390', '844');
      await browser('screenshot', '/tmp/passport-web-auto-linked-mobile.png');
      assert.equal(await inspect('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await inspect("[...document.fonts].some(f => f.family.includes('Pretendard') && f.status === 'loaded')"), true);
      assert.equal(state.inspectReads, count, 'linked stops inspection');
      assert.equal(state.confirmations, 1); assert.equal(state.gameWrites, 0);
      assert.equal(await browser('errors'), '');
    });
    await t.test('web-confirm linked response immediately shows automatic movement', async () => {
      reset('immediate'); expiry = new Date(Date.now() + 300_000).toISOString();
      await browser('open', 'about:blank');
      await browser('open', url); await browser('wait', '--load', 'networkidle');
      await browser('find', 'role', 'button', 'click', '--name', '내 계정으로 연결 확인');
      await until("document.body.textContent.includes('계정 연결이 완료되었습니다. 게임에 접속 중이면')");
      assert.equal(await inspect("document.body.textContent.includes('/passport confirm')"), false);
      assert.equal(state.profileReads, 2); assert.equal(state.confirmations, 1);
    });
    await t.test('401 during polling clears private state and uses fresh login CSRF', async () => {
      reset('expired-session'); expiry = new Date(Date.now() + 300_000).toISOString();
      await browser('open', 'about:blank');
      await browser('open', url);
      await until("document.body.textContent.includes('로그인이 만료되었습니다')");
      assert.equal(await inspect("document.body.textContent.includes('자동 연결 테스트 회원')"), false);
      assert.equal(await inspect('localStorage.length + sessionStorage.length'), 0);
      await browser('find', 'role', 'button', 'click', '--name', '숭실대학교 통합로그인');
      await browser('wait', '--load', 'networkidle');
      assert.equal(state.csrf, 'synthetic-fresh-csrf');
    });
  } finally {
    await browser('close').catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
});
