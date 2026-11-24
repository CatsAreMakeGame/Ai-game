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
    if (['credit', 'gem'].includes(id)) {
      const image = document.createElement('img');
      image.src = item.file;
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

  function revealCrate(crateId, result, element, button) {
    const crate = CRATES[crateId];
    const item = ITEMS[result.rolled];
    const dialog = element('dialog', '', 'crate-reveal');
    const title = element('h2', crate.name);
    title.id = 'crate-reveal-title';
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.style.setProperty('--reward', RARITIES[item.rarity ?? 'common']);
    const viewport = element('div', '', 'reel-window');
    viewport.setAttribute('aria-hidden', 'true');
    const track = element('div', '', 'reel-track');
    const marker = element('div', '', 'reel-marker');
    const pool = crate.outcomes.flatMap(entry => entry.items);
    const stopAt = 16;
    let winner;
    for (let index = 0; index < stopAt + 4; index++) {
      const winning = index === stopAt;
      const id = winning ? result.rolled : pool[(index + 1) % pool.length];
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
      { duration: 2450, easing: 'cubic-bezier(.12,.73,.15,1)' });
    animation.addEventListener('finish', showReward, { once: true });
  }

  function renderArmory({ kind, state, game, body, button, element, open, dismiss, refresh }) {
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
      row.append(graphic(id), copy, action);
      cards.append(row);
    }

    function footer(...actions) {
      const row = element('div', '', 'home-actions');
      row.append(...actions, button('Back', dismiss));
      body.append(row);
    }

    if (kind === 'shop') {
      const options = element('div', '', 'inventory-tabs');
      for (const [id, name] of [['ships', 'Credit ships'], ['crates', 'Star Gem crates']]) {
        const tab = button(name, () => { state.shopTab = id; refresh(); });
        tab.setAttribute('aria-pressed', String(state.shopTab === id));
        options.append(tab);
      }
      body.append(options, element('p', game.credits.toLocaleString() + ' Credits · ' + profile.gems + ' Star Gems', 'panel-note'));
      if (state.shopTab === 'ships') {
        for (const id of sortItems(SHIPS, ship => ship.price ?? 0)) {
          const ship = SHIPS[id];
          if (!ship.price) continue;
          const owned = profile.unlocked.includes(id);
          card(id, ship.description, button(owned ? 'Owned' : ship.price.toLocaleString() + ' Credits', () => {
            game.unlockShip(id);
            refresh();
          }, { disabled: !game.canUnlockShip(id) }));
        }
      } else {
        const label = element('label', '', 'crate-switch');
        const toggle = element('input');
        toggle.type = 'checkbox';
        toggle.checked = state.autoOpen;
        toggle.addEventListener('change', () => { state.autoOpen = toggle.checked; });
        label.append(toggle, element('span', 'Open crates immediately on purchase'));
        body.append(label);
        for (const [id, crate] of Object.entries(CRATES)) {
          card(id, crateOdds(crate), button(crate.price + ' Star Gems', () => {
            const result = game.buyCrate(id, state.autoOpen);
            if (result) state.result = result.rolled ? '' : 'Crate added to inventory.';
            refresh();
            if (result?.rolled) revealCrate(id, result, element, button);
          }, { disabled: !base || profile.gems < crate.price }));
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
        for (const [id, label] of [['ships', 'Ships'], ['upgrades', 'Upgrades'], ['boosts', 'Boosts'], ['crates', 'Crates']]) {
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
          card(id, SHIPS[id].description, button(equipped ? 'Equipped' : 'Equip', () => {
            game.equip(id); refresh();
          }, { disabled: equipped || !base }));
        }
      } else if (tab === 'upgrades') {
        for (const id of sortItems(UPGRADES, part => (part.damage ?? part.speed ?? 0))) {
          if (!profile.upgrades[id]) continue;
          card(id, UPGRADES[id].description, button('Outfit ship', () => open('outfit')), profile.upgrades[id]);
        }
      } else if (tab === 'boosts') {
        for (const id of sortItems(BOOSTS, boost => boost.repair ?? boost.duration)) {
          if (!profile.boosts[id]) continue;
          card(id, BOOSTS[id].description, button('Use', () => {
            game.useBoost(id); refresh();
          }, { disabled: !game.canUseBoost(id) }), profile.boosts[id]);
        }
      } else {
        for (const id of sortItems(CRATES, crate => crate.price)) {
          if (!profile.crates[id]) continue;
          card(id, crateOdds(CRATES[id]), button('Open', () => {
            const result = game.openCrate(id);
            if (result) state.result = '';
            refresh();
            if (result) revealCrate(id, result, element, button);
          }), profile.crates[id]);
        }
      }
      if (!cards.children.length) cards.append(element('p', 'No ' + tab + ' collected yet.', 'panel-note'));
      body.append(cards);
      const options = [button('Outfit ship', () => open('outfit'))];
      if (base) options.push(button('Shop', () => open('shop')));
      footer(...options);
    } else {
      const ship = profile.ship;
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
      for (const [slot, [type, name]] of Object.entries(SLOTS)) {
        const mounted = crafts[slot];
        const locked = slot === 'special' || (type === 'Engine' && +slot.slice(-1) > SHIPS[ship].engines);
        const mount = button(name, () => {
          if (state.part) place(slot, state.part);
          else if (mounted) {
            game.mountUpgrade(ship, slot, null);
            state.result = ITEMS[mounted].name + ' removed.';
            refresh();
          }
        }, { disabled: locked });
        mount.className = 'mount mount-' + slot;
        mount.append(element('small', locked ? (slot === 'special' ? 'Reserved' : 'Unavailable') :
          mounted ? ITEMS[mounted].name : 'Empty'));
        if (!locked) {
          mount.addEventListener('dragover', event => { if (UPGRADES[state.part]?.slot === type) event.preventDefault(); });
          mount.addEventListener('drop', event => { event.preventDefault(); place(slot, event.dataTransfer.getData('text/plain')); });
        }
        diagram.append(mount);
      }
      for (const id of sortItems(UPGRADES, item => item.speed ?? item.damage ?? 0)) {
        if (!profile.upgrades[id]) continue;
        const part = UPGRADES[id];
        const free = profile.upgrades[id] - Object.values(crafts).filter(value => value === id).length;
        const choose = button(part.name + ' · ' + free + ' free', () => { state.part = id; refresh(); });
        choose.style.setProperty('--rarity', RARITIES[part.rarity]);
        choose.title = part.slot + ' · ' + part.description;
        choose.draggable = true;
        choose.setAttribute('aria-pressed', String(state.part === id));
        choose.addEventListener('dragstart', event => {
          state.part = id;
          event.dataTransfer.setData('text/plain', id);
          event.dataTransfer.effectAllowed = 'copy';
        });
        parts.append(choose);
      }
      if (!parts.children.length) parts.append(element('p', 'Collect upgrades in flight or open an Upgrade Crate.', 'panel-note'));
      const effects = game.upgradeEffects();
      const bonuses = 'Speed +' + Math.round((effects.speed - 1) * 100) + '% · Damage +' + effects.damage +
        ' per shot · ' + (effects.vertical ? 'All-direction steering' : 'Horizontal steering');
      body.append(element('p', SHIPS[ship].name + ' · ' + bonuses, 'outfit-summary'),
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
