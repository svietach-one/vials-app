# Task: Split onboarding skin-profile survey into 5 sequential steps

Task slug: onboarding-5-step-redesign
Status: READY FOR IMPLEMENTATION — verified against src/types/index.ts and src/store/profileStore.ts
Depends on: `MarketingSlidesScreen` / `FirstProductScreen` (already exist, unaffected by this task)

---

## 0. Context

The skin-profile survey currently collects age, gender, skin type, and phototype in one step. This task
splits data collection into **5 sequential sub-steps**, using **local component state** for the step
index (not 5 separate navigator routes), so back/forward inside this flow doesn't grow the nav stack.
`FirstProductScreen` still follows step 5 exactly as before.

`hormoneTherapy` and `pregnantOrBreastfeeding` already exist on `UserProfile` (schema v6, default
`false`) — this task only needs to add UI that writes to them, not add the fields themselves.

---

## 1. Open decisions — flag, don't silently resolve

1. **`gender` type extension — decided: keep the third option.** `UserProfile.gender` is currently
   `'female' | 'male' | null`, with no non-binary/other member. Product direction: the third pill stays,
   so extend the type rather than dropping it:

   ```ts
   gender: 'female' | 'male' | 'other' | null;
   ```

   Before wiring the new value through, **search every existing read of `profile.gender`** (routine
   engine, recommendation/scoring layers, any personalization logic) and confirm none of them assume a
   strict binary (e.g. an `if (gender === 'female') {...} else {...}` that silently treats `'other'` as
   `'male'`, or a switch statement missing a case that would throw/fall through unexpectedly). Widening a
   shared type is safe only once every consumer is confirmed to handle the new value explicitly — if any
   consumer can't be updated as part of this task, flag it rather than shipping a value nothing
   downstream handles correctly. If it turns out nothing currently reads `profile.gender` for anything
   beyond display/onboarding, note that in the PR too — it changes how much testing this needs.
2. **Per-step severity for the pregnancy procedure check** (used by a separate task,
   `TASK_pregnancy_conflict_engine.md`) affects whether `AddProcedureModal` blocks or just warns — see
   that file. Not this file's concern, just noting the dependency.

---

## 2. Data model — already exists, no changes needed

`UserProfile` (src/types/index.ts) already has every field this flow needs:
`gender`, `age`, `skinType`, `phototype`, `fitzpatrick`, `concerns`, `skinConditions`, `primaryGoal`,
`secondaryGoal`, `goalNeedsConfirmation`, `phototypeNeedsConfirmation`, `hormoneTherapy`,
`pregnantOrBreastfeeding`. Do not add new fields or a new store slice — write through the existing
`useProfileStore().updateProfile(patch)` method, which already merges the patch and re-derives
`phototype`/`fitzpatrick` sync via `syncPhototypeFields` when the patch touches `fitzpatrick`. No new
setters needed.

---

## 3. New component — `OnboardingProgressRing`

Location: `src/components/onboarding/OnboardingProgressRing.tsx`

- Wraps the existing DS `ProgressRing` component — reuse it, don't build a new ring.
- Props: `step: number`, `totalSteps: number` (5), `icon: LucideIcon` (lucide-react-native, per the
  app-wide icon standard).
- Renders the step icon centered inside the ring; ring fill = `step / totalSteps`.
- Render a "Step {step} of {totalSteps}" text label alongside the ring for screen readers — don't rely
  on the ring fill alone.

---

## 4. Screen structure

Location: `src/screens/onboarding/`. Each step component receives `onNext`, `onSkip`, `onBack` (steps
2–5), reads/writes via `useProfileStore().profile` / `updateProfile()`. "Skip" advances without writing
that step's field(s). Step 5's primary button reads "Finish" and, on press, calls
`updateProfile({ onboardingCompleted: true })` and navigates to `FirstProductScreen`.

| Step | Component | Icon | Writes to `UserProfile` |
|---|---|---|---|
| 1 | `SkinTypeStep` | `Droplet` | `skinType` |
| 2 | `GoalsStep` | `Target` | `primaryGoal`, `secondaryGoal`, `goalNeedsConfirmation: false` |
| 3 | `PhototypeStep` | `Sun` | `fitzpatrick`, `phototypeNeedsConfirmation: false` |
| 4 | `AboutYouStep` | `User` | `age`, `gender`, `hormoneTherapy` |
| 5 | `AdditionalInfoStep` | `ShieldCheck` | `pregnantOrBreastfeeding`, `skinConditions`, `concerns` |

### 4.1 `SkinTypeStep`
- Single-select: Oily / Dry / Combination / Normal → `SkinType` (`'oily' | 'dry' | 'combination' |
  'normal'` — matches the type exactly, no mapping needed).
- `updateProfile({ skinType })`.

### 4.2 `GoalsStep`
- Multi-select grid, **max 2 selections**, mapped to `SkinGoal` (`'acne' | 'pigmentation' | 'aging' |
  'dehydration' | 'barrier_repair' | 'oil_control'` — do **not** show `'maintenance'` as a selectable
  card; that value means "no goal chosen" and is the pre-onboarding default, not a user-facing option):

  | Card copy | `SkinGoal` value |
  |---|---|
  | Clear acne | `acne` |
  | Fade pigmentation | `pigmentation` |
  | Anti-aging | `aging` |
  | Deep hydration | `dehydration` |
  | Repair barrier | `barrier_repair` |
  | Control oil | `oil_control` |

- First selection → `primaryGoal`. Second (optional) selection → `secondaryGoal`. If the user picks only
  one, `secondaryGoal` stays `null`.
- `updateProfile({ primaryGoal, secondaryGoal, goalNeedsConfirmation: false })` — explicitly `false`
  because this flag exists to mark goals that were *derived* (e.g. from concerns) rather than
  user-chosen; an explicit onboarding selection is never a derived one.
- Enforce the 2-item cap in the UI (disable further taps once 2 are selected). If Skip is tapped with
  zero selections, don't write `primaryGoal`/`secondaryGoal` at all — leave the existing default
  (`'maintenance'`) in place.

### 4.3 `PhototypeStep`
- 6 cards, 2-column grid, Fitzpatrick I–VI → `FitzpatrickType` (`1 | 2 | 3 | 4 | 5 | 6`).
- Add a small color swatch (~24px) per card as a supplementary visual cue. Cards stay otherwise
  unlabeled beyond numeral/swatch/description (no racial/ethnic terms) and each still carries a full
  `accessibilityLabel` — the swatch is additive, not a replacement for the label.
- Suggested swatch colors — add to `src/constants/tokens.ts` as `PHOTOTYPE_SWATCHES`, not hardcoded
  inline:

  ```ts
  export const PHOTOTYPE_SWATCHES: Record<FitzpatrickType, string> = {
    1: '#F5D9C6',
    2: '#E8BE9A',
    3: '#D2A278',
    4: '#B37F4E',
    5: '#8A5A32',
    6: '#3B2415',
  };
  ```
  These are UI approximations, not a verified reference — flag for design/clinical sign-off before
  shipping, same caveat class as the unverified procedure-spacing table already flagged in the project's
  clinical-review backlog.
- `updateProfile({ fitzpatrick, phototypeNeedsConfirmation: false })` — the store's `syncPhototypeFields`
  re-derives the grouped `phototype` automatically from `fitzpatrick`; do not also write `phototype`
  directly. `phototypeNeedsConfirmation: false` because this step is the explicit 6-card choice the type
  comment describes as clearing that flag (it exists for values auto-derived during a migration, not
  for user-made choices).

### 4.4 `AboutYouStep`
- Age (optional numeric input) → `updateProfile({ age })`.
- Gender (optional): Female / Male / Other pills, per the type extension decided in §1.
  → `updateProfile({ gender })`. Leaving unselected keeps `gender: null`.
- Caption directly under the gender pills, always visible (not a tooltip):
  > "Skin differs physiologically between men and women — this affects how products perform. We ask to
  > personalize, not out of curiosity."
- Divider, then toggle: **"Currently on hormone therapy"** → `updateProfile({ hormoneTherapy })`.
  - Helper text: "Affects oil production and sensitivity, regardless of the gender selected above."
  - Per the type comment, no downstream logic reads this yet — just persist it, don't build
    personalization logic as part of this task.

### 4.5 `AdditionalInfoStep`
- At the **top** of the screen, amber-accented toggle card (not a plain chip — this is a safety flag):
  **"Pregnant or breastfeeding"** → `updateProfile({ pregnantOrBreastfeeding })`.
  - Helper text: "We'll flag retinoids and other restricted actives."
  - This flag feeds a separate task (`TASK_pregnancy_conflict_engine.md`) — don't build the
    conflict-engine/warning logic here, just persist the toggle.
- "Skin conditions" pills (multi-select) → `SkinConditionType[]` (`'eczema' | 'seborrheic_dermatitis' |
  'rosacea'`) → `updateProfile({ skinConditions })`.
- "Skin concerns" pills (multi-select) → `SkinConcern[]` (`'acne' | 'dryness' | 'wrinkles' |
  'sensitivity' | 'redness' | 'eczema' | 'hyperpigmentation' | 'pores' | 'dark_spots'`) →
  `updateProfile({ concerns })`.
  - Note: `'eczema'` exists in **both** `SkinConcern` and `SkinConditionType`. This is intentional per
    the type's own doc comment (concerns = symptoms, conditions = risk modifiers) and is called out
    there as an open product question already — don't try to merge or dedupe the two "eczema" entries as
    part of this task.
- Buttons: Skip (ghost) / **Finish** (primary) — calls `updateProfile({ onboardingCompleted: true })` and
  navigates to `FirstProductScreen`.

---

## 5. Acceptance criteria

- [ ] 5 steps render in order: skin type → goals → sun reaction → about you → additional info.
- [ ] Progress ring + "Step N of 5" text update correctly, forward and back.
- [ ] "Skip" advances without writing that step's field(s); "Next"/"Finish" persists via `updateProfile`.
- [ ] Goals step enforces max-2 selection and never writes `'maintenance'` as a user choice.
- [ ] Phototype step writes only `fitzpatrick` (+ `phototypeNeedsConfirmation: false`); grouped
      `phototype` updates automatically via the store, not written directly by the screen.
- [ ] Phototype cards show both the color swatch and the existing `accessibilityLabel`.
- [ ] `UserProfile.gender` type extended to `'female' | 'male' | 'other' | null`.
- [ ] Every existing read of `profile.gender` elsewhere in the app is checked and confirmed to handle
      `'other'` correctly (no silent binary fallback); any consumer that can't be updated in this task is
      called out explicitly in the PR.
- [ ] Gender step offers Female / Male / Other.
- [ ] Gender caption text renders exactly as specified, always visible.
- [ ] Hormone-therapy and pregnancy/breastfeeding toggles persist via `updateProfile` and are optional.
- [ ] Pregnancy/breastfeeding toggle is visually distinct (amber) from the neutral chips below it.
- [ ] All new/changed text renders at 14px minimum.
- [ ] Icons use `lucide-react-native`, consistent with the rest of the app.
- [ ] `npx tsc --noEmit` passes with no new errors.
