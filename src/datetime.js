// Pure date/time helpers. No I/O.
//
// The SNCF/Navitia API returns local timestamps in the compact form
// "YYYYMMDDTHHMMSS" with no timezone. Delay is always the difference between
// two such values for the *same* stop event (base vs realtime), so the missing
// timezone is irrelevant: we parse both as UTC and the difference is exact.

const NAVITIA_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse "YYYYMMDDTHHMMSS" to a Date (UTC components), or null. */
export function parseNavitia(value) {
  if (!value) return null;
  const m = NAVITIA_RE.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

/** Delay in whole minutes between scheduled and realtime, or null if unknown. */
export function delayMinutes(baseValue, realtimeValue) {
  const base = parseNavitia(baseValue);
  const rt = parseNavitia(realtimeValue);
  if (!base || !rt) return null;
  return Math.round((rt.getTime() - base.getTime()) / 60000);
}

/** "YYYYMMDDTHHMMSS" -> ISO-like "YYYY-MM-DDTHH:MM:SS", or null. */
export function toIso(value) {
  const m = NAVITIA_RE.exec(value || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/** "YYYYMMDDTHHMMSS" -> "HH:MM", or null. */
export function hhmm(value) {
  const m = NAVITIA_RE.exec(value || '');
  return m ? `${m[4]}:${m[5]}` : null;
}

/** "YYYY-MM-DD" -> "YYYYMMDD" for API query parameters. */
export function navitiaDay(dateStr) {
  return dateStr.replace(/-/g, '');
}

/** "YYYY-MM-DD" -> ISO week key like "2026-W24". */
export function isoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" -> weekday name, e.g. "Tuesday". */
export function weekdayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** True for Monday–Friday. */
export function isWeekday(dateStr) {
  const name = weekdayName(dateStr);
  return name !== 'Saturday' && name !== 'Sunday';
}

/** Add `n` days to "YYYY-MM-DD" and return "YYYY-MM-DD". */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Inclusive list of "YYYY-MM-DD" from start to end. */
export function dateRange(startStr, endStr) {
  const out = [];
  let cur = startStr;
  while (cur <= endStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
