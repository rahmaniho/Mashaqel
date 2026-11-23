/**
 * بذر پارامترهای سالانه قانون کار ۱۴۰۵ — نسخه‌بندی‌شده و مستقل از مزد شغل و مزد مبنا.
 * نسخه 1405-v1: کمک‌هزینه مسکن ۹٬۰۰۰٬۰۰۰ ریال (رقم جاری پیش از مصوبه اردیبهشت ۱۴۰۵) — وضعیت ۲
 * نسخه 1405-v2: کمک‌هزینه مسکن ۳۰٬۰۰۰٬۰۰۰ ریال (تصویب‌نامه ۹۲۳۴ مورخ ۱۴۰۵/۰۲/۱۵) — وضعیت ۱
 */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';
import { getLegalDocumentId } from './legalDocuments.ts';

export const PARAMETER_VERSION_V1 = '1405-v1';
export const PARAMETER_VERSION_V2 = '1405-v2';

export interface AnnualParameterSeed {
  fiscalYear: number;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  minDailyWage: number;
  otherLevelsIncreasePct: number;
  otherLevelsFixedDaily: number;
  baseDailySeniorityG1: number;
  groceryAllowanceMonthly: number;
  housingAllowanceMonthly: number;
  housingLegalStatus: string;
  maritalAllowanceMonthly: number;
  childAllowanceMultiplier: number;
  normalDailyHoursDivisor: number;
  overtimeMultiplier: number;
  shift2Pct: number;
  shift3Pct: number;
  shiftDayNightPct: number;
  nightWorkPct: number;
  workerInsurancePct: number;
  employerInsurancePct: number;
  unemploymentInsurancePct: number;
  insurableDailyCeiling: number | null;
  taxBracketsJson: string | null;
  legalDocumentCode: string;
  validityStatus: string;
}

export const ANNUAL_PARAMETERS_1405: AnnualParameterSeed[] = [
  {
    fiscalYear: 1405,
    version: PARAMETER_VERSION_V1,
    effectiveFrom: '1405-01-01',
    effectiveTo: '1405-12-29',
    minDailyWage: 5_541_850,
    otherLevelsIncreasePct: 45,
    otherLevelsFixedDaily: 519_549,
    baseDailySeniorityG1: 166_667,
    groceryAllowanceMonthly: 22_000_000,
    housingAllowanceMonthly: 9_000_000,
    housingLegalStatus:
      'وضعیت ۲ — رقم ۹٬۰۰۰٬۰۰۰ ریال، مبنای جاری پیش از تصویب‌نامه شماره ۹۲۳۴ مورخ ۱۴۰۵/۰۲/۱۵ هیئت وزیران؛ برای محاسبات پیش از ابلاغ مصوبه جدید قابل استفاده است.',
    maritalAllowanceMonthly: 5_000_000,
    childAllowanceMultiplier: 3,
    normalDailyHoursDivisor: 7.33,
    overtimeMultiplier: 1.4,
    shift2Pct: 0.1,
    shift3Pct: 0.15,
    shiftDayNightPct: 0.225,
    nightWorkPct: 0.35,
    workerInsurancePct: 0.07,
    employerInsurancePct: 0.2,
    unemploymentInsurancePct: 0.03,
    insurableDailyCeiling: null,
    taxBracketsJson: null,
    legalDocumentCode: 'WAGE_CIRCULAR_1405_6682',
    validityStatus: VALIDITY_STATUS.EXTRACTED_NEEDS_VERIFICATION,
  },
  {
    fiscalYear: 1405,
    version: PARAMETER_VERSION_V2,
    effectiveFrom: '1405-01-01',
    effectiveTo: '1405-12-29',
    minDailyWage: 5_541_850,
    otherLevelsIncreasePct: 45,
    otherLevelsFixedDaily: 519_549,
    baseDailySeniorityG1: 166_667,
    groceryAllowanceMonthly: 22_000_000,
    housingAllowanceMonthly: 30_000_000,
    housingLegalStatus:
      'وضعیت ۱ — تصویب‌نامه شماره ۹۲۳۴ مورخ ۱۴۰۵/۰۲/۱۵ هیئت وزیران: کمک‌هزینه مسکن ۳۰٬۰۰۰٬۰۰۰ ریال ماهانه با اجرا از ۱۴۰۵/۰۱/۰۱.',
    maritalAllowanceMonthly: 5_000_000,
    childAllowanceMultiplier: 3,
    normalDailyHoursDivisor: 7.33,
    overtimeMultiplier: 1.4,
    shift2Pct: 0.1,
    shift3Pct: 0.15,
    shiftDayNightPct: 0.225,
    nightWorkPct: 0.35,
    workerInsurancePct: 0.07,
    employerInsurancePct: 0.2,
    unemploymentInsurancePct: 0.03,
    insurableDailyCeiling: null,
    taxBracketsJson: null,
    legalDocumentCode: 'CABINET_DECREE_9234_1405',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
  },
];

export function seedAnnualParameters(db: Db): void {
  const stmt = db.raw.prepare(`
    INSERT INTO annual_labor_parameters (
      fiscal_year, version, effective_from, effective_to, currency_unit, min_daily_wage,
      other_levels_increase_pct, other_levels_fixed_daily, base_daily_seniority_g1,
      grocery_allowance_monthly, housing_allowance_monthly, housing_legal_status,
      marital_allowance_monthly, child_allowance_multiplier, normal_daily_hours_divisor,
      overtime_multiplier, shift_2_pct, shift_3_pct, shift_day_night_pct, night_work_pct,
      worker_insurance_pct, employer_insurance_pct, unemployment_insurance_pct,
      insurable_daily_ceiling, tax_brackets_json, legal_document_id, validity_status
    ) VALUES (?, ?, ?, ?, 'IRR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fiscal_year, version) DO NOTHING
  `);
  for (const p of ANNUAL_PARAMETERS_1405) {
    stmt.run(
      p.fiscalYear,
      p.version,
      p.effectiveFrom,
      p.effectiveTo,
      p.minDailyWage,
      p.otherLevelsIncreasePct,
      p.otherLevelsFixedDaily,
      p.baseDailySeniorityG1,
      p.groceryAllowanceMonthly,
      p.housingAllowanceMonthly,
      p.housingLegalStatus,
      p.maritalAllowanceMonthly,
      p.childAllowanceMultiplier,
      p.normalDailyHoursDivisor,
      p.overtimeMultiplier,
      p.shift2Pct,
      p.shift3Pct,
      p.shiftDayNightPct,
      p.nightWorkPct,
      p.workerInsurancePct,
      p.employerInsurancePct,
      p.unemploymentInsurancePct,
      p.insurableDailyCeiling,
      p.taxBracketsJson,
      getLegalDocumentId(db, p.legalDocumentCode),
      p.validityStatus,
    );
  }
}
