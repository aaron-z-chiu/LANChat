import { MAX_FRAME } from '../protocol.js';
import { encodePacket, decodePacket, PacketType, PAYLOAD, type Packet } from './packet.js';
export interface Stats {
    packetsSent: number;
    packetsReceived: number;
    acksSent: number;
    acksReceived: number;
    retransmissions: number;
    duplicatePackets: number;
    outOfOrderPackets: number;
    fragmentsSent: number;
    fragmentsReceived: number;
    framesCompleted: number;
    bytesSent: number;
    bytesReceived: number;
    currentCwnd: number;
    peakCwnd: number;
    ssthresh: number;
    smoothedRtt: number;
    currentRto: number;
    peakInFlight: number;
    peakReorder: number;
    lossEvents: number;
}
type Segment = {
    packet: Packet;
    sentAt: number;
    retries: number;
};
export class ReliableSession {
    readonly stats: Stats = { packetsSent: 0, packetsReceived: 0, acksSent: 0, acksReceived: 0, retransmissions: 0, duplicatePackets: 0, outOfOrderPackets: 0, fragmentsSent: 0, fragmentsReceived: 0, framesCompleted: 0, bytesSent: 0, bytesReceived: 0, currentCwnd: 2, peakCwnd: 2, ssthresh: 16, smoothedRtt: 0, currentRto: 200, peakInFlight: 0, peakReorder: 0, lossEvents: 0 };
    private queue: Packet[] = [];
    private pending = new Map<number, Segment>();
    private reorder = new Map<number, Packet>();
    private next = 1;
    private read = 1;
    private frame = 1;
    private receivedFrame = 1;
    private parts: Buffer[] = [];
    private count = 0;
    private bytes = 0;
    private assemblyAt = 0;
    private variance = 0;
    private queuedBytes = 0;
    failed = false;
    constructor(readonly session: string, private transmit: (bytes: Buffer) => void, private deliver: (frame: Buffer) => void, private failure: (reason: string) => void, readonly window = 32, private now = () => performance.now()) {
        if (!Number.isInteger(window) || window < 1 || window > 128)
            throw new Error('Invalid window');
        this.stats.currentCwnd = this.stats.peakCwnd = Math.min(2, window);
    }
    get idle() { return !this.queue.length && !this.pending.size; }
    send(frame: Buffer): boolean {
        if (this.failed || frame.length < 1 || frame.length > MAX_FRAME + 4 || this.queuedBytes + frame.length > 2 * 1024 * 1024)
            return false;
        const count = Math.ceil(frame.length / PAYLOAD);
        if (this.next + count >= 0xffffffff || this.frame >= 0xffffffff) {
            this.fail('sequence exhausted');
            return false;
        }
        for (let i = 0; i < count; i++)
            this.queue.push({ type: PacketType.DATA, session: this.session, seq: this.next++, frame: this.frame, index: i, count, payload: Buffer.from(frame.subarray(i * PAYLOAD, (i + 1) * PAYLOAD)) });
        this.frame++;
        this.queuedBytes += frame.length;
        this.pump();
        return true;
    }
    private emit(packet: Packet) { const bytes = encodePacket(packet); this.stats.packetsSent++; this.stats.bytesSent += bytes.length; this.transmit(bytes); }
    private pump() {
        while (!this.failed && this.queue.length && this.pending.size < Math.min(this.window, Math.floor(this.stats.currentCwnd))) {
            const p = this.queue[0], base = this.pending.size ? Math.min(...this.pending.keys()) : p.seq;
            if (p.seq >= base + this.window)
                break;
            this.queue.shift();
            this.pending.set(p.seq, { packet: p, sentAt: this.now(), retries: 0 });
            this.stats.fragmentsSent++;
            this.emit(p);
            this.stats.peakInFlight = Math.max(this.stats.peakInFlight, this.pending.size);
        }
    }
    receive(bytes: Buffer) {
        if (this.failed)
            return;
        const p = decodePacket(bytes);
        if (p.session !== this.session)
            return;
        this.stats.packetsReceived++;
        this.stats.bytesReceived += bytes.length;
        if (p.type === PacketType.ACK) {
            this.stats.acksReceived++;
            const segment = this.pending.get(p.seq);
            if (!segment)
                return;
            this.pending.delete(p.seq);
            this.queuedBytes -= segment.packet.payload.length;
            if (!segment.retries) {
                const sample = Math.max(1, this.now() - segment.sentAt);
                if (!this.stats.smoothedRtt) {
                    this.stats.smoothedRtt = sample;
                    this.variance = sample / 2;
                }
                else {
                    this.variance = .75 * this.variance + .25 * Math.abs(this.stats.smoothedRtt - sample);
                    this.stats.smoothedRtt = .875 * this.stats.smoothedRtt + .125 * sample;
                }
                this.stats.currentRto = Math.min(3000, Math.max(60, this.stats.smoothedRtt + 4 * this.variance));
            }
            this.stats.currentCwnd = Math.min(this.window, this.stats.currentCwnd + (this.stats.currentCwnd < this.stats.ssthresh ? 1 : 1 / this.stats.currentCwnd));
            this.stats.peakCwnd = Math.max(this.stats.peakCwnd, this.stats.currentCwnd);
            this.pump();
            return;
        }
        if (p.type !== PacketType.DATA || p.seq >= this.read + 128)
            return;
        this.stats.fragmentsReceived++;
        if (p.seq < this.read || this.reorder.has(p.seq))
            this.stats.duplicatePackets++;
        else {
            if (p.seq > this.read)
                this.stats.outOfOrderPackets++;
            this.reorder.set(p.seq, p);
        }
        this.stats.acksSent++;
        this.emit({ type: PacketType.ACK, session: this.session, seq: p.seq, frame: 0, index: 0, count: 0, payload: Buffer.alloc(0) });
        this.stats.peakReorder = Math.max(this.stats.peakReorder, this.reorder.size);
        while (this.reorder.has(this.read)) {
            const fragment = this.reorder.get(this.read)!;
            this.reorder.delete(this.read++);
            if (fragment.frame !== this.receivedFrame || fragment.index !== this.parts.length || (this.parts.length && this.count !== fragment.count)) {
                this.fail('fragment sequence');
                return;
            }
            if (!this.parts.length) {
                this.assemblyAt = this.now();
                this.count = fragment.count;
            }
            this.assemblyAt = this.now();
            this.parts.push(fragment.payload);
            this.bytes += fragment.payload.length;
            if (this.bytes > MAX_FRAME + 4) {
                this.fail('reassembly limit');
                return;
            }
            if (this.parts.length === this.count) {
                const frame = Buffer.concat(this.parts);
                this.parts = [];
                this.bytes = 0;
                this.receivedFrame++;
                this.stats.framesCompleted++;
                this.deliver(frame);
            }
        }
    }
    tick() {
        if (this.failed)
            return;
        if (this.parts.length && this.now() - this.assemblyAt > 15000) {
            this.fail('fragment expiry');
            return;
        }
        let loss = false;
        for (const s of this.pending.values())
            if (this.now() - s.sentAt >= Math.min(3000, this.stats.currentRto * 2 ** s.retries)) {
                if (s.retries >= 7) {
                    this.fail('retry limit');
                    return;
                }
                if (!loss) {
                    this.stats.ssthresh = Math.max(2, this.stats.currentCwnd / 2);
                    this.stats.currentCwnd = 1;
                    this.stats.lossEvents++;
                    loss = true;
                }
                s.retries++;
                s.sentAt = this.now();
                this.stats.retransmissions++;
                this.emit(s.packet);
            }
        this.pump();
    }
    fail(reason: string) { if (this.failed)
        return; this.failed = true; this.queue = []; this.pending.clear(); this.reorder.clear(); this.parts = []; this.failure(reason); }
}
