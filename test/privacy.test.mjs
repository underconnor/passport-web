import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privacyNotice } from '../src/privacy.ts';
import { privacy } from './fixtures.mjs';

test('requires the complete server notice before consent can be collected', () => {
  assert.deepEqual(privacyNotice(privacy), privacy);
  for (const value of [null, [], {}, { ...privacy, version: '' }, { ...privacy, items: [] }, { ...privacy, items: [''] }, { ...privacy, retention: null }])
    assert.throws(() => privacyNotice(value), /privacy_notice_invalid/);
});
