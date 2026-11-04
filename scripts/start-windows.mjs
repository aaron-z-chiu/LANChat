import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const options = { profile: 'default', mode: 'start', build: false };

async function run(file, args = []) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.');
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i].toLowerCase();
    if (flag === '--help' || flag === '-help') {
      console.log('start-windows.cmd [-Profile default] [-Mode Start|Dev] [-Build]');
      return 0;
    }
    if (flag === '-build' || flag === '--build') { options.build = true; continue; }
    if (flag === '-profile' || flag === '--profile' || flag === '-mode' || flag === '--mode') {
      const value = args[++i];
      if (!value) throw new Error(`Missing value for ${flag}`);
      if (flag.endsWith('profile')) options.profile = value;
      else options.mode = value.toLowerCase();
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(options.profile)) throw new Error('Profile must use 1–40 letters, digits, underscores or hyphens.');
  if (!['start', 'dev'].includes(options.mode)) throw new Error('Mode must be Start or Dev.');
  if (options.build && options.mode === 'dev') throw new Error('Use -Build with Start mode; Dev already builds desktop code.');
  if (!existsSync(join(root, 'node_modules/electron/cli.js'))) throw new Error('Dependencies are missing. Run npm ci in the project directory first.');
  if (options.build) {
    let code = await run('node_modules/typescript/bin/tsc', ['--noEmit']);
    if (code !== 0) return code;
    code = await run('scripts/build.mjs');
    if (code !== 0) return code;
  }
  if (options.mode === 'dev') return run('scripts/dev.mjs', ['--profile', options.profile]);
  for (const asset of ['dist/main.cjs', 'dist/preload.cjs', 'dist/ui/index.html']) {
    if (!existsSync(join(root, asset))) throw new Error('Build output is missing. Run this launcher with -Build first.');
  }
  return run('node_modules/electron/cli.js', ['.', '--profile', options.profile]);
}

try { process.exitCode = await main(); }
catch (error) { console.error(`LANChat launcher: ${error.message}`); process.exitCode = 1; }
