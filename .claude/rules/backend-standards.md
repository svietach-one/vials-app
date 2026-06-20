---
name: backend-standards
description: >
  Project backend engineering standards for Node.js, Express/Next.js API routes,
  Prisma ORM, service layer architecture, and TypeScript API client patterns.
  Use when writing or reviewing backend API code, asked "how do I structure this
  route", "where does business logic go", "how do I call the AI service", or
  "how should errors be handled in a service". Covers route handler thinness,
  service layer separation, Prisma patterns, error handling, and the AI service
  client contract.
compatibility: Node.js 20, Express/Next.js, Prisma ORM, Zod. For src/api/ only.
---

# Backend Engineering Standards

## Architecture — The Three Layers

Request -> Route Handler -> Service -> Repository/Client -> Response

Each layer has exactly one responsibility and must remain isolated:

| Layer | Primary Responsibility | Prohibited Patterns |
|-------|------------------------|---------------------|
| Route Handler | Parse input (Zod), invoke service, format HTTP response | Containing business logic, querying DB directly |
| Service Layer | Business logic implementation, process orchestration | Importing Web/Express types, referencing req/res/next |
| Prisma / Client | Data access, database interactions, external calls | Containing business rules, validating user input |

---

## 1. Prisma ORM Patterns
- Strict Selection: Always use explicit select fields to fetch only the required data. Never omit select blocks in production queries.
- Transactions: Always wrap multi-step or correlated database writes inside a $transaction block.
- Database Migrations: After altering schema.prisma, immediately generate a new local migration via npx prisma migrate dev. Always commit schema.prisma and the newly generated migration folder together in the same git commit.

---

## 2. Error Handling
The project implements a functional container type Result which strictly returns an ok(value) or err(error) object:
- Services never throw exceptions. They must return an explicit ok(value) on success or err(error) on failure.
- Route handlers do not use try/catch blocks. They call the service layer and pass any failures down the chain using next(result.error).
- All translation of internal application errors (AppError) into HTTP status codes is managed by centralized error middleware. Never expose stack traces or raw database engine errors to the client.

---

## 3. AI Service Client Pattern
The file src/api/clients/ai-service.ts is the exclusive location where the AI service endpoint is defined. Services must import this client and are strictly prohibited from invoking fetch to the AI service directly.
- Request Timeouts: Every request dispatched to the AI service must enforce a strict deadline using AbortSignal.timeout(30000).
- Response Validation: All responses returned from the AI service must be validated against a strict Zod schema prior to processing.
- The client must throw an ExternalServiceError on any non-2xx response. Returning partial or unvalidated payloads is prohibited.

---

## 4. Input Validation (Zod Everywhere)
All request validation occurs strictly at the route layer before arguments are handed to the service layer:
- String inputs must use z.string().min(1).max(N).trim() to automatically strip whitespace.
- Constrained fields must use enum limits: z.enum([...]).
- Use .safeParse(). On validation failure, immediately return an HTTP 400 response. Never allow unvalidated data to penetrate the service layer.

---

## 5. Prohibited Patterns
- Writing business or processing logic inside a route handler.
- Invoking Prisma database queries directly from route handlers (must route through a service).
- Using local try/catch blocks inside route handlers for error processing.
- Executing raw SQL statements containing unescaped string interpolation.
- Utilizing the any type anywhere in TypeScript (ensure strict compiler flags are active).
- Using console.log for application tracking; use the centralized project logger.

---

## 6. Troubleshooting & Common Resolutions
- Business logic ended up in the route handler: Move it into a dedicated service function. The route handler should only validate the request, invoke the service, verify result.ok, and return the response.
- The service is referencing Express objects: Services must remain completely decoupled from the transport layer. Refactor the service signature to accept plain typed objects extracted by the router.
- Database migrations are out of sync: Never modify applied migration files manually. All database modifications must proceed via a newly generated migration file.