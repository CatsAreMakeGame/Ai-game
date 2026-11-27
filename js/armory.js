(() => {
  'use strict';

  const AG = window.AG;
  const { ITEMS, SHIPS, UPGRADES, BOOSTS, CRATES, SLOTS, RARITIES } = AG;

  const MENU_ICONS = {
    "ships": "Transport/Rocket/Rocket 256.png",
    "upgrades": "Tools/Wrench/Wrench 256.png",
    "boosts": "General/Lightning Bolt/Lightning Bolt Yellow 256.png",
    "items": "Player/Brain/Brain 256.png",
    "crates": "Items/Crate/Crate 256.png",
    "flagship": "Currency/Star Gem/Star Gem 256.png",
    "recipes": "Items/Book/Book 256.png",
    "keybinds": "Technology/Keyboard Key/Keyboard Key 256.png",
    "inventory": "Clothing/Backpack/Backpack 256.png",
    "shop": "General/Shopping Basket/Shopping Basket Green 256.png",
    "craft": "Tools/Hammer/Hammer 256.png",
    "settings": "General/Settings/Gear 256.png",
    "help": "UI/Question Mark/Question Mark 256.png",
    "admin": "General/Lock/Lock 256.png"
  };

  function menuIcon(control, id) {
    const img = document.createElement('img');
    img.className = 'menu-icon';
    img.src = 'new-icons/vector-icon-pack/' + MENU_ICONS[id];
    img.alt = '';
    control.prepend(img);
    return control;
  }

  function graphic(id, hover = true) {
    const item = ITEMS[id];
    if (SHIPS[id]) {
      const ship = AG.shipGraphic(id);
      if (hover) itemHover(ship, id);
      return ship;
    }
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
    if (hover) itemHover(badge, id);
    return badge;
  }

  function sortItems(catalog, strength) {
    const ranks = Object.keys(RARITIES);
    return Object.keys(catalog).sort((a, b) =>
      ranks.indexOf(catalog[b].rarity ?? 'common') - ranks.indexOf(catalog[a].rarity ?? 'common') ||
      strength(catalog[b]) - strength(catalog[a]) || catalog[a].name.localeCompare(catalog[b].name));
  }

  const titleCase = value => value[0].toUpperCase() + value.slice(1);
  const tooltipText = id => {
    const item = ITEMS[id];
    if (item.alien) return item.hull + ' hull · ' + Math.round(item.speed) + ' speed · ' + item.damage +
      ' damage · ' + item.engines + (item.engines === 1 ? ' engine' : ' engines');
    return item.description ?? '';
  };

  let tooltip;
  let tooltipOwner;
  let tooltipId;
  function hideTooltip() {
    tooltip?.remove();
    tooltip = null;
    tooltipOwner = null;
    tooltipId = null;
  }

  function showItemTooltip(node, id, x, y) {
    if (tooltipOwner !== node || tooltipId !== id || !tooltip?.isConnected) {
      hideTooltip();
      tooltipOwner = node;
      tooltipId = id;
      const item = ITEMS[id];
      const tier = item.rarity ?? 'common';
      const crate = CRATES[id];
      const label = document.createElement('strong');
      label.textContent = item.name + (item.alien ? ' · Alienated' : '');
      const rarity = document.createElement('small');
      rarity.textContent = titleCase(tier);
      tooltip = document.createElement('aside');
      tooltip.className = 'item-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.style.setProperty('--rarity', RARITIES[tier]);
      tooltip.append(label, rarity);
      if (crate) {
        const list = document.createElement('ul');
        for (const outcome of crate.outcomes) for (const reward of outcome.items) {
          const row = document.createElement('li');
          const name = document.createElement('span');
          name.textContent = ITEMS[reward].name;
          const odds = document.createElement('b');
          odds.textContent = (outcome.weight / outcome.items.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
          row.append(graphic(reward, false), name, odds);
          list.append(row);
        }
        tooltip.append(list);
      } else if (tooltipText(id)) {
        const description = document.createElement('p');
        description.textContent = tooltipText(id);
        tooltip.append(description);
      }
      (node.closest?.('dialog') ?? document.body).append(tooltip);
    }
    const maxX = Math.max(4, window.innerWidth - tooltip.offsetWidth - 6);
    const maxY = Math.max(4, window.innerHeight - tooltip.offsetHeight - 6);
    tooltip.style.left = Math.max(4, Math.min(x + 13, maxX)) + 'px';
    tooltip.style.top = Math.max(4, Math.min(y + 13, maxY)) + 'px';
  }

  function itemHover(node, id) {
    node.addEventListener('pointerenter', event => showItemTooltip(node, id, event.clientX, event.clientY));
    node.addEventListener('pointermove', event => showItemTooltip(node, id, event.clientX, event.clientY));
    node.addEventListener('pointerleave', () => { if (tooltipOwner === node) hideTooltip(); });
    node.addEventListener('focus', () => {
      const rect = node.getBoundingClientRect();
      showItemTooltip(node, id, rect.right, rect.top);
    });
    node.addEventListener('blur', () => { if (tooltipOwner === node) hideTooltip(); });
  }

  function dragIcon(event, control) {
    const source = control.querySelector('img');
    if (!source?.complete || !source.naturalWidth) {
      event.dataTransfer.setDragImage(control.firstElementChild, 14, 14);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 28;
    canvas.className = 'drag-icon';
    canvas.style.left = event.clientX + 'px';
    canvas.style.top = event.clientY + 'px';
    canvas.getContext('2d').drawImage(source, 0, 0, 28, 28);
    document.body.append(canvas);
    event.dataTransfer.setDragImage(canvas, 14, 14);
    requestAnimationFrame(() => canvas.remove());
  }

  function revealCrate(crateId, batch, element, button, game) {
    const { count, featured: result, rewards } = batch;
    const crate = CRATES[crateId];
    const item = ITEMS[result.type];
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
      const id = winning ? result.type : AG.crateRoll(crate).id;
      const spec = ITEMS[id];
      const tile = element('div', '', 'reel-tile');
      tile.style.setProperty('--rarity', RARITIES[spec.rarity ?? 'common']);
      tile.append(graphic(id), element('span', spec.name));
      track.append(tile);
      if (winning) {
        winner = tile;
        tile.append(element('b', '×' + result.amount.toLocaleString(), 'reel-quantity'));
      }
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
      message.textContent = item.name + ' ×' + result.amount.toLocaleString() + ' · ' + (item.rarity ?? 'common');
      summary.hidden = false;
      next.textContent = 'Done';
    }
    const next = button('Skip animation', () => {
      if (revealed) dialog.close();
      else showReward();
    }, { primary: true });
    dialog.append(title, viewport, message, next);
    const summary = element('section', '', 'reel-other');
    summary.hidden = true;
    summary.append(element('h3', 'All rewards'));
    const items = element('ul', '', 'reel-rewards');
    for (const reward of rewards) {
      const spec = ITEMS[reward.type];
      const tile = element('li', '', 'reel-reward-tile');
      tile.style.setProperty('--rarity', RARITIES[spec.rarity ?? 'common']);
      tile.append(graphic(reward.type), element('span', spec.name), element('b', '×' + reward.amount.toLocaleString()));
      items.append(tile);
    }
    summary.append(items);
    dialog.append(summary);
    if (batch.stored) dialog.append(element('p', batch.stored.toLocaleString() + ' saved in Inventory.', 'reel-batch-note'));
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      animation?.cancel();
      dialog.remove();
      for (const reward of rewards) game.notify('loot', reward);
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
    const choices = [...game.profile.unlocked, 'alienCell', 'alienMind', 'alienSerum'].filter(available);
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
      recipe === 'mind' ? 'Craft Alien Mind' : 'Craft';
    const actions = element('div', '', 'home-actions');
    actions.append(button(label, () => {
      const id = game.craft(state.grid);
      if (id) { state.grid.fill(''); state.ingredient = ''; }
      state.result = id ? ITEMS[id].name + ' added to Inventory.' : 'Check the ingredients in the grid.';
      refresh();
    }, { primary: true, disabled: !recipe }), button('Clear grid', () => {
      state.grid.fill(''); state.ingredient = ''; refresh();
    }));
    body.append(element('p', 'Drag an ingredient or select it and tap a slot. Tap a filled slot with nothing selected to clear it.', 'panel-note'),
      layout, actions);
  }

  function renderRecipes(body, element, selectedShip) {
    const list = element('div', '', 'recipe-list');
    for (const [key, recipe] of Object.entries(AG.RECIPES)) {
      const card = element('article', '', 'recipe-card');
      const grid = element('div', '', 'craft-grid recipe-grid');
      for (const id of recipe.pattern) {
        const item = id === 'donor' ? selectedShip : id;
        const slot = element('div', '', 'recipe-slot');
        const name = id === 'donor' ? 'Any owned spaceship' : ITEMS[item].name;
        slot.setAttribute('role', 'img');
        slot.setAttribute('aria-label', name);
        slot.title = name;
        slot.append(graphic(item));
        grid.append(slot);
      }
      const legend = element('ul', '', 'recipe-legend');
      const entries = key === 'ship'
        ? [['alienCell', 'Alien Cells ×6'], [selectedShip, 'Any owned spaceship ×1'], ['alienMind', 'Alien Mind ×1'], ['alienSerum', 'Alien Serum ×1']]
        : [['alienCell', 'Alien Cells ×8'], ['alienSerum', 'Alien Serum ×1']];
      for (const [id, label] of entries) {
        const row = element('li');
        row.append(graphic(id), element('span', label));
        legend.append(row);
      }
      card.append(element('h3', recipe.name), grid, legend);
      list.append(card);
    }
    body.append(list);
  }

  function decorateRarity(node, item) {
    const donor = Object.values(AG.BASE_SHIPS).find(ship => ship.name === item.donor?.replace(/^Alien /, ''));
    node.style.setProperty('--rarity', RARITIES[item.rarity ?? 'common']);
    if (item.alien) {
      node.classList.add('alien-rarity');
      node.style.setProperty('--donor-rarity', RARITIES[item.donorRarity ?? donor?.rarity ?? item.rarity]);
    }
    node.classList.add('rarity-outline');
  }

  const rarityRank = id => Object.keys(RARITIES).indexOf(SHIPS[id].rarity);

  function shipRank(id) {
    const ship = SHIPS[id];
    const base = ship.alien ? Object.keys(AG.BASE_SHIPS).find(key => AG.BASE_SHIPS[key].name === ship.donor?.replace(/^Alien /, '')) : id;
    const rank = AG.SHIP_ORDER.indexOf(base);
    return (rank < 0 ? AG.SHIP_ORDER.length : rank) - (ship.alien ? .25 : 0);
  }

  function renderArmory({ kind, state, game, body, button, element, open, dismiss, refresh }) {
    const profile = game.profile;
    const base = game.canVisitBase();
    const cards = element('div', '', 'cards armory-cards');
    const tiles = element('div', '', 'inventory-tiles');
    const details = element('div', '', 'inventory-details');
    const tileChoices = new Map();

    details.hidden = true;
    function selectTile(id) {
      const choice = tileChoices.get(id);
      if (!choice) return;
      const { item, text, action } = choice;
      hideTooltip();
      state.selectedItem = id;
      state.showItemDetails = true;
      details.hidden = false;
      for (const [key, entry] of tileChoices) entry.tile.setAttribute('aria-pressed', String(key === id));
      const copy = element('div');
      const rarity = element('span', item.rarity ?? 'common', 'item-rarity');
      rarity.style.color = RARITIES[item.rarity ?? 'common'];
      copy.append(element('strong', item.name), rarity, element('p', text));
      details.replaceChildren(graphic(id), copy);
      if (action) details.append(action);
    }

    function tileCard(id, text, action, count) {
      const item = ITEMS[id];
      const rarity = item.rarity ?? 'common';
      const tile = button('', () => selectTile(id));
      tile.className = 'inventory-tile';
      tile.style.setProperty('--rarity', RARITIES[rarity]);
      decorateRarity(tile, item);
      itemHover(tile, id);
      tile.setAttribute('aria-label', item.name + ', ' + rarity + ', quantity ' + (count || 1));
      tile.append(graphic(id, false), element('b', '×' + (count || 1).toLocaleString(), 'inventory-count'));
      if (BOOSTS[id]) {
        tile.draggable = true;
        tile.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', id));
      }
      tiles.append(tile);
      tileChoices.set(id, { item, tile, text, action });
    }

    function card(id, text, action, count = 0) {
      if (kind === 'inventory') { tileCard(id, text, action, count); return; }
      const item = ITEMS[id];
      const row = element('div', '', 'card item-card');
      if (SHIPS[id]) decorateRarity(row, item);
      const copy = element('div');
      const header = element('strong', item.name + (count ? ' ×' + count : ''));
      const rarity = element('span', item.rarity ?? 'common', 'item-rarity');
      rarity.style.color = RARITIES[item.rarity ?? 'common'];
      copy.append(header, rarity, element('small', text));
      itemHover(row, id);
      row.append(graphic(id, false), copy);
      if (action) row.append(action);
      cards.append(row);
    }

    function footer(...actions) {
      const row = element('div', '', 'home-actions');
      row.append(...actions, button('Back', dismiss));
      body.append(row);
    }

    if (kind === 'shipPicker') {
      const list = element('div', '', 'ship-picker');
      for (const id of [...profile.unlocked].sort((a, b) => rarityRank(b) - rarityRank(a) || shipRank(a) - shipRank(b))) {
        const ship = SHIPS[id];
        const pick = button('', () => open('outfit', { ship: id, part: state.part }));
        pick.append(graphic(id, false), element('strong', ship.name),
          element('small', ship.alien ? 'Alienated · ' + titleCase(ship.rarity) : titleCase(ship.rarity)));
        itemHover(pick, id);
        decorateRarity(pick, ship);
        list.append(pick);
      }
      body.append(list);
      footer();
    } else if (kind === 'merchant') {
      body.append(element('p', game.credits.toLocaleString() + ' Credits available', 'panel-note'));
      const stock = game.merchantStock();
      const clock = element('p', '', 'panel-note');
      const updateStockClock = () => {
        const seconds = Math.max(0, Math.ceil((stock.until - Date.now()) / 1000));
        clock.textContent = 'Restock in ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
        return seconds;
      };
      updateStockClock();
      body.append(clock);
      const timer = setInterval(() => {
        if (!clock.isConnected) { clearInterval(timer); return; }
        if (!updateStockClock()) { clearInterval(timer); refresh(); }
      }, 1000);
      for (const id of stock.ids) {
        const price = AG.MERCHANT[id];
        card(id, ITEMS[id].description, button(price.toLocaleString() + ' Credits', () => {
          if (game.buyMerchant(id)) state.result = ITEMS[id].name + ' purchased.';
          refresh();
        }, { disabled: !base || game.credits < price }));
      }
      body.append(cards);
      footer();
    } else if (kind === 'autoBoost') {
      const headings = element('div', '', 'inventory-tabs');
      for (const [id, label] of [['load', 'Available boosts'], ['queue', 'Loaded boosts']]) {
        const tab = button(label, () => { state.relayTab = id; refresh(); });
        tab.setAttribute('aria-pressed', String((state.relayTab ?? 'load') === id));
        headings.append(tab);
      }
      const reserve = element('section', '', 'reserve-grid');
      const types = Object.keys(profile.boostReserve).length;
      reserve.append(element('p', types + '/5 boost types · up to 5 copies per type', 'panel-note'));
      for (const [id, boost] of Object.entries(BOOSTS)) {
        const available = profile.boosts[id] ?? 0;
        const stored = profile.boostReserve[id] ?? 0;
        const unloading = state.relayTab === 'queue';
        if (unloading ? !stored : !available) continue;
        const row = element('div', '', 'reserve-row');
        const action = button(unloading ? 'Unload' : 'Load', () => {
          if (game.adjustBoostReserve(id, unloading ? -1 : 1)) refresh();
        }, { disabled: !unloading && (stored >= 5 || (!stored && types >= 5)) });
        row.append(graphic(id), element('span', boost.name + ' · ' + stored + '/5 loaded'), action);
        reserve.append(row);
      }
      if (reserve.children.length === 1) reserve.append(element('p', 'No boosts here yet.'));
      body.append(headings, reserve);
      footer();
    } else if (kind === 'shop') {
      const options = element('div', '', 'inventory-tabs');
      for (const [id, name] of [['ships', 'Credit ships'], ['crates', 'Star Gem crates'], ['flagship', 'Premium Store']]) {
        const tab = menuIcon(button(name, () => { state.shopTab = id; refresh(); }), id);
        tab.setAttribute('aria-pressed', String(state.shopTab === id));
        options.append(tab);
      }
      body.append(options, element('p', game.credits.toLocaleString() + ' Credits · ' + profile.gems + ' Star Gems', 'panel-note'));
      if (state.shopTab === 'ships') {
        for (const id of Object.keys(AG.BASE_SHIPS).filter(id => Number.isFinite(SHIPS[id].price)).sort((a, b) => shipRank(b) - shipRank(a))) {
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
          element('h4', ability.name), element('p', 'Absorbs up to ' + ability.capacity + ' damage. Recharges ' + ability.interval + ' seconds after the shield breaks.'),
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
            const count = quantity.valueAsNumber;
            if (!game.buyCrates(id, count)) return;
            state.result = count.toLocaleString() + ' crates saved in Inventory.';
            refresh();
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
          card(id, crate.price + ' Star Gems each', controls);
        }
        body.append(element('p', 'Duplicate ships and upgrades add to the copies you own.', 'panel-note'));
      }
      body.append(cards);
      footer();
    } else if (kind === 'inventory' || kind === 'hangar') {
      const inventory = kind === 'inventory';
      const tab = inventory ? state.inventoryTab : 'ships';
      if (inventory) {
        const tabs = element('div', '', 'inventory-tabs');
        for (const [id, label] of [['ships', 'Spaceships'], ['upgrades', 'Upgrades'], ['boosts', 'Boosts'], ['items', 'Items'], ['crates', 'Crates']]) {
          const control = menuIcon(button(label, () => { state.inventoryTab = id; refresh(); }), id);
          control.setAttribute('aria-pressed', String(tab === id));
          tabs.append(control);
        }
        body.append(tabs);
      }
      if (tab === 'ships') {
        for (const id of [...profile.unlocked].sort((a, b) => rarityRank(b) - rarityRank(a) || shipRank(a) - shipRank(b))) {
          if (!profile.unlocked.includes(id)) continue;
          const equipped = profile.ship === id;
          const ship = SHIPS[id];
          const info = tooltipText(id) + (ship.ability ? ' · ' + ship.ability.name : '');
          card(id, info, button(equipped ? 'Equipped' : 'Equip', () => {
            game.equip(id); refresh();
          }, { disabled: equipped || !base }), inventory || game.shipCount(id) > 1 ? game.shipCount(id) : 0);
        }
      } else if (tab === 'upgrades') {
        for (const id of sortItems(UPGRADES, part => (part.damage ?? part.speed ?? 0))) {
          if (!profile.upgrades[id]) continue;
          const outfit = button('Use', () => {
            state.selectedUpgrade = id;
            open('shipPicker', { part: id });
          });
          if (state.selectedUpgrade === id) outfit.setAttribute('aria-pressed', 'true');
          card(id, UPGRADES[id].description, outfit, profile.upgrades[id]);
        }
      } else if (tab === 'boosts') {
        const assigned = element('div', '', 'boost-assign');
        profile.boostSlots.forEach((id, i) => {
          const slot = button('', () => assign(BOOSTS[state.selectedItem] ? state.selectedItem : ''));
          slot.setAttribute('aria-label', 'Flight boost slot ' + (i + 1));
          const unlocked = game.boostSlotOpen(i);
          slot.disabled = !unlocked;
          if (!unlocked) {
            const lock = element('img', '', 'boost-lock');
            lock.src = AG.BOOST_LOCK;
            lock.alt = 'Locked';
            slot.append(lock);
          } else if (id) slot.append(graphic(id));
          slot.append(element('small', 'Level ' + [1, 5, 10][i]));
          function assign(type) {
            if (!game.boostSlotOpen(i) || (type && (!BOOSTS[type] || !profile.boosts[type]))) return;
            profile.boostSlots[i] = type;
            game.save();
            refresh();
          }
          slot.addEventListener('contextmenu', event => { event.preventDefault(); assign(''); });
          slot.addEventListener('dragover', event => event.preventDefault());
          slot.addEventListener('drop', event => {
            event.preventDefault();
            const type = event.dataTransfer.getData('text/plain');
            if (BOOSTS[type]) assign(type);
          });
          assigned.append(slot);
        });
        body.append(assigned, element('p', 'Drag a boost to a flight slot, or select a boost and tap a slot. Right-click a slot to clear it.', 'panel-note'));
        for (const id of sortItems(BOOSTS, boost => boost.repair ?? boost.duration)) {
          if (!profile.boosts[id]) continue;
          card(id, BOOSTS[id].description, button('Use', () => { state.selectedItem = id; assigned.firstElementChild?.focus(); }), profile.boosts[id]);
        }
      } else if (tab === 'items') {
        body.append(element('h3', 'Event', 'inventory-subsection'));
        for (const id of sortItems(AG.MATERIALS, () => 0)) {
          if (!profile.materials[id]) continue;
          const action = id === 'alienSerum' && button(profile.serumUsed ? 'Mind control unlocked' : 'Use on equipped Alien Ship', () => {
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
            revealCrate(id, batch, element, button, game);
          }

          const controls = element('div', '', 'crate-batch-controls');
          controls.append(button('Open 1', () => openBatch(1)),
            button('Open 10', () => openBatch(10), { disabled: limit < 10 }));
          if (game.testing || game.adminUnlocked) {
            const quantity = element('input');
            quantity.type = 'number';
            quantity.min = '1';
            quantity.max = String(limit);
            quantity.step = '1';
            quantity.value = '1';
            quantity.setAttribute('aria-label', CRATES[id].name + ' quantity');
            controls.append(quantity, button('Open', () => openBatch(quantity.valueAsNumber), { primary: true }));
          }
          card(id, '', controls, count);
        }
      }
      if (inventory) {
        const shell = element('div', '', 'inventory-shell');
        const scroll = element('div', '', 'inventory-scroll');
        scroll.setAttribute('aria-label', 'Collected ' + tab);
        if (tileChoices.size) {
          scroll.append(tiles);
          shell.append(scroll, details);
          body.append(shell);
          if (tileChoices.has(state.selectedItem) && state.showItemDetails) selectTile(state.selectedItem);
          const positions = state.inventoryScroll ??= {};
          scroll.scrollTop = positions[tab] ?? 0;
          scroll.addEventListener('scroll', () => { positions[tab] = scroll.scrollTop; });
        } else {
          shell.append(element('p', 'No ' + tab + ' collected yet.', 'panel-note'));
          body.append(shell);
        }
      } else {
        if (!cards.children.length) cards.append(element('p', 'No ships collected yet.', 'panel-note'));
        body.append(cards);
      }
      
      footer();
    } else if (kind === 'craft') {
      renderCraft({ game, state, element, button, body, refresh });
      body.append(menuIcon(button('Recipes', () => open('recipes')), 'recipes'));
      footer();
    } else if (kind === 'recipes') {
      renderRecipes(body, element, profile.ship);
      footer();
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
          (effects.laser ? ' · Lightning Beacon' : '') + (effects.magnet ? ' · Loot Magnet' : '') +
          (effects.boostRelay ? ' · Auto Boost' : '');
      };
      preview.textContent = describe(current);
      const indicators = [];
      for (const [slot, [type, name]] of Object.entries(SLOTS)) {
        const mounted = crafts[slot];
        const locked = !AG.slotAvailable(spec, slot);
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
        if (mounted === 'boostRelay') mount.addEventListener('contextmenu', event => {
          event.preventDefault(); open('autoBoost', { ship });
        });
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
        const choose = button('', () => { state.part = state.part === id ? '' : id; state.selectedUpgrade = id; refresh(); });
        choose.append(graphic(id, false), element('span', part.name));
        choose.style.setProperty('--rarity', RARITIES[part.rarity]);
        itemHover(choose, id);
        choose.draggable = true;
        choose.setAttribute('aria-pressed', String(state.part === id));
        choose.addEventListener('dragstart', event => {
          state.part = id;
          indicators.forEach(highlight => highlight());
          event.dataTransfer.setData('text/plain', id);
          event.dataTransfer.effectAllowed = 'copy';
          hideTooltip();
          dragIcon(event, choose);
        });
        parts.append(choose);
      }
      if (!parts.children.length) parts.append(element('p', 'Collect upgrades in flight or open an Upgrade Crate.', 'panel-note'));
      body.append(element('h3', spec.name));
      if (Object.values(crafts).includes('boostRelay')) body.append(button('Configure Auto Boost', () => open('autoBoost', { ship })));
      const presets = element('div', '', 'loadout-presets');
      for (let i = 0; i < profile.presets.length; i++) {
        const row = element('div');
        row.append(element('strong', 'Preset ' + (i + 1)), button('Save', () => {
          if (game.setPreset(i, ship, true)) { state.result = 'Preset saved.'; refresh(); }
        }), button('Apply', () => {
          if (game.setPreset(i, ship, false)) { state.result = 'Available parts fitted from preset.'; refresh(); }
        }, { disabled: !profile.presets[i] }));
        presets.append(row);
      }
      body.append(preview,
        element('p', 'Drag a part onto a matching mount, or select it and tap a mount. Select a fitted mount to remove the part.', 'panel-note'));
      layout.append(diagram, parts);
      body.append(layout);
      body.append(presets);
      footer();
    }
    if (state.result) {
      const feedback = element('p', state.result, 'admin-status');
      feedback.setAttribute('role', 'status');
      body.prepend(feedback);
    }
  }
  Object.assign(AG, { renderArmory, itemGraphic: graphic, menuIcon, hideItemTooltip: hideTooltip, showItemTooltip });
})();
