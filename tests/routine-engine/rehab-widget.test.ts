/**
 * Integration tests — Story 10: Rehab shield widget & long-term decoupling (V3)
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 10
 *
 * `buildRehabWidgetState` / `applyRehabFilter` already shipped with their own
 * unit tests (rehabFilter.test.ts). This file exercises them TOGETHER against
 * `getDailyView` — the widget state and the daily-view clinical-freeze mask
 * are two independently-derived render-time projections over the same
 * procedure logs, and the spec's ACs are about their combined behaviour on
 * the Routines screen. The RehabWidget component itself is FE-10 UI, not
 * built (progress/routine-engine.md, 2026-07-05) — covered separately in
 * tests/routine-engine/rehab-widget-ui.test.tsx.
 *
 * qa-lead finding (see handoff): `applyRehabFilter` reads active classes via
 * `getProductActiveKeys` (ingredientParser.ts), which ONLY looks at
 * `activeIngredients`/`fullIngredientText` — unlike `buildProductFacts`
 * (productFacts.ts), it does NOT read `Product.activeTags`, even though
 * activeTags is documented elsewhere as the wizard-confirmed, authoritative
 * source. A product whose active class was confirmed only via the tag
 * wizard (no INCI text) is correctly frozen by generate/dailyView's main
 * pipeline but NOT masked out of `applyRehabFilter`'s own steps list. Fixtures
 * below use `activeIngredients` (matching rehabFilter.test.ts's own
 * convention) to reflect current real behaviour; the tag-blindness itself is
 * flagged for the engineer, not fixed here.
 */
import { applyRehabFilter, buildRehabWidgetState } from '@/utils/routineEngine/rehabFilter';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { makeProcedureLog, makeProduct, makeRoutine, makeRoutineStep, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 10 AC: the widget and the daily-view mask agree on an active rehab window', () => {
  it('shows a widget with Day X of Y and masks photosensitizing/exfoliating steps together, for the same peel log', () => {
    const aha = makeProduct({ activeIngredients: [{ key: 'aha', displayName: 'AHA' }] });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const peel = makeProcedureLog({ procedureKey: 'chemical_peel_deep', datePerformed: '2026-07-04' });
    const now = new Date('2026-07-08T12:00:00Z'); // elapsed 4 -> currentDay 5 of 14

    const widget = buildRehabWidgetState([peel], now);
    expect(widget).toEqual(
      expect.objectContaining({ procedureName: 'Deep Chemical Peel', currentDay: 5, totalDays: 14 }),
    );

    const routine = makeRoutine('evening', [makeRoutineStep(cleanser), makeRoutineStep(aha)]);
    const filtered = applyRehabFilter(routine, widget, [cleanser, aha]);
    expect(filtered.steps.map((s) => s.productId)).toEqual([cleanser.id]);

    // getDailyView (a separate mask) agrees independently: aha is frozen for the same reason.
    const [view] = getDailyView([routine], [cleanser, aha], {
      procedures: [peel],
      profile: { fitzpatrick: null },
      seasonMask: { season: 'spring', source: 'calendar' },
      now,
    });
    expect(view.frozen.map((f) => f.productId)).toEqual([aha.id]);
  });

  it('removes the widget and restores masked actives the day after the rehab window ends, with zero store mutation', () => {
    const aha = makeProduct({ activeIngredients: [{ key: 'aha', displayName: 'AHA' }] });
    const peel = makeProcedureLog({ procedureKey: 'chemical_peel_deep', datePerformed: '2026-07-04' });
    const routine = makeRoutine('evening', [makeRoutineStep(aha)]);

    const dayY = new Date('2026-07-17T12:00:00Z'); // elapsed 13 -> currentDay 14 of 14 (last day inside)
    const dayYPlus1 = new Date('2026-07-18T12:00:00Z'); // elapsed 14 -> window over

    const widgetAtY = buildRehabWidgetState([peel], dayY);
    expect(widgetAtY).not.toBeNull();
    expect(applyRehabFilter(routine, widgetAtY, [aha]).steps).toHaveLength(0);

    const widgetAfter = buildRehabWidgetState([peel], dayYPlus1);
    expect(widgetAfter).toBeNull();
    const restored = applyRehabFilter(routine, widgetAfter, [aha]);
    expect(restored).toBe(routine); // same reference — no mutation, nothing to mask
    expect(restored.steps.map((s) => s.productId)).toEqual([aha.id]);
  });

  it('shows no widget for a procedure whose rehab days are exhausted but whose long-term effect is still active (Botox month 2)', () => {
    const botoxMonth2 = makeProcedureLog({
      procedureKey: 'botox',
      datePerformed: '2026-05-01', // >7 rehab days elapsed, well within the 6-month effect window
      status: 'active',
    });
    const widget = buildRehabWidgetState([botoxMonth2], new Date('2026-07-04T12:00:00Z'));
    expect(widget).toBeNull();
  });

  it('does not mask the face routine when the logged rehab is scoped to affectedZones excluding face', () => {
    const aha = makeProduct({ activeIngredients: [{ key: 'aha', displayName: 'AHA' }] });
    const neckPeel = makeProcedureLog({
      procedureKey: 'chemical_peel_deep',
      datePerformed: '2026-07-04',
      affectedZones: ['neck'],
    });
    const widget = buildRehabWidgetState([neckPeel], new Date('2026-07-05T12:00:00Z'));
    expect(widget?.affectedZones).toEqual(['neck']);

    const routine = makeRoutine('evening', [makeRoutineStep(aha)]);
    const filtered = applyRehabFilter(routine, widget, [aha]);
    expect(filtered).toBe(routine); // no zone match -> untouched
  });

  it('treats an absent affectedZones as ["face"] and the window still drives the widget when overlapping windows exist', () => {
    const earlyEnding = makeProcedureLog({
      id: 'proc-early',
      procedureKey: 'mechanical_facial', // 3-day rehab
      datePerformed: '2026-07-04',
    });
    const laterEnding = makeProcedureLog({
      id: 'proc-later',
      procedureKey: 'chemical_peel_deep', // 14-day rehab, no affectedZones -> defaults to face
      datePerformed: '2026-07-04',
    });
    const now = new Date('2026-07-05T12:00:00Z'); // both windows active

    const widget = buildRehabWidgetState([earlyEnding, laterEnding], now);
    // The window ending LAST (the peel, day 14) drives the widget deterministically.
    expect(widget?.procedureName).toBe('Deep Chemical Peel');
    expect(widget?.totalDays).toBe(14);
  });
});

// Story 10 UI ACs are activated as component tests in
// tests/routine-engine/rehab-widget-ui.test.tsx now that FE-10 shipped
// RehabWidget.tsx (progress/routine-engine.md, 2026-07-05 "REHAB SHIELD
// WIDGET" entry) — kept out of this file since they need
// @testing-library/react-native rendering.
