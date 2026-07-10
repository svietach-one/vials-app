/**
 * Routine engine public surface (tech-design §2 module contracts). Screens,
 * hooks, and domain actions import from here; the stage modules behind it
 * (facts → context → eligibility → slotting → resolve → mandates) are
 * engine-internal.
 */
export { generatePlan, type EngineInput, type RoutinePlan } from './generate';
export {
  validateRoutines,
  type PlanDiffEntry,
  type ValidationFinding,
  type ValidationResult,
} from './validate';
export { findSubstitute, type SubstituteResult } from './substitute';
export {
  getDailyView,
  type DailyRoutineView,
  type DailyViewInput,
  type FrozenStepView,
} from './dailyView';
export type {
  DecisionLogEntry,
  FrozenItem,
  PlaceholderSlot,
  PlannedStep,
} from './planTypes';
export { buildRehabWidgetState, applyRehabFilter, getRehabDays } from './rehabFilter';
export { migrateProfile, migrateProducts, migrateRoutines } from './migrations';
export {
  CYCLE_PHASES,
  INITIAL_CYCLE_STATE,
  checkInCycle,
  getCyclePhaseForTonight,
  isCheckedInToday,
  type CyclePhase,
} from './cycleState';
export {
  collectAdaptationLimits,
  getAdaptationStatus,
  virtualApplicationCount,
  type AdaptationStatus,
} from './adaptation';
export {
  buildWeatherSeasonMask,
  deriveSeasonFromTemperature,
  isCacheUsable,
  isWeatherCheckDue,
  resolveSeasonMask,
  type SeasonMaskCache,
} from './seasonMask';
