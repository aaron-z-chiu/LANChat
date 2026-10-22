import { contextBridge, ipcRenderer } from 'electron';
import type { API } from './api.js';
const api: API = {
  snapshot: () => ipcRenderer.invoke('lanchat:snapshot'),
  rename: name => ipcRenderer.invoke('lanchat:rename', name),
  send: (kind, target, content) => ipcRenderer.invoke('lanchat:send', kind, target, content),
  createGroup: (name, members, lifetime) => ipcRenderer.invoke('lanchat:createGroup', name, members, lifetime),
  updateGroup: (id, name, members) => ipcRenderer.invoke('lanchat:updateGroup', id, name, members),
  leaveGroup: id => ipcRenderer.invoke('lanchat:leaveGroup', id),
  network: online => ipcRenderer.invoke('lanchat:network', online),
  subscribe: callback => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: Parameters<Parameters<API['subscribe']>[0]>[0]) => callback(snapshot);
    ipcRenderer.on('lanchat:state', listener);
    return () => { ipcRenderer.removeListener('lanchat:state', listener); };
  },
};
contextBridge.exposeInMainWorld('lanchat', api);
