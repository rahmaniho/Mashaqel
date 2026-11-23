/**
 * بذر جدول‌های مزد و پایه سنوات:
 * ۱) جدول مزد ۲۰ گروهی شرکت‌های خدماتی پیمانکاری تأمین نیروی انسانی برای ۱۴۰۴ و ۱۴۰۵
 *    بر مبنای فرمول رسمی Yn = b + a × (Xn − 80)
 * ۲) جدول نرخ پایه سنوات روزانه ۱۴۰۵ به تفکیک گروه (ماده ۲ دستورالعمل ۶۷۲۴)
 * ۳) جدول رسمی احتساب مزد سنوات تجمیعی گذشته تا پایان ۱۴۰۴
 */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';
import { getLegalDocumentId } from './legalDocuments.ts';
import { GROUP_RANGES_20 } from './groupScoreRanges.ts';

export const SERVICE_SCHEME_CODE = 'SERVICE_COMPANIES_NATIONWIDE';
export const SERVICE_SCHEME_TITLE = 'طرح طبقه‌بندی مشاغل شرکت‌های خدماتی پیمانکاری تأمین نیروی انسانی';

/** ضرایب ریالی رسمی جدول مزد شرکت‌های خدماتی */
export const SERVICE_WAGE_COEFFICIENTS = {
  1404: { a: 421.15, b: 3_463_656 },
  1405: { a: 610.6675, b: 5_541_850 },
} as const;

/** نرخ پایه سنوات روزانه ۱۴۰۵ گروه‌های بیست‌گانه (ریال) — ماده ۲ دستورالعمل ۶۷۲۴ */
export const SENIORITY_RATES_1405: Record<number, number> = {
  1: 166_667,
  2: 166_867,
  3: 167_067,
  4: 167_267,
  5: 167_467,
  6: 167_667,
  7: 167_867,
  8: 168_067,
  9: 168_267,
  10: 168_467,
  11: 168_667,
  12: 169_067,
  13: 169_467,
  14: 169_867,
  15: 170_267,
  16: 170_667,
  17: 171_067,
  18: 171_467,
  19: 171_867,
  20: 172_267,
};

/** جدول رسمی احتساب مزد سنوات تجمیعی تا پایان ۱۴۰۴ (مبنای گروه ۱) — ریال */
export const CUMULATIVE_SENIORITY_1404: Record<number, number> = {
  0: 0,
  1: 166_667,
  2: 302_967,
  3: 436_947,
  4: 600_403,
  5: 798_184,
  6: 980_142,
  7: 1_143_906,
  8: 1_275_733,
  9: 1_384_264,
  10: 1_504_088,
  11: 1_583_026,
  12: 1_673_014,
  13: 1_725_661,
  14: 1_761_041,
  15: 1_793_471,
  16: 1_821_234,
  17: 1_850_658,
  18: 1_870_336,
  19: 1_890_997,
  20: 1_912_693,
  21: 1_936_559,
  22: 1_957_977,
  23: 1_976_879,
  24: 1_991_789,
  25: 2_004_572,
  26: 2_015_417,
  27: 2_024_591,
  28: 2_030_201,
  29: 2_034_946,
  30: 2_039_736,
};

/** محاسبه مزد شغل روزانه گروه بر مبنای فرمول رسمی جدول مزد */
export function computeGroupDailyWage(group: number, fiscalYear: 1404 | 1405): number {
  const range = GROUP_RANGES_20.find((row) => row.group === group);
  if (!range) throw new Error(`گروه شغلی ${group} در جدول ۲۰ گروهی وجود ندارد.`);
  const { a, b } = SERVICE_WAGE_COEFFICIENTS[fiscalYear];
  return Math.round(b + a * range.excess);
}

export function seedWageTables(db: Db): void {
  const docId1404 = getLegalDocumentId(db, 'CONTRACTING_CIRCULAR_52160');
  const docId1405 = getLegalDocumentId(db, 'INSTRUCTION_6724_1405');
  const stmt = db.raw.prepare(`
    INSERT INTO wage_tables (
      scheme_code, scheme_title, workshop_code, fiscal_year, version, effective_from, effective_to,
      currency_unit, base_floor_daily_wage, rial_coefficient_a, has_ranking_system, rank_interval_years,
      group_number, daily_job_wage, legal_document_id, validity_status
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, 'IRR', ?, ?, 0, 4, ?, ?, ?, ?)
    ON CONFLICT(scheme_code, fiscal_year, version, group_number) DO NOTHING
  `);

  for (const year of [1404, 1405] as const) {
    const { a, b } = SERVICE_WAGE_COEFFICIENTS[year];
    for (const range of GROUP_RANGES_20) {
      stmt.run(
        SERVICE_SCHEME_CODE,
        SERVICE_SCHEME_TITLE,
        year,
        year === 1404 ? '1404.1' : '1405.1',
        year === 1404 ? '1404-01-01' : '1405-01-01',
        year === 1404 ? '1404-12-29' : '1405-12-29',
        b,
        a,
        range.group,
        computeGroupDailyWage(range.group, year),
        year === 1404 ? docId1404 : docId1405,
        year === 1404 ? VALIDITY_STATUS.VERIFIED_USABLE : VALIDITY_STATUS.VERIFIED_USABLE,
      );
    }
  }
}

export function seedSeniorityTables(db: Db): void {
  const docId = getLegalDocumentId(db, 'INSTRUCTION_6724_1405');
  const stmt = db.raw.prepare(`
    INSERT INTO seniority_tables (
      scheme_code, table_type, fiscal_year, version, effective_from, effective_to, currency_unit,
      group_number, years_of_service, daily_seniority_amount, legal_document_id, validity_status
    ) VALUES (?, ?, ?, ?, ?, ?, 'IRR', ?, ?, ?, ?, ?)
  `);

  // جدول ماده ۲ دستورالعمل ۶۷۲۴ برای همه طرح‌هایی که بر جدول گروه‌های بیست‌گانه استوارند یکسان است
  const SCHEMES = ['NATIONAL_20_GROUP_1389', SERVICE_SCHEME_CODE];

  db.transaction(() => {
    for (const schemeCode of SCHEMES) {
      const exists = db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM seniority_tables
         WHERE scheme_code = ? AND table_type = 'ANNUAL_GROUP_RATE' AND fiscal_year = 1405`,
        schemeCode,
      );
      if ((exists?.count ?? 0) > 0) continue;

      for (const [groupStr, amount] of Object.entries(SENIORITY_RATES_1405)) {
        const group = Number(groupStr);
        stmt.run(
          schemeCode,
          'ANNUAL_GROUP_RATE',
          1405,
          '1405.1',
          '1405-01-01',
          '1405-12-29',
          group,
          null,
          amount,
          docId,
          VALIDITY_STATUS.VERIFIED_USABLE,
        );
      }
      for (const [yearsStr, amount] of Object.entries(CUMULATIVE_SENIORITY_1404)) {
        const years = Number(yearsStr);
        stmt.run(
          schemeCode,
          'CUMULATIVE_PAST_SERVICE',
          1404,
          '1404.1',
          '1405-01-01',
          null,
          null,
          years,
          amount,
          docId,
          VALIDITY_STATUS.VERIFIED_USABLE,
        );
      }
    }
  });
}
