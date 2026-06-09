import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObservation } from '../src/observe.js';
import { TRAINS } from '../src/config.js';

const MORNING = TRAINS.find((t) => t.id === 'morning');
const nav = (hhmm) => `20260609T${hhmm.replace(':', '')}00`;

// Build a simplified journey in the shape parseJourneysResponse returns.
function sj({
  dep = '07:32', depRt, arr = '07:50', arrRt, status = '', train = 'FLUO 96109',
  origin = 'Sierentz', dest = 'Basel SBB',
} = {}) {
  return {
    train,
    status,
    origin: { name: origin, baseDeparture: nav(dep), departure: nav(depRt ?? dep) },
    destination: { name: dest, baseArrival: nav(arr), arrival: nav(arrRt ?? arr) },
  };
}

test('delayed train: computes departure and arrival delay', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj({ depRt: '07:52', arrRt: '08:10', status: 'SIGNIFICANT_DELAYS' })],
  });
  assert.equal(obs.cancelled, false);
  assert.equal(obs.departureDelay, 20);
  assert.equal(obs.arrivalDelay, 20);
  assert.equal(obs.scheduledArrival, '2026-06-09T07:50:00');
  assert.equal(obs.actualArrival, '2026-06-09T08:10:00');
  assert.equal(obs.weekday, 'Tuesday');
  assert.equal(obs.direction, 'Sierentz → Basel SBB');
  assert.equal(obs.status, 'SIGNIFICANT_DELAYS');
});

test('on-time train: zero delay, not cancelled', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj()],
  });
  assert.equal(obs.cancelled, false);
  assert.equal(obs.arrivalDelay, 0);
  assert.equal(obs.departureDelay, 0);
});

test('cancelled (train absent from realtime → only a later train returned)', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj({ dep: '08:02', arr: '08:20', train: 'FLUO 96111' })],
  });
  assert.equal(obs.cancelled, true);
  assert.equal(obs.status, 'NO_SERVICE');
  assert.equal(obs.arrivalDelay, null);
  assert.equal(obs.actualArrival, null);
  // scheduled times still come from the theoretical schedule
  assert.equal(obs.scheduledArrival, '2026-06-09T07:50:00');
});

test('cancelled (realtime reports NO_SERVICE for the train)', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj({ status: 'NO_SERVICE' })],
  });
  assert.equal(obs.cancelled, true);
  assert.equal(obs.arrivalDelay, null);
});

test('not scheduled that day → no observation', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-07',
    baseJourneys: [],
    realtimeJourneys: [],
  });
  assert.equal(obs, null);
});
