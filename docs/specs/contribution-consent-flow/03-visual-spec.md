# Visual Spec — Contribution Consent Modal, Toggle & Toast

## Icon + badge circle — lilac

Match the icon-circle treatment already used on the Clinic tab and on the `Add Product` screen (see the shield icon in the "All your products are private and stored securely" card — light purple/lilac circle, darker purple/plum icon glyph on top). Reuse that exact token/style rather than introducing a new tint — do not hardcode a new hex here; pull whatever color variable that existing badge circle already uses on those two screens.

- Badge: circle, same size as the existing badge pattern (~44px)
- Icon: outline style, consistent with the rest of the icon set already in the app
- Suggested icon concept: something in the "flask / vial / jar" family, matching the app's own apothecary visual language — pick whatever's closest in the icon set already used elsewhere in the app (do not introduce a new icon family just for this modal)

## Buttons — plum

**Flag before implementing:** `PRD_Spec.md` §2.1 currently states primary buttons are pure black (`#09090B`). The actual onboarding screens already shipped (see `MarketingSlidesScreen`, "Get started" CTA) use a plum/wine color, not black. This is an existing discrepancy between the written spec and the shipped UI — not something introduced by this task. For this modal, follow the **shipped** plum button color (whatever hex is already used for the onboarding primary CTA), not the written black spec. Recommend reconciling `PRD_Spec.md` §2.1 separately (see `04-spec-file-updates.md`).

- Primary CTA (`Continue`): filled plum, white text — same treatment as the existing onboarding primary button
- Secondary CTA (`Not now`): text-only or outline, no fill — consistent with the app's existing secondary-action pattern (per `PRD_Spec.md` §2.1, secondary buttons are outline/transparent — this part of the spec is not in question)

## Toggle — plum

- Track color when on: same plum as the primary buttons above
- Track color when off: neutral gray (existing DS `Switch` off-state, already ported per Phase 0 in `IMPLEMENTATION_PLAN.md`)
- Thumb: white
- This applies to both the toggle inside the modal and the compact inline toggle in `ProductForm`

## Toast — green (success variant)

Do not build a new toast component. Reuse the app's existing toast/notification system (already used elsewhere for save confirmations, per `SCREENS.md` §3 — "success toast ('Product added to your shelf')"). Add or use a `success` color variant on that existing component instead of its current default styling, so this toast reads as affirmatively positive (green) rather than neutral.

- Background/accent: green, drawn from the same Green (`#0F4C3A`) family already reserved in the Apothecary Glass Matrix for "recovery indicators, safe-skin days" per `PRD_Spec.md` §2.2 — reusing this existing semantic color, not introducing a new one
- Icon: checkmark, consistent with whatever icon the existing toast system already uses for success states
- Two-line content: bold "Saved" line + secondary counter line (see copy in `01-copy-and-consent-states.md` §4.4) — omit the counter line entirely (not just blank it) when `contributionOptIn` is false for that save

## Do not

- Introduce new one-off colors outside the app's existing Apothecary Glass Matrix / plum-button palette already in use.
- Build a separate toast component — extend the existing one.
- Reuse the amber ("caution") tone anywhere in this flow — this isn't a warning, it's an invitation, so amber would send the wrong signal per the existing semantic mapping in `PRD_Spec.md` §2.2.
