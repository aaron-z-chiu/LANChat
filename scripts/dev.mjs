import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { createServer } from 'vite';
import electron from 'electron';
// Each invocation gets its own Vite port, desktop profile and ephemeral TCP port.
await build({ entryPoints: ['src/desktop/main.ts'], outfile: 'dist/main.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/desktop/preload.ts'], outfile: 'dist/preload.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
const server = await createServer({ root: 'src/ui', server: { host: '127.0.0.1', port: 5173 }, base: './' });
await server.listen();
const url = server.resolvedUrls.local[0];
const env = { ...process.env, LANCHAT_DEV_URL: url };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('error', async error => { console.error(error); await server.close(); process.exitCode = 1; });
const stop = () => child.kill();
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 0; });
