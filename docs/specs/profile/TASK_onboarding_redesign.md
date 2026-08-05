# SUPERSEDED — see docs/specs/onboarding-5-step-redesign.md

Status: SUPERSEDED
Date superseded: 2026-07-27

This document has been superseded by the canonical spec at
`docs/specs/onboarding-5-step-redesign.md` (business spec) and
`docs/tech-design/onboarding-5-step-redesign.md` (technical design).

This original draft was written against a stale/parallel view of the
codebase and contained factual errors about the `Profile` type, the store
pattern (invented per-field setters), the post-step-5 navigation target, the
phototype card count (the spec assumed 3 grouped cards were still shipping;
6 individual cards had already shipped under a prior task), the "reuse the
existing DS ProgressRing component" instruction (that component is a
non-React-Native web artifact), and the button-color "blocker" (already
resolved in the real `Button.tsx`). Two further corrections were found
during the new planning pass: the Step 5 "Finish" action must not set
`onboardingCompleted`, and the shipped `gender` field has no `'other'`
value despite the reference copy assuming three gender options. See the
History note at the bottom of the new canonical spec for the full,
itemized list.

The product intent captured in this original draft (5 sequential
onboarding steps, the two new safety fields, the progress ring,
skip/next/finish semantics, acceptance criteria) remains valid and was
carried forward into the new canonical spec.

The sibling copy-reference document,
`docs/specs/profile/SCREENS_onboarding_spec.md`, remains accurate and is
still the source of truth for per-step UI text — read it alongside the new
canonical spec.
