import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';
import { GAP_DISMISS_KEYS, gapDismissKey, keysAfterSave, sanitizeDismissedKeys, visibleGaps } from '@/utils/gapDismissal';

function slot(
  period: PlaceholderSlot['period'],
  type: PlaceholderSlot['productTypes'][number],
  reasonCode: PlaceholderSlot['reasonCode'],
): PlaceholderSlot {
  return { period, productTypes: [type], reasonCode, nonSkippable: false, severity: 'caution' };
}

describe('gapDismissKey', () => {
  it.each([
    [slot('am', 'toner', 'toner_recommended'), 'am:toner'],
    [slot('pm', 'toner', 'toner_recommended'), 'pm:toner'],
    [slot('am', 'eye_cream', 'eye_cream_recommended'), 'am:eye_cream'],
    [slot('pm', 'eye_cream', 'eye_cream_recommended'), 'pm:eye_cream'],
  ])('keys the generic toner and eye-cream cards by period and type', (placeholder, key) => {
    expect(gapDismissKey(placeholder)).toBe(key);
  });

  it.each([
    slot('am', 'cleanser', 'cleanser_recommended'),
    slot('am', 'moisturizer', 'moisturizer_recommended'),
    slot('am', 'spf', 'spf_recommended'),
    slot('am', 'spf', 'spf_required_goal'),
    slot('pm', 'cleanser', 'pre_cleanse_requires_followup'),
  ])('refuses every other card (%#)', (placeholder) => {
    expect(gapDismissKey(placeholder)).toBeNull();
  });

  it('refuses a mandate or follow-up card that occupies a toner or eye-cream slot', () => {
    expect(gapDismissKey(slot('am', 'toner', 'spf_required_photosensitizing'))).toBeNull();
    expect(gapDismissKey(slot('pm', 'eye_cream', 'pre_cleanse_requires_followup'))).toBeNull();
  });

  it('refuses a toner reason code that is not on a toner placeholder', () => {
    expect(gapDismissKey(slot('am', 'serum', 'toner_recommended'))).toBeNull();
  });
});

describe('visibleGaps', () => {
  const cards = [
    slot('am', 'cleanser', 'cleanser_recommended'),
    slot('am', 'toner', 'toner_recommended'),
    slot('am', 'eye_cream', 'eye_cream_recommended'),
    slot('pm', 'toner', 'toner_recommended'),
  ];

  it('hides exactly the dismissed card and keeps the order of the rest', () => {
    const shown = visibleGaps(cards, ['am:toner']);

    expect(shown.map((p) => `${p.period}:${p.productTypes[0]}`)).toEqual(['am:cleanser', 'am:eye_cream', 'pm:toner']);
  });

  it('does not mutate its input', () => {
    const copy = JSON.stringify(cards);

    visibleGaps(cards, ['am:toner', 'pm:toner']);

    expect(JSON.stringify(cards)).toBe(copy);
  });

  it('never hides a non-dismissible card, even when its key is stored', () => {
    expect(visibleGaps(cards, ['am:cleanser'])).toHaveLength(4);
    expect(visibleGaps([slot('am', 'toner', 'spf_required_goal')], ['am:toner'])).toHaveLength(1);
  });

  it('shows everything when nothing is dismissed', () => {
    expect(visibleGaps(cards, [])).toEqual(cards);
  });
});

describe('keysAfterSave', () => {
  const all = [...GAP_DISMISS_KEYS];

  it('drops the morning keys after a morning save and keeps the evening ones', () => {
    expect(keysAfterSave(all, ['am'])).toEqual(['pm:toner', 'pm:eye_cream']);
  });

  it('drops the evening keys after an evening save', () => {
    expect(keysAfterSave(all, ['pm'])).toEqual(['am:toner', 'am:eye_cream']);
  });

  it('drops everything after a save of both periods', () => {
    expect(keysAfterSave(all, ['am', 'pm'])).toEqual([]);
  });

  it('keeps everything when no period was saved', () => {
    expect(keysAfterSave(all, [])).toEqual(all);
  });
});

describe('sanitizeDismissedKeys', () => {
  it('keeps the known keys once each, in canonical order', () => {
    expect(sanitizeDismissedKeys(['pm:eye_cream', 'am:toner', 'am:toner'])).toEqual(['am:toner', 'pm:eye_cream']);
  });

  it('drops unknown keys and returns [] for anything that is not an array', () => {
    expect(sanitizeDismissedKeys(['am:spf', 'bogus', 3])).toEqual([]);
    expect(sanitizeDismissedKeys(undefined)).toEqual([]);
    expect(sanitizeDismissedKeys('am:toner')).toEqual([]);
  });
});
