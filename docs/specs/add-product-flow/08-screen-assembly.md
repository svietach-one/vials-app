# Task 08: Screen Assembly

Depends on: `02-form-reducer.md`, `06-accordion-shell.md`,
`07-section-components.md`

## Goal

Create `src/screens/catalog/AddProductScreen.tsx`, wiring the reducer and
all four sections into one scrollable screen. This replaces whatever
screen previously hosted `ProductForm` + `UniversalScannerOverlay` for the
manual/not-found entry path in `IMPLEMENTATION_PLAN.md` Phase 4 — the
barcode-hit ("found in database") path is unchanged and out of scope here.

## Structure

```
<SafeAreaView>
  <Header title="Add product" onClose={confirmDiscardIfDirty} />
  <ScrollView>
    <SectionAccordion index={1} title="Brand, name, and category"
      status={draft.sectionStatus.brand}
      isExpanded={draft.expandedSection === 1}
      onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 1 })}
      summary={<Section1Summary draft={draft} />}>
      <BrandNameCategorySection draft={draft} dispatch={dispatch} />
    </SectionAccordion>

    <SectionAccordion index={2} title="Barcode"
      status={draft.sectionStatus.barcode}
      isExpanded={draft.expandedSection === 2}
      onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 2 })}
      summary={<Section2Summary draft={draft} />}>
      <BarcodeSection draft={draft} dispatch={dispatch} />
    </SectionAccordion>

    <SectionAccordion index={3} title="Ingredients"
      status={draft.sectionStatus.ingredients}
      isExpanded={draft.expandedSection === 3}
      onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 3 })}
      summary={<Section3Summary draft={draft} />}>
      <IngredientsSection draft={draft} dispatch={dispatch} />
    </SectionAccordion>

    <SectionAccordion index={4} title="Usage details"
      status={draft.sectionStatus.usage}
      isExpanded={draft.expandedSection === 4}
      onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 4 })}
      summary={<Section4Summary draft={draft} />}>
      <UsageDetailsSection draft={draft} dispatch={dispatch} />
    </SectionAccordion>
  </ScrollView>

  <SaveBar enabled={canSave(draft)} onPress={() => handleSave(draft)} />
</SafeAreaView>
```

`draft` and `dispatch` come from `useReducer(formReducer, undefined,
initialDraft)` (task 02) at the top of this screen — this is the only
place the reducer is instantiated.

## Summary components

Small inline components (can live in this same file or a co-located
`Summaries.tsx`) that render the one-line collapsed-row content for each
section once complete:

- `Section1Summary`: `"{brand} · {name} · {productType}"`, truncated
  sensibly for long names.
- `Section2Summary`: formatted barcode if present, or `"Barcode skipped"`
  if `sectionStatus.barcode === 'skipped'`.
- `Section3Summary`: `"Actives: {chip list}"` for up to 2-3 tags, or
  `"No actives added"` if empty (not styled as an error/warning — this is
  a neutral, valid state).
- `Section4Summary`: `"Opened {date} · PAO {n}M"` or `"Unopened · PAO
  {n}M"` if `isOpened` is false.

## Save validation UX

If `handleSave` is called while `canSave(draft)` is false (see task 06 —
`SaveBar` always fires `onPress` regardless of `enabled`), the screen
handler must:
1. Identify the first incomplete required section (Section 1 fields or
   Section 4's `paoMonths`).
2. Dispatch `TOGGLE_SECTION` to expand it if it isn't already.
3. Show a brief inline message under that section's header, e.g. "Add a
   brand and category to continue."

Do not show a generic toast or alert for this — the goal is to land the
user directly on the thing that needs fixing, not to interrupt them with a
dialog they have to dismiss first.

## Discard confirmation

`onClose` (the header's close/X control) should check whether the draft
has any non-empty field. If so, confirm before discarding (a simple native
confirm/alert is fine here — this is a low-stakes, infrequent
interaction, doesn't need a custom component). If the draft is still
fully empty, close immediately with no prompt.

## Done when

- The screen renders all four sections with only one expanded at a time.
- Tapping any collapsed, complete section's summary row re-expands it —
  confirm there is no "Back" button or step-navigation control anywhere
  on this screen.
- Save button tap with incomplete required fields expands the right
  section and shows the inline message, without calling `handleSave`'s
  actual save logic (that's wired in task 09).
