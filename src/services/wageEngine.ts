/**
 * موتور محاسبه مزد سال ۱۴۰۵ (تمام مبالغ به ریال ایران — IRR)
 * مراجع قانونی:
 *  - ماده ۱ و تبصره‌های ۱ تا ۳ دستورالعمل ۶۷۲۴ مورخ ۱۴۰۵/۰۱/۳۱
 *  - بندهای ۱ تا ۴ بخشنامه ۶۶۸۲ مورخ ۱۴۰۵/۰۱/۳۱
 *  - مواد ۳۶، ۳۷، ۵۱، ۵۶، ۵۸ و ۵۹ قانون کار
 *  - ماده ۲۸ و ۸۶ قانون تأمین اجتماعی
 *  - تصویب‌نامه ۹۲۳۴ مورخ ۱۴۰۵/۰۲/۱۵ هیئت وزیران (کمک‌هزینه مسکن)
 */

import type { Db } from '../db/query.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import {
  ERROR_CODES,
  MashaqelError,
  VALIDITY_STATUS_LABELS,
  requiresExpertWarning,
  type ValidityStatus,
} from '../core/status.ts';
import {
  assertCurrencyUnit,
  detectTomanSuspicion,
  roundMoney,
  toIrr,
} from '../core/currency.ts';
import type { WageBreakdownLine, WageComputationResult, WageParameters } from '../core/types.ts';
import type { EmployeeWageInput } from '../core/types.ts';
import { computeDailySeniority, getGroupSeniorityRate } from './seniorityService.ts';

export const REFERENCE_MIN_DAILY_WAGE_1405 = 5_541_850;

interface WageTableRow {
  id: number;
  scheme_code: string;
  scheme_title: string;
  fiscal_year: number;
  version: string;
  effective_from: string;
  effective_to: string | null;
  base_floor_daily_wage: number;
  rial_coefficient_a: number;
  has_ranking_system: number;
  rank_interval_years: number;
  group_number: number;
  daily_job_wage: number;
  validity_status: ValidityStatus;
}

/* --------------------------------- پارامترها -------------------------------- */

export function loadParameters(
  db: Db,
  params: { fiscalYear: number; version?: string; asOfDate: string },
): WageParameters {
  const date = normalizeJalaliDate(params.asOfDate);
  const rows = db.all<WageParameters>(
    `SELECT * FROM annual_labor_parameters WHERE fiscal_year = ? ORDER BY effective_from DESC, id DESC`,
    params.fiscalYear,
  );
  if (rows.length === 0) {
    throw new MashaqelError(
      ERROR_CODES.MISSING_PARAMETERS,
      `پارامترهای قانونی سال ${params.fiscalYear} در دیتابیس ثبت نشده است.`,
    );
  }
  let row: WageParameters | undefined;
  if (params.version) {
    row = rows.find((item) => item.version === params.version);
    if (!row) {
      throw new MashaqelError(
        ERROR_CODES.MISSING_PARAMETERS,
        `نسخه پارامتر «${params.version}» برای سال ${params.fiscalYear} یافت نشد.`,
      );
    }
  } else {
    row = rows.find((item) => date >= item.effective_from && (!item.effective_to || date <= item.effective_to));
    if (!row) row = rows[0];
  }
  validateParametersCurrency(row as WageParameters);
  return row as WageParameters;
}

/** نگهبان واحد پولی پارامترهای دیتابیس — جلوگیری از ثبت مبالغ تومانی به‌جای ریالی */
export function validateParametersCurrency(p: WageParameters): void {
  const checks: Array<{ field: string; value: number; reference: number }> = [
    { field: 'min_daily_wage', value: p.min_daily_wage, reference: REFERENCE_MIN_DAILY_WAGE_1405 },
    { field: 'grocery_allowance_monthly', value: p.grocery_allowance_monthly, reference: 22_000_000 },
    { field: 'marital_allowance_monthly', value: p.marital_allowance_monthly, reference: 5_000_000 },
  ];
  for (const check of checks) {
    if (detectTomanSuspicion(check.value, check.reference)) {
      throw new MashaqelError(
        ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
        `پارامتر ${check.field} با مقدار ${check.value} به‌احتمال قوی به تومان ثبت شده است ` +
          `(مقدار قانونی مرجع: ${check.reference} ریال). واحد پولی پایه سامانه ریال است.`,
        { field: check.field, value: check.value, referenceIrr: check.reference },
      );
    }
  }
  if (p.housing_allowance_monthly > 0 && detectTomanSuspicion(p.housing_allowance_monthly, 30_000_000)) {
    throw new MashaqelError(
      ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
      `پارامتر housing_allowance_monthly با مقدار ${p.housing_allowance_monthly} به‌احتمال قوی به تومان ثبت شده است.`,
      { field: 'housing_allowance_monthly', value: p.housing_allowance_monthly },
    );
  }
}

/* -------------------------------- جدول مزد -------------------------------- */

export function findWageTable(
  db: Db,
  params: { schemeCode: string; fiscalYear: number; group: number; asOfDate: string },
): WageTableRow | undefined {
  const date = normalizeJalaliDate(params.asOfDate);
  const rows = db.all<WageTableRow>(
    `SELECT * FROM wage_tables WHERE scheme_code = ? AND fiscal_year = ? AND group_number = ?
     ORDER BY effective_from DESC, version DESC`,
    params.schemeCode,
    params.fiscalYear,
    params.group,
  );
  return rows.find((row) => date >= row.effective_from && (!row.effective_to || date <= row.effective_to)) ?? rows[0];
}

/* ------------------------------ مزد رتبه ------------------------------ */

export function computeRankDailyWage(
  db: Db,
  params: { schemeCode: string; fiscalYear: number; group: number; rankCount: number; asOfDate: string },
): { available: boolean; dailyRankWage: number; message: string | null } {
  const table = findWageTable(db, {
    schemeCode: params.schemeCode,
    fiscalYear: params.fiscalYear,
    group: params.group,
    asOfDate: params.asOfDate,
  });
  if (!table) {
    return { available: false, dailyRankWage: 0, message: 'جدول مزد این طرح در دسترس نیست؛ مزد رتبه محاسبه نشد.' };
  }
  if (table.has_ranking_system === 0) {
    return { available: false, dailyRankWage: 0, message: 'این طرح مصوب دارای نظام رتبه‌بندی نیست.' };
  }
  const range = db.get<{ consecutive_diff_delta: number }>(
    `SELECT consecutive_diff_delta FROM group_score_ranges
     WHERE scheme_code = 'NATIONAL_20_GROUP_1389' AND group_number = ? ORDER BY effective_from DESC LIMIT 1`,
    params.group,
  );
  if (!range) {
    return { available: false, dailyRankWage: 0, message: 'تفاوت امتیاز گروه برای محاسبه رتبه یافت نشد.' };
  }
  return {
    available: true,
    dailyRankWage: roundMoney(range.consecutive_diff_delta * table.rial_coefficient_a * params.rankCount),
    message: null,
  };
}

/* ------------------------------ محاسبه مزد ------------------------------ */

const SHIFT_PCT_MAP: Record<string, 'shift_2_pct' | 'shift_3_pct' | 'shift_day_night_pct' | null> = {
  NONE: null,
  MORNING_EVENING: 'shift_2_pct',
  MORNING_EVENING_NIGHT: 'shift_day_night_pct',
  DAY_NIGHT: 'shift_3_pct',
  ROTATING_24_7: 'shift_3_pct',
};

export class WageEngine {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** فرمول صریح ماده ۱ دستورالعمل ۶۷۲۴: max(round(مزد ۱۴۰۴ × ۱٫۴۵ + ۵۱۹٬۵۴۹), ۵٬۵۴۱٬۸۵۰) */
  static dailyJobWage1405FromPrior(priorDailyWage: number, params: { fixedDaily: number; increasePct: number; minDailyWage: number }): number {
    const increased = roundMoney(priorDailyWage * (1 + params.increasePct / 100) + params.fixedDaily);
    return Math.max(increased, params.minDailyWage);
  }

  computeWage(input: EmployeeWageInput): WageComputationResult {
    const warnings: string[] = [];
    const fiscalYear = input.fiscalYear ?? 1405;
    const computationDate = normalizeJalaliDate(input.computationDate ?? `${fiscalYear}-01-01`);
    const periodYearMonth = input.periodYearMonth ?? `${fiscalYear}-01`;
    const payableDays = input.payableDays ?? 30;
    if (payableDays <= 0 || payableDays > 31) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `روزهای قابل پرداخت نامعتبر است: ${payableDays}`);
    }
    if (!Number.isInteger(input.jobGroup) || input.jobGroup < 1) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `گروه شغلی نامعتبر است: ${input.jobGroup}`);
    }

    const params = loadParameters(this.db, {
      fiscalYear,
      ...(input.parameterVersion ? { version: input.parameterVersion } : {}),
      asOfDate: computationDate,
    });
    if (requiresExpertWarning(params.validity_status)) {
      warnings.push(
        `نسخه پارامترهای سالانه «${params.version}» با وضعیت «${VALIDITY_STATUS_LABELS[params.validity_status]}» استفاده شد.`,
      );
    }

    const inputCurrency = assertCurrencyUnit(input.inputCurrency ?? 'IRR', 'inputCurrency');
    const money = (value: number | undefined, field: string, reference: number): number => {
      if (value === undefined) return 0;
      if (inputCurrency === 'TOMAN') return toIrr(value, 'TOMAN', field);
      if (detectTomanSuspicion(value, reference)) {
        throw new MashaqelError(
          ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
          `مقدار فیلد ${field} (${value}) با واحد ریال ارسال شده اما با مرجع ریالی ${reference} سازگار نیست؛ ` +
            `لطفاً inputCurrency را TOMAN تعیین کنید یا مبلغ را به ریال اصلاح نمایید.`,
          { field, value, referenceIrr: reference },
        );
      }
      return roundMoney(value);
    };

    const priorDailyJobWage = money(input.priorDailyJobWage, 'priorDailyJobWage', params.min_daily_wage);
    const priorAccumulated = money(
      input.priorAccumulatedDailySeniority,
      'priorAccumulatedDailySeniority',
      params.base_daily_seniority_g1,
    );
    const priorRank = money(input.priorDailyRankWage, 'priorDailyRankWage', params.base_daily_seniority_g1);
    const priorOther = money(input.priorOtherFixedDailyWage, 'priorOtherFixedDailyWage', params.base_daily_seniority_g1);
    const otherAllowances = money(input.otherWageAllowancesMonthly, 'otherWageAllowancesMonthly', params.grocery_allowance_monthly);
    const variableBenefits = money(input.variableBenefitsMonthly, 'variableBenefitsMonthly', params.grocery_allowance_monthly);
    const overtimeHours = input.overtimeHours ?? 0;
    const nightHours = input.nightWorkHours ?? 0;
    if (overtimeHours < 0 || nightHours < 0) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'ساعات اضافه‌کاری/شب‌کاری نمی‌تواند منفی باشد.');
    }

    /* ---------------------------------- مزد شغل ---------------------------------- */
    const currentTable = findWageTable(this.db, {
      schemeCode: input.schemeCode,
      fiscalYear,
      group: input.jobGroup,
      asOfDate: computationDate,
    });
    const priorTable = findWageTable(this.db, {
      schemeCode: input.schemeCode,
      fiscalYear: fiscalYear - 1,
      group: input.jobGroup,
      asOfDate: computationDate,
    });
    if (
      priorDailyJobWage > 0 &&
      priorTable &&
      detectTomanSuspicion(priorDailyJobWage, priorTable.daily_job_wage)
    ) {
      throw new MashaqelError(
        ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
        `مزد شغل روزانه سال قبل (${priorDailyJobWage}) با واحد ریال ارسال شده اما با مزد مصوب همان گروه در سال ` +
          `${fiscalYear - 1} (${priorTable.daily_job_wage} ریال) سازگار نیست و به‌احتمال قوی به تومان وارد شده است.`,
        {
          field: 'priorDailyJobWage',
          value: priorDailyJobWage,
          referenceIrr: priorTable.daily_job_wage,
        },
      );
    }
    const effectivePrior = priorDailyJobWage > 0 ? priorDailyJobWage : (priorTable?.daily_job_wage ?? 0);

    const formulaWage =
      effectivePrior > 0
        ? WageEngine.dailyJobWage1405FromPrior(effectivePrior, {
            fixedDaily: params.other_levels_fixed_daily,
            increasePct: params.other_levels_increase_pct,
            minDailyWage: params.min_daily_wage,
          })
        : null;
    const tableWage = currentTable?.daily_job_wage ?? null;
    const source = input.wageSource ?? 'AUTO';

    let dailyJobWage: number;
    if (source === 'TABLE') {
      if (tableWage === null) {
        throw new MashaqelError(
          ERROR_CODES.MISSING_WAGE_TABLE,
          `جدول مزد طرح «${input.schemeCode}» برای سال ${fiscalYear} و گروه ${input.jobGroup} در دسترس نیست.`,
        );
      }
      dailyJobWage = tableWage;
    } else if (source === 'FORMULA') {
      if (formulaWage === null) {
        throw new MashaqelError(
          ERROR_CODES.INVALID_ARGUMENT,
          'برای محاسبه مزد شغل با فرمول قانونی، مزد شغل روزانه سال ۱۴۰۴ الزامی است.',
        );
      }
      dailyJobWage = formulaWage;
    } else if (tableWage !== null && formulaWage !== null) {
      // اختلاف گرد کردن (حداکثر ۲ ریال) ناشی از ترتیب گرد کردن در مصوبه و جدول است؛ جدول رسمی ملاک است
      const ROUNDING_TOLERANCE = 2;
      const diff = formulaWage - tableWage;
      dailyJobWage = Math.abs(diff) <= ROUNDING_TOLERANCE ? tableWage : Math.max(tableWage, formulaWage);
      if (diff > ROUNDING_TOLERANCE) {
        warnings.push(
          `مزد جدول طرح (${tableWage}) از مزد حاصل از فرمول قانونی (${formulaWage}) کمتر است؛ مبلغ بیشتر ملاک قرار گرفت. ` +
            'جدول مزد طرح نیازمند بازنگری و تأیید مجدد است.',
        );
      }
    } else if (tableWage !== null) {
      dailyJobWage = tableWage;
      if (effectivePrior === 0) {
        warnings.push('مزد شغل ۱۴۰۴ در دسترس نبود؛ مزد شغل مستقیماً از جدول مزد مصوب طرح خوانده شد.');
      }
    } else if (formulaWage !== null) {
      dailyJobWage = formulaWage;
      warnings.push(
        `جدول مزد مصوب طرح برای گروه ${input.jobGroup} در دسترس نیست؛ مزد شغل با فرمول قانونی ماده ۱ دستورالعمل ۶۷۲۴ محاسبه شد.`,
      );
    } else {
      throw new MashaqelError(
        ERROR_CODES.MISSING_WAGE_TABLE,
        `برای محاسبه مزد شغل، یا جدول مزد مصوب طرح «${input.schemeCode}» (سال ${fiscalYear}، گروه ${input.jobGroup}) ` +
          'یا مزد شغل روزانه سال ۱۴۰۴ الزامی است؛ هیچ‌کدام در دسترس نیست.',
      );
    }

    if (dailyJobWage < params.min_daily_wage) {
      warnings.push(
        `مزد شغل روزانه (${dailyJobWage}) کمتر از حداقل مزد روزانه قانونی (${params.min_daily_wage}) بود و به کف قانونی افزایش یافت.`,
      );
      dailyJobWage = params.min_daily_wage;
    }

    /* --------------------------------- پایه سنوات -------------------------------- */
    const seniority = computeDailySeniority(this.db, {
      schemeCode: input.schemeCode,
      group: input.jobGroup,
      fiscalYear,
      asOfDate: computationDate,
      priorAccumulatedDailySeniority: priorAccumulated,
      serviceYearsInWorkshop: input.serviceYearsInWorkshop ?? 0,
      increasePct: params.other_levels_increase_pct,
    });
    warnings.push(...seniority.warnings);

    /* ------------------------- سایر اجزای مزد (۴۵٪ افزایش) ------------------------ */
    const dailyRankWage = roundMoney(priorRank * (1 + params.other_levels_increase_pct / 100));
    const dailyOtherBaseElements = roundMoney(priorOther * (1 + params.other_levels_increase_pct / 100));
    const dailySeniorityWage = seniority.dailySeniority;

    const dailyBaseWage = dailyJobWage + dailySeniorityWage + dailyRankWage + dailyOtherBaseElements;

    /* --------------------------------- اجزای ماهانه -------------------------------- */
    const monthlyJobWage = roundMoney(dailyJobWage * payableDays);
    const monthlySeniorityWage = roundMoney(dailySeniorityWage * payableDays);
    const monthlyBaseWage = roundMoney(dailyBaseWage * payableDays);

    const overtimePay = roundMoney(
      (dailyBaseWage / params.normal_daily_hours_divisor) * params.overtime_multiplier * overtimeHours,
    );

    const shiftPctKey = SHIFT_PCT_MAP[input.shiftType ?? 'NONE'] ?? null;
    const shiftPay = shiftPctKey ? roundMoney(monthlyBaseWage * (params[shiftPctKey] as number)) : 0;

    let nightWorkPay = 0;
    if (nightHours > 0) {
      if (input.shiftType && input.shiftType !== 'NONE') {
        warnings.push(
          'کارگر نوبت‌کار مشمول فوق‌العاده شب‌کاری موضوع ماده ۵۸ به‌صورت جداگانه نیست؛ فوق‌العاده شب‌کاری محاسبه نشد.',
        );
      } else {
        nightWorkPay = roundMoney(
          (dailyBaseWage / params.normal_daily_hours_divisor) * params.night_work_pct * nightHours,
        );
      }
    }

    const wageSubtotal = monthlyBaseWage + overtimePay + shiftPay + nightWorkPay + otherAllowances + variableBenefits;

    /* --------------------------- مزایای رفاهی و انگیزشی --------------------------- */
    const includeWelfare = input.includeWelfareBenefits !== false;
    const prorationRatio = Math.min(payableDays / 30, 1);
    const groceryAllowance = includeWelfare ? roundMoney(params.grocery_allowance_monthly * prorationRatio) : 0;
    const housingAllowance = includeWelfare ? roundMoney(params.housing_allowance_monthly * prorationRatio) : 0;
    const maritalAllowance = includeWelfare && input.isMarried ? roundMoney(params.marital_allowance_monthly * prorationRatio) : 0;
    const children = input.eligibleChildrenCount ?? 0;
    const childAllowance = includeWelfare
      ? roundMoney(params.child_allowance_multiplier * params.min_daily_wage * children * prorationRatio)
      : 0;
    const welfareSubtotal = groceryAllowance + housingAllowance + maritalAllowance + childAllowance;

    const grossTotal = wageSubtotal + welfareSubtotal;

    /* --------------------------------- بیمه و مالیات -------------------------------- */
    const insurableRaw =
      monthlyBaseWage +
      overtimePay +
      shiftPay +
      nightWorkPay +
      otherAllowances +
      variableBenefits +
      groceryAllowance +
      housingAllowance +
      maritalAllowance;
    const insurableCeiling = params.insurable_daily_ceiling ? params.insurable_daily_ceiling * payableDays : null;
    const insurableBase = insurableCeiling ? Math.min(insurableRaw, insurableCeiling) : insurableRaw;
    const workerInsurance = roundMoney(insurableBase * params.worker_insurance_pct);
    const employerInsurance = roundMoney(insurableBase * (params.employer_insurance_pct + params.unemployment_insurance_pct));

    let tax = 0;
    if (!params.tax_brackets_json) {
      warnings.push(
        'پلکان مالیات بر حقوق سال ۱۴۰۵ (قانون بودجه و بخشنامه سازمان امور مالیاتی) در سامانه ثبت نشده است؛ ' +
          'مالیات صفر محاسبه شد و باید پیش از صدور فیش نهایی وارد شود (وضعیت ۴: نیازمند ورود اطلاعات).',
      );
    } else {
      tax = computeTaxFromBrackets(insurableRaw, params.tax_brackets_json);
    }

    const netPayable = grossTotal - workerInsurance - tax;
    if (netPayable < 0) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'خالص پرداختی منفی شد؛ ورودی‌های محاسبه نیازمند بازبینی است.');
    }

    const minimumWageCompliance = {
      compliant: dailyBaseWage >= params.min_daily_wage,
      minimumDailyWage: params.min_daily_wage,
      difference: dailyBaseWage - params.min_daily_wage,
    };

    const breakdown: WageBreakdownLine[] = [
      {
        code: 'JOB_WAGE',
        title: 'مزد شغل',
        category: 'JOB_WAGE',
        dailyAmount: dailyJobWage,
        monthlyAmount: monthlyJobWage,
        formulaCode: 'FRM-JOB-WAGE-1405',
        legalBasis: 'ماده ۱ دستورالعمل ۶۷۲۴',
        note: source === 'TABLE' ? 'از جدول مزد مصوب طرح' : 'از فرمول قانونی افزایش مزد',
      },
      {
        code: 'SENIORITY',
        title: 'پایه سنوات',
        category: 'SENIORITY',
        dailyAmount: dailySeniorityWage,
        monthlyAmount: monthlySeniorityWage,
        formulaCode: 'FRM-SEN-TOTAL-1405',
        legalBasis: 'ماده ۲ دستورالعمل ۶۷۲۴',
        note: seniority.rateResult.available
          ? `نرخ پایه سنوات گروه ${input.jobGroup}: ${seniority.rateResult.rate} ریال`
          : (seniority.rateResult.message ?? undefined),
      },
      {
        code: 'RANK_WAGE',
        title: 'مزد رتبه (سایر اجزای مزدی)',
        category: 'BASE_WAGE',
        dailyAmount: dailyRankWage,
        monthlyAmount: roundMoney(dailyRankWage * payableDays),
        formulaCode: 'FRM-OTHER-WAGE-1405',
        legalBasis: 'تبصره ۲ ماده ۱ دستورالعمل ۶۷۲۴',
      },
      {
        code: 'OTHER_BASE',
        title: 'سایر اجزای مزد مبنا',
        category: 'BASE_WAGE',
        dailyAmount: dailyOtherBaseElements,
        monthlyAmount: roundMoney(dailyOtherBaseElements * payableDays),
        formulaCode: 'FRM-OTHER-WAGE-1405',
        legalBasis: 'تبصره ۲ ماده ۱ دستورالعمل ۶۷۲۴',
      },
      {
        code: 'BASE_WAGE',
        title: 'مزد مبنا',
        category: 'BASE_WAGE',
        dailyAmount: dailyBaseWage,
        monthlyAmount: monthlyBaseWage,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: 'تبصره ۲ ماده ۳۶ قانون کار',
      },
      {
        code: 'OVERTIME',
        title: 'فوق‌العاده اضافه‌کاری',
        category: 'WAGE_ALLOWANCE',
        monthlyAmount: overtimePay,
        formulaCode: 'FRM-OVERTIME',
        legalBasis: 'مواد ۵۱ و ۵۹ قانون کار',
        note: `${overtimeHours} ساعت`,
      },
      {
        code: 'SHIFT',
        title: 'فوق‌العاده نوبت‌کاری',
        category: 'WAGE_ALLOWANCE',
        monthlyAmount: shiftPay,
        formulaCode: 'FRM-SHIFT-WORK',
        legalBasis: 'ماده ۵۶ قانون کار',
        note: input.shiftType ?? 'NONE',
      },
      {
        code: 'NIGHT',
        title: 'فوق‌العاده شب‌کاری',
        category: 'WAGE_ALLOWANCE',
        monthlyAmount: nightWorkPay,
        formulaCode: 'FRM-NIGHT-WORK',
        legalBasis: 'ماده ۵۸ قانون کار',
        note: `${nightHours} ساعت`,
      },
      {
        code: 'OTHER_ALLOWANCES',
        title: 'سایر مزایای مزدی مستحق',
        category: 'WAGE_ALLOWANCE',
        monthlyAmount: otherAllowances + variableBenefits,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: 'قرارداد کار / طرح مصوب کارگاه',
      },
      {
        code: 'GROCERY',
        title: 'کمک‌هزینه اقلام مصرفی خانوار (بن)',
        category: 'WELFARE',
        monthlyAmount: groceryAllowance,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: 'بند ۳ بخشنامه ۶۶۸۲',
      },
      {
        code: 'HOUSING',
        title: 'کمک‌هزینه مسکن',
        category: 'WELFARE',
        monthlyAmount: housingAllowance,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: `تصویب‌نامه ۹۲۳۴ هیئت وزیران — نسخه ${params.version}`,
        note: params.housing_legal_status,
      },
      {
        code: 'MARITAL',
        title: 'حق تأهل',
        category: 'WELFARE',
        monthlyAmount: maritalAllowance,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: 'بند ۴ بخشنامه ۶۶۸۲',
      },
      {
        code: 'CHILD',
        title: 'حق اولاد',
        category: 'WELFARE',
        monthlyAmount: childAllowance,
        formulaCode: 'FRM-CHILD-ALLOWANCE',
        legalBasis: 'ماده ۸۶ قانون تأمین اجتماعی',
        note: `${children} فرزند`,
      },
      {
        code: 'WORKER_INSURANCE',
        title: 'کسور بیمه سهم کارگر',
        category: 'DEDUCTION',
        monthlyAmount: -workerInsurance,
        formulaCode: 'FRM-INSURANCE',
        legalBasis: 'ماده ۲۸ قانون تأمین اجتماعی',
      },
      {
        code: 'TAX',
        title: 'مالیات بر حقوق',
        category: 'DEDUCTION',
        monthlyAmount: -tax,
        formulaCode: 'FRM-BASE-WAGE',
        legalBasis: 'قانون بودجه سال ۱۴۰۵ (ثبت‌نشده)',
      },
    ];

    return {
      employeeCode: input.employeeCode ?? null,
      fiscalYear,
      periodYearMonth,
      computationDate,
      currencyUnit: 'IRR',
      parameterVersion: params.version,
      schemeCode: input.schemeCode,
      jobGroup: input.jobGroup,
      payableDays,
      dailyJobWage,
      dailySeniorityWage,
      dailyRankWage,
      dailyOtherBaseElements,
      dailyBaseWage,
      monthlyJobWage,
      monthlySeniorityWage,
      monthlyBaseWage,
      overtimePay,
      shiftPay,
      nightWorkPay,
      otherWageAllowances: otherAllowances + variableBenefits,
      wageSubtotal,
      groceryAllowance,
      housingAllowance,
      maritalAllowance,
      childAllowance,
      welfareSubtotal,
      grossTotal,
      workerInsurance,
      employerInsurance,
      tax,
      netPayable,
      breakdown,
      warnings,
      minimumWageCompliance,
    };
  }
}

/** محاسبه مالیات بر مبنای پلکان مصوب (در صورت ثبت در پارامترهای سالانه) */
export function computeTaxFromBrackets(taxableMonthly: number, bracketsJson: string): number {
  let brackets: Array<{ upTo: number | null; rate: number }>;
  try {
    brackets = JSON.parse(bracketsJson) as Array<{ upTo: number | null; rate: number }>;
  } catch {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'ساختار پلکان مالیات در دیتابیس نامعتبر است.');
  }
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Number.POSITIVE_INFINITY;
    if (taxableMonthly > lower) {
      const taxableInBracket = Math.min(taxableMonthly, upper) - lower;
      if (taxableInBracket > 0) tax += taxableInBracket * bracket.rate;
    }
    lower = upper;
    if (!Number.isFinite(lower)) break;
  }
  return roundMoney(tax);
}

/** نرخ پایه سنوات گروه برای گزارش‌های بیرونی */
export function seniorityRateForGroup(db: Db, schemeCode: string, group: number, fiscalYear: number, asOfDate: string) {
  return getGroupSeniorityRate(db, { schemeCode, group, fiscalYear, asOfDate });
}
