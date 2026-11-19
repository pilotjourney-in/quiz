/* Radio voice engine: Vosk speech recognition running inside the page (no server), limited to radio words.
   Because it can only pick words from this list, everyday words can't creep into a transmission. */
(function (TL) {
  'use strict';
  var WORDS = ["a", "acknowledge", "affirm", "affirmative", "after", "again", "air", "airborne", "airbus", "aircraft", "alliance", "allied", "alpha", "and", "approach", "approved", "apron", "area", "around", "arrival", "at", "back", "base", "behind", "boeing", "bravo", "by", "call", "casa", "cessna", "charlie", "circuit", "circuits", "clearance", "cleared", "climb", "climbing", "confirm", "contact", "continue", "copied", "copy", "correct", "correction", "crosswind", "decimal", "degrees", "delta", "departing", "departure", "descend", "direct", "downwind", "each", "early", "east", "echo", "eight", "established", "expect", "extend", "extending", "f", "feet", "fife", "final", "first", "five", "flight", "fly", "for", "four", "foxtrot", "from", "full", "go", "going", "golf", "ground", "h", "hand", "heading", "hold", "holding", "hotel", "hundred", "i", "in", "inbound", "india", "indigo", "information", "intentions", "is", "jet", "join", "joining", "juliet", "kilo", "knots", "l", "land", "landed", "landing", "left", "leg", "lima", "line", "lined", "lining", "low", "make", "mike", "miles", "minute", "n", "nagpur", "negative", "next", "nine", "niner", "north", "november", "number", "of", "off", "on", "one", "orbit", "orbiting", "oscar", "out", "over", "overhead", "papa", "parked", "passing", "point", "position", "push", "q", "quebec", "r", "ray", "readability", "ready", "report", "request", "right", "roger", "roll", "romeo", "runway", "s", "say", "seven", "short", "sierra", "six", "south", "spice", "stand", "standby", "start", "startup", "station", "stop", "straight", "t", "take", "takeoff", "tango", "taxi", "taxiing", "ten", "the", "this", "thousand", "three", "to", "touch", "tower", "traffic", "tree", "turn", "turning", "two", "unable", "uniform", "up", "v", "vacate", "vacated", "vacating", "via", "victor", "visual", "wait", "west", "whiskey", "wilco", "will", "wind", "with", "x", "yankee", "zero", "zulu"];
  var VK = TL.VK = { state: 'off', ready: false, onstate: null };
  var model = null, rec = null, ctx = null, node = null, src = null, stream = null, feeding = false, parts = [], partial = '', want = null, onPart = null;
  function set(s) { VK.state = s; VK.ready = s === 'ready'; if (VK.onstate) VK.onstate(s); }
  VK.supported = function () { return !!(window.WebAssembly && window.Worker && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); };
  /* Call from a tap (Start) so the audio context and mic prompt are allowed. */
  VK.load = function () {
    if (VK.state !== 'off' && VK.state !== 'failed') return;
    if (!VK.supported()) { set('failed'); return; }
    set('loading');
    var AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC(); } catch (e) { set('failed'); return; }
    var s = document.createElement('script'); s.src = 'vosk/vosk.js';
    s.onerror = function () { set('failed'); };
    s.onload = function () {
      window.Vosk.createModel(new URL('vosk/model.tar.gz', location.href).href, -1).then(function (m) {
        model = m;
        return navigator.mediaDevices.getUserMedia({ video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      }).then(function (st) {
        stream = st;
        rec = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(WORDS.concat(['[unk]'])));
        rec.on('result', function (m) {
          var t = (m.result && m.result.text || '').replace(/\[unk\]/g, '').trim();
          if (t) parts.push(t);
          partial = '';
          if (want) { var cb = want; want = null; var all = parts.join(' ').trim(); parts = []; cb(all); }
          else if (onPart) onPart(parts.join(' '));
        });
        rec.on('partialresult', function (m) { partial = (m.result && m.result.partial || '').replace(/\[unk\]/g, '').trim(); if (onPart) onPart((parts.join(' ') + ' ' + partial).trim()); });
        src = ctx.createMediaStreamSource(stream);
        node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = function (ev) { if (feeding) { try { rec.acceptWaveform(ev.inputBuffer); } catch (e) { /* ignore */ } } };
        src.connect(node); node.connect(ctx.destination);
        set('ready');
      }).catch(function () { set('failed'); });
    };
    document.head.appendChild(s);
  };
  VK.start = function (partCb) {
    if (!VK.ready) return false;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    parts = []; partial = ''; want = null; onPart = partCb; feeding = true;
    return true;
  };
  /* Keep listening a moment so the last word isn't cut, then return the whole transmission. */
  VK.stop = function (cb) {
    setTimeout(function () {
      feeding = false;
      var done = false, finish = function (t) { if (done) return; done = true; onPart = null; cb(t); };
      want = finish;
      try { rec.retrieveFinalResult(); } catch (e) { want = null; finish(parts.join(' ')); }
      setTimeout(function () { if (!done) { want = null; var t = (parts.join(' ') + ' ' + partial).trim(); parts = []; finish(t); } }, 2500);
    }, 450);
  };
})(window.TL = window.TL || {});
