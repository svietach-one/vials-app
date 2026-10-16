/**
 * User-facing copy for the Routines screen additions of the intermediate-routine
 * task: the gap card's "Not for me" button and the calendar hints. (A "Not in
 * your routine" section was built and then removed on 2026-10-16: the generation
 * page's own "In reserve" block is where set-aside products are shown.) ALL
 * PLACEHOLDER pending design approval (spec Q4b) — kept
 * in this one module so a wording change touches one file. English only.
 * Reason texts for engine decisions live in decisionReasons.ts, not here.
 */

/** The second button on a toner / eye-cream gap card. */
export const GAP_DISMISS_COPY = {
  action: 'Not for me',
} as const;

/** Calendar view: caption above the grid and the per-row accessibility hint. */
export const CALENDAR_HINT_COPY = {
  view: 'Tap a product for details. To remove or hide steps, turn on editing with the pencil.',
  edit: 'Tap a product to edit or remove it.',
  rowHintView: 'Opens product details and editing',
  rowHintEdit: 'Opens options to view, edit, remove or hide this product',
} as const;
