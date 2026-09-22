# Fix — Explore Composition capture screen: restore icon + primary/secondary hierarchy

**Context:** the current capture screen shows two equal-weight cards ("Photograph the ingredient
list" and "Paste ingredient text," each icon + title + subtitle + chevron). This is being replaced
with a clear visual hierarchy — photo capture as the dominant, primary action; paste as a
lower-emphasis secondary option. **This intentionally supersedes the "present both as an equal
choice" framing from the original spec (`00-explore-composition-spec.md` §2)** — the product
decision now is that most real-world usage is in-store with the physical product in hand, so photo
should read as the default path, not a coin-flip between two peers.

---

## Layout change

Replace the current two-card "Capture" section with:

1. **Centered icon** at the top of the section (camera icon — reuse the icon already used on the
   current "Photograph the ingredient list" card).
2. **Primary button** below the icon: `Photograph the ingredient list`. Use the app's standard
   primary button style (pure black filled surface, white text — same as every other primary CTA
   in the app, e.g. `Put on My Shelf`).
3. **Secondary text button** below the primary button: `Enter / paste text` (or similar short
   label — confirm exact copy isn't already fixed elsewhere before changing it). This should read
   as a plain text-style link, not a card and not an outlined button — clearly lower visual weight
   than the primary button, consistent with "this is the fallback/alternate path."

Remove the "Capture" section header, the two full-width cards, the chevrons, and the multi-line
subtitles under each — this whole block is replaced by the icon + primary button + secondary text
link described above.

**The `Category (optional)` section below stays exactly as it is today** — chip grid, unaffected by
this change, no reordering relative to the capture section.

---

## What doesn't change

- Both paths still lead to exactly the same next screens/behavior as today — this is a visual
  hierarchy change only, not a behavior change. Paste is still fully functional and easy to reach,
  just visually secondary.
- No changes to the actual OCR/paste logic, category chip behavior, or anything downstream.

---

## Report back

Screenshot of the new capture screen layout.
