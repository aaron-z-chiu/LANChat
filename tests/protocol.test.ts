import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MAX_FRAME, FrameDecoder, encodeFrame, wireSchema, discoverySchema, chatSchema, groupSchema, compareGroups, type Wire } from '../src/core/protocol';

const senderId = randomUUID();
const hello: Wire = { version: 1, type: 'HELLO', senderId, dbId: randomUUID(), displayName: 'Alice', tcpPort: 52000 };
test('LCP framing decodes every byte boundary, Unicode, and coalesced frames', () => {
  const message: Wire = { version: 1, type: 'PRIVATE_MESSAGE', senderId, message: { version: 1, messageId: randomUUID(), senderId, timestamp: Date.now(), kind: 'private', targetId: senderId, audience: [senderId], content: 'Hello 🛩️ 你好\nsecond line' } };
  const bytes = Buffer.concat([encodeFrame(hello), encodeFrame(message), encodeFrame(hello)]);
  for (let cut = 1; cut < bytes.length; cut++) {
    const decoder = new FrameDecoder();
    assert.deepEqual([...decoder.feed(bytes.subarray(0, cut)), ...decoder.feed(bytes.subarray(cut))], [hello, message, hello]);
  }
  const decoder = new FrameDecoder();
  assert.deepEqual([...bytes].flatMap(byte => decoder.feed(Buffer.from([byte]))), [hello, message, hello]);
});
test('invalid length, JSON, version, shape and unknown messages are rejected', () => {
  for (const size of [0, MAX_FRAME + 1, 0xffffffff]) {
    const header = Buffer.alloc(4); header.writeUInt32BE(size);
    assert.throws(() => new FrameDecoder().feed(header));
  }
  assert.throws(() => new FrameDecoder().feed(Buffer.from([0, 0, 0, 1, 123])));
  for (const input of [null, [], {}, { ...hello, version: 2 }, { ...hello, type: 'EXEC' }, { ...hello, senderId: 'not-a-uuid' }, { ...hello, displayName: 'x'.repeat(65) }, { ...hello, tcpPort: 0 }, { ...hello, extra: true }]) assert.equal(wireSchema.safeParse(input).success, false);
  assert.equal(discoverySchema.safeParse({ protocol: 'LANChat', version: 1, type: 'ANNOUNCE', peerId: senderId, displayName: 'Alice', tcpPort: 1234 }).success, true);
  assert.equal(chatSchema.safeParse({ version: 1, messageId: randomUUID(), senderId, timestamp: 1, kind: 'private', targetId: senderId, audience: [randomUUID()], content: 'oops' }).success, false);
  assert.equal(chatSchema.safeParse({ version: 1, messageId: randomUUID(), senderId, timestamp: Number.MAX_SAFE_INTEGER, kind: 'private', targetId: senderId, audience: [senderId], content: 'Invalid Date must not crash the UI' }).success, false);
});
test('group conflicts have a deterministic revision, updater, event ordering', () => {
  const a = { groupId: randomUUID(), name: 'Classroom', members: [senderId], audience: [senderId], revision: 1, updatedBy: senderId, eventId: randomUUID(), expiresAt: null };
  const b = { ...a, name: 'Other', revision: 2 };
  assert.ok(compareGroups(b, a) > 0);
  const c = { ...b, eventId: randomUUID() };
  assert.equal(Math.sign(compareGroups(b, c)), -Math.sign(compareGroups(c, b)));
  assert.equal(compareGroups(a, a), 0);
  assert.equal(groupSchema.safeParse({ ...a, members: [senderId, senderId] }).success, false);
});
