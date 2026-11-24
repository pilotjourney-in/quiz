/* Airport catalog and taxiway graph.

   Each airport is described in a runway frame, in metres:
     u = distance along the runway axis, from the threshold of the "dir: 1" runway towards the other threshold
     v = distance sideways from the centreline, positive towards the terminal side, negative towards the circuit side
   axisHdg is the true bearing of the +u direction.
   runways[id].hdg is the runway heading used for the wind: magnetic, as on the AIP aerodrome chart, for TNCM, LOWI, VHHH, OMDB and EGKK.

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
  /*   (N11 140, N10 339, N6 1306, N4 2814, N3 3188, N1R 3383 m), the     */
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
        "R_N6": { u: 1306, v: 0, kind: 'rwy' },   // AD 2.13
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

  /* Innsbruck (LOWI)                                                   */
  /* Source: AIP Austria (Austro Control), Aerodrome Chart LOWI AD 2 MAP 1-1 */
  /*   and AD 2 text (AD 2.8, 2.12, 2.13, 2.18).                        */
  /* Runway frame: u from the east end (THR 26) towards the west end,   */
  /*   fitted on the runway pavement drawn on the chart (2000 m, 080.97/260.99 */
  /*   true). THR 08 displaced 60 m (AD 2.12/2.13).                     */
  /* Runway links at the AD 2.13 intersection TORAs: A 1586 m (RWY 08), */
  /*   B 1602 m (RWY 26). Departures backtrack from A or B.             */
  /* Z (north apron, MTOM 2000 kg) and grass taxiway Y are not modelled. */
  /* The taxilane along the apron edge is named B east of L and A west of L */
  /*   (my reading of the chart labels; check against the chart).       */
  /* No Ground frequency: Tower handles ground movements (noGnd).       */
  /* No stand numbers are published (AD 2.9: follow-me service on the apron), so */
  /*   parking is spoken as "the apron" (apronOnly).                    */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.LOWI = {
    icao: 'LOWI', name: 'Innsbruck', city: 'Innsbruck', country: 'Austria',
    elev: 1907,
    axisHdg: 260.99, length: 2000, width: 45,
    // AD 2.18: TOWER 120.100, RADAR 128.975, ATIS 126.030. No Ground frequency is published: Tower works ground traffic.
    freqs: {'GND': '120.100', 'TWR': '120.100', 'APP': '128.975', 'ATIS': '126.030'},
    units: {'GND': 'Innsbruck Tower', 'TWR': 'Innsbruck Tower', 'APP': 'Innsbruck Radar'},
    noGnd: true,
    apronOnly: true,
    runways: {
      '26': {'thrU': 0, 'dir': 1, 'hdg': 257, 'hold': 'B', 'backtrack': true, 'exits': ['A'], 'pref': 0.6},
      '08': {'thrU': 2000, 'dir': -1, 'hdg': 77, 'hold': 'A', 'backtrack': true, 'dthr': 60, 'exits': ['B'], 'pref': 0.4}
    },
    nodes: {
        "R_A": {"u": 1586, "v": 0, "kind": "rwy"},
        "H_A": {"u": 1492, "v": 102, "kind": "hold", "name": "A"},
        "A_d": {"u": 1445, "v": 150, "kind": "twy"},
        "A_c": {"u": 1377, "v": 209, "kind": "twy"},
        "A_l": {"u": 1318, "v": 231, "kind": "twy"},
        "R_B": {"u": 338, "v": 0, "kind": "rwy"},
        "H_B": {"u": 348, "v": 110, "kind": "hold", "name": "B"},
        "B_c": {"u": 348, "v": 234, "kind": "twy"},
        "L_j": {"u": 943, "v": 234, "kind": "twy"},
        "L_a": {"u": 943, "v": 292, "kind": "twy"},
        "B_a": {"u": 395, "v": 292, "kind": "twy"},
        "AP1": {"u": 460, "v": 292, "kind": "twy"},
        "S_1": {"u": 460, "v": 322, "kind": "stand", "name": "1"},
        "AP2": {"u": 540, "v": 292, "kind": "twy"},
        "S_2": {"u": 540, "v": 322, "kind": "stand", "name": "2"},
        "AP3": {"u": 620, "v": 292, "kind": "twy"},
        "S_3": {"u": 620, "v": 322, "kind": "stand", "name": "3"},
        "AP4": {"u": 700, "v": 292, "kind": "twy"},
        "S_4": {"u": 700, "v": 322, "kind": "stand", "name": "4"},
        "AP5": {"u": 780, "v": 292, "kind": "twy"},
        "S_5": {"u": 780, "v": 322, "kind": "stand", "name": "5"},
        "AP6": {"u": 860, "v": 292, "kind": "twy"},
        "S_6": {"u": 860, "v": 322, "kind": "stand", "name": "6"},
        "AP7": {"u": 1020, "v": 292, "kind": "twy"},
        "S_7": {"u": 1020, "v": 322, "kind": "stand", "name": "7"},
        "AP8": {"u": 1100, "v": 292, "kind": "twy"},
        "S_8": {"u": 1100, "v": 322, "kind": "stand", "name": "8"},
        "AP9": {"u": 1180, "v": 292, "kind": "twy"},
        "S_9": {"u": 1180, "v": 322, "kind": "stand", "name": "9"}
    },
    edges: [
        ["R_A", "H_A", "A"],
        ["H_A", "A_d", "A"],
        ["A_d", "A_c", "A"],
        ["A_c", "A_l", "A"],
        ["R_B", "H_B", "B"],
        ["H_B", "B_c", "B"],
        ["A_l", "L_j", "A"],
        ["L_j", "B_c", "B"],
        ["L_j", "L_a", "L"],
        ["B_c", "B_a", "B"],
        ["AP1", "S_1", null],
        ["AP2", "S_2", null],
        ["AP3", "S_3", null],
        ["AP4", "S_4", null],
        ["AP5", "S_5", null],
        ["AP6", "S_6", null],
        ["AP7", "S_7", null],
        ["AP8", "S_8", null],
        ["AP9", "S_9", null],
        ["B_a", "AP1", null],
        ["AP1", "AP2", null],
        ["AP2", "AP3", null],
        ["AP3", "AP4", null],
        ["AP4", "AP5", null],
        ["AP5", "AP6", null],
        ["AP6", "L_a", null],
        ["L_a", "AP7", null],
        ["AP7", "AP8", null],
        ["AP8", "AP9", null]
    ],
    aprons: [[[300, 255], [1260, 255], [1260, 345], [300, 345]]],
    gndView: [-150, 2150, -120, 442],
    reg: 'OE-PJA',
    airlines: 'AUSTRIA',
    destinations: ['Vienna', 'Frankfurt', 'Amsterdam', 'London', 'Zurich', 'Hamburg'],
    chart: { aip: true, source: 'Austro Control AIP Austria, LOWI AD 2 MAP 1-1 (AIRAC AMDT 296) and AD 2 text. Runway 08/26 with taxiways A, B, L and the south apron. No stand numbers are published.' }
  };

  /* Princess Juliana, St Maarten (TNCM)                                */
  /* Source: DC-ANSP eAIP (AIRAC AMDT 03-26): Aerodrome Chart and Parking/ */
  /*   Docking Chart P.1 (both AERO INFO DATE 17 APR 2025).             */
  /* Runway frame: u from the west end of the pavement (point b, TORA start */
  /*   RWY 10, 18 02 21.84N 063 07 10.85W) to the east end (point e,    */
  /*   18 02 32.87N 063 05 53.54W), 2300 m, 082 true. LDA 10 2200 m: the */
  /*   landing threshold of RWY 10 is 100 m in (point d).               */
  /* Stands A1-A4, B1-B5, C1-C12: WGS-84 coordinates from the P.1 table. */
  /* Taxi guide lines traced from the Aerodrome Chart (fitted on the runway). */
  /* Departures backtrack: RWY 10 from A (ADC note 3), RWY 28 from E.   */
  /* F, G1, G2 and H are not modelled (F apron and the south G/H aprons). */
  /* No Ground frequency: Tower handles ground movements (noGnd).       */
  /* Circuits: right-hand for RWY 10, left-hand for RWY 28 (ADC note 1). */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.TNCM = {
    icao: 'TNCM', name: 'St Maarten', city: 'Sint Maarten', country: 'Sint Maarten',
    elev: 14,
    axisHdg: 82.0, length: 2300, width: 45,
    // AD 2.18: JULIANA TOWER 118.700, APPROACH 128.950, ATIS 127.650. No Ground frequency is published: Tower works ground traffic.
    freqs: {'GND': '118.700', 'TWR': '118.700', 'APP': '128.950', 'ATIS': '127.650'},
    units: {'GND': 'Juliana Tower', 'TWR': 'Juliana Tower', 'APP': 'Juliana Approach'},
    noGnd: true,
    runways: {
      '10': {'thrU': 0, 'dir': 1, 'hdg': 96, 'hold': 'A', 'backtrack': true, 'dthr': 100, 'exits': ['C', 'D', 'E'], 'pref': 0.85},
      '28': {'thrU': 2300, 'dir': -1, 'hdg': 276, 'hold': 'E', 'backtrack': true, 'exits': ['E', 'D', 'C', 'B'], 'pref': 0.15}
    },
    nodes: {
        "R_A": {"u": 160, "v": 0, "kind": "rwy"},
        "H_A": {"u": 123, "v": 92, "kind": "hold", "name": "A"},
        "A1": {"u": 157, "v": 92, "kind": "twy"},
        "A2": {"u": 320, "v": 92, "kind": "twy"},
        "J_B": {"u": 346, "v": 72, "kind": "twy"},
        "R_B": {"u": 346, "v": 0, "kind": "rwy"},
        "H_B": {"u": 346, "v": 56, "kind": "hold", "name": "B"},
        "B1": {"u": 363, "v": 114, "kind": "twy"},
        "Bd1": {"u": 398, "v": 135, "kind": "twy"},
        "Bd2": {"u": 485, "v": 185, "kind": "twy"},
        "Bd3": {"u": 520, "v": 204, "kind": "twy"},
        "Bd4": {"u": 554, "v": 224, "kind": "twy"},
        "AL0": {"u": 582, "v": 231, "kind": "twy"},
        "AL1": {"u": 627, "v": 231, "kind": "twy"},
        "AL2": {"u": 700, "v": 231, "kind": "twy"},
        "AL3": {"u": 732, "v": 234, "kind": "twy"},
        "AL4": {"u": 756, "v": 243, "kind": "twy"},
        "AL5": {"u": 834, "v": 271, "kind": "twy"},
        "R_C": {"u": 738, "v": 0, "kind": "rwy"},
        "H_C": {"u": 738, "v": 77, "kind": "hold", "name": "C"},
        "C1": {"u": 738, "v": 105, "kind": "twy"},
        "C2": {"u": 737, "v": 131, "kind": "twy"},
        "C3": {"u": 737, "v": 190, "kind": "twy"},
        "C4": {"u": 745, "v": 239, "kind": "twy"},
        "BL5": {"u": 669, "v": 131, "kind": "twy"},
        "BL4": {"u": 621, "v": 131, "kind": "twy"},
        "CS1": {"u": 776, "v": 190, "kind": "twy"},
        "CS2": {"u": 804, "v": 190, "kind": "twy"},
        "CS3": {"u": 836, "v": 190, "kind": "twy"},
        "CS4": {"u": 869, "v": 190, "kind": "twy"},
        "CS5": {"u": 902, "v": 190, "kind": "twy"},
        "CS6": {"u": 925, "v": 190, "kind": "twy"},
        "CS7": {"u": 949, "v": 171, "kind": "twy"},
        "CS8": {"u": 949, "v": 134, "kind": "twy"},
        "R_D": {"u": 877, "v": 0, "kind": "rwy"},
        "H_D": {"u": 877, "v": 77, "kind": "hold", "name": "D"},
        "D1": {"u": 877, "v": 92, "kind": "twy"},
        "R_E": {"u": 1052, "v": 0, "kind": "rwy"},
        "H_E": {"u": 1052, "v": 77, "kind": "hold", "name": "E"},
        "E1": {"u": 1052, "v": 92, "kind": "twy"},
        "DL0": {"u": 758, "v": 105, "kind": "twy"},
        "DL1": {"u": 857, "v": 104, "kind": "twy"},
        "DL2": {"u": 892, "v": 105, "kind": "twy"},
        "DL3": {"u": 923, "v": 105, "kind": "twy"},
        "DL4": {"u": 999, "v": 104, "kind": "twy"},
        "DL5": {"u": 1031, "v": 104, "kind": "twy"},
        "DL6": {"u": 1052, "v": 104, "kind": "twy"},
        "S_A1": {"u": 626, "v": 350, "kind": "stand", "name": "A1"},
        "S_A2": {"u": 699, "v": 350, "kind": "stand", "name": "A2"},
        "S_A3": {"u": 772, "v": 350, "kind": "stand", "name": "A3"},
        "S_A4": {"u": 845, "v": 346, "kind": "stand", "name": "A4"},
        "S_B1": {"u": 553, "v": 347, "kind": "stand", "name": "B1"},
        "S_B2": {"u": 482, "v": 304, "kind": "stand", "name": "B2"},
        "S_B3": {"u": 444, "v": 274, "kind": "stand", "name": "B3"},
        "S_B4": {"u": 620, "v": 202, "kind": "stand", "name": "B4"},
        "S_B5": {"u": 667, "v": 201, "kind": "stand", "name": "B5"},
        "S_C1": {"u": 948, "v": 193, "kind": "stand", "name": "C1"},
        "S_C2": {"u": 935, "v": 212, "kind": "stand", "name": "C2"},
        "S_C3": {"u": 902, "v": 212, "kind": "stand", "name": "C3"},
        "S_C4": {"u": 869, "v": 212, "kind": "stand", "name": "C4"},
        "S_C5": {"u": 832, "v": 200, "kind": "stand", "name": "C5"},
        "S_C6": {"u": 804, "v": 200, "kind": "stand", "name": "C6"},
        "S_C7": {"u": 803, "v": 138, "kind": "stand", "name": "C7"},
        "S_C8": {"u": 836, "v": 138, "kind": "stand", "name": "C8"},
        "S_C9": {"u": 868, "v": 139, "kind": "stand", "name": "C9"},
        "S_C10": {"u": 901, "v": 139, "kind": "stand", "name": "C10"},
        "S_C11": {"u": 998, "v": 159, "kind": "stand", "name": "C11"},
        "S_C12": {"u": 1031, "v": 159, "kind": "stand", "name": "C12"}
    },
    edges: [
        ["R_A", "H_A", "A"],
        ["H_A", "A1", "A"],
        ["A1", "A2", "A"],
        ["A2", "J_B", "A"],
        ["R_B", "H_B", "B"],
        ["H_B", "J_B", "B"],
        ["J_B", "B1", "B"],
        ["B1", "Bd1", null],
        ["Bd1", "Bd2", null],
        ["Bd2", "Bd3", null],
        ["Bd3", "Bd4", null],
        ["Bd4", "AL0", null],
        ["AL0", "AL1", null],
        ["AL1", "AL2", null],
        ["AL2", "AL3", null],
        ["AL3", "AL4", null],
        ["AL4", "AL5", null],
        ["R_C", "H_C", "C"],
        ["H_C", "C1", "C"],
        ["C1", "C2", "C"],
        ["C2", "C3", "C"],
        ["C3", "C4", null],
        ["C4", "AL4", null],
        ["C2", "BL5", null],
        ["BL5", "BL4", null],
        ["C3", "CS1", null],
        ["CS1", "CS2", null],
        ["CS2", "CS3", null],
        ["CS3", "CS4", null],
        ["CS4", "CS5", null],
        ["CS5", "CS6", null],
        ["CS6", "CS7", null],
        ["CS7", "CS8", null],
        ["R_D", "H_D", "D"],
        ["H_D", "D1", "D"],
        ["R_E", "H_E", "E"],
        ["H_E", "E1", "E"],
        ["C1", "DL0", null],
        ["DL0", "DL1", null],
        ["DL1", "D1", "D"],
        ["D1", "DL2", "D"],
        ["DL2", "DL3", null],
        ["DL3", "DL4", null],
        ["DL4", "DL5", null],
        ["DL5", "DL6", null],
        ["DL6", "E1", "E"],
        ["DL3", "CS8", null],
        ["AL1", "S_A1", null],
        ["AL2", "S_A2", null],
        ["AL4", "S_A3", null],
        ["AL5", "S_A4", null],
        ["Bd4", "S_B1", null],
        ["Bd3", "S_B2", null],
        ["Bd2", "S_B3", null],
        ["BL4", "S_B4", null],
        ["BL5", "S_B5", null],
        ["CS7", "S_C1", null],
        ["CS6", "S_C2", null],
        ["CS5", "S_C3", null],
        ["CS4", "S_C4", null],
        ["CS3", "S_C5", null],
        ["CS2", "S_C6", null],
        ["CS2", "S_C7", null],
        ["CS3", "S_C8", null],
        ["CS4", "S_C9", null],
        ["CS5", "S_C10", null],
        ["DL4", "S_C11", null],
        ["DL5", "S_C12", null]
    ],
    aprons: [[[51, 81], [81, 75], [81, 75], [99, 81], [99, 81], [108, 83], [108, 83], [121, 83], [121, 83], [178, 83], [178, 83], [277, 83], [277, 83], [280, 83], [280, 83], [102, 112], [102, 112], [100, 109], [100, 109], [98, 106], [98, 106], [95, 104], [95, 104], [95, 103], [95, 103], [84, 96], [84, 96], [51, 81]], [[105, 128], [373, 89], [373, 89], [375, 92], [375, 92], [377, 96], [377, 96], [379, 98], [379, 98], [381, 101], [381, 101], [331, 111], [331, 111], [329, 111], [329, 111], [328, 112], [328, 112], [327, 112], [327, 112], [326, 113], [326, 113], [325, 113], [325, 113], [325, 114], [325, 114], [324, 115], [324, 115], [323, 116], [323, 116], [323, 117], [323, 117], [323, 117], [323, 117], [322, 119], [322, 119], [321, 121], [321, 121], [321, 124], [321, 124], [188, 144], [188, 144], [168, 183], [168, 183], [144, 170], [144, 170], [136, 165], [136, 165], [105, 148], [105, 148], [105, 128], [105, 128], [105, 128]], [[388, 106], [391, 108], [391, 108], [410, 119], [410, 119], [579, 94], [579, 94], [596, 96], [596, 96], [694, 88], [694, 88], [696, 88], [696, 88], [698, 88], [698, 88], [700, 88], [700, 88], [368, 139], [368, 139], [347, 127], [347, 127], [337, 112], [337, 112], [336, 112], [336, 112], [335, 111], [335, 111], [334, 111], [334, 111], [333, 111], [333, 111], [332, 111], [332, 111], [331, 111], [331, 111], [381, 101], [381, 101], [385, 103], [385, 103], [388, 106]], [[463, 301], [873, 243], [873, 243], [873, 364], [873, 364], [572, 364], [572, 364], [558, 364], [558, 364], [539, 353], [539, 353], [521, 342], [521, 342], [516, 340], [516, 340], [508, 335], [508, 335], [502, 331], [502, 331], [494, 327], [494, 327], [463, 309], [463, 309], [463, 301]], [[873, 243], [463, 301], [463, 301], [463, 301], [463, 301], [459, 300], [459, 300], [455, 300], [455, 300], [451, 299], [451, 299], [447, 298], [447, 298], [443, 297], [443, 297], [439, 295], [439, 295], [436, 293], [436, 293], [432, 291], [432, 291], [431, 291], [431, 291], [431, 290], [431, 290], [433, 283], [433, 283], [434, 231], [434, 231], [1160, 134], [1160, 134], [983, 175], [983, 175], [976, 177], [976, 177], [975, 184], [975, 184], [974, 210], [974, 210], [974, 213], [974, 213], [971, 216], [971, 216], [945, 242], [945, 242], [943, 244], [943, 244], [940, 244], [940, 244], [873, 243]], [[983, 175], [1160, 134], [1160, 134], [1160, 164], [1160, 164], [1160, 170], [1160, 170], [1127, 175], [1127, 175], [1112, 175], [1112, 175], [1010, 175], [1010, 175], [1000, 175], [1000, 175], [983, 175]], [[1190, 116], [1403, 80], [1403, 80], [1403, 90], [1403, 90], [1403, 101], [1403, 101], [1392, 104], [1392, 104], [1378, 108], [1378, 108], [1357, 113], [1357, 113], [1340, 118], [1340, 118], [1315, 117], [1315, 117], [1299, 117], [1299, 117], [1280, 117], [1280, 117], [1268, 117], [1268, 117], [1190, 116]], [[188, 144], [321, 124], [321, 124], [320, 126], [320, 126], [320, 128], [320, 128], [320, 131], [320, 131], [319, 133], [319, 133], [320, 135], [320, 135], [319, 135], [319, 135], [319, 159], [319, 159], [319, 207], [319, 207], [275, 186], [275, 186], [211, 155], [211, 155], [190, 145], [190, 145], [188, 144]], [[2246, -93], [2157, -93], [2157, -93], [2151, -89], [2151, -89], [2150, -29], [2150, -29], [2143, -29], [2143, -29], [2143, -89], [2143, -89], [2136, -93], [2136, -93], [2124, -93], [2124, -93], [2124, -126], [2124, -126], [2288, -126], [2288, -126], [2288, -93], [2288, -93], [2282, -93], [2282, -93], [2281, -93], [2281, -93], [2280, -93], [2280, -93], [2279, -93], [2279, -93], [2275, -91], [2275, -91], [2272, -90], [2272, -90], [2270, -88], [2270, -88], [2267, -86], [2267, -86], [2265, -83], [2265, -83], [2263, -80], [2263, -80], [2233, -30], [2233, -30], [2220, -30], [2220, -30], [2252, -84], [2252, -84], [2252, -84], [2252, -84], [2252, -84], [2252, -84], [2252, -85], [2252, -85], [2252, -86], [2252, -86], [2252, -87], [2252, -87], [2252, -89], [2252, -89], [2251, -90], [2251, -90], [2250, -92], [2250, -92], [2248, -93], [2248, -93], [2247, -93], [2247, -93], [2246, -93]], [[2404, -80], [2333, -80], [2332, -80], [2330, -79], [2327, -78], [2324, -76], [2323, -76], [2322, -74], [2322, -74], [2322, -74], [2321, -73], [2296, -29], [2290, -29], [2318, -77], [2319, -79], [2321, -82], [2323, -83], [2325, -84], [2329, -85], [2330, -85], [2342, -85], [2344, -85], [2346, -86], [2348, -87], [2349, -88], [2350, -89], [2351, -91], [2352, -93], [2352, -95], [2343, -95], [2343, -123], [2348, -127], [2424, -127], [2423, -95], [2414, -95], [2413, -90], [2413, -88], [2413, -86], [2412, -85], [2411, -83], [2409, -82], [2408, -81], [2406, -81]]],
    gndView: [-150, 2450, -120, 470],
    reg: 'PJ-PJA',
    airlines: 'CARIB',
    destinations: ['Miami', 'New York', 'Charlotte', 'Anguilla', 'Curacao', 'Paris', 'Amsterdam'],
    chart: { aip: true, source: 'DC-ANSP eAIP AIRAC AMDT 03-26: Aerodrome Chart and Parking/Docking Chart P.1 (AERO INFO 17 APR 2025). Runway 10/28, taxiways A-E and Aprons A, B, C, E.' }
  };

  /* Kathmandu, Tribhuvan International (VNKT)                          */
  /* Source: CAAN eAIP VNKT AD 2: AD 2.12/2.13/2.18, Ground Movement Chart */
  /*   AD 2-21 (11 JUL 2025) and Parking Chart (International) AD 2-18. */
  /* Runway frame: u from the south end of RWY 02 (TORA start) to the north */
  /*   end, 3074 m, axis from the AD 2.12 thresholds (021.9 true). LDA 02 */
  /*   2774 m: the THR 02 coordinates are 300 m in (dthr 300).          */
  /* Bays 1-11: WGS-84 coordinates from the International Parking Chart. */
  /* Taxiway link positions: the GMC is small-scale, so link positions were */
  /*   scaled to the two published VOR checkpoints (TWY A and TWY E). The */
  /*   parallel is named F south of D and C along the bays (AD 2-18); the */
  /*   B-A section is named G (link TWY G on the GMC). Holding points are */
  /*   placed 90 m from the centreline. Treat them as approximate.      */
  /* Domestic apron, remote apron and H are not modelled.               */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.VNKT = {
    icao: 'VNKT', name: 'Kathmandu', city: 'Kathmandu', country: 'Nepal',
    elev: 4395,
    axisHdg: 21.9, length: 3074, width: 45,
    // AD 2.18 / GMC title block: TWR 118.1, GND 121.9, APP 120.6, ATIS 127.0.
    freqs: {'GND': '121.9', 'TWR': '118.1', 'APP': '120.6', 'ATIS': '127.0'},
    units: {'GND': 'Kathmandu Ground', 'TWR': 'Kathmandu Tower', 'APP': 'Kathmandu Approach'},
    runways: {
      '02': {'thrU': 0, 'dir': 1, 'hdg': 22, 'hold': 'E', 'backtrack': true, 'dthr': 300, 'exits': ['D', 'C', 'B', 'A'], 'pref': 0.7},
      '20': {'thrU': 3074, 'dir': -1, 'hdg': 202, 'hold': 'A', 'backtrack': true, 'exits': ['C', 'D', 'E'], 'pref': 0.3}
    },
    nodes: {
        "R_E": {"u": 1090, "v": 0, "kind": "rwy"},
        "H_E": {"u": 1090, "v": 90, "kind": "hold", "name": "E"},
        "J_E": {"u": 1090, "v": 130, "kind": "twy"},
        "R_D": {"u": 1482, "v": 0, "kind": "rwy"},
        "H_D": {"u": 1482, "v": 90, "kind": "hold", "name": "D"},
        "J_D": {"u": 1482, "v": 130, "kind": "twy"},
        "R_C": {"u": 2172, "v": 0, "kind": "rwy"},
        "H_C": {"u": 2172, "v": 90, "kind": "hold", "name": "C"},
        "J_C": {"u": 2172, "v": 130, "kind": "twy"},
        "R_B": {"u": 2475, "v": 0, "kind": "rwy"},
        "H_B": {"u": 2475, "v": 90, "kind": "hold", "name": "B"},
        "J_B": {"u": 2475, "v": 130, "kind": "twy"},
        "R_A": {"u": 2873, "v": 0, "kind": "rwy"},
        "H_A": {"u": 2873, "v": 90, "kind": "hold", "name": "A"},
        "J_A": {"u": 2873, "v": 130, "kind": "twy"},
        "S1": {"u": 1784, "v": 220, "kind": "stand", "name": "1"},
        "L1": {"u": 1784, "v": 130, "kind": "twy"},
        "S2": {"u": 1857, "v": 220, "kind": "stand", "name": "2"},
        "L2": {"u": 1857, "v": 130, "kind": "twy"},
        "S3": {"u": 1930, "v": 220, "kind": "stand", "name": "3"},
        "L3": {"u": 1930, "v": 130, "kind": "twy"},
        "S4": {"u": 2003, "v": 220, "kind": "stand", "name": "4"},
        "L4": {"u": 2003, "v": 130, "kind": "twy"},
        "S5": {"u": 2073, "v": 208, "kind": "stand", "name": "5"},
        "L5": {"u": 2073, "v": 130, "kind": "twy"},
        "S6": {"u": 2135, "v": 208, "kind": "stand", "name": "6"},
        "L6": {"u": 2135, "v": 130, "kind": "twy"},
        "S7": {"u": 2186, "v": 208, "kind": "stand", "name": "7"},
        "L7": {"u": 2186, "v": 130, "kind": "twy"},
        "S8": {"u": 2232, "v": 208, "kind": "stand", "name": "8"},
        "L8": {"u": 2232, "v": 130, "kind": "twy"},
        "S9": {"u": 2278, "v": 208, "kind": "stand", "name": "9"},
        "L9": {"u": 2278, "v": 130, "kind": "twy"},
        "S10": {"u": 2325, "v": 199, "kind": "stand", "name": "10"},
        "L10": {"u": 2325, "v": 130, "kind": "twy"},
        "S11": {"u": 2369, "v": 197, "kind": "stand", "name": "11"},
        "L11": {"u": 2369, "v": 130, "kind": "twy"}
    },
    edges: [
        ["R_E", "H_E", "E"],
        ["H_E", "J_E", "E"],
        ["R_D", "H_D", "D"],
        ["H_D", "J_D", "D"],
        ["R_C", "H_C", "C"],
        ["H_C", "J_C", "C"],
        ["R_B", "H_B", "B"],
        ["H_B", "J_B", "B"],
        ["R_A", "H_A", "A"],
        ["H_A", "J_A", "A"],
        ["L1", "S1", null],
        ["L2", "S2", null],
        ["L3", "S3", null],
        ["L4", "S4", null],
        ["L5", "S5", null],
        ["L6", "S6", null],
        ["L7", "S7", null],
        ["L8", "S8", null],
        ["L9", "S9", null],
        ["L10", "S10", null],
        ["L11", "S11", null],
        ["J_E", "J_D", "F"],
        ["J_D", "L1", "C"],
        ["L1", "L2", "C"],
        ["L2", "L3", "C"],
        ["L3", "L4", "C"],
        ["L4", "L5", "C"],
        ["L5", "L6", "C"],
        ["L6", "J_C", "C"],
        ["J_C", "L7", "C"],
        ["L7", "L8", "C"],
        ["L8", "L9", "C"],
        ["L9", "L10", "C"],
        ["L10", "L11", "C"],
        ["L11", "J_B", "C"],
        ["J_B", "J_A", "G"]
    ],
    aprons: [[[1740, 165], [2415, 165], [2415, 255], [1740, 255]]],
    gndView: [-150, 3224, -120, 340],
    reg: '9N-PJA',
    airlines: 'NEPAL',
    destinations: ['Pokhara', 'Bhairahawa', 'Biratnagar', 'Delhi', 'Doha', 'Dubai', 'Kuala Lumpur'],
    chart: { aip: true, source: 'CAAN eAIP VNKT AD 2 (charts AMDT 07/2025): Aerodrome Ground Movement Chart and International Parking Chart. Runway 02/20, parallel F/C and bays 1-11. Holding points approximate.' }
  };

  /* London Gatwick (EGKK)                                              */
  /* Source: UK AIP (NATS) AIRAC 11/2026: AD 2.12/2.13/2.18, Aerodrome Chart */
  /*   AD 2.EGKK-2-1, Parking/Docking Chart 2-2, Holding Areas chart 2-4. */
  /* Runway frame: u from the west end of 08R/26L to the east end, fitted on */
  /*   the runway drawn on the Aerodrome Chart (3317 m, 077.63 true).   */
  /*   Displaced thresholds 395 m (08R) and 425 m (26L), AD 2.12.       */
  /* Holding points J1 (08R) and A1 (26L) from chart 2-4. Exit taxiways FR, */
  /*   ER (26L) and D, C, B (08R) cross 08L/26R to Juliet. 08L/26R is drawn */
  /*   as an inactive runway and is not used for take-off or landing.   */
  /* Stands 130-136: positions read from chart 2-2, matched to the Aerodrome */
  /*   Chart on 22 holding-point labels (median error about 20 m).      */
  /* NOTE: holding positions and junctions were placed from chart labels at */
  /*   chart scale. Treat them as approximate.                          */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.EGKK = {
    icao: 'EGKK', name: 'London Gatwick', city: 'London', country: 'United Kingdom',
    elev: 203,
    axisHdg: 77.63, length: 3317, width: 45,
    // AD 2.18 (8.33 kHz channels as published): GROUND 121.805, TOWER 124.230, DIRECTOR 126.825, ATIS 136.525.
    freqs: {'GND': '121.805', 'TWR': '124.230', 'APP': '126.825', 'ATIS': '136.525'},
    units: {'GND': 'Gatwick Ground', 'TWR': 'Gatwick Tower', 'APP': 'Gatwick Director'},
    runways: {
      '08R': {'thrU': 0, 'dir': 1, 'hdg': 77, 'hold': 'J1', 'dthr': 395, 'exits': ['D', 'C', 'B'], 'pref': 0.3},
      '26L': {'thrU': 3317, 'dir': -1, 'hdg': 257, 'hold': 'A1', 'dthr': 425, 'exits': ['ER', 'FR'], 'pref': 0.7}
    },
    nodes: {
        "R_J1": {"u": 40, "v": 0, "kind": "rwy"},
        "H_J1": {"u": 40, "v": 85, "kind": "hold", "name": "J1"},
        "X_J1": {"u": 60, "v": 200, "kind": "twy"},
        "J_J1": {"u": 80, "v": 290, "kind": "twy"},
        "R_FR": {"u": 720, "v": 0, "kind": "rwy"},
        "H_FR": {"u": 640, "v": 85, "kind": "hold", "name": "FR"},
        "X_FR": {"u": 560, "v": 200, "kind": "twy"},
        "J_FR": {"u": 480, "v": 290, "kind": "twy"},
        "R_ER": {"u": 1150, "v": 0, "kind": "rwy"},
        "H_ER": {"u": 1060, "v": 85, "kind": "hold", "name": "ER"},
        "X_ER": {"u": 980, "v": 200, "kind": "twy"},
        "J_ER": {"u": 900, "v": 290, "kind": "twy"},
        "R_D": {"u": 1900, "v": 0, "kind": "rwy"},
        "H_D": {"u": 2000, "v": 95, "kind": "hold", "name": "D"},
        "X_D": {"u": 2080, "v": 200, "kind": "twy"},
        "J_D": {"u": 2150, "v": 295, "kind": "twy"},
        "R_C": {"u": 2540, "v": 0, "kind": "rwy"},
        "H_C": {"u": 2550, "v": 95, "kind": "hold", "name": "C"},
        "X_C": {"u": 2560, "v": 200, "kind": "twy"},
        "J_C": {"u": 2600, "v": 300, "kind": "twy"},
        "R_B": {"u": 2900, "v": 0, "kind": "rwy"},
        "H_B": {"u": 2960, "v": 90, "kind": "hold", "name": "B"},
        "X_B": {"u": 3000, "v": 200, "kind": "twy"},
        "J_B": {"u": 3050, "v": 330, "kind": "twy"},
        "R_A1": {"u": 3190, "v": 0, "kind": "rwy"},
        "H_A1": {"u": 3170, "v": 85, "kind": "hold", "name": "A1"},
        "X_A1": {"u": 3160, "v": 200, "kind": "twy"},
        "J_A1": {"u": 3150, "v": 345, "kind": "twy"},
        "JJ1": {"u": 1500, "v": 290, "kind": "twy"},
        "JJ2": {"u": 2830, "v": 305, "kind": "twy"},
        "JJ3": {"u": 3350, "v": 340, "kind": "twy"},
        "L136": {"u": 2424, "v": 298, "kind": "twy"},
        "S136": {"u": 2424, "v": 455, "kind": "stand", "name": "136"},
        "L135": {"u": 2475, "v": 299, "kind": "twy"},
        "S135": {"u": 2475, "v": 455, "kind": "stand", "name": "135"},
        "L134": {"u": 2532, "v": 299, "kind": "twy"},
        "S134": {"u": 2532, "v": 455, "kind": "stand", "name": "134"},
        "L133": {"u": 2594, "v": 300, "kind": "twy"},
        "S133": {"u": 2594, "v": 455, "kind": "stand", "name": "133"},
        "L132": {"u": 2651, "v": 301, "kind": "twy"},
        "S132": {"u": 2651, "v": 455, "kind": "stand", "name": "132"},
        "L131": {"u": 2717, "v": 302, "kind": "twy"},
        "S131": {"u": 2717, "v": 455, "kind": "stand", "name": "131"},
        "L130": {"u": 2778, "v": 304, "kind": "twy"},
        "S130": {"u": 2778, "v": 455, "kind": "stand", "name": "130"}
    },
    edges: [
        ["R_J1", "H_J1", "J"],
        ["H_J1", "X_J1", "J"],
        ["X_J1", "J_J1", "J"],
        ["R_FR", "H_FR", "FR"],
        ["H_FR", "X_FR", "FR"],
        ["X_FR", "J_FR", "FR"],
        ["R_ER", "H_ER", "E"],
        ["H_ER", "X_ER", "E"],
        ["X_ER", "J_ER", "E"],
        ["R_D", "H_D", "D"],
        ["H_D", "X_D", "D"],
        ["X_D", "J_D", "D"],
        ["R_C", "H_C", "C"],
        ["H_C", "X_C", "C"],
        ["X_C", "J_C", "C"],
        ["R_B", "H_B", "B"],
        ["H_B", "X_B", "B"],
        ["X_B", "J_B", "B"],
        ["R_A1", "H_A1", "A"],
        ["H_A1", "X_A1", "A"],
        ["X_A1", "J_A1", "A"],
        ["L136", "S136", null],
        ["L135", "S135", null],
        ["L134", "S134", null],
        ["L133", "S133", null],
        ["L132", "S132", null],
        ["L131", "S131", null],
        ["L130", "S130", null],
        ["J_J1", "J_FR", "J"],
        ["J_FR", "J_ER", "J"],
        ["J_ER", "JJ1", "J"],
        ["JJ1", "J_D", "J"],
        ["J_D", "L136", "J"],
        ["L136", "L135", "J"],
        ["L135", "L134", "J"],
        ["L134", "L133", "J"],
        ["L133", "J_C", "J"],
        ["J_C", "L132", "J"],
        ["L132", "L131", "J"],
        ["L131", "L130", "J"],
        ["L130", "JJ2", "J"],
        ["JJ2", "J_B", "J"],
        ["J_B", "J_A1", "J"],
        ["J_A1", "JJ3", "J"]
    ],
    aprons: [[[2390, 400], [2810, 400], [2810, 500], [2390, 500]]],
    decor: [{'kind': 'runway', 'width': 45, 'pts': [[21, 198], [2585, 199]], 'label': ['26R', '08L']}],
    gndView: [-150, 3500, -120, 575],
    reg: 'G-PJAA',
    airlines: 'UK',
    destinations: ['Edinburgh', 'Glasgow', 'Belfast', 'Amsterdam', 'Barcelona', 'Malaga', 'Geneva', 'Paris'],
    chart: { aip: true, source: 'UK AIP AIRAC 11/2026: AD 2.EGKK-2-1, 2-2, 2-4. Runway 08R/26L with Juliet and the remote stands 130-136; 08L/26R drawn only. Positions approximate.' }
  };

  /* Dubai International (OMDB)                                         */
  /* Source: UAE GCAA eAIP AIRAC 12/2026 (effective 26 NOV 26): AD 2.12/2.18, */
  /*   Aerodrome Chart AD 2-21, Parking/Docking Chart AD 2-22A.         */
  /* Runway frame: u from the south-east end of 12R/30L (RWY END 12R,   */
  /*   25 14 07.06N 055 23 45.61E) to the north-west end (RWY END 30L,  */
  /*   25 15 22.30N 055 21 29.92E), 4447 m. +v is south-west, towards the */
  /*   concourses. Displaced thresholds: 12R 715 m, 30L 132 m (AD 2.12). */
  /* Apron A stands A2-A10: WGS-84 coordinates from AD 2-22A (A1 omitted). */
  /* Links K1-K17 and taxiway K placed from the chart labels; holding   */
  /*   points 115 m from the centreline. 12L/30R is drawn only.         */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.OMDB = {
    icao: 'OMDB', name: 'Dubai', city: 'Dubai', country: 'United Arab Emirates',
    elev: 62,
    axisHdg: 301.51, length: 4447, width: 60,
    // AD 2.18: DUBAI TOWER 119.550 (Air South), DUBAI GROUND 118.350 (GMC-1), DUBAI DEPARTURES SOUTH 121.025, D-ATIS 131.700 (DEP).
    freqs: {'GND': '118.350', 'TWR': '119.550', 'APP': '121.025', 'ATIS': '131.700'},
    units: {'GND': 'Dubai Ground', 'TWR': 'Dubai Tower', 'APP': 'Dubai Departures'},
    runways: {
      '30L': {'thrU': 0, 'dir': 1, 'hdg': 299, 'hold': 'K17', 'dthr': 132, 'exits': ['K11', 'K10', 'K9', 'K8', 'K7'], 'pref': 0.5},
      '12R': {'thrU': 4447, 'dir': -1, 'hdg': 119, 'hold': 'K1', 'dthr': 715, 'exits': ['K7', 'K8', 'K9', 'K10', 'K12', 'K13', 'K14'], 'pref': 0.5}
    },
    nodes: {
        "R_K1": {"u": 4400, "v": 0, "kind": "rwy"},
        "H_K1": {"u": 4400, "v": 115, "kind": "hold", "name": "K1"},
        "J_K1": {"u": 4400, "v": 200, "kind": "twy"},
        "R_K3": {"u": 3850, "v": 0, "kind": "rwy"},
        "H_K3": {"u": 3850, "v": 115, "kind": "hold", "name": "K3"},
        "J_K3": {"u": 3850, "v": 200, "kind": "twy"},
        "R_K5": {"u": 3600, "v": 0, "kind": "rwy"},
        "H_K5": {"u": 3600, "v": 115, "kind": "hold", "name": "K5"},
        "J_K5": {"u": 3600, "v": 200, "kind": "twy"},
        "R_K6": {"u": 3340, "v": 0, "kind": "rwy"},
        "H_K6": {"u": 3340, "v": 115, "kind": "hold", "name": "K6"},
        "J_K6": {"u": 3340, "v": 200, "kind": "twy"},
        "R_K7": {"u": 3010, "v": 0, "kind": "rwy"},
        "H_K7": {"u": 3010, "v": 115, "kind": "hold", "name": "K7"},
        "J_K7": {"u": 3010, "v": 200, "kind": "twy"},
        "R_K8": {"u": 2850, "v": 0, "kind": "rwy"},
        "H_K8": {"u": 2850, "v": 115, "kind": "hold", "name": "K8"},
        "J_K8": {"u": 2850, "v": 200, "kind": "twy"},
        "R_K9": {"u": 2560, "v": 0, "kind": "rwy"},
        "H_K9": {"u": 2560, "v": 115, "kind": "hold", "name": "K9"},
        "J_K9": {"u": 2560, "v": 200, "kind": "twy"},
        "R_K10": {"u": 2130, "v": 0, "kind": "rwy"},
        "H_K10": {"u": 2130, "v": 115, "kind": "hold", "name": "K10"},
        "J_K10": {"u": 2130, "v": 200, "kind": "twy"},
        "R_K11": {"u": 1960, "v": 0, "kind": "rwy"},
        "H_K11": {"u": 1960, "v": 115, "kind": "hold", "name": "K11"},
        "J_K11": {"u": 1960, "v": 200, "kind": "twy"},
        "R_K12": {"u": 1760, "v": 0, "kind": "rwy"},
        "H_K12": {"u": 1760, "v": 115, "kind": "hold", "name": "K12"},
        "J_K12": {"u": 1760, "v": 200, "kind": "twy"},
        "R_K13": {"u": 1330, "v": 0, "kind": "rwy"},
        "H_K13": {"u": 1330, "v": 115, "kind": "hold", "name": "K13"},
        "J_K13": {"u": 1330, "v": 200, "kind": "twy"},
        "R_K14": {"u": 1100, "v": 0, "kind": "rwy"},
        "H_K14": {"u": 1100, "v": 115, "kind": "hold", "name": "K14"},
        "J_K14": {"u": 1100, "v": 200, "kind": "twy"},
        "R_K16": {"u": 140, "v": 0, "kind": "rwy"},
        "H_K16": {"u": 140, "v": 115, "kind": "hold", "name": "K16"},
        "J_K16": {"u": 140, "v": 200, "kind": "twy"},
        "R_K17": {"u": 20, "v": 0, "kind": "rwy"},
        "H_K17": {"u": 20, "v": 115, "kind": "hold", "name": "K17"},
        "J_K17": {"u": 20, "v": 200, "kind": "twy"},
        "Z_J2": {"u": 3000, "v": 330, "kind": "twy"},
        "K_J3": {"u": 2000, "v": 200, "kind": "twy"},
        "Z_J3": {"u": 2000, "v": 330, "kind": "twy"},
        "ZL_A2": {"u": 2842, "v": 330, "kind": "twy"},
        "S_A2": {"u": 2842, "v": 428, "kind": "stand", "name": "A2"},
        "ZL_A3": {"u": 2768, "v": 330, "kind": "twy"},
        "S_A3": {"u": 2768, "v": 426, "kind": "stand", "name": "A3"},
        "ZL_A4": {"u": 2657, "v": 330, "kind": "twy"},
        "S_A4": {"u": 2657, "v": 426, "kind": "stand", "name": "A4"},
        "ZL_A5": {"u": 2569, "v": 330, "kind": "twy"},
        "S_A5": {"u": 2569, "v": 426, "kind": "stand", "name": "A5"},
        "ZL_A6": {"u": 2480, "v": 330, "kind": "twy"},
        "S_A6": {"u": 2480, "v": 426, "kind": "stand", "name": "A6"},
        "ZL_A7": {"u": 2391, "v": 330, "kind": "twy"},
        "S_A7": {"u": 2391, "v": 426, "kind": "stand", "name": "A7"},
        "ZL_A8": {"u": 2302, "v": 330, "kind": "twy"},
        "S_A8": {"u": 2302, "v": 426, "kind": "stand", "name": "A8"},
        "ZL_A9": {"u": 2213, "v": 330, "kind": "twy"},
        "S_A9": {"u": 2213, "v": 426, "kind": "stand", "name": "A9"},
        "ZL_A10": {"u": 2140, "v": 330, "kind": "twy"},
        "S_A10": {"u": 2140, "v": 430, "kind": "stand", "name": "A10"}
    },
    edges: [
        ["R_K1", "H_K1", "K1"],
        ["H_K1", "J_K1", "K1"],
        ["R_K3", "H_K3", "K3"],
        ["H_K3", "J_K3", "K3"],
        ["R_K5", "H_K5", "K5"],
        ["H_K5", "J_K5", "K5"],
        ["R_K6", "H_K6", "K6"],
        ["H_K6", "J_K6", "K6"],
        ["R_K7", "H_K7", "K7"],
        ["H_K7", "J_K7", "K7"],
        ["R_K8", "H_K8", "K8"],
        ["H_K8", "J_K8", "K8"],
        ["R_K9", "H_K9", "K9"],
        ["H_K9", "J_K9", "K9"],
        ["R_K10", "H_K10", "K10"],
        ["H_K10", "J_K10", "K10"],
        ["R_K11", "H_K11", "K11"],
        ["H_K11", "J_K11", "K11"],
        ["R_K12", "H_K12", "K12"],
        ["H_K12", "J_K12", "K12"],
        ["R_K13", "H_K13", "K13"],
        ["H_K13", "J_K13", "K13"],
        ["R_K14", "H_K14", "K14"],
        ["H_K14", "J_K14", "K14"],
        ["R_K16", "H_K16", "K16"],
        ["H_K16", "J_K16", "K16"],
        ["R_K17", "H_K17", "K17"],
        ["H_K17", "J_K17", "K17"],
        ["J_K17", "J_K16", "K"],
        ["J_K16", "J_K14", "K"],
        ["J_K14", "J_K13", "K"],
        ["J_K13", "J_K12", "K"],
        ["J_K12", "J_K11", "K"],
        ["J_K10", "J_K9", "K"],
        ["J_K9", "J_K8", "K"],
        ["J_K8", "J_K7", "K"],
        ["J_K7", "J_K6", "K"],
        ["J_K6", "J_K5", "K"],
        ["J_K5", "J_K3", "K"],
        ["J_K3", "J_K1", "K"],
        ["J_K7", "Z_J2", "J2"],
        ["K_J3", "Z_J3", "J3"],
        ["J_K11", "K_J3", "K"],
        ["K_J3", "J_K10", "K"],
        ["ZL_A2", "S_A2", null],
        ["ZL_A3", "S_A3", null],
        ["ZL_A4", "S_A4", null],
        ["ZL_A5", "S_A5", null],
        ["ZL_A6", "S_A6", null],
        ["ZL_A7", "S_A7", null],
        ["ZL_A8", "S_A8", null],
        ["ZL_A9", "S_A9", null],
        ["ZL_A10", "S_A10", null],
        ["Z_J3", "ZL_A10", "Z"],
        ["ZL_A10", "ZL_A9", "Z"],
        ["ZL_A9", "ZL_A8", "Z"],
        ["ZL_A8", "ZL_A7", "Z"],
        ["ZL_A7", "ZL_A6", "Z"],
        ["ZL_A6", "ZL_A5", "Z"],
        ["ZL_A5", "ZL_A4", "Z"],
        ["ZL_A4", "ZL_A3", "Z"],
        ["ZL_A3", "ZL_A2", "Z"],
        ["ZL_A2", "Z_J2", "Z"]
    ],
    aprons: [[[2080, 360], [2900, 360], [2900, 470], [2080, 470]]],
    decor: [{'kind': 'runway', 'width': 60, 'pts': [[1714, -385], [6064, -385]], 'label': ['12L', '30R']}],
    gndView: [-150, 4597, -120, 550],
    reg: 'A6-PJA',
    airlines: 'UAE',
    destinations: ['Muscat', 'Doha', 'Riyadh', 'Bahrain', 'Kuwait', 'Mumbai', 'Karachi'],
    chart: { aip: true, source: 'UAE GCAA eAIP AIRAC 12/2026: OMDB AD 2-21 and Parking/Docking Chart AD 2-22A. Runway 12R/30L with taxiway K, J2/J3, Z and Apron A; 12L/30R drawn only.' }
  };

  /* Singapore Changi (WSSS)                                            */
  /* Source: CAAS eAIP (29 OCT 2026): Aerodrome Chart AD-2-WSSS-ADC-2 (page 1 */
  /*   plan, page 2 stand coordinates), ADC-1, AD 2.12/2.18.            */
  /* Runway frame: u from THR 02C (01 19 43.51N 103 59 05.86E) to THR 20C */
  /*   (01 21 43.37N 103 59 56.46E), 4000 m, 023.01 true. +v is west.   */
  /* Stands 200-203 and 205-208 (East and South-East Remote Aprons): WGS-84 from */
  /*   ADC-2 page 2 (they sit on the chart within a few metres).        */
  /* Taxiway T, links T2-T12 (T5 and T4 are rapid exits for 02C, T6-T8 for 20C), R5 and taxilanes R7, R8 traced from ADC-2. */
  /* 02L/20R and 02R/20L are drawn only. 02R/20L is not available for civil */
  /*   use (ADC-1 caution).                                             */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.WSSS = {
    icao: 'WSSS', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore',
    elev: 22,
    axisHdg: 23.01, length: 4000, width: 60,
    // AD 2.18: SINGAPORE TOWER 118.25 (RWY 02C/20C), SINGAPORE GROUND 121.725, SINGAPORE DEPARTURE 120.3, D-ATIS DEP 128.6.
    freqs: {'GND': '121.725', 'TWR': '118.25', 'APP': '120.3', 'ATIS': '128.6'},
    units: {'GND': 'Singapore Ground', 'TWR': 'Singapore Tower', 'APP': 'Singapore Departure'},
    runways: {
      '02C': {'thrU': 0, 'dir': 1, 'hdg': 23, 'hold': 'T12', 'exits': ['T5', 'T4', 'T3', 'T2'], 'pref': 0.5},
      '20C': {'thrU': 4000, 'dir': -1, 'hdg': 203, 'hold': 'T2', 'exits': ['T6', 'T7', 'T8', 'T10'], 'pref': 0.5}
    },
    nodes: {
        "R_T12": {"u": 15, "v": 0, "kind": "rwy"},
        "H_T12": {"u": 15, "v": 125, "kind": "hold", "name": "T12"},
        "J_T12": {"u": 15, "v": 200, "kind": "twy"},
        "R_T11": {"u": 150, "v": 0, "kind": "rwy"},
        "H_T11": {"u": 150, "v": 125, "kind": "hold", "name": "T11"},
        "J_T11": {"u": 150, "v": 200, "kind": "twy"},
        "R_T10": {"u": 570, "v": 0, "kind": "rwy"},
        "H_T10": {"u": 570, "v": 125, "kind": "hold", "name": "T10"},
        "J_T10": {"u": 570, "v": 200, "kind": "twy"},
        "R_T8": {"u": 1430, "v": 0, "kind": "rwy"},
        "H_T8": {"u": 1360, "v": 125, "kind": "hold", "name": "T8"},
        "J_T8": {"u": 1300, "v": 200, "kind": "twy"},
        "R_T7": {"u": 1800, "v": 0, "kind": "rwy"},
        "H_T7": {"u": 1700, "v": 125, "kind": "hold", "name": "T7"},
        "J_T7": {"u": 1640, "v": 200, "kind": "twy"},
        "R_T6": {"u": 2620, "v": 0, "kind": "rwy"},
        "H_T6": {"u": 2520, "v": 125, "kind": "hold", "name": "T6"},
        "J_T6": {"u": 2460, "v": 200, "kind": "twy"},
        "R_T5": {"u": 2650, "v": 0, "kind": "rwy"},
        "H_T5": {"u": 2860, "v": 110, "kind": "hold", "name": "T5"},
        "J_T5": {"u": 2980, "v": 200, "kind": "twy"},
        "R_T4": {"u": 3380, "v": 0, "kind": "rwy"},
        "H_T4": {"u": 3560, "v": 140, "kind": "hold", "name": "T4"},
        "J_T4": {"u": 3620, "v": 200, "kind": "twy"},
        "R_T3": {"u": 3820, "v": 0, "kind": "rwy"},
        "H_T3": {"u": 3820, "v": 125, "kind": "hold", "name": "T3"},
        "J_T3": {"u": 3820, "v": 200, "kind": "twy"},
        "R_T2": {"u": 3975, "v": 0, "kind": "rwy"},
        "H_T2": {"u": 3975, "v": 125, "kind": "hold", "name": "T2"},
        "J_T2": {"u": 3975, "v": 200, "kind": "twy"},
        "T_R5": {"u": 2090, "v": 200, "kind": "twy"},
        "R8_e": {"u": 2090, "v": 300, "kind": "twy"},
        "R8_205": {"u": 1845, "v": 300, "kind": "twy"},
        "S_205": {"u": 1845, "v": 407, "kind": "stand", "name": "205"},
        "R8_206": {"u": 1917, "v": 300, "kind": "twy"},
        "S_206": {"u": 1917, "v": 407, "kind": "stand", "name": "206"},
        "R8_207": {"u": 1990, "v": 300, "kind": "twy"},
        "S_207": {"u": 1990, "v": 403, "kind": "stand", "name": "207"},
        "R8_208": {"u": 2072, "v": 300, "kind": "twy"},
        "S_208": {"u": 2072, "v": 403, "kind": "stand", "name": "208"},
        "R7_e": {"u": 2090, "v": 500, "kind": "twy"},
        "R7_200": {"u": 1891, "v": 500, "kind": "twy"},
        "S_200": {"u": 1891, "v": 607, "kind": "stand", "name": "200"},
        "R7_201": {"u": 1964, "v": 500, "kind": "twy"},
        "S_201": {"u": 1964, "v": 606, "kind": "stand", "name": "201"},
        "R7_202": {"u": 2042, "v": 500, "kind": "twy"},
        "S_202": {"u": 2042, "v": 607, "kind": "stand", "name": "202"},
        "R7_203": {"u": 2114, "v": 500, "kind": "twy"},
        "S_203": {"u": 2114, "v": 608, "kind": "stand", "name": "203"}
    },
    edges: [
        ["R_T12", "H_T12", "T12"],
        ["H_T12", "J_T12", "T12"],
        ["R_T11", "H_T11", "T11"],
        ["H_T11", "J_T11", "T11"],
        ["R_T10", "H_T10", "T10"],
        ["H_T10", "J_T10", "T10"],
        ["R_T8", "H_T8", "T8"],
        ["H_T8", "J_T8", "T8"],
        ["R_T7", "H_T7", "T7"],
        ["H_T7", "J_T7", "T7"],
        ["R_T6", "H_T6", "T6"],
        ["H_T6", "J_T6", "T6"],
        ["R_T5", "H_T5", "T5"],
        ["H_T5", "J_T5", "T5"],
        ["R_T4", "H_T4", "T4"],
        ["H_T4", "J_T4", "T4"],
        ["R_T3", "H_T3", "T3"],
        ["H_T3", "J_T3", "T3"],
        ["R_T2", "H_T2", "T2"],
        ["H_T2", "J_T2", "T2"],
        ["J_T12", "J_T11", "T"],
        ["J_T11", "J_T10", "T"],
        ["J_T10", "J_T8", "T"],
        ["J_T8", "J_T7", "T"],
        ["J_T7", "T_R5", "T"],
        ["T_R5", "J_T6", "T"],
        ["J_T6", "J_T5", "T"],
        ["J_T5", "J_T4", "T"],
        ["J_T4", "J_T3", "T"],
        ["J_T3", "J_T2", "T"],
        ["T_R5", "R8_e", "R5"],
        ["R8_205", "S_205", null],
        ["R8_206", "S_206", null],
        ["R8_207", "S_207", null],
        ["R8_208", "S_208", null],
        ["R8_205", "R8_206", "R8"],
        ["R8_206", "R8_207", "R8"],
        ["R8_207", "R8_208", "R8"],
        ["R8_208", "R8_e", "R8"],
        ["R8_e", "R7_e", "R5"],
        ["R7_200", "S_200", null],
        ["R7_201", "S_201", null],
        ["R7_202", "S_202", null],
        ["R7_203", "S_203", null],
        ["R7_200", "R7_201", "R7"],
        ["R7_201", "R7_202", "R7"],
        ["R7_202", "R7_e", "R7"],
        ["R7_e", "R7_203", "R7"]
    ],
    aprons: [[[1800, 350], [2130, 350], [2130, 450], [1800, 450]], [[1840, 560], [2160, 560], [2160, 650], [1840, 650]]],
    decor: [{'kind': 'runway', 'width': 60, 'pts': [[1738, 1643], [5740, 1643]], 'label': ['20R', '02L']}, {'kind': 'runway', 'width': 60, 'pts': [[-9, -1800], [3991, -1800]], 'label': ['20L', '02R']}],
    gndView: [-150, 4150, -120, 728],
    reg: '9V-PJA',
    airlines: 'SG',
    destinations: ['Kuala Lumpur', 'Jakarta', 'Bangkok', 'Penang', 'Bali', 'Manila', 'Hong Kong'],
    chart: { aip: true, source: 'CAAS eAIP 29 OCT 2026: AD-2-WSSS-ADC-2 (both pages) and ADC-1. Runway 02C/20C with taxiway T and the South-East and East Remote Aprons; 02L/20R and 02R/20L drawn only.' }
  };

  /* Hong Kong International (VHHH)                                     */
  /* Source: Hong Kong CAD eAIP (29 OCT 2026, AMDT 11/26): Aerodrome Chart */
  /*   AD 2-VHHH-ADC-1 (threshold table), Parking/Docking Chart ADC-4.  */
  /* Runway frame: u from the east end of 07R/25L (THR 25L 22 18 26.75N */
  /*   113 55 58.15E) to the west end, 3800 m, 250.9 true. +v is south, the */
  /*   side of the cargo apron. THR 07R displaced 160 m (ADC-1).        */
  /* Taxiway K, links K1-K7 and taxilanes L1-L3/L traced from ADC-1     */
  /*   (fitted on the runway). Stands X24-X35: ADC-4 is not to scale, so */
  /*   their spacing is scaled between taxilanes L1, L2 and L3. Approximate. */
  /* 07C/25C is drawn only (threshold coordinates from ADC-1).          */
  /* Ground: five GMC channels are published; 121.6 is used here.       */
  /* Training simulation, not for navigation.                           */
  AIRPORTS.VHHH = {
    icao: 'VHHH', name: 'Hong Kong', city: 'Hong Kong', country: 'Hong Kong, China',
    elev: 28,
    axisHdg: 250.9, length: 3800, width: 60,
    // AD 2.18: HONG KONG TOWER 118.4 (South Runway), HONG KONG GROUND 121.6 (one of five GMC channels), DEPARTURE 123.8, ATIS DEP 127.05.
    freqs: {'GND': '121.6', 'TWR': '118.4', 'APP': '123.8', 'ATIS': '127.05'},
    units: {'GND': 'Hong Kong Ground', 'TWR': 'Hong Kong Tower', 'APP': 'Hong Kong Departure'},
    runways: {
      '25L': {'thrU': 0, 'dir': 1, 'hdg': 254, 'hold': 'K7', 'exits': ['K4', 'K3', 'K2'], 'pref': 0.6},
      '07R': {'thrU': 3800, 'dir': -1, 'hdg': 74, 'hold': 'K1', 'dthr': 160, 'exits': ['K4', 'K5', 'K6'], 'pref': 0.4}
    },
    nodes: {
        "R_K1": {"u": 3775, "v": 0, "kind": "rwy"},
        "H_K1": {"u": 3775, "v": 95, "kind": "hold", "name": "K1"},
        "J_K1": {"u": 3775, "v": 215, "kind": "twy"},
        "R_K2": {"u": 2950, "v": 0, "kind": "rwy"},
        "H_K2": {"u": 3100, "v": 105, "kind": "hold", "name": "K2"},
        "J_K2": {"u": 3200, "v": 215, "kind": "twy"},
        "R_K3": {"u": 2450, "v": 0, "kind": "rwy"},
        "H_K3": {"u": 2570, "v": 105, "kind": "hold", "name": "K3"},
        "J_K3": {"u": 2680, "v": 215, "kind": "twy"},
        "R_K4": {"u": 1910, "v": 0, "kind": "rwy"},
        "H_K4": {"u": 1910, "v": 95, "kind": "hold", "name": "K4"},
        "J_K4": {"u": 1910, "v": 215, "kind": "twy"},
        "R_K5": {"u": 1150, "v": 0, "kind": "rwy"},
        "H_K5": {"u": 1010, "v": 90, "kind": "hold", "name": "K5"},
        "J_K5": {"u": 900, "v": 215, "kind": "twy"},
        "R_K6": {"u": 700, "v": 0, "kind": "rwy"},
        "H_K6": {"u": 560, "v": 100, "kind": "hold", "name": "K6"},
        "J_K6": {"u": 450, "v": 215, "kind": "twy"},
        "R_K7": {"u": 10, "v": 0, "kind": "rwy"},
        "H_K7": {"u": 10, "v": 95, "kind": "hold", "name": "K7"},
        "J_K7": {"u": 10, "v": 215, "kind": "twy"},
        "K_L1": {"u": 1870, "v": 215, "kind": "twy"},
        "L_L1": {"u": 1870, "v": 390, "kind": "twy"},
        "K_L2": {"u": 1490, "v": 215, "kind": "twy"},
        "L_L2": {"u": 1490, "v": 390, "kind": "twy"},
        "K_L3": {"u": 740, "v": 215, "kind": "twy"},
        "L_L3": {"u": 740, "v": 390, "kind": "twy"},
        "LL_X35": {"u": 1770, "v": 390, "kind": "twy"},
        "S_X35": {"u": 1770, "v": 305, "kind": "stand", "name": "X35"},
        "LL_X34": {"u": 1698, "v": 390, "kind": "twy"},
        "S_X34": {"u": 1698, "v": 305, "kind": "stand", "name": "X34"},
        "LL_X33": {"u": 1607, "v": 390, "kind": "twy"},
        "S_X33": {"u": 1607, "v": 305, "kind": "stand", "name": "X33"},
        "LL_X31": {"u": 1392, "v": 390, "kind": "twy"},
        "S_X31": {"u": 1392, "v": 305, "kind": "stand", "name": "X31"},
        "LL_X30": {"u": 1317, "v": 390, "kind": "twy"},
        "S_X30": {"u": 1317, "v": 305, "kind": "stand", "name": "X30"},
        "LL_X29": {"u": 1241, "v": 390, "kind": "twy"},
        "S_X29": {"u": 1241, "v": 305, "kind": "stand", "name": "X29"},
        "LL_X28": {"u": 1140, "v": 390, "kind": "twy"},
        "S_X28": {"u": 1140, "v": 305, "kind": "stand", "name": "X28"},
        "LL_X27": {"u": 1067, "v": 390, "kind": "twy"},
        "S_X27": {"u": 1067, "v": 305, "kind": "stand", "name": "X27"},
        "LL_X26": {"u": 991, "v": 390, "kind": "twy"},
        "S_X26": {"u": 991, "v": 305, "kind": "stand", "name": "X26"},
        "LL_X25": {"u": 916, "v": 390, "kind": "twy"},
        "S_X25": {"u": 916, "v": 305, "kind": "stand", "name": "X25"},
        "LL_X24": {"u": 842, "v": 390, "kind": "twy"},
        "S_X24": {"u": 842, "v": 305, "kind": "stand", "name": "X24"}
    },
    edges: [
        ["R_K1", "H_K1", "K1"],
        ["H_K1", "J_K1", "K1"],
        ["R_K2", "H_K2", "K2"],
        ["H_K2", "J_K2", "K2"],
        ["R_K3", "H_K3", "K3"],
        ["H_K3", "J_K3", "K3"],
        ["R_K4", "H_K4", "K4"],
        ["H_K4", "J_K4", "K4"],
        ["R_K5", "H_K5", "K5"],
        ["H_K5", "J_K5", "K5"],
        ["R_K6", "H_K6", "K6"],
        ["H_K6", "J_K6", "K6"],
        ["R_K7", "H_K7", "K7"],
        ["H_K7", "J_K7", "K7"],
        ["K_L1", "L_L1", "L1"],
        ["K_L2", "L_L2", "L2"],
        ["K_L3", "L_L3", "L3"],
        ["J_K1", "J_K2", "K"],
        ["J_K2", "J_K3", "K"],
        ["J_K3", "J_K4", "K"],
        ["J_K4", "K_L1", "K"],
        ["K_L1", "K_L2", "K"],
        ["K_L2", "J_K5", "K"],
        ["J_K5", "K_L3", "K"],
        ["K_L3", "J_K6", "K"],
        ["J_K6", "J_K7", "K"],
        ["LL_X35", "S_X35", null],
        ["LL_X34", "S_X34", null],
        ["LL_X33", "S_X33", null],
        ["LL_X31", "S_X31", null],
        ["LL_X30", "S_X30", null],
        ["LL_X29", "S_X29", null],
        ["LL_X28", "S_X28", null],
        ["LL_X27", "S_X27", null],
        ["LL_X26", "S_X26", null],
        ["LL_X25", "S_X25", null],
        ["LL_X24", "S_X24", null],
        ["L_L1", "LL_X35", "L"],
        ["LL_X35", "LL_X34", "L"],
        ["LL_X34", "LL_X33", "L"],
        ["LL_X33", "L_L2", "L"],
        ["L_L2", "LL_X31", "L"],
        ["LL_X31", "LL_X30", "L"],
        ["LL_X30", "LL_X29", "L"],
        ["LL_X29", "LL_X28", "L"],
        ["LL_X28", "LL_X27", "L"],
        ["LL_X27", "LL_X26", "L"],
        ["LL_X26", "LL_X25", "L"],
        ["LL_X25", "LL_X24", "L"],
        ["LL_X24", "L_L3", "L"]
    ],
    aprons: [[[1810, 270], [800, 270], [800, 345], [1810, 345]]],
    decor: [{'kind': 'runway', 'width': 60, 'pts': [[-59, -1546], [3314, -1546]], 'label': ['07C', '25C']}],
    gndView: [-150, 3950, -120, 510],
    reg: 'B-HPJ',
    airlines: 'HK',
    destinations: ['Taipei', 'Manila', 'Bangkok', 'Tokyo', 'Seoul', 'Singapore', 'Shanghai', 'Osaka'],
    chart: { aip: true, source: 'Hong Kong CAD eAIP 29 OCT 2026: AD 2-VHHH-ADC-1 and ADC-4. South runway 07R/25L with taxiway K, taxilanes L1-L3/L and stands X24-X35; 07C/25C drawn only.' }
  };

  /* Airline groups for AI traffic. tel = radiotelephony designator; keys = how it may be heard. */
  var AIRLINE_SETS = {
    INDIA: [
      { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320', 'A320', 'AT72'] },
      { tel: 'Air India', keys: ['airindia'], types: ['A320'] },
      { tel: 'Akasa Air', keys: ['akasaair', 'akasa'], types: ['B738'] },
      { tel: 'Spicejet', keys: ['spicejet'], types: ['B738'] },
      { tel: 'Allied', keys: ['allied', 'allianceair'], types: ['AT72'] }
    ],
    // Telephony designators below are from general knowledge (ICAO Doc 8585), not from the AIPs. Check before relying on them.
    UK: [
      { tel: 'Easy', keys: ['easy', 'easyjet'], types: ['A320'] },
      { tel: 'Speedbird', keys: ['speedbird', 'britishairways'], types: ['A320'] },
      { tel: 'Wizz Air', keys: ['wizzair', 'wizz'], types: ['A320'] },
      { tel: 'Tomjet', keys: ['tomjet', 'tui'], types: ['B738'] },
      { tel: 'Vueling', keys: ['vueling'], types: ['A320'] }
    ],
    AUSTRIA: [
      { tel: 'Austrian', keys: ['austrian'], types: ['A320'] },
      { tel: 'Eurowings', keys: ['eurowings'], types: ['A320'] },
      { tel: 'Easy', keys: ['easy', 'easyjet'], types: ['A320'] },
      { tel: 'Transavia', keys: ['transavia'], types: ['B738'] }
    ],
    CARIB: [
      { tel: 'American', keys: ['american'], types: ['B738', 'A320'] },
      { tel: 'Jetblue', keys: ['jetblue'], types: ['A320'] },
      { tel: 'Delta', keys: ['delta'], types: ['B738'] },
      { tel: 'Windward', keys: ['windward', 'winair'], types: ['AT72'] }
    ],
    NEPAL: [
      { tel: 'Buddha Air', keys: ['buddhaair', 'buddha'], types: ['AT72'] },
      { tel: 'Yeti Air', keys: ['yetiair', 'yeti'], types: ['AT72'] },
      { tel: 'Royal Nepal', keys: ['royalnepal', 'nepalairlines'], types: ['A320'] },
      { tel: 'Himalaya', keys: ['himalaya'], types: ['A320'] },
      { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320'] }
    ],
    UAE: [
      { tel: 'Skydubai', keys: ['skydubai', 'flydubai'], types: ['B738'] },
      { tel: 'Arabia', keys: ['arabia', 'airarabia'], types: ['A320'] },
      { tel: 'Gulf Air', keys: ['gulfair'], types: ['A320'] },
      { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320'] }
    ],
    SG: [
      { tel: 'Scooter', keys: ['scooter', 'scoot'], types: ['A320'] },
      { tel: 'Singapore', keys: ['singapore'], types: ['B738'] },
      { tel: 'Red Cap', keys: ['redcap', 'airasia'], types: ['A320'] },
      { tel: 'Malindo', keys: ['malindo', 'batik'], types: ['B738'] },
      { tel: 'Cebu', keys: ['cebu'], types: ['A320'] }
    ],
    HK: [
      { tel: 'Cathay', keys: ['cathay'], types: ['A320'] },
      { tel: 'Hongkong Shuttle', keys: ['hongkongshuttle', 'hkexpress'], types: ['A320'] },
      { tel: 'Greater Bay', keys: ['greaterbay'], types: ['B738'] },
      { tel: 'Red Cap', keys: ['redcap', 'airasia'], types: ['A320'] }
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
