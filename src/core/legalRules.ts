/**
 * قواعد و جدول‌های مکمل قانونی که در موتور ارزیابی/مزد استفاده می‌شوند:
 * - جدول رسمی کسر سابقه کار بابت کمبود تحصیل (پیوست دستورالعمل شماره ۲۰)  [۱. مستند و قابل استفاده]
 * - معادل‌سازی ساعات آموزش فنی و حرفه‌ای (بخشنامه ۱۱۸۹۴)                    [۱. مستند و قابل استفاده]
 * - دامنه مجاز گروه شغلی بر حسب مدرک تحصیلی شرط احراز                        [۲. استخراج‌شده ولی نیازمند تطبیق]
 * - کنترل سلسله‌مراتب امتیاز سرپرستی                                          [۱. مستند و قابل استفاده]
 */

import { VALIDITY_STATUS, type ValidityStatus } from './status.ts';

/** نوع مدرک تحصیلی (مبنای جدول‌های پیوست دستورالعمل ۲۰) */
export type EducationCategory =
  | 'BI_SWAD'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'ELEMENTARY'
  | 'G7'
  | 'G8'
  | 'SECYCLE'
  | 'G10'
  | 'G11'
  | 'G12'
  | 'DIPLOMA'
  | 'ASSOCIATE'
  | 'BACHELOR'
  | 'MASTER'
  | 'PHD';

export const EDUCATION_CATEGORY_LABELS: Record<EducationCategory, string> = {
  BI_SWAD: 'بی‌سواد',
  P1: 'اول دبستان',
  P2: 'دوم دبستان',
  P3: 'سوم دبستان',
  P4: 'چهارم دبستان',
  P5: 'پنجم دبستان (قدیم)',
  ELEMENTARY: 'پایان دوره ابتدایی',
  G7: 'اول راهنمایی / اول دبیرستان قدیم',
  G8: 'دوم راهنمایی / دوم دبیرستان قدیم',
  SECYCLE: 'سیکل (پایان دوره اول متوسطه)',
  G10: 'اول دبیرستان جدید',
  G11: 'دوم دبیرستان جدید / چهارم قدیم',
  G12: 'سوم دبیرستان جدید / پنجم قدیم',
  DIPLOMA: 'دیپلم',
  ASSOCIATE: 'فوق‌دیپلم (کاردانی)',
  BACHELOR: 'لیسانس (کارشناسی)',
  MASTER: 'فوق‌لیسانس / دکترای حرفه‌ای',
  PHD: 'دکترای تخصصی',
};

export type RequiredEducationColumn = 'READ' | 'READ_WRITE' | 'ELEMENTARY' | 'SECYCLE' | 'DIPLOMA';

export const REQUIRED_EDUCATION_LABELS: Record<RequiredEducationColumn, string> = {
  READ: 'خواندن',
  READ_WRITE: 'خواندن و نوشتن',
  ELEMENTARY: 'پایان ابتدایی',
  SECYCLE: 'پایان دوره اول متوسطه (سیکل)',
  DIPLOMA: 'دیپلم',
};

/**
 * جدول رسمی کسر سابقه کار (سال) بابت کمبود تحصیل — پیوست دستورالعمل شماره ۲۰ روابط کار.
 * سطر = مدرک فعلی شاغل، ستون = حداقل مدرک شرط احراز شغل. مقدار null یعنی «—» (کسر سابقه ندارد).
 */
export const EDUCATION_SHORTAGE_DEDUCTION: {
  sourceStatus: ValidityStatus;
  table: Record<EducationCategory, Record<RequiredEducationColumn, number | null>>;
} = {
  sourceStatus: VALIDITY_STATUS.VERIFIED_USABLE,
  table: {
    BI_SWAD: { READ: 1, READ_WRITE: 2, ELEMENTARY: 3, SECYCLE: 6, DIPLOMA: 9 },
    P1: { READ: 0.5, READ_WRITE: 1.5, ELEMENTARY: 2.5, SECYCLE: 5.5, DIPLOMA: 8.5 },
    P2: { READ: null, READ_WRITE: 1, ELEMENTARY: 2, SECYCLE: 5, DIPLOMA: 8 },
    P3: { READ: null, READ_WRITE: 0.5, ELEMENTARY: 1.5, SECYCLE: 4.5, DIPLOMA: 7.5 },
    P4: { READ: null, READ_WRITE: null, ELEMENTARY: 1, SECYCLE: 4, DIPLOMA: 7 },
    P5: { READ: null, READ_WRITE: null, ELEMENTARY: 0.5, SECYCLE: 3.5, DIPLOMA: 6.5 },
    ELEMENTARY: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: 3, DIPLOMA: 6 },
    G7: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: 2, DIPLOMA: 5 },
    G8: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: 1, DIPLOMA: 4 },
    SECYCLE: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: 3 },
    G10: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: 2.5 },
    G11: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: 2 },
    G12: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: 1 },
    DIPLOMA: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: null },
    ASSOCIATE: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: null },
    BACHELOR: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: null },
    MASTER: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: null },
    PHD: { READ: null, READ_WRITE: null, ELEMENTARY: null, SECYCLE: null, DIPLOMA: null },
  },
};

/** محاسبه سال کسر سابقه بابت کمبود تحصیل (null = کسر ندارد / مستلزم بررسی طرح مصوب) */
export function educationShortageDeductionYears(
  current: EducationCategory,
  required: RequiredEducationColumn,
): { years: number | null; status: ValidityStatus; note: string } {
  if (required === 'DIPLOMA' && ['ASSOCIATE', 'BACHELOR', 'MASTER', 'PHD'].includes(current) === false) {
    // جدول فقط تا سطح دیپلم را پوشش می‌دهد
  }
  const row = EDUCATION_SHORTAGE_DEDUCTION.table[current];
  if (!row) {
    return { years: null, status: VALIDITY_STATUS.INSUFFICIENT_DOCUMENTATION, note: 'مدرک تحصیلی ناشناخته.' };
  }
  const years = row[required];
  if (years === null) {
    return {
      years: 0,
      status: VALIDITY_STATUS.VERIFIED_USABLE,
      note: 'مطابق جدول پیوست دستورالعمل ۲۰، کسر سابقه‌ای برای این ترکیب پیش‌بینی نشده است.',
    };
  }
  return {
    years,
    status: EDUCATION_SHORTAGE_DEDUCTION.sourceStatus,
    note: 'مطابق جدول رسمی پیوست دستورالعمل شماره ۲۰ روابط کار.',
  };
}

/** سال‌های تحصیل معادل هر مدرک (برای جایگزینی تحصیل مازاد با تجربه) */
export const EDUCATION_YEARS: Record<EducationCategory, number> = {
  BI_SWAD: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  ELEMENTARY: 6,
  G7: 7,
  G8: 8,
  SECYCLE: 9,
  G10: 10,
  G11: 11,
  G12: 12,
  DIPLOMA: 12,
  ASSOCIATE: 14,
  BACHELOR: 16,
  MASTER: 18,
  PHD: 22,
};

/* ------------------------- معادل‌سازی آموزش مهارت ------------------------- */

/** هر ۱۰ ساعت آموزش مهارت = ۱ امتیاز نظام ارزیابی (بخشنامه ۱۱۸۹۴) */
export function tvtoHoursToScore(hours: number): number {
  if (hours < 0) throw new Error('ساعت آموزش نمی‌تواند منفی باشد.');
  return hours / 10;
}

/** هر ۱۲۰ ساعت آموزش مهارت = ۱ سال تجربه (سقف عادی ۶ سال؛ تخصصی تا ۸ سال) */
export function tvtoHoursToExperienceYears(hours: number, specialized = false): number {
  if (hours < 0) throw new Error('ساعت آموزش نمی‌تواند منفی باشد.');
  const cap = specialized ? 8 : 6;
  return Math.min(hours / 120, cap);
}

/* --------------------- دامنه مجاز گروه بر حسب مدرک تحصیلی --------------------- */

export const EDUCATION_GROUP_BOUNDS: {
  status: ValidityStatus;
  bounds: Record<RequiredEducationColumn | 'ASSOCIATE' | 'BACHELOR', { min: number; max: number }>;
} = {
  status: VALIDITY_STATUS.EXTRACTED_NEEDS_VERIFICATION,
  bounds: {
    READ: { min: 1, max: 14 },
    READ_WRITE: { min: 1, max: 14 },
    ELEMENTARY: { min: 1, max: 14 },
    SECYCLE: { min: 5, max: 14 },
    DIPLOMA: { min: 6, max: 15 },
    ASSOCIATE: { min: 7, max: 17 },
    BACHELOR: { min: 8, max: 20 },
  },
};

export function educationGroupBounds(requiredEducation: RequiredEducationColumn | 'ASSOCIATE' | 'BACHELOR') {
  return EDUCATION_GROUP_BOUNDS.bounds[requiredEducation];
}

/* --------------------------- کنترل سلسله‌مراتب سرپرستی --------------------------- */

export function supervisionHierarchyCheck(superiorScore: number, subordinateScore: number) {
  const requiredMinimum = subordinateScore * 1.2;
  return {
    compliant: superiorScore >= requiredMinimum,
    requiredMinimum,
    gap: Math.max(0, requiredMinimum - superiorScore),
  };
}

/* -------------------------------- شمارش رتبه -------------------------------- */

export interface RankCountInput {
  serviceYears: number;
  educationSurplusYears?: number;
  tvtoEquivalentYears?: number;
  requiredExperienceYears: number;
  deductedYears?: number;
  rankIntervalYears?: number;
}

/** تعداد رتبه استحقاقی بر مبنای ماده ۱۴ و تبصره‌های آن */
export function countEligibleRanks(input: RankCountInput): number {
  const interval = input.rankIntervalYears ?? 4;
  const effectiveYears =
    input.serviceYears +
    (input.educationSurplusYears ?? 0) +
    (input.tvtoEquivalentYears ?? 0) -
    input.requiredExperienceYears -
    (input.deductedYears ?? 0);
  if (effectiveYears < 0) return 0;
  return Math.floor(effectiveYears / interval);
}

/** مبلغ روزانه هر رتبه = تفاوت امتیاز دو گروه متوالی × ضریب ریالی طرح (ماده ۱۶) */
export function rankDailyWage(consecutiveDelta: number, rialCoefficient: number): number {
  return Math.round(consecutiveDelta * rialCoefficient);
}

/** فرمول رسمی محاسبه ضریب ریالی جدول مزد در زمان تدوین طرح */
export function computeRialCoefficient(params: {
  secondGroupWage: number;
  totalGroups: number;
  baseFloorWage: number;
  priorAdjustmentSum?: number;
  groups: Array<{ group: number; excessOverGroup1: number }>;
}): number {
  const denominator = params.groups.reduce((sum, item) => sum + item.excessOverGroup1, 0);
  if (denominator <= 0) throw new Error('مخرج فرمول ضریب ریالی نامعتبر است.');
  const numerator =
    params.secondGroupWage - params.totalGroups * params.baseFloorWage - (params.priorAdjustmentSum ?? 0);
  return numerator / denominator;
}
