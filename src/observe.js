// Pure business logic: turn scheduled + realtime journeys into one observation.
//
// Cancellation handling:
//  - Configured trains missing from realtime, even from the theoretical
//    schedule too, are cancelled. Use configured times when both are absent.
//  - Realtime journey-level status "NO_SERVICE" also means cancelled.

import {
  delayMinutes, toIso, hhmm, weekdayName,
} from './datetime.js';

function matchByDeparture(journeys, scheduledHHMM) {
  return journeys.find((j) => hhmm(j.origin.baseDeparture) === scheduledHHMM) || null;
}

/**
 * Keep only trains whose journey is already complete, i.e. whose scheduled
 * arrival is at or before `nowLocalIso`. Both values are local
 * "YYYY-MM-DDTHH:MM:SS" strings, so a lexicographic compare is chronological.
 * Drops trains that have not run yet (their delay is not real).
 */
export function selectCompleted(observations, nowLocalIso) {
  return observations.filter((o) => o.scheduledArrival && o.scheduledArrival <= nowLocalIso);
}

/**
 * @param {object} args
 * @param {object} args.train       one entry from config TRAINS
 * @param {string} args.date        "YYYY-MM-DD"
 * @param {Array}  args.baseJourneys      parsed base_schedule journeys
 * @param {Array}  args.realtimeJourneys  parsed realtime journeys
 * @returns {object} observation
 */
export function buildObservation({ train, date, baseJourneys, realtimeJourneys }) {
  const base = matchByDeparture(baseJourneys, train.scheduledDeparture);
  const rt = matchByDeparture(realtimeJourneys, train.scheduledDeparture);
  const scheduled = base || rt;
  const cancelled = !rt || rt.status === 'NO_SERVICE';

  const obs = {
    date,
    weekday: weekdayName(date),
    trainId: train.id,
    period: train.period,
    label: train.label,
    direction: train.direction,
    origin: train.originName,
    destination: train.destinationName,
    trainNumber: (rt || base)?.train ?? null,
    scheduledDeparture: scheduled
      ? toIso(scheduled.origin.baseDeparture)
      : `${date}T${train.scheduledDeparture}:00`,
    scheduledArrival: scheduled
      ? toIso(scheduled.destination.baseArrival)
      : `${date}T${train.scheduledArrival}:00`,
    actualDeparture: null,
    actualArrival: null,
    departureDelay: null,
    arrivalDelay: null,
    cancelled,
    status: cancelled ? 'NO_SERVICE' : rt.status,
  };

  obs.cause = (rt && rt.cause) || null;

  if (!cancelled) {
    obs.actualDeparture = toIso(rt.origin.departure);
    obs.actualArrival = toIso(rt.destination.arrival);
    obs.departureDelay = delayMinutes(rt.origin.baseDeparture, rt.origin.departure);
    obs.arrivalDelay = delayMinutes(rt.destination.baseArrival, rt.destination.arrival);
  }
  return obs;
}
