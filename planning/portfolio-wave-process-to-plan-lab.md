# Portfolio Wave Process-to-Plan Lab

Status: long-running Codex branch plan
Branch: `codex/process-to-plan-lab`
Repo: `lawrencerowland/gimmer-crag`
Started: 2026-07-02

## Why This Repo

`gimmer-crag` is already the most concrete Portfolio Wave receiver for turning process ideas into inspectable planning artefacts. It has small apps for Petri nets, PDDL, WBS paths, schedules, change impact, sheaf-like change control, ontology views, and mountain-refuge / cliff-shed toy cases.

That makes it a good long-running branch for the question:

> Can a source cluster about processes, compositional systems, planning, and dynamic project state become a tiny but credible path from process description to WBS or schedule evidence?

This branch should not try to make a grand Portfolio Wave platform. It should make a sequence of small, legible improvements that gradually tighten one practical route:

source cluster -> process fragment -> formal-ish translation -> WBS/schedule fragment -> interactive inspection -> receipt back to the local Portfolio Wave working directory.

## Private Grounding Kept Outside This Public Repo

The working context for this branch lives in the local Portfolio Wave workspace and DEVONthink. In public repo artifacts, keep the grounding at cluster level rather than copying record-level provenance.

Local/private anchors to consult before each increment:

- Portfolio Wave `/best/processes to plans/`
- Portfolio Wave `/best/Generate WBS paths/`
- Portfolio Wave `/best/Dynamic project states/`
- local `FORAY_HANDOFF.md` notes for `processes to plans`, `Generate WBS paths`, and `Dynamic project states`
- the local GitHub repo-domain map that identifies `gimmer-crag` as a receiver for process-to-plan and WBS-path work

Each concrete increment should leave a local receipt in the Portfolio Wave working directory before it claims to have absorbed a DEVONthink source cluster.

## Working Hypothesis

A useful planning app does not begin with a complete ontology. It begins with a small transformation that can be inspected:

1. a process fragment with explicit states or transitions;
2. a planning interpretation of that fragment;
3. a candidate WBS or schedule path;
4. a visible explanation of what the translation preserves, distorts, or ignores.

If that loop works once, the branch can gradually add better schemas, richer source provenance, and stronger dynamic-state interpretation.

## Current Receiver Surface

Promising existing apps in this repo:

- `wbs-via-pddl` — current default app and a natural first receiver for planning-path work.
- `petri-net-to-wbs-to-schedule-current-working-concept` — close to the desired transformation chain.
- `mountain-refuge-petri-wbs-demo` — best concrete case slice for a tangible project example.
- `constraint-to-plan-studio-minimal-demo` — candidate for a later unified inspection surface.
- `process-first-project-model` — useful for making the process-first framing explicit.
- `sheaf-change-control-workbench` and `sheafified-change-impact-workbench` — later receivers once the process-to-plan path has a stable core.

## Improvement Sequence

### 0. Stabilise the receiver map

Create a small repo-local map of which existing apps play which role in the process-to-plan chain.

Output:

- `planning/app-receiver-map.md`
- no app behavior changes yet

Done when a future agent can tell which app should receive a WBS-path, state-transition, change-impact, or ontology increment.

### 1. Define the first translation contract

Write the minimal input/output contract for one process-to-plan slice.

Output:

- `planning/process-to-plan-contract.md`
- candidate JSON shape for process steps, dependencies, states, and produced WBS items

Done when one process/Petri/PDDL fragment can be described without inventing a new framework each time.

### 2. Pick the first app target

Choose one app as the first living target, probably `mountain-refuge-petri-wbs-demo` or `petri-net-to-wbs-to-schedule-current-working-concept`.

Output:

- one short implementation note naming the chosen app and why
- one small fixture or inline dataset, if needed

Done when the branch has one obvious place to make code changes rather than spreading across many demos.

### 3. Make one vertical slice inspectable

Add or refine one tiny demonstration where a process fragment produces a candidate WBS or schedule path.

Output:

- app-level change in the selected target
- visible explanation panel: input, transformation rule, output, caveat
- local Portfolio Wave receipt outside this repo

Done when a user can see the whole route without reading the code.

### 4. Add dynamic-state interpretation

Use the dynamic-project-states foray as a second layer, after the WBS path exists.

Output:

- state vocabulary for the slice, such as blocked, constrained, parallelisable, waiting, committed, or rework-risk
- visible rule for how state changes affect the plan path

Done when the app shows not just a plan, but why the plan is changing.

### 5. Turn change into a governed experiment

Only after the process-to-plan and dynamic-state pieces are visible, connect the change-control/sheafification demos.

Output:

- one change request that alters the process fragment
- visible impact on WBS path, interface obligations, or schedule fragment

Done when change control is an inspectable transformation rather than a metaphor.

## Branch Rules

- Keep the branch long-running and experimental.
- Prefer small PR updates that add one planning artifact or one app increment at a time.
- Do not merge to `main` until a slice is useful on its own.
- Do not copy private DEVONthink record details into the public repo; keep record-level provenance in local Portfolio Wave receipts.
- Do not treat generated `docs/` output as the source of truth; source apps and planning notes drive the work.

## First Next Step

Create `planning/app-receiver-map.md` and classify the existing apps into five roles:

1. process fragment
2. planning/WBS translation
3. schedule/timeline inspection
4. dynamic project state
5. change-impact governance

That map should nominate one app for the first vertical slice.
