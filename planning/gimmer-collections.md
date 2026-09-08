# Gimmer collection boundaries

User-directed curation, 8 September 2026. This changes discoverability, not model behaviour or retirement status.

- `petri-smc-wbs.html`: main Petri → SMC → WBS route. Includes direct process/state-to-task mappings, Petri reachability and checks, plan generation, composition explanations and schedule/WBS projections. PDDL (#2) belongs here because its PNML-to-tasks bridge and causal WBS construction directly support the route. #12 is the conflict/event-structure companion. References and source generators remain labelled as such; listing does not imply full executable correctness.
- `app-index.html`: only the ten other numbered apps: observation/binding, procurement, ontology and sheaf/change experiments. They do not implement the direct process-to-WBS route.
- The separate `gimmer-crag-project-mountain-refuge` site owns the higher-autonomy labs. Its shared earlier comparison is background, not an independently generated new result. No apps are deleted or moved between repositories.

Maintain the disjoint, exhaustive numbered-app partition in `gimmer-collections.json`, the two landing pages and each app’s return links together. Keep source `apps/` and deployed `docs/` consistent through the normal build. The original CSV remains the complete inventory, not the broader collection membership list.
