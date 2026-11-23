/**
 * تولید داده استاتیک وب‌اپ از دیتابیس موتور.
 * خروجی: web/data/mashaqel-data.json — تمام جدول‌های لازم برای محاسبات سمت مرورگر.
 * اجرا: npm run export:web
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MashaqelEngine } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outputPath = join(root, 'web', 'data', 'mashaqel-data.json');

const engine = MashaqelEngine.open();
const db = engine.db;

const legalDocuments = db
  .all<Record<string, unknown>>('SELECT * FROM legal_documents ORDER BY id')
  .map((row) => ({
    code: row.doc_code,
    title: row.title,
    authority: row.issuing_authority,
    circularNumber: row.circular_number,
    approvalDate: row.approval_date_jalali,
    effectiveFrom: row.effective_from,
    docType: row.doc_type,
    status: row.validity_status,
    notes: row.summary_notes,
  }));

const formulaVersions = db
  .all<Record<string, unknown>>('SELECT * FROM formula_versions ORDER BY formula_code, version')
  .map((row) => ({
    code: row.formula_code,
    name: row.formula_name,
    version: row.version,
    description: row.calculation_description,
    expression: row.expression_spec,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    currency: row.currency_unit,
    legalSource: row.legal_source,
    circularNumber: row.circular_number,
    status: row.validity_status,
  }));

const systems = db.all<Record<string, unknown>>('SELECT * FROM evaluation_systems ORDER BY id').map((row) => ({
  id: row.id,
  code: row.system_code,
  version: row.version,
  name: row.name,
  legalBasis: row.legal_basis,
  circularNumber: row.circular_number,
  approvalDate: row.approval_date_jalali,
  effectiveFrom: row.effective_from,
  scoringMode: row.scoring_mode,
  maxTheoreticalScore: row.max_theoretical_score,
  requiresWorkshopTables: row.requires_workshop_tables,
  validityStatus: row.validity_status,
  description: row.description,
}));

const factors = db
  .all<Record<string, unknown>>(
    `SELECT f.*, s.system_code AS systemCode FROM evaluation_factors f
     JOIN evaluation_systems s ON s.id = f.system_id ORDER BY f.system_id, f.display_order`,
  )
  .map((row) => ({
    id: row.id,
    systemId: row.system_id,
    systemCode: row.systemCode,
    code: row.factor_code,
    name: row.name,
    displayOrder: row.display_order,
    maxScore: row.max_score,
    officialWeightPct: row.official_weight_pct,
    definition: row.definition,
    validityStatus: row.validity_status,
  }));

const subFactors = db
  .all<Record<string, unknown>>(
    `SELECT sf.*, f.factor_code AS factorCode, f.name AS factorName
     FROM evaluation_sub_factors sf
     JOIN evaluation_factors f ON f.id = sf.factor_id
     ORDER BY f.system_id, sf.display_order`,
  )
  .map((row) => ({
    id: row.id,
    factorId: row.factor_id,
    factorCode: row.factorCode,
    factorName: row.factorName,
    code: row.sub_factor_code,
    name: row.name,
    displayOrder: row.display_order,
    maxScore: row.max_score,
    officialWeightPct: row.official_weight_pct,
    scoringMechanism: row.scoring_mechanism,
    scoringEnabled: row.scoring_enabled,
    definition: row.definition,
    applicationRule: row.application_rule,
    validityStatus: row.validity_status,
  }));

const levels = db.all<Record<string, unknown>>('SELECT * FROM evaluation_levels ORDER BY sub_factor_id, level_number').map((row) => ({
  id: row.id,
  subFactorId: row.sub_factor_id,
  levelCode: row.level_code,
  levelNumber: row.level_number,
  title: row.title,
  secondaryDimensionCode: row.secondary_dimension_code,
  secondaryDimensionTitle: row.secondary_dimension_title,
  criteria: row.criteria_description,
  tvtoHoursEquivalent: row.tvto_hours_equivalent,
  validityStatus: row.validity_status,
}));

const scores = db.all<Record<string, unknown>>('SELECT * FROM evaluation_scores ORDER BY level_id').map((row) => ({
  levelId: row.level_id,
  version: row.version,
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  points: row.points,
  rule: row.formula_rule_json,
  validityStatus: row.validity_status,
}));

const groupRanges = db
  .all<Record<string, unknown>>('SELECT * FROM group_score_ranges ORDER BY scheme_code, version, group_number')
  .map((row) => ({
    schemeCode: row.scheme_code,
    version: row.version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    groupNumber: row.group_number,
    minScore: row.min_score,
    maxScore: row.max_score,
    ceilingScoreXn: row.ceiling_score_xn,
    excessOverG1Bn: row.excess_over_g1_bn,
    consecutiveDiffDelta: row.consecutive_diff_delta,
    validityStatus: row.validity_status,
  }));

const wageTables = db
  .all<Record<string, unknown>>('SELECT * FROM wage_tables ORDER BY scheme_code, fiscal_year, group_number')
  .map((row) => ({
    schemeCode: row.scheme_code,
    schemeTitle: row.scheme_title,
    fiscalYear: row.fiscal_year,
    version: row.version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    baseFloorDailyWage: row.base_floor_daily_wage,
    rialCoefficientA: row.rial_coefficient_a,
    hasRankingSystem: row.has_ranking_system,
    groupNumber: row.group_number,
    dailyJobWage: row.daily_job_wage,
    validityStatus: row.validity_status,
  }));

const seniorityTables = db
  .all<Record<string, unknown>>('SELECT * FROM seniority_tables ORDER BY scheme_code, table_type, group_number, years_of_service')
  .map((row) => ({
    schemeCode: row.scheme_code,
    tableType: row.table_type,
    fiscalYear: row.fiscal_year,
    version: row.version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    groupNumber: row.group_number,
    yearsOfService: row.years_of_service,
    dailySeniorityAmount: row.daily_seniority_amount,
    validityStatus: row.validity_status,
  }));

const annualParameters = db
  .all<Record<string, unknown>>('SELECT * FROM annual_labor_parameters ORDER BY fiscal_year, id')
  .map((row) => ({
    fiscalYear: row.fiscal_year,
    version: row.version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    minDailyWage: row.min_daily_wage,
    otherLevelsIncreasePct: row.other_levels_increase_pct,
    otherLevelsFixedDaily: row.other_levels_fixed_daily,
    baseDailySeniorityG1: row.base_daily_seniority_g1,
    groceryAllowanceMonthly: row.grocery_allowance_monthly,
    housingAllowanceMonthly: row.housing_allowance_monthly,
    housingLegalStatus: row.housing_legal_status,
    maritalAllowanceMonthly: row.marital_allowance_monthly,
    childAllowanceMultiplier: row.child_allowance_multiplier,
    normalDailyHoursDivisor: row.normal_daily_hours_divisor,
    overtimeMultiplier: row.overtime_multiplier,
    shift2Pct: row.shift_2_pct,
    shift3Pct: row.shift_3_pct,
    shiftDayNightPct: row.shift_day_night_pct,
    nightWorkPct: row.night_work_pct,
    workerInsurancePct: row.worker_insurance_pct,
    employerInsurancePct: row.employer_insurance_pct,
    unemploymentInsurancePct: row.unemployment_insurance_pct,
    taxBrackets: row.tax_brackets_json,
    validityStatus: row.validity_status,
  }));

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    engineVersion: '1.0.0',
    currency: 'IRR',
    source: 'MashaqelEngine (node:sqlite)',
  },
  legalDocuments,
  formulaVersions,
  systems,
  factors,
  subFactors,
  levels,
  scores,
  groupRanges,
  wageTables,
  seniorityTables,
  annualParameters,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
engine.close();

const sizeKb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
console.log(`داده وب‌اپ تولید شد: ${outputPath} (${sizeKb} کیلوبایت)`);
console.log(
  `شامل ${levels.length} سطح، ${scores.length} امتیاز، ${groupRanges.length} بازه گروه، ` +
    `${wageTables.length} ردیف جدول مزد، ${seniorityTables.length} ردیف سنوات، ${formulaVersions.length} فرمول.`,
);
