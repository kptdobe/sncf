#!/usr/bin/env node
// Collect delay observations for the two daily commute trains and store them as
// one JSON file per ISO week under docs/data/.
//
// Usage:
//   node src/collect.js [options] [dates...]
//
// Options:
//   -x          Execute: actually write the JSON files. Without it, dry-run.
//   -b N        Backfill the last N days (ending today). SNCF only retains
//               realized delays ~2 days, so N > 2 mostly yields on-time data.
//   -w          Include weekends (default: weekdays only).
//   -h          Show this help.
//
// Dates are "YYYY-MM-DD". With no dates and no -b, defaults to today (Europe/Paris).
//
// Requires SNCF_API_TOKEN (read from the environment or a local .env file).

import processQueue from '@adobe/helix-shared-process-queue';
import { TRAINS } from './config.js';
import { fetchJourneys } from './sncf.js';
import { buildObservation, selectCompleted } from './observe.js';
import {
  navitiaDay, isoWeekKey, isWeekday, dateRange, addDays,
} from './datetime.js';
import { readWeek, writeWeek, mergeObservations, writeManifest } from './storage.js';

function parisToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

/** Current Europe/Paris time as a local "YYYY-MM-DDTHH:MM:SS" string. */
function parisNowIso() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

function parseArgs(argv) {
  const opts = { execute: false, weekends: false, backfill: 0, dates: [], help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-x') opts.execute = true;
    else if (a === '-w') opts.weekends = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-b') { opts.backfill = Number(argv[i + 1]); i += 1; }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(a)) opts.dates.push(a);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function resolveDates(opts) {
  const set = new Set(opts.dates);
  if (opts.backfill > 0) {
    const today = parisToday();
    for (const d of dateRange(addDays(today, -(opts.backfill - 1)), today)) set.add(d);
  }
  if (set.size === 0) set.add(parisToday());
  let dates = [...set].sort();
  if (!opts.weekends) dates = dates.filter(isWeekday);
  return dates;
}

async function collectOne(token, date, train) {
  const datetime = `${navitiaDay(date)}T${train.scheduledDeparture.replace(':', '')}00`;
  const [baseJourneys, realtimeJourneys] = await Promise.all([
    fetchJourneys({ token, fromId: train.fromId, toId: train.toId, datetime, freshness: 'base_schedule' }),
    fetchJourneys({ token, fromId: train.fromId, toId: train.toId, datetime, freshness: 'realtime' }),
  ]);
  return buildObservation({ train, date, baseJourneys, realtimeJourneys });
}

function describe(o) {
  const arr = o.cancelled ? 'CANCELLED' : `${o.actualArrival?.slice(11, 16)} (${o.arrivalDelay >= 0 ? '+' : ''}${o.arrivalDelay} min)`;
  return `${o.date} ${o.weekday.padEnd(9)} ${o.period.padEnd(7)} ${o.label} ${o.direction}  arr ${o.scheduledArrival.slice(11, 16)} -> ${arr}`;
}

const HELP = `Collect Sierentz <-> Basel SBB delay observations into docs/data/<week>.json

Usage: node src/collect.js [options] [dates...]

  -x          Execute: write the JSON files (default is dry-run).
  -b N        Backfill the last N days ending today (SNCF retains ~2 days).
  -w          Include weekends (default: weekdays only).
  -h          Show this help.

Dates are "YYYY-MM-DD". With no dates and no -b, defaults to today (Europe/Paris).
Requires SNCF_API_TOKEN (environment or local .env).`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return; }
  try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env, use environment */ }
  const token = process.env.SNCF_API_TOKEN;
  if (!token) throw new Error('SNCF_API_TOKEN is not set (see .env.example).');

  const dates = resolveDates(opts);
  const tasks = [];
  for (const date of dates) for (const train of TRAINS) tasks.push({ date, train });

  const collected = [];
  await processQueue(tasks, async ({ date, train }) => {
    const obs = await collectOne(token, date, train);
    if (obs) collected.push(obs);
  }, 5);

  // Drop trains that have not completed their journey yet (their delay is not real).
  const observations = selectCompleted(collected, parisNowIso());
  const skipped = collected.length - observations.length;
  if (skipped > 0) console.log(`(skipping ${skipped} train(s) that have not run yet)`);

  observations.sort((a, b) => (a.scheduledDeparture < b.scheduledDeparture ? -1 : 1));

  console.log(`\nCollected ${observations.length} observation(s) over ${dates.length} day(s):\n`);
  for (const o of observations) console.log(`  ${describe(o)}`);

  if (!opts.execute) {
    console.log('\n(dry-run) Nothing written. Re-run with -x to persist.\n');
    return;
  }

  const byWeek = new Map();
  for (const o of observations) {
    const wk = isoWeekKey(o.date);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push(o);
  }
  for (const [wk, incoming] of byWeek) {
    const existing = await readWeek(wk);
    const merged = mergeObservations(existing.observations || [], incoming);
    await writeWeek(wk, { week: wk, observations: merged });
    console.log(`  wrote docs/data/${wk}.json (${merged.length} total)`);
  }
  const manifest = await writeManifest();
  console.log(`\nWrote manifest: ${manifest.weeks.length} week(s), ${manifest.observationCount} observation(s).\n`);
}

main().catch((err) => { console.error(`Error: ${err.message}`); process.exit(1); });
