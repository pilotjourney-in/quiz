/* Airport catalog and taxiway graph.

   Each airport is described in a runway frame, in metres:
     u = distance along the runway axis, from the threshold of the "dir: 1" runway towards the other threshold
     v = distance sideways from the centreline, positive towards the terminal side, negative towards the circuit side
   axisHdg is the true bearing of the +u direction.

   The ground layout is a graph:
     nodes: { id: { u, v, kind, name } }
       kind 'rwy'   a point on the runway centreline where a taxiway joins
       kind 'hold'  a runway-holding point; name is its designator as published (e.g. 'A', 'A1', 'N3')
       kind 'stand' a parking stand; name is the stand number as published
       kind 'twy'   any other taxiway node (junction or bend)
     edges: [ nodeA, nodeB, taxiwayDesignator ]   designator null for apron taxilanes and stand lead-ins
   Every 'hold' node must connect to exactly one 'rwy' node; that edge is the runway entry/exit.

   chart.aip tells whether the layout was traced from the official AIP aerodrome chart.
   Layouts are simplified for training. Training simulation, not for navigation. */
(function (TL) {
  'use strict';

  var AIRPORTS = {};

  /* ------------------------------------------------------------------ */
  /* Nagpur, Dr Babasaheb Ambedkar International (VANP)                   */
  /* Source: AIP India (AAI eAIP), AMDT 10/2026 effective 29 OCT 2026:    */
  /*   AD 2.2, 2.8, 2.12, 2.13, 2.18; Aerodrome Chart AD 2 VANP 1-101 and */
  /*   1-103 (displaced THR 14), Parking/Docking Chart AD 2 VANP 1-301.   */
  /* Runway frame: u from THR 14 (21 06 32.38N 079 02 02.22E) towards     */
  /*   THR 32 (21 05 08.84N 079 03 08.30E, AD 2.12). Axis 143.44 deg true */
  /*   (bearing between the two AD 2.12 thresholds).                      */
  /*   The Aerodrome Chart prints THR 32 as 21 05 06.843N, which would    */
  /*   make the runway 3250 m and 32 m off-axis; AD 2.12 gives the        */
  /*   published 3200 m, so AD 2.12 is used.                              */
  /* Stands: WGS-84 stand coordinates from the Parking/Docking Chart      */
  /*   table (bays 1-12, 14-18). 17A/17B (Air India only, overlapping 17) */
  /*   and the isolation bay (IAPP) are not offered as stands.            */
  /* Taxiway centrelines: traced from the charts, georeferenced on the    */
  /*   stand coordinates (fit error under 1 m) and the runway thresholds. */
  /*   Accurate to a few metres; simplified (no fillets).                 */
  /* The west parallel taxiway is marked DISUSED on the chart; drawn only. */
  /* C1/C2/F lead to the Air Force apron and the MRO; no civil stands.    */
  /* Training simulation, not for navigation.                            */
  /* ------------------------------------------------------------------ */
  AIRPORTS.VANP = {
    icao: 'VANP', name: 'Nagpur', city: 'Nagpur', country: 'India',
    elev: 1037,                        // ft, AD 2.2
    axisHdg: 143.44, length: 3200, width: 45,
    freqs: { GND: '121.9', TWR: '118.1', APP: '120.4', ATIS: '128.325' },   // AD 2.18
    units: { GND: 'Nagpur Ground', TWR: 'Nagpur Tower', APP: 'Nagpur Approach' },
    runways: {
      // RWY 14: THR displaced 455 m till 01 NOV 2027 (AD 2.12/2.13). Departures enter at B1 and backtrack to the threshold.
      '14': { thrU: 0, dir: 1, hdg: 144, hold: 'B1', backtrack: true, dthr: 455, dthrUntil: '2027-11-01', exits: ['B1', 'A'], pref: 0.3 },
      // RWY 32: departures from A (TORA 2980 m, AD 2.13). Landing traffic vacates via B1, backtracking if it rolls past.
      '32': { thrU: 3200, dir: -1, hdg: 324, hold: 'A', exits: ['B1'], pref: 0.7 }
    },
    nodes: {
        "R_BC": { u: 2316, v: 0, kind: 'rwy' },
        "R_A": { u: 2988, v: 0, kind: 'rwy' },
        "H_B1": { u: 2382, v: 104, kind: 'hold', name: 'B1' },
        "B1_a": { u: 2473, v: 264, kind: 'twy' },
        "B1_b2": { u: 2590, v: 465, kind: 'twy' },
        "B2_m": { u: 2660, v: 441, kind: 'twy' },
        "L_n": { u: 2751, v: 465, kind: 'twy' },
        "L_s": { u: 2863, v: 177, kind: 'twy' },
        "A_t": { u: 2913, v: 168, kind: 'twy' },
        "A_b": { u: 2971, v: 145, kind: 'twy' },
        "H_A": { u: 2993, v: 92, kind: 'hold', name: 'A' },
        "B1_s14": { u: 2615, v: 508, kind: 'twy' },
        "S14": { u: 2547, v: 548, kind: 'stand', name: '14' },
        "B1_s15": { u: 2636, v: 543, kind: 'twy' },
        "S15": { u: 2568, v: 583, kind: 'stand', name: '15' },
        "B1_s16": { u: 2656, v: 578, kind: 'twy' },
        "S16": { u: 2588, v: 617, kind: 'stand', name: '16' },
        "B1_s17": { u: 2677, v: 613, kind: 'twy' },
        "S17": { u: 2609, v: 652, kind: 'stand', name: '17' },
        "B1_s18": { u: 2697, v: 648, kind: 'twy' },
        "S18": { u: 2630, v: 687, kind: 'stand', name: '18' },
        "IAPP": { u: 2762, v: 759, kind: 'twy' },
        "L_s1": { u: 2756, v: 453, kind: 'twy' },
        "S1": { u: 2832, v: 482, kind: 'stand', name: '1' },
        "L_s2": { u: 2780, v: 392, kind: 'twy' },
        "S2": { u: 2855, v: 421, kind: 'stand', name: '2' },
        "L_s3": { u: 2798, v: 344, kind: 'twy' },
        "S3": { u: 2867, v: 372, kind: 'stand', name: '3' },
        "L_s4": { u: 2813, v: 305, kind: 'twy' },
        "S4": { u: 2882, v: 332, kind: 'stand', name: '4' },
        "L_s5": { u: 2829, v: 266, kind: 'twy' },
        "S5": { u: 2897, v: 292, kind: 'stand', name: '5' },
        "L_s6": { u: 2844, v: 226, kind: 'twy' },
        "S6": { u: 2912, v: 253, kind: 'stand', name: '6' },
        "L_s8": { u: 2769, v: 419, kind: 'twy' },
        "S8": { u: 2705, v: 395, kind: 'stand', name: '8' },
        "L_s9": { u: 2784, v: 380, kind: 'twy' },
        "S9": { u: 2720, v: 355, kind: 'stand', name: '9' },
        "L_s10": { u: 2800, v: 340, kind: 'twy' },
        "S10": { u: 2735, v: 315, kind: 'stand', name: '10' },
        "L_s11": { u: 2815, v: 301, kind: 'twy' },
        "S11": { u: 2750, v: 275, kind: 'stand', name: '11' },
        "L_s12": { u: 2830, v: 261, kind: 'twy' },
        "S12": { u: 2765, v: 236, kind: 'stand', name: '12' },
        "S7": { u: 2913, v: 194, kind: 'stand', name: '7' },
        "A_s7": { u: 2888, v: 172, kind: 'twy' },
        "H_C1": { u: 2260, v: -92, kind: 'hold', name: 'C1' },
        "C1_a": { u: 2185, v: -270, kind: 'twy' },
        "C1_b": { u: 2080, v: -395, kind: 'twy' },
        "C1_c": { u: 1708, v: -1020, kind: 'twy' },
        "C1_d": { u: 1640, v: -1135, kind: 'twy' },
        "C1_e": { u: 1690, v: -1440, kind: 'twy' },
        "C1_f": { u: 1765, v: -1790, kind: 'twy' },
        "F_e": { u: 2270, v: -325, kind: 'twy' },
        "C2_a": { u: 1850, v: -1817, kind: 'twy' },
        "C2_b": { u: 2860, v: -1817, kind: 'twy' },
        "C2_c": { u: 3460, v: -1817, kind: 'twy' }
    },
    edges: [
        ['R_BC', 'H_B1', 'B1'],
        ['H_B1', 'B1_a', 'B1'],
        ['B1_a', 'B1_b2', 'B1'],
        ['B1_b2', 'B2_m', 'B2'],
        ['B2_m', 'L_n', 'B2'],
        ['R_A', 'H_A', 'A'],
        ['H_A', 'A_b', 'A'],
        ['A_b', 'A_t', 'A'],
        ['B1_s14', 'S14', null],
        ['B1_s15', 'S15', null],
        ['B1_s16', 'S16', null],
        ['B1_s17', 'S17', null],
        ['B1_s18', 'S18', null],
        ['B1_b2', 'B1_s14', 'B1'],
        ['B1_s14', 'B1_s15', 'B1'],
        ['B1_s15', 'B1_s16', 'B1'],
        ['B1_s16', 'B1_s17', 'B1'],
        ['B1_s17', 'B1_s18', 'B1'],
        ['B1_s18', 'IAPP', 'B1'],
        ['L_s1', 'S1', null],
        ['L_s2', 'S2', null],
        ['L_s3', 'S3', null],
        ['L_s4', 'S4', null],
        ['L_s5', 'S5', null],
        ['L_s6', 'S6', null],
        ['L_s8', 'S8', null],
        ['L_s9', 'S9', null],
        ['L_s10', 'S10', null],
        ['L_s11', 'S11', null],
        ['L_s12', 'S12', null],
        ['L_n', 'L_s1', 'L'],
        ['L_s1', 'L_s8', 'L'],
        ['L_s8', 'L_s2', 'L'],
        ['L_s2', 'L_s9', 'L'],
        ['L_s9', 'L_s3', 'L'],
        ['L_s3', 'L_s10', 'L'],
        ['L_s10', 'L_s4', 'L'],
        ['L_s4', 'L_s11', 'L'],
        ['L_s11', 'L_s5', 'L'],
        ['L_s5', 'L_s12', 'L'],
        ['L_s12', 'L_s6', 'L'],
        ['L_s6', 'L_s', 'L'],
        ['L_s', 'A_s7', 'L'],
        ['A_s7', 'A_t', 'A'],
        ['A_s7', 'S7', null],
        ['R_BC', 'H_C1', 'C1'],
        ['H_C1', 'C1_a', 'C1'],
        ['C1_a', 'C1_b', 'C1'],
        ['C1_b', 'C1_c', 'C1'],
        ['C1_c', 'C1_d', 'C1'],
        ['C1_d', 'C1_e', 'C1'],
        ['C1_e', 'C1_f', 'C1'],
        ['C1_a', 'F_e', 'F'],
        ['C1_f', 'C2_a', 'C2'],
        ['C2_a', 'C2_b', 'C2'],
        ['C2_b', 'C2_c', 'C2']
    ],
    aprons: [[[2671, 450], [2672, 406], [2755, 202], [2933, 165], [2937, 228], [2877, 448], [2839, 516], [2735, 496]], [[2522, 531], [2613, 478], [2722, 665], [2633, 717]]],
    decor: [{'kind': 'disused', 'pts': [[95, -162], [3170, -162]]}, {'kind': 'disused', 'pts': [[1650, -162], [1650, -25]]}],
    gndView: [-150, 3350, -330, 820],   // ground view: the runway and the civil side; C1/C2 to the MRO run off-screen
    smallStands: ['7'],                 // AD 2.8: stand 7 limited to 30 m span / 30 m length / 8 m tail
    reg: 'VT-PJA',
    airlines: 'INDIA',
    destinations: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Raipur', 'Indore'],
    chart: { aip: true, source: 'AAI eAIP charts, AMDT 10/2026 (29 Oct 2026).' }
  };

  /* ------------------------------------------------------------------ */
  /* Mumbai, Chhatrapati Shivaji Maharaj International (VABB)             */
  /* Source: AIP India (AAI eAIP), AMDT 10/2026 effective 29 OCT 2026:    */
  /*   AD 2.2, 2.12, 2.13, 2.18; Aerodrome Chart AD 2 VABB 1-101;          */
  /*   Aircraft Parking/Docking Chart Apron A.                            */
  /* Modelled: RWY 09/27 (one runway in use), parallel taxiway N / N1     */
  /*   with its runway links, and Apron A (stands A1-A12) with taxilane L */
  /*   and links L1, L3, L4. RWY 14/32 is drawn but never in use here.    */
  /*   Other aprons and taxiways (M, W, E-side, cargo, T2) not modelled.  */
  /* Runway frame: u from the west end of the 09/27 pavement (RWY 27 END, */
  /*   19 05 18.37N 072 50 52.48E) towards the east end, along the line   */
  /*   between the AD 2.12 runway ends (89.16 deg true).                  */
  /*   Pavement 3448 m (AD 2.12 remark). RWY 09: take-off from the west   */
  /*   end (TORA 3188), THR 09 140 m in (LDA 3048). RWY 27: take-off from */
  /*   the east end (TORA 3448), THR 27 484 m in (LDA 2965).              */
  /* Runway link positions: from the AD 2.13 reduced TORAs where given    */
  /*   (N11 140, N10 339, N6 entry, N4 2814, N3 3188, N1R 3383 m), the    */
  /*   rest traced. Taxiway centrelines traced from the Aerodrome Chart   */
  /*   (fitted on the four runway ends, under 1 m) and the Apron A chart  */
  /*   (fitted on the 12 stand coordinates, under 1 m).                   */
  /* NOTE: the runway-holding positions are not legible at chart scale,   */
  /*   so holding points are placed 107 m from the centreline. Treat them */
  /*   as approximate.                                                    */
  /* Training simulation, not for navigation.                            */
  /* ------------------------------------------------------------------ */
  AIRPORTS.VABB = {
    icao: 'VABB', name: 'Mumbai', city: 'Mumbai', country: 'India',
    elev: 40,                          // ft, AD 2.2
    axisHdg: 89.16, length: 3448, width: 60,
    // AD 2.18: TWR 118.1 (main), SMC-1 121.9, ATIS 126.4. APP: the sim hands departures to Approach Departure 124.65 (one of two main departure frequencies).
    freqs: { GND: '121.9', TWR: '118.1', APP: '124.65', ATIS: '126.4' },
    units: { GND: 'Mumbai Ground', TWR: 'Mumbai Tower', APP: 'Mumbai Approach' },
    runways: {
      '09': { thrU: 0, dir: 1, hdg: 90, hold: 'N11', dthr: 140, exits: ['N6', 'N5', 'N4', 'N3'], pref: 0.3 },
      '27': { thrU: 3448, dir: -1, hdg: 270, hold: 'N1', dthr: 484, exits: ['N5', 'E', 'N7', 'N8', 'N9', 'N10', 'N11'], pref: 0.7 }
    },
    nodes: {
        "NJ10": { u: 351, v: 192, kind: 'twy' },
        "R_N11": { u: 140, v: 0, kind: 'rwy' },
        "H_N11": { u: 140, v: 107, kind: 'hold', name: 'N11' },
        "J_N11": { u: 140, v: 150, kind: 'twy' },
        "R_N10": { u: 339, v: 0, kind: 'rwy' },
        "H_N10": { u: 347, v: 107, kind: 'hold', name: 'N10' },
        "R_N9": { u: 665, v: 0, kind: 'rwy' },
        "H_N9": { u: 481, v: 107, kind: 'hold', name: 'N9' },
        "R_N8": { u: 967, v: 0, kind: 'rwy' },
        "H_N8": { u: 737, v: 107, kind: 'hold', name: 'N8' },
        "J_N8": { u: 554, v: 192, kind: 'twy' },
        "R_N7": { u: 1293, v: 0, kind: 'rwy' },
        "H_N7": { u: 1101, v: 107, kind: 'hold', name: 'N7' },
        "J_N7": { u: 950, v: 192, kind: 'twy' },
        "R_N6": { u: 1230, v: 0, kind: 'rwy' },
        "H_N6": { u: 1370, v: 107, kind: 'hold', name: 'N6' },
        "J_N6": { u: 1460, v: 192, kind: 'twy' },
        "R_E": { u: 2340, v: 0, kind: 'rwy' },
        "H_E": { u: 2212, v: 107, kind: 'hold', name: 'E' },
        "J_E": { u: 2100, v: 198, kind: 'twy' },
        "R_N5": { u: 2455, v: 0, kind: 'rwy' },
        "H_N5": { u: 2455, v: 107, kind: 'hold', name: 'N5' },
        "J_N5": { u: 2440, v: 198, kind: 'twy' },
        "R_N4": { u: 2814, v: 0, kind: 'rwy' },
        "H_N4": { u: 2814, v: 107, kind: 'hold', name: 'N4' },
        "J_N4": { u: 2814, v: 198, kind: 'twy' },
        "R_N3": { u: 3188, v: 0, kind: 'rwy' },
        "H_N3": { u: 3188, v: 107, kind: 'hold', name: 'N3' },
        "J_N3": { u: 3186, v: 198, kind: 'twy' },
        "R_N1R": { u: 3383, v: 0, kind: 'rwy' },
        "H_N1R": { u: 3419, v: 95, kind: 'hold', name: 'N1R' },
        "J_N1R": { u: 3440, v: 150, kind: 'twy' },
        "R_N1": { u: 3440, v: 0, kind: 'rwy' },
        "H_N1": { u: 3440, v: 107, kind: 'hold', name: 'N1' },
        "N1_e": { u: 3440, v: 198, kind: 'twy' },
        "L_w": { u: 351, v: 267, kind: 'twy' },
        "L3_t": { u: 646, v: 267, kind: 'twy' },
        "L4_t": { u: 829, v: 267, kind: 'twy' },
        "L_e": { u: 860, v: 267, kind: 'twy' },
        "J_L3": { u: 646, v: 192, kind: 'twy' },
        "J_L4": { u: 829, v: 192, kind: 'twy' },
        "S_A1": { u: 858, v: 344, kind: 'stand', name: 'A1' },
        "LS_A1": { u: 858, v: 267, kind: 'twy' },
        "S_A2": { u: 817, v: 345, kind: 'stand', name: 'A2' },
        "LS_A2": { u: 817, v: 267, kind: 'twy' },
        "S_A3": { u: 777, v: 345, kind: 'stand', name: 'A3' },
        "LS_A3": { u: 777, v: 267, kind: 'twy' },
        "S_A4": { u: 736, v: 345, kind: 'stand', name: 'A4' },
        "LS_A4": { u: 736, v: 267, kind: 'twy' },
        "S_A5": { u: 696, v: 345, kind: 'stand', name: 'A5' },
        "LS_A5": { u: 696, v: 267, kind: 'twy' },
        "S_A6": { u: 655, v: 345, kind: 'stand', name: 'A6' },
        "LS_A6": { u: 655, v: 267, kind: 'twy' },
        "S_A7": { u: 609, v: 347, kind: 'stand', name: 'A7' },
        "LS_A7": { u: 609, v: 267, kind: 'twy' },
        "S_A8": { u: 553, v: 347, kind: 'stand', name: 'A8' },
        "LS_A8": { u: 553, v: 267, kind: 'twy' },
        "S_A9": { u: 491, v: 347, kind: 'stand', name: 'A9' },
        "LS_A9": { u: 491, v: 267, kind: 'twy' },
        "S_A10": { u: 438, v: 348, kind: 'stand', name: 'A10' },
        "LS_A10": { u: 438, v: 267, kind: 'twy' },
        "S_A11": { u: 389, v: 347, kind: 'stand', name: 'A11' },
        "LS_A11": { u: 389, v: 267, kind: 'twy' },
        "S_A12": { u: 340, v: 351, kind: 'stand', name: 'A12' },
        "LS_A12": { u: 340, v: 267, kind: 'twy' },
        "N_w": { u: 20, v: 95, kind: 'twy' },
        "N_w2": { u: 250, v: 178, kind: 'twy' },
        "N_x": { u: 1820, v: 196, kind: 'twy' }
    },
    edges: [
        ['R_N11', 'H_N11', 'N11'],
        ['R_N10', 'H_N10', 'N10'],
        ['R_N9', 'H_N9', 'N9'],
        ['R_N8', 'H_N8', 'N8'],
        ['R_N7', 'H_N7', 'N7'],
        ['R_N6', 'H_N6', 'N6'],
        ['R_E', 'H_E', 'E'],
        ['R_N5', 'H_N5', 'N5'],
        ['R_N4', 'H_N4', 'N4'],
        ['R_N3', 'H_N3', 'N3'],
        ['R_N1R', 'H_N1R', 'N1R'],
        ['R_N1', 'H_N1', 'N1'],
        ['H_N11', 'J_N11', 'N11'],
        ['H_N10', 'NJ10', 'N10'],
        ['H_N9', 'NJ10', 'N9'],
        ['H_N8', 'J_N8', 'N8'],
        ['H_N7', 'J_N7', 'N7'],
        ['H_N6', 'J_N6', 'N6'],
        ['H_E', 'J_E', 'E'],
        ['H_N5', 'J_N5', 'N5'],
        ['H_N4', 'J_N4', 'N4'],
        ['H_N3', 'J_N3', 'N3'],
        ['H_N1R', 'J_N1R', 'N1R'],
        ['J_N1R', 'H_N1', 'N1'],
        ['N1_e', 'J_N1R', 'N1'],
        ['NJ10', 'L_w', 'L1'],
        ['L3_t', 'J_L3', 'L3'],
        ['L4_t', 'J_L4', 'L4'],
        ['LS_A1', 'S_A1', null],
        ['LS_A2', 'S_A2', null],
        ['LS_A3', 'S_A3', null],
        ['LS_A4', 'S_A4', null],
        ['LS_A5', 'S_A5', null],
        ['LS_A6', 'S_A6', null],
        ['LS_A7', 'S_A7', null],
        ['LS_A8', 'S_A8', null],
        ['LS_A9', 'S_A9', null],
        ['LS_A10', 'S_A10', null],
        ['LS_A11', 'S_A11', null],
        ['LS_A12', 'S_A12', null],
        ['LS_A12', 'L_w', 'L'],
        ['L_w', 'LS_A11', 'L'],
        ['LS_A11', 'LS_A10', 'L'],
        ['LS_A10', 'LS_A9', 'L'],
        ['LS_A9', 'LS_A8', 'L'],
        ['LS_A8', 'LS_A7', 'L'],
        ['LS_A7', 'L3_t', 'L'],
        ['L3_t', 'LS_A6', 'L'],
        ['LS_A6', 'LS_A5', 'L'],
        ['LS_A5', 'LS_A4', 'L'],
        ['LS_A4', 'LS_A3', 'L'],
        ['LS_A3', 'LS_A2', 'L'],
        ['LS_A2', 'L4_t', 'L'],
        ['L4_t', 'LS_A1', 'L'],
        ['LS_A1', 'L_e', 'L'],
        ['N_w', 'J_N11', 'N'],
        ['J_N11', 'N_w2', 'N'],
        ['N_w2', 'NJ10', 'N'],
        ['NJ10', 'J_N8', 'N'],
        ['J_N8', 'J_L3', 'N'],
        ['J_L3', 'J_L4', 'N'],
        ['J_L4', 'J_N7', 'N'],
        ['J_N7', 'J_N6', 'N'],
        ['J_N6', 'N_x', 'N'],
        ['N_x', 'J_E', 'N1'],
        ['J_E', 'J_N5', 'N1'],
        ['J_N5', 'J_N4', 'N1'],
        ['J_N4', 'J_N3', 'N1'],
        ['J_N3', 'N1_e', 'N1']
    ],
    aprons: [[[305, 237], [895, 237], [895, 391], [305, 391]]],
    decor: [{'kind': 'runway', 'width': 45, 'pts': [[993, 1102], [3025, -926]], 'label': ['14', '32']}],
    gndView: [-150, 3550, -170, 430],
    reg: 'VT-PJA',
    airlines: 'INDIA',
    destinations: ['Delhi', 'Bengaluru', 'Goa', 'Ahmedabad', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur'],
    chart: { aip: true, source: 'AAI eAIP charts, AMDT 10/2026 (29 Oct 2026). Runway 09/27 with taxiway N/N1 and Apron A; holding points approximate.' }
  };

  /* Airline groups for AI traffic. tel = radiotelephony designator; keys = how it may be heard. */
  var AIRLINE_SETS = {
    INDIA: [
      { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320', 'A320', 'AT72'] },
      { tel: 'Air India', keys: ['airindia'], types: ['A320'] },
      { tel: 'Akasa Air', keys: ['akasaair', 'akasa'], types: ['B738'] },
      { tel: 'Spicejet', keys: ['spicejet'], types: ['B738'] },
      { tel: 'Allied', keys: ['allied', 'allianceair'], types: ['AT72'] }
    ]
  };

  /* ---------------- graph helpers ---------------- */
  function build(src) {
    var ap = {}, k;
    for (k in src) ap[k] = src[k];
    ap.hdg14 = ap.axisHdg;                       // old name, kept for compatibility
    if (typeof ap.airlines === 'string') ap.airlines = AIRLINE_SETS[ap.airlines];
    var adj = {}, nodes = ap.nodes;
    Object.keys(nodes).forEach(function (id) { adj[id] = []; nodes[id].id = id; });
    ap.edges.forEach(function (ed) {
      var a = nodes[ed[0]], b = nodes[ed[1]];
      if (!a || !b) throw new Error(ap.icao + ': edge to unknown node ' + ed[0] + '-' + ed[1]);
      var d = Math.hypot(a.u - b.u, a.v - b.v);
      adj[ed[0]].push({ to: ed[1], name: ed[2], d: d });
      adj[ed[1]].push({ to: ed[0], name: ed[2], d: d });
    });
    ap.adj = adj;
    // holding points by designator, each with its runway node
    ap.holds = {};
    Object.keys(nodes).forEach(function (id) {
      var nd = nodes[id];
      if (nd.kind !== 'hold') return;
      var r = adj[id].filter(function (x) { return nodes[x.to].kind === 'rwy'; })[0];
      if (!r) throw new Error(ap.icao + ': holding point ' + nd.name + ' has no runway node');
      var beyond = adj[id].filter(function (x) { return nodes[x.to].kind !== 'rwy'; })[0];
      ap.holds[nd.name] = { id: id, name: nd.name, rwy: r.to, next: beyond ? beyond.to : null, v: nd.v };
    });
    ap.standIds = Object.keys(nodes).filter(function (id) { return nodes[id].kind === 'stand'; });
    ap.standIds.sort(function (a, b) { return String(nodes[a].name).localeCompare(String(nodes[b].name), 'en', { numeric: true }); });
    for (k in ap.runways) {
      var rw = ap.runways[k];
      rw.id = k;
      if (!ap.holds[rw.hold]) throw new Error(ap.icao + ': runway ' + k + ' hold ' + rw.hold + ' missing');
      if (!rw.exits) rw.exits = Object.keys(ap.holds);
      // The circuit is flown on the side away from the terminal (negative v). +v is to the left of +u travel,
      // so that is a right-hand circuit for the dir 1 runway and left-hand for the other, unless the data says otherwise.
      if (!rw.circuit) rw.circuit = rw.dir > 0 ? 'right' : 'left';
    }
    return ap;
  }

  /* Shortest route between two nodes over taxiways (never across a runway node).
     Returns the node ids, start included, or null. */
  function route(ap, from, to) {
    var dist = {}, prev = {}, done = {}, q = [from];
    dist[from] = 0;
    while (q.length) {
      q.sort(function (a, b) { return dist[a] - dist[b]; });
      var cur = q.shift();
      if (done[cur]) continue;
      done[cur] = true;
      if (cur === to) break;
      ap.adj[cur].forEach(function (x) {
        if (ap.nodes[x.to].kind === 'rwy') return;
        if (ap.nodes[x.to].kind === 'stand' && x.to !== to) return;   // don't taxi through other stands
        var nd = dist[cur] + x.d;
        if (dist[x.to] == null || nd < dist[x.to]) { dist[x.to] = nd; prev[x.to] = cur; q.push(x.to); }
      });
    }
    if (dist[to] == null) return null;
    var out = [to];
    while (out[0] !== from) out.unshift(prev[out[0]]);
    return out;
  }
  /* Taxiway designators along a route, in order, without repeats or unnamed apron lanes. */
  function names(ap, ids) {
    var out = [];
    for (var i = 1; i < ids.length; i++) {
      var ed = ap.adj[ids[i - 1]].filter(function (x) { return x.to === ids[i]; })[0];
      var nm = ed && ed.name;
      if (nm && out[out.length - 1] !== nm) out.push(nm);
    }
    return out;
  }

  function select(icao) {
    var src = AIRPORTS[icao] || AIRPORTS[TL.DEFAULT_AIRPORT];
    TL.AIRPORT = build(src);
    return TL.AIRPORT;
  }

  TL.AIRPORTS = AIRPORTS;
  TL.AIRLINE_SETS = AIRLINE_SETS;
  TL.DEFAULT_AIRPORT = 'VANP';
  TL.selectAirport = select;
  TL.Graph = { route: route, names: names, build: build };
  select(TL.DEFAULT_AIRPORT);
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
