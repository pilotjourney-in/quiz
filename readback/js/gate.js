/* Subscriber gate for Readback. App scripts load only after a correct weekly password. */
(function () {
  'use strict';
  var GATE_URL = 'gate.json';
  var STORAGE_KEY = 'pj-readback-gate';
  var SCRIPTS = [
    'js/airport.js?v=3',
    'js/phrase.js?v=4',
    'js/sim.js?v=4',
    'js/pilot.js?v=4',
    'js/atc.js?v=4',
    'js/vk.js?v=3',
    'js/ui.js?v=10'
  ];
  var booted = false;

  function $(id) { return document.getElementById(id); }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var x = 0;
    for (var i = 0; i < a.length; i++) x |= a[i] ^ b[i];
    return x === 0;
  }

  async function deriveHash(password, salt, iterations) {
    var enc = new TextEncoder();
    var base = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    var key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );
    return new Uint8Array(await crypto.subtle.exportKey('raw', key));
  }

  async function loadGate() {
    var res = await fetch(GATE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('gate-load');
    var data = await res.json();
    if (data.kdf !== 'PBKDF2-SHA256') throw new Error('gate-kdf');
    if (!data.iter || data.iter < 200000) throw new Error('gate-iter');
    if (!data.salt || !data.hash) throw new Error('gate-format');
    return data;
  }

  async function passwordMatches(password, gate) {
    var salt = b64ToBytes(gate.salt);
    var expected = b64ToBytes(gate.hash);
    var actual = await deriveHash(password, salt, gate.iter);
    return bytesEqual(actual, expected);
  }

  function loadScripts(urls) {
    return urls.reduce(function (p, url) {
      return p.then(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = url;
          s.onload = resolve;
          s.onerror = function () { reject(new Error('script-load')); };
          document.body.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  async function unlock() {
    if (booted) return;
    booted = true;
    await loadScripts(SCRIPTS);
    var gateEl = $('gate');
    var setup = $('setup');
    if (gateEl) gateEl.hidden = true;
    if (setup) setup.hidden = false;
  }

  function setError(msg) {
    var el = $('gate-error');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function rememberedHash() {
    try { return window.localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }

  function remember(hash) {
    try { window.localStorage.setItem(STORAGE_KEY, hash); } catch (e) { /* private mode */ }
  }

  async function init() {
    var form = $('gate-form');
    var input = $('gate-password');
    var button = $('gate-submit');
    var gate;
    try {
      gate = await loadGate();
    } catch (e) {
      setError('The unlock page could not be loaded. Please try again in a moment.');
      return;
    }
    if (rememberedHash() === gate.hash) {
      try {
        await unlock();
        return;
      } catch (e) {
        booted = false;
        setError('Something went wrong while opening Readback. Please try again.');
      }
    }
    if (form) {
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setError('');
        var password = ((input && input.value) || '').trim();
        if (!password) {
          setError('Enter this week’s password from the subscribers group.');
          return;
        }
        if (button) { button.disabled = true; button.textContent = 'Unlocking…'; }
        try {
          if (!(await passwordMatches(password, gate))) {
            setError('That password didn’t work. Check this week’s subscriber post and try again.');
            return;
          }
          remember(gate.hash);
          if (input) input.value = '';
          await unlock();
        } catch (e) {
          booted = false;
          setError('Something went wrong while unlocking. Please try again.');
        } finally {
          if (button && !booted) { button.disabled = false; button.textContent = 'Unlock'; }
        }
      });
    }
    if (input) {
      try { input.focus(); } catch (e) { /* ignore */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
