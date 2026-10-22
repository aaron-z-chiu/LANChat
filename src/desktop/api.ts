import type { Snapshot } from '../core/protocol.js';
export interface API {
  priority(value: import('../core/protocol.js').NetworkPriority): Promise<void>;
  snapshot(): Promise<Snapshot>;
  rename(name: string): Promise<void>;
  send(kind: 'private' | 'group', targetId: string, content: string): Promise<string>;
  createGroup(name: string, members: string[], lifetime: number | null): Promise<string>;
  updateGroup(id: string, name: string, members: string[]): Promise<void>;
  leaveGroup(id: string): Promise<void>;
  network(online: boolean): Promise<void>;
  subscribe(callback: (state: Snapshot) => void): () => void;
}
declare global { interface Window { lanchat: API } }
