# LANChat Physical Cross-Platform Validation — macOS

## Status

All eight core tests M1–M8 passed under their specified Mac-observable criteria, including recovery of all ten messages from physical Windows Bob to Mac Charlie while original sender Alice was offline. M4 initially fell back to TCP and needed a normal reconnect; M7 reconnected with TCP fallback after a logged LRDT negotiation timeout. Both observations are retained below. Stopped at MAC CHECKPOINT M8. Windows-side UI/disk observations remain separately verifiable by the Windows operator; they are not inferred from this Mac record.

Instructions: `/Users/aaron/Desktop/lanchat_physical_test_macos.md`.

## Environment

- Inspection timestamp: 2026-10-29T04:04:39Z (2026-10-29 12:04:39 +08:00, Asia/Singapore).
- macOS: 15.7.1, build 24G231; Darwin 24.6.0.
- Hardware: Mac14,9, Apple M2 Pro; 17,179,869,184 bytes of memory (16 GiB).
- Architecture: arm64.
- Node: v25.2.1.
- npm: 11.6.2.
- Git commit: `c4b74142b0c366dc8c245ba2979bc821958bf7ee`.
- Branch: `master` (status shows tracking `origin/master`).
- Worktree at initial inspection: dirty due to untracked `report.zip`; no tracked changes reported by `git status --short --branch`.
- This session adds this evidence file. Production source, tests, package configuration, and existing evidence have not been edited.
- Active default-route interface: `en0`.
- Local IPv4: `192.168.31.83/24`, netmask `255.255.255.0`.
- Default gateway: `192.168.31.1`; default-route MTU: 1500.
- Remote OS/physical endpoint: user confirmed the requested Windows endpoint before M1; OS/hardware not independently inspected from Mac.
- Remote source revision: user replied `Confirm` to the M0 request for matching relevant revision and same LAN; not independently inspected from Mac.
- LAN reachability: Mac automatically discovered and connected to `Windows-Aaron` at `192.168.31.172` during M1.
- Mac profile/display name: `Mac-Aaron`, launched for M1 with persistent data under `.local-data/Mac-Aaron/`.
- Mac UUID: `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
- Local priority during M1: `auto`; selected transport at final observation: `lrdt`.

## Results

Core validation is complete through M8. PASS applies to each specified local criterion; initial LRDT failures and other qualifications are retained in the detailed observations. No optional induced-fallback experiment was performed.

| Test ID | Purpose | Local evidence | Result |
|---|---|---|---|
| DISC-01 | Automatic discovery of physical Windows peer | `Windows-Aaron` appeared without entering an address; final snapshot at 2026-10-29T04:12:55.403Z shows online, CONNECTED, LRDT | PASS (Mac-side discovery only) |
| SAFE-M2W-001 | Safe/TCP Mac → Windows | Mac priority `safe`; peer CONNECTED via `tcp`; exact payload shown with `✓ Delivered`; snapshot reports `state: delivered`, 1/1 recipient ACK | PASS |
| SAFE-W2M-001 | Safe/TCP Windows → Mac | Exact expected payload from Windows UUID visible once in Mac history and snapshot; local `safe` priority and connected `tcp` path at 2026-10-29T04:24:25.163Z | PASS |
| AUTO-M2W-001 | Auto/LRDT Mac → Windows | Initial TCP fallback; after one normal Mac reconnect, explicit LRDT selection, LRDT application ACK, and `delivered` 1/1 | PASS after reconnect; initial establishment failure recorded |
| AUTO-W2M-001 | Auto/LRDT Windows → Mac | Explicit `lrdt.received.PRIVATE_MESSAGE` and matching receive log; exact payload visible once in history; connected LRDT path | PASS |
| GROUP-01 | Group messaging | Both expected members in group `d058608b-566d-4cdc-abce-e24fe8de3674`; `GROUP-M2W-001` delivered 1/1; `GROUP-W2M-001` received via LRDT and visible once in the same room | PASS |
| RESTART-01 | Restart and persistent identity | Mac logged disconnect/offline/rediscovery/reconnection; identical Windows UUID before/after, endpoint changed from `192.168.31.172:59391` to `192.168.31.172:63054` | PASS (identity); LRDT renegotiation timed out and fell back to TCP |
| RECOVERY-01 | Recovery from secondary peer | Mac Charlie recovered exactly 10/10 expected Alice messages from Windows Bob via LRDT SYNC_RESPONSE; Alice network was paused throughout; 10 distinct IDs, zero visible duplicates | PASS |

## Detailed Observations

### Preparation and M0

Read-only Git inspection used `git status --short --branch`, `git rev-parse HEAD`, and `git branch --show-current`. No Git mutation was performed.

Environment inspection used `uname`, `sw_vers`, Node/npm version commands, Node's `os` module, and `sysctl`. Initial restricted network/hardware reads could not obtain the requested information. A permitted read-only retry returned the interface, default route, hardware model, and memory listed above. Router, firewall, and security settings were not changed.

Inspected the existing launch workflow in `package.json`, `README.md`, `scripts/dev.mjs`, and `src/desktop/main.ts`. Installed dependencies and a `dist/` directory exist; freshness of the compiled output has not been verified. No build, automated test, benchmark, or application launch was performed during preparation. Functional tests must not begin before the user confirms the matching relevant Windows source revision.

No connected physical Windows endpoint is available through the tools exposed to this session. No LAN device scan was performed. Windows availability must be confirmed by the user or Windows endpoint operator; local environment inspection does not establish remote availability.

```text
MAC CHECKPOINT M0
commit: c4b74142b0c366dc8c245ba2979bc821958bf7ee
branch: master
worktree: dirty (pre-existing untracked report.zip; this session adds the evidence file)
ready: YES
```

Here `ready: YES` means Mac preparation is complete and ready for the user's next instruction. It does not assert that Windows is available, that revisions match, or that any functional test passed.

The user subsequently replied `Confirm`, satisfying the requested M0 synchronization before proceeding to M1.

### M1 — DISC-01: Automatic Windows discovery

- Start: 2026-10-29T04:11:57.800Z (12:11:57.800 +08:00), first observed application window.
- Local mode: `auto`, unchanged default; normal discovery port and timing, no manually entered remote endpoint.
- Launch: installed Electron executable with the existing compiled application entry point (`.`) and arguments `--profile Mac-Aaron`, matching the repository's compiled launch workflow. Desktop automation controlled the application without changing source. `LANCHAT_DATA_ROOT` points to the repository's `.local-data/`; discovery-port/dev-server overrides were removed from the launch environment. No LRDT disable or impairment flags were supplied.
- At 2026-10-29T04:12:07.455Z, first-launch setup had been completed using display name `Mac-Aaron`; snapshot reported `network: true`, `priority: auto`, and initially zero peers.
- The Mac sidebar subsequently showed `Windows-Aaron` and `Connecting…` through automatic discovery.
- At 2026-10-29T04:12:34.612Z, the app snapshot retained Windows UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, IP `192.168.31.172`, TCP port `53695`, but reported `offline` / `DISCONNECTED`. The cause of this transient absence was NOT VERIFIED; no Windows-side restart or failure is inferred.
- At 2026-10-29T04:12:55.403Z, the same UUID was `online` / `CONNECTED`, IP `192.168.31.172`, TCP port `63178`, selected `transport: lrdt`, `fallback: false`, zero establishment failures and zero TCP fallbacks. The sidebar also explicitly displayed `Windows-Aaron Connected via LRDT`.
- Transport counters in that final snapshot: packets sent/received 4/4, ACKs sent/received 2/2, completed frames 2, retransmissions 0. These are connection-time observations; no test chat message was sent and no messaging PASS is claimed.
- Captured application stderr after launch was empty at the observation times.
- Result: PASS for Mac-side automatic discovery. Discovery of Mac on Windows remains separately confirmable only by the Windows operator.
- Revision recheck after launch still returned `c4b74142b0c366dc8c245ba2979bc821958bf7ee`; no tracked modifications were reported. Status showed `master...origin/master [behind 1]` and this untracked evidence file; the previously untracked `report.zip` was no longer listed. This session did not fetch, pull, remove that archive, or change Git state.
- No Safe/TCP test, test-message send, group operation, or restart/recovery procedure was performed. The Mac application remains open for the next checkpoint.

```text
MAC CHECKPOINT M1
test: DISC-01
windows_peer_visible: PASS
windows_peer_name: Windows-Aaron
windows_peer_uuid: b409098b-ab65-4578-a0bd-4d1238173f16
ready_for_next: YES
```

The next test is M2, Safe/TCP Mac → Windows. Section 8 requires user confirmation that both endpoints are in Safe mode; section 6 requires user direction before advancing. Current Mac mode remains Auto at M1. Await instruction to advance and coordinate the Safe-mode transition before sending `SAFE-M2W-001 physical Mac to Windows`.

### M2 — SAFE-M2W-001: Safe/TCP Mac → Windows

- Preconditions: user stated `Both set to safe mode`, authorizing continuation from M1 and confirming the remote mode. The Mac mode and path were independently checked locally.
- Start / pre-send observation: 2026-10-29T04:18:54.557Z (12:18:54.557 +08:00).
- Local identity: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
- Local priority: `safe`; network running.
- Remote peer: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, IP `192.168.31.172`, TCP port `58869`.
- Locally observed path: peer `online`, connection `CONNECTED`, `transport: tcp`, `fallback: false`. The sidebar displayed `Connected via TCP` before and after sending.
- Action: opened the Windows private conversation, entered exactly `SAFE-M2W-001 physical Mac to Windows`, and clicked Send once through the normal UI.
- Persisted message timestamp: 2026-10-29T04:19:13.128Z (12:19:13.128 +08:00), from message timestamp `1793247553128`. This is the application's timestamp; no separate packet-send timing was measured.
- Message UUID: `dafc27b2-9f3e-4153-9dcc-0a41d6f237c7`.
- UI evidence: the exact payload appeared once in the Mac conversation with `✓ Delivered`.
- Post-send snapshot timestamp: 2026-10-29T04:19:21.204Z. The single message had `kind: private`, the expected Windows target and audience, `state: delivered`, `delivered: 1`, and `recipients: 1`. The peer remained connected over TCP. This establishes the normal local application-ACK delivery state; Windows UI rendering was not independently observed from Mac.
- Captured stderr contained one macOS input-method diagnostic at 2026-10-29T04:18:38.035Z: `error messaging the mach port for IMKCFRunLoopWakeUpReliable`. No network or delivery error was present in the captured stderr; the diagnostic did not prevent the observed send and delivery.
- Result: PASS under the specified Mac-side criterion (Safe/TCP observed and normal delivered state).
- No Windows → Mac test was performed or claimed during M2. No implementation changes were made.

```text
MAC CHECKPOINT M2
test: SAFE-M2W-001
local_transport: TCP
local_delivery_state: delivered (1/1 recipient acknowledged)
result: PASS
```

Await user direction before M3. The expected Windows → Mac payload for M3 is `SAFE-W2M-001 physical Windows to Mac`, with both endpoints remaining in Safe mode.

### M3 — SAFE-W2M-001: Safe/TCP Windows → Mac

- User synchronization: user reported `the message has been sent by windows`, authorizing the receive check after M2.
- Test observation timestamp: 2026-10-29T04:24:25.163Z (12:24:25.163 +08:00), from the captured local application snapshot. The exact network arrival/receive timestamp was NOT OBSERVED; the message was already present when checked.
- Local identity: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`; priority `safe`, network running.
- Sender: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, IP `192.168.31.172`, TCP port `58869`.
- Locally observed path: sender `online`, connection `CONNECTED`, `transport: tcp`, `fallback: false`. The Mac sidebar displayed `Connected via TCP`.
- Exact received payload: `SAFE-W2M-001 physical Windows to Mac`.
- Message UUID: `24423c36-cba3-4801-b310-7946396c26db`.
- Message's sender-provided timestamp: `1793247823891` (2026-10-29T04:23:43.891Z / 12:23:43.891 +08:00). This is not a measured Mac receive time; no latency is inferred.
- Snapshot: one matching private message, expected Windows `senderId`, Mac `targetId` and audience. Only two messages were present in the complete local snapshot: the M2 outgoing payload and this M3 incoming payload. No duplicate of the M3 payload or message UUID appeared.
- History/UI: Windows private conversation visibly contained the exact incoming payload once (displayed at 12:23 PM), alongside the previously delivered M2 message.
- Incoming message snapshot state was `delivered`, with `delivered: 0` / `recipients: 0`; those zero counts are the Mac's absence of outgoing pending recipients for an incoming message, not a measurement of Windows-side ACK state. No Windows-side delivery assertion is made.
- Captured stderr showed only the previously recorded macOS input-method diagnostic, with no additional error in the snapshot's log capture.
- Result: PASS for receipt of the expected Windows message exactly once in the observed Mac history under Safe/TCP. No new message was sent from Mac during M3, and no implementation changes were made.

```text
MAC CHECKPOINT M3
test: SAFE-W2M-001
message_received: PASS
duplicate_visible: NO
local_transport: TCP
result: PASS
```

Await user direction before M4. Both endpoints must be confirmed in Auto mode and normally reconnected before sending `AUTO-M2W-001 physical Mac to Windows over LRDT`. M1's earlier LRDT connection observation does not by itself establish the M4 messaging result.

### M4 — AUTO-M2W-001: Auto/LRDT Mac → Windows

- Preconditions: user stated `Both set to auto mode`, authorizing continuation from M3 and confirming the remote mode. Local mode and selected data path were independently checked.
- Start / initial observation: 2026-10-29T04:28:40.981Z (12:28:40.981 +08:00).
- Local identity: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`, priority `auto` throughout M4.
- Remote peer: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, IP `192.168.31.172`.
- Initial failure evidence: sidebar showed `Connected via TCP (fallback)`; snapshot reported `connection: CONNECTED`, `transport: tcp`, `fallback: true`, `establishmentFailures: 1`, `tcpFallbacks: 1`, remote TCP port `59857`. Thus the initial Auto connection did not satisfy the LRDT condition. No test chat message was sent on that fallback connection. The precise establishment failure cause was NOT OBSERVED; no firewall or Windows-side diagnosis is inferred.
- Action before messaging: one normal Mac Pause connection → Reconnect cycle, through existing UI, without changing priority, source, timings, impairment, firewall, or router settings. This was a normal retry of LRDT establishment, not a simulated fallback experiment.
- At 2026-10-29T04:29:10.215Z, Mac network was running but the retained Windows peer was temporarily `offline` / `DISCONNECTED`; no chat message was sent while disconnected.
- At 2026-10-29T04:29:36.518Z, the same remote UUID/IP was `online` / `CONNECTED`, port `59391`, `transport: lrdt`, `fallback: false`. The sidebar explicitly displayed `Connected via LRDT`. Counters for the newly created local transport manager were zero establishment failures and zero TCP fallbacks; their reset does not erase the earlier failed attempt.
- LRDT was explicitly observed before sending. The exact payload `AUTO-M2W-001 physical Mac to Windows over LRDT` was entered and Send clicked once in the normal Windows private conversation.
- Message UUID: `1f3ed777-b7e5-4143-9b84-38d4b476bc08`.
- Persisted message timestamp: `1793248198897`, i.e. 2026-10-29T04:29:58.897Z (12:29:58.897 +08:00). No throughput or latency benchmark is inferred.
- Application stdout capture was attached at 2026-10-29T04:29:41.198Z; earlier stdout was not available for retrospective inspection. Existing stderr capture continued.
- Relevant normal application stdout events:

```json
{"time":"2026-10-29T04:29:58.899Z","event":"message.sent","details":{"messageId":"1f3ed777-b7e5-4143-9b84-38d4b476bc08","kind":"private","recipients":["b409098b-ab65-4578-a0bd-4d1238173f16"]}}
{"time":"2026-10-29T04:29:58.907Z","event":"lrdt.received.ACK","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:29:58.907Z","event":"message.ack","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16","messageId":"1f3ed777-b7e5-4143-9b84-38d4b476bc08"}}
```

- UI evidence: exact outgoing payload appeared with `✓ Delivered`, while the sidebar remained `Connected via LRDT`.
- Post-send snapshot at 2026-10-29T04:30:07.730Z: priority `auto`, peer `online` / `CONNECTED`, `transport: lrdt`, `fallback: false`; message `state: delivered`, `delivered: 1`, `recipients: 1`. There was exactly one local copy of the M4 message.
- At that snapshot LRDT session counters were 86 packets sent / 86 received, 45 ACKs sent / 41 received, 41 fragments sent / 45 received, 42 completed frames, 0 retransmissions and 3 duplicate packets. These counters include background protocol traffic and do not represent duplicate chat entries or a per-message benchmark.
- Result: PASS for the successful M4 send after normal reconnection, with both explicit LRDT selection and LRDT application-ACK evidence. Initial establishment failure remains a concrete observed limitation of the first attempt. Windows UI rendering was not independently inspected.
- No Windows → Mac Auto message test or production modification was performed during M4.

```text
MAC CHECKPOINT M4
test: AUTO-M2W-001
lrdt_selected_locally: YES
delivery_state: delivered (1/1 recipient acknowledged)
result: PASS
```

Await user direction before M5. Both endpoints should remain in Auto mode. The expected Windows → Mac payload is `AUTO-W2M-001 physical Windows to Mac over LRDT`.

### M5 — AUTO-W2M-001: Auto/LRDT Windows → Mac

- User synchronization: user reported `the message has been sent by windows`, authorizing the receive check after M4.
- Test observation timestamp: 2026-10-29T04:34:21.824Z (12:34:21.824 +08:00), from the local application snapshot captured for M5. The message had already arrived when checked; the earlier receive time below is established by the existing application log.
- Local identity: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`; priority `auto`, network running.
- Sender: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, IP `192.168.31.172`, TCP control port `59391`.
- Locally observed data path: `online` / `CONNECTED`, `transport: lrdt`, `fallback: false`. Sidebar explicitly displayed `Connected via LRDT`; application log explicitly identifies an LRDT private-message receive.
- Exact received payload: `AUTO-W2M-001 physical Windows to Mac over LRDT`.
- Message UUID: `a1c40fe7-0427-4914-a564-162c360f8fad`.
- Message's sender-provided timestamp: `1793248436339` (2026-10-29T04:33:56.339Z / 12:33:56.339 +08:00). Sender and receiver clocks are not assumed synchronized; no latency is inferred.
- Locally logged receive: 2026-10-29T04:33:56.259Z (12:33:56.259 +08:00), immediately following the LRDT receive event below.

```json
{"time":"2026-10-29T04:33:56.257Z","event":"lrdt.received.PRIVATE_MESSAGE","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:33:56.259Z","event":"message.received","details":{"messageId":"a1c40fe7-0427-4914-a564-162c360f8fad","source":"b409098b-ab65-4578-a0bd-4d1238173f16","relayed":false}}
{"time":"2026-10-29T04:34:00.004Z","event":"message.duplicate","details":{"messageId":"a1c40fe7-0427-4914-a564-162c360f8fad","source":"b409098b-ab65-4578-a0bd-4d1238173f16","relayed":true}}
```

- Duplicate handling: a later relayed copy was logged as `message.duplicate`. The local snapshot contained exactly one matching payload and one distinct matching UUID; the conversation displayed exactly one incoming entry. Thus duplicate traffic was observed and suppressed, with no visible duplicate message.
- History evidence: the exact incoming payload appeared in the Windows private conversation at 12:33 PM, alongside the three earlier test messages. The complete snapshot contained four messages total, one per test payload.
- Incoming snapshot `state: delivered`, `delivered: 0`, `recipients: 0` reflects no outgoing pending recipient rows on Mac for this received message; it does not assert Windows-side ACK state.
- Session counters at observation included 13 retransmissions, 26 duplicate packets, and 13 loss events; these are cumulative protocol-session counters including background traffic, not per-message measurements. No new establishment failure or TCP fallback was reported in this session, and no fallback/selection-change event was present in the captured stdout interval.
- Result: PASS for explicit LRDT reception and exactly one visible/persisted copy of the expected Windows message. No new Mac message, group operation, or implementation modification was performed during M5.

```text
MAC CHECKPOINT M5
test: AUTO-W2M-001
lrdt_selected_locally: YES
message_received: PASS
duplicate_visible: NO
result: PASS
```

Await user direction before M6 group messaging. Suggested group: `PHYSICAL-XPLAT-TEST`; payloads `GROUP-M2W-001` and `GROUP-W2M-001`. Group creation, membership checks, and bidirectional group-message results remain NOT VERIFIED.

### M6 — GROUP-01: Group messaging

- User synchronization: user stated `Please proceed` after M5, authorizing M6.
- Start / pre-group snapshot: 2026-10-29T04:43:42.684Z (12:43:42.684 +08:00). Local priority `auto`; Windows peer `online` / `CONNECTED`, `transport: lrdt`, `fallback: false`; no groups existed in that snapshot.
- Action: created `PHYSICAL-XPLAT-TEST` through the existing UI, included `Windows-Aaron`, and retained default lifetime `Until everyone leaves`.
- Mac-created test group UUID: `d058608b-566d-4cdc-abce-e24fe8de3674`.
- Creation log: 2026-10-29T04:44:00.200Z, `group.created`, matching that UUID.
- Membership: Mac UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3` and Windows UUID `b409098b-ab65-4578-a0bd-4d1238173f16`; revision 1, updater Mac UUID, event `11c22a6a-52de-410a-8c7d-a6688c9d1254`, no expiry. Sidebar displayed `2 members`; group header displayed `You, Windows-Aaron`.
- A second, distinct group with the same name subsequently appeared: UUID `a8c1ada8-41cd-4fd5-86df-069820872d8b`, revision 1, updater Windows UUID, event `53b52ea5-d81d-465a-b6c2-992bc307b86c`; both peers were members. Local `group.updated` log was at 2026-10-29T04:44:03.020Z. This records the received metadata, not an independently observed Windows UI action. Neither group was removed or renamed. The test uses the Mac-created UUID above; same-name rooms are not treated as one room.
- Membership snapshot at 2026-10-29T04:44:28.888Z confirmed both distinct group UUIDs and expected member sets.
- Send action: entered exactly `GROUP-M2W-001` in the selected Mac-created room and clicked Send once.
- Message UUID: `6be34a2e-afb5-4363-927c-d28c3ca2a88e`; `kind: group`, target `d058608b-566d-4cdc-abce-e24fe8de3674`, audience containing the Windows UUID.
- Persisted message timestamp: `1793249092253`, i.e. 2026-10-29T04:44:52.253Z (12:44:52.253 +08:00).
- Relevant existing application logs:

```json
{"time":"2026-10-29T04:44:52.254Z","event":"message.sent","details":{"messageId":"6be34a2e-afb5-4363-927c-d28c3ca2a88e","kind":"group","recipients":["b409098b-ab65-4578-a0bd-4d1238173f16"]}}
{"time":"2026-10-29T04:44:52.267Z","event":"message.ack","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16","messageId":"6be34a2e-afb5-4363-927c-d28c3ca2a88e"}}
```

- UI evidence: exact payload appeared once with `✓ Delivered 1/1` in the selected group. The sidebar remained `Connected via LRDT`.
- Post-send snapshot at 2026-10-29T04:45:07.346Z: priority `auto`, peer `online` / `CONNECTED`, `transport: lrdt`, `fallback: false`; one group message, `state: delivered`, `delivered: 1`, `recipients: 1`. No Windows group payload had been observed at that snapshot.
- Interim results: group visibility/membership PASS; Mac group send PASS; Windows group receive NOT OBSERVED; no visible duplicate group message. Overall GROUP-01 remains NOT VERIFIED pending its Windows → Mac half.
- Required remote action: send exactly `GROUP-W2M-001` in the room containing `GROUP-M2W-001` (UUID `d058608b-566d-4cdc-abce-e24fe8de3674`). Do not use the second same-name room for this test.
- No M7/M8 action or production modification was performed.

#### Windows reply and completed M6 result

- A further snapshot at 2026-10-29T04:45:48.545Z showed `GROUP-W2M-001` from Windows in the same Mac-created test group, UUID `d058608b-566d-4cdc-abce-e24fe8de3674`. Windows remained `online` / `CONNECTED` with `transport: lrdt`, `fallback: false`.
- Received message UUID: `68764b90-f425-4505-855e-3b1bd6dcb71e`; `kind: group`; sender Windows UUID, audience Mac UUID; sender-provided timestamp `1793249124490` (2026-10-29T04:45:24.490Z / 12:45:24.490 +08:00). No latency is inferred from unsynchronized clocks.
- Local application receipt timestamp: 2026-10-29T04:45:24.457Z (12:45:24.457 +08:00).

```json
{"time":"2026-10-29T04:45:24.454Z","event":"lrdt.received.GROUP_MESSAGE","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:45:24.457Z","event":"message.received","details":{"messageId":"68764b90-f425-4505-855e-3b1bd6dcb71e","source":"b409098b-ab65-4578-a0bd-4d1238173f16","relayed":false}}
{"time":"2026-10-29T04:45:27.431Z","event":"message.duplicate","details":{"messageId":"68764b90-f425-4505-855e-3b1bd6dcb71e","source":"b409098b-ab65-4578-a0bd-4d1238173f16","relayed":true}}
```

- UI verification showed `Windows-Aaron GROUP-W2M-001` once, displayed at 12:45 PM, below the Mac's delivered group message. Snapshot count for the exact incoming payload in the test group was 1; both group payloads appeared exactly once. The later relayed copy in the log was suppressed and did not create a visible duplicate.
- Incoming snapshot `delivered: 0`, `recipients: 0` again reflects no outgoing Mac recipient queue for this received message, not Windows-side ACK state.
- Completed M6 result: PASS — correct local membership, Mac send delivered 1/1, Windows reply received in the same room, no visible duplicates. Separate same-name group remains preserved and is not conflated with the test group.

```text
MAC CHECKPOINT M6
test: GROUP-01
group_visible: PASS
mac_group_send_state: delivered (1/1 recipient acknowledged)
windows_group_message_received: PASS
duplicate_visible: NO
result: PASS
```

Await user instruction before M7 restart/persistent-identity validation. Windows UUID last verified here: `b409098b-ab65-4578-a0bd-4d1238173f16`, display name `Windows-Aaron`, endpoint `192.168.31.172:59391`. These observations are available as context; no controlled M7 before/after restart test has yet been performed.

### M7 — RESTART-01: Windows restart and persistent identity

- User synchronization: after the M6 checkpoint and proposed Windows restart test, user stated `The windows is doing the operations`. This was treated as direction to observe M7. The Mac did not operate or independently inspect the Windows process; the local criterion is whether the returning peer retains its identity.
- Pre-restart baseline: M6 snapshot at 2026-10-29T04:45:48.545Z recorded `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, endpoint `192.168.31.172:59391`, online / CONNECTED, selected LRDT.
- Test observation snapshot retrieved at 2026-10-29T04:48:36.364Z (12:48:36.364 +08:00). Existing continuous local stdout capture retained the transition that occurred before this snapshot. The exact Windows operator action timestamp is NOT OBSERVED; the first local disconnect event is below.
- Relevant local application events:

```json
{"time":"2026-10-29T04:48:11.523Z","event":"tcp.closed","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:48:12.134Z","event":"tcp.connecting","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:48:18.142Z","event":"peer.offline","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:48:27.622Z","event":"peer.discovered","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16","ip":"192.168.31.172"}}
{"time":"2026-10-29T04:48:27.623Z","event":"tcp.connecting","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:48:27.647Z","event":"tcp.connected","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16"}}
{"time":"2026-10-29T04:48:29.150Z","event":"transport.fallback","details":{"peer":"b409098b-ab65-4578-a0bd-4d1238173f16","reason":"negotiation timeout"}}
```

- Post-return identity: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`; unchanged from baseline.
- Post-return endpoint: `192.168.31.172:63054`; IP unchanged, TCP port changed from `59391` to `63054`.
- Post-return status: online / CONNECTED, `transport: tcp`, `fallback: true`; `establishmentFailures: 1`, `tcpFallbacks: 1`. Mac priority remained `auto`, Mac network remained running. Sidebar explicitly showed `Windows-Aaron Connected via TCP (fallback)`.
- Identity result: PASS. Mac recognized the returned endpoint as the same logical peer after the observed disconnect/offline/rediscovery cycle associated with the user-directed Windows restart operations. A changed endpoint does not imply a changed identity.
- Transport caveat: LRDT renegotiation on return did not succeed in this attempt; the log explicitly reports `negotiation timeout` and TCP fallback. No claim of successful post-restart LRDT is made. Cause beyond that logged timeout is NOT VERIFIED. No Mac reconnect or implementation change was made to conceal or repair it during M7.
- Mac retained its existing two rooms and six test messages; group history remained visible. Windows disk contents, UUID persistence implementation, and Windows-side history were not independently inspected.

```text
MAC CHECKPOINT M7
test: RESTART-01
uuid_before: b409098b-ab65-4578-a0bd-4d1238173f16
uuid_after: b409098b-ab65-4578-a0bd-4d1238173f16
same_identity: YES
endpoint_changed: YES
result: PASS
```

Await user direction before M8. Section 14 of the supplied instructions assigns exact Alice/Bob/Charlie placement to the user. Suggested placement for confirmation: Alice = existing `Mac-Aaron`, Bob = existing `Windows-Aaron`, Charlie = a new persistent Mac profile. No recovery scenario has started; all 10-message recovery results remain NOT VERIFIED.

### M8 — RECOVERY-01: Secondary-peer history recovery

- User confirmed placement: Alice = existing `Mac-Aaron` on Mac, Bob = existing `Windows-Aaron` on the physical Windows endpoint, Charlie = new `Mac-Charlie` profile on Mac.
- Start / initial observation: 2026-10-29T04:55:35.033Z (12:55:35.033 +08:00). Alice remained in Auto with a TCP-fallback connection to Bob from M7. No forced transport change or simulated impairment was introduced.
- Charlie launched using the same installed Electron/compiled application entry point with `--profile Mac-Charlie` and persistent `.local-data/Mac-Charlie/`. Initial snapshot at 2026-10-29T04:56:01.525Z showed UUID `209a9c94-3413-49ca-b515-f2256e1c7221`, no messages, no groups, and network initially off before first-name setup. The existing profile/name API initialized display name `Mac-Charlie` and normal discovery.
- Existing application control APIs (`rename`, `createGroup`, `network`, `send`, `snapshot`) were used to operate the separately identified Mac profiles. These are the same validated IPC operations exposed by the normal UI. No production instrumentation, source, tests, configuration, or timing constants were changed. Native UI was also inspected to verify offline state and recovered visible history.
- Dedicated group: `PHYSICAL-RECOVERY-TEST`, UUID `e8049fd0-60dc-4dbc-bc92-7b69c00ec535`, created by Alice at 2026-10-29T04:56:53.831Z (creation response observation).
- All three member UUIDs: Alice `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`, Bob `b409098b-ab65-4578-a0bd-4d1238173f16`, Charlie `209a9c94-3413-49ca-b515-f2256e1c7221`. Revision 1, updater Alice, event `e58bc211-16c6-47c5-9a60-58ad306d6d46`, no expiry.
- Initial convergence: at 2026-10-29T04:57:19.951Z, Alice and Charlie snapshots had identical group state/member lists; Charlie was connected to both peers and still had zero messages. In response to the explicit Windows-side membership question, the user confirmed `Yes, all three members are visible`. This is the remote membership confirmation; no Windows UI was independently inspected.
- Charlie offline: normal network pause requested at 2026-10-29T04:57:42.260Z; snapshot at 04:57:42.269Z confirmed `network: false` and empty history, with group membership preserved.
- Alice then sent exactly `RECOVERY-001` through `RECOVERY-010`, once each. Persisted message timestamps span 2026-10-29T04:57:42.270Z–04:57:42.291Z. Each message's original audience included both Bob and Charlie.
- Bob retention evidence observable locally: Alice recorded a distinct application ACK from Bob for every one of the ten message IDs at 04:57:42.279Z–04:57:42.302Z. Snapshot at 04:57:58.446Z showed all ten at 1/2 acknowledged recipients, Bob online/connected via TCP fallback, and Charlie still offline with zero messages. Bob's UI/disk was not directly inspected; subsequent successful relaying from Bob provides additional local evidence that Bob retained those exact messages.
- Alice offline before recovery: pause requested at 2026-10-29T04:58:22.828Z; at 04:58:22.837Z, Alice `network: false`, Charlie `network: false`, Charlie messages still empty. Pausing stops the application's networking; it does not require shutting off Wi-Fi or the computer.
- Charlie returned at 2026-10-29T04:58:22.837Z (request); normal network start response at 04:58:22.839Z. Alice remained paused throughout recovery.
- Recovery path: Charlie discovered Bob at `192.168.31.172`, selected LRDT at 04:58:23.067Z, and logged `lrdt.received.SYNC_RESPONSE` from Bob at 04:58:23.077Z. At 04:58:23.079Z–04:58:23.083Z, ten `message.received` events identified Bob as `source`, with `relayed: true`, matching all ten original Alice message IDs. `sync.completed` from Bob at 04:58:23.083Z reported count 10. These exact events are captured below.
- First result snapshot at 2026-10-29T04:58:28.849Z: Alice network still false; Charlie network true, Bob online/CONNECTED over LRDT without fallback, Alice offline/DISCONNECTED; 10 recovered rows, 10 unique IDs, no missing content/ID pairs.
- Post-recovery recheck at 04:58:39.854Z still showed Alice network false and 10 recovered messages. Subsequent synchronization rounds returned zero new rows; the final saved capture contains one occurrence of every expected payload/ID and no duplicate chat entries.
- Native UI evidence: Alice window displayed `Network paused` before closing it after recovery. Closing that already-offline sender window exposed Charlie's conversation, where `RECOVERY-001` through `RECOVERY-010` each appeared once attributed to Mac-Aaron; Bob showed `Connected via LRDT` and Mac-Aaron showed `Offline`. Alice was not reconnected during this validation. Charlie remains open with recovered history.
- Result: PASS. This is physical cross-device secondary-peer recovery because the retained source Bob is on Windows and the receiving Charlie is on Mac; Alice and Charlie share the Mac but had separate persistent profiles/databases, and Alice's networking was stopped before Charlie returned.
- No benchmark, Windows disk inspection, induced fallback test, or implementation modification is claimed.

```text
MAC CHECKPOINT M8
test: RECOVERY-01
mac_role: Alice and Charlie
messages_expected: 10
messages_locally_verified: 10
duplicates_locally_observed: 0
original_sender_offline_during_recovery: YES
result: PASS
```

## Final Summary

- Tested repository HEAD: `c4b74142b0c366dc8c245ba2979bc821958bf7ee`, branch `master`; final read-only status still reports no tracked changes and only this untracked evidence file. `master` is shown one commit behind `origin/master`; this session performed no fetch/pull or other Git mutation. Windows relevant revision was user-confirmed at M0, not remotely inspected.
- Mac: macOS 15.7.1 build 24G231, Apple M2 Pro / Mac14,9, arm64, Node v25.2.1, npm 11.6.2, local IPv4 `192.168.31.83/24` through `en0`.
- Core results: 8/8 test rows PASS under the specified Mac-side criteria. DISC-01, SAFE-M2W-001, SAFE-W2M-001, AUTO-M2W-001, AUTO-W2M-001, GROUP-01, RESTART-01, and RECOVERY-01 have individual evidence above. Passing these functional checks is not a throughput, reliability-rate, or general deployment guarantee.
- Physical Windows discovery: observed automatically as `Windows-Aaron` at `192.168.31.172`; Windows hardware/OS and matching source were user-confirmed, not independently inspected on Mac.
- Safe/TCP: selected TCP and bidirectional exact private payloads verified locally.
- Auto/LRDT: explicit selected LRDT plus LRDT application-ACK/receive logs verified for private messaging; selected LRDT and LRDT receive logs also verified for group messaging and Charlie's recovery from Bob.
- Group messaging: correct two-member test room and exact bidirectional payloads verified. Two distinct rooms with the same name appeared; the Mac-created UUID was used consistently, and neither room was removed or silently merged.
- Persistent identity: same Windows UUID before and after observed offline/rediscovery/reconnection during the user-directed Windows restart; TCP endpoint port changed. Windows-side process lifecycle and storage were not independently inspected.
- Peer-assisted recovery: ten original Alice messages recovered exactly once by Mac Charlie from physical Windows Bob while Alice networking was off. All ten IDs, payload counts, Bob ACKs, and relay-source events are included below.
- Concrete failures/ambiguities: initial Auto attempt in M4 fell back to TCP; one ordinary Mac reconnect then established LRDT. M7 post-restart LRDT negotiation timed out and fell back to TCP. The causes were not diagnosed or patched. Protocol duplicate/retry traffic was observed, with no duplicate visible chat entries in the tested histories. Initial discovery also included a transient peer absence, as recorded in M1.
- Windows UI rendering, remote disk state, and remote-only observations remain NOT VERIFIED except where a user confirmation is explicitly recorded. Optional induced fallback testing was not requested or performed. Broader Wi-Fi roaming, sleep/wake, IP changes, and performance testing were outside this protocol.
- Production implementation, tests, package configuration, previous benchmarks, and existing evidence were not modified. New persistent Mac profiles/data are under ignored `.local-data/`; this new Markdown file is the validation evidence. Alice was left offline/closed; Charlie remains open. No requested core validation work remains beyond separate Windows-side reporting and any further user-directed tests.

### M8 — captured local evidence

The following capture records Charlie’s persisted snapshot, all ten matching message identities, Bob application ACKs observed on Alice, and Charlie recovery log events. It does not independently inspect Windows UI or disk.

```json
{
  "observedAt": "2026-10-29T05:00:02.891Z",
  "groupId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
  "aliceState": "network paused before/during recovery; sender window subsequently closed",
  "charlieIdentity": {
    "peerId": "209a9c94-3413-49ca-b515-f2256e1c7221",
    "displayName": "Mac-Charlie"
  },
  "charlieNetwork": true,
  "charliePriority": "auto",
  "group": {
    "groupId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
    "name": "PHYSICAL-RECOVERY-TEST",
    "members": [
      "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "b409098b-ab65-4578-a0bd-4d1238173f16",
      "209a9c94-3413-49ca-b515-f2256e1c7221"
    ],
    "audience": [
      "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "b409098b-ab65-4578-a0bd-4d1238173f16",
      "209a9c94-3413-49ca-b515-f2256e1c7221"
    ],
    "revision": 1,
    "updatedBy": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
    "eventId": "e58bc211-16c6-47c5-9a60-58ad306d6d46",
    "expiresAt": null
  },
  "peers": [
    {
      "peerId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "displayName": "Mac-Aaron",
      "ip": "127.0.0.1",
      "port": 55605,
      "lastSeen": 1793249860704,
      "status": "offline",
      "connection": "DISCONNECTED",
      "fallback": false,
      "establishmentFailures": 0,
      "tcpFallbacks": 0
    },
    {
      "peerId": "b409098b-ab65-4578-a0bd-4d1238173f16",
      "displayName": "Windows-Aaron",
      "ip": "192.168.31.172",
      "port": 63054,
      "lastSeen": 1793249985700,
      "status": "online",
      "connection": "CONNECTED",
      "transport": "lrdt",
      "fallback": false,
      "stats": {
        "packetsSent": 199,
        "packetsReceived": 199,
        "acksSent": 104,
        "acksReceived": 95,
        "retransmissions": 0,
        "duplicatePackets": 8,
        "outOfOrderPackets": 0,
        "fragmentsSent": 95,
        "fragmentsReceived": 104,
        "framesCompleted": 94,
        "bytesSent": 33029,
        "bytesReceived": 35433,
        "currentCwnd": 20.451059282630926,
        "peakCwnd": 20.451059282630926,
        "ssthresh": 16,
        "smoothedRtt": 13.905635755962546,
        "currentRto": 60,
        "peakInFlight": 7,
        "peakReorder": 1,
        "lossEvents": 0
      },
      "establishmentFailures": 0,
      "tcpFallbacks": 0
    }
  ],
  "expected": 10,
  "recovered": 10,
  "distinctIds": 10,
  "payloadCounts": {
    "RECOVERY-001": 1,
    "RECOVERY-002": 1,
    "RECOVERY-003": 1,
    "RECOVERY-004": 1,
    "RECOVERY-005": 1,
    "RECOVERY-006": 1,
    "RECOVERY-007": 1,
    "RECOVERY-008": 1,
    "RECOVERY-009": 1,
    "RECOVERY-010": 1
  },
  "messages": [
    {
      "version": 1,
      "messageId": "48927e6f-4087-4d54-bd69-a998c266fb0e",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862270,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-001",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "a68be603-2cbe-4324-99c1-756b14dbea24",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862272,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-002",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "52547301-84bd-4854-a654-c3e006665596",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862274,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-003",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "ce2bca0b-8207-4ea5-9849-59c42dd3c448",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862278,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-004",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "3dc5010f-2a5f-40d1-8c7d-8f5bdc8de5cd",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862281,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-005",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "b584b7a6-1cac-4abc-87fe-e1314572a037",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862284,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-006",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "1d938c67-6b14-40fb-aecd-cbd83f299646",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862285,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-007",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "7e31e0ec-2cc3-45fc-a96e-15130060e3fd",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862287,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-008",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "cbf47831-0972-4fd8-bdb4-f6ccb59760d8",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862289,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-009",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    },
    {
      "version": 1,
      "messageId": "53be1c1c-8ee6-4e71-90be-9cc41f7ad447",
      "senderId": "6531ea21-5915-4f5b-bcaf-14d5c04dadc3",
      "timestamp": 1793249862291,
      "kind": "group",
      "targetId": "e8049fd0-60dc-4dbc-bc92-7b69c00ec535",
      "content": "RECOVERY-010",
      "audience": [
        "b409098b-ab65-4578-a0bd-4d1238173f16",
        "209a9c94-3413-49ca-b515-f2256e1c7221"
      ],
      "state": "delivered",
      "delivered": 0,
      "recipients": 0
    }
  ],
  "bobApplicationAcks": [
    {
      "time": "2026-10-29T04:57:42.279Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "48927e6f-4087-4d54-bd69-a998c266fb0e"
      }
    },
    {
      "time": "2026-10-29T04:57:42.279Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "a68be603-2cbe-4324-99c1-756b14dbea24"
      }
    },
    {
      "time": "2026-10-29T04:57:42.280Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "52547301-84bd-4854-a654-c3e006665596"
      }
    },
    {
      "time": "2026-10-29T04:57:42.286Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "ce2bca0b-8207-4ea5-9849-59c42dd3c448"
      }
    },
    {
      "time": "2026-10-29T04:57:42.289Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "3dc5010f-2a5f-40d1-8c7d-8f5bdc8de5cd"
      }
    },
    {
      "time": "2026-10-29T04:57:42.290Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "b584b7a6-1cac-4abc-87fe-e1314572a037"
      }
    },
    {
      "time": "2026-10-29T04:57:42.292Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "1d938c67-6b14-40fb-aecd-cbd83f299646"
      }
    },
    {
      "time": "2026-10-29T04:57:42.295Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "7e31e0ec-2cc3-45fc-a96e-15130060e3fd"
      }
    },
    {
      "time": "2026-10-29T04:57:42.297Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "cbf47831-0972-4fd8-bdb4-f6ccb59760d8"
      }
    },
    {
      "time": "2026-10-29T04:57:42.302Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "53be1c1c-8ee6-4e71-90be-9cc41f7ad447"
      }
    }
  ],
  "recoveryEvents": [
    {
      "time": "2026-10-29T04:58:23.067Z",
      "event": "transport.selected",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "transport": "lrdt"
      }
    },
    {
      "time": "2026-10-29T04:58:23.077Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:23.079Z",
      "event": "message.received",
      "details": {
        "messageId": "48927e6f-4087-4d54-bd69-a998c266fb0e",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.080Z",
      "event": "message.received",
      "details": {
        "messageId": "a68be603-2cbe-4324-99c1-756b14dbea24",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.080Z",
      "event": "message.received",
      "details": {
        "messageId": "52547301-84bd-4854-a654-c3e006665596",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.081Z",
      "event": "message.received",
      "details": {
        "messageId": "ce2bca0b-8207-4ea5-9849-59c42dd3c448",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.081Z",
      "event": "message.received",
      "details": {
        "messageId": "3dc5010f-2a5f-40d1-8c7d-8f5bdc8de5cd",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.082Z",
      "event": "message.received",
      "details": {
        "messageId": "b584b7a6-1cac-4abc-87fe-e1314572a037",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.082Z",
      "event": "message.received",
      "details": {
        "messageId": "1d938c67-6b14-40fb-aecd-cbd83f299646",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.082Z",
      "event": "message.received",
      "details": {
        "messageId": "7e31e0ec-2cc3-45fc-a96e-15130060e3fd",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.083Z",
      "event": "message.received",
      "details": {
        "messageId": "cbf47831-0972-4fd8-bdb4-f6ccb59760d8",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.083Z",
      "event": "message.received",
      "details": {
        "messageId": "53be1c1c-8ee6-4e71-90be-9cc41f7ad447",
        "source": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "relayed": true
      }
    },
    {
      "time": "2026-10-29T04:58:23.083Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 10
      }
    },
    {
      "time": "2026-10-29T04:58:27.364Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:27.365Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:31.365Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:31.366Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:35.370Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:35.371Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:39.378Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:39.379Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:43.388Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:43.389Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:47.391Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:47.393Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:51.397Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:51.398Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:55.398Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:55.400Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:58:59.403Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:58:59.404Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:03.409Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:03.411Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:07.416Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:07.416Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:11.425Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:11.426Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:15.423Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:15.423Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:19.429Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:19.430Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:23.445Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:23.446Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:27.446Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:27.447Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:31.452Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:31.452Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:35.454Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:35.455Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:39.458Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:39.458Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    },
    {
      "time": "2026-10-29T04:59:43.480Z",
      "event": "lrdt.received.SYNC_RESPONSE",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16"
      }
    },
    {
      "time": "2026-10-29T04:59:43.482Z",
      "event": "sync.completed",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "count": 0
      }
    }
  ]
}
```

## Post-validation Windows PM cross-check

The user explicitly authorized waiting for and answering Windows confirmation PMs, then specified Mac-Charlie as the destination. After completed M8, Mac-Aaron was reopened at 2026-10-29T05:05:42.773Z to make the original Mac profile reachable for this separate request; this did not occur during recovery. Charlie received W8-STATUS-REQUEST-001 from Windows/Bob and replied with W8-STATUS-REPLY-001, giving the recorded Mac-side sequence and times. Windows statements in the incoming PM are attributed remote reports, not independent Mac observations. No test was rerun and no production source was changed. Both Mac profiles are now online; the earlier end-of-M8 offline/closed state is historical.

```json
{
  "observedAt": "2026-10-29T05:08:28.874Z",
  "request": {
    "version": 1,
    "messageId": "d3fd54bb-10f0-4d7f-a705-de2e6ce305a1",
    "senderId": "b409098b-ab65-4578-a0bd-4d1238173f16",
    "timestamp": 1793250404738,
    "kind": "private",
    "targetId": "209a9c94-3413-49ca-b515-f2256e1c7221",
    "content": "W8-STATUS-REQUEST-001 from Windows/Bob (Windows-Aaron). The user asked me to confirm W8 directly with the Mac-Charlie agent by PM. Group: PHYSICAL-RECOVERY-TEST, UUID e8049fd0-60dc-4dbc-bc92-7b69c00ec535. Windows retained RECOVERY-001 through RECOVERY-010 exactly once. Windows observed Alice offline and Charlie connected via LRDT at 13:03:15 +08:00; Alice is back online at the current observation. Please reply here starting W8-STATUS-REPLY with the completed Mac-side result: (1) initial three-member convergence, (2) Charlie offline during all ten Alice sends, (3) Alice stopped BEFORE Charlie returned and remained offline throughout recovery, (4) Charlie recovered all ten exactly once from Bob, (5) PASS/FAIL/NOT VERIFIED plus supporting times/logs if available. Report existing evidence; no rerun or source changes requested. For cross-check, RECOVERY-001 ID is 48927e6f-4087-4d54-bd69-a998c266fb0e and RECOVERY-010 ID is 53be1c1c-8ee6-4e71-90be-9cc41f7ad447.",
    "audience": [
      "209a9c94-3413-49ca-b515-f2256e1c7221"
    ],
    "state": "delivered",
    "delivered": 0,
    "recipients": 0
  },
  "reply": {
    "version": 1,
    "messageId": "2548b2ba-b40e-4813-a567-12248e643679",
    "senderId": "209a9c94-3413-49ca-b515-f2256e1c7221",
    "timestamp": 1793250481077,
    "kind": "private",
    "targetId": "b409098b-ab65-4578-a0bd-4d1238173f16",
    "content": "W8-STATUS-REPLY-001 Mac-side RECOVERY-01: PASS. Existing evidence only; no rerun or source changes.\n\nGroup PHYSICAL-RECOVERY-TEST / e8049fd0-60dc-4dbc-bc92-7b69c00ec535. Roles: Alice=Mac-Aaron (6531ea21-5915-4f5b-bcaf-14d5c04dadc3), Bob=Windows-Aaron (b409098b-ab65-4578-a0bd-4d1238173f16), Charlie=Mac-Charlie (209a9c94-3413-49ca-b515-f2256e1c7221). All times below are 2026-10-29, UTC+08:00.\n\n1. Initial convergence: Alice/Charlie snapshots at 12:57:19.951 contained identical revision-1 three-member state (event e58bc211-16c6-47c5-9a60-58ad306d6d46). The user separately confirmed all three members visible on Windows before Charlie was paused.\n2. Charlie network=false and history empty at 12:57:42.269. Alice persisted/sent RECOVERY-001..010 at 12:57:42.270..291. All ten Bob application ACKs were logged at 12:57:42.279..302. At 12:57:58.446 Charlie remained network=false with zero messages, while Alice showed each message 1/2 acknowledged.\n3. Alice pause requested 12:58:22.828; completed snapshot at 12:58:22.837 showed Alice network=false, Charlie network=false, Charlie history empty. Only then was Charlie restarted: request 12:58:22.837, network.started 12:58:22.838. Alice stayed network=false throughout recovery, confirmed again at 12:58:28.849 and 12:58:39.854. Offline means application networking stopped; Alice's window was subsequently closed.\n4. Charlie log: transport.selected=lrdt for Bob at 12:58:23.067; lrdt.received.SYNC_RESPONSE from Bob at 12:58:23.077; ten message.received events at 12:58:23.079..083, all source=Bob UUID and relayed=true; sync.completed count=10 at 12:58:23.083. Original senderId remained Alice. Snapshot contained all ten expected IDs/payloads, 10 distinct IDs, zero missing or duplicate entries. Native Charlie UI showed RECOVERY-001..010 once each; Bob connected via LRDT, Alice offline. Your RECOVERY-001 and RECOVERY-010 IDs match exactly.\n5. PASS under Mac-observable recovery criterion. Evidence saved in results/physical_cross_platform_macos.md. Windows UI/disk was not independently inspected from Mac.\n\nAlice was reopened later at 13:05:42.773 for this separate PM-confirmation request, after M8 was already complete. Current Alice online status does not describe the earlier recovery interval.",
    "audience": [
      "b409098b-ab65-4578-a0bd-4d1238173f16"
    ],
    "state": "delivered",
    "delivered": 1,
    "recipients": 1
  },
  "peer": {
    "peerId": "b409098b-ab65-4578-a0bd-4d1238173f16",
    "displayName": "Windows-Aaron",
    "ip": "192.168.31.172",
    "port": 63054,
    "lastSeen": 1793250507227,
    "status": "online",
    "connection": "CONNECTED",
    "transport": "lrdt",
    "fallback": false,
    "stats": {
      "packetsSent": 1314,
      "packetsReceived": 1314,
      "acksSent": 677,
      "acksReceived": 637,
      "retransmissions": 13,
      "duplicatePackets": 57,
      "outOfOrderPackets": 0,
      "fragmentsSent": 624,
      "fragmentsReceived": 677,
      "framesCompleted": 614,
      "bytesSent": 216361,
      "bytesReceived": 225449,
      "currentCwnd": 22.738691130968103,
      "peakCwnd": 22.738691130968103,
      "ssthresh": 7.584436792572911,
      "smoothedRtt": 9.203078951073437,
      "currentRto": 60,
      "peakInFlight": 7,
      "peakReorder": 1,
      "lossEvents": 9
    },
    "establishmentFailures": 0,
    "tcpFallbacks": 0
  },
  "replyEvents": [
    {
      "time": "2026-10-29T05:08:01.078Z",
      "event": "message.sent",
      "details": {
        "messageId": "2548b2ba-b40e-4813-a567-12248e643679",
        "kind": "private",
        "recipients": [
          "b409098b-ab65-4578-a0bd-4d1238173f16"
        ]
      }
    },
    {
      "time": "2026-10-29T05:08:01.089Z",
      "event": "message.ack",
      "details": {
        "peer": "b409098b-ab65-4578-a0bd-4d1238173f16",
        "messageId": "2548b2ba-b40e-4813-a567-12248e643679"
      }
    }
  ]
}
```
