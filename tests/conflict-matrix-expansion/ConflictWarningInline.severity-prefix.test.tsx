/**
 * FE-5 — severity-driven copy prefixes on ConflictWarningInline.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md §5, §10 (decision 1 —
 * "no third severity tier is introduced").
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3
 *
 * Exactly two prefixes exist: "Strong conflict — " for `avoid`,
 * "Possible conflict — " for `caution`. Tone stays `warning` (amber) for
 * both — no new color, no third tier.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';
import { ConflictEngine } from '@/utils/conflictEngine';
import { colors } from '@/constants/tokens';
import { makeConflictWarningInlineProps, makeProduct, makeVisibleSteps } from './fixtures';

type TextInstance = ReturnType<typeof screen.getByText>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walks up from a rendered Text node to the nearest InlineAlert container —
 * the first ancestor whose flattened style declares a borderColor (the tone
 * marker set from InlineAlert's toneBackground/toneBorder maps).
 */
function alertContainerStyle(textNode: TextInstance): Record<string, unknown> {
  let node: TextInstance | null = textNode;
  while (node) {
    const flat = StyleSheet.flatten(node.props?.style) as Record<string, unknown> | undefined;
    if (flat && flat.borderColor !== undefined) return flat;
    node = node.parent;
  }
  throw new Error('Could not find an InlineAlert container above this text node');
}

describe('FE-5: severity-driven conflict prefixes', () => {
  it('prefixes an avoid-severity conflict with "Strong conflict — "', () => {
    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);
    const steps = makeVisibleSteps([retinoid, acid]);
    const [conflict] = ConflictEngine.detectConflicts(steps, [retinoid, acid]);
    expect(conflict.rule.severity).toBe('avoid');

    render(
      <ConflictWarningInline
        {...makeConflictWarningInlineProps({ eveningSteps: steps, products: [retinoid, acid] })}
      />,
    );

    expect(
      screen.getByText(new RegExp(`^Strong conflict — ${escapeRegExp(conflict.rule.explanation)}`)),
    ).toBeTruthy();
  });

  it('prefixes a caution-severity conflict with "Possible conflict — "', () => {
    const vitc = makeProduct(['vitamin_c_pure']);
    const copper = makeProduct(['copper_peptides']);
    const steps = makeVisibleSteps([vitc, copper]);
    const [conflict] = ConflictEngine.detectConflicts(steps, [vitc, copper]);
    expect(conflict.rule.severity).toBe('caution');

    render(
      <ConflictWarningInline
        {...makeConflictWarningInlineProps({ morningSteps: steps, products: [vitc, copper] })}
      />,
    );

    expect(
      screen.getByText(new RegExp(`^Possible conflict — ${escapeRegExp(conflict.rule.explanation)}`)),
    ).toBeTruthy();
  });

  it('keeps tone="warning" (amber) for both an avoid and a caution row — no new color per severity', () => {
    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);
    const vitc = makeProduct(['vitamin_c_pure']);
    const copper = makeProduct(['copper_peptides']);
    const morningSteps = makeVisibleSteps([retinoid, acid]);
    const eveningSteps = makeVisibleSteps([vitc, copper]);
    const [avoidConflict] = ConflictEngine.detectConflicts(morningSteps, [retinoid, acid]);
    const [cautionConflict] = ConflictEngine.detectConflicts(eveningSteps, [vitc, copper]);

    render(
      <ConflictWarningInline
        {...makeConflictWarningInlineProps({
          morningSteps,
          eveningSteps,
          products: [retinoid, acid, vitc, copper],
        })}
      />,
    );

    const avoidBody = screen.getByText(
      new RegExp(`^Strong conflict — ${escapeRegExp(avoidConflict.rule.explanation)}`),
    );
    const cautionBody = screen.getByText(
      new RegExp(`^Possible conflict — ${escapeRegExp(cautionConflict.rule.explanation)}`),
    );

    expect(alertContainerStyle(avoidBody)).toMatchObject({
      backgroundColor: colors.statusWarningTint,
      borderColor: colors.statusWarningLine,
    });
    expect(alertContainerStyle(cautionBody)).toMatchObject({
      backgroundColor: colors.statusWarningTint,
      borderColor: colors.statusWarningLine,
    });
  });

  it('never introduces a third severity prefix anywhere in the component source', () => {
    // Source-level guard (same convention as rulesetIntegrity.test.ts's
    // "engine determinism guard"): ConflictSeverity is exactly two-tier
    // ('avoid' | 'caution') per spec §10 decision 1 — guard against a stray
    // third branch (e.g. a "Low"/"Minor" tier reintroduced from the brief's
    // originally-drafted 3-tier matrix).
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/routine/ConflictWarningInline.tsx'),
      'utf8',
    );

    expect(src).toContain('Strong conflict — ');
    expect(src).toContain('Possible conflict — ');
    expect(src).not.toMatch(/low conflict|minor conflict|mild conflict/i);
  });
});
