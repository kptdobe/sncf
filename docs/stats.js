// Pure statistics + presentation helpers. Imported by both the dashboard
// (in the browser) and the unit tests (in Node). No DOM, no I/O.

// Contractual conformity threshold for line L1 (Mulhouse–Bâle, our line):
// 5 min 59 s. We floor delays to whole minutes, so a train is "non-conforming"
// (late, in the contractual sense) at >= 6 min, or if cancelled. The other 10
// Grand Est zones use 2'59" (=> 3 min) — change here if tracking another line.
export const LATE_THRESHOLD = 6;

/**
 * Classify a row for colour-coding.
 * @returns {'cancelled'|'late-heavy'|'late-light'|'ontime'}
 */
export function rowCategory(obs) {
  if (obs.cancelled) return 'cancelled';
  const d = obs.arrivalDelay;
  if (d == null) return 'ontime';
  if (d >= LATE_THRESHOLD) return 'late-heavy';
  if (d >= 1) return 'late-light';
  return 'ontime';
}

/**
 * Group observations by individual train and rank them most-reliable first
 * (fewest disruptions, then lowest average delay). Used to advise which of the
 * morning / evening departures to take. Returns an array of
 * { trainId, label, period, direction, scheduledArrival, stats }.
 */
export function classifyByTrain(observations) {
  const groups = new Map();
  for (const o of observations) {
    if (!groups.has(o.trainId)) {
      groups.set(o.trainId, {
        trainId: o.trainId,
        label: o.label,
        period: o.period,
        direction: o.direction,
        scheduledArrival: o.scheduledArrival,
        observations: [],
      });
    }
    groups.get(o.trainId).observations.push(o);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, stats: computeStats(g.observations) }))
    .sort((a, b) => a.stats.pctSeriouslyDisrupted - b.stats.pctSeriouslyDisrupted
      || a.stats.averageDelay - b.stats.averageDelay
      || (a.label < b.label ? -1 : 1));
}

const positive = (d) => (typeof d === 'number' && d > 0 ? d : 0);

/**
 * Aggregate delay statistics over a list of observations.
 * "Accumulated delay" sums only positive arrival delays (early trains count 0).
 * Conformity follows the contract: a train is conforming if it ran and arrived
 * less than LATE_THRESHOLD minutes late.
 */
export function computeStats(observations) {
  const total = observations.length;
  const cancelled = observations.filter((o) => o.cancelled).length;
  const ran = observations.filter((o) => !o.cancelled);
  const ranCount = ran.length;

  const delays = ran.map((o) => positive(o.arrivalDelay));
  const accumulatedDelay = delays.reduce((a, b) => a + b, 0);
  const late = ran.filter((o) => o.arrivalDelay >= 1).length;
  const lateMajor = ran.filter((o) => o.arrivalDelay >= LATE_THRESHOLD).length;
  const lateMinor = late - lateMajor;
  const onTime = ranCount - late;
  // Contractual "conforme": ran AND arrived < threshold late.
  const conforming = ranCount - lateMajor;

  let worst = null;
  for (const o of ran) {
    if (worst === null || (o.arrivalDelay ?? 0) > (worst.arrivalDelay ?? 0)) worst = o;
  }

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return {
    total,
    cancelled,
    ran: ranCount,
    onTime,
    late,
    lateMajor,
    lateMinor,
    conforming,
    accumulatedDelay,
    averageDelay: ranCount > 0 ? Math.round((accumulatedDelay / ranCount) * 10) / 10 : 0,
    maxDelay: worst ? worst.arrivalDelay : 0,
    worst,
    // Mutually-exclusive buckets as a share of all observed trains; these four
    // (on time / late <thr / late ≥thr / cancelled) sum to ~100%.
    pctOnTime: pct(onTime, total),
    pctLateMinor: pct(lateMinor, total),
    pctLateMajor: pct(lateMajor, total),
    pctCancelled: pct(cancelled, total),
    pctLate: pct(late, total),
    // Contractual conformity rate (our sample): not late ≥threshold and not cancelled.
    pctConformity: pct(conforming, total),
    // "not on time as planned" = any late or cancelled, over all scheduled trains.
    pctDisrupted: pct(late + cancelled, total),
    // Non-conforming = ≥threshold late OR cancelled. Drives the ranking.
    pctSeriouslyDisrupted: pct(lateMajor + cancelled, total),
  };
}

/**
 * Group observations that have a known cause by that cause string.
 * Returns entries sorted by count descending.
 * @returns {Array<{cause:string, count:number, cancelled:number, delayed:number}>}
 */
export function causeBreakdown(observations) {
  const map = new Map();
  for (const o of observations) {
    if (!o.cause) continue;
    if (!map.has(o.cause)) map.set(o.cause, { cause: o.cause, count: 0, cancelled: 0, delayed: 0 });
    const entry = map.get(o.cause);
    entry.count += 1;
    if (o.cancelled) entry.cancelled += 1;
    else entry.delayed += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
