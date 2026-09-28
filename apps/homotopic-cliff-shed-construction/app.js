(function () {
  'use strict';
  const { approaches, interpolate } = globalThis.CliffPaths;
  const byId = id => document.getElementById(id);
  const from = byId('from-path'), to = byId('to-path'), slider = byId('blend');
  const play = byId('play'), status = byId('playback-status');
  const ns = 'http://www.w3.org/2000/svg';
  let playing = false, frame = null, startTime = null, startBlend = 0;
  const pointString = points => points.map(p => `${p.x},${p.y}`).join(' ');
  function svgElement(tag, attrs) {
    const element = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }
  function render() {
    const a = approaches[Number(from.value)], b = approaches[Number(to.value)];
    const t = Number(slider.value) / 100;
    const points = interpolate(Number(from.value), Number(to.value), t);
    byId('blend-path').setAttribute('points', pointString(points));
    byId('blend-value').value = `${Math.round(t * 100)}%`;
    slider.setAttribute('aria-valuetext', `${Math.round(t * 100)} percent from ${a.name} toward ${b.name}`);
    byId('from-label').textContent = a.short;
    byId('to-label').textContent = b.short;
    byId('diagram-title').textContent = `${Math.round(t * 100)} percent drawing blend from ${a.name} to ${b.name}`;
    const refs = byId('reference-paths');
    refs.replaceChildren(...[a, b].map(path => svgElement('polyline', { points: pointString(path.milestones), stroke: path.color })));
    const dots = byId('vertices');
    dots.replaceChildren(...points.map((point, i) => {
      const g = svgElement('g', { transform: `translate(${point.x} ${point.y})` });
      const circle = svgElement('circle', { r: 11, fill: '#fffaf0', stroke: '#173f42', 'stroke-width': 2 });
      const label = svgElement('text', { 'text-anchor': 'middle', dy: '.35em', fill: '#173f42', 'font-size': 11, 'font-weight': 700 });
      label.textContent = i + 1;
      g.append(circle, label);
      return g;
    }));
    byId('milestones').replaceChildren(...a.milestones.map((point, i) => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'dot-number'; n.textContent = i + 1;
      const names = document.createElement('span');
      names.textContent = `${point.name} → ${b.milestones[i].name}`;
      li.append(n, names); return li;
    }));
  }
  function pause(message) {
    playing = false; startTime = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    play.textContent = 'Play blend'; play.setAttribute('aria-pressed', 'false');
    status.textContent = message || `Paused at ${slider.value}%.`;
  }
  function animate(time) {
    if (!playing) return;
    if (startTime === null) startTime = time;
    const value = Math.min(100, startBlend + (time - startTime) / 80);
    slider.value = String(Math.round(value)); render();
    if (value >= 100) { pause('Reached the destination drawing. Play to start again.'); return; }
    frame = requestAnimationFrame(animate);
  }
  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    if (Number(slider.value) === 100) slider.value = '0';
    startBlend = Number(slider.value); startTime = null; playing = true;
    play.textContent = 'Pause blend'; play.setAttribute('aria-pressed', 'true');
    status.textContent = 'Playing the drawing blend. Pause at any point.';
    render(); frame = requestAnimationFrame(animate);
  });
  slider.addEventListener('input', () => { pause(); render(); });
  byId('reset').addEventListener('click', () => { slider.value = '0'; pause('Reset to the starting drawing.'); render(); });
  function changePair(event) {
    pause('Approaches changed. Blend reset to the starting drawing.');
    if (from.value === to.value) {
      const other = event.target === from ? to : from;
      other.value = String((Number(event.target.value) + 1) % approaches.length);
    }
    slider.value = '0'; render();
  }
  from.addEventListener('change', changePair); to.addEventListener('change', changePair);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  render();
})();
