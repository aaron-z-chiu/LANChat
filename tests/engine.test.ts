import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Engine } from '../src/core/engine';

test('expired and departed rooms reject new messages; history and tombstones remain', async () => {
  const engine = new Engine(':memory:', { log: () => {} });
  try {
    const me = engine.identity.peerId;
    const groupId = engine.createGroup('Solo room', [me]);
    const messageId = engine.sendMessage('group', groupId, 'Before expiry');
    const group = engine.store.group(groupId)!;
    engine.store.applyGroup({ ...group, revision: 2, eventId: randomUUID(), expiresAt: Date.now() - 1 });
    assert.throws(() => engine.sendMessage('group', groupId, 'After expiry'), /inactive/);
    assert.ok(engine.store.message(messageId));
    const otherGroup = engine.createGroup('Leave test', []);
    engine.sendMessage('group', otherGroup, 'Retained history');
    engine.leaveGroup(otherGroup);
    assert.deepEqual(engine.store.group(otherGroup)?.members, []);
    assert.throws(() => engine.sendMessage('group', otherGroup, 'After leave'), /inactive/);
    assert.equal(engine.store.rawMessages().length, 2);
  } finally { await engine.close(); }
});
test('outbound messages are persisted while paused and invalid input cannot insert', async () => {
  const engine = new Engine(':memory:', { log: () => {} });
  try {
    const peerId = randomUUID();
    engine.peers.set(peerId, { peerId, displayName: 'Bob', ip: '127.0.0.1', port: 50000, lastSeen: 0, status: 'offline', connection: 'DISCONNECTED' });
    const messageId = engine.sendMessage('private', peerId, 'Queued offline');
    assert.ok(engine.store.message(messageId));
    assert.equal(engine.snapshot().messages[0].state, 'sending');
    assert.equal(engine.snapshot().network, false);
    for (const content of ['', ' ', 'x'.repeat(8001)]) assert.throws(() => engine.sendMessage('private', peerId, content));
    assert.throws(() => engine.sendMessage('private', randomUUID(), 'Unknown peer'));
    assert.throws(() => engine.sendMessage('private', engine.identity.peerId, 'Self chat'));
    assert.throws(() => engine.createGroup('Unknown member', [randomUUID()]));
    assert.throws(() => engine.createGroup('Invalid expiry', [], 123));
    assert.equal(engine.store.rawMessages().length, 1);
    engine.store.rename('Alice');
    await engine.rename('Renamed Alice');
    assert.equal(engine.snapshot().network, false, 'renaming a paused profile must not start networking');
  } finally { await engine.close(); }
});
