/**
 * بارگذاری «طرح مصوب کارگاه» برای نظام ارزیابی ۱۳۹۵ (سیستم A).
 * طبق ماده ۳ و ۱۰ مصوبه ۴۹۲۴۰، زیرعامل‌ها، سطوح، امتیازات، وزن‌ها و جدول گروه‌بندی
 * باید در طرح اختصاصی هر کارگاه و با تأیید اداره کل روابط کار تعیین شود.
 * این سرویس فقط ظرف ورود داده است و داده‌ای را به‌عنوان مقدار کشوری ثبت نمی‌کند.
 */

import type { Db } from '../db/query.ts';
import { ERROR_CODES, MashaqelError, VALIDITY_STATUS } from '../core/status.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import { recordHistory } from './historyService.ts';

export interface WorkshopSubFactorDefinition {
  factorCode: string;
  subFactorCode: string;
  name: string;
  maxScore: number;
  definition: string;
  weightPercent?: number;
  levels: Array<{
    levelCode: string;
    title: string;
    points: number;
    secondaryDimensionCode?: string;
    secondaryDimensionTitle?: string;
  }>;
}

export interface WorkshopGroupRange {
  group: number;
  min: number;
  max: number;
  ceiling: number;
  excess: number;
  delta: number;
}

export interface WorkshopSchemeInput {
  systemCode: string;
  systemVersion?: string;
  schemeCode: string;
  schemeVersion: string;
  effectiveFrom: string;
  /** شماره مصوبه/تأییدیه اداره کل روابط کار — الزامی */
  ministryApprovalReference: string;
  subFactors: WorkshopSubFactorDefinition[];
  groupRanges: WorkshopGroupRange[];
  loadedBy: string;
}

export function loadWorkshopApprovedScheme(db: Db, input: WorkshopSchemeInput): { insertedSubFactors: number; insertedLevels: number } {
  if (!input.ministryApprovalReference || input.ministryApprovalReference.trim() === '') {
    throw new MashaqelError(
      ERROR_CODES.APPROVAL_REQUIRED,
      'بارگذاری طرح کارگاه بدون شماره تأییدیه اداره کل روابط کار مجاز نیست.',
    );
  }
  if (input.subFactors.length === 0 || input.groupRanges.length === 0) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'طرح کارگاه باید حداقل یک زیرعامل و یک بازه گروه داشته باشد.');
  }
  const effectiveFrom = normalizeJalaliDate(input.effectiveFrom);
  const system = db.get<{ id: number; version: string }>(
    input.systemVersion
      ? 'SELECT id, version FROM evaluation_systems WHERE system_code = ? AND version = ?'
      : 'SELECT id, version FROM evaluation_systems WHERE system_code = ? ORDER BY effective_from DESC, id DESC LIMIT 1',
    ...(input.systemVersion ? [input.systemCode, input.systemVersion] : [input.systemCode]),
  );
  if (!system) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `نظام ارزیابی «${input.systemCode}» یافت نشد.`);
  }

  let insertedSubFactors = 0;
  let insertedLevels = 0;

  db.transaction(() => {
    for (const sub of input.subFactors) {
      const factor = db.get<{ id: number }>(
        'SELECT id FROM evaluation_factors WHERE system_id = ? AND factor_code = ?',
        system.id,
        sub.factorCode,
      );
      if (!factor) {
        throw new MashaqelError(
          ERROR_CODES.INVALID_ARGUMENT,
          `عامل «${sub.factorCode}» در نظام ${input.systemCode} تعریف نشده است.`,
        );
      }
      const subResult = db.run(
        `INSERT INTO evaluation_sub_factors (
           factor_id, sub_factor_code, name, display_order, max_score, official_weight_pct,
           scoring_mechanism, scoring_enabled, definition, application_rule, validity_status
         ) VALUES (?, ?, ?, ?, ?, ?, 'WORKSHOP_SCHEME_DEFINED', 1, ?, ?, ?)
         ON CONFLICT(factor_id, sub_factor_code) DO UPDATE SET
           max_score = excluded.max_score,
           official_weight_pct = excluded.official_weight_pct,
           definition = excluded.definition,
           application_rule = excluded.application_rule,
           validity_status = excluded.validity_status`,
        factor.id,
        sub.subFactorCode,
        sub.name,
        db.all<{ n: number }>('SELECT COUNT(*) AS n FROM evaluation_sub_factors WHERE factor_id = ?', factor.id)[0]?.n ?? 1,
        sub.maxScore,
        sub.weightPercent ?? null,
        sub.definition,
        `طرح مصوب کارگاه — تأییدیه: ${input.ministryApprovalReference}`,
        VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
      );
      if (subResult.changes > 0) insertedSubFactors += 1;
      const subRow = db.get<{ id: number }>(
        'SELECT id FROM evaluation_sub_factors WHERE factor_id = ? AND sub_factor_code = ?',
        factor.id,
        sub.subFactorCode,
      );
      if (!subRow) throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'ثبت زیرعامل طرح کارگاه ناموفق بود.');

      if (sub.weightPercent !== undefined) {
        db.run(
          `INSERT INTO evaluation_weights (
             system_id, scheme_code, target_type, target_code, weight_percent, coefficient, version,
             effective_from, effective_to, is_official_national, validity_status
           ) VALUES (?, ?, 'SUB_FACTOR', ?, ?, 1.0, ?, ?, NULL, 0, ?)
           ON CONFLICT(system_id, scheme_code, target_type, target_code, version) DO UPDATE SET
             weight_percent = excluded.weight_percent`,
          system.id,
          input.schemeCode,
          sub.subFactorCode,
          sub.weightPercent,
          input.schemeVersion,
          effectiveFrom,
          VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
        );
      }

      let levelNumber = 0;
      for (const level of sub.levels) {
        levelNumber += 1;
        db.run(
          `INSERT INTO evaluation_levels (
             sub_factor_id, level_code, level_number, title, secondary_dimension_code,
             secondary_dimension_title, criteria_description, tvto_hours_equivalent, validity_status
           ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)
           ON CONFLICT(sub_factor_id, level_code, secondary_dimension_code) DO NOTHING`,
          subRow.id,
          level.levelCode,
          levelNumber,
          level.title,
          level.secondaryDimensionCode ?? 'DEFAULT',
          level.secondaryDimensionTitle ?? null,
          VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
        );
        const levelRow = db.get<{ id: number }>(
          `SELECT id FROM evaluation_levels WHERE sub_factor_id = ? AND level_code = ? AND secondary_dimension_code = ?`,
          subRow.id,
          level.levelCode,
          level.secondaryDimensionCode ?? 'DEFAULT',
        );
        if (!levelRow) continue;
        const scoreResult = db.run(
          `INSERT INTO evaluation_scores (
             level_id, version, effective_from, effective_to, points, formula_rule_json, validity_status
           ) VALUES (?, ?, ?, NULL, ?, NULL, ?)
           ON CONFLICT(level_id, version) DO UPDATE SET points = excluded.points`,
          levelRow.id,
          input.schemeVersion,
          effectiveFrom,
          level.points,
          VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
        );
        if (scoreResult.changes > 0) insertedLevels += 1;
      }
    }

    for (const range of input.groupRanges) {
      db.run(
        `INSERT INTO group_score_ranges (
           system_id, scheme_code, version, effective_from, effective_to, group_number,
           min_score, max_score, ceiling_score_xn, excess_over_g1_bn, consecutive_diff_delta,
           validity_status
         ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(scheme_code, version, group_number) DO UPDATE SET
           min_score = excluded.min_score,
           max_score = excluded.max_score,
           ceiling_score_xn = excluded.ceiling_score_xn,
           excess_over_g1_bn = excluded.excess_over_g1_bn,
           consecutive_diff_delta = excluded.consecutive_diff_delta`,
        system.id,
        input.schemeCode,
        input.schemeVersion,
        effectiveFrom,
        range.group,
        range.min,
        range.max,
        range.ceiling,
        range.excess,
        range.delta,
        VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
      );
    }
  });

  recordHistory(db, {
    operationType: 'WORKSHOP_SCHEME_LOAD',
    entityType: 'evaluation_scheme',
    entityId: null,
    formulaCode: 'FRM-EVAL-A-TOTAL',
    formulaVersion: input.schemeVersion,
    input: { ...input, subFactors: input.subFactors.length, groupRanges: input.groupRanges.length },
    appliedTables: { schemeCode: input.schemeCode, effectiveFrom },
    output: { insertedSubFactors, insertedLevels },
    actor: input.loadedBy,
  });

  return { insertedSubFactors, insertedLevels };
}
