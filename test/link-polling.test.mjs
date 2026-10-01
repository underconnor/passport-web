import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollLink } from '../src/link-polling.ts';

const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(overrides = {}) {
  let now = 0, sequence = 0;
  const timers = new Map();
  const visibility = new EventTarget();
  visibility.visibilityState = 'visible';
  const clock = {
    now: () => now,
    set: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
    clear: (id) => timers.delete(id),
  };
  const results = [], errors = [], requests = [];
  let expiries = 0;
  const stop = pollLink({
    expiresAt: new Date(300_000).toISOString(), clock, visibility,
    inspect: (signal) => { const request = deferred(); requests.push({ ...request, signal }); return request.promise; },
    onResult: (result) => { results.push(result); return result === 'linked' ? 'stop' : 'continue'; },
    onError: (error) => { errors.push(error); return 'retry'; },
    onExpire: () => { expiries++; }, ...overrides,
  });
  return {
    stop, requests, results, errors, get expiries() { return expiries; },
    async advance(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle();
      }
      now = end; await settle();
    },
    async visible(value) { visibility.visibilityState = value ? 'visible' : 'hidden'; visibility.dispatchEvent(new Event('visibilitychange')); await settle(); },
  };
}

test('polls serially every two seconds after completion and stops at linked', async () => {
  const f = fixture();
  await f.advance(2000); assert.equal(f.requests.length, 1);
  await f.advance(6000); assert.equal(f.requests.length, 1, 'slow request cannot overlap');
  f.requests[0].resolve('pending'); await settle();
  await f.advance(1999); assert.equal(f.requests.length, 1);
  await f.advance(1); assert.equal(f.requests.length, 2);
  f.requests[1].resolve('linked'); await settle();
  await f.advance(400_000);
  assert.deepEqual(f.results, ['pending', 'linked']); assert.equal(f.requests.length, 2); assert.equal(f.expiries, 0);
});
test('hidden tab aborts inspection and discards a late result from the old generation', async () => {
  const f = fixture(); await f.advance(2000);
  await f.visible(false); assert.equal(f.requests[0].signal.aborted, true);
  await f.visible(true); await f.advance(0);
  assert.equal(f.requests.length, 1, 'waits for the aborted transport to settle');
  f.requests[0].resolve('linked'); await settle(); await f.advance(0);
  assert.deepEqual(f.results, []); assert.equal(f.requests.length, 2);
  f.stop();
});
test('does not poll while hidden and resumes on return', async () => {
  const f = fixture(); await f.visible(false); await f.advance(30_000);
  assert.equal(f.requests.length, 0);
  await f.visible(true); await f.advance(0); assert.equal(f.requests.length, 1);
  f.stop();
});
test('expiry aborts pending work even in a hidden tab and fires once', async () => {
  const f = fixture({ expiresAt: new Date(5000).toISOString() }); await f.advance(2000);
  await f.visible(false); await f.advance(3000);
  assert.equal(f.expiries, 1); assert.equal(f.requests[0].signal.aborted, true);
  f.requests[0].resolve('linked'); await settle();
  await f.visible(true); await f.advance(10_000);
  assert.deepEqual(f.results, []); assert.equal(f.expiries, 1); assert.equal(f.requests.length, 1);
});
test('transient failures back off and a successful response resets the delay', async () => {
  const f = fixture(); await f.advance(2000);
  f.requests[0].reject(new Error('synthetic offline')); await settle();
  await f.advance(3999); assert.equal(f.requests.length, 1);
  await f.advance(1); assert.equal(f.requests.length, 2);
  f.requests[1].resolve('pending'); await settle();
  await f.advance(2000); assert.equal(f.requests.length, 3); assert.equal(f.errors.length, 1);
  f.stop();
});
test('terminal auth or link errors stop polling instead of retrying credentials', async () => {
  let failures = 0;
  const f = fixture({ onError: () => { failures++; return 'stop'; } });
  await f.advance(2000); f.requests[0].reject(new Error('synthetic session expiry')); await settle();
  await f.advance(400_000); assert.equal(f.requests.length, 1); assert.equal(failures, 1); assert.equal(f.expiries, 0);
});
test('cleanup aborts and ignores late completions without firing callbacks', async () => {
  const f = fixture(); await f.advance(2000); f.stop();
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[0].resolve('linked'); await settle(); await f.advance(400_000);
  assert.deepEqual(f.results, []); assert.deepEqual(f.errors, []); assert.equal(f.expiries, 0);
});
