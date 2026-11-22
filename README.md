# SOLMAR HEAT

An open-world crime game in the sun-baked coastal city of **Solmar Bay**.
You are **Jax Vega**, a driver fresh off the ferry. **La Rosa**, the fixer who
runs the club on Marlin Row, has five jobs for you — steal cars, run packages,
shake the cops, settle a score with the Vultures, and pull off the Solmar
Score across the whole city.

Everything is original: the city, the characters, the cars, the story, the
art and the music. No external assets, no network requests — the whole game
is plain HTML, CSS and JavaScript on a canvas, with procedural WebAudio
sound.

## Play

Serve the folder and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from the `game/` folder through any
static server. The game needs no build step.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive in a car |
| Shift | Run |
| Space | Punch |
| F (or mouse click) | Shoot the pistol (aim with the mouse) |
| E | Get in / out of a car, steal a parked car, talk to La Rosa |
| P / Esc | Pause |
| S (while paused) | Save game |
| Q (while paused) | Quit to title |
| M | Mute |

Progress auto-saves when you finish a job, and you can save from the pause
menu. **Continue** on the title screen picks up where you left off.

## The city

Solmar Bay is a 2600×2600 open world: a grid of streets with traffic and
pedestrians, colourful blocks, Palm Court Park, Solmar Beach and the sea,
Pier 9 and the docks, Manny's Garage, the old cannery warehouse and Solmar
General hospital. A live minimap tracks you, the police and your job marker.

## Wanted

Stealing cars, shooting and hitting pedestrians raise your wanted level
(0–5 stars). Police cruisers chase and ram you; foot cops chase you down
on the street. Lay low and stay out of sight and the heat cools off. Get
busted or wasted and you wake up at Solmar General, lighter in the wallet.

## The five jobs

1. **First Wheels** — boost a parked car and bring it to Manny's Garage.
   Reward: $300 and a pistol.
2. **Dock Run** — fetch a package at Pier 9 and deliver it to the club
   while the cops are on you. Reward: $500.
3. **Shake the Tail** — lose a two-star wanted level. Reward: $400.
4. **Warehouse Payback** — deal with four Vultures at the old cannery.
   Reward: $700.
5. **The Solmar Score** — five checkpoints across the whole city against
   the clock. Reward: $1,200.

## Screenshots

The four screenshots in `screenshots/` are deterministic scenes from the
game itself — run it with `?shot=cover|chase|mission|city&seed=1`:

- `1-cover.jpg` — cruising the central boulevard with traffic, one star.
- `2-chase.jpg` — three stars, two cruisers on your tail, skid marks.
- `3-mission.jpg` — the Dock Run pickup at Pier 9.
- `4-city.jpg` — on foot by the park and the beach, pedestrians and a
  boosted sedan at the kerb.

## Files

- `game/index.html` — the game page (fullscreen canvas).
- `game/src/main.js` — boot + fixed-timestep loop.
- `game/src/config.js` — tuning, palette, car models, key places.
- `game/src/world.js` — city generation, physics, traffic, pedestrians,
  police, wanted system, combat and missions.
- `game/src/render.js` — canvas drawing, HUD and live minimap.
- `game/src/input.js` — keyboard + mouse.
- `game/src/audio.js` — procedural WebAudio: engine, sirens, gunshots,
  pickups and a bassline loop.
- `game/src/missions.js` — the five jobs and their story.
- `game/src/save.js` — save/load through localStorage.
- `game/src/shots.js` — deterministic screenshot scenes.
- `main.ts` — make.fun entry plumbing (copies `game/` + `screenshots/`
  and writes `dossier.json`).
- `serve.ts` — static dev server.
- `shots.json` — the four screenshot scenes.

## License

MIT — see `LICENSE`.
