(function () {
  'use strict';
  const M = globalThis.CliffTaskField, id = key => document.getElementById(key);
  const ns = 'http://www.w3.org/2000/svg';
  let state = M.initial(), steps = 0, selected = 1, playing = false, frame = null, last = null, elapsed = 0;
  const nodes = new Map();
  function element(tag, attrs) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  M.tasks.forEach(task => {
    const node = element('g', { role: 'button', tabindex: '0', 'aria-label': `${task.id}. ${task.name}`, 'data-task': task.id, 'aria-pressed': 'false' });
    const circle = element('circle', { r: task.priority === 'critical' ? 13 : 11, fill: M.types[task.type].color, stroke: '#fffaf0', 'stroke-width': task.priority === 'critical' ? 3 : 1 });
    const label = element('text', { 'text-anchor': 'middle', dy: '.35em', fill: '#fff', 'font-size': 10, 'font-weight': 600 });
    label.textContent = task.id;
    node.append(circle, label);
    node.addEventListener('click', () => inspect(task.id));
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(task.id); } });
    id('field-nodes').append(node); nodes.set(task.id, node);
    const option = document.createElement('option'); option.value = task.id; option.textContent = `${task.id}. ${task.name}`; id('field-task').append(option);
  });
  function inspect(taskId) {
    selected = taskId;
    const task = M.tasks.find(item => item.id === selected);
    id('field-task').value = selected;
    id('field-task-name').textContent = task.name;
    id('field-task-description').textContent = `${M.types[task.type].name} · supplied priority: ${task.priority}.`;
    nodes.forEach((node, n) => { node.setAttribute('aria-pressed', String(n === selected)); node.classList.toggle('selected', n === selected); });
  }
  function draw() {
    state.forEach(task => nodes.get(task.id).setAttribute('transform', `translate(${task.x} ${task.y})`));
    id('field-links').replaceChildren(...M.links(state).map(([a, b]) => {
      const from = state[a - 1], to = state[b - 1];
      return element('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }));
    id('field-steps').textContent = `${steps} / ${M.MAX_STEPS} steps`;
  }
  function pause(message) {
    playing = false; last = null; elapsed = 0;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    id('field-play').textContent = 'Play layout'; id('field-play').setAttribute('aria-pressed', 'false');
    id('field-status').textContent = message || `Paused at step ${steps}.`;
  }
  function reset() { pause('Reset to the same starting positions (seed 190). Current strength retained.'); state = M.initial(); steps = 0; draw(); }
  function animate(time) {
    if (!playing) return;
    if (last !== null) elapsed += Math.min(250, time - last);
    last = time;
    while (elapsed >= 50 && steps < M.MAX_STEPS) { state = M.step(state, Number(id('field-strength').value)); steps++; elapsed -= 50; }
    draw();
    if (steps >= M.MAX_STEPS) { pause('600-step illustration complete. This is a run limit, not a convergence or optimality result. Play to restart from the same seed.'); return; }
    frame = requestAnimationFrame(animate);
  }
  id('field-play').addEventListener('click', () => {
    if (playing) { pause(); return; }
    if (steps === M.MAX_STEPS) reset();
    playing = true; last = null; elapsed = 0;
    id('field-play').textContent = 'Pause layout'; id('field-play').setAttribute('aria-pressed', 'true');
    id('field-status').textContent = 'Moving task dots using supplied affinities. No work is being scheduled.';
    frame = requestAnimationFrame(animate);
  });
  id('field-reset').addEventListener('click', reset);
  id('field-strength').addEventListener('input', () => { pause('Strength changed. Reset to compare from the same starting positions.'); id('field-strength-value').value = Number(id('field-strength').value).toFixed(1); });
  id('field-task').addEventListener('change', () => inspect(Number(id('field-task').value)));
  id('task-field').addEventListener('toggle', event => { if (playing && !event.currentTarget.open) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  inspect(1); draw();
})();
