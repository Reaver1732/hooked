// Audit F44: the per-student rejoin limiter only keys well-formed requests, so huge or junk
// path and nickname strings never land in its in-memory store.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rejoinKey, rejoinRequestKey } from '../server/src/rateLimits.ts';

test('well-formed requests get the normalized per-student key', () => {
  assert.equal(rejoinRequestKey(' abcdef ', '  Sam   Lee '), 'ABCDEF:sam lee');
  assert.equal(rejoinRequestKey('ABCDEF', 'Sam Lee'), rejoinKey('abcdef', 'sam  lee'), 'same key as "Reset code" resets');
  const twenty = 'x'.repeat(20);
  assert.equal(rejoinRequestKey('ABCDEF', twenty), `ABCDEF:${twenty}`, 'a 20-character nickname is fine');
});

test('malformed requests get no key', () => {
  assert.equal(rejoinRequestKey('A'.repeat(16_000), 'Sam'), null, 'a 16 KB class code');
  assert.equal(rejoinRequestKey('ABCDE', 'Sam'), null, 'too short');
  assert.equal(rejoinRequestKey('ABCDE0', 'Sam'), null, 'a character not in the alphabet');
  assert.equal(rejoinRequestKey('ABCDEF', 'x'.repeat(2000)), null, 'a 2 KB nickname');
  assert.equal(rejoinRequestKey('ABCDEF', 'x'.repeat(21)), null, 'one character too many');
  assert.equal(rejoinRequestKey('ABCDEF', '   '), null, 'a blank nickname');
  assert.equal(rejoinRequestKey('ABCDEF', 42), null, 'not a string');
  assert.equal(rejoinRequestKey(undefined, 'Sam'), null, 'no code');
});
