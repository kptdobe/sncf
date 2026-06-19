import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readRunStatus, recordRun } from '../src/run-status.js';

const tmpFile = () => join(tmpdir(), `run-status-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

test('readRunStatus returns empty state when file does not exist', async () => {
  const result = await readRunStatus(join(tmpdir(), 'nonexistent-sncf-test-xyz.json'));
  assert.deepEqual(result, { runs: [], lastSuccessAt: null, lastFailedAt: null });
});

test('recordRun writes a success entry with observations and dates', async () => {
  const file = tmpFile();
  const result = await recordRun({ status: 'success', observations: 3, dates: ['2026-06-19'], statusFile: file });
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].status, 'success');
  assert.equal(result.runs[0].observations, 3);
  assert.deepEqual(result.runs[0].dates, ['2026-06-19']);
  assert.ok(result.lastSuccessAt);
  assert.equal(result.lastFailedAt, null);
});

test('recordRun writes a failed entry with error message', async () => {
  const file = tmpFile();
  const result = await recordRun({ status: 'failed', error: 'SNCF API 401: Unauthorized', statusFile: file });
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].status, 'failed');
  assert.equal(result.runs[0].error, 'SNCF API 401: Unauthorized');
  assert.equal(result.lastSuccessAt, null);
  assert.ok(result.lastFailedAt);
});

test('recordRun prepends new entries and retains lastSuccessAt across a failure', async () => {
  const file = tmpFile();
  await recordRun({ status: 'success', observations: 2, statusFile: file });
  const after = await recordRun({ status: 'failed', error: 'oops', statusFile: file });
  assert.equal(after.runs.length, 2);
  assert.equal(after.runs[0].status, 'failed');
  assert.equal(after.runs[1].status, 'success');
  assert.ok(after.lastSuccessAt, 'lastSuccessAt should be retained after a failure');
  assert.ok(after.lastFailedAt);
});

test('recordRun retains lastFailedAt across a success', async () => {
  const file = tmpFile();
  await recordRun({ status: 'failed', error: 'bad', statusFile: file });
  const after = await recordRun({ status: 'success', observations: 1, statusFile: file });
  assert.ok(after.lastSuccessAt);
  assert.ok(after.lastFailedAt, 'lastFailedAt should be retained after a success');
});

test('recordRun prunes history to 20 entries', async () => {
  const file = tmpFile();
  for (let i = 0; i < 25; i++) {
    await recordRun({ status: 'success', observations: i, statusFile: file });
  }
  const result = await readRunStatus(file);
  assert.equal(result.runs.length, 20);
  // Most recent entry should be first (observations = 24).
  assert.equal(result.runs[0].observations, 24);
});
