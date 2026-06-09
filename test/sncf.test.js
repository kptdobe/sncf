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
