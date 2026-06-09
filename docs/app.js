// Cache-bust the module import so a redeploy of stats.js is picked up
// immediately (ES module imports are otherwise cached aggressively).
const { computeStats, rowCategory, classifyByTrain } = await import(`./stats.js?v=${Date.now()}`);

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
      <li>on time: <b>${s.onTime}</b> (${s.pctOnTime}%)</li>
      <li>late &lt; 5 min: <b>${s.lateUnder5}</b> (${s.pctLateUnder5}%)</li>
      <li>late ≥ 5 min: <b>${s.late5}</b> (${s.pctLate5}%)</li>
      <li>cancelled: <b>${s.cancelled}</b> (${s.pctCancelled}%)</li>
      <li><b>${s.accumulatedDelay}</b> min accumulated · <b>${s.averageDelay}</b> avg · worst <b>${s.maxDelay}</b></li>
    </ul>
  </div>`;
}

function renderStats(observations) {
  const morning = observations.filter((o) => o.period === 'morning');
  const evening = observations.filter((o) => o.period === 'evening');
  document.getElementById('stats').innerHTML = [
    statCard('All trains', computeStats(observations)),
    statCard('Morning → Basel SBB', computeStats(morning)),
    statCard('Evening → Sierentz', computeStats(evening)),
  ].join('');
}

function rankingTable(title, rows) {
  if (rows.length === 0) return `<div class="rank-card"><h3>${title}</h3><p class="hint">No data yet.</p></div>`;
  const body = rows.map((r, i) => {
    const s = r.stats;
    const arr = r.scheduledArrival ? r.scheduledArrival.slice(11, 16) : '';
    return `<tr class="${i === 0 ? 'recommended' : ''}">
      <td>${i === 0 ? '★' : i + 1}</td>
      <td><b>${r.label}</b> → ${arr}</td>
      <td>${s.total}</td>
      <td>${s.pctOnTime}%</td>
      <td>${s.pctLate}%</td>
      <td>${s.pctLate5}%</td>
      <td>${s.pctCancelled}%</td>
      <td>${s.averageDelay}</td>
      <td>${s.maxDelay}</td>
    </tr>`;
  }).join('');
  return `<div class="rank-card"><h3>${title}</h3>
    <table class="rank">
      <thead><tr><th>#</th><th>Train</th><th>Days</th><th>On&nbsp;time</th><th>Late</th><th>≥5&nbsp;min</th><th>Cancel</th><th>Avg</th><th>Worst</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

function renderRanking(observations) {
  const morning = classifyByTrain(observations.filter((o) => o.period === 'morning'));
  const evening = classifyByTrain(observations.filter((o) => o.period === 'evening'));
  document.getElementById('ranking').innerHTML = rankingTable('Morning → Basel SBB', morning)
    + rankingTable('Evening → Sierentz', evening);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function renderTable(observations) {
  document.getElementById('rows').innerHTML = observations.map((o) => `
    <tr class="${rowCategory(o)}">
      <td>${o.date}</td><td>${o.weekday}</td>
      <td>${cap(o.period)}</td><td>${o.direction}</td><td>${o.trainNumber || '—'}</td>
      <td>${time(o.scheduledDeparture)}</td><td>${time(o.actualDeparture)}</td>
      <td>${time(o.scheduledArrival)}</td><td>${time(o.actualArrival)}</td>
      <td class="delay">${delayLabel(o)}</td>
    </tr>`).join('');
}

async function main() {
  try {
    const { observations, manifest } = await loadObservations();
    renderStats(observations);
    renderRanking(observations);
    renderTable(observations);
    const updated = manifest.lastUpdated ? new Date(manifest.lastUpdated).toLocaleString() : 'unknown';
    document.getElementById('meta').textContent = `${observations.length} observations · last updated ${updated}`;
  } catch (err) {
    document.getElementById('rows').innerHTML = `<tr><td colspan="10">Failed to load data: ${err.message}</td></tr>`;
  }
}

main();
