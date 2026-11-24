# Alien Shooter

A browser-based alien shooter with 50 escalating waves, Mothership bosses, pilot upgrades and unlockable ships.

## Play

Open `index.html` in a browser. The game runs directly from disk with no installation, server or build step.

- Move left and right with **A/D**, **left/right arrows**, or a **held mouse or touch drag**. The ship fires automatically.
- Press **P** or **Esc** to pause. Use **Enter** or the on-screen buttons to start.
- Every tenth wave is a Mothership fight. Defeat the final Mothership and any remaining enemies to win.
- **Skip Wave** advances to the next wave while enemies and projectiles already on the field stay live. **Auto Skip** waits until 60% has spawned. Boss waves must be cleared.
- Earn XP through kills and cleared waves. At **pilot level 5**, spend run Credits on supplies during intermissions.
- Open **Inventory** or press **I** during a run. Fly into a drop to collect it. Use consumable boosts from the **Boosts** tab and equip ship parts from **Upgrades**. The Vector Engine unlocks vertical movement, Swift Wings improve speed, and the Pulse Cannon adds damage. Inventory and equipment reset at the start of each run.
- Defeat bosses to earn Star Gems. Unlock the Falcon in the **Shop** and equip it in the **Hangar**. Gems, ship unlocks, the equipped ship, records and preferences are saved in the current browser when local storage is available.

## Local testing

Open **Admin** from the main menu and enter `ADMIN99`. Testing runs can jump to any wave, spawn enemies and pickups, grant inventory items or currency, adjust the pilot and test results. Exit testing to return to your saved profile. The code is a client-side shortcut for this offline game.

## Source

| File | Role |
| --- | --- |
| `index.html`, `css/style.css` | Flight deck, HUD, menus and responsive layout |
| `js/data.js` | Ship, enemy, boost and supply data, difficulty curve and profile defaults |
| `js/game.js` | Simulation, wave progression, combat, XP and purchases |
| `js/flight-view.js` | Canvas rendering, optional sprites, effects and synthesized audio |
| `js/admin.js` | Local test panel and scenario setup |
| `js/main.js` | Controls, menu wiring, notifications and frame loop |
| `icons/` | Optional art overrides and installed interface icons |
| `JOURNAL.md` | Original project history and current handover |
