/* The automatic controller (used when you fly), plus understanding what the user says in either seat, and hints. */
(function (TL) {
  'use strict';
  var P = TL.Phrase, Cmd = TL.Cmd;
  function ap() { return TL.AIRPORT; }
  var DEFER = { STARTUP: 1, TAXI: 1, TAXI_STAND: 1, LINE_UP: 1, CLEARED_TAKEOFF: 1 };   // wait for the user's readback before moving
  var PRI = { GOING_AROUND: 0, REPORT: 1, INBOUND: 2, READY: 3 };
  var GROUND_OUT = { TAXI_OUT: 1, HOLDING_POINT: 1, LINEUP: 1, LINED_UP: 1 };

  /* ================= Automatic controller ================= */
  function AutoATC(w) { this.w = w; this.req = {}; this.busy = {}; this.met = {}; this.lastTx = {}; this.last = 0; }
  var A = AutoATC.prototype;

  A.receive = function (ac, intent, data, ch) { this.req[ac.id] = { ac: ac, intent: intent, data: data || {}, ch: ch }; };
  A.addr = function (ac, ch) {
    var k = ac.id + ch;
    if (this.met[k]) return ac.cs.abbr;
    this.met[k] = 1; return ac.cs.full + ', ' + ap().units[ch];
  };
  A.issue = function (ac, unit, decide) {
    var w = this.w, self = this, ch = w.chan(unit);
    this.busy[ac.id] = true;
    w.radio.tx({ ch: ch, from: 'ATC', to: ac,
      valid: function () { return ac.alive; },
      build: function (t) {
        var cmds = decide(); if (!cmds || !cmds.length) return null;
        t.cmds = cmds; t.body = cmds.map(function (c) { return Cmd.text(w, ac, c); }).join(', ');
        return self.addr(ac, ch) + ', ' + t.body;
      },
      onSkip: function () { self.busy[ac.id] = false; },
      onEnd: function (t) { self.busy[ac.id] = false; self.lastTx[ac.id] = t.text; self.deliver(ac, t.cmds, ch, t.body); } });
  };
  A.deliver = function (ac, cmds, ch, body) {
    var w = this.w;
    if (!ac.alive) return;
    if (!ac.isUser) { TL.Pilot.respond(w, ac, cmds, ch); return; }
    cmds.forEach(function (c) { if (!DEFER[c.t]) TL.Pilot.apply(w, ac, c); });
    if (cmds.every(function (c) { return c.t === 'ROGER' || c.t === 'RADIO' || c.t === 'STANDBY'; })) return;
    w.pendingRb = { cmds: cmds, ch: ch, t: w.time, tries: 0, body: body };
    w.emit('pending', w.pendingRb);
  };

  /* Another departure already has the runway (line-up or take-off clearance) and has not started rolling. */
  A.otherLining = function (ac) {
    return this.w.acs.some(function (o) { return o !== ac && GROUND_OUT[o.phase] && (o.clr.lineup || o.clr.takeoff); });
  };
  A.canTakeoff = function (ac) {
    var w = this.w;
    if (w.rwyBlocker(ac)) return false;
    if (this.otherLining(ac)) return false;
    // do not launch behind slower traffic that is still climbing out on the runway track
    if (w.acs.some(function (o) { return o !== ac && o.phase === 'CLIMB' && o.perf.vClimb <= ac.perf.vClimb && Math.abs(o.v) < 500 && w.along(o.u) < (ac.perf.ifr ? 9000 : 3000); })) return false;
    if (w.needsBacktrack(ac) && ac.phase !== 'LINED_UP') return false;   // must backtrack and line up first
    var need = ac.phase === 'LINED_UP' ? 65 : ac.perf.ifr ? 95 : 110;
    return w.nextArrival(ac).t > need;
  };
  A.canLineup = function (ac) {
    var w = this.w, b = w.rwyBlocker(ac);
    if (w.needsBacktrack(ac)) {   // backtrack: needs an empty runway and a gap long enough to backtrack and line up
      return !b && !this.otherLining(ac) && w.nextArrival(ac).t > 150 + w.lineupTime(ac);
    }
    if (!b || b.phase === 'LINED_UP' || b.phase === 'LINEUP') return false;
    if (this.otherLining(ac)) return false;
    if (b.perf.vClimb < ac.perf.vClimb && b.phase !== 'LANDING_ROLL' && b.phase !== 'VACATING') return false;   // would be stuck behind a slow climber
    return w.nextArrival(ac).t > (b.phase === 'LANDING_ROLL' ? 210 : 150) + w.lineupTime(ac);
  };
  A.tkof = function (ac, first) {
    var w = this.w;
    if (!GROUND_OUT[ac.phase]) return first ? [{ t: 'ROGER' }] : null;
    if (this.canTakeoff(ac)) { ac.atcWait = null; return [{ t: 'CLEARED_TAKEOFF' }]; }
    ac.atcWait = 'TKOF';
    if (!ac.clr.lineup && this.canLineup(ac)) return [{ t: 'LINE_UP' }];
    if (!first || ac.clr.lineup) return null;
    return [{ t: 'HOLD_SHORT', why: w.rwyBlocker(ac) ? 'traffic on the runway' : 'traffic on final' }];
  };
  A.aheadOnFinal = function (ac) {
    var w = this.w, d = -w.la(ac.u);
    return w.acs.some(function (o) { return o !== ac && o.phase === 'FINAL' && ac.phase === 'FINAL' && -w.la(o.u) < d; });
  };
  A.landOk = function (ac) {
    var w = this.w;
    if (w.rwyBlocker(ac) || this.aheadOnFinal(ac)) return false;
    return !w.acs.some(function (o) { return o !== ac && o.clr.takeoff && o.alt === 0; });
  };
  A.land = function (ac, first) {
    if (ac.phase !== 'FINAL' && ac.phase !== 'BASE' && ac.phase !== 'DOWNWIND') return first ? [{ t: 'ROGER' }] : null;
    if (this.landOk(ac)) { ac.atcWait = null; return [{ t: ac.wantTG && !ac.perf.ifr ? 'CLEARED_TG' : 'CLEARED_LAND' }]; }
    ac.atcWait = 'LAND';
    if (!first) return null;
    return this.aheadOnFinal(ac) ? [{ t: 'CONTINUE' }, { t: 'NUMBER', n: 2 }] : [{ t: 'CONTINUE', why: 'traffic on the runway' }];
  };
  /* Track distance still to fly to the threshold, for aircraft established in the circuit. */
  A.td = function (o) {
    var w = this.w, pf = o.perf;
    if (o.phase === 'DOWNWIND') return Math.max(0, w.la(o.u) + pf.fl) + pf.cw + pf.fl;
    if (o.phase === 'BASE') return Math.abs(o.v) + pf.fl;
    if (o.phase === 'FINAL') return -w.la(o.u);
    return null;
  };
  /* Same-speed traffic too close ahead in the circuit. */
  A.tooClose = function (ac) {
    var self = this, me = this.td(ac);
    return this.w.acs.some(function (o) {
      if (o === ac || o.perf.ifr !== ac.perf.ifr || o.orbit) return false;
      var t = self.td(o); return t != null && me - t > -200 && me - t < 2600 && (me - t > 0 || o.id < ac.id);
    });
  };
  A.conflict = function (ac) {
    var w = this.w, eta = (Math.max(0, w.la(ac.u) + ac.perf.fl) + ac.perf.cw + ac.perf.fl) / ac.spd, hit = null;
    w.acs.forEach(function (o) {
      if (o === ac || o.phase !== 'FINAL') return;
      var t = w.eta(o, -w.la(o.u));
      if (o.perf.ifr !== ac.perf.ifr && t > eta - 110 && t < eta + 110) hit = o;
    });
    return hit;
  };

  A.answer = function (r) {
    var w = this.w, ac = r.ac, self = this, d = r.data, unit = r.ch === 'GND' ? 'GND' : 'TWR', ph = ac.phase;
    if (r.intent === 'SAY_AGAIN') {
      var lastText = this.lastTx[ac.id];
      if (lastText) w.radio.tx({ ch: r.ch, from: 'ATC', to: ac, text: lastText, onEnd: function () { if (w.pendingRb) w.pendingRb.t = w.time; } });
      return;
    }
    this.issue(ac, unit, function () {
      switch (r.intent) {
        case 'WRONG_UNIT': return [{ t: 'CONTACT', unit: d.unit }];
        case 'REQ_STARTUP': return ph === 'PARKED' ? [{ t: 'STARTUP' }] : [{ t: 'ROGER' }];
        case 'REQ_TAXI':
          if (ph === 'PARKED') return [{ t: 'STARTUP' }];
          if (ph === 'STARTED') return [{ t: 'TAXI' }];
          if (ph === 'VACATED' || ph === 'VACATING') return [{ t: 'TAXI_STAND' }];
          return [{ t: 'ROGER' }];
        case 'READY': return self.tkof(ac, true);
        case 'REQ_HANDOFF': ac.handIssued = true; return [{ t: 'CONTACT', unit: 'APP' }];
        case 'GOING_AROUND': return ac.missed ? [{ t: 'ROGER' }] : [{ t: 'ROGER' }, { t: 'REPORT', point: 'downwind' }];
        case 'RADIO_CHECK': return [{ t: 'RADIO' }];
        case 'VACATED':
          if (ac.isUser && unit === 'TWR' && w.mode === 'PILOT') return [{ t: 'CONTACT', unit: 'GND' }];
          return ph === 'VACATED' || ph === 'VACATING' || ph === 'LANDING_ROLL' ? [{ t: 'TAXI_STAND' }] : [{ t: 'ROGER' }];
        case 'INBOUND':
          if (d.ifr || ph === 'FINAL') return -w.la(ac.u) > 9000 ? [{ t: 'CONTINUE' }, { t: 'QNH' }] : self.land(ac, true);
          if (ph === 'INBOUND') return [{ t: 'JOIN' }, { t: 'REPORT', point: 'downwind' }];
          return [{ t: 'ROGER' }];
        case 'REPORT':
          if (!TL.AIR[ac.phase]) return [{ t: 'ROGER' }];
          if (d.want) ac.wantTG = d.want === 'TG';
          if (d.point === 'final' || ac.phase === 'FINAL') return self.land(ac, true);
          if (d.point === 'base') return [{ t: 'REPORT', point: 'final' }];
          var conf = ac.phase === 'DOWNWIND' ? self.conflict(ac) : null;
          if (conf) { ac.atcWait = 'BASE'; ac.confWith = conf; return [{ t: 'EXTEND' }, { t: 'NUMBER', n: 2, follow: conf.perf.short + ' on final' }]; }
          var n = 1 + w.acs.filter(function (o) { return o !== ac && (o.phase === 'FINAL' || o.phase === 'BASE'); }).length;
          return n > 1 ? [{ t: 'NUMBER', n: n }, { t: 'REPORT', point: 'final' }] : [{ t: 'REPORT', point: 'final' }];
      }
      return [{ t: 'ROGER' }];
    });
  };

  /* Things the controller does without being asked. */
  A.pro = function (ac) {
    var w = this.w, self = this, ph = ac.phase, d = -w.la(ac.u);
    if (ac.atcWait === 'TKOF') {
      if (!GROUND_OUT[ph]) { ac.atcWait = null; return; }
      if (this.canTakeoff(ac) || (!ac.clr.lineup && ph === 'HOLDING_POINT' && this.canLineup(ac))) this.issue(ac, 'TWR', function () { return self.tkof(ac, false); });
      return;
    }
    if (ac.atcWait === 'LAND') {
      if (ph !== 'FINAL' && ph !== 'BASE') { ac.atcWait = null; return; }
      if (this.landOk(ac)) this.issue(ac, 'TWR', function () { return self.land(ac, false); });
      else if (ph === 'FINAL' && d < (ac.perf.ifr ? 1500 : 800)) this.issue(ac, 'TWR', function () { return ac.phase === 'FINAL' && !self.landOk(ac) ? [{ t: 'GO_AROUND' }] : self.land(ac, false); });
      return;
    }
    if (ac.atcWait === 'BASE') {
      var c = ac.confWith;
      if (ph !== 'DOWNWIND') { ac.atcWait = null; return; }
      var mine = (ac.perf.cw + Math.max(0, -w.la(ac.u))) / 38;
      if (!c || !c.alive || c.phase !== 'FINAL' || w.eta(c, -w.la(c.u)) < mine - 110) { ac.atcWait = null; this.issue(ac, 'TWR', function () { return ac.phase === 'DOWNWIND' ? [{ t: 'TURN_BASE' }, { t: 'NUMBER', n: 2 }] : null; }); }
      return;
    }
    if (ph === 'DOWNWIND' && !ac.extend && !ac.orbit) {
      var lined = !ac.rep.orb && this.td(ac) / ac.spd < 170 && w.acs.some(function (o) { return o.phase === 'LINED_UP' && o.atcWait === 'TKOF' && w.time - o.linedAt > 15; });
      if (lined) { ac.rep.orb = 1; this.issue(ac, 'TWR', function () { return ac.phase === 'DOWNWIND' && !ac.orbit ? [{ t: 'ORBIT' }, { t: 'NUMBER', n: 2, follow: 'departing traffic' }] : null; }); return; }
      if (this.tooClose(ac)) { this.issue(ac, 'TWR', function () { return ac.phase === 'DOWNWIND' && !ac.orbit && self.tooClose(ac) ? [{ t: 'ORBIT' }, { t: 'NUMBER', n: 2 }] : null; }); return; }
      if (this.conflict(ac)) this.issue(ac, 'TWR', function () {
        var c2 = ac.phase === 'DOWNWIND' ? self.conflict(ac) : null; if (!c2) return null;
        ac.atcWait = 'BASE'; ac.confWith = c2; return [{ t: 'EXTEND' }, { t: 'NUMBER', n: 2, follow: c2.perf.short + ' on final' }];
      });
      return;
    }
    if (ph === 'FINAL' && !ac.clr.land && !ac.call && d < (ac.perf.ifr ? 2600 : 1000) && d > 0) {
      if (ac.isUser && !ac.rep.fin) { ac.rep.fin = 1; w.score.missed++; w.note('tip', 'You did not report final. The tower had to call you.', -2); }
      this.issue(ac, 'TWR', function () { return self.land(ac, true); });
      return;
    }
    if ((ac.kind === 'DEP' || ac.missed) && ph === 'CLIMB' && ac.alt > 1500 && !ac.handed && !ac.handIssued) {
      ac.handIssued = true; this.issue(ac, 'TWR', function () { return [{ t: 'CONTACT', unit: 'APP' }]; });
      return;
    }
    if (ac.isUser && w.mode === 'PILOT' && !ac.ctTwr && w.tuned === 'GND' && ((ph === 'TAXI_OUT' && ac.path.length <= 1) || ph === 'HOLDING_POINT')) {
      ac.ctTwr = true; this.issue(ac, 'GND', function () { return [{ t: 'CONTACT', unit: 'TWR' }]; });
    }
  };

  A.step = function () {
    var w = this.w, self = this;
    if (w.time - this.last < 0.5) return;
    this.last = w.time;
    var rb = w.pendingRb;
    if (rb && w.time - rb.t > 40) {
      if (!rb.nagged) {
        rb.nagged = true; rb.t = w.time + 5;
        w.radio.tx({ ch: rb.ch, from: 'ATC', to: w.user, text: w.user.cs.abbr + ', ' + rb.body + ', acknowledge', onEnd: function () { if (w.pendingRb === rb) rb.t = w.time; } });
      } else { w.score.missed++; w.score.rbTotal++; w.note('tip', 'No readback given for: ' + rb.body, -3); acceptRb(w); }
    }
    Object.keys(this.req).sort(function (a, b) {
      var x = PRI[self.req[a].intent], y = PRI[self.req[b].intent];
      return (x == null ? 9 : x) - (y == null ? 9 : y);
    }).forEach(function (id) {
      var r = self.req[id];
      if (!r.ac.alive) { delete self.req[id]; return; }
      if (self.busy[id] || (r.ac.isUser && w.pendingRb)) return;
      delete self.req[id]; self.answer(r);
    });
    w.acs.forEach(function (ac) {
      if (self.busy[ac.id] || self.req[ac.id] || (ac.isUser && w.pendingRb)) return;
      self.pro(ac);
    });
  };

  /* ================= You are the pilot ================= */
  var RBREQ = { STARTUP: ['start', 'qnh'], TAXI: ['hold', 'rwy'], TAXI_STAND: ['stand'], HOLD_POSITION: ['holdw'], HOLD_SHORT: ['holdw', 'rwy'],
    LINE_UP: ['lineup', 'rwy', 'bt'], CLEARED_TAKEOFF: ['takeoff', 'rwy'], CLEARED_LAND: ['land', 'rwy'], CLEARED_TG: ['touch', 'rwy'],
    GO_AROUND: ['goaround'], JOIN: ['downwind', 'rwy', 'qnh'], CONTACT: ['freq'] };
  var RBNAME = { start: 'start-up', qnh: 'QNH', hold: 'holding point', rwy: 'runway', stand: 'stand number', holdw: 'the word "hold"', lineup: '"line up"',
    takeoff: '"cleared for take-off"', bt: '"backtrack"', land: '"cleared to land"', touch: '"touch and go"', goaround: '"going around"', downwind: 'downwind', freq: 'frequency' };
  function has(w, key, n, c, ac) {
    var s = n.plain, some = function (v) { return n.nums.some(function (x) { return x.indexOf(v) >= 0; }); };
    switch (key) {
      case 'start': return /start/.test(s);
      case 'qnh': return some(String(w.qnh));
      case 'rwy': return P.rwyNamed(n, w.rw.id);
      case 'hold': return P.desigAfter(n, ['point', 'holding', 'short', 'hold'], w.holdOf(ac).name);
      case 'stand': return P.desigAfter(n, ['stand'], w.standName(ac));
      case 'holdw': return /hold/.test(s);
      case 'lineup': return /line up/.test(s);
      case 'bt': return !w.needsBacktrack(ac) || /back ?track/.test(s);
      case 'takeoff': return /take off/.test(s);
      case 'land': return /land/.test(s);
      case 'touch': return /touch/.test(s);
      case 'goaround': return /go(ing)? around/.test(s);
      case 'downwind': return /downwind/.test(s);
      case 'freq': var f = ap().freqs[c.unit]; return some(f) || some(f.replace('.', ''));
    }
    return true;
  }
  function checkRb(w, cmds, n, ac) {
    var miss = [];
    cmds.forEach(function (c) { (RBREQ[c.t] || []).forEach(function (k) { if (!has(w, k, n, c, ac) && miss.indexOf(RBNAME[k]) < 0) miss.push(RBNAME[k]); }); });
    return miss;
  }
  function acceptRb(w) {
    var rb = w.pendingRb; if (!rb) return;
    w.pendingRb = null;
    rb.cmds.forEach(function (c) {
      if (DEFER[c.t]) TL.Pilot.apply(w, w.user, c);
      if (c.t === 'CONTACT') { if (c.unit === 'APP') w.finish('Handed off to ' + ap().units.APP); else w.expectFreq = c.unit; }
    });
    w.emit('pending', null);
  }
  function parsePilot(n) {
    var s = n.plain;
    if (/say again/.test(s)) return { i: 'SAY_AGAIN' };
    if (/radio check/.test(s)) return { i: 'RADIO_CHECK' };
    if (/go(ing)? around/.test(s)) return { i: 'GOING_AROUND' };
    if (/vacated|clear of (the )?runway|runway clear/.test(s)) return { i: 'VACATED' };
    if (/request/.test(s) && /start/.test(s)) return { i: 'REQ_STARTUP' };
    if (/request|ready/.test(s) && /taxi/.test(s)) return { i: 'REQ_TAXI' };
    if (/ready/.test(s)) return { i: 'READY', tk: /take off/.test(s) };
    if (/frequency change/.test(s)) return { i: 'REQ_HANDOFF' };
    if (/inbound|for landing|joining instructions|request join/.test(s) && !/downwind|final|base/.test(s)) return { i: 'INBOUND' };
    if (!/report|wilco|will|extend|join|turn|cleared/.test(s)) {
      var want = /touch/.test(s) ? 'TG' : /full stop|land/.test(s) ? 'LAND' : null;
      if (/downwind/.test(s)) return { i: 'REPORT', point: 'downwind', want: want };
      if (/final/.test(s)) return { i: 'REPORT', point: 'final', want: want };
      if (/base/.test(s)) return { i: 'REPORT', point: 'base', want: want };
    }
    return null;
  }
  var UNIT = { REQ_STARTUP: 'GND', REQ_TAXI: 'GND', READY: 'TWR', REPORT: 'TWR', INBOUND: 'TWR', GOING_AROUND: 'TWR', REQ_HANDOFF: 'TWR' };

  function userPilotSays(w, textIn) {
    var ac = w.user, n = P.norm(textIn), ch = w.tuned, atc = w.atc, c = w.radio.ch[ch];
    w.emit('tx', { from: 'USER', ch: ch, text: textIn, aud: true });
    c.free = Math.max(c.free, w.time + 0.8);
    if (!P.matchCs(n, ac.cs) && !w.csTip) { w.csTip = true; w.note('tip', 'Include your callsign in every transmission.', 0); }
    var it = parsePilot(n), rb = w.pendingRb;
    if (rb) {
      if (rb.cmds.some(function (x) { return x.t === 'GO_AROUND'; }) && it && it.i === 'GOING_AROUND') it = null;
      var needs = rb.cmds.some(function (x) { return (RBREQ[x.t] || []).length; });
      var miss = rb.ch === ch ? checkRb(w, rb.cmds, n, ac) : ['frequency'];
      if (it || rb.ch !== ch) {
        if (needs) { w.score.missed++; w.score.rbTotal++; w.note('tip', 'No readback given for: ' + rb.body, -3); }
        acceptRb(w);
      } else if (!miss.length) {
        if (needs) { w.score.rbTotal++; if (!rb.tries) w.score.rbOk++; }
        acceptRb(w); return;
      } else {
        rb.tries++; w.score.rbBad++;
        w.note('tip', 'Readback incomplete. Missing: ' + miss.join(', ') + '.', -1);
        if (rb.tries >= 2) { w.score.rbTotal++; acceptRb(w); return; }
        w.radio.tx({ ch: ch, from: 'ATC', to: ac, text: ac.cs.abbr + ', negative, ' + rb.body, onEnd: function () { if (w.pendingRb === rb) rb.t = w.time; } });
        rb.t = w.time + 8;
        return;
      }
    }
    if (!it) {
      if (!/\b(roger|wilco|affirm|negative|thanks?|good day)\b/.test(n.plain) && n.plain.split(' ').length > 1)
        w.radio.tx({ ch: ch, from: 'ATC', to: ac, text: ac.cs.abbr + ', say again' });
      return;
    }
    if (it.i === 'READY' && it.tk) w.note('tip', 'Say "ready for departure". The words "take-off" are used only in the take-off clearance and its readback.', -1);
    if (it.i === 'GOING_AROUND') ac.gaSay = false;
    if (it.i === 'REPORT') ac.rep[it.point === 'downwind' ? 'dw' : it.point === 'final' ? 'fin' : 'base'] = 1;
    var want = UNIT[it.i];
    if (want && want !== ch) { w.note('tip', 'That call belongs on ' + ap().units[want] + ' ' + ap().freqs[want] + '.', -1); atc.receive(ac, 'WRONG_UNIT', { unit: want }, ch); return; }
    atc.receive(ac, it.i, { point: it.point, want: it.want }, ch);
  }

  /* ================= You are the controller ================= */
  function findAc(w, n) {
    var best = null, bs = 0, tie = false;
    w.acs.forEach(function (ac) { var s = P.matchCs(n, ac.cs); if (s > bs) { bs = s; best = ac; tie = false; } else if (s === bs && s) tie = true; });
    return tie && bs < 3 ? null : best;
  }
  function parseAtc(w, n, ac) {
    var s = n.plain, cmds = [], m, ph = ac.phase;
    if (/go around/.test(s)) return [{ t: 'GO_AROUND' }];
    if (/say again/.test(s)) return [{ t: 'SAY_AGAIN' }];
    if (/start up|push back/.test(s)) cmds.push({ t: 'STARTUP' });
    if (/continue taxi|resume taxi/.test(s)) cmds.push({ t: 'RESUME' });
    else if (/taxi/.test(s)) {
      var inb = ph === 'VACATED' || ph === 'VACATING' || ph === 'LANDING_ROLL' || ph === 'TAXI_IN' || /\b(stand|apron|bay|gate|parking)\b/.test(s);
      cmds.push({ t: inb ? 'TAXI_STAND' : 'TAXI' });
    }
    if (/hold position|\bstop\b/.test(s)) cmds.push({ t: 'HOLD_POSITION' });
    else if (/hold short|hold at|holding point \w+ hold\b/.test(s)) cmds.push({ t: 'HOLD_SHORT' });
    if (/line up|back ?track/.test(s)) cmds.push({ t: 'LINE_UP' });
    if (/cleared (for |4 )?(immediate )?take off|take off (is )?cleared/.test(s)) cmds.push({ t: 'CLEARED_TAKEOFF' });
    if (/touch and go/.test(s)) cmds.push({ t: 'CLEARED_TG' });
    else if (/cleared (to |too |2 )?land|cleared full stop|land(ing)? cleared/.test(s)) cmds.push({ t: 'CLEARED_LAND' });
    if (/continue/.test(s) && !/continue taxi/.test(s)) cmds.push({ t: 'CONTINUE' });
    if (/extend/.test(s)) cmds.push({ t: 'EXTEND' });
    if (/turn (left |right )?base|base now/.test(s)) cmds.push({ t: 'TURN_BASE' });
    if (/orbit|\b360\b/.test(s)) cmds.push({ t: 'ORBIT', dir: /right/.test(s) ? 'right' : /left/.test(s) ? 'left' : undefined });
    if (/join/.test(s)) cmds.push({ t: 'JOIN' });
    if ((m = /number (\d)/.exec(s))) cmds.push({ t: 'NUMBER', n: +m[1] });
    if ((m = /report (downwind|base|final|short final)/.exec(s))) cmds.push({ t: 'REPORT', point: m[1] });
    if ((m = /vacate (?:via |at |on |left |right )*(?:taxiway )?(\w+)(?: (\d{1,2})\b)?/.exec(s))) { var L = P.desig(m[1], m[2]); if (!ap().holds[L] && m[2]) L = P.desig(m[1]); if (ap().holds[L] && w.rw.exits.indexOf(L) >= 0) cmds.push({ t: 'VACATE', exit: L }); }
    if (/contact|frequency change/.test(s)) cmds.push({ t: 'CONTACT', unit: /ground/.test(s) ? 'GND' : /tower/.test(s) ? 'TWR' : 'APP' });
    if (!cmds.length && /standby/.test(s)) cmds.push({ t: 'STANDBY' });
    if (!cmds.length && /qnh/.test(s)) cmds.push({ t: 'QNH' });
    if (!cmds.length && /roger|affirm|correct|negative/.test(s)) cmds.push({ t: 'ROGER' });
    return cmds;
  }
  function userAtcSays(w, textIn, sel) {
    var n = P.norm(textIn);
    w.emit('tx', { from: 'USER', ch: 'TWR', text: textIn, aud: true });
    var c = w.radio.ch.TWR; c.free = Math.max(c.free, w.time + 0.8);
    var ac = findAc(w, n);
    if (!ac) {
      if (!sel || !sel.alive) { w.note('tip', 'No callsign recognised. Say the callsign first, or tap a strip and try again.', 0); return; }
      ac = sel;
      if (!w.csTip) { w.csTip = true; w.note('tip', 'Start each instruction with the aircraft callsign. Sent to the selected strip this time.', 0); }
    }
    var cmds = parseAtc(w, n, ac);
    if (!cmds.length) { w.radio.tx({ ch: 'TWR', from: ac, pri: true, text: ap().units.TWR + ', say again for ' + ac.cs.abbr }); return; }
    var wrongRwy = !P.rwyNamed(n, w.rw.id) && Object.keys(ap().runways).some(function (id) { return id !== w.rw.id && P.rwyNamed(n, id); });
    if (wrongRwy && /runway/.test(n.plain)) {
      w.note('tip', 'Runway in use is ' + w.rw.id + '.', -2);
      w.radio.tx({ ch: 'TWR', from: ac, pri: true, text: 'Confirm runway ' + w.rw.id + '? ' + ac.cs.abbr }); return;
    }
    cmds.forEach(function (k) {
      var clr = k.t === 'CLEARED_TAKEOFF' || k.t === 'CLEARED_LAND' || k.t === 'CLEARED_TG' || k.t === 'LINE_UP';
      if (clr && !P.rwyNamed(n, w.rw.id) && !w.rwTip) { w.rwTip = true; w.note('tip', 'Include the runway designator in line-up, take-off and landing clearances.', -1); }
      if (k.t === 'CLEARED_TAKEOFF' && GROUND_OUT[ac.phase] && w.nextArrival(ac).t < 50) w.note('bad', 'Take-off clearance issued with traffic on short final', -10);
    });
    TL.Pilot.respond(w, ac, cmds, 'TWR');
  }

  World_userSays();
  function World_userSays() {
    TL.World.prototype.userSays = function (textIn, sel) {
      if (this.over || !String(textIn).trim()) return;
      if (this.mode === 'PILOT') userPilotSays(this, textIn); else userAtcSays(this, textIn, sel);
    };
  }

  /* ================= Hints ================= */
  function pilotHint(w) {
    var ac = w.user, rb = w.pendingRb, ph = ac.phase, cs = ac.cs, r = 'runway ' + w.rw.id, G = ap().units.GND, T = ap().units.TWR;
    var tune = function (u) { return { note: 'Tune ' + ap().units[u] + ' ' + ap().freqs[u] + '.', opts: [] }; };
    if (rb) {
      if (rb.ch !== w.tuned) return tune(rb.ch);
      var parts = rb.cmds.map(function (c) { return Cmd.rb(w, ac, c); }).filter(Boolean);
      return { note: 'Read back the instruction.', opts: [parts.join(', ') + ', ' + cs.abbr] };
    }
    if (w.expectFreq && w.expectFreq !== w.tuned) return tune(w.expectFreq);
    var g = w.tuned === 'GND';
    switch (ph) {
      case 'PARKED': return g ? { note: 'Ask for start-up.', opts: [G + ', ' + cs.full + ', stand ' + w.standName(ac) + ', information ' + w.info + ', request start-up' + (ac.kind === 'CIRCUIT' ? ' for circuits' : ', VFR to ' + ac.dest)] } : tune('GND');
      case 'STARTED': return g ? { note: 'Ask for taxi.', opts: [cs.abbr + ', request taxi'] } : tune('GND');
      case 'TAXI_OUT': return { note: 'Taxiing to holding point ' + w.holdOf(ac).name + '. Listen out.', opts: [] };
      case 'HOLDING_POINT': return g ? { note: 'Wait to be passed to Tower.', opts: [] } : { note: ac.atcWait || ac.toldHold ? 'Holding. Wait for the tower.' : 'Report ready.', opts: ac.atcWait ? [] : [T + ', ' + cs.full + ', holding point ' + w.holdOf(ac).name + ', ready for departure'] };
      case 'LINEUP': case 'LINED_UP': return { note: ac.backtracking ? 'Backtracking to the end of runway ' + w.rw.id + '. Listen out.' : ac.clr.takeoff ? 'Cleared for take-off.' : 'Lined up. Wait for take-off clearance.', opts: [] };
      case 'TKOF_ROLL': return { note: 'Rolling.', opts: [] };
      case 'CLIMB': return { note: ac.gaSay ? 'Going around. Tell the tower.' : ac.kind === 'DEP' ? 'Climbing out. Wait for the handoff.' : 'Climbing. Report when downwind.', opts: ac.gaSay ? [cs.abbr + ', going around'] : [] };
      case 'CROSSWIND': return { note: 'Crosswind. Report when downwind.', opts: [] };
      case 'INBOUND': return ac.joinClr ? { note: 'Joining the circuit.', opts: [] } : { note: 'Call the tower for joining instructions.', opts: [T + ', ' + cs.full + ', ' + ac.perf.name + ', ' + ac.posRep + ', inbound for landing, information ' + w.info] };
      case 'DOWNWIND': return ac.rep.dw ? { note: ac.extend ? 'Extending downwind. Wait for the base call.' : 'Downwind.', opts: [] } : { note: 'Report downwind with your intentions.', opts: (function () {
        var fs = cs.abbr + ', downwind ' + r + ', full stop', tg = cs.abbr + ', downwind ' + r + ', touch and go';
        return ac.kind !== 'CIRCUIT' ? [fs] : ac.wantTG ? [tg, fs] : [fs, tg];   // full stop first unless a touch and go is wanted
      })() };
      case 'BASE': return { note: 'Base leg.', opts: [] };
      case 'FINAL': return ac.clr.land ? { note: ac.clr.land === 'TG' ? 'Cleared touch and go.' : 'Cleared to land.', opts: [] } : { note: 'Report final.', opts: ac.rep.fin ? [] : [cs.abbr + ', final ' + r] };
      case 'LANDING_ROLL': case 'TG_ROLL': case 'VACATING': return { note: 'On the runway.', opts: [] };
      case 'VACATED': return g ? { note: 'Ask Ground for taxi to the stand.', opts: [G + ', ' + cs.full + ', runway vacated via ' + ac.exit + ', request taxi'] } : { note: 'Report runway vacated.', opts: [cs.abbr + ', runway vacated via ' + ac.exit] };
      case 'TAXI_IN': return { note: 'Taxiing to stand ' + w.standName(ac) + '.', opts: [] };
    }
    return { note: '', opts: [] };
  }
  /* Instructions that make sense for this aircraft right now (the tap-to-send buttons in the tower seat).
     Nothing already given to this aircraft is offered again, and no take-off or landing clearance is offered while the runway is occupied. */
  function atcHint(w, ac) {
    var told = ac.told || {}, o = [], blocked = !!w.rwyBlocker(ac);
    function add(t, x, tail) {
      var c = { t: t }, k; if (x) for (k in x) c[k] = x[k];
      if (told[Cmd.key(c)]) return;
      o.push(Cmd.text(w, ac, c) + (tail || ''));
    }
    switch (ac.phase) {
      case 'PARKED': add('STARTUP'); add('STANDBY'); break;
      case 'STARTED': add('TAXI'); add('STANDBY'); break;
      case 'TAXI_OUT': add(ac.holdPos ? 'RESUME' : 'HOLD_POSITION'); add('LINE_UP'); if (!blocked) add('CLEARED_TAKEOFF'); break;
      case 'HOLDING_POINT': if (!blocked) add('CLEARED_TAKEOFF'); add('LINE_UP'); add('HOLD_SHORT'); break;
      case 'LINEUP': case 'LINED_UP': if (!blocked) add('CLEARED_TAKEOFF'); add(ac.holdPos ? 'RESUME' : 'HOLD_POSITION'); break;
      case 'CLIMB': if (ac.kind === 'DEP' || ac.missed) add('CONTACT', { unit: 'APP' }); else add('REPORT', { point: 'downwind' }); break;
      case 'CROSSWIND': add('REPORT', { point: 'downwind' }); add('EXTEND'); break;
      case 'INBOUND': add('JOIN', null, ', report downwind'); if (!ac.orbit) add('ORBIT'); add('STANDBY'); break;
      case 'DOWNWIND':
        add('REPORT', { point: 'final' });
        if (!told['REPORT:final']) o.push('number 2, report final');
        add(ac.extend ? 'TURN_BASE' : 'EXTEND'); if (!ac.orbit) add('ORBIT');
        break;
      case 'BASE': case 'FINAL':
        if (!ac.clr.land) {
          if (!blocked) {
            var land = ['CLEARED_LAND']; if (!ac.perf.ifr) { if (ac.wantTG) land.unshift('CLEARED_TG'); else land.push('CLEARED_TG'); }
            land.forEach(function (t) { add(t); });
          }
          add('CONTINUE');
        }
        add('GO_AROUND'); break;
      case 'LANDING_ROLL': case 'VACATING': add('TAXI_STAND'); break;
      case 'VACATED': add('TAXI_STAND'); add('STANDBY'); break;
      case 'TAXI_IN': add(ac.holdPos ? 'RESUME' : 'HOLD_POSITION'); break;
    }
    return o;
  }

  TL.AutoATC = AutoATC;
  TL.Hint = { pilot: pilotHint, atc: atcHint };
  TL.parseAtc = parseAtc; TL.parsePilot = parsePilot;
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
