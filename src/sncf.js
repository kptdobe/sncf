// SNCF (Navitia) API client.
//
// We use the `journeys` endpoint constrained to direct trips
// (max_nb_transfers=0). A single realtime journey response carries BOTH the
// scheduled (`base_*`) and realtime times for every stop, plus a journey-level
// `status` (e.g. "SIGNIFICANT_DELAYS", "NO_SERVICE" for a cancellation).

import { API_BASE } from './config.js';

/**
 * Reduce a raw Navitia /journeys response to the fields we care about.
 * Pure function — unit tested against real API fixtures.
 *
 * @returns {Array<{train:string,status:string,cause:string|null,
 *   origin:{name:string,baseDeparture:string,departure:string},
 *   destination:{name:string,baseArrival:string,arrival:string}}>}
 */
export function parseJourneysResponse(json) {
  // Build a Map from disruption id to human-readable cause text.
  const disruptions = (json && json.disruptions) || [];
  const causeMap = new Map();
  for (const d of disruptions) {
    if (d.id && d.messages && d.messages[0] && d.messages[0].text) {
      causeMap.set(d.id, d.messages[0].text);
    }
  }

  const journeys = (json && json.journeys) || [];
  const out = [];
  for (const journey of journeys) {
    const ptSections = (journey.sections || []).filter((s) => s.type === 'public_transport');
    if (ptSections.length === 0) continue;
    const first = ptSections[0];
    const last = ptSections[ptSections.length - 1];
    const di = first.display_informations || {};
    const originStop = first.stop_date_times[0];
    const destStop = last.stop_date_times[last.stop_date_times.length - 1];

    // Look for a disruption link in display_informations.links (delayed trains) or
    // section.links with type=disruption (cancelled/NO_SERVICE trains).
    const disruptionLink = (di.links || []).find((l) => l.rel === 'disruptions')
      || (first.links || []).find((l) => l.type === 'disruption');
    const cause = (disruptionLink && causeMap.get(disruptionLink.id)) || null;

    out.push({
      train: [di.commercial_mode, di.headsign].filter(Boolean).join(' ') || di.label || '',
      status: journey.status || '',
      cause,
      origin: {
        name: originStop.stop_point.name,
        baseDeparture: originStop.base_departure_date_time || '',
        departure: originStop.departure_date_time || '',
      },
      destination: {
        name: destStop.stop_point.name,
        baseArrival: destStop.base_arrival_date_time || '',
        arrival: destStop.arrival_date_time || '',
      },
    });
  }
  return out;
}

/** HTTP Basic auth header: token as username, empty password. */
export function authHeader(token) {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

/**
 * Fetch direct journeys between two stop areas at a given datetime.
 * Retries up to `retries` times on transient errors (network failures, 401, 5xx).
 * @returns simplified journeys (see parseJourneysResponse). Empty array if the
 *   date is outside the API's rolling window.
 */
export async function fetchJourneys({
  token, fromId, toId, datetime, freshness = 'realtime', fetchImpl = fetch,
  retries = 2, retryDelayMs = 1000, onRawResponse = null,
}) {
  const params = new URLSearchParams({
    from: fromId,
    to: toId,
    datetime,
    data_freshness: freshness,
    max_nb_transfers: '0',
    count: '3',
    disable_geojson: 'true',
  });

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
      console.warn(`[sncf] retry ${attempt}/${retries} (${freshness} at ${datetime})`);
    }
    try {
      const res = await fetchImpl(`${API_BASE}/journeys?${params}`, {
        headers: { Authorization: authHeader(token) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error && body.error.id === 'date_out_of_bounds') return [];
        throw new Error(`SNCF API ${res.status}: ${body.error ? body.error.message : res.statusText}`);
      }
      const json = await res.json();
      if (onRawResponse) onRawResponse(json);
      return parseJourneysResponse(json);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
