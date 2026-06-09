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
  const lateUnder5 = late - late5;
  const onTime = ranCount - late;

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
    late5,
    lateUnder5,
    accumulatedDelay,
    averageDelay: ranCount > 0 ? Math.round((accumulatedDelay / ranCount) * 10) / 10 : 0,
    maxDelay: worst ? worst.arrivalDelay : 0,
    worst,
    // Mutually-exclusive buckets as a share of all observed trains; these four
    // (on time / late <5 / late ≥5 / cancelled) sum to ~100%.
    pctOnTime: pct(onTime, total),
    pctLateUnder5: pct(lateUnder5, total),
    pctLate5: pct(late5, total),
    pctCancelled: pct(cancelled, total),
    pctLate: pct(late, total),
    // "not on time as planned" = late or cancelled, over all scheduled trains
    pctDisrupted: pct(late + cancelled, total),
    // the commute-ruining cases: ≥5 min late OR cancelled. Drives the ranking.
    pctSeriouslyDisrupted: pct(late5 + cancelled, total),
  };
}
