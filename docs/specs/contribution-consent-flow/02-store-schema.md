# Store Schema — Contribution Consent

## `settingsStore` additions

```ts
contributionConsentStatus: 'unset' | 'declined' | 'accepted' | 'disabled'  // default: 'unset'

// Reminder cadence bookkeeping — only meaningful while status === 'declined'
declinedSaveCountSinceLastReminder: number   // default: 0
reminderCountShown: number                    // default: 0 — 0 = no reminder shown yet,
                                               // 1 = 1st reminder shown, 2 = 2nd, 3+ = 3rd/every-30 tier

// Actions
setContributionConsentStatus(status: ContributionConsentStatus): void
  // Side effects:
  //   - setting to 'accepted' or 'disabled' resets declinedSaveCountSinceLastReminder to 0
  //   - setting to 'unset' (re-enabling from 'disabled') resets reminderCountShown to 0 as well
incrementDeclinedSaveCount(): void
resetDeclinedSaveCount(): void
incrementReminderCountShown(): void
```

Persisted via AsyncStorage like the rest of `settingsStore`, per Phase 1 architecture constraints in `IMPLEMENTATION_PLAN.md` (no separate storage driver introduced).

## `productsStore` / `Product` type additions

Per-product field, set once at save time and not mutated afterward:

```ts
contributionOptIn: boolean  // true only if the user explicitly opted in on THIS product's save
```

Add to `src/types/index.ts`'s `Product` type alongside the existing fields (`id, brand, name, type, inciTags[], openedDate, paoMonths, source`).

## Derived value (not persisted, computed on read)

```ts
// in productsStore or a selector
contributedProductsCount = () =>
  get().products.filter(p => p.contributionOptIn === true).length
```

## Notes

- These fields are independent of `medicalDisclaimerAcceptedAt` / `medicalDisclaimerVersion` (the onboarding medical-disclaimer fields from the separate `onboarding-consent-copy-update` task) — do not conflate or reuse either field for the other purpose.
- `ConflictEngine` and store-write rules from `IMPLEMENTATION_PLAN.md` ("ConflictEngine is never called from inside a store", "all stores remain synchronous after hydration") are unaffected by this change — none of the above requires async writes or engine calls.
