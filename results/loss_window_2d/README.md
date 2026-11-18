# LRDT packet loss and sliding-window experiment

## Objective

This factorial experiment measures how per-datagram loss probability and maximum send-window size jointly affect LRDT transfer completion and retransmissions in the LANChat virtual-time model.

## Experimental setup

| Parameter | Setting |
| --- | --- |
| Per-datagram loss probability | 0%, 1%, 5%, 10%, 20% |
| Configured maximum send window | 1, 4, 8, 16, 32 segments |
| Repetitions | Three per condition, forward seeds 100, 101, 102 |
| Reverse seeds | Forward seed + 100, yielding 200, 201, 202 |
| Payload | One 131,072-byte frame (128 KiB) |
| Base delay | 10 model ms in each direction (20 model ms round trip) |
| Jitter, duplication, additional reordering delay | Disabled |
| Model clock and trial limit | 1 ms scheduling increments; 120,000 model ms maximum |
| Total workload | 25 conditions, 75 trials |

The existing scheduler runs two production `ReliableSession` instances. The forward DATA stream and reverse ACK stream use separate instances of the existing seeded impairment function. Each datagram, including a retransmission, is eligible for loss according to its direction's pseudorandom stream. The session's production congestion control, timeout, retry-limit, and reassembly logic are used directly. A trial completes when the receiver has delivered exactly one byte-identical frame and the sender has no queued or outstanding segments. Session failures or expiration of the simulation limit are retained as trial outcomes. Model milliseconds are simulated clock time.

The earlier A experiment in `docs/LRDT_EVALUATION.md` varied loss at a fixed window of 32 with **5 ms one-way delay**. The earlier B experiment varied window size at zero loss with **10 ms one-way delay**. This factorial experiment uses **10 ms one-way delay in every cell** and is analyzed independently of A. At 0% loss, its five completion means agree with B's recorded values.

## Metrics and results

Every cell succeeded in **3/3 trials**, for **75/75 successful trials (100%)**. There were no simulation timeouts, retry-limit failures, or other unsuccessful trials. Individual completion times ranged from 180 to 17,320 model ms. Cell means ranged from 180 to 12,260 model ms.

Mean completion time in model ms, rounded to one decimal. Columns are configured window sizes in segments.

| Loss | 1 | 4 | 8 | 16 | 32 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0% | 2,260.0 | 580.0 | 320.0 | 200.0 | 180.0 |
| 1% | 2,360.0 | 720.0 | 440.0 | 326.7 | 286.7 |
| 5% | 3,540.0 | 1,813.3 | 1,500.0 | 1,073.3 | 1,006.7 |
| 10% | 4,640.0 | 2,480.0 | 2,513.3 | 1,780.0 | 1,653.3 |
| 20% | 12,260.0 | 5,453.3 | 6,400.0 | 6,933.3 | 6,786.7 |

Each trial contributes to the success rate and the mean number of sender DATA retransmissions. The arithmetic mean and sample standard deviation of completion time use successful trials only. With zero successes, both time statistics are unavailable. With one success, only the standard deviation is unavailable. JSON records unavailable values as `null`; CSV uses empty fields. A failed trial retains its model stop time, failure reason, and endpoint counters separately from its unavailable completion time. Counters describe activity observed by each endpoint; the retransmission count is a sender counter, not a count of dropped datagrams.

1. Mean completion time increased with loss at every tested window. At window 32 it rose from 180.0 model ms without loss to 6,786.7 model ms at 20% loss.
2. Window 32 gave the shortest observed mean at each tested loss level from 0% through 10%. Without loss, increasing the window from 1 to 4 reduced the mean from 2,260.0 to 580.0 model ms, whereas increasing it from 16 to 32 reduced it from 200.0 to 180.0.
3. At 20% loss, window 4 gave the shortest observed mean (5,453.3 model ms), compared with 6,786.7 at window 32 and 12,260.0 at window 1. Window 4's three trials ranged from 3,960 to 6,780 model ms, overlapping window 32's 5,300–9,260 range. The ranking describes these three seeds per condition.
4. Mean sender retransmissions were the same across the five windows at each tested loss level. They rose from 0.0 without loss to 1.7, 18.7, 30.7, and 72.0 at 1%, 5%, 10%, and 20%, respectively. Completion time still varied across windows at each of those loss levels.

## Reproduction

The immutable LANChat base revision is `42f08ab74772435baa56a0d06322c31c3ac0ff0f`. This run used the benchmark extension supplied with the bundle atop that revision. Production LRDT files match the base revision. The experiment was executed on 18 November 2026 with Node.js 25.2.1; the raw JSON records its UTC timestamp.

From the repository root, with the locked npm dependencies installed and Python 3.10+ with Matplotlib 3.10.7 and NumPy 1.26.4:

```sh
node --import tsx scripts/benchmarks/loss-window-2d.ts --source-revision "$(git rev-parse HEAD)"
python3 scripts/benchmarks/plot-loss-window-2d.py
```

Use the runner's `--output` argument and the plotter's `--summary` and `--output` arguments to regenerate into another directory. The archive's `reproduction/README.md` describes standalone execution using the packaged source subset and npm lockfile. Its `verification/` directory records the commands, outcomes, runtime environment, and source revisions.

## Report integration

Add a subsection titled “Joint Effect of Packet Loss and Sliding-Window Size” after “Sliding-Window Performance” and before “Congestion-Control Behavior” in the Evaluation section. Copy the vector figure into `paper/figure/` and use a full-width `figure*` for legible cell annotations. Add a separate row to the evaluation setup table for the factorial sweep and its fixed 10 ms one-way delay.

**Suggested caption.** Mean LRDT completion time for one 128 KiB transfer under a factorial sweep of per-datagram packet loss and configured maximum send window. The virtual-time model uses a fixed 10 ms one-way delay and separate seeded impairment streams for DATA and ACK traffic. Each cell shows the mean of three successful trials in model milliseconds (75/75 overall). Color follows a logarithmic scale; annotations give completion times on the original scale.

The bundle includes the current complete, unedited LaTeX sources from the workspace's report repository at `c6b8f28fd009001beff994ab5c01397f1d12f712` under `report_source/`. This includes the bibliography, ACL styles, number macros, and all figures referenced by `main.tex`. The copy compiled independently with `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex` (19 pages). The new heatmap is supplied separately for insertion.
