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
      ' damage · ' + item.engines + (item.engines === 1 ? ' engine' : ' engines') + ' · ' + AG.energyCapacity(item) + '% energy';
    return SHIPS[id] ? item.description + ' · ' + AG.energyCapacity(item) + '% energy' : (item.description ?? '');
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
      const crate = AG.liveCrate(id);
      const label = document.createElement('strong');
      label.textContent = AG.itemName(id) + (item.alien ? ' · Alienated' : '');
      const rarity = document.createElement('small');
      rarity.textContent = titleCase(tier);
      tooltip = document.createElement('aside');
      tooltip.className = 'item-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.style.setProperty('--rarity', RARITIES[tier]);
      tooltip.append(label, rarity);
      if (['alienCell', 'alienMind', 'alienSerum'].includes(id)) {
        const eventTag = document.createElement('span');
        eventTag.className = 'event-tag';
        eventTag.textContent = 'Event';
        tooltip.append(eventTag);
      }
      if (crate?.outcomes) {
        const list = document.createElement('ul');
        for (const outcome of crate.outcomes) for (const reward of outcome.items) {
          const row = document.createElement('li');
          const name = document.createElement('span');
          name.textContent = AG.itemName(reward);
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

  function itemHover(node, id, pointer = true) {
    if (pointer) {
      node.addEventListener('pointerenter', event => showItemTooltip(node, id, event.clientX, event.clientY));
      node.addEventListener('pointermove', event => showItemTooltip(node, id, event.clientX, event.clientY));
      node.addEventListener('pointerleave', () => { if (tooltipOwner === node) hideTooltip(); });
    }
    node.addEventListener('focus', () => {
      if (!node.matches(':focus-visible')) return;
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
    const crate = AG.liveCrate(crateId);
    const item = ITEMS[result.type];
    const protectedReveal = !game.profile.allowRareCrateSkip && ['mythical', 'godly'].includes(item.rarity);
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
      tile.append(graphic(id), element('span', AG.itemName(id)));
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
      message.textContent = AG.itemName(result.type) + ' ×' + result.amount.toLocaleString() + ' · ' + (item.rarity ?? 'common');
      summary.hidden = false;
      next.textContent = 'Done';
      next.hidden = false;
    }
    const next = button('Skip animation', () => {
      if (revealed) dialog.close();
      else if (!protectedReveal) showReward();
    }, { primary: true });
    next.hidden = protectedReveal;
    dialog.addEventListener('cancel', event => { if (!revealed && protectedReveal) event.preventDefault(); });
    dialog.append(title, viewport, message, next);
    const summary = element('section', '', 'reel-other');
    summary.hidden = true;
    summary.append(element('h3', 'All rewards'));
    const items = element('ul', '', 'reel-rewards');
    for (const reward of rewards) {
      const spec = ITEMS[reward.type];
      const tile = element('li', '', 'reel-reward-tile');
      tile.style.setProperty('--rarity', RARITIES[spec.rarity ?? 'common']);
      tile.append(graphic(reward.type), element('span', AG.itemName(reward.type)), element('b', '×' + reward.amount.toLocaleString()));
      items.append(tile);
    }
    summary.append(items);
    dialog.append(summary);
    if (batch.stored) dialog.append(element('p', batch.stored.toLocaleString() + ' saved in Inventory.', 'reel-batch-note'));
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      animation?.cancel();
      dialog.remove();
      for (const reward of rewards) {
        game.notify('loot', reward);
        if (reward.discovered) game.notify('discovery', reward.type);
      }
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
    const available = id => AG.itemAvailable(id) ? game.itemCount(id) : 0;
    const recipesAvailable = Object.entries(AG.RECIPES).filter(([, spec]) => spec.event || AG.contentActive());
    const parts = new Set(recipesAvailable.flatMap(([, recipe]) => recipe.pattern ?? recipe.ingredients));
    const choices = [...game.profile.unlocked, ...parts].filter(id => ITEMS[id] && available(id));
    const grid = element('div', '', 'craft-grid');
    const ingredients = element('div', '', 'ingredient-bank');
    const missing = state.missing ??= [];
    ingredients.addEventListener('scroll', () => { state.ingredientScroll = ingredients.scrollTop; });
    function place(index, id) {
      const occupied = state.grid.filter((ingredient, position) => ingredient === id && position !== index).length;
      if (id && (!choices.includes(id) || occupied >= available(id))) return;
      state.grid[index] = id;
      delete missing[index];
      if (id && occupied + 1 === available(id)) state.ingredient = '';
      refresh();
    }
    state.grid.forEach((id, index) => {
      const tile = button('', () => place(index, state.ingredient));
      const wanted = missing[index];
      if (id && ITEMS[id]) tile.append(graphic(id));
      else if (wanted) {
        tile.classList.add('missing-ingredient');
        tile.append(graphic(wanted === 'alienShip' ? game.profile.ship : wanted));
      }
      tile.setAttribute('aria-label', 'Slot ' + (index + 1) + ' · ' +
        (id ? AG.itemName(id) : wanted ? 'Missing ' + (wanted === 'alienShip' ? 'an Alien spaceship' : AG.itemName(wanted)) : 'empty'));
      tile.addEventListener('dragover', event => event.preventDefault());
      tile.addEventListener('drop', event => { event.preventDefault(); place(index, event.dataTransfer.getData('text/plain')); });
      grid.append(tile);
    });
    for (const id of choices) {
      const remaining = available(id) - state.grid.filter(item => item === id).length;
      const option = button('', () => { state.ingredient = state.ingredient === id ? '' : id; refresh(); }, { disabled: remaining <= 0 });
      option.setAttribute('aria-pressed', String(state.ingredient === id));
      option.append(graphic(id), element('span', AG.itemName(id)), element('b', '×' + remaining));
      option.draggable = remaining > 0;
      option.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', id));
      ingredients.append(option);
    }
    const layout = element('div', '', 'craft-layout');
    layout.append(grid, ingredients);
    if (game.profile.bestPilotLevel >= 10) {
      const controls = element('div', '', 'recipe-autofill');
      const recipes = element('select');
      recipes.setAttribute('aria-label', 'Recipe to autofill');
      for (const [id, recipe] of recipesAvailable) {
        const option = element('option', recipe.name);
        option.value = id;
        recipes.append(option);
      }
      recipes.value = state.autofillRecipe ?? 'ship';
      const ships = element('select');
      ships.setAttribute('aria-label', 'Spaceship for recipe');
      function shipChoices() {
        const mode = recipes.value;
        const eligible = game.profile.unlocked.filter(id => mode === 'ship' ? !SHIPS[id].alien : SHIPS[id].alien && !SHIPS[id].mindControl);
        ships.hidden = !['ship', 'control'].includes(mode);
        ships.replaceChildren();
        for (const id of eligible) {
          const option = element('option', AG.itemName(id));
          option.value = id;
          ships.append(option);
        }
        ships.value = eligible.includes(state.autofillShip) ? state.autofillShip :
          eligible.includes(game.profile.ship) ? game.profile.ship : eligible[0] ?? '';
      }
      recipes.addEventListener('change', () => { state.autofillRecipe = recipes.value; shipChoices(); });
      ships.addEventListener('change', () => { state.autofillShip = ships.value; });
      shipChoices();
      controls.append(recipes, ships, button('Fill recipe', () => {
        state.autofillRecipe = recipes.value;
        state.autofillShip = ships.value;
        const chosen = AG.RECIPES[recipes.value];
        const pattern = chosen.pattern ?? chosen.ingredients;
        const allocated = {};
        state.grid = Array(9).fill('');
        state.missing = [];
        state.ingredient = '';
        pattern.forEach((part, index) => {
          if (!part) return;
          const id = part === 'donor' || part === 'alienShip' ? ships.value || 'alienShip' : part;
          allocated[id] = (allocated[id] ?? 0) + 1;
          if (allocated[id] <= available(id)) state.grid[index] = id;
          else state.missing[index] = id;
        });
        refresh();
      }));
      body.append(controls);
    }
    const recipe = game.recipe(state.grid);
    const label = recipe === 'ship' ? 'Consume ' + AG.itemName(state.grid[4]) + ' and craft Alien Ship' :
      recipe === 'mind' ? 'Craft Alien Mind' : recipe === 'serum' ? 'Craft Alien Mind Serum' :
        recipe === 'control' ? 'Add Mind Control' : recipe ? 'Craft ' + AG.RECIPES[recipe].name : 'Craft';
    const actions = element('div', '', 'home-actions');
    actions.append(button(label, () => {
      const id = game.craft(state.grid);
      if (id) { state.grid.fill(''); state.missing = []; state.ingredient = ''; }
      state.result = id ? AG.itemName(id) + (recipe === 'control' ? ' gained Mind Control.' : ' added to Inventory.') : 'Check the ingredients in the grid.';
      refresh();
    }, { primary: true, disabled: !recipe }), button('Clear grid', () => {
      state.grid.fill(''); state.missing = []; state.ingredient = ''; refresh();
    }));
    body.append(element('p', 'Drag an ingredient or select it and tap a slot. Tap a filled slot with nothing selected to clear it.', 'panel-note'),
      layout, actions);
    ingredients.scrollTop = state.ingredientScroll ?? 0;
  }

  function renderRecipes(body, element, button, game, state, refresh) {
    const activeTab = state.recipeTab ?? (AG.contentActive() ? 'normal' : 'event');
    const tabs = element('div', '', 'inventory-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Recipe categories');
    for (const [id, label] of [['normal', 'Normal'], ['event', 'Event']]) {
      const tab = button(label, () => { state.recipeTab = id; refresh(); });
      tab.setAttribute('aria-pressed', String(activeTab === id));
      tabs.append(tab);
    }
    const list = element('div', '', 'recipe-list');
    body.append(tabs, list);
    const ships = Object.keys(AG.BASE_SHIPS).filter(AG.itemAvailable);
    const example = ships.includes(game.profile.ship) ? game.profile.ship : ships[0];
    const alienExample = game.profile.unlocked.find(id => SHIPS[id].alien) ?? example;
    const ingredients = {
      ship: [['alienCell', 'Alien Cells ×6'], [example, 'Any owned spaceship ×1'],
        ['alienMind', 'Alien Mind ×1'], ['alienSerum', 'Alien Mind Serum ×1']],
      mind: [['alienCell', 'Alien Cells ×9']],
      serum: [['alienCell', 'Alien Cells ×8'], ['alienMind', 'Alien Mind ×1']],
      control: [[alienExample, 'Any Alien spaceship ×1'], ['alienSerum', 'Alien Mind Serum ×1'], ['alienMind', 'Alien Mind ×1']]
    };
    for (const [key, recipe] of Object.entries(AG.RECIPES)) {
      if (Boolean(recipe.event) !== (activeTab === 'event') || (!recipe.event && !AG.contentActive())) continue;
      const card = element('article', '', 'recipe-card');
      card.append(element('h3', recipe.name));
      if (recipe.pattern) {
        const grid = element('div', '', 'craft-grid recipe-grid');
        for (const id of recipe.pattern) {
          const slot = element('div', '', 'recipe-slot');
          if (!id) { grid.append(slot); continue; }
          const anyShip = id === 'donor';
          const name = anyShip ? 'Any owned spaceship' : AG.itemName(id);
          slot.setAttribute('role', 'img');
          slot.setAttribute('aria-label', name);
          slot.title = name;
          slot.append(graphic(anyShip ? example : id));
          if (anyShip && ships.length > 1) {
            let index = Math.max(0, ships.indexOf(example));
            const rotation = setInterval(() => {
              if (!slot.isConnected) { clearInterval(rotation); return; }
              index = (index + 1) % ships.length;
              slot.replaceChildren(graphic(ships[index]));
            }, 850);
          }
          grid.append(slot);
        }
        card.append(grid);
        if (recipe.shift) card.append(element('p', 'The same pattern also fits one row lower.', 'panel-note'));
      } else card.append(element('p', 'Place the three ingredients anywhere in the grid.'));
      const legend = element('ul', '', 'recipe-legend');
      const counts = {};
      for (const id of (recipe.pattern ?? recipe.ingredients).filter(Boolean)) counts[id] = (counts[id] ?? 0) + 1;
      const labels = ingredients[key] ?? Object.entries(counts).map(([id, count]) => [id, AG.itemName(id) + ' ×' + count]);
      for (const [id, label] of labels) {
        const row = element('li');
        row.append(graphic(id), element('span', label));
        legend.append(row);
      }
      card.append(legend);
      list.append(card);
    }
    if (!list.children.length) body.append(element('p', 'Normal recipes unlock with the Asteroid update.', 'panel-note'));
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

  function renderCrateShop(game, state, element, button, refresh) {
    const shelf = element('div', '', 'shop-crates');
    const flash = state.crateFlash;
    state.crateFlash = '';
    for (const id of ['enemyCrate', 'shipCrate', 'upgradeCrate']) {
      if (!AG.itemAvailable(id)) continue;
      const crate = CRATES[id];
      const limit = game.cratePurchaseLimit(id);
      const card = element('article', '', 'shop-crate');
      card.style.setProperty('--rarity', RARITIES[crate.rarity]);
      if (flash === id) card.classList.add('crate-purchased');
      const art = element('div', '', 'shop-crate-art');
      const icon = graphic(id);
      icon.tabIndex = 0;
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('aria-label', crate.name + ' drop rates');
      if (id === 'enemyCrate') {
        card.classList.add('shop-crate-new');
        art.append(element('span', 'New!', 'crate-new-label'));
      }
      art.append(icon);
      const info = element('div', '', 'shop-crate-info');
      const title = element('h3', crate.name);
      const pricing = element('p', crate.price + ' Star Gems each · ' + game.itemCount(id).toLocaleString() + ' owned', 'panel-note');
      const quick = element('div', '', 'crate-quick-buy');
      function purchase(count) {
        if (!game.buyCrates(id, count)) return;
        state.result = count.toLocaleString() + (count === 1 ? ' crate saved in Inventory.' : ' crates saved in Inventory.');
        state.crateFlash = id;
        refresh();
      }
      for (const count of AG.CRATE_BUY_AMOUNTS) {
        const price = game.cratePurchasePrice(id, count);
        const choice = button('Buy ' + count, () => purchase(count), { disabled: !game.canBuyCrates(id, count) });
        const amount = element('small', '', price < count * crate.price ? 'sale-price' : '');
        if (price < count * crate.price) amount.append(element('s', String(count * crate.price)));
        amount.append(element('span', price + ' Gems'));
        choice.append(amount);
        choice.setAttribute('aria-label', 'Buy ' + count + ' ' + crate.name + (count === 1 ? '' : 's') + ' for ' + price + ' Star Gems');
        quick.append(choice);
      }
      info.append(title, pricing, quick);
      if (id === 'enemyCrate' && AG.enemyCrateSaleActive()) {
        info.append(element('p', '25% off Buy 4 and Buy 10 until 29 Nov, 12:00 a.m. AEDT', 'sale-note'));
      }
      if (game.canBuyCustomCrateAmount) {
        const controls = element('form', '', 'crate-batch-controls crate-admin-buy');
        const quantity = element('input');
        quantity.type = 'number';
        quantity.min = '1';
        quantity.max = String(Math.max(1, limit));
        quantity.step = '1';
        quantity.value = '1';
        quantity.disabled = limit < 1;
        quantity.setAttribute('aria-label', crate.name + ' custom purchase quantity');
        const buy = button('Buy custom', () => purchase(quantity.valueAsNumber), { disabled: limit < 1 });
        buy.type = 'button';
        function updateTotal() {
          const count = quantity.valueAsNumber;
          buy.disabled = !game.canBuyCrates(id, count);
          buy.textContent = buy.disabled ? 'Buy custom' : 'Buy custom · ' + AG.formatCurrency(game.cratePurchasePrice(id, count)) + ' Gems';
        }
        controls.addEventListener('submit', event => {
          event.preventDefault();
          if (!buy.disabled) purchase(quantity.valueAsNumber);
        });
        quantity.addEventListener('input', updateTotal);
        updateTotal();
        controls.append(quantity, buy);
        info.append(controls);
      }
      card.append(art, info);
      shelf.append(card);
    }
    return shelf;
  }

  function renderUpdateGifts(game, state, element, button, refresh) {
    const section = element('section', '', 'update-gifts');
    section.setAttribute('aria-label', 'Free update gifts');
    section.append(element('h3', 'Free update gifts'));
    const steps = element('ol', '', 'gift-steps');
    const { claimed, nextAt } = game.profile.updateGifts;
    AG.UPDATE_GIFTS.forEach(({ wait, rewards }, index) => {
      const step = element('li', '', 'gift-step');
      if (index === claimed) step.classList.add('gift-current');
      const items = element('ul', '', 'gift-items');
      for (const [id, count] of Object.entries(rewards)) {
        const row = element('li');
        row.append(graphic(id), element('span', count.toLocaleString() + ' × ' + AG.itemName(id)));
        items.append(row);
      }
      step.append(element('h4', 'Gift ' + (index + 1)), items);
      if (index === claimed) {
        const claim = button('Claim free gift', () => {
          if (!game.claimUpdateGift()) return;
          state.result = 'Update gift claimed.';
          refresh();
        }, { primary: true });
        const update = () => {
          const remaining = Math.max(0, Math.ceil((nextAt - game.now()) / 1000));
          const text = remaining ? 'Ready in ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0') : 'Claim free gift';
          if (claim.textContent !== text) claim.textContent = text;
          claim.disabled = remaining > 0 || !game.canVisitBase();
          return remaining;
        };
        if (update()) {
          const timer = setInterval(() => {
            if (!claim.isConnected || !update()) clearInterval(timer);
          }, 250);
        }
        step.append(claim);
      } else {
        const status = index < claimed ? 'Claimed' : 'Unlocks ' + wait / 60000 + ' min after Gift ' + index;
        step.append(element('p', status, 'gift-status'));
      }
      steps.append(step);
    });
    section.append(steps);
    return section;
  }

  function renderArmory({ kind, state, game, body, button, element, open, dismiss, refresh }) {
    const profile = game.profile;
    const base = game.canVisitBase();
    const cards = element('div', '', 'cards armory-cards');
    const tiles = element('div', '', 'inventory-tiles');
    const eventTiles = element('div', '', 'inventory-tiles');
    const details = element('div', '', 'inventory-actions');
    const tileChoices = new Map();

    details.hidden = true;
    function selectTile(id, toggle = false) {
      const choice = tileChoices.get(id);
      if (!choice) return;
      hideTooltip();
      const closing = toggle && Object.hasOwn(CRATES, id) && state.selectedItem === id && state.showItemDetails;
      state.selectedItem = closing ? null : id;
      state.showItemDetails = Boolean(choice.action) && !closing;
      details.hidden = !state.showItemDetails;
      for (const [key, entry] of tileChoices) {
        entry.tile.setAttribute('aria-pressed', String(key === state.selectedItem));
        if (Object.hasOwn(CRATES, key)) entry.tile.setAttribute('aria-expanded', String(key === id && state.showItemDetails));
      }
      details.replaceChildren(...(state.showItemDetails ? [choice.action] : []));
    }

    function tileCard(id, action, count) {
      const item = ITEMS[id];
      const rarity = item.rarity ?? 'common';
      const tile = button('', () => selectTile(id, true));
      if (Object.hasOwn(CRATES, id)) tile.setAttribute('aria-expanded', 'false');
      tile.className = 'inventory-tile';
      tile.style.setProperty('--rarity', RARITIES[rarity]);
      decorateRarity(tile, item);
      itemHover(tile, id, false);
      tile.setAttribute('aria-label', AG.itemName(id) + ', ' + rarity + ', quantity ' + (count || 1));
      tile.append(graphic(id), element('b', '×' + (count || 1).toLocaleString(), 'inventory-count'));
      if (BOOSTS[id]) {
        tile.draggable = true;
        tile.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', id));
      }
      tiles.append(tile);
      tileChoices.set(id, { tile, action });
    }

    function card(id, text, action, count = 0) {
      if (kind === 'inventory') { tileCard(id, action, count); return; }
      const item = ITEMS[id];
      const row = element('div', '', 'card item-card');
      if (SHIPS[id]) decorateRarity(row, item);
      const copy = element('div');
      const header = element('strong', AG.itemName(id) + (count ? ' ×' + count : ''));
      const rarity = element('span', item.rarity ?? 'common', 'item-rarity');
      rarity.style.color = RARITIES[item.rarity ?? 'common'];
      copy.append(header, rarity, element('small', text));
      
      row.append(graphic(id), copy);
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
        pick.append(graphic(id), element('strong', AG.itemName(id)),
          element('small', ship.alien ? 'Alienated · ' + titleCase(ship.rarity) : titleCase(ship.rarity)));
        itemHover(pick, id, false);
        decorateRarity(pick, ship);
        list.append(pick);
      }
      body.append(list);
      footer();
    } else if (kind === 'merchant') {
      body.append(element('p', AG.formatCurrency(game.credits) + ' Credits available', 'panel-note'));
      const stock = game.merchantStock();
      const clock = element('p', '', 'panel-note');
      const updateStockClock = () => {
        const seconds = Math.max(0, Math.ceil((stock.until - game.now()) / 1000));
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
        const price = AG.merchantCatalog()[id];
        const sold = stock.sold.includes(id);
        card(id, ITEMS[id].description, button(sold ? 'Out of stock' : AG.formatCurrency(price) + ' Credits', () => {
          if (game.buyMerchant(id)) state.result = ITEMS[id].name + ' purchased.';
          refresh();
        }, { disabled: sold || !base || game.credits < price }));
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
      const relay = state.relayItem ?? 'boostRelay';
      const { capacity, types: maxTypes } = UPGRADES[relay].boostRelay;
      const stock = profile.boostReserves[relay];
      const types = Object.keys(stock).length;
      reserve.append(element('p', types + '/' + maxTypes + ' boost types · up to ' + capacity + ' copies per type', 'panel-note'));
      for (const [id, boost] of Object.entries(BOOSTS)) {
        const available = profile.boosts[id] ?? 0;
        const stored = stock[id] ?? 0;
        const unloading = state.relayTab === 'queue';
        if (unloading ? !stored : !available) continue;
        const row = element('div', '', 'reserve-row');
        const action = button(unloading ? 'Unload' : 'Load', () => {
          if (game.adjustBoostReserve(id, unloading ? -1 : 1, relay)) refresh();
        }, { disabled: !unloading && (stored >= capacity || (!stored && types >= maxTypes)) });
        row.append(graphic(id), element('span', boost.name + ' · ' + stored + '/' + capacity + ' loaded'), action);
        reserve.append(row);
      }
      if (reserve.children.length === 1) reserve.append(element('p', 'No boosts here yet.'));
      body.append(headings, reserve);
      footer();
    } else if (kind === 'shop') {
      const options = element('div', '', 'inventory-tabs');
      for (const [id, name] of [['ships', 'Spaceships'], ['crates', 'Star Gem crates'], ['flagship', 'Premium Shop']]) {
        const tab = menuIcon(button(name, () => { state.shopTab = id; refresh(); }), id);
        tab.setAttribute('aria-pressed', String(state.shopTab === id));
        options.append(tab);
      }
      body.append(options, element('p', AG.formatCurrency(game.credits) + ' Credits · ' + AG.formatCurrency(profile.gems) + ' Star Gems', 'panel-note'));
      if (state.shopTab === 'ships') {
        for (const id of Object.keys(AG.BASE_SHIPS).filter(id => Number.isFinite(SHIPS[id].price)).sort((a, b) => shipRank(b) - shipRank(a))) {
          const ship = SHIPS[id];
          if (!ship.price && game.shipCount(id)) continue;
          const owned = profile.unlocked.includes(id);
          card(id, ship.description, button(owned ? 'Owned' : ship.price ? AG.formatCurrency(ship.price) + ' Credits' : 'Reclaim Scout', () => {
            game.unlockShip(id);
            refresh();
          }, { disabled: !game.canUnlockShip(id) }));
        }
        body.append(cards);
      } else if (state.shopTab === 'flagship') {
        const shipGroup = element('section', '', 'supernova-shop');
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
        const buy = button('Buy for ' + (Number.isSafeInteger(price) ? AG.formatCurrency(price) + ' Star Gems' : 'maximum price'), () => {
          if (game.unlockFlagship('supernova')) state.result = 'Supernova acquired. Equip it in the Hangar.';
          refresh();
        }, { primary: true, disabled: !game.canUnlockFlagship('supernova') });
        const wait = element('p');
        const status = () => {
          const seconds = Math.ceil(game.flagshipWait() / 1000);
          wait.textContent = seconds ? 'Next purchase in ' + Math.floor(seconds / 60) + 'm ' + seconds % 60 + 's' : 'Available to purchase';
          buy.disabled = !game.canUnlockFlagship('supernova');
          return seconds;
        };
        if (status()) {
          const timer = setInterval(() => {
            if (!wait.isConnected || !status()) clearInterval(timer);
          }, 1000);
        }
        details.append(element('span', 'Godly', 'flagship-rarity'), element('h3', ship.name), stats,
          element('h4', ability.name), element('p', 'Absorbs up to ' + ability.capacity + ' damage. Recharges ' + ability.interval + ' seconds after the shield breaks.'),
          element('p', 'Owned ×' + game.shipCount('supernova') + ' · ' + AG.formatCurrency(profile.gems) + ' Star Gems saved'),
          savings, wait, buy);
        featured.append(visual, details);
        shipGroup.append(featured);
        body.append(shipGroup);
        if (AG.contentActive()) {
          const id = 'boostOverdrive';
          const item = UPGRADES[id];
          const feature = element('article', '', 'overdrive-feature');
          const art = element('div', '', 'overdrive-art');
          art.append(graphic(id));
          const info = element('div', '', 'overdrive-info');
          const benefits = element('ul', '', 'overdrive-benefits');
          const { types, capacity } = item.boostRelay;
          for (const benefit of [
            'Loads up to ' + types + ' different boost types',
            'Stores up to ' + capacity + ' boosts of each type',
            'Activates eligible boosts with no delay'
          ]) benefits.append(element('li', benefit));
          const rarity = element('span', 'Mythical · Ability upgrade', 'overdrive-rarity');
          info.append(rarity, element('h3', item.name), benefits, button('Buy · ' + item.premium + ' Star Gems', () => {
            if (game.buyPremiumUpgrade(id)) state.result = item.name + ' purchased.';
            refresh();
          }, { disabled: !base || profile.gems < item.premium }));
          feature.append(art, info);
          body.append(feature);
        }
        if (AG.contentActive(game.now())) body.append(renderUpdateGifts(game, state, element, button, refresh));
      } else if (AG.contentActive()) {
        body.append(renderCrateShop(game, state, element, button, refresh));
      } else {
        for (const [id, crate] of Object.entries(CRATES)) {
          if (!crate.price || !AG.itemAvailable(id)) continue;
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
            else if (valid) buy.textContent = 'Buy · ' + AG.formatCurrency(count * crate.price) + ' Star Gems';
            else buy.textContent = 'Choose 1–' + limit.toLocaleString();
          }
          quantity.addEventListener('input', updateTotal);
          updateTotal();
          controls.append(quantity, buy);
          card(id, crate.price + ' Star Gems each', controls);
        }
        body.append(element('p', 'Duplicate ships and upgrades add to the copies you own.', 'panel-note'));
      }
      if (state.shopTab === 'crates' && !AG.contentActive()) body.append(cards);
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
        for (const id of sortItems(AG.MATERIALS, () => 0)) {
          if (!AG.itemAvailable(id) || !profile.materials[id]) continue;
          card(id, ITEMS[id].description, null, profile.materials[id]);
          if (id.startsWith('alien')) eventTiles.append(tileChoices.get(id).tile);
        }
      } else {
        for (const id of sortItems(CRATES, crate => crate.price)) {
          if (!AG.itemAvailable(id) || !profile.crates[id]) continue;
          const count = profile.crates[id];
          if (CRATES[id].bundle) {
            card(id, '', button('Open bundle', () => {
              const rewards = game.openBundle(id);
              state.result = rewards ? Object.entries(rewards).map(([id, quantity]) => AG.itemName(id) + ' ×' + quantity).join(' · ') : 'Bundle could not be opened.';
              refresh();
            }, { primary: true }), count);
            continue;
          }
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
          if (tiles.children.length) scroll.append(tiles);
          if (eventTiles.children.length) scroll.append(element('h3', 'Event', 'inventory-subsection'), eventTiles);
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
      renderRecipes(body, element, button, game, state, refresh);
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
        state.result = ok ? AG.itemName(id) + ' fitted.' : 'Choose a matching mount and an available copy.';
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
          (effects.boostRelay ? ' · ' + AG.itemName(effects.boostRelay) : '') +
          (effects.barrels > 1 ? ' · ' + effects.barrels + ' projectiles per volley' : '');
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
            state.result = AG.itemName(mounted) + ' removed.';
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
        if (UPGRADES[mounted]?.boostRelay) mount.addEventListener('contextmenu', event => {
          event.preventDefault(); open('autoBoost', { ship, relayItem: mounted });
        });
        mount.append(element('small', locked ? 'Unavailable' :
          mounted ? AG.itemName(mounted) : 'Empty'));
        if (!locked) {
          mount.addEventListener('dragover', event => { if (compatible()) { event.preventDefault(); predict(); } });
          mount.addEventListener('drop', event => { event.preventDefault(); place(slot, event.dataTransfer.getData('text/plain')); });
        }
        diagram.append(mount);
      }
      for (const id of sortItems(UPGRADES, item => item.speed ?? item.damage ?? 0)) {
        if (!profile.upgrades[id]) continue;
        const part = UPGRADES[id];
        const exhausted = Object.values(crafts).filter(mounted => mounted === id).length >= profile.upgrades[id];
        const choose = button('', () => {
          if (exhausted) return;
          state.part = state.part === id ? '' : id; state.selectedUpgrade = id; refresh();
        });
        choose.classList.toggle('spent-part', exhausted);
        if (exhausted) choose.setAttribute('aria-disabled', 'true');
        choose.append(graphic(id), element('span', AG.itemName(id)));
        choose.style.setProperty('--rarity', RARITIES[part.rarity]);
        itemHover(choose, id, false);
        choose.draggable = !exhausted;
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
      body.append(element('h3', AG.itemName(ship)));
      for (const id of new Set(Object.values(crafts))) {
        if (UPGRADES[id]?.boostRelay) body.append(button('Configure ' + AG.itemName(id), () => open('autoBoost', { ship, relayItem: id })));
      }
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
