# Alien Shooter

A browser-based shooter with 50 campaign waves, returning boss fleets, unlockable ships and custom loadouts. Open `index.html` directly or play the GitHub Pages build.

## Flight

- Move with **A/D**, the left and right arrows, or a held drag. The ship fires automatically. Fit a **Vector Engine** to unlock vertical movement.
- Open **Inventory** with **I** or the on-screen button. It holds ships, upgrades, boosts and crates. Use a boost during flight or outfit your ship at any time. Credits, Star Gems, parts and other loot are collected by flying close to the floating icons.
- The boss ladder adds a new boss on waves 10, 20, 30, 40 and 50. Each boss wave includes the previous bosses. Boss waves cannot be skipped.
- Use **P** or **Esc** to pause. At pilot level 5, you can buy flight supplies during intermission.

## Shop and outfitting

- Spend Credits on ships. Spend Star Gems on Spaceship or Upgrade Crates. The Shop shows the outcome odds and duplicate rules before purchase. Purchased crates go into Inventory unless the Shop's immediate-open switch is on.
- Equip an owned ship and choose **Outfit ship**. Drag an upgrade onto a matching mount, or select the part and then the mount. Ships have one to three engine mounts. Each fitted mount on a ship consumes one available copy. The special slot is reserved for a future ability.
- Your ships, inventory, loadouts, currency and records save in this browser.

## Local testing

Open **Admin** and enter `ADMIN99` once per tab session. Admin waves go up to **2,147,483,647**. Higher input is capped at that value. High-wave spawns scale within fixed limits to keep the browser responsive. **Clear all testing data** resets the isolated test inventory, currency and run after confirmation. **Exit testing** restores the normal game.

## Source

| File | Role |
| --- | --- |
| `js/data.js` | Content, rarities, crate tables and wave scaling |
| `js/game.js` | Simulation, combat, rewards and persistence |
| `js/flight-view.js` | Ship and boss art, canvas effects and audio |
| `js/armory.js` | Shop, inventory and ship outfitting |
| `js/admin.js` | Test scenarios and isolated reset |
| `js/main.js` | Controls, menus, loot notifications and frame loop |
