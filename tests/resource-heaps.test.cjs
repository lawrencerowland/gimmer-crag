/* Independent discrete-time oracle and schedule-witness checks.
 * Run: node tests/resource-heaps.test.cjs
 * The oracle does not call the engine's validator, SGS, or verifier.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const enginePath = path.join(__dirname, '../apps/resource-heaps/model.js');
const sandbox = { module: { exports: {} }, console };
vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: enginePath });
const engine = sandbox.module.exports;
const pools = ['climbers', 'builders', 'porters'];
const copy = value => JSON.parse(JSON.stringify(value));
let comparisons = 0;
let witnesses = 0;
let oracleStates = 0;
let rejectedMutations = 0;
let maximumOracleStates = 0;

// Exhaustive breadth-first search in integer time. A state has the completed
// set and each running job's remaining duration. At every tick we may start
// ANY feasible subset of ready jobs, including none while other work runs.
// Consequently this includes intentional waiting, unlike a non-delay policy.
// With constant capacities and no dates/calendars, waiting when nothing runs
// cannot improve makespan and revisiting a state later cannot improve it.
function oracle(tasks, capacities) {
  const count = tasks.length;
  const all = (1 << count) - 1;
  const index = new Map(tasks.map((task, i) => [task.id, i]));
  const pred = tasks.map(task => task.predecessors.reduce((mask, id) => mask | (1 << index.get(id)), 0));
  const need = tasks.map(task => pools.map(pool => task.resources[pool] || 0));
  if (tasks.some((task, i) => need[i].some((amount, r) => amount > capacities[pools[r]]))) {
    return { makespan: Infinity, states: 0 };
  }
  const horizon = tasks.reduce((sum, task) => sum + task.duration, 0);
  const key = (done, remaining) => done + ':' + remaining.join(',');
  const queue = [{ done: 0, remaining: Array(count).fill(0), time: 0 }];
  const seen = new Set([key(0, queue[0].remaining)]);
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    if (state.done === all) return { makespan: state.time, states: seen.size };
    assert.ok(state.time < horizon, 'oracle reached serial horizon without completing');
    const used = pools.map(() => 0);
    let running = false;
    for (let i = 0; i < count; i++) {
      if (state.remaining[i] > 0) {
        running = true;
        need[i].forEach((amount, r) => { used[r] += amount; });
      }
    }
    const ready = tasks.flatMap((task, i) => (
      !(state.done & (1 << i)) && !state.remaining[i] && (pred[i] & state.done) === pred[i] ? [i] : []
    ));
    for (let subset = 0; subset < (1 << ready.length); subset++) {
      if (!running && subset === 0) continue;
      const load = used.slice();
      const remaining = state.remaining.slice();
      for (let bit = 0; bit < ready.length; bit++) {
        if (subset & (1 << bit)) {
          const i = ready[bit];
          remaining[i] = tasks[i].duration;
          need[i].forEach((amount, r) => { load[r] += amount; });
        }
      }
      if (load.some((amount, r) => amount > capacities[pools[r]])) continue;
      let done = state.done;
      for (let i = 0; i < count; i++) {
        if (remaining[i] > 0 && --remaining[i] === 0) done |= 1 << i;
      }
      const nextKey = key(done, remaining);
      if (!seen.has(nextKey)) {
        seen.add(nextKey);
        queue.push({ done, remaining, time: state.time + 1 });
      }
    }
    assert.ok(seen.size <= 250000, 'oracle fixture exceeds intentional 250000-state test budget');
  }
  return { makespan: Infinity, states: seen.size };
}

// This audit is deliberately separate from engine.verifySchedule. It checks
// the full intervals, both cumulative capacity and the concrete unit witness.
function audit(tasks, capacities, schedule) {
  assert.equal(schedule.length, tasks.length, 'coverage');
  const byId = new Map(schedule.map(entry => [entry.id, entry]));
  assert.equal(byId.size, tasks.length, 'unique schedule IDs');
  const finish = Math.max(0, ...schedule.map(entry => entry.end));
  const peak = Object.fromEntries(pools.map(pool => [pool, 0]));
  for (const task of tasks) {
    const entry = byId.get(task.id);
    assert.ok(entry, 'every required job exists');
    assert.ok(Number.isInteger(entry.start) && entry.start >= 0, 'integer nonnegative start');
    assert.equal(entry.end, entry.start + task.duration, 'uninterrupted duration');
    for (const parent of task.predecessors) assert.ok(byId.get(parent).end <= entry.start, 'physical prerequisite');
    for (const pool of pools) {
      const units = entry.units[pool] || [];
      assert.equal(units.length, task.resources[pool] || 0, 'unit demand count');
      assert.equal(new Set(units).size, units.length, 'distinct units within job');
      assert.ok(units.every(unit => Number.isInteger(unit) && unit >= 0 && unit < capacities[pool]), 'unit range');
    }
  }
  for (const pool of pools) {
    for (let time = 0; time < finish; time++) {
      const active = schedule.filter(entry => entry.start <= time && time < entry.end);
      const load = active.reduce((sum, entry) => sum + (tasks.find(task => task.id === entry.id).resources[pool] || 0), 0);
      assert.ok(load <= capacities[pool], 'cumulative capacity');
      peak[pool] = Math.max(peak[pool], load);
      const units = active.flatMap(entry => entry.units[pool] || []);
      assert.equal(new Set(units).size, units.length, 'no person double-booked');
    }
  }
  return { makespan: finish, peak };
}

function topologicalOrderCount(tasks) {
  const byId = new Map(tasks.map((task, i) => [task.id, i]));
  const memo = new Map();
  function visit(done) {
    if (done === (1 << tasks.length) - 1) return 1;
    if (memo.has(done)) return memo.get(done);
    let total = 0;
    tasks.forEach((task, i) => {
      if (!(done & (1 << i)) && task.predecessors.every(id => done & (1 << byId.get(id)))) total += visit(done | (1 << i));
    });
    memo.set(done, total);
    return total;
  }
  return visit(0);
}

function expectedBounds(tasks, capacities) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const cache = new Map();
  function pathFinish(id) {
    if (cache.has(id)) return cache.get(id);
    const task = byId.get(id);
    const result = task.duration + Math.max(0, ...task.predecessors.map(pathFinish));
    cache.set(id, result);
    return result;
  }
  const criticalPath = Math.max(0, ...tasks.map(task => pathFinish(task.id)));
  const resourceWork = Math.max(0, ...pools.map(pool => {
    const work = tasks.reduce((sum, task) => sum + task.duration * (task.resources[pool] || 0), 0);
    return work === 0 ? 0 : Math.ceil(work / capacities[pool]);
  }));
  return { criticalPath, resourceWork };
}

function compare(tasks, capacities, label) {
  const before = JSON.stringify({ tasks, capacities });
  const expected = oracle(tasks, capacities);
  const actual = engine.solveExact(tasks, capacities);
  comparisons++;
  oracleStates += expected.states;
  maximumOracleStates = Math.max(maximumOracleStates, expected.states);
  assert.equal(actual.ok, Number.isFinite(expected.makespan), label + ' feasible status');
  if (!actual.ok) {
    assert.ok(actual.errors.length, label + ' explains infeasibility');
    assert.equal(JSON.stringify({ tasks, capacities }), before, 'solver does not mutate input');
    return actual;
  }
  assert.equal(actual.bestMakespan, expected.makespan, label + ' independent optimum');
  assert.equal(actual.ordersChecked, topologicalOrderCount(tasks), label + ' all priority orders checked');
  const vectors = new Set();
  let optimal = 0;
  let previous = -Infinity;
  for (const result of actual.schedules) {
    assert.equal(result.ok, true);
    const checked = audit(tasks, capacities, result.schedule);
    assert.equal(result.makespan, checked.makespan, 'displayed finish');
    assert.deepEqual(copy(result.peak), checked.peak, 'displayed peak');
    assert.ok(result.makespan >= previous, 'schedule results ordered by objective');
    previous = result.makespan;
    const vector = tasks.map(task => result.schedule.find(entry => entry.id === task.id).start).join(',');
    assert.ok(!vectors.has(vector), 'unique start-vector representatives');
    vectors.add(vector);
    if (result.makespan === expected.makespan) optimal++;
    assert.equal(engine.verifySchedule(tasks, capacities, result.schedule).ok, true, 'engine also accepts independent witness');
    witnesses++;
  }
  assert.equal(actual.uniqueSchedules, vectors.size);
  assert.equal(actual.optimalCount, optimal);
  assert.equal(actual.best.makespan, expected.makespan);
  audit(tasks, capacities, actual.best.schedule);
  const bounds = expectedBounds(tasks, capacities);
  assert.equal(actual.criticalPathBound, bounds.criticalPath, 'critical path lower bound');
  assert.equal(actual.resourceWorkBound, bounds.resourceWork, 'resource-work lower bound');
  assert.ok(actual.bestMakespan >= Math.max(bounds.criticalPath, bounds.resourceWork));
  const priority = tasks.map(task => task.id).reverse();
  const chosen = engine.schedulePriority(tasks, capacities, priority);
  assert.equal(chosen.ok, true, 'arbitrary complete priority list can be dispatched');
  audit(tasks, capacities, chosen.schedule);
  assert.ok(chosen.makespan >= expected.makespan, 'user priority cannot beat exact optimum');
  const picked = new Set();
  for (const id of chosen.order) {
    const expectedNext = priority.find(candidate => !picked.has(candidate) && tasks.find(task => task.id === candidate).predecessors.every(parent => picked.has(parent)));
    assert.equal(id, expectedNext, 'highest-priority ready task selected');
    picked.add(id);
  }
  assert.equal(JSON.stringify({ tasks, capacities }), before, 'solver does not mutate inputs');
  return actual;
}

const defaultTasks = copy(engine.DEFAULT_TASKS);
const defaultCaps = copy(engine.DEFAULT_CAPACITIES);
assert.equal(defaultTasks.length, 6);
assert.deepEqual(defaultTasks.find(task => task.id === 'f').predecessors, ['a']);
const defaultResult = compare(defaultTasks, defaultCaps, 'default refuge');
assert.equal(defaultResult.ordersChecked, 10, 'fixed refuge partial order has ten linear extensions');

for (let climbers = 2; climbers <= 4; climbers++) {
  for (let builders = 3; builders <= 5; builders++) {
    for (let porters = 3; porters <= 5; porters++) {
      compare(defaultTasks, { climbers, builders, porters }, 'refuge capacity variation');
    }
  }
}
for (const durations of [[1, 1, 1, 1, 1, 1], [5, 5, 5, 5, 5, 5], [1, 5, 2, 4, 1, 3], [4, 1, 3, 1, 5, 2]]) {
  compare(defaultTasks.map((task, i) => ({ ...task, duration: durations[i] })), defaultCaps, 'refuge duration variation');
}

const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
for (let graph = 0; graph < 64; graph++) {
  const tasks = Array.from({ length: 4 }, (_, i) => ({
    id: 'j' + i, name: 'Synthetic ' + i, duration: [1, 2, 1, 2][i],
    resources: { climbers: [0, 1, 1, 0][i], builders: [2, 1, 2, 1][i], porters: [1, 0, 1, 1][i] },
    predecessors: pairs.flatMap(([from, to], bit) => to === i && graph & (1 << bit) ? ['j' + from] : [])
  }));
  for (const capacities of [{ climbers: 1, builders: 2, porters: 2 }, { climbers: 2, builders: 3, porters: 2 }]) compare(tasks, capacities, 'four-job DAG ' + graph);
}
let seed = 0x9e3779b9;
function random(max) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) % max;
}
for (let fixture = 0; fixture < 24; fixture++) {
  const capacities = { climbers: 1 + random(3), builders: 1 + random(3), porters: 1 + random(3) };
  const tasks = Array.from({ length: 5 }, (_, i) => ({
    id: 'r' + i, name: 'Synthetic ' + i, duration: 1 + random(3),
    resources: Object.fromEntries(pools.map(pool => [pool, random(capacities[pool] + 1)])),
    predecessors: Array.from({ length: i }, (_, parent) => parent).filter(() => random(3) === 0).map(parent => 'r' + parent)
  }));
  compare(tasks, capacities, 'seeded five-job model ' + fixture);
}

// Feasibility and bounded input contracts. Failures must be explicit, never
// manufactured as a start beyond the horizon or as an unassigned task.
for (const capacities of [
  { climbers: 1, builders: 3, porters: 3 },
  { climbers: 2, builders: 2, porters: 3 },
  { climbers: 2, builders: 3, porters: 2 },
  { climbers: 0, builders: 0, porters: 0 }
]) {
  compare(defaultTasks, capacities, 'insufficient capacity');
  const result = engine.schedulePriority(defaultTasks, capacities, defaultTasks.map(task => task.id));
  assert.equal(result.ok, false);
  assert.equal((result.schedule || []).length, 0);
}
const freeTask = [{ id: 'free', name: 'No team required', duration: 2, resources: {}, predecessors: [] }];
compare(freeTask, { climbers: 0, builders: 0, porters: 0 }, 'zero demand and zero capacity');
const chainEight = Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, name: 'Bound ' + i, duration: 1, resources: { builders: 1 }, predecessors: i ? ['n' + (i - 1)] : [] }));
compare(chainEight, { climbers: 0, builders: 1, porters: 0 }, 'eight-job API limit');
const independentEight = chainEight.map(task => ({ ...task, resources: {}, predecessors: [] }));
const fullBound = compare(independentEight, { climbers: 0, builders: 0, porters: 0 }, 'full eight-job enumeration');
assert.equal(fullBound.ordersChecked, 40320, 'maximum order space is completed without a hidden cutoff');
assert.equal(fullBound.uniqueSchedules, 1, 'equivalent priority words share one timed representative');

// A non-delay policy would start A and B at day zero, delaying C until day
// four and finishing D at ten. Waiting to start B until after C gives seven.
// This ensures the optimum claim is not accidentally narrowed to non-delay
// schedules. All four jobs are mandatory and the model has no dates/calendars.
const idleTrap = [
  { id: 'A', name: 'Prepare', duration: 1, resources: { builders: 1 }, predecessors: [] },
  { id: 'B', name: 'Independent long work', duration: 4, resources: { builders: 1 }, predecessors: [] },
  { id: 'C', name: 'Critical team operation', duration: 1, resources: { builders: 2 }, predecessors: ['A'] },
  { id: 'D', name: 'Follow-on', duration: 5, resources: { climbers: 1 }, predecessors: ['C'] }
];
const idleCaps = { climbers: 1, builders: 2, porters: 0 };
const idleResult = compare(idleTrap, idleCaps, 'deliberate waiting improves completion');
assert.equal(idleResult.bestMakespan, 7);
assert.equal(engine.schedulePriority(idleTrap, idleCaps, ['A', 'B', 'C', 'D']).makespan, 10);

function invalid(tasks, capacities, label) {
  assert.ok(engine.validateModel(tasks, capacities).length > 0, label);
  assert.equal(engine.solveExact(tasks, capacities).ok, false, label + ' exact rejected');
  assert.equal(engine.schedulePriority(tasks, capacities, Array.isArray(tasks) ? tasks.map(task => task.id) : []).ok, false, label + ' priority rejected');
}
for (const duration of [0, -1, 1.5, 6, NaN, Infinity]) {
  const tasks = copy(defaultTasks); tasks[0].duration = duration; invalid(tasks, defaultCaps, 'invalid duration');
}
for (const capacity of [-1, 1.5, 6, NaN, Infinity]) invalid(defaultTasks, { ...defaultCaps, climbers: capacity }, 'invalid capacity');
for (const demand of [-1, 1.5, 6, NaN, Infinity]) {
  const tasks = copy(defaultTasks); tasks[0].resources.climbers = demand; invalid(tasks, defaultCaps, 'invalid demand');
}
let malformed = copy(defaultTasks); malformed[0].predecessors = ['e']; invalid(malformed, defaultCaps, 'cycle');
malformed = copy(defaultTasks); malformed[0].predecessors = ['missing']; invalid(malformed, defaultCaps, 'missing predecessor');
malformed = copy(defaultTasks); malformed[1].id = malformed[0].id; invalid(malformed, defaultCaps, 'duplicate identifier');
malformed = copy(defaultTasks); malformed[0].resources.helicopters = 1; invalid(malformed, defaultCaps, 'unknown pool');
invalid([...chainEight, { id: 'n8', name: 'Ninth', duration: 1, resources: {}, predecessors: [] }], defaultCaps, 'nine jobs exceeds API bound');
for (const priority of [[], ['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e', 'e'], ['a', 'b', 'c', 'd', 'e', 'missing']]) {
  assert.equal(engine.schedulePriority(defaultTasks, defaultCaps, priority).ok, false, 'invalid priority permutation');
}

function reject(tasks, capacities, schedule, label) {
  const check = engine.verifySchedule(tasks, capacities, schedule);
  assert.equal(check.ok, false, 'verifier rejects ' + label);
  assert.ok(check.errors.length, 'verifier explains ' + label);
  rejectedMutations++;
}
const valid = copy(defaultResult.best.schedule);
reject(defaultTasks, defaultCaps, valid.slice(1), 'missing job');
reject(defaultTasks, defaultCaps, [...valid, copy(valid[0])], 'duplicate job');
let mutation = copy(valid); mutation[0].id = 'unknown'; reject(defaultTasks, defaultCaps, mutation, 'unknown job');
mutation = copy(valid); mutation[0].start = -1; reject(defaultTasks, defaultCaps, mutation, 'negative start');
mutation = copy(valid); mutation[0].start += 0.5; mutation[0].end += 0.5; reject(defaultTasks, defaultCaps, mutation, 'fractional start');
mutation = copy(valid); mutation[0].end++; reject(defaultTasks, defaultCaps, mutation, 'duration mutation');
mutation = copy(valid); mutation.find(entry => entry.id === 'e').start = 0; mutation.find(entry => entry.id === 'e').end = 3; reject(defaultTasks, defaultCaps, mutation, 'broken predecessor');
mutation = copy(valid); mutation.find(entry => entry.id === 'a').units.climbers = [0]; reject(defaultTasks, defaultCaps, mutation, 'missing unit');
mutation = copy(valid); mutation.find(entry => entry.id === 'a').units.climbers = [0, 0]; reject(defaultTasks, defaultCaps, mutation, 'duplicated assigned unit');
mutation = copy(valid); mutation.find(entry => entry.id === 'a').units.climbers = [0, 9]; reject(defaultTasks, defaultCaps, mutation, 'out-of-range unit');
mutation = copy(valid); mutation.find(entry => entry.id === 'a').units.climbers = [0, 0.5]; reject(defaultTasks, defaultCaps, mutation, 'fractional unit');
const pair = ['x', 'y'].map(id => ({ id, name: id, duration: 2, resources: { builders: 1 }, predecessors: [] }));
const pairCaps = { climbers: 0, builders: 2, porters: 0 };
const pairSchedule = copy(engine.solveExact(pair, pairCaps).best.schedule);
pairSchedule.forEach(entry => { entry.units.builders = [0]; });
reject(pair, pairCaps, pairSchedule, 'same person assigned to concurrent jobs although aggregate load fits');
reject(pair, { ...pairCaps, builders: 1 }, pairSchedule, 'cumulative overload');

console.log('Resource heaps: ' + comparisons + ' independent optimum comparisons; ' + witnesses + ' schedule witnesses; ' + oracleStates + ' oracle states (' + maximumOracleStates + ' maximum per fixture); ' + rejectedMutations + ' tampered schedules rejected.');
