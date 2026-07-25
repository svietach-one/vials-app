# Spec File Updates — Contribution Consent Flow

## `SCREENS.md` — Section 3 (Tab 2: Catalog Screen)

Under `ProductForm (Manual Fallback)`, replace the "Instant local activation" / "Asynchronous background sync" bullets with:

> * **Instant local activation on save:** The new record is immediately written to `productsStore` with `source: 'manual'`, available for routines and conflict checks without a server round-trip.
> * **Contribution consent:** Whether the record is also sent to the server depends on `settingsStore.contributionConsentStatus`:
>   - First manual save ever (`unset`): a full-screen `ContributionConsentModal` asks the user to opt in, with a toggle defaulting on. Accepting sets status to `accepted`; declining sets status to `declined`.
>   - Subsequent saves while `declined`: no modal on most saves — just a compact inline toggle in the form (default off) — except on a periodic reminder cadence (5 declined saves, then 15, then 30, then every 30) where the full modal reappears with softer copy.
>   - Subsequent saves while `accepted`: compact inline toggle only, default on.
>   - While `disabled` (explicit opt-out in Profile): no modal, no toggle, ever.
>   - See `progress/contribution-consent-flow/01-copy-and-consent-states.md` for the full state machine and copy.
> * **Asynchronous background sync:** If the user opted in on this save (`contributionOptIn: true`), the app fires `suggestProduct(payload)` → `POST /api/v1/products/suggest` in the background with `status: 'pending'`. The save action never awaits this call — the user sees an immediate success toast (green variant, see visual spec) and is returned to the Shelf.

## `SCREENS.md` — Section 5 (Tab 4: Profile & Settings Screen)

Add a new bullet after `GamificationToggle`:

> * **`ContributionSettingsRow`:** DS Switch labeled "Share new products with Vials", bound to `settingsStore.contributionConsentStatus` (on = `accepted`, off = `disabled`; re-enabling from `disabled` resets to `unset` so the full explainer modal reappears on the next manual save). Shows a running count: "{N} products contributed so far", derived from `productsStore` (count of records with `contributionOptIn === true`). Helper text clarifies that turning this off only affects future contributions, not already-shared records.

## `PRD_Spec.md` — Section 4.3 (Tab 2: Catalog Screen)

Update the "Crowdsourcing & Manual Fallback" bullet to reference the new consent flow instead of implying background sync always happens unconditionally:

> * **Crowdsourcing & Manual Fallback:** If a product is missing from the global database, the user fills out a manual form. Whether the submission is sent to the server depends on the user's contribution-consent state (first-ask modal, periodic reminders while declined, permanent opt-out available in Profile) — see `progress/contribution-consent-flow/`. Upon saving, the product is always written locally first (`source: 'manual'`); the background `POST /api/v1/products/suggest` call only fires if the user opted in for that specific product.

## `PRD_Spec.md` — Section 2.1 (flag for separate cleanup, not part of this task)

`PRD_Spec.md` §2.1 states primary buttons are pure black (`#09090B`). The shipped onboarding screens use a plum/wine primary button instead. This predates this task and isn't something to silently fix as a side effect here — flag it to whoever owns the design-system doc so §2.1 gets reconciled against the actual shipped color, or the shipped screens get corrected to match black. This task's new modal should match the **shipped** plum, per `03-visual-spec.md`, regardless of which side the reconciliation lands on.

## `USER_STORIES.md` — add new story

```markdown
### US-24 · Product Contribution Consent

**As a** user manually adding a product
**I want to** be asked, clearly and not too often, whether my product data can help grow the shared database
**So that** I stay in control of what I contribute without being nagged on every save.

**Acceptance criteria:**
* On a user's first-ever manual product save, `ContributionConsentModal` (first-time variant) is shown before the background sync would fire. The modal explains the value of sharing and includes a toggle (default on) plus `Continue` / `Not now` actions.
* If the user accepts, `settingsStore.contributionConsentStatus` becomes `accepted`, `contributionOptIn: true` is set on that product, and no modal is shown again for future saves — only a compact inline toggle (default on) inside `ProductForm`.
* If the user declines, status becomes `declined`, `contributionOptIn: false` is set on that product, and subsequent saves show only the compact inline toggle (default off) — with the modal reappearing (reminder variant, softer copy) on a schedule: after 5 declined-saves, then after 15 more, then after 30 more, then every 30 declined-saves thereafter. The schedule tracks declined-saves since the *last* reminder shown, not since account creation.
* Accepting any reminder modal moves status permanently to `accepted` and stops the reminder cadence.
* A `ContributionSettingsRow` in the Profile screen lets the user explicitly set status to `disabled` at any time, which silences the modal and toggle entirely going forward, without deleting or un-sharing any products already contributed. Re-enabling from `disabled` resets status to `unset`, so the full first-time modal is shown again on the next manual save.
* A running counter — "{N} products contributed so far" — is shown in Profile and referenced in the post-save success toast. It counts only products where `contributionOptIn === true` was set at time of save, regardless of the user's current global status.
* The success toast after a manual save uses a green ("success") visual treatment, distinct from the app's default black/monochrome UI, per `progress/contribution-consent-flow/03-visual-spec.md`.
```

Also add a sync-note line at the top of `USER_STORIES.md` (following the existing revision-note pattern) referencing US-24 and the reconciliation flag on `PRD_Spec.md` §2.1.

## `IMPLEMENTATION_PLAN.md` — Phase 4 (Catalog Screen)

Under `ProductForm (Manual Fallback + Crowdsourcing)`, replace the "Instant local activation" / "Asynchronous background sync" bullets with the same updated language as the `SCREENS.md` §3 edit above, and add two new components to the Phase 4 component list:

> - `ContributionConsentModal` — full-screen modal, two copy variants (`first-time` / `reminder`), toggle + two CTAs. See `progress/contribution-consent-flow/01-copy-and-consent-states.md`.
> - `ContributionToggle` — compact inline toggle rendered inside `ProductForm` on all manual saves except the ones that trigger the modal.

Add to Phase 6 (`ExportBackupUtility` / `ImportRestoreUtility` section), a new bullet:

> - `ContributionSettingsRow` — Profile-screen switch + counter for contribution consent, bound to `settingsStore.contributionConsentStatus`. See `progress/contribution-consent-flow/`.

Add to the Phase 0 `settingsStore` update bullet (alongside `dismissedBanners` and the medical-disclaimer fields from the separate onboarding task):

> Add `contributionConsentStatus`, `declinedSaveCountSinceLastReminder`, `reminderCountShown` and their actions — see `progress/contribution-consent-flow/02-store-schema.md`. Add `contributionOptIn: boolean` to the `Product` type in `src/types/index.ts`.
