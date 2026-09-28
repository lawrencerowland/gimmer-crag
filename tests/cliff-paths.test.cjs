const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'apps/homotopic-cliff-shed-construction/model.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'apps/homotopic-cliff-shed-construction/field-model.js'), 'utf8'), context);
const { approaches, interpolate } = context.CliffPaths;
const copy = value => JSON.parse(JSON.stringify(value));
const coords = approach => copy(approach.milestones.map(({ x, y }) => ({ x, y })));

test('all six ordered comparisons reproduce both source drawings exactly', () => {
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) {
    assert.deepEqual(copy(interpolate(a, b, 0)), coords(approaches[a]));
    assert.deepEqual(copy(interpolate(a, b, 1)), coords(approaches[b]));
  }
});

test('the companion field preserves all sixteen source task records', () => {
  const M = context.CliffTaskField;
  assert.deepEqual(copy(M.tasks.map(t => t.name)), [
    'Drill anchor points', 'Install expansion bolts', 'Test anchor loads', 'Level platform base',
    'Assemble floor frame', 'Install wall panels', 'Mount roof trusses', 'Secure joints',
    'Install roof membrane', 'Seal wall joints', 'Add wind bracing', 'Install door seals',
    'Install safety railings', 'Add emergency anchors', 'Mount first aid station', 'Test egress routes'
  ]);
  assert.deepEqual(copy(M.tasks.map(t => t.type)), ['foundation', 'foundation', 'foundation', 'foundation', 'structure', 'structure', 'structure', 'structure', 'weatherproofing', 'weatherproofing', 'weatherproofing', 'weatherproofing', 'safety', 'safety', 'safety', 'safety']);
  assert.deepEqual(copy(M.tasks.map(t => t.priority)), ['critical', 'critical', 'high', 'high', 'high', 'medium', 'medium', 'high', 'critical', 'high', 'critical', 'medium', 'critical', 'critical', 'high', 'high']);
});

test('seeded field runs are reproducible, finite and bounded throughout the declared horizon', () => {
  const M = context.CliffTaskField;
  assert.deepEqual(copy(M.initial()), copy(M.initial(190)));
  assert.notDeepEqual(copy(M.initial(190)), copy(M.initial(191)));
  for (const strength of [.1, .5, 2]) {
    let a = M.initial(), b = M.initial();
    for (let step = 0; step < M.MAX_STEPS; step++) {
      const previous = copy(a);
      const next = M.step(a, strength);
      assert.deepEqual(copy(a), previous, 'a step must not mutate the preceding snapshot');
      a = next; b = M.step(b, strength);
      for (const p of a) {
        assert.ok([p.x, p.y, p.vx, p.vy].every(Number.isFinite));
        assert.ok(p.x >= M.MIN && p.x <= M.MAX && p.y >= M.MIN && p.y <= M.MAX);
        assert.ok(Math.abs(p.vx) <= 3 && Math.abs(p.vy) <= 3);
      }
    }
    assert.deepEqual(copy(a), copy(b));
  }
  const overlap = M.initial().map(p => ({ ...p, x: 200, y: 200 }));
  assert.ok(M.step(overlap, 2).every(p => [p.x, p.y, p.vx, p.vy].every(Number.isFinite)), 'coincident dots cannot divide by zero');
  assert.throws(() => M.step(M.initial(), NaN));
  assert.throws(() => M.step(M.initial(), 3));
});

test('a known midpoint and reverse blend agree; all sampled blends fix the two endpoints', () => {
  assert.deepEqual(copy(interpolate(0, 1, .5)), [{ x: 100, y: 350 }, { x: 175, y: 275 }, { x: 275, y: 175 }, { x: 350, y: 50 }]);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let step = 0; step <= 100; step++) {
    const forward = copy(interpolate(a, b, step / 100));
    const reverse = copy(interpolate(b, a, 1 - step / 100));
    assert.deepEqual(forward[0], { x: 100, y: 350 });
    assert.deepEqual(forward[3], { x: 350, y: 50 });
    forward.forEach((p, i) => { assert.ok(Math.abs(p.x - reverse[i].x) < 1e-9); assert.ok(Math.abs(p.y - reverse[i].y) < 1e-9); });
  }
});

test('invalid indices or blend values cannot produce a misleading path', () => {
  for (const args of [[-1, 0, .5], [0, 3, .5], [0, 1, NaN], [0, 1, -1], [0, 1, 1.1]]) assert.throws(() => interpolate(...args));
});

test('App 28 belongs only to the broader collection and has a complete return journey', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'planning/gimmer-collections.json')));
  const broad = fs.readFileSync(path.join(root, 'app-index.html'), 'utf8');
  const process = fs.readFileSync(path.join(root, 'petri-smc-wbs.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'apps/homotopic-cliff-shed-construction/index.html'), 'utf8');
  assert.equal(manifest.broader_collection.filter(n => n === 28).length, 1);
  assert.equal(manifest.processes_to_plans.includes(28), false);
  assert.match(broad, /id="app-28"><a[^>]*href="apps\/homotopic-cliff-shed-construction\/index.html"/);
  assert.doesNotMatch(process, /apps\/homotopic-cliff-shed-construction/);
  assert.match(app, /href="\.\.\/\.\.\/app-index.html#app-28"/);
  assert.equal((app.match(/Unknown · not modelled/g) || []).length, 4);
  assert.match(app, /not a proof that the construction approaches are homotopic as feasible plans/);
  assert.match(app, /c9481a81a731682906837b500602948407d5f630\/input\/homotopic-cliff-shed-construction.tsx/);
});
