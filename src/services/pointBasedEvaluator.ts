/**
 * موتور امتیازدهی سیستم B — نظام امتیازی چهارعاملی مصوب ۱۳۸۹/۰۵/۱۸.
 * تمام امتیازات از جدول‌های دیتابیس خوانده می‌شود؛ هیچ عددی در کد سخت‌کد نشده است.
 */

import type { Db } from '../db/query.ts';
import {
  ERROR_CODES,
  MashaqelError,
  SUB_FACTOR_TABLE_MISSING_MESSAGE,
  VALIDITY_STATUS_LABELS,
  requiresExpertWarning,
} from '../core/status.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import type {
  FactorScoreDetail,
  PointBasedSelection,
  PointEvaluationResult,
  SubFactorScoreDetail,
} from '../core/types.ts';
import { findLevelScore, listLevels, loadEvaluationSystem, type SubFactorWithFactor } from './evaluationRepository.ts';

export interface PointBasedEvaluationInput {
  systemCode: string;
  systemVersion?: string;
  scoreVersion?: string;
  evaluationDate: string;
  selections: PointBasedSelection[];
}

const MECHANISM_LEVEL_DIM_DEFAULT = 'DEFAULT';

export class PointBasedEvaluator {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  evaluate(input: PointBasedEvaluationInput): PointEvaluationResult {
    const date = normalizeJalaliDate(input.evaluationDate);
    const { system, factors, subFactors } = loadEvaluationSystem(
      this.db,
      input.systemCode,
      input.systemVersion,
    );

    const theoreticalMax =
      system.max_theoretical_score ??
      subFactors.reduce((sum: number, item: { max_score: number | null }) => sum + (item.max_score ?? 0), 0);
    if (theoreticalMax <= 0) {
      throw new MashaqelError(
        ERROR_CODES.SCORING_SYSTEM_NOT_READY,
        'سقف امتیاز نظری این نظام تعریف نشده است؛ امتیازدهی ممکن نیست.',
      );
    }

    const selectionMap = new Map<string, PointBasedSelection>();
    for (const selection of input.selections) {
      if (selectionMap.has(selection.subFactorCode)) {
        throw new MashaqelError(
          ERROR_CODES.INVALID_ARGUMENT,
          `برای زیرعامل «${selection.subFactorCode}» بیش از یک انتخاب ارسال شده است.`,
        );
      }
      selectionMap.set(selection.subFactorCode, selection);
    }

    const knownCodes = new Set(subFactors.map((sf) => sf.sub_factor_code));
    for (const code of selectionMap.keys()) {
      if (!knownCodes.has(code)) {
        throw new MashaqelError(ERROR_CODES.UNKNOWN_SUB_FACTOR, `زیرعامل «${code}» در این نظام وجود ندارد.`);
      }
    }

    const warnings: string[] = [];
    const unscored: string[] = [];
    const subFactorDetails: SubFactorScoreDetail[] = [];

    for (const sub of subFactors) {
      const detail = this.scoreSubFactor(sub, selectionMap.get(sub.sub_factor_code), date, input.scoreVersion);
      subFactorDetails.push(detail);
      warnings.push(...detail.warnings);
      if (detail.scoringMechanism === 'DISABLED_PENDING_OFFICIAL_TABLE') {
        unscored.push(sub.sub_factor_code);
      }
      if (detail.maxScore !== null && detail.points > detail.maxScore) {
        throw new MashaqelError(
          ERROR_CODES.SCORE_EXCEEDS_SUB_FACTOR_MAX,
          `امتیاز زیرعامل ${sub.name} (${detail.points}) از سقف رسمی آن (${detail.maxScore}) بیشتر است.`,
        );
      }
    }

    const factorScores: FactorScoreDetail[] = factors.map((factor) => {
      const related = subFactorDetails.filter((detail) => detail.factorCode === factor.factor_code);
      const points = related.reduce((sum, item) => sum + item.points, 0);
      return {
        factorCode: factor.factor_code,
        factorName: factor.name,
        points,
        maxScore: factor.max_score,
        officialWeightPct: factor.official_weight_pct,
        achievedWeightPct: factor.official_weight_pct,
      };
    });

    for (const factor of factorScores) {
      if (factor.maxScore !== null && factor.points > factor.maxScore) {
        throw new MashaqelError(
          ERROR_CODES.SCORE_EXCEEDS_SUB_FACTOR_MAX,
          `امتیاز عامل ${factor.factorName} (${factor.points}) از سقف رسمی آن (${factor.maxScore}) بیشتر است.`,
        );
      }
    }

    const totalScore = factorScores.reduce((sum, item) => sum + item.points, 0);

    if (unscored.length > 0) {
      warnings.push(
        `امتیاز زیرعامل‌های ${unscored.join('، ')} به دلیل فقدان جدول رسمی سطوح، در امتیاز کل لحاظ نشده است و امتیاز کل «ناقص» است.`,
      );
    }

    return {
      systemCode: system.system_code,
      systemVersion: system.version,
      evaluationDate: date,
      currencyUnit: 'IRR',
      totalScore,
      maxTheoreticalScore: theoreticalMax,
      factorScores,
      subFactorScores: subFactorDetails,
      warnings,
      scoringComplete: unscored.length === 0,
      unscoredSubFactors: unscored,
    };
  }

  private scoreSubFactor(
    sub: SubFactorWithFactor,
    selection: PointBasedSelection | undefined,
    date: string,
    scoreVersion: string | undefined,
  ): SubFactorScoreDetail {
    const base: SubFactorScoreDetail = {
      subFactorCode: sub.sub_factor_code,
      subFactorName: sub.name,
      factorCode: sub.factorCode,
      factorName: sub.factorName,
      points: 0,
      maxScore: sub.max_score,
      officialWeightPct: sub.official_weight_pct,
      selectionKind: selection?.kind ?? 'MISSING',
      selectionDescription: '—',
      scoringMechanism: sub.scoring_mechanism,
      subFactorValidityStatus: sub.validity_status,
      pointsValidityStatus: sub.validity_status,
      warnings: [],
    };

    if (sub.scoring_enabled === 0 || sub.scoring_mechanism === 'DISABLED_PENDING_OFFICIAL_TABLE') {
      base.warnings.push(
        `${SUB_FACTOR_TABLE_MISSING_MESSAGE} (زیرعامل: ${sub.name} — وضعیت: ${VALIDITY_STATUS_LABELS[sub.validity_status]})`,
      );
      return base;
    }

    if (!selection) {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `برای زیرعامل «${sub.name}» (${sub.sub_factor_code}) هیچ انتخاب امتیازدهی ارسال نشده است؛ محاسبه امتیاز کل بدون آن ممکن نیست.`,
      );
    }

    const levels = listLevels(this.db, sub.id);
    if (levels.length === 0) {
      base.warnings.push(`${SUB_FACTOR_TABLE_MISSING_MESSAGE} (زیرعامل: ${sub.name})`);
      return base;
    }

    switch (sub.scoring_mechanism) {
      case 'SINGLE_DEGREE':
      case 'MATRIX_2D':
      case 'WORKSHOP_SCHEME_DEFINED':
        return this.scoreByLevel(base, sub, selection, date, scoreVersion);
      case 'DOMINANT_ACTIVITY_ROW':
        return this.scoreDominantRow(base, sub, selection, date, scoreVersion);
      case 'SUPERVISION_COMPOSITE':
        return this.scoreSupervision(base, sub, selection, date);
      case 'MULTI_ITEM_SUM_CAPPED':
        return this.scoreEnvironment(base, sub, selection, date, scoreVersion);
      case 'INJURY_PLUS_DISEASE_CAPPED':
        return this.scoreHazards(base, sub, selection, date, scoreVersion);
      default:
        throw new MashaqelError(
          ERROR_CODES.SCORING_DISABLED,
          `سازوکار امتیازدهی «${sub.scoring_mechanism}» برای زیرعامل ${sub.name} پشتیبانی نمی‌شود.`,
        );
    }
  }

  private scoreByLevel(
    base: SubFactorScoreDetail,
    sub: SubFactorWithFactor,
    selection: PointBasedSelection,
    date: string,
    scoreVersion?: string,
  ): SubFactorScoreDetail {
    if (selection.kind !== 'LEVEL' && selection.kind !== 'MATRIX') {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `زیرعامل ${sub.name} نیازمند انتخاب سطح (LEVEL/MATRIX) است.`,
      );
    }
    const dimension =
      selection.kind === 'MATRIX'
        ? selection.secondaryDimensionCode
        : (selection.secondaryDimensionCode ?? MECHANISM_LEVEL_DIM_DEFAULT);
    const found = findLevelScore(this.db, sub.id, selection.levelCode, dimension, date);
    if (!found) {
      throw new MashaqelError(
        ERROR_CODES.UNKNOWN_LEVEL,
        `سطح «${selection.levelCode}» با بُعد «${dimension}» برای زیرعامل ${sub.name} در تاریخ ${date} یافت نشد.`,
      );
    }
    if (scoreVersion && found.score.version !== scoreVersion) {
      base.warnings.push(
        `نسخه امتیاز سطح انتخابی (${found.score.version}) با نسخه درخواستی (${scoreVersion}) متفاوت است.`,
      );
    }
    base.points = found.score.points;
    base.selectionKind = selection.kind;
    base.selectionDescription = `${found.level.title}${found.level.secondary_dimension_title ? ` — ${found.level.secondary_dimension_title}` : ''}`;
    base.pointsValidityStatus = found.score.validity_status;
    if (requiresExpertWarning(found.score.validity_status)) {
      base.warnings.push(
        `امتیاز سطح انتخابی ${sub.name} با وضعیت «${VALIDITY_STATUS_LABELS[found.score.validity_status]}» ثبت شده است.`,
      );
    }
    return base;
  }

  private scoreDominantRow(
    base: SubFactorScoreDetail,
    sub: SubFactorWithFactor,
    selection: PointBasedSelection,
    date: string,
    scoreVersion?: string,
  ): SubFactorScoreDetail {
    if (selection.kind !== 'DOMINANT_ROW') {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `زیرعامل ${sub.name} نیازمند انتخاب ردیف غالب فعالیت (DOMINANT_ROW) است.`,
      );
    }
    const found = findLevelScore(this.db, sub.id, selection.levelCode, selection.hoursBracketCode, date);
    if (!found) {
      throw new MashaqelError(
        ERROR_CODES.UNKNOWN_LEVEL,
        `ردیف فعالیت «${selection.levelCode}» با بازه ساعتی «${selection.hoursBracketCode}» برای ${sub.name} در تاریخ ${date} یافت نشد.`,
      );
    }
    base.points = found.score.points;
    base.selectionKind = selection.kind;
    base.selectionDescription = `${found.level.title} — ${found.level.secondary_dimension_title ?? ''}`;
    base.pointsValidityStatus = found.score.validity_status;
    base.details = { dominantRowOnly: true, scoreVersion: scoreVersion ?? found.score.version };
    if (requiresExpertWarning(found.score.validity_status)) {
      base.warnings.push(
        `امتیاز ردیف غالب ${sub.name} با وضعیت «${VALIDITY_STATUS_LABELS[found.score.validity_status]}» ثبت شده است و نیازمند تطبیق است.`,
      );
    }
    return base;
  }

  private scoreSupervision(
    base: SubFactorScoreDetail,
    sub: SubFactorWithFactor,
    selection: PointBasedSelection,
    date: string,
  ): SubFactorScoreDetail {
    if (selection.kind !== 'SUPERVISION') {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `زیرعامل ${sub.name} نیازمند انتخاب سرپرستی (SUPERVISION) با تعداد نفرات مستقیم و غیرمستقیم است.`,
      );
    }
    const directLevels = listLevels(this.db, sub.id, 'DIRECT');
    const indirectLevels = listLevels(this.db, sub.id, 'INDIRECT');
    const directCap = 40;
    const indirectCap = 30;

    let directPoints = 0;
    const directDetail: Array<{ grade: string; headcount: number; points: number }> = [];
    for (const level of directLevels) {
      const headcount = selection.directHeadcountByGrade[level.level_code] ?? 0;
      if (headcount <= 0) continue;
      const found = findLevelScore(this.db, sub.id, level.level_code, 'DIRECT', date);
      const rule = found?.rule ?? {};
      const perPerson = Number(rule.pointsPerPerson ?? found?.score.points ?? 0);
      const maxPoints = Number(rule.maxPoints ?? Number.POSITIVE_INFINITY);
      const points = Math.min(headcount * perPerson, maxPoints);
      directPoints += points;
      directDetail.push({ grade: level.level_code, headcount, points });
    }
    directPoints = Math.min(directPoints, directCap);

    let indirectPoints = 0;
    const indirectDetail: Array<{ tier: string; headcount: number; points: number }> = [];
    for (const level of indirectLevels) {
      const found = findLevelScore(this.db, sub.id, level.level_code, 'INDIRECT', date);
      const rule = found?.rule ?? {};
      const from = Number(rule.headcountFrom ?? 1);
      const to = Number(rule.headcountTo ?? 0);
      const personsPerPoint = Number(rule.personsPerPoint ?? 1);
      const maxPoints = Number(rule.maxPoints ?? 5);
      const inTier = Math.max(0, Math.min(selection.indirectHeadcount, to) - (from - 1));
      if (inTier <= 0) continue;
      const points = Math.min(Math.floor(inTier / personsPerPoint), maxPoints);
      if (points > 0) {
        indirectPoints += points;
        indirectDetail.push({ tier: level.level_code, headcount: inTier, points });
      }
    }
    indirectPoints = Math.min(indirectPoints, indirectCap);

    const total = Math.min(directPoints + indirectPoints, sub.max_score ?? 70);
    base.points = total;
    base.selectionKind = selection.kind;
    base.selectionDescription = `سرپرستی مستقیم ${directPoints} امتیاز + غیرمستقیم ${indirectPoints} امتیاز`;
    base.details = { directPoints, indirectPoints, directDetail, indirectDetail, directCap, indirectCap };
    return base;
  }

  private scoreEnvironment(
    base: SubFactorScoreDetail,
    sub: SubFactorWithFactor,
    selection: PointBasedSelection,
    date: string,
    _scoreVersion?: string,
  ): SubFactorScoreDetail {
    if (selection.kind !== 'ENV_ITEMS') {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `زیرعامل ${sub.name} نیازمند فهرست اجزای محیطی (ENV_ITEMS) است.`,
      );
    }
    if (selection.items.length > 12) {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `تعداد اجزای محیطی انتخاب‌شده (${selection.items.length}) از سقف رسمی ۱۲ جزء بیشتر است.`,
      );
    }
    const seen = new Set<string>();
    let sum = 0;
    const itemDetail: Array<{ itemCode: string; points: number; status: string }> = [];
    for (const item of selection.items) {
      if (seen.has(item.itemCode)) {
        throw new MashaqelError(
          ERROR_CODES.INVALID_ARGUMENT,
          `جزء محیطی «${item.itemCode}» تکراری است و امتیاز آن دو بار محاسبه نمی‌شود.`,
        );
      }
      seen.add(item.itemCode);
      const dimension = `${item.intensityCode}_${item.hoursBracketCode}`;
      const found = findLevelScore(this.db, sub.id, item.itemCode, dimension, date);
      if (!found) {
        throw new MashaqelError(
          ERROR_CODES.UNKNOWN_LEVEL,
          `جزء محیطی «${item.itemCode}» با شدت/ساعت «${dimension}» یافت نشد.`,
        );
      }
      sum += found.score.points;
      itemDetail.push({ itemCode: item.itemCode, points: found.score.points, status: found.score.validity_status });
      if (requiresExpertWarning(found.score.validity_status)) {
        base.warnings.push(
          `جزء محیطی ${found.level.title} با وضعیت «${VALIDITY_STATUS_LABELS[found.score.validity_status]}» ثبت شده است.`,
        );
      }
    }
    const capped = Math.min(sum, sub.max_score ?? 120);
    if (sum > capped) {
      base.warnings.push(`مجموع امتیاز اجزای محیطی (${sum}) از سقف رسمی ${capped} امتیاز عبور کرد و به سقف محدود شد.`);
    }
    base.points = capped;
    base.selectionKind = selection.kind;
    base.selectionDescription = `مجموع ${selection.items.length} جزء محیطی`;
    base.details = { rawSum: sum, capped, items: itemDetail };
    return base;
  }

  private scoreHazards(
    base: SubFactorScoreDetail,
    sub: SubFactorWithFactor,
    selection: PointBasedSelection,
    date: string,
    _scoreVersion?: string,
  ): SubFactorScoreDetail {
    if (selection.kind !== 'HAZARD') {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `زیرعامل ${sub.name} نیازمند انتخاب خطرات (HAZARD) است.`,
      );
    }
    let injuryPoints = 0;
    if (selection.injuryLevelCode) {
      const found = findLevelScore(
        this.db,
        sub.id,
        selection.injuryLevelCode,
        `P_${selection.injuryProbabilityCode ?? 'LOW'}`,
        date,
      );
      if (!found) {
        throw new MashaqelError(
          ERROR_CODES.UNKNOWN_LEVEL,
          `سطح خطر «${selection.injuryLevelCode}» با احتمال «${selection.injuryProbabilityCode ?? 'LOW'}» یافت نشد.`,
        );
      }
      injuryPoints = found.score.points;
    }
    let diseasePoints = 0;
    if (selection.diseaseProbabilityCode) {
      const found = findLevelScore(this.db, sub.id, 'HZ_DISEASE', `P_${selection.diseaseProbabilityCode}`, date);
      if (!found) {
        throw new MashaqelError(
          ERROR_CODES.UNKNOWN_LEVEL,
          `سطح امراض ناشی از کار با احتمال «${selection.diseaseProbabilityCode}» یافت نشد.`,
        );
      }
      diseasePoints = found.score.points;
    }
    const rawSum = injuryPoints + diseasePoints;
    const capped = Math.min(rawSum, sub.max_score ?? 80);
    if (rawSum > capped) {
      base.warnings.push(`مجموع امتیاز صدمات و امراض (${rawSum}) به سقف رسمی ${capped} امتیاز محدود شد.`);
    }
    base.points = capped;
    base.selectionKind = selection.kind;
    base.selectionDescription = `صدمات ${injuryPoints} + امراض ${diseasePoints}`;
    base.details = { injuryPoints, diseasePoints, rawSum, capped };
    if (injuryPoints > 40 || diseasePoints > 40) {
      base.warnings.push('امتیاز صدمات یا امراض از سقف ۴۰ امتیازی هر یک عبور کرده است؛ نیازمند بازبینی کارشناسی.');
    }
    return base;
  }
}
