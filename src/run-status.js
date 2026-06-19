// Tracks the outcome of each collect run in docs/data/run-status.json.
// The dashboard reads this file to display the last success / failure badge.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA_DIR = fileURLToPath(new URL('../docs/data/', import.meta.url));
export const STATUS_FILE = `${DATA_DIR}run-status.json`;
const MAX_RUNS = 20;

export async function readRunStatus(statusFile = STATUS_FILE) {
  try {
    return JSON.parse(await readFile(statusFile, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { runs: [], lastSuccessAt: null, lastFailedAt: null };
    throw err;
  }
}

/**
 * Prepend a run entry and persist. Trims the history to MAX_RUNS.
 * @param {{ status: 'success'|'failed', observations?: number, dates?: string[], error?: string, statusFile?: string }} opts
 */
export async function recordRun({ status, observations, dates, error, statusFile = STATUS_FILE }) {
  const existing = await readRunStatus(statusFile);
  const timestamp = new Date().toISOString();
  const entry = { timestamp, status };
  if (status === 'success') {
    entry.observations = observations;
    if (dates) entry.dates = dates;
  }
  if (error) entry.error = error;

  const runs = [entry, ...existing.runs].slice(0, MAX_RUNS);
  const lastSuccessAt = status === 'success' ? timestamp : existing.lastSuccessAt;
  const lastFailedAt = status === 'failed' ? timestamp : existing.lastFailedAt;

  const statusObj = { runs, lastSuccessAt, lastFailedAt };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(statusFile, `${JSON.stringify(statusObj, null, 2)}\n`);
  return statusObj;
}
