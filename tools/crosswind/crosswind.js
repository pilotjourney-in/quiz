/**
 * Crosswind and headwind/tailwind components.
 * Angle = wind direction − runway heading, normalised to −180…180°.
 * Headwind = speed × cos(angle). Negative values are a tailwind.
 * Crosswind = speed × sin(angle). Positive is from the right, negative from the left.
 * Wind direction is the direction the wind is coming from.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Crosswind = factory();
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

  function norm180(deg) {
    var a = ((deg + 180) % 360 + 360) % 360 - 180;
    return a === -180 ? 180 : a;
  }

  function norm360(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function headingFromRunway(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim().toUpperCase();
    var m = text.match(/^0?([1-9]|[12][0-9]|3[0-6])([LRC])?$/);
    if (!m) return null;
    var num = Number(m[1]);
    return num === 36 ? 360 : num * 10;
  }

  function resolveHeading(runwayRaw, headingRaw) {
    var heading = parseInput(headingRaw);
    if (heading !== null) {
      var h = norm360(heading);
      return h === 0 ? 360 : h;
    }
    var fromRwy = headingFromRunway(runwayRaw);
    return fromRwy !== null ? fromRwy : null;
  }

  function components(heading, windDir, speed) {
    if (!isFiniteNumber(heading) || !isFiniteNumber(windDir) || !isFiniteNumber(speed)) return null;
    if (speed < 0) return null;
    var angle = norm180(windDir - heading);
    var rad = (angle * Math.PI) / 180;
    var headwind = speed * Math.cos(rad);
    var crosswind = speed * Math.sin(rad);
    return {
      heading: heading, windDir: windDir, speed: speed, angle: angle,
      headwind: headwind, crosswind: crosswind,
      flow: headwind >= 0 ? 'headwind' : 'tailwind',
      side: crosswind >= 0 ? 'right' : 'left',
      headwindAbs: Math.abs(headwind), crosswindAbs: Math.abs(crosswind)
    };
  }

  function calculate(opts) {
    var heading = resolveHeading(opts.runway, opts.heading);
    var windDir = parseInput(opts.windDir);
    var speed = parseInput(opts.speed);
    var gust = parseInput(opts.gust);
    if (heading === null || windDir === null || speed === null) return null;
    // Wind direction is reported 0–360° (000 = calm or north in some sources, 360 = north).
    if (windDir < 0 || windDir > 360) return null;
    var sustained = components(heading, windDir, speed);
    if (!sustained) return null;
    var gusted = gust !== null && gust > speed ? components(heading, windDir, gust) : null;
    return { heading: heading, sustained: sustained, gusted: gusted };
  }

  function formatKt(value) {
    if (!isFiniteNumber(value)) return '';
    var digits = Math.abs(value) >= 100 ? 0 : 1;
    return String(Number(value.toFixed(digits)));
  }

  return {
    parseInput: parseInput, norm180: norm180, norm360: norm360,
    headingFromRunway: headingFromRunway, resolveHeading: resolveHeading,
    components: components, calculate: calculate, formatKt: formatKt,
    EXAMPLE: { label: 'VIDP runway 28, wind 310°/18G26', runway: '28', heading: '281', windDir: '310', speed: '18', gust: '26' }
  };
});
