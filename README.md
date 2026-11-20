# Alien Shooter

A browser-based alien spaceship shooter. One ship, 50 waves, exponential difficulty.
Built with plain HTML, CSS and JavaScript — no build step, no dependencies.

**Handover:** `JOURNAL.md` summarises the game and records everything that has
been done, including verification results and future work. Read it first when
picking this project up in a new session.

## Play

Open `index.html` in a browser. That's it.

- **Move:** arrow keys / WASD, or move the mouse over the playfield
- **Fire:** automatic
- **Pause:** `P` or `Esc`
- **Start / restart:** `Enter`, or use the on-screen buttons

Survive all 50 waves to win. Every 10th wave is a Mothership boss wave.

## How difficulty scales

`js/config.js` owns the curve. For wave `n` the tier is `1.12^(n-1)`, and each
system derives its own exponential value with a safety cap so the game remains
winnable:

| System | Formula (wave n) | Cap |
| --- | --- | --- |
| Enemy count | `ceil(6 × 1.05^(n-1))` | 70 |
| Enemy health | `1 × 1.045^(n-1)` | 16× |
| Enemy speed | `42 × 1.03^(n-1)` px/s | 205 px/s |
| Spawn interval | `0.90 × 0.965^(n-1)` s | 0.18 s min |
| Enemy fire interval | `3.40 × 0.955^(n-1)` s | 0.50 s min |

Player damage rises one point every 8 waves, which can later be replaced by an
upgrade system. Enemy types unlock over time: Grunts (wave 1), Shooters (3),
Divers (5), Tanks (8), Mothership boss (every 10).

Killed enemies have a chance to drop a temporary boost: Repair, Rapid Fire,
Double Damage or Shield. Kills award score and credits.

## Project layout

```
index.html          markup, screens, HUD, script load order
css/style.css       all styling and the responsive stage
js/config.js        tunables + difficulty formulas
js/data.js          content registries (ships, enemies, boosts, currencies, shop, icons)
js/assets.js        icon loader + procedural placeholder art
js/entities.js      Player, Enemy, Bullet, PowerUp, Particle
js/waves.js         wave planning, spawning, completion
js/ui.js            HUD, banners, screens, icon-driven shop scaffold
js/game.js          state machine, loop, collisions, rendering
js/main.js          bootstrap
icons/              your purchased icon-pack assets (see icons/README.md)
```

## Adding content later

- **Another ship:** add a definition to `AG.SPACESHIPS` in `js/data.js` and an
  icon entry in `AG.ICON_MANIFEST`. `AG.Game.newRun()` reads `AG.SPACESHIPS[0]`;
  swapping in a selected index is the only change needed for a ship select.
- **Another enemy:** add an entry to `AG.ENEMY_TYPES` and, if it should spawn,
  add it to the weighted pool in `js/waves.js`.
- **A boost:** add it to `AG.BOOSTS`; pickups, HUD chips and the shop scaffold
  all read that registry automatically.
- **Shop / currency:** item and currency data already live in `js/data.js`,
  and `AG.UI._renderShop()` renders them with the shared icon resolver. Purchase
  and persistence logic is the remaining feature work.
- **Icons:** drop PNGs into `icons/` using the names in `icons/README.md`. Missing
  files fall back to canvas art, so the game is playable before your pack arrives.

`window.AG.game` is exposed for console debugging.
