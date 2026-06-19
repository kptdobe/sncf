// Cache-bust the module import so a redeploy of stats.js is picked up
// immediately (ES module imports are otherwise cached aggressively).
const { computeStats, rowCategory, classifyByTrain } = await import(`./stats.js?v=${Date.now()}`);

const PERIOD_FR = { morning: 'Matin', evening: 'Soir' };
const WEEKDAY_FR = {
  Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi',
  Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche',
};
// Direction labels in the per-period stat/ranking cards.
const TITLE_FR = { morning: 'Matin → Basel SBB', evening: 'Soir → Sierentz' };

async function loadObservations() {
  const manifest = await fetch(`./data/manifest.json?t=${Date.now()}`).then((r) => r.json());
  const [weeks, runStatus] = await Promise.all([
    Promise.all(manifest.weeks.map((w) => fetch(`./data/${w}.json?t=${Date.now()}`).then((r) => r.json()))),
    fetch(`./data/run-status.json?t=${Date.now()}`).then((r) => r.json()).catch(() => null),
  ]);
  const observations = weeks.flatMap((w) => w.observations || []);
  // Plus récent en premier.
  observations.sort((a, b) => (a.scheduledDeparture < b.scheduledDeparture ? 1 : -1));
  return { observations, manifest, runStatus };
}

const time = (iso) => (iso ? iso.slice(11, 16) : '—');

function delayLabel(o) {
  if (o.cancelled) return 'Annulé';
  if (o.arrivalDelay == null) return '—';
  const v = `${o.arrivalDelay > 0 ? '+' : ''}${o.arrivalDelay} min`;
  return o.proxy ? `${v}<span class="proxy" title="Retard au départ de Basel SBB (approximation) ; l'arrivée à Sierentz n'est pas enregistrée dans l'historique">&nbsp;≈</span>` : v;
}

function statCard(title, s) {
  return `<div class="card">
    <h3>${title}</h3>
    <div class="headline">
      <div class="stat"><div class="big">${s.pctLateMajor}%</div><div class="sub">≥ 6 min de retard</div></div>
      <div class="stat"><div class="big">${s.pctCancelled}%</div><div class="sub">annulés</div></div>
    </div>
    <ul>
      <li><b>${s.total}</b> trains · conformité <b>${s.pctConformity}%</b></li>
      <li>à l'heure : <b>${s.onTime}</b> (${s.pctOnTime}%)</li>
      <li>retard &lt; 6 min : <b>${s.lateMinor}</b> (${s.pctLateMinor}%)</li>
      <li>retard ≥ 6 min : <b>${s.lateMajor}</b> (${s.pctLateMajor}%)</li>
      <li>annulés : <b>${s.cancelled}</b> (${s.pctCancelled}%)</li>
      <li><b>${s.accumulatedDelay}</b> min cumulées · <b>${s.averageDelay}</b> moy. · pire <b>${s.maxDelay}</b></li>
    </ul>
  </div>`;
}

function renderStats(observations) {
  const morning = observations.filter((o) => o.period === 'morning');
  const evening = observations.filter((o) => o.period === 'evening');
  document.getElementById('stats').innerHTML = [
    statCard('Tous les trains', computeStats(observations)),
    statCard(TITLE_FR.morning, computeStats(morning)),
    statCard(TITLE_FR.evening, computeStats(evening)),
  ].join('');
}

function rankingTable(title, rows) {
  if (rows.length === 0) return `<div class="rank-card"><h3>${title}</h3><p class="hint">Pas encore de données.</p></div>`;
  const body = rows.map((r, i) => {
    const s = r.stats;
    const arr = r.scheduledArrival ? r.scheduledArrival.slice(11, 16) : '';
    return `<tr class="${i === 0 ? 'recommended' : ''}">
      <td>${i === 0 ? '★' : i + 1}</td>
      <td><b>${r.label}</b> → ${arr}</td>
      <td>${s.total}</td>
      <td>${s.pctOnTime}%</td>
      <td>${s.pctLate}%</td>
      <td>${s.pctLateMajor}%</td>
      <td>${s.pctCancelled}%</td>
      <td>${s.averageDelay}</td>
      <td>${s.maxDelay}</td>
    </tr>`;
  }).join('');
  return `<div class="rank-card"><h3>${title}</h3>
    <table class="rank">
      <thead><tr><th>#</th><th>Train</th><th>Jours</th><th>À&nbsp;l'heure</th><th>Retard</th><th>≥6&nbsp;min</th><th>Annulé</th><th>Moy.</th><th>Pire</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

function renderRanking(observations) {
  const morning = classifyByTrain(observations.filter((o) => o.period === 'morning'));
  const evening = classifyByTrain(observations.filter((o) => o.period === 'evening'));
  document.getElementById('ranking').innerHTML = rankingTable(TITLE_FR.morning, morning)
    + rankingTable(TITLE_FR.evening, evening);
}

function renderTable(observations) {
  document.getElementById('rows').innerHTML = observations.map((o) => `
    <tr class="${rowCategory(o)}">
      <td>${o.date}</td><td>${WEEKDAY_FR[o.weekday] || o.weekday}</td>
      <td>${PERIOD_FR[o.period] || o.period}</td><td>${o.direction}</td><td>${o.trainNumber || '—'}</td>
      <td>${time(o.scheduledDeparture)}</td><td>${time(o.actualDeparture)}</td>
      <td>${time(o.scheduledArrival)}</td><td>${time(o.actualArrival)}</td>
      <td class="delay">${delayLabel(o)}</td>
    </tr>`).join('');
}

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');

function renderRunStatus(runStatus) {
  const el = document.getElementById('run-status');
  if (!el || !runStatus) return;
  const { runs, lastSuccessAt, lastFailedAt } = runStatus;
  const last = runs && runs[0];
  if (!last) return;
  if (last.status === 'failed') {
    el.className = 'run-failed';
    const obs = lastSuccessAt ? ` · dernière réussie : ${fmt(lastSuccessAt)}` : '';
    el.innerHTML = `⚠ Collecte échouée le ${fmt(last.timestamp)}${last.error ? ` — ${last.error}` : ''}${obs}`;
  } else {
    el.className = 'run-ok';
    const failNote = lastFailedAt && lastFailedAt > lastSuccessAt ? ` · précédente échouée : ${fmt(lastFailedAt)}` : '';
    el.innerHTML = `Collecte réussie le ${fmt(lastSuccessAt)} (${last.observations} obs.)${failNote}`;
  }
}

let ALL = [];
let LAST_UPDATED = 'inconnue';

function option(value, text) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}

function populateFilters() {
  const daySel = document.getElementById('f-day');
  const periodSel = document.getElementById('f-period');
  const trainSel = document.getElementById('f-train');

  daySel.append(option('', 'Tous'));
  WEEKDAY_ORDER.filter((d) => ALL.some((o) => o.weekday === d))
    .forEach((d) => daySel.append(option(d, WEEKDAY_FR[d])));

  periodSel.append(option('', 'Toutes'), option('morning', 'Matin'), option('evening', 'Soir'));

  trainSel.append(option('', 'Tous'));
  const seen = new Map();
  for (const o of ALL) if (!seen.has(o.trainId)) seen.set(o.trainId, o);
  [...seen.values()]
    .sort((a, b) => (a.scheduledDeparture < b.scheduledDeparture ? -1 : 1))
    .forEach((o) => trainSel.append(option(o.trainId, `${o.direction} · ${o.label}`)));

  // Force a clean default (browsers may otherwise restore a prior selection on reload).
  [daySel, periodSel, trainSel].forEach((s) => { s.value = ''; s.addEventListener('change', applyFilters); });
  document.getElementById('f-reset').addEventListener('click', () => {
    daySel.value = ''; periodSel.value = ''; trainSel.value = '';
    applyFilters();
  });
}

function applyFilters() {
  const day = document.getElementById('f-day').value;
  const period = document.getElementById('f-period').value;
  const train = document.getElementById('f-train').value;
  const filtered = ALL.filter((o) => (!day || o.weekday === day)
    && (!period || o.period === period)
    && (!train || o.trainId === train));

  renderStats(filtered);
  renderRanking(filtered);
  renderTable(filtered);

  const scope = filtered.length === ALL.length ? `${ALL.length}` : `${filtered.length} / ${ALL.length}`;
  document.getElementById('meta').textContent = `${scope} observations · dernière mise à jour ${LAST_UPDATED}`;
}

async function main() {
  try {
    const { observations, manifest, runStatus } = await loadObservations();
    ALL = observations;
    LAST_UPDATED = manifest.lastUpdated
      ? new Date(manifest.lastUpdated).toLocaleString('fr-FR') : 'inconnue';
    renderRunStatus(runStatus);
    populateFilters();
    applyFilters();
  } catch (err) {
    document.getElementById('rows').innerHTML = `<tr><td colspan="10">Échec du chargement des données : ${err.message}</td></tr>`;
  }
}

main();
