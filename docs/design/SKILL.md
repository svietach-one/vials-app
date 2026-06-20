---
name: vials-design
description: Use this skill to generate well-branded interfaces and assets for Vials, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Theme:** Tech-Clinical / Neo-Minimalist. Monochrome canvas + Apothecary Glass accents.
- **Canvas:** `#FFFFFF` (light) / `#09090B` (dark). Cards: bone `#FAF9F6`. Dividers: zinc-200 `#E4E4E7`.
- **Text:** off-black `#09090B` primary, zinc-500 `#71717A` secondary.
- **Accents (functional only — never large fills or primary buttons):** Cabernet `#800C2E` (active/SOS),
  Amber `#A84C0E` (warning/expiry), Bottle Green `#0F4C3A` (safe/recovery), Cobalt `#1E3A8A` (info/tracking).
- **Type:** Hanken Grotesk (UI/body), Newsreader (display), IBM Plex Mono (labels/data, UPPERCASE tracked).
- **Icons:** Lucide, 1.75px stroke. No emoji.
- **Voice:** calm, clinical, premium. "You". Sentence case. Concrete monospaced numbers/units.

## Files
- `styles.css` — link this for all tokens. `tokens/` holds the source.
- `components/` — React primitives (`window.VialsDesignSystem_d5d96f.<Name>`).
- `guidelines/foundations/` — specimen cards.
- `ui_kits/vials-app/` — full interactive mobile app recreation.
- `assets/` — brand art (logo pending).
