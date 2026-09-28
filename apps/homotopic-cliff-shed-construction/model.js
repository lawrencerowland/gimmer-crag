/* A drawing model: no costs, dates, forces or feasible project states are encoded. */
(function (root) {
  'use strict';
  const approaches = [
    { id: 'helicopter', name: 'Helicopter Assembly', short: 'Helicopter', color: '#b9543e', description: 'Pre-fabricated modules are assembled on the ground and airlifted to the cliff.', milestones: [
      { name: 'Ground Assembly', x: 100, y: 350 }, { name: 'Weather Window', x: 150, y: 250 },
      { name: 'Airlift', x: 250, y: 200 }, { name: 'Cliff Assembly', x: 350, y: 50 }
    ] },
    { id: 'rope', name: 'Rope & Pulley System', short: 'Rope & pulley', color: '#397096', description: 'Materials are hauled up incrementally using a rope and pulley system.', milestones: [
      { name: 'Base Camp', x: 100, y: 350 }, { name: 'Pulley Install', x: 200, y: 300 },
      { name: 'Material Haul', x: 300, y: 150 }, { name: 'Cliff Build', x: 350, y: 50 }
    ] },
    { id: 'climbing', name: 'Climbing Construction', short: 'Climbing', color: '#786096', description: 'A climbing team establishes access, builds a platform and assembles the shelter in place.', milestones: [
      { name: 'Team Staging', x: 100, y: 350 }, { name: 'Route Setup', x: 120, y: 200 },
      { name: 'Platform Build', x: 250, y: 100 }, { name: 'Shed Assembly', x: 350, y: 50 }
    ] }
  ];
  function interpolate(fromIndex, toIndex, t) {
    const from = approaches[fromIndex], to = approaches[toIndex];
    if (!from || !to || !Number.isFinite(t) || t < 0 || t > 1) throw new RangeError('Choose two approaches and a blend from 0 to 1.');
    return from.milestones.map((point, i) => ({
      x: point.x + (to.milestones[i].x - point.x) * t,
      y: point.y + (to.milestones[i].y - point.y) * t
    }));
  }
  root.CliffPaths = { approaches, interpolate };
})(globalThis);
