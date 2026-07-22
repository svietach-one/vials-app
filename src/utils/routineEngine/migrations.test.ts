import type { Product, Routine, UserProfile } from '@/types';
import {
  CURRENT_SCHEMA_VERSION,
  deriveFitzpatrick,
  deriveGroupedPhototype,
  migrateProductActiveKeys,
  migrateProducts,
  migrateProductSource,
  migrateProfile,
  migrateRoutines,
} from '@/utils/routineEngine/migrations';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Serum',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

/** Builds a pre-migration profile (no fitzpatrick / city fields persisted). */
function makeLegacyProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const base = {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    concerns: [],
    spfSensitivity: false,
    onboardingCompleted: false,
    individualDurationMonths: {},
    ...overrides,
  };
  return base as unknown as UserProfile;
}

function makeRoutine(steps: Routine['steps']): Routine {
  return { id: 'r1', name: 'Morning', timeOfDay: 'morning', steps };
}

// ─── Schema version ───────────────────────────────────────────────────────────

describe('CURRENT_SCHEMA_VERSION', () => {
  it('is 4 after adding contributionConsent (contribution-consent task)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });
});

// ─── deriveFitzpatrick ────────────────────────────────────────────────────────

describe('deriveFitzpatrick', () => {
  it('maps each grouped phototype to its stricter Fitzpatrick member', () => {
    expect(deriveFitzpatrick('type_1_2')).toBe(1);
    expect(deriveFitzpatrick('type_3_4')).toBe(4);
    expect(deriveFitzpatrick('type_5_6')).toBe(6);
  });

  it('returns null when the grouped phototype is null', () => {
    expect(deriveFitzpatrick(null)).toBeNull();
  });
});

describe('deriveGroupedPhototype', () => {
  it('maps every numeric type to its group', () => {
    expect(deriveGroupedPhototype(1)).toBe('type_1_2');
    expect(deriveGroupedPhototype(2)).toBe('type_1_2');
    expect(deriveGroupedPhototype(3)).toBe('type_3_4');
    expect(deriveGroupedPhototype(4)).toBe('type_3_4');
    expect(deriveGroupedPhototype(5)).toBe('type_5_6');
    expect(deriveGroupedPhototype(6)).toBe('type_5_6');
  });

  it('returns null for null', () => {
    expect(deriveGroupedPhototype(null)).toBeNull();
  });

  it('round-trips with deriveFitzpatrick group membership', () => {
    for (const fp of [1, 2, 3, 4, 5, 6] as const) {
      const grouped = deriveGroupedPhototype(fp);
      // The stricter member of the derived group maps back into the same group
      expect(deriveGroupedPhototype(deriveFitzpatrick(grouped))).toBe(grouped);
    }
  });
});

// ─── migrateProfile ───────────────────────────────────────────────────────────

describe('migrateProfile', () => {
  it('adds a null city default when none was persisted', () => {
    // Arrange
    const profile = makeLegacyProfile();
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.city).toBeNull();
  });

  it('derives the numeric fitzpatrick from the grouped phototype', () => {
    // Arrange
    const profile = makeLegacyProfile({ phototype: 'type_5_6' });
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.fitzpatrick).toBe(6);
  });

  it('derives null fitzpatrick when phototype is null', () => {
    const result = migrateProfile(makeLegacyProfile({ phototype: null }));
    expect(result.fitzpatrick).toBeNull();
  });

  it('leaves the grouped phototype field untouched', () => {
    const result = migrateProfile(makeLegacyProfile({ phototype: 'type_3_4' }));
    expect(result.phototype).toBe('type_3_4');
  });

  it('preserves an already-set city rather than overwriting it', () => {
    // Arrange
    const city = { name: 'Berlin', lat: 52.52, lon: 13.4 };
    const profile = makeLegacyProfile({ phototype: 'type_1_2' });
    (profile as UserProfile).city = city;
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.city).toBe(city);
  });

  it('is idempotent — running twice returns the same reference', () => {
    // Arrange
    const once = migrateProfile(makeLegacyProfile({ phototype: 'type_3_4' }));
    // Act
    const twice = migrateProfile(once);
    // Assert
    expect(twice).toBe(once);
  });
});

// ─── migrateProductActiveKeys ─────────────────────────────────────────────────

describe('migrateProductActiveKeys', () => {
  it('canonicalizes legacy activeTags keys', () => {
    // Arrange
    const product = makeProduct({ activeTags: ['retinol', 'spf_chemical'] });
    // Act
    const result = migrateProductActiveKeys(product);
    // Assert
    expect(result.activeTags).toEqual(['retinoid', 'spf_filters']);
  });

  it('canonicalizes legacy activeIngredients keys', () => {
    // Arrange
    const product = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    // Act
    const result = migrateProductActiveKeys(product);
    // Assert
    expect(result.activeIngredients[0].key).toBe('retinoid');
  });

  it('sets vitaminCAutoMigrated when a legacy vitamin_c tag maps to pure', () => {
    // Arrange
    const product = makeProduct({ activeTags: ['vitamin_c'] });
    // Act
    const result = migrateProductActiveKeys(product);
    // Assert
    expect(result.activeTags).toEqual(['vitamin_c_pure']);
    expect(result.vitaminCAutoMigrated).toBe(true);
  });

  it('sets vitaminCAutoMigrated when the legacy key is only on activeIngredients', () => {
    const product = makeProduct({
      activeIngredients: [{ key: 'vitamin_c', displayName: 'Vitamin C' }],
    });
    const result = migrateProductActiveKeys(product);
    expect(result.vitaminCAutoMigrated).toBe(true);
  });

  it('does not set the vitamin C marker when no vitamin_c tag is present', () => {
    const product = makeProduct({ activeTags: ['retinol'] });
    const result = migrateProductActiveKeys(product);
    expect(result.vitaminCAutoMigrated).toBeUndefined();
  });

  it('de-duplicates keys that collapse onto the same canonical key', () => {
    // Arrange — legacy 'retinol' and canonical 'retinoid' both present
    const product = makeProduct({ activeTags: ['retinol', 'retinoid'] });
    // Act
    const result = migrateProductActiveKeys(product);
    // Assert
    expect(result.activeTags).toEqual(['retinoid']);
  });

  it('returns the same reference when the product is already canonical', () => {
    // Arrange
    const product = makeProduct({
      activeTags: ['retinoid'],
      activeIngredients: [{ key: 'niacinamide', displayName: 'Niacinamide' }],
    });
    // Act
    const result = migrateProductActiveKeys(product);
    // Assert
    expect(result).toBe(product);
  });

  it('is idempotent — running twice returns the same reference', () => {
    const once = migrateProductActiveKeys(makeProduct({ activeTags: ['vitamin_c'] }));
    const twice = migrateProductActiveKeys(once);
    expect(twice).toBe(once);
  });
});

// ─── migrateProductSource ─────────────────────────────────────────────────────

describe('migrateProductSource', () => {
  it('backfills user_local when the product has no OBF id', () => {
    // Arrange
    const product = makeProduct({ openBeautyFactsId: null });
    // Act
    const result = migrateProductSource(product);
    // Assert
    expect(result.source).toBe('user_local');
  });

  it('backfills obf_import when the product carries an OBF id', () => {
    // Arrange
    const product = makeProduct({ openBeautyFactsId: 'obf-123' });
    // Act
    const result = migrateProductSource(product);
    // Assert
    expect(result.source).toBe('obf_import');
  });

  it('returns the same reference when source is already set, even if it disagrees with the OBF id', () => {
    // Arrange — a community-synced record must never be re-labelled.
    const product = makeProduct({ source: 'community', openBeautyFactsId: 'obf-123' });
    // Act
    const result = migrateProductSource(product);
    // Assert
    expect(result).toBe(product);
    expect(result.source).toBe('community');
  });
});

// ─── migrateProducts ──────────────────────────────────────────────────────────

describe('migrateProducts', () => {
  it('migrates every product in the list, including the source backfill', () => {
    const products = [
      makeProduct({ id: 'a', activeTags: ['retinol'] }),
      makeProduct({ id: 'b', activeTags: ['vitamin_c'], openBeautyFactsId: 'obf-9' }),
    ];
    const result = migrateProducts(products);
    expect(result[0].activeTags).toEqual(['retinoid']);
    expect(result[0].source).toBe('user_local');
    expect(result[1].activeTags).toEqual(['vitamin_c_pure']);
    expect(result[1].source).toBe('obf_import');
  });

  it('returns the same reference when no product changed', () => {
    const products = [makeProduct({ activeTags: ['retinoid'], source: 'user_local' })];
    expect(migrateProducts(products)).toBe(products);
  });
});

// ─── migrateRoutines ──────────────────────────────────────────────────────────

describe('migrateRoutines', () => {
  it('defaults userPinned to false on steps that lack it', () => {
    // Arrange
    const routines = [
      makeRoutine([
        { id: 's1', productType: 'serum', productId: 'p1', hidden: false, scheduledDays: [] },
      ]),
    ];
    // Act
    const result = migrateRoutines(routines);
    // Assert
    expect(result[0].steps[0].userPinned).toBe(false);
  });

  it('defaults scheduledDays to [] for pre-field steps', () => {
    // Arrange — simulate a step persisted before scheduledDays existed
    const routines = [
      makeRoutine([
        { id: 's1', productType: 'serum', productId: 'p1', hidden: false } as never,
      ]),
    ];
    // Act
    const result = migrateRoutines(routines);
    // Assert
    expect(result[0].steps[0].scheduledDays).toEqual([]);
    expect(result[0].steps[0].userPinned).toBe(false);
  });

  it('preserves an existing userPinned value', () => {
    const routines = [
      makeRoutine([
        {
          id: 's1',
          productType: 'serum',
          productId: 'p1',
          hidden: false,
          scheduledDays: [1, 3],
          userPinned: true,
        },
      ]),
    ];
    const result = migrateRoutines(routines);
    expect(result[0].steps[0].userPinned).toBe(true);
    expect(result[0].steps[0].scheduledDays).toEqual([1, 3]);
  });

  it('returns the same reference when every step already conforms', () => {
    const routines = [
      makeRoutine([
        {
          id: 's1',
          productType: 'serum',
          productId: 'p1',
          hidden: false,
          scheduledDays: [],
          userPinned: false,
        },
      ]),
    ];
    expect(migrateRoutines(routines)).toBe(routines);
  });

  it('is idempotent — running twice returns the same reference', () => {
    const routines = [
      makeRoutine([
        { id: 's1', productType: 'serum', productId: 'p1', hidden: false, scheduledDays: [] },
      ]),
    ];
    const once = migrateRoutines(routines);
    const twice = migrateRoutines(once);
    expect(twice).toBe(once);
  });
});

describe('migrateProfile — goal derivation (phase-03 §3.1)', () => {
  it('derives aging + needsConfirmation from a wrinkles concern', () => {
    const result = migrateProfile(makeLegacyProfile({ concerns: ['wrinkles'] }));
    expect(result.primaryGoal).toBe('aging');
    expect(result.secondaryGoal).toBeNull();
    expect(result.goalNeedsConfirmation).toBe(true);
  });

  it('defaults empty concerns to maintenance WITHOUT a confirmation prompt', () => {
    // A default is not a guess — nothing to confirm (tech design Assumption 1)
    const result = migrateProfile(makeLegacyProfile({ concerns: [] }));
    expect(result.primaryGoal).toBe('maintenance');
    expect(result.goalNeedsConfirmation).toBe(false);
  });

  it('applies first-match-wins ordering across concern groups', () => {
    // acne group outranks pigmentation and aging even when all are present
    const result = migrateProfile(
      makeLegacyProfile({ concerns: ['wrinkles', 'dark_spots', 'pores'] }),
    );
    expect(result.primaryGoal).toBe('acne');
  });

  it('maps sensitivity-family concerns to barrier_repair', () => {
    const result = migrateProfile(makeLegacyProfile({ concerns: ['eczema'] }));
    expect(result.primaryGoal).toBe('barrier_repair');
  });

  it('never re-derives a present goal — including user-confirmed maintenance', () => {
    const confirmed = migrateProfile(
      makeLegacyProfile({
        concerns: ['wrinkles'],
        primaryGoal: 'maintenance',
        secondaryGoal: null,
        goalNeedsConfirmation: false,
      }),
    );
    expect(confirmed.primaryGoal).toBe('maintenance');
    expect(confirmed.goalNeedsConfirmation).toBe(false);
  });

  it('is idempotent — a second run returns the same reference', () => {
    const once = migrateProfile(makeLegacyProfile({ concerns: ['dryness'] }));
    const twice = migrateProfile(once);
    expect(twice).toBe(once);
    expect(once.primaryGoal).toBe('dehydration');
  });
});

describe('migrateProfile — phototype confirmation flag (phase-08 §8.1)', () => {
  it('flags a migrating profile with a grouped phototype for confirmation', () => {
    const result = migrateProfile(makeLegacyProfile({ phototype: 'type_3_4' }));
    expect(result.fitzpatrick).toBe(4); // strict-member derivation
    expect(result.phototypeNeedsConfirmation).toBe(true);
  });

  it('does not flag a migrating profile that had no phototype', () => {
    const result = migrateProfile(makeLegacyProfile({ phototype: null }));
    expect(result.phototypeNeedsConfirmation).toBe(false);
  });

  it('never re-flags a post-v3 profile — a present flag is preserved', () => {
    const confirmed = migrateProfile(
      makeLegacyProfile({ phototype: 'type_5_6', phototypeNeedsConfirmation: false }),
    );
    expect(confirmed.phototypeNeedsConfirmation).toBe(false);
  });
});

describe('migrateProfile — contribution consent backfill (contribution-consent task)', () => {
  it('backfills a declined, never-asked consent when the field is absent', () => {
    // Arrange
    const profile = makeLegacyProfile();
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.contributionConsent).toEqual({ granted: false, timestamp: null });
  });

  it('leaves an already-present consent value untouched, including a user-granted true', () => {
    // Arrange
    const consent = { granted: true, timestamp: '2026-05-01T00:00:00.000Z' };
    const profile = makeLegacyProfile({ contributionConsent: consent });
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.contributionConsent).toBe(consent);
  });

  it('leaves an already-present declined consent with a real timestamp untouched', () => {
    // Arrange
    const consent = { granted: false, timestamp: '2026-05-01T00:00:00.000Z' };
    const profile = makeLegacyProfile({ contributionConsent: consent });
    // Act
    const result = migrateProfile(profile);
    // Assert
    expect(result.contributionConsent).toBe(consent);
  });

  it('returns the same reference when contributionConsent is already present and every other field conforms', () => {
    // Arrange
    const migratedOnce = migrateProfile(makeLegacyProfile({ phototype: 'type_3_4' }));
    // Act
    const migratedTwice = migrateProfile(migratedOnce);
    // Assert
    expect(migratedTwice).toBe(migratedOnce);
  });
});

describe('migrateProductActiveKeys — peptide re-attribution (phase-08 §8.3)', () => {
  it('re-tags copper_peptides to peptide_signal when INCI has no copper marker', () => {
    const result = migrateProductActiveKeys(
      makeProduct({
        activeTags: ['copper_peptides'],
        fullIngredientText: 'Aqua, Palmitoyl Pentapeptide-4, Glycerin',
      }),
    );
    expect(result.activeTags).toEqual(['peptide_signal']);
  });

  it('keeps copper_peptides when the INCI carries a copper marker', () => {
    const product = makeProduct({
      activeTags: ['copper_peptides'],
      fullIngredientText: 'Aqua, Copper Tripeptide-1, Glycerin',
    });
    const result = migrateProductActiveKeys(product);
    expect(result).toBe(product); // same reference — no change
    expect(result.activeTags).toEqual(['copper_peptides']);
  });

  it('keeps copper_peptides when there is no INCI text (user assertion, no evidence)', () => {
    const product = makeProduct({ activeTags: ['copper_peptides'], fullIngredientText: null });
    const result = migrateProductActiveKeys(product);
    expect(result).toBe(product);
    expect(result.activeTags).toEqual(['copper_peptides']);
  });

  it('does not duplicate peptide_signal when the tag list already carries it', () => {
    const result = migrateProductActiveKeys(
      makeProduct({
        activeTags: ['copper_peptides', 'peptide_signal'],
        fullIngredientText: 'Aqua, Palmitoyl Pentapeptide-4',
      }),
    );
    expect(result.activeTags).toEqual(['peptide_signal']);
  });

  it('is idempotent — a second run over the re-tagged product is a no-op', () => {
    const once = migrateProductActiveKeys(
      makeProduct({
        activeTags: ['copper_peptides'],
        fullIngredientText: 'Aqua, Palmitoyl Pentapeptide-4',
      }),
    );
    const twice = migrateProductActiveKeys(once);
    expect(twice).toBe(once); // same reference — nothing left to migrate
  });
});
