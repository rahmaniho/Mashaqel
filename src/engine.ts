/**
 * MashaqelEngine — دروازه یکپارچه موتور ارزیابی، طبقه‌بندی مشاغل و محاسبات مزد و معوقات.
 * تمام مبالغ به ریال ایران (IRR) است.
 */

import type { DatabaseSync } from 'node:sqlite';
import { createDatabase, applyMigrations } from './db/database.ts';
import { Db } from './db/query.ts';
import { seedAll } from './db/seed/index.ts';
import { PointBasedEvaluator, type PointBasedEvaluationInput } from './services/pointBasedEvaluator.ts';
import { SystemAEvaluator, type SystemAEvaluationInput } from './services/systemAEvaluator.ts';
import { matchGroup, listGroupTables, type GroupMatchInput } from './services/groupMatcher.ts';
import { WageEngine, type WageEngine as WageEngineType } from './services/wageEngine.ts';
import { computeArrears, type ArrearsInput } from './services/arrearsEngine.ts';
import { JobProfileService } from './services/jobProfileService.ts';
import { loadWorkshopApprovedScheme, type WorkshopSchemeInput } from './services/workshopSchemeService.ts';
import { recordHistory, listHistory } from './services/historyService.ts';
import { getGroupSeniorityRate, getCumulativeSeniority } from './services/seniorityService.ts';
import type {
  ArrearsResult,
  EmployeeWageInput,
  GroupMatchResult,
  JobEvaluationOutcome,
  JobEvaluationRequest,
  JobProfileInput,
  PointEvaluationResult,
  WageComputationResult,
} from './core/types.ts';
import type { ValidityStatus } from './core/status.ts';

export interface EngineOpenOptions {
  /** مسیر فایل دیتابیس؛ پیش‌فرض حافظه موقت */
  file?: string;
  /** اجرای مهاجرت‌ها و بذرهای رسمی (پیش‌فرض: بله) */
  seed?: boolean;
}

export interface FormulaVersionRow {
  id: number;
  formula_code: string;
  formula_name: string;
  calculation_description: string;
  expression_spec: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  currency_unit: string;
  legal_source: string;
  circular_number: string | null;
  validity_status: ValidityStatus;
  last_modified_at: string;
}

export class MashaqelEngine {
  readonly db: Db;
  readonly wageEngine: WageEngine;
  readonly profiles: JobProfileService;
  private readonly pointBasedEvaluator: PointBasedEvaluator;
  private readonly systemAEvaluator: SystemAEvaluator;

  readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync, options: { seed?: boolean } = {}) {
    this.rawDb = rawDb;
    this.db = new Db(rawDb);
    applyMigrations(rawDb);
    if (options.seed !== false) seedAll(this.db);
    this.wageEngine = new WageEngine(this.db);
    this.profiles = new JobProfileService(this.db);
    this.pointBasedEvaluator = new PointBasedEvaluator(this.db);
    this.systemAEvaluator = new SystemAEvaluator(this.db);
  }

  static open(options: EngineOpenOptions = {}): MashaqelEngine {
    const raw = createDatabase(options.file ?? ':memory:');
    return new MashaqelEngine(raw, { seed: options.seed });
  }

  close(): void {
    this.rawDb.close();
  }

  /* ------------------------------- ارزیابی مشاغل ------------------------------ */

  evaluatePointBased(input: PointBasedEvaluationInput): PointEvaluationResult {
    const result = this.pointBasedEvaluator.evaluate(input);
    recordHistory(this.db, {
      operationType: 'POINT_BASED_EVALUATION',
      entityType: 'evaluation',
      entityId: null,
      formulaCode: 'FRM-EVAL-B-TOTAL',
      formulaVersion: result.systemVersion,
      input,
      appliedTables: { scoreVersion: result.systemVersion, evaluationDate: result.evaluationDate },
      output: { totalScore: result.totalScore, scoringComplete: result.scoringComplete },
    });
    return result;
  }

  evaluateSystemA(input: SystemAEvaluationInput): PointEvaluationResult {
    return this.systemAEvaluator.evaluate(input);
  }

  isSystemASchemeLoaded(systemCode: string, version?: string): boolean {
    return this.systemAEvaluator.isSchemeLoaded(systemCode, version);
  }

  loadWorkshopScheme(input: WorkshopSchemeInput) {
    return loadWorkshopApprovedScheme(this.db, input);
  }

  /* --------------------------------- گروه‌بندی -------------------------------- */

  matchGroup(input: GroupMatchInput): GroupMatchResult {
    return matchGroup(this.db, input);
  }

  listGroupTables(schemeCode?: string) {
    return listGroupTables(this.db, schemeCode);
  }

  /* ---------------------------------- سنوات --------------------------------- */

  seniorityRate(params: { schemeCode: string; group: number; fiscalYear: number; asOfDate: string }) {
    return getGroupSeniorityRate(this.db, params);
  }

  cumulativeSeniority(params: { schemeCode: string; yearsOfService: number; asOfDate: string; baseFiscalYear?: number }) {
    return getCumulativeSeniority(this.db, params);
  }

  /* ---------------------------------- مزد ----------------------------------- */

  computeWage(input: EmployeeWageInput): WageComputationResult {
    const result = this.wageEngine.computeWage(input);
    recordHistory(this.db, {
      operationType: 'WAGE_COMPUTATION',
      entityType: 'wage_calculation',
      entityId: null,
      formulaCode: 'FRM-JOB-WAGE-1405',
      formulaVersion: result.parameterVersion,
      input,
      appliedTables: {
        parameterVersion: result.parameterVersion,
        schemeCode: result.schemeCode,
        jobGroup: result.jobGroup,
      },
      output: {
        dailyJobWage: result.dailyJobWage,
        dailyBaseWage: result.dailyBaseWage,
        grossTotal: result.grossTotal,
        netPayable: result.netPayable,
      },
    });
    return result;
  }

  /** ذخیره نتیجه محاسبه در جدول wage_calculations */
  saveWageCalculation(result: WageComputationResult, employeeId: number | null = null): number {
    const insert = this.db.run(
      `INSERT INTO wage_calculations (
         employee_id, calculation_type, fiscal_year, period_year_month, calculation_date,
         parameter_version, wage_table_version, seniority_table_version, currency_unit, payable_days,
         daily_job_wage, daily_seniority_wage, daily_rank_wage, daily_other_base_elements,
         daily_adaptation_diff, daily_base_wage, monthly_job_wage, monthly_seniority_wage, monthly_base_wage,
         overtime_pay, shift_pay, night_work_pay, other_wage_allowances,
         grocery_allowance, housing_allowance, marital_allowance, child_allowance,
         gross_total, worker_insurance_deduction, employer_insurance_contribution, tax_deduction,
         net_payable, breakdown_json, warnings_json
       ) VALUES (?, 'MONTHLY_PAYROLL', ?, ?, ?, ?, NULL, NULL, 'IRR', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      employeeId,
      result.fiscalYear,
      result.periodYearMonth,
      result.computationDate,
      result.parameterVersion,
      result.payableDays,
      result.dailyJobWage,
      result.dailySeniorityWage,
      result.dailyRankWage,
      result.dailyOtherBaseElements,
      result.dailyBaseWage,
      result.monthlyJobWage,
      result.monthlySeniorityWage,
      result.monthlyBaseWage,
      result.overtimePay,
      result.shiftPay,
      result.nightWorkPay,
      result.otherWageAllowances,
      result.groceryAllowance,
      result.housingAllowance,
      result.maritalAllowance,
      result.childAllowance,
      result.grossTotal,
      result.workerInsurance,
      result.employerInsurance,
      result.tax,
      result.netPayable,
      JSON.stringify(result.breakdown),
      JSON.stringify(result.warnings),
    );
    return insert.lastInsertRowid;
  }

  computeArrears(input: ArrearsInput): ArrearsResult {
    const result = computeArrears(input);
    recordHistory(this.db, {
      operationType: 'ARREARS_COMPUTATION',
      entityType: 'arrears',
      entityId: null,
      formulaCode: 'FRM-ARREARS',
      formulaVersion: '1.0.0',
      input,
      appliedTables: { periods: result.periods.length },
      output: { totalArrears: result.totalArrears },
    });
    return result;
  }

  /* --------------------------------- شناسنامه -------------------------------- */

  createJobProfile(input: JobProfileInput): number {
    return this.profiles.createProfile(input);
  }

  evaluateJobProfile(request: JobEvaluationRequest): JobEvaluationOutcome {
    return this.profiles.evaluateJob(request);
  }

  approveEvaluation(params: Parameters<JobProfileService['approve']>[0]) {
    return this.profiles.approve(params);
  }

  /* ---------------------------------- دیگر ---------------------------------- */

  listFormulaVersions(formulaCode?: string): FormulaVersionRow[] {
    return formulaCode
      ? this.db.all<FormulaVersionRow>('SELECT * FROM formula_versions WHERE formula_code = ? ORDER BY version', formulaCode)
      : this.db.all<FormulaVersionRow>('SELECT * FROM formula_versions ORDER BY formula_code, version');
  }

  listParameterVersions(fiscalYear = 1405) {
    return this.db.all<{
      id: number;
      fiscal_year: number;
      version: string;
      effective_from: string;
      effective_to: string | null;
      min_daily_wage: number;
      housing_allowance_monthly: number;
      validity_status: ValidityStatus;
    }>(
      `SELECT id, fiscal_year, version, effective_from, effective_to, min_daily_wage,
              housing_allowance_monthly, validity_status
       FROM annual_labor_parameters WHERE fiscal_year = ? ORDER BY effective_from, id`,
      fiscalYear,
    );
  }

  history(entityType: string, entityId?: number) {
    return listHistory(this.db, entityType, entityId);
  }
}

export type { WageEngineType };
