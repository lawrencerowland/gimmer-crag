# App Receiver Map

Status: first branch map
Branch: `codex/process-to-plan-lab`
Started: 2026-07-02

This map classifies the existing `gimmer-crag` apps by the role they can play in a Portfolio Wave process-to-plan vertical slice.

The first useful slice should show:

process fragment -> planning interpretation -> WBS or schedule path -> caveat / decision implication.

## Role 1: Process Fragment

Apps that can hold or explain the initial process structure.

| App | Current fit | Use in this branch |
|---|---|---|
| `project-process-task-explorer` | typed process/task wiring | Good conceptual explainer for how process parts connect to tasks. |
| `process-first-project-model` | process-first cliff-shed demo | Good narrative surface for why the model starts with process, not WBS. |
| `processes-plans-shed-on-a-cliff` | category view for process-to-plan | Useful for the formal translation story. |
| `processes-plans-shed-halfway-up-a-cliff` | process-to-plan prototype | Useful if it has the clearest existing flow. |
| `petri-net-checks` | Petri workflow with checks | Good source of check/explanation language. |

## Role 2: Planning / WBS Translation

Apps that are closest to the core transformation this branch should tighten.

| App | Current fit | Use in this branch |
|---|---|---|
| `wbs-via-pddl` | default app; PDDL-driven WBS workbench | Strong candidate if the first slice should be planning-language led. |
| `petri-net-to-wbs-to-schedule-current-working-concept` | direct Petri -> WBS -> schedule chain | Strongest chain-shaped candidate. |
| `mountain-refuge-petri-wbs-demo` | Petri -> SMC -> WBS for mountain refuge | Best concrete case candidate. |
| `cliff-refuge-petri-smc-wbs` | Petri -> CMC/SMC -> WBS/schedule | Good sibling or comparison surface. |
| `mountain-shed-wbs-from-petri-net` | candidate WBS paths from Petri net | Good narrow source for WBS-path details. |
| `constraint-to-plan-studio-minimal-demo` | Petri -> WBS -> timeline studio | Candidate later unifying surface. |

## Role 3: Schedule / Timeline Inspection

Apps that can show the output as something closer to project control.

| App | Current fit | Use in this branch |
|---|---|---|
| `constraint-to-plan-studio-minimal-demo` | timeline from constraints | Best candidate for later integrated inspection. |
| `half-cliff-shed-ops-console` | ops console with timeline | Useful if the slice needs operational status. |
| `temporal-binding-approach` | temporal binding dashboard | Useful for timing and dependency explanations. |
| `cliff-shed-event-structure-dual-view` | event structure and configurations | Useful if conflict/choice matters. |

## Role 4: Dynamic Project State

Apps that can help the branch move beyond static WBS generation.

| App | Current fit | Use in this branch |
|---|---|---|
| `active-inference-procurement` | procurement console with active-inference framing | Candidate state/decision layer after the first WBS slice. |
| `project-binding-experiments` | concurrent experiment prompts | Useful for scenario prompts and parallel trials. |
| `cliff-shed-binding-prototype` | project binding prototype | Useful if state is expressed as binding / commitment. |
| `temporal-binding-approach` | temporal dashboard | Useful for timing-state changes. |
| `build-a-shed-petri-net-split-materials` | split materials and parallel prep tasks | Good small example of parallelisable vs constrained state. |

## Role 5: Change-Impact Governance

Apps that should come later, once the core process-to-plan route is visible.

| App | Current fit | Use in this branch |
|---|---|---|
| `sheaf-change-control-workbench` | interface-driven change requests | Later governance layer. |
| `sheafified-change-impact-workbench` | topology edits and glue analysis | Later change-impact explanation layer. |
| `project-change-requests-as-sheafification` | one-file change-request demo | Lightweight bridge from change request to impact. |
| `mountain-refuge-change-as-sheafification` | mountain refuge change request prototype | Best case-aligned change-control sibling. |

## First Vertical Slice Nomination

Nominate `mountain-refuge-petri-wbs-demo` as the first living target.

Reason:

- It is concrete enough to inspect without explaining the entire formal stack.
- It already sits close to Petri/SMC/WBS translation.
- It fits the `gimmer-crag` mountain-refuge case rather than becoming a generic modelling demo.
- It can later connect naturally to `mountain-refuge-change-as-sheafification`.

Supporting apps to inspect before coding:

- `petri-net-to-wbs-to-schedule-current-working-concept`
- `constraint-to-plan-studio-minimal-demo`
- `mountain-shed-wbs-from-petri-net`

## First Code Increment To Consider

Add an explanation layer to `mountain-refuge-petri-wbs-demo` that makes the vertical slice visible:

1. Input: the small Petri/process fragment.
2. Translation: the rule that turns transitions or reachable markings into candidate WBS items.
3. Output: the WBS path or schedule fragment.
4. Caveat: what the translation does not yet prove.
5. Receipt: note in the local Portfolio Wave working directory naming which private source cluster informed the change.

That increment should be small enough to review in one PR update and useful even if the long-running branch later changes direction.
