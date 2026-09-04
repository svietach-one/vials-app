# Implementation Prompt — Product Contribution Consent Flow

Task slug: `product-contribution-consent`
Status: READY FOR IMPLEMENTATION
Depends on: Phase 4 (Catalog Screen / `ProductForm`) from `IMPLEMENTATION_PLAN.md`
Related, but separate: `onboarding-consent-copy-update` (medical disclaimer on onboarding slide 3 — already speced, not part of this task)

---

## What to build

When a user saves a manually-created product (`ProductForm`, per `IMPLEMENTATION_PLAN.md` Phase 4 / `SCREENS.md` §3), decide whether to ask them to share it (anonymously) with the Vials product database, using the following rules. Read all four companion files before implementing — they are not optional context, they contain the actual copy, schema, and visual spec this task depends on:

1. `01-copy-and-consent-states.md` — the state machine, reminder cadence, and all EN/RU copy (source of truth — do not paraphrase).
2. `02-store-schema.md` — exact fields/actions to add to `settingsStore` and `productsStore`.
3. `03-visual-spec.md` — colors, icon, toast styling.
4. `04-spec-file-updates.md` — the exact edits to make in `SCREENS.md`, `PRD_Spec.md`, `USER_STORIES.md`, `IMPLEMENTATION_PLAN.md` so the specs stay in sync with this behavior.

---

## Build order

1. Add the new fields/actions to `settingsStore` and `productsStore` (see `02-store-schema.md`).
2. Build the `ContributionConsentModal` component (full modal, used both for the first-time ask and for periodic reminders — same component, different copy variant passed as a prop).
3. Build the `ContributionToggle` component (compact inline toggle, lives inside `ProductForm`, always visible unless status is `disabled`).
4. Wire the decision logic into the `ProductForm` save handler (see the pseudocode in `01-copy-and-consent-states.md` §2 — implement it exactly as written, including the three-stage reminder schedule).
5. Wire the green success toast (reuse the existing toast/notification system — do not build a new toast component, just add a `success`/green variant if one doesn't already exist).
6. Add the "Share new products with Vials" row + running counter to the Profile screen (`SkinProfileEditor`/settings area per `SCREENS.md` §5), wired to `productsStore`'s derived counter.
7. Apply the spec-file edits from `04-spec-file-updates.md`.

---

## Non-negotiable behavior details (easy to get wrong)

- **Reminder cadence is stateful and counts from the *last shown* reminder, not from install or from the first decline.** Schedule: 1st reminder at 5 declined-saves after the initial "Not now", 2nd reminder at 15 declined-saves after the 1st reminder, 3rd reminder at 30 declined-saves after the 2nd reminder, then every 30 declined-saves after that. See the worked example in `01-copy-and-consent-states.md` §2 if this is ambiguous from the pseudocode.
- **`disabled` status (explicit opt-out in Profile) permanently silences both the modal and the inline toggle.** No reminder logic runs while status is `disabled`. The only way out of `disabled` is the user manually re-enabling the Profile setting.
- **The counter only counts products where `contributionOptIn === true` on that specific product record** — not all manually-added products, and not gated by the user's *current* global status (so turning `disabled` on later does not retroactively shrink the counter).
- **The modal and the inline toggle are the same visual language but different components** — don't try to make one collapse into the other via CSS visibility; the modal blocks interaction (it's a decision moment), the toggle doesn't (it's a passive default).

---

## Explicitly out of scope for this task

- The medical-disclaimer onboarding checkbox (separate task, already speced).
- Any backend/API change to `POST /api/v1/products/suggest` — this task only concerns when/how the client asks for and records consent before firing that existing call.
- Push notifications or any out-of-app reminder — the reminder is strictly in-flow, triggered by the save action itself.
- Localization infrastructure (i18n keys/loader) — copy is provided in both RU and EN as literal strings; wire them however the app's existing locale system expects.

## Scope decisions from review (resolved, do not re-litigate)

These were raised and explicitly closed — do not add speculative handling for them:

- **No consent-copy versioning field.** The app has no users in production yet, so there's no backward-compatibility burden to protect against. Skip `contributionConsentVersion` entirely for now. The one thing that must still happen: whatever the modal copy reads at actual launch time needs a legal review pass once, before real users see it — that's a one-time review gate, not an ongoing versioning system. If versioning is needed post-launch, that's a future task, not part of this one.
- **No "share this product later" retroactive path.** If a user declines on a product, that product simply may or may not get added by someone else later. Not a gap to fill now.
- **No special handling for Import/Restore (US-19).** A restored backup is the user's own data — there's no "whose consent is this" ambiguity to resolve, since it's not merging in anyone else's contributions.
- **No consent flow for editing/completing existing database-sourced products.** This task only covers a user submitting a product they didn't find in the database (`source: 'manual'`, genuinely their own contribution). Editing or completing an existing record pulled from the API (e.g. filling in a missing INCI list on an already-matched product) is a different feature, not built here. Note for later: there's a separate, already-flagged future direction to make INCI a required field when a user selects an incomplete API record — that's a data-quality/validation task, not a consent task, and should be scoped separately when it comes up.
