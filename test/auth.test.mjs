import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountAccess, minecraftEligibility, linkCallbackError, schoolLoginDestination, universityCallbackError } from '../src/auth.ts';

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
  for (const key of ['__proto__', 'constructor', 'toString']) assert.equal(typeof universityCallbackError(key), 'string');
});
test('automatic linking failure describes recovery without exposing callback values', () => {
  assert.equal(linkCallbackError(null), '');
  assert.match(linkCallbackError('link_expired'), /새 링크/);
  assert.match(linkCallbackError('membership_required'), /접속 가능한 서버/);
  assert.match(linkCallbackError('consent_version_mismatch'), /최신 안내/);
  assert.match(linkCallbackError('web_confirmation_consumed'), /이미 완료/);
  assert.equal(linkCallbackError('unknown-sensitive-value'), linkCallbackError('link_confirmation_failed'));
  assert.ok(!linkCallbackError('unknown-sensitive-value').includes('unknown-sensitive-value'));
  for (const key of ['__proto__', 'constructor', 'toString']) assert.equal(linkCallbackError(key), linkCallbackError('link_confirmation_failed'));
});
test('verified enrolled, leave-of-absence and unknown academic labels use roster membership', () => {
  for (const academicStatus of ['ENROLLED', 'LEAVE_OF_ABSENCE', 'UNKNOWN']) {
    const result = accountAccess({ ...profile, academicStatus }, now);
    assert.equal(result.canLinkDiscord, true);
    assert.equal(result.label, '소모임 회원');
  }
});
test('unregistered roster, stale roster, expired school identity and suspension have distinct next actions', () => {
  const inactive = accountAccess({ ...profile, membership: { ...profile.membership, status: 'inactive' } }, now);
  assert.equal(inactive.canLinkDiscord, true); assert.equal(inactive.label, '소모임 비회원');
  const stale = accountAccess({ ...profile, membership: { ...profile.membership, verifiedUntil: expired } }, now);
  assert.equal(stale.canLinkDiscord, true); assert.equal(stale.label, '회원 확인 갱신 대기');
  const schoolExpired = accountAccess({ ...profile, universityVerifiedUntil: expired }, now);
  assert.equal(schoolExpired.canLinkDiscord, false); assert.equal(schoolExpired.label, '소모임 회원'); assert.equal(schoolExpired.schoolExpired, true);
  const suspended = accountAccess({ ...profile, accessSuspended: true }, now);
  assert.equal(suspended.canLinkDiscord, false); assert.equal(suspended.label, '소모임 회원'); assert.equal(suspended.suspended, true);
});
test('school validity gates Discord while stale roster remains a separate member state', () => {
  for (const value of [null, 'malformed', new Date(now).toISOString()]) {
    assert.equal(accountAccess({ ...profile, universityVerifiedUntil: value }, now).canLinkDiscord, false);
    assert.equal(accountAccess({ ...profile, membership: { ...profile.membership, verifiedUntil: value } }, now).membershipActive, false);
    assert.equal(accountAccess({ ...profile, membership: { ...profile.membership, verifiedUntil: value } }, now).canLinkDiscord, true);
  }
});
test('Discord accepts school-verified nonmembers but respects a server-side suspension', () => {
  for (const effectiveStatus of ['revoked', 'stale', 'suspended']) {
    assert.equal(accountAccess({ ...profile, membership: { ...profile.membership, effectiveStatus } }, now).canLinkDiscord, effectiveStatus !== 'suspended');
  }
});

test('Minecraft eligibility uses valid school identity and returned servers, independently of club membership', () => {
  const nonmember = { ...profile, membership: { status: 'inactive', effectiveStatus: 'revoked', verifiedUntil: null } };
  const staleMember = { ...profile, membership: { ...profile.membership, effectiveStatus: 'stale', verifiedUntil: expired } };
  for (const subject of [profile, nonmember, staleMember]) {
    assert.equal(minecraftEligibility(subject, 1, false, now).allowed, true);
    assert.equal(minecraftEligibility(subject, 0, false, now).allowed, false);
  }
  assert.equal(accountAccess(nonmember, now).canLinkDiscord, true);
  assert.equal(accountAccess(staleMember, now).canLinkDiscord, true);
});
test('suspension and expired or invalid school identity block new Minecraft linking even with a stale server response', () => {
  for (const subject of [
    { ...profile, accessSuspended: true },
    { ...profile, membership: { ...profile.membership, status: 'suspended' } },
    ...[null, 'malformed', new Date(now).toISOString(), expired].map(universityVerifiedUntil => ({ ...profile, universityVerifiedUntil })),
  ]) assert.equal(minecraftEligibility(subject, 1, false, now).allowed, false);
  const synthetic = { ...profile, identityProvider: 'development' };
  assert.equal(accountAccess(synthetic, now).canLinkDiscord, false);
  assert.equal(accountAccess({ ...profile, identityProvider: 'unknown' }, now).canLinkDiscord, false);
  assert.equal(minecraftEligibility(synthetic, 1, false, now).allowed, false);
  assert.equal(minecraftEligibility(synthetic, 1, true, now).allowed, true);
  assert.equal(minecraftEligibility(synthetic, 0, true, now).allowed, false);
});

test('global suspension never erases the underlying member or nonmember label', () => {
  for (const [status, label] of [['active', '소모임 회원'], ['inactive', '소모임 비회원']]) {
    const subject = { ...profile, accessSuspended: true, membership: { ...profile.membership, status, effectiveStatus: 'suspended' } };
    const result = accountAccess(subject, now);
    assert.equal(result.label, label);
    assert.equal(result.suspended, true);
    assert.equal(result.canLinkDiscord, false);
    assert.equal(minecraftEligibility(subject, 1, false, now).allowed, false);
  }
});
