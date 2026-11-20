# Project Journal — Alien Shooter

This file is the handover record. If working on this repo in a new session, read
this first, then `README.md`, then the relevant file under `js/`. It records what
the game is, why it is structured this way, and exactly what has already been done.

---

## 1. Game summary

**What it is:** a browser-based vertical alien shooter. One playable ship, 50
waves, exponential difficulty, no build step and no dependencies. Open
`index.html` directly from disk (`file://`) — no local server needed.

**Controls:** arrow keys / WASD or mouse to move; firing is automatic; `P` or
`Esc` pauses; `Enter` starts/restarts. Survive all 50 waves to win. A Mothership
boss appears on every 10th wave.

**Core systems:**
- `js/config.js` — every tunable number and the pure difficulty function
  `AG.difficultyFor(wave)`. Tier is `1.12^(n-1)`; count, health, speed, spawn
  interval and enemy fire interval each have their own exponential curve plus a
  cap so late waves stay winnable. `AG.playerDamageFor(wave)` raises player
  damage every 8 waves to keep pace with enemy health.
- `js/data.js` — content registries: `AG.SPACESHIPS` (one entry today),
  `AG.ENEMY_TYPES` (grunt, diver, shooter, tank, boss), `AG.BOOSTS` (heal,
  rapidFire, doubleDamage, shield), `AG.CURRENCIES`, `AG.SHOP_ITEMS`, and
  `AG.ICON_MANIFEST` (flat `category.name` keys -> paths under `icons/`).
- `js/assets.js` — `AG.AssetManager` preloads manifest images and records
  loaded/missing; `AG.assets.draw(key, ..., fallback)` uses the image when present
  and procedural art otherwise. `AG.Art.drawShape()` holds all placeholder art.
- `js/entities.js` — `Player`, `Enemy`, `Bullet`, `PowerUp`, `Particle`, all on a
  small `Entity` base with AABB collision.
- `js/waves.js` — `AG.WaveManager` builds a spawn queue from the difficulty
  values, puts the boss at the front on boss waves, and calls
  `game.onWaveCleared()` when the queue is empty and no enemies remain.
- `js/ui.js` — DOM HUD, banners, overlay screens, and a shop scaffold that
  renders `AG.SHOP_ITEMS` through the shared icon resolver.
- `js/game.js` — `AG.Game` state machine
  (`menu / playing / waveclear / paused / gameover / victory / shop`), capped-dt
  loop (`dt <= 0.033`), collisions, screen shake, starfield, rendering.
- `js/main.js` — bootstrap; exposes `window.AG.game` for console debugging.

**Design decisions worth preserving:**
- Classic `<script>` tags and one `window.AG` namespace, loaded in dependency
  order. ES modules were deliberately avoided because `file://` blocks module
  CORS and the user must be able to double-click `index.html`.
- Text lives in the DOM, not on the canvas: crisper type, easier icon hooks.
- Every art asset is optional. Placeholder art means the game is playable before
  the user adds their purchased icon pack.
- Projectiles never resolve icon keys — bullets are always procedural, otherwise
  installing a ship pack would turn bullets into ship sprites.
- New ships/enemies/boosts/shop items are data additions in `data.js`, not loop
  changes. Purchasing and persistence are the remaining shop work.

**Scale at wave 50 (measured in-browser):** tier 258x, 66 enemies, 8.6x health,
179 px/s speed, 0.18 s spawn interval. Player damage at wave 50 is 7.

---

## 2. Journal

### Session 1 — initial connection and the `Successful` file
- Confirmed `gh` was authenticated as `CatsAreMakeGame` and that
  `C:/Users/chich/Ai-game` was a git repo with remote
  `https://github.com/CatsAreMakeGame/Ai-game.git`.
- Repo contained only `README.md` ("made with hermes tencent") and `Successful`.
- Created a file named `Successful` containing the text `Successful`; committed
  as `bef5d81` "Add Successful file" and pushed to `main`.
- Two environment fixes were needed and are still in effect (repo-local config):
  `user.name=CatsAreMakeGame`, `user.email=CatsAreMakeGame@users.noreply.github.com`,
  and `gh auth setup-git` set `credential.helper=helper-selector` so HTTPS pushes
  use the existing `gh` token without prompting. The token lacks the `user`
  scope, so `gh api user` cannot be used to look up email.

### Session 2 — build the game
- User asked to remove `Successful` and build a 50-wave alien shooter with an
  `icons/` folder and a structure ready for shop/currency/boosts later.
- `git rm Successful`, created `css/`, `js/`, and `icons/<category>/` folders.
- Wrote all 12 project files in this order: `index.html`, `css/style.css`,
  `js/config.js`, `js/data.js`, `js/assets.js`, `js/entities.js`, `js/waves.js`,
  `js/ui.js`, `js/game.js`, `js/main.js`, `icons/README.md`, root `README.md`.
- Added six `.gitkeep` files so empty icon folders are tracked, plus a `README.md`
  inside `icons/` listing the exact expected PNG filenames.
- Fixed three bugs found while writing, before ever running the game:
  1. `Bullet.draw` initially resolved ship icon keys — replaced with a direct
     procedural draw.
  2. `Player` had no `age` field for engine animation — added and advanced it.
  3. `Player.draw` called `ctx.restore()` on some frames without a matching
     `save()` — replaced with a local `saved` flag.
  4. `WaveManager.start` popped and unshifted an arbitrary entry to put the boss
     first, which actually put an escort first — removed; the boss is pushed to
     the queue front by construction.
- Browser verification (real Chromium via the browser harness, file URL):
  - Injected a `window.__errs` error collector before page load.
  - Loaded the page: `AG` present, `AG.game` present, state `menu`, 1 ship,
    15 manifest entries, zero errors.
  - Clicked start, waited: state `playing`, wave 1, enemies and bullets alive.
  - Forced a deterministic collision by placing a grunt in the firing line:
    `kills=1`, `score=10`, `credits=3`, no errors.
  - Exercised transitions: wave 10 queue starts with `boss`; `onWaveCleared(10)`
    -> `waveclear`; `onWaveCleared(50)` -> `victory` screen active; shop button
    -> shop screen active with 3 item cards. `window.__errs` remained empty.
  - Captured a screenshot and inspected it: player ship, glowing enemies,
    bullet stream, starfield and HUD all visibly render correctly.
- Committed as `63a025b` "Add playable 50-wave alien shooter foundation" (19
  files, 1885 insertions).
- First push was rejected: remote had two new commits made outside this session,
  `b3413e8` "Create icons" and `bc9cac5` "Delete icons". Inspection showed they
  created and deleted a *file* named `icons`, a net-zero tree change against
  `bef5d81`. Ran `git pull --rebase origin main` (clean) and pushed successfully.
  The rebased game commit is `99421b3`.
- Verified the remote tree with `git ls-tree -r --name-only origin/main`: all
  game files present, `Successful` absent.

### Session 3 — this journal
- Loaded the `browser-game-development` skill (it matches this exact project).
- Recorded the above summary and journal in `JOURNAL.md`, then committed and
  pushed it so the next session can catch up from the repo alone.

---

## 3. Current state and next steps

**State at time of writing:** `main` is clean and in sync with `origin/main`.
Commit order: `8b5c2a2` initial -> `bef5d81` Successful -> `b3413e8` Create icons
-> `bc9cac5` Delete icons -> `99421b3` game foundation -> journal commit.

**Known out-of-scope / future work:**
- More playable ships: add entries to `AG.SPACESHIPS`, then add a ship-select
  screen and swap `AG.SPACESHIPS[0]` in `AG.Game.newRun()`.
- Real shop: purchasing, persistence (localStorage), equipping, and the
  `available: false` flags in `AG.SHOP_ITEMS`.
- Currency sinks and a use for `currency.gem`.
- Art: drop purchased PNGs into `icons/` using the names in `icons/README.md`.
- Sound, mobile on-screen controls, and a difficulty setting are not implemented.

**How to re-verify quickly:** open `file:///C:/Users/chich/Ai-game/index.html`,
inject `window.__errs`, click start, wait, force a collision, check `kills`/`score`,
exercise boss/wave-clear/victory/shop, require no errors, screenshot and inspect.
See the `browser-game-development` skill for the full recipe.

---

## 4. Game updates — Part 1 (user spec, save verbatim)

### 4.1 Files and folders
- Two currency icons have been added to `icons/currency/` — use them in the game.
  (They are `credit_gold.png` and `star_gem.png`; the manifest still points at the
  old `credit.png` / `gem.png` paths.)
- Create a new folder called `crates`.

### 4.2 Gameplay and controls
- Remove excess side text, including "One ship · 50 waves · exponential difficulty".
- Players must hold left-click to move the spaceship.
- Restrict movement to left and right only. No up or down movement.
- These restrictions are intentional because players should earn additional
  movement abilities later — do not "fix" this back into free movement.
- Reduce the number of bullets fired by the rocket ship; there are currently too many.

### 4.3 Wave system
- Add a wave completion percentage bar.
- Add a manual Skip Wave button.
- Add an Auto Skip option. It can only activate once at least 60% of the enemies
  scheduled for the current wave have spawned.
- Make round completion messages smaller and less intrusive so they don't
  obstruct gameplay.

### 4.4 Notifications
- Add action-bar notifications at the bottom of the screen whenever players:
  - receive an upgrade,
  - earn coins,
  - receive repairs.

### 4.5 Shop and hangar
- Fix the issue preventing players from exiting the Shop and Hangar.
- Players cannot access the Shop or Hangar while actively playing a wave. They
  can access them once the game is finished.
- Add an in-round shop that unlocks at level 5.
- Below level 5, display `ui/shaded_lock.png` as the locked shop icon.
- At level 5 and above, display `ui/in_round_shop.png` as the unlocked shop icon.
  The actual filename is `in_round_shop.png`, not `normal_shop.png`.

**Note:** Part 2 of this spec will arrive after Part 1 is reported ready.
