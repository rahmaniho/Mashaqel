/**
 * خدمات پایه سنوات (مزد سنوات):
 * - نرخ روزانه پایه سنوات سال جاری به تفکیک گروه (ماده ۲ دستورالعمل ۶۷۲۴)
 * - جدول رسمی احتساب مزد سنوات تجمیعی گذشته
 * - قاعده الزامی: در طرح‌های بدون جدول پایه سنوات، هیچ مقدار فرضی (از جمله ۱۶۶٬۶۶۷ ریال) اعمال نمی‌شود.
 */

import type { Db } from '../db/query.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import {
  ERROR_CODES,
  MashaqelError,
  SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
  VALIDITY_STATUS_LABELS,
  type ValidityStatus,
} from '../core/status.ts';

export interface SeniorityRateResult {
  available: boolean;
  schemeCode: string;
  group: number;
  fiscalYear: number;
  rate: number | null;
  tableVersion: string | null;
  validityStatus: ValidityStatus | null;
  message: string | null;
}

export interface CumulativeSeniorityResult {
  available: boolean;
  schemeCode: string;
  baseFiscalYear: number;
  years: number;
  amount: number | null;
  interpolated: boolean;
  tableVersion: string | null;
  message: string | null;
}

interface SeniorityRow {
  id: number;
  scheme_code: string;
  table_type: string;
  fiscal_year: number;
  version: string;
  effective_from: string;
  effective_to: string | null;
  group_number: number | null;
  years_of_service: number | null;
  daily_seniority_amount: number;
  validity_status: ValidityStatus;
}

function activeRows(db: Db, schemeCode: string, tableType: string, asOfDate: string): SeniorityRow[] {
  const date = normalizeJalaliDate(asOfDate);
  return db.all<SeniorityRow>(
    `SELECT * FROM seniority_tables
     WHERE scheme_code = ? AND table_type = ?
     ORDER BY fiscal_year DESC, version DESC`,
    schemeCode,
    tableType,
  ).filter((row) => date >= row.effective_from && (!row.effective_to || date <= row.effective_to));
}

/** نرخ پایه سنوات روزانه گروه در سال مالی مشخص (بدون هیچ مقدار پیش‌فرض) */
export function getGroupSeniorityRate(
  db: Db,
  params: { schemeCode: string; group: number; fiscalYear: number; asOfDate: string },
): SeniorityRateResult {
  const rows = activeRows(db, params.schemeCode, 'ANNUAL_GROUP_RATE', params.asOfDate);
  const groupRows = rows.filter((row) => row.fiscal_year === params.fiscalYear && row.group_number === params.group);
  if (groupRows.length === 0) {
    return {
      available: false,
      schemeCode: params.schemeCode,
      group: params.group,
      fiscalYear: params.fiscalYear,
      rate: null,
      tableVersion: null,
      validityStatus: null,
      message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
    };
  }
  const withRate = groupRows.filter((row) => row.daily_seniority_amount > 0);
  if (withRate.length === 0) {
    return {
      available: false,
      schemeCode: params.schemeCode,
      group: params.group,
      fiscalYear: params.fiscalYear,
      rate: null,
      tableVersion: groupRows[0]?.version ?? null,
      validityStatus: groupRows[0]?.validity_status ?? null,
      message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
    };
  }
  const row = withRate[0] as SeniorityRow;
  return {
    available: true,
    schemeCode: params.schemeCode,
    group: params.group,
    fiscalYear: params.fiscalYear,
    rate: row.daily_seniority_amount,
    tableVersion: row.version,
    validityStatus: row.validity_status,
    message: null,
  };
}

/** مزد سنوات تجمیعی بر مبنای جدول رسمی؛ برای سابقه غیرصحیح با درون‌یابی خطی */
export function getCumulativeSeniority(
  db: Db,
  params: { schemeCode: string; yearsOfService: number; asOfDate: string; baseFiscalYear?: number },
): CumulativeSeniorityResult {
  if (params.yearsOfService < 0) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'سابقه سنوات نمی‌تواند منفی باشد.');
  }
  const rows = activeRows(db, params.schemeCode, 'CUMULATIVE_PAST_SERVICE', params.asOfDate);
  const baseFiscalYear = params.baseFiscalYear ?? Math.max(...rows.map((row) => row.fiscal_year), 0);
  const table = rows
    .filter((row) => row.fiscal_year === baseFiscalYear && row.years_of_service !== null)
    .sort((a, b) => (a.years_of_service as number) - (b.years_of_service as number));

  if (table.length === 0) {
    return {
      available: false,
      schemeCode: params.schemeCode,
      baseFiscalYear,
      years: params.yearsOfService,
      amount: null,
      interpolated: false,
      tableVersion: null,
      message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
    };
  }

  const exact = table.find((row) => row.years_of_service === Math.floor(params.yearsOfService));
  const maxYear = table[table.length - 1] as SeniorityRow;
  if (params.yearsOfService >= (maxYear.years_of_service as number)) {
    if (params.yearsOfService === maxYear.years_of_service) {
      return {
        available: true,
        schemeCode: params.schemeCode,
        baseFiscalYear,
        years: params.yearsOfService,
        amount: maxYear.daily_seniority_amount,
        interpolated: false,
        tableVersion: maxYear.version,
        message: null,
      };
    }
    // فراتر از سقف جدول: با ضریب آخرین پله توسعه داده می‌شود و نیازمند تأیید کارشناسی است
    const prev = table[table.length - 2] as SeniorityRow;
    const increment =
      (maxYear.daily_seniority_amount - prev.daily_seniority_amount) /
      ((maxYear.years_of_service as number) - (prev.years_of_service as number));
    const extra = (params.yearsOfService - (maxYear.years_of_service as number)) * increment;
    return {
      available: true,
      schemeCode: params.schemeCode,
      baseFiscalYear,
      years: params.yearsOfService,
      amount: Math.round(maxYear.daily_seniority_amount + extra),
      interpolated: true,
      tableVersion: maxYear.version,
      message:
        'سابقه اعلامی از سقف جدول رسمی سنوات بیشتر است؛ مبلغ با توسعه پله آخر محاسبه شده و نیازمند تأیید کارشناسی است.',
    };
  }

  const whole = Math.floor(params.yearsOfService);
  const fraction = params.yearsOfService - whole;
  const current = table.find((row) => row.years_of_service === whole) as SeniorityRow | undefined;
  const next = table.find((row) => row.years_of_service === whole + 1) as SeniorityRow | undefined;
  if (!current) {
    return {
      available: false,
      schemeCode: params.schemeCode,
      baseFiscalYear,
      years: params.yearsOfService,
      amount: null,
      interpolated: false,
      tableVersion: maxYear.version,
      message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE,
    };
  }
  if (fraction === 0 || !next) {
    return {
      available: true,
      schemeCode: params.schemeCode,
      baseFiscalYear,
      years: params.yearsOfService,
      amount: current.daily_seniority_amount,
      interpolated: false,
      tableVersion: current.version,
      message: fraction > 0 ? 'بخش اعشاری سابقه در نبود پله بعدی جدول، بدون درون‌یابی محاسبه شد.' : null,
    };
  }
  const amount = Math.round(
    current.daily_seniority_amount + fraction * (next.daily_seniority_amount - current.daily_seniority_amount),
  );
  return {
    available: true,
    schemeCode: params.schemeCode,
    baseFiscalYear,
    years: params.yearsOfService,
    amount,
    interpolated: true,
    tableVersion: current.version,
    message: null,
  };
}

export interface DailySeniorityComputation {
  dailySeniority: number;
  accumulatedInflated: number;
  newYearRateAddition: number;
  rateResult: SeniorityRateResult;
  eligibleForNewRate: boolean;
  warnings: string[];
}

/**
 * محاسبه کل مزد سنوات روزانه سال جاری:
 * سنوات تجمیعی پایان سال قبل × ضریب افزایش + نرخ پایه سنوات گروه (در صورت احراز شرایط)
 */
export function computeDailySeniority(
  db: Db,
  params: {
    schemeCode: string;
    group: number;
    fiscalYear: number;
    asOfDate: string;
    priorAccumulatedDailySeniority: number;
    serviceYearsInWorkshop: number;
    increasePct: number;
    grantNewYearRate?: boolean;
  },
): DailySeniorityComputation {
  const warnings: string[] = [];
  const accumulatedInflated = Math.round(params.priorAccumulatedDailySeniority * (1 + params.increasePct / 100));
  const eligibleForNewRate = params.grantNewYearRate ?? params.serviceYearsInWorkshop >= 1;

  const rateResult = getGroupSeniorityRate(db, {
    schemeCode: params.schemeCode,
    group: params.group,
    fiscalYear: params.fiscalYear,
    asOfDate: params.asOfDate,
  });

  let newYearRateAddition = 0;
  if (eligibleForNewRate) {
    if (!rateResult.available) {
      warnings.push(`${SENIORITY_TABLE_UNAVAILABLE_MESSAGE} — پایه سنوات سال جدید (گروه ${params.group}) اعمال نشد.`);
    } else {
      newYearRateAddition = rateResult.rate as number;
      if (rateResult.validityStatus && rateResult.validityStatus !== '1_VERIFIED_USABLE') {
        warnings.push(
          `نرخ پایه سنوات گروه ${params.group} با وضعیت «${VALIDITY_STATUS_LABELS[rateResult.validityStatus]}» ثبت شده است.`,
        );
      }
    }
  }

  return {
    dailySeniority: accumulatedInflated + newYearRateAddition,
    accumulatedInflated,
    newYearRateAddition,
    rateResult,
    eligibleForNewRate,
    warnings,
  };
}
