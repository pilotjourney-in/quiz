/**
 * Aviation unit conversions used by the Pilot Journey converter.
 * Constants follow SI / ICAO conventions:
 *   1 international nautical mile = 1852 m (exactly)
 *   1 foot = 0.3048 m (exactly)
 *   1 statute (international) mile = 1609.344 m (exactly)
 *   1 inHg = 33.86389 hPa (ICAO Doc 7488 / conventional aviation value)
 *   1 kilogram = 2.2046226218487757 avoirdupois pounds
 *   1 US gallon = 3.785411784 L (exactly)
 *
 * Jet A-1 density defaults to 0.8 kg/L, a common planning figure.
 * Actual fuel density varies with temperature and batch; the value is editable.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AviationUnits = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FT_M = 0.3048;
  var NM_M = 1852;
  var SM_M = 1609.344;
  var INHG_HPA = 33.86389;
  var LB_PER_KG = 2.2046226218487757;
  var L_PER_US_GAL = 3.785411784;
  var DEFAULT_JET_A1_KG_PER_L = 0.8;

  var SPEED_TO_MS = {
    kt: NM_M / 3600,
    'km/h': 1000 / 3600,
    mph: SM_M / 3600,
    'm/s': 1,
  };

  var DIST_TO_M = {
    ft: FT_M,
    m: 1,
    nm: NM_M,
    sm: SM_M,
    km: 1000,
  };

  var SPEED_UNITS = ['kt', 'km/h', 'mph', 'm/s'];
  var DIST_UNITS = ['ft', 'm', 'nm', 'sm', 'km'];
  var PRESSURE_UNITS = ['hPa', 'inHg'];
  var TEMP_UNITS = ['C', 'F'];
  var MASS_UNITS = ['kg', 'lb'];
  var VOLUME_UNITS = ['L', 'usgal'];

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function parseInput(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim().replace(/,/g, '');
    if (text === '' || text === '.' || text === '-' || text === '+' || text === '-.') return null;
    var n = Number(text);
    if (!isFinite(n)) return null;
    return n;
  }

  function convertSpeed(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (!SPEED_TO_MS[from] || !SPEED_TO_MS[to]) {
      throw new Error('Unknown speed unit: ' + from + ' → ' + to);
    }
    return (value * SPEED_TO_MS[from]) / SPEED_TO_MS[to];
  }

  function convertDistance(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (!DIST_TO_M[from] || !DIST_TO_M[to]) {
      throw new Error('Unknown distance unit: ' + from + ' → ' + to);
    }
    return (value * DIST_TO_M[from]) / DIST_TO_M[to];
  }

  function convertPressure(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (PRESSURE_UNITS.indexOf(from) === -1 || PRESSURE_UNITS.indexOf(to) === -1) {
      throw new Error('Unknown pressure unit: ' + from + ' → ' + to);
    }
    var hpa = from === 'hPa' ? value : value * INHG_HPA;
    return to === 'hPa' ? hpa : hpa / INHG_HPA;
  }

  function convertTemperature(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (TEMP_UNITS.indexOf(from) === -1 || TEMP_UNITS.indexOf(to) === -1) {
      throw new Error('Unknown temperature unit: ' + from + ' → ' + to);
    }
    var c = from === 'C' ? value : ((value - 32) * 5) / 9;
    return to === 'C' ? c : (c * 9) / 5 + 32;
  }

  function convertMass(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (MASS_UNITS.indexOf(from) === -1 || MASS_UNITS.indexOf(to) === -1) {
      throw new Error('Unknown mass unit: ' + from + ' → ' + to);
    }
    var kg = from === 'kg' ? value : value / LB_PER_KG;
    return to === 'kg' ? kg : kg * LB_PER_KG;
  }

  function convertVolume(value, from, to) {
    if (!isFiniteNumber(value)) return null;
    if (VOLUME_UNITS.indexOf(from) === -1 || VOLUME_UNITS.indexOf(to) === -1) {
      throw new Error('Unknown volume unit: ' + from + ' → ' + to);
    }
    var litres = from === 'L' ? value : value * L_PER_US_GAL;
    return to === 'L' ? litres : litres / L_PER_US_GAL;
  }

  function fuelFrom(value, unit, densityKgPerL) {
    if (!isFiniteNumber(value)) return null;
    var density = isFiniteNumber(densityKgPerL) ? densityKgPerL : DEFAULT_JET_A1_KG_PER_L;
    if (density <= 0) return null;

    var litres;
    if (unit === 'L' || unit === 'usgal') {
      litres = convertVolume(value, unit, 'L');
    } else if (unit === 'kg' || unit === 'lb') {
      var kgIn = convertMass(value, unit, 'kg');
      litres = kgIn / density;
    } else {
      throw new Error('Unknown fuel unit: ' + unit);
    }

    var kg = litres * density;
    return {
      L: litres,
      usgal: litres / L_PER_US_GAL,
      kg: kg,
      lb: kg * LB_PER_KG,
      densityKgPerL: density,
    };
  }

  function convertAll(kind, value, from) {
    if (!isFiniteNumber(value)) return null;
    var out = {};
    var units;
    var fn;
    if (kind === 'speed') {
      units = SPEED_UNITS;
      fn = convertSpeed;
    } else if (kind === 'distance') {
      units = DIST_UNITS;
      fn = convertDistance;
    } else if (kind === 'pressure') {
      units = PRESSURE_UNITS;
      fn = convertPressure;
    } else if (kind === 'temperature') {
      units = TEMP_UNITS;
      fn = convertTemperature;
    } else if (kind === 'mass') {
      units = MASS_UNITS;
      fn = convertMass;
    } else {
      throw new Error('Unknown conversion kind: ' + kind);
    }
    for (var i = 0; i < units.length; i++) {
      out[units[i]] = fn(value, from, units[i]);
    }
    return out;
  }

  /**
   * Format a converted value for display.
   * Large magnitudes use fewer fraction digits; small ones keep more.
   */
  function formatValue(value, kind) {
    if (!isFiniteNumber(value)) return '';
    var abs = Math.abs(value);
    var digits;
    if (kind === 'temperature') {
      digits = abs >= 100 ? 1 : 2;
    } else if (kind === 'pressure') {
      digits = abs >= 100 ? 2 : 3;
    } else if (abs === 0) {
      digits = 1;
    } else if (abs >= 10000) {
      digits = 0;
    } else if (abs >= 1000) {
      digits = 1;
    } else if (abs >= 100) {
      digits = 2;
    } else if (abs >= 10) {
      digits = 2;
    } else if (abs >= 1) {
      digits = 3;
    } else {
      digits = 4;
    }
    var rounded = Number(value.toFixed(digits));
    return String(rounded);
  }

  return {
    FT_M: FT_M,
    NM_M: NM_M,
    SM_M: SM_M,
    INHG_HPA: INHG_HPA,
    LB_PER_KG: LB_PER_KG,
    L_PER_US_GAL: L_PER_US_GAL,
    DEFAULT_JET_A1_KG_PER_L: DEFAULT_JET_A1_KG_PER_L,
    SPEED_UNITS: SPEED_UNITS,
    DIST_UNITS: DIST_UNITS,
    PRESSURE_UNITS: PRESSURE_UNITS,
    TEMP_UNITS: TEMP_UNITS,
    MASS_UNITS: MASS_UNITS,
    VOLUME_UNITS: VOLUME_UNITS,
    parseInput: parseInput,
    convertSpeed: convertSpeed,
    convertDistance: convertDistance,
    convertPressure: convertPressure,
    convertTemperature: convertTemperature,
    convertMass: convertMass,
    convertVolume: convertVolume,
    convertAll: convertAll,
    fuelFrom: fuelFrom,
    formatValue: formatValue,
  };
});
