# LRDT evaluation — measured local results

## Environment and method

Measured 22 October 2026, macOS Darwin 24.6.0 arm64, Apple M2 Pro, CLI Node v25.2.1. Desktop validation used Electron 45.0.0, embedded Node 24.22.0 / Chromium 156.0.8078.48. No Windows or physical two-device Wi-Fi test was performed.

Run `npm run benchmark` or `npm run benchmark -- --repetitions 3`. The checked-in run contains **54 experiment rows**, three repetitions with deterministic seeds **100, 101, 102**, and no recorded delivery failures. Outputs are generated directly by the harness: [JSON](../results/lrdt.json), [CSV](../results/lrdt.csv), [congestion trace](../results/congestion.csv).

Experiments A–D run the **production ReliableSession** in a virtual-time two-way datagram scheduler. They do not use real UDP sockets, so reported simulation milliseconds are model time, not elapsed CPU time. Loss/duplication/reordering apply independently to DATA and ACKs. Frames are 131,072 bytes, configured window 32 unless varied. Per-case sender metrics include success, completion time, payload goodput, retransmissions, current SRTT/RTO, average/peak cwnd, and buffer peaks. The C trace is the seed-100 10%-loss case sampled every 10 model milliseconds; loss/retransmission columns are cumulative counters.

Experiments E–H use real loopback sockets and production Engines with SQLite in one Node process. The separate test:lrdt suite additionally uses independent peer processes. There is no injected OS TCP loss. TCP internal retransmission/congestion counters are unavailable; LRDT's internal counters must not be interpreted as comparable OS TCP counters. All real timing includes event loop, SQLite, JSON, and polling overhead. Polling every 10 ms makes small-message latency coarse. The real runs are sequential cases; test or OS load can affect timing. CPU deltas are whole-process values, not isolated transport CPU.

## A — Loss

Each direction has 5 ms base delay. Mean completion time and mean sender retransmissions across three seeds:

| Loss probability per datagram | Mean completion (model ms) | Mean retransmissions | Delivery |
| --- | ---: | ---: | --- |
| 0% | 90.0 | 0.0 | 3/3 |
| 1% | 173.3 | 1.7 | 3/3 |
| 5% | 710.0 | 18.7 | 3/3 |
| 10% | 1293.3 | 30.7 | 3/3 |
| 20% | 5066.7 | 72.0 | 3/3 |

Loss substantially increases completion time. This demonstrates bounded Selective Repeat recovery, not immunity to loss. Retry exhaustion remains possible with other seeds or harsher conditions and triggers TCP fallback in the real manager.

## B — Window and C — Congestion

No loss; 10 ms one-way delay. Same payload and seeds:

| Window | Mean completion (model ms) |
| --- | ---: |
| 1 | 2260 |
| 4 | 580 |
| 8 | 320 |
| 16 | 200 |
| 32 | 180 |

Pipelining reduces modeled completion time relative to stop-and-wait. Gains taper as congestion-window growth limits sending. `congestion.csv` records cwnd, ssthresh, SRTT, RTO, loss count and retransmissions over time, suitable for cwnd-vs-time plots. Automated tests explicitly assert growth and reduction under loss; the model is not evidence of fair sharing on a real link.

## D — Delay, jitter, duplication and reorder

Three seeded runs used 10 ms base delay, ±8 ms jitter, 40% probability of an additional 30 ms scheduling delay, and 20% duplication. All three delivered the complete original frame exactly once. Raw rows include observed reordering, receiver duplicate counts and peak reorder-buffer size. This covers ordering correctness under the configured model, not every adversarial schedule.

## E/F — TCP versus LRDT and user modes

One persisted small PM followed by 32 persisted PMs of 4,000 ASCII bytes each, acknowledged by the receiver. Means across three real-loopback repetitions:

| Mode | Negotiated path | Small PM completion (ms) | Bulk completion (ms) |
| --- | --- | ---: | ---: |
| Safe | TCP | 10.74 | 45.46 |
| Auto | LRDT | 10.34 | 65.44 |
| Custom | LRDT | 10.67 | 62.90 |

The small-PM differences are below the polling resolution and cannot establish a latency benefit. TCP completed the bulk workload faster. **The visible name is Custom, not Speed.** Auto and Custom currently share the same preference algorithm; timing differences between them are normal run variance. No universal performance advantage is claimed.

## G — Failure/fallback

Both peers' LRDT transmission was deliberately blocked, including handshake packets. Mean time from peer creation until TCP fallback: Auto **1513.06 ms**, Custom **1514.49 ms**. All six cases subsequently delivered and persisted a PM over TCP. Safe requires no LRDT attempt. Unit validation also treats an unsupported discovery capability version as absent, and real mode tests verify the compatibility matrix. Selective handshake-only loss, repeated real-interface outages, and large physical-firewall matrices were not separately benchmarked.

## H — Distributed recovery

Three engines create a group; Charlie disconnects; Alice sends 38 messages to Bob; Alice goes offline; Charlie reconnects and obtains missing history from Bob. Each mode ran three times. All six recovered exactly 38 messages with zero duplicates. Mean completion was TCP **1014.09 ms**, Auto/LRDT **986.95 ms**, but individual runs span roughly 0.5–2.0 seconds because discovery/reconnect scheduling dominates. This does not establish a transport speed advantage. The tests additionally assert reception of SYNC_RESPONSE over LRDT, rather than relying solely on the final selected-path label.

Legacy/unknown-capability sessions can begin on TCP and later upgrade; not every startup frame is guaranteed to use the final transport. LRDT uses a live TCP control channel, so this is not an evaluation of a UDP-only messenger. Recovery-byte overhead is not separately normalized across protocols in this harness; LRDT session counters exist, while equivalent OS TCP overhead requires packet capture or platform tooling. Physical loss/throughput/fairness testing and confidence intervals remain future work.

## Verification and limits

The standard suite preserves TCP private/group/persistence/retry/recovery coverage and adds LRDT packet, window, loss, ACK-loss, reordering, duplicate, RTO, congestion, expiry, and mode tests. The additional `npm run test:lrdt` runs the original three-process recovery scenario with Auto/LRDT and explicit selected-path assertions. Desktop smoke drives Settings to Safe and Custom and executes PM/group/reconnect/history flows, both normally and with `--blocked-lrdt`.

Seeds make the scheduler reproducible; real network and CPU timings are inherently variable. No claim of research novelty, RFC compliance, security, Windows interoperability, or LRDT superiority follows from these measurements.
