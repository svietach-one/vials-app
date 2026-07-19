# MASTER PROMPT — Product Images, Card & Routine Screen Redesign, Calendar View

You are implementing a multi-task feature set for the Vials app. The tasks live in
`docs/tasks/product-images/` (files 01–05). Execute them **strictly in order** —
each task depends on the previous one's output.

## Ground rules (apply to every task)

1. **Read first, code second.** Before task 01, read
   `docs/research/product-images-research.md` in full. Before each task file,
   read the actual source files it names — the research doc is from 2026-07-19
   and the codebase may have drifted.
2. **Decisions are locked.** Every task file has a "Locked decisions" section.
   Do not re-open, re-litigate, or "improve" them. If a locked decision turns
   out to be technically impossible, STOP, write the problem into
   `docs/tasks/product-images/BLOCKERS.md`, and continue with the parts that
   don't depend on it.
3. **One task = one commit** (or a small series of commits prefixed with the
   task number, e.g. `[img-02] add ProductThumbnail`). Never mix changes from
   two tasks in one commit.
4. **After every task:** run `npx tsc --noEmit` — must be clean. Run the test
   suite — must pass. Fix before moving on.
5. **Architecture invariants (from IMPLEMENTATION_PLAN / codebase rules):**
   - Zustand stores stay synchronous after hydration; persistence via AsyncStorage.
   - ConflictEngine is only called from the render cycle, never inside stores.
   - `src/utils/` stays pure (no IO); filesystem/network code lives in `src/services/`.
   - All colors/spacing/radii come from `src/constants/tokens.ts`. The Apothecary
     palette keeps its semantic meanings: Amber = warning/conflict,
     Cabernet = completed/blocked, Green = safe/soothing, Cobalt = informational/
     calendar. Never reuse a semantic color for decoration.
   - Local file paths (`localImageUri`) never enter any outbound network payload.
   - Expo SDK 54, Expo Go compatible — no packages requiring a custom native build.
   - Install Expo packages via `npx expo install`, never `npm install`.
6. **Progress tracking.** Maintain `docs/tasks/product-images/PROGRESS.md`:
   after each task, append a short entry (task id, what shipped, deviations,
   files touched).
7. **When a task says "verify on device"** and you cannot run a device, write
   the manual QA step into PROGRESS.md as an unchecked checkbox for the human.

## Task order

| # | File | Depends on |
|---|---|---|
| 01 | `01-image-foundation.md` — types, photo service, upload queue | research doc |
| 02 | `02-thumbnail-and-cards.md` — ProductThumbnail, both cards, form attach | 01 |
| 03 | `03-routine-screen-restructure.md` — header, accordions, drag, action sheet | 02 |
| 04 | `04-photo-server-sync.md` — Supabase Storage upload + contribution linking | 01 (02/03 not required) |
| 05 | `05-routine-calendar-view.md` — month calendar matrix view | 03 |

Task 04 may be swapped after 05 if server credentials are not available yet —
its client side is already stubbed by task 01's queue.

## Definition of done (whole series)

- All five tasks in PROGRESS.md, no unresolved BLOCKERS.
- `npx tsc --noEmit` clean, tests green.
- No new emoji icon stubs; Feather icons only.
- No semantic-color violations introduced (self-audit in the final PROGRESS entry).
