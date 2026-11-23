/** تطبیق امتیاز کل شغل با جدول نسخه‌بندی‌شده دامنه امتیاز گروه‌های شغلی */

import type { Db } from '../db/query.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import { ERROR_CODES, MashaqelError, VALIDITY_STATUS_LABELS, requiresExpertWarning } from '../core/status.ts';
import type { GroupMatchResult, GroupRangeRow } from '../core/types.ts';

export interface GroupMatchInput {
  schemeCode: string;
  score: number;
  asOfDate: string;
  tableVersion?: string;
  systemCode?: string;
}

export interface AvailableGroupTable {
  schemeCode: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  groupCount: number;
  maxScore: number;
}

export function listGroupTables(db: Db, schemeCode?: string): AvailableGroupTable[] {
  const sql = `
    SELECT scheme_code AS schemeCode, version,
           MIN(effective_from) AS effectiveFrom, MAX(effective_to) AS effectiveTo,
           COUNT(*) AS groupCount, MAX(max_score) AS maxScore
    FROM group_score_ranges
    ${schemeCode ? 'WHERE scheme_code = ?' : ''}
    GROUP BY scheme_code, version
    ORDER BY scheme_code, version
  `;
  const params = schemeCode ? [schemeCode] : [];
  return db.all<AvailableGroupTable>(sql, ...params);
}

export function resolveGroupTableVersion(db: Db, schemeCode: string, asOfDate: string): string | undefined {
  const date = normalizeJalaliDate(asOfDate);
  const rows = db.all<{ version: string; effective_from: string; effective_to: string | null }>(
    `SELECT DISTINCT version, effective_from, effective_to FROM group_score_ranges
     WHERE scheme_code = ? ORDER BY effective_from DESC, version DESC`,
    schemeCode,
  );
  const found = rows.find((row) => date >= row.effective_from && (!row.effective_to || date <= row.effective_to));
  return found?.version;
}

export function matchGroup(db: Db, input: GroupMatchInput): GroupMatchResult {
  if (!Number.isFinite(input.score) || input.score < 0) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `امتیاز کل شغل نامعتبر است: ${input.score}`);
  }
  const date = normalizeJalaliDate(input.asOfDate);
  const version = input.tableVersion ?? resolveGroupTableVersion(db, input.schemeCode, date);
  if (!version) {
    return {
      matched: false,
      group: null,
      range: null,
      tableVersion: null,
      candidates: [],
      warnings: [
        `برای طرح «${input.schemeCode}» در تاریخ ${date} هیچ جدول دامنه امتیاز گروه‌بندی ثبت نشده است؛ تعیین گروه ممکن نیست.`,
      ],
    };
  }

  const rows = db.all<GroupRangeRow>(
    `SELECT * FROM group_score_ranges WHERE scheme_code = ? AND version = ? ORDER BY group_number`,
    input.schemeCode,
    version,
  );
  const candidates = rows.filter((row) => date >= row.effective_from && (!row.effective_to || date <= row.effective_to));
  const warnings: string[] = [];

  if (candidates.length === 0) {
    return {
      matched: false,
      group: null,
      range: null,
      tableVersion: version,
      candidates,
      warnings: [`نسخه ${version} جدول گروه‌ها در تاریخ ${date} معتبر نیست (خارج از بازه اعتبار).`],
    };
  }

  const direct = candidates.find((row) => input.score >= row.min_score && input.score <= row.max_score);
  if (direct) {
    if (requiresExpertWarning(direct.validity_status)) {
      warnings.push(
        `وضعیت اعتبار جدول گروه انتخابی: «${VALIDITY_STATUS_LABELS[direct.validity_status]}»؛ نیازمند تطبیق کارشناسی است.`,
      );
    }
    return { matched: true, group: direct.group_number, range: direct, tableVersion: version, candidates, warnings };
  }

  const last = candidates[candidates.length - 1] as GroupRangeRow;
  if (input.score > last.max_score) {
    warnings.push(
      `امتیاز کل (${input.score}) از سقف جدول (${last.max_score}) بیشتر است؛ گروه ${last.group_number} به‌صورت پیشنهادی ثبت شد و نیازمند بازبینی کمیته است.`,
    );
    return {
      matched: false,
      group: last.group_number,
      range: last,
      tableVersion: version,
      candidates,
      warnings,
    };
  }

  warnings.push(`امتیاز کل (${input.score}) با هیچ بازه‌ای از نسخه ${version} جدول گروه‌ها تطبیق نیافت.`);
  return { matched: false, group: null, range: null, tableVersion: version, candidates, warnings };
}
