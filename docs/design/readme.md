# Vials — Design System

**Vials** is a premium, unisex personal skincare and aesthetic-medicine management mobile app.
It helps users track formulations, build dynamic morning/evening **Skin Cycling** schedules,
avoid ingredient conflicts, and safely navigate clinical cosmetic procedures (Botox, fillers,
peels). Daily skincare and medical-cosmetic tracking are combined into one inseparable local engine.

- **Platform:** Mobile (React Native / Expo SDK 52). This design system mirrors that product in HTML/React for prototyping.
- **Design language:** Tech-Clinical / Neo-Minimalist.
- **Visual theme:** Monochrome canvas with **Apothecary Glass & Wine accents**.

### Sources
No codebase or Figma was provided. This system was authored from the written product + visual brief.
When real source becomes available (Expo repo, Figma file), reconcile tokens, components, and the UI kit against it.

---

## CONTENT FUNDAMENTALS

The voice is **calm, clinical, and quietly premium** — a knowledgeable dermatology concierge, never a chirpy consumer app.

- **Person:** Address the user as **"you"**; the app refers to itself implicitly ("your shelf", "tonight"). Avoid "we".
- **Tone:** Precise, reassuring, evidence-led. Short declaratives. No hype, no exclamation marks.
- **Casing:** Sentence case for everything UI-facing. **Mono UPPERCASE with wide tracking** is reserved for micro-labels, units, dates, and section eyebrows (apothecary-label feel).
- **Numbers & units:** Always concrete and monospaced — `0.5%`, `24 units`, `PAO 14d`, `21:40`, `0.5ml`. Units sit in mono.
- **Imperatives for actions:** "Log tonight's routine", "Apply retinoid", "Skip vitamin C tonight."
- **Safety language is specific, not alarmist:** "Skip vitamin C tonight — it clashes with your exfoliant." / "24-hour rehab boundary active. No actives until tomorrow."
- **No emoji.** Status is carried by color + an icon + a word, never an emoji.
- **Vibe:** An apothecary's lab notebook reinterpreted as software — measured, trustworthy, editorial at the edges.

Example copy:
> THURSDAY · 24 APR
> **Tonight**
> Evening routine — Cycle Day 2, Exfoliate night.
> *Ingredient conflict:* Skip vitamin C tonight; use it tomorrow morning instead.

---

## VISUAL FOUNDATIONS

**Color.** A monochrome system: pure white (`#FFFFFF`) or off-black (`#09090B`) canvas, bone/cream
cards (`#FAF9F6`, like premium textured paper), zinc-200 hairline dividers, off-black primary text,
zinc-500 secondary. Four **apothecary-glass accents** — Cabernet `#800C2E`, Amber `#A84C0E`, Bottle
Green `#0F4C3A`, Cobalt `#1E3A8A` — are **functional only**. They appear in text links, graph fills,
status dots/badges, small tinted cards, and contextual alerts. They are **never** used for large
background fills or primary buttons (primary actions are always monochrome black). Each accent maps
to a meaning: Cabernet = active trigger / SOS, Amber = warning / expiry / transition, Green = safe /
soothing / recovery, Cobalt = info / tracking / forecasting.

**Type.** Three families. **Hanken Grotesk** for UI + body (clean clinical grotesque). **Newsreader**
(serif) for display/editorial moments only — hero lines, big section titles. **IBM Plex Mono** for
labels, doses, dates, and data — set UPPERCASE with `0.12em` tracking for the apothecary-label look.
Tight tracking (−0.01em) on headings; relaxed 1.65 line-height on body.

**Spacing & layout.** 4px base grid. Mobile-first (390pt). 20px screen gutters, 16px card padding,
12px stack rhythm. Generous whitespace; content breathes.

**Backgrounds.** Flat. No gradients, no photographic hero washes, no decorative illustration or
texture (the "textured paper" reference is conveyed by the bone color, not an image). The only
non-flat surface is the **frosted apothecary-glass** treatment on floating chrome (the bottom tab
bar): `backdrop-filter: blur(16px) saturate(1.1)` over a translucent white.

**Corner radii.** Soft but restrained: controls 12px, cards 16px, sheets 22px, pills 999px, small
chips 8px. Nothing fully rounded except dots, switches, and pill tags.

**Cards.** Bone surface + 1px zinc-200 border. Default cards have **no shadow** — the border does the
structural work (neo-minimalist). "Raised" cards use a soft, low, cool shadow (`--shadow-md`) and a
white surface. Accent-tinted cards (8% tint + 22% hairline) are reserved for small status surfaces
(SOS rehab, alerts).

**Borders & shadows.** Hairlines everywhere (1px, occasionally 1.5px for inputs/unchecked boxes).
Shadow ramp is soft, low, and cool (low opacity black). Elevation is used sparingly — most depth is
implied by borders and the bone/white surface contrast.

**Motion.** Clinical, no bounce. Standard easing `cubic-bezier(0.2,0,0,1)`; durations 120/200/320ms.
Transitions are fades + short slides (segmented thumb, switch knob, progress arcs). No springy
overshoot, no infinite decorative loops.

**Hover / press.** Hover = a subtle surface change (transparent → sunken zinc) or one step darker on
fills (black → zinc-800); cards lift 1px with a shadow. Press = `scale(0.98)` on buttons, `scale(0.94)`
on icon buttons. Destructive/SOS controls use a Cabernet outline + tint on hover, never a solid fill.

**Transparency & blur.** Used only for floating chrome (tab bar glass) and modal scrims
(`black @ 45%`). Body content is fully opaque.

**Imagery.** Minimal by default. If product/ingredient imagery is introduced it should be **cool,
clean, clinical** — neutral light, no warm filters, no grain. Prefer the monochrome data visual
language (rings, bars, dots) over photography.

---

## ICONOGRAPHY

- **Library:** [Lucide](https://lucide.dev) — line icons, **1.75px stroke**, rendered at 20–24px on a 24px grid. Loaded from CDN (`unpkg.com/lucide`).  *Substitution flag:* no brand icon set was provided; Lucide is the closest clinical line match. Replace if a proprietary set exists.
- **Style:** Outline only, consistent stroke, rounded caps/joins. No duotone, no filled icons except inside filled buttons.
- **Usage in app:** `sun`/`moon` (AM/PM), `flask-conical` (formulations/shelf), `droplet`, `calendar` (cycle), `syringe` (clinic), `shield-check` (safe), `triangle-alert` (conflict/warning), `clock` (rehab boundary), `bell`, `trending-up` (forecast), `plus`, `check`.
- **Emoji:** Never. **Unicode glyphs:** only `×` for chip-remove and `✓` (drawn as SVG in checkboxes/rings).
- Status is always color + icon + word together, for accessibility.

Brand marks: **no logo is currently included** — the placeholder mark/wordmark was removed at your request. Add final logo art to `assets/` and create a new Brand card when available.

---

## INDEX

**Root**
- `styles.css` — global entry point (import this one file). `@import`s the token files below.
- `readme.md` — this guide. · `SKILL.md` — Agent-Skill wrapper.

**Tokens** (`tokens/`)
- `fonts.css` — webfont loading (Google Fonts CDN). · `colors.css` — neutrals, accents, tints, semantic aliases, dark theme.
- `typography.css` — families, scale, roles. · `spacing.css` — 4px grid. · `effects.css` — radii, borders, shadows, motion, z-index.

**Components** (`components/`) — `window.VialsDesignSystem_d5d96f.<Name>`
- `core/` — **Button, IconButton, Card, Tag, ListRow**
- `forms/` — **Input, Checkbox, Switch, SegmentedControl**
- `feedback/` — **Badge, InlineAlert, ProgressRing**
- `navigation/` — **TabBar**
- Each has `.jsx` + `.d.ts` + `.prompt.md`, and a `*.card.html` specimen.

**Foundations** (`guidelines/foundations/`) — Design System tab cards for Colors, Type, Spacing, Brand.

**UI kit** (`ui_kits/vials-app/`) — interactive mobile app: **Today · Shelf · Cycle · Clinic**. Open `index.html`.

**Assets** (`assets/`) — (logo pending — add final art here).
