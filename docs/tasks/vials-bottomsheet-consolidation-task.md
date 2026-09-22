# Vials — Task: Reusable BottomSheet Component
Task slug: vials-bottomsheet-consolidation
Date: 2026-08-04
Status: DESIGNED
Touches: `src/components/ui/`, onboarding quiz (consumer), `DisambiguationSheet`

---

## Goal

Consolidate bottom-sheet UI into one DS component instead of letting each screen implement its own backdrop/dismiss/safe-area logic — done now, ahead of the onboarding quiz becoming another independent consumer.

---

## Step 0 — Audit first, before writing any component code

Several existing screens are described as "DS modal pattern" without specifying whether they're actually a bottom sheet (slide-up, swipe-to-dismiss) or a centered modal. Confirm each before assuming it's in scope:

| Screen / component | Confirmed bottom sheet? | Notes |
|---|---|---|
| `DisambiguationSheet` (`db-setup-guide.md`, Sprint 4) | Likely — name implies it | First migration target |
| `DeleteProductModal` (US-08.1) | Unconfirmed | Verify before including in scope |
| `AddProcedureModal` (US-18) | Unconfirmed | Contains a blocking Cabernet alert — dismiss behavior matters, see below |
| `LocalDataWarningModal` | Unconfirmed | Shown once per install; may not need a full sheet |
| Import/Restore confirmation summary (US-19) | Unconfirmed | May be full-screen rather than a sheet |

Do not assume all of these migrate as part of this task — only confirmed bottom-sheet usages are in scope now.

---

## Scope for this task

1. Build `src/components/ui/BottomSheet.tsx` + `.d.ts` stub, added to the existing DS component list (alongside Button, Card, IconButton, etc.).
2. Migrate `DisambiguationSheet` onto it (confirmed usage).
3. Build the onboarding quiz sheets (phototype + skin-type) directly on it — new usage, not a migration.
4. Everything else in the audit table: migrate opportunistically when that screen is touched for other reasons. Not a deliverable of this task.

---

## Dependency

`@gorhom/bottom-sheet` — not currently in `package.json`. Apply the same check already used for other Phase 1 additions (`react-native-draggable-flatlist`, `expo-sharing`, etc. per `IMPLEMENTATION_PLAN.md`'s dependency table): confirm Expo Go / SDK 52 compatibility before installing, and install via `npx expo install` if a managed variant exists. No custom native build step should be required — this carries over Phase 1's "Option B — AsyncStorage retained" constraint of staying Expo-Go-runnable.

---

## Component API

```ts
interface BottomSheetProps {
  visible: boolean
  onDismiss: () => void
  dismissible?: boolean            // default true; false = no swipe-down, no backdrop-tap-to-dismiss
  children: ReactNode
  heightMode?: 'content' | 'full'  // default 'content' — sheet sizes to its children
}
```

- `dismissible: false` is required for at least one known case: `AddProcedureModal`'s blocking Cabernet safety warning (US-18) should not be swipe-away-able — the explicit "I understand the risk, log anyway" action must be the only way past it. This is set per-usage as a deliberate product decision, not inferred by the component.
- `heightMode: 'full'` covers variable-length content like `DisambiguationSheet`'s candidate list; `'content'` covers short fixed content like a single quiz question.

---

## Acceptance criteria

- [ ] Component lives in `src/components/ui/`, with a `.d.ts` stub matching the existing DS pattern
- [ ] Swipe-down and backdrop-tap dismissal both respect `dismissible: false`
- [ ] Safe-area insets are handled once, inside the component — no per-usage workarounds
- [ ] `DisambiguationSheet` migrated and passes the existing scan-to-detail flow QA (Sprint 3/4, `db-setup-guide.md`)
- [ ] Onboarding quiz (phototype and skin-type variants) built directly on this component
- [ ] No other existing modal is touched or migrated as part of this task

---

## Open items

- Confirm which audit-table items are actually bottom sheets vs. centered modals before scoping any future migration — this task only resolves that question for `DisambiguationSheet`.
- Open/close animation timing — not blocking; library defaults are acceptable for the first pass.
