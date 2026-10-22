# LANChat

LANChat is an offline, decentralized desktop messenger for macOS and Windows. People on the same Wi-Fi or LAN automatically discover each other, exchange direct private messages, and create shared group chats. Every instance is an equal peer with its own SQLite database. There is no account, cloud API, dedicated messaging server, or central group database.

Useful on a ship, in a classroom, on temporary Wi-Fi, during an Internet outage, or on an airplane **if its network permits communication between passengers' devices**. Devices still need a shared local network; LANChat cannot communicate between disconnected computers or bypass access-point client isolation.

## Run locally

Install Node.js **24 or newer**, including npm. Dependency installation needs Internet access once; the installed application works without it.

```sh
npm install
npm run dev -- --profile peer-a
```

Enter a display name on first launch. Nearby peers appear automatically. Choose a person to open a private conversation, or click **+** beside Groups to create a room. **Manage group** changes its name or members and lets you leave. Enter sends a message; Shift+Enter inserts a newline.

For the compiled app, without a development server:

```sh
npm run build
npm start -- --profile peer-a
```

`build` produces application files in `dist/`, not an installer. `npm start` uses only local assets. No signing, installers, auto-update, or deployment infrastructure is included.

## Run three local peers

Use three terminals in this directory:

```sh
npm run dev -- --profile peer-a
```

```sh
npm run dev -- --profile peer-b
```

```sh
npm run dev -- --profile peer-c
```

Choose different names. Each profile has a persistent UUID, separate SQLite database, Electron session, Vite port, and automatically assigned TCP port. Multicast loopback supports discovery between local instances; production and development use the same networking engine. A single profile cannot open twice.

Data lives under Electron's platform app-data directory, in `LANChat/<profile>/lanchat.sqlite`. Set the optional `LANCHAT_DATA_ROOT` environment variable to change the parent directory. Windows PowerShell example:

```powershell
$env:LANCHAT_DATA_ROOT = Join-Path $PWD '.local-data'
npm run dev -- --profile peer-a
```

macOS example:

```sh
LANCHAT_DATA_ROOT=.local-data npm run dev -- --profile peer-a
```

Copying a profile to another concurrently running device duplicates its identity and is unsupported. To create another person, use another profile rather than copying a database.

## Architecture

```text
+-----------------------------------------------------+
| React desktop UI                                    |
| names, nearby people, conversations, groups, delivery|
+-----------------------------------------------------+
| Sandboxed Electron preload: small validated IPC API  |
+-----------------------------------------------------+
| Messaging / groups (Engine)                          |
| ACK after persistence, retries, membership, expiry   |
+-----------------------------------------------------+
| Identity / SQLite Store / paged synchronization      |
| immutable message IDs, group revisions, durable queue|
+---------------------------+-------------------------+
| UDP Discovery             | TCP Transport           |
| multicast + broadcast     | framed JSON, HELLO      |
| announce/heartbeat/goodbye | canonical links, retry  |
+---------------------------+-------------------------+
| Shared IPv4 LAN; every running instance is a peer    |
+-----------------------------------------------------+
```

- `src/core/protocol.ts`: runtime schemas, wire types, length-prefixed framing, group conflict comparison.
- `src/core/discovery.ts`: IPv4 interface enumeration, multicast membership, subnet broadcast, heartbeat.
- `src/core/transport.ts`: direct sockets, handshake, canonical connections, liveness, bounded writes.
- `src/core/store.ts`: SQLite schema, transactions, identity, deduplication, delivery state, log pages.
- `src/core/engine.ts`: group replication, visibility filtering, ACK, retries, offline and reconnect handling.
- `src/desktop/`: Electron lifecycle, per-profile data directories, IPC validation and preload.
- `src/ui/`: React interface. It cannot access Node, sockets, or SQL.

SQLite uses Node's built-in `node:sqlite` API, avoiding a native npm addon and platform-specific rebuilds. This is supported by the pinned Electron runtime; Node may print an experimental API warning. See [Node SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) and [Electron's SQLite support fix](https://releases.electronjs.org/pr/47706).

## LANChat Protocol (LCP v1)

Discovery datagrams contain `protocol: "LANChat"`, `version: 1`, `type`, `peerId`, `displayName`, and the peer's dynamic `tcpPort`. Supported types: `ANNOUNCE`, `HEARTBEAT`, `GOODBYE`. The source address supplies the current IP; permanent identity is a saved UUID, never an IP address.

Discovery uses UDP **45878**, multicast **239.255.42.99** with TTL 1, and per-interface IPv4 subnet broadcasts. It enumerates external IPv4 interfaces, refreshes memberships every heartbeat, and joins loopback for local profiles. Announcements go out every **2 seconds**; peers go offline after **8 seconds** without discovery traffic. Graceful shutdown sends GOODBYE. VPNs and multiple NICs can affect route selection; there is no manual IP setup.

TCP listens on an OS-assigned IPv4 port. Each frame is a **4-byte unsigned big-endian byte length** followed by UTF-8 JSON. The decoder buffers incomplete frames and extracts multiple frames from a single data callback. Frames are limited to **256 KiB**. Datagrams are limited to **2 KiB**, names to **64 characters**, chat content to **8,000 JavaScript string units**, groups to **64 current members**, and known peers to **256**. Malformed packets are ignored; invalid TCP frames close only that socket. Handshakes have a 5-second deadline; PING/PONG and a 15-second idle timeout detect stalled connections. Per-socket output buffers and open connections are bounded.

TCP envelopes include `version`, `type`, and `senderId`. Families:

| Type | Purpose |
| --- | --- |
| `HELLO` | Peer UUID, display name, advertised TCP port, database incarnation UUID |
| `PING`, `PONG` | Application connection liveness |
| `PRIVATE_MESSAGE`, `GROUP_MESSAGE` | Immutable persisted message and delivery audience |
| `ACK` | Receiver committed the referenced message ID to SQLite |
| `GROUP_UPDATE` | Complete revisioned snapshot, including creation, update, and leave |
| `SYNC_REQUEST` | Request UUID and source-local sequence cursor |
| `SYNC_RESPONSE` | Matching request UUID, next cursor, up to 16 messages, `more` |

A persistent chat message contains `version`, globally unique `messageId`, `senderId`, `timestamp`, `kind`, `targetId`, `content`, and `audience`. For private messages `targetId` is the recipient; for group messages it is the group UUID. Group snapshots contain `groupId`, name, current members, historical audience, revision, updater UUID, event UUID, and optional absolute `expiresAt`.

### Connection and delivery rules

The **lexically smaller peer UUID initiates** the canonical TCP connection; both endpoints enforce the same direction. Repeated dial requests and duplicate connections cannot create two active links. Dropped connections retry while the peer is discovered online; no application restart is needed.

Outgoing messages and their recipients are committed together before socket transmission. Receivers validate identity/membership, insert with a unique message ID, update local state, and **ACK only after the transaction commits**. Duplicate messages are not inserted, but are acknowledged again. ACKs update only the corresponding recipient's pending row.

The UI shows queued, sent, delivered, or retrying. After five unsuccessful transmission attempts the internal state is `failed`, displayed as **Retrying**; it continues retrying with exponential delay capped at 30 seconds. `sent` means written to a socket, not acknowledged. `delivered` means saved by every applicable recipient, not read by a person. Group messages display an acknowledged recipient count. Pending sends survive restart, including messages composed while disconnected.

### Groups and deterministic conflicts

Each member saves its own group snapshot. Updates are exchanged immediately and periodically over direct peer connections. There is no owner server: any current member may edit or leave a group.

Snapshots compare by the lexicographic tuple **(revision, updater UUID, event UUID)**, greatest wins, using locale-independent string ordering. Local edits increment revision. This produces deterministic eventual convergence for received snapshots. Concurrent edits replace a whole snapshot rather than merging member lists; a winning edit can overwrite another edit or leave. Historical participant IDs are retained so offline former members receive removal/leave state. The historical audience is capped at 128 identities per room.

Rooms can last until everyone leaves, one hour, or eight hours. Expiry prevents new local sends; leaving removes membership. Empty and expired rooms remain as inactive history/tombstones. They are not securely erased, and there is no manual room-delete UI.

### Missing-message recovery

Each database has an append-only local message sequence and a persistent incarnation UUID. A receiver stores one cursor per source database. On reconnect and every four seconds, members exchange group snapshots and request log pages after their last source cursor. Responses contain at most 16 messages and fit the frame byte limit, including Unicode. A response must match the current request UUID. Group changes reset cursors and invalidate outstanding requests to rescan newly authorized scope safely. Old sequence gaps caused by visibility filtering are expected.

Private history is shared **only between its original two endpoints**, directly. Group history may be recovered from another current member; this is history synchronization, not real-time multi-hop routing. Only current shared group members may exchange history, and a recipient must have been in the message's original audience. New invitees do not receive pre-invitation history. Immutable message IDs deduplicate overlap from several peers. Sync traffic does not trust wall-clock timestamps as a completeness cursor.

Recovery is possible only if a reachable eligible peer still has the message. Losing all copies loses the message. Membership changes may cancel undelivered group recipients; current group membership takes precedence over an older pending audience.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:desktop
npm run test:desktop -- --dev
```

`npm test` uses Node's test runner with TypeScript loading. Networking tests open real UDP and TCP sockets and fork three separate peer processes, with isolated temporary databases and a separate discovery port. They do not replace the network with mocks. Tests clean up their processes and databases. Sandboxed environments must allow local listening sockets.

The desktop smoke test uses Playwright to launch three real Electron profiles against the compiled `dist/` app. Run `npm run build` first. Add `-- --dev` to repeat it against a real local Vite server using the compiled main/preload. It exercises name setup, discovery, PM and ACK, group creation and exchange, metadata update, network pause/reconnect, desktop restart with retained identity/history, IPC rejection, and Electron isolation settings. Chromium is placed offline after initial file loading; the main-process LAN transport continues working. It writes `docs/desktop-smoke.png` and removes its temporary profiles. No extra Chromium download is required.

### macOS test status

Verified on the current macOS Apple Silicon machine with Node 25 and Electron 45:

- Type checking and compiled app build; three-window Electron smoke in both compiled and Vite development modes.
- All 10 automated protocol, framing, SQLite, group conflict, delivery, expiry/offline, and multi-process tests passed.
- Three real peer processes: automatic discovery in both directions, PM/ACK, group fanout, persisted identity/history, duplicate rejection, GOODBYE and crash timeout, reconnection on a new port.
- Charlie recovers 38 missed group messages in several pages from Bob while Alice (the original sender of most of them) is offline. Alice later retries; no duplicate entries appear.

Desktop smoke results and the final test count are recorded in [implementation status](docs/IMPLEMENTATION_STATUS.md). Local-loopback success does not prove that a particular router permits cross-device multicast/broadcast. A separate physical-device LAN test remains necessary.

### Windows real-machine verification plan

Windows source/configuration is prepared, but **Windows has not been run in this session**. Use Node 24+ and the same commands in PowerShell. No Unix shell is used by application runtime or development scripts. Dependencies install the platform's Electron build; paths come from Electron/Node APIs.

1. Connect Windows and macOS to the same ordinary/private Wi-Fi, with client isolation disabled. Disconnect WAN/Internet if desired.
2. Install dependencies, build, and start one unique profile on each computer. Allow the LANChat development Electron executable on the **private network** when Windows Firewall prompts. Verify UDP 45878 and direct inbound/outbound dynamic TCP connectivity.
3. Confirm discovery in both directions and correct display names. Change the name and verify propagation.
4. Send private messages both ways and confirm saved delivery ACKs and history after restart.
5. Add a third peer. Create a group, exchange messages, edit name/members, and verify all copies.
6. Disconnect a member's Wi-Fi, send messages from both remaining members, then reconnect without restarting the app. Confirm stable UUID, updated group revision, complete missing history, and no duplicates.
7. Stop the original sender before reconnection and verify recovery from the other member. Confirm unrelated private messages are absent.
8. Verify timeout after killing a process without GOODBYE, reconnection after Wi-Fi/IP changes, firewall behavior, sleep/wake, and Ethernet/Wi-Fi/VPN combinations.
9. Check separate local profiles, Unicode/newlines, the temporary room deadline, minimum window size, and graceful shutdown.

## Known limitations

- Trusted local networks only: traffic and SQLite contents are **unencrypted**, UUIDs are not authenticated identities, and group metadata/relayed message authorship are not cryptographically verified. A malicious participant can impersonate a peer or fabricate state. Do not use this version for sensitive communication.
- IPv4 and one local discovery domain only. Access-point client isolation, blocked UDP, VPN routing, or restrictive firewalls can prevent discovery or direct connections. No WAN relay, NAT traversal, or manual remote connection feature.
- Tested on one macOS machine with multiple independent processes/windows; Windows and physical cross-device interoperability, real IP changes, and sleep/wake still need verification.
- Simple whole-snapshot group conflicts can overwrite concurrent edits, including a leave. Tombstone/history retention is indefinite; no secure expiration or full delete.
- History sync supports small LAN groups. The UI loads local history into memory, snapshots use full local state, and group changes rescan logs. No archival/pruning, large-history pagination in the UI, or unbounded-size LAN support.
- Packet/input size and connection limits protect against basic malformed traffic; there is no comprehensive denial-of-service protection.
- Display order uses sender wall-clock timestamps and UUID tie-breaking; clocks are not synchronized. Expiry also depends on device clocks.
- Main/preload source edits require restarting `npm run dev`; React/CSS changes use Vite HMR. Compiled mode has no development server.

## Future work

Physical macOS/Windows testing first, then authenticated identity and reviewed E2EE design, QR verification, more precise group conflict rules, history pagination/retention, file transfer, and eventually a mobile client. Voice/video, cloud messaging, central servers, consensus protocols, and multi-hop wireless routing are outside this implementation.
