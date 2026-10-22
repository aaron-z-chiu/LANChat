# Dual-transport upgrade — 22 October 2026

This section supersedes the original TCP-only session notes below.

- **Dual-Transport Architecture — completed:** Engine uses Transport Manager; original TCP implementation/framing/canonical connections remain. TCP stays active for negotiation/control/fallback while selected LRDT carries LCP frames.
- **LRDT — completed for educational use:** 1,200-byte datagrams, binary headers, session-bound handshake, fragmentation/reassembly, sequence numbers, selective ACK/retransmission, bounded ordered receive window, duplicate suppression, adaptive RTT/RTO with Karn sampling, slow start/additive increase/timeout decrease, statistics and seeded impairment.
- **Mode Negotiation — completed:** persisted Auto/Safe/Custom Settings and CLI override. Either Safe selects TCP; two compatible non-Safe modes prefer LRDT. Mode edits restart sessions with history/pending state retained. Custom replaces proposed Speed because bulk measurements favor TCP.
- **Fallback — completed:** bounded 1.5-second handshake, session failure/idle/expiry detection, TCP fallback notice and latch. Real blocked-UDP tests cover Auto and Custom.
- **Benchmark Status — measured:** 54 runs, three repetitions, seeds 100–102; virtual-time production-session loss/window/cwnd/jitter experiments plus real loopback engine TCP/LRDT/mode/fallback/recovery runs. JSON/CSV and congestion traces in results/. See LRDT_EVALUATION.md for exact measurements and limits.
- **Tests:** 39 standard tests passed (preserved TCP recovery and new LRDT/mixed/fallback tests); separate two-test multi-process recovery invocation passed with Auto/LRDT. Updated compiled Electron smoke passed with Settings Safe/Custom and default LRDT; the blocked-LRDT desktop fallback smoke also passed.
- **Partial / untested:** no fast retransmit, MTU probing, fairness validation, or Windows/physical cross-device execution. Detailed statistical loss/reordering tests use a simulated clock, not physical radio loss. TCP is a required control channel. Expiration/security/scaling limitations in the original implementation still apply.
- **Windows physical-test status:** still pending. Allow UDP discovery 45878, dynamic LRDT UDP, and dynamic TCP control/fallback. No Windows runtime success is claimed.

Commands: `npm test`, `npm run test:lrdt`, `npm run build`, `npm run test:desktop`, `npm run test:desktop -- --blocked-lrdt`, `npm run benchmark`. Design: LRDT_DESIGN.md. Evaluation: LRDT_EVALUATION.md.

---

# LANChat implementation status

Session date: **22 October 2026 (Asia/Singapore)**.

## Completed

- Electron desktop application with React, strict TypeScript, a bundled main process, sandboxed preload, and local renderer assets.
- First-launch display-name setup, persisted UUID identity, display-name changes without changing identity, and independent development profiles.
- Automatic IPv4 UDP multicast and subnet-broadcast discovery across enumerated interfaces, including local multicast loopback. ANNOUNCE, HEARTBEAT, GOODBYE, peer timeout, interface refresh, and saved offline peers.
- Direct long-lived TCP links on dynamic ports, HELLO identity checks, canonical connection direction, duplicate connection prevention, retry after failure, handshake deadline, PING/PONG liveness, and output/connection limits.
- LCP v1 strict input schemas and four-byte length-prefixed JSON framing. Fragmented and coalesced TCP input, malformed frames, Unicode, unsupported versions, invalid IDs, oversized payloads, and unrepresentable dates are handled.
- Direct private chats with no intermediary forwarding. Messages commit before send; recipients commit before ACK. Deduplication uses a SQLite unique message ID. Per-recipient pending state, attempts, ACK status, and history survive restart.
- Decentralized groups: creation, direct fanout, member edits, naming, leave, revisioned snapshot exchange, deterministic conflict resolution, and retained removal state for offline members.
- Missing-message recovery using persistent per-source/database sequence cursors, correlated paged requests, visibility filtering, automatic periodic sync, and cross-peer message-ID deduplication. Group scope changes reset cursors and invalidate older outstanding responses.
- Offline composition, graceful pause/reconnect, crash detection, new TCP port after restart, and stable identity/history.
- Basic temporary rooms: one-hour/eight-hour send deadlines, or inactive once everyone leaves. History is retained.
- Functional UI: nearby users with connection status, private conversations, groups, group editor/member picker, message status and recipient counts, profile editor, network pause/reconnect, multiline composer, and inactive-room history.
- Structured JSON logs for discovery, sockets, messages, duplicate rejection, ACK, group revisions, retries, and sync.
- README with exact commands, architecture, protocol, practical limitations, and Windows verification steps.

## Verification results on this machine

Host: **macOS, Apple Silicon (arm64)**. CLI Node **25.2.1**. Desktop Electron **45.0.0**, embedded Node **24.22.0**, Chromium **156.0.8078.48**, SQLite **3.53.4**.

| Check | Result |
| --- | --- |
| Dependency installation | Passed (`npm install`); Electron runtime downloaded separately when the restricted network blocked its first download |
| Type checking | Passed (`npm run typecheck`; also required by build) |
| Production application build | Passed (`npm run build`), including esbuild main/preload and Vite renderer |
| Automated suite | **10 tests passed, zero failures**, including real UDP/TCP and three independent peer processes |
| Compiled Electron desktop smoke | **Passed**, three separate profiles/windows |
| Electron isolation/IPC checks | Passed: context isolation and sandbox enabled, Node integration disabled, no renderer `require`/`process`, malformed IPC rejected |
| Visual inspection | Passed; screenshot at `docs/desktop-smoke.png` |
| Vite development desktop smoke | **Passed**, same three-window flow against a real local Vite server |
| Lint | No separate linter configured; strict TypeScript checking is configured |
| Windows runtime | **Not tested**; requires a physical Windows machine |
| Cross-device Wi-Fi / real IP change / sleep-wake | **Not tested**; local profiles use real sockets on one computer |

The protocol tests exercise every possible split boundary for a multi-frame Unicode stream, byte-by-byte input, coalesced frames, invalid lengths/JSON/versions/types, UUID validation, timestamp bounds, and deterministic group comparisons. Store tests check transactional rollback, deduplication, delivery transitions, sender-specific ACKs, persisted pending messages and cursors, incarnation reset, group convergence in different arrival orders, member rows, and byte-bounded pages with 64 recipients and large Unicode messages. Engine tests cover expired/left rooms, retained history, offline pending state, invalid outbound input, and profile rename while paused.

### Three-process networking scenario (passed)

1. Start Alice, Bob, and Charlie as separate Node processes with separate SQLite files.
2. Discover each other automatically by UDP; establish exactly the canonical TCP links.
3. Alice sends a PM to Bob and receives a persisted ACK. Charlie receives no private history.
4. Alice creates Flight Friends with all three members; Charlie sends a group message and receives ACKs from both peers.
5. Charlie stops networking; peers observe GOODBYE.
6. Alice sends **37** group messages; Bob also sends one. Bob stores the complete missing log and renames the room.
7. Alice stops networking. Charlie reconnects and recovers all **38** missed messages and new metadata **from Bob** over several pages, without the original sender being online.
8. Alice reconnects and retries its pending messages. Charlie ACKs duplicates without extra chat entries. Charlie has exactly **39** group messages (one initial + 38 missed).
9. Kill Charlie without GOODBYE; heartbeat timeout marks it offline. Bob queues a PM. Restart Charlie from its old SQLite file; it retains the same UUID and history, uses a new TCP port, reconnects, and acknowledges the queued PM.
10. Charlie leaves the room; peers replicate the leave and Charlie receives no subsequent group chat. Rapid stop/start commands remain serialized and usable.

A separate real-TCP test verifies repeated simultaneous connect requests yield one link, broken-link reconnection, oversized invalid frames close only their socket, byte-fragmented HELLO, multiple ACK frames in a packet, and rejection of a changed sender ID on an established connection.

### Three-window compiled Electron scenario (passed)

The test drives the actual UI to enter three names, discover peers, send a PM and confirm ACK, create a group, send messages from Alice and Bob, pause Charlie, send while Charlie is absent, rename the group, reconnect Charlie, and recover the message/state. It closes and reopens Bob's Electron profile, verifies stable identity/history and no duplicate rows, rejects malformed IPC, and checks the sandbox settings. Chromium is placed offline after loading the local UI while UDP/TCP continues in the main process. Its isolated temporary databases are removed afterwards.

## Architecture decisions

1. **One equal peer engine per instance.** No application server, cloud dependency, signaling service, or dedicated group authority.
2. **Built-in Node SQLite.** Real SQLite with WAL and transaction boundaries, without a native npm addon or rebuild workflow. A persistent database incarnation UUID scopes sync cursors.
3. **UUID identity.** IP addresses and ports are replaceable discovery information. Profiles each own a separate identity/database and Electron single-instance lock.
4. **Multicast plus broadcast.** Join each external IPv4 interface and loopback; refresh on each heartbeat. Multicast TTL is one. Platform networking differences remain isolated in discovery/transport.
5. **Smaller UUID dials.** Both sides enforce this rule at handshake; only one connection per peer is retained.
6. **Framed, validated JSON.** Four-byte byte length, strict Zod schemas, 256 KiB frames, 2 KiB discovery packets, 8,000-unit message text, and bounded control state. Socket error handling is local to the connection.
7. **Persist before ACK.** No read receipts. "Delivered" indicates the receiving application saved the message. "Retrying" follows five missed ACK attempts and continues automatically, with delay capped at 30 seconds.
8. **Whole-snapshot group conflicts.** Greatest `(revision, updatedBy, eventId)` wins with locale-independent ordering. This is easy to inspect/test but does not merge concurrent edits.
9. **Historical audience/tombstones.** Offline former members can learn removals. Current members govern history sharing; the immutable per-message audience prevents exposing pre-invitation history to a new member. Outbound delivery to removed members is canceled.
10. **Source-local append-only cursors.** Do not rely on timestamps for completeness. Sync pages include only shareable records, but advance through the source's entire log. Changes in group scope reset cursors and outstanding requests. Another current member can supply original messages; UUID deduplication handles overlap.
11. **Cross-platform tooling.** Node scripts use portable APIs. App data comes from Electron, TCP ports from the OS, test folders from `os.tmpdir()`. No Unix shell commands are required to run the app.
12. **Simple UI/state loading.** Full local state is sent through a narrow typed preload API. Appropriate for class-project/small-LAN use; large histories need pagination later.

## Partially implemented features / limitations

- Temporary-room expiry disables new sends and marks the room inactive. It does not delete local history, erase remote copies, or synchronize clocks. Empty rooms remain as history/tombstones.
- Group updates converge deterministically, but simultaneous whole-snapshot edits may overwrite another member's edit or leave. Revision ancestry and signatures are not verified.
- Retry state is durable and automatic; there is no manual retry/cancel UI. The internal `failed` state means no ACK after five transmissions, not permanent discard.
- Discovery tries all enumerated IPv4 interfaces. There is no user-facing NIC selector; multiple adapters/VPNs and Wi-Fi roaming need physical tests. UDP silence can mark a peer offline even if an old TCP link exists.
- Headless tests and desktop tests use real networking but are on one Mac. No Windows or physical two-machine success is claimed.
- No comprehensive flood control or disk quota. Known peers/open sockets/frame sizes/output buffers are bounded, but a malicious LAN participant can still exhaust resources.
- UI snapshots load history in memory and query per-message delivery state. Group metadata changes rescan source logs; this favors clarity over large-dataset performance.

## Unimplemented / out of scope

- Authentication, encryption at rest, E2EE, QR verification, signed groups/messages, and secure deletion.
- File transfer, mobile clients, read receipts, global search, retention/archival, and large-history UI pagination.
- Manual group deletion (leave/expiry retains history), owner/admin roles, and advanced conflict merging.
- IPv6, WAN messaging, Internet relays, multi-hop routing, voice/video, screen sharing, accounts, or central services.
- Installers, signing/notarization, auto-updates, Git workflows, GitHub, and CI/CD were not added.

## Known bugs / remaining risks

No failing build or automated test is currently known. The documented conflict, clock, trust, routing, and scaling limitations above remain material. Traffic and the local database are unencrypted; identity claims and relayed group authorship are not authenticated. This implementation is intended for trusted local experiments.

Bugs found and fixed during this session included an oversized Unicode sync page, stale in-flight sync cursors overwriting group resets, overlapping network start/stop, offline peers incorrectly showing RECONNECTING during teardown, the group picker including "you" while creation rejected the local ID, rename unexpectedly unpausing a profile, and dates outside JavaScript Date's valid range.

## How to run

```sh
npm install
npm run dev -- --profile peer-a
```

In two other terminals use `peer-b` and `peer-c`. For compiled local mode use `npm run build` then `npm start -- --profile peer-a` (and distinct profiles in other terminals). There is no installer step. Main/preload edits need a dev restart; renderer edits use Vite HMR.

## How to verify

```sh
npm run typecheck
npm test
npm run build
npm run test:desktop
npm run test:desktop -- --dev
```

Tests need permission to bind local UDP/TCP and launch Electron. `test:desktop -- --dev` repeats the desktop scenario using a real local Vite server and the already compiled main/preload. Normal `test:desktop` runs compiled local UI assets. No Playwright browser download is needed; it controls the installed Electron executable.

Manual checks: exchange PMs in both directions; create/edit/leave a three-person group; pause a member, send messages, reconnect; close/reopen a profile; verify the same identity/history; kill a peer and wait for timeout; check queued delivery after restart.

## Windows items requiring a real device

Use the detailed checklist in the README. At minimum verify Windows ↔ macOS discovery, dynamic TCP connectivity, PM/ACK, three-member group fanout/state, Wi-Fi disconnect/reconnect without app restart, missing-message recovery when the origin is offline, UUID stability across IP changes, process crash timeout, sleep/wake, Unicode layout, and graceful shutdown. Confirm Windows Defender Firewall permits the development Electron executable on the private network (UDP 45878 plus dynamic inbound TCP). Also test Windows local multicast loopback and separate profile locking.

## Recommended next steps

1. Run the Windows/macOS physical-LAN checklist with WAN disconnected, then test a third physical device.
2. Test Wi-Fi changes, sleep/wake, VPNs/multiple interfaces, and restrictive firewalls; improve route selection based on observed failures.
3. Add history pagination/retention and clearer canceled-recipient state if needed for longer-running use.
4. Design authenticated identity and E2EE with established protocols/libraries before considering sensitive use.
5. Add file transfer only after interoperability and recovery remain stable.
