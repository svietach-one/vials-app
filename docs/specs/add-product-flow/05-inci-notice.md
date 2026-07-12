# Task 05: INCI Scan Language Notice

Depends on: `04-camera-modal.md`

## Goal

Create `src/components/camera/InciScanNotice.tsx` — a lightweight
modal/sheet (not a full screen) shown immediately when the user taps "Scan
INCI list" in Section 3, **before** `CameraCaptureModal mode="inci"` is
ever mounted.

**This is a hard requirement, not optional polish.** Do not cut or
simplify this step even under scope pressure — see rationale below.

## Required copy (use verbatim, do not paraphrase)

Heading:
> Scan the original ingredients list

Body:
> Please scan the original INCI ingredients list in Latin characters
> (English/Latin names only). Do not scan localized translations or
> distributor stickers.

Supporting line (context, paraphrasing this one is fine):
> This keeps ingredient matching accurate. If your product only has a
> translated label, use the manual checklist instead.

## Actions

- Primary button: **"Got it, scan now"** → dismisses the notice, then
  opens `CameraCaptureModal mode="inci"`.
- Secondary button: **"Use manual checklist instead"** → dismisses the
  notice entirely and returns focus to the manual `ActivesChecklist` path
  in Section 3. The camera never opens in this case.

## Frequency

Show this notice **every time** the "Scan INCI list" tile is tapped within
a given `AddProductScreen` session. Do not add a "don't show again"
toggle or any persisted dismissal flag. It's a one-line read each time,
and the cost of a user missing it once — silently degraded ingredient
data with no visible error — outweighs the friction of seeing it twice in
one session.

## Why this exists (context for implementation, not user-facing)

The product's business plan explicitly targets markets where a
distributor sticker in the local language (Polish, Belarusian, or a
Korean-brand EU-import label) commonly sits next to or over the original
Latin INCI text on the packaging. `activeIngredientMatcher.ts` (task 03)
only recognizes Latin/English INCI names — scanning the wrong text block
produces **zero matches with no visible error**. That's a silent
correctness bug (a real conflict-causing ingredient goes undetected by
`ConflictEngine` later), not a crash, which makes it more dangerous, not
less. This notice is the cheapest available fix for that failure mode.

## Done when

- The notice renders before every INCI camera launch, with no bypass path
  other than the two buttons described above.
- "Use manual checklist instead" correctly skips the camera entirely and
  lands the user back on the checklist UI from Section 3.
- No persistence/dismissal-memory logic was added — confirm this
  explicitly in review, since it's an easy thing to "helpfully" add later.
