import dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';
import { FrameDecoder, encodeFrame, type Wire } from '../protocol.js';
import { decodePacket, encodePacket, PacketType } from './packet.js';
import { ReliableSession } from './session.js';
import { impairment, type NetworkImpairment } from './impairment.js';
type Link = {
    id: string;
    ip: string;
    port: number;
    session: ReliableSession;
    ready: boolean;
    initiator: boolean;
    started: number;
    lastHello: number;
    lastSeen: number;
};
export interface LrdtOptions {
    impairment?: NetworkImpairment;
    window?: number;
    disabled?: boolean;
}
export class LrdtTransport {
    private socket?: dgram.Socket;
    private timer?: ReturnType<typeof setInterval>;
    private timers = new Set<ReturnType<typeof setTimeout>>();
    private links = new Map<string, Link>();
    private retired = new Set<string>();
    private inject: ReturnType<typeof impairment>;
    port = 0;
    constructor(private receive: (peer: string, wire: Wire) => void, private ready: (peer: string) => void, private failed: (peer: string, reason: string) => void, private options: LrdtOptions = {}) { this.inject = impairment(options.impairment); }
    async start() {
        const socket = dgram.createSocket('udp4');
        this.socket = socket;
        socket.on('error', () => { });
        socket.on('message', (bytes, remote) => {
            try {
                const p = decodePacket(bytes), entry = [...this.links.entries()].find(([, l]) => l.id === p.session && l.port === remote.port && l.ip === remote.address);
                if (!entry)
                    return;
                const [peer, l] = entry;
                l.lastSeen = performance.now();
                if (p.type === PacketType.HELLO && !l.initiator) {
                    this.control(l, PacketType.HELLO_ACK);
                    if (!l.ready) {
                        l.ready = true;
                        this.ready(peer);
                    }
                }
                else if (p.type === PacketType.HELLO_ACK && l.initiator) {
                    if (!l.ready) {
                        l.ready = true;
                        this.ready(peer);
                    }
                }
                else if (l.ready)
                    l.session.receive(bytes);
            }
            catch { /* A malformed datagram cannot escape the socket callback. */ }
        });
        await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.bind(0, '0.0.0.0', () => { socket.off('error', reject); resolve(); }); });
        this.port = socket.address().port;
        this.timer = setInterval(() => {
            const now = performance.now();
            for (const [peer, l] of this.links) {
                if (!l.ready) {
                    if (now - l.started > 1500) {
                        this.drop(peer);
                        this.failed(peer, 'establishment timeout');
                        continue;
                    }
                    if (l.initiator && now - l.lastHello > 150) {
                        l.lastHello = now;
                        this.control(l, PacketType.HELLO);
                    }
                }
                else {
                    l.session.tick();
                    if (now - l.lastSeen > 12000) {
                        this.drop(peer);
                        this.failed(peer, 'idle timeout');
                    }
                }
            }
        }, 10);
    }
    prepare(peer: string, ip: string, port: number, id: string = randomUUID(), initiator = true) {
        if (this.retired.has(id))
            return;
        const old = this.links.get(peer);
        if (old?.id === id)
            return;
        this.drop(peer);
        if (this.links.size >= 256)
            return;
        const decoder = new FrameDecoder();
        const session = new ReliableSession(id, b => this.sendDatagram(b, ip, port), b => { for (const wire of decoder.feed(b)) {
            if (wire.senderId !== peer)
                throw new Error('LRDT sender mismatch');
            this.receive(peer, wire);
        } }, reason => { this.drop(peer); this.failed(peer, reason); }, this.options.window);
        this.links.set(peer, { id, ip, port, session, ready: false, initiator, started: performance.now(), lastHello: 0, lastSeen: performance.now() });
        return id;
    }
    private sendDatagram(bytes: Buffer, ip: string, port: number) {
        if (!this.socket || this.options.disabled)
            return;
        this.inject(bytes, (b, delay) => { if (!delay)
            this.socket?.send(b, port, ip, () => { });
        else {
            const timer = setTimeout(() => { this.timers.delete(timer); this.socket?.send(b, port, ip, () => { }); }, delay);
            this.timers.add(timer);
        } });
    }
    private control(l: Link, type: PacketType) { this.sendDatagram(encodePacket({ type, session: l.id, seq: 0, frame: 0, index: 0, count: 0, payload: Buffer.alloc(0) }), l.ip, l.port); }
    has(peer: string) { return this.links.get(peer)?.ready ?? false; }
    send(peer: string, wire: Wire) { const l = this.links.get(peer); return l?.ready ? l.session.send(encodeFrame(wire)) : false; }
    stats(peer: string) { return this.links.get(peer)?.session.stats; }
    drop(peer: string) { const l = this.links.get(peer); if (l) {
        this.retired.add(l.id);
        if (this.retired.size > 1024)
            this.retired.delete(this.retired.values().next().value!);
    } this.links.delete(peer); }
    async stop() { if (this.timer)
        clearInterval(this.timer); for (const t of this.timers)
        clearTimeout(t); this.timers.clear(); this.links.clear(); if (this.socket) {
        const s = this.socket;
        this.socket = undefined;
        await new Promise<void>(r => { try {
            s.close(() => r());
        }
        catch {
            r();
        } });
    } }
}
