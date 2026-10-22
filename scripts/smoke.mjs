import { _electron as electron, expect } from 'playwright/test';
import electronPath from 'electron';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import dgram from 'node:dgram';
import { once } from 'node:events';

const root = await mkdtemp(join(tmpdir(), 'lanchat-desktop-'));
const apps = [], rendererErrors = [], logs = [];
const env = { ...process.env, LANCHAT_DATA_ROOT: root };
delete env.ELECTRON_RUN_AS_NODE;
const discoverySocket=dgram.createSocket('udp4');discoverySocket.bind(0);await once(discoverySocket,'listening');env.LANCHAT_DISCOVERY_PORT=String(discoverySocket.address().port);await new Promise(r=>discoverySocket.close(r));
const devServer = process.argv.includes('--dev') ? await createServer({ root: 'src/ui', server: { host: '127.0.0.1', port: 0 }, base: './' }) : undefined;
if (devServer) { await devServer.listen(); env.LANCHAT_DEV_URL = devServer.resolvedUrls.local[0]; }
else delete env.LANCHAT_DEV_URL;
async function launch(profile) {
  const app = await electron.launch({ executablePath: electronPath, args: ['.', '--profile', profile, ...(process.argv.includes('--blocked-lrdt') ? ['--disable-lrdt'] : [])], env, timeout: 25000 });
  apps.push(app);
  app.process().stderr?.on('data', bytes => logs.push(bytes.toString()));
  const page = await app.firstWindow();
  page.on('pageerror', error => rendererErrors.push(error.message));
  await page.waitForSelector('.app-shell');
  return { app, page };
}
async function waitFor(check, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(`Desktop smoke timed out: ${label}`);
}
const snapshot = page => page.evaluate(() => window.lanchat.snapshot());
const send = async (page, content) => { await page.getByRole('textbox', { name: 'Message', exact: true }).fill(content); await page.getByRole('button', { name: /Send/ }).click(); };
try {
  const peers = [];
  for (const [profile, name] of [['a', 'Alice'], ['b', 'Bob'], ['c', 'Charlie']]) {
    const peer = await launch(profile);
    await peer.page.getByLabel('Display name', { exact: true }).fill(name);
    await peer.page.getByRole('button', { name: 'Join local network' }).click();
    await peer.page.getByRole('dialog').waitFor({ state: 'hidden' });
    // Chromium has no network access for the rest of the test. Main-process UDP/TCP
    // and local IPC continue to operate without any browser or cloud service.
    await peer.page.context().setOffline(true);
    peers.push(peer);
  }
  const [a, b, c] = peers;
  await waitFor(async () => (await Promise.all(peers.map(p => snapshot(p.page)))).every(s => s.peers.length === 2 && s.peers.every(p => p.connection === 'CONNECTED')), 'three desktop profiles discover each other');
  const blocked=process.argv.includes('--blocked-lrdt');
  await waitFor(async()=> (await Promise.all(peers.map(p=>snapshot(p.page)))).every(s=>s.peers.every(p=>blocked ? p.fallback : p.transport==='lrdt')), 'Auto LRDT selection or forced fallback');
  await a.page.getByRole('button',{name:'Edit display name'}).click();
  await a.page.getByLabel('Network priority',{exact:true}).selectOption('safe');
  await waitFor(async()=> (await snapshot(a.page)).peers.every(p=>p.connection==='CONNECTED'&&p.transport==='tcp'), 'Safe selects TCP');
  await a.page.getByRole('button',{name:'Cancel',exact:true}).click();
  await a.page.getByRole('button',{name:'Edit display name'}).click();
  await a.page.getByLabel('Network priority',{exact:true}).selectOption('custom');
  await waitFor(async()=> (await snapshot(a.page)).peers.every(p=>p.connection==='CONNECTED'&&(blocked?p.fallback:p.transport==='lrdt')), 'Custom renegotiates');
  await a.page.getByRole('button',{name:'Cancel',exact:true}).click();
  const security = await a.app.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox };
  });
  if (!security.contextIsolation || security.nodeIntegration || !security.sandbox) throw new Error('Unsafe Electron preferences');
  if (await a.page.evaluate(() => typeof window.require !== 'undefined' || typeof window.process !== 'undefined')) throw new Error('Renderer has Node access');
  await a.page.locator('.conversation').filter({ hasText: 'Bob' }).click();
  await send(a.page, 'Hello Bob, directly over the LAN.');
  await b.page.locator('.conversation').filter({ hasText: 'Alice' }).click();
  await b.page.getByRole('log').getByText('Hello Bob, directly over the LAN.', { exact: true }).waitFor();
  await a.page.getByText('✓ Delivered', { exact: true }).waitFor();
  await a.page.getByRole('button', { name: 'Create group', exact: true }).click();
  await a.page.getByLabel('Group name', { exact: true }).fill('Flight Friends');
  await a.page.getByLabel('Include Bob', { exact: true }).check();
  await a.page.getByLabel('Include Charlie', { exact: true }).check();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Create group', exact: true }).click();
  await a.page.getByRole('dialog').waitFor({ state: 'hidden' });
  await a.page.locator('.chat-header').getByRole('heading', { name: 'Flight Friends', exact: true }).waitFor();
  await send(a.page, 'Welcome aboard.');
  for (const p of [b, c]) { await p.page.locator('.conversation').filter({ hasText: 'Flight Friends' }).click(); await p.page.getByRole('log').getByText('Welcome aboard.', { exact: true }).waitFor(); }
  await send(b.page, 'Hello from Bob.');
  await c.page.getByRole('log').getByText('Hello from Bob.', { exact: true }).waitFor();
  await c.page.getByRole('button', { name: 'Pause connection', exact: true }).click();
  await waitFor(async () => !(await snapshot(c.page)).network, 'pause network');
  await send(a.page, 'Sent while Charlie was disconnected.');
  await a.page.getByRole('button', { name: 'Manage group' }).click();
  await a.page.getByLabel('Group name', { exact: true }).fill('Boarding Friends');
  await a.page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await c.page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await c.page.getByRole('heading', { name: 'Boarding Friends', exact: true }).first().waitFor();
  await c.page.getByRole('log').getByText('Sent while Charlie was disconnected.', { exact: true }).waitFor();
  await waitFor(async () => (await snapshot(a.page)).messages.filter(m => m.kind === 'group').every(m => m.state === 'delivered'), 'reconnect ACKs');
  const old = await snapshot(b.page);
  await b.app.close();
  const restarted = await launch('b');
  await waitFor(async () => (await snapshot(restarted.page)).identity.peerId === old.identity.peerId && (await snapshot(restarted.page)).peers.every(p => p.connection === 'CONNECTED'), 'desktop SQLite identity and restart');
  await restarted.page.locator('.conversation').filter({ hasText: 'Boarding Friends' }).click();
  await restarted.page.getByRole('log').getByText('Welcome aboard.', { exact: true }).waitFor();
  const saved = await snapshot(restarted.page);
  if (saved.messages.length !== new Set(saved.messages.map(m => m.messageId)).size) throw new Error('Duplicate messages after restart');
  await expect(restarted.page.getByRole('dialog')).toHaveCount(0);
  // Invalid IPC payload must be rejected without changing the database.
  const rejected = await restarted.page.evaluate(async () => {
    try { await window.lanchat.send('private', 'invalid-id', 'oops'); return false; } catch { return true; }
  });
  if (!rejected) throw new Error('Invalid IPC input accepted');
  await a.page.screenshot({ path: 'docs/desktop-smoke.png' });
  if (rendererErrors.length) throw new Error(rendererErrors.join('\n'));
  console.log(JSON.stringify({ success: true, mode: devServer ? 'development' : 'compiled', profiles: 3, runtime: await a.app.evaluate(() => process.versions), security, verified: ['Settings Safe selects TCP', 'Settings Custom selects LRDT or blocked-UDP fallback', 'first-launch setup', 'automatic UDP discovery', 'private message + persisted ACK', 'group create + fanout', 'group rename replication', 'pause + reconnect recovery', 'stable identity/history after desktop restart', 'no duplicate messages', 'IPC validation', 'no renderer Node access', 'Chromium offline'], screenshot: 'docs/desktop-smoke.png' }, null, 2));
} catch (error) {
  console.error(logs.join('').slice(-12000));
  throw error;
} finally {
  for (const app of apps.reverse()) await app.close().catch(() => {});
  await devServer?.close();
  await rm(root, { recursive: true, force: true });
}
