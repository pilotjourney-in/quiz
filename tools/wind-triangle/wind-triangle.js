/**
 * Wind triangle (E6B-style) solution for heading and groundspeed.
 * sin(WCA) = (wind speed / TAS) × sin(wind direction − true course)
 * A positive WCA is a right correction (wind from the right).
 * TH = TC + WCA
 * GS = TAS × cos(WCA) − wind speed × cos(wind direction − true course)
 * MH = TH − easterly variation + westerly variation ("east is least, west is best").
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WindTriangle = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

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

  function norm360(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function toRad(deg) { return (deg * Math.PI) / 180; }
  function toDeg(rad) { return (rad * 180) / Math.PI; }

  function solve(tas, tc, windDir, windSpeed, variation, varEW) {
    if (!isFiniteNumber(tas) || !isFiniteNumber(tc) || !isFiniteNumber(windDir) || !isFiniteNumber(windSpeed)) return null;
    if (tas <= 0 || windSpeed < 0) return null;
    var wa = windDir - tc;
    var swc = (windSpeed / tas) * Math.sin(toRad(wa));
    if (Math.abs(swc) > 1) return { impossible: true, sineWindCorrection: swc };
    var wca = toDeg(Math.asin(swc));
    var th = norm360(tc + wca);
    var gs = tas * Math.cos(toRad(wca)) - windSpeed * Math.cos(toRad(wa));
    // A headwind equal to or stronger than the TAS gives no progress along the course.
    if (!(gs > 0)) return { impossible: true, noProgress: true, sineWindCorrection: swc, gs: gs };
    var varMag = isFiniteNumber(variation) ? Math.abs(variation) : 0;
    var east = String(varEW || 'E').toUpperCase() !== 'W';
    var varSigned = east ? varMag : -varMag;
    var mh = norm360(th - varSigned);
    return {
      impossible: false, windAngle: wa, sineWindCorrection: swc, wca: wca, th: th, mh: mh, gs: gs,
      variation: varMag, varEW: east ? 'E' : 'W', tas: tas, tc: norm360(tc),
      windDir: norm360(windDir), windSpeed: windSpeed
    };
  }

  function withFuel(result, distanceNm, fuelFlowPerHour) {
    if (!result || result.impossible) return result;
    var out = {};
    for (var k in result) out[k] = result[k];
    if (isFiniteNumber(distanceNm) && distanceNm >= 0 && isFiniteNumber(result.gs) && result.gs > 0) {
      out.distanceNm = distanceNm;
      out.timeHours = distanceNm / result.gs;
    }
    if (isFiniteNumber(out.timeHours) && isFiniteNumber(fuelFlowPerHour) && fuelFlowPerHour >= 0) {
      out.fuelFlow = fuelFlowPerHour;
      out.fuel = out.timeHours * fuelFlowPerHour;
    }
    return out;
  }

  function formatAngle(value) {
    if (!isFiniteNumber(value)) return '';
    return String(Number(value.toFixed(1)));
  }
  // Headings are shown 001–360: due north is 360, never 0.
  function formatHeading(value) {
    if (!isFiniteNumber(value)) return '';
    var r = Number(value.toFixed(1));
    return String(r === 0 || r === 360 ? 360 : r);
  }
  function formatKt(value) {
    if (!isFiniteNumber(value)) return '';
    return String(Number(value.toFixed(1)));
  }
  function formatTime(hours) {
    if (!isFiniteNumber(hours) || hours < 0) return '';
    var totalMin = Math.round(hours * 60);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h === 0) return m + ' min';
    return h + ' h ' + String(m).padStart(2, '0') + ' min';
  }

  return {
    parseInput: parseInput, norm360: norm360, solve: solve, withFuel: withFuel,
    formatAngle: formatAngle, formatHeading: formatHeading, formatKt: formatKt, formatTime: formatTime,
    EXAMPLE: {
      label: 'VIDP westbound, TAS 120 kt, wind 310°/20, var 1° E, 123 NM',
      tas: '120', tc: '240', windDir: '310', windSpeed: '20',
      variation: '1', varEW: 'E', distance: '123', fuelFlow: '28'
    }
  };
});
