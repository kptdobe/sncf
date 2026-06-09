// Pure business logic: turn scheduled + realtime journeys into one observation.
//
// Cancellation handling:
//  - If the train is absent from the *base* (theoretical) schedule for that
//    day, it simply does not run (weekend / holiday): we emit no observation.
//  - If it is scheduled but absent from realtime, or realtime reports the
//    journey-level status "NO_SERVICE", it was cancelled.

import {
  delayMinutes, toIso, hhmm, weekdayName,
} from './datetime.js';

function matchByDeparture(journeys, scheduledHHMM) {
  return journeys.find((j) => hhmm(j.origin.baseDeparture) === scheduledHHMM) || null;
}

/**
 * @param {object} args
 * @param {object} args.train       one entry from config TRAINS
 * @param {string} args.date        "YYYY-MM-DD"
 * @param {Array}  args.baseJourneys      parsed base_schedule journeys
 * @param {Array}  args.realtimeJourneys  parsed realtime journeys
 * @returns {object|null} observation, or null if the train does not run that day
 */
export function buildObservation({ train, date, baseJourneys, realtimeJourneys }) {
  const base = matchByDeparture(baseJourneys, train.scheduledDeparture);
  if (!base) return null; // not scheduled to run on this day

  const rt = matchByDeparture(realtimeJourneys, train.scheduledDeparture);
  const cancelled = !rt || rt.status === 'NO_SERVICE';

  const obs = {
    date,
    weekday: weekdayName(date),
    trainId: train.id,
    label: train.label,
    direction: train.direction,
    origin: train.originName,
    destination: train.destinationName,
    trainNumber: (rt || base).train,
    scheduledDeparture: toIso(base.origin.baseDeparture),
    scheduledArrival: toIso(base.destination.baseArrival),
    actualDeparture: null,
    actualArrival: null,
    departureDelay: null,
    arrivalDelay: null,
    cancelled,
    status: cancelled ? 'NO_SERVICE' : rt.status,
  };

  if (!cancelled) {
    obs.actualDeparture = toIso(rt.origin.departure);
    obs.actualArrival = toIso(rt.destination.arrival);
    obs.departureDelay = delayMinutes(rt.origin.baseDeparture, rt.origin.departure);
    obs.arrivalDelay = delayMinutes(rt.destination.baseArrival, rt.destination.arrival);
  }
  return obs;
}
