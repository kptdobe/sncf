import { computeStats, rowCategory } from './stats.js';

async function loadObservations() {
  const manifest = await fetch(`./data/manifest.json?t=${Date.now()}`).then((r) => r.json());
  const weeks = await Promise.all(
    manifest.weeks.map((w) => fetch(`./data/${w}.json?t=${Date.now()}`).then((r) => r.json())),
  );
  const observations = weeks.flatMap((w) => w.observations || []);
  // Newest first.
  observations.sort((a, b) => (a.scheduledDeparture < b.scheduledDeparture ? 1 : -1));
  return { observations, manifest };
}

const time = (iso) => (iso ? iso.slice(11, 16) : '—');

function delayLabel(o) {
  if (o.cancelled) return 'Cancelled';
  if (o.arrivalDelay == null) return '—';
  return `${o.arrivalDelay > 0 ? '+' : ''}${o.arrivalDelay} min`;
}

function statCard(title, s) {
  return `<div class="card">
    <h3>${title}</h3>
    <div class="big">${s.pctDisrupted}%</div>
    <div class="sub">not on time as scheduled</div>
    <ul>
      <li><b>${s.total}</b> trains observed</li>
      <li><b>${s.late}</b> late (${s.pctLate}%) · <b>${s.late5}</b> by ≥5 min</li>
      <li><b>${s.cancelled}</b> cancelled (${s.pctCancelled}%)</li>
      <li><b>${s.accumulatedDelay}</b> min accumulated delay</li>
      <li><b>${s.averageDelay}</b> min average · worst <b>${s.maxDelay}</b> min</li>
    </ul>
  </div>`;
}

function renderStats(observations) {
  const morning = observations.filter((o) => o.trainId === 'morning');
  const evening = observations.filter((o) => o.trainId === 'evening');
  document.getElementById('stats').innerHTML = [
    statCard('All trains', computeStats(observations)),
    statCard('Morning → Basel SBB', computeStats(morning)),
    statCard('Evening → Sierentz', computeStats(evening)),
  ].join('');
}

function renderTable(observations) {
  document.getElementById('rows').innerHTML = observations.map((o) => `
    <tr class="${rowCategory(o)}">
      <td>${o.date}</td><td>${o.weekday}</td>
      <td>${o.label}</td><td>${o.direction}</td>
      <td>${time(o.scheduledDeparture)}</td><td>${time(o.actualDeparture)}</td>
      <td>${time(o.scheduledArrival)}</td><td>${time(o.actualArrival)}</td>
      <td class="delay">${delayLabel(o)}</td>
    </tr>`).join('');
}

async function main() {
  try {
    const { observations, manifest } = await loadObservations();
    renderStats(observations);
    renderTable(observations);
    const updated = manifest.lastUpdated ? new Date(manifest.lastUpdated).toLocaleString() : 'unknown';
    document.getElementById('meta').textContent = `${observations.length} observations · last updated ${updated}`;
  } catch (err) {
    document.getElementById('rows').innerHTML = `<tr><td colspan="9">Failed to load data: ${err.message}</td></tr>`;
  }
}

main();
