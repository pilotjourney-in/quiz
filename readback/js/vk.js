/* Radio voice engine: Vosk speech recognition running inside the page (no server), limited to radio words.
   Because it can only pick words from this list, everyday words can't creep into a transmission. */
(function (TL) {
  'use strict';
  var WORDS = ["a", "acknowledge", "affirm", "affirmative", "after", "again", "ahmedabad", "air", "airasia", "airborne", "airbus", "aircraft", "airlines", "airways", "akasa", "alliance", "allied", "alpha", "american", "amsterdam", "and", "anguilla", "approach", "approved", "apron", "arabia", "area", "around", "arrival", "arrivals", "at", "austrian", "back", "backtrack", "bahrain", "bali", "bangalore", "bangkok", "barcelona", "base", "batik", "bay", "behind", "belfast", "bengaluru", "bhairahawa", "biratnagar", "boeing", "bravo", "british", "buddha", "by", "call", "cap", "casa", "cathay", "cebu", "center", "centre", "cessna", "change", "changi", "charlie", "charlotte", "check", "chennai", "circuit", "circuits", "clearance", "cleared", "climb", "climbing", "confirm", "contact", "continue", "copied", "copy", "correct", "correction", "crosswind", "curacao", "decimal", "degrees", "delhi", "delivery", "delta", "departing", "departure", "departures", "descend", "direct", "director", "doha", "downwind", "dubai", "each", "early", "east", "easy", "easyjet", "echo", "edinburgh", "eight", "established", "eurowings", "expect", "express", "extend", "extending", "f", "feet", "fife", "final", "first", "five", "flight", "fly", "flydubai", "for", "four", "foxtrot", "frankfurt", "frequency", "from", "full", "gatwick", "geneva", "glasgow", "go", "goa", "going", "golf", "greater", "ground", "gulf", "h", "hamburg", "hand", "heading", "himalaya", "hkexpress", "hold", "holding", "hong", "hongkong", "hotel", "hundred", "hyderabad", "i", "ifly", "in", "inbound", "india", "indigo", "indore", "information", "innsbruck", "intentions", "is", "jaipur", "jakarta", "jet", "jetblue", "join", "joining", "juliana", "juliet", "karachi", "kathmandu", "kilo", "knots", "kolkata", "kong", "kuala", "kuwait", "l", "land", "landed", "landing", "left", "leg", "lima", "line", "lined", "lining", "london", "low", "lumpur", "make", "malaga", "malindo", "manila", "miami", "mike", "miles", "minute", "mumbai", "muscat", "n", "nagpur", "negative", "nepal", "new", "next", "nine", "niner", "north", "northeast", "northwest", "november", "number", "of", "off", "on", "one", "orbit", "orbiting", "osaka", "oscar", "out", "over", "overhead", "papa", "paris", "parked", "passing", "penang", "point", "pokhara", "position", "pune", "push", "q", "quebec", "r", "radar", "radio", "raipur", "ray", "readability", "ready", "red", "report", "request", "right", "riyadh", "roger", "roll", "romeo", "royal", "runway", "s", "say", "scoot", "scooter", "seoul", "seven", "shanghai", "short", "shuttle", "sierra", "singapore", "six", "skydubai", "south", "southeast", "southwest", "speedbird", "spice", "spicejet", "stand", "standby", "start", "startup", "station", "stop", "straight", "t", "taipei", "take", "takeoff", "tango", "taxi", "taxiing", "ten", "the", "this", "thousand", "three", "to", "tokyo", "tomjet", "touch", "tower", "track", "traffic", "transavia", "tree", "tui", "turn", "turning", "two", "unable", "uniform", "up", "v", "vacate", "vacated", "vacating", "via", "victor", "vienna", "visual", "vueling", "wait", "west", "whiskey", "wilco", "will", "winair", "wind", "windward", "with", "wizz", "x", "yankee", "yeti", "york", "your", "zero", "zulu", "zurich"];
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
