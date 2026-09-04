/**
 * Story 1 — `sensitive` exists as a real, migratable profile field.
 * Spec: docs/specs/vials-onboarding-quizzes.md Story 1 (all 3 ACs).
 * Tech design: docs/tech-design/vials-onboarding-quizzes.md FE-1/FE-2/FE-3.
 *
 * `UserProfile.sensitive` does not exist yet (FE-1); `migrateProfile` has no
 * v6->v7 backfill branch for it yet (FE-2); `DEFAULT_PROFILE` doesn't set it
 * yet (FE-3); `CURRENT_SCHEMA_VERSION` is still 6, not 7. Every assertion
 * below is expected to fail (tsc and/or jest) until FE-1..FE-3 land —
 * red-before-green.
 *
 * Two layers are exercised, matching the task's own scoping note ("testable
 * via profileStore/migrateProfile"):
 *   - `migrateProfile` called directly, composed the same way
 *     `tests/routine-engine/migrations-hydrate.test.ts` already does for the
 *     schema-v2 migration — a faithful integration simulation of "legacy
 *     data on disk -> canonical in-memory shape" without needing a real or
 *     mocked AsyncStorage.
 *   - The real `useProfileStore.hydrate()` with only the storage I/O
 *     boundary (`@/services/storage`) mocked, to verify the STORE actually
 *     wires `migrateProfile`'s output through to `profile` state and
 *     persists it back — not re-testing `migrateProfile`'s own unit
 *     behaviour a second time (that co-located suite is FE-2's own scope
 *     per .claude/rules/testing.md).
 *
 * This suite does NOT duplicate FE-2's co-located `migrations.test.ts` case
 * (idempotency across every other v6 field, etc.) — only the `sensitive`
 * backfill and the schema-version bump are asserted here, at the level the
 * task told qa-lead to own.
 */
import { makeProfile } from './fixtures';

const mockSaveJson = jest.fn();
const mockLoadJson = jest.fn();
const mockLoadSchemaVersion = jest.fn();
const mockPersistSchemaVersionIfBehind = jest.fn();

jest.mock('@/services/storage', () => ({
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  loadJson: (...args: unknown[]) => mockLoadJson(...args),
  loadSchemaVersion: (...args: unknown[]) => mockLoadSchemaVersion(...args),
  persistSchemaVersionIfBehind: (...args: unknown[]) => mockPersistSchemaVersionIfBehind(...args),
  STORAGE_KEYS: { profile: '@vials/profile', schemaVersion: '@vials/schemaVersion' },
}));

import type { UserProfile } from '@/types';
import { CURRENT_SCHEMA_VERSION, migrateProfile } from '@/utils/routineEngine/migrations';
import { useProfileStore } from '@/store/profileStore';

beforeEach(() => {
  mockSaveJson.mockClear();
  mockLoadJson.mockReset();
  mockLoadSchemaVersion.mockReset().mockResolvedValue(CURRENT_SCHEMA_VERSION);
  mockPersistSchemaVersionIfBehind.mockClear();
  useProfileStore.setState({ profile: null, hydrated: false });
});

describe('Story 1 AC1: CURRENT_SCHEMA_VERSION reports the bumped v6->v7 version', () => {
  it('is 7, not 6', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(7);
  });
});

describe('Story 1 AC2: migrateProfile backfills `sensitive` to false for a pre-v7 profile', () => {
  it('sets sensitive: false on a legacy profile that lacks the field entirely', () => {
    const legacyProfile = makeProfile({ sensitive: true }); // any value, then stripped below
    delete (legacyProfile as Partial<UserProfile>).sensitive;

    const result = migrateProfile(legacyProfile);

    expect(result.sensitive).toBe(false);
  });

  it('does not touch an already-migrated profile\'s sensitive value (idempotent, same reference)', () => {
    const alreadyMigrated = makeProfile({ sensitive: true });

    const result = migrateProfile(alreadyMigrated);

    expect(result).toBe(alreadyMigrated);
    expect(result.sensitive).toBe(true);
  });

  it('backfills sensitive on a legacy profile without disturbing other already-present v6 fields', () => {
    const legacyProfile = makeProfile({ hormoneTherapy: true, pregnantOrBreastfeeding: true });
    delete (legacyProfile as Partial<UserProfile>).sensitive;

    const result = migrateProfile(legacyProfile);

    expect(result.sensitive).toBe(false);
    expect(result.hormoneTherapy).toBe(true);
    expect(result.pregnantOrBreastfeeding).toBe(true);
  });
});

describe('Story 1 AC3: a fresh install with no persisted profile defaults sensitive to false', () => {
  it('DEFAULT_PROFILE (via profileStore.hydrate with nothing on disk) has sensitive: false', async () => {
    // Real loadJson resolves the caller's fallback (DEFAULT_PROFILE) when
    // AsyncStorage has nothing stored — simulated directly here.
    mockLoadJson.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().profile?.sensitive).toBe(false);
  });
});

describe('Story 1 AC2 (store integration): hydrate() persists the sensitive backfill for a legacy install', () => {
  it('sets profile.sensitive to false and persists the migrated profile when the persisted profile predates the field', async () => {
    const legacyPersisted = makeProfile({ skinType: 'oily' });
    delete (legacyPersisted as Partial<UserProfile>).sensitive;
    mockLoadJson.mockResolvedValue(legacyPersisted);

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().profile?.sensitive).toBe(false);
    expect(useProfileStore.getState().profile?.skinType).toBe('oily');
    expect(mockSaveJson).toHaveBeenCalledWith(
      '@vials/profile',
      expect.objectContaining({ sensitive: false }),
    );
  });

  it('does not re-persist an already-migrated profile (no gratuitous write on every hydrate)', async () => {
    const migrated = makeProfile({ sensitive: true });
    mockLoadJson.mockResolvedValue(migrated);

    await useProfileStore.getState().hydrate();

    expect(useProfileStore.getState().profile?.sensitive).toBe(true);
    expect(mockSaveJson).not.toHaveBeenCalled();
  });
});
