# Readback by Pilot Journey

Radio practice at a simplified Nagpur (VANP), runway 14/32. Pick the pilot seat or the controller seat.

Plain static site: HTML, CSS and JavaScript. No build step, no server code, no API keys, no external requests.

## Hosting

Upload the folder as it is to `quiz.pilotjourney.in/readback/` and open `index.html`.
Add the logo as `img/logo.png` (top bar, start screen, score card and favicon all use that one file).
Voice input needs the page to be served over **https** and a browser with speech recognition (Chrome, Edge, Safari).
Everywhere else, typing and the tap-to-send buttons do the same job.

## Files

- `index.html`, `css/style.css` — page and styling. All colours are CSS variables at the top of `style.css`; the map reads the same variables.
- `img/logo.png` — your logo (not included)
- `js/airport.js` — runway, frequencies, taxiway layout. **Edit this to correct the layout.**
- `js/phrase.js` — spoken numbers/letters, speech normalising, callsigns
- `js/sim.js` — aircraft movement, runway state, radio channels, scoring events
- `js/pilot.js` — instruction wording, how aircraft comply, what simulated pilots say
- `js/atc.js` — the simulated controller, understanding your speech in either seat, hints
- `js/ui.js` — map, strips, log, microphone and speech output

## Known limits

- Taxiways, holding points, apron and stands are a simplified training layout, not the published chart.
  Runway dimensions, elevation and Tower/Ground frequencies are from public listings; Approach 122.7 is
  listed inconsistently between sources. Check all of it against the current AIP before teaching from it.
- Speech is matched by keywords, so it is forgiving of word order and strict only about the items that
  must be read back (runway, holding point, QNH, frequency, clearance type).
- The eye button in the top bar is clean recording mode: it hides the suggested calls and the menus, and the choice is remembered in localStorage.
- No wind effect on flight paths, one runway in use per session, no IFR clearances or SIDs.
