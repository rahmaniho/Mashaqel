/**
 * وضعیت‌های استاندارد اعتبار قانونی اقلام (فرمول، جدول، ضریب، پارامتر)
 * هر قلم اطلاعاتی در سامانه الزاماً یکی از این چهار وضعیت را دارد.
 */
export const VALIDITY_STATUS = {
  /** ۱. مستند و قابل استفاده — مستند رسمی کامل؛ اجرای مستقیم مجاز است. */
  VERIFIED_USABLE: '1_VERIFIED_USABLE',
  /** ۲. استخراج‌شده ولی نیازمند تطبیق — اجرا با هشدار کارشناسی و نسخه‌بندی. */
  EXTRACTED_NEEDS_VERIFICATION: '2_EXTRACTED_NEEDS_VERIFICATION',
  /** ۳. فاقد مستند کافی — امتیازدهی/اجرای خودکار تا بارگذاری مستند رسمی ممنوع. */
  INSUFFICIENT_DOCUMENTATION: '3_INSUFFICIENT_DOCUMENTATION',
  /** ۴. نیازمند ورود اطلاعات طرح مصوب کارگاه — مقدار سراسری ندارد. */
  REQUIRES_WORKSHOP_APPROVED_SCHEME: '4_REQUIRES_WORKSHOP_APPROVED_SCHEME',
} as const;

export type ValidityStatus = (typeof VALIDITY_STATUS)[keyof typeof VALIDITY_STATUS];

export const VALIDITY_STATUS_LABELS: Record<ValidityStatus, string> = {
  '1_VERIFIED_USABLE': '۱. مستند و قابل استفاده',
  '2_EXTRACTED_NEEDS_VERIFICATION': '۲. استخراج‌شده ولی نیازمند تطبیق',
  '3_INSUFFICIENT_DOCUMENTATION': '۳. فاقد مستند کافی',
  '4_REQUIRES_WORKSHOP_APPROVED_SCHEME': '۴. نیازمند ورود اطلاعات طرح مصوب کارگاه',
};

/** آیا قلم اطلاعاتی از نظر قانونی اجازه اجرای خودکار دارد؟ */
export function isExecutable(status: ValidityStatus): boolean {
  return status === VALIDITY_STATUS.VERIFIED_USABLE || status === VALIDITY_STATUS.EXTRACTED_NEEDS_VERIFICATION;
}

/** آیا اجرای قلم نیازمند هشدار کارشناسی است؟ */
export function requiresExpertWarning(status: ValidityStatus): boolean {
  return status !== VALIDITY_STATUS.VERIFIED_USABLE;
}

/** نوع خطاهای تخصصی موتور */
export class MashaqelError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MashaqelError';
    this.code = code;
    if (details) this.details = details;
  }
}

export const ERROR_CODES = {
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  AMOUNT_TOMAN_SUSPECTED: 'AMOUNT_TOMAN_SUSPECTED',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  MISSING_WAGE_TABLE: 'MISSING_WAGE_TABLE',
  MISSING_SENIORITY_TABLE: 'MISSING_SENIORITY_TABLE',
  MISSING_PARAMETERS: 'MISSING_PARAMETERS',
  SCORING_DISABLED: 'SCORING_DISABLED',
  SCORING_SYSTEM_NOT_READY: 'SCORING_SYSTEM_NOT_READY',
  UNKNOWN_SUB_FACTOR: 'UNKNOWN_SUB_FACTOR',
  UNKNOWN_LEVEL: 'UNKNOWN_LEVEL',
  NO_GROUP_MATCH: 'NO_GROUP_MATCH',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  BELOW_MINIMUM_WAGE: 'BELOW_MINIMUM_WAGE',
  SCORE_EXCEEDS_SUB_FACTOR_MAX: 'SCORE_EXCEEDS_SUB_FACTOR_MAX',
} as const;

/** پیام استاندارد قانونی فقدان جدول پایه سنوات طرح */
export const SENIORITY_TABLE_UNAVAILABLE_MESSAGE = 'جدول پایه سنوات این طرح در دسترس نیست';

/** پیام استاندارد فقدان جداول امتیازدهی طرح مصوب کارگاه (نظام جدید ارزیابی مشاغل) */
export const WORKSHOP_SCHEME_REQUIRED_MESSAGE =
  'جداول امتیازدهی، وزن‌ها و سطوح این نظام برای طرح مصوب این کارگاه بارگذاری نشده است؛ امتیازدهی تا ورود اطلاعات طرح مصوب کارگاه (تأییدشده اداره کل روابط کار) فعال نمی‌شود.';

/** پیام استاندارد فقدان جدول رسمی یک زیرعامل */
export const SUB_FACTOR_TABLE_MISSING_MESSAGE =
  'جدول رسمی سطوح و امتیازات این زیرعامل در دسترس نیست؛ امتیازدهی خودکار آن غیرفعال است.';
