import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeObservations } from '../src/storage.js';

const o = (date, trainId, extra = {}) => ({ date, trainId, ...extra });

test('mergeObservations replaces same (date, trainId) with the incoming value', () => {
  const existing = [o('2026-06-09', 'morning', { arrivalDelay: 5 })];
  const incoming = [o('2026-06-09', 'morning', { arrivalDelay: 20 })];
  const merged = mergeObservations(existing, incoming);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].arrivalDelay, 20);
});

test('mergeObservations sorts by date then morning-before-evening', () => {
  const merged = mergeObservations(
    [o('2026-06-10', 'evening'), o('2026-06-09', 'evening')],
    [o('2026-06-09', 'morning'), o('2026-06-10', 'morning')],
  );
  assert.deepEqual(
    merged.map((x) => `${x.date}:${x.trainId}`),
    ['2026-06-09:morning', '2026-06-09:evening', '2026-06-10:morning', '2026-06-10:evening'],
  );
});

test('mergeObservations keeps distinct days and trains', () => {
  const merged = mergeObservations([], [o('2026-06-09', 'morning'), o('2026-06-09', 'evening')]);
  assert.equal(merged.length, 2);
});
