---
name: ts-coding-standards
description: >
  Project TypeScript and JavaScript coding standards, patterns, and conventions.
  Use when writing or reviewing TypeScript or JavaScript code, asked about naming
  conventions, error handling patterns, how to use Prisma, how to structure
  Next.js App Router files, or what async pattern to follow. Covers naming,
  error handling, async patterns, Prisma ORM usage, Next.js App Router
  conventions, and testing requirements.
compatibility: TypeScript strict mode, Node.js 20, Next.js App Router, Prisma ORM,
  Zod. For src/api/ and src/web/.
---

# TypeScript Coding Standards

## Naming Conventions
- `camelCase` — variables, functions, parameters, object keys
- `PascalCase` — types, interfaces, classes, React components, enums
- `SCREAMING_SNAKE_CASE` — module-level constants, env var names
- `kebab-case` — file names, directory names, URL slugs
- Boolean names: prefix with `is`, `has`, `can`, `should`, `was`
- Async functions: no `async` prefix needed — name describes what it does

## TypeScript Rules
- `strict: true` in tsconfig — no exceptions
- Never use `any` — use `unknown` and narrow explicitly
- All exported functions must have explicit return types
- Prefer `type` over `interface` for object shapes (use `interface` only for extension)
- Use `satisfies` operator for config objects
- Zod for all runtime validation (request bodies, env vars, external API responses)

## Error Handling Pattern
Use the `Result<T, E>` type in all service functions. Route handlers call `next(error)` — never `try/catch` in routes.

- Services return `ok(value)` or `err(error)` — never throw
- Route handlers check `result.ok` and call `next(result.error)` on failure
- Error middleware translates `AppError` subtypes to HTTP status codes

See `references/patterns.md` for the full Result type definition and usage examples.

## Async Patterns
- Always `await` — never fire-and-forget unless intentional (and comment why)
- Never mix `.then()` and `await` in the same function
- Use `Promise.all()` for independent parallel calls
- Use `Promise.allSettled()` when partial failure is acceptable

## Prisma ORM Usage
- Always `select` only the fields needed — never omit `select` in production queries
- Always use `$transaction` for multi-step writes
- Type database IDs explicitly with branded types

See `references/patterns.md` for Prisma select and transaction examples.

## Next.js App Router Conventions
- Default to server components — add `'use client'` only when hooks or browser APIs are needed
- Server components fetch data directly with `async/await`
- Route handlers live in `app/api/[route]/route.ts` and validate with Zod before any logic

See `references/patterns.md` for server component, client component, and route handler examples.

## File Organisation
```
src/
├── web/
│   ├── app/                   ← Next.js routes
│   ├── components/[feature]/  ← feature-scoped components
│   ├── lib/                   ← shared utilities
│   └── types/                 ← shared TypeScript types
└── api/
    ├── routes/[feature].ts    ← route handlers (thin)
    ├── services/[feature].ts  ← business logic (testable)
    ├── middleware/            ← auth, validation, error
    └── prisma/                ← schema + migrations
```

## Quality Gates (must pass before marking task complete)
```bash
npx tsc --noEmit                      # zero type errors
npx eslint src/ --ext .ts,.tsx        # zero lint errors
npm test -- --run                     # all tests pass
```

## Testing Requirements
- Every exported function in `services/` has unit tests
- Every route handler has integration tests
- Test naming: `it('should [behavior] when [condition]')`
- No test file over 200 lines — split by scenario
- Mock at the boundary (database, external APIs) not in the middle

## Absolute Prohibitions
- No `console.log` in committed code — use a logger
- No hardcoded secrets or URLs — use env vars
- No `// @ts-ignore` or `// @ts-expect-error` without a comment explaining why
- No `any` type
- No synchronous file I/O in request handlers

## Troubleshooting

**"`any` type crept in from an external API response"**
Use `unknown` at the boundary and narrow with Zod. Define a `z.object(...)` schema for the external response shape and call `.parse()` or `.safeParse()`. The `any` type disables all downstream type checking — never let it propagate past the boundary.

**"Result type used inconsistently — some functions throw, others return `Result`"**
Services must always return `Result<T>` — never throw. Route handlers must never `try/catch` — always check `result.ok` and call `next(result.error)`. Pick the pattern and apply it uniformly; mixing the two makes error handling unpredictable.

**"Prisma query fetches more columns than needed"**
Always add an explicit `select` object. Without it, Prisma fetches every column including sensitive ones (password hashes, tokens). The `select` requirement is non-negotiable in production queries.

**"Mixing `.then()` and `await` in the same function"**
Pick one and be consistent throughout the function. Always prefer `await` — it produces cleaner stack traces and makes control flow easier to follow. Remove all `.then()` chains when converting to `async/await`.

---

## Examples

**Example 1: Reviewing a TypeScript service file for standards compliance**

User says: "Review this service for coding standards"

Actions:
1. Check all exported functions have explicit return types — flag any bare `async function foo()` without `: Promise<Result<T>>`
2. Search for `any` type usage — replace with `unknown` + Zod narrowing at boundaries
3. Verify the service never throws — all error paths return `err(new AppError(...))` via the `Result<T>` pattern
4. Run `npx tsc --noEmit` and `npx eslint src/` — confirm zero errors before marking compliant

Result: Standards report with specific line numbers for violations; all `any` usages and thrown exceptions identified

---

**Example 2: Structuring a new Next.js App Router route**

User says: "How do I structure Next.js App Router files for the new dashboard page?"

Actions:
1. Create `src/web/app/dashboard/page.tsx` as a server component (no `'use client'`) — fetch data directly with `async/await`
2. Extract any interactive widget into `src/web/components/dashboard/StatsWidget.tsx` with `'use client'` — add `useState` there
3. Validate any form input with a Zod schema at the route level before passing to a service
4. Confirm the component handles all four states: loading skeleton, error message, empty state, and data display

Result: Page component is a server component; client interactivity is isolated in a named component; all four states are present
