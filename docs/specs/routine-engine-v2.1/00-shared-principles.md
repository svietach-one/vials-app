# Shared Principles (include in every implementation session)

1. **Minimalism beats completeness.** An empty slot is not an error. A 3-step
   routine that solves the goal is better than a 7-step routine that exists
   "because the products are on the shelf."
2. **A product enters the routine only through one of two grounds:**
   (a) it fills a skeleton slot (cleanse / moisturize / SPF), or
   (b) it is selected as a treatment for an active user goal.
   "Doesn't conflict and fits under the caps" is NOT a ground for inclusion.
3. **Do-no-harm > efficacy.** On any ambiguity the engine picks the more
   conservative option (less often, gentler, exclude).
4. **Determinism.** No `Math.random`, no iteration over objects without sorted
   keys. Identical input → byte-identical output.
5. **Explainability.** Every "excluded / frozen / relocated" decision is
   written to the DecisionLog with a machine-readable reason code (Phase 7).
6. **100% local.** The engine makes no network calls. Weather lives outside
   the engine (Phase 6, seasonMask is a fixed input).
7. All existing V2 mandates remain in force: stacking caps, frequency caps,
   self-conflict exemption (`ProductA.id !== ProductB.id`), Fitzpatrick 1–6,
   no gamification.
