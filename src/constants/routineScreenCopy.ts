/**
 * User-facing copy for the Routines screen additions of the intermediate-routine
 * task: the "Not in your routine" section, the gap card's "Not for me" button and
 * the calendar hints. ALL PLACEHOLDER pending design approval (spec Q4b) — kept
 * in this one module so a wording change touches one file. English only.
 * Reason texts for engine decisions live in decisionReasons.ts, not here.
 */

/** "Not in your routine" — the owned products that have no visible saved step. */
export const LEFT_OUT_COPY = {
  /** Spec-literal (not placeholder): "Not in your routine · N". */
  leftOutHeader: (count: number): string => `Not in your routine · ${count}`,
  /** A fresh draft would schedule this product. */
  readyToAdd: 'Ready to add',
  /** The product lost a same-slot contest and is the winner's backup. */
  backup: 'Backup — another product fills this step',
  addAction: 'Add',
  reviewAction: 'Review',
  /** Appended to a frozen row's reason when the pause has an end date. */
  pausedUntil: (isoDate: string): string => `paused until ${isoDate}`,
} as const;

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
