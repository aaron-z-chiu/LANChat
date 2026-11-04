import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dgram from 'node:dgram';
import net from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Transport } from '../src/core/transport';
import { FrameDecoder, encodeFrame, type Snapshot, type Peer, type Wire } from '../src/core/protocol';

async function until(check: () => Promise<boolean> | boolean, label: string, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(r => setTimeout(r, 60)); }
  throw new Error(`Timed out: ${label}`);
}
class PeerProcess {
  child: ChildProcess;
  events: string[] = [];
  ready: Promise<void>;
  private sequence = 0;
  private pending = new Map<number, { resolve: (x: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(path: string, discoveryPort: number) {
    this.child = fork(fileURLToPath(new URL('./peer-worker.ts', import.meta.url)), [path, String(discoveryPort), process.env.LANCHAT_TEST_PRIORITY ?? 'safe'], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stderr = '';
    this.child.stderr?.on('data', b => { stderr = (stderr + b).slice(-8000); });
    this.ready = new Promise((resolve, reject) => {
      this.child.on('message', (message: any) => {
        if (message.ready) resolve();
        if (message.event) this.events.push(message.event);
        if (message.request) {
          const pending = this.pending.get(message.request); if (!pending) return;
          this.pending.delete(message.request); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.value);
        }
      });
      this.child.once('error', reject);
      this.child.once('exit', code => {
        reject(new Error(`Peer exited ${code}: ${stderr}`));
        for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(`Peer exited ${code}: ${stderr}`)); }
        this.pending.clear();
      });
    });
  }
  async call<T = any>(method: string, ...args: any[]): Promise<T> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const request = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(request); reject(new Error(`RPC timeout: ${method}`)); }, 12000);
      this.pending.set(request, { resolve, reject, timer }); this.child.send({ request, method, args });
    });
  }
  snapshot() { return this.call<Snapshot>('snapshot'); }
  async close() { if (this.child.connected) { const exit = once(this.child, 'exit'); await this.call('close'); await exit; } }
  async crash() { const exit = once(this.child, 'exit'); this.child.kill('SIGKILL'); await exit; }
}
async function discoveryPort() {
  const socket = dgram.createSocket('udp4'); socket.bind(0, '0.0.0.0'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise<void>(r => socket.close(() => r())); return port;
}

test('three separate peers discover, persist, ACK, replicate, recover via another member, and deduplicate', { timeout: 90000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'lanchat-peers-')), port = await discoveryPort();
  const a = new PeerProcess(join(root, 'a.sqlite'), port), b = new PeerProcess(join(root, 'b.sqlite'), port);
  let c = new PeerProcess(join(root, 'c.sqlite'), port);
  try {
    await Promise.all([a.call('rename', 'Alice'), b.call('rename', 'Bob'), c.call('rename', 'Charlie')]);
    const [sa, sb, sc] = await Promise.all([a.snapshot(), b.snapshot(), c.snapshot()]);
    const aid = sa.identity.peerId, bid = sb.identity.peerId, cid = sc.identity.peerId;
    await until(async () => (await Promise.all([a.snapshot(), b.snapshot(), c.snapshot()])).every(s => s.peers.length === 2 && s.peers.every(p => p.connection === 'CONNECTED')), 'all three automatically discover and connect');
    await until(async () => (await Promise.all([a.snapshot(),b.snapshot(),c.snapshot()])).every(s=>s.peers.every(p=>p.transport === (process.env.LANCHAT_TEST_PRIORITY === 'auto' ? 'lrdt':'tcp'))), 'expected negotiated transport');
    const pm = await a.call<string>('send', 'private', bid, 'Private hello, Bob');
    await until(async () => (await a.snapshot()).messages.find(m => m.messageId === pm)?.state === 'delivered', 'private application ACK');
    assert.equal((await b.snapshot()).messages.filter(m => m.messageId === pm).length, 1);
    assert.equal((await c.snapshot()).messages.length, 0);
    await b.call('send', 'private', aid, 'Private reply');
    const groupId = await a.call<string>('createGroup', 'Flight Friends', [aid, bid, cid], null);
    await until(async () => (await b.snapshot()).groups.length === 1 && (await c.snapshot()).groups.length === 1, 'group state replication');
    const initial = await c.call<string>('send', 'group', groupId, 'We are here');
    await until(async () => (await c.snapshot()).messages.find(m => m.messageId === initial)?.state === 'delivered', 'group fanout ACK');
    await c.call('stop');
    await until(async () => (await b.snapshot()).peers.find(p => p.peerId === cid)?.status === 'offline', 'graceful GOODBYE');
    const missing: string[] = [];
    for (let i = 0; i < 37; i++) missing.push(await a.call('send', 'group', groupId, `Catch up ${i} 你好`));
    missing.push(await b.call('send', 'group', groupId, 'Bob also has a message'));
    await until(async () => { const s = await b.snapshot(); return missing.every(id => s.messages.some(m => m.messageId === id)); }, 'Bob retains the complete log');
    await b.call('updateGroup', groupId, 'Boarding now', [aid, bid, cid]);
    // Original author vanishes. Charlie must recover Alice's history from Bob.
    await a.call('stop');
    c.events=[];
    await c.call('start');
    await until(async () => { const s = await c.snapshot(); return s.groups[0]?.name === 'Boarding now' && missing.every(id => s.messages.some(m => m.messageId === id)); }, 'paged peer-assisted recovery with original author offline');
    assert.equal((await c.snapshot()).messages.filter(m => m.kind === 'private').length, 0);
    assert.ok(c.events.includes('sync.page'));
    if(process.env.LANCHAT_TEST_PRIORITY==='auto')assert.ok(c.events.includes('lrdt.received.SYNC_RESPONSE'),'history responses actually arrived over UDP');
    await a.call('start');
    // Pending messages retain exponential retry backoff across stop/start. Its
    // 30-second cap can exceed the helper's default deadline on a busy runner.
    await until(async () => (await a.snapshot()).messages.filter(m => missing.includes(m.messageId) && m.senderId === aid).every(m => m.state === 'delivered'), 'original sender retries receive duplicate ACKs', 45000);
    const afterSync = await c.snapshot();
    assert.equal(afterSync.messages.length, 39); // initial + 38 missed group messages
    assert.equal(new Set(afterSync.messages.map(m => m.messageId)).size, afterSync.messages.length);
    const beforeCrash = afterSync.identity;
    await c.crash();
    await until(async () => (await b.snapshot()).peers.find(p => p.peerId === cid)?.status === 'offline', 'heartbeat timeout after abrupt crash');
    const queued = await b.call<string>('send', 'private', cid, 'Persisted across restart');
    c = new PeerProcess(join(root, 'c.sqlite'), port);
    await c.call('start');
    assert.deepEqual((await c.snapshot()).identity, beforeCrash);
    await until(async () => (await c.snapshot()).messages.some(m => m.messageId === queued) && (await b.snapshot()).messages.find(m => m.messageId === queued)?.state === 'delivered', 'stable identity reconnect on new port and pending delivery');
    assert.equal((await c.snapshot()).messages.filter(m => m.kind === 'group').length, 39);
    await c.call('leaveGroup', groupId);
    await until(async () => !(await b.snapshot()).groups[0].members.includes(cid), 'leave replication');
    await b.call('send', 'group', groupId, 'After Charlie left');
    await new Promise(r => setTimeout(r, 500));
    assert.equal((await c.snapshot()).messages.filter(m => m.content === 'After Charlie left').length, 0);
    const expiredId = await b.call<string>('createGroup', 'Temporary', [aid], 3600000);
    assert.ok((await b.snapshot()).groups.find(g => g.groupId === expiredId)?.expiresAt);
    await assert.rejects(b.call('send', 'private', aid, ' '.repeat(3)));
    // Rapid network commands are serialized and leave the engine in a usable state.
    await Promise.all([c.call('stop'), c.call('start'), c.call('stop'), c.call('start')]);
    assert.equal((await c.snapshot()).network, true);
    console.log('Verified 3 independent processes: UDP discovery, TCP, PM privacy, ACK, SQLite restart, group revisions, >2 sync pages, recovery through Bob, duplicate retries, GOODBYE, heartbeat timeout, and leave.');
  } finally {
    await Promise.allSettled([a.close(), b.close(), c.close()]);
    for (const p of [a, b, c]) if (p.child.exitCode === null && p.child.signalCode === null) p.child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});

test('TCP canonical connection, fragmented handshake, malformed frames, and reconnect', { timeout: 20000 }, async () => {
  const clients: net.Socket[] = [];
  const ids = [randomUUID(), randomUUID()].sort(), received: Wire[] = [], connections = [0, 0];
  const make = (i: number) => new Transport(() => ({ peerId: ids[i], displayName: `Peer ${i}` }), randomUUID(), (_peer, message) => received.push(message), () => { connections[i]++; }, () => {}, () => {});
  const a = make(0), b = make(1);
  const peer = (i: number, port: number): Peer => ({ peerId: ids[i], displayName: `Peer ${i}`, port, ip: '127.0.0.1', lastSeen: Date.now(), status: 'online', connection: 'DISCONNECTED' });
  try {
    await a.start(); await b.start();
    for (let i = 0; i < 10; i++) { a.connect(peer(1, b.port)); b.connect(peer(0, a.port)); }
    await until(() => a.has(ids[1]) && b.has(ids[0]), 'canonical connection');
    assert.deepEqual(connections, [1, 1]);
    a.send(ids[1], { version: 1, type: 'ACK', senderId: ids[0], messageId: randomUUID() });
    await until(() => received.length === 1, 'message');
    a.drop(ids[1]); await until(() => !a.has(ids[1]) && !b.has(ids[0]), 'broken connection closes both ends');
    a.connect(peer(1, b.port)); await until(() => connections[0] === 2 && connections[1] === 2, 'reconnect');
    const bad = net.createConnection({ host: '127.0.0.1', port: b.port }); clients.push(bad); bad.on('error', () => {}); bad.resume(); await once(bad, 'connect');
    const closed = once(bad, 'close', { signal: AbortSignal.timeout(3000) }); bad.write(Buffer.from([255, 255, 255, 255])); await closed;
    assert.ok(b.has(ids[0]));
    // New, lower UUID initiates a byte-fragmented HELLO and coalesced ACK frames.
    const rawId = '00000000-0000-4000-8000-000000000001';
    const socket = net.createConnection({ host: '127.0.0.1', port: b.port }); clients.push(socket); await once(socket, 'connect');
    const decoder = new FrameDecoder(); socket.on('data', chunk => decoder.feed(chunk));
    const frame = encodeFrame({ version: 1, type: 'HELLO', senderId: rawId, dbId: randomUUID(), displayName: 'Raw', tcpPort: 12345 });
    for (const byte of frame) socket.write(Buffer.from([byte]));
    await until(() => b.has(rawId), 'fragmented HELLO');
    const ack: Wire = { version: 1, type: 'ACK', senderId: rawId, messageId: randomUUID() };
    socket.write(Buffer.concat([encodeFrame(ack), encodeFrame(ack)]));
    await until(() => received.length === 3, 'coalesced TCP frames');
    const spoofClosed = once(socket, 'close', { signal: AbortSignal.timeout(3000) }); socket.write(encodeFrame({ ...ack, senderId: randomUUID() })); await spoofClosed;
    assert.ok(b.has(ids[0]));
  } finally { for (const socket of clients) socket.destroy(); await a.stop(); await b.stop(); }
});
