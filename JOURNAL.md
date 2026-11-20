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

### 4.6 Implementation status (Part 1 — done)
- Wired `icons/currency/credit_gold.png` and `star_gem.png` through
  `AG.ICON_MANIFEST`; both now appear in the HUD and the shop. Boss kills award
  a star gem, and the Falcon is priced in gems.
- Created `icons/crates/.gitkeep`.
- Removed the footer tagline, top-bar build tag and icon-pack hint.
- Movement is hold-left-click only and horizontal only; keyboard movement and
  vertical movement were removed. Player fire delay 0.155 -> 0.28 (~3 shots/s).
- Added a DOM wave-completion bar (kills-based, not spawn-based), manual Skip
  Wave, and Auto Skip gated at 60% spawned (`CONFIG.wave.autoSkipAt`).
- Wave-clear banners now use a `.compact` style.
- Added bottom action-bar toasts for credits, repairs and upgrades.
- Shop/Hangar button is disabled during playing/waveclear; Shop BACK now
  restores the screen and state it came from (Escape/P also closes it).
- In-round shop unlocks at wave/level 5. Below it shows
  `ui/shaded_lock.png`, at/above it shows `ui/in_round_shop.png` (copied from
  the uploaded `icons/shop/In_round_shop.png`). It opens only between waves and
  sells Hull Repair / Rapid Fire+ for credits; `game.buy()` handles purchase.
- Level mapping: "level" is the current wave number. If Part 2 defines a
  separate player-level system, rewire `CONFIG.wave.inRoundShopLevel`.

**Verification (headless Chromium via CDP, no browser harness):** all checks
passed with zero console errors — hold-left movement moves X only, ~3 shots/s,
forced kill raises credits and emits a toast, completion bar reaches 100%,
skip and auto-skip at 60% work, shop gating and exit restore state, both
in-round shop icons resolve from the manifest, and purchasing works. A
screenshot was captured; DOM layout boxes confirm HUD/progress/controls sit
inside the canvas without overlap.

---

## 5. Game updates — Part 2 (user spec, save verbatim)

### 5.1 Fixes requested alongside Part 2
- Fix auto skip and Skip Wave clearing all enemies from the field.
- Make it impossible to skip boss fights.
- Allow arrow keys or WASD to move again, and make movement more responsive
  because it feels slow.

### 5.2 Level system
- Add a player level system.
- Players must reach level 5 to unlock the in-round shop. (Level is a player
  stat, NOT the wave number — this supersedes the Part 1 assumption.)

### 5.3 Home screen tutorial
- Remove all gameplay instructions currently displayed on the home screen.
- Replace them with a tutorial slideshow popup.
- Display one instruction at a time.
- Include navigation controls to move between slides.
- Add an X button in the top-right corner so players can close the tutorial at
  any time.
- Keep the tutorial visually polished and easy to understand.
- The tutorial should not obstruct the home screen once closed.

### 5.4 Visual improvements
- Remove the word "Foundation" from the top-right corner of the build.
- Make the UI less thin and more substantial. Improve the visual weight of UI
  elements while keeping the design consistent.
- Keep the interface clean and avoid unnecessary text or visual clutter.
- Completely remove this developer-facing text from the home screen:
  "Drop your icon pack into `icons/` to replace the placeholder art."
  This should not be visible to players.

### 5.5 General requirements
- Preserve existing working features.
- Ensure all buttons and menus work correctly.
- Keep the code organised and maintainable.
- Test the changes to make sure they work properly.

**Note on 5.4:** the build tag and icon-pack hint were already removed in Part 1;
only code comments still contain the word "foundation", which is not user-facing.

### 5.6 Implementation status (Part 2 — done)
- Skip Wave / Auto Skip no longer erase field enemies: skipping only discards
  the unspawned queue and advances the round, so live enemies carry over.
  Boss waves (every 10th) cannot be skipped by either route; the buttons are
  disabled on boss waves and the logic guards both paths.
- Restored arrow keys / WASD full 2D movement alongside hold-left-click
  steering, and raised ship speed 315 -> 430 px/s for snappier control.
- Added a player level system in `config.js`/`game.js`: XP from kills, wave
  clears and bosses; `AG.xpForLevel()` curve; HUD LEVEL + XP bar; level-up
  toast and small heal. The in-round shop now checks `game.level >= 5`
  (`CONFIG.leveling.shopUnlock`), not wave number.
- Home-screen instructions replaced by `js/tutorial.js`: six-slide modal with
  PREV/NEXT, clickable dots, X close button, arrow-key navigation, and a
  first-visit auto-open via localStorage. "HOW TO PLAY" reopens it.
- Visual weight raised across HUD, buttons, bars, cards and modal (thicker
  borders, larger/bolder type, stronger panels) without adding new text.
- No user-facing "Foundation" or icon-pack hint text remains.

**Verification (headless Chromium via CDP):** zero console errors. Passed:
tutorial next/prev/close and 6 dots; keyboard movement in both axes at 430
px/s; skip preserves enemies; manual and auto skip both blocked on boss wave;
XP levelling to 5; lock/unlock icon paths; in-round shop open/close; shop exit.
Screenshots of the tutorial and gameplay were captured and visually inspected.

---

## 6. Handover — complete session context

### 6.1 Access and environment
- `gh` is authenticated as **CatsAreMakeGame** (keyring token `gho_…`, scopes
  `gist`, `read:org`, `repo`, `workflow`; HTTPS protocol). The token lacks the
  `user` scope, so `gh api user` cannot look up the account email.
- Working checkout: `C:/Users/chich/Ai-game`, branch `main`, remote
  `https://github.com/CatsAreMakeGame/Ai-game.git`. Repo-local identity:
  `user.name=CatsAreMakeGame`, `user.email=CatsAreMakeGame@users.noreply.github.com`;
  `gh auth setup-git` set `credential.helper=helper-selector` so HTTPS pushes
  use the `gh` token without prompts.
- The remote has repeatedly received **out-of-band commits** (icons uploaded or
  renamed through the GitHub web UI). Always `git fetch` + `git pull --rebase
  origin main` before pushing, inspect divergence, and never force-push. When
  local and remote files collide, compare hashes before removing duplicates.
- Game has no build step and no dependencies: double-click `index.html` (`file://`).
- The `browser_exec` harness fails on this host with "Chromium exited with code 0
  during startup". Working verification path: launch the bundled Chromium at
  `C:/Users/chich/AppData/Local/hermes/tools/chromium-1248/chrome-win64/chrome.exe`
  with `--headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222
  --user-data-dir=<scratch>`, then drive CDP from Node (built-in global
  `WebSocket`) using the page target from `http://127.0.0.1:9222/json/list`.
  `--dump-dom` produced no output here. A temporary copy of `index.html` with an
  injected `VERIFY_JSON` marker makes verification one call; delete it after.
  `vision_analyze` intermittently returns 429 — retry or fall back to DOM rects.
  This workaround is recorded in the `browser-game-development` skill.

### 6.2 Currency design decisions (chat)
- Two-tier economy: **Credits** = common soft currency, gold `#ffd75c`, glyph
  `●`, earned from kills and wave clears, spends on consumables (Hull Repair,
  Rapid Fire+). **Star Gems** = rare, cyan `#6ef0ff`, glyph `◆`, dropped by
  Mothership bosses, spend on permanent unlocks (Falcon ship).
- "Coins" was rejected as too earthy for a space shooter. "Space Gems" was
  rejected as too literal; "Star Gems" was chosen. Purple is reserved for a
  possible third, premium tier.
- The old fallback rendered every missing icon in cyan; fallback colour now
  follows each currency's own colour.
- Purchases are still in-memory only — no localStorage persistence yet.

### 6.3 Icon art spec (chat)
- Use **256x256 transparent PNG**, with a thin near-black outline (`#0a0d14`)
  about 6-8px at source so it survives downscaling to the 15px HUD / 30px shop
  sizes. Centre the shape with padding, no baked-in text, no heavy drop shadow.
- 256px is deliberately oversized for current display but power-of-two and
  future-proof; 64px would be sufficient for today's use.

### 6.4 Icon files and manifest
- Source pack: `C:/Users/chich/Downloads/vector-icon-pack/General/...`.
- Shop basket history: `paid_shopping.png` = Red Outline 256,
  `premium_shopping.png` = Yellow Outline 256, `normal_shop.png` = Blue Outline
  256. The remote later renamed `normal_shop.png` to `In_round_shop.png`; that
  image was copied to `icons/ui/in_round_shop.png` for the level-5 unlocked shop
  icon. `icons/ui/shaded_lock.png` was uploaded on the remote for the locked state.
- Currency files: `icons/currency/credit_gold.png`, `star_gem.png`.
- Manifest: `currency.credit` -> `icons/currency/credit_gold.png`,
  `currency.gem` -> `icons/currency/star_gem.png`, `ui.shadedLock` ->
  `icons/ui/shaded_lock.png`, `ui.inRoundShop` -> `icons/ui/in_round_shop.png`.
  `shop.locked` still points at `icons/shop/locked.png`, which does not exist.
- `icons/README.md` lists the current expected filenames. `icons/crates/` was
  created with a `.gitkeep` and is currently empty (no crate drops yet).

### 6.5 Current remote icon tree
```
icons/README.md
icons/crates/.gitkeep
icons/currency/.gitkeep, credit_gold.png, star_gem.png
icons/enemies/.gitkeep
icons/shop/.gitkeep, In_round_shop.png, paid_shopping.png, premium_shopping.png
icons/spaceships/.gitkeep
icons/ui/.gitkeep, in_round_shop.png, shaded_lock.png
```

### 6.6 Feature state at handover
- Controls: arrow keys / WASD for full 2D movement plus hold-left-click steering;
  automatic fire; P/Esc pause; Enter restart. Speed 430 px/s.
- "Level" means **player level**, not wave. XP from kills, wave clears and
  bosses; in-round shop unlocks at level 5.
- Skip Wave / Auto Skip stop future spawns but leave field enemies alive; boss
  waves cannot be skipped by either route. Auto Skip requires 60% spawned.
- HUD: wave, level + XP bar, score, credits, star gems, hull, wave completion %.
- Tutorial: six slides, PREV/NEXT, dots, X close, first-visit auto-open,
  "HOW TO PLAY" button to reopen.
- Shop/Hangar locked during a wave; in-round shop opens between waves at level 5.
- Recent commits: `b503cbb` icons renamed, `ff0a0b5` Part 1 spec, `b3cda79`
  Part 1 implementation, `15a0d6c` Part 2 spec, `0a7e758` Part 2 implementation.
  `main` was clean and in sync with `origin/main` at handover.

### 6.7 Remaining / future work
- More playable ships and a ship-select screen.
- Real shop: purchase persistence (localStorage), equipping, `available` flags,
  and a sink for star gems.
- Crates folder is empty — no crate drops or crate opening yet.
- Sound, mobile on-screen controls, difficulty setting.
- Boss waves disable the Auto Skip toggle visually but leave the flag set; the
  guard in `Game.update` prevents actual skipping. Revisit if a cleaner UX is
  wanted.
