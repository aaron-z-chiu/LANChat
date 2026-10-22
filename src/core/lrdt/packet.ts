export const HEADER = 40, DATAGRAM = 1200, PAYLOAD = DATAGRAM - HEADER;
export enum PacketType {
    DATA = 1,
    ACK = 2,
    HELLO = 3,
    HELLO_ACK = 4
}
export interface Packet {
    type: PacketType;
    session: string;
    seq: number;
    frame: number;
    index: number;
    count: number;
    payload: Buffer;
}
export function encodePacket(p: Packet): Buffer {
    const b = Buffer.alloc(HEADER + p.payload.length);
    b.write('LRDT');
    b[4] = 1;
    b[5] = p.type;
    Buffer.from(p.session.replaceAll('-', ''), 'hex').copy(b, 8);
    b.writeUInt32BE(p.seq, 24);
    b.writeUInt32BE(p.frame, 28);
    b.writeUInt16BE(p.index, 32);
    b.writeUInt16BE(p.count, 34);
    b.writeUInt16BE(p.payload.length, 36);
    p.payload.copy(b, HEADER);
    if (b.length > DATAGRAM)
        throw new Error('Oversized datagram');
    return b;
}
export function decodePacket(b: Buffer): Packet {
    if (b.length < HEADER || b.length > DATAGRAM || b.toString('ascii', 0, 4) !== 'LRDT' || b[4] !== 1 || ![1, 2, 3, 4].includes(b[5]) || b.readUInt16BE(6) || b.readUInt16BE(38) || b.readUInt16BE(36) !== b.length - HEADER)
        throw new Error('Invalid LRDT header');
    const h = b.subarray(8, 24).toString('hex');
    const p = { type: b[5], session: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, seq: b.readUInt32BE(24), frame: b.readUInt32BE(28), index: b.readUInt16BE(32), count: b.readUInt16BE(34), payload: b.subarray(HEADER) };
    if (p.type === PacketType.DATA && (!p.seq || !p.frame || !p.count || p.count > 227 || p.index >= p.count || !p.payload.length || (p.index < p.count - 1 && p.payload.length !== PAYLOAD)))
        throw new Error('Invalid fragment');
    if (p.type !== PacketType.DATA && (p.payload.length || p.frame || p.index || p.count || (p.type === PacketType.ACK ? !p.seq : p.seq !== 0)))
        throw new Error('Invalid control');
    return p;
}
