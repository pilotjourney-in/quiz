/* Instruction wording, how an aircraft complies with an instruction, and what AI pilots say on their own. */
(function (TL) {
  'use strict';
  var P = TL.Phrase;
  function ap() { return TL.AIRPORT; }
  var GROUND_OUT = { TAXI_OUT: 1, HOLDING_POINT: 1, LINEUP: 1, LINED_UP: 1 };

  function unitShort(u) { return u === 'GND' ? 'Ground' : u === 'TWR' ? 'Tower' : 'Approach'; }

  /* Orbits default to turning away from the runway. */
  function orbitDir(w, c) { return c.dir || (w.rw.circuit === 'left' ? 'right' : 'left'); }

  /* "F and P", "N3, P and J": designators as written; spoken() turns them into Foxtrot, November three... */
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function via(names) { return names.length ? ', via ' + list(names) : ''; }

  /* What the controller says for a command. */
  function text(w, ac, c) {
    var r = 'runway ' + w.rw.id;
    switch (c.t) {
      case 'STARTUP': return 'start-up approved, QNH ' + w.qnh;
      case 'TAXI': return 'taxi holding point ' + w.holdOf(ac).name + ', ' + r + via(w.taxiNames(ac, true));
      case 'TAXI_STAND': return 'taxi stand ' + w.standName(ac) + via(ac.exit ? w.taxiNames(ac, false) : []);
      case 'HOLD_POSITION': return 'hold position';
      case 'RESUME': return 'continue taxi';
      case 'HOLD_SHORT': return 'hold short of ' + r + (c.why ? ', ' + c.why : '');
      case 'LINE_UP': return w.needsBacktrack(ac) ? 'backtrack ' + r + ', line up and wait' : 'line up and wait ' + r;
      case 'CLEARED_TAKEOFF': return w.windText() + ', ' + r + ', cleared for take-off';
      case 'CLEARED_LAND': return w.windText() + ', ' + r + ', cleared to land';
      case 'CLEARED_TG': return w.windText() + ', ' + r + ', cleared touch and go';
      case 'GO_AROUND': return 'go around';
      case 'CONTINUE': return 'continue approach' + (c.why ? ', ' + c.why : '');
      case 'REPORT': return 'report ' + c.point;
      case 'NUMBER': return 'number ' + c.n + (c.follow ? ', follow ' + c.follow : '');
      case 'EXTEND': return 'extend downwind, I will call your base';
      case 'TURN_BASE': return 'turn base';
      case 'ORBIT': return 'orbit ' + orbitDir(w, c);
      case 'JOIN': return 'join ' + w.rw.circuit + '-hand downwind ' + r + ', QNH ' + w.qnh;
      case 'VACATE': return 'vacate via ' + c.exit;
      case 'CONTACT': return 'contact ' + ap().units[c.unit] + ' ' + ap().freqs[c.unit];
      case 'STANDBY': return 'standby';
      case 'ROGER': return 'roger';
      case 'RADIO': return 'readability five';
      case 'QNH': return 'QNH ' + w.qnh;
    }
    return '';
  }
  /* What the pilot reads back. */
  function rb(w, ac, c) {
    var r = 'runway ' + w.rw.id;
    switch (c.t) {
      case 'HOLD_POSITION': return 'holding position';
      case 'HOLD_SHORT': return 'holding short of ' + r;
      case 'CLEARED_TAKEOFF': return r + ', cleared for take-off';
      case 'CLEARED_LAND': return r + ', cleared to land';
      case 'CLEARED_TG': return r + ', cleared touch and go';
      case 'GO_AROUND': return 'going around';
      case 'CONTINUE': return 'continue approach';
      case 'REPORT': return 'wilco';
      case 'NUMBER': return 'number ' + c.n;
      case 'EXTEND': return 'extending downwind';
      case 'TURN_BASE': return 'turning base';
      case 'ORBIT': return 'orbiting ' + orbitDir(w, c);
      case 'CONTACT': return unitShort(c.unit) + ' ' + ap().freqs[c.unit];
      case 'ROGER': case 'RADIO': case 'STANDBY': return '';
      default: return text(w, ac, c);
    }
  }

  /* Make the aircraft comply. Returns { ok, rb } where rb is the readback or the reason it is unable. */
  function key(c) { return c.t === 'REPORT' ? 'REPORT:' + c.point : c.t; }
  var NO_MEMO = { HOLD_POSITION: 1, RESUME: 1, ORBIT: 1, GO_AROUND: 1, NUMBER: 1, ROGER: 1, RADIO: 1, QNH: 1, SAY_AGAIN: 1 };
  /* apply() plus a note of what this aircraft has now been told, so the same instruction is not offered again. */
  function apply(w, ac, c) {
    var r = comply(w, ac, c);
    if (r.ok && !NO_MEMO[c.t]) { ac.told = ac.told || {}; ac.told[key(c)] = true; }
    return r;
  }
  function comply(w, ac, c) {
    var ph = ac.phase, air = !!TL.AIR[ph], ok = function () { return { ok: true, rb: rb(w, ac, c) }; }, no = function (why) { return { ok: false, rb: why }; };
    switch (c.t) {
      case 'STARTUP':
        if (ph === 'PARKED') { ac.phase = 'STARTED'; ac.startedAt = w.time; return ok(); }
        return no('engines already running');
      case 'TAXI':
        if (ph === 'PARKED' || ph === 'STARTED') { ac.path = w.outRoute(ac); ac.phase = 'TAXI_OUT'; ac.holdPos = false; return ok(); }
        if (ph === 'TAXI_OUT') { ac.holdPos = false; return ok(); }
        if (ph === 'VACATED' || ph === 'TAXI_IN' || ph === 'VACATING' || ph === 'LANDING_ROLL') return apply(w, ac, { t: 'TAXI_STAND' });
        return no(air ? 'we are airborne' : 'already at the holding point');
      case 'TAXI_STAND':
        if (ph === 'VACATED') { ac.path = w.inRoute(ac); ac.phase = 'TAXI_IN'; ac.holdPos = false; return ok(); }
        if (ph === 'TAXI_IN') { ac.holdPos = false; return ok(); }
        if (ph === 'VACATING' || ph === 'LANDING_ROLL') { ac.taxiClr = true; return ok(); }
        return no('say again');
      case 'HOLD_POSITION':
        if (ph === 'TKOF_ROLL' || ph === 'TG_ROLL') return no('already rolling');
        if (air) return no('we are airborne');
        ac.holdPos = true; if (ph === 'LINED_UP' || ph === 'HOLDING_POINT' || ph === 'TAXI_OUT') ac.clr.takeoff = false;
        return ok();
      case 'RESUME': ac.holdPos = false; return ok();
      case 'HOLD_SHORT':
        if (ph === 'TAXI_OUT' || ph === 'HOLDING_POINT') { ac.clr.lineup = false; ac.clr.takeoff = false; }
        ac.toldHold = w.time; return ok();
      case 'LINE_UP':
        if (ph !== 'TAXI_OUT' && ph !== 'HOLDING_POINT') return no(GROUND_OUT[ph] ? 'already on the runway' : 'not at the holding point');
        if (!ac.isUser && w.nextArrival(ac).t < 35) { if (w.mode === 'ATC') w.note('bad', 'Line-up instruction refused: traffic on short final', -8); return no('traffic on short final'); }
        ac.clr.lineup = true; ac.holdPos = false; if (ph === 'HOLDING_POINT') w.startLineup(ac);
        return ok();
      case 'CLEARED_TAKEOFF':
        if (!GROUND_OUT[ph]) return no(air ? 'we are airborne' : 'not ready for departure');
        var b = w.surfaceBlocker(ac);
        if (b && !ac.isUser && b.phase !== 'TKOF_ROLL' && b.phase !== 'TG_ROLL') { if (w.mode === 'ATC') w.note('bad', 'Take-off clearance refused: runway occupied by ' + b.cs.full, -15); return no('traffic on the runway'); }
        ac.clr.lineup = true; ac.clr.takeoff = true; ac.holdPos = false; if (ph === 'HOLDING_POINT') w.startLineup(ac);
        return ok();
      case 'CLEARED_LAND': case 'CLEARED_TG':
        if (ph !== 'DOWNWIND' && ph !== 'BASE' && ph !== 'FINAL') return no(air ? 'not yet in the circuit' : 'we are on the ground');
        if (c.t === 'CLEARED_TG' && ac.perf.ifr) return no('touch and go, request full stop landing');
        ac.clr.land = c.t === 'CLEARED_TG' ? 'TG' : 'LAND'; ac.atcWait = null; return ok();
      case 'GO_AROUND':
        if (ph !== 'BASE' && ph !== 'FINAL') return no('say again');
        w.goAround(ac, 'ATC'); return ok();
      case 'EXTEND':
        if (ph !== 'DOWNWIND' && ph !== 'CROSSWIND' && !(ph === 'CLIMB' && ac.kind !== 'DEP')) return no('not on downwind');
        ac.extend = true; return ok();
      case 'TURN_BASE':
        if (ph !== 'DOWNWIND') return no('not on downwind');
        w.turnBase(ac); return ok();
      case 'ORBIT':
        if (ph !== 'DOWNWIND' && ph !== 'INBOUND' && ph !== 'CROSSWIND') return no('unable to orbit here');
        ac.orbit = { rem: 360, dir: orbitDir(w, c) === 'right' ? -1 : 1 }; return ok();
      case 'JOIN':
        if (ph !== 'INBOUND') return no('say again');
        ac.joinClr = true; ac.orbit = null; return ok();
      case 'VACATE':
        ac.exitPref = c.exit;
        if (ph === 'LANDING_ROLL') { ac.exit = null; ac.exit = w.chooseExit(ac); if (ac.exit !== c.exit) return no('vacate ' + c.exit + ', will vacate via ' + ac.exit); }
        return ok();
      case 'CONTACT':
        if (c.unit === 'APP') { if ((ac.kind !== 'DEP' && !ac.missed) || !air) return no('say again'); ac.handed = true; }
        return ok();
      default: return ok();
    }
  }

  /* Apply a set of commands to an AI aircraft and transmit its reply. */
  function respond(w, ac, cmds, ch) {
    var parts = [], sayAgain = false, standbyOnly = cmds.every(function (c) { return c.t === 'STANDBY'; });
    cmds.forEach(function (c) {
      if (c.t === 'SAY_AGAIN') { sayAgain = true; return; }
      var r = apply(w, ac, c);
      if (!r.rb) return;
      parts.push(r.ok ? r.rb : 'unable, ' + r.rb);
    });
    if (standbyOnly) { if (ac.call) ac.call.t = w.time; return; }
    if (sayAgain && ac.lastCall) { w.radio.tx({ ch: ch, from: ac, pri: true, text: ac.lastCall }); if (ac.call) ac.call.t = w.time; return; }
    ac.call = null;
    if (!parts.length) return;
    w.radio.tx({ ch: ch, from: ac, pri: true, text: parts.join(', ') + ', ' + ac.cs.abbr, valid: function () { return ac.alive; } });
  }

  /* AI pilots: decide whether to call ATC this tick. */
  function think(w, ac) {
    if (ac.isUser || !ac.alive) return;
    var c = ac.call, t = w.time, ph = ac.phase;
    if (c && c.queued) return;
    var waiting = c && (t - c.t < 55);
    var rw = 'runway ' + w.rw.id;
    function go(intent, unit, body, data) {
      var ch = w.chan(unit), key = 'met' + ch, first = !ac[key]; ac[key] = 1;
      var txt = (first ? w.station(unit) + ', ' + ac.cs.full : ac.cs.abbr) + ', ' + body;
      var call = { intent: intent, t: t, queued: true, text: txt, data: data || {}, ch: ch };
      if (ac.told) delete ac.told.STANDBY;
      ac.call = call; ac.lastCall = txt;
      w.radio.tx({ ch: ch, from: ac, text: txt,
        valid: function () { return ac.alive && ac.call === call && (ac.phase === ph || intent === 'GOING_AROUND'); },
        onSkip: function () { call.queued = false; if (ac.call === call) ac.call = null; },
        onEnd: function () { call.queued = false; call.t = w.time; w.emit('call', ac); if (w.atc) w.atc.receive(ac, intent, call.data, ch); } });
    }
    if (ac.gaSay) { ac.gaSay = false; go('GOING_AROUND', 'TWR', 'going around'); return; }
    switch (ph) {
      case 'PARKED':
        if (t >= ac.readyAt && !waiting) go('REQ_STARTUP', 'GND', 'stand ' + w.standName(ac) + ', information ' + w.info + ', request start-up' +
          (ac.kind === 'CIRCUIT' ? ' for circuits' : ', ' + (ac.perf.ifr ? 'IFR' : 'VFR') + ' to ' + ac.dest));
        break;
      case 'STARTED':
        if (t - ac.startedAt > 12 && !waiting) go('REQ_TAXI', 'GND', 'request taxi');
        break;
      case 'HOLDING_POINT':
        if (!ac.clr.lineup && !waiting && !(ac.toldHold && t - ac.toldHold < 90)) go('READY', 'TWR', 'holding point ' + w.holdOf(ac).name + ', ready for departure');
        break;
      case 'CLIMB':
        if ((ac.kind === 'DEP' ? ac.alt > 3500 : ac.missed && ac.alt > 2500) && !ac.handed && !ac.rep.fc && !waiting) { ac.rep.fc = 1; go('REQ_HANDOFF', 'TWR', 'passing ' + w.amsl(ac) + ' feet, request frequency change'); }
        break;
      case 'INBOUND':
        if (!ac.joinClr && !waiting) go('INBOUND', 'TWR', ac.perf.name + ', ' + ac.posRep + ', inbound for landing, information ' + w.info, {});
        break;
      case 'DOWNWIND':
        if (!ac.rep.dw && (ac.extend || ac.orbit || ac.told.EXTEND || ac.told.TURN_BASE)) ac.rep.dw = 1;   // already being sequenced: no downwind call
        if (!ac.rep.dw && w.along(ac.u) < 2000) { ac.rep.dw = 1; go('REPORT', 'TWR', 'downwind ' + rw + ', ' + (ac.wantTG ? 'touch and go' : 'full stop'), { point: 'downwind', want: ac.wantTG ? 'TG' : 'LAND' }); }
        else if (ac.extMax) { ac.extMax = false; w.turnBase(ac); go('REPORT', 'TWR', 'turning base ' + rw, { point: 'base' }); }
        break;
      case 'FINAL':
        var d = -w.la(ac.u), jet = ac.perf.ifr, mi = Math.max(1, Math.round(d / 1852));
        if (ac.kind === 'ARR_IFR' && !ac.rep.init) { ac.rep.init = 1; go('INBOUND', 'TWR', 'established ILS ' + rw + ', ' + mi + ' miles', { ifr: true }); }
        else if (!ac.rep.fin && !ac.clr.land && d < (jet ? 7600 : 1e9)) { ac.rep.fin = 1; go('REPORT', 'TWR', (jet ? mi + ' miles ' : '') + 'final ' + rw, { point: 'final', want: ac.wantTG ? 'TG' : 'LAND' }); }
        else if (!ac.rep.sf && !ac.clr.land && d < (jet ? 3200 : 1300)) { ac.rep.sf = 1; go('REPORT', 'TWR', 'short final ' + rw, { point: 'final', want: ac.wantTG ? 'TG' : 'LAND' }); }
        break;
      case 'VACATED':
        if (!waiting) go('VACATED', 'TWR', 'runway vacated via ' + ac.exit);
        break;
    }
  }

  TL.Cmd = { text: text, rb: rb, key: key, unitShort: unitShort };
  TL.Pilot = { apply: apply, respond: respond, think: think };
})(typeof window !== 'undefined' ? (window.TL = window.TL || {}) : (globalThis.TL = globalThis.TL || {}));
