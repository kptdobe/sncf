import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObservation, selectCompleted } from '../src/observe.js';
import { TRAINS } from '../src/config.js';

const MORNING = TRAINS.find((t) => t.id === 'm0732');
const nav = (hhmm) => `20260609T${hhmm.replace(':', '')}00`;

// Build a simplified journey in the shape parseJourneysResponse returns.
function sj({
  dep = '07:32', depRt, arr = '07:50', arrRt, status = '', train = 'FLUO 96109',
  origin = 'Sierentz', dest = 'Basel SBB', cause = null,
} = {}) {
  return {
    train,
    status,
    cause,
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
  assert.equal(obs.period, 'morning');
  assert.equal(obs.label, '07:32');
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

test('selectCompleted drops trains that have not arrived yet', () => {
  const data = [
    { trainId: 'morning', scheduledArrival: '2026-06-09T07:50:00' },
    { trainId: 'evening', scheduledArrival: '2026-06-09T17:56:00' },
  ];
  // At 10:00 the morning train has arrived but the evening one has not.
  const kept = selectCompleted(data, '2026-06-09T10:00:00');
  assert.deepEqual(kept.map((o) => o.trainId), ['morning']);
  // After both have arrived, keep both.
  assert.equal(selectCompleted(data, '2026-06-09T20:00:00').length, 2);
  // Before either, keep none.
  assert.equal(selectCompleted(data, '2026-06-09T06:00:00').length, 0);
});

test('train absent from both schedules is cancelled with configured times', () => {
  const obs = buildObservation({
    train: TRAINS.find((t) => t.id === 'm0802'),
    date: '2026-11-05',
    baseJourneys: [],
    realtimeJourneys: [],
  });
  assert.deepEqual(obs, {
    date: '2026-11-05',
    weekday: 'Thursday',
    trainId: 'm0802',
    period: 'morning',
    label: '08:02',
    direction: 'Sierentz → Basel SBB',
    origin: 'Sierentz',
    destination: 'Basel SBB',
    trainNumber: null,
    scheduledDeparture: '2026-11-05T08:02:00',
    scheduledArrival: '2026-11-05T08:20:00',
    actualDeparture: null,
    actualArrival: null,
    departureDelay: null,
    arrivalDelay: null,
    cancelled: true,
    status: 'NO_SERVICE',
    cause: null,
  });
});

test('only other trains returned → missing configured train is cancelled', () => {
  const laterTrain = sj({ dep: '08:02', arr: '08:20', train: 'FLUO 96111' });
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [laterTrain],
    realtimeJourneys: [laterTrain],
  });
  assert.equal(obs.cancelled, true);
  assert.equal(obs.trainNumber, null);
  assert.equal(obs.scheduledDeparture, '2026-06-09T07:32:00');
  assert.equal(obs.scheduledArrival, '2026-06-09T07:50:00');
});

test('realtime data is retained when the theoretical schedule is absent', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [],
    realtimeJourneys: [sj({
      depRt: '07:52', arr: '07:55', arrRt: '08:15', status: 'SIGNIFICANT_DELAYS',
    })],
  });
  assert.equal(obs.cancelled, false);
  assert.equal(obs.trainNumber, 'FLUO 96109');
  assert.equal(obs.scheduledDeparture, '2026-06-09T07:32:00');
  assert.equal(obs.scheduledArrival, '2026-06-09T07:55:00');
  assert.equal(obs.actualArrival, '2026-06-09T08:15:00');
  assert.equal(obs.departureDelay, 20);
  assert.equal(obs.arrivalDelay, 20);
});

test('NO_SERVICE is cancelled even without a theoretical schedule', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [],
    realtimeJourneys: [sj({ status: 'NO_SERVICE', cause: 'Travaux sur la voie' })],
  });
  assert.equal(obs.cancelled, true);
  assert.equal(obs.status, 'NO_SERVICE');
  assert.equal(obs.cause, 'Travaux sur la voie');
  assert.equal(obs.scheduledArrival, '2026-06-09T07:50:00');
  assert.equal(obs.actualArrival, null);
});

test('missing train cancellations are excluded until scheduled arrival', () => {
  const observations = TRAINS.map((train) => buildObservation({
    train,
    date: '2026-06-09',
    baseJourneys: [],
    realtimeJourneys: [],
  }));
  assert.ok(observations.every((obs) => obs.cancelled));
  assert.equal(selectCompleted(observations, '2026-06-09T07:19:59').length, 0);
  assert.deepEqual(
    selectCompleted(observations, '2026-06-09T08:49:59').map((obs) => obs.trainId),
    ['m0702', 'm0732', 'm0802'],
  );
  assert.deepEqual(
    selectCompleted(observations, '2026-06-09T08:50:00').map((obs) => obs.trainId),
    ['m0702', 'm0732', 'm0802', 'm0832'],
  );
  assert.equal(selectCompleted(observations, '2026-06-09T18:56:00').length, TRAINS.length);
});

test('cause is propagated from realtime journey to observation', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj({ depRt: '07:52', arrRt: '08:10', status: 'SIGNIFICANT_DELAYS', cause: 'Réutilisation d\'un train' })],
  });
  assert.equal(obs.cause, 'Réutilisation d\'un train');
});

test('cause is null for on-time train', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [sj()],
  });
  assert.equal(obs.cause, null);
});

test('cause is null when train is absent from realtime (cancelled)', () => {
  const obs = buildObservation({
    train: MORNING,
    date: '2026-06-09',
    baseJourneys: [sj()],
    realtimeJourneys: [],
  });
  assert.equal(obs.cancelled, true);
  assert.equal(obs.cause, null);
});
