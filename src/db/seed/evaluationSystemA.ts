/**
 * بذر سیستم A — نظام ارزیابی مشاغل مصوب ۱۳۹۵/۰۳/۲۲ (شماره ۴۹۲۴۰).
 * مصوبه کشوری فقط چارچوب شش‌عاملی را تعیین می‌کند؛ وزن، سطح، امتیاز و جدول گروه‌بندی
 * باید در «طرح مصوب کارگاه» (تأیید اداره کل روابط کار) بارگذاری شود.
 * بنابراین هیچ عدد، وزن یا سطحی برای این نظام به‌عنوان داده رسمی ثبت نمی‌شود.
 */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';
import { getLegalDocumentId } from './legalDocuments.ts';

export const SYSTEM_A_CODE = 'EVAL_1395_FRAMEWORK';
export const SYSTEM_A_VERSION = '1395.1';
export const SYSTEM_A_EFFECTIVE_FROM = '1395-03-22';

interface SystemAFactorSeed {
  code: string;
  name: string;
  order: number;
  definition: string;
}

export const SYSTEM_A_FACTORS: SystemAFactorSeed[] = [
  {
    code: 'SYS_A_F1',
    name: 'دانش',
    order: 1,
    definition:
      'مجموعه‌ای از اصول و حقایق سازمان‌یافته از قبیل معلومات نظری، توانمندی‌های ذهنی و آگاهی‌های قابل کاربرد برای انجام وظایف شغلی.',
  },
  {
    code: 'SYS_A_F2',
    name: 'تجربه و مهارت',
    order: 2,
    definition:
      'معلومات، مهارت‌ها و رشد فکری مرتبط با شغل که ظرف مدت زمان و در عمل به دست می‌آید و موجب احاطه و تسلط کافی شاغل متناسب با استانداردهای متعارف برای انجام وظایف شغل یا پست سازمانی می‌شود.',
  },
  {
    code: 'SYS_A_F3',
    name: 'مسئولیت‌ها',
    order: 3,
    definition:
      'الزامات و تعهدات شاغل در قبال اجرای تکالیف و اعمال اختیارات و ضوابط و معیارهای مقرر که به انواع مختلف تقسیم می‌شود.',
  },
  {
    code: 'SYS_A_F4',
    name: 'شرایط کار',
    order: 4,
    definition:
      'عوامل فیزیکی و اجتماعی پیرامون شاغل که بر ماهیت کار تأثیر گذارده و شاغل به‌عنوان بخشی از انجام وظایف با آن روبرو است.',
  },
  {
    code: 'SYS_A_F5',
    name: 'نیازهای فکری شغل',
    order: 5,
    definition:
      'میزان تلاش فکری، دقت، درجه تمرکز ذهنی، قدرت تصمیم‌گیری، تجزیه و تحلیل مسائل، طراحی و برنامه‌ریزی، تجسم و قضاوت، سرعت انتقال، ابتکار و تدوین خط‌مشی و مقررات مربوط به شغل.',
  },
  {
    code: 'SYS_A_F6',
    name: 'نیازهای جسمی شغل',
    order: 6,
    definition: 'فعالیت جسمی و مهارت حرکات اندام‌های بدن شاغل برای حسن انجام وظایف شغلی.',
  },
];

export function seedEvaluationSystemA(db: Db): void {
  const docId = getLegalDocumentId(db, 'EVAL_SYSTEM_1395');
  db.raw
    .prepare(
      `INSERT INTO evaluation_systems (
        system_code, name, legal_basis, circular_number, approval_date_jalali, version,
        effective_from, effective_to, scoring_mode, max_theoretical_score,
        requires_workshop_tables, validity_status, legal_document_id, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(system_code, version) DO NOTHING`,
    )
    .run(
      SYSTEM_A_CODE,
      'نظام ارزیابی مشاغل مصوب ۱۳۹۵ (چارچوب شش‌عاملی)',
      'نظام ارزیابی مشاغل مصوب ۱۳۹۵/۰۳/۲۲ وزیر تعاون، کار و رفاه اجتماعی (شماره ۴۹۲۴۰)، مواد ۱ تا ۴ و ۱۰',
      '49240',
      SYSTEM_A_EFFECTIVE_FROM,
      SYSTEM_A_VERSION,
      SYSTEM_A_EFFECTIVE_FROM,
      null,
      'CONFIGURABLE_QUANTITATIVE_OR_HYBRID',
      null,
      1,
      VALIDITY_STATUS.VERIFIED_USABLE,
      docId,
      'چارچوب قانونی شش‌عاملی؛ زیرعامل‌ها، سطوح، امتیازات، وزن‌ها و جدول گروه‌بندی باید از طرح مصوب کارگاه بارگذاری شود.',
    );

  const systemRow = db.get<{ id: number }>(
    'SELECT id FROM evaluation_systems WHERE system_code = ? AND version = ?',
    SYSTEM_A_CODE,
    SYSTEM_A_VERSION,
  );
  if (!systemRow) throw new Error('ثبت نظام ارزیابی سیستم A ناموفق بود.');

  const factorStmt = db.raw.prepare(`
    INSERT INTO evaluation_factors (
      system_id, factor_code, name, display_order, max_score, official_weight_pct, definition, validity_status
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
    ON CONFLICT(system_id, factor_code) DO NOTHING
  `);
  for (const factor of SYSTEM_A_FACTORS) {
    factorStmt.run(
      systemRow.id,
      factor.code,
      factor.name,
      factor.order,
      factor.definition,
      VALIDITY_STATUS.REQUIRES_WORKSHOP_APPROVED_SCHEME,
    );
  }
}
