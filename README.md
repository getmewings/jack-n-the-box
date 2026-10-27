# Jack n the Box

A once-a-day surprise for your phone. No words inside. Open it, crank the handle in circles, and on the *pop* the box opens into that day's scene.

Add it to your home screen from the browser's share menu and it behaves like an app.

## Running it

It is a static site with no build step. Serve the folder over HTTPS (camera, microphone and motion sensors need a secure origin). GitHub Pages does this via `.github/workflows/pages.yml`.

For local testing: `python3 -m http.server` then open `http://localhost:8000` (sensors work on localhost).

## Adding a day

Each surprise is one module in `src/boxes/` exporting `{ name, mount(root, api) }`. `mount` draws into `root` and returns a cleanup function. `api` gives you `day`, a seeded `rng`, and `motion()` for tilt and shake. Shared synths, sensors and canvas helpers live in `src/engine.js`. Register the module in `src/boxes/index.js`; its position in the list is the day it plays.
