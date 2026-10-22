// Runs the real production engine in an independent OS process, no fake transport.
import { Engine } from '../src/core/engine';
const [path, port] = process.argv.slice(2);
const engine = new Engine(path, { priority: (process.argv[4] ?? 'safe') as 'safe'|'auto'|'custom', discoveryPort: Number(port), heartbeatMs: 200, timeoutMs: 1400, tickMs: 60, syncMs: 300,
  log: (event, details) => { if (process.connected) process.send?.({ event, details }); } });
process.on('message', async (raw: unknown) => {
  const { request, method, args } = raw as { request: number; method: string; args: any[] };
  try {
    let value: unknown;
    switch (method) {
      case 'snapshot': value = engine.snapshot(); break;
      case 'rename': value = await engine.rename(args[0]); break;
      case 'send': value = engine.sendMessage(args[0], args[1], args[2]); break;
      case 'createGroup': value = engine.createGroup(args[0], args[1], args[2]); break;
      case 'updateGroup': value = engine.updateGroup(args[0], args[1], args[2]); break;
      case 'leaveGroup': value = engine.leaveGroup(args[0]); break;
      case 'start': value = await engine.start(); break;
      case 'stop': value = await engine.stop(); break;
      case 'close': await engine.close(); process.send?.({ request, value: null }); process.disconnect(); return;
      default: throw new Error('Unknown test method');
    }
    process.send?.({ request, value });
  } catch (error) { process.send?.({ request, error: String(error) }); }
});
process.send?.({ ready: true });
