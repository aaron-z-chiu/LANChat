import { ReliableSession } from '../../src/core/lrdt/session.js';
import { impairment, type NetworkImpairment } from '../../src/core/lrdt/impairment.js';
export const SIMULATION_TIMEOUT_MS = 120_000;
export const REVERSE_SEED_OFFSET = 100;

export function simulate(config: NetworkImpairment = {}, window = 32, size = 128 * 1024, frames = 1) {
    return simulateWithStatus(config, window, size, frames).result;
}

export function simulateWithStatus(config: NetworkImpairment, window: number, size: number, frames = 1) {
    let now = 0;
    const events: {
        at: number;
        side: number;
        bytes: Buffer;
    }[] = [];
    const delivered: Buffer[] = [];
    let failure = '';
    const aImpair = impairment(config), bImpair = impairment({ ...config, seed: (config.seed ?? 1) + REVERSE_SEED_OFFSET });
    let a: ReliableSession, b: ReliableSession;
    const id = '11111111-1111-4111-8111-111111111111';
    a = new ReliableSession(id, bytes => aImpair(bytes, (b, d) => events.push({ at: now + d, side: 1, bytes: Buffer.from(b) })), () => { }, reason => failure = reason, window, () => now);
    b = new ReliableSession(id, bytes => bImpair(bytes, (b, d) => events.push({ at: now + d, side: 0, bytes: Buffer.from(b) })), frame => delivered.push(frame), reason => failure = reason, window, () => now);
    const original = Buffer.alloc(size, 97);
    for (let i = 0; i < frames; i++)
        a.send(original);
    const trace: {
        timestamp: number;
        cwnd: number;
        ssthresh: number;
        rtt: number;
        rto: number;
        lossEvents: number;
        retransmissions: number;
    }[] = [];
    while (now < SIMULATION_TIMEOUT_MS && !failure && (!a.idle || delivered.length < frames)) {
        now++;
        const due = events.filter(e => e.at <= now);
        for (const e of due) {
            events.splice(events.indexOf(e), 1);
            (e.side ? b : a).receive(e.bytes);
        }
        a.tick();
        b.tick();
        if (now % 10 === 0)
            trace.push({ timestamp: now, cwnd: a.stats.currentCwnd, ssthresh: a.stats.ssthresh, rtt: a.stats.smoothedRtt, rto: a.stats.currentRto, lossEvents: a.stats.lossEvents, retransmissions: a.stats.retransmissions });
    }
    const result = { success: !failure && delivered.length === frames && delivered.every(b => b.equals(original)), completionMs: now, throughputBytesPerSecond: size * frames / Math.max(1, now) * 1000, averageCwnd: trace.reduce((n, p) => n + p.cwnd, 0) / Math.max(1, trace.length), ...a.stats, received: b.stats, trace, failure };
    return { result, senderIdle: a.idle, deliveredFrames: delivered.length };
}
