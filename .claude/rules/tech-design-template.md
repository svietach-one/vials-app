---
name: tech-design-template
description: >
  Technical design document template and quality standards. Defines the
  required sections, constraints, and format for all tech design documents
  in docs/tech-design/. Used by tech-designer (authoring) and tech-lead
  (validation, design phase). Auto-activates when creating or reviewing tech designs.
---

# Technical Design Template

## Document Structure

Every tech design document must follow this structure. Sections may be marked "N/A" if genuinely not applicable, but must not be omitted.

# Technical Design: [Feature Name]
Spec: docs/specs/{ISSUE-KEY}-[filename].md
Author: tech-designer
Date: [YYYY-MM-DD]

## 1. Architecture Overview
[How data flows through the system. Which existing services/modules are involved. What new modules are needed. Keep it to 5-10 lines + a simple ASCII diagram if helpful.]

## 2. API Contracts
[Only NEW or CHANGED endpoints. For each one: method, path, request body shape, response shape, error codes. Reference existing patterns — don't redefine them.]

### POST /api/v1/[endpoint]
- Request: { field: type }
- Response 200: { id: uuid, status: string }
- Errors: 400 (validation), 401 (auth), 409 (conflict)

## 3. Implementation Tasks

### engineer (scope=backend)
- BE-1: [short description] — files: src/api/...
- BE-2: [short description] — files: src/api/...

### engineer (scope=frontend)
- FE-1: [short description] — files: src/web/...

### devops-lead (if infra_changes: true)
- INFRA-1: [short description] — files: infra/...

### engineer (unit tests, both scopes)
- Each task above includes writing unit tests for the code produced

## 4. Assumptions
- [Decision statement].
  Alternative: [what else could have been done].
  Reason: [why this choice was made].
- [If none: "No assumptions."]

## 5. Open Questions
- [Any decisions that need clarification before implementation begins]
- [If none: "No open questions."]

---

## Quality Constraints

- Under 150 lines. If longer, you are over-specifying. (See ai-sdlc.json for hard threshold.)
- Tasks must be atomic enough for one agent invocation to implement in isolation.
- Every API endpoint must have request/response shapes (not full JSON Schema — just the shape).
- Open questions must be resolved before calling for engineer agents.

---

## What NOT to Include

- Full SQL/Prisma/SQLAlchemy schemas — engineers read the existing schema directly
- Full component trees — a file list in the task is enough
- Infrastructure resource details — devops-lead reads infra/ and the task description
- Test scope breakdown — qa-lead determines this from the spec and tech design
- Data model migrations — engineer (scope=backend) handles this based on the task description

---

## Assumptions Format

Every assumption must include three parts:
1. Decision — what was decided
2. Alternative — what else could have been done
3. Reason — why this choice was made

Example:
- Order statuses use the existing OrderStatus enum.
  Alternative: create a separate enum for filter-specific statuses.
  Reason: avoids domain duplication; existing enum covers all needed values.

### Gap types that produce assumptions

| Gap type | Action |
|---|---|
| Type A — Business gap | Do NOT create an assumption. Set BLOCKED + NEEDS_CLARIFICATION. |
| Type B — Technical, one answer | Create assumption, proceed. |
| Type C — Technical, multiple answers | If affects API/DB/migrations -> ask user. Otherwise -> assumption. |
| Type D — Contradiction | Do NOT create assumption. Set BLOCKED, route to product-analyst. |

---

## Validation Checklist (for tech-lead, design phase)

When reviewing a tech design against this template:
- [ ] All 5 sections present (or explicitly marked N/A)
- [ ] Architecture overview is 5-10 lines, not a full system diagram
- [ ] API contracts show request/response shapes and error codes
- [ ] Tasks are assigned to specific agents (engineer scope=backend|frontend, devops-lead) with file paths
- [ ] Assumptions follow the decision/alternative/reason format
- [ ] No business-level assumptions (those require PM sign-off -> Jira)
- [ ] Document is under 150 lines (see ai-sdlc.json)
- [ ] Open questions are empty (all resolved) before implementation starts