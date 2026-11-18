import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Stats } from '../../src/core/lrdt/session.js';
import config from './loss-window-config.json';
import { REVERSE_SEED_OFFSET, SIMULATION_TIMEOUT_MS, simulateWithStatus } from './simulation.js';

const { values } = parseArgs({
    options: {
        output: { type: 'string', default: 'results/loss_window_2d' },
        'source-revision': { type: 'string' },
    },
});

if (config.timeout_model_ms !== SIMULATION_TIMEOUT_MS || config.reverse_seed_offset !== REVERSE_SEED_OFFSET) {
    throw new Error('Experiment timeout or reverse seed offset does not match the shared scheduler');
}

interface Trial {
    loss_probability: number;
    max_window: number;
    seed: number;
    reverse_seed: number;
    success: boolean;
    completion_time_model_ms: number | null;
    stop_time_model_ms: number;
    retransmission_count: number;
    payload_bytes: number;
    sender_idle: boolean;
    delivered_frames: number;
    failure_reason: string | null;
    sender_statistics: Stats;
    receiver_statistics: Stats;
}

const trials: Trial[] = [];
for (const loss of config.loss_probabilities) {
    for (const window of config.max_windows) {
        for (const seed of config.seeds) {
            const { result, senderIdle, deliveredFrames } = simulateWithStatus({
                lossRate: loss,
                seed,
                baseDelayMs: config.one_way_delay_model_ms,
                jitterMs: config.jitter_model_ms,
                duplicateRate: config.duplication_probability,
                reorderRate: config.reordering_probability,
            }, window, config.payload_bytes, config.frames_per_trial);
            const {
                success: exactDelivery, completionMs, failure, received,
                trace: _trace, throughputBytesPerSecond: _throughput,
                averageCwnd: _averageCwnd, ...senderStats
            } = result;
            const success = exactDelivery && senderIdle;
            const failureReason = success ? null : failure || (
                completionMs >= SIMULATION_TIMEOUT_MS ? 'simulation timeout' : 'payload verification failed'
            );
            trials.push({
                loss_probability: loss,
                max_window: window,
                seed,
                reverse_seed: seed + config.reverse_seed_offset,
                success,
                completion_time_model_ms: success ? completionMs : null,
                stop_time_model_ms: completionMs,
                retransmission_count: senderStats.retransmissions,
                payload_bytes: config.payload_bytes,
                sender_idle: senderIdle,
                delivered_frames: deliveredFrames,
                failure_reason: failureReason,
                sender_statistics: senderStats,
                receiver_statistics: received,
            });
        }
    }
}

function mean(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const summary = config.loss_probabilities.flatMap(loss => config.max_windows.map(window => {
    const group = trials.filter(row => row.loss_probability === loss && row.max_window === window);
    if (group.length !== 3 || new Set(group.map(row => row.seed)).size !== 3) {
        throw new Error(`Expected three distinct seeds for loss=${loss}, window=${window}`);
    }
    const times = group.flatMap(row => row.completion_time_model_ms === null ? [] : [row.completion_time_model_ms]);
    const average = times.length ? mean(times) : null;
    const deviation = average !== null && times.length > 1
        ? Math.sqrt(times.reduce((sum, time) => sum + (time - average) ** 2, 0) / (times.length - 1))
        : null;
    return {
        loss_probability: loss,
        max_window: window,
        total_trials: group.length,
        successful_trials: times.length,
        success_rate: times.length / group.length,
        mean_completion_time_model_ms: average,
        std_completion_time_model_ms: deviation,
        mean_retransmissions: mean(group.map(row => row.retransmission_count)),
    };
}));
if (trials.length !== 75 || summary.length !== 25) {
    throw new Error('Expected 75 trials across 25 conditions');
}

function csv(rows: Record<string, unknown>[]) {
    const columns = Object.keys(rows[0]);
    const field = (value: unknown) => {
        const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    return [columns.join(','), ...rows.map(row => columns.map(key => field(row[key])).join(','))].join('\n') + '\n';
}

const output = values.output;
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
await mkdir(output, { recursive: true });
await Promise.all([
    writeFile(join(output, 'raw_results.csv'), csv(trials.map(row => ({ ...row })))),
    writeFile(join(output, 'summary.csv'), csv(summary)),
    writeFile(join(output, 'raw_results.json'), json({
        configuration: config,
        source_git_commit: values['source-revision'] ?? null,
        execution: { utc_timestamp: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch },
        trials,
    })),
    writeFile(join(output, 'summary.json'), json({
        completion_time_statistics: 'Successful trials only; standard deviation is sample SD (null for fewer than two successes).',
        retransmission_statistics: 'Sender DATA retransmissions averaged across all trials, including failures.',
        conditions: summary,
    })),
]);
console.log(`Executed ${trials.length} trials in ${summary.length} conditions: ${trials.filter(row => row.success).length} succeeded. Results: ${output}`);
