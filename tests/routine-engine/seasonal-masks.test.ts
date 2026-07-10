/**
 * Integration tests — Story 8: Weather-driven seasonal masks
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 8
 *
 * FE-7 (weather service, city autocomplete, hysteresis threshold, cache/
 * staleness fallback) shipped 2026-07-05 and is exercised further down this
 * file at the domain level, plus a component test for the city field in
 * tests/routine-engine/city-field.test.tsx. The
 * engine already CONSUMES a resolved SeasonMask as plain input (tech-design
 * §1); this file exercises seasons.json's rule effects end-to-end through
 * generatePlan/validateRoutines, combined with other engine features
 * (phototype, procedures) to confirm the season layer composes cleanly.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  makeEngineInput,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  makeSeasonMask,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 8 AC: seasonal rules apply through generate/validate once a SeasonMask is supplied', () => {
  it('summer mandates an AM SPF placeholder when the plan contains a photosensitizing active and none is on the shelf', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(makeEngineInput([retinoid], { seasonMask: makeSeasonMask('summer') }));
    expect(plan.placeholders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 'am', productTypes: ['spf'], reasonCode: 'summer_photosensitizer_spf' }),
      ]),
    );
  });

  it('does not mandate SPF in spring for the same shelf (season-scoped rule)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(makeEngineInput([retinoid], { seasonMask: makeSeasonMask('spring') }));
    expect(plan.placeholders.some((p) => p.reasonCode === 'summer_photosensitizer_spf')).toBe(false);
  });

  it('summer caps a solo exfoliant to 1 day/week (Wednesday) via the seasonal limit', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const plan = generatePlan(makeEngineInput([aha], { seasonMask: makeSeasonMask('summer') }));
    const step = plan.periods.evening.find((s) => s.productId === aha.id);
    expect(step?.scheduledDays).toEqual([3]); // Wednesday
  });

  it('winter boosts a barrier-repair product ahead of a newer-but-plain competitor in PM ordering', () => {
    // Both share the "serum" slot and are benign (irritancy 0), so both are
    // admitted regardless of season — the observable seasonal effect is
    // ordering: winter_barrier_priority (period: pm) boosts ceramide's score,
    // overriding the normal newer-addedAt-wins tie-break (slotting.ts orderSteps).
    const ceramideSerum = makeProduct({ activeTags: ['ceramides'], addedAt: '2026-01-01' });
    const plainSerum = makeProduct({ addedAt: '2026-06-01' }); // newer -> would sort first with no boost

    const springOrder = generatePlan(
      makeEngineInput([ceramideSerum, plainSerum], { seasonMask: makeSeasonMask('spring') }),
    ).periods.evening.map((s) => s.productId);
    expect(springOrder).toEqual([plainSerum.id, ceramideSerum.id]); // baseline: newer addedAt first

    const winterOrder = generatePlan(
      makeEngineInput([ceramideSerum, plainSerum], { seasonMask: makeSeasonMask('winter') }),
    ).periods.evening.map((s) => s.productId);
    expect(winterOrder).toEqual([ceramideSerum.id, plainSerum.id]); // boosted -> sorts first despite being older
  });

  it('validate reports the summer SPF gap as a finding over a saved routine missing SPF', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const routines = [makeRoutine('evening', [makeRoutineStep(retinoid)])];
    const result = validateRoutines(
      routines,
      makeEngineInput([retinoid], { seasonMask: makeSeasonMask('summer') }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonCode: 'summer_photosensitizer_spf' }),
      ]),
    );
  });
});

describe('Story 8 — seasons.json severity flows through to the validate finding', () => {
  // Originally a qa-lead gap lock (2026-07-04): the JSON's "severity": "avoid"
  // was dead data. Fixed same day — collectRequireMandates now carries the
  // season rule's own severity into the placeholder, and validate reports it.
  it('reports the summer SPF gap as avoid, honoring the JSON severity declaration', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const routines = [makeRoutine('evening', [makeRoutineStep(retinoid)])];
    const result = validateRoutines(
      routines,
      makeEngineInput([retinoid], { seasonMask: makeSeasonMask('summer') }),
    );
    const finding = result.findings.find((f) => f.reasonCode === 'summer_photosensitizer_spf');
    expect(finding?.severity).toBe('avoid');
    expect(result.hasBlockingFindings).toBe(true);
  });
});

// Story 8 UI: city field autocomplete is activated as a ProfileScreen
// component test in tests/routine-engine/city-field.test.tsx (FE-9 shipped
// the field; FE-7 shipped citySearch.ts) — kept out of this file since it
// needs @testing-library/react-native rendering.
describe('Story 8 UI/service (FE-7, not built yet)', () => {
  it.todo('opens the before/after Diff View transition screen on a mask threshold crossing, never a silent switch — FE-8 shipped no such screen (GenerateCard/OptimizeStrip/DraftPreviewSheet only); the resolved SeasonMask silently drives the next generate/validate call per the tech-design\'s render-time-projection principle');
});

describe('Story 8 AC (FE-7, shipped 2026-07-05): domain-level weather refresh cadence + fallback chain', () => {
  const CITY = { name: 'Warsaw, Poland', lat: 52.23, lon: 21.01 };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('caches exactly one weather request per 7 days once a city is set and the app is online', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn().mockResolvedValue(22);
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useProfileStore } = require('@/store/profileStore');
    const { useTrackingStore } = require('@/store/trackingStore');
    const { refreshSeasonMaskIfDue } = require('@/domain/seasonActions');

    useProfileStore.setState({
      profile: {
        id: 'p1', gender: null, age: null, skinType: null, phototype: null,
        fitzpatrick: null, city: CITY, concerns: [], spfSensitivity: false,
        onboardingCompleted: true, individualDurationMonths: {},
      },
      hydrated: true,
    });
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });

    const now = new Date('2026-07-04T12:00:00Z');
    await refreshSeasonMaskIfDue(now);
    expect(fetchWeeklyAverageTemperatureC).toHaveBeenCalledTimes(1);

    // A second call the SAME day (interval not elapsed) makes no new request.
    await refreshSeasonMaskIfDue(new Date('2026-07-04T18:00:00Z'));
    expect(fetchWeeklyAverageTemperatureC).toHaveBeenCalledTimes(1);

    // A week later, the interval has elapsed -> exactly one more request.
    await refreshSeasonMaskIfDue(new Date('2026-07-11T12:00:00Z'));
    expect(fetchWeeklyAverageTemperatureC).toHaveBeenCalledTimes(2);
  });

  it('applies the summer mask above +20C and the winter mask below +15C via the real refresh path', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn();
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useProfileStore } = require('@/store/profileStore');
    const { useTrackingStore } = require('@/store/trackingStore');
    const { refreshSeasonMaskIfDue } = require('@/domain/seasonActions');

    useProfileStore.setState({
      profile: {
        id: 'p1', gender: null, age: null, skinType: null, phototype: null,
        fitzpatrick: null, city: CITY, concerns: [], spfSensitivity: false,
        onboardingCompleted: true, individualDurationMonths: {},
      },
      hydrated: true,
    });

    // A January reading of 25C (warm) -> summer family, calendar (winter) disagrees -> 'summer'.
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });
    fetchWeeklyAverageTemperatureC.mockResolvedValueOnce(25);
    const summerMask = await refreshSeasonMaskIfDue(new Date('2026-01-04T12:00:00Z'));
    expect(summerMask).toEqual({ season: 'summer', source: 'weather' });

    // A July reading of 8C (cold) -> winter family.
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });
    fetchWeeklyAverageTemperatureC.mockResolvedValueOnce(8);
    const winterMask = await refreshSeasonMaskIfDue(new Date('2026-07-04T12:00:00Z'));
    expect(winterMask).toEqual({ season: 'winter', source: 'weather' });
  });

  it('retains the previous mask inside the 15-20C hysteresis band (no flapping)', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn();
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useProfileStore } = require('@/store/profileStore');
    const { useTrackingStore } = require('@/store/trackingStore');
    const { refreshSeasonMaskIfDue } = require('@/domain/seasonActions');

    useProfileStore.setState({
      profile: {
        id: 'p1', gender: null, age: null, skinType: null, phototype: null,
        fitzpatrick: null, city: CITY, concerns: [], spfSensitivity: false,
        onboardingCompleted: true, individualDurationMonths: {},
      },
      hydrated: true,
    });
    // Establish a 'summer' reading first.
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });
    fetchWeeklyAverageTemperatureC.mockResolvedValueOnce(25);
    await refreshSeasonMaskIfDue(new Date('2026-07-04T12:00:00Z'));

    // A week later a mid-band reading (18C) arrives -> retains 'summer', not recomputed from calendar.
    fetchWeeklyAverageTemperatureC.mockResolvedValueOnce(18);
    const mask = await refreshSeasonMaskIfDue(new Date('2026-07-11T12:00:00Z'));
    expect(mask).toEqual({ season: 'summer', source: 'weather' });
  });

  it('falls back silently to the calendar season with no city set (weather layer stays inert)', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn();
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useProfileStore } = require('@/store/profileStore');
    const { useTrackingStore } = require('@/store/trackingStore');
    const { refreshSeasonMaskIfDue } = require('@/domain/seasonActions');

    useProfileStore.setState({ profile: null, hydrated: true });
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });

    const mask = await refreshSeasonMaskIfDue(new Date('2026-07-04T12:00:00Z'));
    expect(mask).toEqual({ season: 'summer', source: 'calendar' });
    expect(fetchWeeklyAverageTemperatureC).not.toHaveBeenCalled();
  });

  it('falls back silently to the calendar season on a fetch failure, leaving the cache untouched', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn().mockResolvedValue(null); // the service's own contract: null on any failure
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useProfileStore } = require('@/store/profileStore');
    const { useTrackingStore } = require('@/store/trackingStore');
    const { refreshSeasonMaskIfDue } = require('@/domain/seasonActions');

    useProfileStore.setState({
      profile: {
        id: 'p1', gender: null, age: null, skinType: null, phototype: null,
        fitzpatrick: null, city: CITY, concerns: [], spfSensitivity: false,
        onboardingCompleted: true, individualDurationMonths: {},
      },
      hydrated: true,
    });
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null }, applicationStats: [], seasonMaskCache: null, hydrated: true });

    const mask = await refreshSeasonMaskIfDue(new Date('2026-07-04T12:00:00Z'));
    expect(mask).toEqual({ season: 'summer', source: 'calendar' });
    expect(useTrackingStore.getState().seasonMaskCache).toBeNull(); // untouched
  });

  it('falls back silently to the calendar season once the cache is more than 14 days stale', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () =>
      require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
    );
    const fetchWeeklyAverageTemperatureC = jest.fn();
    jest.doMock('@/services/weather', () => ({ fetchWeeklyAverageTemperatureC }));

    const { useTrackingStore } = require('@/store/trackingStore');
    const { getActiveSeasonMask } = require('@/domain/seasonActions');

    // getActiveSeasonMask is the sync render-path resolver — no fetch involved,
    // just the staleness fallback over a stale weather cache.
    useTrackingStore.setState({
      cycleState: { cyclePhaseIndex: 0, lastAppliedDate: null },
      applicationStats: [],
      seasonMaskCache: { mask: { season: 'winter', source: 'weather' }, fetchedAt: '2026-06-01' },
      hydrated: true,
    });

    const mask = getActiveSeasonMask(new Date('2026-07-04T12:00:00Z')); // 33 days stale
    expect(mask).toEqual({ season: 'summer', source: 'calendar' });
  });
});
