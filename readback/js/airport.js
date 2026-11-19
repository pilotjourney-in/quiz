/* Airport data. Edit this file to correct the layout or move the sim to another field.
   Runway, elevation and frequencies are from public sources for Nagpur (VANP).
   The taxiway and apron layout is a SIMPLIFIED TRAINING LAYOUT, not the real aerodrome chart.

   Geometry uses a runway frame in metres:
     u = distance along the runway from the runway 14 threshold towards the runway 32 threshold
     v = distance sideways, positive towards the apron (north-east), negative towards the circuit side */
(function (TL) {
  'use strict';
  TL.AIRPORT = {
    icao: 'VANP',
    name: 'Nagpur',
    elev: 1033,            // ft
    hdg14: 143,            // true bearing of the u axis
    length: 3200,          // m
    width: 45,
    freqs: { GND: '121.9', TWR: '118.1', APP: '122.7', ATIS: '126.6' },
    unitNames: { GND: 'Nagpur Ground', TWR: 'Nagpur Tower', APP: 'Nagpur Approach' },
    runways: {
      '32': { id: '32', thrU: 3200, dir: -1, hdg: 323, hold: 'A', circuit: 'left', exits: ['B', 'C', 'D'], apronOut: 'F', apronIn: 'E' },
      '14': { id: '14', thrU: 0, dir: 1, hdg: 143, hold: 'D', circuit: 'right', exits: ['C', 'B', 'A'], apronOut: 'E', apronIn: 'F' }
    },
    links: { A: 3150, B: 2000, C: 1200, D: 50 },   // runway-to-taxiway links, u position
    apronLinks: { E: 1100, F: 2100 },              // taxiway-to-apron links, u position
    HOLD_V: 90,     // holding point distance from centreline
    CLEAR_V: 185,   // where a vacating aircraft stops and reports
    P_V: 250,       // parallel taxiway P
    APRON_V: 420,   // apron taxilane
    STAND_V: 480,
    stands: [1300, 1420, 1540, 1660, 1780, 1900],  // u position of stands 1..6
    destinations: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Raipur', 'Indore']
  };
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
