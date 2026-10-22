export interface NetworkImpairment {
    lossRate?: number;
    duplicateRate?: number;
    reorderRate?: number;
    baseDelayMs?: number;
    jitterMs?: number;
    seed?: number;
}
/** Seeded transmission scheduling. The caller owns timers or a simulated clock. */
export function impairment(config: NetworkImpairment = {}) {
    let seed = config.seed ?? 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const rate of [config.lossRate, config.duplicateRate, config.reorderRate])
        if (rate !== undefined && (rate < 0 || rate > 1 || !Number.isFinite(rate)))
            throw new Error('Invalid impairment rate');
    for (const delay of [config.baseDelayMs, config.jitterMs])
        if (delay !== undefined && (!Number.isFinite(delay) || delay < 0 || delay > 10000))
            throw new Error('Invalid impairment delay');
    return (bytes: Buffer, schedule: (bytes: Buffer, delay: number) => void) => {
        if (random() < (config.lossRate ?? 0))
            return;
        const delay = Math.max(0, (config.baseDelayMs ?? 0) + (random() * 2 - 1) * (config.jitterMs ?? 0)) + (random() < (config.reorderRate ?? 0) ? 30 : 0);
        schedule(bytes, delay);
        if (random() < (config.duplicateRate ?? 0))
            schedule(bytes, delay + 1);
    };
}
