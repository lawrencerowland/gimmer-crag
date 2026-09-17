/*
 * Bounded renewable-resource project scheduling for a fictional six-job example.
 * Scheduling uses aggregate pool capacities. Named resource columns are assigned
 * only after start times have been computed; they are a witness, not a constraint.
 *
 * Full enumeration of precedence-feasible priority orders with serial schedule
 * generation covers an optimal makespan under this model's assumptions: all jobs
 * mandatory, nonpreemptive integer durations, renewable interchangeable pools,
 * finish-to-start precedence, and no calendars, release dates or other constraints.
 * It does not enumerate every feasible schedule or every deliberate idle period.
 * Reference: https://arxiv.org/html/1708.07786 (serial schedule generation).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ResourceHeap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RESOURCE_TYPES = Object.freeze(['climbers', 'builders', 'porters']);
  const DEFAULT_CAPACITIES = Object.freeze({ climbers: 2, builders: 3, porters: 3 });
  const DEFAULT_TASKS = Object.freeze([
    { id: 'a', name: 'Equipment haul', duration: 2, resources: { climbers: 2, porters: 3 }, predecessors: [] },
    { id: 'b', name: 'Site preparation', duration: 3, resources: { climbers: 1, builders: 2 }, predecessors: ['a'] },
    { id: 'c', name: 'Frame assembly', duration: 3, resources: { climbers: 1, builders: 3 }, predecessors: ['b'] },
    { id: 'd', name: 'Wall panels', duration: 2, resources: { builders: 2, porters: 1 }, predecessors: ['c'] },
    { id: 'e', name: 'Roof and weatherproofing', duration: 3, resources: { climbers: 2, builders: 2 }, predecessors: ['c'] },
    // The cache occupies a separate prepared recess; shell completion is not a prerequisite.
    { id: 'f', name: 'Emergency cache', duration: 2, resources: { climbers: 2, porters: 1 }, predecessors: ['a'] }
  ].map(task => Object.freeze({ ...task, resources: Object.freeze(task.resources), predecessors: Object.freeze(task.predecessors) })));

  const pools = value => Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, value]));
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integerIn = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
  const demand = (task, resource) => task.resources[resource] === undefined ? 0 : task.resources[resource];

  function validateModel(tasks, capacities) {
    const errors = [];
    if (!record(capacities)) {
      errors.push('Capacities must be an object containing all three resource pools.');
    } else {
      for (const resource of RESOURCE_TYPES) {
        if (!integerIn(capacities[resource], 0, 5)) errors.push(`Capacity for ${resource} must be an integer from 0 to 5.`);
      }
      for (const resource of Object.keys(capacities)) {
        if (!RESOURCE_TYPES.includes(resource)) errors.push(`Unknown capacity pool: ${resource}.`);
      }
    }
    if (!Array.isArray(tasks)) return [...errors, 'Tasks must be an array.'];
    if (tasks.length > 8) return [...errors, 'At most eight tasks are supported by the complete enumeration.'];

    const ids = new Set();
    for (const [index, task] of tasks.entries()) {
      if (!record(task)) {
        errors.push(`Task ${index + 1} must be an object.`);
        continue;
      }
      const label = typeof task.id === 'string' && task.id.trim() ? task.id : `at position ${index + 1}`;
      if (typeof task.id !== 'string' || !task.id.trim()) errors.push(`Task ${index + 1} needs a nonempty string id.`);
      else if (ids.has(task.id)) errors.push(`Duplicate task id: ${task.id}.`);
      else ids.add(task.id);
      if (!integerIn(task.duration, 1, 5)) errors.push(`Duration for task ${label} must be an integer from 1 to 5.`);
      if (!record(task.resources)) errors.push(`Resources for task ${label} must be an object.`);
      else {
        for (const resource of Object.keys(task.resources)) {
          if (!RESOURCE_TYPES.includes(resource)) errors.push(`Task ${label} uses unknown pool ${resource}.`);
          else if (!integerIn(task.resources[resource], 0, 5)) errors.push(`Demand for ${resource} in task ${label} must be an integer from 0 to 5.`);
        }
        if (record(capacities)) {
          for (const resource of RESOURCE_TYPES) {
            const needed = demand(task, resource);
            if (integerIn(needed, 0, 5) && integerIn(capacities[resource], 0, 5) && needed > capacities[resource]) {
              errors.push(`Task ${label} needs ${needed} ${resource}, but capacity is ${capacities[resource]}.`);
            }
          }
        }
      }
      if (!Array.isArray(task.predecessors)) errors.push(`Predecessors for task ${label} must be an array.`);
      else {
        const seen = new Set();
        for (const predecessor of task.predecessors) {
          if (typeof predecessor !== 'string' || !predecessor.trim()) errors.push(`Task ${label} has an invalid predecessor id.`);
          else if (seen.has(predecessor)) errors.push(`Task ${label} repeats predecessor ${predecessor}.`);
          seen.add(predecessor);
        }
      }
    }
    for (const task of tasks) {
      if (!record(task) || !Array.isArray(task.predecessors)) continue;
      for (const predecessor of task.predecessors) {
        if (typeof predecessor === 'string' && !ids.has(predecessor)) errors.push(`Task ${task.id} references missing predecessor ${predecessor}.`);
      }
    }
    // Cycle checking is meaningful only after the graph's identifiers are valid.
    const graphValid = tasks.every(task => record(task) && typeof task.id === 'string' && task.id.trim() && Array.isArray(task.predecessors) && task.predecessors.every(id => typeof id === 'string' && ids.has(id))) && ids.size === tasks.length;
    if (graphValid) {
      const completed = new Set();
      let changed = true;
      while (changed) {
        changed = false;
        for (const task of tasks) {
          if (!completed.has(task.id) && task.predecessors.every(id => completed.has(id))) {
            completed.add(task.id);
            changed = true;
          }
        }
      }
      if (completed.size !== tasks.length) errors.push('The predecessor graph contains a cycle.');
    }
    return errors;
  }

  function failedPriority(errors) {
    return { ok: false, errors, order: [], schedule: [], makespan: null, peak: pools(0) };
  }

  function priorityErrors(tasks, priorityIds) {
    if (!Array.isArray(priorityIds)) return ['Priority must be a complete array of task ids.'];
    const known = new Set(tasks.map(task => task.id));
    const errors = [];
    const seen = new Set();
    for (const id of priorityIds) {
      if (!known.has(id)) errors.push(`Priority contains unknown task ${String(id)}.`);
      if (seen.has(id)) errors.push(`Priority repeats task ${String(id)}.`);
      seen.add(id);
    }
    for (const id of known) if (!seen.has(id)) errors.push(`Priority is missing task ${id}.`);
    return errors;
  }

  function precedenceOrder(tasks, priorityIds) {
    const byId = new Map(tasks.map(task => [task.id, task]));
    const done = new Set();
    const order = [];
    while (order.length < tasks.length) {
      const next = priorityIds.find(id => !done.has(id) && byId.get(id).predecessors.every(predecessor => done.has(predecessor)));
      // Model validation guarantees this exists for a complete priority list.
      if (next === undefined) return null;
      done.add(next);
      order.push(next);
    }
    return order;
  }

  function assignUnits(tasks, capacities, schedule) {
    const taskIndex = new Map(tasks.map((task, index) => [task.id, index]));
    const byId = new Map(tasks.map(task => [task.id, task]));
    const release = Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, Array(capacities[resource]).fill(0)]));
    const chronological = [...schedule].sort((left, right) => left.start - right.start || taskIndex.get(left.id) - taskIndex.get(right.id));
    for (const entry of chronological) {
      const task = byId.get(entry.id);
      entry.units = {};
      for (const resource of RESOURCE_TYPES) {
        const units = [];
        const needed = demand(task, resource);
        for (let unit = 0; unit < release[resource].length && units.length < needed; unit++) {
          if (release[resource][unit] <= entry.start) {
            units.push(unit);
            release[resource][unit] = entry.end;
          }
        }
        if (units.length !== needed) throw new Error('Internal error: an aggregate-feasible schedule could not be assigned to interchangeable units.');
        entry.units[resource] = units;
      }
    }
  }

  function generate(tasks, capacities, order) {
    const horizon = tasks.reduce((total, task) => total + task.duration, 0);
    const use = Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, Array(horizon).fill(0)]));
    const byId = new Map(tasks.map(task => [task.id, task]));
    const finishes = new Map();
    const schedule = [];
    for (const id of order) {
      const task = byId.get(id);
      const predecessorReady = Math.max(0, ...task.predecessors.map(predecessor => finishes.get(predecessor)));
      let start = predecessorReady;
      let found = false;
      for (; start + task.duration <= horizon; start++) {
        let fits = true;
        for (let time = start; time < start + task.duration && fits; time++) {
          for (const resource of RESOURCE_TYPES) {
            if (use[resource][time] + demand(task, resource) > capacities[resource]) {
              fits = false;
              break;
            }
          }
        }
        if (fits) {
          found = true;
          break;
        }
      }
      // For a valid DAG whose individual jobs fit, fully serial execution fits H.
      if (!found) return failedPriority(['No feasible placement was found within the serial horizon.']);
      const end = start + task.duration;
      for (let time = start; time < end; time++) {
        for (const resource of RESOURCE_TYPES) use[resource][time] += demand(task, resource);
      }
      finishes.set(id, end);
      schedule.push({ id, start, end, units: {}, predecessorReady, resourceDelay: start - predecessorReady });
    }
    assignUnits(tasks, capacities, schedule);
    return {
      ok: true,
      errors: [],
      order: [...order],
      schedule,
      makespan: Math.max(0, ...schedule.map(entry => entry.end)),
      peak: Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, Math.max(0, ...use[resource])]))
    };
  }

  function schedulePriority(tasks, capacities, priorityIds) {
    const errors = validateModel(tasks, capacities);
    if (errors.length) return failedPriority(errors);
    const invalidPriority = priorityErrors(tasks, priorityIds);
    if (invalidPriority.length) return failedPriority(invalidPriority);
    const order = precedenceOrder(tasks, priorityIds);
    if (!order) return failedPriority(['No precedence-feasible priority order exists.']);
    return generate(tasks, capacities, order);
  }

  function solveExact(tasks, capacities) {
    const errors = validateModel(tasks, capacities);
    const failure = {
      ok: false, errors, bestMakespan: null, criticalPathBound: null, resourceWorkBound: null,
      ordersChecked: 0, uniqueSchedules: 0, optimalCount: 0, schedules: [], best: null
    };
    if (errors.length) return failure;
    const canonicalOrder = precedenceOrder(tasks, tasks.map(task => task.id));
    const byId = new Map(tasks.map(task => [task.id, task]));
    const earliestFinish = new Map();
    for (const id of canonicalOrder) {
      const task = byId.get(id);
      earliestFinish.set(id, task.duration + Math.max(0, ...task.predecessors.map(predecessor => earliestFinish.get(predecessor))));
    }
    const criticalPathBound = Math.max(0, ...earliestFinish.values());
    const resourceWorkBound = Math.max(0, ...RESOURCE_TYPES.map(resource => {
      const work = tasks.reduce((total, task) => total + task.duration * demand(task, resource), 0);
      return work === 0 ? 0 : Math.ceil(work / capacities[resource]);
    }));
    const retained = new Map();
    let ordersChecked = 0;
    let internalError = null;
    const done = new Set();
    const order = [];
    function enumerate() {
      if (order.length === tasks.length) {
        ordersChecked++;
        const result = generate(tasks, capacities, order);
        if (!result.ok) {
          internalError = result.errors;
          return;
        }
        const starts = new Map(result.schedule.map(entry => [entry.id, entry.start]));
        const vector = tasks.map(task => starts.get(task.id));
        const key = vector.join(',');
        if (!retained.has(key)) retained.set(key, { result, vector });
        return;
      }
      for (const task of tasks) {
        if (!done.has(task.id) && task.predecessors.every(predecessor => done.has(predecessor))) {
          done.add(task.id);
          order.push(task.id);
          enumerate();
          order.pop();
          done.delete(task.id);
        }
      }
    }
    enumerate();
    if (internalError) return { ...failure, errors: internalError, ordersChecked };
    const sorted = [...retained.values()].sort((left, right) => {
      const difference = left.result.makespan - right.result.makespan;
      if (difference) return difference;
      for (let index = 0; index < left.vector.length; index++) {
        if (left.vector[index] !== right.vector[index]) return left.vector[index] - right.vector[index];
      }
      return 0;
    });
    const schedules = sorted.map(item => item.result);
    const best = schedules[0];
    return {
      ok: true, errors: [], bestMakespan: best.makespan, criticalPathBound, resourceWorkBound,
      ordersChecked, uniqueSchedules: schedules.length,
      optimalCount: schedules.filter(result => result.makespan === best.makespan).length,
      schedules, best
    };
  }

  // Independent checker: recompute coverage, time inequalities, aggregate demand
  // and per-unit conflicts directly from supplied intervals, never from SGS state.
  function verifySchedule(tasks, capacities, schedule) {
    const errors = validateModel(tasks, capacities);
    const peak = pools(0);
    if (errors.length) return { ok: false, errors, peak, makespan: null };
    if (!Array.isArray(schedule)) return { ok: false, errors: ['Schedule must be an array.'], peak, makespan: null };
    const byId = new Map(tasks.map(task => [task.id, task]));
    const rows = new Map();
    const intervals = [];
    const unitUses = Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, Array.from({ length: capacities[resource] }, () => [])]));
    for (const [index, entry] of schedule.entries()) {
      if (!record(entry) || !byId.has(entry.id)) {
        errors.push(`Schedule entry ${index + 1} has an unknown or missing task id.`);
        continue;
      }
      const task = byId.get(entry.id);
      if (rows.has(entry.id)) errors.push(`Schedule repeats task ${entry.id}.`);
      else rows.set(entry.id, entry);
      const validInterval = Number.isSafeInteger(entry.start) && entry.start >= 0 && Number.isSafeInteger(entry.end) && entry.end > entry.start;
      if (!validInterval) errors.push(`Task ${entry.id} needs nonnegative integer start and a later integer end.`);
      else {
        if (entry.end - entry.start !== task.duration) errors.push(`Task ${entry.id} has the wrong duration.`);
        intervals.push({ task, entry });
      }
      if (!record(entry.units)) {
        errors.push(`Task ${entry.id} needs a per-pool unit assignment.`);
        continue;
      }
      for (const resource of Object.keys(entry.units)) {
        if (!RESOURCE_TYPES.includes(resource)) errors.push(`Task ${entry.id} assigns unknown pool ${resource}.`);
      }
      for (const resource of RESOURCE_TYPES) {
        const assigned = entry.units[resource] === undefined ? [] : entry.units[resource];
        if (!Array.isArray(assigned)) {
          errors.push(`Task ${entry.id} needs an array of ${resource} unit indices.`);
          continue;
        }
        if (assigned.length !== demand(task, resource)) errors.push(`Task ${entry.id} has the wrong number of ${resource} units.`);
        const seenUnits = new Set();
        for (const unit of assigned) {
          if (!integerIn(unit, 0, capacities[resource] - 1)) {
            errors.push(`Task ${entry.id} assigns an out-of-range ${resource} unit.`);
            continue;
          }
          if (seenUnits.has(unit)) errors.push(`Task ${entry.id} assigns ${resource} unit ${unit} more than once.`);
          seenUnits.add(unit);
          if (validInterval) unitUses[resource][unit].push(entry);
        }
      }
    }
    for (const task of tasks) {
      const entry = rows.get(task.id);
      if (!entry) {
        errors.push(`Schedule is missing task ${task.id}.`);
        continue;
      }
      for (const predecessor of task.predecessors) {
        const previous = rows.get(predecessor);
        if (previous && Number.isSafeInteger(entry.start) && Number.isSafeInteger(previous.end) && entry.start < previous.end) {
          errors.push(`Task ${task.id} starts before predecessor ${predecessor} finishes.`);
        }
      }
    }
    const times = [...new Set(intervals.flatMap(({ entry }) => [entry.start, entry.end]))].sort((left, right) => left - right);
    for (const time of times) {
      const use = pools(0);
      for (const { task, entry } of intervals) {
        if (entry.start <= time && time < entry.end) {
          for (const resource of RESOURCE_TYPES) use[resource] += demand(task, resource);
        }
      }
      for (const resource of RESOURCE_TYPES) {
        peak[resource] = Math.max(peak[resource], use[resource]);
        if (use[resource] > capacities[resource]) errors.push(`${resource} capacity is exceeded at time ${time}.`);
      }
    }
    for (const resource of RESOURCE_TYPES) {
      for (const [unit, uses] of unitUses[resource].entries()) {
        for (let left = 0; left < uses.length; left++) {
          for (let right = left + 1; right < uses.length; right++) {
            if (uses[left].start < uses[right].end && uses[right].start < uses[left].end) {
              errors.push(`${resource} unit ${unit} overlaps between tasks ${uses[left].id} and ${uses[right].id}.`);
            }
          }
        }
      }
    }
    return {
      ok: errors.length === 0,
      errors,
      peak,
      makespan: Math.max(0, ...intervals.map(({ entry }) => entry.end))
    };
  }

  return Object.freeze({ RESOURCE_TYPES, DEFAULT_TASKS, DEFAULT_CAPACITIES, validateModel, schedulePriority, solveExact, verifySchedule });
});
