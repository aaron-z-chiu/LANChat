# LANChat Physical Cross-Platform Validation — Windows

## Environment

- Date: 2026-10-29; timestamps use Asia/Shanghai (UTC+08:00) unless marked UTC.
- Windows: Microsoft Windows 11 Enterprise, version 10.0.26200, display version 25H2, build 26200.9711.
- Hardware: ASUSTeK COMPUTER INC., ROG Strix G18 G815LR_G815LR.
- Architecture: x64 / 64-bit.
- Node: v24.22.1; npm: 11.19.1.
- Git commit: `3fec6adf0c690145c687ce1a475cfbd21d50fe32`.
- Branch: `master`, tracking `origin/master`.
- Initial worktree: clean. No production source, existing tests, package configuration, or Git history changed.
- Local IPv4: `192.168.31.172/24`, interface `Wi-Fi`, interface index 16, gateway `192.168.31.1`.
- Wi-Fi network: `C403_Redmi 2`; network category: Public (Get-NetConnectionProfile value 0).
- Additional active adapter: `Clash`, interface index 8, IPv4 `198.18.0.1/16`, Public; potential routing influence, not established as a cause.
- Windows Defender Firewall: Domain, Private, and Public profiles enabled. No firewall or network-profile settings changed.
- Remote OS: macOS, per test specification/user confirmation; not independently verified by Windows.
- Remote source revision: user explicitly confirmed the same revision with no relevant source changes and authorized W1 discovery.
- Profile/display name: `Windows-Aaron`.
- Profile root: `.local-data/physical-validation` inside this checkout; persisted data retained.
- Local persistent UUID: `b409098b-ab65-4578-a0bd-4d1238173f16`.
- Local mode: Auto for W1, W4, and W5; Safe for W2 and W3 (confirmed by user and local persisted setting).
- Discovery: application's default multicast/broadcast discovery, UDP 45878; no manual remote address supplied.

## Preparation

- `git status --branch --porcelain=v1`: `## master...origin/master`, with no changes at baseline.
- `npm run build`: PASS, exit code 0; existing TypeScript check and compiled-app build completed.
- Initial sandboxed OS/network queries lacked CIM access; read-only queries outside the sandbox succeeded.
- Initial sandboxed Electron launch failed with `Process failed to launch!`; launch outside the sandbox succeeded.
- Used the installed Playwright Electron driver, as the existing desktop smoke test does, to launch the compiled app and observe its normal renderer snapshot API. No implementation changes or additional peers were introduced.
- Windows checkpoint W0 emitted; user confirmed the same Mac revision, Mac running, and permission to proceed to W1.

## Results

| Test ID | Purpose | Local evidence | Result |
|---|---|---|---|
| DISC-01 | Physical Mac automatic discovery | First attempt timed out. Retry automatically discovered Mac-Aaron at 192.168.31.83:54450 within 30.032 seconds, online and CONNECTED via LRDT. | PASS on retry; first attempt FAIL retained |
| SAFE-M2W-001 | Safe/TCP Mac → Windows | Exact payload visible once in Mac-Aaron conversation and stored once; local mode safe; live peer status Connected via TCP. | PASS |
| SAFE-W2M-001 | Safe/TCP Windows → Mac | Exact payload sent once to Mac-Aaron; live TCP connection and Delivered visible; one saved recipient row with attempts=1 and delivered=1. | PASS |
| AUTO-M2W-001 | Auto/LRDT Mac → Windows | Exact payload received and stored once while LRDT locally selected. Initial TCP fallback preserved; LRDT observed after one ordinary reconnect. | PASS after reconnect |
| AUTO-W2M-001 | Auto/LRDT Windows → Mac | Exact payload sent once with LRDT selected; normal Delivered state and one saved recipient row with attempts=1, delivered=1. | PASS |
| GROUP-01 | Group messaging | Both expected members visible; GROUP-M2W-001 received once; GROUP-W2M-001 sent in the same group and Delivered 1/1 with saved ACK. Duplicate group names recorded separately. | PASS |
| RESTART-01 | Restart / persistent identity | Same local UUID/db identity retained; endpoints changed; Mac-Aaron reconnects via TCP fallback; all six messages retained. User separately confirmed Mac recognizes the same UUID and reconnects. | PASS |
| RECOVERY-01 | Secondary-peer recovery | Bob locally retained 10/10 unique messages; Windows observed Alice offline and Charlie connected. Mac-Charlie separately confirmed exact-once recovery from Bob while Alice's networking remained stopped, with timestamped relay/sync evidence received by PM. | PASS (local Bob evidence + attributed Mac confirmation) |

## Detailed observations

### DISC-01 / checkpoint W1

- Start: 2026-10-29T12:05:47.945+08:00 (`2026-10-29T04:05:47.945Z`).
- Observation limit: 120 seconds, snapshots sampled approximately every 10 seconds; ordinary discovery remains active continuously.
- Action: launched the compiled app with `--profile Windows-Aaron`, selected the display name through the normal first-launch UI, and observed automatic discovery.
- Initial snapshot: identity `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, priority `auto`, network `true`, peers `[]`, groups `[]`, messages `[]`.
- End: 2026-10-29T12:07:48.059+08:00; elapsed 120.114 seconds.
- All 13 snapshots showed network `true`, peers `[]`, groups `[]`, messages `[]`.
- Remote display name, UUID, endpoint, OS, and online state: NOT OBSERVED throughout the attempt.
- Selected TCP/LRDT data path: NOT OBSERVED.
- Screenshot: `physical_windows_w1.png`; visually verified that the UI showed zero nearby people and the Windows-Aaron profile.
- Exact-executable firewall inspection found two enabled inbound Allow rules for electron.exe on Public. This does not establish end-to-end reachability or rule out other network restrictions.
- Status: FAIL for discovery within this bounded attempt. Stopped at the user's requested limit and closed this endpoint gracefully; no downstream functional tests ran.

```text
WINDOWS CHECKPOINT W1
test: DISC-01
mac_peer_visible: FAIL
mac_peer_name: NOT OBSERVED
mac_peer_uuid: NOT OBSERVED
ready_for_next: NO
```

### DISC-01 retry authorized by user

- On 2026-10-29, after the first timeout, the user requested: `please restart`.
- Reusing the same persisted Windows-Aaron profile and unchanged commit.
- A second automatic-discovery observation is limited to 120 seconds after the app is running. First-attempt evidence is retained.
- Retry start: 2026-10-29T12:11:47.135+08:00 (`2026-10-29T04:11:47.135Z`).
- Initial retry snapshot: network `true`, priority `auto`, no peers, groups, or messages.
- UUID after this user-requested restart: `b409098b-ab65-4578-a0bd-4d1238173f16`, matching the first attempt. At this early stage RESTART-01 was NOT VERIFIED; the dedicated W7 procedure and subsequent Mac-side confirmation are recorded below.
- At 2026-10-29T12:12:17.167+08:00 (30.032 seconds after retry start), the Windows snapshot automatically showed:
  - Display name: `Mac-Aaron`.
  - Peer UUID: `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
  - Source IPv4: `192.168.31.83`; advertised TCP port: `54450`.
  - Status: `online`; connection: `CONNECTED`.
  - Selected transport: `lrdt`; fallback: `false`; establishment failures: 0; TCP fallbacks: 0.
  - LRDT statistics: packets sent/received 16/16, ACKs sent/received 8/8, completed frames 8, retransmissions 0, duplicate packets 0, bytes sent/received 1792/1792.
  - Local priority `auto`, network `true`, no application messages or groups.
- Screenshot: `physical_windows_w1_retry_20261029_1211.png`, visually verified to show Mac-Aaron connected via LRDT and one nearby person.
- Result: PASS for Windows-side automatic discovery. Mac-side discovery is not independently confirmed here.
- LRDT selection/establishment is locally observed. AUTO-M2W-001 and AUTO-W2M-001 remain NOT VERIFIED because their required payloads and delivery states have not been tested.
- The observation driver closed its instance at checkpoint W1. At 2026-10-29T12:12:51.461+08:00 the same compiled app/profile was launched normally and left open, process ID 10400. This additional launch was not a synchronized restart test.
- Desktop-session process inspection verified PID 10400 remains running with window title `LANChat`. A subsequent same-profile launch exited normally because the existing instance owns the single-instance lock. Sandboxed process enumeration could not see the desktop-session process; the desktop-session query confirmed it.

```text
WINDOWS CHECKPOINT W1
test: DISC-01
mac_peer_visible: PASS
mac_peer_name: Mac-Aaron
mac_peer_uuid: 6531ea21-5915-4f5b-bcaf-14d5c04dadc3
ready_for_next: YES
```

At W1, testing paused until the user confirmed both endpoints were in Safe mode. No test messages had been sent by Windows.

### SAFE-M2W-001 / checkpoint W2

- Authorization/preconditions: user stated `Both set to safe mode`, then confirmed the Mac sent the required message once.
- Start/initial database observation: 2026-10-29T12:18:49.702+08:00; opened the running profile's SQLite database read-only. Persisted priority was `safe`; matching payload count was 0.
- Windows profile/UUID: `Windows-Aaron`, `b409098b-ab65-4578-a0bd-4d1238173f16`.
- Remote sender: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
- Local transport: TCP. At 2026-10-29T12:20:09.922+08:00, the foreground LANChat screenshot showed `Mac-Aaron — Connected via TCP`; the conversation observation at 12:20:17.251+08:00 also showed the same transport.
- Action: opened Mac-Aaron's conversation using the existing UI; no message was sent from Windows.
- First local observation of reception/history visibility: 2026-10-29T12:20:17.251+08:00. Exactly one message bubble contained `SAFE-M2W-001 physical Mac to Windows`.
- Sender-authored message timestamp: `1793247553128` milliseconds since epoch. The UI displayed `12:19 PM`; this is not claimed as an exact local receive timestamp.
- Exact local receive time: NOT OBSERVED. The payload was absent at the initial database read and present at the later UI/history observation.
- Read-only persistence verification: 2026-10-29T12:20:32.755+08:00; exactly 1 matching message in SQLite, sequence 1, ID `dafc27b2-9f3e-4153-9dcc-0a41d6f237c7`, kind `private`, sender the Mac UUID, target/audience the Windows UUID.
- Duplicate visible: NO; one UI bubble and one matching saved row. No claim is made about unobserved transport-level retransmissions.
- Screenshot evidence: `physical_windows_w2_20261029_1220.jpg`.
- Result: PASS for Windows-side Safe/TCP reception and single persisted/visible copy. Mac-side ACK state was not independently observed by Windows.

```text
WINDOWS CHECKPOINT W2
test: SAFE-M2W-001
message_received: PASS
duplicate_visible: NO
local_transport: TCP
result: PASS
```

Paused at W2 until the user instructed `Please send message`. Windows remained in Safe mode with Mac-Aaron's conversation selected.

### SAFE-W2M-001 / checkpoint W3

- User authorization: `Please send message`, in response to the W2 checkpoint and the stated Windows-to-Mac test payload.
- Start/pre-send observation: 2026-10-29T12:23:26.175+08:00. Restored the existing minimized LANChat window; Mac-Aaron's selected conversation showed `Connected via TCP`.
- Local sender: `Windows-Aaron`, UUID `b409098b-ab65-4578-a0bd-4d1238173f16`; mode Safe, independently verified from the persisted setting after the send.
- Remote recipient: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
- Payload: `SAFE-W2M-001 physical Windows to Mac`.
- Action: filled the existing message composer, visually checked the exact payload and target, and clicked Send once.
- Send action started: 2026-10-29T12:23:43.803+08:00. Persisted message timestamp: 2026-10-29T12:23:43.891+08:00 (`1793247823891` milliseconds since epoch).
- Message ID: `24423c36-cba3-4801-b310-7946396c26db`, private message, local sequence 3, target/audience the Mac UUID.
- Local selected transport/path: TCP, observed in the sidebar immediately before and after the send.
- Local delivery state: `Delivered` visible in the post-send screenshot at 2026-10-29T12:23:43.953+08:00; confirmed in the refreshed accessibility tree/screenshot at 12:23:53.177+08:00.
- Read-only SQLite verification at 2026-10-29T12:23:53.480+08:00: exact payload count 1; recipient Mac UUID; `attempts=1`, `last_attempt=1793247823894`, `delivered=1`.
- Application ACK: locally recorded by the normal pending-message delivery row and the normal Delivered UI state. No independent Mac-screen observation or user-read claim is made.
- Duplicate visible: NO; one outgoing UI bubble and one matching saved message.
- Screenshot evidence: `physical_windows_w3_20261029_1223.jpg`.
- Result: PASS under the W3 criterion of locally observed Safe/TCP path and normal delivered state.

```text
WINDOWS CHECKPOINT W3
test: SAFE-W2M-001
local_transport: TCP
local_delivery_state: Delivered
result: PASS
```

Paused at W3 until the user stated `Both set to auto mode`, authorizing W4 preparation and reception observation.

### AUTO-M2W-001 / checkpoint W4

- User confirmed both endpoints set to Auto mode.
- Start/local persisted-mode verification: 2026-10-29T12:28:27.619+08:00; `networkPriority=auto`, exact required payload count 0 in the read-only SQLite query.
- Initial live observation at 12:28:35.741+08:00: Mac-Aaron present, `Connected via TCP (fallback)`. This observation does not verify LRDT; no W4 payload was visible.
- Initial-fallback screenshot: `physical_windows_w4_initial_fallback_20261029_1228.jpg`.
- Performed one ordinary network pause/reconnect cycle using the existing UI, with no production or timing changes. Pause action at 12:29:01.419+08:00; reconnect at 12:29:12.522+08:00.
- At 12:29:22.141+08:00, screenshot and accessibility tree both showed Mac-Aaron `Connected via LRDT`, one nearby person, normal active local network, and the existing Safe-mode history.
- LRDT-readiness screenshot: `physical_windows_w4_lrdt_ready_20261029_1229.jpg`.
- Requested the Mac send `AUTO-M2W-001 physical Mac to Windows over LRDT` once, then observed reception as recorded below.
- Local persistent UUID and target peer remain the same as previous tests. No Windows-to-Mac Auto-mode test message has been sent.
- Read-only polling at 2026-10-29T12:29:57.123+08:00 still found 0 exact payloads. At 12:30:07.134+08:00 it found exactly 1, with local mode still `auto`.
- Received payload: `AUTO-M2W-001 physical Mac to Windows over LRDT`.
- Message ID: `1f3ed777-b7e5-4143-9b84-38d4b476bc08`, local sequence 4, kind `private`.
- Sender: `Mac-Aaron`, UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`; target/audience: Windows UUID `b409098b-ab65-4578-a0bd-4d1238173f16`.
- Sender-authored timestamp: `1793248198897` milliseconds since epoch; the UI displayed `12:29 PM`. Exact local receive time is NOT OBSERVED; it falls between the two polling observations above.
- At 12:30:16.686+08:00, the screenshot and accessibility tree both showed the exact payload once in Mac-Aaron's conversation and `Connected via LRDT` in the sidebar.
- LRDT selected locally: YES, explicitly observed before and after reception; no TCP fallback label in the successful reception observation.
- Duplicate visible: NO; one matching saved message and one visible bubble.
- Reception screenshot: `physical_windows_w4_received_20261029_1230.jpg`.
- Result: PASS after ordinary reconnect. The initial Auto-mode TCP fallback remains a recorded observation; its cause is not established. No source code, timing constants, firewall settings, or test logic was changed.

```text
WINDOWS CHECKPOINT W4
test: AUTO-M2W-001
lrdt_selected_locally: YES
message_received: PASS
duplicate_visible: NO
result: PASS
```

Paused at W4 before sending a Windows message. The user then confirmed the Mac sent W4 once, followed by `Please send the message`, authorizing W5.

### AUTO-W2M-001 / checkpoint W5

- Start/pre-send observation: 2026-10-29T12:33:40.568+08:00. The existing Windows-Aaron instance was restored to the foreground, with Mac-Aaron's conversation selected and `Connected via LRDT` visible in the screenshot and accessibility tree.
- Local mode: Auto, confirmed from the saved setting in the read-only database check after the send.
- Sender UUID: `b409098b-ab65-4578-a0bd-4d1238173f16`; recipient Mac-Aaron UUID: `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`.
- Exact payload: `AUTO-W2M-001 physical Windows to Mac over LRDT`.
- Action: filled the existing composer, visually checked the payload and LRDT label, then clicked Send exactly once.
- Send action started: 2026-10-29T12:33:56.257+08:00. Persisted message timestamp: 12:33:56.339+08:00 (`1793248436339` milliseconds since epoch).
- Message ID: `a1c40fe7-0427-4914-a564-162c360f8fad`; local sequence 6, kind `private`, target/audience the Mac UUID.
- Local LRDT selection: YES, explicitly observed before the send and in the final delivery observation. No fallback label was present.
- Read-only database check at 2026-10-29T12:34:06.293+08:00 found exactly 1 matching saved message and one recipient row for the Mac UUID: `attempts=1`, `last_attempt=1793248436342`, `delivered=1`.
- At 12:34:07.946+08:00, after scrolling the existing message log to show the entire outgoing entry, the screenshot and accessibility tree both showed the exact W5 payload with `Delivered` and the sidebar `Connected via LRDT`.
- Application ACK: confirmed in the normal local delivered row and UI state; Mac's own screen and human-read status were not observed from Windows.
- Duplicate visible: NO; one outgoing bubble and one matching saved message.
- Screenshot: `physical_windows_w5_20261029_1234.jpg`.
- Result: PASS under the W5 criterion of locally selected/established LRDT and normal delivered state.

```text
WINDOWS CHECKPOINT W5
test: AUTO-W2M-001
lrdt_selected_locally: YES
delivery_state: Delivered
result: PASS
```

Paused at W5 until the user instructed `Please proceed`, authorizing W6 group messaging.

### GROUP-01 / checkpoint W6

- Start/local observation: 2026-10-29T12:43:31.388+08:00; Windows-Aaron open in Auto mode, Mac-Aaron present and connected via LRDT.
- Windows created `PHYSICAL-XPLAT-TEST` using the normal UI, explicitly including Mac-Aaron, with lifetime `Until everyone leaves`. Create action: 12:44:03.000+08:00.
- The resulting screenshot showed two separate groups with the same name and two members each. This is recorded as a coordination ambiguity, not a duplicate-message failure.
- Read-only database inspection at 12:44:12.754+08:00 showed two revision-1 group records:
  - `d058608b-566d-4cdc-abce-e24fe8de3674`: updatedBy Mac UUID `6531ea21-5915-4f5b-bcaf-14d5c04dadc3`, event `11c22a6a-52de-410a-8c7d-a6688c9d1254`.
  - `a8c1ada8-41cd-4fd5-86df-069820872d8b`: updatedBy Windows UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, event `53b52ea5-d81d-465a-b6c2-992bc307b86c`.
- Each record contains exactly the Windows and Mac UUIDs in members/audience, and `expiresAt=null`. The selected group's header shows `You, Mac-Aaron`; both sidebar entries show `2 members`.
- At the initial database check there were no saved group messages.
- Requested Mac send `GROUP-M2W-001` once in its test group. Windows will identify that message's target group UUID and send `GROUP-W2M-001` in the same group, avoiding any assumption based only on the duplicate display name.
- At this preparation stage, no group message had yet been sent from Windows; observations below complete the bidirectional check.
- At 2026-10-29T12:45:00.356+08:00, a read-only query found exactly one `GROUP-M2W-001`, message ID `6be34a2e-afb5-4363-927c-d28c3ca2a88e`, local sequence 11, kind `group`, sender the Mac UUID, target group `d058608b-566d-4cdc-abce-e24fe8de3674`, audience the Windows UUID.
- Mac-message sender-authored timestamp: `1793249092253` milliseconds since epoch (12:44:52.253+08:00). Exact local receive timestamp is NOT OBSERVED; the first saved-message observation was at 12:45:00.356+08:00.
- At 12:45:11.858+08:00, opened the first group entry and visually verified the Mac message appears once, group header lists `Mac-Aaron, You`, and two members are shown.
- Used that same selected group for the Windows reply; payload `GROUP-W2M-001`, Send clicked once at 12:45:24.407+08:00.
- Windows message ID: `68764b90-f425-4505-855e-3b1bd6dcb71e`; local sequence 13; persisted timestamp 12:45:24.490+08:00 (`1793249124490` milliseconds since epoch).
- Read-only verification at 12:45:33.038+08:00 confirmed both payloads occur once, both have the same target group UUID `d058608b-566d-4cdc-abce-e24fe8de3674`, and group membership remains exactly the two expected UUIDs.
- The Windows message's recipient row targets the Mac UUID with `attempts=1`, `last_attempt=1793249124493`, `delivered=1`.
- At 12:45:32.738+08:00, screenshot and accessibility tree show both group payloads once and `Delivered 1/1` on the Windows message. The sidebar shows Mac-Aaron connected via LRDT; local saved priority remains Auto.
- Screenshot: `physical_windows_w6_20261029_1245.jpg`.
- Result: PASS for Windows-observed group visibility, expected membership, Mac-message reception, and acknowledged Windows group send. No independent Mac-screen or human-read confirmation is claimed.
- Both same-name group records are preserved; no group was deleted or renamed. The unused Windows-created group is not treated as a duplicate message.

```text
WINDOWS CHECKPOINT W6
test: GROUP-01
group_visible: PASS
mac_group_message_received: PASS
windows_group_send_state: Delivered 1/1
duplicate_visible: NO
result: PASS
```

Paused at W6 until the user instructed `Please proceed`, authorizing W7 restart/persistent-identity testing.

### RESTART-01 / checkpoint W7

- Start/baseline database observation: 2026-10-29T12:47:53.716+08:00.
- Same source commit: `3fec6adf0c690145c687ce1a475cfbd21d50fe32`. No production, test, or package changes were made.
- Profile/data root: `Windows-Aaron`, `.local-data/physical-validation/Windows-Aaron`, retained in place; no profile copy or reset.
- UUID before restart: `b409098b-ab65-4578-a0bd-4d1238173f16`; display name `Windows-Aaron`; database incarnation `cde2d16b-d5a0-4b8a-94ed-974e82568a02`; saved priority `auto`.
- Baseline: two groups and six saved message IDs, including the four private-test payloads and two group-test payloads.
- At 12:47:55.319+08:00, desktop-session endpoint inspection found main PID 10400 listening on TCP `0.0.0.0:59391`, UDP `0.0.0.0:61693`, and discovery UDP `0.0.0.0:45878`. UDP 61693 is the non-discovery LRDT listener, identified from the application's existing networking implementation and process ownership.
- At 12:48:06.913+08:00, the screenshot showed Mac-Aaron `Connected via LRDT`, two-member group membership, both group payloads, and the existing `Delivered 1/1` state.
- Pre-restart screenshot: `physical_windows_w7_before_20261029_1248.jpg`.
- Closed the existing app normally with Alt+F4 at 12:48:11.520+08:00. Verified old main process 10400 exited before launching again; verification timestamp 12:48:27.432+08:00.
- Relaunched the existing compiled app with the same data root and `--profile Windows-Aaron`; new main process PID 29652, start 12:48:27.463+08:00. Used the app's existing same-profile single-instance focus behavior to show the restarted window; the main process remained PID 29652.
- At 12:48:32.381+08:00, the read-only database check showed UUID after restart `b409098b-ab65-4578-a0bd-4d1238173f16`, the same display name and database incarnation, saved Auto mode, six messages, and two groups.
- At 12:48:43.921+08:00, new endpoints were TCP `0.0.0.0:63054`, non-discovery/LRDT UDP `0.0.0.0:56875`, discovery UDP `0.0.0.0:45878`, owned by PID 29652. TCP/LRDT ports changed; discovery port did not.
- At 12:49:10.887+08:00, Windows automatically showed Mac-Aaron online and `Connected via TCP (fallback)` in the screenshot and accessibility tree. No manual remote endpoint was supplied, no retry cycle was forced, and no post-restart test message was sent.
- Post-restart reconnection screenshot: `physical_windows_w7_reconnected_20261029_1249.jpg`.
- At 12:49:40.933+08:00, opened the tested group and visually confirmed both group payloads and their existing delivery state remain visible. Screenshot: `physical_windows_w7_history_20261029_1249.jpg`.
- Read-only verification at 12:50:17.345+08:00 found all six baseline message IDs retained, six unique saved messages, and no missing baseline ID.
- Same local UUID: YES. Endpoint changed: YES. Mac reconnected as observed on Windows: YES. Post-restart LRDT selection: NO at the recorded observation; TCP fallback was selected. Cause is not established.
- Requested separate Mac-side confirmation that Windows-Aaron is recognized as UUID `b409098b-ab65-4578-a0bd-4d1238173f16` and reconnected. The initial W7 checkpoint was NOT VERIFIED while that confirmation was pending.
- Confirmation recorded at 2026-10-29T12:50:57.431+08:00: the user answered `Yes—same UUID and reconnected` to the exact question naming the Windows UUID and requiring Mac-side recognition/reconnection. This is explicitly user-supplied Mac-side confirmation, not a Windows-side inference or direct inspection of the Mac.
- Final result: PASS for W7 persistent identity and reconnection. The post-restart TCP fallback observation is retained; W7 does not require LRDT specifically.
- No W8 roles or recovery steps have been started.

```text
WINDOWS CHECKPOINT W7
test: RESTART-01
uuid_before: b409098b-ab65-4578-a0bd-4d1238173f16
uuid_after: b409098b-ab65-4578-a0bd-4d1238173f16
same_local_uuid: YES
endpoint_changed: YES
mac_reconnected: YES (observed on Windows)
result: PASS
```

W7 is complete. The user subsequently selected Alice/Bob/Charlie placement and authorized W8 as recorded below.

### RECOVERY-01 / W8 preparation

- User-selected placement: Alice = Mac-Aaron (original sender), Bob = Windows-Aaron (secondary retaining peer), Charlie = a new Mac profile.
- Windows role: Bob; persistent UUID `b409098b-ab65-4578-a0bd-4d1238173f16`. The Windows app remains online; no restart, profile reset, or network pause is planned during recovery.
- Initial observation: 2026-10-29T12:55:56.003+08:00, Mac-Aaron visible and `Connected via TCP (fallback)` in Auto mode. This transport does not prevent W8's application-level recovery check.
- Read-only database check at 12:55:56.410+08:00: no `RECOVERY-*` messages present, only Mac-Aaron known; its stored peer row is not used as evidence of current liveness because it is persisted metadata.
- Requested a distinct Mac-Charlie identity and all three profiles online for initial convergence. The user replied `I’ll start Mac-Charlie now`.
- Windows will create one fresh group named `PHYSICAL-RECOVERY-TEST` after Charlie is discovered. Mac is instructed to wait before sending recovery payloads, so Charlie can first receive the initial membership state and then go offline.
- Charlie's recovery is remote to Windows. Bob can directly verify retained copies, its live connections, and source-offline observations; Charlie's exact-once recovery requires separately attributed Mac-side confirmation.
- At 12:56:45.524+08:00, read-only known-peer monitoring first observed distinct Mac-Charlie UUID `209a9c94-3413-49ca-b515-f2256e1c7221`, IP `192.168.31.83`, TCP port 57631. The subsequent live screenshot at 12:57:04.937+08:00 showed Mac-Charlie connected via LRDT and Mac-Aaron via TCP fallback.
- A Mac-Aaron-authored recovery group arrived before Windows created one. Used this already-arrived group; no duplicate recovery group was created by Windows.
- At 12:57:22.376+08:00, the saved group `e8049fd0-60dc-4dbc-bc92-7b69c00ec535` was named `PHYSICAL-RECOVERY-TEST`, revision 1, event `e58bc211-16c6-47c5-9a60-58ad306d6d46`, updatedBy Alice/Mac-Aaron, no expiry. Members and audience were exactly Alice, Bob, and Charlie UUIDs. No recovery messages were yet present in Bob's database at that observation.
- Requested explicit Mac-side confirmation of initial group convergence before Charlie's offline/send phase. This remains pending; neither Mac profile's initial state is inferred from Bob's copy.
- At 12:57:50.237+08:00, Bob's accessibility tree contained all ten expected payloads from Mac-Aaron. The screenshot showed the lower portion of retained history; peer snapshots around this time changed from Charlie Connecting to Offline.
- At 12:58:11.011+08:00, read-only SQLite inspection confirmed exactly 10 retained recovery messages, 10 unique message IDs, each payload RECOVERY-001 through RECOVERY-010 occurring once. Every message is from Alice UUID, targets group `e8049fd0-60dc-4dbc-bc92-7b69c00ec535`, and has both Bob and Charlie in its original audience. Group revision/membership remained unchanged.
- Sender-authored timestamps span `1793249862270`–`1793249862291` milliseconds since epoch; these are not claimed as exact Windows receive times.
- At 12:58:18.187+08:00, the live screenshot showed Mac-Charlie Offline, Mac-Aaron Connected via TCP (fallback), Bob's local network active, and the recovery messages in history. Windows did not independently capture Charlie's exact offline transition before Alice sent the messages; that temporal condition requires Mac-side confirmation.
- Saved Bob's full retained-message manifest with exact IDs and audiences as `physical_windows_w8_retained_20261029_1258.json`; screenshot `physical_windows_w8_retained_bottom_20261029_1258.jpg`.
- Bob retention subcheck: PASS, 10 messages, 0 duplicate payload entries. Overall recovery: NOT VERIFIED until Alice-offline/Charlie-return sequence and Charlie's actual recovered copies are confirmed. Windows has remained online continuously through W8 preparation and retention.
- The user subsequently asked `I think the W8 has finished?`. No test repetition was initiated; inspected the existing final state.
- At 2026-10-29T13:03:13.978+08:00, read-only verification again found all ten expected payloads exactly once, ten unique IDs, unchanged three-member group, and unchanged source commit.
- At 13:03:15.547+08:00, screenshot and accessibility tree both showed Mac-Aaron/Alice `Offline`, Mac-Charlie `Connected via LRDT`, local network active, and Bob's retained recovery history.
- Final-stage screenshot: `physical_windows_w8_alice_offline_charlie_online_20261029_1303.jpg`.
- This proves Alice is offline at the recorded final-state observation and Charlie is connected to Bob. It does not by itself prove Charlie's saved-message count, Charlie's earlier offline state at send time, or that Alice was offline for the entire recovery interval.
- Requested the Mac-side result to confirm initial group convergence, Charlie offline for all ten sends, Alice stopped before Charlie returned and stayed offline, and Charlie recovering all ten exactly once from Bob. No rerun is required if those conditions have already been verified remotely.
- The user explicitly authorized direct communication with the agent on Mac-Charlie, then specified private messaging (`Talk with PM`). The connected Codex chat list did not expose that Mac agent; used LANChat's normal PM UI as requested.
- At 2026-10-29T13:05:59.530+08:00, Windows showed both Mac-Aaron and Mac-Charlie connected via LRDT. Alice had returned by this observation; no inference is made about whether that return occurred before or after Charlie's completed recovery.
- Sent coordination PM `W8-STATUS-REQUEST-001` once to Mac-Charlie at 13:06:44.651+08:00. Message ID `d3fd54bb-10f0-4d7f-a705-de2e6ce305a1`; persisted timestamp `1793250404738`; recipient Charlie UUID `209a9c94-3413-49ca-b515-f2256e1c7221`.
- The request states Bob's retained ten-message evidence, supplies first/last recovery IDs for cross-checking, and asks the Mac agent for the completed test's convergence, offline/send/recovery sequence, exact-once count, and PASS/FAIL/NOT VERIFIED result. It requests reporting existing evidence, with no rerun or source changes.
- At 13:07:06.067+08:00, read-only SQLite inspection confirmed this PM's recipient state `attempts=1`, `delivered=1`. No incoming PM from Charlie was present at that first check. This coordination PM is separate from the ten group recovery messages.

```text
WINDOWS CHECKPOINT W8 (initial provisional result, before Mac PM confirmation)
test: RECOVERY-01
windows_role: Bob
messages_expected: 10
messages_locally_verified: 10 retained on Bob
duplicates_locally_observed: 0
original_sender_offline_during_recovery: NOT VERIFIED (offline in final Windows snapshot)
result: NOT VERIFIED (Charlie's result and timing confirmation pending)
```

### RECOVERY-01 / direct Mac confirmation and final W8

- The user requested direct PM communication with the Mac-Charlie agent. The Windows operator sent the status request documented above and received a substantive reply; no recovery test was repeated.
- At 2026-10-29T13:08:05.609+08:00, the Windows screenshot and accessibility tree displayed incoming `W8-STATUS-REPLY-001 Mac-side RECOVERY-01: PASS` in the Mac-Charlie PM conversation. The incoming saved message was also observed by the read-only poll at 13:08:06.097+08:00.
- Reply message ID: `2548b2ba-b40e-4813-a567-12248e643679`, sender Mac-Charlie UUID `209a9c94-3413-49ca-b515-f2256e1c7221`, target Windows/Bob UUID `b409098b-ab65-4578-a0bd-4d1238173f16`, sender-authored timestamp `1793250481077` (13:08:01.077+08:00).
- The following are separately reported Mac-side observations, received locally as PM data. They are not represented as direct Windows inspection of Mac files/windows:
  - Initial Alice/Charlie snapshots at 12:57:19.951+08:00 contained identical revision-1 three-member group state and event `e58bc211-16c6-47c5-9a60-58ad306d6d46`.
  - At 12:57:42.269, Charlie had `network=false` and empty history. Alice sent/persisted the ten messages at 12:57:42.270–12:57:42.291; Bob's ten application ACKs were logged at 12:57:42.279–12:57:42.302. Charlie was still paused with zero messages at 12:57:58.446.
  - Alice's network pause completed at 12:58:22.837. At that point both Alice and Charlie had networking stopped and Charlie's history was empty. Charlie networking was then started at 12:58:22.838. Alice remained `network=false`, checked again at 12:58:28.849 and 12:58:39.854; its window was closed subsequently. Offline in this run means application networking stopped.
  - Charlie selected LRDT to Bob at 12:58:23.067, received a SYNC_RESPONSE from Bob at 12:58:23.077, logged ten relayed message-received events with source Bob at 12:58:23.079–12:58:23.083, and completed synchronization with count 10 at 12:58:23.083.
  - Charlie's snapshot and native UI contained all ten expected messages, ten distinct IDs, zero missing or duplicate entries, original sender Alice, Bob connected, Alice offline. The first and last IDs supplied by Windows matched exactly.
  - The Mac agent reports its evidence saved in `results/physical_cross_platform_macos.md` on the Mac. That remote file was not read directly from Windows; the full reply is preserved locally.
  - Alice was reopened later at 13:05:42.773, after recovery was complete. This is consistent with Windows observing Alice offline at 13:03:15.547 and back online at 13:05:59.530.
- Cross-checks: group UUID, revision/event, role UUIDs, sender-authored send-time range, first/last message IDs, and ten-message count agree with Bob's locally saved evidence. At 13:08:28.502+08:00, all ten Bob message IDs were still present, unique, and matched the pre-confirmation manifest.
- Full request/reply, sender/target IDs, delivery state, and local retention recheck: `physical_windows_w8_mac_confirmation_pm_20261029_1308.json`.
- Reply screenshot: `physical_windows_w8_mac_reply_20261029_1308.jpg`.
- Final result: PASS using Windows-observed Bob retention and separately attributed Mac-confirmed Charlie recovery. No remote success is inferred solely from the Windows peer list or the status-request delivery ACK.

```text
WINDOWS CHECKPOINT W8
test: RECOVERY-01
windows_role: Bob
messages_expected: 10
messages_locally_verified: 10 retained on Bob
duplicates_locally_observed: 0
original_sender_offline_during_recovery: YES (Mac-confirmed; Windows also observed Alice offline after recovery)
result: PASS (Windows Bob evidence plus separate Mac confirmation)
```

## Final summary

- Revision tested: `3fec6adf0c690145c687ce1a475cfbd21d50fe32`, branch `master`. Production implementation, existing tests/configuration, and Git history were not changed. The build used existing dependencies and succeeded.
- Windows environment: Windows 11 Enterprise 25H2, build 26200.9711, x64, ASUSTeK ROG Strix G18 G815LR; Node v24.22.1, npm 11.19.1. Physical Wi-Fi IPv4 `192.168.31.172/24`, network Public, firewall enabled.
- Final core results: 8 PASS, 0 final FAIL, 0 final NOT VERIFIED. Initial failed/timed-out attempts and transitional observations remain in this report and are not erased by the final outcomes.
- Physical Mac discovery: observed automatically on retry. The first 120.114-second attempt found no peer; the user-requested retry discovered Mac-Aaron within 30.032 seconds.
- Safe/TCP: observed locally for both required private-message directions, with the expected incoming payload saved once and the outgoing payload acknowledged normally.
- Auto/LRDT: explicitly observed for both required private-message directions. W4 initially showed TCP fallback, then passed after one ordinary pause/reconnect. W5 passed with LRDT selected and normal delivery ACK.
- Group messaging: both expected members visible; Mac payload saved once; Windows payload delivered 1/1 in the same group UUID. Two separately created groups shared the test display name; their distinct IDs were recorded and the tested ID was used for both messages.
- Restart/persistent identity: same Windows UUID and database incarnation, all six pre-restart messages retained, dynamically assigned endpoints changed, Mac reconnected. The user separately confirmed Mac recognized the same Windows UUID. The first recorded post-restart link used TCP fallback in Auto mode.
- Peer-assisted recovery: Windows/Bob retained ten distinct Alice messages exactly once. The Mac-Charlie agent directly confirmed the required offline sequence and ten-message exact-once recovery from Bob, with timestamped relay/sync evidence received in LANChat PM and cross-checked against Bob's data.
- Remaining ambiguity/limits: initial discovery delay and observed Auto-mode fallback causes were not diagnosed or patched. Mac-side internals are attributed to the separately received report; Windows did not independently access Mac disk/UI. These results establish the observed functional scenarios on these physical hosts, not throughput, broader network compatibility, or every possible restart/transport timing.
- Validation completed; no optional fallback simulation or benchmark was requested or performed. Existing profiles, groups, history, screenshots, and evidence remain available for review.

## Limits

The active Wi-Fi is Public; the test document recommends a trusted Private network and application permission for LANChat/Electron. The firewall was enabled. Neither firewall blocking, access-point isolation, remote application state, nor a routing issue has been demonstrated. No Mac-side success is inferred.

No fallback simulation or benchmark was performed.
