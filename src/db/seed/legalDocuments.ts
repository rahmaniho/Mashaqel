/** بذر (seed) اسناد قانونی مرجع — تمامی اقلام مستند رسمی و دارای شماره/تاریخ ابلاغ */

import type { Db } from '../query.ts';
import { VALIDITY_STATUS } from '../../core/status.ts';

export interface LegalDocumentSeed {
  docCode: string;
  title: string;
  issuingAuthority: string;
  circularNumber: string | null;
  approvalDateJalali: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  docType: 'LAW' | 'BYLAW' | 'EVALUATION_SYSTEM' | 'INSTRUCTION' | 'CIRCULAR' | 'CABINET_DECREE';
  validityStatus: string;
  summaryNotes: string;
}

export const LEGAL_DOCUMENTS: LegalDocumentSeed[] = [
  {
    docCode: 'LABOR_LAW_1369',
    title: 'قانون کار جمهوری اسلامی ایران',
    issuingAuthority: 'مجمع تشخیص مصلحت نظام',
    circularNumber: null,
    approvalDateJalali: '1369-08-29',
    effectiveFrom: '1369-12-03',
    effectiveTo: null,
    docType: 'LAW',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      'مواد ۲۴، ۳۶، ۳۷، ۴۱، ۴۸، ۴۹، ۵۰، ۵۱، ۵۵ تا ۵۹، ۶۲ و ۱۴۸ — مبانی طبقه‌بندی مشاغل، مزد مبنا، اضافه‌کاری، نوبت‌کاری و شب‌کاری.',
  },
  {
    docCode: 'SOCIAL_SECURITY_LAW_1354',
    title: 'قانون تأمین اجتماعی',
    issuingAuthority: 'مجلس شورای ملی',
    circularNumber: null,
    approvalDateJalali: '1354-04-03',
    effectiveFrom: '1354-04-03',
    effectiveTo: null,
    docType: 'LAW',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: 'ماده ۲۸ (نرخ حق بیمه ۷٪ کارگر و ۲۰+۳٪ کارفرما) و ماده ۸۶ (کمک عائله‌مندی و حق اولاد).',
  },
  {
    docCode: 'EVAL_SYSTEM_1389',
    title: 'نظام ارزیابی مشاغل چهارعاملی وزارت کار و امور اجتماعی',
    issuingAuthority: 'وزیر کار و امور اجتماعی',
    circularNumber: null,
    approvalDateJalali: '1389-05-18',
    effectiveFrom: '1389-05-18',
    effectiveTo: null,
    docType: 'EVALUATION_SYSTEM',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: '۴ عامل اصلی، ۱۴ زیرعامل، مجموع نظری ۱٬۱۳۷ امتیاز؛ مبنای امتیازدهی نظام قدیم (سیستم B).',
  },
  {
    docCode: 'TVTO_INSTRUCTION_11894',
    title: 'دستورالعمل احتساب گواهی‌نامه‌های مهارت سازمان آموزش فنی و حرفه‌ای در نظام ارزیابی مشاغل',
    issuingAuthority: 'معاونت روابط کار وزارت تعاون، کار و رفاه اجتماعی',
    circularNumber: '11894',
    approvalDateJalali: '1389-11-20',
    effectiveFrom: '1389-11-20',
    effectiveTo: null,
    docType: 'INSTRUCTION',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: 'معادل‌سازی ساعت آموزش مهارت با امتیاز تحصیل/تجربه و امکان جایگزینی کمبود شرایط احراز.',
  },
  {
    docCode: 'BYLAW_49_1389',
    title: 'آیین‌نامه اجرایی طرح طبقه‌بندی مشاغل کارگاه‌ها (موضوع تبصره ۱ ماده ۴۹ قانون کار)',
    issuingAuthority: 'وزیر کار و امور اجتماعی',
    circularNumber: null,
    approvalDateJalali: '1389-12-01',
    effectiveFrom: '1389-12-01',
    effectiveTo: null,
    docType: 'BYLAW',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: '۱۱ ماده و ۱۳ تبصره — الزام طرح برای کارگاه‌های بالای ۵۰ نفر، اجرای مرحله‌ای و ماده ۹ (پرداخت معوقات از تاریخ شمول).',
  },
  {
    docCode: 'INSTRUCTION_20_LABOR_RELATIONS',
    title: 'دستورالعمل اجرایی طرح‌های طبقه‌بندی مشاغل — دستورالعمل شماره (۲۰) روابط کار',
    issuingAuthority: 'اداره کل تنظیم و نظارت بر روابط کار و نظام‌های جبران خدمت',
    circularNumber: '232/7',
    approvalDateJalali: '1390-07-26',
    effectiveFrom: '1390-07-26',
    effectiveTo: null,
    docType: 'INSTRUCTION',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      '۲۳ ماده، ۴۵ تبصره و دو جدول پیوست (تفاوت امتیاز دو گروه متوالی و جدول کسر سابقه بابت کمبود تحصیل).',
  },
  {
    docCode: 'EVAL_SYSTEM_1395',
    title: 'نظام ارزیابی مشاغل (مصوب ۱۳۹۵/۰۳/۲۲)',
    issuingAuthority: 'وزیر تعاون، کار و رفاه اجتماعی',
    circularNumber: '49240',
    approvalDateJalali: '1395-03-22',
    effectiveFrom: '1395-03-22',
    effectiveTo: null,
    docType: 'EVALUATION_SYSTEM',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      '۲۴ ماده و ۶ تبصره — چارچوب شش‌عاملی؛ وزن‌ها، سطوح و جداول کمّی هر روش باید به تصویب اداره کل روابط کار برسد (اقلام کمّی: وضعیت ۴).',
  },
  {
    docCode: 'WAGE_CIRCULAR_1405_6682',
    title: 'بخشنامه حداقل مزد و افزایش سایر سطوح مزدی سال ۱۴۰۵',
    issuingAuthority: 'شورای عالی کار / وزیر تعاون، کار و رفاه اجتماعی',
    circularNumber: '6682',
    approvalDateJalali: '1405-01-31',
    effectiveFrom: '1405-01-01',
    effectiveTo: '1405-12-29',
    docType: 'CIRCULAR',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      'حداقل مزد روزانه ۵٬۵۴۱٬۸۵۰ ریال؛ افزایش ۴۵٪ و مبلغ ثابت ۵۱۹٬۵۴۹ ریال؛ بن ۲۲٬۰۰۰٬۰۰۰ و حق تأهل ۵٬۰۰۰٬۰۰۰ ریال ماهانه.',
  },
  {
    docCode: 'INSTRUCTION_6724_1405',
    title: 'دستورالعمل نحوه اجرای مصوبه مزد ۱۴۰۵ در کارگاه‌های دارای طرح طبقه‌بندی مشاغل مصوب',
    issuingAuthority: 'اداره کل روابط کار، جبران خدمت و بیمه بیکاری',
    circularNumber: '6724',
    approvalDateJalali: '1405-01-31',
    effectiveFrom: '1405-01-01',
    effectiveTo: null,
    docType: 'INSTRUCTION',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      'ماده ۱ (مزد شغل = ۱٫۴۵×مزد ۱۴۰۴ + ۵۱۹٬۵۴۹ با کف ۵٬۵۴۱٬۸۵۰)، تبصره ۳ ماده ۱ (افزایش ۴۵٪ ضرایب جدول مزد)، ماده ۲ (جدول پایه سنوات گروه‌های بیست‌گانه).',
  },
  {
    docCode: 'INSTRUCTION_6727_1405',
    title: 'دستورالعمل نحوه اجرای مصوبه مزد ۱۴۰۵ در مورد کارگران کارمزدی دائم و موقت',
    issuingAuthority: 'اداره کل روابط کار، جبران خدمت و بیمه بیکاری',
    circularNumber: '6727',
    approvalDateJalali: '1405-01-31',
    effectiveFrom: '1405-01-01',
    effectiveTo: null,
    docType: 'INSTRUCTION',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: 'کارمزدی‌ها مشمول حداقل مزد و مزایای قانونی به نسبت کارکرد؛ خارج از حوزه محاسبات گروه‌بندی.',
  },
  {
    docCode: 'CABINET_DECREE_9234_1405',
    title: 'تصویب‌نامه تعیین کمک‌هزینه مسکن کارگران مشمول قانون کار در سال ۱۴۰۵',
    issuingAuthority: 'هیئت وزیران',
    circularNumber: '9234',
    approvalDateJalali: '1405-02-15',
    effectiveFrom: '1405-01-01',
    effectiveTo: '1405-12-29',
    docType: 'CABINET_DECREE',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes:
      'کمک‌هزینه مسکن سال ۱۴۰۵ برابر ۳۰٬۰۰۰٬۰۰۰ ریال ماهانه (جلسه ۱۴۰۵/۰۲/۰۶، ابلاغ ۱۴۰۵/۰۲/۱۵، اجرا از ۱۴۰۵/۰۱/۰۱).',
  },
  {
    docCode: 'CONTRACTING_CIRCULAR_52160',
    title: 'دستورالعمل اجرایی طرح طبقه‌بندی مشاغل شرکت‌های خدماتی پیمانکاری تأمین نیروی انسانی',
    issuingAuthority: 'وزارت کار و امور اجتماعی',
    circularNumber: '52160',
    approvalDateJalali: '1385-03-31',
    effectiveFrom: '1385-03-31',
    effectiveTo: null,
    docType: 'INSTRUCTION',
    validityStatus: VALIDITY_STATUS.VERIFIED_USABLE,
    summaryNotes: 'جدول مزد گروه‌های بیست‌گانه شرکت‌های خدماتی با ضریب ریالی سراسری a (۱۴۰۴: ۴۲۱٫۱۵ ریال).',
  },
];

export function seedLegalDocuments(db: Db): void {
  const stmt = db.raw.prepare(`
    INSERT INTO legal_documents (
      doc_code, title, issuing_authority, circular_number, approval_date_jalali,
      effective_from, effective_to, doc_type, validity_status, summary_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(doc_code) DO UPDATE SET
      title = excluded.title,
      summary_notes = excluded.summary_notes,
      validity_status = excluded.validity_status
  `);
  for (const doc of LEGAL_DOCUMENTS) {
    stmt.run(
      doc.docCode,
      doc.title,
      doc.issuingAuthority,
      doc.circularNumber,
      doc.approvalDateJalali,
      doc.effectiveFrom,
      doc.effectiveTo,
      doc.docType,
      doc.validityStatus,
      doc.summaryNotes,
    );
  }
}

export function getLegalDocumentId(db: Db, docCode: string): number {
  const row = db.get<{ id: number }>('SELECT id FROM legal_documents WHERE doc_code = ?', docCode);
  if (!row) throw new Error(`سند قانونی با کد ${docCode} یافت نشد.`);
  return row.id;
}
