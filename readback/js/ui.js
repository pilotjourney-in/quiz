/* Browser side: setup screen, map drawing, strips, radio log, speech in and out. */
(function () {
  'use strict';
  var TL = window.TL, AP = TL.AIRPORT, P = TL.Phrase, RAD = Math.PI / 180, NM = 1852;
  var $ = function (id) { return document.getElementById(id); };
  var S = { w: null, opts: null, sel: null, speed: 1, paused: false, view: 'AUTO', voice: true, hints: true, lastT: 0, lastDom: 0, hits: [], inset: null, listening: false };
  // map colours are read from the CSS variables in css/style.css, so the stylesheet stays the single source
  var C = {};
  (function () {
    var cs = getComputedStyle(document.documentElement);
    ['navy', 'navy-deep', 'panel', 'card', 'line', 'ink', 'body', 'muted', 'sky', 'accent', 'good', 'bad'].forEach(function (k) { C[k] = cs.getPropertyValue('--' + k).trim(); });
  })();
  var ICON = {
    pause: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="4" height="14"/><rect x="12" y="3" width="4" height="14"/></svg>',
    play: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3l12 7-12 7z"/></svg>',
    sound: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3z" fill="currentColor" stroke="none"/><path d="M13 7a4 4 0 010 6M15.5 4.5a7.5 7.5 0 010 11"/></svg>',
    mute: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3z" fill="currentColor" stroke="none"/><path d="M13 7.5l5 5M18 7.5l-5 5"/></svg>',
    end: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
    eye: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none"/></svg>',
    eyeOff: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><path d="M3 3l14 14"/></svg>'
  };
  var FLIGHT = { CIRCUIT: 'Circuits', DEP: 'VFR departure', ARR_VFR: 'Arrival' }, TRAFFIC = ['no other traffic', 'light traffic', 'moderate traffic', 'busy traffic'];
  var CLEAN_KEY = 'readback.clean';
  var PHASE = { PARKED: 'At stand', STARTED: 'Engines running', TAXI_OUT: 'Taxiing out', HOLDING_POINT: 'At holding point', LINEUP: 'Lining up', LINED_UP: 'Lined up',
    TKOF_ROLL: 'Rolling', CLIMB: 'Climbing out', CROSSWIND: 'Crosswind', DOWNWIND: 'Downwind', BASE: 'Base', FINAL: 'Final', INBOUND: 'Inbound',
    LANDING_ROLL: 'Landed', TG_ROLL: 'Touch and go', VACATING: 'Vacating', VACATED: 'Runway vacated', TAXI_IN: 'Taxiing in', AT_STAND: 'Parked', AWAY: 'With Approach' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clock(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

  /* ================= setup screen ================= */
  function role() { return document.querySelector('input[name=role]:checked').value; }
  function syncSetup() {
    var r = role();
    document.querySelectorAll('.opts [data-for]').forEach(function (el) {
      var show = el.getAttribute('data-for') === r;
      if (el.tagName === 'OPTION') { el.disabled = !show; if (!show && el.selected) $('o-traffic').value = '1'; } else el.hidden = !show;
    });
  }
  document.querySelectorAll('input[name=role]').forEach(function (el) { el.addEventListener('change', syncSetup); });
  syncSetup();
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, synth = window.speechSynthesis, voices = [];
  if (!SR) $('mic-note').textContent = 'This browser has no voice input, so you will type or tap your transmissions. Chrome, Edge and Safari support voice.';
  else if (location.protocol === 'file:') $('mic-note').textContent = 'Opened from a file: the microphone may be blocked. Voice input works when the page is served over https.';
  function loadVoices() { voices = synth ? synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); }) : []; }
  if (synth) { loadVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); }

  $('start').addEventListener('click', function () {
    S.opts = { role: role(), flight: $('o-flight').value, cs: $('o-cs').value, traffic: +$('o-traffic').value, runway: $('o-rwy').value };
    S.voice = $('o-voice').checked; S.hints = $('o-hints').checked;
    if (synth && S.voice) { try { synth.cancel(); synth.speak(new SpeechSynthesisUtterance(' ')); } catch (e) { /* ignore */ } }
    unlockAudio();
    begin();
  });

  /* iPhone/iPad mute web speech when the silent switch is on. Telling Safari this is a play-and-record app,
     and keeping a silent media track playing, routes the voices like media so the volume buttons control them. */
  var silentEl = null;
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { /* ignore */ }
    try {
      if (!silentEl) {
        silentEl = document.createElement('audio');
        silentEl.setAttribute('playsinline', ''); silentEl.loop = true; silentEl.volume = 0.01;
        silentEl.src = 'silence.wav';
      }
      var pr = silentEl.play(); if (pr && pr.catch) pr.catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }

  function begin() {
    var o = S.opts, w = new TL.World({ mode: o.role, runway: o.runway, traffic: o.traffic });
    S.w = w; S.sel = null; S.paused = false; S.speed = 1; S.view = o.role === 'PILOT' ? 'AUTO' : 'GND';
    if (o.role === 'PILOT') {
      var ac = w.spawn(o.flight, { user: true, type: 'C172', cs: P.regCs(o.cs) });
      ac.plan = 0; ac.wantTG = false;
      w.tuned = o.flight === 'ARR_VFR' ? 'TWR' : 'GND';
    } else w.traffic.next = 2;
    w.on('tx', onTx);
    w.on('note', function (n) { line(n.kind, '', n.text + (n.pts ? ' (' + n.pts + ')' : '')); });
    w.on('finish', debrief);
    w.on('pending', function () { dom(); });   // a new instruction (or its readback) changes the suggested call at once
    w.on('call', function (ac) { if (w.mode === 'ATC' && (!S.sel || !S.sel.alive || !S.sel.call)) S.sel = ac; });
    $('log').innerHTML = ''; $('hint').innerHTML = ''; $('strips').innerHTML = ''; lastHint = ''; lastStrips = ''; lastOwn = '';
    $('setup').hidden = true; $('debrief').hidden = true; $('sim').hidden = false;
    $('own').hidden = o.role !== 'PILOT'; $('strips').hidden = o.role === 'PILOT';
    $('b-speed').textContent = '1×'; setPause(); setSound(); $('b-end').innerHTML = ICON.end; setClean();
    $('ptt').disabled = !SR; if (!SR) $('ptt').textContent = 'No mic';
    line('info', '', o.role === 'PILOT'
      ? 'You are ' + w.user.cs.full + ', a Cessna 172. Runway ' + w.rw.id + ' is in use. Hold the red button to transmit, or type.'
      : 'You are Nagpur Tower on 118.1, working ground and air. Runway ' + w.rw.id + ' is in use. Say the callsign, then the instruction.');
    S.lastT = performance.now();
    var my = S.token = (S.token || 0) + 1;
    requestAnimationFrame(function loop(ts) { if (S.token !== my || !S.w) return; frame(ts); requestAnimationFrame(loop); });
  }

  /* ================= radio log and speech out ================= */
  function line(cls, who, text) {
    var log = $('log'), d = document.createElement('div');
    d.className = 'ln ' + cls;
    d.innerHTML = '<time>' + clock(S.w.time) + '</time>' + (who ? '<b>' + esc(who) + '</b>' : '') + esc(text);
    log.appendChild(d);
    while (log.children.length > 150) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function onTx(tx) {
    if (!tx.aud) return;
    var who, cls;
    if (tx.from === 'USER') { who = 'You'; cls = 'me'; }
    else if (tx.from === 'ATC') { who = tx.ch === 'GND' ? 'Ground' : 'Tower'; cls = 'atc'; }
    else { who = tx.from.cs.full; cls = 'ac'; }
    line(cls, who, tx.text);
    if (tx.from !== 'USER') speak(tx);
  }
  function speak(tx) {
    if (!S.voice || !synth) return;
    var u = new SpeechSynthesisUtterance(P.spoken(tx.text));
    var ind = voices.filter(function (v) { return /en[-_]IN/i.test(v.lang); }), pool = ind.length > 1 ? ind : ind.concat(voices);
    var key = tx.from === 'ATC' ? 0 : tx.from.id;
    if (pool.length) { u.voice = pool[key % pool.length]; u.lang = u.voice.lang; } else u.lang = 'en-IN';
    u.pitch = tx.from === 'ATC' ? 1 : 0.75 + ((key * 37) % 7) * 0.09;
    u.rate = 1.12;
    tx.hold = true;
    var done = function () { tx.hold = false; };
    u.onend = done; u.onerror = done; setTimeout(done, 14000);
    synth.speak(u);
  }
  function setSound() { var b = $('b-sound'); b.innerHTML = S.voice ? ICON.sound : ICON.mute; b.setAttribute('aria-label', S.voice ? 'Sound on' : 'Sound off'); b.title = S.voice ? 'Sound on' : 'Sound off'; }
  function setPause() { var b = $('b-pause'); b.innerHTML = S.paused ? ICON.play : ICON.pause; b.setAttribute('aria-label', S.paused ? 'Resume' : 'Pause'); b.title = S.paused ? 'Resume' : 'Pause'; }
  /* Clean recording mode hides the suggested calls and the menus. The choice is remembered on this device. */
  function getClean() { try { return localStorage.getItem(CLEAN_KEY) === '1'; } catch (e) { return !!S.cleanMem; } }
  function setClean(v) {
    if (v != null) { S.cleanMem = v; try { localStorage.setItem(CLEAN_KEY, v ? '1' : '0'); } catch (e) { /* storage unavailable: keep it for this session only */ } }
    var on = getClean(), b = $('b-clean');
    document.body.classList.toggle('clean', on);
    b.innerHTML = on ? ICON.eyeOff : ICON.eye; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Clean recording mode is on' : 'Clean recording mode';
  }

  /* ================= speech in ================= */
  var rec = null, heard = '', latch = false, downAt = 0, held = false, ready = false, stopping = false, relT = 0, dogT = 0, started = false;
  function pttLabel() {
    var b = $('ptt'); b.classList.toggle('live', S.listening);
    b.textContent = !SR ? 'No mic' : stopping ? 'Sending...' : S.listening ? (!ready ? 'Wait...' : latch ? 'Tap to send' : 'Listening') : 'Hold to talk';
  }
  function resetPtt() {
    clearTimeout(relT); clearTimeout(dogT);
    S.listening = false; latch = false; stopping = false; ready = false; held = false; started = false;
    if (S.w) S.w.radio.ptt = false; pttLabel();
  }
  /* One recogniser for the whole session: iPhone and iPad Safari stop working after several new ones are created. */
  function getRec() {
    if (rec) return rec;
    var r = rec = new SR(); r.lang = 'en-IN'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    r.onstart = function () { started = true; clearTimeout(dogT); setTimeout(function () { if (S.listening && !ready) { ready = true; pttLabel(); } }, 350); };
    r.onaudiostart = function () { ready = true; pttLabel(); if (navigator.vibrate) navigator.vibrate(30); };
    r.onresult = function (e) {
      var fin = '', inter = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '; else inter += e.results[i][0].transcript; }
      if (fin) S.fin = ((S.fin || '') + ' ' + fin).trim();
      heard = ((S.fin || '') + ' ' + inter).trim(); $('txt').value = heard;
    };
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') line('tip', '', 'The microphone is blocked. Allow it in the browser settings, or type your transmission.');
      else if (e.error === 'network') line('tip', '', 'Voice input needs an internet connection. Check it, or type your transmission.');
      else if (e.error === 'audio-capture') line('tip', '', 'The microphone is busy or missing. Close other apps using it, or type your transmission.');
    };
    r.onend = function () {
      started = false;
      // Phones often end recognition on their own after a pause: if the button is still held, keep listening.
      if (held && !stopping && S.listening && S.w && !S.w.over) { setTimeout(function () { try { r.start(); } catch (err) { finish(); } }, 120); return; }
      finish();
    };
    return r;
  }
  /* Phone speech recognition often swaps a word or two ("tower" for "two", "lying up" for "line up").
     If what was heard is close to one of the calls that fit right now, and every number in that call was heard
     correctly, send that call instead. Numbers are never guessed, so a wrong readback still counts as wrong. */
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function wordsClose(a, b) { return a === b || (a.length > 3 && b.length > 3 && lev(a, b) <= Math.floor(Math.max(a.length, b.length) / 3)); }
  function simWords(h, c) {
    var used = [], hit = 0;
    c.forEach(function (cw) { for (var i = 0; i < h.length; i++) if (!used[i] && wordsClose(h[i], cw)) { used[i] = true; hit++; return; } });
    return hit / Math.max(h.length, c.length);
  }
  function toks(n) {
    var out = [];
    n.plain.split(' ').forEach(function (x) {
      var v = P.PHW[x] || x, last = out[out.length - 1];
      if (/^[a-z]{1,3}$/.test(v) && last && /^[a-z]+$/.test(last.v) && last.short) last.v += v;
      else out.push({ v: v, short: /^[a-z]{1,3}$/.test(v) });
    });
    return out.map(function (o) { return o.v; });
  }
  function snap(text) {
    var w = S.w; if (!w) return text;
    var cands = [];
    try {
      if (w.mode === 'ATC') { if (S.sel && S.sel.alive) cands = TL.Hint.atc(w, S.sel).map(function (t) { return S.sel.cs.full + ', ' + t; }); }
      else cands = TL.Hint.pilot(w).opts || [];
    } catch (e) { return text; }
    var hn = P.norm(text), hw = toks(hn), best = null, bs = 0;
    cands.forEach(function (c) {
      if (typeof c !== 'string') return;
      var cn = P.norm(c);
      if (!cn.nums.every(function (x) { return hn.nums.indexOf(x) >= 0; })) return;
      if (hn.nums.some(function (x) { return cn.nums.indexOf(x) < 0; })) return;
      var sc = simWords(hw, toks(cn));
      if (sc > bs) { bs = sc; best = c; }
    });
    if (best && bs >= 0.6 && bs < 1) { line('tip', '', 'Heard "' + text + '", taken as "' + best + '".'); return best; }
    return text;
  }
  function finish() {
    var was = S.listening; resetPtt();
    var t = heard; heard = ''; S.fin = ''; $('txt').value = '';
    if (t) send(snap(t));
    else if (was) line('tip', '', 'Nothing heard. Hold the button, wait for "Listening", then speak, and let go a moment after you finish.');
  }
  function startListen() {
    if (!SR || S.listening || stopping || !S.w || S.w.over) return;
    heard = ''; S.fin = ''; ready = false;
    if (synth) synth.cancel();
    var r = getRec();
    S.listening = true; S.w.radio.ptt = true; pttLabel();
    try { r.start(); } catch (err) { try { r.abort(); } catch (e2) { /* ignore */ } rec = null; resetPtt(); line('tip', '', 'The mic was still busy. Tap Hold to talk again.'); return; }
    // Watchdog: if the mic never opens, reset so the button doesn't stay stuck.
    dogT = setTimeout(function () { if (!started && S.listening) { try { r.abort(); } catch (e) { /* ignore */ } rec = null; resetPtt(); line('tip', '', 'The mic did not open. Tap Hold to talk again.'); } }, 2500);
  }
  function stopListen() {
    if (!rec || !S.listening || stopping) return;
    stopping = true; held = false; pttLabel();
    var r = rec;
    // Keep the mic open briefly so the last word isn't cut off, then stop; force-finish if the browser never ends.
    setTimeout(function () { try { r.stop(); } catch (e) { /* ignore */ } }, 400);
    relT = setTimeout(function () { if (S.listening) { try { r.abort(); } catch (e) { /* ignore */ } rec = null; finish(); } }, 3000);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && S.listening) { try { rec && rec.abort(); } catch (e) { /* ignore */ } rec = null; resetPtt(); } });
  var ptt = $('ptt');
  ptt.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (stopping) return;
    if (S.listening) { stopListen(); return; }
    downAt = performance.now(); latch = false; held = true; startListen();
    try { ptt.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  function pttUp() {
    if (!S.listening || latch || stopping) return;
    if (performance.now() - downAt < 350) { latch = true; held = true; pttLabel(); } else stopListen();
  }
  ptt.addEventListener('pointerup', pttUp); ptt.addEventListener('pointercancel', function () { /* ignore: phones cancel long presses; release is handled by pointerup */ });
  ptt.addEventListener('lostpointercapture', pttUp);
  ptt.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || e.repeat || $('sim').hidden || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    e.preventDefault(); if (stopping) return; downAt = 0; latch = false; held = true; startListen();
  });
  document.addEventListener('keyup', function (e) { if (e.code === 'Space' && S.listening && !latch) stopListen(); });

  function send(text) { if (S.w && !S.w.over) S.w.userSays(text, S.sel); }
  $('say').addEventListener('submit', function (e) { e.preventDefault(); var t = $('txt').value.trim(); $('txt').value = ''; if (t) send(t); });

  /* ================= controls ================= */
  $('b-speed').addEventListener('click', function () { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; this.textContent = S.speed + '×'; });
  $('b-pause').addEventListener('click', function () { S.paused = !S.paused; setPause(); });
  $('b-clean').addEventListener('click', function () { setClean(!getClean()); });
  $('b-sound').addEventListener('click', function () { S.voice = !S.voice; if (!S.voice && synth) synth.cancel(); setSound(); });
  $('b-end').addEventListener('click', function () { if (S.w) S.w.finish('Session ended'); });
  $('b-view').addEventListener('click', function () { S.view = curView() === 'GND' ? 'AREA' : 'GND'; });
  $('d-again').addEventListener('click', begin);
  $('d-setup').addEventListener('click', function () { S.w = null; S.token++; $('debrief').hidden = true; $('sim').hidden = true; $('setup').hidden = false; });
  $('own').addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (b && S.w) { S.w.tuned = b.getAttribute('data-f'); if (S.w.expectFreq === S.w.tuned) S.w.expectFreq = null; lastOwn = ''; dom(); } });
  $('strips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]'); if (!b) return;
    var id = +b.getAttribute('data-id'); S.sel = S.w.acs.filter(function (a) { return a.id === id; })[0] || null; dom();
  });
  $('hint').addEventListener('click', function (e) {
    var b = e.target.closest('button.chip'); if (!b) return;
    var t = b.getAttribute('data-say'), w = S.w, atc = w.mode === 'ATC';
    // only send a chip that is still the right call; if things moved on since it was drawn, redraw instead
    var now = atc ? (S.sel && S.sel.alive ? TL.Hint.atc(w, S.sel) : []) : TL.Hint.pilot(w).opts;
    if (now.indexOf(t) < 0) { dom(); return; }
    send(atc ? S.sel.cs.full + ', ' + t : t);
    dom();
  });
  $('map').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, I = S.inset;
    if (I && x >= I.x && x <= I.x + I.w && y >= I.y && y <= I.y + I.h) { S.view = curView() === 'GND' ? 'AREA' : 'GND'; return; }
    if (!S.w || S.w.mode !== 'ATC') return;
    var best = null, bd = 30;
    S.hits.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.ac; } });
    if (best) { S.sel = best; dom(); }
  });

  /* ================= DOM panels ================= */
  var lastHint = '', lastStrips = '', lastOwn = '';
  function stripState(w, ac) {
    var s = PHASE[ac.phase] || ac.phase;
    if (ac.phase === 'FINAL') s += ' ' + Math.max(0, -w.along(ac.u) / NM).toFixed(1) + ' NM';
    if (ac.holdPos) s += ', holding';
    if (ac.clr.land) s += ac.clr.land === 'TG' ? ', clr T&G' : ', clr land';
    else if (ac.clr.takeoff) s += ', clr t/o';
    return s;
  }
  function dom() {
    var w = S.w; if (!w) return;
    var info = '<span><b>Rwy</b>' + w.rw.id + '</span><span><b>Wind</b>' + ('00' + w.wind.dir).slice(-3) + '°/' + w.wind.spd + ' kt</span><span><b>QNH</b>' + w.qnh +
      '</span><span><b>Info</b>' + w.info + '</span><span><b>Time</b>' + clock(w.time) + '</span>';
    var chip = w.mode === 'ATC' ? 'Score ' + w.score.pts : 'Readbacks ' + w.score.rbOk + '/' + w.score.rbTotal;
    if ($('scorechip').textContent !== chip) $('scorechip').textContent = chip;
    if ($('info').innerHTML !== info) $('info').innerHTML = info;
    $('b-view').textContent = curView() === 'GND' ? 'Area view' : 'Ground view';
    var h = '';
    if (w.mode === 'PILOT') {
      var u = w.user, st = PHASE[u.phase] || '';
      if (u.alt > 0) st += ', ' + w.amsl(u) + ' ft, ' + Math.round(u.spd / 0.5144) + ' kt';
      var own = '<div class="own-id">' + esc(u.cs.full) + '</div><div class="own-state">' + esc(st) + '</div><div class="freq">' +
        ['GND', 'TWR'].map(function (f) { return '<button type="button" data-f="' + f + '" aria-pressed="' + (w.tuned === f) + '">' + (f === 'GND' ? 'Ground' : 'Tower') + '<small>' + AP.freqs[f] + '</small></button>'; }).join('') + '</div>';
      if (own !== lastOwn) { lastOwn = own; $('own').innerHTML = own; }
      var ph = TL.Hint.pilot(w);
      h = '<p>' + esc(ph.note) + '</p>';
      if (S.hints && ph.opts.length) h += '<div class="chips">' + ph.opts.map(function (t) { return '<button type="button" class="chip" data-say="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    } else {
      if (S.sel && !S.sel.alive) S.sel = null;
      var list = w.acs.slice().sort(function (a, b) {
        var ca = a.call && !a.call.queued ? a.call.t : Infinity, cb = b.call && !b.call.queued ? b.call.t : Infinity;
        return ca !== cb ? ca - cb : a.id - b.id;
      });
      var sh = list.map(function (ac) {
        var k = ac.kind === 'DEP' ? 'dep' : ac.kind === 'CIRCUIT' ? 'loc' : 'arr';
        var extra = ac.kind === 'DEP' ? 'to ' + ac.dest : ac.kind === 'CIRCUIT' ? 'circuits' : 'stand ' + (ac.stand + 1);
        return '<button type="button" class="strip ' + k + (ac === S.sel ? ' sel' : '') + (ac.call && !ac.call.queued ? ' calling' : '') + '" data-id="' + ac.id + '"><b>' + esc(ac.cs.full) +
          '</b><span>' + esc(ac.perf.short + ', ' + extra) + '</span><span class="st">' + esc(stripState(w, ac)) + '</span></button>';
      }).join('');
      if (sh !== lastStrips) { lastStrips = sh; $('strips').innerHTML = sh; }
      if (S.sel) {
        var opts = TL.Hint.atc(w, S.sel);
        h = '<p><b>' + esc(S.sel.cs.full) + '</b> ' + (S.sel.call && !S.sel.call.queued ? 'is calling. ' : '') + (opts.length ? 'Say an instruction, or tap one.' : 'Nothing new to send right now.') + '</p><div class="chips">' +
          opts.map(function (t) { return '<button type="button" class="chip" data-say="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
      } else h = '<p>Tap a strip or an aircraft to see instructions you can send.</p>';
    }
    if (h !== lastHint) { lastHint = h; $('hint').innerHTML = h; }
  }

  function scoreText() { var w = S.w, sc = w.score; return w.mode === 'PILOT' ? sc.rbOk + '/' + sc.rbTotal : String(sc.pts); }
  function debrief(why) {
    var w = S.w, sc = w.score, o = S.opts, sum, items = [];
    if (synth) synth.cancel();
    if (S.listening) stopListen();
    var counts = {};
    sc.notes.forEach(function (n) { if (n.kind === 'info') return; counts[n.text] = (counts[n.text] || 0) + 1; });
    Object.keys(counts).forEach(function (t) { items.push(esc(t) + (counts[t] > 1 ? ' (' + counts[t] + ' times)' : '')); });
    if (w.mode === 'PILOT') sum = why + '. ' + (sc.rbTotal ? 'Clearances read back correctly first time: ' + sc.rbOk + ' of ' + sc.rbTotal + '.' : 'No readbacks were needed yet.');
    else sum = why + ' after ' + clock(w.time) + '. Aircraft handled to completion: ' + sc.moves + '.';
    $('d-score').textContent = scoreText();
    $('d-score').classList.toggle('full', w.mode === 'PILOT' && sc.rbTotal > 0 && sc.rbOk === sc.rbTotal);
    $('d-role').textContent = w.mode === 'PILOT' ? 'Pilot' : 'ATC';
    $('d-flight').textContent = w.mode === 'PILOT' ? FLIGHT[o.flight] : 'Tower, ' + TRAFFIC[o.traffic];
    $('d-sum').textContent = sum;
    $('d-notes').innerHTML = items.length ? items.map(function (i) { return '<li>' + i + '</li>'; }).join('') : '<li class="ok">Nothing to fix. Clean radio work.</li>';
    $('d-share').textContent = navigator.share ? 'Share' : 'Copy link';
    $('debrief').hidden = false;
  }
  /* Report a bug: opens an email to Pilot Journey with the flight details and the last radio calls filled in. */
  $('d-bug').addEventListener('click', function (e) {
    e.preventDefault();
    var w = S.w, o = S.opts || {}, logs = [].slice.call($('log').children, -15).map(function (d) { return d.textContent; });
    var body = 'What went wrong (please describe):\n\n\n' +
      '--- Details (filled in automatically) ---\n' +
      'Role: ' + (w ? (w.mode === 'PILOT' ? 'Pilot' : 'ATC') : '') + '\n' +
      'Flight: ' + (w ? (w.mode === 'PILOT' ? FLIGHT[o.flight] : 'Tower, ' + TRAFFIC[o.traffic]) : '') + ', runway ' + (o.runway || '') + '\n' +
      'Score: ' + (w ? scoreText() : '') + '\n' +
      'Voice input: ' + (SR ? 'available' : 'not available') + ', sound ' + (S.voice ? 'on' : 'off') + '\n' +
      'Device: ' + navigator.userAgent + '\n\nLast radio calls:\n' + logs.join('\n');
    location.href = 'mailto:pilotjourney0405@gmail.com?subject=' + encodeURIComponent('Readback bug report') + '&body=' + encodeURIComponent(body.slice(0, 1800));
  });
  $('d-share').addEventListener('click', function () {
    var btn = this, url = location.href, text = 'I scored ' + scoreText() + ' on Readback by Pilot Journey';
    if (navigator.share) { navigator.share({ title: 'Readback by Pilot Journey', text: text, url: url }).catch(function () { /* share sheet closed */ }); return; }
    var done = function () { btn.textContent = 'Link copied'; };
    var legacy = function () {
      var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); else btn.textContent = 'Copy failed'; } catch (e) { btn.textContent = 'Copy failed'; }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, legacy); else legacy();
  });

  /* ================= map ================= */
  var DX = Math.sin(AP.hdg14 * RAD), DY = Math.cos(AP.hdg14 * RAD), NX = -DY, NY = DX, HALF = AP.length / 2;
  function world(u, v) { return { x: (u - HALF) * DX + v * NX, y: (u - HALF) * DY + v * NY }; }
  function curView() { var w = S.w; if (S.view !== 'AUTO') return S.view; return w && w.user && w.user.alt > 0 ? 'AREA' : 'GND'; }
  function makeView(kind, r) {
    var pts, w = S.w;
    if (kind === 'GND') pts = [world(-250, -330), world(3450, -330), world(3450, 640), world(-250, 640)];
    else {
      var c = world(w.pt(-2500, 0).u, -1200), R = 12500;
      if (w.user) { // your own flight: stay close to the circuit, widen only as far as needed
        var q0 = w.pt(600, 900); c = world(q0.u, q0.v);
        var me = world(w.user.u, w.user.v); R = Math.max(4600, Math.hypot(me.x - c.x, me.y - c.y) + 1500);
      }
      pts = [{ x: c.x - R, y: c.y - R }, { x: c.x + R, y: c.y + R }];
    }
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    var s = Math.min(r.w / (x1 - x0), r.h / (y1 - y0)) * 0.94;
    return { s: s, ox: (x0 + x1) / 2, oy: (y0 + y1) / 2, cx: r.x + r.w / 2, cy: r.y + r.h / 2, kind: kind };
  }
  function sc(V, u, v) { var p = world(u, v); return { x: V.cx + (p.x - V.ox) * V.s, y: V.cy - (p.y - V.oy) * V.s }; }
  function seg(g, V, u0, v0, u1, v1) { var a = sc(V, u0, v0), b = sc(V, u1, v1); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
  function label(g, text, x, y, color, font, align) {
    g.font = font || '600 11px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = C['navy-deep']; g.lineJoin = 'round'; g.strokeText(text, x, y);
    g.fillStyle = color || C.body; g.fillText(text, x, y);
  }
  var FONT = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", Arial, sans-serif';

  function scene(g, r, kind, mini) {
    var w = S.w, V = makeView(kind, r), s = V.s, detail = !mini && s * 100 > 9;
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    g.fillStyle = mini ? C.navy : C['navy-deep']; g.fillRect(r.x, r.y, r.w, r.h);
    var rw = w.rw, k;
    if (kind === 'AREA') {
      // range rings and the extended centreline, like an approach chart
      var c0 = sc(V, HALF, 0);
      g.strokeStyle = C.line; g.lineWidth = 1; g.setLineDash([4, 5]);
      [5].concat(mini ? [] : [2.5]).forEach(function (nm) { g.beginPath(); g.arc(c0.x, c0.y, nm * NM * s, 0, 7); g.stroke(); });
      g.beginPath(); var t0 = w.pt(0, 0), t9 = w.pt(-9 * NM, 0); seg(g, V, t0.u, 0, t9.u, 0); g.stroke();
      g.setLineDash([]);
      if (!mini) {
        g.beginPath();
        for (k = 1; k <= 9; k++) { var tk = w.pt(-k * NM, 0), len = k % 5 === 0 ? 260 : 130; seg(g, V, tk.u, -len, tk.u, len); }
        g.stroke();
        var l5 = sc(V, w.pt(-5 * NM, 0).u, 420); label(g, '5 NM', l5.x + 4, l5.y, C.muted, '11px ' + FONT);
        // light-aircraft circuit
        var pf = TL.PERF.C172, q = [w.pt(pf.xa, 0), w.pt(pf.xa, pf.cw), w.pt(-pf.fl, pf.cw), w.pt(-pf.fl, 0)];
        g.strokeStyle = C.line; g.setLineDash([2, 4]); g.beginPath();
        q.forEach(function (p, i) { var a = sc(V, p.u, p.v); if (i) g.lineTo(a.x, a.y); else g.moveTo(a.x, a.y); });
        g.stroke(); g.setLineDash([]);
      }
    }
    // apron and taxiways
    if (!mini) {
      var ap = [sc(V, 1040, 395), sc(V, 2160, 395), sc(V, 2160, 530), sc(V, 1040, 530)];
      g.fillStyle = C.panel; g.beginPath(); ap.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); g.fill();
      g.strokeStyle = C.line; g.lineWidth = Math.max(1.5, 23 * s); g.lineCap = 'round'; g.beginPath();
      for (k in AP.links) seg(g, V, AP.links[k], 0, AP.links[k], AP.P_V);
      seg(g, V, AP.links.D, AP.P_V, AP.links.A, AP.P_V);
      for (k in AP.apronLinks) seg(g, V, AP.apronLinks[k], AP.P_V, AP.apronLinks[k], AP.APRON_V);
      g.stroke();
    }
    // runway
    var rwW = Math.max(mini ? 2 : 4, AP.width * s);
    g.lineCap = 'butt';
    if (!mini) { g.strokeStyle = C.line; g.lineWidth = rwW + 3; g.beginPath(); seg(g, V, 0, 0, AP.length, 0); g.stroke(); }
    g.strokeStyle = mini ? C.body : C.card; g.lineWidth = rwW;
    g.beginPath(); seg(g, V, 0, 0, AP.length, 0); g.stroke();
    if (kind === 'GND' && !mini) { g.strokeStyle = C.ink; g.lineWidth = Math.max(1, 1.2 * s); g.setLineDash([Math.max(4, 30 * s), Math.max(4, 30 * s)]); g.beginPath(); seg(g, V, 80, 0, AP.length - 80, 0); g.stroke(); g.setLineDash([]); }
    if (detail) {
      // holding points
      g.strokeStyle = C.accent; g.lineWidth = 2.5; g.beginPath();
      for (k in AP.links) seg(g, V, AP.links[k] - 28, AP.HOLD_V, AP.links[k] + 28, AP.HOLD_V);
      g.stroke();
      for (k in AP.links) { var lp = sc(V, AP.links[k] + (k === 'A' ? 75 : -75), 150); label(g, k, lp.x, lp.y, C.body, '700 12px ' + FONT, 'center'); }
      for (k in AP.apronLinks) { var ep = sc(V, AP.apronLinks[k] + (k === 'F' ? 75 : -75), 335); label(g, k, ep.x, ep.y, C.body, '700 12px ' + FONT, 'center'); }
      var pp = sc(V, 2650, AP.P_V + 60); label(g, 'P', pp.x, pp.y, C.body, '700 12px ' + FONT, 'center');
      AP.stands.forEach(function (u, i) { var sp = sc(V, u, AP.STAND_V + 75); label(g, String(i + 1), sp.x, sp.y, C.muted, '11px ' + FONT, 'center'); });
      var ar = sc(V, 1600, 560); label(g, 'Apron', ar.x + 60 * s, ar.y - 22, C.muted, '11px ' + FONT, 'center');
    }
    if (!mini) {
      var n14 = sc(V, -170, 0), n32 = sc(V, AP.length + 170, 0), f = '700 ' + (detail ? 15 : 11) + 'px ' + FONT;
      label(g, '14', n14.x, n14.y, rw.id === '14' ? C.accent : C.muted, f, 'center'); label(g, '32', n32.x, n32.y, rw.id === '32' ? C.accent : C.muted, f, 'center');
    }
    // aircraft
    var cur = w.radio.ch.TWR.cur || w.radio.ch.GND.cur, pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    w.acs.forEach(function (ac) {
      if (ac.phase === 'AWAY') return;
      var p = sc(V, ac.u, ac.v);
      if (p.x < r.x - 20 || p.x > r.x + r.w + 20 || p.y < r.y - 20 || p.y > r.y + r.h + 20) return;
      var fx = Math.cos(ac.th) * DX + Math.sin(ac.th) * NX, fy = Math.cos(ac.th) * DY + Math.sin(ac.th) * NY, ang = Math.atan2(-fy, fx);
      var L = mini ? 4 : ac.perf.ifr ? 10 : 7.5, mine = ac.isUser, air = ac.alt > 0;
      if (mini) { if (!air && !mine) return; g.fillStyle = mine ? C.sky : C.ink; g.beginPath(); g.arc(p.x, p.y, mine ? 3.5 : 2.5, 0, 7); g.fill(); return; }
      var calling = w.mode === 'ATC' && ac.call && !ac.call.queued, talking = cur && cur.from === ac && cur.aud;
      if (ac === S.sel || calling || talking) {
        g.strokeStyle = calling || talking ? C.accent : C.sky; g.lineWidth = 2; g.globalAlpha = calling ? 0.35 + 0.65 * pulse : 1;
        g.beginPath(); g.arc(p.x, p.y, L + 7, 0, 7); g.stroke(); g.globalAlpha = 1;
      }
      g.save(); g.translate(p.x, p.y); g.rotate(ang);
      g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.75, L * 0.62); g.lineTo(-L * 0.35, 0); g.lineTo(-L * 0.75, -L * 0.62); g.closePath();
      g.fillStyle = mine ? C.sky : C.ink; g.fill(); g.strokeStyle = C['navy-deep']; g.lineWidth = 1; g.stroke();
      g.restore();
      S.hits.push({ x: p.x, y: p.y, ac: ac });
      var parked = ac.phase === 'PARKED' || ac.phase === 'STARTED' || ac.phase === 'AT_STAND';
      if (kind === 'AREA' && !air && !mine) return;
      var lx = p.x + L + 6, ly = p.y - (parked ? 0 : L + 4);
      label(g, ac.cs.full, lx, ly, mine ? C.sky : C.ink, '700 11px ' + FONT);
      if (air) label(g, w.amsl(ac) + ' ft  ' + Math.round(ac.spd / 0.5144) + ' kt', lx, ly + 12, C.body, '11px ' + FONT);
    });
    if (mini) { g.strokeStyle = C.line; g.lineWidth = 1; g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); label(g, kind === 'AREA' ? 'Area' : 'Ground', r.x + 6, r.y + 10, C.muted, '11px ' + FONT); }
    g.restore();
  }

  function draw() {
    var cv = $('map'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.hits = [];
    var kind = curView();
    scene(g, { x: 0, y: 0, w: W, h: H }, kind, false);
    var m = Math.round(Math.min(130, Math.min(W, H) * 0.34));
    S.inset = { x: W - m - 8, y: 8, w: m, h: m };
    scene(g, S.inset, kind === 'GND' ? 'AREA' : 'GND', true);
    if (S.paused) { g.globalAlpha = 0.7; g.fillStyle = C['navy-deep']; g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.fillStyle = C.ink; g.font = '700 22px ' + FONT; g.textAlign = 'center'; g.fillText('Paused', W / 2, H / 2); }
  }

  function frame(ts) {
    var w = S.w; if (!w) return;
    var dt = Math.min(0.1, Math.max(0, (ts - S.lastT) / 1000)); S.lastT = ts;
    if (!S.paused && !w.over) for (var i = 0; i < S.speed; i++) w.step(dt);
    draw();
    if (ts - S.lastDom > 300) { S.lastDom = ts; dom(); }
  }
  window.TLUI = S;
})();
