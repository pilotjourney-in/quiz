/* Phraseology helpers: display text -> spoken text, speech text -> normalised tokens, callsigns. */
(function (TL) {
  'use strict';
  var PH = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett',
    K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
    U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
  // ICAO pronunciation for transmitted numbers. Recognition (NUMW below) accepts both the plain and the ICAO forms.
  var DIG = ['zero', 'one', 'two', 'tree', 'fower', 'fife', 'six', 'seven', 'eight', 'niner'];
  var SAYW = { three: 'tree', four: 'fower', five: 'fife', nine: 'niner' };
  var NUMW = { zero: '0', oh: '0', one: '1', won: '1', two: '2', three: '3', tree: '3', four: '4', fower: '4', five: '5', fife: '5',
    six: '6', seven: '7', eight: '8', nine: '9', niner: '9', ten: '10' };
  var PHW = { alpha: 'a', alfa: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h', india: 'i',
    juliet: 'j', juliett: 'j', juliette: 'j', kilo: 'k', lima: 'l', mike: 'm', november: 'n', oscar: 'o', papa: 'p', quebec: 'q',
    romeo: 'r', sierra: 's', tango: 't', uniform: 'u', victor: 'v', whiskey: 'w', whisky: 'w', xray: 'x', yankee: 'y', zulu: 'z' };

  function spell(s) { return s.split('').map(function (c) { return PH[c] || c; }).join(' '); }
  function digits(s) { return String(s).split('').map(function (c) { return c === '.' ? 'decimal' : DIG[+c]; }).join(' '); }
  function feet(n) {
    n = Math.round(n / 100) * 100;
    var th = Math.floor(n / 1000), h = (n % 1000) / 100, o = [];
    if (th) o.push(digits(th) + ' thousand');
    if (h) o.push(DIG[h] + ' hundred');
    return o.join(' ') || 'zero';
  }
  /* Turn display text ("runway 32, QNH 1012") into what should be said on the radio. */
  function spoken(text) {
    var s = text;
    s = s.replace(/\b([A-Z]{2})-([A-Z]{3})\b/g, function (m, a, b) { return spell(a + b); });
    s = s.replace(/\b([A-Z])-([A-Z]{2})\b/g, function (m, a, b) { return spell(a + b); });
    s = s.replace(/(\d+) feet\b/g, function (m, n) { return feet(+n) + ' feet'; });
    s = s.replace(/\bQNH\b/g, 'Q N H').replace(/\bILS\b/g, 'I L S').replace(/\bIFR\b/g, 'I F R').replace(/\bVFR\b/g, 'V F R');
    s = s.replace(/\bIFLY\b/g, 'I-fly');
    s = s.replace(/\d+(\.\d+)?/g, function (m) { return digits(m); });
    s = s.replace(/\b(three|four|five|nine)\b/gi, function (m) { return SAYW[m.toLowerCase()]; });
    return s.replace(/-/g, ' ');
  }

  /* Normalise recognised or typed speech. Returns { plain, nums, compact }. */
  function norm(text) {
    var s = ' ' + String(text).toLowerCase() + ' ';
    s = s.replace(/[’']/g, '').replace(/(\d),(\d)/g, '$1$2').replace(/[^a-z0-9. ]+/g, ' ');
    s = s.replace(/\.(?!\d)/g, ' ').replace(/([^0-9])\./g, '$1 ');
    var fixes = [[/\btake ?offs?\b/g, 'take off'], [/\bline ?up\b/g, 'line up'], [/\blining up\b/g, 'line up'], [/\bstart ?up\b/g, 'start up'],
      [/\bpush ?back\b/g, 'push back'], [/\bx ray\b/g, 'xray'], [/\bfox trot\b/g, 'foxtrot'], [/\b(q n h|queen h|que n h|q and h)\b/g, 'qnh'],
      [/\brun way\b/g, 'runway'], [/\btouch (n|and|in) go\b/g, 'touch and go'], [/\bgo round\b/g, 'go around'], [/\bgoing round\b/g, 'going around'],
      [/\bstand by\b/g, 'standby'], [/\bdown wind\b/g, 'downwind'], [/\bfinals\b/g, 'final'], [/\bi fly\b/g, 'ifly'], [/\beye fly\b/g, 'ifly'],
      [/\bwill co\b/g, 'wilco'], [/\bspice jet\b/g, 'spicejet'], [/\b(a casa|akasha|a kasa)\b/g, 'akasa'], [/\bclear (for|to|2|4)\b/g, 'cleared $1']];
    fixes.forEach(function (f) { s = s.replace(f[0], f[1]); });
    var raw = s.trim().split(/\s+/).filter(Boolean);
    var t = raw.map(function (w) {
      if (/^\d+(\.\d+)?$/.test(w)) return { k: 'n', v: w };
      if (NUMW[w]) return { k: 'n', v: NUMW[w] };
      if (w === 'decimal') return { k: 'n', v: '.' };
      return { k: 'w', v: w };
    });
    for (var i = 0; i < t.length; i++) {
      var w = t[i].v, p = t[i - 1], q = t[i + 1];
      if (t[i].k !== 'w') continue;
      var d = (w === 'to' || w === 'too') ? '2' : (w === 'for' || w === 'fore') ? '4' : (w === 'point') ? '.' : null;
      if (!d) continue;
      var both = p && q && p.k === 'n' && q.k === 'n';
      var rwy = d !== '.' && p && p.k === 'n' && p.v.length === 1 && t[i - 2] && t[i - 2].v === 'runway';
      if (both || rwy) t[i] = { k: 'n', v: d };
    }
    var out = [];
    t.forEach(function (x) {
      var last = out[out.length - 1];
      if (x.k === 'n' && last && last.k === 'n') last.v += x.v; else out.push({ k: x.k, v: x.v });
    });
    out.forEach(function (x) { if (x.k === 'n') x.v = x.v.replace(/^\.+|\.+$/g, '') || '0'; });
    return {
      plain: out.map(function (x) { return x.v; }).join(' '),
      nums: out.filter(function (x) { return x.k === 'n'; }).map(function (x) { return x.v; }),
      compact: out.map(function (x) { return PHW[x.v] || x.v; }).join('')
    };
  }

  /* Does the normalised text name a taxiway/holding-point letter after one of the lead words? */
  function letterAfter(n, leads, letter) {
    var L = letter.toLowerCase(), names = Object.keys(PHW).filter(function (k) { return PHW[k] === L; }).concat([L]);
    return new RegExp('\\b(' + leads.join('|') + ') (' + names.join('|') + ')\\b').test(n.plain);
  }

  var AIRLINES = [
    { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320', 'A320', 'AT72'] },
    { tel: 'Air India', keys: ['airindia'], types: ['A320'] },
    { tel: 'Akasa Air', keys: ['akasaair', 'akasa'], types: ['B738'] },
    { tel: 'Spicejet', keys: ['spicejet'], types: ['B738'] },
    { tel: 'Allied', keys: ['allied', 'allianceair'], types: ['AT72'] }
  ];
  function regCs(reg) {
    reg = reg.toUpperCase().replace(/[^A-Z]/g, '');
    if (reg.length !== 5) reg = 'VTPJA';
    var l = reg.toLowerCase();
    return { full: reg.slice(0, 2) + '-' + reg.slice(2), abbr: reg[0] + '-' + reg.slice(3), keys: [l], abbrKeys: [l[0] + l.slice(3), l.slice(2)], num: null, names: [] };
  }
  function airlineCs(al, num) {
    return { full: al.tel + ' ' + num, abbr: al.tel + ' ' + num, keys: al.keys.map(function (k) { return k + num; }), abbrKeys: [], num: String(num), names: al.keys };
  }
  /* 0 = not addressed, higher = stronger match. */
  function matchCs(n, cs) {
    var c = n.compact, i;
    for (i = 0; i < cs.keys.length; i++) if (c.indexOf(cs.keys[i]) >= 0) return 3;
    for (i = 0; i < cs.abbrKeys.length; i++) if (c.indexOf(cs.abbrKeys[i]) >= 0) return 2;
    for (i = 0; i < cs.names.length; i++) if (c.indexOf(cs.names[i]) >= 0) return 2;
    if (cs.num && n.nums.indexOf(cs.num) >= 0) return 1;
    return 0;
  }

  TL.Phrase = { PH: PH, PHW: PHW, spoken: spoken, norm: norm, letterAfter: letterAfter, AIRLINES: AIRLINES, regCs: regCs, airlineCs: airlineCs, matchCs: matchCs };
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
