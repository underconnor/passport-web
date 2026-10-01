import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discordLinkError, discordRoleState, discordSynchronizationPending, discordNicknameState, discordRoleSummary } from '../src/discord.ts';

test('Discord link recovery never tells a member to use Minecraft commands or echoes callback data', () => {
  for (const code of ['link_expired', 'discord_link_expired', 'link_consumed', 'invalid_token', 'discord_already_linked']) {
    const text = discordLinkError(code);
    assert.ok(!text.includes('/passport')); assert.ok(!text.includes('게임에서'));
  }
  for (const code of ['unknown-sensitive-value', '__proto__', 'constructor', 'toString']) assert.equal(discordLinkError(code), discordLinkError('link_confirmation_failed'));
  assert.equal(discordLinkError(null), '');
});
test('only applied granted role status claims role delivery; link remains distinct from role failure or revocation', () => {
  assert.equal(discordRoleState('granted').label, '역할 지급 완료');
  for (const status of ['pending', 'failed', 'revoked', undefined, 'unknown']) assert.notEqual(discordRoleState(status).tone, 'success');
  assert.match(discordRoleState('failed').message, /계정 연결은 완료/);
  assert.match(discordRoleState('revoked').message, /계정 연결은 유지/);
});

test('nickname and each role keep polling independently without claiming application early', () => {
  assert.equal(discordSynchronizationPending({ roleStatus: 'granted', nickname: { status: 'pending' } }), true);
  assert.equal(discordSynchronizationPending({ roleStatus: 'granted', roles: { verification: null, member: { status: 'pending' }, semesters: [] } }), true);
  assert.equal(discordSynchronizationPending({ roleStatus: 'granted', roles: { verification: null, member: null, semesters: [{ status: 'pending' }] } }), true);
  assert.equal(discordSynchronizationPending({ roleStatus: 'granted', nickname: { status: 'failed' } }), false);
  assert.equal(discordNicknameState('pending').tone, 'pending');
  assert.equal(discordNicknameState('failed').tone, 'warning');
  assert.equal(discordNicknameState('applied', null).label, '닉네임 관리 해제됨');
  assert.equal(discordNicknameState('applied', 'Synthetic').label, '닉네임 반영 완료');
});

test('aggregate delivery never reports completion while any managed role is pending or failed', () => {
  const connection = { roleStatus: 'granted', roles: { verification: { status: 'granted' }, member: { status: 'revoked' }, semesters: [{ status: 'granted' }] } };
  assert.equal(discordRoleSummary(connection).label, '역할 지급 완료');
  connection.roles.member.status = 'pending'; assert.equal(discordRoleSummary(connection).tone, 'pending');
  connection.roles.member.status = 'failed'; assert.equal(discordRoleSummary(connection).tone, 'warning');
  connection.roles.member.status = 'granted'; connection.managementConsentRequired = true; assert.notEqual(discordRoleSummary(connection).tone, 'success');
  connection.managementConsentRequired = false; connection.roles.verification.status = 'revoked'; assert.notEqual(discordRoleSummary(connection).tone, 'success');
});
