import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { z } from 'zod';
import { Engine } from '../core/engine.js';
import { id, name } from '../core/protocol.js';

const flag = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const profile = flag('--profile') ?? 'default';
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(profile)) throw new Error('Profile must use 1–40 letters, digits, underscores or hyphens');
const root = process.env.LANCHAT_DATA_ROOT ? resolve(process.env.LANCHAT_DATA_ROOT) : join(app.getPath('appData'), 'LANChat');
const data = join(root, profile); mkdirSync(data, { recursive: true }); app.setPath('userData', data);
app.setName('LANChat');
// Each development profile is an independent equal peer; a profile itself may open only once.
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  let engine: Engine; let win: BrowserWindow; let quitting = false;
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(async () => {
    engine = new Engine(join(data, 'lanchat.sqlite'));
    const devUrl = process.env.LANCHAT_DEV_URL;
    if (devUrl && !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(devUrl)) throw new Error('Invalid local development URL');
    win = new BrowserWindow({ width: 1140, height: 780, minWidth: 760, minHeight: 540,
      title: `LANChat · ${profile}`, backgroundColor: '#f7f8fa',
      webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    const register = (method: string, schema: z.ZodType, handler: (...args: any[]) => unknown) => {
      ipcMain.handle(`lanchat:${method}`, (event, ...args) => {
        if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted IPC sender');
        return handler(...schema.parse(args) as any[]);
      });
    };
    register('snapshot', z.tuple([]), () => engine.snapshot());
    register('rename', z.tuple([name]), displayName => engine.rename(displayName));
    register('send', z.tuple([z.enum(['private', 'group']), id, z.string().trim().min(1).max(8000)]), (kind, target, content) => engine.sendMessage(kind, target, content));
    register('createGroup', z.tuple([name, z.array(id).max(64), z.union([z.literal(3600000), z.literal(28800000), z.null()])]), (n, m, l) => engine.createGroup(n, m, l));
    register('updateGroup', z.tuple([id, name, z.array(id).max(64)]), (g, n, m) => engine.updateGroup(g, n, m));
    register('leaveGroup', z.tuple([id]), g => engine.leaveGroup(g));
    register('network', z.tuple([z.boolean()]), online => online ? engine.start() : engine.stop());
    engine.on('change', snapshot => { if (!win.isDestroyed()) win.webContents.send('lanchat:state', snapshot); });
    if (devUrl) await win.loadURL(devUrl); else await win.loadFile(join(__dirname, 'ui', 'index.html'));
    try { await engine.start(); } catch (error) { console.error('Network startup failed', error); }
  }).catch(error => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (quitting || !engine) return;
    event.preventDefault(); quitting = true;
    engine.close().catch(console.error).finally(() => app.quit());
  });
}
