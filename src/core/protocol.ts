import { z } from 'zod';

export const VERSION = 1;
export const MAX_FRAME = 256 * 1024;
export const id = z.uuid();
export const name = z.string().trim().min(1).max(64);
// Keep timestamps representable by JavaScript Date, including renderer formatting.
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
export const groupSchema = z.object({
  groupId: id, name, members: z.array(id).min(0).max(64),
  audience: z.array(id).min(1).max(128), revision: z.number().int().min(1).max(1e9),
  updatedBy: id, eventId: id, expiresAt: timestamp.nullable(),
}).strict().refine(g => new Set(g.members).size === g.members.length &&
  new Set(g.audience).size === g.audience.length &&
  g.members.every(m => g.audience.includes(m)) && g.audience.includes(g.updatedBy));
export const chatSchema = z.object({
  version: z.literal(VERSION), messageId: id, senderId: id, timestamp,
  kind: z.enum(['private', 'group']), targetId: id,
  content: z.string().trim().min(1).max(8000), audience: z.array(id).min(1).max(64),
}).strict().refine(m => new Set(m.audience).size === m.audience.length &&
  (m.kind !== 'private' || (m.audience.length === 1 && m.audience[0] === m.targetId)));
export const discoverySchema = z.object({
  protocol: z.literal('LANChat'), version: z.literal(VERSION),
  type: z.enum(['ANNOUNCE', 'HEARTBEAT', 'GOODBYE']), peerId: id, displayName: name,
  tcpPort: z.number().int().min(1).max(65535),
}).strict();
const base = { version: z.literal(VERSION), senderId: id };
export const wireSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('HELLO'), displayName: name, dbId: id, tcpPort: z.number().int().min(1).max(65535) }).strict(),
  z.object({ ...base, type: z.literal('PRIVATE_MESSAGE'), message: chatSchema }).strict(),
  z.object({ ...base, type: z.literal('GROUP_MESSAGE'), message: chatSchema }).strict(),
  z.object({ ...base, type: z.literal('ACK'), messageId: id }).strict(),
  z.object({ ...base, type: z.literal('PING') }).strict(),
  z.object({ ...base, type: z.literal('PONG') }).strict(),
  z.object({ ...base, type: z.literal('GROUP_UPDATE'), group: groupSchema }).strict(),
  z.object({ ...base, type: z.literal('SYNC_REQUEST'), requestId: id, cursor: z.number().int().nonnegative() }).strict(),
  z.object({ ...base, type: z.literal('SYNC_RESPONSE'), requestId: id, cursor: z.number().int().nonnegative(),
    messages: z.array(chatSchema).max(16), more: z.boolean() }).strict(),
]);
export type Group = z.infer<typeof groupSchema>;
export type ChatMessage = z.infer<typeof chatSchema>;
export type Wire = z.infer<typeof wireSchema>;
export type DiscoveryPacket = z.infer<typeof discoverySchema>;
export interface Identity { peerId: string; displayName: string }
export interface Peer extends Identity { ip: string; port: number; lastSeen: number; status: 'online' | 'offline'; connection: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' }
export interface DisplayMessage extends ChatMessage { state: 'sending' | 'sent' | 'delivered' | 'failed'; delivered: number; recipients: number }
export interface Snapshot { identity: Identity; peers: Peer[]; groups: Group[]; messages: DisplayMessage[]; network: boolean; error?: string }

export function compareGroups(a: Group, b: Group): number {
  const lexical = (x: string, y: string) => x === y ? 0 : x < y ? -1 : 1;
  return a.revision - b.revision || lexical(a.updatedBy, b.updatedBy) || lexical(a.eventId, b.eventId);
}
export function encodeFrame(message: Wire): Buffer {
  const payload = Buffer.from(JSON.stringify(wireSchema.parse(message)), 'utf8');
  if (payload.length > MAX_FRAME) throw new Error('Frame too large');
  const header = Buffer.alloc(4); header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
}
/** Length-prefixed UTF-8 JSON. Owns only an incomplete frame, bounded by MAX_FRAME. */
export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);
  feed(chunk: Buffer): Wire[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: Wire[] = [];
    while (this.buffer.length >= 4) {
      const size = this.buffer.readUInt32BE(0);
      if (size === 0 || size > MAX_FRAME) throw new Error('Invalid frame length');
      if (this.buffer.length < size + 4) break;
      const payload = this.buffer.subarray(4, size + 4);
      this.buffer = this.buffer.subarray(size + 4);
      messages.push(wireSchema.parse(JSON.parse(payload.toString('utf8'))));
    }
    return messages;
  }
}
