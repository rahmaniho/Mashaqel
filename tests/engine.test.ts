/**
 * آزمون‌های خودکار موتور طبقه‌بندی مشاغل و محاسبات مزد (node:test)
 * اجرا: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MashaqelEngine,
  MashaqelError,
  ERROR_CODES,
  isLeapJalaliYear,
  jalaliToIso,
  isoToJalali,
  normalizeJalaliDate,
  daysInYearMonth,
  enumerateYearMonths,
  toIrr,
  toToman,
  roundMoney,
  detectTomanSuspicion,
  guardReferenceAmount,
  educationShortageDeductionYears,
  tvtoHoursToScore,
  tvtoHoursToExperienceYears,
  supervisionHierarchyCheck,
  countEligibleRanks,
  rankDailyWage,
  computeRialCoefficient,
  createDatabase,
  applyMigrations,
} from '../src/index.ts';
import { runAllScenarios } from './scenarios.ts';

describe('سناریوهای جامع محاسبات و ارزیابی', () => {
  const results = runAllScenarios();

  it('همه سناریوها اجرا و ثبت شده‌اند', () => {
    assert.ok(results.length >= 40, `تعداد سناریوها کم است: ${results.length}`);
  });

  for (const scenario of results) {
    it(`${scenario.id} — ${scenario.title}`, () => {
      const message = [
        `ورودی: ${scenario.input}`,
        `فرمول: ${scenario.formula}`,
        `انتظار: ${String(scenario.expected)}`,
        `واقعی: ${String(scenario.actual)}`,
        ...scenario.notes.filter(Boolean).map((note) => `یادداشت: ${note}`),
      ].join('\n');
      assert.ok(scenario.pass, message);
    });
  }
});

describe('تاریخ شمسی', () => {
  it('نوروز ۱۴۰۵ برابر ۲۱ مارس ۲۰۲۶ است', () => {
    assert.equal(jalaliToIso({ year: 1405, month: 1, day: 1 }), '2026-03-21');
  });

  it('تبدیل رفت و برگشت میلادی/شمسی', () => {
    const parts = isoToJalali('2026-03-21');
    assert.deepEqual(parts, { year: 1405, month: 1, day: 1 });
  });

  it('سال ۱۴۰۳ کبیسه و ۱۴۰۴ عادی است', () => {
    assert.equal(isLeapJalaliYear(1403), true);
    assert.equal(isLeapJalaliYear(1404), false);
  });

  it('طول ماه‌های شمسی', () => {
    assert.equal(daysInYearMonth('1405-01'), 31);
    assert.equal(daysInYearMonth('1405-07'), 30);
    assert.equal(daysInYearMonth('1405-12'), 29);
    assert.equal(daysInYearMonth('1403-12'), 30);
  });

  it('رد تاریخ نامعتبر', () => {
    assert.throws(() => normalizeJalaliDate('1405-12-30'), MashaqelError);
    assert.throws(() => normalizeJalaliDate('1405-13-01'), MashaqelError);
    assert.throws(() => normalizeJalaliDate('abc'), MashaqelError);
  });

  it('شمارش سال-ماه‌ها', () => {
    assert.deepEqual(enumerateYearMonths('1404-11', '1405-02'), ['1404-11', '1404-12', '1405-01', '1405-02']);
  });
});

describe('محافظ واحد پولی ریال/تومان', () => {
  it('تبدیل تومان به ریال', () => {
    assert.equal(toIrr(5_541_850, 'TOMAN'), 55_418_500);
    assert.equal(toIrr(5_541_850, 'IRR'), 5_541_850);
  });

  it('تبدیل ریال به تومان فقط برای نمایش', () => {
    assert.equal(toToman(5_541_850), 554_185);
  });

  it('رد واحد پولی ناشناخته', () => {
    assert.throws(() => toIrr(1000, 'USD'), MashaqelError);
  });

  it('تشخیص مبلغ تومانی', () => {
    assert.equal(detectTomanSuspicion(554_185, 5_541_850), true);
    assert.equal(detectTomanSuspicion(5_541_850, 5_541_850), false);
    assert.equal(detectTomanSuspicion(3_463_656, 5_541_850), false);
  });

  it('نگهبان مبلغ مرجع خطای تومان می‌دهد', () => {
    assert.throws(() => guardReferenceAmount(554_185, 5_541_850, 'min_daily_wage'), MashaqelError);
  });

  it('گرد کردن پول', () => {
    assert.equal(roundMoney(5_541_850.4), 5_541_850);
    assert.equal(roundMoney(5_541_850.5), 5_541_851);
  });

  it('مبلغ منفی در محافظ رد می‌شود', () => {
    assert.throws(() => toIrr(-1, 'IRR'), MashaqelError);
  });
});

describe('قواعد مکمل قانونی', () => {
  it('جدول کسر سابقه بابت کمبود تحصیل (بی‌سواد با شرط دیپلم = ۹ سال)', () => {
    const result = educationShortageDeductionYears('BI_SWAD', 'DIPLOMA');
    assert.equal(result.years, 9);
    assert.equal(result.status, '1_VERIFIED_USABLE');
  });

  it('کسر سابقه برای دیپلم با شرط دیپلم صفر است', () => {
    assert.equal(educationShortageDeductionYears('DIPLOMA', 'DIPLOMA').years, 0);
  });

  it('معادل‌سازی ساعت آموزش مهارت', () => {
    assert.equal(tvtoHoursToScore(1_080), 108);
    assert.equal(tvtoHoursToExperienceYears(720), 6);
    assert.equal(tvtoHoursToExperienceYears(1_440), 6);
    assert.equal(tvtoHoursToExperienceYears(1_440, true), 8);
  });

  it('کنترل سلسله‌مراتب سرپرستی', () => {
    assert.equal(supervisionHierarchyCheck(50, 40).compliant, true);
    assert.equal(supervisionHierarchyCheck(40, 40).compliant, false);
    assert.equal(supervisionHierarchyCheck(40, 40).gap, 8);
  });

  it('شمارش رتبه و مبلغ رتبه', () => {
    assert.equal(countEligibleRanks({ serviceYears: 10, requiredExperienceYears: 2 }), 2);
    assert.equal(countEligibleRanks({ serviceYears: 3, requiredExperienceYears: 2 }), 0);
    assert.equal(rankDailyWage(20, 610.6675), 12_213);
  });

  it('ضریب ریالی از فرمول تدوین طرح', () => {
    const groups = [
      { group: 1, excessOverGroup1: 0 },
      { group: 2, excessOverGroup1: 15 },
    ];
    const a = computeRialCoefficient({
      secondGroupWage: 3_469_973,
      totalGroups: 1,
      baseFloorWage: 3_463_656,
      groups,
    });
    assert.ok(Math.abs(a - 421.13) < 1, `ضریب محاسبه‌شده: ${a}`);
  });
});

describe('اسکیمای دیتابیس و قیدهای یکپارچگی', () => {
  it('کلید خارجی نامعتبر رد می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(() =>
        engine.db.run(
          `INSERT INTO evaluation_factors (system_id, factor_code, name, display_order, definition, validity_status)
           VALUES (999999, 'X', 'X', 1, 'X', '1_VERIFIED_USABLE')`,
        ),
      );
    } finally {
      engine.close();
    }
  });

  it('وضعیت اعتبار نامعتبر رد می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(() =>
        engine.db.run(
          `INSERT INTO evaluation_systems (system_code, name, legal_basis, approval_date_jalali, version,
             effective_from, scoring_mode, validity_status)
           VALUES ('X', 'X', 'X', '1405-01-01', '1', '1405-01-01', 'POINT_FACTOR_FIXED', 'UNKNOWN_STATUS')`,
        ),
      );
    } finally {
      engine.close();
    }
  });

  it('واحد پول غیر ریالی برای جدول مزد رد می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(() =>
        engine.db.run(
          `INSERT INTO wage_tables (scheme_code, scheme_title, fiscal_year, version, effective_from,
             currency_unit, base_floor_daily_wage, rial_coefficient_a, group_number, daily_job_wage, validity_status)
           VALUES ('X', 'X', 1405, '1', '1405-01-01', 'USD', 5541850, 500, 1, 5541850, '1_VERIFIED_USABLE')`,
        ),
      );
    } finally {
      engine.close();
    }
  });

  it('مزد روزانه کمتر از کف جدول در جدول مزد رد می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(() =>
        engine.db.run(
          `INSERT INTO wage_tables (scheme_code, scheme_title, fiscal_year, version, effective_from,
             base_floor_daily_wage, rial_coefficient_a, group_number, daily_job_wage, validity_status)
           VALUES ('X', 'X', 1405, '1', '1405-01-01', 6000000, 500, 1, 5000000, '1_VERIFIED_USABLE')`,
        ),
      );
    } finally {
      engine.close();
    }
  });

  it('مهاجرت‌ها فقط یک بار اعمال می‌شوند', () => {
    const raw = createDatabase(':memory:');
    const first = applyMigrations(raw);
    const second = applyMigrations(raw);
    assert.ok(first.length > 0);
    assert.equal(second.length, 0);
    raw.close();
  });

  it('بذرها idempotent هستند (اجرای دوباره داده تکراری ایجاد نمی‌کند)', () => {
    const engine = MashaqelEngine.open();
    try {
      const before = engine.listFormulaVersions().length;
      const groupsBefore = engine.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM group_score_ranges')?.c;
      engine.close();
      const reopened = MashaqelEngine.open();
      try {
        assert.equal(reopened.listFormulaVersions().length, before);
        assert.equal(reopened.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM group_score_ranges')?.c, groupsBefore);
      } finally {
        reopened.close();
      }
    } catch (error) {
      throw error;
    }
  });
});

describe('محاسبات مزد — قواعد تکمیلی', () => {
  it('کف حداقل مزد روزانه همیشه رعایت می‌شود (پایین‌ترین ورودی ممکن)', () => {
    const engine = MashaqelEngine.open();
    try {
      const wage = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 1,
        priorDailyJobWage: 3_463_656,
        payableDays: 30,
        computationDate: '1405-01-01',
      });
      assert.equal(wage.dailyJobWage, 5_541_850);
      assert.equal(wage.monthlyJobWage, 166_255_500);
      assert.equal(wage.minimumWageCompliance.compliant, true);
      assert.equal(wage.currencyUnit, 'IRR');
    } finally {
      engine.close();
    }
  });

  it('مزایای رفاهی هرگز در مزد شغل و مزد مبنا ادغام نمی‌شوند', () => {
    const engine = MashaqelEngine.open();
    try {
      const withoutWelfare = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 6,
        priorDailyJobWage: 3_499_454,
        priorAccumulatedDailySeniority: 166_667,
        serviceYearsInWorkshop: 2,
        includeWelfareBenefits: false,
        computationDate: '1405-03-01',
      });
      const withWelfare = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 6,
        priorDailyJobWage: 3_499_454,
        priorAccumulatedDailySeniority: 166_667,
        serviceYearsInWorkshop: 2,
        isMarried: true,
        eligibleChildrenCount: 1,
        computationDate: '1405-03-01',
      });
      assert.equal(withoutWelfare.dailyJobWage, withWelfare.dailyJobWage);
      assert.equal(withoutWelfare.dailyBaseWage, withWelfare.dailyBaseWage);
      assert.equal(withoutWelfare.welfareSubtotal, 0);
      assert.ok(withWelfare.welfareSubtotal > 0);
      assert.equal(withWelfare.grossTotal - withoutWelfare.grossTotal, withWelfare.welfareSubtotal);
    } finally {
      engine.close();
    }
  });

  it('کاهش کارکرد، مزایای ماهانه را به نسبت کاهش می‌دهد', () => {
    const engine = MashaqelEngine.open();
    try {
      const full = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 9,
        priorDailyJobWage: 3_528_934,
        payableDays: 30,
        computationDate: '1405-03-01',
      });
      const partial = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 9,
        priorDailyJobWage: 3_528_934,
        payableDays: 15,
        computationDate: '1405-03-01',
      });
      assert.equal(full.groceryAllowance, 22_000_000);
      assert.equal(partial.groceryAllowance, 11_000_000);
      assert.equal(partial.housingAllowance, 15_000_000);
    } finally {
      engine.close();
    }
  });

  it('مالیات در نبود پلکان مصوب صفر است و هشدار وضعیت ۴ صادر می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      const wage = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 9,
        priorDailyJobWage: 3_528_934,
        computationDate: '1405-03-01',
      });
      assert.equal(wage.tax, 0);
      assert.ok(wage.warnings.some((w) => w.includes('مالیات')));
    } finally {
      engine.close();
    }
  });

  it('ماشین‌حساب مالیات با پلکان مصوب (تست کمکی)', () => {
    const engine = MashaqelEngine.open();
    try {
      engine.db.run(
        `UPDATE annual_labor_parameters SET tax_brackets_json = ?
         WHERE fiscal_year = 1405 AND version = '1405-v2'`,
        JSON.stringify([
          { upTo: 50_000_000, rate: 0 },
          { upTo: 150_000_000, rate: 0.1 },
          { upTo: null, rate: 0.15 },
        ]),
      );
      const wage = engine.computeWage({
        schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
        jobGroup: 9,
        priorDailyJobWage: 3_528_934,
        includeWelfareBenefits: false,
        computationDate: '1405-03-01',
      });
      const taxable = wage.grossTotal;
      const expectedTax = Math.round(
        (Math.min(taxable, 150_000_000) - 50_000_000) * 0.1 + Math.max(0, taxable - 150_000_000) * 0.15,
      );
      assert.ok(taxable > 150_000_000, 'برای آزمون پلکان سوم، مزد مشمول باید بیش از ۱۵۰ میلیون ریال باشد');
      assert.equal(wage.tax, expectedTax);
    } finally {
      engine.close();
    }
  });

  it('خطای صریح در نبود نسخه پارامتر درخواستی', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(
        () =>
          engine.computeWage({
            schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
            jobGroup: 3,
            priorDailyJobWage: 3_476_291,
            parameterVersion: '1405-ناموجود',
            computationDate: '1405-03-01',
          }),
        (error: unknown) =>
          error instanceof MashaqelError && error.code === ERROR_CODES.MISSING_PARAMETERS,
      );
    } finally {
      engine.close();
    }
  });
});

describe('ارزیابی — قواعد تکمیلی', () => {
  it('زیرعامل ناشناخته در ورودی رد می‌شود', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(
        () =>
          engine.evaluatePointBased({
            systemCode: 'EVAL_1389_POINT_FACTOR',
            evaluationDate: '1405-03-01',
            selections: [{ subFactorCode: 'UNKNOWN', kind: 'LEVEL', levelCode: 'X' }],
          }),
        (error: unknown) => error instanceof MashaqelError && error.code === ERROR_CODES.UNKNOWN_SUB_FACTOR,
      );
    } finally {
      engine.close();
    }
  });

  it('نبود انتخاب برای زیرعامل فعال، خطای صریح ایجاد می‌کند', () => {
    const engine = MashaqelEngine.open();
    try {
      assert.throws(
        () =>
          engine.evaluatePointBased({
            systemCode: 'EVAL_1389_POINT_FACTOR',
            evaluationDate: '1405-03-01',
            selections: [{ subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_3' }],
          }),
        MashaqelError,
      );
    } finally {
      engine.close();
    }
  });

  it('تطبیق گروه با نسخه صریح جدول', () => {
    const engine = MashaqelEngine.open();
    try {
      const result = engine.matchGroup({
        schemeCode: 'NATIONAL_20_GROUP_1389',
        score: 500,
        asOfDate: '1405-03-01',
        tableVersion: '1389.1',
      });
      assert.equal(result.matched, true);
      assert.equal(result.group, 17);
      assert.equal(result.range?.ceiling_score_xn, 545);
    } finally {
      engine.close();
    }
  });

  it('عدم تطبیق در نبود جدول گروه برای طرح', () => {
    const engine = MashaqelEngine.open();
    try {
      const result = engine.matchGroup({ schemeCode: 'NO_TABLE', score: 100, asOfDate: '1405-03-01' });
      assert.equal(result.matched, false);
      assert.equal(result.group, null);
      assert.ok(result.warnings.length > 0);
    } finally {
      engine.close();
    }
  });
});
