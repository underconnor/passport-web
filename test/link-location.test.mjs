import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkLocation } from '../src/link-location.ts';
const id = '00000000-0000-4000-8000-000000000010';

test('Minecraft and Discord link targets are exclusive and use only fragment tokens', () => {
  for (const [prefix, kind] of [['/link/', 'minecraft'], ['/discord/link/', 'discord']]) {
    assert.deepEqual(parseLinkLocation(`${prefix}${id}`, '#token=synthetic'), { kind, reference: { id, token: 'synthetic' } });
    assert.deepEqual(parseLinkLocation(`${prefix}${id}/`, ''), { kind, reference: { id, token: null } });
    for (const suffix of ['malformed', `${id}/extra`, '-'.repeat(36)]) assert.deepEqual(parseLinkLocation(`${prefix}${suffix}`, '#token=ignored'), { kind, reference: null });
  }
  assert.equal(parseLinkLocation('/', '#token=ignored'), null);
  assert.equal(parseLinkLocation('/discord/other', '#token=ignored'), null);
});
