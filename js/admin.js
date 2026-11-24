(() => {
  'use strict';

  const AG = window.AG;
  const UNLOCK_CODE = 'ADMIN99';

  function renderAdmin({ body, game, button, element, dismiss, resumeFlight, enterTesting, exitTesting }) {
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
    const wave = group('Wave controls');
    const label = element('label', 'Wave number (1–50)');
    const number = element('input');
    number.type = 'number';
    number.min = '1';
    number.max = String(AG.LAST_WAVE);
    number.value = String(run?.wave ?? 1);
    number.step = '1';
    label.append(number);
    wave.append(label);
    actions(wave, button('Jump to wave', () => {
      if (number.value && number.checkValidity()) waveJump(number.valueAsNumber);
      else {
        status.textContent = 'Enter a whole wave number from 1 to ' + AG.LAST_WAVE + '.';
        number.focus();
      }
    }), button('Fresh test run', () => { game.start(); resumeFlight(); }));

    if (run) {
      actions(wave, button('Clear wave', () => {
        if (run.pending.includes('boss')) game.spawn('boss');
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
        run.credits += 1000;
        status.textContent = run.credits + ' Credits available.';
      }));

      const items = group('Inventory and drops');
      const catalog = { ...AG.BOOSTS, ...AG.UPGRADES };
      const item = select(items, 'Item', Object.entries(catalog).map(([id, spec]) => [id, spec.name]));
      actions(items, button('Grant item', () => {
        status.textContent = catalog[item.value].name + (game.grantItem(item.value) ? ' added.' : ' already owned.');
      }), button('Spawn item pickup', () => {
        game.dropItem(item.value, run.player.x, run.player.y - 100);
        status.textContent = catalog[item.value].name + ' dropped in the flight lane.';
      }));
      const combat = group('Enemy testing');
      const enemy = select(combat, 'Enemy type', Object.keys(AG.ENEMIES)
        .map(id => [id, id === 'boss' ? 'Mothership' : id[0].toUpperCase() + id.slice(1)]));
      actions(combat, button('Spawn enemy', () => {
        game.spawn(enemy.value, true);
        status.textContent = 'Enemy spawned.';
      }, { disabled: phase !== 'playing' }));
    }

    const profile = group('Shop testing');
    actions(profile, button('+5 Star Gems', () => {
      game.profile.gems += 5;
      status.textContent = game.profile.gems + ' Star Gems available.';
    }));
    const leave = element('div', '', 'admin-actions');
    leave.append(button(flight ? 'Back to flight' : 'Back', dismiss, { primary: true }),
      button('Exit testing', exitTesting));
    body.append(status, leave);
  }

  AG.renderAdmin = renderAdmin;
})();
