# Process-To-Plan Contract

Status: branch contract for `codex/process-to-plan-lab`
Created: 2026-07-02

This contract names the minimal shape a Gimmer Crag process-to-plan slice should expose. It is not a
full schema yet; it is a reviewable agreement about what the app must make visible.

## Contract Fields

### `processFragment`

The source process structure being interpreted.

Minimum contents:

- project or case name;
- count of places/states/resources;
- count of transitions/work items;
- selected transition IDs, where a specific execution has been chosen;
- statement of the invariant process rule.

For the current mountain-refuge slice, this is the Petri/process net embedded in
`apps/mountain-refuge-petri-wbs-demo/index.html`.

### `executionWitness`

The concrete run through the process fragment.

Minimum contents:

- resource-token settings;
- priority or selection policy;
- schedule step count;
- makespan, where timed execution is available;
- statement that the schedule is a witness under those settings, not the only possible plan.

### `projection`

The visible planning view derived from the execution witness.

Minimum contents:

- SMC or parallel/sequential expression;
- schedule-derived WBS or stage list;
- explanation of the projection rule.

For the current slice, same-start tasks become parallel blocks, ordered blocks become stages, and the
WBS is generated from the selected schedule.

### `caveats`

The limits of the transformation.

Minimum contents:

- duration/calibration limits;
- non-uniqueness of WBS grouping;
- gap between useful formal view and formal proof;
- material risks or states not yet modeled.

### `localReceiptRequired`

The private provenance rule.

Minimum contents:

- public repo artifacts name only cluster-level Portfolio Wave anchors;
- record-level DEVONthink provenance remains in the local Portfolio Wave working directory;
- any source-backed increment needs a matching local receipt before being treated as absorbed.

## First Implementation Target

Add a `Translation contract` panel to `mountain-refuge-petri-wbs-demo` using these fields.

The panel should be generated from the selected schedule candidate. It should clear when no valid
candidate is selected and update when the user selects another candidate.
