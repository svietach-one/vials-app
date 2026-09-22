# Product Intelligence — Capture Flow (Identification vs. Ingredients)

Status: DRAFT — product/UX design, not yet built.
Depends on: `04-scanner-flow.md`, `05-copy.md`.
**Supersedes** `04-scanner-flow.md`'s framing of "no match found" as a rare fallback. Given current corpus coverage (sparse product database, barcode coverage close to none), reaching the ingredient-photo step is the **expected primary path** for a large share of scans, not an edge case — this document treats it accordingly and should be read as the authoritative version of that part of the flow.

---

## 1. Why this needs its own document

The scanner flow as originally written assumed "identify by barcode or name → done" as the common case and "no match → manual entry" as the rare exception. That assumption doesn't hold: barcode coverage is close to none, and general product coverage is limited. For a meaningful share of scans, the real flow is **identify what you can from the front of the bottle → the app can't find it → photograph the ingredient list instead of typing it**. This needs to be designed as its own guided step, not a degraded fallback, or the app effectively asks most new users to hand-type a paragraph of INCI text the first time it matters most.

Two consequences that follow directly from this:
- The UI must **teach the user what to photograph, twice, with two different instructions** — not assume one camera gesture covers both.
- "Not found" must **not read as an error state** in tone or visual treatment — it's a normal fork, not a failure, since it will happen often.

---

## 2. The two capture moments

| | Shot 1 — Identification | Shot 2 — Ingredients |
|---|---|---|
| **What's being photographed** | Front of the product — brand/name, whatever text is visible. Barcode is attempted silently in the background but never instructed for or mentioned to the user (see §5). | Back/side of the product — the INCI list, usually starting "Ingredients" or "INCI." |
| **When it happens** | Always, first, for every scan. | Only if Shot 1 doesn't resolve to a database match. |
| **Viewfinder shape** | Small centered bracket — matches a label or logo, a short target. | Wide horizontal band spanning most of the frame width — matches a dense paragraph of small text, not a short target. |
| **Purpose** | Try to identify the product from the existing corpus. | Feed Product Intelligence's local build path directly — capabilities, irritation, and routine position can all be computed from ingredient text alone, with no database match needed (`04-scanner-flow.md` §2). |

These are visually and instructionally distinct steps. The user should never wonder which one they're being asked for.

---

## 3. Persistent hint bar

A single bar, anchored to the bottom of the camera view for the entire capture flow, whose copy changes per state — not a one-time tooltip that disappears after first viewing.

| State | Hint bar copy | Viewfinder |
|---|---|---|
| Camera open, Shot 1 pending | "Point at the product name" | Small bracket |
| Shot 1 processing | "Identifying product…" | Small bracket, subtle pulse |
| Match found | *(transitions to Product Intelligence — no further hint needed)* | — |
| No match found | "Couldn't find it in our database. Let's read the ingredient list instead." | Switches to wide band |
| Shot 2 pending | "Point at the ingredient list — usually starts with 'Ingredients' or 'INCI'" | Wide band |
| Shot 2 processing | "Reading ingredient list…" | Wide band, subtle pulse |
| Either shot, always available | "Can't get a clear shot? Enter manually" (flat text link, not a button — low visual weight, but never hidden) | — |

The two processing states ("Identifying product…", "Reading ingredient list…") already exist in `05-copy.md`; this document is what puts them in sequence and ties each to a specific viewfinder state.

---

## 4. Full sequence

```
[Camera opens]
      │
      ▼
[Hint: "Point at the product name"]  — small bracket viewfinder
      │
      ▼
[Shot 1 captured] → [Hint: "Identifying product…"]
      │
      │  barcode checked silently in background (see §5) — never
      │  part of the visible instruction, regardless of outcome
      │
      ├───────────────► [Match found]
      │                        │
      │                        ▼
      │              [Straight to Product Intelligence —
      │               04-scanner-flow.md §1 from here]
      │
      └───────────────► [No match found]   ◄── the common case, not an edge case
                                 │
                                 ▼
                  [Hint: "Couldn't find it in our database.
                   Let's read the ingredient list instead."]
                                 │
                                 ▼
                  [Viewfinder switches to wide band]
                  [Hint: "Point at the ingredient list —
                   usually starts with 'Ingredients' or 'INCI'"]
                                 │
                     ┌───────────┴───────────┐
                     ▼                        ▼
            [Shot 2 captured]        [Manual entry link tapped]
                     │                        │
                     ▼                        ▼
        [Hint: "Reading ingredient    [ProductForm, pre-filled
         list…"]                       with whatever OCR did
                     │                 recognize from Shot 1 —
                     ▼                 see §4a]
        [Product Intelligence
         builds locally from the
         recognized ingredient text
         — no database match needed]
                     │
                     ▼
        [Straight to Product Intelligence —
         04-scanner-flow.md §1 from here]
```

The "Enter manually" link is reachable from Shot 1's pending state, Shot 2's pending state, or after a failed/unclear Shot 2 attempt — never gated behind a required number of retries.

### 4a. Shot 1's OCR result is never thrown away

Even when Shot 1 produces no database match, whatever brand/name text it *did* recognize carries forward and pre-fills `ProductForm` if the user ends up there — either directly (manual entry tapped early) or after an unclear Shot 2. The user photographs up to twice; they should never have to type what a camera already read once, even on the no-match path.

---

## 5. Barcode's role: attempted, never instructed

Barcode scanning still runs in the background during Shot 1 — cheap to attempt, occasionally a fast win. But because coverage is close to none right now, it must not be part of what the user is told to do:

- The hint bar never says "scan the barcode."
- The viewfinder bracket in Shot 1 is framed as matching a label/name, not a barcode strip.
- A successful barcode decode is simply a faster route to the same "match found" outcome in §4 — invisible to the user either way, not a separately celebrated fast path.

This avoids training users toward an instruction that will fail for most products right now, which would erode trust in the capture flow faster than an honest "point at the name" ever would. If barcode coverage improves materially later, this is the one thing in this document worth revisiting — not before.

---

## 6. Tone: "not found" is not an error

Given how often this path will trigger, its visual and verbal treatment must read as a normal second step, not a failure state:

- No red, no warning iconography, no "Error" or "Failed" language anywhere in this branch.
- The copy in §3 ("Couldn't find it — let's read the ingredient list instead") frames it as the app moving to a next, equally legitimate step, not apologizing for a shortfall.
- Visually, the transition from small bracket to wide band should feel like a deliberate mode change (matching `04-scanner-flow.md`'s perceived-performance principle of narrating in domain language), not a fallback screen bolted onto the side of the "real" flow.

---

## 7. Relationship to the offline case (`04-scanner-flow.md` §2)

Two different causes can both lead to a manual/ingredient-photo path, and they should be told apart in copy even though they converge on similar UI:

- **Offline** — no network at all. Shot 1's on-device OCR can still extract text locally, but there's nothing to check it against. Copy should say so plainly (existing offline banner language from `SCREENS.md`), since it's actionable information for the user (their connection, not the product, is the issue).
- **Online, no match** — the network works fine; the product simply isn't in the database yet. This is the §3/§4 flow in this document, and should not imply a connectivity problem, since telling a user to "check their connection" when the real issue is catalog coverage would be actively misleading.

Both converge on the same Shot 2 (ingredient photo) mechanics — only the copy explaining *why* differs.
