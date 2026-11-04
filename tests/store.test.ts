import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/core/store';
import { encodeFrame, compareGroups, type Group, type ChatMessage } from '../src/core/protocol';

const message = (senderId: string, targetId: string, content = 'Hello'): ChatMessage => ({ version: 1, messageId: randomUUID(), senderId, targetId, kind: 'private', timestamp: Date.now(), content, audience: [targetId] });

test('Chinese identity and multiline Unicode history survive reopening a database in a spaced path', () => {
  const root = mkdtempSync(join(tmpdir(), 'lanchat-store-'));
  const path = join(root, '中文 profile', 'chat.sqlite');
  let store: Store | undefined;
  try {
    store = new Store(path);
    store.rename('张同学 😀');
    const identity = store.identity(), peer = randomUUID();
    const original = message(identity.peerId, peer, '你好，组员！\n第二行 😀\nCafe\u0301');
    assert.equal(store.insert(original, [peer]), true);
    store.close(); store = undefined;
    store = new Store(path);
    assert.deepEqual(store.identity(), identity);
    assert.deepEqual(store.message(original.messageId), original);
    assert.deepEqual(store.page(0).messages, [original]);
    assert.equal(store.pending(peer).length, 1);
    assert.equal(store.messages()[0].state, 'sending');
  } finally { store?.close(); rmSync(root, { recursive: true, force: true }); }
});

test('duplicate IDs cannot overwrite history, reset attempts, add recipients, or undo an ACK', () => {
  const root = mkdtempSync(join(tmpdir(), 'lanchat-dedup-'));
  const path = join(root, 'chat.sqlite');
  let store: Store | undefined;
  try {
    store = new Store(path);
    const peer = randomUUID(), unrelatedPeer = randomUUID();
    const original = message(store.identity().peerId, peer, '原始消息 😀');
    assert.equal(store.insert(original, [peer]), true);
    store.attempted(original.messageId, peer);
    const before = store.pending(peer);
    const duplicate = { ...original, content: '替换内容', targetId: unrelatedPeer, audience: [unrelatedPeer] };
    assert.equal(store.insert(duplicate, [peer, unrelatedPeer]), false);
    assert.deepEqual(store.message(original.messageId), original);
    assert.deepEqual(store.pending(peer), before);
    assert.equal(store.pending(unrelatedPeer).length, 0);
    const cursor = store.page(0).cursor;
    assert.equal(store.ack(original.messageId, peer), true);
    store.close(); store = undefined;
    store = new Store(path);
    assert.equal(store.insert(duplicate, [peer, unrelatedPeer]), false);
    assert.deepEqual(store.rawMessages(), [original]);
    assert.equal(store.pending(peer).length, 0);
    assert.equal(store.pending(unrelatedPeer).length, 0);
    assert.equal(store.messages()[0].state, 'delivered');
    assert.equal(store.messages()[0].recipients, 1);
    assert.equal(store.messages()[0].delivered, 1);
    assert.equal(store.page(0).cursor, cursor);
    assert.deepEqual(store.page(cursor).messages, []);
  } finally { store?.close(); rmSync(root, { recursive: true, force: true }); }
});
test('SQLite identity, deduplication, delivery state, cursors, and history survive restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'lanchat-store-')), path = join(root, 'chat.sqlite');
  let store = new Store(path);
  try {
    store.rename('Alice');
    const identity = store.identity(), dbId = store.dbId, peer = randomUUID();
    const m = message(identity.peerId, peer);
    assert.equal(store.insert(m, [peer]), true);
    assert.equal(store.insert(m, [peer]), false);
    assert.equal(store.messages().length, 1);
    assert.equal(store.messages()[0].state, 'sending');
    store.attempted(m.messageId, peer);
    assert.equal(store.messages()[0].state, 'sent');
    for (let i = 0; i < 4; i++) store.attempted(m.messageId, peer);
    assert.equal(store.messages()[0].state, 'failed');
    store.saveCursor(peer, dbId, 22);
    assert.equal(store.cursor(peer, randomUUID()), 0);
    store.close(); store = new Store(path);
    assert.deepEqual(store.identity(), identity); assert.equal(store.dbId, dbId);
    assert.equal(store.cursor(peer, dbId), 22); assert.equal(store.pending(peer).length, 1);
    assert.equal(store.ack(m.messageId, randomUUID()), false);
    assert.equal(store.ack(m.messageId, peer), true); assert.equal(store.ack(m.messageId, peer), false);
    assert.equal(store.messages()[0].state, 'delivered'); assert.equal(store.pending(peer).length, 0);
    const pending = message(identity.peerId, peer); store.insert(pending, [peer]);
    store.close(); store = new Store(path); assert.equal(store.pending(peer).length, 1);
    assert.equal(store.messages().length, 2);
    assert.throws(() => store.transaction(() => { store.set('rolled-back', 'bad'); throw new Error('simulate failure'); }));
    assert.equal(store.setting('rolled-back'), undefined);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
test('group snapshots converge regardless of arrival order and cancel removed recipients', () => {
  const a = new Store(':memory:'), b = new Store(':memory:');
  try {
    const me = a.identity().peerId, other = randomUUID();
    const g: Group = { groupId: randomUUID(), name: 'Flight', members: [me, other], audience: [me, other], revision: 1, updatedBy: me, eventId: randomUUID(), expiresAt: null };
    const x = { ...g, name: 'Window', revision: 2, eventId: randomUUID() }, y = { ...g, name: 'Aisle', revision: 2, eventId: randomUUID() };
    for (const g1 of [g, x, y]) a.applyGroup(g1);
    for (const g1 of [y, x, g]) b.applyGroup(g1);
    assert.deepEqual(a.groups(), b.groups()); assert.equal(a.applyGroup(g), false);
    assert.equal(a.group(g.groupId)?.eventId, compareGroups(x, y) > 0 ? x.eventId : y.eventId);
    assert.equal(a.db.prepare('SELECT * FROM group_members').all().length, 2);
    const m = { ...message(me, g.groupId), kind: 'group' as const, audience: [other] };
    a.insert(m, [other]); a.saveCursor(other, b.dbId, 20);
    a.applyGroup({ ...g, revision: 3, members: [me] });
    assert.equal(a.pending(other).length, 0); assert.equal(a.cursor(other, b.dbId), 0);
  } finally { a.close(); b.close(); }
});
test('sync pages fit the frame limit with worst-case Unicode and 64 recipients', () => {
  const store = new Store(':memory:');
  try {
    const senderId = randomUUID(), audience = Array.from({ length: 64 }, () => randomUUID());
    for (let i = 0; i < 35; i++) store.insert({ ...message(senderId, randomUUID(), '界'.repeat(8000)), kind: 'group', audience });
    let cursor = 0, count = 0, more = true;
    while (more) {
      const page = store.page(cursor);
      assert.doesNotThrow(() => encodeFrame({ version: 1, type: 'SYNC_RESPONSE', senderId, requestId: randomUUID(), ...page }));
      assert.ok(page.cursor > cursor); count += page.messages.length; cursor = page.cursor; more = page.more;
    }
    assert.equal(count, 35);
  } finally { store.close(); }
});
