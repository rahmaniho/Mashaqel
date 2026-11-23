/**
 * خدمات شناسنامه شغل، ارزیابی شغل و تعیین گروه پیشنهادی با الزام تأیید کارشناسی.
 * قاعده الزامی: گروه شغلی هرگز بدون بازبینی کارشناس و تأیید کمیته/مرجع مسئول «قطعی» نمی‌شود.
 */

import type { Db } from '../db/query.ts';
import { ERROR_CODES, MashaqelError, VALIDITY_STATUS } from '../core/status.ts';
import { normalizeJalaliDate } from '../core/jalali.ts';
import type {
  ApprovalStatus,
  JobEvaluationOutcome,
  JobEvaluationRequest,
  JobProfileInput,
  PointBasedSelection,
  SystemASelection,
} from '../core/types.ts';
import { educationGroupBounds, supervisionHierarchyCheck, type RequiredEducationColumn } from '../core/legalRules.ts';
import { PointBasedEvaluator } from './pointBasedEvaluator.ts';
import { SystemAEvaluator } from './systemAEvaluator.ts';
import { matchGroup } from './groupMatcher.ts';
import { recordHistory } from './historyService.ts';
import { SYSTEM_A_CODE } from '../db/seed/evaluationSystemA.ts';

export interface JobProfileRow {
  id: number;
  workshop_code: string;
  job_code: string;
  job_title: string;
  organizational_unit: string;
  job_objective: string;
  duties_description: string;
  responsibilities: string;
  authorities: string;
  qualification_requirements: string;
  required_education: string;
  required_experience_years: number;
  required_skills: string;
  working_conditions: string;
  parent_supervisor_job_code: string | null;
  version: string;
}

export interface JobEvaluationRow {
  id: number;
  job_profile_id: number;
  system_id: number;
  scheme_code: string;
  group_table_version: string;
  factor_scores_json: string;
  sub_factor_scores_json: string;
  total_score: number;
  matched_range_id: number | null;
  proposed_group: number | null;
  final_confirmed_group: number | null;
  determination_reasons_json: string;
  expert_warnings_json: string;
  approval_status: ApprovalStatus;
  reviewed_by_expert: string | null;
  committee_reference_no: string | null;
  approved_at: string | null;
}

const REQUIRED_PROFILE_FIELDS: Array<keyof JobProfileInput> = [
  'workshopCode',
  'jobCode',
  'jobTitle',
  'organizationalUnit',
  'jobObjective',
  'duties',
  'responsibilities',
  'authorities',
  'qualificationRequirements',
  'requiredEducation',
  'requiredSkills',
  'workingConditions',
];

export class JobProfileService {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  createProfile(input: JobProfileInput): number {
    for (const field of REQUIRED_PROFILE_FIELDS) {
      const value = input[field];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new MashaqelError(
          ERROR_CODES.INVALID_ARGUMENT,
          `فیلد الزامی شناسنامه شغل «${String(field)}» خالی است.`,
        );
      }
    }
    if (input.requiredExperienceYears < 0) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'سابقه مورد نیاز نمی‌تواند منفی باشد.');
    }
    const version = input.version ?? '1.0';
    const result = this.db.run(
      `INSERT INTO job_profiles (
         workshop_code, job_code, job_title, organizational_unit, job_objective,
         duties_description, responsibilities, authorities, qualification_requirements,
         required_education, required_experience_years, required_skills, working_conditions,
         parent_supervisor_job_code, version
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workshop_code, job_code, version) DO UPDATE SET
         job_title = excluded.job_title,
         duties_description = excluded.duties_description,
         updated_at = datetime('now')`,
      input.workshopCode,
      input.jobCode,
      input.jobTitle,
      input.organizationalUnit,
      input.jobObjective,
      input.duties,
      input.responsibilities,
      input.authorities,
      input.qualificationRequirements,
      input.requiredEducation,
      input.requiredExperienceYears,
      input.requiredSkills,
      input.workingConditions,
      input.parentSupervisorJobCode ?? null,
      version,
    );
    if (result.lastInsertRowid > 0) return result.lastInsertRowid;
    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM job_profiles WHERE workshop_code = ? AND job_code = ? AND version = ?',
      input.workshopCode,
      input.jobCode,
      version,
    );
    if (!existing) throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, 'ثبت شناسنامه شغل ناموفق بود.');
    return existing.id;
  }

  getProfile(id: number): JobProfileRow {
    const row = this.db.get<JobProfileRow>('SELECT * FROM job_profiles WHERE id = ?', id);
    if (!row) throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `شناسنامه شغل با شناسه ${id} یافت نشد.`);
    return row;
  }

  /** ارزیابی شغل و تعیین گروه پیشنهادی (بدون قطعی‌سازی) */
  evaluateJob(request: JobEvaluationRequest): JobEvaluationOutcome {
    const profile = this.getProfile(request.jobProfileId);
    const evaluationDate = normalizeJalaliDate(request.evaluationDate);

    const system = this.db.get<{ id: number; system_code: string; version: string }>(
      'SELECT id, system_code, version FROM evaluation_systems WHERE system_code = ? ORDER BY effective_from DESC, id DESC LIMIT 1',
      request.systemCode,
    );
    if (!system) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `نظام ارزیابی «${request.systemCode}» یافت نشد.`);
    }

    const isSystemA = system.system_code === SYSTEM_A_CODE;
    const expertWarnings: string[] = [];
    let evaluation;
    let subFactorScores;

    if (isSystemA) {
      const evaluator = new SystemAEvaluator(this.db);
      const result = evaluator.evaluate({
        systemCode: system.system_code,
        systemVersion: system.version,
        schemeCode: request.schemeCode,
        evaluationDate,
        selections: (request.systemASelections ?? []) as SystemASelection[],
      });
      evaluation = result;
      subFactorScores = result.subFactorScores;
    } else {
      const evaluator = new PointBasedEvaluator(this.db);
      const result = evaluator.evaluate({
        systemCode: system.system_code,
        systemVersion: system.version,
        evaluationDate,
        selections: (request.pointBasedSelections ?? []) as PointBasedSelection[],
      });
      evaluation = result;
      subFactorScores = result.subFactorScores;
    }

    expertWarnings.push(...evaluation.warnings);

    if (!evaluation.scoringComplete) {
      expertWarnings.push(
        'امتیاز کل شغل ناقص است (برخی زیرعامل‌ها به دلیل فقدان جدول رسمی امتیازدهی نشده‌اند)؛ گروه پیشنهادی الزاماً بازبینی شود.',
      );
    }

    const tableMatch = matchGroup(this.db, {
      schemeCode: request.schemeCode,
      score: evaluation.totalScore,
      asOfDate: evaluationDate,
      ...(request.groupTableVersion ? { tableVersion: request.groupTableVersion } : {}),
      systemCode: system.system_code,
    });
    expertWarnings.push(...tableMatch.warnings);

    const rationale: string[] = [
      `امتیاز کل شغل «${profile.job_title}» برابر ${evaluation.totalScore} از سقف نظری ${evaluation.maxTheoreticalScore} امتیاز نظام است.`,
    ];
    if (tableMatch.matched && tableMatch.range) {
      rationale.push(
        `امتیاز کل در بازه ${tableMatch.range.min_score} تا ${tableMatch.range.max_score} امتیاز نسخه ${tableMatch.tableVersion} جدول گروه‌ها قرار دارد و گروه پیشنهادی ${tableMatch.group} است.`,
      );
    } else if (tableMatch.group !== null) {
      rationale.push(
        `امتیاز کل با بازه مصوب تطبیق کامل نیافت؛ گروه ${tableMatch.group} صرفاً به‌صورت پیشنهادی و نیازمند بازبینی ثبت شد.`,
      );
    } else {
      rationale.push('هیچ گروهی برای این امتیاز قابل پیشنهاد نبود؛ ورودی‌های امتیازدهی یا نسخه جدول گروه‌ها بررسی شود.');
    }

    const boundsKey = normalizeEducationKey(profile.required_education);
    const bounds = boundsKey ? educationGroupBounds(boundsKey) : undefined;
    if (bounds && tableMatch.group !== null) {
      if (tableMatch.group < bounds.min || tableMatch.group > bounds.max) {
        expertWarnings.push(
          `گروه پیشنهادی ${tableMatch.group} با دامنه مجاز گروه بر حسب مدرک تحصیلی شرط احراز «${profile.required_education}» ` +
            `(${bounds.min} تا ${bounds.max}) سازگار نیست؛ نیازمند بازبینی کارشناسی است.`,
        );
      }
    }
    if (boundsKey) {
      expertWarnings.push(
        `دامنه مجاز گروه بر حسب مدرک تحصیلی با وضعیت «${VALIDITY_STATUS.EXTRACTED_NEEDS_VERIFICATION === '2_EXTRACTED_NEEDS_VERIFICATION' ? '۲. استخراج‌شده ولی نیازمند تطبیق' : ''}» اعمال شده است.`,
      );
    }

    const supScore = subFactorScores.find((item) => item.subFactorCode === 'SUP');
    if (supScore && profile.parent_supervisor_job_code) {
      const parent = this.db.get<{ id: number }>(
        'SELECT id FROM job_profiles WHERE workshop_code = ? AND job_code = ? ORDER BY id DESC LIMIT 1',
        profile.workshop_code,
        profile.parent_supervisor_job_code,
      );
      if (parent) {
        const lastParentEval = this.db.get<{ sub_factor_scores_json: string }>(
          'SELECT sub_factor_scores_json FROM job_evaluations WHERE job_profile_id = ? ORDER BY id DESC LIMIT 1',
          parent.id,
        );
        if (lastParentEval) {
          const parentScores = JSON.parse(lastParentEval.sub_factor_scores_json) as Array<{
            subFactorCode: string;
            points: number;
          }>;
          const parentSup = parentScores.find((item) => item.subFactorCode === 'SUP');
          if (parentSup) {
            const check = supervisionHierarchyCheck(parentSup.points, supScore.points);
            if (!check.compliant) {
              expertWarnings.push(
                `امتیاز سرپرستی پست مافوق (${parentSup.points}) کمتر از ۱٫۲ برابر امتیاز سرپرستی رده مادون (${supScore.points}) است؛ ` +
                  `حداقل مورد نیاز ${check.requiredMinimum.toFixed(1)} امتیاز.`,
              );
            }
          }
        }
      }
    }

    expertWarnings.push(
      'گروه پیشنهادی در وضعیت «در انتظار تأیید کمیته طبقه‌بندی مشاغل و اداره کل روابط کار» ثبت شد و قطعی نیست.',
    );

    const insert = this.db.run(
      `INSERT INTO job_evaluations (
         job_profile_id, system_id, scheme_code, group_table_version, factor_scores_json,
         sub_factor_scores_json, total_score, matched_range_id, proposed_group,
         final_confirmed_group, determination_reasons_json, expert_warnings_json, approval_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'PENDING_COMMITTEE_APPROVAL')`,
      profile.id,
      system.id,
      request.schemeCode,
      tableMatch.tableVersion ?? request.groupTableVersion ?? 'UNKNOWN',
      JSON.stringify(evaluation.factorScores),
      JSON.stringify(subFactorScores),
      evaluation.totalScore,
      tableMatch.range?.id ?? null,
      tableMatch.group,
      JSON.stringify(rationale),
      JSON.stringify(expertWarnings),
    );

    const evaluationId = insert.lastInsertRowid;
    recordHistory(this.db, {
      operationType: 'JOB_EVALUATION',
      entityType: 'job_evaluation',
      entityId: evaluationId,
      formulaCode: isSystemA ? 'FRM-EVAL-A-TOTAL' : 'FRM-EVAL-B-TOTAL',
      formulaVersion: evaluation.systemVersion,
      input: request,
      appliedTables: {
        groupTableVersion: tableMatch.tableVersion,
        schemeCode: request.schemeCode,
        jobProfile: profile.job_code,
      },
      output: { totalScore: evaluation.totalScore, proposedGroup: tableMatch.group },
      actor: request.createdBy ?? 'SYSTEM',
    });

    return {
      evaluationId,
      jobProfileId: profile.id,
      totalScore: evaluation.totalScore,
      proposedGroup: tableMatch.group,
      tableMatch,
      approvalStatus: 'PENDING_COMMITTEE_APPROVAL',
      finalConfirmedGroup: null,
      rationale,
      expertWarnings,
      factorScores: evaluation.factorScores,
      subFactorScores,
    };
  }

  /** تأیید کارشناسی و قطعی‌سازی گروه — بدون آن گروه قطعی نمی‌شود */
  approve(params: {
    evaluationId: number;
    reviewerName: string;
    committeeReferenceNo?: string;
    decision?: 'COMMITTEE_APPROVED' | 'MINISTRY_APPROVED' | 'REJECTED';
    finalGroup?: number;
    approvedAt?: string;
  }): { evaluationId: number; approvalStatus: ApprovalStatus; finalConfirmedGroup: number | null } {
    if (!params.reviewerName || params.reviewerName.trim() === '') {
      throw new MashaqelError(
        ERROR_CODES.APPROVAL_REQUIRED,
        'قطعی‌سازی گروه شغلی بدون نام کارشناس/مرجع تأییدکننده مجاز نیست.',
      );
    }
    const evaluation = this.db.get<JobEvaluationRow>('SELECT * FROM job_evaluations WHERE id = ?', params.evaluationId);
    if (!evaluation) {
      throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `ارزیابی با شناسه ${params.evaluationId} یافت نشد.`);
    }
    const decision = params.decision ?? 'COMMITTEE_APPROVED';

    if (decision === 'REJECTED') {
      this.db.run(
        `UPDATE job_evaluations SET approval_status = 'REJECTED', final_confirmed_group = NULL,
           reviewed_by_expert = ?, committee_reference_no = ?, approved_at = ?
         WHERE id = ?`,
        params.reviewerName,
        params.committeeReferenceNo ?? null,
        params.approvedAt ?? null,
        params.evaluationId,
      );
      return { evaluationId: params.evaluationId, approvalStatus: 'REJECTED', finalConfirmedGroup: null };
    }

    const finalGroup = params.finalGroup ?? evaluation.proposed_group;
    if (finalGroup === null || finalGroup < 1) {
      throw new MashaqelError(
        ERROR_CODES.APPROVAL_REQUIRED,
        'برای تأیید نهایی، تعیین گروه شغلی (پیشنهادی یا اصلاح‌شده توسط کارشناس) الزامی است.',
      );
    }
    const maxGroup = this.db.get<{ maxGroup: number | null }>(
      'SELECT MAX(group_number) AS maxGroup FROM group_score_ranges WHERE scheme_code = ?',
      evaluation.scheme_code,
    );
    if (maxGroup?.maxGroup && finalGroup > maxGroup.maxGroup) {
      throw new MashaqelError(
        ERROR_CODES.INVALID_ARGUMENT,
        `گروه ${finalGroup} از حداکثر گروه تعریف‌شده (${maxGroup.maxGroup}) در جدول طرح بیشتر است.`,
      );
    }
    if (!params.committeeReferenceNo || params.committeeReferenceNo.trim() === '') {
      throw new MashaqelError(
        ERROR_CODES.APPROVAL_REQUIRED,
        'شماره صورت‌جلسه/مستند تأیید کمیته طبقه‌بندی مشاغل برای قطعی‌سازی گروه الزامی است.',
      );
    }

    this.db.run(
      `UPDATE job_evaluations
       SET approval_status = ?, final_confirmed_group = ?, reviewed_by_expert = ?,
           committee_reference_no = ?, approved_at = ?
       WHERE id = ?`,
      decision,
      finalGroup,
      params.reviewerName,
      params.committeeReferenceNo,
      params.approvedAt ?? null,
      params.evaluationId,
    );
    recordHistory(this.db, {
      operationType: 'GROUP_APPROVAL',
      entityType: 'job_evaluation',
      entityId: params.evaluationId,
      formulaCode: 'FRM-GRP-MATCH',
      formulaVersion: evaluation.group_table_version,
      input: params,
      appliedTables: { schemeCode: evaluation.scheme_code },
      output: { approvalStatus: decision, finalConfirmedGroup: finalGroup },
      actor: params.reviewerName,
    });
    return { evaluationId: params.evaluationId, approvalStatus: decision, finalConfirmedGroup: finalGroup };
  }

  getEvaluation(id: number): JobEvaluationRow {
    const row = this.db.get<JobEvaluationRow>('SELECT * FROM job_evaluations WHERE id = ?', id);
    if (!row) throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `ارزیابی با شناسه ${id} یافت نشد.`);
    return row;
  }
}

function normalizeEducationKey(requiredEducation: string): RequiredEducationColumn | 'ASSOCIATE' | 'BACHELOR' | null {
  const text = requiredEducation.trim();
  const map: Array<[RegExp, RequiredEducationColumn | 'ASSOCIATE' | 'BACHELOR']> = [
    [/بی\s*سواد|خواندن\s*و\s*نوشتن|خواندن/i, 'READ_WRITE'],
    [/ابتدایی|پنجم|ششم/i, 'ELEMENTARY'],
    [/سیکل|راهنمایی|متوسطه\s*اول/i, 'SECYCLE'],
    [/دیپلم|متوسطه\s*دوم|دبیرستان/i, 'DIPLOMA'],
    [/فوق\s*دیپلم|کاردانی|associate/i, 'ASSOCIATE'],
    [/لیسانس|کارشناسی(?!\s*ارشد)|bachelor/i, 'BACHELOR'],
  ];
  for (const [regex, key] of map) {
    if (regex.test(text)) return key;
  }
  return null;
}
