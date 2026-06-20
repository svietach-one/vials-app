---
name: frontend-standards
description: >
  Project frontend engineering standards for Next.js App Router, React, Tailwind
  CSS, React Query, and form handling. Use when writing or reviewing frontend code,
  asked "should this be a server or client component", "how do I fetch data in
  Next.js", "how do I handle form validation", or "what are the accessibility
  requirements". Covers server vs client component rules, data fetching patterns,
  state management, accessibility basics, and the all-states requirement.
compatibility: Next.js 14+ App Router, React 18, Tailwind CSS, React Query,
  react-hook-form, Zod. For src/web/ only.
---

# Frontend Engineering Standards

## Server vs Client Component Decision

Default to server components. Add 'use client' only when you need:
- useState, useEffect, useReducer, or other hooks
- Browser APIs (window, document, navigator)
- Event listeners (onClick, onChange in JSX)
- Third-party client-only libraries

---

## The All-States Rule (non-negotiable)

Every component that loads or submits data must handle all four states:
- Loading — skeleton or spinner
- Error — error message component
- Empty — explicit empty state message
- Data — the actual content

A blank screen during loading is a bug. An unhandled error that crashes the page is a bug. An empty list with no message is a bug.

---

## Data Fetching Patterns

- Server components — fetch data directly with async/await; no React Query
- Client components — use React Query (useQuery for reads, useMutation for writes)
- Never use useEffect for data fetching — use React Query or server components

---

## Form Handling

Use react-hook-form + zodResolver for all forms:
- Define a Zod schema — this is the source of truth for validation
- Use register, handleSubmit, formState from useForm
- Show errors with role="alert" for screen reader accessibility
- Disable the submit button while isSubmitting is true

---

## Tailwind CSS Rules
- Use design system tokens — don't invent arbitrary values (p-[13px] is a code smell)
- Mobile-first: sm:, md:, lg: for responsive breakpoints
- Extract repeated patterns into components, not @apply classes
- Dark mode: use dark: prefix — never hardcode colours

---

## Accessibility Minimums
- Interactive elements must be <button> or <a>, never <div onClick>
- Images must have alt text (empty string alt="" for decorative images)
- Form inputs must have <label> or aria-label
- Error messages must use role="alert" so screen readers announce them
- Focus must be visible — don't remove outline without a replacement

---

## Prohibited Patterns
- dangerouslySetInnerHTML with user-provided content — XSS risk
- Storing tokens in localStorage — use httpOnly cookies
- Calling the backend API directly with hardcoded URLs — use env vars
- useEffect for data fetching — use React Query or server components
- any type anywhere

---

## Troubleshooting & Common Resolutions

- Added 'use client' to a component that doesn't need it: Remove it. Server components are the default and more performant — they fetch data directly without client-side waterfalls. Only add 'use client' when hooks (useState, useEffect) or browser APIs are actually used in that specific file.
- One of the four states (loading / error / empty / data) is missing: All four are non-negotiable. A missing loading state means a blank flash. A missing error state means a silent crash. A missing empty state means users see nothing and don't know why. Add the missing state before marking the task complete.
- useEffect is used for data fetching: Replace with React Query in client components or direct async/await in server components. useEffect for data fetching causes race conditions, stale data on re-renders, and missing loading/error states. React Query handles all of this correctly.
- Tailwind has arbitrary values like p-[13px] or text-[#3a2b1c]: Use design system tokens only. If the exact value you need doesn't exist as a token, add it to the Tailwind config rather than using an arbitrary value. Arbitrary values bypass the design system and make the UI inconsistent.