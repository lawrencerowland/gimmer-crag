# Resource Heaps: method and boundaries

[Open Resource Heaps](index.html) · [Broader Gimmer collection](../../app-index.html)

This app compares ways to schedule supplied work. Its coloured columns show which individual resource units are occupied and when. Its calculation is a small resource-constrained project scheduling model, with a separate check of every result. It does not discover the required work or derive it from a Petri net, symmetric monoidal category, or WBS.

## The declared model

1. There are six mandatory jobs, each performed once. Completion means finishing all six.
2. Each job has one fixed integer duration, editable from one to five days. Work runs without interruption and holds its stated resources for the whole duration.
3. Climbers, builders and porters are renewable, interchangeable units within their own pools. Each pool has a constant integer capacity from zero to five. A person cannot serve two jobs at the same time.
4. The supplied acyclic dependencies are finish-to-start, with zero lag. They describe this fictional construction method; priority choices cannot remove them.
5. There are no calendars, release dates, access or weather windows, uncertain outcomes, travel or setup times, or alternative methods. A day is a model time unit.
6. The emergency cache occupies a separate prepared recess. It needs the equipment haul but not the completed shell. This explicit fictional assumption allows cache work to compete with shell work for the climbers.

| Job | Default days | Climbers | Builders | Porters | Must finish first |
|---|---:|---:|---:|---:|---|
| A: Equipment haul | 2 | 2 | 0 | 3 | — |
| B: Site preparation | 3 | 1 | 2 | 0 | A |
| C: Frame assembly | 3 | 1 | 3 | 0 | B |
| D: Wall panels | 2 | 0 | 2 | 1 | C |
| E: Roof and weatherproofing | 3 | 2 | 2 | 0 | C |
| F: Emergency cache | 2 | 2 | 0 | 1 | A |

Default capacity is two climbers, three builders and three porters. Walls and roof may proceed separately after the frame if resources permit; neither job is a prerequisite of the other in this model. These are declared example assumptions, not engineering validation of a real refuge.

## Generation and the exact claim

The chosen priority is read from highest to lowest. Whenever a job is selected, all its predecessors must already have been scheduled. The selected job receives the earliest integer start after predecessor completion for which the required aggregate capacity is available throughout its duration. A later-selected independent job can occupy an earlier gap: selection order is not necessarily chronological execution order.

The exact solver repeats this procedure for every topological priority order, removes duplicate start-time vectors, and chooses minimum completion time. There is no sampled or truncated search. The interface has six jobs; the engine accepts at most eight, bounding enumeration by 8! = 40,320 orders. Invalid models and insufficient capacity produce an explained failure rather than a fabricated placement.

The serial schedule generation scheme and its active-schedule coverage are described by [Karapetyan and Vernitski (2017), §1, Algorithms 1–3](https://arxiv.org/html/1708.07786). An optimum for makespan exists among active schedules, and a suitable precedence-feasible permutation produces each active schedule. Therefore complete enumeration establishes the optimum under this app's assumptions. It does **not** enumerate every schedule with inserted waiting, nor every interchangeable-person assignment.

The finite horizon is the sum of all durations. When the graph is acyclic and every job individually fits the pools, executing the jobs one at a time in a topological order is feasible within that horizon. Thus no shorter optimum can require a larger horizon. Integer durations and zero-lag constraints let the generator produce integer earliest starts.

Two lower bounds help explain a result: the longest dependency-chain duration, and the greatest rounded-up resource-work/capacity ratio across pools. Neither bound alone proves attainability. “Best finish for this model” comes from the completed search, not from calling a preset optimal.

## People, pieces and the independent witness

Individual columns are assigned **after** aggregate scheduling, in chronological start order. A job takes the lowest-numbered available units of each pool and retains them until it ends. Jobs ending at a boundary release their units before new jobs start there. Capacity feasibility guarantees enough free units in this chronological assignment. Fixing particular people while inserting jobs in a nonchronological priority order could create avoidable fragmentation and invalidate the scheduling argument.

The verifier checks complete job coverage, duration, prerequisites, every interval's cumulative resource load, assignment counts and unit ranges, and each person's non-overlap. The test suite separately audits those witnesses and compares optimum values against a unit-time breadth-first search. That oracle branches over every capacity-feasible subset of ready jobs, including choosing to wait while other jobs run; it does not use priority-order generation. With no calendars or release dates, waiting when no work runs cannot improve completion time, and a later visit to the same completed/running state is dominated.

Run the independent checks with `node tests/resource-heaps.test.cjs`. They include every forward-edge DAG on four jobs, varied resource pools, seeded five-job examples, refuge capacity and duration variations, impossible inputs, the API bound, and intentionally damaged schedules. Their terminal output reports the comparisons and witnesses actually checked. These checks establish properties of the declared model and implementation, not real-world suitability or human-use benefits.

## What “heap” means here

[Gaubert and Mairesse, *Task Resource Models and (max,+) Automata* (1995), §§2.1–2.3](https://www.cmap.polytechnique.fr/~gaubert/PAPERS/GM95-BRISTOL.pdf) gives a precise heap construction: a task uses a fixed subset of identifiable resources; pieces are added in a word order and rest above those resources' prior releases. Its upper contour records latest release times, not the full utilisation history.

This app borrows the resource-column geometry. Its pool-based, gap-filling scheduler is **not** that max-plus product. The visual is a concrete interval-allocation witness. A fixed assignment and order could support a separate heap reconstruction with explicit prerequisite guards, but that construction is not claimed here. No categorical translation or general heap theorem is inferred from the picture.

## Place in the collection

Resource Heaps belongs to broader Gimmer: a scheduling companion using the same fictional refuge. It adds a checked resource-allocation view and finite optimisation comparison. It does not replace or complete the main Petri → SMC → WBS investigation.
