import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, rowCategory } from '../docs/stats.js';

const obs = (over = {}) => ({ cancelled: false, arrivalDelay: 0, ...over });

test('rowCategory classifies by delay and cancellation', () => {
  assert.equal(rowCategory(obs({ cancelled: true })), 'cancelled');
  assert.equal(rowCategory(obs({ arrivalDelay: 12 })), 'late-heavy');
  assert.equal(rowCategory(obs({ arrivalDelay: 5 })), 'late-heavy');
  assert.equal(rowCategory(obs({ arrivalDelay: 4 })), 'late-light');
  assert.equal(rowCategory(obs({ arrivalDelay: 1 })), 'late-light');
  assert.equal(rowCategory(obs({ arrivalDelay: 0 })), 'ontime');
  assert.equal(rowCategory(obs({ arrivalDelay: -2 })), 'ontime');
  assert.equal(rowCategory(obs({ cancelled: true, arrivalDelay: null })), 'cancelled');
});

test('computeStats aggregates a mixed week', () => {
  const data = [
    obs({ arrivalDelay: 0 }),       // on time
    obs({ arrivalDelay: 3 }),       // late <5
    obs({ arrivalDelay: 20 }),      // late >=5
    obs({ arrivalDelay: 7 }),       // late >=5
    obs({ cancelled: true, arrivalDelay: null }),
  ];
  const s = computeStats(data);
  assert.equal(s.total, 5);
  assert.equal(s.cancelled, 1);
  assert.equal(s.ran, 4);
  assert.equal(s.onTime, 1);
  assert.equal(s.late, 3);
  assert.equal(s.late5, 2);
  assert.equal(s.lateUnder5, 1);
  assert.equal(s.accumulatedDelay, 30); // 0+3+20+7
  assert.equal(s.averageDelay, 7.5);    // 30/4
  assert.equal(s.maxDelay, 20);
  // Buckets as a share of all 5 observed trains (sum to 100%).
  assert.equal(s.pctOnTime, 20);        // 1/5
  assert.equal(s.pctLateUnder5, 20);    // 1/5 (the +3 min)
  assert.equal(s.pctLate5, 40);         // 2/5 (the +20 and +7)
  assert.equal(s.pctCancelled, 20);     // 1/5
  assert.equal(s.pctOnTime + s.pctLateUnder5 + s.pctLate5 + s.pctCancelled, 100);
  assert.equal(s.pctDisrupted, 80);     // (3 late + 1 cancelled)/5
});

test('computeStats handles an empty dataset without dividing by zero', () => {
  const s = computeStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.averageDelay, 0);
  assert.equal(s.pctLate, 0);
  assert.equal(s.worst, null);
});

test('accumulatedDelay ignores early arrivals', () => {
  const s = computeStats([obs({ arrivalDelay: -3 }), obs({ arrivalDelay: 4 })]);
  assert.equal(s.accumulatedDelay, 4);
});
