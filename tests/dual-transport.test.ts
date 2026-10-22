import test from 'node:test';
import assert from 'node:assert/strict';
import { peers, until } from '../scripts/benchmarks/real';
import { chooseTransport } from '../src/core/transport-manager';
for (const [a, b] of [['safe', 'safe'], ['safe', 'auto'], ['safe', 'custom'], ['auto', 'auto'], ['auto', 'custom'], ['custom', 'custom']] as const)
    test(`real negotiation ${a}/${b} and persisted application ACK`, { timeout: 20000 }, async () => {
        const es = await peers([a, b]);
        try {
            await until(() => es.every(e => e.snapshot().peers[0].transport === chooseTransport(a, b, true)), 'selection');
            const id = es[0].sendMessage('private', es[1].identity.peerId, 'Unicode 🛩️\n' + '界'.repeat(4000));
            await until(() => es[0].store.messages().find(m => m.messageId === id)?.state === 'delivered', 'application ACK');
            assert.equal(es[1].store.rawMessages().length, 1);
        }
        finally {
            await Promise.all(es.map(e => e.close()));
        }
    });
for (const mode of ['auto', 'custom'] as const)
    test(`blocked UDP ${mode} falls back to TCP`, { timeout: 20000 }, async () => {
        const es = await peers([mode, mode], [{ disabled: true }, { disabled: true }]);
        try {
            await until(() => es.every(e => e.snapshot().peers[0].fallback), 'fallback');
            assert.ok(es.every(e => e.snapshot().peers[0].transport === 'tcp'));
            const id = es[0].sendMessage('private', es[1].identity.peerId, 'Fallback preserved');
            await until(() => es[0].store.messages()[0]?.state === 'delivered', 'fallback ACK');
            assert.ok(es[1].store.message(id));
        }
        finally {
            await Promise.all(es.map(e => e.close()));
        }
    });
test('mixed group edges and runtime priority change preserve messages', { timeout: 20000 }, async () => {
    const es = await peers(['custom', 'safe', 'auto']);
    const [a, b, c] = es;
    try {
        await until(() => a.snapshot().peers.find(p => p.peerId === c.identity.peerId)?.transport === 'lrdt', 'custom/auto');
        assert.equal(a.snapshot().peers.find(p => p.peerId === b.identity.peerId)?.transport, 'tcp');
        const group = a.createGroup('Mixed', [b.identity.peerId, c.identity.peerId]);
        await until(() => b.store.groups().length === 1 && c.store.groups().length === 1, 'metadata');
        const id = a.sendMessage('group', group, 'Across different transports');
        await until(() => a.store.messages()[0]?.state === 'delivered', 'group ACKs');
        assert.ok(b.store.message(id) && c.store.message(id));
        await a.setPriority('safe');
        assert.equal(a.priority, 'safe');
        await until(() => a.snapshot().peers.every(p => p.transport === 'tcp' && p.connection === 'CONNECTED'), 'renegotiated Safe');
        assert.ok(a.store.message(id));
    }
    finally {
        await Promise.all(es.map(e => e.close()));
    }
});
test('asymmetric capability loss cannot leave application activation waiting forever', { timeout: 10000 }, async () => {
    const { TransportManager } = await import('../src/core/transport-manager');
    const { randomUUID } = await import('node:crypto');
    const ids = [randomUUID(), randomUUID()].sort(), ready = [0, 0];
    const make = (i: number) => new TransportManager(() => ({ peerId: ids[i], displayName: `P${i}` }), randomUUID(), () => 'auto', () => { }, () => { ready[i]++; }, () => { }, () => { });
    const a = make(0), b = make(1);
    try {
        await a.start();
        await b.start();
        const peer = (i: number, port: number) => ({ peerId: ids[i], displayName: `P${i}`, ip: '127.0.0.1', port, lastSeen: Date.now(), status: 'online' as const, connection: 'DISCONNECTED' as const });
        b.observe({ protocol: 'LANChat', version: 1, type: 'ANNOUNCE', peerId: ids[0], displayName: 'P0', tcpPort: a.port, capabilities: a.capabilities() }, peer(0, a.port));
        // A saw only B's legacy advertisement, so A never initiates LRDT.
        a.connect(peer(1, b.port));
        await until(() => ready[0] === 1 && ready[1] === 1, 'activation deadline fallback');
        assert.equal(b.diagnostics(ids[0]).fallback, true);
    }
    finally {
        await a.stop();
        await b.stop();
    }
});
