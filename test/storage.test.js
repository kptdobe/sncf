import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeObservations } from '../src/storage.js';

const o = (date, trainId, dep, extra = {}) => ({
  date, trainId, scheduledDeparture: `${date}T${dep}:00`, ...extra,
});

test('mergeObservations replaces same (date, trainId) with the incoming value', () => {
  const existing = [o('2026-06-09', 'm0732', '07:32', { arrivalDelay: 5 })];
  const incoming = [o('2026-06-09', 'm0732', '07:32', { arrivalDelay: 20 })];
  const merged = mergeObservations(existing, incoming);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].arrivalDelay, 20);
});

test('mergeObservations sorts by date then scheduled departure', () => {
  const merged = mergeObservations(
    [o('2026-06-10', 'e1738', '17:38'), o('2026-06-09', 'e1738', '17:38')],
    [o('2026-06-09', 'm0702', '07:02'), o('2026-06-10', 'm0732', '07:32')],
  );
  assert.deepEqual(
    merged.map((x) => `${x.date}:${x.trainId}`),
    ['2026-06-09:m0702', '2026-06-09:e1738', '2026-06-10:m0732', '2026-06-10:e1738'],
  );
});

test('mergeObservations keeps distinct days and trains', () => {
  const merged = mergeObservations([], [o('2026-06-09', 'm0732', '07:32'), o('2026-06-09', 'e1738', '17:38')]);
  assert.equal(merged.length, 2);
});
