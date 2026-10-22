import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import { Discovery } from './discovery.js';
import { TransportManager } from './transport-manager.js';
import type { LrdtOptions } from './lrdt/transport.js';
import { prioritySchema, type NetworkPriority } from './protocol.js';
import { chatSchema, groupSchema, id, name, type ChatMessage, type DiscoveryPacket, type Group, type Peer, type Snapshot, type Wire } from './protocol.js';

export interface EngineOptions { priority?: NetworkPriority; lrdt?: LrdtOptions; discoveryPort?: number; heartbeatMs?: number; timeoutMs?: number; tickMs?: number; syncMs?: number; log?: (event: string, details?: unknown) => void }
export class Engine extends EventEmitter {
  readonly store: Store;
  readonly peers = new Map<string, Peer>();
  private transport?: TransportManager;
  private discovery?: Discovery;
  private timer?: ReturnType<typeof setInterval>;
  private sessions = new Map<string, { dbId: string; request?: string; requestedAt: number; cursor?: number }>();
  private retryAt = new Map<string, number>();
  private running = false;
  private lifecycle: Promise<void> = Promise.resolve();
  private networkError?: string;
  private readonly log: (event: string, details?: unknown) => void;
  constructor(path: string, private options: EngineOptions = {}) {
    super(); this.store = new Store(path); this.log = options.log ?? ((event, details) => console.log(JSON.stringify({ time: new Date().toISOString(), event, details })));
    if (options.priority) this.store.set('networkPriority', prioritySchema.parse(options.priority));
    for (const peer of this.store.peers()) this.peers.set(peer.peerId, peer);
  }
  get priority(): NetworkPriority { return this.store.setting<NetworkPriority>('networkPriority') ?? 'auto'; }
  setPriority(value: NetworkPriority) { return this.enqueue(async () => {
    const wasRunning=this.running; this.store.set('networkPriority',prioritySchema.parse(value));
    if(wasRunning){await this.stopNetwork();await this.startNetwork();} this.changed();
  }); }
  get identity() { return this.store.identity(); }
  snapshot(): Snapshot {
    return { identity: this.identity, peers: [...this.peers.values()].map(p=>({...p,...this.transport?.diagnostics(p.peerId)})), groups: this.store.groups(),
      priority: this.priority, messages: this.store.messages(), network: this.running, error: this.networkError };
  }
  private changed() { this.emit('change', this.snapshot()); }
  async rename(displayName: string) {
    const firstLaunch = !this.identity.displayName;
    this.store.rename(name.parse(displayName));
    this.discovery?.announce('ANNOUNCE'); this.changed();
    if (firstLaunch) await this.start();
  }
  private enqueue(action: () => Promise<void>): Promise<void> {
    const next = this.lifecycle.then(action);
    this.lifecycle = next.catch(() => {});
    return next;
  }
  start() { return this.enqueue(() => this.startNetwork()); }
  private async startNetwork() {
    if (this.running || !this.identity.displayName) return;
    const transport = new TransportManager(() => this.identity, this.store.dbId, () => this.priority,
      (peer, msg) => this.receive(peer, msg),
      (peer, dbId, ip, port, displayName) => {
        this.upsert(peer, displayName, ip, port, 'CONNECTED');
        this.sessions.set(peer, { dbId, requestedAt: 0 });
        this.sendGroups(peer); this.requestSync(peer); this.flush(peer); this.changed();
      }, peer => {
        this.sessions.delete(peer); this.retryAt.set(peer, Date.now() + 500);
        const p = this.peers.get(peer); if (p) p.connection = this.running && p.status === 'online' ? 'RECONNECTING' : 'DISCONNECTED'; this.changed();
      }, this.log, this.options.lrdt);
    this.transport = transport;
    try {
      await transport.start();
      this.discovery = new Discovery(() => this.identity, transport.port,
        (packet, ip) => this.discovered(packet, ip), this.log, this.options.discoveryPort, this.options.heartbeatMs, () => transport.capabilities());
      await this.discovery.start();
      this.running = true; this.networkError = undefined;
      this.timer = setInterval(() => this.tick(), this.options.tickMs ?? 500);
      this.log('network.started', { peerId: this.identity.peerId, tcpPort: transport.port });
    } catch (error) {
      this.networkError = String(error); await this.discovery?.stop().catch(() => {}); await transport.stop();
      this.discovery = undefined; this.transport = undefined; throw error;
    } finally { this.changed(); }
  }
  private upsert(peerId: string, displayName: string, ip: string, port: number, connection?: Peer['connection']) {
    const old = this.peers.get(peerId);
    // Bound untrusted discovery state. Existing peers remain eligible for updates.
    if (!old && this.peers.size >= 256) return;
    const peer: Peer = { peerId, displayName, ip, port, lastSeen: Date.now(), status: 'online', connection: connection ?? old?.connection ?? 'DISCONNECTED' };
    this.peers.set(peerId, peer);
    if (!old || old.ip !== ip || old.port !== port || old.displayName !== displayName) this.store.savePeer(peer);
  }
  private discovered(packet: DiscoveryPacket, ip: string) {
    if (packet.type === 'GOODBYE') { this.offline(packet.peerId); return; }
    const previous = this.peers.get(packet.peerId); const wasOnline = previous?.status === 'online';
    // Multiple NICs (including local-profile loopback) may advertise the same peer.
    // A changed TCP port signals a restart; a failed old route retries the latest IP.
    if (previous && previous.port !== packet.tcpPort) this.transport?.drop(packet.peerId);
    this.upsert(packet.peerId, packet.displayName, ip, packet.tcpPort);
    const discoveredPeer=this.peers.get(packet.peerId); if(discoveredPeer)this.transport?.observe(packet,discoveredPeer);
    if (!wasOnline) { this.log('peer.discovered', { peer: packet.peerId, ip }); this.discovery?.announce('ANNOUNCE'); }
    else this.log('peer.heartbeat', { peer: packet.peerId });
    this.dial(packet.peerId); this.changed();
  }
  private dial(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!this.running || !peer || peer.status !== 'online' || this.transport?.has(peerId) || Date.now() < (this.retryAt.get(peerId) ?? 0)) return;
    if (this.identity.peerId < peerId) {
      peer.connection = peer.connection === 'DISCONNECTED' ? 'CONNECTING' : 'RECONNECTING';
      this.retryAt.set(peerId, Date.now() + 2000); this.transport?.connect(peer);
    }
  }
  private offline(peerId: string) {
    const peer = this.peers.get(peerId); if (!peer || peer.status === 'offline') return;
    this.transport?.drop(peerId); peer.status = 'offline'; peer.connection = 'DISCONNECTED';
    this.log('peer.offline', { peer: peerId }); this.changed();
  }
  private tick() {
    const now = Date.now();
    for (const peer of this.peers.values()) {
      if (peer.status === 'online' && now - peer.lastSeen > (this.options.timeoutMs ?? 8000)) this.offline(peer.peerId);
      this.dial(peer.peerId);
    }
    for (const [peer, session] of this.sessions) {
      this.flush(peer);
      if (now - session.requestedAt > (this.options.syncMs ?? 4000)) { session.request = undefined; this.sendGroups(peer); this.requestSync(peer); }
    }
    // UI computes room expiration from shared absolute expiresAt. History remains available.
    this.changed();
  }
  private send(peer: string, body: Omit<Wire, 'version' | 'senderId'> | object): boolean {
    return this.transport?.send(peer, { ...body, version: 1, senderId: this.identity.peerId } as Wire) ?? false;
  }
  private sendGroups(peer: string) {
    for (const group of this.store.groups()) if (group.audience.includes(peer) && group.audience.includes(this.identity.peerId)) this.send(peer, { type: 'GROUP_UPDATE', group });
  }
  private requestSync(peer: string) {
    const session = this.sessions.get(peer); if (!session || session.request) return;
    const requestId = randomUUID(); session.request = requestId; session.requestedAt = Date.now();
    this.log('sync.requested', { peer });
    session.cursor = this.store.cursor(peer, session.dbId);
    this.send(peer, { type: 'SYNC_REQUEST', requestId, cursor: session.cursor });
  }
  private groupsChanged() {
    // Store resets cursors when membership changes. In-flight responses from the
    // previous visibility scope must not overwrite that reset with an old cursor.
    for (const [peer, session] of this.sessions) { session.request = undefined; this.requestSync(peer); }
  }
  private shareable(message: ChatMessage, peer: string): boolean {
    const me = this.identity.peerId;
    if (message.kind === 'private') return (message.senderId === me && message.targetId === peer) || (message.senderId === peer && message.targetId === me);
    const group = this.store.group(message.targetId);
    return !!group && group.members.includes(me) && group.members.includes(peer) && message.audience.includes(peer);
  }
  private accept(message: ChatMessage, source: string, relayed = false): boolean {
    const me = this.identity.peerId;
    if (message.kind === 'private') {
      if (message.senderId !== source || message.targetId !== me) return false;
    } else {
      const group = this.store.group(message.targetId);
      if (!group || !group.members.includes(me) || !group.members.includes(source) || !group.audience.includes(message.senderId) || !message.audience.includes(me)) return false;
      if (!relayed && message.senderId !== source) return false;
    }
    const inserted = this.store.insert(message);
    this.log(inserted ? 'message.received' : 'message.duplicate', { messageId: message.messageId, source, relayed });
    this.changed();
    // Sent only after the insert transaction has committed (also for duplicates).
    this.send(source, { type: 'ACK', messageId: message.messageId }); return true;
  }
  private receive(peer: string, wire: Wire) {
    switch (wire.type) {
      case 'PRIVATE_MESSAGE': case 'GROUP_MESSAGE':
        if ((wire.type === 'PRIVATE_MESSAGE') !== (wire.message.kind === 'private')) return;
        this.accept(wire.message, peer); break;
      case 'ACK':
        if (this.store.ack(wire.messageId, peer)) { this.log('message.ack', { peer, messageId: wire.messageId }); this.changed(); } break;
      case 'GROUP_UPDATE': {
        const g = wire.group; const old = this.store.group(g.groupId);
        // Snapshots may be forwarded by a previous participant to propagate leave/removal tombstones.
        if (!g.audience.includes(this.identity.peerId) || !g.audience.includes(peer) ||
          (old && !old.audience.includes(peer)) || (!old && !g.members.includes(this.identity.peerId))) return;
        if (this.store.applyGroup(g)) { this.groupsChanged(); this.log('group.updated', { groupId: g.groupId, revision: g.revision }); this.changed(); }
        break;
      }
      case 'SYNC_REQUEST': {
        const page = this.store.page(wire.cursor);
        this.send(peer, { type: 'SYNC_RESPONSE', requestId: wire.requestId, ...page, messages: page.messages.filter(m => this.shareable(m, peer)) }); break;
      }
      case 'SYNC_RESPONSE': {
        const session = this.sessions.get(peer);
        if (!session || wire.requestId !== session.request) return;
        if (wire.cursor < (session.cursor ?? 0) || (wire.more && wire.cursor === session.cursor)) return;
        // Responses contain only missing log pages; message IDs deduplicate overlapping peers.
        for (const message of wire.messages) {
          if (message.senderId === this.identity.peerId) continue; // Own immutable messages already persisted.
          this.accept(message, peer, true);
        }
        this.store.saveCursor(peer, session.dbId, wire.cursor); session.request = undefined;
        this.log(wire.more ? 'sync.page' : 'sync.completed', { peer, count: wire.messages.length });
        if (wire.more) this.requestSync(peer); break;
      }
    }
  }
  sendMessage(kind: 'private' | 'group', targetId: string, content: string) {
    id.parse(targetId);
    let recipients: string[];
    if (kind === 'private') {
      if (targetId === this.identity.peerId || !this.peers.has(targetId)) throw new Error('Select a known peer');
      recipients = [targetId];
    } else {
      const group = this.store.group(targetId);
      if (!group || !group.members.includes(this.identity.peerId) || (group.expiresAt !== null && group.expiresAt <= Date.now())) throw new Error('This room is inactive');
      recipients = group.members.filter(p => p !== this.identity.peerId);
    }
    const message = chatSchema.parse({ version: 1, messageId: randomUUID(), senderId: this.identity.peerId,
      timestamp: Date.now(), kind, targetId, content, audience: recipients.length ? recipients : [this.identity.peerId] });
    this.store.insert(message, recipients); this.changed();
    for (const peer of recipients) this.flush(peer);
    this.log('message.sent', { messageId: message.messageId, kind, recipients });
    return message.messageId;
  }
  private flush(peer: string) {
    if (!this.transport?.has(peer)) return;
    let count = 0;
    for (const row of this.store.pending(peer)) {
      if (count >= 16) break;
      const delay = row.attempts === 0 ? 0 : Math.min(30000, 500 * 2 ** Math.min(row.attempts as number, 6));
      if (Date.now() - (row.last_attempt as number) < delay) continue;
      const message = this.store.message(row.message_id as string);
      if (!message || !this.shareable(message, peer)) continue;
      if (this.send(peer, { type: message.kind === 'private' ? 'PRIVATE_MESSAGE' : 'GROUP_MESSAGE', message })) {
        this.store.attempted(message.messageId, peer); count++;
      }
    }
  }
  createGroup(groupName: string, members: string[], lifetime: number | null = null): string {
    name.parse(groupName);
    const all = [...new Set([this.identity.peerId, ...members])];
    if (all.length > 64 || members.some(p => p !== this.identity.peerId && !this.peers.has(p))) throw new Error('Choose up to 63 known peers');
    if (lifetime !== null && lifetime !== 3600000 && lifetime !== 28800000) throw new Error('Unsupported room lifetime');
    const group = groupSchema.parse({ groupId: randomUUID(), name: groupName, members: all, audience: all,
      revision: 1, updatedBy: this.identity.peerId, eventId: randomUUID(), expiresAt: lifetime === null ? null : Date.now() + lifetime });
    this.store.applyGroup(group); this.broadcastGroup(group); this.groupsChanged(); this.log('group.created', { groupId: group.groupId }); return group.groupId;
  }
  updateGroup(groupId: string, groupName: string, members: string[]) {
    const old = this.store.group(id.parse(groupId));
    if (!old || !old.members.includes(this.identity.peerId)) throw new Error('You are no longer a member');
    if (members.some(p => p !== this.identity.peerId && !this.peers.has(p) && !old.members.includes(p))) throw new Error('Unknown group member');
    const group = groupSchema.parse({ ...old, name: groupName, members: [...new Set(members)],
      audience: [...new Set([...old.audience, ...members])], revision: old.revision + 1,
      updatedBy: this.identity.peerId, eventId: randomUUID() });
    this.store.applyGroup(group); this.broadcastGroup(group); this.groupsChanged();
  }
  leaveGroup(groupId: string) {
    const group = this.store.group(id.parse(groupId)); if (!group) throw new Error('Unknown room');
    this.updateGroup(groupId, group.name, group.members.filter(p => p !== this.identity.peerId));
  }
  private broadcastGroup(group: Group) {
    for (const peer of group.audience) if (peer !== this.identity.peerId) this.send(peer, { type: 'GROUP_UPDATE', group });
    this.changed();
  }
  stop() { return this.enqueue(() => this.stopNetwork()); }
  private async stopNetwork() {
    if (!this.running && !this.transport) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    await this.discovery?.stop(); await this.transport?.stop();
    this.discovery = undefined; this.transport = undefined; this.sessions.clear();
    for (const peer of this.peers.values()) { peer.status = 'offline'; peer.connection = 'DISCONNECTED'; }
    this.log('network.stopped'); this.changed();
  }
  async close() { await this.stop(); this.store.close(); }
}
