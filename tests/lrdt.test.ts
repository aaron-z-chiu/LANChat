import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePacket, decodePacket, PacketType } from '../src/core/lrdt/packet';
import { ReliableSession } from '../src/core/lrdt/session';
import { simulate } from '../scripts/benchmarks/simulation';
import { chooseTransport } from '../src/core/transport-manager';
const session = '11111111-1111-4111-8111-111111111111';
test('LRDT binary header roundtrip and malformed rejection', () => {
    const p = { session, type: PacketType.DATA, seq: 1, frame: 1, index: 0, count: 1, payload: Buffer.from('你好') };
    const bytes = encodePacket(p);
    assert.deepEqual(decodePacket(bytes), p);
    for (const offset of [0, 4, 5, 36]) {
        const bad = Buffer.from(bytes);
        bad[offset] = 255;
        assert.throws(() => decodePacket(bad));
    }
    assert.throws(() => decodePacket(Buffer.alloc(20)));
    assert.throws(() => decodePacket(Buffer.alloc(1201)));
});
for (const lossRate of [0, .01, .05, .1, .2])
    test(`LRDT loss ${lossRate}: fragmented ordered exact delivery with adaptive ARQ`, () => {
        const r = simulate({ lossRate, baseDelayMs: 5, jitterMs: 2, reorderRate: .2, duplicateRate: .1, seed: 41 }, 32, 256 * 1024 + 4, 2);
        assert.ok(r.success, r.failure);
        assert.ok(r.peakInFlight > 1);
        assert.ok(r.currentRto >= 60);
        assert.ok(r.peakCwnd > 2);
        if (lossRate) {
            assert.ok(r.retransmissions > 0);
            assert.ok(r.lossEvents > 0);
        }
    });
test('window pipelines; deterministic impairment reproduces exact counters', () => {
    const one = simulate({ baseDelayMs: 10, seed: 7 }, 1), many = simulate({ baseDelayMs: 10, seed: 7 }, 32);
    assert.ok(many.completionMs < one.completionMs);
    assert.equal(one.peakInFlight, 1);
    assert.deepEqual(simulate({ lossRate: .1, seed: 10 }), simulate({ lossRate: .1, seed: 10 }));
});
test('only a missing DATA segment is retransmitted; ACK loss does not duplicate frames; stale session rejected', () => {
    let now = 0;
    const sent: Buffer[] = [];
    const received: Buffer[] = [];
    const acks: Buffer[] = [];
    const a = new ReliableSession(session, b => sent.push(b), () => { }, () => { }, 8, () => now);
    const b = new ReliableSession(session, b => acks.push(b), f => received.push(f), () => { }, 8, () => now);
    a.send(Buffer.alloc(2000, 8));
    const initial = sent.splice(0);
    assert.equal(initial.length, 2);
    b.receive(initial[1]);
    for (const ack of acks.splice(0))
        a.receive(ack);
    now = 250;
    a.tick();
    assert.equal(sent.length, 1);
    assert.equal(decodePacket(sent[0]).seq, 1);
    b.receive(sent[0]);
    assert.equal(received.length, 1);
    // Deliberately drop ACK 1, retransmit the same segment after RTO.
    acks.splice(0);
    now = 1000;
    a.tick();
    b.receive(sent.at(-1)!);
    assert.equal(received.length, 1);
    assert.ok(b.stats.duplicatePackets > 0);
    for (const ack of acks)
        a.receive(ack);
    assert.ok(a.idle);
    const before = b.stats.packetsReceived;
    b.receive(encodePacket({ ...decodePacket(initial[0]), session: '22222222-2222-4222-8222-222222222222' }));
    assert.equal(b.stats.packetsReceived, before);
});
test('RTT tracks delay, loss reduces cwnd, retry exhaustion is bounded', () => {
    const fast = simulate({ baseDelayMs: 2 }, 32), slow = simulate({ baseDelayMs: 40 }, 32);
    assert.ok(slow.smoothedRtt > fast.smoothedRtt);
    const lost = simulate({ baseDelayMs: 5, lossRate: .2, seed: 12 });
    assert.ok(lost.lossEvents > 0);
    assert.ok(lost.trace.some((p, i) => i > 0 && p.cwnd < lost.trace[i - 1].cwnd));
    const blocked = simulate({ lossRate: 1 }, 32, 4000);
    assert.equal(blocked.success, false);
    assert.equal(blocked.failure, 'retry limit');
    assert.ok(blocked.completionMs < 120000);
});
for (const a of ['safe', 'auto', 'custom'] as const)
    for (const b of ['safe', 'auto', 'custom'] as const)
        test(`negotiation ${a}/${b}`, () => { assert.equal(chooseTransport(a, b, true), a === 'safe' || b === 'safe' ? 'tcp' : 'lrdt'); assert.equal(chooseTransport(a, b, false), 'tcp'); });
test('fragment expiry fails an incomplete frame and unsupported capabilities preserve TCP discovery', async () => {
    let now = 0, reason = '';
    const b = new ReliableSession(session, () => { }, () => assert.fail('incomplete frame delivered'), r => reason = r, 32, () => now);
    b.receive(encodePacket({ session, type: PacketType.DATA, seq: 1, frame: 1, index: 0, count: 2, payload: Buffer.alloc(1160) }));
    now = 16000;
    b.tick();
    assert.equal(reason, 'fragment expiry');
    const { discoverySchema } = await import('../src/core/protocol');
    const p = discoverySchema.parse({ protocol: 'LANChat', version: 1, type: 'ANNOUNCE', peerId: session, displayName: 'Legacy', tcpPort: 1234, capabilities: { version: 2, port: 4321, priority: 'auto' } });
    assert.equal(p.capabilities, undefined);
    assert.equal(p.tcpPort, 1234);
});
