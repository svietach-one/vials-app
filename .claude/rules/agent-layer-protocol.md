# Agent Interaction Protocol (AI-SDLC)

## 1. Task Identification ({TASK-SLUG})
Each new task receives a unique name in kebab-case format (e.g., `user-login`, `api-retry-logic`). The use of Jira keys is prohibited.

## 12. Task Lifecycle (Execution Order)
1. **`planner`** — Communicates with the human, creates business requirements (`docs/specs/{TASK-SLUG}.md`), technical design (`docs/tech-design/{TASK-SLUG}.md`), and tracking files.
2. **`qa-lead`** — Reads the design and writes integration/E2E tests before any code is written.
3. **`engineer`** — Writes production code and unit tests until all QA tests pass successfully.
4. **`tech-lead`** — Performs the final code review for bugs and architectural compliance. Accepts the work or blocks it for revision.

## 3. Context Transfer (Handoff)
All coordination occurs locally via the `progress/{TASK-SLUG}-handoff.json` file. Each agent is required to update this file at the very end of their work before committing.