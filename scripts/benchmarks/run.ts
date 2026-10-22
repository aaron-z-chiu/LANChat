import { mkdir, writeFile } from 'node:fs/promises';
import { platform, arch, release, cpus } from 'node:os';
import { simulate } from './simulation.js';
import { peers, until, recovery } from './real.js';
import type { NetworkPriority } from '../../src/core/protocol.js';
const arg = process.argv.indexOf('--repetitions');
const repetitions = arg < 0 ? 3 : Number(process.argv[arg + 1]);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20)
    throw new Error('Repetitions must be 1..20');
const rows: Record<string, unknown>[] = [];
let trace: unknown[] = [];
for (let repeat = 0; repeat < repetitions; repeat++) {
    const seed = 100 + repeat;
    for (const lossRate of [0, .01, .05, .1, .2]) {
        const { trace: t, received, ...r } = simulate({ lossRate, baseDelayMs: 5, seed }, 32);
        rows.push({ experiment: 'A-loss', repeat, seed, lossRate, window: 32, ...r });
        if (lossRate === .1 && repeat === 0)
            trace = t;
    }
    for (const window of [1, 4, 8, 16, 32]) {
        const { trace: t, received, ...r } = simulate({ baseDelayMs: 10, seed }, window);
        rows.push({ experiment: 'B-window', repeat, seed, window, ...r });
    }
    const { trace: t, received, ...r } = simulate({ baseDelayMs: 10, jitterMs: 8, reorderRate: .4, duplicateRate: .2, seed }, 32);
    rows.push({ experiment: 'D-jitter', repeat, seed, ...r, reorderBufferPeak: received.peakReorder, receiverDuplicates: received.duplicatePackets });
    for (const mode of ['safe', 'auto', 'custom'] as NetworkPriority[]) {
        const start = performance.now(), es = await peers([mode, mode]);
        try {
            await until(() => es.every(e => e.snapshot().peers[0].transport === (mode === 'safe' ? 'tcp' : 'lrdt')), 'benchmark selection');
            const negotiatedMs = performance.now() - start;
            const cpu = process.cpuUsage(), t = performance.now();
            const first = es[0].sendMessage('private', es[1].identity.peerId, 'small message');
            await until(() => es[0].store.messages().find(m => m.messageId === first)?.state === 'delivered', 'small ACK');
            const smallMessageMs = performance.now() - t;
            const bulk = performance.now();
            const ids = Array.from({ length: 32 }, () => es[0].sendMessage('private', es[1].identity.peerId, 'a'.repeat(4000)));
            await until(() => ids.every(id => es[0].store.messages().find(m => m.messageId === id)?.state === 'delivered'), 'bulk ACK');
            const bulkMs = performance.now() - bulk;
            rows.push({ experiment: 'E-F-real-loopback', repeat, mode, transport: es[0].snapshot().peers[0].transport, negotiatedMs, smallMessageMs, bulkMs, throughputBytesPerSecond: 128000 / bulkMs * 1000, cpu: process.cpuUsage(cpu), stats: es[0].snapshot().peers[0] });
        }
        finally {
            await Promise.all(es.map(e => e.close()));
        }
    }
    for (const mode of ['auto', 'custom'] as NetworkPriority[]) {
        const start = performance.now(), es = await peers([mode, mode], [{ disabled: true }, { disabled: true }]);
        try {
            await until(() => es.every(e => e.snapshot().peers[0].fallback), 'blocked fallback');
            const fallbackMs = performance.now() - start;
            const id = es[0].sendMessage('private', es[1].identity.peerId, 'fallback');
            await until(() => es[0].store.messages()[0]?.state === 'delivered', 'fallback delivery');
            rows.push({ experiment: 'G-blocked-UDP', repeat, mode, fallbackMs, success: !!es[1].store.message(id) });
        }
        finally {
            await Promise.all(es.map(e => e.close()));
        }
    }
    for (const mode of ['safe', 'auto'] as NetworkPriority[])
        rows.push({ experiment: 'H-recovery', repeat, ...await recovery(mode) });
}
await mkdir('results', { recursive: true });
const metadata = { date: new Date().toISOString(), os: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, node: process.version, repetitions, seeds: Array.from({ length: repetitions }, (_, i) => 100 + i), topology: 'A-D: seeded virtual-time two-way datagram simulation using production session; E-H: real loopback sockets + SQLite engines, same process', simulationFrameBytes: 131072, simulationBaseDelayMs: 'A=5, B/D=10 each direction', tcpImpairment: 'none; OS ARQ counters unavailable', realLoss: 'G blocks LRDT datagrams; E/F/H unimpaired' };
await writeFile('results/lrdt.json', JSON.stringify({ metadata, rows }, null, 2));
const columns = [...new Set(rows.flatMap(Object.keys))].filter(k => !['cpu', 'stats'].includes(k));
const quote = (v: unknown) => JSON.stringify(String(v ?? ''));
await writeFile('results/lrdt.csv', [columns.join(','), ...rows.map(r => columns.map(k => quote(r[k])).join(','))].join('\n'));
const t = trace as Record<string, unknown>[];
const tc = Object.keys(t[0] ?? {});
await writeFile('results/congestion.csv', [tc.join(','), ...t.map(r => tc.map(k => r[k]).join(','))].join('\n'));
console.log(JSON.stringify({ metadata, runs: rows.length, failures: rows.filter(r => r.success === false), real: rows.filter(r => !String(r.experiment).startsWith('A-') && !String(r.experiment).startsWith('B-') && !String(r.experiment).startsWith('D-')).map(({ stats, cpu, ...r }) => r) }, null, 2));
