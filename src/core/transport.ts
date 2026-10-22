import net from 'node:net';
import { FrameDecoder, encodeFrame, type Identity, type Wire, type Peer } from './protocol.js';

type Link = { socket: net.Socket; peerId?: string; dbId?: string; expected?: string; outgoing: boolean; ready: boolean };
export class Transport {
  private server?: net.Server;
  private links = new Map<string, Link>();
  private sockets = new Set<net.Socket>();
  private connecting = new Set<string>();
  private keepalive?: ReturnType<typeof setInterval>;
  port = 0;
  constructor(private identity: () => Identity, private dbId: string,
    private receive: (peer: string, message: Wire) => void,
    private connected: (peer: string, dbId: string, ip: string, port: number, displayName: string) => void,
    private disconnected: (peer: string) => void,
    private log: (event: string, detail?: unknown) => void) {}
  async start() {
    this.server = net.createServer(socket => this.attach(socket, false));
    this.server.on('error', error => this.log('tcp.server-error', { message: error.message }));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '0.0.0.0', () => { this.server!.off('error', reject); resolve(); });
    });
    this.port = (this.server.address() as net.AddressInfo).port;
    this.keepalive = setInterval(() => {
      for (const link of this.links.values()) this.write(link, { version: 1, type: 'PING', senderId: this.identity().peerId });
    }, 4000);
  }
  has(peer: string) { return this.links.has(peer); }
  connect(peer: Peer) {
    // Exactly the lexically smaller UUID dials. Both ends enforce the same rule.
    if (this.identity().peerId >= peer.peerId || this.has(peer.peerId) || this.connecting.has(peer.peerId)) return;
    this.connecting.add(peer.peerId); this.log('tcp.connecting', { peer: peer.peerId });
    const socket = net.createConnection({ host: peer.ip, port: peer.port });
    this.attach(socket, true, peer.peerId);
  }
  private attach(socket: net.Socket, outgoing: boolean, expected?: string) {
    if (this.sockets.size >= 256) { socket.destroy(); if (expected) this.connecting.delete(expected); return; }
    const link: Link = { socket, outgoing, expected, ready: false };
    this.sockets.add(socket);
    const decoder = new FrameDecoder();
    const handshakeDeadline = setTimeout(() => socket.destroy(), 5000);
    socket.setNoDelay(true); socket.setKeepAlive(true, 5000); socket.setTimeout(5000);
    const hello = () => this.write(link, { version: 1, type: 'HELLO', senderId: this.identity().peerId,
      displayName: this.identity().displayName, dbId: this.dbId, tcpPort: this.port });
    if (outgoing) socket.once('connect', hello); else hello();
    socket.on('timeout', () => socket.destroy());
    socket.on('error', error => this.log('tcp.socket-error', { peer: link.peerId ?? expected, message: error.message }));
    socket.on('data', chunk => {
      try {
        for (const message of decoder.feed(chunk)) {
          if (!link.ready) {
            if (message.type !== 'HELLO' || message.senderId === this.identity().peerId ||
              (expected && expected !== message.senderId) ||
              outgoing !== (this.identity().peerId < message.senderId) || this.links.has(message.senderId)) {
              socket.destroy(); return;
            }
            link.peerId = message.senderId; link.dbId = message.dbId; link.ready = true;
            clearTimeout(handshakeDeadline);
            socket.setTimeout(15000); this.connecting.delete(message.senderId); this.links.set(message.senderId, link);
            this.log('tcp.connected', { peer: message.senderId });
            this.connected(message.senderId, message.dbId, socket.remoteAddress ?? '127.0.0.1', message.tcpPort, message.displayName);
          } else {
            if (message.type === 'HELLO' || message.senderId !== link.peerId) { socket.destroy(); return; }
            if (message.type === 'PING') this.write(link, { version: 1, type: 'PONG', senderId: this.identity().peerId });
            else if (message.type !== 'PONG') this.receive(link.peerId!, message);
          }
        }
      } catch (error) { this.log('tcp.invalid-frame', { message: String(error) }); socket.destroy(); }
    });
    socket.on('close', () => {
      clearTimeout(handshakeDeadline);
      this.sockets.delete(socket); if (expected) this.connecting.delete(expected);
      if (link.peerId && this.links.get(link.peerId) === link) {
        this.links.delete(link.peerId); this.log('tcp.closed', { peer: link.peerId }); this.disconnected(link.peerId);
      }
    });
  }
  private write(link: Link, message: Wire): boolean {
    if (link.socket.destroyed || link.socket.writableLength > 2 * 1024 * 1024) return false;
    link.socket.write(encodeFrame(message)); return true;
  }
  send(peer: string, message: Wire): boolean { const link = this.links.get(peer); return link ? this.write(link, message) : false; }
  drop(peer: string) { this.links.get(peer)?.socket.destroy(); }
  async stop() {
    if (this.keepalive) clearInterval(this.keepalive);
    for (const socket of this.sockets) socket.destroy();
    if (this.server) await new Promise<void>(resolve => this.server!.close(() => resolve()));
    this.links.clear(); this.connecting.clear(); this.server = undefined;
  }
}
