/**
 * OnboardingProgressRing (tech design FE-3, Assumption 6).
 * Spec: docs/specs/onboarding-5-step-redesign.md Story 1.
 *
 * src/components/onboarding/OnboardingProgressRing.tsx does not exist yet —
 * this file is expected to fail to import/compile until FE-3 lands (see
 * .claude/rules/testing.md: red before green).
 *
 * react-native-svg is mocked at the module boundary: this is the first usage
 * of that dependency anywhere in src/ (tech design Assumption 6), and the
 * arc itself is a pure visual; only the accessibility-parity text sibling
 * matters to this test.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const stub = (name: string) => {
    const Stub = (props: Record<string, unknown>) => (
      <View testID={(props.testID as string) ?? `svg-${name}`} />
    );
    Stub.displayName = name;
    return Stub;
  };
  // Real own properties (not just a Proxy `get` trap) so lucide-react-native's
  // internal namespace-import enumeration (`Object.keys(...)`) finds them — a
  // `get`-only Proxy stubs direct property access fine but is invisible to
  // `Object.keys`, which otherwise silently drops every SVG primitive the
  // Icon component's lucide glyphs render through (Circle, Path, etc.),
  // making any icon inside the ring resolve to `undefined`.
  const KNOWN_EXPORTS = [
    'Svg', 'Circle', 'Path', 'Line', 'Rect', 'Polyline', 'Polygon', 'Ellipse',
    'G', 'Defs', 'ClipPath', 'Mask', 'LinearGradient', 'RadialGradient',
    'Stop', 'Use', 'Symbol', 'Text', 'TSpan',
  ];
  const target: Record<string, unknown> = { __esModule: true, default: stub('Svg') };
  KNOWN_EXPORTS.forEach((name) => {
    target[name] = stub(name);
  });
  return new Proxy(target, {
    get: (t: Record<string, unknown>, prop: string) => (prop in t ? t[prop] : stub(prop)),
  });
});

import { makeProgressRingProps } from './fixtures';
import { OnboardingProgressRing } from '@/components/onboarding/OnboardingProgressRing';

describe('OnboardingProgressRing — accessibility parity with the visual ring (tech design FE-3)', () => {
  it('renders "Step 1 of 5" as visible text on the first of five steps', () => {
    render(<OnboardingProgressRing {...makeProgressRingProps({ step: 1, totalSteps: 5 })} />);

    expect(screen.getByText('Step 1 of 5')).toBeTruthy();
  });

  it('updates the visible text to "Step 3 of 5" when re-rendered on the third step', () => {
    const props = makeProgressRingProps({ step: 1, totalSteps: 5 });
    const { rerender } = render(<OnboardingProgressRing {...props} />);
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();

    rerender(<OnboardingProgressRing {...props} step={3} />);

    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
    expect(screen.queryByText('Step 1 of 5')).toBeNull();
  });

  it('renders "Step 5 of 5" on the final step', () => {
    render(<OnboardingProgressRing {...makeProgressRingProps({ step: 5, totalSteps: 5 })} />);

    expect(screen.getByText('Step 5 of 5')).toBeTruthy();
  });
});
