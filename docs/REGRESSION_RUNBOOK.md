# Regression runbook

Run these checks after changing dependencies or transport code, and before a project demonstration. Commands run from the repository root and require Node.js 24 or newer. Record the revision, environment and command output for each run.

## Automated checks

Install the locked dependency set with `npm ci`, then run in order:

```sh
npm run typecheck
npm test
npm run test:lrdt
npm run build
npm run test:desktop
npm run test:desktop -- --blocked-lrdt
```

Stop and retain output if a command fails. Desktop checks require a working graphical Electron environment; networking tests require permission to bind local UDP/TCP. If Electron cannot launch because no display is available, record the desktop check as BLOCKED. `npm run benchmark` is optional measurement, not a replacement for correctness checks; it writes result files, so retain existing measurements before rerunning it.

## Physical regression checklist

Use independent profiles on a trusted shared LAN. Record which machine observes each outcome. Profiles A and C may share one Mac, so record both the profile count and physical host count.

| Case | Action | Acceptance criterion |
| --- | --- | --- |
| Discovery | Start peers without manually entering endpoints | Both peers become visible; log timeout/retry and selected transport |
| Safe mode | Set both endpoints to Safe; send a unique PM each way | TCP selected; one saved copy per payload; sender reports delivery |
| Auto mode | Set Auto and send new unique payloads both ways | LRDT use corroborated by logs; any initial fallback/reconnect recorded |
| Group | Create a group containing A, B and C; send once from each | Intended recipients receive one copy and expected ACK counts |
| Restart | Close and reopen B using the same profile | UUID/history retained; reconnection works even if port changes |
| Secondary recovery | Pause C; send ten tagged group messages A→B; verify B retains all ten; pause A; reconnect C | C recovers exactly ten unique messages from B while A remains offline |
| Pending delivery | Pause recipient; send PM; reopen recipient | Queued payload eventually persists once and sender obtains application ACK |
| Room lifecycle | Leave a group or exercise a temporary room deadline | New sends rejected when inactive; retained history remains readable |

For LRDT cases, check the transport logs as well as delivery status. For recovery, retain the synchronization response path and final message count.

## Result template

```text
Revision:
Date / time zone:
Hosts / OS versions:
Node / Electron versions:
Profiles and transport settings:
Case / command:
Expected:
Observed:
Result: NOT RUN / PASS / FAIL / BLOCKED
Evidence location:
Retry or workaround:
```

Use isolated disposable profiles for regression. Do not delete an ordinary user's database to reset a test.
