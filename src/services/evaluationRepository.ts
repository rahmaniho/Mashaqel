/** دسترسی به داده‌های نظام ارزیابی (عوامل، زیرعامل‌ها، سطوح، امتیازات، وزن‌ها) با پرس‌وجوی چندتاریخی */

import type { Db } from '../db/query.ts';
import { ERROR_CODES, MashaqelError } from '../core/status.ts';
import { isDateInRange, normalizeJalaliDate } from '../core/jalali.ts';
import type {
  EvaluationFactorRow,
  EvaluationLevelRow,
  EvaluationScoreRow,
  EvaluationSubFactorRow,
  ScoringMechanism,
} from '../core/types.ts';
import type { ValidityStatus } from '../core/status.ts';

export interface SystemRow {
  id: number;
  system_code: string;
  name: string;
  legal_basis: string;
  circular_number: string | null;
  approval_date_jalali: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  scoring_mode: 'POINT_FACTOR_FIXED' | 'CONFIGURABLE_QUANTITATIVE_OR_HYBRID';
  max_theoretical_score: number | null;
  requires_workshop_tables: number;
  validity_status: ValidityStatus;
  description: string | null;
}

export interface SubFactorWithFactor extends EvaluationSubFactorRow {
  factorCode: string;
  factorName: string;
  factorOrder: number;
  factorMaxScore: number | null;
  factorWeightPct: number | null;
  factorValidityStatus: ValidityStatus;
}

export interface LoadedSystem {
  system: SystemRow;
  factors: EvaluationFactorRow[];
  subFactors: SubFactorWithFactor[];
}

export function loadEvaluationSystem(db: Db, systemCode: string, version?: string): LoadedSystem {
  const system = version
    ? db.get<SystemRow>(
        'SELECT * FROM evaluation_systems WHERE system_code = ? AND version = ?',
        systemCode,
        version,
      )
    : db.get<SystemRow>(
        'SELECT * FROM evaluation_systems WHERE system_code = ? ORDER BY effective_from DESC, id DESC LIMIT 1',
        systemCode,
      );
  if (!system) {
    throw new MashaqelError(
      ERROR_CODES.INVALID_ARGUMENT,
      `نظام ارزیابی با کد «${systemCode}»${version ? ` و نسخه «${version}»` : ''} در دیتابیس یافت نشد.`,
    );
  }

  const factors = db.all<EvaluationFactorRow>(
    'SELECT * FROM evaluation_factors WHERE system_id = ? ORDER BY display_order',
    system.id,
  );

  const subFactors = db.all<SubFactorWithFactor>(
    `SELECT sf.*, f.factor_code AS factorCode, f.name AS factorName, f.display_order AS factorOrder,
            f.max_score AS factorMaxScore, f.official_weight_pct AS factorWeightPct,
            f.validity_status AS factorValidityStatus
     FROM evaluation_sub_factors sf
     JOIN evaluation_factors f ON f.id = sf.factor_id
     WHERE f.system_id = ?
     ORDER BY sf.display_order`,
    system.id,
  );

  return { system, factors, subFactors };
}

export interface LevelWithScore {
  level: EvaluationLevelRow;
  score: EvaluationScoreRow;
  rule: Record<string, unknown> | null;
}

/** یافتن سطح و امتیاز نسخه معتبر در تاریخ مشخص */
export function findLevelScore(
  db: Db,
  subFactorId: number,
  levelCode: string,
  secondaryDimensionCode: string,
  asOfDate: string,
): LevelWithScore | undefined {
  const level = db.get<EvaluationLevelRow>(
    `SELECT * FROM evaluation_levels
     WHERE sub_factor_id = ? AND level_code = ? AND secondary_dimension_code = ?`,
    subFactorId,
    levelCode,
    secondaryDimensionCode,
  );
  if (!level) return undefined;

  const scores = db.all<EvaluationScoreRow>(
    `SELECT * FROM evaluation_scores WHERE level_id = ? ORDER BY effective_from DESC`,
    level.id,
  );
  const date = normalizeJalaliDate(asOfDate);
  const score = scores.find((row) =>
    isDateInRange(date, row.effective_from, row.effective_to ?? null),
  );
  if (!score) return undefined;

  let rule: Record<string, unknown> | null = null;
  if (score.formula_rule_json) {
    try {
      rule = JSON.parse(score.formula_rule_json) as Record<string, unknown>;
    } catch {
      rule = null;
    }
  }
  return { level, score, rule };
}

export function listLevels(db: Db, subFactorId: number, dimensionCode?: string): EvaluationLevelRow[] {
  if (dimensionCode) {
    return db.all<EvaluationLevelRow>(
      'SELECT * FROM evaluation_levels WHERE sub_factor_id = ? AND secondary_dimension_code = ? ORDER BY level_number',
      subFactorId,
      dimensionCode,
    );
  }
  return db.all<EvaluationLevelRow>(
    'SELECT * FROM evaluation_levels WHERE sub_factor_id = ? ORDER BY level_number',
    subFactorId,
  );
}

export function getWeights(
  db: Db,
  systemId: number,
  schemeCode: string,
  version: string,
): Array<{ target_type: string; target_code: string; weight_percent: number; coefficient: number }> {
  return db.all(
    `SELECT target_type, target_code, weight_percent, coefficient FROM evaluation_weights
     WHERE system_id = ? AND scheme_code = ? AND version = ?`,
    systemId,
    schemeCode,
    version,
  );
}

export function mechanismRequiresLevels(mechanism: ScoringMechanism): boolean {
  return (
    mechanism === 'SINGLE_DEGREE' ||
    mechanism === 'MATRIX_2D' ||
    mechanism === 'DOMINANT_ACTIVITY_ROW' ||
    mechanism === 'MULTI_ITEM_SUM_CAPPED' ||
    mechanism === 'INJURY_PLUS_DISEASE_CAPPED'
  );
}
