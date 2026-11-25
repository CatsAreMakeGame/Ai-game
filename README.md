# Alien Shooter

A browser-based shooter with four flight modes, returning boss fleets, unlockable ships, crafting and custom loadouts. Open `index.html` directly or play the GitHub Pages build.

## Flight

- Move with **A/D**, the left and right arrows, or a held drag. The ship fires automatically. Fit a **Vector Engine** to unlock vertical movement.
- Open **Inventory** with **I** or the on-screen button. It holds spaceships, upgrades, boosts, items and crates. Use a boost during flight or outfit your ship at any time. Credits, Star Gems, parts and other loot are collected by flying close to the floating icons.
- The boss ladder adds a new boss on waves 10, 20, 30, 40 and 50. Each boss wave includes the previous bosses. Boss waves cannot be skipped.
- Use **P** or **Esc** to pause. At pilot level 5, you can buy flight supplies during intermission.

## Missions and crafting

- Easy ends at wave 20, Medium at 30, Hard at 50, and Endless continues after the wave-50 boss. Continue resumes from the last cleared wave in the same browser.
- The Hangar's Practice range lets you test a stationary boss, a moving target or a cluster. Practice does not award progression.
- The Alien Event ends at midnight at the start of 1 December 2026 in Melbourne. Afterward, repeatable boss bounties supply Alien Cells, Alien Minds and Crafting Serum for permanent recipes.
- Craft an Alien Ship with an owned ship in the centre, an Alien Mind below it, and seven Alien Cells in the other slots. Craft an Alien Brain with serum in the centre and eight Alien Cells around it.
- Alien Ships extend and retract tendrils with **E** and **Q**. The Lightning Beacon uses **F** or right-click. Change the keys in Settings. Apply Alien Mind Serum from Inventory while an Alien Ship is equipped to unlock mind control.
- The Premium Store accepts Star Gems, including a one-way exchange for 250 Credits per gem. Supernova can be purchased again after an hour, at double the previous price.

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
| `js/expansion.js` | Game modes, checkpoints, crafting, event drops, alien combat and practice |
| `js/flight-view.js` | Ship and boss art, canvas effects and audio |
| `js/armory.js` | Shop, inventory and ship outfitting |
| `js/admin.js` | Test scenarios and isolated reset |
| `js/main.js` | Controls, menus, loot notifications and frame loop |
