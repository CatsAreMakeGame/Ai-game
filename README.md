# Alien Shooter

A browser-based shooter with four flight modes, returning boss fleets, unlockable ships, crafting and custom loadouts. Open `index.html` directly or play the GitHub Pages build.

## Flight

- Move with **A/D**, the left and right arrows, or a held drag. The ship fires automatically. Fit a **Vector Engine** to unlock vertical movement.
- Open **Inventory** between runs. Drag boosts into its three flight slots, then click a slot during flight to use its boost. Extra slots unlock at pilot levels 5 and 10. Reach those levels once to assign boosts between runs. Credits, Star Gems, parts and other loot are collected by flying close to the floating icons.
- Equip a **Loot Magnet** to pull drops toward your ship. Right-click an equipped **Auto Boost** in Ship Loadout to open Available Boosts and Loaded Boosts. It starts on each run and can be switched off with the **Auto** button or your Equipment keybind. Fit a **Smoke Bomb** in an engine slot for a damaging two-second trail.
- The boss ladder adds a new boss on waves 10, 20, 30, 40 and 50. Each boss wave includes the previous bosses. Boss waves cannot be skipped.
- Use **P** or **Esc** to pause. At pilot level 5, you can buy flight supplies during intermission.

## Missions and crafting

- Easy ends at wave 20, Medium at 30, Hard at 50, and Endless continues after the wave-50 boss. Continue resumes from the last cleared wave in the same browser.
- The Alien Event ends at midnight at the start of 1 December 2026 in Melbourne. Afterward, repeatable boss bounties supply Alien Cells, Alien Minds and Alien Serum for permanent recipes.
- Craft an Alien Ship with an owned ship in the centre, Alien Serum above it, an Alien Mind below it, and six Alien Cells in the other slots. Craft an Alien Mind with Alien Serum in the centre and eight Alien Cells around it.
- Alien Ships extend and retract tendrils with **E** and **Q**. The Lightning Beacon uses **F** or right-click. Change the keys in Settings. Select Alien Serum under Inventory → Items → Event and choose **Use on equipped Alien Ship** to unlock mind control permanently.
- The Premium Store accepts Star Gems, including a one-way exchange for 250 Credits per gem. Supernova can be purchased again after an hour, at double the previous price.

## Shop and Ship Loadout

- Spend Credits on ships. Spend Star Gems on Spaceship or Upgrade Crates. Hover over a crate to see each possible item and its odds. Crate duplicates add copies, and the opening screen displays batch quantities for every reward. Credit Shop ships are purchasable only while you own zero copies. Purchased crates go into Inventory.
- Open **Ship Loadout** and choose a ship. Drag upgrades onto compatible slots, or select a part and then its slot. Ships with two engines have left and right engine slots. Save an arrangement into a preset to apply its compatible parts to another ship.
- The Merchant is the only gameplay source for Auto Boost, Heat-Seeking Missile, Vector Engine and Loot Magnet. It stocks two every five minutes.
- Your ships, inventory, loadouts, currency and records save in this browser.

## Local testing

Open **Admin** and enter `ADMIN99` once per tab session. **Wave controls** can run the entire game from **0.25× to 10×** during testing. Admin waves go up to **2,147,483,647**. Higher input is capped at that value. High-wave spawns scale within fixed limits to keep the browser responsive. **Clear all testing data** resets the isolated test inventory, currency and run after confirmation. **Exit testing** restores the normal game.

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
