(() => {
  'use strict';

  const AG = window.AG;
  const { ITEMS, SHIPS, UPGRADES, BOOSTS, CRATES, SLOTS, RARITIES } = AG;

  function graphic(id) {
    const item = ITEMS[id];
    if (SHIPS[id]) return AG.shipGraphic(id);
    const badge = document.createElement('span');
    badge.className = 'item-icon';
    badge.style.setProperty('--rarity', RARITIES[item.rarity ?? 'common']);
    badge.setAttribute('aria-hidden', 'true');
    if (item.icon || ['credit', 'gem'].includes(id)) {
      const image = document.createElement('img');
      image.src = item.icon ?? item.file;
      image.alt = '';
      image.addEventListener('error', () => { badge.textContent = item.glyph; }, { once: true });
      badge.append(image);
    } else {
      badge.textContent = item.glyph;
    }
    return badge;
  }

  function sortItems(catalog, strength) {
    const ranks = Object.keys(RARITIES);
    return Object.keys(catalog).sort((a, b) =>
      ranks.indexOf(catalog[b].rarity ?? 'common') - ranks.indexOf(catalog[a].rarity ?? 'common') ||
      strength(catalog[b]) - strength(catalog[a]) || catalog[a].name.localeCompare(catalog[b].name));
  }

  function crateOdds(crate) {
    return crate.outcomes.map(({ rarity, weight, items }) =>
      weight + '% ' + rarity + ' (' + items.map(id => ITEMS[id].name).join(', ') + ')').join(' · ');
  }

  function revealCrate(crateId, batch, element, button) {
    const { count, featured: result, sideItems } = batch;
    const crate = CRATES[crateId];
    const item = ITEMS[result.rolled];
    const dialog = element('dialog', '', 'crate-reveal');
    const title = element('h2', crate.name + (count > 1 ? ' ×' + count.toLocaleString() : ''));
    title.id = 'crate-reveal-title';
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.style.setProperty('--reward', RARITIES[item.rarity ?? 'common']);
    const viewport = element('div', '', 'reel-window');
    viewport.setAttribute('aria-hidden', 'true');
    const track = element('div', '', 'reel-track');
    const marker = element('div', '', 'reel-marker');
    const stopAt = 16;
    let winner;
    for (let index = 0; index < stopAt + 4; index++) {
      const winning = index === stopAt;
      const id = winning ? result.rolled : AG.crateRoll(crate).id;
      const spec = ITEMS[id];
      const tile = element('div', '', 'reel-tile');
      tile.style.setProperty('--rarity', RARITIES[spec.rarity ?? 'common']);
      tile.append(graphic(id), element('span', spec.name));
      track.append(tile);
      if (winning) winner = tile;
    }
    viewport.append(track, marker);
    const message = element('p', 'Opening crate…', 'reel-result');
    message.setAttribute('role', 'status');
    const centered = tile => 'translateX(' + (viewport.clientWidth / 2 - tile.offsetLeft - tile.offsetWidth / 2) + 'px)';
    let animation;
    let revealed = false;
    function showReward() {
      if (revealed || !dialog.open) return;
      revealed = true;
      animation?.cancel();
      track.style.transform = centered(winner);
      winner.classList.add('reel-winner');
      dialog.classList.add('reel-revealed');
      message.textContent = result.text;
      next.textContent = 'Done';
    }
    const next = button('Skip animation', () => {
      if (revealed) dialog.close();
      else showReward();
    }, { primary: true });
    dialog.append(title, viewport, message, next);
    if (sideItems.length) {
      const summary = element('section', '', 'reel-other');
      summary.append(element('h3', 'Other rewards'));
      const items = element('ul', '', 'reel-rewards');
      for (const reward of sideItems) {
        const spec = ITEMS[reward.type];
        const tile = element('li', '', 'reel-reward-tile');
        tile.style.setProperty('--rarity', RARITIES[spec.rarity ?? 'common']);
        tile.title = reward.text;
        tile.append(graphic(reward.type), element('span', (reward.amount > 1 ? reward.amount + ' ' : '') + spec.name));
        items.append(tile);
      }
      summary.append(items);
      dialog.append(summary);
    } else if (count > 10) {
      dialog.append(element('p', 'Rarest reward shown. All ' + count.toLocaleString() + ' results are awarded.', 'reel-batch-note'));
    }
    if (batch.stored) dialog.append(element('p', batch.stored.toLocaleString() + ' saved in Inventory.', 'reel-batch-note'));
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      animation?.cancel();
      dialog.remove();
    }, { once: true });
    dialog.showModal();
    const end = centered(winner);
    track.style.transform = end;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !track.animate) {
      showReward();
      return;
    }
    animation = track.animate([{ transform: centered(track.children[3]) }, { transform: end }],
      { duration: 4600, easing: 'cubic-bezier(.23,.66,.24,1)' });
    animation.addEventListener('finish', showReward, { once: true });
  }

  function renderCraft({ game, state, element, button, body, refresh }) {
    const available = id => SHIPS[id] ? game.shipCount(id) : (game.profile.materials[id] ?? 0);
    const choices = [...game.profile.unlocked, 'alienCell', 'alienMind', 'alienSerum', 'craftingSerum'].filter(available);
    const grid = element('div', '', 'craft-grid');
    const ingredients = element('div', '', 'ingredient-bank');
    function place(index, id) {
      const occupied = state.grid.filter((ingredient, position) => ingredient === id && position !== index).length;
      if (id && (!choices.includes(id) || occupied >= available(id))) return;
      state.grid[index] = id;
      if (id && occupied + 1 === available(id)) state.ingredient = '';
      refresh();
    }
    state.grid.forEach((id, index) => {
      const tile = button('', () => place(index, state.ingredient));
      if (id && ITEMS[id]) tile.append(graphic(id));
      else tile.textContent = index === 4 ? 'Centre' : index === 7 ? 'Below centre' : '＋';
      tile.setAttribute('aria-label', 'Slot ' + (index + 1) + ' · ' + (ITEMS[id]?.name ?? 'empty'));
      tile.addEventListener('dragover', event => event.preventDefault());
      tile.addEventListener('drop', event => { event.preventDefault(); place(index, event.dataTransfer.getData('text/plain')); });
      grid.append(tile);
    });
    for (const id of choices) {
      const remaining = available(id) - state.grid.filter(item => item === id).length;
      const option = button('', () => { state.ingredient = state.ingredient === id ? '' : id; refresh(); }, { disabled: remaining <= 0 });
      option.setAttribute('aria-pressed', String(state.ingredient === id));
      option.append(graphic(id), element('span', ITEMS[id].name), element('b', '×' + remaining));
      option.draggable = remaining > 0;
      option.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', id));
      ingredients.append(option);
    }
    const layout = element('div', '', 'craft-layout');
    layout.append(grid, ingredients);
    const recipe = game.recipe(state.grid);
    const label = recipe === 'ship' ? 'Consume ' + ITEMS[state.grid[4]].name + ' and craft Alien Ship' :
      recipe === 'brain' ? 'Craft Alien Brain' : 'Craft';
    const actions = element('div', '', 'home-actions');
    actions.append(button(label, () => {
      const id = game.craft(state.grid);
      if (id) { state.grid.fill(''); state.ingredient = ''; }
      state.result = id ? ITEMS[id].name + ' added to Inventory.' : 'Check the ingredients in the grid.';
      refresh();
    }, { primary: true, disabled: !recipe }), button('Clear grid', () => {
      state.grid.fill(''); state.ingredient = ''; refresh();
    }));
    body.append(element('p', 'Alien Ship · Ship in the centre, Alien Mind below, seven Alien Cells around them. Alien Brain · Serum in the centre, eight Alien Cells around it.', 'panel-note'),
      element('p', 'Drag ingredients or select one and tap a slot. Tap a filled slot with no ingredient selected to remove it.', 'panel-note'),
      layout, actions, element('p', AG.eventActive() ? 'Alien materials drop during the event.' :
        'Boss bounties drop Alien Cells. Lead bosses also drop Alien Mind. Nexus Overlord drops Crafting Serum.', 'panel-note'));
  }

  function renderArmory({ kind, state, game, body, button, element, open, dismiss, refresh, practice }) {
    const profile = game.profile;
    const base = game.canVisitBase();
    const cards = element('div', '', 'cards armory-cards');

    function card(id, text, action, count = 0) {
      const item = ITEMS[id];
      const row = element('div', '', 'card item-card');
      const copy = element('div');
      const header = element('strong', item.name + (count ? ' ×' + count : ''));
      const rarity = element('span', item.rarity ?? 'common', 'item-rarity');
      rarity.style.color = RARITIES[item.rarity ?? 'common'];
      copy.append(header, rarity, element('small', text));
      if (item.donor) row.title = 'Donor ship · ' + item.donor;
      row.append(graphic(id), copy);
      if (action) row.append(action);
      cards.append(row);
    }

    function footer(...actions) {
      const row = element('div', '', 'home-actions');
      row.append(...actions, button('Back', dismiss));
      body.append(row);
    }

    if (kind === 'shop') {
      const options = element('div', '', 'inventory-tabs');
      for (const [id, name] of [['ships', 'Credit ships'], ['crates', 'Star Gem crates'], ['flagship', 'Premium Store']]) {
        const tab = button(name, () => { state.shopTab = id; refresh(); });
        tab.setAttribute('aria-pressed', String(state.shopTab === id));
        options.append(tab);
      }
      body.append(options, element('p', game.credits.toLocaleString() + ' Credits · ' + profile.gems + ' Star Gems', 'panel-note'));
      if (state.shopTab === 'ships') {
        for (const id of Object.keys(AG.BASE_SHIPS).filter(id => Number.isFinite(SHIPS[id].price)).sort((a, b) => SHIPS[a].price - SHIPS[b].price)) {
          const ship = SHIPS[id];
          if (!ship.price && game.shipCount(id)) continue;
          const owned = profile.unlocked.includes(id);
          card(id, ship.description, button(owned ? 'Owned' : ship.price ? ship.price.toLocaleString() + ' Credits' : 'Reclaim Scout', () => {
            game.unlockShip(id);
            refresh();
          }, { disabled: !game.canUnlockShip(id) }));
        }
      } else if (state.shopTab === 'flagship') {
        const ship = SHIPS.supernova;
        const ability = ship.ability;
        const featured = element('article', '', 'flagship');
        const visual = element('div', '', 'flagship-visual');
        visual.append(graphic('supernova'));
        const details = element('div', '', 'flagship-details');
        const stats = element('dl', '', 'flagship-stats');
        for (const [label, value] of [['Hull', ship.hull], ['Speed', ship.speed], ['Shot damage', ship.damage],
          ['Shot interval', ship.delay + 's'], ['Engine mounts', ship.engines]]) {
          const stat = element('div');
          stat.append(element('dt', label), element('dd', String(value)));
          stats.append(stat);
        }
        const price = game.flagshipPrice('supernova');
        const savings = element('progress');
        savings.max = Number.isSafeInteger(price) ? price : 100;
        savings.value = Math.min(profile.gems, savings.max);
        savings.setAttribute('aria-label', 'Star Gems saved toward next Supernova');
        const buy = button('Buy for ' + (Number.isSafeInteger(price) ? price.toLocaleString() + ' Star Gems' : 'maximum price'), () => {
          if (game.unlockFlagship('supernova')) state.result = 'Supernova acquired. Equip it in the Hangar.';
          refresh();
        }, { primary: true, disabled: !game.canUnlockFlagship('supernova') });
        const wait = element('p');
        const status = () => {
          const seconds = Math.ceil(game.flagshipWait() / 1000);
          wait.textContent = seconds ? 'Next purchase in ' + Math.floor(seconds / 60) + 'm ' + seconds % 60 + 's' : 'Purchase cooldown ready';
          buy.disabled = !game.canUnlockFlagship('supernova');
          return seconds;
        };
        if (status()) {
          const timer = setInterval(() => {
            if (!wait.isConnected || !status()) clearInterval(timer);
          }, 1000);
        }
        details.append(element('span', 'Flagship Store · Godly', 'flagship-rarity'), element('h3', ship.name), stats,
          element('h4', ability.name), element('p', 'Reduces the next hit by ' + Math.round(ability.reduction * 100) + '%. Recharges in ' + ability.interval + ' seconds.'),
          element('p', 'Owned ×' + game.shipCount('supernova') + ' · ' + profile.gems.toLocaleString() + ' Star Gems saved'),
          savings, wait, buy);
        featured.append(visual, details);
        const exchange = element('section', '', 'store-exchange');
        const quantity = element('input');
        quantity.type = 'number';
        quantity.min = '1';
        quantity.max = String(profile.gems);
        quantity.value = '1';
        quantity.setAttribute('aria-label', 'Star Gems to exchange');
        const convert = button('Exchange', () => {
          if (game.exchangeGems(quantity.valueAsNumber)) state.result = 'Exchange complete.';
          refresh();
        });
        function quote() {
          const count = quantity.valueAsNumber;
          const credits = count * AG.EXCHANGE_RATE;
          convert.disabled = !Number.isSafeInteger(count) || count < 1 || count > profile.gems || !Number.isSafeInteger(profile.credits + credits);
          convert.textContent = convert.disabled ? 'Exchange' : 'Receive ' + credits.toLocaleString() + ' Credits';
        }
        quantity.addEventListener('input', quote);
        quote();
        exchange.append(element('h3', 'Currency exchange'), element('p', '1 Star Gem → ' + AG.EXCHANGE_RATE + ' Credits'), quantity, convert);
        body.append(featured, exchange);
      } else {
        const label = element('label', '', 'crate-switch');
        const toggle = element('input');
        toggle.type = 'checkbox';
        toggle.checked = state.autoOpen;
        toggle.addEventListener('change', () => { state.autoOpen = toggle.checked; });
        label.append(toggle, element('span', 'Open up to ' + game.crateBatchLimit().toLocaleString() + ' crates immediately. Store any extras.'));
        body.append(label);
        for (const [id, crate] of Object.entries(CRATES)) {
          const limit = game.cratePurchaseLimit(id);
          const controls = element('div', '', 'crate-batch-controls');
          const quantity = element('input');
          quantity.type = 'number';
          quantity.min = '1';
          quantity.max = String(limit);
          quantity.step = '1';
          quantity.value = '1';
          quantity.disabled = limit < 1;
          quantity.setAttribute('aria-label', crate.name + ' purchase quantity');
          const buy = button('Buy', () => {
            const result = game.buyCrates(id, quantity.valueAsNumber, state.autoOpen);
            if (!result) return;
            state.result = result.stored ? result.stored.toLocaleString() + ' crates saved in Inventory.' : '';
            refresh();
            if (result.batch) revealCrate(id, { ...result.batch, stored: result.stored }, element, button);
          }, { disabled: limit < 1 });
          function updateTotal() {
            const count = quantity.valueAsNumber;
            const valid = Number.isSafeInteger(count) && count >= 1 && count <= limit;
            buy.disabled = !valid;
            if (limit < 1) buy.textContent = 'Need ' + crate.price + ' Star Gems';
            else if (valid) buy.textContent = 'Buy · ' + (count * crate.price).toLocaleString() + ' Star Gems';
            else buy.textContent = 'Choose 1–' + limit.toLocaleString();
          }
          quantity.addEventListener('input', updateTotal);
          updateTotal();
          controls.append(quantity, buy);
          card(id, crate.price + ' Star Gems each · ' + crateOdds(crate), controls);
        }
        body.append(element('p', 'Duplicate ships convert to 250 Credits. Upgrade copies can fill multiple mounts.', 'panel-note'));
      }
      body.append(cards);
      footer(button('Inventory', () => open('inventory')), button('Hangar', () => open('hangar')));
    } else if (kind === 'inventory' || kind === 'hangar') {
      const inventory = kind === 'inventory';
      const tab = inventory ? state.inventoryTab : 'ships';
      if (inventory) {
        const tabs = element('div', '', 'inventory-tabs');
        for (const [id, label] of [['ships', 'Spaceships'], ['upgrades', 'Upgrades'], ['boosts', 'Boosts'], ['items', 'Items'], ['crates', 'Crates']]) {
          const control = button(label, () => { state.inventoryTab = id; refresh(); });
          control.setAttribute('aria-pressed', String(tab === id));
          tabs.append(control);
        }
        body.append(tabs);
      }
      if (tab === 'ships') {
        for (const id of sortItems(SHIPS, ship => ship.hull + ship.speed + 50 * ship.damage)) {
          if (!profile.unlocked.includes(id)) continue;
          const equipped = profile.ship === id;
          const ship = SHIPS[id];
          const info = ship.description + (ship.ability ? ' · ' + ship.ability.name : '');
          card(id, info, button(equipped ? 'Equipped' : 'Equip', () => {
            game.equip(id); refresh();
          }, { disabled: equipped || !base }), game.shipCount(id) > 1 ? game.shipCount(id) : 0);
        }
      } else if (tab === 'upgrades') {
        for (const id of sortItems(UPGRADES, part => (part.damage ?? part.speed ?? 0))) {
          if (!profile.upgrades[id]) continue;
          const outfit = button('Outfit ship', () => {
            state.selectedUpgrade = id;
            open('outfit', { part: id, ship: base ? profile.ship : game.run.shipId });
          });
          if (state.selectedUpgrade === id) outfit.setAttribute('aria-pressed', 'true');
          card(id, UPGRADES[id].description, outfit, profile.upgrades[id]);
        }
      } else if (tab === 'boosts') {
        const settings = element('div', '', 'settings-grid');
        for (let index = 0; index < 2; index++) {
          const label = element('label', 'Quick boost ' + (index + 1));
          const select = element('select');
          for (const [id, name] of [['', 'None'], ...Object.entries(BOOSTS).map(([id, boost]) => [id, boost.name])]) {
            const option = element('option', name);
            option.value = id;
            select.append(option);
          }
          select.value = profile.favoriteBoosts[index];
          select.addEventListener('change', () => { profile.favoriteBoosts[index] = select.value; game.save(); });
          label.append(select);
          settings.append(label);
        }
        body.append(settings);
        for (const id of sortItems(BOOSTS, boost => boost.repair ?? boost.duration)) {
          if (!profile.boosts[id]) continue;
          card(id, BOOSTS[id].description, button('Use', () => {
            game.useBoost(id); refresh();
          }, { disabled: !game.canUseBoost(id) }), profile.boosts[id]);
        }
      } else if (tab === 'items') {
        for (const id of sortItems(AG.MATERIALS, () => 0)) {
          if (!profile.materials[id]) continue;
          const action = id === 'alienSerum' && button(profile.serumUsed ? 'Mind control unlocked' : 'Apply to equipped Alien Ship', () => {
            if (game.applySerum()) state.result = 'Mind control unlocked permanently.';
            refresh();
          }, { disabled: !base || !SHIPS[profile.ship].alien || profile.serumUsed });
          card(id, ITEMS[id].description, action, profile.materials[id]);
        }
      } else {
        for (const id of sortItems(CRATES, crate => crate.price)) {
          if (!profile.crates[id]) continue;
          const count = profile.crates[id];
          const limit = Math.min(count, game.crateBatchLimit());
          function openBatch(quantity) {
            const batch = game.openCrates(id, quantity);
            if (!batch) {
              state.result = 'Enter a whole number from 1 to ' + limit.toLocaleString() + ' within your inventory limits.';
              refresh();
              return;
            }
            state.result = '';
            refresh();
            revealCrate(id, batch, element, button);
          }

          const controls = element('div', '', 'crate-batch-controls');
          if (game.testing) {
            const quantity = element('input');
            quantity.type = 'number';
            quantity.min = '1';
            quantity.max = String(limit);
            quantity.step = '1';
            quantity.value = '1';
            quantity.setAttribute('aria-label', CRATES[id].name + ' quantity');
            controls.append(quantity, button('Open', () => openBatch(quantity.valueAsNumber), { primary: true }));
          } else {
            controls.append(button('Open 1', () => openBatch(1)));
            if (limit > 1) controls.append(button('Open ' + limit, () => openBatch(limit), { primary: true }));
          }
          card(id, crateOdds(CRATES[id]), controls, count);
        }
      }
      if (!cards.children.length) cards.append(element('p', 'No ' + tab + ' collected yet.', 'panel-note'));
      body.append(cards);
      const options = [button('Outfit ship', () => open('outfit'))];
      if (base) options.push(button('Shop', () => open('shop')), button('Crafting', () => open('craft')));
      if (!inventory && base) {
        const range = element('section', '', 'practice-range');
        range.append(element('h3', 'Practice range'), ...[['boss', 'Boss dummy'], ['moving', 'Moving target'], ['cluster', 'Grunt cluster']].map(([id, label]) => button(label, () => practice(id))));
        body.append(range);
      }
      footer(...options);
    } else if (kind === 'craft') {
      renderCraft({ game, state, element, button, body, refresh });
      footer(button('Inventory', () => open('inventory', { inventoryTab: 'items' })));
    } else {
      const ship = base ? (profile.unlocked.includes(state.ship) ? state.ship : profile.ship) : game.run.shipId;
      const crafts = profile.loadouts[ship] ?? {};
      const layout = element('div', '', 'outfit-layout');
      const diagram = element('div', '', 'ship-diagram');
      const art = graphic(ship);
      art.classList.add('diagram-art');
      diagram.append(art);
      const parts = element('div', '', 'outfit-parts');
      function place(slot, id) {
        if (!id) return;
        const ok = game.mountUpgrade(ship, slot, id);
        state.result = ok ? ITEMS[id].name + ' fitted.' : 'Choose a matching mount and an available copy.';
        if (ok) state.part = '';
        refresh();
      }
      const spec = SHIPS[ship];
      const preview = element('p', '', 'outfit-summary');
      preview.setAttribute('aria-live', 'polite');
      const current = game.upgradeEffects(ship);
      const describe = effects => {
        const speed = Math.round(spec.speed * effects.speed);
        const vertical = Math.round(spec.speed * effects.speed * (1 + (effects.vectors - 1) * .2));
        return speed + ' speed · ' + (effects.vertical ? vertical + ' vertical speed' : 'Horizontal steering') +
          ' · ' + Number((spec.damage + effects.damage).toFixed(3)) + ' damage' +
          (effects.missile ? ' · ' + (effects.missile === 'homing' ? 'Heat-Seeking Missile' : 'Blast Missile') : '') +
          (effects.laser ? ' · Lightning Beacon' : '');
      };
      preview.textContent = describe(current);
      const indicators = [];
      for (const [slot, [type, name]] of Object.entries(SLOTS)) {
        const mounted = crafts[slot];
        const locked = type === 'Engine' && +slot.slice(-1) > SHIPS[ship].engines;
        const mount = button(name, () => {
          if (state.part) place(slot, state.part);
          else if (mounted) {
            game.mountUpgrade(ship, slot, null);
            state.result = ITEMS[mounted].name + ' removed.';
            refresh();
          }
        }, { disabled: locked });
        mount.className = 'mount mount-' + slot;
        function compatible() {
          const otherCopies = Object.entries(crafts).filter(([key, id]) => key !== slot && id === state.part).length;
          return !locked && UPGRADES[state.part]?.slot === type && otherCopies < (profile.upgrades[state.part] ?? 0);
        }
        function predict() {
          if (compatible()) preview.textContent = name + ' · ' + describe(current) + ' → ' +
            describe(game.upgradeEffects(ship, { ...crafts, [slot]: state.part }));
        }
        const highlight = () => mount.classList.toggle('compatible', compatible());
        indicators.push(highlight);
        highlight();
        predict();
        mount.addEventListener('pointerenter', predict);
        mount.addEventListener('focus', predict);
        if (mounted) mount.append(graphic(mounted));
        mount.append(element('small', locked ? 'Unavailable' :
          mounted ? ITEMS[mounted].name : 'Empty'));
        if (!locked) {
          mount.addEventListener('dragover', event => { if (compatible()) { event.preventDefault(); predict(); } });
          mount.addEventListener('drop', event => { event.preventDefault(); place(slot, event.dataTransfer.getData('text/plain')); });
        }
        diagram.append(mount);
      }
      for (const id of sortItems(UPGRADES, item => item.speed ?? item.damage ?? 0)) {
        if (!profile.upgrades[id]) continue;
        const part = UPGRADES[id];
        const free = profile.upgrades[id] - Object.values(crafts).filter(value => value === id).length;
        const choose = button('', () => { state.part = state.part === id ? '' : id; state.selectedUpgrade = id; refresh(); });
        choose.append(graphic(id), element('span', part.name + ' · ' + free + ' free'));
        choose.style.setProperty('--rarity', RARITIES[part.rarity]);
        choose.title = part.slot + ' · ' + part.description;
        choose.draggable = true;
        choose.setAttribute('aria-pressed', String(state.part === id));
        choose.addEventListener('dragstart', event => {
          state.part = id;
          indicators.forEach(highlight => highlight());
          event.dataTransfer.setData('text/plain', id);
          event.dataTransfer.effectAllowed = 'copy';
        });
        parts.append(choose);
      }
      if (!parts.children.length) parts.append(element('p', 'Collect upgrades in flight or open an Upgrade Crate.', 'panel-note'));
      if (base) {
        const label = element('label', 'Ship to outfit ', 'outfit-select');
        const select = element('select');
        for (const id of profile.unlocked) {
          const option = element('option', SHIPS[id].name);
          option.value = id;
          select.append(option);
        }
        select.value = ship;
        select.addEventListener('change', () => { state.ship = select.value; refresh(); });
        label.append(select);
        body.append(label);
      }
      body.append(preview,
        element('p', 'Drag a part onto a matching mount, or select it and tap a mount. Select a fitted mount to remove the part.', 'panel-note'));
      layout.append(diagram, parts);
      body.append(layout);
      footer(button('Inventory', () => open('inventory')));
    }
    if (state.result) {
      const feedback = element('p', state.result, 'admin-status');
      feedback.setAttribute('role', 'status');
      body.prepend(feedback);
    }
  }
  Object.assign(AG, { renderArmory, itemGraphic: graphic });
})();
