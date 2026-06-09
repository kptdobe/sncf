// Static configuration for the Sierentz <-> Basel SBB commute tracker.

export const API_BASE = 'https://api.sncf.com/v1/coverage/sncf';

// SNCF (Navitia) stop_area identifiers.
export const STOPS = {
  sierentz: 'stop_area:SNCF:87182105',
  baselSBB: 'stop_area:SNCF:85000109',
};

// Every train runs the same ~18 min between the two stations.
const RIDE_MIN = 18;

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Departure times I can take, Monday to Friday.
const MORNING = ['07:02', '07:32', '08:02', '08:32']; // Sierentz -> Basel SBB
const EVENING = ['17:08', '17:38', '18:08', '18:38']; // Basel SBB -> Sierentz

function train(period, dep) {
  const morning = period === 'morning';
  return {
    id: (morning ? 'm' : 'e') + dep.replace(':', ''),
    period,
    label: dep,
    direction: morning ? 'Sierentz → Basel SBB' : 'Basel SBB → Sierentz',
    fromId: morning ? STOPS.sierentz : STOPS.baselSBB,
    toId: morning ? STOPS.baselSBB : STOPS.sierentz,
    originName: morning ? 'Sierentz' : 'Basel SBB',
    destinationName: morning ? 'Basel SBB' : 'Sierentz',
    scheduledDeparture: dep,
    scheduledArrival: addMinutes(dep, RIDE_MIN),
  };
}

export const TRAINS = [
  ...MORNING.map((d) => train('morning', d)),
  ...EVENING.map((d) => train('evening', d)),
];
