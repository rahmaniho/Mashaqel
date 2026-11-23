/**
 * سناریوهای آزمون جامع موتور — هر سناریو ورودی، فرمول، خروجی مورد انتظار و خروجی واقعی را ثبت می‌کند.
 * این فایل هم توسط آزمون‌های خودکار (node:test) و هم توسط تولیدکننده گزارش آزمون استفاده می‌شود.
 */

import { MashaqelEngine, MashaqelError, ERROR_CODES, WORKSHOP_SCHEME_REQUIRED_MESSAGE, SENIORITY_TABLE_UNAVAILABLE_MESSAGE } from '../src/index.ts';
import type { PointBasedSelection } from '../src/index.ts';

export type ExpectedValue = number | string | boolean;

export interface ScenarioResult {
  id: string;
  area: string;
  title: string;
  input: string;
  formula: string;
  expected: ExpectedValue;
  actual: ExpectedValue;
  tolerance: number;
  pass: boolean;
  notes: string[];
}

interface RawOutcome {
  input: string | Record<string, unknown>;
  formula: string;
  expected: ExpectedValue;
  actual: ExpectedValue;
  tolerance?: number;
  notes?: string[];
}

const SERVICE = 'SERVICE_COMPANIES_NATIONWIDE';
const NATIONAL = 'NATIONAL_20_GROUP_1389';
const SYS_B = 'EVAL_1389_POINT_FACTOR';
const SYS_A = 'EVAL_1395_FRAMEWORK';

const MIN_DAILY = 5_541_850;
const FIXED_1405 = 519_549;
const INCREASE = 1.45;

function roundMoney(value: number): number {
  return Math.round(value);
}

/** فرمول قانونی ماده ۱ دستورالعمل ۶۷۲۴ (بازنویسی مستقل در آزمون) */
function statutoryDailyJobWage(prior1404: number): number {
  return Math.max(roundMoney(prior1404 * INCREASE + FIXED_1405), MIN_DAILY);
}

function describeInput(input: string | Record<string, unknown>): string {
  if (typeof input === 'string') return input;
  return JSON.stringify(input);
}

function equals(a: ExpectedValue, b: ExpectedValue, tolerance: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance;
  return a === b;
}

function captureError(fn: () => unknown): { code: string; message: string } {
  try {
    fn();
    return { code: 'NO_ERROR', message: '' };
  } catch (error) {
    if (error instanceof MashaqelError) return { code: error.code, message: error.message };
    return { code: 'UNEXPECTED_ERROR', message: (error as Error).message };
  }
}

const WELDER_SELECTIONS: PointBasedSelection[] = [
  { subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_3' },
  { subFactorCode: 'EXP', kind: 'LEVEL', levelCode: 'EXP_3' },
  { subFactorCode: 'SUP', kind: 'SUPERVISION', directHeadcountByGrade: {}, indirectHeadcount: 0 },
  { subFactorCode: 'MAT_PRD', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'MCH_EQP', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'P_HIGH' },
  { subFactorCode: 'COM_REL', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'C_LOW' },
  { subFactorCode: 'FIN_AST', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'P_LOW' },
  { subFactorCode: 'FRM_RPT', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'V_LOW' },
  { subFactorCode: 'SPC_RSP', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_LOW' },
  { subFactorCode: 'MNT_EFF', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'PHY_EFF', kind: 'DOMINANT_ROW', levelCode: 'PHY_6B', hoursBracketCode: 'H5' },
  {
    subFactorCode: 'ENV_CND',
    kind: 'ENV_ITEMS',
    items: [
      { itemCode: 'ENV_TEMP', intensityCode: 'HIGH', hoursBracketCode: 'B8' },
      { itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
      { itemCode: 'ENV_DUST', intensityCode: 'SEVERE', hoursBracketCode: 'B4' },
      { itemCode: 'ENV_SMOKE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
    ],
  },
  {
    subFactorCode: 'OCC_HAZ',
    kind: 'HAZARD',
    injuryLevelCode: 'HZ_INJ_3',
    injuryProbabilityCode: 'HIGH',
    diseaseProbabilityCode: 'MEDIUM',
  },
];

const SUPERVISOR_SELECTIONS: PointBasedSelection[] = [
  { subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_4' },
  { subFactorCode: 'EXP', kind: 'LEVEL', levelCode: 'EXP_6' },
  {
    subFactorCode: 'SUP',
    kind: 'SUPERVISION',
    directHeadcountByGrade: { G1: 8, G2: 3, G3: 1 },
    indirectHeadcount: 25,
  },
  { subFactorCode: 'MAT_PRD', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'MCH_EQP', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'COM_REL', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'C_MEDIUM' },
  { subFactorCode: 'FIN_AST', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'FRM_RPT', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'V_MEDIUM' },
  { subFactorCode: 'SPC_RSP', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'MNT_EFF', kind: 'MATRIX', levelCode: 'L4', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'PHY_EFF', kind: 'DOMINANT_ROW', levelCode: 'PHY_2', hoursBracketCode: 'H4' },
  {
    subFactorCode: 'ENV_CND',
    kind: 'ENV_ITEMS',
    items: [{ itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B4' }],
  },
  {
    subFactorCode: 'OCC_HAZ',
    kind: 'HAZARD',
    injuryLevelCode: 'HZ_INJ_2',
    injuryProbabilityCode: 'MEDIUM',
    diseaseProbabilityCode: 'LOW',
  },
];

/** جمع امتیازهای مورد انتظار بر مبنای جدول‌های رسمی (محاسبه مستقل از موتور) */
const WELDER_EXPECTED = {
  edu: 108,
  exp: 36,
  sup: 0,
  saf: 0,
  mat: 10,
  mch: 22,
  com: 4,
  fin: 4,
  frm: 4,
  spc: 16,
  mnt: 25,
  phy: 30,
  env: 6 + 4 + 6 + 4,
  haz: 24 + 20,
};
const WELDER_TOTAL =
  WELDER_EXPECTED.edu +
  WELDER_EXPECTED.exp +
  WELDER_EXPECTED.sup +
  WELDER_EXPECTED.saf +
  WELDER_EXPECTED.mat +
  WELDER_EXPECTED.mch +
  WELDER_EXPECTED.com +
  WELDER_EXPECTED.fin +
  WELDER_EXPECTED.frm +
  WELDER_EXPECTED.spc +
  WELDER_EXPECTED.mnt +
  WELDER_EXPECTED.phy +
  WELDER_EXPECTED.env +
  WELDER_EXPECTED.haz;

const SUPERVISOR_EXPECTED = {
  edu: 144,
  exp: 72,
  supDirect: Math.min(8 * 1, 10) + Math.min(3 * 2, 16) + Math.min(1 * 3, 30),
  supIndirect: Math.min(Math.floor(10 / 2), 5) + Math.min(Math.floor(15 / 4), 5),
  mat: 18,
  mch: 10,
  com: 25,
  fin: 20,
  frm: 32,
  spc: 32,
  mnt: 55,
  phy: 15,
  env: 2,
  haz: 12 + 10,
};
const SUPERVISOR_SUP = SUPERVISOR_EXPECTED.supDirect + SUPERVISOR_EXPECTED.supIndirect;
const SUPERVISOR_TOTAL =
  SUPERVISOR_EXPECTED.edu +
  SUPERVISOR_EXPECTED.exp +
  SUPERVISOR_SUP +
  SUPERVISOR_EXPECTED.mat +
  SUPERVISOR_EXPECTED.mch +
  SUPERVISOR_EXPECTED.com +
  SUPERVISOR_EXPECTED.fin +
  SUPERVISOR_EXPECTED.frm +
  SUPERVISOR_EXPECTED.spc +
  SUPERVISOR_EXPECTED.mnt +
  SUPERVISOR_EXPECTED.phy +
  SUPERVISOR_EXPECTED.env +
  SUPERVISOR_EXPECTED.haz;

const PROFILE_BASE = {
  workshopCode: 'WS-001',
  jobCode: 'JOB-WELDER',
  jobTitle: 'جوشکار سازه‌های فلزی',
  organizationalUnit: 'واحد تولید — خط مونتاژ',
  jobObjective: 'جوشکاری قطعات فلزی مطابق نقشه فنی و استانداردهای کیفیت',
  duties: 'جوشکاری قطعات، آماده‌سازی سطوح، کنترل کیفیت درز جوش',
  responsibilities: 'حفظ کیفیت جوش، رعایت ایمنی و نگهداری تجهیزات جوشکاری',
  authorities: 'توقف کار در شرایط ناایمن، گزارش عیوب به سرپرست خط',
  qualificationRequirements: 'دیپلم فنی، ۳ سال سابقه جوشکاری، گواهینامه ایمنی',
  requiredEducation: 'دیپلم',
  requiredExperienceYears: 3,
  requiredSkills: 'جوشکاری SMAW و MIG، خواندن نقشه',
  workingConditions: 'محیط تولیدی با صدا، گردوغبار و حرارت',
};

/* ------------------------------------------------------------------------- */

export function runAllScenarios(): ScenarioResult[] {
  const results: ScenarioResult[] = [];

  const add = (id: string, area: string, title: string, fn: () => RawOutcome): void => {
    try {
      const outcome = fn();
      const tolerance = outcome.tolerance ?? 0;
      results.push({
        id,
        area,
        title,
        input: describeInput(outcome.input),
        formula: outcome.formula,
        expected: outcome.expected,
        actual: outcome.actual,
        tolerance,
        pass: equals(outcome.actual, outcome.expected, tolerance),
        notes: outcome.notes ?? [],
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        id,
        area,
        title,
        input: '—',
        formula: '—',
        expected: 'بدون خطا',
        actual: `خطای غیرمنتظره: ${err.message}`,
        tolerance: 0,
        pass: false,
        notes: [],
      });
    }
  };

  const withEngine = <T>(fn: (engine: MashaqelEngine) => T): T => {
    const engine = MashaqelEngine.open();
    try {
      return fn(engine);
    } finally {
      engine.close();
    }
  };

  /* ------------------------------ مزد ۱۴۰۵ ------------------------------ */

  add('WAGE-01', 'مزد ۱۴۰۵', 'مزد شغل روزانه ۱۴۰۵ برای کارگر گروه ۱ (برخورد با کف قانونی)', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 1,
        priorDailyJobWage: 3_463_656,
        computationDate: '1405-03-15',
      });
      return {
        input: { mazd1404: 3_463_656, group: 1 },
        formula: `max(round(3,463,656 × 1.45 + 519,549), 5,541,850) = max(5,541,850, 5,541,850)`,
        expected: 5_541_850,
        actual: wage.dailyJobWage,
        notes: ['مبلغ ثابت ۵۱۹٬۵۴۹ ریال دقیقاً اختلاف کف حداقل مزد با ۱٫۴۵ برابر مزد گروه ۱ را جبران می‌کند.'],
      };
    }),
  );

  add('WAGE-02', 'مزد ۱۴۰۵', 'مزد شغل روزانه ۱۴۰۵ بالاتر از کف (گروه ۱۲ از جدول مصوب)', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 12,
        priorDailyJobWage: 3_566_838,
        computationDate: '1405-03-15',
      });
      return {
        input: { mazd1404: 3_566_838, group: 12 },
        formula: 'max(round(3,566,838 × 1.45 + 519,549), 5,541,850)',
        expected: statutoryDailyJobWage(3_566_838),
        actual: wage.dailyJobWage,
        tolerance: 2,
        notes: ['اختلاف حداکثر ۲ ریالی ناشی از ترتیب گرد کردن در فرمول و جدول مصوب است.'],
      };
    }),
  );

  add('WAGE-03', 'مزد ۱۴۰۵', 'اعمال کف حداقل مزد روزانه برای مزد بسیار پایین', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 1,
        priorDailyJobWage: 1_000_000,
        computationDate: '1405-03-15',
      });
      return {
        input: { mazd1404: 1_000_000, group: 1 },
        formula: '1,000,000 × 1.45 + 519,549 = 1,969,549 < 5,541,850 ⇒ 5,541,850',
        expected: 5_541_850,
        actual: wage.dailyJobWage,
        notes: wage.warnings.filter((w) => w.includes('کف قانونی')),
      };
    }),
  );

  add('WAGE-04', 'مزد ۱۴۰۵', 'انطباق مزد جدول مصوب طرح با فرمول قانونی برای گروه ۲۰', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 20,
        priorDailyJobWage: 3_741_615,
        computationDate: '1405-03-15',
      });
      return {
        input: { mazd1404: 3_741_615, group: 20 },
        formula: 'جدول: 5,541,850 + 610.6675 × (740 − 80) = 5,944,891 | فرمول: round(3,741,615 × 1.45 + 519,549)',
        expected: 5_944_891,
        actual: wage.dailyJobWage,
        tolerance: 2,
        notes: ['هر دو مسیر (جدول مصوب و فرمول قانونی) به یک مبلغ می‌رسند.'],
      };
    }),
  );

  add('WAGE-05', 'مزد ۱۴۰۵', 'مزد شغل ماهانه = مزد روزانه × ۳۰ روز', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 5,
        priorDailyJobWage: 3_491_031,
        computationDate: '1405-03-15',
        payableDays: 30,
      });
      return {
        input: { group: 5, payableDays: 30 },
        formula: '5,581,543 × 30',
        expected: wage.dailyJobWage * 30,
        actual: wage.monthlyJobWage,
      };
    }),
  );

  add('WAGE-06', 'مزد ۱۴۰۵', 'مزد ماهانه با روزهای قابل پرداخت ۳۱ روز (ماه ۳۱ روزه)', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 5,
        priorDailyJobWage: 3_491_031,
        computationDate: '1405-02-01',
        periodYearMonth: '1405-02',
        payableDays: 31,
      });
      return {
        input: { group: 5, payableDays: 31, period: '1405-02' },
        formula: '5,581,543 × 31',
        expected: wage.dailyJobWage * 31,
        actual: wage.monthlyJobWage,
      };
    }),
  );

  /* ------------------------------ پایه سنوات ------------------------------ */

  add('SNR-01', 'پایه سنوات', 'نرخ پایه سنوات ۱۴۰۵ گروه ۱ (۱۶۶٬۶۶۷ ریال)', () =>
    withEngine((engine) => {
      const rate = engine.seniorityRate({ schemeCode: NATIONAL, group: 1, fiscalYear: 1405, asOfDate: '1405-01-01' });
      return {
        input: { group: 1 },
        formula: 'seniority_tables[1405][group=1]',
        expected: 166_667,
        actual: rate.rate ?? 'null',
        notes: [rate.available ? 'جدول در دسترس است.' : (rate.message ?? '')],
      };
    }),
  );

  add('SNR-02', 'پایه سنوات', 'تفکیک نرخ پایه سنوات گروه ۱۰ و ۲۰ (نه نرخ یکسان)', () =>
    withEngine((engine) => {
      const g10 = engine.seniorityRate({ schemeCode: NATIONAL, group: 10, fiscalYear: 1405, asOfDate: '1405-01-01' });
      const g20 = engine.seniorityRate({ schemeCode: NATIONAL, group: 20, fiscalYear: 1405, asOfDate: '1405-01-01' });
      return {
        input: { groups: [10, 20] },
        formula: 'G10 = 168,467 و G20 = 172,267 (گام +۲۰۰ ریال تا گروه ۱۱ و +۴۰۰ ریال از گروه ۱۲)',
        expected: `${168_467}|${172_267}`,
        actual: `${g10.rate}|${g20.rate}`,
      };
    }),
  );

  add('SNR-03', 'پایه سنوات', 'کل مزد سنوات = ۱٫۴۵ × سنوات تجمیعی ۱۴۰۴ + نرخ گروه', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        computationDate: '1405-03-15',
      });
      return {
        input: { priorAccumulated: 600_403, group: 10, serviceYears: 5 },
        formula: 'round(600,403 × 1.45) + 168,467 = 870,584 + 168,467',
        expected: 1_039_051,
        actual: wage.dailySeniorityWage,
      };
    }),
  );

  add('SNR-04', 'پایه سنوات', 'عدم اعمال افزایش ۴۵٪ روی نرخ پایه سنوات گروه (نرخ ثابت مصوب)', () =>
    withEngine((engine) => {
      const rate = engine.seniorityRate({ schemeCode: NATIONAL, group: 14, fiscalYear: 1405, asOfDate: '1405-06-01' });
      return {
        input: { group: 14 },
        formula: 'نرخ رسمی ۱۶۹٬۸۶۷ ریال (بدون ضریب ۱٫۴۵)؛ 169,867 × 1.45 = 246,307 که نباید اعمال شود',
        expected: 169_867,
        actual: rate.rate ?? 'null',
        notes: ['تبصره ۱ ماده ۲ دستورالعمل ۶۷۲۴: نرخ پایه سنوات اعطایی ۱۴۰۵ مشمول افزایش ۴۵٪ نیست.'],
      };
    }),
  );

  add('SNR-05', 'پایه سنوات', 'طرح بدون جدول پایه سنوات: پیام «جدول پایه سنوات این طرح در دسترس نیست»', () =>
    withEngine((engine) => {
      engine.db.run(
        `INSERT INTO wage_tables (scheme_code, scheme_title, fiscal_year, version, effective_from, effective_to,
           base_floor_daily_wage, rial_coefficient_a, has_ranking_system, rank_interval_years, group_number,
           daily_job_wage, validity_status)
         VALUES ('CUSTOM_NO_SENIORITY', 'طرح اختصاصی آزمون', 1405, '1.0', '1405-01-01', '1405-12-29',
           5541850, 500, 0, 4, 3, 6000000, '4_REQUIRES_WORKSHOP_APPROVED_SCHEME')`,
      );
      const wage = engine.computeWage({
        schemeCode: 'CUSTOM_NO_SENIORITY',
        jobGroup: 3,
        priorAccumulatedDailySeniority: 302_967,
        serviceYearsInWorkshop: 3,
        computationDate: '1405-03-15',
      });
      const messageShown = wage.warnings.some((w) => w.includes(SENIORITY_TABLE_UNAVAILABLE_MESSAGE));
      return {
        input: { schemeCode: 'CUSTOM_NO_SENIORITY', group: 3 },
        formula: 'سنوات = round(302,967 × 1.45) + 0 (نرخ گروه اعمال نشد)',
        expected: `true|${roundMoney(302_967 * 1.45)}`,
        actual: `${messageShown}|${wage.dailySeniorityWage}`,
      };
    }),
  );

  /* ------------------------------ مزد مبنا ------------------------------ */

  add('BASE-01', 'مزد مبنا', 'مزد مبنا = مزد شغل + مزد سنوات + مزد رتبه + سایر اجزا', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        priorDailyRankWage: 100_000,
        priorOtherFixedDailyWage: 50_000,
        computationDate: '1405-03-15',
      });
      return {
        input: { group: 10, priorRank: 100_000, priorOther: 50_000 },
        formula: '5,654,823 + 1,039,051 + round(100,000×1.45) + round(50,000×1.45)',
        expected: 5_654_823 + 1_039_051 + 145_000 + 72_500,
        actual: wage.dailyBaseWage,
      };
    }),
  );

  /* ------------------------------ مزایا ------------------------------ */

  add('WEL-01', 'مزایای رفاهی', 'تفکیک کامل مزایای رفاهی از مزد شغل و مزد مبنا', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        isMarried: true,
        eligibleChildrenCount: 1,
        computationDate: '1405-03-15',
      });
      return {
        input: { married: true, children: 1, group: 10 },
        formula: 'مزایا = ۲۲٬۰۰۰٬۰۰۰ (بن) + ۳۰٬۰۰۰٬۰۰۰ (مسکن) + ۵٬۰۰۰٬۰۰۰ (تأهل) + ۱۶٬۶۲۵٬۵۵۰ (اولاد)',
        expected: 22_000_000 + 30_000_000 + 5_000_000 + 16_625_550,
        actual: wage.welfareSubtotal,
        notes: [
          `مزد شغل روزانه = ${wage.dailyJobWage} — مزایا در مزد شغل و مزد مبنا لحاظ نشده است.`,
          `مزد مبنا ماهانه = ${wage.monthlyBaseWage} — جدا از مزایا.`,
        ],
      };
    }),
  );

  add('WEL-02', 'مزایای رفاهی', 'حق اولاد = ۳ برابر حداقل مزد روزانه به ازای هر فرزند', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 4,
        priorDailyJobWage: 3_482_608,
        eligibleChildrenCount: 2,
        computationDate: '1405-03-15',
      });
      return {
        input: { children: 2 },
        formula: '3 × 5,541,850 × 2 = 16,625,550 × 2',
        expected: 33_251_100,
        actual: wage.childAllowance,
      };
    }),
  );

  add('WEL-03', 'مزایای رفاهی', 'نسخه‌بندی کمک‌هزینه مسکن ۱۴۰۵ (نسخه v1 = ۹٬۰۰۰٬۰۰۰ ریال)', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 4,
        priorDailyJobWage: 3_482_608,
        parameterVersion: '1405-v1',
        computationDate: '1405-02-20',
      });
      return {
        input: { parameterVersion: '1405-v1' },
        formula: 'annual_labor_parameters[1405-v1].housing_allowance_monthly',
        expected: 9_000_000,
        actual: wage.housingAllowance,
        notes: ['وضعیت ۲ — رقم پیش از تصویب‌نامه ۹۲۳۴ هیئت وزیران.'],
      };
    }),
  );

  add('WEL-04', 'مزایای رفاهی', 'نسخه‌بندی کمک‌هزینه مسکن ۱۴۰۵ (نسخه v2 = ۳۰٬۰۰۰٬۰۰۰ ریال پس از مصوبه ۹۲۳۴)', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 4,
        priorDailyJobWage: 3_482_608,
        parameterVersion: '1405-v2',
        computationDate: '1405-05-01',
      });
      return {
        input: { parameterVersion: '1405-v2' },
        formula: 'annual_labor_parameters[1405-v2].housing_allowance_monthly',
        expected: 30_000_000,
        actual: wage.housingAllowance,
      };
    }),
  );

  add('WEL-05', 'مزایای رفاهی', 'انتخاب خودکار نسخه پارامتر بر مبنای تاریخ محاسبه', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 4,
        priorDailyJobWage: 3_482_608,
        computationDate: '1405-06-01',
      });
      return {
        input: { computationDate: '1405-06-01', parameterVersion: 'خودکار' },
        formula: 'آخرین نسخه معتبر تا تاریخ محاسبه',
        expected: '1405-v2|30000000',
        actual: `${wage.parameterVersion}|${wage.housingAllowance}`,
      };
    }),
  );

  /* --------------------------- بیمه، اضافه‌کاری --------------------------- */

  add('CAL-01', 'اجزای مزد', 'کسور بیمه: سهم کارگر ۷٪ و سهم کارفرما ۲۳٪ بدون حق اولاد', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        isMarried: true,
        eligibleChildrenCount: 1,
        computationDate: '1405-03-15',
      });
      const insurable = wage.monthlyBaseWage + wage.groceryAllowance + wage.housingAllowance + wage.maritalAllowance;
      return {
        input: { gross: wage.grossTotal, childAllowance: wage.childAllowance },
        formula: `مشمول بیمه = ${insurable} ؛ کارگر ۷٪ و کارفرما ۲۳٪`,
        expected: `${roundMoney(insurable * 0.07)}|${roundMoney(insurable * 0.23)}`,
        actual: `${wage.workerInsurance}|${wage.employerInsurance}`,
        notes: ['حق اولاد معاف از کسر بیمه است (ماده ۸۶ قانون تأمین اجتماعی).'],
      };
    }),
  );

  add('CAL-02', 'اجزای مزد', 'فوق‌العاده اضافه‌کاری = مزد مبنا ÷ ۷٫۳۳ × ۱٫۴ × ساعت', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        overtimeHours: 12,
        computationDate: '1405-03-15',
      });
      return {
        input: { overtimeHours: 12, baseDaily: wage.dailyBaseWage },
        formula: `round(${wage.dailyBaseWage} / 7.33 × 1.4 × 12)`,
        expected: roundMoney((wage.dailyBaseWage / 7.33) * 1.4 * 12),
        actual: wage.overtimePay,
      };
    }),
  );

  add('CAL-03', 'اجزای مزد', 'فوق‌العاده نوبت‌کاری ۲۲٫۵٪ برای نوبت گردشی صبح/عصر/شب', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        shiftType: 'MORNING_EVENING_NIGHT',
        computationDate: '1405-03-15',
      });
      return {
        input: { shiftType: 'MORNING_EVENING_NIGHT' },
        formula: `22.5% × ${wage.monthlyBaseWage}`,
        expected: roundMoney(wage.monthlyBaseWage * 0.225),
        actual: wage.shiftPay,
      };
    }),
  );

  add('CAL-04', 'اجزای مزد', 'عدم محاسبه شب‌کاری جداگانه برای کارگر نوبت‌کار + هشدار', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 10,
        priorDailyJobWage: 3_541_569,
        priorAccumulatedDailySeniority: 600_403,
        serviceYearsInWorkshop: 5,
        shiftType: 'DAY_NIGHT',
        nightWorkHours: 20,
        computationDate: '1405-03-15',
      });
      const warned = wage.warnings.some((w) => w.includes('شب‌کاری'));
      return {
        input: { shiftType: 'DAY_NIGHT', nightHours: 20 },
        formula: 'ماده ۵۸: کارگر نوبت‌کار مشمول فوق‌العاده شب‌کاری جداگانه نیست',
        expected: '0|true',
        actual: `${wage.nightWorkPay}|${warned}`,
      };
    }),
  );

  /* --------------------------- محافظ ریال/تومان --------------------------- */

  add('CUR-01', 'واحد پولی', 'رد مبلغ تومانی که به‌اشتباه با واحد ریال ارسال شده', () => {
    const error = captureError(() =>
      withEngine((engine) =>
        engine.computeWage({
          schemeCode: SERVICE,
          jobGroup: 1,
          priorDailyJobWage: 346_366,
          computationDate: '1405-03-15',
        }),
      ),
    );
    return {
      input: { priorDailyJobWage: 346_366, inputCurrency: 'IRR (پیش‌فرض)' },
      formula: 'detectTomanSuspicion(346,366, 5,541,850) ⇒ 346,366 × 10 ≈ 3,463,660',
      expected: ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
      actual: error.code,
      notes: [error.message.slice(0, 160)],
    };
  });

  add('CUR-02', 'واحد پولی', 'تبدیل صریح ورودی تومانی به ریال', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 5,
        priorDailyJobWage: 400_000,
        inputCurrency: 'TOMAN',
        computationDate: '1405-03-15',
      });
      return {
        input: { priorDailyJobWage: 400_000, inputCurrency: 'TOMAN' },
        formula: 'round(4,000,000 × 1.45 + 519,549) = 6,319,549',
        expected: statutoryDailyJobWage(4_000_000),
        actual: wage.dailyJobWage,
      };
    }),
  );

  add('CUR-03', 'واحد پولی', 'رد پارامتر قانونی ثبت‌شده به تومان در دیتابیس', () =>
    withEngine((engine) => {
      engine.db.run(
        `INSERT INTO annual_labor_parameters (
           fiscal_year, version, effective_from, effective_to, min_daily_wage, other_levels_increase_pct,
           other_levels_fixed_daily, base_daily_seniority_g1, grocery_allowance_monthly,
           housing_allowance_monthly, housing_legal_status, marital_allowance_monthly,
           child_allowance_multiplier, validity_status)
         VALUES (1405, '1405-bad', '1405-01-01', '1405-12-29', 554185, 45, 51954, 16667, 2200000,
           900000, 'آزمون', 500000, 3, '4_REQUIRES_WORKSHOP_APPROVED_SCHEME')`,
      );
      const error = captureError(() =>
        engine.computeWage({
          schemeCode: SERVICE,
          jobGroup: 4,
          parameterVersion: '1405-bad',
          priorDailyJobWage: 3_482_608,
          computationDate: '1405-03-15',
        }),
      );
      return {
        input: { min_daily_wage: 554_185, version: '1405-bad' },
        formula: 'detectTomanSuspicion(554,185, 5,541,850) ⇒ true',
        expected: ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
        actual: error.code,
      };
    }),
  );

  add('CUR-04', 'واحد پولی', 'خطای صریح در نبود جدول مزد و مزد سال قبل', () => {
    const error = captureError(() =>
      withEngine((engine) =>
        engine.computeWage({ schemeCode: 'UNKNOWN_SCHEME', jobGroup: 3, computationDate: '1405-03-15' }),
      ),
    );
    return {
      input: { schemeCode: 'UNKNOWN_SCHEME', jobGroup: 3, priorDailyJobWage: 'ندارد' },
      formula: 'بدون جدول مزد و بدون مزد ۱۴۰۴، محاسبه مزد شغل ممکن نیست',
      expected: ERROR_CODES.MISSING_WAGE_TABLE,
      actual: error.code,
    };
  });

  /* ------------------------------ معوقات ------------------------------ */

  add('ARR-01', 'معوقات', 'مابه‌التفاوت دو دوره با اختلاف مثبت روزانه', () =>
    withEngine((engine) => {
      const arrears = engine.computeArrears({
        periods: [
          { periodYearMonth: '1405-01', payableDays: 30, entitledDailyWage: 5_654_823, paidDailyWage: 5_541_850 },
          { periodYearMonth: '1405-02', payableDays: 31, entitledDailyWage: 5_654_823, paidDailyWage: 5_541_850 },
        ],
      });
      return {
        input: { entitled: 5_654_823, paid: 5_541_850, days: [30, 31] },
        formula: '(5,654,823 − 5,541,850) × 30 + (…) × 31 = 112,973 × 61',
        expected: 112_973 * 61,
        actual: arrears.totalArrears,
      };
    }),
  );

  add('ARR-02', 'معوقات', 'اختلاف منفی به بدهی کارگر تبدیل نمی‌شود و تفاوت تطبیق ثبت می‌گردد', () =>
    withEngine((engine) => {
      const arrears = engine.computeArrears({
        periods: [{ periodYearMonth: '1405-03', payableDays: 31, entitledDailyWage: 5_500_000, paidDailyWage: 5_600_000 }],
        fixedDailyWageBeforeScheme: 5_600_000,
        baseDailyWageAfterScheme: 5_500_000,
      });
      return {
        input: { entitled: 5_500_000, paid: 5_600_000 },
        formula: 'max(0, −100,000) × 31 = 0 ؛ تفاوت تطبیق = 100,000 ریال در روز',
        expected: '0|100000',
        actual: `${arrears.totalArrears}|${arrears.adaptationRetentionDaily}`,
      };
    }),
  );

  add('ARR-03', 'معوقات', 'عدم احتساب مابه‌التفاوت مزایای متغیر در حالت عدم توافق', () =>
    withEngine((engine) => {
      const arrears = engine.computeArrears({
        includeVariableConsequences: false,
        periods: [
          {
            periodYearMonth: '1405-04',
            payableDays: 31,
            entitledDailyWage: 5_654_823,
            paidDailyWage: 5_541_850,
            entitledVariableBenefits: 2_000_000,
            paidVariableBenefits: 0,
          },
        ],
      });
      return {
        input: { includeVariableConsequences: false },
        formula: 'ذیل ماده ۹ آیین‌نامه: بدون تبعات مزدی ⇒ فقط 112,973 × 31',
        expected: 112_973 * 31,
        actual: arrears.totalArrears,
        notes: [arrears.warnings[0] ?? ''],
      };
    }),
  );

  add('ARR-04', 'معوقات', 'معوقات دوره‌ای با ارتقای گروه شغلی در میانه سال', () =>
    withEngine((engine) => {
      const arrears = engine.computeArrears({
        periods: [
          { periodYearMonth: '1405-02', payableDays: 31, entitledDailyWage: 5_621_237, paidDailyWage: 5_541_850 },
          { periodYearMonth: '1405-04', payableDays: 31, entitledDailyWage: 5_691_464, paidDailyWage: 5_541_850 },
        ],
      });
      return {
        input: { group8: 5_621_237, group12: 5_691_464, paid: 5_541_850 },
        formula: '(5,621,237 − 5,541,850) × 31 + (5,691,464 − 5,541,850) × 31',
        expected: 79_387 * 31 + 149_614 * 31,
        actual: arrears.totalArrears,
      };
    }),
  );

  /* ------------------------------ ارزیابی ------------------------------ */

  add('EVAL-01', 'ارزیابی', 'امتیاز کل شغل جوشکار در نظام امتیازی ۱۳۸۹', () =>
    withEngine((engine) => {
      const result = engine.evaluatePointBased({
        systemCode: SYS_B,
        evaluationDate: '1405-03-15',
        selections: WELDER_SELECTIONS,
      });
      return {
        input: { job: 'جوشکار', selections: WELDER_SELECTIONS.length },
        formula:
          '۱۰۸ + ۳۶ + ۰ (سرپرستی) + ۰ (ایمنی — غیرفعال) + ۱۰ + ۲۲ + ۴ + ۴ + ۴ + ۱۶ + ۲۵ + ۳۰ + ۲۰ (محیط) + ۴۴ (خطرات)',
        expected: WELDER_TOTAL,
        actual: result.totalScore,
        notes: [`امتیاز نظری حداکثر: ${result.maxTheoreticalScore}؛ کامل بودن امتیازدهی: ${result.scoringComplete}`],
      };
    }),
  );

  add('EVAL-02', 'ارزیابی', 'تطبیق امتیاز جوشکار با گروه شغلی (۳۲۳ امتیاز ⇒ گروه ۱۲)', () =>
    withEngine((engine) => {
      const match = engine.matchGroup({ schemeCode: NATIONAL, score: WELDER_TOTAL, asOfDate: '1405-03-15' });
      return {
        input: { score: WELDER_TOTAL },
        formula: 'بازه گروه ۱۲: ۲۹۶ تا ۳۲۵ امتیاز',
        expected: '12|true',
        actual: `${match.group}|${match.matched}`,
      };
    }),
  );

  add('EVAL-03', 'ارزیابی', 'امتیاز و گروه شغل سرپرست تولید (۴۸۹ امتیاز ⇒ گروه ۱۶)', () =>
    withEngine((engine) => {
      const result = engine.evaluatePointBased({
        systemCode: SYS_B,
        evaluationDate: '1405-03-15',
        selections: SUPERVISOR_SELECTIONS,
      });
      const match = engine.matchGroup({ schemeCode: NATIONAL, score: result.totalScore, asOfDate: '1405-03-15' });
      return {
        input: { job: 'سرپرست تولید', supDetail: SUPERVISOR_EXPECTED.supDirect + '+' + SUPERVISOR_EXPECTED.supIndirect },
        formula: `۱۴۴ + ۷۲ + ${SUPERVISOR_SUP} (سرپرستی) + ۱۸ + ۱۰ + ۲۵ + ۲۰ + ۳۲ + ۳۲ + ۵۵ + ۱۵ + ۲ + ۲۲`,
        expected: `${SUPERVISOR_TOTAL}|16`,
        actual: `${result.totalScore}|${match.group}`,
      };
    }),
  );

  add('EVAL-04', 'ارزیابی', 'غیرفعال بودن امتیازدهی زیرعامل «مسئولیت ایمنی دیگران» (وضعیت ۳)', () =>
    withEngine((engine) => {
      const result = engine.evaluatePointBased({
        systemCode: SYS_B,
        evaluationDate: '1405-03-15',
        selections: WELDER_SELECTIONS,
      });
      const saf = result.subFactorScores.find((s) => s.subFactorCode === 'SAF_OTH');
      return {
        input: { subFactor: 'SAF_OTH' },
        formula: 'سقف ۳۰ امتیاز مستند است اما جدول ریزسطوح در دسترس نیست ⇒ امتیاز ۰ و هشدار',
        expected: '0|false|30',
        actual: `${saf?.points}|${result.scoringComplete}|${saf?.maxScore}`,
        notes: [saf?.warnings[0]?.slice(0, 200) ?? ''],
      };
    }),
  );

  add('EVAL-05', 'ارزیابی', 'سقف ۱۲۰ امتیازی شرایط نامساعد محیط کار', () =>
    withEngine((engine) => {
      const items = [
        'ENV_SMOKE',
        'ENV_DIRT',
        'ENV_DUST',
        'ENV_NOISE',
        'ENV_HUMIDITY',
        'ENV_TEMP',
        'ENV_LIGHT',
        'ENV_ODOR',
        'ENV_ISOLATION',
        'ENV_VIBRATION',
        'ENV_HEIGHT',
        'ENV_DEPTH',
      ].map((itemCode) => ({ itemCode, intensityCode: 'SEVERE' as const, hoursBracketCode: 'B8' }));
      const selections = WELDER_SELECTIONS.map((selection) =>
        selection.subFactorCode === 'ENV_CND' ? { subFactorCode: 'ENV_CND', kind: 'ENV_ITEMS' as const, items } : selection,
      );
      const result = engine.evaluatePointBased({ systemCode: SYS_B, evaluationDate: '1405-03-15', selections });
      const env = result.subFactorScores.find((s) => s.subFactorCode === 'ENV_CND');
      return {
        input: { items: 12, severity: 'SEVERE', hours: 'B8' },
        formula: '۱۲ جزء × ۱۰ امتیاز = ۱۲۰ ⇒ سقف ۱۲۰ امتیاز',
        expected: 120,
        actual: env?.points ?? -1,
        notes: [env?.warnings[0] ?? ''],
      };
    }),
  );

  add('EVAL-06', 'ارزیابی', 'سقف ۸۰ امتیازی خطرات ناشی از کار (۴۰ صدمه + ۴۰ مرض)', () =>
    withEngine((engine) => {
      const selections = WELDER_SELECTIONS.map((selection) =>
        selection.subFactorCode === 'OCC_HAZ'
          ? {
              subFactorCode: 'OCC_HAZ',
              kind: 'HAZARD' as const,
              injuryLevelCode: 'HZ_INJ_5',
              injuryProbabilityCode: 'HIGH' as const,
              diseaseProbabilityCode: 'VERY_HIGH' as const,
            }
          : selection,
      );
      const result = engine.evaluatePointBased({ systemCode: SYS_B, evaluationDate: '1405-03-15', selections });
      const haz = result.subFactorScores.find((s) => s.subFactorCode === 'OCC_HAZ');
      return {
        input: { injury: 'HZ_INJ_5 (HIGH)', disease: 'VERY_HIGH' },
        formula: '۴۰ (ازکارافتادگی/فوت با احتمال زیاد) + ۴۰ (امراض با احتمال خیلی زیاد) = ۸۰ ⇒ سقف ۸۰',
        expected: 80,
        actual: haz?.points ?? -1,
      };
    }),
  );

  add('EVAL-07', 'ارزیابی', 'سقف ۷۰ امتیازی سرپرستی (۴۰ مستقیم + ۳۰ غیرمستقیم)', () =>
    withEngine((engine) => {
      const selections = WELDER_SELECTIONS.map((selection) =>
        selection.subFactorCode === 'SUP'
          ? {
              subFactorCode: 'SUP',
              kind: 'SUPERVISION' as const,
              directHeadcountByGrade: { G1: 100, G2: 100, G3: 100, G4: 100, G5: 100 },
              indirectHeadcount: 700,
            }
          : selection,
      );
      const result = engine.evaluatePointBased({ systemCode: SYS_B, evaluationDate: '1405-03-15', selections });
      const sup = result.subFactorScores.find((s) => s.subFactorCode === 'SUP');
      return {
        input: { direct: '۵ درجه × ۱۰۰ نفر', indirect: 700 },
        formula: 'مستقیم min(10+16+30+36+40, 40)=40 + غیرمستقیم min(5×6, 30)=30 ⇒ ۷۰',
        expected: 70,
        actual: sup?.points ?? -1,
      };
    }),
  );

  add('EVAL-08', 'ارزیابی', 'مرز گروه: ۱۲۵ امتیاز ⇒ گروه ۴ و ۱۲۶ امتیاز ⇒ گروه ۵', () =>
    withEngine((engine) => {
      const a = engine.matchGroup({ schemeCode: NATIONAL, score: 125, asOfDate: '1405-03-15' });
      const b = engine.matchGroup({ schemeCode: NATIONAL, score: 126, asOfDate: '1405-03-15' });
      return {
        input: { scores: [125, 126] },
        formula: 'G4: ۱۱۱–۱۲۵ | G5: ۱۲۶–۱۴۵',
        expected: '4|5',
        actual: `${a.group}|${b.group}`,
      };
    }),
  );

  add('EVAL-09', 'ارزیابی', 'امتیاز فراتر از سقف جدول (۷۴۵) ⇒ گروه ۲۰ پیشنهادی و نیازمند بازبینی', () =>
    withEngine((engine) => {
      const match = engine.matchGroup({ schemeCode: NATIONAL, score: 745, asOfDate: '1405-03-15' });
      return {
        input: { score: 745 },
        formula: 'سقف جدول ۷۴۰ امتیاز است',
        expected: '20|false',
        actual: `${match.group}|${match.matched}`,
        notes: [match.warnings[0] ?? ''],
      };
    }),
  );

  add('EVAL-10', 'ارزیابی', 'غیرفعال بودن سیستم A بدون بارگذاری طرح مصوب کارگاه', () => {
    const error = captureError(() =>
      withEngine((engine) =>
        engine.evaluateSystemA({
          systemCode: SYS_A,
          schemeCode: 'WS-A',
          evaluationDate: '1405-03-15',
          selections: [{ subFactorCode: 'A_KNOWLEDGE', levelCode: 'K1' }],
        }),
      ),
    );
    return {
      input: { systemCode: SYS_A, schemeCode: 'WS-A' },
      formula: 'نظام ۱۳۹۵ فقط چارچوب است؛ وزن/سطح/امتیاز باید در طرح مصوب کارگاه بارگذاری شود',
      expected: ERROR_CODES.SCORING_SYSTEM_NOT_READY,
      actual: error.code,
      notes: [error.message.includes(WORKSHOP_SCHEME_REQUIRED_MESSAGE) ? 'پیام راهنمای رسمی صادر شد.' : error.message],
    };
  });

  add('EVAL-11', 'ارزیابی', 'فعال شدن سیستم A پس از بارگذاری طرح مصوب کارگاه (وضعیت ۴)', () =>
    withEngine((engine) => {
      engine.loadWorkshopScheme({
        systemCode: SYS_A,
        schemeCode: 'WS-A',
        schemeVersion: 'A-1.0',
        effectiveFrom: '1405-01-01',
        ministryApprovalReference: '۱۴۰۵/۱۲۳۴۵ — مصوبه کمیته طبقه‌بندی مشاغل استان',
        loadedBy: 'کارشناس آزمون',
        subFactors: [
          {
            factorCode: 'SYS_A_F1',
            subFactorCode: 'A_KNOWLEDGE',
            name: 'دانش فنی',
            maxScore: 200,
            definition: 'دانش نظری و فنی لازم برای تصدی شغل',
            weightPercent: 50,
            levels: [
              { levelCode: 'K1', title: 'دانش پایه', points: 40 },
              { levelCode: 'K2', title: 'دانش متوسط', points: 100 },
              { levelCode: 'K3', title: 'دانش تخصصی', points: 160 },
            ],
          },
          {
            factorCode: 'SYS_A_F3',
            subFactorCode: 'A_RESPONSIBILITY',
            name: 'مسئولیت ایمنی و کیفیت',
            maxScore: 200,
            definition: 'مسئولیت حفظ ایمنی و کیفیت خروجی',
            weightPercent: 50,
            levels: [
              { levelCode: 'R1', title: 'مسئولیت محدود', points: 30 },
              { levelCode: 'R2', title: 'مسئولیت متوسط', points: 80 },
            ],
          },
        ],
        groupRanges: [
          { group: 1, min: 0, max: 100, ceiling: 100, excess: 20, delta: 20 },
          { group: 2, min: 101, max: 200, ceiling: 200, excess: 120, delta: 20 },
          { group: 3, min: 201, max: 400, ceiling: 400, excess: 320, delta: 20 },
        ],
      });
      const result = engine.evaluateSystemA({
        systemCode: SYS_A,
        schemeCode: 'WS-A',
        evaluationDate: '1405-03-15',
        selections: [
          { subFactorCode: 'A_KNOWLEDGE', levelCode: 'K2' },
          { subFactorCode: 'A_RESPONSIBILITY', levelCode: 'R2' },
        ],
      });
      const match = engine.matchGroup({ schemeCode: 'WS-A', score: result.totalScore, asOfDate: '1405-03-15' });
      return {
        input: { K2: 100, R2: 80 },
        formula: '۱۰۰ + ۸۰ = ۱۸۰ ⇒ بازه ۱۰۱–۲۰۰ ⇒ گروه ۲',
        expected: '180|2',
        actual: `${result.totalScore}|${match.group}`,
        notes: [result.warnings.at(-1) ?? ''],
      };
    }),
  );

  add('EVAL-12', 'ارزیابی', 'تغییر گروه با نسخه‌بندی جدول در دو تاریخ مختلف', () =>
    withEngine((engine) => {
      const subFactors = [
        {
          factorCode: 'SYS_A_F1',
          subFactorCode: 'A_KNOWLEDGE',
          name: 'دانش فنی',
          maxScore: 400,
          definition: 'دانش فنی',
          levels: [{ levelCode: 'K1', title: 'سطح یک', points: 250 }],
        },
      ];
      engine.loadWorkshopScheme({
        systemCode: SYS_A,
        schemeCode: 'WS-MULTI',
        schemeVersion: '1.0',
        effectiveFrom: '1405-01-01',
        ministryApprovalReference: '۱۴۰۵/۱ — نسخه اول',
        loadedBy: 'کارشناس',
        subFactors,
        groupRanges: [
          { group: 1, min: 0, max: 300, ceiling: 300, excess: 220, delta: 20 },
          { group: 2, min: 301, max: 600, ceiling: 600, excess: 520, delta: 20 },
        ],
      });
      engine.loadWorkshopScheme({
        systemCode: SYS_A,
        schemeCode: 'WS-MULTI',
        schemeVersion: '2.0',
        effectiveFrom: '1405-07-01',
        ministryApprovalReference: '۱۴۰۵/۲ — نسخه دوم',
        loadedBy: 'کارشناس',
        subFactors,
        groupRanges: [
          { group: 1, min: 0, max: 200, ceiling: 200, excess: 120, delta: 20 },
          { group: 2, min: 201, max: 600, ceiling: 600, excess: 520, delta: 20 },
        ],
      });
      const before = engine.matchGroup({ schemeCode: 'WS-MULTI', score: 250, asOfDate: '1405-03-01' });
      const after = engine.matchGroup({ schemeCode: 'WS-MULTI', score: 250, asOfDate: '1405-08-01' });
      return {
        input: { score: 250, dates: ['1405-03-01', '1405-08-01'] },
        formula: 'نسخه ۱: ۰–۳۰۰ ⇒ G1 | نسخه ۲: ۲۰۱–۶۰۰ ⇒ G2',
        expected: '1|2',
        actual: `${before.group}|${after.group}`,
        notes: [`نسخه مؤثر در تاریخ اول: ${before.tableVersion}`, `نسخه مؤثر در تاریخ دوم: ${after.tableVersion}`],
      };
    }),
  );

  add('EVAL-13', 'ارزیابی', 'عدم امکان امتیازدهی پیش از تاریخ اعتبار جدول امتیازات', () => {
    const error = captureError(() =>
      withEngine((engine) =>
        engine.evaluatePointBased({
          systemCode: SYS_B,
          evaluationDate: '1389-01-01',
          selections: WELDER_SELECTIONS,
        }),
      ),
    );
    return {
      input: { evaluationDate: '1389-01-01' },
      formula: 'نسخه امتیازات ۱۳۸۹٫۱ از ۱۳۸۹/۰۵/۱۸ معتبر است',
      expected: ERROR_CODES.UNKNOWN_LEVEL,
      actual: error.code,
    };
  });

  /* --------------------------- تأیید و قطعی‌سازی --------------------------- */

  add('APR-01', 'تأیید', 'گروه پیشنهادی بدون تأیید کارشناس قطعی نمی‌شود', () =>
    withEngine((engine) => {
      const profileId = engine.createJobProfile(PROFILE_BASE);
      const outcome = engine.evaluateJobProfile({
        jobProfileId: profileId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: WELDER_SELECTIONS,
      });
      const stored = engine.profiles.getEvaluation(outcome.evaluationId);
      return {
        input: { jobProfileId: profileId },
        formula: 'approval_status = PENDING_COMMITTEE_APPROVAL و final_confirmed_group = NULL',
        expected: `PENDING_COMMITTEE_APPROVAL|null|${WELDER_TOTAL}`,
        actual: `${stored.approval_status}|${stored.final_confirmed_group}|${stored.total_score}`,
        notes: [outcome.rationale.at(-1) ?? ''],
      };
    }),
  );

  add('APR-02', 'تأیید', 'رد قطعی‌سازی گروه بدون نام کارشناس تأییدکننده', () => {
    const error = captureError(() =>
      withEngine((engine) => {
        const profileId = engine.createJobProfile(PROFILE_BASE);
        const outcome = engine.evaluateJobProfile({
          jobProfileId: profileId,
          systemCode: SYS_B,
          schemeCode: NATIONAL,
          evaluationDate: '1405-03-15',
          pointBasedSelections: WELDER_SELECTIONS,
        });
        return engine.approveEvaluation({ evaluationId: outcome.evaluationId, reviewerName: '  ' });
      }),
    );
    return {
      input: { reviewerName: '(خالی)' },
      formula: 'reviewed_by_expert الزامی است',
      expected: ERROR_CODES.APPROVAL_REQUIRED,
      actual: error.code,
    };
  });

  add('APR-03', 'تأیید', 'قطعی‌سازی گروه پس از تأیید کارشناس و کمیته', () =>
    withEngine((engine) => {
      const profileId = engine.createJobProfile(PROFILE_BASE);
      const outcome = engine.evaluateJobProfile({
        jobProfileId: profileId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: WELDER_SELECTIONS,
      });
      const approved = engine.approveEvaluation({
        evaluationId: outcome.evaluationId,
        reviewerName: 'کارشناس ارزیابی مشاغل — اداره کل روابط کار',
        committeeReferenceNo: '۱۴۰۵/۸۸۸ — صورت‌جلسه کمیته طبقه‌بندی مشاغل',
        finalGroup: 12,
        approvedAt: '1405-04-10',
      });
      const stored = engine.profiles.getEvaluation(outcome.evaluationId);
      return {
        input: { finalGroup: 12 },
        formula: 'approval_status = COMMITTEE_APPROVED و final_confirmed_group = ۱۲',
        expected: 'COMMITTEE_APPROVED|12|12',
        actual: `${approved.approvalStatus}|${approved.finalConfirmedGroup}|${stored.final_confirmed_group}`,
      };
    }),
  );

  add('APR-04', 'تأیید', 'ممنوعیت ثبت گروه قطعی بدون تأیید در سطح دیتابیس (CHECK)', () =>
    withEngine((engine) => {
      const profileId = engine.createJobProfile(PROFILE_BASE);
      const system = engine.db.get<{ id: number }>(
        'SELECT id FROM evaluation_systems WHERE system_code = ?',
        SYS_B,
      );
      let blocked = false;
      try {
        engine.db.run(
          `INSERT INTO job_evaluations (
             job_profile_id, system_id, scheme_code, group_table_version, factor_scores_json,
             sub_factor_scores_json, total_score, proposed_group, final_confirmed_group,
             determination_reasons_json, expert_warnings_json, approval_status)
           VALUES (?, ?, ?, '1389.1', '[]', '[]', 300, 11, 11, '[]', '[]', 'PENDING_COMMITTEE_APPROVAL')`,
          profileId,
          system?.id ?? 0,
          NATIONAL,
        );
      } catch {
        blocked = true;
      }
      return {
        input: { approval_status: 'PENDING', final_confirmed_group: 11 },
        formula: 'CHECK دیتابیس: گروه قطعی فقط همراه با وضعیت تأییدشده و نام تأییدکننده',
        expected: true,
        actual: blocked,
      };
    }),
  );

  add('APR-05', 'تأیید', 'هشدار ناسازگاری گروه با مدرک تحصیلی شرط احراز', () =>
    withEngine((engine) => {
      const profileId = engine.createJobProfile({ ...PROFILE_BASE, requiredEducation: 'ابتدایی' });
      const outcome = engine.evaluateJobProfile({
        jobProfileId: profileId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: SUPERVISOR_SELECTIONS,
      });
      const warning = outcome.expertWarnings.find((w) => w.includes('دامنه مجاز گروه'));
      return {
        input: { requiredEducation: 'ابتدایی', proposedGroup: outcome.proposedGroup },
        formula: 'حداکثر گروه مجاز برای مدرک ابتدایی = ۱۴',
        expected: true,
        actual: Boolean(warning),
        notes: [warning?.slice(0, 220) ?? 'هشدار صادر نشد.'],
      };
    }),
  );

  add('APR-06', 'تأیید', 'هشدار نقض سلسله‌مراتب امتیاز سرپرستی (مافوق ≥ ۱٫۲ × مادون)', () =>
    withEngine((engine) => {
      const managerId = engine.createJobProfile({
        ...PROFILE_BASE,
        jobCode: 'JOB-MANAGER',
        jobTitle: 'مدیر تولید',
        requiredEducation: 'لیسانس',
      });
      engine.evaluateJobProfile({
        jobProfileId: managerId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: WELDER_SELECTIONS,
      });
      const childId = engine.createJobProfile({
        ...PROFILE_BASE,
        jobCode: 'JOB-SUP',
        jobTitle: 'سرپرست تولید',
        requiredEducation: 'فوق‌دیپلم',
        parentSupervisorJobCode: 'JOB-MANAGER',
      });
      const outcome = engine.evaluateJobProfile({
        jobProfileId: childId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: SUPERVISOR_SELECTIONS,
      });
      const warning = outcome.expertWarnings.find((w) => w.includes('سرپرستی پست مافوق'));
      return {
        input: { parentSup: 0, childSup: SUPERVISOR_SUP },
        formula: '۰ ≥ ۱٫۲ × ۴۲ = ۵۰٫۴ ⇒ نقض',
        expected: true,
        actual: Boolean(warning),
        notes: [warning?.slice(0, 200) ?? 'هشدار صادر نشد.'],
      };
    }),
  );

  add('APR-07', 'تأیید', 'ثبت تاریخچه کامل محاسبات (calculation_history)', () =>
    withEngine((engine) => {
      const profileId = engine.createJobProfile(PROFILE_BASE);
      engine.evaluateJobProfile({
        jobProfileId: profileId,
        systemCode: SYS_B,
        schemeCode: NATIONAL,
        evaluationDate: '1405-03-15',
        pointBasedSelections: WELDER_SELECTIONS,
      });
      engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 12,
        priorDailyJobWage: 3_566_838,
        computationDate: '1405-03-15',
      });
      return {
        input: { operations: ['JOB_EVALUATION', 'WAGE_COMPUTATION'] },
        formula: 'ثبت trace_id، ورودی، جداول اعمالی و خروجی هر عملیات',
        expected: true,
        actual: engine.history('job_evaluation').length > 0 && engine.history('wage_calculation').length > 0,
      };
    }),
  );

  /* ---------------------------- ساختار و نسخه‌ها ---------------------------- */

  add('SYS-01', 'ساختار', 'وجود ۱۷ جدول مستقل و اجرای کامل مهاجرت‌ها', () =>
    withEngine((engine) => {
      const tables = engine.db
        .all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_migrations'`)
        .map((row) => row.name)
        .filter((name) => name !== 'sqlite_sequence');
      const expectedTables = [
        'evaluation_systems',
        'evaluation_factors',
        'evaluation_sub_factors',
        'evaluation_levels',
        'evaluation_scores',
        'evaluation_weights',
        'group_score_ranges',
        'job_profiles',
        'job_evaluations',
        'wage_tables',
        'seniority_tables',
        'annual_labor_parameters',
        'employee_records',
        'wage_calculations',
        'calculation_history',
        'legal_documents',
        'formula_versions',
      ];
      const missing = expectedTables.filter((name) => !tables.includes(name));
      const migrations = engine.db.all<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
      return {
        input: { expectedTables: expectedTables.length },
        formula: 'بررسی sqlite_master و schema_migrations',
        expected: '0|2',
        actual: `${missing.length}|${migrations.length}`,
        notes: [`جداول موجود: ${tables.length}`],
      };
    }),
  );

  add('SYS-02', 'ساختار', 'شناسنامه نسخه‌بندی فرمول‌ها با واحد ریال و وضعیت اعتبار', () =>
    withEngine((engine) => {
      const formulas = engine.listFormulaVersions();
      const invalidCurrency = formulas.filter((f) => f.currency_unit !== 'IRR').length;
      const codes = new Set(formulas.map((f) => f.formula_code));
      const required = [
        'FRM-JOB-WAGE-1405',
        'FRM-SEN-TOTAL-1405',
        'FRM-GRP-MATCH',
        'FRM-ARREARS',
        'FRM-EVAL-B-TOTAL',
        'FRM-EVAL-A-TOTAL',
      ];
      const missing = required.filter((code) => !codes.has(code));
      const jobWage = formulas.find((f) => f.formula_code === 'FRM-JOB-WAGE-1405');
      return {
        input: { formulaCount: formulas.length },
        formula: 'همه ردیف‌ها باید currency_unit = IRR و وضعیت یکی از چهار وضعیت مجاز باشند',
        expected: '0|0',
        actual: `${invalidCurrency}|${missing.length}`,
        notes: [
          `تعداد فرمول‌های ثبت‌شده: ${formulas.length}`,
          `فرمول مزد شغل ۱۴۰۵: نسخه ${jobWage?.version} — منبع: ${jobWage?.legal_source}`,
        ],
      };
    }),
  );

  add('SYS-03', 'ساختار', 'بازتولید مستقل جدول مزد ۱۴۰۵ از ضریب ریالی و کف مصوب', () =>
    withEngine((engine) => {
      const rows = engine.db.all<{ group_number: number; daily_job_wage: number; rial_coefficient_a: number; base_floor_daily_wage: number }>(
        `SELECT group_number, daily_job_wage, rial_coefficient_a, base_floor_daily_wage
         FROM wage_tables WHERE scheme_code = ? AND fiscal_year = 1405 ORDER BY group_number`,
        SERVICE,
      );
      const excess: Record<number, number> = {
        1: 0, 2: 15, 3: 30, 4: 45, 5: 65, 6: 85, 7: 105, 8: 130, 9: 155, 10: 185,
        11: 215, 12: 245, 13: 285, 14: 325, 15: 365, 16: 415, 17: 465, 18: 525, 19: 585, 20: 660,
      };
      const mismatches = rows.filter(
        (row) => row.daily_job_wage !== Math.round(row.base_floor_daily_wage + row.rial_coefficient_a * (excess[row.group_number] ?? 0)),
      );
      return {
        input: { scheme: SERVICE, groups: rows.length },
        formula: 'Yn = b + a × (Xn − 80) با a = 610.6675 و b = 5,541,850',
        expected: '0|20',
        actual: `${mismatches.length}|${rows.length}`,
      };
    }),
  );

  add('SYS-04', 'ساختار', 'یکنواختی و گام‌های جدول نرخ پایه سنوات ۱۴۰۵', () =>
    withEngine((engine) => {
      const rates = Array.from({ length: 20 }, (_, index) =>
        engine.seniorityRate({ schemeCode: NATIONAL, group: index + 1, fiscalYear: 1405, asOfDate: '1405-05-01' }).rate ?? 0,
      );
      const steps = rates.slice(1).map((rate, index) => rate - (rates[index] as number));
      const firstTen = steps.slice(0, 10).every((step) => step === 200);
      const lastNine = steps.slice(10).every((step) => step === 400);
      return {
        input: { groups: '1..20' },
        formula: 'گام +۲۰۰ ریال تا گروه ۱۱ و +۴۰۰ ریال از گروه ۱۲ تا ۲۰',
        expected: 'true|true|166667|172267',
        actual: `${firstTen}|${lastNine}|${rates[0]}|${rates[19]}`,
      };
    }),
  );

  add('SYS-05', 'ساختار', 'درون‌یابی خطی مزد سنوات تجمیعی برای سابقه ۷٫۵ سال', () =>
    withEngine((engine) => {
      const exact = engine.cumulativeSeniority({ schemeCode: NATIONAL, yearsOfService: 8, asOfDate: '1405-05-01' });
      const mid = engine.cumulativeSeniority({ schemeCode: NATIONAL, yearsOfService: 7.5, asOfDate: '1405-05-01' });
      return {
        input: { years: [7, 7.5, 8] },
        formula: '1,143,906 + 0.5 × (1,275,733 − 1,143,906) = 1,209,819.5 ⇒ 1,209,820',
        expected: `1275733|1209820`,
        actual: `${exact.amount}|${mid.amount}`,
      };
    }),
  );

  add('SYS-06', 'ساختار', 'پارامترهای ۱۴۰۵: حداقل مزد، بن، تأهل و نسبت حق اولاد', () =>
    withEngine((engine) => {
      const p = engine.db.get<{
        min_daily_wage: number;
        grocery_allowance_monthly: number;
        marital_allowance_monthly: number;
        child_allowance_multiplier: number;
        other_levels_increase_pct: number;
        other_levels_fixed_daily: number;
      }>('SELECT * FROM annual_labor_parameters WHERE fiscal_year = 1405 AND version = ?', '1405-v2');
      return {
        input: { version: '1405-v2' },
        formula: 'حداقل مزد ۵٬۵۴۱٬۸۵۰ | بن ۲۲٬۰۰۰٬۰۰۰ | تأهل ۵٬۰۰۰٬۰۰۰ | ضریب حق اولاد ۳ | افزایش ۴۵٪ + ۵۱۹٬۵۴۹',
        expected: '5541850|22000000|5000000|3|45|519549',
        actual: `${p?.min_daily_wage}|${p?.grocery_allowance_monthly}|${p?.marital_allowance_monthly}|${p?.child_allowance_multiplier}|${p?.other_levels_increase_pct}|${p?.other_levels_fixed_daily}`,
      };
    }),
  );

  add('SYS-07', 'ساختار', 'محاسبه ضریب ریالی جدول مزد با فرمول رسمی تدوین طرح', () =>
    withEngine((engine) => {
      const groups = Array.from({ length: 20 }, (_, index) => ({
        group: index + 1,
        excessOverGroup1: [0, 15, 30, 45, 65, 85, 105, 130, 155, 185, 215, 245, 285, 325, 365, 415, 465, 525, 585, 660][index] as number,
      }));
      const a = engine.db.get<{ rial_coefficient_a: number }>(
        'SELECT rial_coefficient_a FROM wage_tables WHERE scheme_code = ? AND fiscal_year = 1405 AND group_number = 1',
        SERVICE,
      );
      // a_1405 باید برابر ۱٫۴۵ برابر a_1404 باشد
      const a1404 = engine.db.get<{ rial_coefficient_a: number }>(
        'SELECT rial_coefficient_a FROM wage_tables WHERE scheme_code = ? AND fiscal_year = 1404 AND group_number = 1',
        SERVICE,
      );
      const expected = Math.round((a1404?.rial_coefficient_a ?? 0) * 1.45 * 1e6) / 1e6;
      return {
        input: { groups: groups.length, a1404: a1404?.rial_coefficient_a },
        formula: 'a_1405 = 1.45 × a_1404 = 1.45 × 421.15',
        expected: expected.toFixed(4),
        actual: (a?.rial_coefficient_a ?? 0).toFixed(4),
      };
    }),
  );

  add('SYS-08', 'ساختار', 'ذخیره محاسبه در جدول wage_calculations و بازیابی آن', () =>
    withEngine((engine) => {
      const wage = engine.computeWage({
        schemeCode: SERVICE,
        jobGroup: 7,
        priorDailyJobWage: 3_507_877,
        priorAccumulatedDailySeniority: 166_667,
        serviceYearsInWorkshop: 4,
        computationDate: '1405-03-15',
      });
      const id = engine.saveWageCalculation(wage, null);
      const row = engine.db.get<{ daily_job_wage: number; gross_total: number; currency_unit: string }>(
        'SELECT daily_job_wage, gross_total, currency_unit FROM wage_calculations WHERE id = ?',
        id,
      );
      return {
        input: { group: 7, savedId: id },
        formula: 'ذخیره مزد شغل، مزد مبنا، مزایا، بیمه و خالص در wage_calculations',
        expected: `${wage.dailyJobWage}|${wage.grossTotal}|IRR`,
        actual: `${row?.daily_job_wage}|${row?.gross_total}|${row?.currency_unit}`,
      };
    }),
  );

  return results;
}

export const SCENARIO_COUNT = runAllScenarios.length;
