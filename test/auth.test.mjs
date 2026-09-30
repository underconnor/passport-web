import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountAccess, schoolLoginDestination, universityCallbackError } from '../src/auth.ts';

const now = Date.parse('2026-09-30T00:00:00Z');
const future = '2027-01-01T00:00:00Z';
const expired = '2026-09-01T00:00:00Z';
const profile = {
  identityProvider: 'usaint', accessSuspended: false, academicStatus: 'ENROLLED',
  universityVerifiedUntil: future, membership: { status: 'active', verifiedUntil: future },
};
test('school redirect accepts only the reviewed HTTPS login destination', () => {
  const url = 'https://smartid.ssu.ac.kr/Symtra_sso/smln.asp?apiReturnUrl=https%3A%2F%2Fpassport.example%2Fcallback';
  assert.equal(schoolLoginDestination(url), url);
  for (const value of ['javascript:alert(1)', 'http://smartid.ssu.ac.kr/Symtra_sso/smln.asp', 'https://smartid.ssu.ac.kr.attacker.invalid/Symtra_sso/smln.asp', 'https://smartid.ssu.ac.kr/other', 'https://user:pass@smartid.ssu.ac.kr/Symtra_sso/smln.asp', `${url}#token=do-not-send`]) {
    assert.throws(() => schoolLoginDestination(value));
  }
});
test('callback errors use bounded Korean copy and never echo unknown query data', () => {
  assert.equal(universityCallbackError(null), '');
  assert.match(universityCallbackError('expired'), /만료/);
  assert.match(universityCallbackError('rejected'), /다시 로그인/);
  assert.match(universityCallbackError('university_request_expired'), /만료/);
  assert.match(universityCallbackError('university_token_consumed'), /이미 처리/);
  const arbitrary = 'secret-school-token<script>unsafe</script>';
  assert.ok(!universityCallbackError(arbitrary).includes(arbitrary));
});
test('verified enrolled, leave-of-absence and unknown academic labels use roster membership', () => {
  for (const academicStatus of ['ENROLLED', 'LEAVE_OF_ABSENCE', 'UNKNOWN']) {
    const result = accountAccess({ ...profile, academicStatus }, now);
    assert.equal(result.canAccess, true);
    assert.equal(result.label, '활성 회원');
  }
});
test('unregistered roster, stale roster, expired school identity and suspension have distinct next actions', () => {
  const inactive = accountAccess({ ...profile, membership: { ...profile.membership, status: 'inactive' } }, now);
  assert.equal(inactive.canAccess, false); assert.equal(inactive.label, '명부 미등록');
  const stale = accountAccess({ ...profile, membership: { ...profile.membership, verifiedUntil: expired } }, now);
  assert.equal(stale.canAccess, false); assert.equal(stale.label, '명부 갱신 대기');
  const schoolExpired = accountAccess({ ...profile, universityVerifiedUntil: expired }, now);
  assert.equal(schoolExpired.canAccess, false); assert.equal(schoolExpired.label, '학교 인증 만료');
  const suspended = accountAccess({ ...profile, accessSuspended: true }, now);
  assert.equal(suspended.canAccess, false); assert.equal(suspended.label, '이용 정지');
});
test('missing, malformed and exact-boundary validity values do not show active access', () => {
  for (const value of [null, 'malformed', new Date(now).toISOString()]) {
    assert.equal(accountAccess({ ...profile, universityVerifiedUntil: value }, now).canAccess, false);
    assert.equal(accountAccess({ ...profile, membership: { ...profile.membership, verifiedUntil: value } }, now).canAccess, false);
  }
});
test('a server-side denial remains authoritative even when the browser clock sees future validity', () => {
  for (const effectiveStatus of ['revoked', 'stale', 'suspended']) {
    assert.equal(accountAccess({ ...profile, membership: { ...profile.membership, effectiveStatus } }, now).canAccess, false);
  }
});
