import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseJourneysResponse, authHeader } from '../src/sncf.js';

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('parseJourneysResponse extracts origin/destination from a real realtime response', async () => {
  const journeys = parseJourneysResponse(await fixture('morning-realtime.json'));
  assert.ok(journeys.length >= 1);
  const j = journeys[0];
  assert.equal(j.origin.name, 'Sierentz');
  assert.equal(j.origin.baseDeparture, '20260609T073200');
  assert.equal(j.origin.departure, '20260609T075200');
  assert.equal(j.destination.name, 'Basel SBB');
  assert.equal(j.destination.baseArrival, '20260609T075000');
  assert.equal(j.destination.arrival, '20260609T081000');
  assert.equal(j.status, 'SIGNIFICANT_DELAYS');
  assert.match(j.train, /96109/);
  assert.equal(j.cause, 'Réutilisation d\'un train');
});

test('parseJourneysResponse on base schedule has equal base/realtime times', async () => {
  const journeys = parseJourneysResponse(await fixture('morning-base.json'));
  const j = journeys.find((x) => x.origin.baseDeparture === '20260609T073200');
  assert.ok(j, 'expected the 07:32 train in base schedule');
  assert.equal(j.origin.baseDeparture, j.origin.departure);
});

test('parseJourneysResponse tolerates empty/missing input', () => {
  assert.deepEqual(parseJourneysResponse({}), []);
  assert.deepEqual(parseJourneysResponse({ journeys: [] }), []);
  assert.deepEqual(parseJourneysResponse(null), []);
});

test('authHeader builds Basic auth with empty password', () => {
  assert.equal(authHeader('mytoken'), `Basic ${Buffer.from('mytoken:').toString('base64')}`);
});

// fetchJourneys retry behaviour

const { fetchJourneys } = await import('../src/sncf.js');

test('fetchJourneys succeeds on first attempt without retrying', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ journeys: [] }) };
  };
  const result = await fetchJourneys({ token: 't', fromId: 'a', toId: 'b', datetime: 'd', fetchImpl, retryDelayMs: 0 });
  assert.deepEqual(result, []);
  assert.equal(calls, 1);
});

test('fetchJourneys retries on error and succeeds on third attempt', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) throw new Error('transient network error');
    return { ok: true, json: async () => ({ journeys: [] }) };
  };
  const result = await fetchJourneys({ token: 't', fromId: 'a', toId: 'b', datetime: 'd', fetchImpl, retryDelayMs: 0 });
  assert.deepEqual(result, []);
  assert.equal(calls, 3);
});

test('fetchJourneys fails after exhausting all retries', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('always fails'); };
  await assert.rejects(
    () => fetchJourneys({ token: 't', fromId: 'a', toId: 'b', datetime: 'd', fetchImpl, retries: 2, retryDelayMs: 0 }),
    /always fails/,
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});

test('fetchJourneys does not retry date_out_of_bounds', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { id: 'date_out_of_bounds', message: 'out of bounds' } }),
    };
  };
  const result = await fetchJourneys({ token: 't', fromId: 'a', toId: 'b', datetime: 'd', fetchImpl, retries: 2, retryDelayMs: 0 });
  assert.deepEqual(result, []);
  assert.equal(calls, 1);
});

test('parseJourneysResponse returns null cause for on-time journey without disruption link', async () => {
  const journeys = parseJourneysResponse(await fixture('morning-realtime.json'));
  const onTime = journeys.find((j) => j.status === '');
  assert.ok(onTime, 'expected an on-time journey');
  assert.equal(onTime.cause, null);
});

test('parseJourneysResponse returns null cause when disruptions array is absent', () => {
  const json = { journeys: [{ sections: [], status: '' }] };
  const result = parseJourneysResponse(json);
  assert.deepEqual(result, []); // no pt sections → skipped
});

test('parseJourneysResponse extracts cause for NO_SERVICE journey via section.links', async () => {
  const journeys = parseJourneysResponse(await fixture('evening-cancelled.json'));
  assert.equal(journeys.length, 1);
  const j = journeys[0];
  assert.equal(j.status, 'NO_SERVICE');
  assert.equal(j.cause, 'Travaux sur la voie');
});
