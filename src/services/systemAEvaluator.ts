/**
 * موتور ارزیابی سیستم A — نظام ارزیابی مشاغل مصوب ۱۳۹۵.
 * چارچوب شش‌عاملی کشوری است و امتیازدهی تنها زمانی فعال می‌شود که
 * جزئیات کمّی طرح مصوب همان کارگاه (زیرعامل، سطح، امتیاز، وزن) بارگذاری شده باشد.
 */

import type { Db } from '../db/query.ts';
import {
  ERROR_CODES,
  MashaqelError,
  VALIDITY_STATUS_LABELS,
  WORKSHOP_SCHEME_REQUIRED_MESSAGE,
} from '../core/status.ts';
import type { PointEvaluationResult, SystemASelection } from '../core/types.ts';
import { loadEvaluationSystem, getWeights } from './evaluationRepository.ts';
import { PointBasedEvaluator } from './pointBasedEvaluator.ts';

export interface SystemAEvaluationInput {
  systemCode: string;
  systemVersion?: string;
  schemeCode: string;
  evaluationDate: string;
  selections: SystemASelection[];
}

export class SystemAEvaluator {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** آیا جزئیات کمّی طرح مصوب کارگاه برای این نظام بارگذاری شده است؟ */
  isSchemeLoaded(systemCode: string, version?: string): boolean {
    const { subFactors } = loadEvaluationSystem(this.db, systemCode, version);
    return subFactors.length > 0;
  }

  evaluate(input: SystemAEvaluationInput): PointEvaluationResult {
    const loaded = loadEvaluationSystem(this.db, input.systemCode, input.systemVersion);
    if (loaded.subFactors.length === 0) {
      throw new MashaqelError(ERROR_CODES.SCORING_SYSTEM_NOT_READY, WORKSHOP_SCHEME_REQUIRED_MESSAGE, {
        systemCode: input.systemCode,
        schemeCode: input.schemeCode,
        requiredAction: 'بارگذاری زیرعامل‌ها، سطوح، امتیازات، وزن‌ها و جدول گروه‌های طرح مصوب کارگاه',
      });
    }

    const evaluator = new PointBasedEvaluator(this.db);
    const result = evaluator.evaluate({
      systemCode: input.systemCode,
      systemVersion: loaded.system.version,
      evaluationDate: input.evaluationDate,
      selections: input.selections.map((selection) => ({
        subFactorCode: selection.subFactorCode,
        kind: 'LEVEL' as const,
        levelCode: selection.levelCode,
        ...(selection.secondaryDimensionCode
          ? { secondaryDimensionCode: selection.secondaryDimensionCode }
          : {}),
      })),
    });

    const weights = getWeights(this.db, loaded.system.id, input.schemeCode, loaded.system.version);
    const coefficientByCode = new Map(weights.map((w) => [w.target_code, w.coefficient]));

    let weightedTotal = 0;
    const adjustedSubScores = result.subFactorScores.map((sub) => {
      const coefficient = coefficientByCode.get(sub.subFactorCode) ?? 1;
      const points = coefficient === 1 ? sub.points : sub.points * coefficient;
      weightedTotal += points;
      if (coefficient !== 1) {
        sub.warnings.push(`ضریب وزنی ${coefficient} طرح مصوب کارگاه روی امتیاز این زیرعامل اعمال شد.`);
      }
      return { ...sub, points };
    });

    const warnings = [...result.warnings];
    if (weights.length === 0) {
      warnings.push(
        'جدول وزن‌های طرح مصوب کارگاه بارگذاری نشده است؛ امتیاز کل به‌صورت جمع ساده سطوح محاسبه شد و نیازمند تأیید کمیته است.',
      );
    }
    warnings.push(
      `این امتیازدهی بر مبنای اقلام «${VALIDITY_STATUS_LABELS['4_REQUIRES_WORKSHOP_APPROVED_SCHEME']}» طرح همین کارگاه است و بدون تأیید اداره کل روابط کار قطعی نمی‌شود.`,
    );

    return {
      ...result,
      totalScore: weightedTotal,
      subFactorScores: adjustedSubScores,
      warnings,
    };
  }
}
