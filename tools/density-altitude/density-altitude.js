/**
 * Pressure and density altitude for study use.
 * PA = elevation + (1013.25 − QNH) × (1000 / 33.86389)
 * ISA = 15 − 2 × (PA / 1000)
 * DA ≈ PA + 120 × (OAT − ISA)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DensityAltitude = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var INHG_HPA = 33.86389;
  var STD_HPA = 1013.25;
  var FT_PER_HPA = 1000 / INHG_HPA;
  var ISA_SL = 15;
  var ISA_LAPSE_PER_1000FT = 2;
  var DA_FT_PER_DEG = 120;
  var VIDP_ELEV_FT = 777;

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function parseInput(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim().replace(/,/g, '');
    if (text === '' || text === '.' || text === '-' || text === '+' || text === '-.') return null;
    var n = Number(text);
    return isFinite(n) ? n : null;
  }

  function calculate(elevationFt, qnhHpa, oatC) {
    if (!isFiniteNumber(elevationFt) || !isFiniteNumber(qnhHpa) || !isFiniteNumber(oatC)) return null;
    if (qnhHpa <= 0) return null;
    var qnhInHg = qnhHpa / INHG_HPA;
    var pa = elevationFt + (STD_HPA - qnhHpa) * FT_PER_HPA;
    var isa = ISA_SL - ISA_LAPSE_PER_1000FT * (pa / 1000);
    var dev = oatC - isa;
    var da = pa + DA_FT_PER_DEG * dev;
    return { elevationFt: elevationFt, qnhHpa: qnhHpa, qnhInHg: qnhInHg, oatC: oatC, pa: pa, isa: isa, dev: dev, da: da };
  }

  function formatFt(value) {
    if (!isFiniteNumber(value)) return '';
    return String(Math.round(value));
  }
  function formatTemp(value) {
    if (!isFiniteNumber(value)) return '';
    return String(Number(value.toFixed(1)));
  }

  return {
    INHG_HPA: INHG_HPA, STD_HPA: STD_HPA, FT_PER_HPA: FT_PER_HPA,
    ISA_LAPSE_PER_1000FT: ISA_LAPSE_PER_1000FT, DA_FT_PER_DEG: DA_FT_PER_DEG,
    VIDP_ELEV_FT: VIDP_ELEV_FT, parseInput: parseInput, calculate: calculate,
    formatFt: formatFt, formatTemp: formatTemp,
    EXAMPLE: { label: 'VIDP 777 ft, QNH 1008 hPa, OAT 38 °C', elevation: '777', qnh: '1008', oat: '38' }
  };
});
