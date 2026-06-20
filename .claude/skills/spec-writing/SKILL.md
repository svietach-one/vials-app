---
name: spec-writing
description: >
  Standard product specification format, required template (10 sections from
  Problem Statement to Open Questions), and quality bar for this project. Use
  when asked to "write a spec", "create a product spec", "draft a feature
  specification", "review this spec", or when the planner agent is authoring
  or evaluating any feature specification. Covers required sections, testable
  AC format, precision rules, and common spec mistakes to avoid.
---

# Product Specification Standard

## Spec File Naming
`docs/specs/YYYY-MM-DD-kebab-case-feature-name.md`

## Required Spec Template

```markdown
# [Feature Name]
Date: YYYY-MM-DD
Author: planner-agent
Jira: [PROJ-XXX]
Status: DRAFT | APPROVED | SUPERSEDED

## 1. Problem Statement
[Why does this feature exist? What user pain does it solve?
One paragraph. If you can't write this clearly, stop and ask.]

## 2. Goals
- [Specific, measurable outcome 1]
- [Specific, measurable outcome 2]

## 3. Non-Goals (explicitly out of scope)
- [Thing we are NOT doing, even if related]
- [Prevents scope creep — be explicit]

## 4. User Stories
### Story 1: [Short name]
As a [role], I want to [action] so that [benefit].

**Acceptance Criteria:**
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]

### Story 2: ...

## 5. UX / Behaviour
[Describe what the user sees and does — step by step.
Include error states, empty states, loading states.
Reference designs/mockups if they exist.]

## 6. Data Requirements
- New data needed: [describe]
- Existing data consumed: [which entities, which fields]
- Data retention: [how long, why]

## 7. Dependencies
- Depends on spec: [link to other spec if this builds on something]
- Blocks: [any other feature that cannot start until this ships]
- External services: [any third-party APIs or services needed]

## 8. Security & Privacy
- Authentication required: yes/no
- Data sensitivity: [PII / financial / public]
- Compliance considerations: [GDPR, HIPAA, etc. if relevant]

## 9. Success Metrics
- [How will we know this feature is working? Specific numbers.]

## 10. Open Questions
- [ ] [Question] → owner: [person/team]
```

## Quality Bar — Every Spec Must Pass These

### Completeness
- Every acceptance criterion is testable (Given/When/Then format)
- Non-goals are explicit — not just "everything else"
- Error states are described, not just happy paths
- All open questions have an owner

### Precision
- No vague language: "fast", "easy", "simple" — replace with measurable
- No passive voice for requirements: "Users should be able to" → "Users can"
- No "TBD" without an owner and deadline

### Dependencies
- If this spec references another feature, that feature's spec must be linked
- If this spec changes existing behaviour, the original spec must be updated

## Common Mistakes to Avoid
- Writing acceptance criteria as "The system displays X" — say WHAT X is specifically
- Missing the error/failure case — always specify what happens when things go wrong
- Forgetting non-goals — they prevent the tech-designer from over-engineering
- Vague success metrics — "users will be happier" is not a metric

## Troubleshooting

**"Acceptance criteria aren't testable"**
Rewrite using Given/When/Then. If you cannot fill in all three parts concretely, the AC is too vague — break it down further or ask the product owner for specifics before continuing.

**"Non-goals section is empty"**
This is always wrong. If scope feels unlimited, the feature is too large to spec as a single story. Force at least 2 explicit non-goals — things a reader might reasonably assume are included but are not.

**"The problem statement reads like a feature description"**
Rewrite it starting from the user's pain: "Users currently cannot..." or "The current system fails when...". A problem statement describes what is broken or missing today, not what will be built tomorrow.

**"Open questions have no owner"**
Every open question must name a person or team responsible for resolving it. Unowned questions are never resolved. If you don't know who owns it, that itself is a blocker — escalate before finalising the spec.
Every open question must name a person or team responsible for resolving it. Unowned questions are never resolved. If you don't know who owns it, that itself is a blocker — escalate before finalising the spec.

---

## Examples

**Example 1: Writing a spec from scratch**

User says: "Write a spec for user notifications — email and in-app"

Actions:
1. Draft all 10 sections: Problem Statement → Goals → Non-Goals → User Stories → UX/Behaviour → Data Requirements → Dependencies → Security → Success Metrics → Open Questions
2. Write each AC in Given/When/Then format; ensure error states are covered
3. Set explicit non-goals (e.g. "SMS notifications are out of scope")
4. Save to `docs/specs/YYYY-MM-DD-user-notifications.md`

Result: Complete spec file passing all quality bar checks, ready for spec-flags and spec-collision-check

---

**Example 2: Reviewing an existing spec**

User says: "Review this spec — does it meet quality standards?"

Actions:
1. Check completeness: all 10 sections present, no empty sections
2. Check each AC for testable Given/When/Then format — rewrite any that use passive voice
3. Verify non-goals are explicit (not "everything else")
4. Verify all open questions have an owner and no "TBD" without deadline

Result: Review report listing which sections pass, which need revision, with specific rewrites suggested
