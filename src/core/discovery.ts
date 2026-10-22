import dgram from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { discoverySchema, type DiscoveryPacket, type Identity } from './protocol.js';

export const DISCOVERY_PORT = 45878;
export const MULTICAST = '239.255.42.99';
export function interfaces(): { address: string; broadcast: string }[] {
  return Object.values(networkInterfaces()).flatMap(list => (list ?? []).filter(i => i.family === 'IPv4' && !i.internal).map(i => {
    const ip = i.address.split('.').map(Number); const mask = i.netmask.split('.').map(Number);
    return { address: i.address, broadcast: ip.map((b, n) => b | (~mask[n] & 255)).join('.') };
  }));
}
export class Discovery {
  private socket?: dgram.Socket;
  private timer?: ReturnType<typeof setInterval>;
  private memberships = new Set<string>();
  constructor(private identity: () => Identity, private tcpPort: number,
    private onPacket: (p: DiscoveryPacket, ip: string) => void,
    private log: (event: string, details?: unknown) => void,
    private port = DISCOVERY_PORT, private interval = 2000) {}
  async start() {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true }); this.socket = socket;
    socket.on('error', error => this.log('discovery.error', { message: error.message }));
    socket.on('message', (bytes, remote) => {
      if (bytes.length > 2048) return;
      try { const packet = discoverySchema.parse(JSON.parse(bytes.toString('utf8')));
        if (packet.peerId !== this.identity().peerId) this.onPacket(packet, remote.address);
      } catch { /* Unrelated and malformed datagrams are ignored. */ }
    });
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error);
      socket.once('error', fail);
      socket.bind(this.port, '0.0.0.0', () => { socket.off('error', fail); resolve(); });
    });
    socket.setBroadcast(true); socket.setMulticastTTL(1); socket.setMulticastLoopback(true);
    this.refresh(); this.announce('ANNOUNCE');
    this.timer = setInterval(() => { this.refresh(); this.announce('HEARTBEAT'); }, this.interval);
  }
  private refresh() {
    if (!this.socket) return;
    // Explicit membership on every IPv4 LAN interface; loopback supports local profiles.
    const current = new Set([...interfaces().map(i => i.address), '127.0.0.1']);
    for (const ip of this.memberships) if (!current.has(ip)) {
      try { this.socket.dropMembership(MULTICAST, ip); } catch { /* Interface disappeared. */ }
      this.memberships.delete(ip);
    }
    for (const ip of current) if (!this.memberships.has(ip)) {
      try { this.socket.addMembership(MULTICAST, ip); this.memberships.add(ip); }
      catch (error) { this.log('discovery.membership-unavailable', { ip, message: String(error) }); }
    }
  }
  announce(type: DiscoveryPacket['type']) {
    const socket = this.socket; if (!socket) return;
    const packet = Buffer.from(JSON.stringify({ protocol: 'LANChat', version: 1, type,
      ...this.identity(), tcpPort: this.tcpPort }));
    const send = (address: string) => socket.send(packet, this.port, address, error => { if (error) this.log('discovery.send-error', { address, message: error.message }); });
    for (const i of interfaces()) {
      try { socket.setMulticastInterface(i.address); send(MULTICAST); } catch { /* Broadcast still works. */ }
      send(i.broadcast);
    }
    try { socket.setMulticastInterface('127.0.0.1'); send(MULTICAST); } catch { /* Optional loopback. */ }
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    const socket = this.socket;
    if (socket) {
      this.announce('GOODBYE');
      await new Promise<void>(resolve => socket.close(() => resolve()));
      this.socket = undefined; this.memberships.clear();
    }
  }
}
