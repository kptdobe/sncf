// Static configuration for the Sierentz <-> Basel SBB commute tracker.

export const API_BASE = 'https://api.sncf.com/v1/coverage/sncf';

// SNCF (Navitia) stop_area identifiers.
export const STOPS = {
  sierentz: 'stop_area:SNCF:87182105',
  baselSBB: 'stop_area:SNCF:85000109',
};

// The two daily commute trains we track, Monday to Friday.
// `scheduledDeparture` / `scheduledArrival` are local "HH:MM" strings and are
// only used as a fallback label and to match the right train in API results.
export const TRAINS = [
  {
    id: 'morning',
    label: 'Morning',
    direction: 'Sierentz → Basel SBB',
    fromId: STOPS.sierentz,
    toId: STOPS.baselSBB,
    originName: 'Sierentz',
    destinationName: 'Basel SBB',
    scheduledDeparture: '07:32',
    scheduledArrival: '07:50',
  },
  {
    id: 'evening',
    label: 'Evening',
    direction: 'Basel SBB → Sierentz',
    fromId: STOPS.baselSBB,
    toId: STOPS.sierentz,
    originName: 'Basel SBB',
    destinationName: 'Sierentz',
    scheduledDeparture: '17:38',
    scheduledArrival: '17:56',
  },
];
