/** تیپ‌های دامنه‌ای موتور ارزیابی، طبقه‌بندی و محاسبات مزد */

import type { ValidityStatus } from './status.ts';

export type ScoringMechanism =
  | 'SINGLE_DEGREE'
  | 'MATRIX_2D'
  | 'SUPERVISION_COMPOSITE'
  | 'DOMINANT_ACTIVITY_ROW'
  | 'MULTI_ITEM_SUM_CAPPED'
  | 'INJURY_PLUS_DISEASE_CAPPED'
  | 'WORKSHOP_SCHEME_DEFINED'
  | 'DISABLED_PENDING_OFFICIAL_TABLE';

export type ApprovalStatus =
  | 'DRAFT'
  | 'PENDING_COMMITTEE_APPROVAL'
  | 'COMMITTEE_APPROVED'
  | 'MINISTRY_APPROVED'
  | 'REJECTED';

export interface EvaluationFactorRow {
  id: number;
  system_id: number;
  factor_code: string;
  name: string;
  display_order: number;
  max_score: number | null;
  official_weight_pct: number | null;
  definition: string;
  validity_status: ValidityStatus;
}

export interface EvaluationSubFactorRow {
  id: number;
  factor_id: number;
  sub_factor_code: string;
  name: string;
  display_order: number;
  max_score: number | null;
  official_weight_pct: number | null;
  scoring_mechanism: ScoringMechanism;
  scoring_enabled: number;
  definition: string;
  application_rule: string | null;
  validity_status: ValidityStatus;
}

export interface EvaluationLevelRow {
  id: number;
  sub_factor_id: number;
  level_code: string;
  level_number: number;
  title: string;
  secondary_dimension_code: string;
  secondary_dimension_title: string | null;
  criteria_description: string | null;
  tvto_hours_equivalent: number | null;
  validity_status: ValidityStatus;
}

export interface EvaluationScoreRow {
  id: number;
  level_id: number;
  version: string;
  effective_from: string;
  effective_to: string | null;
  points: number;
  formula_rule_json: string | null;
  validity_status: ValidityStatus;
}

export interface SubFactorScoreDetail {
  subFactorCode: string;
  subFactorName: string;
  factorCode: string;
  factorName: string;
  points: number;
  maxScore: number | null;
  officialWeightPct: number | null;
  selectionKind: string;
  selectionDescription: string;
  scoringMechanism: ScoringMechanism;
  subFactorValidityStatus: ValidityStatus;
  pointsValidityStatus: ValidityStatus;
  warnings: string[];
  details?: Record<string, unknown>;
}

export interface FactorScoreDetail {
  factorCode: string;
  factorName: string;
  points: number;
  maxScore: number | null;
  officialWeightPct: number | null;
  achievedWeightPct: number | null;
}

export interface PointEvaluationResult {
  systemCode: string;
  systemVersion: string;
  evaluationDate: string;
  currencyUnit: 'IRR';
  totalScore: number;
  maxTheoreticalScore: number;
  factorScores: FactorScoreDetail[];
  subFactorScores: SubFactorScoreDetail[];
  warnings: string[];
  scoringComplete: boolean;
  unscoredSubFactors: string[];
}

export interface GroupRangeRow {
  id: number;
  system_id: number;
  scheme_code: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  group_number: number;
  min_score: number;
  max_score: number;
  ceiling_score_xn: number;
  excess_over_g1_bn: number;
  consecutive_diff_delta: number;
  validity_status: ValidityStatus;
}

export interface GroupMatchResult {
  matched: boolean;
  group: number | null;
  range: GroupRangeRow | null;
  tableVersion: string | null;
  candidates: GroupRangeRow[];
  warnings: string[];
}

export interface JobProfileInput {
  workshopCode: string;
  jobCode: string;
  jobTitle: string;
  organizationalUnit: string;
  jobObjective: string;
  duties: string;
  responsibilities: string;
  authorities: string;
  qualificationRequirements: string;
  requiredEducation: string;
  requiredExperienceYears: number;
  requiredSkills: string;
  workingConditions: string;
  parentSupervisorJobCode?: string | null;
  version?: string;
}

export interface JobEvaluationRequest {
  jobProfileId: number;
  systemCode: string;
  schemeCode: string;
  evaluationDate: string;
  pointBasedSelections?: PointBasedSelection[];
  systemASelections?: SystemASelection[];
  groupTableVersion?: string;
  createdBy?: string;
}

export interface JobEvaluationOutcome {
  evaluationId: number;
  jobProfileId: number;
  totalScore: number;
  proposedGroup: number | null;
  tableMatch: GroupMatchResult;
  approvalStatus: ApprovalStatus;
  finalConfirmedGroup: number | null;
  rationale: string[];
  expertWarnings: string[];
  factorScores: FactorScoreDetail[];
  subFactorScores: SubFactorScoreDetail[];
}

/** انتخاب‌های ورودی امتیازدهی نظام امتیازی (سیستم B) */
export type PointBasedSelection =
  | { subFactorCode: string; kind: 'LEVEL'; levelCode: string; secondaryDimensionCode?: string }
  | { subFactorCode: string; kind: 'MATRIX'; levelCode: string; secondaryDimensionCode: string }
  | {
      subFactorCode: string;
      kind: 'SUPERVISION';
      directHeadcountByGrade: Record<string, number>;
      indirectHeadcount: number;
    }
  | { subFactorCode: string; kind: 'DOMINANT_ROW'; levelCode: string; hoursBracketCode: string }
  | {
      subFactorCode: string;
      kind: 'ENV_ITEMS';
      items: Array<{ itemCode: string; intensityCode: 'MODERATE' | 'HIGH' | 'SEVERE'; hoursBracketCode: string }>;
    }
    | {
      subFactorCode: string;
      kind: 'HAZARD';
      injuryLevelCode?: string;
      injuryProbabilityCode?: 'LOW' | 'MEDIUM' | 'HIGH';
      diseaseProbabilityCode?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    };

/** انتخاب‌های ورودی امتیازدهی نظام جدید (سیستم A) — مستلزم بارگذاری طرح مصوب کارگاه */
export interface SystemASelection {
  subFactorCode: string;
  levelCode: string;
  secondaryDimensionCode?: string;
}

export interface WageParameters {
  id: number;
  fiscal_year: number;
  version: string;
  effective_from: string;
  effective_to: string | null;
  min_daily_wage: number;
  other_levels_increase_pct: number;
  other_levels_fixed_daily: number;
  base_daily_seniority_g1: number;
  grocery_allowance_monthly: number;
  housing_allowance_monthly: number;
  housing_legal_status: string;
  marital_allowance_monthly: number;
  child_allowance_multiplier: number;
  normal_daily_hours_divisor: number;
  overtime_multiplier: number;
  shift_2_pct: number;
  shift_3_pct: number;
  shift_day_night_pct: number;
  night_work_pct: number;
  worker_insurance_pct: number;
  employer_insurance_pct: number;
  unemployment_insurance_pct: number;
  insurable_daily_ceiling: number | null;
  tax_brackets_json: string | null;
  validity_status: ValidityStatus;
}

export interface EmployeeWageInput {
  employeeCode?: string;
  fullName?: string;
  jobGroup: number;
  schemeCode: string;
  fiscalYear?: number;
  computationDate?: string;
  /** دوره محاسبه به قالب `YYYY-MM` (پیش‌فرض: 1405-01) */
  periodYearMonth?: string;
  /** نسخه پارامترهای سالانه؛ در صورت عدم تعیین، آخرین نسخه معتبر تا تاریخ محاسبه انتخاب می‌شود */
  parameterVersion?: string;
  payableDays?: number;
  /** مزد شغل روزانه سال قبل (۱۴۰۴) — مبنای فرمول ماده ۱ دستورالعمل ۶۷۲۴ */
  priorDailyJobWage?: number;
  /** سنوات تجمیعی روزانه تا پایان ۱۴۰۴ */
  priorAccumulatedDailySeniority?: number;
  /** مزد رتبه روزانه برقرار تا پایان ۱۴۰۴ (مشمول ۴۵٪) */
  priorDailyRankWage?: number;
  /** سایر اجزای مزدی برقرار تا پایان ۱۴۰۴ (مشمول ۴۵٪) */
  priorOtherFixedDailyWage?: number;
  /** سال‌های سابقه در کارگاه (برای احراز استحقاق پایه سنوات) */
  serviceYearsInWorkshop?: number;
  isMarried?: boolean;
  eligibleChildrenCount?: number;
  otherWageAllowancesMonthly?: number;
  overtimeHours?: number;
  nightWorkHours?: number;
  shiftType?: 'NONE' | 'MORNING_EVENING' | 'MORNING_EVENING_NIGHT' | 'DAY_NIGHT' | 'ROTATING_24_7';
  /** منبع مزد شغل: جدول مزد مصوب طرح یا فرمول قانونی یا خودکار (حداکثر) */
  wageSource?: 'TABLE' | 'FORMULA' | 'AUTO';
  includeWelfareBenefits?: boolean;
  /** واحد پولی مبالغ ورودی کاربر (پیش‌فرض: ریال) */
  inputCurrency?: 'IRR' | 'TOMAN';
  /** مزایای متغیر ماهانه (فوق‌العاده‌های خارج از طرح) */
  variableBenefitsMonthly?: number;
}

export interface WageBreakdownLine {
  code: string;
  title: string;
  category: 'JOB_WAGE' | 'SENIORITY' | 'BASE_WAGE' | 'WAGE_ALLOWANCE' | 'WELFARE' | 'STATUTORY' | 'DEDUCTION';
  dailyAmount?: number;
  monthlyAmount: number;
  formulaCode: string;
  legalBasis: string;
  note?: string;
}

export interface WageComputationResult {
  employeeCode: string | null;
  fiscalYear: number;
  periodYearMonth: string;
  computationDate: string;
  currencyUnit: 'IRR';
  parameterVersion: string;
  schemeCode: string;
  jobGroup: number;
  payableDays: number;
  dailyJobWage: number;
  dailySeniorityWage: number;
  dailyRankWage: number;
  dailyOtherBaseElements: number;
  dailyBaseWage: number;
  monthlyJobWage: number;
  monthlySeniorityWage: number;
  monthlyBaseWage: number;
  overtimePay: number;
  shiftPay: number;
  nightWorkPay: number;
  otherWageAllowances: number;
  wageSubtotal: number;
  groceryAllowance: number;
  housingAllowance: number;
  maritalAllowance: number;
  childAllowance: number;
  welfareSubtotal: number;
  grossTotal: number;
  workerInsurance: number;
  employerInsurance: number;
  tax: number;
  netPayable: number;
  breakdown: WageBreakdownLine[];
  warnings: string[];
  minimumWageCompliance: { compliant: boolean; minimumDailyWage: number; difference: number };
}

export interface ArrearsPeriodInput {
  periodYearMonth: string;
  payableDays: number;
  entitledDailyWage: number;
  paidDailyWage: number;
  entitledVariableBenefits?: number;
  paidVariableBenefits?: number;
  includeVariableConsequences?: boolean;
}

export interface ArrearsResult {
  currencyUnit: 'IRR';
  periods: Array<{
    periodYearMonth: string;
    payableDays: number;
    entitledDailyWage: number;
    paidDailyWage: number;
    dailyDifference: number;
    dailyArrears: number;
    monthlyArrears: number;
    variableArrears: number;
    totalArrears: number;
    cappedAtZero: boolean;
  }>;
  totalArrears: number;
  totalDailyArrears: number;
  adaptationRetentionDaily: number;
  warnings: string[];
}
