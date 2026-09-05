import { setAnalyticsSink, trackEvent, type AnalyticsEvent } from '@/utils/analytics';

const EVENT: AnalyticsEvent = { name: 'explore_dismissed' };

describe('trackEvent — default sink', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    // Restore the module's default sink for subsequent test files/describes.
    setAnalyticsSink((event) => {
      if ((global as { __DEV__?: boolean }).__DEV__) console.log('[analytics]', event);
    });
  });

  it('does not throw with no custom sink configured', () => {
    expect(() => trackEvent(EVENT)).not.toThrow();
  });

  it('is a silent no-op outside __DEV__', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;

    trackEvent(EVENT);

    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('trackEvent — custom sink', () => {
  it('delivers the event to a configured sink', () => {
    const received: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => received.push(event));

    trackEvent(EVENT);

    expect(received).toEqual([EVENT]);
  });

  it('swallows a throwing sink — the caller never sees the error', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setAnalyticsSink(() => {
      throw new Error('sink exploded');
    });

    expect(() => trackEvent(EVENT)).not.toThrow();

    warnSpy.mockRestore();
  });
});
