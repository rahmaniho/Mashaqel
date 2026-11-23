/**
 * نقطه ورود عمومی بسته موتور طبقه‌بندی مشاغل و محاسبات مزد ایران.
 *
 * @example
 * import { MashaqelEngine } from './src/index.ts';
 * const engine = MashaqelEngine.open();
 * const wage = engine.computeWage({ schemeCode: 'SERVICE_COMPANIES_NATIONWIDE', jobGroup: 5, priorDailyJobWage: 3_491_031, ... });
 */

export { MashaqelEngine } from './engine.ts';
export type { EngineOpenOptions, FormulaVersionRow } from './engine.ts';

export { PointBasedEvaluator } from './services/pointBasedEvaluator.ts';
export type { PointBasedEvaluationInput } from './services/pointBasedEvaluator.ts';
export { SystemAEvaluator } from './services/systemAEvaluator.ts';
export type { SystemAEvaluationInput } from './services/systemAEvaluator.ts';
export { WageEngine, loadParameters, findWageTable, computeRankDailyWage, computeTaxFromBrackets } from './services/wageEngine.ts';
export { computeArrears } from './services/arrearsEngine.ts';
export type { ArrearsInput } from './services/arrearsEngine.ts';
export { JobProfileService } from './services/jobProfileService.ts';
export { matchGroup, listGroupTables, resolveGroupTableVersion } from './services/groupMatcher.ts';
export {
  getGroupSeniorityRate,
  getCumulativeSeniority,
  computeDailySeniority,
} from './services/seniorityService.ts';
export { loadWorkshopApprovedScheme } from './services/workshopSchemeService.ts';
export type { WorkshopSchemeInput } from './services/workshopSchemeService.ts';
export { recordHistory, listHistory } from './services/historyService.ts';
export { createDatabase, applyMigrations, MIGRATIONS } from './db/database.ts';
export { Db } from './db/query.ts';
export { seedAll } from './db/seed/index.ts';

export * from './core/types.ts';
export {
  VALIDITY_STATUS,
  VALIDITY_STATUS_LABELS,
  ERROR_CODES,
  MashaqelError,
  SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
  WORKSHOP_SCHEME_REQUIRED_MESSAGE,
  SUB_FACTOR_TABLE_MISSING_MESSAGE,
} from './core/status.ts';
export type { ValidityStatus } from './core/status.ts';
export {
  toIrr,
  toToman,
  roundMoney,
  guardReferenceAmount,
  detectTomanSuspicion,
  assertCurrencyUnit,
  formatIrr,
  IRR_PER_TOMAN,
} from './core/currency.ts';
export {
  normalizeJalaliDate,
  formatJalaliDate,
  jalaliToIso,
  isoToJalali,
  isLeapJalaliYear,
  daysInYearMonth,
  enumerateYearMonths,
} from './core/jalali.ts';
export {
  educationShortageDeductionYears,
  educationGroupBounds,
  tvtoHoursToScore,
  tvtoHoursToExperienceYears,
  supervisionHierarchyCheck,
  countEligibleRanks,
  rankDailyWage,
  computeRialCoefficient,
  EDUCATION_SHORTAGE_DEDUCTION,
  EDUCATION_YEARS,
} from './core/legalRules.ts';
export type { EducationCategory, RequiredEducationColumn } from './core/legalRules.ts';
