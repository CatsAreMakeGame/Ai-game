# Alien Shooter

A browser-based shooter with four flight modes, returning boss fleets, unlockable ships, crafting and custom loadouts. Open `index.html` directly or play the GitHub Pages build.

## Flight

- Move with **A/D**, the left and right arrows, or a held drag. The ship fires automatically. Fit a **Vector Engine** to unlock vertical movement.
- Open **Inventory** between runs. Drag boosts into its three flight slots, then click a slot during flight to use its boost. Extra slots unlock at pilot levels 5 and 10. Reach those levels once to assign boosts between runs. Loot pauses for one second and then accelerates toward your ship.
- Equip a **Loot Magnet** to pull drops toward your ship faster. Right-click an equipped **Boost Cycle** in Ship Loadout to configure it. It starts off and can be enabled during flight with the **Auto** button or your Equipment keybind. It holds up to 15 of each of three boost types and activates one every two seconds when eligible. Fit a **Smoke Bomb** in an engine slot for a five-second trail that damages enemies every half second.
- The boss ladder adds a new boss on waves 10, 20, 30, 40 and 50. Each boss wave includes the previous bosses. Boss waves cannot be skipped. Every five clears earn a boost. Every ten clears also earn Credits, Star Gems, an upgrade and an Alien Event item while the event is active. You'll receive these milestone rewards together when the run ends. Flight boost drops activate immediately.
- Pilot level and XP save across runs. Use the top arrow to reduce the flight HUD to wave and health. Use **P** or **Esc** to pause. Continuing a saved run keeps its launch loadout. Equipment changes apply to new runs. At pilot level 5, you can buy flight supplies during intermission.

## Missions and crafting

- Easy ends at wave 20, Medium at 30, Hard at 50, and Endless continues after the wave-50 boss. Continue resumes from the last cleared wave in the same browser.
- The Alien Event ends at midnight at the start of 1 December 2026 in Melbourne. Afterward, repeatable boss bounties supply Alien Cells, Alien Minds and Alien Mind Serum for permanent recipes.
- Craft an Alien Ship with an owned ship in the centre, Alien Mind Serum above it, an Alien Mind below it, and six Alien Cells in the other slots. Craft an Alien Mind with nine Alien Cells. To make Alien Mind Serum, surround an Alien Mind with eight Alien Cells. At pilot level 10, **Fill recipe** places available ingredients and marks missing ones in red. Recipes appear under Event Recipes after the event ends.
- All ships recover 0.5 energy per second and gain 1 per enemy destroyed until full. An eligible ship enters Overdrive automatically at full energy. It drains 1% of capacity every quarter second and suspends energy gain until it ends. Alien variants inherit the original ship’s energy capacity. Alien Ships extend and retract wall-anchored tendrils with **E** and **Q**. Extending costs 30 energy, and each anchor draws 1 per second. Captured enemies are held for four seconds and award 1 energy after two seconds. The Lightning Beacon uses **F** or right-click. It pulses every 0.1 seconds for normal shot damage divided by 2.75. Change the keys in Settings. To give an Alien Ship Mind Control, add that ship, an Alien Mind Serum and an Alien Mind to any three slots of the crafting grid. Press Q to release one controlled ship or retract a tendril.
- Supernova is sold for Star Gems in Shop → Premium Shop. It can be purchased again after an hour, at double the previous price.

## Rewards

Campaign wins grant guaranteed credits, gems, crates, upgrades and repair boosts. Endless bonus rewards scale every tenth wave cleared, with Spaceship Crates every fiftieth wave. Rewards shows your most recent completed run's payout. Milestone rewards settle when you finish or quit.

## Loot crates

Spaceship Crates have a 1% chance to contain Singularity.

Smoke Ninja can appear from wave 30, with a 10% chance per campaign wave or 3% per Endless wave. It drops a Smoke Bomb upgrade 60% of the time and a crate 45% of the time. Its purple smoke lasts ten seconds and deals two damage per half second within the cloud.

The lead bosses at waves 10, 20, 30, 40 and 50 have a 20%, 30%, 40%, 50% and 60% chance to drop one crate, respectively. In Endless, later lead bosses stay at 60%. Escorts have no crate chance. A regular enemy has a 0.05% chance. When a crate drops, it is a Spaceship Crate 25% of the time and an Upgrade Crate 75% of the time.

## Shop and Ship Loadout

- Spend Credits on ships. Spend Star Gems on Spaceship or Upgrade Crates. Hover over a crate to see each possible item and its odds. Crate duplicates add copies, and the opening screen displays batch quantities for every reward. Credit Shop ships are purchasable only while you own zero copies. Purchased crates go into Inventory.
- Open **Ship Loadout** and choose a ship. Drag upgrades onto compatible slots, or select a part and then its slot. Ships with two engines have left and right engine slots. Save an arrangement into a preset to apply its compatible parts to another ship.
- The Merchant is the only gameplay source for Boost Cycle, Heat-Seeking Missile, Vector Engine and Loot Magnet. It stocks one copy each of two upgrades every five minutes.
- Your ships, inventory, loadouts, currency and records save in this browser.

## Local testing

Open **Admin** and enter `ADMIN99` once per tab session. **Ship energy** accepts test values above the ship's normal capacity, such as 5,000%. **Test clock** can skip ahead for the Alien Event, Supernova availability and Merchant restocks. **Wave controls** can run the entire game from **0.25× to 10×** during testing. Admin wave jumps past the selected campaign’s limit enable a test override up to **2,147,483,647**. Regular campaign tests stop at the chosen mode’s final wave. Higher input is capped at that value. High-wave spawns scale within fixed limits to keep the browser responsive. **Clear all testing data** resets the isolated test inventory, currency and run after confirmation. **Exit testing** restores the normal game.

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
