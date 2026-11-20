# Icon pack folder

Drop your purchased icon-pack assets here. Nothing in the game requires them —
every object has procedural placeholder art that is used automatically when a
file is missing. Adding a file with the exact name below swaps the art in with
zero code changes.

## Expected files

| Path | Used for |
| --- | --- |
| `spaceships/scout.png` | The playable Scout ship |
| `spaceships/falcon.png` | A future second ship (shop preview) |
| `enemies/grunt.png` | Basic invader |
| `enemies/diver.png` | Fast weaving enemy |
| `enemies/shooter.png` | Enemy that fires |
| `enemies/tank.png` | Armoured enemy |
| `enemies/boss.png` | Mothership on every 10th wave |
| `currency/credit.png` | Credits in HUD and shop |
| `currency/gem.png` | Reserved for a premium currency |
| `boosts/heal.png` | Repair pickup |
| `boosts/rapid-fire.png` | Rapid-fire pickup |
| `boosts/double-damage.png` | Double-damage pickup |
| `boosts/shield.png` | Shield pickup |
| `shop/locked.png` | Reserved for locked shop slots |
| `ui/heart.png` | Reserved for HUD hearts |

PNG with transparency works best. Any size is fine — the game draws each icon
into the entity's rectangle.

## Wiring in a different filename

Icon keys are declared once in `js/data.js` under `AG.ICON_MANIFEST`:

```js
'boosts.shield': 'icons/boosts/shield.png'
```

Change the path there and every place that uses the key (`entities.js`, HUD,
shop) picks it up. To register a brand-new icon, add one manifest entry and
reference its key from the relevant registry in `data.js`.
