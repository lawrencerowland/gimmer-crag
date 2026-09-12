# Gimmer collection boundaries

User-directed curation, 8 September 2026; App 20 entrances clarified 12 September 2026. This changes discoverability, not model behaviour or retirement status.

- `petri-smc-wbs.html`: main Petri → SMC → WBS route. Includes direct process/state-to-task mappings, Petri reachability and checks, plan generation, composition explanations and schedule/WBS projections. PDDL (#2) belongs here because its PNML-to-tasks bridge and causal WBS construction directly support the route. #12 is the conflict/event-structure companion. References and source generators remain labelled as such; listing does not imply full executable correctness.
- `app-index.html`: the ten other numbered apps in observation/binding, procurement, ontology and sheaf/change experiments, plus an explicit comparison reference to App 20. The comparison tests why two supplied mechanisms can give the same chosen plan; it does not infer a mechanism from a plan.
- The separate `gimmer-crag-project-mountain-refuge` site owns the higher-autonomy labs. Its inherited comparison links to the canonical App 20 here as background, not an independently generated new result. No apps are deleted or moved between repositories.

Maintain the disjoint, exhaustive numbered-app partition in `gimmer-collections.json`, the two landing pages and each app’s return links together. Keep source `apps/` and deployed `docs/` consistent through the normal build. The original CSV remains the complete inventory, not the broader collection membership list.

## App 20: one implementation, two purposes

The Processes to plans feature and catalogue entry open `apps/mountain-refuge-petri-wbs-demo/index.html?view=scheduler`: **Generate refuge schedules from process rules**. The broader comparison reference opens that same file with `?view=comparison`: **Why one plan can hide different process rules**. Each entrance sets the heading, introduction, visible work area and collection return. View changes retain temporary settings and results; reload restores defaults.

The numbered primary memberships remain a disjoint 16/10 partition. The manifest records the broader comparison as a reference, so there are 26 unique apps and 27 purpose entries, not a duplicate app or code copy. Both collection return anchors remain explicit in the app.

Plain URLs retain the comparison. Existing known hashes select and reveal their own view, including `#schedule-lab`, `#process-lab`, `#netJson`, `#model-notes` and `#same-plan-witness`; a recognized hash takes priority over the query. Other query parameters survive in-app navigation. Back/forward and repeated anchor activation restore the corresponding view. No inherited redirect needs alteration. Without JavaScript both sections remain available as markup, with the workbench disclosure and both collection links.

The original simulator and its twelve witness cases are retained. Schedule generation samples priority-based executions rather than exhaustively enumerating plans. Its same-start SMC-style expression and WBS remain illustrative projections; this curation adds no categorical or engineering-validity claim.
