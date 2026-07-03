# Architecture Review Standards (Expo / React Native)

## Tech Lead's Mental Model
Your job during a review is to answer three questions:
1. Fidelity — Was what was designed actually built?
2. Fit — Does it fit cleanly into the existing system without duplication or conflict?
3. Future — Will this make the next feature easier or harder to build?

---

## 1. Design Fidelity Checks
Compare the technical design document `docs/tech-design/{TASK-SLUG}.md` to the implemented code:

| Tech Design Section | Verification Criteria |
|---|---|
| Data Model | Interfaces in `src/types/index.ts` match exactly — no extra or missing fields. |
| Screens & Components | Component names and layout structure match the design; new screens are registered in `src/navigation/AppNavigator.tsx` with typed param lists. |
| Stores | New persisted state uses a Zustand store in `src/store/` backed by `src/services/storage.ts` with a key in `STORAGE_KEYS`. |

- Rule: Any undocumented deviation from the technical design without a corresponding justification in the log file `progress/{TASK-SLUG}.md` is an automatic BLOCKER.

---

## 2. Layer Separation Controls

The app has three layers. Each must stay isolated:

| Layer | Responsibility | Prohibited |
|---|---|---|
| Screens / components (`src/screens/`, `src/components/`) | Rendering, local UI state, calling stores/domain actions | Business rules, direct AsyncStorage access, fetch calls |
| Stores / domain (`src/store/`, `src/domain/`) | State, persistence, cross-store orchestration | Rendering concerns, navigation |
| Utils / services (`src/utils/`, `src/services/`) | Pure business logic, API clients, storage helpers | Importing React, react-native UI, or stores (utils must stay pure) |

Checks:

- Cross-store operations (e.g. delete product + purge routine steps) must live in `src/domain/`, never composed ad hoc inside a screen.
- No direct AsyncStorage usage outside `src/services/storage.ts`:
  `grep -rn "AsyncStorage" src/ --include="*.ts*" | grep -v "services/storage.ts"`
- No React imports in business-logic utils:
  `grep -rln "from 'react'" src/utils/`
- Network calls only inside `src/services/`:
  `grep -rn "fetch(" src/ --include="*.ts*" | grep -v "src/services/"`

---

## 3. Duplication Detection

- TypeScript type duplication — domain types belong in `src/types/index.ts`, not recreated per file:
  `grep -rn "^export type \|^export interface " src/ --include="*.ts*" | grep -v types/index.ts | grep -v Props`
- Design tokens — no hardcoded colors/spacing in components; everything comes from `src/constants/tokens.ts`:
  `grep -rn "#[0-9a-fA-F]\{6\}" src/screens/ src/components/ --include="*.tsx"`

---

## 4. Type Safety Gate
Run the project's type compiler. Any active TypeScript compilation error automatically blocks the review:
`npx tsc --noEmit 2>&1`

---

## 5. Technical Debt & Quality Signals

- Functions exceeding 50 lines must be refactored and split into sub-functions.
- Find unresolved TODOs, FIXMEs, and HACKs:
  `grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts*"`
- Find forgotten console logs or debuggers (dev-only `__DEV__`-guarded warnings are acceptable):
  `grep -rn "console\.log\|debugger" src/ --include="*.ts*"`
- Product constraints from CLAUDE.md hold: no pink hues, English-only UI text, minimum 14px font size, conflict warnings only in routines.

---

## Severity & Actions Matrix

| Violation | Severity Level | Agent Action |
|-----------|----------------|--------------|
| TypeScript compilation error (`tsc --noEmit`) | BLOCKER | Stop review, set task status to BLOCKED |
| Data model / screen mismatch with technical design | BLOCKER | Stop review, set task status to BLOCKED |
| Business logic leaked into a screen or component | BLOCKER | Reject PR, demand layer refactoring |
| Direct AsyncStorage or fetch outside services layer | BLOCKER | Reject PR, route through the service |
| Residual console.log or debug statements | WARNING | Note in feedback, do not block merge |
| Single function exceeding 50 lines | WARNING | Recommend refactoring, allow merge if clean |
| Hardcoded color/spacing values bypassing tokens | WARNING | Recommend tokenising, allow merge if clean |

---

## 6. Troubleshooting & Handling Deviations
- Scenario: The engineer modified the data model or store structure away from the design.
- Resolution: Check `progress/{TASK-SLUG}.md`. If the `## Log` contains a clear explanation (e.g., "Changed field X to Y because..."), downgrade the issue to a WARNING. If no log entry is present, mark it as a BLOCKER and return the task to the engineer.
