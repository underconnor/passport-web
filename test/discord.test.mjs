import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discordLinkError, discordRoleState } from '../src/discord.ts';

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
