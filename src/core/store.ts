import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MAX_FRAME, compareGroups, type ChatMessage, type DisplayMessage, type Group, type Identity, type Peer } from './protocol.js';

type Row = Record<string, unknown>;
const parse = <T>(row: Row | undefined): T | undefined => row ? JSON.parse(row.json as string) as T : undefined;
export class Store {
  readonly db: DatabaseSync;
  readonly dbId: string;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS identity (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS known_peers (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS group_members (group_id TEXT, peer_id TEXT, PRIMARY KEY(group_id,peer_id));
      CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pending_messages (message_id TEXT, peer_id TEXT, attempts INTEGER DEFAULT 0,
        last_attempt INTEGER DEFAULT 0, delivered INTEGER DEFAULT 0, PRIMARY KEY(message_id,peer_id));
      CREATE TABLE IF NOT EXISTS sync_cursors (peer_id TEXT PRIMARY KEY, db_id TEXT, cursor INTEGER);
    `);
    this.dbId = this.setting<string>('dbId') ?? randomUUID(); this.set('dbId', this.dbId);
    if (!this.setting<Identity>('local')) this.set('local', { peerId: randomUUID(), displayName: '' });
  }
  setting<T>(key: string): T | undefined { return parse<T>(this.db.prepare('SELECT json FROM identity WHERE key=?').get(key)); }
  set(key: string, value: unknown) { this.db.prepare('INSERT OR REPLACE INTO identity VALUES (?,?)').run(key, JSON.stringify(value)); }
  identity(): Identity { return this.setting<Identity>('local')!; }
  rename(displayName: string) { this.set('local', { ...this.identity(), displayName }); }
  peers(): Peer[] { return this.db.prepare('SELECT json FROM known_peers').all().map(r => ({ ...parse<Peer>(r)!, status: 'offline', connection: 'DISCONNECTED' })); }
  savePeer(peer: Peer) { this.db.prepare('INSERT OR REPLACE INTO known_peers VALUES (?,?)').run(peer.peerId, JSON.stringify(peer)); }
  groups(): Group[] { return this.db.prepare('SELECT json FROM groups').all().map(r => parse<Group>(r)!); }
  group(id: string): Group | undefined { return parse<Group>(this.db.prepare('SELECT json FROM groups WHERE id=?').get(id)); }
  applyGroup(group: Group): boolean {
    const old = this.group(group.groupId);
    if (old && compareGroups(group, old) <= 0) return false;
    this.transaction(() => {
      this.db.prepare('INSERT OR REPLACE INTO groups VALUES (?,?)').run(group.groupId, JSON.stringify(group));
      this.db.prepare('DELETE FROM group_members WHERE group_id=?').run(group.groupId);
      for (const peer of group.members) this.db.prepare('INSERT INTO group_members VALUES (?,?)').run(group.groupId, peer);
      // A newly joined room can authorize older messages previously filtered from a source's log.
      this.db.exec('DELETE FROM sync_cursors');
      for (const m of this.rawMessages().filter(m => m.kind === 'group' && m.targetId === group.groupId))
        for (const row of this.db.prepare('SELECT peer_id FROM pending_messages WHERE message_id=? AND delivered=0').all(m.messageId))
          if (!group.members.includes(this.identity().peerId) || !group.members.includes(row.peer_id as string))
            this.db.prepare('DELETE FROM pending_messages WHERE message_id=? AND peer_id=?').run(m.messageId, row.peer_id as string);
    });
    return true;
  }
  transaction(fn: () => void) {
    this.db.exec('BEGIN IMMEDIATE');
    try { fn(); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  message(id: string): ChatMessage | undefined { return parse<ChatMessage>(this.db.prepare('SELECT json FROM messages WHERE id=?').get(id)); }
  insert(message: ChatMessage, recipients: string[] = []): boolean {
    let inserted = false;
    this.transaction(() => {
      inserted = !!this.db.prepare('INSERT OR IGNORE INTO messages(id,json) VALUES (?,?)').run(message.messageId, JSON.stringify(message)).changes;
      if (inserted) for (const peer of recipients) this.db.prepare('INSERT INTO pending_messages(message_id,peer_id) VALUES (?,?)').run(message.messageId, peer);
    });
    return inserted;
  }
  rawMessages(): ChatMessage[] { return this.db.prepare('SELECT json FROM messages ORDER BY seq').all().map(r => parse<ChatMessage>(r)!); }
  messages(): DisplayMessage[] {
    return this.rawMessages().map(m => {
      const rows = this.db.prepare('SELECT attempts,delivered FROM pending_messages WHERE message_id=?').all(m.messageId);
      const delivered = rows.filter(r => r.delivered === 1).length;
      const state = !rows.length || delivered === rows.length ? 'delivered' : rows.some(r => r.delivered === 0 && (r.attempts as number) >= 5) ? 'failed' : rows.some(r => (r.attempts as number) > 0) ? 'sent' : 'sending';
      return { ...m, state, delivered, recipients: rows.length };
    });
  }
  pending(peer: string) { return this.db.prepare('SELECT message_id, attempts, last_attempt FROM pending_messages WHERE peer_id=? AND delivered=0').all(peer); }
  attempted(message: string, peer: string) { this.db.prepare('UPDATE pending_messages SET attempts=attempts+1,last_attempt=? WHERE message_id=? AND peer_id=?').run(Date.now(), message, peer); }
  ack(message: string, peer: string): boolean { return !!this.db.prepare('UPDATE pending_messages SET delivered=1 WHERE message_id=? AND peer_id=? AND delivered=0').run(message, peer).changes; }
  cursor(peer: string, dbId: string): number {
    const row = this.db.prepare('SELECT db_id,cursor FROM sync_cursors WHERE peer_id=?').get(peer);
    return row?.db_id === dbId ? row.cursor as number : 0;
  }
  saveCursor(peer: string, dbId: string, cursor: number) { this.db.prepare('INSERT OR REPLACE INTO sync_cursors VALUES (?,?,?)').run(peer, dbId, cursor); }
  page(cursor: number) {
    const candidates = this.db.prepare('SELECT seq,json FROM messages WHERE seq>? ORDER BY seq LIMIT 16').all(cursor);
    // Unicode content plus recipient UUIDs can make 16 messages exceed one frame.
    const rows: Row[] = []; let bytes = 2048;
    for (const row of candidates) {
      const size = Buffer.byteLength(row.json as string) + 1;
      if (bytes + size > MAX_FRAME) break;
      rows.push(row); bytes += size;
    }
    const next = rows.length ? rows.at(-1)!.seq as number : cursor;
    const more = !!this.db.prepare('SELECT seq FROM messages WHERE seq>? LIMIT 1').get(next);
    return { messages: rows.map(r => parse<ChatMessage>(r)!), cursor: next, more };
  }
  close() { this.db.close(); }
}
