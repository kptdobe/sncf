// Persistence: one JSON file per ISO week under docs/data/ (so GitHub Pages
// serves them directly), plus a manifest the dashboard reads first.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../docs/data/', import.meta.url));

/**
 * Merge incoming observations into existing ones, replacing any with the same
 * (date, trainId) and sorting chronologically by scheduled departure. Pure.
 */
export function mergeObservations(existing, incoming) {
  const byKey = new Map();
  for (const o of [...existing, ...incoming]) byKey.set(`${o.date}:${o.trainId}`, o);
  const key = (o) => o.scheduledDeparture || `${o.date}T${o.label || ''}`;
  return [...byKey.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.trainId < b.trainId ? -1 : 1;
  });
}

export function weekFilePath(weekKey) {
  return `${DATA_DIR}${weekKey}.json`;
}

export async function readWeek(weekKey) {
  try {
    return JSON.parse(await readFile(weekFilePath(weekKey), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { week: weekKey, observations: [] };
    throw err;
  }
}

export async function writeWeek(weekKey, weekObj) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(weekFilePath(weekKey), `${JSON.stringify(weekObj, null, 2)}\n`);
}

/** Rebuild docs/data/manifest.json from the week files on disk. */
export async function writeManifest() {
  await mkdir(DATA_DIR, { recursive: true });
  const files = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f));
  files.sort();
  let observationCount = 0;
  for (const f of files) {
    const wk = JSON.parse(await readFile(`${DATA_DIR}${f}`, 'utf8'));
    observationCount += (wk.observations || []).length;
  }
  const manifest = {
    weeks: files.map((f) => f.replace('.json', '')),
    observationCount,
    lastUpdated: new Date().toISOString(),
  };
  await writeFile(`${DATA_DIR}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
