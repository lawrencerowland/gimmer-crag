# One canonical refuge app, two purpose entrances

Implemented locally on 12 September 2026 following the user's accepted curation proposal. This record describes local implementation and agent verification; publication is a separate checkpoint.

Processes to plans features **Generate refuge schedules from process rules**, opening App 20 with `?view=scheduler`. The broader collection adds **Why one plan can hide different process rules**, opening the same file with `?view=comparison`. The comparison is inherited background and uses supplied mechanisms; it does not infer a mechanism from an observed plan.

Each entrance sets its page title, main heading, introduction, visible work area and primary collection return. The view links preserve temporary controls and results. Back/forward restores the selected entrance. Plain URLs still open the comparison. Recognized existing hashes reveal the relevant section even when the query requests the other view; unrelated query parameters survive view switches. Both static collection links and both no-JavaScript work areas remain present. Existing inherited redirects can continue forwarding their query and hash unchanged.

The numbered inventory still contains 26 unique apps with 16/10 disjoint primary memberships. A manifest reference represents App 20's additional comparison entrance. There is one source implementation and the normal generated deployment copy.

The simulator and literal toy net are unchanged. Candidate generation remains priority-based sampling. Same-start SMC-style notation and WBS stages remain illustrative projections, with their limitation stated beside the forward controls.

## Local verification

- All 12 actual-core witness tests pass, retaining full 14-task comparisons, resource interventions and failed-completion boundaries.
- The app-link checker passes and now compares collection routes against the manifest, including the separate App 20 purposes and both return anchors.
- All 27 Chrome checks pass against the final static Pages output. They cover both ordinary collection journeys, generation/selection, three comparison interventions, keyboard handoff, view changes, query preservation, back/forward, reload, seven old deep links, reopening a collapsed disclosure, malformed hashes, 390px layout and the no-JavaScript fallback.
- No app script errors or failed local requests were recorded. Desktop and phone screenshots were inspected.
- The canonical HTML, both collection pages and shared stylesheet match their locally copied `docs/` output byte for byte. These are the static-copy operations used by `scripts/build-all.js`; a complete React/Vite build was not run locally because the available runtime supplies Node without npm. The publishing workflow remains responsible for the full build.
- `git diff --check` passes. No commit, remote push or publication was performed as part of this local implementation checkpoint.

The repeatable checks are `node --test scripts/process-witness.test.js`, `node scripts/check-app-links.js`, and `node scripts/curation-browser.mjs` with Playwright and Chrome available. The browser script accepts `BASE_URL` for source or built/public output and `EVIDENCE_DIR` for its JSON report and screenshots.

These checks demonstrate the bounded navigation and retained model behaviour. They do not establish human usefulness, engineering validity or a general categorical transformation.
