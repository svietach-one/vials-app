import { canShareContributionPhoto, setContributionConsent } from '@/utils/contributionConsent';

// ─── canShareContributionPhoto ─────────────────────────────────────────────────

describe('canShareContributionPhoto', () => {
  it('returns false when consent is undefined', () => {
    // Arrange
    const consent = undefined;
    // Act
    const result = canShareContributionPhoto(consent);
    // Assert
    expect(result).toBe(false);
  });

  it('returns false when consent was explicitly declined', () => {
    // Arrange
    const consent = { granted: false, timestamp: '2026-01-01T00:00:00.000Z' };
    // Act
    const result = canShareContributionPhoto(consent);
    // Assert
    expect(result).toBe(false);
  });

  it('returns false for a migrated profile with a null timestamp', () => {
    // Arrange
    const consent = { granted: false, timestamp: null };
    // Act
    const result = canShareContributionPhoto(consent);
    // Assert
    expect(result).toBe(false);
  });

  it('returns true only when consent was explicitly granted', () => {
    // Arrange
    const consent = { granted: true, timestamp: '2026-01-01T00:00:00.000Z' };
    // Act
    const result = canShareContributionPhoto(consent);
    // Assert
    expect(result).toBe(true);
  });
});

// ─── setContributionConsent ────────────────────────────────────────────────────

describe('setContributionConsent', () => {
  it('preserves the injected now as an ISO timestamp when granting', () => {
    // Arrange
    const now = new Date('2026-03-15T09:30:00.000Z');
    // Act
    const result = setContributionConsent(true, now);
    // Assert
    expect(result).toEqual({ granted: true, timestamp: '2026-03-15T09:30:00.000Z' });
  });

  it('preserves the injected now as an ISO timestamp when declining', () => {
    // Arrange
    const now = new Date('2026-03-15T09:30:00.000Z');
    // Act
    const result = setContributionConsent(false, now);
    // Assert
    expect(result).toEqual({ granted: false, timestamp: '2026-03-15T09:30:00.000Z' });
  });

  it('defaults to the current time when now is not provided', () => {
    // Arrange
    const before = Date.now();
    // Act
    const result = setContributionConsent(true);
    // Assert
    const after = Date.now();
    expect(result.timestamp).not.toBeNull();
    const parsed = new Date(result.timestamp as string).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
