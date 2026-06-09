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
 * @returns {Array<{train:string,status:string,
 *   origin:{name:string,baseDeparture:string,departure:string},
 *   destination:{name:string,baseArrival:string,arrival:string}}>}
 */
export function parseJourneysResponse(json) {
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
    out.push({
      train: [di.commercial_mode, di.headsign].filter(Boolean).join(' ') || di.label || '',
      status: journey.status || '',
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
 * @returns simplified journeys (see parseJourneysResponse). Empty array if the
 *   date is outside the API's rolling window.
 */
export async function fetchJourneys({ token, fromId, toId, datetime, freshness = 'realtime', fetchImpl = fetch }) {
  const params = new URLSearchParams({
    from: fromId,
    to: toId,
    datetime,
    data_freshness: freshness,
    max_nb_transfers: '0',
    count: '3',
    disable_geojson: 'true',
  });
  const res = await fetchImpl(`${API_BASE}/journeys?${params}`, {
    headers: { Authorization: authHeader(token) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error && body.error.id === 'date_out_of_bounds') return [];
    throw new Error(`SNCF API ${res.status}: ${body.error ? body.error.message : res.statusText}`);
  }
  return parseJourneysResponse(await res.json());
}
