/**
 * هسته محاسباتی وب‌اپ — نسخه مرورگری موتور مشاغل.
 * این ماژول هیچ وابستگی‌ای به Node یا DOM ندارد و تمام داده‌ها را از
 * `web/data/mashaqel-data.json` (خروجی `npm run export:web`) می‌خواند.
 *
 * قواعد محاسباتی دقیقاً معادل `src/services/*` موتور است و با آزمون تطبیق
 * (`scripts/verify-web-parity.ts`) صحت آن کنترل می‌شود.
 *
 * واحد پولی: ریال ایران (IRR)
 */

export const MIN_DAILY_1405 = 5_541_850;
export const FIXED_1405 = 519_549;

export const STATUS = {
  VERIFIED: '1_VERIFIED_USABLE',
  EXTRACTED: '2_EXTRACTED_NEEDS_VERIFICATION',
  INSUFFICIENT: '3_INSUFFICIENT_DOCUMENTATION',
  WORKSHOP: '4_REQUIRES_WORKSHOP_APPROVED_SCHEME',
};

export const STATUS_LABELS = {
  '1_VERIFIED_USABLE': '۱. مستند و قابل استفاده',
  '2_EXTRACTED_NEEDS_VERIFICATION': '۲. استخراج‌شده، نیازمند تطبیق',
  '3_INSUFFICIENT_DOCUMENTATION': '۳. فاقد مستند کافی',
  '4_REQUIRES_WORKSHOP_APPROVED_SCHEME': '۴. نیازمند طرح مصوب کارگاه',
};

export const SENIORITY_TABLE_UNAVAILABLE_MESSAGE = 'جدول پایه سنوات این طرح در دسترس نیست';

export class CoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}

export function roundMoney(value) {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function detectTomanSuspicion(amount, reference, tolerance = 0.02) {
  if (!(amount > 0) || !(reference > 0)) return false;
  const asIrr = Math.abs(amount - reference) / reference;
  const asToman = Math.abs(amount * 10 - reference) / reference;
  return asIrr > tolerance && asToman <= tolerance;
}

function normalizeDate(value) {
  const text = String(value).trim().replace(/\//g, '-');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!match) throw new CoreError('INVALID_DATE', `تاریخ نامعتبر است: ${value}`);
  return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
}

function inRange(date, from, to) {
  if (date < from) return false;
  if (to && date > to) return false;
  return true;
}

/* ------------------------------- پارامترها ------------------------------- */

export function pickParameters(data, { fiscalYear = 1405, version, asOfDate }) {
  const date = normalizeDate(asOfDate ?? `${fiscalYear}-01-01`);
  const rows = data.annualParameters
    .filter((row) => row.fiscalYear === fiscalYear)
    .sort((a, b) => {
      // جدیدترین تاریخ اعتبار، و در تاریخ برابر، بالاترین نسخه (مطابق ترتیب موتور)
      if (a.effectiveFrom !== b.effectiveFrom) return a.effectiveFrom < b.effectiveFrom ? 1 : -1;
      return a.version < b.version ? 1 : a.version > b.version ? -1 : 0;
    });
  if (rows.length === 0) {
    throw new CoreError('MISSING_PARAMETERS', `پارامترهای قانونی سال ${fiscalYear} در دسترس نیست.`);
  }
  let params;
  if (version) {
    params = rows.find((row) => row.version === version);
    if (!params) {
      throw new CoreError('MISSING_PARAMETERS', `نسخه پارامتر «${version}» برای سال ${fiscalYear} یافت نشد.`);
    }
  } else {
    params = rows.find((row) => inRange(date, row.effectiveFrom, row.effectiveTo));
    if (!params) params = rows[0];
  }
  return params;
}

/* -------------------------------- جدول مزد -------------------------------- */

export function findWageTable(data, { schemeCode, fiscalYear, group, asOfDate }) {
  const date = normalizeDate(asOfDate);
  const rows = data.wageTables
    .filter((row) => row.schemeCode === schemeCode && row.fiscalYear === fiscalYear && row.groupNumber === group)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  return rows.find((row) => inRange(date, row.effectiveFrom, row.effectiveTo)) ?? rows[0] ?? null;
}

export function listWageSchemes(data) {
  const map = new Map();
  for (const row of data.wageTables) {
    if (!map.has(row.schemeCode)) {
      map.set(row.schemeCode, { schemeCode: row.schemeCode, schemeTitle: row.schemeTitle });
    }
  }
  return [...map.values()];
}

/* --------------------------------- سنوات --------------------------------- */

export function getSeniorityRate(data, { schemeCode, group, fiscalYear, asOfDate }) {
  const date = normalizeDate(asOfDate);
  const rows = data.seniorityTables
    .filter((row) => row.schemeCode === schemeCode && row.tableType === 'ANNUAL_GROUP_RATE')
    .filter((row) => inRange(date, row.effectiveFrom, row.effectiveTo))
    .filter((row) => row.fiscalYear === fiscalYear && row.groupNumber === group && row.dailySeniorityAmount > 0);
  if (rows.length === 0) {
    return { available: false, rate: null, message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE, validityStatus: null };
  }
  const row = rows[0];
  return {
    available: true,
    rate: row.dailySeniorityAmount,
    message: null,
    validityStatus: row.validityStatus,
    tableVersion: row.version,
  };
}

export function computeCumulativeSeniority(data, { schemeCode, yearsOfService, asOfDate, baseFiscalYear }) {
  const date = normalizeDate(asOfDate);
  const active = data.seniorityTables
    .filter((row) => row.schemeCode === schemeCode && row.tableType === 'CUMULATIVE_PAST_SERVICE')
    .filter((row) => inRange(date, row.effectiveFrom, row.effectiveTo));
  const base = baseFiscalYear ?? Math.max(...active.map((row) => row.fiscalYear), 0);
  const table = active
    .filter((row) => row.fiscalYear === base && row.yearsOfService !== null)
    .sort((a, b) => a.yearsOfService - b.yearsOfService);
  if (table.length === 0) {
    return { available: false, amount: null, message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE, interpolated: false };
  }
  const max = table[table.length - 1];
  if (yearsOfService >= max.yearsOfService) {
    return { available: true, amount: max.dailySeniorityAmount, interpolated: false, message: null };
  }
  const whole = Math.floor(yearsOfService);
  const fraction = yearsOfService - whole;
  const current = table.find((row) => row.yearsOfService === whole);
  const next = table.find((row) => row.yearsOfService === whole + 1);
  if (!current) return { available: false, amount: null, message: SENIORITY_TABLE_UNAVAILABLE_MESSAGE, interpolated: false };
  if (fraction === 0 || !next) {
    return { available: true, amount: current.dailySeniorityAmount, interpolated: false, message: null };
  }
  return {
    available: true,
    amount: Math.round(current.dailySeniorityAmount + fraction * (next.dailySeniorityAmount - current.dailySeniorityAmount)),
    interpolated: true,
    message: null,
  };
}

/* ------------------------------ محاسبه مزد ------------------------------ */

const SHIFT_PCT = {
  NONE: null,
  MORNING_EVENING: 'shift2Pct',
  MORNING_EVENING_NIGHT: 'shiftDayNightPct',
  DAY_NIGHT: 'shift3Pct',
  ROTATING_24_7: 'shift3Pct',
};

export function computeWage(data, input) {
  const warnings = [];
  const fiscalYear = input.fiscalYear ?? 1405;
  const computationDate = normalizeDate(input.computationDate ?? `${fiscalYear}-01-01`);
  const periodYearMonth = input.periodYearMonth ?? `${fiscalYear}-01`;
  const payableDays = input.payableDays ?? 30;
  const jobGroup = Number(input.jobGroup);

  if (!Number.isInteger(jobGroup) || jobGroup < 1) {
    throw new CoreError('INVALID_ARGUMENT', `گروه شغلی نامعتبر است: ${input.jobGroup}`);
  }
  if (!(payableDays > 0) || payableDays > 31) {
    throw new CoreError('INVALID_ARGUMENT', `روزهای قابل پرداخت نامعتبر است: ${payableDays}`);
  }

  const params = pickParameters(data, {
    fiscalYear,
    version: input.parameterVersion,
    asOfDate: computationDate,
  });
  if (params.validityStatus !== STATUS.VERIFIED) {
    warnings.push(`نسخه پارامترهای «${params.version}» با وضعیت «${STATUS_LABELS[params.validityStatus]}» استفاده شد.`);
  }

  const money = (value, field, reference) => {
    if (value === undefined || value === null || value === '') return 0;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new CoreError('INVALID_ARGUMENT', `مبلغ فیلد ${field} نامعتبر است.`);
    }
    if (input.inputCurrency === 'TOMAN') return roundMoney(amount * 10);
    if (detectTomanSuspicion(amount, reference)) {
      throw new CoreError(
        'AMOUNT_TOMAN_SUSPECTED',
        `مقدار ${field} (${amount.toLocaleString('en-US')}) با واحد ریال سازگار نیست و به‌احتمال قوی تومان است.`,
      );
    }
    return roundMoney(amount);
  };

  const priorDailyJobWage = money(input.priorDailyJobWage, 'priorDailyJobWage', params.minDailyWage);
  const priorAccumulated = money(input.priorAccumulatedDailySeniority, 'priorAccumulatedDailySeniority', params.baseDailySeniorityG1);
  const priorRank = money(input.priorDailyRankWage, 'priorDailyRankWage', params.baseDailySeniorityG1);
  const priorOther = money(input.priorOtherFixedDailyWage, 'priorOtherFixedDailyWage', params.baseDailySeniorityG1);
  const otherAllowances = money(input.otherWageAllowancesMonthly, 'otherWageAllowancesMonthly', params.groceryAllowanceMonthly);
  const variableBenefits = money(input.variableBenefitsMonthly, 'variableBenefitsMonthly', params.groceryAllowanceMonthly);
  const overtimeHours = Number(input.overtimeHours ?? 0);
  const nightHours = Number(input.nightWorkHours ?? 0);
  if (overtimeHours < 0 || nightHours < 0) {
    throw new CoreError('INVALID_ARGUMENT', 'ساعات اضافه‌کاری یا شب‌کاری نمی‌تواند منفی باشد.');
  }

  const currentTable = findWageTable(data, { schemeCode: input.schemeCode, fiscalYear, group: jobGroup, asOfDate: computationDate });
  const priorTable = findWageTable(data, { schemeCode: input.schemeCode, fiscalYear: fiscalYear - 1, group: jobGroup, asOfDate: computationDate });

  if (priorDailyJobWage > 0 && priorTable && detectTomanSuspicion(priorDailyJobWage, priorTable.dailyJobWage)) {
    throw new CoreError(
      'AMOUNT_TOMAN_SUSPECTED',
      `مزد شغل سال قبل (${priorDailyJobWage.toLocaleString('en-US')}) با مزد مصوب همان گروه در سال ${fiscalYear - 1} ` +
        `(${priorTable.dailyJobWage.toLocaleString('en-US')} ریال) سازگار نیست و به‌احتمال قوی تومان وارد شده است.`,
    );
  }

  const effectivePrior = priorDailyJobWage > 0 ? priorDailyJobWage : (priorTable?.dailyJobWage ?? 0);
  const formulaWage =
    effectivePrior > 0
      ? Math.max(
          roundMoney(effectivePrior * (1 + params.otherLevelsIncreasePct / 100) + params.otherLevelsFixedDaily),
          params.minDailyWage,
        )
      : null;
  const tableWage = currentTable?.dailyJobWage ?? null;
  const source = input.wageSource ?? 'AUTO';
  let dailyJobWage;

  if (source === 'TABLE') {
    if (tableWage === null) {
      throw new CoreError('MISSING_WAGE_TABLE', `جدول مزد طرح «${input.schemeCode}» برای گروه ${jobGroup} در دسترس نیست.`);
    }
    dailyJobWage = tableWage;
  } else if (source === 'FORMULA') {
    if (formulaWage === null) {
      throw new CoreError('INVALID_ARGUMENT', 'برای فرمول قانونی، مزد شغل روزانه سال ۱۴۰۴ الزامی است.');
    }
    dailyJobWage = formulaWage;
  } else if (tableWage !== null && formulaWage !== null) {
    const diff = formulaWage - tableWage;
    dailyJobWage = Math.abs(diff) <= 2 ? tableWage : Math.max(tableWage, formulaWage);
    if (diff > 2) {
      warnings.push(
        `مزد جدول طرح (${tableWage.toLocaleString('en-US')}) از فرمول قانونی (${formulaWage.toLocaleString('en-US')}) کمتر است؛ مبلغ بیشتر ملاک شد.`,
      );
    }
  } else if (tableWage !== null) {
    dailyJobWage = tableWage;
    if (effectivePrior === 0) {
      warnings.push('مزد شغل ۱۴۰۴ در دسترس نبود؛ مزد مستقیماً از جدول مصوب طرح خوانده شد.');
    }
  } else if (formulaWage !== null) {
    dailyJobWage = formulaWage;
    warnings.push('جدول مزد مصوب طرح در دسترس نیست؛ مزد با فرمول قانونی ماده ۱ دستورالعمل ۶۷۲۴ محاسبه شد.');
  } else {
    throw new CoreError(
      'MISSING_WAGE_TABLE',
      'نه جدول مزد مصوب طرح و نه مزد شغل روزانه ۱۴۰۴ در دسترس نیست؛ محاسبه مزد شغل ممکن نیست.',
    );
  }

  if (dailyJobWage < params.minDailyWage) {
    warnings.push(
      `مزد شغل روزانه (${dailyJobWage.toLocaleString('en-US')}) کمتر از حداقل مزد قانونی بود و به کف ${params.minDailyWage.toLocaleString('en-US')} ریال افزایش یافت.`,
    );
    dailyJobWage = params.minDailyWage;
  }

  const rateResult = getSeniorityRate(data, {
    schemeCode: input.schemeCode,
    group: jobGroup,
    fiscalYear,
    asOfDate: computationDate,
  });
  const eligibleForNewRate = input.grantNewSeniorityRate ?? Number(input.serviceYearsInWorkshop ?? 0) >= 1;
  const accumulatedInflated = roundMoney(priorAccumulated * (1 + params.otherLevelsIncreasePct / 100));
  let newYearRateAddition = 0;
  if (eligibleForNewRate) {
    if (rateResult.available) {
      newYearRateAddition = rateResult.rate;
      if (rateResult.validityStatus && rateResult.validityStatus !== STATUS.VERIFIED) {
        warnings.push(`نرخ پایه سنوات گروه ${jobGroup} با وضعیت «${STATUS_LABELS[rateResult.validityStatus]}» ثبت شده است.`);
      }
    } else {
      warnings.push(`${SENIORITY_TABLE_UNAVAILABLE_MESSAGE} — پایه سنوات سال جدید (گروه ${jobGroup}) اعمال نشد.`);
    }
  }
  const dailySeniorityWage = accumulatedInflated + newYearRateAddition;
  const dailyRankWage = roundMoney(priorRank * (1 + params.otherLevelsIncreasePct / 100));
  const dailyOtherBaseElements = roundMoney(priorOther * (1 + params.otherLevelsIncreasePct / 100));
  const dailyBaseWage = dailyJobWage + dailySeniorityWage + dailyRankWage + dailyOtherBaseElements;

  const monthlyJobWage = roundMoney(dailyJobWage * payableDays);
  const monthlySeniorityWage = roundMoney(dailySeniorityWage * payableDays);
  const monthlyBaseWage = roundMoney(dailyBaseWage * payableDays);
  const overtimePay = roundMoney((dailyBaseWage / params.normalDailyHoursDivisor) * params.overtimeMultiplier * overtimeHours);

  const shiftKey = SHIFT_PCT[input.shiftType ?? 'NONE'];
  const shiftPay = shiftKey ? roundMoney(monthlyBaseWage * params[shiftKey]) : 0;
  let nightWorkPay = 0;
  if (nightHours > 0) {
    if (input.shiftType && input.shiftType !== 'NONE') {
      warnings.push('کارگر نوبت‌کار مشمول فوق‌العاده شب‌کاری جداگانه (ماده ۵۸) نیست؛ محاسبه نشد.');
    } else {
      nightWorkPay = roundMoney((dailyBaseWage / params.normalDailyHoursDivisor) * params.nightWorkPct * nightHours);
    }
  }

  const wageSubtotal = monthlyBaseWage + overtimePay + shiftPay + nightWorkPay + otherAllowances + variableBenefits;

  const includeWelfare = input.includeWelfareBenefits !== false;
  const ratio = Math.min(payableDays / 30, 1);
  const groceryAllowance = includeWelfare ? roundMoney(params.groceryAllowanceMonthly * ratio) : 0;
  const housingAllowance = includeWelfare ? roundMoney(params.housingAllowanceMonthly * ratio) : 0;
  const maritalAllowance = includeWelfare && input.isMarried ? roundMoney(params.maritalAllowanceMonthly * ratio) : 0;
  const children = Number(input.eligibleChildrenCount ?? 0);
  const childAllowance = includeWelfare
    ? roundMoney(params.childAllowanceMultiplier * params.minDailyWage * children * ratio)
    : 0;
  const welfareSubtotal = groceryAllowance + housingAllowance + maritalAllowance + childAllowance;
  const grossTotal = wageSubtotal + welfareSubtotal;

  const insurableRaw =
    monthlyBaseWage + overtimePay + shiftPay + nightWorkPay + otherAllowances + variableBenefits +
    groceryAllowance + housingAllowance + maritalAllowance;
  const workerInsurance = roundMoney(insurableRaw * params.workerInsurancePct);
  const employerInsurance = roundMoney(
    insurableRaw * (params.employerInsurancePct + params.unemploymentInsurancePct),
  );

  let tax = 0;
  if (!params.taxBrackets) {
    warnings.push(
      'پلکان مالیات بر حقوق ۱۴۰۵ ثبت نشده است (وضعیت ۴)؛ مالیات صفر محاسبه شد و پیش از صدور فیش نهایی باید وارد شود.',
    );
  } else {
    tax = computeTax(insurableRaw, params.taxBrackets);
  }
  const netPayable = grossTotal - workerInsurance - tax;

  const breakdown = [
    { code: 'JOB_WAGE', title: 'مزد شغل', category: 'JOB_WAGE', daily: dailyJobWage, monthly: monthlyJobWage, formula: 'FRM-JOB-WAGE-1405', note: source === 'TABLE' ? 'جدول مزد مصوب طرح' : 'فرمول ماده ۱ دستورالعمل ۶۷۲۴' },
    { code: 'SENIORITY', title: 'پایه سنوات', category: 'SENIORITY', daily: dailySeniorityWage, monthly: monthlySeniorityWage, formula: 'FRM-SEN-TOTAL-1405', note: rateResult.available ? `نرخ گروه ${jobGroup}: ${rateResult.rate.toLocaleString('en-US')} ریال` : (rateResult.message ?? '') },
    { code: 'RANK_WAGE', title: 'مزد رتبه (سایر اجزای مزدی)', category: 'BASE_WAGE', daily: dailyRankWage, monthly: roundMoney(dailyRankWage * payableDays), formula: 'FRM-OTHER-WAGE-1405', note: 'تبصره ۲ ماده ۱' },
    { code: 'OTHER_BASE', title: 'سایر اجزای مزد مبنا', category: 'BASE_WAGE', daily: dailyOtherBaseElements, monthly: roundMoney(dailyOtherBaseElements * payableDays), formula: 'FRM-OTHER-WAGE-1405', note: 'تبصره ۲ ماده ۱' },
    { code: 'BASE_WAGE', title: 'مزد مبنا', category: 'BASE_WAGE', daily: dailyBaseWage, monthly: monthlyBaseWage, formula: 'FRM-BASE-WAGE', note: 'تبصره ۲ ماده ۳۶ قانون کار' },
    { code: 'OVERTIME', title: 'فوق‌العاده اضافه‌کاری', category: 'WAGE_ALLOWANCE', monthly: overtimePay, formula: 'FRM-OVERTIME', note: `${overtimeHours} ساعت` },
    { code: 'SHIFT', title: 'فوق‌العاده نوبت‌کاری', category: 'WAGE_ALLOWANCE', monthly: shiftPay, formula: 'FRM-SHIFT-WORK', note: input.shiftType ?? 'NONE' },
    { code: 'NIGHT', title: 'فوق‌العاده شب‌کاری', category: 'WAGE_ALLOWANCE', monthly: nightWorkPay, formula: 'FRM-NIGHT-WORK', note: `${nightHours} ساعت` },
    { code: 'OTHER_ALLOWANCES', title: 'سایر مزایای مزدی', category: 'WAGE_ALLOWANCE', monthly: otherAllowances + variableBenefits, formula: 'FRM-BASE-WAGE', note: 'قرارداد / طرح کارگاه' },
    { code: 'GROCERY', title: 'کمک‌هزینه اقلام مصرفی خانوار (بن)', category: 'WELFARE', monthly: groceryAllowance, formula: 'FRM-BASE-WAGE', note: 'بند ۳ بخشنامه ۶۶۸۲' },
    { code: 'HOUSING', title: 'کمک‌هزینه مسکن', category: 'WELFARE', monthly: housingAllowance, formula: 'FRM-BASE-WAGE', note: `نسخه ${params.version}` },
    { code: 'MARITAL', title: 'حق تأهل', category: 'WELFARE', monthly: maritalAllowance, formula: 'FRM-BASE-WAGE', note: 'بند ۴ بخشنامه ۶۶۸۲' },
    { code: 'CHILD', title: 'حق اولاد', category: 'WELFARE', monthly: childAllowance, formula: 'FRM-CHILD-ALLOWANCE', note: `${children} فرزند` },
    { code: 'WORKER_INSURANCE', title: 'کسور بیمه سهم کارگر', category: 'DEDUCTION', monthly: -workerInsurance, formula: 'FRM-INSURANCE', note: '۷٪' },
    { code: 'TAX', title: 'مالیات بر حقوق', category: 'DEDUCTION', monthly: -tax, formula: 'FRM-BASE-WAGE', note: 'قانون بودجه ۱۴۰۵ (ثبت‌نشده)' },
  ];

  return {
    currencyUnit: 'IRR',
    fiscalYear,
    periodYearMonth,
    computationDate,
    parameterVersion: params.version,
    jobGroup,
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
    newYearRateAddition,
    accumulatedInflated,
    rateAvailable: rateResult.available,
    breakdown,
    warnings,
    minimumWageCompliance: {
      compliant: dailyBaseWage >= params.minDailyWage,
      minimumDailyWage: params.minDailyWage,
      difference: dailyBaseWage - params.minDailyWage,
    },
  };
}

function computeTax(taxableMonthly, bracketsJson) {
  let brackets;
  try {
    brackets = JSON.parse(bracketsJson);
  } catch {
    return 0;
  }
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Number.POSITIVE_INFINITY;
    if (taxableMonthly > lower) {
      const taxable = Math.min(taxableMonthly, upper) - lower;
      if (taxable > 0) tax += taxable * bracket.rate;
    }
    lower = upper;
    if (!Number.isFinite(lower)) break;
  }
  return roundMoney(tax);
}

/* ------------------------------ تطبیق گروه ------------------------------ */

export function matchGroup(data, { schemeCode, score, asOfDate, tableVersion }) {
  const date = normalizeDate(asOfDate);
  const all = data.groupRanges.filter((row) => row.schemeCode === schemeCode);
  if (all.length === 0) {
    return { matched: false, group: null, range: null, tableVersion: null, warnings: [`جدول گروه‌بندی برای طرح «${schemeCode}» ثبت نشده است.`] };
  }
  let version = tableVersion;
  if (!version) {
    const versions = [...new Set(all.map((row) => row.version))].sort().reverse();
    version = versions.find((candidate) =>
      all.some((row) => row.version === candidate && inRange(date, row.effectiveFrom, row.effectiveTo)),
    );
  }
  const rows = all
    .filter((row) => row.version === version)
    .filter((row) => inRange(date, row.effectiveFrom, row.effectiveTo))
    .sort((a, b) => a.groupNumber - b.groupNumber);
  const warnings = [];
  if (rows.length === 0) {
    return { matched: false, group: null, range: null, tableVersion: version ?? null, warnings: ['نسخه جدول گروه‌ها در این تاریخ معتبر نیست.'] };
  }
  const direct = rows.find((row) => score >= row.minScore && score <= row.maxScore);
  if (direct) {
    if (direct.validityStatus !== STATUS.VERIFIED) {
      warnings.push(`وضعیت جدول گروه انتخابی: «${STATUS_LABELS[direct.validityStatus]}».`);
    }
    return { matched: true, group: direct.groupNumber, range: direct, tableVersion: version, warnings };
  }
  const last = rows[rows.length - 1];
  if (score > last.maxScore) {
    warnings.push(`امتیاز (${score}) از سقف جدول (${last.maxScore}) بیشتر است؛ گروه ${last.groupNumber} پیشنهادی است.`);
    return { matched: false, group: last.groupNumber, range: last, tableVersion: version, warnings };
  }
  warnings.push(`امتیاز (${score}) با هیچ بازه‌ای تطبیق نیافت.`);
  return { matched: false, group: null, range: null, tableVersion: version, warnings };
}

/* ------------------------------ ارزیابی امتیازی ------------------------------ */

function scoreLookup(data, { subFactorId, levelCode, dimension, asOfDate }) {
  const level = data.levels.find(
    (row) => row.subFactorId === subFactorId && row.levelCode === levelCode && row.secondaryDimensionCode === dimension,
  );
  if (!level) return null;
  const candidates = data.scores
    .filter((row) => row.levelId === level.id && inRange(asOfDate, row.effectiveFrom, row.effectiveTo))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  const score = candidates[0];
  if (!score) return null;
  let rule = null;
  if (score.rule) {
    try {
      rule = JSON.parse(score.rule);
    } catch {
      rule = null;
    }
  }
  return { level, score, rule };
}

export function evaluatePointBased(data, { systemCode, evaluationDate, selections }) {
  const date = normalizeDate(evaluationDate);
  const system = data.systems.find((row) => row.code === systemCode);
  if (!system) throw new CoreError('INVALID_ARGUMENT', `نظام ارزیابی «${systemCode}» یافت نشد.`);
  const factors = data.factors.filter((row) => row.systemCode === systemCode).sort((a, b) => a.displayOrder - b.displayOrder);
  const subFactors = data.subFactors
    .filter((row) => factors.some((factor) => factor.code === row.factorCode))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (subFactors.length === 0) {
    throw new CoreError(
      'SCORING_SYSTEM_NOT_READY',
      'زیرعامل‌ها، سطوح و امتیازات این نظام برای طرح مصوب کارگاه بارگذاری نشده است؛ امتیازدهی فعال نیست.',
    );
  }

  const theoreticalMax =
    system.maxTheoreticalScore ?? subFactors.reduce((sum, row) => sum + (row.maxScore ?? 0), 0);

  const selectionMap = new Map();
  for (const selection of selections ?? []) selectionMap.set(selection.subFactorCode, selection);

  const warnings = [];
  const unscored = [];
  const subFactorScores = [];

  for (const sub of subFactors) {
    const base = {
      subFactorCode: sub.code,
      subFactorName: sub.name,
      factorCode: sub.factorCode,
      factorName: sub.factorName,
      points: 0,
      maxScore: sub.maxScore,
      officialWeightPct: sub.officialWeightPct,
      selectionKind: selectionMap.get(sub.code)?.kind ?? 'MISSING',
      selectionDescription: '—',
      scoringMechanism: sub.scoringMechanism,
      validityStatus: sub.validityStatus,
      warnings: [],
    };

    if (!sub.scoringEnabled || sub.scoringMechanism === 'DISABLED_PENDING_OFFICIAL_TABLE') {
      base.warnings.push(`جدول رسمی سطوح این زیرعامل در دسترس نیست (وضعیت: ${STATUS_LABELS[sub.validityStatus]})؛ امتیازدهی خودکار غیرفعال است.`);
      unscored.push(sub.code);
      subFactorScores.push(base);
      warnings.push(...base.warnings);
      continue;
    }

    const selection = selectionMap.get(sub.code);
    if (!selection) {
      throw new CoreError('INVALID_ARGUMENT', `برای زیرعامل «${sub.name}» انتخاب امتیازدهی ارسال نشده است.`);
    }

    const subs = data.levels.filter((row) => row.subFactorId === sub.id);
    if (subs.length === 0) {
      base.warnings.push('سطوح این زیرعامل در طرح بارگذاری نشده است.');
      subFactorScores.push(base);
      warnings.push(...base.warnings);
      continue;
    }

    const applyScore = (found, description) => {
      base.points = found.score.points;
      base.selectionDescription = description;
      base.validityStatus = found.score.validityStatus;
      if (found.score.validityStatus !== STATUS.VERIFIED) {
        base.warnings.push('امتیاز انتخابی با وضعیت «۲. استخراج‌شده، نیازمند تطبیق» ثبت شده است.');
      }
    };

    switch (sub.scoringMechanism) {
      case 'SINGLE_DEGREE':
      case 'MATRIX_2D':
      case 'WORKSHOP_SCHEME_DEFINED': {
        const dimension = selection.secondaryDimensionCode ?? 'DEFAULT';
        const found = scoreLookup(data, { subFactorId: sub.id, levelCode: selection.levelCode, dimension, asOfDate: date });
        if (!found) {
          throw new CoreError('UNKNOWN_LEVEL', `سطح «${selection.levelCode}» برای ${sub.name} یافت نشد.`);
        }
        applyScore(found, `${found.level.title}${found.level.secondaryDimensionTitle ? ` — ${found.level.secondaryDimensionTitle}` : ''}`);
        break;
      }
      case 'DOMINANT_ACTIVITY_ROW': {
        const found = scoreLookup(data, {
          subFactorId: sub.id,
          levelCode: selection.levelCode,
          dimension: selection.hoursBracketCode,
          asOfDate: date,
        });
        if (!found) throw new CoreError('UNKNOWN_LEVEL', 'ردیف فعالیت/بازه ساعتی یافت نشد.');
        applyScore(found, `${found.level.title} — ${found.level.secondaryDimensionTitle ?? ''}`);
        break;
      }
      case 'SUPERVISION_COMPOSITE': {
        const directLevels = data.levels
          .filter((row) => row.subFactorId === sub.id && row.secondaryDimensionCode === 'DIRECT')
          .sort((a, b) => a.levelNumber - b.levelNumber);
        const indirectLevels = data.levels
          .filter((row) => row.subFactorId === sub.id && row.secondaryDimensionCode === 'INDIRECT')
          .sort((a, b) => a.levelNumber - b.levelNumber);
        let direct = 0;
        const directDetail = [];
        for (const level of directLevels) {
          const headcount = Number(selection.directHeadcountByGrade?.[level.levelCode] ?? 0);
          if (headcount <= 0) continue;
          const found = scoreLookup(data, { subFactorId: sub.id, levelCode: level.levelCode, dimension: 'DIRECT', asOfDate: date });
          const rule = found?.rule ?? {};
          const perPerson = Number(rule.pointsPerPerson ?? found?.score.points ?? 0);
          const maxPoints = Number(rule.maxPoints ?? Number.POSITIVE_INFINITY);
          const points = Math.min(headcount * perPerson, maxPoints);
          direct += points;
          directDetail.push({ grade: level.levelCode, headcount, points });
        }
        direct = Math.min(direct, 40);
        let indirect = 0;
        const indirectDetail = [];
        for (const level of indirectLevels) {
          const found = scoreLookup(data, { subFactorId: sub.id, levelCode: level.levelCode, dimension: 'INDIRECT', asOfDate: date });
          const rule = found?.rule ?? {};
          const from = Number(rule.headcountFrom ?? 1);
          const to = Number(rule.headcountTo ?? 0);
          const perPersons = Number(rule.personsPerPoint ?? 1);
          const maxPoints = Number(rule.maxPoints ?? 5);
          const count = Math.max(0, Math.min(Number(selection.indirectHeadcount ?? 0), to) - (from - 1));
          if (count <= 0) continue;
          const points = Math.min(Math.floor(count / perPersons), maxPoints);
          if (points > 0) {
            indirect += points;
            indirectDetail.push({ tier: level.levelCode, headcount: count, points });
          }
        }
        indirect = Math.min(indirect, 30);
        base.points = Math.min(direct + indirect, sub.maxScore ?? 70);
        base.selectionDescription = `مستقیم ${direct} + غیرمستقیم ${indirect} امتیاز`;
        base.details = { directDetail, indirectDetail };
        break;
      }
      case 'MULTI_ITEM_SUM_CAPPED': {
        const items = selection.items ?? [];
        if (items.length > 12) throw new CoreError('INVALID_ARGUMENT', 'تعداد اجزای محیطی از سقف ۱۲ بیشتر است.');
        let sum = 0;
        const detail = [];
        for (const item of items) {
          const found = scoreLookup(data, {
            subFactorId: sub.id,
            levelCode: item.itemCode,
            dimension: `${item.intensityCode}_${item.hoursBracketCode}`,
            asOfDate: date,
          });
          if (!found) throw new CoreError('UNKNOWN_LEVEL', `جزء محیطی ${item.itemCode} یافت نشد.`);
          sum += found.score.points;
          detail.push({ item: found.level.title, points: found.score.points });
        }
        base.points = Math.min(sum, sub.maxScore ?? 120);
        base.selectionDescription = `${items.length} جزء — مجموع ${sum}`;
        base.details = { detail };
        if (sum > base.points) base.warnings.push(`مجموع ${sum} به سقف ${base.points} محدود شد.`);
        break;
      }
      case 'INJURY_PLUS_DISEASE_CAPPED': {
        let injury = 0;
        if (selection.injuryLevelCode) {
          const found = scoreLookup(data, {
            subFactorId: sub.id,
            levelCode: selection.injuryLevelCode,
            dimension: `P_${selection.injuryProbabilityCode ?? 'LOW'}`,
            asOfDate: date,
          });
          if (!found) throw new CoreError('UNKNOWN_LEVEL', 'سطح صدمات یافت نشد.');
          injury = found.score.points;
        }
        let disease = 0;
        if (selection.diseaseProbabilityCode) {
          const found = scoreLookup(data, {
            subFactorId: sub.id,
            levelCode: 'HZ_DISEASE',
            dimension: `P_${selection.diseaseProbabilityCode}`,
            asOfDate: date,
          });
          if (!found) throw new CoreError('UNKNOWN_LEVEL', 'سطح امراض یافت نشد.');
          disease = found.score.points;
        }
        base.points = Math.min(injury + disease, sub.maxScore ?? 80);
        base.selectionDescription = `صدمات ${injury} + امراض ${disease}`;
        break;
      }
      default:
        throw new CoreError('SCORING_DISABLED', `سازوکار ${sub.scoringMechanism} پشتیبانی نمی‌شود.`);
    }

    if (sub.maxScore && base.points > sub.maxScore) {
      throw new CoreError('SCORE_EXCEEDS_SUB_FACTOR_MAX', `امتیاز ${sub.name} از سقف ${sub.maxScore} بیشتر است.`);
    }
    subFactorScores.push(base);
    warnings.push(...base.warnings);
  }

  const factorScores = factors.map((factor) => {
    const related = subFactorScores.filter((row) => row.factorCode === factor.code);
    return {
      factorCode: factor.code,
      factorName: factor.name,
      points: related.reduce((sum, row) => sum + row.points, 0),
      maxScore: factor.maxScore,
      officialWeightPct: factor.officialWeightPct,
    };
  });

  const totalScore = factorScores.reduce((sum, row) => sum + row.points, 0);
  return {
    systemCode: system.code,
    systemVersion: system.version,
    evaluationDate: date,
    currencyUnit: 'IRR',
    totalScore,
    maxTheoreticalScore: theoreticalMax,
    factorScores,
    subFactorScores,
    warnings,
    scoringComplete: unscored.length === 0,
    unscoredSubFactors: unscored,
  };
}
