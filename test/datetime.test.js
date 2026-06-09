import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNavitia, delayMinutes, toIso, hhmm, navitiaDay,
  isoWeekKey, weekdayName, isWeekday, addDays, dateRange,
} from '../src/datetime.js';

test('parseNavitia parses compact local timestamps', () => {
  const d = parseNavitia('20260609T075200');
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5); // June
  assert.equal(d.getUTCDate(), 9);
  assert.equal(d.getUTCHours(), 7);
  assert.equal(d.getUTCMinutes(), 52);
});

test('parseNavitia returns null for bad input', () => {
  assert.equal(parseNavitia(''), null);
  assert.equal(parseNavitia('2026-06-09'), null);
  assert.equal(parseNavitia(undefined), null);
});

test('delayMinutes computes the gap in minutes', () => {
  assert.equal(delayMinutes('20260609T073200', '20260609T075200'), 20);
  assert.equal(delayMinutes('20260609T173800', '20260609T174300'), 5);
  assert.equal(delayMinutes('20260609T073200', '20260609T073200'), 0);
});

test('delayMinutes handles early trains and unknowns', () => {
  assert.equal(delayMinutes('20260609T073200', '20260609T073000'), -2);
  assert.equal(delayMinutes('20260609T073200', ''), null);
  assert.equal(delayMinutes(null, '20260609T073200'), null);
});

test('delayMinutes drops seconds (within-the-minute arrival is on time)', () => {
  // 07:50:59 against a 07:50 schedule is still 0, not +1.
  assert.equal(delayMinutes('20260410T075000', '20260410T075059'), 0);
  assert.equal(delayMinutes('20260410T075000', '20260410T075100'), 1);
  assert.equal(delayMinutes('20260410T075000', '20260410T075130'), 1);
});

test('toIso and hhmm format for display', () => {
  assert.equal(toIso('20260609T075200'), '2026-06-09T07:52:00');
  assert.equal(hhmm('20260609T075200'), '07:52');
  assert.equal(toIso('nope'), null);
});

test('navitiaDay strips dashes', () => {
  assert.equal(navitiaDay('2026-06-09'), '20260609');
});

test('isoWeekKey matches ISO-8601 week numbering', () => {
  assert.equal(isoWeekKey('2026-06-09'), '2026-W24');
  assert.equal(isoWeekKey('2026-01-01'), '2026-W01'); // Thursday -> week 1
  assert.equal(isoWeekKey('2026-12-31'), '2026-W53');
});

test('weekdayName and isWeekday', () => {
  assert.equal(weekdayName('2026-06-09'), 'Tuesday');
  assert.equal(weekdayName('2026-06-07'), 'Sunday');
  assert.equal(isWeekday('2026-06-09'), true);
  assert.equal(isWeekday('2026-06-07'), false); // Sunday
  assert.equal(isWeekday('2026-06-06'), false); // Saturday
});

test('addDays and dateRange', () => {
  assert.equal(addDays('2026-06-09', 1), '2026-06-10');
  assert.equal(addDays('2026-06-01', -1), '2026-05-31');
  assert.deepEqual(dateRange('2026-06-08', '2026-06-10'), ['2026-06-08', '2026-06-09', '2026-06-10']);
});
