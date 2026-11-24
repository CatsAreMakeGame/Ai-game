(() => {
  'use strict';

  const AG = window.AG;
  const UNLOCK_CODE = 'ADMIN99';

  function renderAdmin({ body, game, button, element, dismiss, resumeFlight, enterTesting, exitTesting, refresh, shop, inventory }) {
    if (!game.testing) {
      const form = element('form', '', 'admin-group');
      const label = element('label', 'Access code');
      const input = element('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.required = true;
      label.append(input);
      const submit = button('Unlock testing', () => {}, { primary: true });
      submit.type = 'submit';
      const status = element('p', '', 'admin-status');
      status.setAttribute('role', 'status');
      const actions = element('div', '', 'admin-actions');
      actions.append(submit);
      form.append(label, actions, status);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (input.value.trim() !== UNLOCK_CODE) {
          status.textContent = 'Incorrect access code.';
          input.focus();
          return;
        }
        enterTesting();
      });
      body.append(form);
      return;
    }

    const intro = element('p', 'Changes in testing mode stay out of your saved game.', 'panel-note');
    const status = element('p', '', 'admin-status');
    status.setAttribute('role', 'status');
    const phase = game.state === 'paused' ? game.resumeState : game.state;
    const flight = ['playing', 'intermission'].includes(phase);
    const run = flight ? game.run : null;

    function group(name) {
      const section = element('section', '', 'admin-group');
      section.append(element('h3', name));
      body.append(section);
      return section;
    }

    function actions(section, ...buttons) {
      const row = element('div', '', 'admin-actions');
      row.append(...buttons);
      section.append(row);
    }

    function select(section, name, choices) {
      const label = element('label', name);
      const field = element('select');
      for (const [value, text] of choices) {
        const option = element('option', text);
        option.value = value;
        field.append(option);
      }
      label.append(field);
      section.append(label);
      return field;
    }

    function waveJump(number) {
      if (!flight) game.start();
      const current = game.run;
      current.enemies = [];
      current.drops = [];
      game.beginWave(number);
      resumeFlight();
    }

    body.append(intro);
    const items = group('Give yourself an item');
    const categories = [
      ['Ship', AG.SHIPS], ['Upgrade', AG.UPGRADES], ['Boost', AG.BOOSTS], ['Crate', AG.CRATES],
      ['Currency', { credit: AG.ITEMS.credit, gem: AG.ITEMS.gem }]
    ];
    const choices = categories.flatMap(([category, catalog]) => Object.entries(catalog)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, spec]) => [id, category + ' · ' + spec.name]));
    const item = select(items, 'Item', choices);
    const amountLabel = element('label', 'Quantity');
    const amount = element('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.value = '1';
    amountLabel.append(amount);
    items.append(amountLabel);
    const feedback = element('p', '', 'admin-status');
    feedback.setAttribute('role', 'status');
    function updateQuantity() {
      amount.disabled = Object.hasOwn(AG.SHIPS, item.value);
      if (amount.disabled) amount.value = '1';
      feedback.textContent = '';
    }
    item.addEventListener('change', updateQuantity);
    updateQuantity();

    function quantity() {
      const count = amount.disabled ? 1 : amount.valueAsNumber;
      const id = item.value;
      const profile = game.profile;
      const owned = id === 'credit' ? profile.credits : id === 'gem' ? profile.gems :
        (profile.upgrades[id] ?? profile.boosts[id] ?? profile.crates[id] ?? 0);
      if (Number.isSafeInteger(count) && count >= 1 && Number.isSafeInteger(owned + count)) return count;
      feedback.textContent = 'Enter a positive whole quantity that keeps your total within the safe number range.';
      amount.focus();
      return null;
    }

    const itemActions = [button('Grant item', () => {
      const count = quantity();
      if (count === null) return;
      const id = item.value;
      const name = AG.ITEMS[id].name;
      feedback.textContent = game.grantItem(id, count)
        ? name + (amount.disabled ? ' unlocked.' : ' ×' + count.toLocaleString() + ' added.')
        : name + ' is already owned.';
    }, { primary: true }), button('Open Inventory', inventory)];
    if (run) itemActions.push(button('Spawn item pickup', () => {
      const count = quantity();
      if (count === null) return;
      game.dropItem(item.value, run.player.x, run.player.y - 100, count);
      feedback.textContent = AG.ITEMS[item.value].name + ' dropped in the flight lane.';
    }));
    actions(items, ...itemActions);
    items.append(feedback);

    const wave = group('Wave controls');
    const label = element('label', 'Wave number (1–2,147,483,647)');
    const number = element('input');
    number.type = 'number';
    number.min = '1';
    number.value = String(run?.wave ?? 1);
    number.step = '1';
    label.append(number);
    wave.append(label);
    actions(wave, button('Jump to wave', () => {
      if (Number.isInteger(number.valueAsNumber) && number.valueAsNumber >= 1) waveJump(Math.min(AG.MAX_WAVE, number.valueAsNumber));
      else {
        status.textContent = 'Enter a positive whole wave number.';
        number.focus();
      }
    }), button('Fresh test run', () => { game.start(); resumeFlight(); }));

    if (run) {
      actions(wave, button('Clear wave', () => {
        for (const type of run.pending) if (AG.BOSSES[type]) game.spawn(type);
        run.pending.length = 0;
        while (run.enemies.length) game.removeEnemy(0, true);
        run.resolved = run.total;
        game.finishWave();
        dismiss();
      }, { disabled: phase !== 'playing' }), button('Test game over', () => {
        game.finish('gameover');
        dismiss();
      }));

      const pilot = group('Pilot and currency');
      const god = button('Invulnerability', () => {
        run.godMode = !run.godMode;
        god.setAttribute('aria-pressed', String(run.godMode));
      });
      god.setAttribute('aria-pressed', String(Boolean(run.godMode)));
      actions(pilot, god, button('Restore hull', () => {
        game.repair(run.ship.hull);
        status.textContent = 'Hull restored.';
      }), button('Set hull to 25%', () => {
        run.player.hp = Math.ceil(run.ship.hull / 4);
        status.textContent = 'Hull reduced to 25%.';
      }), button('Level up', () => {
        if (run.level < 50) game.gainXp(AG.xpForLevel(run.level) - run.xp);
        status.textContent = 'Pilot level ' + run.level + '.';
      }), button('+1,000 Credits', () => {
        game.grantItem('credit', 1000);
        status.textContent = game.credits + ' Credits available.';
      }));

      const combat = group('Enemy testing');
      const enemy = select(combat, 'Enemy type', Object.keys(AG.ENEMIES)
        .map(id => [id, AG.BOSSES[id]?.name ?? (id[0].toUpperCase() + id.slice(1))]));
      actions(combat, button('Spawn enemy', () => {
        game.spawn(enemy.value, true);
        status.textContent = 'Enemy spawned.';
      }, { disabled: phase !== 'playing' }));
    }

    const profile = group('Shop testing');
    actions(profile, button('+5 Star Gems', () => {
      game.grantItem('gem', 5);
      status.textContent = game.profile.gems + ' Star Gems available.';
    }), button('+5,000 Credits', () => {
      game.grantItem('credit', 5000);
      status.textContent = game.credits + ' Credits available.';
    }));
    if (!flight) actions(profile, button('Open Shop', shop));
    const reset = group('Testing data');
    actions(reset, button('Clear all testing data', () => {
      reset.replaceChildren(element('h3', 'Delete all testing progress?'),
        element('p', 'This clears the testing run, ships, inventory and currency. Normal progress stays saved.', 'panel-note'));
      actions(reset, button('Clear testing data', () => {
        game.clearTestingData();
        refresh();
      }), button('Cancel', refresh));
    }));
    const leave = element('div', '', 'admin-actions');
    leave.append(button(flight ? 'Back to flight' : 'Back', dismiss, { primary: true }),
      button('Exit testing', exitTesting));
    body.append(status, leave);
  }

  AG.renderAdmin = renderAdmin;
})();
