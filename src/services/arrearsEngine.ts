/**
 * موتور مابه‌التفاوت و معوقات مزدی (ماده ۹ آیین‌نامه اجرایی طرح طبقه‌بندی مشاغل مصوب ۱۳۸۹/۱۲/۰۱)
 * و ماده ۷ دستورالعمل شماره ۲۰ (تفاوت تطبیق و حفظ حقوق مکتسبه).
 */

import { ERROR_CODES, MashaqelError } from '../core/status.ts';
import { roundMoney } from '../core/currency.ts';
import type { ArrearsPeriodInput, ArrearsResult } from '../core/types.ts';

export interface ArrearsInput {
  periods: ArrearsPeriodInput[];
  /** لحاظ تبعات مزدی (اضافه‌کاری، نوبت‌کاری...) در معوقات — ماده ۸ و صدر ماده ۹ */
  includeVariableConsequences?: boolean;
  /** مزد ثابت روزانه پیش از اجرای طرح (برای محاسبه تفاوت تطبیق) */
  fixedDailyWageBeforeScheme?: number;
  /** مزد مبنای روزانه پس از اجرای طرح */
  baseDailyWageAfterScheme?: number;
}

export function computeArrears(input: ArrearsInput): ArrearsResult {
  if (!Array.isArray(input.periods) || input.periods.length === 0) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'فهرست دوره‌های محاسبه معوقات خالی است.');
  }
  const warnings: string[] = [];
  const includeVariable = input.includeVariableConsequences ?? true;

  const periods = input.periods.map((period) => {
    if (period.payableDays <= 0) {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `روزهای قابل پرداخت دوره ${period.periodYearMonth} نامعتبر است.`,
      );
    }
    const entitledVariable = period.entitledVariableBenefits ?? 0;
    const paidVariable = period.paidVariableBenefits ?? 0;
    const dailyDifference = roundMoney(period.entitledDailyWage - period.paidDailyWage);
    const cappedAtZero = dailyDifference < 0;

    const dailyArrears = Math.max(0, dailyDifference);
    const monthlyArrears = roundMoney(dailyArrears * period.payableDays);
    const variableArrears = includeVariable
      ? Math.max(0, roundMoney(entitledVariable - paidVariable))
      : 0;
    if (!includeVariable && entitledVariable !== paidVariable) {
      warnings.push(
        `دوره ${period.periodYearMonth}: مابه‌التفاوت مزایای متغیر به دلیل عدم توافق طرفین (ذیل ماده ۹ آیین‌نامه) لحاظ نشد.`,
      );
    }
    if (cappedAtZero) {
      warnings.push(
        `دوره ${period.periodYearMonth}: مزد پرداختی بیشتر از مزد استحقاقی بوده و اختلاف منفی به بدهی کارگر تبدیل نمی‌شود ` +
          `(تفاوت تطبیق ${Math.abs(dailyDifference)} ریال در روز برای استهلاک آتی ثبت شد).`,
      );
    }

    return {
      periodYearMonth: period.periodYearMonth,
      payableDays: period.payableDays,
      entitledDailyWage: period.entitledDailyWage,
      paidDailyWage: period.paidDailyWage,
      dailyDifference,
      dailyArrears,
      monthlyArrears,
      variableArrears,
      totalArrears: monthlyArrears + variableArrears,
      cappedAtZero,
    };
  });

  const totalArrears = periods.reduce((sum, period) => sum + period.totalArrears, 0);
  const totalDailyArrears = periods.reduce((sum, period) => sum + period.dailyArrears, 0);

  let adaptationRetentionDaily = 0;
  if (
    input.fixedDailyWageBeforeScheme !== undefined &&
    input.baseDailyWageAfterScheme !== undefined &&
    input.fixedDailyWageBeforeScheme > input.baseDailyWageAfterScheme
  ) {
    adaptationRetentionDaily = roundMoney(input.fixedDailyWageBeforeScheme - input.baseDailyWageAfterScheme);
    warnings.push(
      `تفاوت تطبیق روزانه ${adaptationRetentionDaily} ریال است؛ مطابق ماده ۷ دستورالعمل ۲۰ طی چهار نوبت اعطای پایه سنوات آتی مستهلک می‌شود.`,
    );
  }

  return { currencyUnit: 'IRR', periods, totalArrears, totalDailyArrears, adaptationRetentionDaily, warnings };
}
