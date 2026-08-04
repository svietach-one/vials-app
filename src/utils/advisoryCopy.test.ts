/**
 * US-26 non-absolute language lint. Scans every advisory message template
 * shipped by the v1.2 layers against the banned-phrase list. This is the
 * enforcement point the story asks for: a build-failing test, not a style
 * guideline — new copy that reaches for prohibitive phrasing fails here.
 */

import {
  BANNED_ADVISORY_PHRASES,
  findBannedPhrases,
} from '@/utils/advisoryCopy';
import { DENSITY_MESSAGES } from '@/utils/activeIngredientDensity';
import {
  CONDITION_DISCLAIMER,
  CONDITION_MODIFIERS,
  RECOVERY_CAUTIONS,
} from '@/utils/skinConditionModifiers';
import { buildSpfAdequacyMessage } from '@/utils/spfAdequacy';
import {
  buildNotOwnedMessage,
  buildOnShelfMessage,
  buildSafetyRedirectMessage,
  goalCoverageNotOwnedTitle,
  GOAL_COVERAGE_ON_SHELF_TITLE,
  GOAL_COVERAGE_SAFETY_TITLE,
} from '@/utils/goalCoverage';

/** Every user-visible advisory string, labelled by where it comes from. */
function allTemplates(): { source: string; text: string }[] {
  const templates: { source: string; text: string }[] = [];

  for (const modifier of CONDITION_MODIFIERS) {
    templates.push({ source: `CONDITION_MODIFIERS.${modifier.condition}.label`, text: modifier.label });
    modifier.advisories.forEach((advisory, i) => {
      templates.push({
        source: `CONDITION_MODIFIERS.${modifier.condition}.advisories[${i}]`,
        text: advisory.message,
      });
    });
  }

  for (const [phase, text] of Object.entries(RECOVERY_CAUTIONS)) {
    templates.push({ source: `RECOVERY_CAUTIONS.${phase}`, text });
  }

  for (const [group, tiers] of Object.entries(DENSITY_MESSAGES)) {
    for (const [tier, text] of Object.entries(tiers)) {
      templates.push({ source: `DENSITY_MESSAGES.${group}.${tier}`, text });
    }
  }

  templates.push({ source: 'CONDITION_DISCLAIMER', text: CONDITION_DISCLAIMER });

  // The SPF recommendation is generated, so lint a representative rendering.
  for (const spf of [15, 20, 29]) {
    templates.push({ source: `buildSpfAdequacyMessage(${spf})`, text: buildSpfAdequacyMessage(spf) });
  }

  // engine4.1 §3 goal-coverage copy — also generated, lint representative
  // renderings across every tone (not_owned / on_shelf / safety_redirect).
  templates.push({
    source: 'buildNotOwnedMessage(acne)',
    text: buildNotOwnedMessage('acne', ['retinoid', 'bha']),
  });
  templates.push({
    source: 'buildOnShelfMessage(dehydration)',
    text: buildOnShelfMessage('dehydration', ['hyaluronic_acid']),
  });
  templates.push({
    source: 'buildSafetyRedirectMessage(aging)',
    text: buildSafetyRedirectMessage('aging', ['retinoid'], ['peptide_signal', 'vitamin_c_pure']),
  });
  templates.push({
    source: 'buildSafetyRedirectMessage(aging, no alternative)',
    text: buildSafetyRedirectMessage('aging', ['retinoid'], []),
  });
  templates.push({ source: 'goalCoverageNotOwnedTitle(pigmentation)', text: goalCoverageNotOwnedTitle('pigmentation') });
  templates.push({ source: 'GOAL_COVERAGE_ON_SHELF_TITLE', text: GOAL_COVERAGE_ON_SHELF_TITLE });
  templates.push({ source: 'GOAL_COVERAGE_SAFETY_TITLE', text: GOAL_COVERAGE_SAFETY_TITLE });

  return templates;
}

describe('findBannedPhrases', () => {
  it('flags a prohibitive phrase', () => {
    // Arrange / Act / Assert
    expect(findBannedPhrases('You cannot use this together.')).toContain('cannot');
    expect(findBannedPhrases('Do not use with retinol.')).toContain('do not use');
  });

  it('passes advisory phrasing', () => {
    expect(
      findBannedPhrases('Consider introducing this gradually and monitor your skin response.'),
    ).toEqual([]);
  });

  it('does not fire on a longer word that merely contains a banned phrase', () => {
    // Arrange — "scannot" is nonsense, but the guard must be boundary-aware
    expect(findBannedPhrases('A scannot of the label')).toEqual([]);
  });

  it('still catches a violation preceded by a false-positive occurrence', () => {
    // Arrange — the first hit is inside "scannot"; the real one comes later
    // and must not be masked by it (regression: indexOf checked once).
    expect(findBannedPhrases('A scannot of the label, and you cannot do that')).toContain(
      'cannot',
    );
  });

  it('catches a violation at the very start of the string', () => {
    expect(findBannedPhrases('Cannot be layered.')).toContain('cannot');
  });
});

describe('US-26 banned-phrase lint over every advisory template', () => {
  it('covers a non-trivial number of templates', () => {
    // Guards against the lint silently passing because the collector broke
    expect(allTemplates().length).toBeGreaterThan(15);
  });

  it.each(allTemplates())('$source uses non-absolute language', ({ text }) => {
    // Arrange / Act
    const violations = findBannedPhrases(text);
    // Assert
    expect(violations).toEqual([]);
  });

  it('never calls a single-ingredient advisory a conflict', () => {
    // Arrange / Act / Assert
    for (const modifier of CONDITION_MODIFIERS) {
      for (const advisory of modifier.advisories) {
        expect(advisory.message.toLowerCase()).not.toContain('conflict');
      }
    }
  });

  it('lists every phrase US-26 requires at minimum', () => {
    // Arrange
    const required = [
      'cannot',
      "can't",
      'must not',
      'forbidden',
      'unsafe',
      'do not use',
      'you should not',
      'never use',
    ];
    // Act / Assert
    for (const phrase of required) {
      expect(BANNED_ADVISORY_PHRASES).toContain(phrase);
    }
  });
});
