# LRDT v1 transport design

LANChat now offers two transport paths. TCP remains the compatibility baseline; LRDT demonstrates reliability and congestion mechanisms over UDP. LRDT is an educational implementation, not a claim of novelty or a production replacement for TCP.

```text
React Settings: Auto / Safe / Custom
                 |
Messages / Groups / SQLite / Sync / LCP
                 |
          Transport Manager
          /              \
 TCP (baseline/control)  LRDT (application frames)
          |              |
         TCP            UDP
          +------ IP ----+
```

## Selection and capabilities

Fresh profiles default to `auto`. `safe` always chooses TCP. `custom` and Auto prefer LRDT when both peers advertise compatible LRDT v1. The name Custom replaces the proposed Speed label because measured performance does not support that claim. Both non-Safe modes use the same policy today.

| Local / Remote | Safe | Auto | Custom |
| --- | --- | --- | --- |
| Safe | TCP | TCP | TCP |
| Auto | TCP | LRDT, TCP fallback | LRDT, TCP fallback |
| Custom | TCP | LRDT, TCP fallback | LRDT, TCP fallback |

A peer without compatible capabilities uses TCP. Discovery keeps `tcpPort` and optionally adds `capabilities: {version: 1, port, priority}`. Unknown fields are stripped; malformed/unsupported capability fields become absent while valid base discovery remains usable. To accommodate the original strict discovery schema, a legacy datagram is also advertised. Legacy advertisements do not erase a capability previously observed during this manager lifetime. The TCP HELLO format is unchanged. Extended TCP control messages are sent only to capability-advertising peers.

The existing canonical TCP connection (lower UUID dials) is retained as a control/liveness/fallback channel even when LRDT carries LCP. This deliberately does not implement a UDP-only application. Negotiation controls are `LRDT_START {session, port}` and `LRDT_FALLBACK`. Each source IP is bound to the established TCP route; discovery is used for the UDP port, not permanent identity. This avoids interface/loopback address ambiguity. TCP already confirms the peer UUID and LCP version; a random session UUID transferred over that connection binds the UDP handshake to that peer and endpoint. It is not cryptographic authentication.

The smaller UUID initiates. The responder prepares the offered session, the initiator repeats UDP HELLO every 150 ms, and the responder sends HELLO_ACK. Duplicate HELLOs receive another response. Known LRDT-capable connections defer application activation until handshake success or fallback. Legacy/unknown-capability connections can initially activate TCP and upgrade after discovery; therefore diagnostics at completion alone should not be interpreted as proof that every earlier frame used LRDT.

Handshake and deferred application-activation deadline: 1.5 seconds, including asymmetric capability loss where the initiator never offers LRDT. Failure notifies the other peer via TCP; both latch TCP for that connection, preventing negotiation loops. Runtime LRDT failure also falls back. Mode changes are persisted and serialize a complete network stop/start with fresh discovery endpoints/sessions. Conversations, pending rows, and identity remain intact. Changing a name does not reset mode. A mode change or later TCP reconnect permits a new attempt. `--network-priority speed` is a development alias for Custom; visible UI labels are Auto/Safe/Custom.

## Binary datagrams

Maximum UDP datagram: **1,200 bytes**, with a **40-byte big-endian header**, leaving 1,160 bytes of payload. No intended IP fragmentation on ordinary Ethernet/Wi-Fi MTUs (tunnels with lower MTUs still require physical testing).

| Offset | Bytes | Field |
| --- | --- | --- |
| 0 | 4 | ASCII `LRDT` magic |
| 4 | 1 | Version = 1 |
| 5 | 1 | Type: DATA=1, ACK=2, HELLO=3, HELLO_ACK=4 |
| 6 | 2 | Reserved, zero |
| 8 | 16 | Session UUID bytes |
| 24 | 4 | DATA sequence or individual ACK number |
| 28 | 4 | Frame number |
| 32 | 2 | Zero-based fragment index |
| 34 | 2 | Fragment count |
| 36 | 2 | Payload byte length |
| 38 | 2 | Reserved, zero |
| 40 | variable | Payload |

Control packets have no payload or fragment/frame fields. HELLO packets use sequence zero. ACKs require a nonzero sequence. Strict decoding checks magic/version/type/length/reserved fields and fragment structure. Bad packets are ignored locally. LCP remains its existing validated, length-prefixed JSON, including over LRDT; reassembly delivers complete encoded LCP frames to the same decoder.

## Reliable ordering and fragmentation

Each direction starts DATA sequence and frame number at one. Frames up to 256 KiB + four framing bytes are fragmented into datagrams. The receiver selectively ACKs accepted segments immediately, including duplicate old segments. ACK **N means only segment N**, never all segments through N. Out-of-order segments are buffered (128-segment receive window). Segments beyond the receive window are dropped without ACK. Duplicate segments are ACKed but never delivered again. Contiguous sequence order feeds frame reassembly; the upper layer receives complete frames in order, exactly once within a healthy session.

Reassembly checks frame number, fragment index/count consistency and total byte size. At most one contiguous incomplete frame plus 128 reordered datagrams is retained per session; stalled fragment progress expires after 15 seconds and fails the session rather than skipping an ordered frame. Progress refreshes the deadline, permitting large frames to complete under loss. Packet fragment counts are bounded. At most 256 transport peers exist, bounding aggregate reassembly state to approximately 101 MiB of payload in the worst case. Per-peer outbound queued/unacknowledged payload is capped at 2 MiB; application pending state remains in SQLite when the transport refuses more data.

Sequence/frame counters are unsigned 32-bit integers. The session fails before wraparound rather than comparing wrapped values. Four billion packets per direction per session is well beyond intended classroom use; application retry plus TCP fallback handles exhaustion.

## Selective Repeat and windows

The sender tracks each unacknowledged segment's payload, original sequence, send time, and retransmission count. Only expired unacknowledged segments are retransmitted; a received selective ACK removes only that entry. Sending capacity is `min(configured window, floor(cwnd))`, and the next sequence must also stay inside the window relative to the oldest unacknowledged sequence. This latter bound prevents a hole from overflowing the receiver while later packets are ACKed.

Configured window range is 1–128, default 32. Window one is the stop-and-wait experimental baseline. There is no fast retransmit; loss recovery is RTO-based. Seven retransmissions are allowed per segment; the next expiry fails the session. Connection backpressure returns false to the engine; SQLite/application retry supplies durability across transport failure.

## RTT and adaptive RTO

Initial RTO is 200 ms. First eligible sample initializes SRTT and RTTVAR to RTT and RTT/2. Later samples use:

```text
RTTVAR = .75 * RTTVAR + .25 * abs(old SRTT - sample)
SRTT   = .875 * old SRTT + .125 * sample
RTO    = clamp(SRTT + 4 * RTTVAR, 60 ms, 3000 ms)
```

Samples from retransmitted segments are excluded (Karn rule). Per-segment timeout backs off exponentially with retry count, capped at 3 seconds. Timers use monotonic `performance.now()`, not wall clock. The estimator follows the approach described in [RFC 6298](https://www.rfc-editor.org/rfc/rfc6298), with deliberately different LAN/class-project minimum and initial RTO values; this is not RFC compliance.

## Congestion control

Initial cwnd is min(2, configured window); initial ssthresh is 16 segments. Each newly acknowledged segment adds one segment while cwnd < ssthresh (slow start), otherwise adds 1/cwnd (additive congestion avoidance). Cwnd is capped by the configured window. On a timer tick with loss, set ssthresh=max(2,cwnd/2), reset cwnd=1, and retransmit only expired segments. Multiple expired segments in one tick trigger one decrease. Existing in-flight packets remain outstanding after a decrease. There is no pacing, ECN, fairness proof, receive-window advertisement, or full Reno implementation. The trace exposes loss events, retransmissions, cwnd, ssthresh, SRTT, and RTO.

## Failure, stale sessions and two ACK layers

Endpoint + random session UUID must match. A session is prepared only through TCP negotiation; unsolicited UDP cannot create one. Reconnection uses a fresh UUID. Retired UUIDs are rejected with a bounded 1,024-entry cache; unknown session data is always ignored. TCP loss drops LRDT too. LRDT also has a 12-second receive-idle failure check; manager sends reliable LCP PING every four seconds to keep idle sessions active. TCP fallback is latched until reconnect; retransmission exhaustion, handshake failure, fragment expiry, and idle failure all feed it.

```text
LRDT DATA segment -> receive/reorder buffer -> LRDT ACK
                       |
                 reassembled LCP
                       |
              validate + SQLite commit
                       |
                 LCP application ACK
                       |
                 chat delivered state
```

LRDT ACKs never touch SQLite pending-delivery rows. Transport failure may leave a frame partly delivered; the existing immutable message ID and application retry deduplicate it on TCP. Group metadata and history requests are refreshed by the existing periodic sync. No transport ACK is a read receipt or proof of persistence.

## Metrics, impairment and verification

Per-session counters cover sent/received packets/bytes, ACKs, retransmissions, duplicates, reordering, fragments, completed frames, cwnd/peak, ssthresh, SRTT/RTO, peak in-flight and reorder buffers, and loss events. Snapshot peer diagnostics expose selected transport, fallback status, stats, and manager failure/fallback counts. Structured logs report selection and fallback. Metrics are session-local and may disappear on teardown; exported benchmark results retain measured data.

The isolated impairment scheduler uses a seeded LCG and supports loss, duplication, extra reordering delay, base delay and jitter in both directions. Production impairment is disabled. Tests/benchmarks can pass `EngineOptions.lrdt` or instantiate the production session with a virtual clock. Simulation does not emulate Wi-Fi contention or an OS congestion stack.

## Limitations and next validation

No encryption, identity authentication, transport integrity beyond UDP/IP checksums, congestion fairness proof, selective-ACK ranges, fast retransmit, migration, or automatic MTU probing. TCP is required even for an LRDT pair. Mode changes reconnect all peers rather than migrate sessions. Capability-advertisement loss can cause temporary TCP use. Real-network loss testing is limited to blocked UDP and real loopback; detailed seeded loss/reordering experiments run the production session in virtual time. Windows, cross-device Wi-Fi, low-MTU tunnels, sleep/wake, and firewall behavior are untested. Windows must permit discovery UDP 45878, the dynamic LRDT UDP port, and the dynamic TCP control/fallback port. Read LRDT_EVALUATION.md before making performance claims.
