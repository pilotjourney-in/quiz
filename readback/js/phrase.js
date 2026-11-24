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
  var SIDE = { L: 'left', R: 'right', C: 'centre' };
  function spoken(text) {
    var s = text;
    /* Registrations with their nationality mark: VT-PJA, G-PJAA, OE-PJA, A6-PJA, 9V-PJA, PJ-PJA. */
    s = s.replace(/\b([A-Z0-9]{1,2})-([A-Z]{2,4})\b/g, function (m, a, b) { return spell(a + b); });
    /* ICAO abbreviated registration (first character + last two), e.g. VJA, GAA, 9JA. Leave known 3-letter groups alone. */
    s = s.replace(/\b([A-Z0-9][A-Z]{2})\b/g, function (m) {
      return /^(QNH|ILS|IFR|VFR|ATC|GND|TWR|APP|ATR)$/.test(m) ? m : spell(m);
    });
    /* Runway with a side letter: 08R -> zero eight right. */
    s = s.replace(/\b(\d{2})([LRC])\b/g, function (m, d, x) { return d + ' ' + SIDE[x]; });
    /* Designators of two letters (ER, FR, KP) at the current airport: spelt letter by letter. */
    var AP = (typeof TL !== 'undefined' && TL.AIRPORT) || null;
    if (AP && AP.edges) {
      var two = {}; AP.edges.forEach(function (e) { if (e[2] && /^[A-Z]{2}\d{0,2}$/.test(e[2])) two[e[2]] = 1; });
      Object.keys(AP.holds || {}).forEach(function (h) { if (/^[A-Z]{2}\d{0,2}$/.test(h)) two[h] = 1; });
      s = s.replace(/\b([A-Z]{2})(\d{0,2})\b/g, function (m, l, d) { return two[m] ? PH[l[0]] + ' ' + PH[l[1]] + (d ? ' ' + d : '') : m; });
    }
    /* Taxiway, holding point and stand designators: A, P, A1, N3, E10 -> Alpha, Papa, Alpha one ...
       (I and O are never used as designators, so the word "I" is left alone). */
    s = s.replace(/\b([A-HJ-NP-Z])(\d{0,2})\b(?!-)/g, function (m, l, d) { return PH[l] + (d ? ' ' + d : ''); });   // (?!-): not the X of an already spelt 'X-ray'
    s = s.replace(/(\d+) feet\b/g, function (m, n) { return feet(+n) + ' feet'; });
    s = s.replace(/\bQNH\b/g, 'Q N H').replace(/\bILS\b/g, 'I L S').replace(/\bIFR\b/g, 'I F R').replace(/\bVFR\b/g, 'V F R');
    s = s.replace(/\bIFLY\b/g, 'I-fly');
    s = s.replace(/\b(1[1-3]\d\.\d)00\b/g, '$1');   // frequencies: when the final two digits are zero, only the first four are spoken (120.100 -> one two zero decimal one)
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
    // typed runway side letters (08r -> 08 right) and "centre"/"center"
    s = s.replace(/\b(\d{1,2})([lrc])\b/g, function (m, d, x) { return d + ' ' + { l: 'left', r: 'right', c: 'center' }[x]; }).replace(/\bcentre\b/g, 'center');
    var raw = [];
    // split designators the way they are spoken: "n11" -> "n 11" (November one one), "9v" -> "9 v", so typed and spoken forms compare alike
    s.trim().split(/\s+/).filter(Boolean).forEach(function (w) {
      var m = /^([a-z])(\d{1,3})$/.exec(w) || /^(\d{1,2})([a-z])$/.exec(w);
      if (m) raw.push(m[1], m[2]); else raw.push(w);
    });
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

  /* Does the text name a taxiway/holding-point/stand designator (A, A1, N3, 12) right after one of the lead words?
     Works on the compact form, where "alpha one" and "A1" both become "a1". */
  function desigAfter(n, leads, des) {
    var d = String(des).toLowerCase().replace(/[^a-z0-9]/g, '');
    return new RegExp('(' + leads.join('|') + ')' + d + '(?![0-9])').test(n.compact);
  }
  function letterAfter(n, leads, letter) { return desigAfter(n, leads, letter); }
  /* Is this runway (e.g. '32', '08R') named? The digits must be heard ('08' or '8'), and the side word if it has one. */
  function rwyNamed(n, id) {
    var m = /^(\d{2})([LRC]?)$/.exec(id); if (!m) return false;
    var d = m[1], ok = n.nums.some(function (x) { return x === d || x === d.replace(/^0/, '') || x.indexOf(d) === 0 && /^\d+$/.test(x) && x.length <= 2; });
    if (!ok) return false;
    return !m[2] || new RegExp('\\b' + { L: 'left', R: 'right', C: 'center' }[m[2]] + '\\b').test(n.plain);
  }
  /* Turn a designator heard in speech ('a1', 'alpha', 'b') into its written form ('A1', 'A', 'B'), or ''. */
  function desig(word, nextNum) {
    var w = String(word || '').toLowerCase(), l = PHW[w] || (/^[a-z]\d{0,2}$/.test(w) ? w : '');
    if (!l) return '';
    if (l.length === 1 && nextNum && /^\d{1,2}$/.test(nextNum)) l += nextNum;
    return l.toUpperCase();
  }

  var AIRLINES = [
    { tel: 'IFLY', keys: ['ifly', 'indigo'], types: ['A320', 'A320', 'AT72'] },
    { tel: 'Air India', keys: ['airindia'], types: ['A320'] },
    { tel: 'Akasa Air', keys: ['akasaair', 'akasa'], types: ['B738'] },
    { tel: 'Spicejet', keys: ['spicejet'], types: ['B738'] },
    { tel: 'Allied', keys: ['allied', 'allianceair'], types: ['AT72'] }
  ];
  /* Nationality marks used to split a registration typed without its hyphen. Longest match wins. */
  var MARKS = ['VT', 'G', 'OE', 'A6', '9V', '9N', 'PJ', 'PH', 'D', 'F', 'I', 'EI', 'HB', 'OY', 'SE', 'LN', 'OH', 'EC', 'CS', 'SP', 'OK', 'C', 'VH', 'ZK',
    'JA', 'HL', 'B', 'HS', '9M', 'PK', 'RP', 'A7', 'A9C', 'HZ', 'AP', '4R', 'S2', 'ZS', '5Y', 'ET', 'SU', 'TC', 'VP', 'N'];
  /* Split 'VT-PJA', 'G-PJAA', '9VPJA' into mark and suffix. */
  function splitReg(reg) {
    var r = String(reg || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''), m = /^([A-Z0-9]{1,3})-([A-Z0-9]{1,5})$/.exec(r);
    if (m) return { mark: m[1], suf: m[2] };
    r = r.replace(/-/g, '');
    var best = '';
    MARKS.forEach(function (k) { if (r.indexOf(k) === 0 && k.length > best.length && r.length - k.length >= 3) best = k; });
    return best ? { mark: best, suf: r.slice(best.length) } : null;
  }
  /* Callsign from a registration. Abbreviated form per ICAO Annex 10: first character plus the last two (VT-PJA -> VJA, G-PJAA -> GAA, 9V-PJA -> 9JA). */
  function regCs(reg, fallback) {
    var p = splitReg(reg);
    if (!p || !/^[A-Z]{3,4}$/.test(p.suf)) p = splitReg(fallback || 'VT-PJA');
    var full = p.mark + '-' + p.suf, flat = (p.mark + p.suf).toLowerCase(), abbr = (p.mark[0] + p.suf.slice(-2));
    return { full: full, abbr: abbr, keys: [flat], abbrKeys: [abbr.toLowerCase(), p.suf.toLowerCase()], num: null, names: [] };
  }
  /* A random local registration with the same mark and suffix length as the airport's default one. */
  function randomReg(like) {
    var p = splitReg(like || 'VT-PJA') || { mark: 'VT', suf: 'PJA' }, L = 'ABCDEFGHJKLMNPRSTUWXYZ', r = '';
    for (var i = 0; i < p.suf.length; i++) r += L[Math.floor(Math.random() * L.length)];
    return p.mark + '-' + r;
  }
  function airlineCs(al, num) {
    // also match the telephony as norm() hears it: 'Air India' -> 'airi', 'Delta' -> 'd' (India and Delta are spelling-alphabet words)
    var heard = norm(al.tel).compact, keys = al.keys.slice(); if (keys.indexOf(heard) < 0) keys.push(heard);
    return { full: al.tel + ' ' + num, abbr: al.tel + ' ' + num, keys: keys.map(function (k) { return k + num; }), abbrKeys: [], num: String(num), names: keys.filter(function (k) { return k.length > 2; }) };
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

  TL.Phrase = { PH: PH, PHW: PHW, spoken: spoken, norm: norm, letterAfter: letterAfter, desigAfter: desigAfter, desig: desig, rwyNamed: rwyNamed,
    AIRLINES: AIRLINES, regCs: regCs, randomReg: randomReg, splitReg: splitReg, airlineCs: airlineCs, matchCs: matchCs };
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
