/**
 * بذر جدول رسمی دامنه امتیازات ۲۰ گروه شغلی، سقف امتیاز گروه (Xn)،
 * مازاد بر گروه ۱ (Bn = Xn − 80) و تفاوت امتیاز دو گروه متوالی (Δn).
 */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';
import { getLegalDocumentId } from './legalDocuments.ts';
import { SYSTEM_B_CODE, SYSTEM_B_EFFECTIVE_FROM, SYSTEM_B_VERSION } from './evaluationSystemB.ts';

export const GROUP_TABLE_VERSION = '1389.1';

export interface GroupRangeSeed {
  group: number;
  min: number;
  max: number;
  ceiling: number;
  excess: number;
  delta: number;
}

export const GROUP_RANGES_20: GroupRangeSeed[] = [
  { group: 1, min: 0, max: 80, ceiling: 80, excess: 0, delta: 15 },
  { group: 2, min: 81, max: 95, ceiling: 95, excess: 15, delta: 15 },
  { group: 3, min: 96, max: 110, ceiling: 110, excess: 30, delta: 15 },
  { group: 4, min: 111, max: 125, ceiling: 125, excess: 45, delta: 15 },
  { group: 5, min: 126, max: 145, ceiling: 145, excess: 65, delta: 20 },
  { group: 6, min: 146, max: 165, ceiling: 165, excess: 85, delta: 20 },
  { group: 7, min: 166, max: 185, ceiling: 185, excess: 105, delta: 20 },
  { group: 8, min: 186, max: 210, ceiling: 210, excess: 130, delta: 25 },
  { group: 9, min: 211, max: 235, ceiling: 235, excess: 155, delta: 25 },
  { group: 10, min: 236, max: 265, ceiling: 265, excess: 185, delta: 30 },
  { group: 11, min: 266, max: 295, ceiling: 295, excess: 215, delta: 30 },
  { group: 12, min: 296, max: 325, ceiling: 325, excess: 245, delta: 30 },
  { group: 13, min: 326, max: 365, ceiling: 365, excess: 285, delta: 40 },
  { group: 14, min: 366, max: 405, ceiling: 405, excess: 325, delta: 40 },
  { group: 15, min: 406, max: 445, ceiling: 445, excess: 365, delta: 40 },
  { group: 16, min: 446, max: 495, ceiling: 495, excess: 415, delta: 50 },
  { group: 17, min: 496, max: 545, ceiling: 545, excess: 465, delta: 50 },
  { group: 18, min: 546, max: 605, ceiling: 605, excess: 525, delta: 60 },
  { group: 19, min: 606, max: 665, ceiling: 665, excess: 585, delta: 60 },
  { group: 20, min: 666, max: 740, ceiling: 740, excess: 660, delta: 75 },
];

export function seedGroupScoreRanges(db: Db): void {
  const system = db.get<{ id: number }>(
    'SELECT id FROM evaluation_systems WHERE system_code = ? AND version = ?',
    SYSTEM_B_CODE,
    SYSTEM_B_VERSION,
  );
  if (!system) throw new Error('نظام ارزیابی سیستم B برای ثبت جدول گروه‌ها یافت نشد.');
  const docId = getLegalDocumentId(db, 'EVAL_SYSTEM_1389');

  const stmt = db.raw.prepare(`
    INSERT INTO group_score_ranges (
      system_id, scheme_code, version, effective_from, effective_to, group_number,
      min_score, max_score, ceiling_score_xn, excess_over_g1_bn, consecutive_diff_delta,
      validity_status, legal_document_id
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scheme_code, version, group_number) DO NOTHING
  `);
  for (const row of GROUP_RANGES_20) {
    stmt.run(
      system.id,
      'NATIONAL_20_GROUP_1389',
      GROUP_TABLE_VERSION,
      SYSTEM_B_EFFECTIVE_FROM,
      row.group,
      row.min,
      row.max,
      row.ceiling,
      row.excess,
      row.delta,
      VALIDITY_STATUS.VERIFIED_USABLE,
      docId,
    );
  }
}
