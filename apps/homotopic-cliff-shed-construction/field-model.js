/* Heuristic layout only. Affinities are not prerequisite, time or resource rules. */
(function (root) {
  'use strict';
  const types = {
    foundation: { name: 'Foundation / anchoring', color: '#74539c' },
    structure: { name: 'Structural', color: '#9e6427' },
    weatherproofing: { name: 'Weatherproofing', color: '#267862' },
    safety: { name: 'Safety systems', color: '#b64f4f' }
  };
  const taskData = [
    ['Drill anchor points', 'foundation', 'critical'], ['Install expansion bolts', 'foundation', 'critical'],
    ['Test anchor loads', 'foundation', 'high'], ['Level platform base', 'foundation', 'high'],
    ['Assemble floor frame', 'structure', 'high'], ['Install wall panels', 'structure', 'medium'],
    ['Mount roof trusses', 'structure', 'medium'], ['Secure joints', 'structure', 'high'],
    ['Install roof membrane', 'weatherproofing', 'critical'], ['Seal wall joints', 'weatherproofing', 'high'],
    ['Add wind bracing', 'weatherproofing', 'critical'], ['Install door seals', 'weatherproofing', 'medium'],
    ['Install safety railings', 'safety', 'critical'], ['Add emergency anchors', 'safety', 'critical'],
    ['Mount first aid station', 'safety', 'high'], ['Test egress routes', 'safety', 'high']
  ];
  const tasks = taskData.map(([name, type, priority], i) => ({ id: i + 1, name, type, priority }));
  const SEED = 190, MAX_STEPS = 600, MIN = 18, MAX = 382;
  function initial(seed = SEED) {
    let state = seed >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    return tasks.map(task => ({ ...task, x: 50 + random() * 300, y: 50 + random() * 300, vx: 0, vy: 0 }));
  }
  function affinity(a, b) {
    if (a.type === b.type) return 1.2;
    const pair = [a.type, b.type].sort().join(':');
    if (pair === 'foundation:structure') return .8;
    if (pair === 'structure:weatherproofing') return .6;
    if (a.type === 'safety' || b.type === 'safety') return .4;
    return -.3;
  }
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function step(state, strength) {
    if (!Number.isFinite(strength) || strength < .1 || strength > 2) throw new RangeError('Strength must be between 0.1 and 2.');
    if (state.length !== tasks.length || state.some(p => ![p.x, p.y, p.vx, p.vy].every(Number.isFinite))) throw new RangeError('The layout requires 16 finite task positions.');
    return state.map((point, i) => {
      let fx = 0, fy = 0;
      state.forEach((other, j) => {
        if (i === j) return;
        let dx = other.x - point.x, dy = other.y - point.y;
        let distance = Math.hypot(dx, dy);
        // Coincident points separate deterministically; no division by zero.
        if (distance < 1e-6) { dx = i < j ? .001 : -.001; dy = .0005 * (i < j ? 1 : -1); distance = Math.hypot(dx, dy); }
        if (distance >= 150) return;
        const weight = point.priority === 'critical' || other.priority === 'critical' ? 1.5 : 1;
        const attraction = strength * affinity(point, other) * weight * (1 - distance / 150);
        const spacing = point.type === other.type ? 38 : 60;
        const repulsion = Math.max(0, spacing - distance) * .12;
        fx += (attraction - repulsion) * dx / distance;
        fy += (attraction - repulsion) * dy / distance;
      });
      let vx = clamp(point.vx * .88 + fx * .12, -3, 3);
      let vy = clamp(point.vy * .88 + fy * .12, -3, 3);
      const x = clamp(point.x + vx, MIN, MAX), y = clamp(point.y + vy, MIN, MAX);
      if (x === MIN || x === MAX) vx = 0;
      if (y === MIN || y === MAX) vy = 0;
      return { ...point, x, y, vx, vy };
    });
  }
  function links(state) {
    const result = [];
    state.forEach((a, i) => state.slice(i + 1).forEach(b => {
      if (affinity(a, b) > 0 && Math.hypot(a.x - b.x, a.y - b.y) < 100) result.push([a.id, b.id]);
    }));
    return result;
  }
  root.CliffTaskField = { types, tasks, SEED, MAX_STEPS, MIN, MAX, initial, step, links, affinity };
})(globalThis);
