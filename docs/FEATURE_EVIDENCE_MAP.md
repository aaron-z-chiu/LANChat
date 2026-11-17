# Feature and evidence map

This index links LANChat features to their implementation, tests and recorded results. It does not record a new test run.

| Capability | Implementation | Automated coverage | Recorded evidence |
| --- | --- | --- | --- |
| IPv4 peer discovery | `src/core/discovery.ts` | `tests/network.test.ts` | `results/physical_cross_platform_windows.md`, DISC-01 (passed on retry) |
| TCP identity, framing and reconnect | `src/core/transport.ts`, `src/core/protocol.ts` | `tests/network.test.ts`, `tests/protocol.test.ts` | Same record, SAFE-M2W-001 and SAFE-W2M-001 |
| Reliable UDP data path | `src/core/lrdt/session.ts`, `src/core/lrdt/packet.ts`, `src/core/lrdt/transport.ts` | `tests/lrdt.test.ts` | `docs/LRDT_EVALUATION.md`, sections A–D |
| Transport selection and fallback | `src/core/transport-manager.ts` | `tests/dual-transport.test.ts` | `docs/LRDT_EVALUATION.md`, E–G; physical AUTO scenarios |
| Durable identity, messages and ACK state | `src/core/store.ts`, `src/core/engine.ts` | `tests/store.test.ts`, `tests/engine.test.ts` | Physical RESTART-01 |
| Group state and secondary-peer recovery | `src/core/store.ts`, `src/core/engine.ts` | `tests/store.test.ts`, `tests/network.test.ts` | Physical GROUP-01 and RECOVERY-01 |
| Desktop isolation and user flows | `src/desktop/preload.ts`, `src/desktop/main.ts`, `src/ui/main.tsx` | `scripts/smoke.mjs` | `docs/desktop-smoke.png`; physical records |
| Windows, macOS and Ubuntu automated checks | `.github/workflows/ci-checks.yml` | Each platform workflow calls the shared typecheck, test, LRDT test and build steps | Check the three README badges for hosted results |

## Reading older status notes

`docs/IMPLEMENTATION_STATUS.md` contains a dated 22 October baseline. Its statements that Windows physical validation and CI are absent do not describe all files in this archive: later physical records and a workflow are included. For Windows validation, refer to the physical test records listed above.

The 22 October LRDT evaluation's single-machine scope applies to that experiment. The later physical tests verify functionality; the published timing results still describe the original single-machine experiments.

## Evidence boundaries

- A test file establishes available coverage, not a passing run on every machine.
- DISC-01 passed on retry; Auto reception required an ordinary reconnect. Both observations are recorded in the Windows validation log.
- Physical RECOVERY-01 combines local Windows retention evidence with attributed Mac-side confirmation.
- Two physical hosts and three profiles are not three physical devices.
- Modeled datagram loss through 20% is not a measured Wi-Fi loss tolerance guarantee.
- Transport ACK confirms segment receipt; application ACK follows message persistence. Neither is a read receipt.
