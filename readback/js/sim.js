/* World, aircraft movement and the radio channels. No DOM in here, so it also runs under Node for tests. */
(function (TL) {
  'use strict';
  var P = TL.Phrase, RAD = Math.PI / 180;
  function ap() { return TL.AIRPORT; }   // read at call time, so a change of airport applies everywhere

  // jet = engine type (the ATR 72 is a turboprop). ifr = airline traffic: flies the ILS, flies a missed approach instead of a visual circuit.
  // speeds m/s, climb/desc ft/min, turn deg/s, cw = downwind offset (m), fl = final length (m), xa = crosswind turn point (m from threshold)
  var PERF = {
    C172: { name: 'Cessna 172', short: 'Cessna', taxi: 8, vr: 28, vClimb: 39, vCruise: 46, vApp: 34, climb: 700, desc: 600, acc: 1.6, brk: 2.2, turn: 5, cw: 1800, fl: 2200, xa: 2200, jet: false, ifr: false, circ: 1000 },
    A320: { name: 'Airbus A320', short: 'A320', taxi: 11, vr: 72, vClimb: 85, vCruise: 98, vApp: 70, climb: 2200, desc: 1200, acc: 2.2, brk: 2.0, turn: 2.5, cw: 5500, fl: 8000, xa: 7000, jet: true, ifr: true, circ: 1500 },
    B738: { name: 'Boeing 737', short: '737', taxi: 11, vr: 74, vClimb: 87, vCruise: 98, vApp: 72, climb: 2200, desc: 1200, acc: 2.2, brk: 2.0, turn: 2.5, cw: 5500, fl: 8000, xa: 7000, jet: true, ifr: true, circ: 1500 },
    AT72: { name: 'ATR 72', short: 'ATR', taxi: 10, vr: 57, vClimb: 70, vCruise: 82, vApp: 59, climb: 1400, desc: 1000, acc: 1.9, brk: 2.2, turn: 3, cw: 4500, fl: 6500, xa: 6000, jet: false, ifr: true, circ: 1500 }
  };
  var SURFACE = { LINEUP: 1, LINED_UP: 1, TKOF_ROLL: 1, LANDING_ROLL: 1, TG_ROLL: 1, VACATING: 1 };
  var AIR = { CLIMB: 1, CROSSWIND: 1, DOWNWIND: 1, BASE: 1, FINAL: 1, INBOUND: 1 };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  /* ---------- Radio ---------- */
  function Radio(w) { this.w = w; this.ch = { GND: { q: [], cur: null, free: 0 }, TWR: { q: [], cur: null, free: 0 } }; this.ptt = false; }
  Radio.prototype.tx = function (t) {
    var q = this.ch[t.ch].q;
    if (t.pri) { var i = 0; while (i < q.length && q[i].pri) i++; q.splice(i, 0, t); } else q.push(t);
    return t;
  };
  Radio.prototype.busy = function (ch) { var c = this.ch[ch]; return !!c.cur || c.q.length > 0; };
  Radio.prototype.step = function () {
    var w = this.w;
    for (var k in this.ch) {
      var c = this.ch[k];
      if (c.cur) {
        if (w.time >= c.cur.end && !c.cur.hold) { var d = c.cur; c.cur = null; c.free = w.time + 0.6; if (d.onEnd) d.onEnd(d); }
        continue;
      }
      if (w.time < c.free) continue;
      if (this.ptt && w.audible(k)) continue;
      while (c.q.length) {
        var t = c.q.shift();
        if (t.valid && !t.valid()) { if (t.onSkip) t.onSkip(); continue; }
        if (t.build) { var x = t.build(t); if (!x) { if (t.onSkip) t.onSkip(); continue; } t.text = x; }
        t.aud = w.audible(k);
        t.start = w.time;
        t.end = w.time + (t.aud ? P.spoken(t.text).split(/\s+/).length / 3 + 0.5 : 1);
        c.cur = t;
        w.emit('tx', t);
        break;
      }
    }
  };

  /* ---------- World ---------- */
  function World(o) {
    o = o || {};
    this.mode = o.mode || 'ATC';           // 'PILOT' (user flies), 'ATC' (user controls), 'AUTO' (everything automatic, for tests)
    this.time = 0; this.acs = []; this.nid = 1; this.L = {};
    var A = ap(), ids = Object.keys(A.runways), rid = A.runways[o.runway] ? o.runway : null;
    if (!rid) {   // set by the wind: each runway's pref is how often it is the one in use
      var tot = 0, r0; ids.forEach(function (k) { tot += A.runways[k].pref || 1; }); r0 = Math.random() * tot;
      for (var q = 0; q < ids.length; q++) { r0 -= A.runways[ids[q]].pref || 1; if (r0 <= 0) { rid = ids[q]; break; } }
      rid = rid || ids[0];
    }
    this.ap = A;
    this.rw = A.runways[rid];
    this.rwAngle = this.rw.dir > 0 ? 0 : Math.PI;
    this.wind = { dir: ((Math.round((this.rw.hdg + rnd(-40, 40)) / 10) * 10 + 359) % 360) + 1, spd: Math.round(rnd(3, 12)) };
    this.qnh = Math.round(rnd(1004, 1016));
    this.info = pick(['Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Quebec', 'Romeo', 'Sierra']);
    this.stands = A.standIds.map(function () { return null; });
    this.radio = new Radio(this);
    this.score = { pts: 0, moves: 0, notes: [], rbOk: 0, rbTotal: 0, rbBad: 0, missed: 0 };   // rbOk of rbTotal = readbacks right first time
    this.tuned = ap().noGnd ? 'TWR' : 'GND'; this.pendingRb = null; this.user = null; this.over = false;
    this.atc = this.mode !== 'ATC' ? new TL.AutoATC(this) : null;
    this.traffic = { level: o.traffic == null ? 1 : o.traffic, next: 4 };
    this.lastCheck = 0; this.pairs = {};
  }
  var W = World.prototype;
  W.on = function (e, f) { (this.L[e] = this.L[e] || []).push(f); };
  W.emit = function (e, a, b) { (this.L[e] || []).forEach(function (f) { f(a, b); }); };
  W.pt = function (a, c) { return { u: this.rw.thrU + this.rw.dir * a, v: -c }; };
  W.along = function (u) { return (u - this.rw.thrU) * this.rw.dir; };
  /* Landing geometry uses the landing threshold, which may be displaced (rw.dthr metres in from the runway end). */
  W.la = function (u) { return this.along(u) - (this.rw.dthr || 0); };
  W.lpt = function (a, c) { return this.pt(a + (this.rw.dthr || 0), c); };
  W.chan = function (unit) { return this.mode === 'ATC' ? 'TWR' : (unit === 'GND' && !ap().noGnd ? 'GND' : 'TWR'); };
  W.station = function (unit) { return this.mode === 'ATC' ? ap().units.TWR : ap().units[unit === 'GND' && !ap().noGnd ? 'GND' : 'TWR']; };
  W.audible = function (ch) { return this.mode === 'PILOT' ? ch === this.tuned : this.mode === 'ATC'; };
  W.windText = function () { return 'wind ' + ('00' + this.wind.dir).slice(-3) + ' degrees ' + this.wind.spd + ' knots'; };
  /* Heights inside the sim are above the field (never below zero); what is said and shown is MSL, rounded to 100 ft. */
  W.amsl = function (ac) { return this.msl(ac.alt); };
  W.msl = function (agl) { return Math.round((Math.max(0, agl) + ap().elev) / 100) * 100; };
  /* Compass direction (e.g. 'southwest') of a runway-frame point as seen from the middle of the field. */
  W.compass = function (p) {
    var A = ap(), h = A.axisHdg * RAD, du = p.u - A.length / 2, dv = p.v;
    var x = du * Math.sin(h) + dv * -Math.cos(h), y = du * Math.cos(h) + dv * Math.sin(h);
    var b = (Math.atan2(x, y) / RAD + 360) % 360;
    return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(b / 45) % 8];
  };
  W.node = function (id) { return ap().nodes[id]; };
  /* "5 miles southwest, 2500 feet": position report from an aircraft's current position, MSL altitude. */
  W.posReport = function (ac) {
    var A = ap(), d = Math.hypot(ac.u - A.length / 2, ac.v) / 1852;
    return Math.max(1, Math.round(d)) + ' miles ' + this.compass(ac) + ', ' + this.amsl(ac) + ' feet';
  };
  /* Height above the field that gives a round MSL altitude, e.g. circuit 1000 ft AGL at a 4390 ft field -> 5400 ft MSL (1010 ft AGL). */
  W.agl = function (nominal) { var e = ap().elev; return Math.max(nominal * 0.8, Math.round((e + nominal) / 100) * 100 - e); };
  W.note = function (kind, text, pts) {
    var n = { kind: kind, text: text, pts: pts || 0, t: this.time };
    this.score.notes.push(n); this.score.pts += n.pts; this.emit('note', n);
  };
  W.finish = function (why) { if (this.over) return; this.over = true; this.emit('finish', why); };

  /* ---------- spawning ---------- */
  W.freeStand = function (type) {
    var A = ap(), small = A.smallStands || [], big = type && type !== 'C172' && type !== 'AT72', f = [];
    this.stands.forEach(function (s, i) { if (!s && !(big && small.indexOf(String(A.nodes[A.standIds[i]].name)) >= 0)) f.push(i); });
    return f.length ? pick(f) : -1;
  };
  W.newCs = function (type) {
    var cs, tries = 0;
    do {
      if (type === 'C172') cs = P.regCs(P.randomReg(ap().reg));
      else { var als = (ap().airlines || P.AIRLINES).filter(function (a) { return a.types.indexOf(type) >= 0; });
        if (!als.length) als = ap().airlines || P.AIRLINES; cs = P.airlineCs(pick(als), Math.floor(rnd(101, 989))); }
    } while (tries++ < 20 && this.acs.some(function (a) { return a.cs.full === cs.full || (cs.num && a.cs.num === cs.num) || a.cs.abbr === cs.abbr; }));
    return cs;
  };
  W.spawn = function (kind, o) {
    o = o || {};
    var als = ap().airlines || P.AIRLINES, pool = [];   // airline types come from the airport's own airline list
    als.forEach(function (x) { pool = pool.concat(x.types); });
    var type = o.type || (kind === 'CIRCUIT' || kind === 'ARR_VFR' ? 'C172' : pick(pool));
    var si = this.freeStand(type);
    if (si < 0) return null;
    var pf = PERF[type];
    var ac = { id: this.nid++, kind: kind, type: type, perf: pf, cs: o.cs || this.newCs(type), isUser: !!o.user, alive: true,
      u: 0, v: 0, th: 0, spd: 0, alt: 0, clr: {}, rep: {}, told: {}, path: [], legs: [], call: null, stand: si,
      dest: pick(ap().destinations), readyAt: this.time + (o.user ? 0 : rnd(4, 40)), plan: kind === 'CIRCUIT' ? Math.floor(rnd(1, 3)) : 0 };
    ac.wantTG = ac.plan > 0;
    this.stands[si] = ac;
    if (kind === 'DEP' || kind === 'CIRCUIT') {
      ac.phase = 'PARKED'; var sp = this.standPos(si); ac.u = sp.u; ac.v = sp.v; ac.th = sp.th;
    } else if (kind === 'ARR_IFR') {
      var s = this.lpt(-16000, 0); ac.u = s.u; ac.v = s.v; ac.th = this.rwAngle; ac.spd = pf.vCruise; ac.alt = this.agl(2700);
      ac.phase = 'FINAL'; ac.legs = [{ from: s, to: this.lpt(300, 0), ph: 'FINAL' }];
    } else { // ARR_VFR
      var s0 = this.pt(1000, 9000), j = this.pt(2600, pf.cw), p3 = this.lpt(-pf.fl, pf.cw), p4 = this.lpt(-pf.fl, 0);
      ac.u = s0.u; ac.v = s0.v; ac.th = Math.atan2(j.v - s0.v, j.u - s0.u); ac.spd = pf.vCruise; ac.alt = this.agl(1500); ac.phase = 'INBOUND';
      ac.posRep = this.posReport(ac);   // fixed at the start, so the suggested call doesn't change under the user's finger
      ac.legs = [{ from: s0, to: j, ph: 'INBOUND' }, { from: j, to: p3, ph: 'DOWNWIND' }, { from: p3, to: p4, ph: 'BASE' }, { from: p4, to: this.lpt(300, 0), ph: 'FINAL' }];
    }
    this.acs.push(ac);
    if (ac.isUser) this.user = ac;
    this.emit('spawn', ac);
    return ac;
  };
  W.spawnTraffic = function () {
    var tr = this.traffic;
    if (!tr.level || this.time < tr.next) return;
    tr.next = this.time + [0, 170, 110, 75][tr.level] * rnd(0.7, 1.3);
    if (this.acs.length >= 2 + 2 * tr.level) return;
    var circ = this.acs.filter(function (a) { return a.kind === 'CIRCUIT' || a.kind === 'ARR_VFR'; }).length;
    var self = this, onFinal = this.acs.some(function (a) { return a.kind === 'ARR_IFR' && (a.phase === 'AWAY' || (a.phase === 'FINAL' && -self.la(a.u) > 4000)); });
    var r = Math.random(), kind = r < 0.42 ? 'DEP' : r < 0.75 ? 'ARR_IFR' : r < 0.9 ? 'CIRCUIT' : 'ARR_VFR';
    if ((kind === 'CIRCUIT' || kind === 'ARR_VFR') && circ >= (this.mode === 'PILOT' ? 1 : 2)) kind = 'DEP';
    // a slow aircraft on a long base or final would be caught on final by a new jet (spawned about 3.5 min out): wait
    var slowLong = this.acs.some(function (a) {
      if (a.perf.ifr || (a.phase !== 'BASE' && a.phase !== 'FINAL')) return false;
      var d = a.phase === 'BASE' ? Math.abs(a.v) + a.perf.fl : -self.la(a.u);
      return d / a.perf.vApp > 100;
    });
    if (kind === 'ARR_IFR' && (onFinal || slowLong)) kind = 'DEP';
    // departures waiting on the ground (not yet airborne): beyond 3, add no more (a backtrack runway handles few)
    var waiting = this.acs.filter(function (a) { return (a.kind === 'DEP' || a.kind === 'CIRCUIT') && /^(PARKED|STARTED|TAXI_OUT|HOLDING_POINT)$/.test(a.phase); }).length;
    if ((kind === 'DEP' || kind === 'CIRCUIT') && waiting >= (this.rw.backtrack ? 2 : 3)) return;
    // a departure kept waiting at its holding point gets a gap: no new arrivals until it has gone
    var t = this.time, starved = this.acs.some(function (a) { return a.phase === 'HOLDING_POINT' && t - (a.atHoldAt || t) > 90; });
    if (starved && (kind === 'ARR_IFR' || kind === 'ARR_VFR')) return;
    this.spawn(kind);
  };

  /* ---------- routes ---------- */
  /* Stand position and parked heading (nose in, facing away from its lead-in). */
  W.standPos = function (si) {
    var A = ap(), id = A.standIds[si], nd = A.nodes[id], lead = A.adj[id][0], ln = lead ? A.nodes[lead.to] : { u: nd.u, v: nd.v - 1 };
    return { u: nd.u, v: nd.v, th: Math.atan2(nd.v - ln.v, nd.u - ln.u), id: id, name: nd.name };
  };
  W.standName = function (ac) { return String(ap().nodes[ap().standIds[ac.stand]].name); };
  // Airports whose AIP publishes no stand numbers (apronOnly) are spoken as "the apron".
  W.standAt = function (ac) { return ap().apronOnly ? 'on the apron' : 'stand ' + this.standName(ac); };
  W.standTo = function (ac) { return ap().apronOnly ? 'to the apron' : 'stand ' + this.standName(ac); };
  W.holdOf = function (ac) { return ap().holds[ac.holdName || this.rw.hold]; };
  function pts(ids) { return ids.map(function (id) { var nd = ap().nodes[id]; return { u: nd.u, v: nd.v }; }); }
  /* Node routes over the taxiway graph. */
  W.outIds = function (ac) { return TL.Graph.route(ap(), ap().standIds[ac.stand], this.holdOf(ac).id) || []; };
  W.inIds = function (ac) {
    var h = ap().holds[ac.exit], from = (h && h.next) || ac.atNode;
    return (from && TL.Graph.route(ap(), from, ap().standIds[ac.stand])) || [];
  };
  /* Taxiway designators an instruction names: the holding point itself and the taxiway the aircraft is on are left out. */
  W.taxiNames = function (ac, out) {
    var nm = TL.Graph.names(ap(), out ? this.outIds(ac) : this.inIds(ac));
    if (out) { var h = this.holdOf(ac).name; if (nm[nm.length - 1] === h) nm.pop(); }
    else if (nm[0] === ac.exit) nm.shift();
    return nm;
  };
  /* Departures from this runway's holding point backtrack to the threshold (rw.backtrack). */
  W.needsBacktrack = function (ac) { return !!this.rw.backtrack && this.holdOf(ac).name === this.rw.hold; };
  /* Seconds a departure will occupy the runway before it can start its roll. */
  W.lineupTime = function (ac) {
    if (!this.needsBacktrack(ac)) return 0;
    return (this.along(ap().nodes[this.holdOf(ac).rwy].u) + 80) / Math.max(ac.perf.taxi, 13) + 30;
  };
  W.outRoute = function (ac) { ac.hv = Math.abs(this.holdOf(ac).v); return pts(this.outIds(ac).slice(1)); };
  W.inRoute = function (ac) { return pts(this.inIds(ac)); };
  W.startLineup = function (ac) {
    var h = this.holdOf(ac), r = ap().nodes[h.rwy], a = this.along(r.u);
    ac.hv = Math.abs(h.v);
    ac.phase = 'LINEUP';
    if (this.needsBacktrack(ac)) {
      // enter, backtrack to the runway end, turn on the turn pad and line up facing the departure direction
      ac.path = [{ u: r.u, v: 0 }, this.pt(45, 0), this.pt(18, 20), this.pt(4, 0), this.pt(60, 0)];
      ac.backtracking = true;
    } else ac.path = [{ u: r.u, v: 0 }, this.pt(a + 70, 0)];
  };
  W.circuitLegs = function (ac, a0) {
    var pf = ac.perf, A = Math.max(pf.xa, a0 + 800);
    var p0 = { u: ac.u, v: ac.v }, p1 = this.pt(A, 0), p2 = this.pt(A, pf.cw), p3 = this.lpt(-pf.fl, pf.cw), p4 = this.lpt(-pf.fl, 0);
    return [{ from: p0, to: p1, ph: 'CLIMB' }, { from: p1, to: p2, ph: 'CROSSWIND' }, { from: p2, to: p3, ph: 'DOWNWIND' },
      { from: p3, to: p4, ph: 'BASE' }, { from: p4, to: this.lpt(300, 0), ph: 'FINAL' }];
  };

  /* ---------- runway state ---------- */
  W.onSurface = function (ac) {
    if (!SURFACE[ac.phase]) return false;
    return (ac.phase !== 'LINEUP' && ac.phase !== 'VACATING') || Math.abs(ac.v) < (ac.hv || 90) - 3;
  };
  /* An aircraft that makes the runway unavailable to `ex`: on the surface, or just airborne and not yet past the far end. */
  W.rwyBlocker = function (ex) {
    for (var i = 0; i < this.acs.length; i++) {
      var o = this.acs[i];
      if (o === ex || !o.alive) continue;
      if (this.onSurface(o) || o.justDep) return o;
    }
    return null;
  };
  W.surfaceBlocker = function (ex) {
    for (var i = 0; i < this.acs.length; i++) { var o = this.acs[i]; if (o !== ex && o.alive && this.onSurface(o)) return o; }
    return null;
  };
  /* Seconds until the next arriving aircraft (other than ex) reaches the threshold. */
  W.nextArrival = function (ex) {
    var best = Infinity, who = null, self = this;
    this.acs.forEach(function (o) {
      if (o === ex || !o.alive) return;
      var d;
      if (o.phase === 'FINAL') d = -self.la(o.u);
      else if (o.phase === 'BASE') d = Math.abs(o.v) + o.perf.fl;
      else if (o.phase === 'DOWNWIND' && !o.extend && !o.orbit) d = Math.max(0, self.la(o.u) + o.perf.fl) + o.perf.cw + o.perf.fl;   // matters for long runway occupancy (backtracking)
      else return;
      var t = self.eta(o, d);
      if (t < best) { best = t; who = o; }
    });
    return { t: best, ac: who };
  };

  W.eta = function (o, d) { d = Math.max(0, d); return d > 9000 ? (d - 9000) / o.perf.vCruise + 9000 / o.perf.vApp : d / o.perf.vApp; };

  /* ---------- per-aircraft movement ---------- */
  /* 0 = clear, 1 = blocked by traffic ahead, 2 = blocked only by oncoming traffic (head-on on a single taxiway).
     After 25 s nose to nose, oncoming traffic is ignored so the two can pass instead of locking up for good. */
  function aheadBlocked(w, ac, passOncoming) {
    var tgt = ac.path[0]; if (!tgt) return 0;
    var dir = Math.atan2(tgt.v - ac.v, tgt.u - ac.u), res = 0;
    for (var i = 0; i < w.acs.length; i++) {
      var o = w.acs[i];
      if (o === ac || o.alt > 0 || o.phase === 'PARKED' || o.phase === 'STARTED' || o.phase === 'AT_STAND') continue;
      // an aircraft leaving the runway is never stopped by one waiting at a holding point (it would block the runway)
      if (ac.phase === 'VACATING' && (o.phase === 'HOLDING_POINT' || o.phase === 'TAXI_OUT')) continue;
      var du = o.u - ac.u, dv = o.v - ac.v, d = Math.hypot(du, dv);
      if (d > 75 || d < 0.01) continue;
      if (Math.abs(wrap(Math.atan2(dv, du) - dir)) > 55 * RAD) continue;
      var oh = o.path && o.path[0] ? Math.atan2(o.path[0].v - o.v, o.path[0].u - o.u) : o.th, oncoming = Math.abs(wrap(oh - dir)) > 120 * RAD;
      if (o.path && o.path[0] && !o.holdPos) {
        var od = Math.atan2(o.path[0].v - o.v, o.path[0].u - o.u);
        if (Math.abs(wrap(Math.atan2(-dv, -du) - od)) <= 55 * RAD && ac.id < o.id) continue;
      }
      if (oncoming && passOncoming) continue;
      res = oncoming ? Math.max(res, 2) : 1;
      if (res === 1) return 1;
    }
    return res;
  }
  function taxi(w, ac, dt, vmax) {
    var tgt = ac.path[0];
    if (!tgt) return true;
    var b = ac.holdPos ? 1 : aheadBlocked(w, ac, (ac.hoT || 0) > 25);
    if (b === 2) ac.hoT = (ac.hoT || 0) + dt; else if (!b) ac.hoT = 0;
    var blocked = !!b;
    var dist = Math.hypot(tgt.u - ac.u, tgt.v - ac.v);
    var want = blocked ? 0 : vmax;
    if (ac.path.length === 1) want = Math.min(want, Math.max(2, Math.sqrt(2.4 * dist)));
    ac.spd += Math.max(-3 * dt, Math.min(1.2 * dt, want - ac.spd));
    if (ac.spd < 0) ac.spd = 0;
    var st = ac.spd * dt;
    if (dist <= st + 0.5) {
      ac.u = tgt.u; ac.v = tgt.v; ac.path.shift();
      if (!ac.path.length) { ac.spd = 0; return true; }
    } else if (st > 0) {
      ac.th = Math.atan2(tgt.v - ac.v, tgt.u - ac.u);
      ac.u += Math.cos(ac.th) * st; ac.v += Math.sin(ac.th) * st;
    }
    return false;
  }
  /* First exit the aircraft can make at a normal deceleration. If it can't make any, it takes the exit nearest
     to where it stops and backtracks to it (ac.btExit). */
  function chooseExit(w, ac) {
    var a = w.along(ac.u), stop = Math.max(0, (ac.spd * ac.spd - 225) / (2 * ac.perf.brk)), need = stop + 80, ex = w.rw.exits;
    // don't vacate into a taxiway where a departure is holding or taxiing towards that holding point
    var busy = function (x) {
      var h = ap().nodes[ap().holds[x].id];
      return w.acs.some(function (o) {
        if (o === ac || o.alt !== 0 || TL.SURFACE[o.phase]) return false;
        if ((o.phase === 'TAXI_OUT' || o.phase === 'HOLDING_POINT') && w.holdOf(o).name === x) return true;   // departure queue for that holding point
        return Math.hypot(o.u - h.u, o.v - h.v) < 250;
      });
    };
    var free = ex.filter(function (x) { return !busy(x); });
    if (free.length) ex = free;
    var ok = ex.filter(function (x) { return w.along(w.exitU(x)) - a >= need; });
    ac.btExit = false;
    if (ac.exitPref && ok.indexOf(ac.exitPref) >= 0) return ac.exitPref;
    if (ok.length) return ok[0];
    var end = a + stop, best = ex[0];
    ex.forEach(function (x) { if (Math.abs(w.along(w.exitU(x)) - end) < Math.abs(w.along(w.exitU(best)) - end)) best = x; });
    if (w.along(w.exitU(best)) - a < need) ac.btExit = true;
    return best;
  }
  W.chooseExit = function (ac) { return chooseExit(this, ac); };
  W.exitU = function (x) { var A = ap(); return A.nodes[A.holds[x].rwy].u; };

  W.goAround = function (ac, why) {
    if (ac.perf.ifr) { ac.legs = [{ from: { u: ac.u, v: ac.v }, to: this.pt(90000, 0), ph: 'CLIMB' }]; ac.missed = true; ac.handed = false; ac.handIssued = false; }
    else ac.legs = this.circuitLegs(ac, this.along(ac.u));
    ac.phase = 'CLIMB'; ac.justDep = true; ac.clr.land = null; ac.rep = {}; ac.told = {}; ac.atcWait = null; ac.extend = false; ac.orbit = null;
    ac.ga = (ac.ga || 0) + 1; ac.gaSay = why !== 'ATC';
    this.emit('goaround', ac, why);
    var who = ac.cs.full;
    if (this.mode === 'ATC') {
      if (why === 'NOCLR') this.note('bad', who + ' went around: no landing clearance', -8);
      if (why === 'BLOCKED') this.note('bad', who + ' went around: runway occupied', -12);
    } else if (ac.isUser) {
      if (why === 'NOCLR') this.note('bad', 'No landing clearance by short final, so the aircraft went around. Report final earlier.', -5);
      if (why === 'TRAFFIC') this.note('info', 'The runway was still occupied, so you went around. Say "going around" and rejoin the circuit.', 0);
      if (why === 'BLOCKED') this.note('info', 'Runway occupied: going around.', 0);
    }
  };
  W.turnBase = function (ac) {
    var leg = ac.legs[0];
    if (!leg || leg.ph !== 'DOWNWIND') return false;
    ac.extend = false;
    var nu = ac.u - this.rw.dir * (ac.spd / (ac.perf.turn * RAD)) * 0.6;
    if (this.la(nu) < -ac.perf.fl * 0.6) { leg.to.u = nu; ac.legs[1].to.u = nu; }
    return true;
  };

  function fly(w, ac, dt) {
    var pf = ac.perf, leg = ac.legs[0];
    if (!leg) return;
    var dx = leg.to.u - leg.from.u, dv = leg.to.v - leg.from.v, L = Math.hypot(dx, dv) || 1, ex = dx / L, ev = dv / L;
    var along = (ac.u - leg.from.u) * ex + (ac.v - leg.from.v) * ev, rem = L - along;
    var rate = pf.turn * RAD, r = ac.spd / rate;

    if (leg.ph === 'INBOUND' && !ac.joinClr && rem < 3000 && !ac.orbit) ac.orbit = { rem: Infinity, dir: 1 };
    if (ac.orbit) {
      var dth = rate * dt * ac.orbit.dir; ac.th = wrap(ac.th + dth); ac.orbit.rem -= Math.abs(dth) / RAD;
      if (ac.orbit.rem <= 0) ac.orbit = null;
    } else {
      var look = Math.max(300, r * 1.2);
      var want = Math.atan2(leg.from.v + ev * (along + look) - ac.v, leg.from.u + ex * (along + look) - ac.u);
      var d = wrap(want - ac.th);
      ac.th = wrap(ac.th + Math.max(-rate * dt, Math.min(rate * dt, d)));
      var lead = 0, nx = ac.legs[1];
      if (nx) {
        var turnAng = Math.abs(wrap(Math.atan2(nx.to.v - nx.from.v, nx.to.u - nx.from.u) - Math.atan2(ev, ex)));
        lead = Math.min(r * 1.5, r * Math.tan(turnAng / 2));
      }
      if (leg.ph === 'DOWNWIND' && ac.extend && rem < lead + 150) {
        var sh = ac.spd * dt;
        leg.to.u += ex * sh; nx.to.u += ex * sh; rem += sh;
        if (w.la(nx.to.u) < -16000) { ac.extend = false; ac.extMax = true; }
      }
      if (rem <= lead) {
        if (nx) { ac.legs.shift(); ac.phase = nx.ph; if (nx.ph === 'DOWNWIND') { ac.rep = {}; ac.told = {}; ac.clr.land = null; ac.gaSay = false; } if (nx.ph !== 'CLIMB') ac.justDep = false; }
        else if (leg.ph === 'FINAL') { touchdown(w, ac); return; }
      }
    }
    // speed
    var ph = ac.phase, vt = ph === 'CLIMB' ? pf.vClimb : ph === 'BASE' ? (pf.vCruise + pf.vApp) / 2 : ph === 'FINAL' ? (rem > 9000 ? pf.vCruise : pf.vApp) : pf.vCruise;
    ac.spd += Math.max(-1.2 * dt, Math.min(1.2 * dt, vt - ac.spd));
    // altitude (ft above the field)
    var tgt = ac.alt, up = pf.climb / 60 * dt, dn = pf.desc / 60 * dt;
    if (ph === 'FINAL') { var g = Math.max(0, rem) * 0.172; if (ac.alt > g) tgt = g; dn *= 1.8; }
    else if (ph === 'BASE') { var g2 = (Math.max(0, rem) + pf.fl + 300) * 0.172; tgt = Math.min(w.agl(pf.circ), g2); if (tgt > ac.alt) tgt = ac.alt; }
    else tgt = w.agl(ac.kind === 'DEP' ? 7000 : ac.missed ? 3000 : pf.circ);
    ac.alt += Math.max(-dn, Math.min(up, tgt - ac.alt));
    ac.u += Math.cos(ac.th) * ac.spd * dt; ac.v += Math.sin(ac.th) * ac.spd * dt;
    if (ac.justDep && (w.along(ac.u) > ap().length || ac.alt > 300)) ac.justDep = false;
    // go-around gates
    if (ph === 'FINAL') {
      var dthr = -w.la(ac.u);
      if (dthr > 0 && !ac.clr.land && dthr < (pf.ifr ? 900 : 450)) w.goAround(ac, ac.atcWait === 'LAND' && w.mode !== 'ATC' ? 'TRAFFIC' : 'NOCLR');   // the automatic tower was holding the clearance for traffic: not the pilot's fault
      // runway occupied: go around, also over the threshold until touchdown (another aircraft can touch down just ahead)
      else if (ac.clr.land && dthr < 350) { var sb = w.surfaceBlocker(ac); if (sb && (dthr > 0 || Math.abs(sb.u - ac.u) < 1200)) w.goAround(ac, 'BLOCKED'); }
    }
  }
  function touchdown(w, ac) {
    if (!ac.clr.land) { w.goAround(ac, 'NOCLR'); return; }
    ac.alt = 0; ac.v = 0; ac.th = w.rwAngle; ac.legs = []; ac.tdAt = w.time; ac.exit = null; ac.justDep = false;
    ac.phase = ac.clr.land === 'TG' ? 'TG_ROLL' : 'LANDING_ROLL';
    w.emit('landed', ac);
  }

  function stepAc(w, ac, dt) {
    var pf = ac.perf, ph = ac.phase;
    if (AIR[ph]) { fly(w, ac, dt); return; }
    switch (ph) {
      case 'TAXI_OUT':
        if (taxi(w, ac, dt, pf.taxi)) { if (ac.clr.lineup) w.startLineup(ac); else { ac.phase = 'HOLDING_POINT'; ac.atHoldAt = w.time; } }
        break;
      case 'LINEUP':
        if (taxi(w, ac, dt, ac.backtracking ? Math.max(pf.taxi, 13) : pf.taxi)) { ac.phase = 'LINED_UP'; ac.th = w.rwAngle; ac.linedAt = w.time; ac.backtracking = false; }
        break;
      case 'LINED_UP':
        if (ac.clr.takeoff && w.time - ac.linedAt > 2) {
          var b = w.surfaceBlocker(ac);
          if (!b || w.along(b.u) < w.along(ac.u)) { ac.phase = 'TKOF_ROLL'; w.emit('rolling', ac); }
        }
        break;
      case 'TKOF_ROLL':
        ac.th = w.rwAngle; ac.v = 0; ac.spd += pf.acc * dt; ac.u += w.rw.dir * ac.spd * dt;
        if (ac.spd >= pf.vr) {
          ac.phase = 'CLIMB'; ac.justDep = true; ac.clr = {}; ac.rep = {}; ac.told = {};
          if (ac.kind !== 'DEP') ac.legs = w.circuitLegs(ac, w.along(ac.u));
          else if (pf.ifr) ac.legs = [{ from: { u: ac.u, v: 0 }, to: w.pt(90000, 0), ph: 'CLIMB' }];
          else { var a1 = w.along(ac.u) + 1500, q = w.pt(a1, 0); ac.legs = [{ from: { u: ac.u, v: 0 }, to: q, ph: 'CLIMB' }, { from: q, to: w.pt(a1 + 40000, 40000), ph: 'CLIMB' }]; }
          w.emit('airborne', ac);
        }
        break;
      case 'TG_ROLL':
        ac.u += w.rw.dir * ac.spd * dt;
        if (w.time - ac.tdAt < 3) ac.spd = Math.max(pf.vr * 0.8, ac.spd - 1.5 * dt);
        else { ac.phase = 'TKOF_ROLL'; ac.plan = Math.max(0, ac.plan - 1); ac.wantTG = ac.plan > 0; ac.tgs = (ac.tgs || 0) + 1; if (w.mode === 'ATC') { w.score.pts += 3; } w.emit('tg', ac); }
        break;
      case 'LANDING_ROLL':
        if (!ac.exit) ac.exit = chooseExit(w, ac);
        var dist = w.along(w.exitU(ac.exit)) - w.along(ac.u);
        if (ac.btExit) {
          // slow to taxi speed, turn around on the runway and backtrack to the exit
          if (!ac.btRev) { ac.spd = Math.max(0, ac.spd - pf.brk * dt); if (ac.spd <= 6) { ac.btRev = true; ac.th = w.rwAngle + Math.PI; } else { ac.u += w.rw.dir * ac.spd * dt; break; } }
          ac.spd = Math.min(pf.taxi, ac.spd + dt);
          if (-dist <= ac.spd * dt + 1) { dist = 0; } else { ac.u -= w.rw.dir * ac.spd * dt; break; }
        }
        var want = ac.spd > 15 ? 0 : (dist < (ac.spd * ac.spd - 64) / (2 * pf.brk) + 12 ? 8 : 15);
        if (!ac.btExit) { if (ac.spd > want) ac.spd = Math.max(want, ac.spd - pf.brk * dt); else ac.spd = Math.min(want, ac.spd + dt); }
        if (dist <= ac.spd * dt + 1) {
          ac.u = w.exitU(ac.exit); ac.spd = Math.min(ac.spd, pf.taxi); ac.phase = 'VACATING'; ac.clr = {}; ac.btExit = false; ac.btRev = false;
          var hx = ap().holds[ac.exit], hn = ap().nodes[hx.id], nx = hx.next ? ap().nodes[hx.next] : null;
          ac.hv = Math.abs(hn.v);
          // stop about 95 m past the holding point (or at the next junction if that is closer), then report vacated
          var cp = { u: hn.u, v: hn.v };
          if (nx) { var dd = Math.hypot(nx.u - hn.u, nx.v - hn.v), f = Math.min(1, 95 / (dd || 1)); cp = { u: hn.u + (nx.u - hn.u) * f, v: hn.v + (nx.v - hn.v) * f }; }
          ac.path = [{ u: hn.u, v: hn.v }, cp];
        } else ac.u += w.rw.dir * ac.spd * dt;
        break;
      case 'VACATING':
        if (taxi(w, ac, dt, pf.taxi)) { ac.phase = 'VACATED'; ac.vacAt = w.time; if (ac.taxiClr) { ac.path = w.inRoute(ac); ac.phase = 'TAXI_IN'; } }
        break;
      case 'TAXI_IN':
        if (taxi(w, ac, dt, pf.taxi)) { ac.phase = 'AT_STAND'; ac.th = w.standPos(ac.stand).th; ac.doneAt = w.time; w.emit('parked', ac); }
        break;
    }
  }

  W.remove = function (ac) {
    ac.alive = false;
    if (this.stands[ac.stand] === ac) this.stands[ac.stand] = null;
    this.acs.splice(this.acs.indexOf(ac), 1);
  };

  function checks(w) {
    var acs = w.acs.slice();
    acs.forEach(function (ac) {
      if (ac.phase === 'AT_STAND') {
        if (ac.isUser) { w.finish('Parked ' + (ap().apronOnly ? 'on the apron' : 'at stand ' + w.standName(ac))); return; }
        if (w.time - ac.doneAt > 20) { w.score.moves++; if (w.mode === 'ATC') w.score.pts += 10; w.remove(ac); }
      } else if (ac.kind === 'DEP' && ac.phase === 'CLIMB' && Math.hypot(ac.u - 1600, ac.v) > (ac.handed ? 9000 : 15000)) {
        if (ac.handed) { w.score.moves++; if (w.mode === 'ATC') w.score.pts += 10; }
        else if (w.mode === 'ATC') w.note('bad', ac.cs.full + ' left your airspace without a handoff to Approach', -5);
        if (ac.isUser) { w.finish('Departed the control zone'); return; }
        w.remove(ac);
      }
      if (ac.missed && ac.phase === 'CLIMB' && w.along(ac.u) > 9000) { ac.phase = 'AWAY'; ac.backAt = w.time + 150; ac.call = null; ac.atcWait = null; }
      else if (ac.phase === 'AWAY' && w.time >= ac.backAt && !w.acs.some(function (o) { return o.phase === 'FINAL' && -w.la(o.u) > 6000; })) {
        var s = w.lpt(-16000, 0); ac.u = s.u; ac.v = s.v; ac.th = w.rwAngle; ac.spd = ac.perf.vCruise; ac.alt = w.agl(2700); ac.missed = false; ac.handed = false;
        ac.phase = 'FINAL'; ac.legs = [{ from: s, to: w.lpt(300, 0), ph: 'FINAL' }]; ac.rep = {}; ac.clr = {}; ac.told = {}; ac.metTWR = 0;
      }
      if (w.mode === 'ATC' && ac.call && !ac.call.queued && !ac.call.pen && w.time - ac.call.t > 75) {
        ac.call.pen = true; w.note('bad', ac.cs.full + ' has been waiting over a minute for a reply', -3);
      }
    });
    for (var i = 0; i < w.acs.length; i++) for (var j = i + 1; j < w.acs.length; j++) {
      var a = w.acs[i], b = w.acs[j], key = a.id + '-' + b.id;
      if (a.phase === 'AWAY' || b.phase === 'AWAY') continue;
      if (w.pairs[key] && w.time - w.pairs[key] < 90) continue;
      var d = Math.hypot(a.u - b.u, a.v - b.v);
      if (w.onSurface(a) && w.onSurface(b) && (a.spd > 20 || b.spd > 20) && d < 1500) {
        var fast = a.spd > b.spd ? a : b, slow = fast === a ? b : a;
        if ((w.along(slow.u) - w.along(fast.u)) > 0) { w.pairs[key] = w.time; w.note('bad', 'Runway incursion: ' + a.cs.full + ' and ' + b.cs.full + ' on the runway together', w.mode === 'ATC' ? -25 : 0); }
      } else if (a.alt > 100 && b.alt > 100 && !a.perf.ifr && !b.perf.ifr) {
        // VFR circuit traffic keeps its own visual separation: only flag it when the two are really close
        if (d < 150 && Math.abs(a.alt - b.alt) < 200) { w.pairs[key] = w.time; w.note('bad', 'Too close: ' + a.cs.full + ' and ' + b.cs.full, w.mode === 'ATC' ? -5 : 0); }
      } else if (a.alt > 100 && b.alt > 100 && d < 450 && Math.abs(a.alt - b.alt) < 300) {
        w.pairs[key] = w.time; w.note('bad', 'Loss of separation: ' + a.cs.full + ' and ' + b.cs.full, w.mode === 'ATC' ? -15 : 0);
      }
    }
  }

  W.step = function (dt) {
    if (this.over) return;
    this.time += dt;
    var self = this;
    this.acs.forEach(function (ac) { stepAc(self, ac, dt); });
    this.radio.step();
    if (this.atc) this.atc.step();
    this.acs.slice().forEach(function (ac) { TL.Pilot.think(self, ac); });
    this.spawnTraffic();
    if (this.time - this.lastCheck >= 1) { this.lastCheck = this.time; checks(this); }
  };

  TL.World = World; TL.PERF = PERF; TL.AIR = AIR; TL.SURFACE = SURFACE;
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
