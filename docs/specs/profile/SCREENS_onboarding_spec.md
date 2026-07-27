# Onboarding — 5-step skin profile spec (reference for TASK_onboarding_redesign.md)

Language: all copy below is final English copy, ready to use as-is. Font sizes: 14px minimum for all
text, including helper/muted text (do not use the 12–13px sizes seen in earlier drafts of this flow).

---

## Step 1 of 5 — Skin type

- Icon: `Droplet` (lucide-react-native)
- Title: "What's your skin type?"
- Subtitle: "Choose the option that best describes your skin most of the time."
- Options (single-select):
  1. Oily — "Shiny, prone to clogged pores"
  2. Dry — "Feels tight, may flake"
  3. Combination — "Oily in some areas, dry in others"
  4. Normal — "Balanced, not too oily or dry"
- Buttons: Skip (ghost) / Next (primary)

---

## Step 2 of 5 — Goals

- Icon: `Target`
- Title: "What would you like to improve?"
- Subtitle: "Choose up to two goals. We'll build routines around your primary goal."
- Options (multi-select, max 2), 2-column grid:
  1. Clear acne
  2. Fade pigmentation
  3. Anti-aging
  4. Deep hydration
  5. Repair barrier
  6. Control oil
- Buttons: Skip (ghost) / Next (primary)

---

## Step 3 of 5 — Sun reaction (phototype)

- Icon: `Sun`
- Title: "How does your skin react to the sun?"
- Subtitle: "This helps us tailor product and procedure recommendations."
- Options (single-select), 2-column grid, 6 cards. Each card: roman numeral + color swatch (see
  `PHOTOTYPE_SWATCHES` in the task file) + short description. Cards remain visually unlabeled beyond
  numeral/swatch/description — no racial or ethnic labels — but each carries a full `accessibilityLabel`:

  | Card | Swatch | Label text on card | accessibilityLabel |
  |---|---|---|---|
  | I | `#F5D9C6` | "Always burns, never tans" | "Light or fair skin tone, always burns, never tans, highest sun sensitivity" |
  | II | `#E8BE9A` | "Usually burns, tans minimally" | "Light skin tone, usually burns, tans minimally, high sensitivity" |
  | III | `#D2A278` | "Sometimes burns, tans gradually" | "Medium skin tone, sometimes burns, tans gradually, moderate sensitivity" |
  | IV | `#B37F4E` | "Rarely burns, tans easily" | "Olive or moderate brown skin tone, rarely burns, tans easily, lower sensitivity" |
  | V | `#8A5A32` | "Very rarely burns" | "Brown skin tone, very rarely burns, low sensitivity, elevated laser/peel risk" |
  | VI | `#3B2415` | "Never burns" | "Dark brown to black skin tone, never burns, lowest sun sensitivity, elevated laser/peel risk" |

- Buttons: Skip (ghost) / Next (primary)

---

## Step 4 of 5 — About you

- Icon: `User`
- Title: "A little about you"
- Subtitle: "Optional, but helps us personalize even better."
- Field: Age (optional), numeric text input, placeholder "e.g. 28"
- Field: Gender (optional), single-select pills: Female / Male / Other
- Caption (always visible, 14px, muted, directly under the gender pills — not a tooltip):
  > "Skin differs physiologically between men and women — this affects how products perform. We ask to
  > personalize, not out of curiosity."
- Divider
- Toggle: "Currently on hormone therapy"
  - Helper text: "Affects oil production and sensitivity, regardless of the gender selected above."
- Buttons: Skip (ghost) / Next (primary)

---

## Step 5 of 5 — Anything we should know

- Icon: `ShieldCheck`
- Title: "Anything we should know?"
- Subtitle: "Select anything that applies. This helps us avoid ingredients or procedures that may not be
  right for your skin."
- **Toggle (top of screen, amber-accented card, not a plain chip):** "Pregnant or breastfeeding"
  - Helper text: "We'll flag retinoids and other restricted actives."
- Section: "Skin conditions" — pills (multi-select): Eczema / Atopic dermatitis, Rosacea, Seborrheic
  dermatitis
- Section: "Skin concerns" — pills (multi-select): Acne, Dryness, Sensitivity, Redness, Wrinkles, Pores,
  Hyperpigmentation, Dark spots
- Buttons: Skip (ghost) / Finish (primary) — "Finish" completes onboarding and navigates to
  `FirstProductScreen`.

---

## Notes carried over from discussion (not yet resolved — see TASK_onboarding_redesign.md §1)

- Primary button color: use `<Button variant="primary">` as-is; do not hardcode a hex. Confirm
  `--control-fill` value with design before shipping.
- Icon library: `lucide-react-native` app-wide (confirmed) — `IMPLEMENTATION_PLAN.md` Phase 7 still
  references Feather icons, which is stale; corrected as part of this task (see task file §7).
- Phototype swatch colors are a UI approximation, not a verified reference — flag for a design sign-off
  pass, same category of caveat as the procedure-spacing table already flagged in `PRD_Spec.md` §6.
