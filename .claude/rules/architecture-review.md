---
name: architecture-review
description: >
  Technical architecture review checklist: design fidelity against tech-design
  docs (data model, API contracts, frontend components, infra), layer separation
  (route/service/data, no HTTP in services, no logic in components), cross-feature
  collision detection (routes, Prisma models, types), TypeScript type safety gate,
  and technical debt signals. Use when asked to "review this PR", "architecture review",
  "tech-lead review", or "check design fidelity".
compatibility: TypeScript/Node.js (Express/Next.js), Prisma ORM. Applies to src/api/ and src/web/.
---

# Architecture Review Standards

## Tech Lead's Mental Model
Your job during a review is to answer three questions:
1. Fidelity — Was what was designed actually built?
2. Fit — Does it fit cleanly into the existing system without duplication or conflict?
3. Future — Will this make the next feature easier or harder to build?

---

## 1. Design Fidelity Checks
Compare the technical design document docs/tech-design/{TASK-SLUG}.md to the implemented code:

| Tech Design Section | Verification Criteria |
|---|---|
| Data Model | Prisma schema matches exactly — no extra or missing fields. |
| API Contracts | Every endpoint exists; request and response shapes match the spec. |
| Frontend Components | Component names and layout structure match the tree in the design. |

- Rule: Any undocumented deviation from the technical design without a corresponding justification in the log file progress/{TASK-SLUG}.md is an automatic BLOCKER.

---

## 2. Collision & Duplication Detection

### Route Collisions
Verify that new API routes do not shadow or conflict with existing routes:
grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\)" src/api/routes/ | grep -oP "['\"](/[^'\"]+)['\"]" | sort | uniq -d

### TypeScript Type Duplication
Ensure the engineer did not recreate identical or redundant interfaces across different files:
grep -rn "^type \|^interface " src/ --include="*.ts" | grep -v "node_modules" | awk -F: '{print $NF}' | sort | uniq -d

---

## 3. Layer Separation Controls

### Service Isolation (No HTTP in Services)
Business logic layers (src/api/services/) must have zero awareness of the HTTP transport layer. Detecting request/response objects or status helpers here is a direct violation:
grep -rn "req\.\|res\.\|next(\|status(" src/api/services/ --include="*.ts"

### Thin Frontend Components
Components should handle display and user interaction only. Complex inline computations (.filter, .reduce, nested .map) indicate leaked business logic:
grep -rn "\.filter\|\.reduce\|\.map.*\.map\|Math\." src/web/components/ --include="*.tsx" | head -20

---

## 4. Type Safety Gate
Run the project's type compiler. Any active TypeScript compilation error automatically blocks the review:
npx tsc --noEmit 2>&1

---

## 5. Technical Debt & Quality Signals

### Function Length Limits
Functions exceeding 50 lines must be refactored and split into sub-functions:
awk '/^(export )?(async )?function|^  (async )?function|=> {/{start=NR} /^}$/{if(NR-start>50) print FILENAME":"start" ("NR-start" lines)"}' $(find src/ -name "*.ts" -not -path "*/node_modules/*") 2>/dev/null | head -20

### Leftover Debug & Temporary Markers
Scan the codebase to prevent internal markers or debugging artifacts from leaking into main:
- Find unresolved TODOs, FIXMEs, and HACKs:
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" | grep -v node_modules
- Find forgotten console logs or debuggers:
grep -rn "console\.log\|debugger" src/ --include="*.ts" | grep -v node_modules

---

## Severity & Actions Matrix

| Violation | Severity Level | Agent Action |
|-----------|----------------|--------------|
| TypeScript compilation error (tsc --noEmit) | BLOCKER | Stop review, set task status to BLOCKED |
| API contract mismatch with technical design | BLOCKER | Stop review, set task status to BLOCKED |
| Business logic leaked into route or component | BLOCKER | Reject PR, demand layer refactoring |
| Residual console.log or debug statements | WARNING | Note in feedback, do not block merge |
| Single function exceeding 50 lines | WARNING | Recommend refactoring, allow merge if clean |

---

## 6. Troubleshooting & Handling Deviations
- Scenario: The engineer modified the data model or API structure away from the design.
- Resolution: Check progress/{TASK-SLUG}.md. If the ## Log contains a clear explanation (e.g., "Changed field X to Y because..."), downgrade the issue to a WARNING. If no log entry is present, mark it as a BLOCKER and return the task to the engineer.