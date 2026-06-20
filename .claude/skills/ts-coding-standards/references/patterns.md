# TypeScript Coding Patterns — Code Reference

Full code examples for patterns described in SKILL.md.

---

## Result Type — Definition

```typescript
// src/lib/result.ts — canonical definition, do not redefine elsewhere
export type Ok<T>  = { ok: true;  value: T }
export type Err<E> = { ok: false; error: E }
export type Result<T, E = AppError> = Ok<T> | Err<E>
export const ok  = <T>(value: T): Ok<T>  => ({ ok: true,  value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })
```

## Result Type — Service Usage

```typescript
async function findUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.user.findUnique({ where: { id } })
    if (!user) return err(new NotFoundError(`User ${id} not found`))
    return ok(user)
  } catch (e) {
    return err(new DatabaseError('findUser failed', { cause: e }))
  }
}
```

## Result Type — Route Handler Usage

```typescript
router.get('/:id', requireAuth, async (req, res, next) => {
  const result = await findUser(req.params.id)
  if (!result.ok) return next(result.error)  // error middleware handles it
  return res.json(result.value)
})
```

---

## Prisma — Always Select Required Fields

```typescript
// BAD — fetches every column including sensitive ones
const user = await db.user.findUnique({ where: { id } })

// GOOD — explicit selection
const user = await db.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true, role: true }
})
```

## Prisma — Transactions for Multi-Step Writes

```typescript
await db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { ... } })
  await tx.auditLog.create({ data: { userId: user.id, action: 'created' } })
})
```

## Prisma — Branded Database IDs

```typescript
type UserId = string & { readonly __brand: 'UserId' }

function toUserId(raw: string): UserId {
  return raw as UserId
}
```

---

## Next.js App Router — Server Component (default)

```typescript
// app/[route]/page.tsx — no 'use client', data fetched directly
export default async function FeaturePage({ params }: { params: { id: string } }) {
  const data = await fetchData(params.id)
  return <FeatureView data={data} />
}
```

## Next.js App Router — Client Component

```typescript
// Mark client components explicitly at the top of the file
'use client'
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

## Next.js App Router — Route Handler

```typescript
// app/api/[route]/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const parsed = FeatureSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const result = await featureService.create(parsed.data)
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: result.error.statusCode })
  }
  return Response.json(result.value, { status: 201 })
}
```
