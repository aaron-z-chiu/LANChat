import { Engine } from '../../src/core/engine.js';
import dgram from 'node:dgram';
import { once } from 'node:events';
import type { NetworkPriority } from '../../src/core/protocol.js';
import type { LrdtOptions } from '../../src/core/lrdt/transport.js';
export async function until(check: () => boolean | Promise<boolean>, label: string, timeout = 15000) { const end = performance.now() + timeout; while (performance.now() < end) {
    if (await check())
        return;
    await new Promise(r => setTimeout(r, 10));
} throw new Error(`Timeout: ${label}`); }
export async function peers(modes: NetworkPriority[], options: LrdtOptions[] = []) {
    const s = dgram.createSocket('udp4');
    s.bind(0);
    await once(s, 'listening');
    const port = s.address().port;
    await new Promise<void>(r => s.close(() => r()));
    const engines = modes.map((priority, i) => new Engine(':memory:', { priority, lrdt: options[i], discoveryPort: port, heartbeatMs: 100, tickMs: 30, syncMs: 200, log: () => { } }));
    try {
        await Promise.all(engines.map((e, i) => e.rename(`Peer ${i}`)));
        await until(() => engines.every(e => e.snapshot().peers.length === modes.length - 1 && e.snapshot().peers.every(p => p.connection === 'CONNECTED')), 'connections');
        return engines;
    }
    catch (error) {
        await Promise.all(engines.map(e => e.close()));
        throw error;
    }
}
export async function recovery(mode: NetworkPriority) {
    const es = await peers([mode, mode, mode]);
    const [a, b, c] = es;
    try {
        await until(() => es.every(e => e.snapshot().peers.every(p => p.transport === (mode === 'safe' ? 'tcp' : 'lrdt'))), 'transport');
        const group = a.createGroup('Recovery', [b.identity.peerId, c.identity.peerId]);
        await until(() => c.store.groups().length === 1 && b.store.groups().length === 1, 'groups');
        await c.stop();
        const ids = Array.from({ length: 38 }, (_, i) => a.sendMessage('group', group, `Recovery ${i}`));
        await until(() => ids.every(id => b.store.message(id) !== undefined), 'Bob history');
        await a.stop();
        const start = performance.now();
        await c.start();
        await until(() => ids.every(id => c.store.message(id) !== undefined), 'peer assisted recovery');
        return { mode, recoveryMs: performance.now() - start, messages: c.store.rawMessages().length, duplicates: c.store.rawMessages().length - new Set(c.store.rawMessages().map(m => m.messageId)).size, transport: c.snapshot().peers.find(p => p.peerId === b.identity.peerId)?.transport };
    }
    finally {
        await Promise.all(es.map(e => e.close()));
    }
}
