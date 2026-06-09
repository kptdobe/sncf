// Pure statistics + presentation helpers. Imported by both the dashboard
// (in the browser) and the unit tests (in Node). No DOM, no I/O.

/**
 * Classify a row for colour-coding.
 * @returns {'cancelled'|'late-heavy'|'late-light'|'ontime'}
 */
export function rowCategory(obs) {
  if (obs.cancelled) return 'cancelled';
  const d = obs.arrivalDelay;
  if (d == null) return 'ontime';
  if (d >= 5) return 'late-heavy';
  if (d >= 1) return 'late-light';
  return 'ontime';
}

const positive = (d) => (typeof d === 'number' && d > 0 ? d : 0);

/**
 * Aggregate delay statistics over a list of observations.
 * "Accumulated delay" sums only positive arrival delays (early trains count 0).
 */
export function computeStats(observations) {
  const total = observations.length;
  const cancelled = observations.filter((o) => o.cancelled).length;
  const ran = observations.filter((o) => !o.cancelled);
  const ranCount = ran.length;

  const delays = ran.map((o) => positive(o.arrivalDelay));
  const accumulatedDelay = delays.reduce((a, b) => a + b, 0);
  const late = ran.filter((o) => o.arrivalDelay >= 1).length;
  const late5 = ran.filter((o) => o.arrivalDelay >= 5).length;
  const onTime = ranCount - late;

  let worst = null;
  for (const o of ran) {
    if (worst === null || (o.arrivalDelay ?? 0) > (worst.arrivalDelay ?? 0)) worst = o;
  }

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  return {
    total,
    cancelled,
    ran: ranCount,
    onTime,
    late,
    late5,
    accumulatedDelay,
    averageDelay: ranCount > 0 ? Math.round((accumulatedDelay / ranCount) * 10) / 10 : 0,
    maxDelay: worst ? worst.arrivalDelay : 0,
    worst,
    pctCancelled: pct(cancelled, total),
    pctLate: pct(late, ranCount),
    pctLate5: pct(late5, ranCount),
    pctOnTime: pct(onTime, ranCount),
    // "not on time as planned" = late or cancelled, over all scheduled trains
    pctDisrupted: pct(late + cancelled, total),
  };
}
