# Process-To-Plan Route Boundary

Status: public boundary note for `codex/process-to-plan-lab`
Created: 2026-07-04

This branch is intentionally narrow. It makes one route through the Portfolio Wave material
inspectable:

`process/Petri fragment -> valid execution -> schedule/SMC/WBS projection -> caveat`

It does not try to make `gimmer-crag` the whole process-to-plan programme.

## Foray Relationship

| Layer | Foray | Role in this branch |
|---|---|---|
| Primary | `FORAY-WBS-PATHS` | Owns the Gimmer Petri/process -> schedule -> SMC/WBS route. |
| Parent context | `FORAY-PROCESSES-TO-PLANS` | Explains why the route matters: rich process material can become thinner executable plan artefacts. |
| Adjacent/deferred | `FORAY-DYNAMIC-PROJECT-STATES` | Remains out of the current Gimmer slice until its first state grammar is tested elsewhere. |

## What This Branch Can Claim

- A selected schedule candidate can witness one valid execution of the embedded process/Petri
  fragment.
- The SMC expression and WBS view are projections of that witness.
- The projection preserves some useful structure: task identity, ordering, parallel blocks,
  resource settings, and makespan.
- The projection deliberately forgets other structure: unchosen alternatives, guard rationale,
  resource provenance, and risks not modelled in the toy net.
- A plan view is too thin to reconstruct the original process without extra assumptions.

## What This Branch Should Not Claim

- It is not a formal proof that every project plan is functorial.
- It is not a general route-planning engine.
- It is not the first public receiver for dynamic project states.
- It should not expose record-level DEVONthink provenance.

## Broader Scenario Boundary

The broader `processes to plans` foray now has a private hill/travel scenario under review. That
scenario is useful because real route planning contains intention, constraints, resources,
preferences, weather, body state, and contingency decisions that should not be forced into a Petri
net too early.

For this public branch, mention that broader scenario only at concept level. Keep detailed source
notes, record titles, links, and provenance in the local Portfolio Wave working folder until they are
deliberately reviewed for public use.

## Next Branch Move

After this boundary is aligned, the next app-level increment should be a small non-invertibility
witness: show that two different process interpretations or execution settings can collapse to the
same visible plan fragment, so `plan -> process` remains a non-canonical lift rather than an inverse.
