# CLAUDE.md — Vials App Development Guide

This file is the entry point for Claude Code. Read all referenced docs before writing any code.

---

## What is Vials?

Vials is a mobile skincare management app. Users track products, build morning/evening routines, get warned about ingredient conflicts, and manage clinical cosmetic procedures (Botox, fillers, rehab windows). Full details in `docs/PRD_Spec.md`.

**Phase 1 scope:** MVP + Clinical Aesthetics (both layers, not separable).

---

## Docs to read first (in order)

1. `docs/PRD_Spec.md` — product overview, scope, key decisions
2. `src/types/index.ts` — all TypeScript interfaces
3. `docs/SCREENS.md` — every screen, components, states
4. `docs/USER_STORIES.md` — acceptance criteria per feature

---

## Tech Stack

```
Framework:        React Native (Expo SDK 52)
Language:         TypeScript (strict mode)
Navigation:       React Navigation v7 (stack + bottom tabs)
State:            Zustand (lightweight, no boilerplate)
Local storage:    AsyncStorage (Phase 1, offline-first, zero-cost)
Styling:          StyleSheet + design tokens (no Tailwind on native)
Drag-and-drop:    react-native-draggable-flatlist (routines reorder)
Icons:            @expo/vector-icons (Feather set)
Fonts:            Google Fonts via expo-font (DM Sans + DM Serif Display)
Testing:          Jest + React Native Testing Library
```

---

## Project Structure

```
/src
  /components         # Reusable UI components
    /ui               # Atoms: Button, Chip, Badge, Card, Toggle
    /product          # ProductCard, ProductHero, IngredientList
    /routine          # RoutineStep, ConflictWarning, DragList
    /onboarding       # Slide, ProgressBar, SkinTypeCard
  /screens            # One file per screen
  /navigation         # Stack and tab navigators
  /store              # Zustand stores (profile, products, routines, procedures, settings)
  /services
    storage.ts        # AsyncStorage helpers
    /openBeautyFacts  # Search + parse (TBD)
    /anthropic        # Routine suggestion + product analysis (TBD)
  /constants
    tokens.ts           # Design tokens
    conflictRulesDb.ts  # Ingredient + procedure conflict rules, INCI map
  /utils
    conflictEngine.ts   # Ingredient + clinical conflict detection
    ingredientParser.ts # INCI text → active ingredient keys
    timeHelpers.ts      # Skincare date + season helpers
  /hooks              # useDebounce, useConflicts, useRoutine (TBD)
  /types              # All interfaces
  /constants          # Colors, spacing, typography tokens
```

---

## Design Tokens

Defined in `/src/constants/tokens.ts`:

| Token | Value | Usage |
|---|---|---|
| Teal (accent) | `#008080` | Primary actions |
| Sand (bg) | `#F5F2EB` | Background |
| Slate (text) | `#2F4F4F` | Text / dark elements |

High contrast, unisex, medical-minimalist.

---

## Conflict Engine

Clinical procedure logic lives in `/src/utils/conflictEngine.ts` (local, no API).

Ingredient-pair detection (TBD) will live in `/src/services/conflictEngine/` or extend the utils module per `conflictRules.ts`.

---

## Development Order (recommended)

1. **Setup** — Expo project, navigation shell, design tokens, Zustand stores ✅
2. **Onboarding** — MarketingSlides → StartScreen → SkinProfile → AddFirstProduct
3. **Product Catalog** — list, add (search + manual), detail, delete
4. **Conflict Engine** — ingredient rules + detection + ConflictWarning component
5. **Routines** — view, manual edit, AI suggestion
6. **Today screen** — routine display + clinical blocks + gamification toggle
7. **Clinic / Aesthetics** — procedure logging, timeline, fading counter
8. **Profile screen** — edit profile + settings + local data warning
9. **Polish** — empty states, error states, loading skeletons, animations

---

## Key Constraints

- **English only** — all UI text, comments, and logs in English (Phase 1)
- **Local-only storage** — no Supabase/Firebase in Phase 1
- **Conflict warnings only in routines** — not on product catalog cards
- **Gamification is opt-in** — default OFF
- **OBF API always has manual fallback** — never block user if API is down
- **AI routine always has manual fallback** — if Anthropic API fails, show manual builder

---

## Environment Variables

```
EXPO_PUBLIC_ANTHROPIC_API_KEY=...   # For AI routine + analysis (optional until AI features ship)
# Open Beauty Facts requires no key
```

Do not commit API keys. Use `.env.local` locally and Expo secrets in CI.
