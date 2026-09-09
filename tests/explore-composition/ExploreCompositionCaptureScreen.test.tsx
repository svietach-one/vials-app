/**
 * Component tests — ExploreCompositionCaptureScreen (FE-2).
 * Spec: docs/specs/explore-composition.md §4 Story 1 (all 4 ACs), §5
 * Tech design: docs/tech-design/explore-composition.md §3 FE-2
 * Layout revision (primary/secondary hierarchy):
 * docs/tasks/explore ingredient/06-capture-screen-hierarchy.md
 * (human-approved 2026-08-27).
 * Redesign (2026-08-27, human design reference): a single headline
 * (consolidated from an initial headline+subheadline pair per a same-day
 * follow-up), required category chips moved above the capture block (label
 * reverted to just "Category" in that same follow-up, no divider line below
 * it), photo action now reuses `ScanTile` (the same dashed-border
 * camera-launch tile already shared by the manual-entry wizard's sections —
 * `src/components/addProduct/ScanTile.tsx`) instead of a filled `Button`,
 * paste renamed "Paste text manually". No hero illustration — not available
 * yet, per the human's own note. The primary/secondary weighting from 06 is
 * preserved: photo is a large dedicated tile, paste is still a plain
 * text-link `Button`.
 *
 * Contract this suite pins down where the redesign leaves it open (qa-lead
 * judgment call, flagged for engineer/tech-lead to confirm or override):
 *   - The PASTE method sets local raw-text state and immediately navigates
 *     to `ExploreCompositionResult` with `{ rawIngredientsText, category }` —
 *     no intermediate "Continue" step. UNCHANGED by either revision (layout
 *     only).
 *   - The PHOTO method, as of 2026-09-09 (docs/investigations/
 *     ocr-incomplete-ingredient-capture.md), no longer navigates instantly —
 *     it pauses on a "Missing something? Add another shot." / "Continue"
 *     choice, since a single photo can't always fit a long ingredient list
 *     in one legible frame. A second shot merges onto the first via
 *     `mergeIngredientCaptures.ts` before "Continue" navigates. This
 *     deliberately supersedes what this suite pinned down before that date.
 *   - The paste path's submit control is literally "Parse ingredients" —
 *     copied verbatim from `IngredientsSection.tsx`'s existing paste modal.
 *     UNCHANGED — only the *trigger* that opens this modal has ever changed
 *     label/presentation, not the modal itself.
 *   - The category selector renders `PRODUCT_TYPE_LABELS` chips (same option
 *     set `ManualProductFormScreen.tsx` already uses), **required** since
 *     2026-08-27 — neither capture path opens without one selected.
 *   - Headline copy is deliberately neutral ("a product", not "your
 *     product") since the product hasn't been purchased yet in this flow
 *     (spec Story 1's own framing) — asserted verbatim since the human gave
 *     this exact fix as the one required correction to the design reference.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

// Icon mock renders its `name` prop as visible text (`icon-${name}`) instead
// of `null` — needed for this file's regression assertion that the old
// two-card layout's chevron icon is gone, and for asserting ScanTile's own
// camera icon renders. Same convention as
// tests/add-product-flow/accordion-shell.test.tsx.
jest.mock('@/components/ui/Icon', () => {
  const { Text: RNText } = require('react-native');
  return { Icon: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// CaptureResult shape for mode="inci" per CameraCaptureModal.tsx:
// { mode: 'inci', rawText, hadNonLatin, sourceUri }. `mockNextCaptureText`/
// `mockNextSourceUri` are read at press time (not baked in at mock-definition
// time) so a test can simulate a *second* shot returning different text (the
// "Add another shot" merge path) or a null sourceUri (CameraCaptureModal.tsx
// sets it from `assets[0]?.uri ?? null`, so real code must not assume it's
// always present).
let capturedCaptureProps: { onCapture: (r: unknown) => void } | null = null;
let mockNextCaptureText = 'Aqua, Niacinamide, Glycerin';
let mockNextSourceUri: string | null = 'file://ingredients.jpg';
jest.mock('@/components/camera/CameraCaptureModal', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    CameraCaptureModal: (props: any) => {
      capturedCaptureProps = props;
      if (!props.visible) return null;
      return (
        <Pressable
          accessibilityLabel="Simulate OCR capture"
          onPress={() =>
            props.onCapture({
              mode: 'inci',
              rawText: mockNextCaptureText,
              hadNonLatin: false,
              sourceUri: mockNextSourceUri,
            })
          }
        >
          <RNText>{`camera-open-${props.mode}`}</RNText>
        </Pressable>
      );
    },
  };
});

// Captures every render's props so the primary/secondary hierarchy test
// below can assert on `variant` for the paste action — a real Pressable+Text
// is still rendered so every existing `fireEvent.press(screen.getByText(...))`
// call keeps working unchanged (same double-duty mock shape as
// ExploreCompositionResultScreen.test.tsx's Button mock).
let mockButtonCalls: Array<{ variant?: string; children: unknown; testID?: string }> = [];
jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    Button: (props: any) => {
      mockButtonCalls.push({ variant: props.variant, children: props.children, testID: props.testID });
      return (
        <Pressable
          onPress={props.disabled ? undefined : props.onPress}
          accessibilityLabel={props.accessibilityLabel ?? String(props.children)}
          testID={props.testID}
        >
          <RNText>{props.children}</RNText>
        </Pressable>
      );
    },
  };
});

function findButtonCall(label: string) {
  return mockButtonCalls.find((call) => call.children === label);
}

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

import ExploreCompositionCaptureScreen from '@/screens/catalog/ExploreCompositionCaptureScreen';
import { trackEvent } from '@/utils/analytics';
import { makeNavigation } from './fixtures';

function renderScreen() {
  const navigation = makeNavigation();
  render(<ExploreCompositionCaptureScreen navigation={navigation} route={{ params: {} } as any} />);
  return navigation as { navigate: jest.Mock };
}

function selectCategory() {
  fireEvent.press(screen.getByText('Serum'));
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedCaptureProps = null;
  mockButtonCalls = [];
  mockNextCaptureText = 'Aqua, Niacinamide, Glycerin';
  mockNextSourceUri = 'file://ingredients.jpg';
});

describe('Analytics (explore-insights-v2 task 07): explore_capture_started', () => {
  it('fires with method "photo" and the selected category when the photo path captures', () => {
    renderScreen();
    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(trackEvent).toHaveBeenCalledWith({
      name: 'explore_capture_started',
      method: 'photo',
      category: 'serum',
    });
  });

  it('fires with method "paste" and the selected category when the paste path parses', () => {
    renderScreen();
    selectCategory();
    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.changeText(screen.getByLabelText(/paste.*ingredient/i), 'Aqua, Retinol');
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(trackEvent).toHaveBeenCalledWith({
      name: 'explore_capture_started',
      method: 'paste',
      category: 'serum',
    });
  });

  it('does not fire when capture is blocked by a missing category', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Take a photo'));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not fire when the paste modal is cancelled with empty text', () => {
    renderScreen();
    selectCategory();
    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('fires exactly once per capture FLOW, not once per shot (code review 2026-09-09: "Add another shot" must not re-fire it)', () => {
    renderScreen();
    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    const captureStartedCalls = (trackEvent as jest.Mock).mock.calls.filter(
      (call) => call[0].name === 'explore_capture_started',
    );
    expect(captureStartedCalls).toHaveLength(1);
  });
});

describe('Redesign (2026-08-27, consolidated to a single headline): explains the screen, no ownership implied', () => {
  it('renders one headline explaining what to do, never implying the product is already owned', () => {
    renderScreen();

    expect(
      screen.getByText('Choose a category and add the ingredients to see the details.'),
    ).toBeTruthy();
    // Never "your product" here — this flow is explicitly pre-purchase
    // (spec Story 1), and there is deliberately no separate subheadline
    // anymore (consolidated into this one sentence, per the human's
    // follow-up simplification of the original two-part design reference).
    expect(screen.queryByText(/your product/i)).toBeNull();
  });
});

describe('AC (Story 1, bullet 1): photo is the primary action, paste is a secondary text link', () => {
  it('renders the photo action as a dedicated ScanTile, not the same Button component paste uses', () => {
    renderScreen();

    expect(screen.getByText('Take a photo')).toBeTruthy();
    expect(screen.getByText('Photograph the ingredient list on the label')).toBeTruthy();
    expect(screen.getByText('Paste text manually')).toBeTruthy();

    // Regression signal: ScanTile is never rendered via the mocked Button —
    // if photo ever moves back to a Button, this call would exist and the
    // structural-distinction assertion below would need revisiting.
    expect(findButtonCall('Take a photo')).toBeUndefined();

    const pasteCall = findButtonCall('Paste text manually');
    expect(pasteCall).toBeDefined();
    // Paste stays a plain text-style link — never the filled 'primary'
    // variant and never the outlined 'secondary' variant (06's hierarchy,
    // unchanged by this redesign).
    expect(pasteCall!.variant).not.toBe('primary');
    expect(pasteCall!.variant).not.toBe('secondary');
    expect(['ghost', 'textActive']).toContain(pasteCall!.variant);
  });
});

describe('Regression: no leftover copy from either prior layout', () => {
  it('renders no chevron icon and no card-style subtitles from the original two-card layout', () => {
    renderScreen();

    expect(screen.queryByText('icon-chevron-right')).toBeNull();
    expect(screen.queryByText('Uses the camera, same as scanning a label')).toBeNull();
    expect(screen.queryByText('Type or paste the INCI list instead')).toBeNull();
  });

  it('no longer offers "Photograph the ingredient list" or "Enter / paste text" as button labels', () => {
    // Both were this screen's own action labels before this redesign —
    // "Photograph the ingredient list" is now ScanTile's caption text only
    // (not a button label), and "Enter / paste text" was renamed outright.
    renderScreen();
    expect(screen.queryByText('Paste ingredient text')).toBeNull();
    expect(screen.queryByText('Enter / paste text')).toBeNull();
  });
});

describe('AC (Story 1, bullet 4): no brand/name input anywhere on this screen', () => {
  it('never renders a brand or name field, before or after a capture', () => {
    renderScreen();
    expect(screen.queryByLabelText(/brand/i)).toBeNull();
    expect(screen.queryByLabelText(/product name/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/brand/i)).toBeNull();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(screen.queryByLabelText(/brand/i)).toBeNull();
    expect(screen.queryByLabelText(/product name/i)).toBeNull();
  });
});

describe('AC (Story 1, bullets 2+3): raw text is persisted the instant capture completes, before navigation', () => {
  it('photo path: opens CameraCaptureModal(mode="inci"), then navigates with the captured raw text once "Continue" is pressed', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    expect(capturedCaptureProps).not.toBeNull();

    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    // Does not navigate immediately — pauses on the Continue/Add-another-shot
    // choice (2026-09-09 revision) instead of the pre-revision instant nav.
    expect(navigation.navigate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Continue'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ rawIngredientsText: 'Aqua, Niacinamide, Glycerin' }),
    );
  });

  it('photo path: "Add another shot" merges a second capture onto the first before Continue navigates', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(screen.getByText("Missing something? Add another shot.")).toBeTruthy();

    mockNextCaptureText = 'Glycerin, Sodium Hyaluronate';
    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));
    fireEvent.press(screen.getByText('Continue'));

    // mergeIngredientCaptures dedupes the "Glycerin" overlap between the two
    // shots rather than concatenating them naively.
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({
        rawIngredientsText: 'Aqua, Niacinamide, Glycerin, Sodium Hyaluronate',
      }),
    );
  });
});

describe('Capture confirmation feedback (2026-09-09 user feedback: unclear whether a photo attached, unclear merge-vs-overwrite, unsure all photos counted)', () => {
  it('shows a thumbnail and an ingredient count after a single capture', () => {
    renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(screen.getByLabelText('Captured photo 1')).toBeTruthy();
    expect(screen.queryByLabelText('Captured photo 2')).toBeNull();
    // mockNextCaptureText defaults to 'Aqua, Niacinamide, Glycerin' — 3 tokens.
    expect(screen.getByText('3 ingredients recognized')).toBeTruthy();
    // Single-shot case: no "N photos combined" prefix.
    expect(screen.queryByText(/photos combined/i)).toBeNull();
  });

  it('shows a thumbnail per shot and a "combined" count once a second shot is added', () => {
    renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    mockNextCaptureText = 'Glycerin, Sodium Hyaluronate';
    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(screen.getByLabelText('Captured photo 1')).toBeTruthy();
    expect(screen.getByLabelText('Captured photo 2')).toBeTruthy();
    // Merged, deduped text is "Aqua, Niacinamide, Glycerin, Sodium Hyaluronate" — 4 tokens.
    expect(screen.getByText('2 photos combined — 4 ingredients recognized')).toBeTruthy();
  });

  it('explains that a second shot adds to the first rather than replacing it', () => {
    renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(
      screen.getByText(/added to what we already read, not replace it/i),
    ).toBeTruthy();
  });

  it('regression (2026-09-09 real device photos): does not silently drop a second shot\'s new ingredients behind the first shot\'s own trailing Directions/Warnings text', () => {
    // Real-world shape confirmed via actual Tesseract output on the user's
    // photos: shot 1's own photo happened to also capture the trailing
    // "Made in ..." manufacturer footer, so extractIngredientSection's
    // single cut-at-first-stop-marker pass — if applied to the merged
    // text — would stop there and discard everything shot 2 contributed.
    const navigation = renderScreen();

    selectCategory();
    mockNextCaptureText = 'Ingredients Aqua, Niacinamide, Made in Poland by Farmapol';
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    mockNextCaptureText = 'Isopropyl Myristate, Cetearyl Alcohol, Hydroxyacetophenone';
    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));
    fireEvent.press(screen.getByText('Continue'));

    const navigatedText = (navigation.navigate as jest.Mock).mock.calls[0][1].rawIngredientsText as string;
    expect(navigatedText).toContain('Isopropyl Myristate');
    expect(navigatedText).toContain('Cetearyl Alcohol');
    expect(navigatedText).toContain('Hydroxyacetophenone');
  });

  it('regression (code review 2026-09-09): still treats it as a multi-shot merge even when a shot\'s sourceUri comes back null', () => {
    // CameraCaptureModal.tsx sets sourceUri from `assets[0]?.uri ?? null` —
    // it can legitimately be null. The single-vs-multi-shot decision in
    // finalizeCapturedText must not be derived from capturedPhotoUris.length
    // (which only grows when sourceUri is truthy), or a null sourceUri on
    // either shot would silently re-enable the extraction pass and
    // reintroduce the exact data-loss bug the previous test guards against.
    const navigation = renderScreen();

    selectCategory();
    mockNextCaptureText = 'Ingredients Aqua, Niacinamide, Made in Poland by Farmapol';
    mockNextSourceUri = null;
    fireEvent.press(screen.getByText('Take a photo'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    mockNextCaptureText = 'Isopropyl Myristate, Cetearyl Alcohol, Hydroxyacetophenone';
    mockNextSourceUri = null;
    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));
    fireEvent.press(screen.getByText('Continue'));

    const navigatedText = (navigation.navigate as jest.Mock).mock.calls[0][1].rawIngredientsText as string;
    expect(navigatedText).toContain('Isopropyl Myristate');
    expect(navigatedText).toContain('Cetearyl Alcohol');
    expect(navigatedText).toContain('Hydroxyacetophenone');
  });
});

describe('Paste path (AC Story 1, bullets 2+3, unchanged by the 2026-09-09 photo-path revision): persists raw text and navigates instantly', () => {
  it('paste path: applies no OCR step and navigates with the exact pasted text', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.changeText(
      screen.getByLabelText(/paste.*ingredient/i),
      'Water, Panthenol, Cica',
    );
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ rawIngredientsText: 'Water, Panthenol, Cica' }),
    );
  });

  it('cuts off Directions/Warnings text captured alongside the real ingredient list before navigating (2026-08-27 follow-up)', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.changeText(
      screen.getByLabelText(/paste.*ingredient/i),
      'Water, Panthenol, Cica, Directions: Apply twice daily. Made in France.',
    );
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ rawIngredientsText: 'Water, Panthenol, Cica' }),
    );
  });

  it('does not invoke splitLabelText/brandCorrection-style identity machinery — no corpus search call is made from this screen', () => {
    // Guardrail regression: this screen has no search input/corpus lookup at
    // all. A search box would only ever appear via AddProductHub, never here.
    renderScreen();
    expect(screen.queryByTestId('hub-search-input')).toBeNull();
    expect(screen.queryByPlaceholderText(/search by name or brand/i)).toBeNull();
  });
});

describe('Category capture (2026-08-27: required, single-tap, carried through, above the capture block)', () => {
  it('blocks the paste path with an inline error when no category is selected, never opening the modal', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Paste text manually'));

    expect(screen.queryByLabelText(/paste.*ingredient/i)).toBeNull();
    expect(screen.getByText(/please select a category/i)).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('blocks the photo path with an inline error when no category is selected, never opening the camera', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Take a photo'));

    expect(screen.queryByLabelText('Simulate OCR capture')).toBeNull();
    expect(screen.getByText(/please select a category/i)).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('clears the error and lets capture proceed once a category chip is selected', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Paste text manually'));
    expect(screen.getByText(/please select a category/i)).toBeTruthy();

    selectCategory();
    expect(screen.queryByText(/please select a category/i)).toBeNull();

    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.changeText(screen.getByLabelText(/paste.*ingredient/i), 'Aqua, Retinol');
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ category: 'serum' }),
    );
  });

  it('carries a tapped category chip through to the result screen', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Paste text manually'));
    fireEvent.changeText(screen.getByLabelText(/paste.*ingredient/i), 'Aqua, Retinol');
    fireEvent.press(screen.getByText('Parse ingredients'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ category: 'serum' }),
    );
  });
});
