/**
 * بذر کامل سیستم B — نظام امتیازی چهارعاملی مصوب ۱۳۸۹/۰۵/۱۸ (۴ عامل، ۱۴ زیرعامل، ۱٬۱۳۷ امتیاز).
 * تمامی سطوح و امتیازات مستقیماً از جدول‌های رسمی مصوبه استخراج شده است.
 * اقلامی که جدول رسمی آنها در دسترس نبود، با وضعیت «۳. فاقد مستند کافی» و امتیازدهی غیرفعال ثبت شده‌اند.
 */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';
import { getLegalDocumentId } from './legalDocuments.ts';

export const SYSTEM_B_CODE = 'EVAL_1389_POINT_FACTOR';
export const SYSTEM_B_VERSION = '1389.1';
export const SYSTEM_B_SCORE_VERSION = '1389.1';
export const SYSTEM_B_SCHEME = 'NATIONAL_20_GROUP_1389';
export const SYSTEM_B_EFFECTIVE_FROM = '1389-05-18';

const V = VALIDITY_STATUS;

interface LevelSeed {
  code: string;
  num: number;
  title: string;
  dim?: string;
  dimTitle?: string;
  criteria?: string;
  tvto?: number | null;
  points: number;
  status?: string;
  rule?: Record<string, unknown> | null;
}

interface SubFactorSeed {
  code: string;
  name: string;
  order: number;
  maxScore: number;
  weightPct: number;
  mechanism:
    | 'SINGLE_DEGREE'
    | 'MATRIX_2D'
    | 'SUPERVISION_COMPOSITE'
    | 'DOMINANT_ACTIVITY_ROW'
    | 'MULTI_ITEM_SUM_CAPPED'
    | 'INJURY_PLUS_DISEASE_CAPPED'
    | 'WORKSHOP_SCHEME_DEFINED'
    | 'DISABLED_PENDING_OFFICIAL_TABLE';
  enabled: boolean;
  definition: string;
  applicationRule?: string;
  status: string;
  levels: LevelSeed[];
}

interface FactorSeed {
  code: string;
  name: string;
  order: number;
  maxScore: number;
  weightPct: number;
  definition: string;
  subFactors: SubFactorSeed[];
}

/* ------------------------------------------------------------------------- */
/* ابزارهای ساخت سطوح ماتریسی                                                 */
/* ------------------------------------------------------------------------- */

const PROBABILITY_DIMS = [
  { code: 'P_LOW', title: 'به ندرت (کم)' },
  { code: 'P_MEDIUM', title: 'گاهی (متوسط)' },
  { code: 'P_HIGH', title: 'غالباً (زیاد)' },
];

function matrixLevels(
  rows: Array<{ code: string; title: string; values: number[] }>,
  dims: Array<{ code: string; title: string }>,
): LevelSeed[] {
  const levels: LevelSeed[] = [];
  rows.forEach((row, index) => {
    dims.forEach((dim, dimIndex) => {
      levels.push({
        code: row.code,
        num: index + 1,
        title: row.title,
        dim: dim.code,
        dimTitle: dim.title,
        points: row.values[dimIndex] as number,
      });
    });
  });
  return levels;
}

/* ------------------------------------------------------------------------- */
/* عوامل و زیرعامل‌ها                                                          */
/* ------------------------------------------------------------------------- */

const EDUCATION_DEGREES: LevelSeed[] = [
  { code: 'EDU_0', num: 1, title: 'بی‌سواد', points: 0, tvto: null },
  { code: 'EDU_I01', num: 2, title: 'اول دبستان', dim: 'INTERMEDIATE', points: 6 },
  { code: 'EDU_I02', num: 3, title: 'دوم دبستان', dim: 'INTERMEDIATE', points: 12 },
  { code: 'EDU_I03', num: 4, title: 'سوم دبستان', dim: 'INTERMEDIATE', points: 18 },
  { code: 'EDU_I04', num: 5, title: 'چهارم دبستان', dim: 'INTERMEDIATE', points: 24 },
  { code: 'EDU_I05', num: 6, title: 'پنجم دبستان (قدیم)', dim: 'INTERMEDIATE', points: 30 },
  { code: 'EDU_1', num: 7, title: 'پایان دوره ابتدایی (ششم قدیم / پنجم جدید)', points: 36, tvto: 360 },
  { code: 'EDU_I07', num: 8, title: 'اول راهنمایی / اول دبیرستان قدیم', dim: 'INTERMEDIATE', points: 48 },
  { code: 'EDU_I08', num: 9, title: 'دوم راهنمایی / دوم دبیرستان قدیم', dim: 'INTERMEDIATE', points: 60 },
  { code: 'EDU_2', num: 10, title: 'سیکل (پایان دوره اول متوسطه / سوم راهنمایی)', points: 72, tvto: 720 },
  { code: 'EDU_I10', num: 11, title: 'اول دبیرستان (جدید)', dim: 'INTERMEDIATE', points: 78 },
  { code: 'EDU_I11', num: 12, title: 'دوم دبیرستان جدید / چهارم قدیم', dim: 'INTERMEDIATE', points: 84 },
  { code: 'EDU_I12', num: 13, title: 'سوم دبیرستان جدید / پنجم قدیم', dim: 'INTERMEDIATE', points: 96 },
  { code: 'EDU_3', num: 14, title: 'دیپلم (چهارم دبیرستان جدید / ششم قدیم)', points: 108, tvto: 1080 },
  { code: 'EDU_4', num: 15, title: 'فوق‌دیپلم (کاردانی)', points: 144, tvto: 1440 },
  { code: 'EDU_5', num: 16, title: 'لیسانس (کارشناسی)', points: 180, tvto: 1800 },
  { code: 'EDU_6', num: 17, title: 'فوق‌لیسانس (کارشناسی ارشد و دکترای حرفه‌ای)', points: 216, tvto: 360 },
  { code: 'EDU_7', num: 18, title: 'دکترای تخصصی (Ph.D)', points: 252, tvto: null },
];

const EXPERIENCE_LEVELS: LevelSeed[] = Array.from({ length: 11 }, (_, index) => ({
  code: `EXP_${index}`,
  num: index,
  title: index === 0 ? 'بدون نیاز به تجربه قبلی' : `${index} سال تجربه مفید`,
  points: index * 12,
  tvto: index * 120,
}));

const SUPERVISION_DIRECT_GRADES = [
  { code: 'G1', title: 'درجه ۱ — کارکنان تولید، مهندسی، انبارها و امثالهم', perPerson: 1, max: 10 },
  { code: 'G2', title: 'درجه ۲ — کارکنان متخصص و فنی سطح بالا و اپراتورهای دستگاه‌های مهم', perPerson: 2, max: 16 },
  { code: 'G3', title: 'درجه ۳ — رؤسای بخش‌ها، معاونین ادارات و کارکنان ارشد', perPerson: 3, max: 30 },
  {
    code: 'G4',
    title: 'درجه ۴ — رؤسای ادارات (حسابداری، کارگزینی، مهندسی صنایع، کنترل کیفیت، آزمایشگاه)',
    perPerson: 4,
    max: 36,
  },
  {
    code: 'G5',
    title: 'درجه ۵ — مدیران ادارات مهم که مستقیماً به مدیرعامل گزارش می‌دهند',
    perPerson: 5,
    max: 40,
  },
];

const SUPERVISION_INDIRECT_TIERS = [
  { code: 'T1', title: 'تا ۱۰ نفر افراد تحت سرپرستی غیرمستقیم', from: 1, to: 10, perPersons: 2 },
  { code: 'T2', title: '۲۰ نفر بعدی (۱۱ تا ۳۰ نفر)', from: 11, to: 30, perPersons: 4 },
  { code: 'T3', title: '۴۰ نفر بعدی (۳۱ تا ۷۰ نفر)', from: 31, to: 70, perPersons: 8 },
  { code: 'T4', title: '۸۰ نفر بعدی (۷۱ تا ۱۵۰ نفر)', from: 71, to: 150, perPersons: 16 },
  { code: 'T5', title: '۱۶۰ نفر بعدی (۱۵۱ تا ۳۱۰ نفر)', from: 151, to: 310, perPersons: 32 },
  { code: 'T6', title: '۳۲۰ نفر بعدی (۳۱۱ تا ۶۳۰ نفر)', from: 311, to: 630, perPersons: 64 },
];

const MENTAL_EFFORT_ROWS = Array.from({ length: 7 }, (_, index) => ({
  code: `L${index + 1}`,
  title: `سطح ${index + 1} کوشش فکری`,
  values: [(index * 3 + 1) * 5, (index * 3 + 2) * 5, (index * 3 + 3) * 5],
}));

const MENTAL_EFFORT_TITLES = [
  'کاربرد مهارت‌ها و روش‌های ساده و تکراری، دقت معمولی یا ابزار اندازه‌گیری ساده',
  'کاربرد مهارت‌ها و روش‌های متعدد یا پیچیده، تمرکز حواس زیاد یا ابزار دقیق',
  'تجزیه و تحلیل مسائل و روش‌های مختلف و اتخاذ تصمیم برای تغییر یا تطبیق موارد مهم',
  'طراحی یا تدوین روش‌های مختلف، مواجهه با مسائل پیچیده، ابتکار، خلاقیت و قضاوت',
  'مواجهه با مسائل پیچیده و برنامه‌ریزی و اتخاذ تصمیم در حد واحد سازمانی',
  'اتخاذ تصمیم در موارد مختلف و تغییر برنامه و خط‌مشی جهت واحدهای مختلف سازمانی',
  'اتخاذ تصمیم در موارد مختلف کلان و تغییر خط‌مشی کلی سازمان',
];

const HOUR_BRACKETS = [
  { code: 'H1', title: 'تا ۱ ساعت' },
  { code: 'H2', title: 'تا ۲ ساعت' },
  { code: 'H3', title: 'تا ۳ ساعت' },
  { code: 'H4', title: 'تا ۴ ساعت' },
  { code: 'H5', title: 'تا ۵ ساعت' },
  { code: 'H6', title: 'تا ۶ ساعت' },
  { code: 'H7', title: 'تا ۷ ساعت' },
  { code: 'H8', title: 'بالای ۷ ساعت' },
];

const PHYSICAL_ROWS = [
  { code: 'PHY_1', title: 'بالا و پایین رفتن، خم و راست شدن و یا راه رفتن', values: [0, 0, 5, 10, 15, 20, 30, 40] },
  { code: 'PHY_2', title: 'ایستادن', values: [0, 0, 10, 15, 20, 30, 40, 50] },
  { code: 'PHY_3', title: 'تمرکز قوای سمعی و بصری', values: [0, 5, 10, 15, 20, 30, 40, 50] },
  { code: 'PHY_4', title: 'نشستن مداوم جهت کار با ماشین', values: [0, 0, 0, 10, 15, 20, 25, 30] },
  { code: 'PHY_5', title: 'حرکات بدنی مستلزم صرف نیروی جسمانی', values: [0, 0, 15, 20, 25, 30, 35, 40] },
  { code: 'PHY_6A', title: 'جابه‌جا کردن یا حمل اشیا بدون وسیله: ۱۰ تا ۲۰ کیلوگرم', values: [0, 10, 15, 20, 25, 30, 40, 50] },
  { code: 'PHY_6B', title: 'جابه‌جا کردن یا حمل اشیا بدون وسیله: ۲۱ تا ۳۰ کیلوگرم', values: [10, 15, 20, 25, 30, 40, 50, 60] },
  { code: 'PHY_6C', title: 'جابه‌جا کردن یا حمل اشیا بدون وسیله: ۳۱ کیلوگرم به بالا', values: [15, 20, 30, 40, 50, 60, 70, 80] },
  { code: 'PHY_7A', title: 'هل دادن یا حمل‌ونقل اشیا با وسیله: ۱۰۰ تا ۲۰۰ کیلوگرم', values: [0, 0, 5, 10, 15, 20, 25, 30] },
  { code: 'PHY_7B', title: 'هل دادن یا حمل‌ونقل اشیا با وسیله: ۲۰۱ تا ۳۰۰ کیلوگرم', values: [0, 5, 10, 15, 20, 25, 30, 40] },
  { code: 'PHY_7C', title: 'هل دادن یا حمل‌ونقل اشیا با وسیله: ۳۰۱ کیلوگرم به بالا', values: [5, 10, 15, 20, 25, 30, 40, 50] },
];

const ENVIRONMENT_ITEMS = [
  { code: 'ENV_SMOKE', title: 'دود، بخار، گاز' },
  { code: 'ENV_DIRT', title: 'محیط کثیف' },
  { code: 'ENV_DUST', title: 'گرد و غبار' },
  { code: 'ENV_NOISE', title: 'سر و صدا' },
  { code: 'ENV_HUMIDITY', title: 'رطوبت' },
  { code: 'ENV_TEMP', title: 'گرما و سرما' },
  { code: 'ENV_LIGHT', title: 'نور (کم یا شدید)' },
  { code: 'ENV_ODOR', title: 'بوی نامطبوع' },
  { code: 'ENV_ISOLATION', title: 'تنهایی' },
  { code: 'ENV_VIBRATION', title: 'لرزش و ارتعاش' },
  { code: 'ENV_HEIGHT', title: 'کار در ارتفاع (سایر عوامل نامساعد تأییدشده در کاربینی)' },
  { code: 'ENV_DEPTH', title: 'کار در اعماق زمین یا آب (سایر عوامل نامساعد تأییدشده در کاربینی)' },
];

const ENVIRONMENT_INTENSITIES = [
  { code: 'MODERATE', title: 'متوسط', values: [0, 1, 2, 3] },
  { code: 'HIGH', title: 'زیاد', values: [1, 2, 4, 6] },
  { code: 'SEVERE', title: 'شدید', values: [2, 6, 8, 10] },
];

const ENVIRONMENT_BRACKETS = [
  { code: 'B2', title: 'تا ۲ ساعت' },
  { code: 'B4', title: 'تا ۴ ساعت' },
  { code: 'B6', title: 'تا ۶ ساعت' },
  { code: 'B8', title: 'بیش از ۶ ساعت' },
];

function buildEnvironmentLevels(): LevelSeed[] {
  const levels: LevelSeed[] = [];
  ENVIRONMENT_ITEMS.forEach((item, itemIndex) => {
    const itemStatus = item.code === 'ENV_HEIGHT' || item.code === 'ENV_DEPTH' ? V.EXTRACTED_NEEDS_VERIFICATION : V.VERIFIED_USABLE;
    ENVIRONMENT_INTENSITIES.forEach((intensity) => {
      ENVIRONMENT_BRACKETS.forEach((bracket, bracketIndex) => {
        levels.push({
          code: item.code,
          num: itemIndex + 1,
          title: item.title,
          dim: `${intensity.code}_${bracket.code}`,
          dimTitle: `شدت ${intensity.title} — ${bracket.title}`,
          points: intensity.values[bracketIndex] as number,
          status: itemStatus,
        });
      });
    });
  });
  return levels;
}

function buildHazardLevels(): LevelSeed[] {
  const injuries = [
    { code: 'HZ_INJ_1', title: 'صدمات یا جراحات سطحی', values: [2, 4, 8] },
    { code: 'HZ_INJ_2', title: 'صدمات یا جراحات عمقی', values: [10, 12, 16] },
    { code: 'HZ_INJ_3', title: 'نقص عضو جزئی', values: [18, 20, 24] },
    { code: 'HZ_INJ_4', title: 'نقص عضو کلی', values: [26, 28, 32] },
    { code: 'HZ_INJ_5', title: 'ازکارافتادگی یا فوت', values: [34, 36, 40] },
  ];
  const levels: LevelSeed[] = [];
  injuries.forEach((injury, index) => {
    ['LOW', 'MEDIUM', 'HIGH'].forEach((prob, probIndex) => {
      levels.push({
        code: injury.code,
        num: index + 1,
        title: injury.title,
        dim: `P_${prob}`,
        dimTitle: prob === 'LOW' ? 'احتمال کم' : prob === 'MEDIUM' ? 'احتمال متوسط' : 'احتمال زیاد',
        points: injury.values[probIndex] as number,
      });
    });
  });
  const diseaseValues = [
    { dim: 'P_LOW', title: 'احتمال کم', points: 10 },
    { dim: 'P_MEDIUM', title: 'احتمال متوسط', points: 20 },
    { dim: 'P_HIGH', title: 'احتمال زیاد', points: 30 },
    { dim: 'P_VERY_HIGH', title: 'احتمال خیلی زیاد', points: 40 },
  ];
  diseaseValues.forEach((d) => {
    levels.push({
      code: 'HZ_DISEASE',
      num: 6,
      title: 'امراض ناشی از کار',
      dim: d.dim,
      dimTitle: d.title,
      points: d.points,
    });
  });
  return levels;
}

const FACTORS: FactorSeed[] = [
  {
    code: 'SYS_B_F1',
    name: 'مهارت‌ها',
    order: 1,
    maxScore: 372,
    weightPct: 32.7,
    definition: 'مجموع معلومات نظری و مهارت‌های عملی لازم برای احراز و انجام وظایف شغل.',
    subFactors: [
      {
        code: 'EDU',
        name: 'تحصیل',
        order: 1,
        maxScore: 252,
        weightPct: 22.2,
        mechanism: 'SINGLE_DEGREE',
        enabled: true,
        definition:
          'تحصیل عبارت است از حداقل معلومات لازم جهت تصدی و انجام وظایف هر شغل که بر طبق یکی از مقاطع ابتدایی، راهنمایی، دبیرستانی و دانشگاهی مشخص می‌شود.',
        applicationRule:
          'ملاک تخصیص امتیاز، حداقل مدرک تحصیلی لازم در شناسنامه شغل است. گواهی‌نامه‌های مهارت سازمان آموزش فنی و حرفه‌ای بابت جایگزینی کمبود شرایط احراز شغل از نظر تحصیل قابل احتساب است (بخشنامه ۱۱۸۹۴).',
        status: V.VERIFIED_USABLE,
        levels: EDUCATION_DEGREES,
      },
      {
        code: 'EXP',
        name: 'تجربه',
        order: 2,
        maxScore: 120,
        weightPct: 10.5,
        mechanism: 'SINGLE_DEGREE',
        enabled: true,
        definition:
          'تجربه عبارت است از حداقل زمان لازم برای احراز مهارت عملی مورد نیاز شغل که در سطوح مادون یا مشاغل همتراز به دست می‌آید.',
        applicationRule:
          'هر ۱۲۰ ساعت گواهی‌نامه مهارت سازمان آموزش فنی و حرفه‌ای معادل یک سال تجربه (بخشنامه ۱۱۸۹۴)؛ سقف احتساب ۶ سال و در مشاغل تخصصی تا ۸ سال با نظر کمیته.',
        status: V.VERIFIED_USABLE,
        levels: EXPERIENCE_LEVELS,
      },
    ],
  },
  {
    code: 'SYS_B_F2',
    name: 'مسئولیت‌ها',
    order: 2,
    maxScore: 380,
    weightPct: 33.4,
    definition: 'تعهدات و الزامات شاغل در قبال افراد، مواد، ماشین‌آلات، منابع مالی و اطلاعات سازمان.',
    subFactors: [
      {
        code: 'SUP',
        name: 'سرپرستی',
        order: 3,
        maxScore: 70,
        weightPct: 6.2,
        mechanism: 'SUPERVISION_COMPOSITE',
        enabled: true,
        definition:
          'عبارت است از نظارت و رسیدگی، کمک و ارشاد، تعلیم، هماهنگی و تقسیم کار افراد تحت سرپرستی به منظور انجام صحیح کار.',
        applicationRule:
          'سرپرستی مستقیم حداکثر ۴۰ امتیاز (به ازای هر نفر بر حسب درجه افراد) و سرپرستی غیرمستقیم حداکثر ۳۰ امتیاز (پلکانی)؛ امتیاز سرپرستی پست مافوق نباید از ۱٫۲ برابر امتیاز رده مادون کمتر باشد.',
        status: V.VERIFIED_USABLE,
        levels: [
          ...SUPERVISION_DIRECT_GRADES.map((grade, index) => ({
            code: grade.code,
            num: index + 1,
            title: grade.title,
            dim: 'DIRECT',
            dimTitle: 'سرپرستی مستقیم',
            points: grade.perPerson,
            rule: { kind: 'PER_PERSON_CAPPED', pointsPerPerson: grade.perPerson, maxPoints: grade.max },
          })),
          ...SUPERVISION_INDIRECT_TIERS.map((tier, index) => ({
            code: tier.code,
            num: index + 1,
            title: tier.title,
            dim: 'INDIRECT',
            dimTitle: 'سرپرستی غیرمستقیم (پلکانی)',
            points: 1,
            rule: {
              kind: 'TIERED_HEADCOUNT',
              personsPerPoint: tier.perPersons,
              headcountFrom: tier.from,
              headcountTo: tier.to,
              maxPoints: 5,
            },
          })),
        ],
      },
      {
        code: 'SAF_OTH',
        name: 'مسئولیت ایمنی دیگران',
        order: 4,
        maxScore: 30,
        weightPct: 2.6,
        mechanism: 'DISABLED_PENDING_OFFICIAL_TABLE',
        enabled: false,
        definition:
          'عبارت است از دقت در جلوگیری از بروز حوادث و مخاطرات جسمی در حین انجام کار برای دیگران.',
        applicationRule:
          'سقف رسمی ۳۰ امتیاز (۲٫۶٪) مستند است، اما جدول تفکیکی سطوح و امتیازات جزئی این زیرعامل در نسخه رسمی در دسترس نبود؛ امتیازدهی خودکار تا بارگذاری جدول رسمی غیرفعال است.',
        status: V.INSUFFICIENT_DOCUMENTATION,
        levels: [],
      },
      {
        code: 'MAT_PRD',
        name: 'مسئولیت مواد و محصول',
        order: 5,
        maxScore: 30,
        weightPct: 2.6,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از مسئولیت دقت در نگهداری و استفاده مؤثر و صحیح در کاربرد، وصول، صدور و جابه‌جا کردن و حفاظت مواد و محصول که مستقیماً در اختیار شاغل قرار می‌گیرد.',
        applicationRule: 'سطح دقت لازم در جلوگیری از خسارت یا ضایعات غیرمتعارف × احتمال وقوع (به‌ندرت/گاهی/غالباً).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — دقت لازم به میزان کم', values: [2, 4, 6] },
            { code: 'L2', title: 'سطح ۲ — دقت لازم به میزان متوسط', values: [8, 10, 14] },
            { code: 'L3', title: 'سطح ۳ — دقت لازم به میزان زیاد', values: [16, 18, 22] },
            { code: 'L4', title: 'سطح ۴ — دقت لازم به میزان بسیار زیاد', values: [24, 26, 30] },
          ],
          PROBABILITY_DIMS,
        ),
      },
      {
        code: 'MCH_EQP',
        name: 'مسئولیت ماشین‌آلات، تجهیزات و ابزار',
        order: 6,
        maxScore: 30,
        weightPct: 2.6,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از مسئولیت مستقیم و غیرمستقیم دقت در تنظیم، به کارگیری، نگهداری، تعمیرات و برنامه‌ریزی ماشین‌آلات، تجهیزات و ابزاری که در اختیار شاغل قرار گرفته است.',
        applicationRule: 'سطح دقت مورد نیاز × احتمال وارد شدن خسارت و اثر آن در کار کارگاه.',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — دقت لازم به میزان کم', values: [2, 4, 6] },
            { code: 'L2', title: 'سطح ۲ — دقت لازم به میزان متوسط', values: [8, 10, 14] },
            { code: 'L3', title: 'سطح ۳ — دقت لازم به میزان زیاد', values: [16, 18, 22] },
            { code: 'L4', title: 'سطح ۴ — دقت لازم به میزان بسیار زیاد', values: [24, 26, 30] },
          ],
          PROBABILITY_DIMS,
        ),
      },
      {
        code: 'COM_REL',
        name: 'تماس و ارتباط با دیگران',
        order: 7,
        maxScore: 40,
        weightPct: 3.5,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از مسئولیت ارتباط با دیگران بر حسب الزامات شغل به منظور انجام صحیح وظایف و رفع مشکلات کار.',
        applicationRule: 'سطح حدود مسئولیت ارتباط × درجه پیچیدگی (کم/متوسط/زیاد).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — تماس با همکاران و ارباب‌رجوع جهت وظایف جاری', values: [4, 7, 10] },
            { code: 'L2', title: 'سطح ۲ — ارتباط با سایر واحدهای سازمانی', values: [13, 16, 19] },
            {
              code: 'L3',
              title: 'سطح ۳ — تماس و مذاکره با افراد خارج از سازمان جهت اهداف معین',
              values: [22, 25, 28],
            },
            {
              code: 'L4',
              title: 'سطح ۴ — تماس و مذاکره با ادارات و سازمان‌ها در داخل و خارج از کشور',
              values: [32, 36, 40],
            },
          ],
          [
            { code: 'C_LOW', title: 'درجه کم' },
            { code: 'C_MEDIUM', title: 'درجه متوسط' },
            { code: 'C_HIGH', title: 'درجه زیاد' },
          ],
        ),
      },
      {
        code: 'FIN_AST',
        name: 'مسئولیت مالی و دارایی',
        order: 8,
        maxScore: 60,
        weightPct: 5.3,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'مسئولیت‌های مربوط به دریافت و پرداخت یا کنترل و نگهداری وجوه نقد، اوراق بهادار، اسناد و اموال و هرگونه مسئولیت بررسی، پیشنهاد، محاسبه، برنامه‌ریزی و تصمیم‌گیری در امور مالی، بودجه و اعتبارات.',
        applicationRule: 'سطح حجم عملیات مالی کارگاه × احتمال وقوع (کم/متوسط/زیاد).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — حجم عملیات مالی بسیار کم', values: [4, 8, 12] },
            { code: 'L2', title: 'سطح ۲ — حجم عملیات مالی کم', values: [16, 20, 24] },
            { code: 'L3', title: 'سطح ۳ — حجم عملیات مالی متوسط', values: [28, 32, 36] },
            { code: 'L4', title: 'سطح ۴ — حجم عملیات مالی زیاد', values: [40, 44, 48] },
            { code: 'L5', title: 'سطح ۵ — حجم عملیات مالی بسیار زیاد', values: [52, 56, 60] },
          ],
          PROBABILITY_DIMS,
        ),
      },
      {
        code: 'FRM_RPT',
        name: 'فرم‌ها و گزارشات',
        order: 9,
        maxScore: 60,
        weightPct: 5.3,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از تهیه، ثبت، ضبط و بررسی اطلاعات، محاسبات، برآوردها، برنامه‌ریزی، تهیه کروکی، نقشه، فرم‌ها، تهیه آمار و تجزیه و تحلیل به منظور دستیابی به گزارش‌ها و برنامه‌های لازم.',
        applicationRule: 'سطح مسئولیت تهیه و تحلیل فرم‌ها و گزارش‌ها × حجم (کم/متوسط/زیاد).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — تکمیل فرم‌های ساده و گزارش‌های ساده ثبت یا استخراج وقایع', values: [4, 8, 12] },
            { code: 'L2', title: 'سطح ۲ — تهیه و تنظیم فرم‌های مشکل و تفکیک نوع وقایع', values: [16, 20, 24] },
            {
              code: 'L3',
              title: 'سطح ۳ — بررسی فرم‌های مشکل و تهیه گزارشات نسبتاً مهم یا طرح‌های معمولی',
              values: [28, 32, 36],
            },
            {
              code: 'L4',
              title: 'سطح ۴ — مقایسه، محاسبه و تجزیه‌وتحلیل آمارها، گزارش توجیهی مهم و اطلاعات محرمانه',
              values: [40, 44, 48],
            },
            {
              code: 'L5',
              title:
                'سطح ۵ — بررسی و تحلیل فرم‌های مهم و تنظیم گزارشات تحلیلی مهم حقوقی، اقتصادی، مالی، تولیدی، فنی و اداری',
              values: [52, 56, 60],
            },
          ],
          [
            { code: 'V_LOW', title: 'حجم کم' },
            { code: 'V_MEDIUM', title: 'حجم متوسط' },
            { code: 'V_HIGH', title: 'حجم زیاد' },
          ],
        ).map((level) =>
          level.code === 'L5' && level.dim !== 'V_LOW'
            ? { ...level, status: V.EXTRACTED_NEEDS_VERIFICATION }
            : level,
        ),
      },
      {
        code: 'SPC_RSP',
        name: 'سایر مسئولیت‌های خاص',
        order: 10,
        maxScore: 60,
        weightPct: 5.3,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از مسئولیت‌های خاص که به مقتضای فعالیت‌های کارگاه می‌تواند مورد ارزیابی و در تعیین امتیاز شغل ملاک عمل قرار گیرد.',
        applicationRule: 'سطح مسئولیت خاص × میزان تأثیر (کم/متوسط/زیاد).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          [
            { code: 'L1', title: 'سطح ۱ — مسئولیت خاص بسیار کم', values: [4, 8, 12] },
            { code: 'L2', title: 'سطح ۲ — مسئولیت خاص کم', values: [16, 20, 24] },
            { code: 'L3', title: 'سطح ۳ — مسئولیت خاص متوسط', values: [28, 32, 36] },
            { code: 'L4', title: 'سطح ۴ — مسئولیت خاص زیاد', values: [40, 44, 48] },
            { code: 'L5', title: 'سطح ۵ — مسئولیت خاص بسیار زیاد', values: [52, 56, 60] },
          ],
          [
            { code: 'I_LOW', title: 'تأثیر کم' },
            { code: 'I_MEDIUM', title: 'تأثیر متوسط' },
            { code: 'I_HIGH', title: 'تأثیر زیاد' },
          ],
        ),
      },
    ],
  },
  {
    code: 'SYS_B_F3',
    name: 'کوشش‌ها',
    order: 3,
    maxScore: 185,
    weightPct: 16.3,
    definition: 'میزان صرف نیروی فکری و جسمانی لازم برای انجام وظایف شغل.',
    subFactors: [
      {
        code: 'MNT_EFF',
        name: 'کوشش فکری',
        order: 11,
        maxScore: 105,
        weightPct: 9.2,
        mechanism: 'MATRIX_2D',
        enabled: true,
        definition:
          'عبارت است از سطح تأثیر و میزان اعمال نیروی فکری، تجزیه و تحلیل، خلاقیت، کاربرد مفاهیم تخصصی و تصمیم‌گیری که برای انجام وظایف شغلی است.',
        applicationRule: 'سطح کوشش فکری (۷ سطح) × میزان تأثیر (کم/متوسط/زیاد).',
        status: V.VERIFIED_USABLE,
        levels: matrixLevels(
          MENTAL_EFFORT_ROWS.map((row, index) => ({ ...row, title: MENTAL_EFFORT_TITLES[index] as string })),
          [
            { code: 'I_LOW', title: 'تأثیر کم' },
            { code: 'I_MEDIUM', title: 'تأثیر متوسط' },
            { code: 'I_HIGH', title: 'تأثیر زیاد' },
          ],
        ),
      },
      {
        code: 'PHY_EFF',
        name: 'کوشش جسمانی',
        order: 12,
        maxScore: 80,
        weightPct: 7.0,
        mechanism: 'DOMINANT_ACTIVITY_ROW',
        enabled: true,
        definition:
          'عبارت است از نوع و میزان و تکرار کوشش‌های جسمانی و حد سختی و صعوبت حرکات مورد نیاز برای انجام وظایف.',
        applicationRule:
          'فقط جزء مؤثر عامل شغل مورد توجه قرار می‌گیرد و به هر شغل فقط امتیاز یک ردیف از ردیف‌های هفت‌گانه تخصیص می‌یابد (جدول ۸ ستون ساعتی).',
        status: V.VERIFIED_USABLE,
        levels: PHYSICAL_ROWS.flatMap((row, rowIndex) =>
          HOUR_BRACKETS.map((bracket, bracketIndex) => ({
            code: row.code,
            num: rowIndex + 1,
            title: row.title,
            dim: bracket.code,
            dimTitle: bracket.title,
            points: row.values[bracketIndex] as number,
            status:
              row.code === 'PHY_4' && bracket.code === 'H6' ? V.EXTRACTED_NEEDS_VERIFICATION : V.VERIFIED_USABLE,
          })),
        ),
      },
    ],
  },
  {
    code: 'SYS_B_F4',
    name: 'شرایط کار',
    order: 4,
    maxScore: 200,
    weightPct: 17.6,
    definition: 'شرایط فیزیکی و مخاطرات محیط کار که شاغل در حین انجام وظایف با آن مواجه است.',
    subFactors: [
      {
        code: 'ENV_CND',
        name: 'شرایط نامساعد محیط کار',
        order: 13,
        maxScore: 120,
        weightPct: 10.5,
        mechanism: 'MULTI_ITEM_SUM_CAPPED',
        enabled: true,
        definition:
          'عبارت است از میزان نامتعارف بودن محیط کار به دلیل وجود عوامل آزاردهنده در محیط کار ناشی از ماهیت کار کارگاه.',
        applicationRule:
          'کارشناس طراح با کاربینی، اجزای عامل را شناسایی و برای هر جزء بر اساس شدت و ساعات مواجهه امتیاز می‌دهد؛ حداکثر ۱۲ جزء و سقف ۱۲۰ امتیاز.',
        status: V.VERIFIED_USABLE,
        levels: buildEnvironmentLevels(),
      },
      {
        code: 'OCC_HAZ',
        name: 'خطرات ناشی از کار',
        order: 14,
        maxScore: 80,
        weightPct: 7.0,
        mechanism: 'INJURY_PLUS_DISEASE_CAPPED',
        enabled: true,
        definition:
          'عبارت است از صدمات جسمی و امراض ناشی از وقوع حوادث اجتناب‌ناپذیر در حین انجام کار.',
        applicationRule:
          'بیشترین سطح صدمات جسمی محتمل (سطوح ۱ تا ۵، حداکثر ۴۰ امتیاز) به‌علاوه سطح امراض ناشی از کار (حداکثر ۴۰ امتیاز) با سقف کل ۸۰ امتیاز.',
        status: V.VERIFIED_USABLE,
        levels: buildHazardLevels(),
      },
    ],
  },
];

export function seedEvaluationSystemB(db: Db): void {
  const docId = getLegalDocumentId(db, 'EVAL_SYSTEM_1389');
  db.raw
    .prepare(
      `INSERT INTO evaluation_systems (
        system_code, name, legal_basis, circular_number, approval_date_jalali, version,
        effective_from, effective_to, scoring_mode, max_theoretical_score,
        requires_workshop_tables, validity_status, legal_document_id, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(system_code, version) DO NOTHING`,
    )
    .run(
      SYSTEM_B_CODE,
      'نظام امتیازی چهارعاملی ارزیابی مشاغل (سیستم B)',
      'نظام ارزیابی مشاغل مصوب ۱۳۸۹/۰۵/۱۸ وزارت کار و امور اجتماعی و مواد ۴۸ و ۴۹ قانون کار',
      null,
      SYSTEM_B_EFFECTIVE_FROM,
      SYSTEM_B_VERSION,
      SYSTEM_B_EFFECTIVE_FROM,
      null,
      'POINT_FACTOR_FIXED',
      1137,
      0,
      V.VERIFIED_USABLE,
      docId,
      'نظام امتیازی رسمی با ۴ عامل اصلی، ۱۴ زیرعامل، مجموع نظری ۱۱۳۷ امتیاز و تطبیق با جدول دامنه امتیازات ۲۰ گروهی.',
    );

  const systemRow = db.get<{ id: number }>(
    'SELECT id FROM evaluation_systems WHERE system_code = ? AND version = ?',
    SYSTEM_B_CODE,
    SYSTEM_B_VERSION,
  );
  if (!systemRow) throw new Error('ثبت نظام ارزیابی سیستم B ناموفق بود.');
  const systemId = systemRow.id;

  const factorStmt = db.raw.prepare(`
    INSERT INTO evaluation_factors (
      system_id, factor_code, name, display_order, max_score, official_weight_pct, definition, validity_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(system_id, factor_code) DO NOTHING
  `);
  const subFactorStmt = db.raw.prepare(`
    INSERT INTO evaluation_sub_factors (
      factor_id, sub_factor_code, name, display_order, max_score, official_weight_pct,
      scoring_mechanism, scoring_enabled, definition, application_rule, validity_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(factor_id, sub_factor_code) DO NOTHING
  `);
  const levelStmt = db.raw.prepare(`
    INSERT INTO evaluation_levels (
      sub_factor_id, level_code, level_number, title, secondary_dimension_code,
      secondary_dimension_title, criteria_description, tvto_hours_equivalent, validity_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sub_factor_id, level_code, secondary_dimension_code) DO NOTHING
  `);
  const scoreStmt = db.raw.prepare(`
    INSERT INTO evaluation_scores (
      level_id, version, effective_from, effective_to, points, formula_rule_json, validity_status, legal_document_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(level_id, version) DO NOTHING
  `);
  const weightStmt = db.raw.prepare(`
    INSERT INTO evaluation_weights (
      system_id, scheme_code, target_type, target_code, weight_percent, coefficient, version,
      effective_from, effective_to, is_official_national, validity_status, legal_document_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(system_id, scheme_code, target_type, target_code, version) DO NOTHING
  `);

  db.transaction(() => {
    for (const factor of FACTORS) {
      factorStmt.run(
        systemId,
        factor.code,
        factor.name,
        factor.order,
        factor.maxScore,
        factor.weightPct,
        factor.definition,
        V.VERIFIED_USABLE,
      );
      const factorRow = db.get<{ id: number }>(
        'SELECT id FROM evaluation_factors WHERE system_id = ? AND factor_code = ?',
        systemId,
        factor.code,
      );
      if (!factorRow) throw new Error(`ثبت عامل ${factor.code} ناموفق بود.`);
      weightStmt.run(
        systemId,
        SYSTEM_B_SCHEME,
        'FACTOR',
        factor.code,
        factor.weightPct,
        1.0,
        SYSTEM_B_SCORE_VERSION,
        SYSTEM_B_EFFECTIVE_FROM,
        null,
        1,
        V.VERIFIED_USABLE,
        docId,
      );

      for (const sub of factor.subFactors) {
        subFactorStmt.run(
          factorRow.id,
          sub.code,
          sub.name,
          sub.order,
          sub.maxScore,
          sub.weightPct,
          sub.mechanism,
          sub.enabled ? 1 : 0,
          sub.definition,
          sub.applicationRule ?? null,
          sub.status,
        );
        const subRow = db.get<{ id: number }>(
          'SELECT id FROM evaluation_sub_factors WHERE factor_id = ? AND sub_factor_code = ?',
          factorRow.id,
          sub.code,
        );
        if (!subRow) throw new Error(`ثبت زیرعامل ${sub.code} ناموفق بود.`);
        weightStmt.run(
          systemId,
          SYSTEM_B_SCHEME,
          'SUB_FACTOR',
          sub.code,
          sub.weightPct,
          1.0,
          SYSTEM_B_SCORE_VERSION,
          SYSTEM_B_EFFECTIVE_FROM,
          null,
          1,
          sub.status,
          docId,
        );

        for (const level of sub.levels) {
          levelStmt.run(
            subRow.id,
            level.code,
            level.num,
            level.title,
            level.dim ?? 'DEFAULT',
            level.dimTitle ?? null,
            level.criteria ?? null,
            level.tvto ?? null,
            level.status ?? V.VERIFIED_USABLE,
          );
          const levelRow = db.get<{ id: number }>(
            `SELECT id FROM evaluation_levels
             WHERE sub_factor_id = ? AND level_code = ? AND secondary_dimension_code = ?`,
            subRow.id,
            level.code,
            level.dim ?? 'DEFAULT',
          );
          if (!levelRow) throw new Error(`ثبت سطح ${level.code} ناموفق بود.`);
          scoreStmt.run(
            levelRow.id,
            SYSTEM_B_SCORE_VERSION,
            SYSTEM_B_EFFECTIVE_FROM,
            null,
            level.points,
            level.rule ? JSON.stringify(level.rule) : null,
            level.status ?? V.VERIFIED_USABLE,
            docId,
          );
        }
      }
    }
  });
}

export const SYSTEM_B_METADATA = {
  code: SYSTEM_B_CODE,
  version: SYSTEM_B_VERSION,
  scoreVersion: SYSTEM_B_SCORE_VERSION,
  scheme: SYSTEM_B_SCHEME,
  maxTheoreticalScore: 1137,
  factors: FACTORS.map((f) => ({ code: f.code, name: f.name, maxScore: f.maxScore, weightPct: f.weightPct })),
};
