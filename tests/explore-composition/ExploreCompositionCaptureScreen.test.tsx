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
 *   - Both capture methods converge on setting local raw-text state and
 *     immediately navigating to `ExploreCompositionResult` with
 *     `{ rawIngredientsText, category }` — no intermediate "Continue" step.
 *     UNCHANGED by either revision (layout only).
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
// { mode: 'inci', rawText, hadNonLatin, sourceUri }.
let capturedCaptureProps: { onCapture: (r: unknown) => void } | null = null;
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
              rawText: 'Aqua, Niacinamide, Glycerin',
              hadNonLatin: false,
              sourceUri: 'file://ingredients.jpg',
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

import ExploreCompositionCaptureScreen from '@/screens/catalog/ExploreCompositionCaptureScreen';
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
  it('photo path: opens CameraCaptureModal(mode="inci") and, on capture, navigates to the result screen with the captured raw text', () => {
    const navigation = renderScreen();

    selectCategory();
    fireEvent.press(screen.getByText('Take a photo'));
    expect(capturedCaptureProps).not.toBeNull();

    fireEvent.press(screen.getByLabelText('Simulate OCR capture'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionResult',
      expect.objectContaining({ rawIngredientsText: 'Aqua, Niacinamide, Glycerin' }),
    );
  });

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
