# Alien Shooter

A browser-based alien shooter with 50 escalating waves, Mothership bosses, pilot upgrades and unlockable ships.

## Play

Open `index.html` in a browser. The game runs directly from disk with no installation, server or build step.

- Move with **WASD**, **arrow keys**, or a **held mouse or touch drag**. The ship fires automatically.
- Press **P** or **Esc** to pause. Use **Enter** or the on-screen buttons to start.
- Every tenth wave is a Mothership fight. Defeat the final Mothership and any remaining enemies to win.
- **Skip Wave** advances to the next wave while enemies and projectiles already on the field stay live. **Auto Skip** waits until 60% has spawned. Boss waves must be cleared.
- Earn XP through kills and cleared waves. At **pilot level 5**, spend run Credits on supplies during intermissions.
- Defeat bosses to earn Star Gems. Unlock and equip the Falcon in the Hangar. Gems, unlocks, equipped ship, records and preferences are saved in the current browser when local storage is available.

## Source

| File | Role |
| --- | --- |
| `index.html`, `css/style.css` | Flight deck, HUD, menus and responsive layout |
| `js/data.js` | Ship, enemy, boost and supply data, difficulty curve and profile defaults |
| `js/game.js` | Simulation, wave progression, combat, XP and purchases |
| `js/flight-view.js` | Canvas rendering, optional sprites, effects and synthesized audio |
| `js/main.js` | Controls, menu wiring, notifications and frame loop |
| `icons/` | Optional art overrides and installed interface icons |
| `JOURNAL.md` | Original project history and current handover |
