import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Group, Snapshot } from '../core/protocol';
import type {} from '../desktop/api';
import './style.css';

type Conversation = { kind: 'private' | 'group'; id: string };
const key = (c: Conversation) => `${c.kind}:${c.id}`;
const initials = (s: string) => s.trim().slice(0, 2).toUpperCase();
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(error);

function App() {
  const [state, setState] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [active, setActive] = useState<Conversation>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [groupEditor, setGroupEditor] = useState<Group | 'new'>();
  const [settings, setSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true, eventReceived = false;
    const unsubscribe = window.lanchat.subscribe(s => { eventReceived = true; if (live) setState(s); });
    window.lanchat.snapshot().then(s => { if (live && !eventReceived) setState(s); }).catch(e => setError(errorText(e)));
    return () => { live = false; unsubscribe(); };
  }, []);
  const me = state?.identity.peerId;
  const selectedPeer = state?.peers.find(p => p.peerId === active?.id);
  const selectedGroup = state?.groups.find(g => g.groupId === active?.id);
  const messages = (state?.messages ?? []).filter(m => active && (active.kind === 'group'
    ? m.kind === 'group' && m.targetId === active.id
    : m.kind === 'private' && (m.senderId === me ? m.targetId === active.id : m.senderId === active.id)))
    .sort((a, b) => a.timestamp - b.timestamp || a.messageId.localeCompare(b.messageId));
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, active?.id]);
  const report = (e: unknown) => setError(errorText(e));
  if (!state) return <div className="loading"><div className="brand-mark">L</div><h1>Opening LANChat</h1>{error && <p role="alert">{error}</p>}</div>;
  const who = (peerId: string) => peerId === me ? 'You' : state.peers.find(p => p.peerId === peerId)?.displayName ?? `Peer ${peerId.slice(0, 6)}`;
  const online = state.peers.filter(p => p.status === 'online').length;
  const title = active?.kind === 'private' ? selectedPeer?.displayName : selectedGroup?.name;
  const expired = selectedGroup?.expiresAt != null && selectedGroup.expiresAt <= Date.now();
  const inactive = active?.kind === 'group' && (!selectedGroup?.members.includes(me!) || expired);
  const draft = active ? drafts[key(active)] ?? '' : '';
  const setDraft = (value: string) => active && setDrafts(d => ({ ...d, [key(active)]: value }));
  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!active || !draft.trim() || sending || inactive) return;
    const conversation = active, text = draft;
    setSending(true);
    try {
      await window.lanchat.send(conversation.kind, conversation.id, text);
      setDrafts(d => d[key(conversation)] === text ? { ...d, [key(conversation)]: '' } : d);
    } catch (e) { report(e); } finally { setSending(false); }
  };
  const toggleNetwork = async () => {
    setNetworkBusy(true);
    try { await window.lanchat.network(!state.network); } catch (e) { report(e); } finally { setNetworkBusy(false); }
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">L</div><div><strong>LANChat</strong><span>A little closer, offline.</span></div></div>
      <div className={`network-card ${state.network ? '' : 'paused'}`}>
        <div><span className={`dot ${state.network ? 'online' : ''}`} /><strong>{state.network ? 'Local network' : 'Network paused'}</strong></div>
        <p>{state.network ? `${online} nearby ${online === 1 ? 'person' : 'people'} · no internet needed` : 'Your history is available offline'}</p>
        <button className="text-button" onClick={toggleNetwork} disabled={networkBusy || !state.identity.displayName}>{networkBusy ? 'Updating…' : state.network ? 'Pause connection' : 'Reconnect'}</button>
      </div>
      <div className="sidebar-scroll">
        <div className="section-label"><h2>Nearby</h2><span>{state.peers.length}</span></div>
        {!state.peers.length && <p className="sidebar-empty">People on the same Wi-Fi appear here automatically.</p>}
        {[...state.peers].sort((a, b) => Number(b.status === 'online') - Number(a.status === 'online') || a.displayName.localeCompare(b.displayName)).map(p =>
          <button key={p.peerId} className={`conversation ${active?.id === p.peerId ? 'selected' : ''}`} onClick={() => setActive({ kind: 'private', id: p.peerId })} aria-pressed={active?.id === p.peerId}>
            <span className="avatar">{initials(p.displayName)}<span className={`dot ${p.status === 'online' ? 'online' : ''}`} /></span>
            <span className="conversation-text"><strong>{p.displayName}</strong><small>{p.status === 'offline' ? 'Offline' : p.connection === 'CONNECTED' ? `Connected via ${(p.transport ?? 'tcp').toUpperCase()}${p.fallback ? ' (fallback)' : ''}` : 'Connecting…'}</small></span>
          </button>)}
        <div className="section-label group-label"><h2>Groups</h2><button className="add-button" onClick={() => setGroupEditor('new')} aria-label="Create group">+</button></div>
        {!state.groups.length && <p className="sidebar-empty">Bring your nearby people into one conversation.</p>}
        {state.groups.map(g => <button key={g.groupId} className={`conversation ${active?.id === g.groupId ? 'selected' : ''}`} onClick={() => setActive({ kind: 'group', id: g.groupId })} aria-pressed={active?.id === g.groupId}>
          <span className="avatar room-avatar">#</span><span className="conversation-text"><strong>{g.name}</strong><small>{!g.members.includes(me!) ? 'You left this group' : g.expiresAt !== null && g.expiresAt <= Date.now() ? 'Expired' : `${g.members.length} members`}</small></span>
        </button>)}
      </div>
      <button className="profile" onClick={() => setSettings(true)} aria-label="Edit display name"><span className="avatar self-avatar">{initials(state.identity.displayName || '?')}</span><span className="conversation-text"><strong>{state.identity.displayName || 'Set up profile'}</strong><small>Your local profile</small></span><span aria-hidden="true">⚙</span></button>
    </aside>
    <main className="main-panel">
      {(error || state.error) && <div role="alert" className="error-banner"><span>{error || state.error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {active && title ? <>
        <header className="chat-header"><div className="avatar room-avatar">{active.kind === 'group' ? '#' : initials(title)}</div><div><h1>{title}</h1><p>{active.kind === 'group' ? `${selectedGroup?.members.map(who).join(', ')}${expired ? ' · Expired' : selectedGroup?.expiresAt ? ` · Expires ${new Date(selectedGroup.expiresAt).toLocaleString()}` : ''}` : selectedPeer?.status === 'online' ? 'Nearby · direct connection' : 'Offline · messages will wait for reconnection'}</p></div>{active.kind === 'group' && selectedGroup?.members.includes(me!) && <button className="secondary" onClick={() => setGroupEditor(selectedGroup)}>Manage group</button>}</header>
        <div className="message-list" role="log" aria-label={`${title} messages`} aria-live="polite">
          <div className="conversation-start"><span>{active.kind === 'group' ? '#' : '↔'}</span><h2>{title}</h2><p>{active.kind === 'group' ? 'A shared room, stored by its members.' : 'A direct conversation across your local network.'}</p><small>Stored on your devices · LAN traffic is unencrypted</small></div>
          {messages.map((m, i) => { const own = m.senderId === me; const day = new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const firstOfDay = !i || new Date(messages[i - 1].timestamp).toDateString() !== new Date(m.timestamp).toDateString();
            return <React.Fragment key={m.messageId}>{firstOfDay && <div className="day-label"><span>{day}</span></div>}<article className={`message-row ${own ? 'own' : ''}`} data-message-id={m.messageId}>
              {!own && <span className="avatar message-avatar">{initials(who(m.senderId))}</span>}
              <div className="message-body">{!own && active.kind === 'group' && <strong className="sender-name">{who(m.senderId)}</strong>}<div className="bubble">{m.content}</div><div className="message-meta"><time dateTime={new Date(m.timestamp).toISOString()}>{clock(m.timestamp)}</time>{own && <span title={m.state === 'failed' ? 'No acknowledgement yet. Retrying automatically.' : 'Delivery means the receiving app saved the message.'}>{m.state === 'delivered' ? `✓ Delivered${active.kind === 'group' && m.recipients ? ` ${m.delivered}/${m.recipients}` : ''}` : m.state === 'failed' ? '↻ Retrying' : m.state === 'sent' ? `Sent${m.delivered ? ` · ${m.delivered}/${m.recipients}` : ''}` : '◷ Queued'}</span>}</div></div>
            </article></React.Fragment>; })}
          <div ref={bottom} />
        </div>
        <div className="composer-area">{inactive ? <p className="inactive-note">{expired ? 'This temporary group has expired.' : 'You are no longer a member.'} Your history is still available.</p> : <form className="composer" onSubmit={send}><textarea aria-label="Message" placeholder={`Message ${title}…`} value={draft} onChange={e => setDraft(e.target.value)} maxLength={8000} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button className="primary" type="submit" disabled={!draft.trim() || sending}>Send <span aria-hidden="true">↑</span></button></form>}<div className="composer-hint"><span>{state.network ? 'Direct from device to device' : 'Network paused · messages stay queued'}</span><span>Enter to send · Shift+Enter for a new line</span></div></div>
      </> : <div className="welcome"><div className="welcome-symbol">↔</div><span className="eyebrow">SAME NETWORK. SHARED MOMENTS.</span><h1>Good conversations.<br />No internet required.</h1><p>Say hello to someone nearby, or make a group for the people around you. All you need is the same local network.</p><button className="primary" onClick={() => setGroupEditor('new')}>Create a group <span aria-hidden="true">+</span></button><div className="welcome-details"><span>○ No accounts</span><span>↔ Peer to peer</span><span>⌂ Stored locally</span></div></div>}
    </main>
    {(!state.identity.displayName || settings) && <NameDialog initial={state.identity.displayName} priority={state.priority ?? 'auto'} onPriority={value=>window.lanchat.priority(value)} onClose={state.identity.displayName ? () => setSettings(false) : undefined} onSave={async value => { await window.lanchat.rename(value); setSettings(false); }} />}
    {groupEditor && <GroupDialog state={state} group={groupEditor === 'new' ? undefined : groupEditor} onClose={() => setGroupEditor(undefined)} onSave={async (groupName, members, lifetime) => {
      if (groupEditor === 'new') { const groupId = await window.lanchat.createGroup(groupName, members, lifetime); setActive({ kind: 'group', id: groupId }); }
      else await window.lanchat.updateGroup(groupEditor.groupId, groupName, members);
      setGroupEditor(undefined);
    }} onLeave={groupEditor === 'new' ? undefined : async () => { await window.lanchat.leaveGroup(groupEditor.groupId); setGroupEditor(undefined); }} />}
  </div>;
}

function NameDialog({ initial, onSave, onClose, priority, onPriority }: { priority: string; onPriority: (value: 'auto'|'safe'|'custom')=>Promise<void>; initial: string; onSave: (value: string) => Promise<void>; onClose?: () => void }) {
  const [value, setValue] = useState(initial), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="name-title"><div className="brand-mark">L</div><h2 id="name-title">{initial ? 'Your local profile' : 'Welcome to LANChat'}</h2><p>Choose a name so people on your local network can find you.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSave(value.trim()); } catch (err) { setError(errorText(err)); } finally { setBusy(false); } }}><label htmlFor="network-priority">Network priority</label><select id="network-priority" value={priority} onChange={e => { void onPriority(e.target.value as 'auto'|'safe'|'custom').catch(err=>setError(errorText(err))); }}><option value="auto">Auto — prefer available reliable UDP, with TCP fallback</option><option value="safe">Safe — standard TCP</option><option value="custom">Custom — prefer LRDT, with TCP fallback</option></select><label htmlFor="display-name">Display name</label><input id="display-name" value={value} onChange={e => setValue(e.target.value)} maxLength={64} autoFocus required autoComplete="nickname" />{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions">{onClose && <button type="button" className="secondary" onClick={onClose}>Cancel</button>}<button className="primary" disabled={!value.trim() || busy}>{busy ? 'Saving…' : initial ? 'Save name' : 'Join local network'}</button></div></form><small className="muted">No account needed. Your identity stays on this device.</small></section></div>;
}

function GroupDialog({ state, group, onClose, onSave, onLeave }: { state: Snapshot; group?: Group; onClose: () => void; onSave: (name: string, members: string[], lifetime: number | null) => Promise<void>; onLeave?: () => Promise<void> }) {
  const [value, setValue] = useState(group?.name ?? ''), [members, setMembers] = useState(group?.members ?? [state.identity.peerId]);
  const [lifetime, setLifetime] = useState('manual'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const choices = [...new Set([...state.peers.map(p => p.peerId), ...(group?.members ?? [])])].filter(p => p !== state.identity.peerId);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop"><section className="modal group-modal" role="dialog" aria-modal="true" aria-labelledby="group-title"><h2 id="group-title">{group ? 'Manage group' : 'Make room for everyone'}</h2><p>{group ? 'Any current member can update this shared room.' : 'Invite people nearby to a decentralized group.'}</p><form onSubmit={e => { e.preventDefault(); void run(() => onSave(value.trim(), members, lifetime === 'manual' ? null : Number(lifetime))); }}><label htmlFor="group-name">Group name</label><input id="group-name" value={value} onChange={e => setValue(e.target.value)} maxLength={64} required autoFocus /><label>Members</label><div className="member-list"><div className="member-option"><span className="avatar self-avatar">{initials(state.identity.displayName)}</span><span>{state.identity.displayName} (you)</span><span className="muted">Included</span></div>{choices.map(peerId => { const p = state.peers.find(p => p.peerId === peerId); return <label className="member-option" key={peerId}><span className="avatar">{initials(p?.displayName ?? '?')}</span><span>{p?.displayName ?? `Peer ${peerId.slice(0, 6)}`}<small>{p?.status === 'online' ? 'Nearby' : 'Offline'}</small></span><input type="checkbox" aria-label={`Include ${p?.displayName ?? peerId}`} checked={members.includes(peerId)} onChange={e => setMembers(m => e.target.checked ? [...m, peerId] : m.filter(id => id !== peerId))} /></label>; })}{!choices.length && <p className="sidebar-empty">You can create the room now and add people when they appear.</p>}</div>{!group && <><label htmlFor="lifetime">Room lifetime</label><select id="lifetime" value={lifetime} onChange={e => setLifetime(e.target.value)}><option value="manual">Until everyone leaves</option><option value="3600000">1 hour</option><option value="28800000">8 hours</option></select></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions">{onLeave && <button type="button" className="danger text-button" disabled={busy} onClick={() => void run(onLeave)}>Leave group</button>}<button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={!value.trim() || busy || members.length > 64}>{busy ? 'Saving…' : group ? 'Save changes' : 'Create group'}</button></div></form></section></div>;
}

createRoot(document.getElementById('root')!).render(<App />);
