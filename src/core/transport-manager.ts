import { Transport } from './transport.js';
import { LrdtTransport, type LrdtOptions } from './lrdt/transport.js';
import { type Identity, type Peer, type Wire, type DiscoveryPacket, type NetworkPriority } from './protocol.js';
export const chooseTransport = (local: NetworkPriority, remote: NetworkPriority, supported: boolean) => supported && local !== 'safe' && remote !== 'safe' ? 'lrdt' : 'tcp';
export class TransportManager {
    readonly tcp: Transport;
    readonly lrdt: LrdtTransport;
    private deadlines = new Map<string, ReturnType<typeof setTimeout>>();
    private activation = new Map<string, () => void>();
    private endpoints = new Map<string, string>();
    private timer?: ReturnType<typeof setInterval>;
    private peers = new Map<string, Peer>();
    private remote = new Map<string, NonNullable<DiscoveryPacket['capabilities']>>();
    private fallback = new Set<string>();
    private selected = new Map<string, 'tcp' | 'lrdt'>();
    private offered = new Set<string>();
    establishmentFailures = 0;
    tcpFallbacks = 0;
    get port() { return this.tcp.port; }
    constructor(identity: () => Identity, dbId: string, private mode: () => NetworkPriority, receive: (peer: string, message: Wire) => void, connected: (peer: string, dbId: string, ip: string, port: number, name: string) => void, disconnected: (peer: string) => void, private log: (event: string, details?: unknown) => void, options: LrdtOptions = {}) {
        this.lrdt = new LrdtTransport((peer, wire) => { log(`lrdt.received.${wire.type}`, { peer }); receive(peer, wire); }, peer => { this.selected.set(peer, 'lrdt'); this.activate(peer); log('transport.selected', { peer, transport: 'lrdt' }); }, (peer, reason) => this.fail(peer, reason), options);
        this.tcp = new Transport(identity, dbId, (peer, wire) => {
            if (wire.type === 'LRDT_START') {
                const p = this.peers.get(peer), cap = this.remote.get(peer);
                if (p && cap && identity().peerId > peer && chooseTransport(this.mode(), cap.priority, true) === 'lrdt' && !this.fallback.has(peer))
                    this.lrdt.prepare(peer, this.endpoints.get(peer) ?? p.ip, wire.port, wire.session, false);
            }
            else if (wire.type === 'LRDT_FALLBACK')
                this.fail(peer, 'remote fallback', false);
            else
                receive(peer, wire);
        }, (peer, db, ip, port, name) => {
            this.endpoints.set(peer, ip);
            this.selected.set(peer, 'tcp');
            const cap = this.remote.get(peer);
            if (cap && this.lrdt.port && chooseTransport(this.mode(), cap.priority, true) === 'lrdt') {
                this.activation.set(peer, () => connected(peer, db, ip, port, name));
                this.deadlines.set(peer, setTimeout(() => this.fail(peer, 'negotiation timeout'), 1500));
            }
            else
                connected(peer, db, ip, port, name);
            this.negotiate(peer, identity().peerId);
        }, peer => { this.lrdt.drop(peer); this.activation.delete(peer); clearTimeout(this.deadlines.get(peer)); this.deadlines.delete(peer); this.selected.delete(peer); this.offered.delete(peer); this.fallback.delete(peer); disconnected(peer); }, log);
        this.localId = identity().peerId;
    }
    private activate(peer: string) { clearTimeout(this.deadlines.get(peer)); this.deadlines.delete(peer); const action = this.activation.get(peer); this.activation.delete(peer); action?.(); }
    private localId: string;
    async start() { this.timer = setInterval(() => { for (const [peer, t] of this.selected)
        if (t === 'lrdt')
            this.lrdt.send(peer, { version: 1, senderId: this.localId, type: 'PING' }); }, 4000); await this.tcp.start(); try {
        await this.lrdt.start();
    }
    catch (error) {
        this.log('lrdt.unavailable', { error: String(error) });
    } }
    capabilities() { return this.lrdt.port ? { version: 1 as const, port: this.lrdt.port, priority: this.mode() } : undefined; }
    observe(packet: DiscoveryPacket, peer: Peer) { this.peers.set(peer.peerId, peer); if (packet.capabilities)
        this.remote.set(peer.peerId, packet.capabilities); this.negotiate(peer.peerId, this.localId); }
    private negotiate(peer: string, me: string) {
        const cap = this.remote.get(peer), p = this.peers.get(peer);
        if (!cap || !p || me >= peer || !this.tcp.has(peer) || this.offered.has(peer) || this.fallback.has(peer) || !this.lrdt.port || chooseTransport(this.mode(), cap.priority, true) !== 'lrdt')
            return;
        this.offered.add(peer);
        const session = this.lrdt.prepare(peer, this.endpoints.get(peer) ?? p.ip, cap.port);
        if (session)
            this.tcp.send(peer, { version: 1, senderId: me, type: 'LRDT_START', session, port: this.lrdt.port });
    }
    private fail(peer: string, reason: string, notify = true) {
        if (this.fallback.has(peer))
            return;
        this.fallback.add(peer);
        this.establishmentFailures++;
        this.tcpFallbacks++;
        this.lrdt.drop(peer);
        this.selected.set(peer, 'tcp');
        this.activate(peer);
        this.log('transport.fallback', { peer, reason });
        if (notify)
            this.tcp.send(peer, { version: 1, senderId: this.localId, type: 'LRDT_FALLBACK' });
    }
    diagnostics(peer: string) { return { transport: this.selected.get(peer), fallback: this.fallback.has(peer), stats: this.lrdt.stats(peer), establishmentFailures: this.establishmentFailures, tcpFallbacks: this.tcpFallbacks }; }
    has(peer: string) { return this.tcp.has(peer); }
    connect(peer: Peer) { this.peers.set(peer.peerId, peer); this.tcp.connect(peer); }
    send(peer: string, wire: Wire) { if (this.activation.has(peer))
        return false; if (this.selected.get(peer) === 'lrdt')
        return this.lrdt.send(peer, wire); return this.tcp.send(peer, wire); }
    drop(peer: string) { this.lrdt.drop(peer); this.tcp.drop(peer); }
    async stop() { for (const timer of this.deadlines.values())
        clearTimeout(timer); this.deadlines.clear(); if (this.timer)
        clearInterval(this.timer); await this.lrdt.stop(); await this.tcp.stop(); }
}
