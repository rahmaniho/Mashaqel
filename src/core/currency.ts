/**
 * محافظ واحد پولی — جلوگیری سیستمی از اختلاط ریال و تومان.
 * قاعده الزامی سامانه: تمامی مبالغ ورودی، محاسباتی و ذخیره‌شده به «ریال ایران (IRR)» است.
 * هر مبلغی که با واحد «تومان» وارد شود باید صریحاً اعلام واحد کند و موتور خودش آن را به ریال تبدیل می‌کند؛
 * در غیر این صورت خطای CURRENCY_MISMATCH صادر می‌شود.
 */

import { ERROR_CODES, MashaqelError } from './status.ts';

export const BASE_CURRENCY = 'IRR' as const;
export type CurrencyUnit = 'IRR' | 'TOMAN';

/** هر تومان = ۱۰ ریال */
export const IRR_PER_TOMAN = 10;

export function assertCurrencyUnit(unit: string, field = 'currency_unit'): CurrencyUnit {
  if (unit !== 'IRR' && unit !== 'TOMAN') {
    throw new MashaqelError(
      ERROR_CODES.CURRENCY_MISMATCH,
      `واحد پولی «${unit}» در فیلد ${field} پشتیبانی نمی‌شود؛ فقط IRR (ریال) یا TOMAN (تومان) مجاز است.`,
      { field, unit },
    );
  }
  return unit;
}

/** الزام ریالی بودن یک مبلغ و تبدیل صریح تومان به ریال */
export function toIrr(amount: number, unit: string, field = 'amount'): number {
  assertFiniteAmount(amount, field);
  const parsed = assertCurrencyUnit(unit, field);
  if (parsed === 'TOMAN') {
    return roundMoney(amount * IRR_PER_TOMAN);
  }
  return roundMoney(amount);
}

/** تبدیل ریال به تومان (فقط برای نمایش؛ مقدار بازگشتی هرگز مبنای محاسبه نیست) */
export function toToman(amountIrr: number, field = 'amount'): number {
  assertFiniteAmount(amountIrr, field);
  return roundMoney(amountIrr / IRR_PER_TOMAN);
}

export function assertFiniteAmount(amount: number, field = 'amount'): void {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `مبلغ فیلد ${field} عدد معتبر نیست: ${String(amount)}`);
  }
  if (amount < 0) {
    throw new MashaqelError(ERROR_CODES.INVALID_ARGUMENT, `مبلغ فیلد ${field} نمی‌تواند منفی باشد: ${amount}`);
  }
}

/** گرد کردن پول به ریال صحیح (نیم به بالا) */
export function roundMoney(amount: number): number {
  return Math.sign(amount) * Math.round(Math.abs(amount));
}

/**
 * تشخیص خودکار اشتباه ریال/تومان بر مبنای یک مقدار مرجع ریالی معتبر.
 * اگر مبلغ ورودی حدود یک‌دهم مقدار مرجع باشد ولی مبلغ×۱۰ برابر مرجع باشد،
 * به‌احتمال قوی مبلغ به تومان وارد شده است.
 */
export function detectTomanSuspicion(amount: number, referenceIrr: number, tolerance = 0.02): boolean {
  if (amount <= 0 || referenceIrr <= 0) return false;
  const asIrr = Math.abs(amount - referenceIrr) / referenceIrr;
  const asToman = Math.abs(amount * IRR_PER_TOMAN - referenceIrr) / referenceIrr;
  return asIrr > tolerance && asToman <= tolerance;
}

/**
 * نگهبان اجباری مبلغ: هر مبلغ ورودی کاربر برای مبالغ مرجع قانونی
 * (حداقل مزد، مزایای رفاهی، ...) از این گذرگاه عبور می‌کند.
 */
export function guardReferenceAmount(
  amount: number,
  referenceIrr: number,
  field: string,
  declaredUnit: string = BASE_CURRENCY,
): number {
  const unit = assertCurrencyUnit(declaredUnit, field);
  const converted = toIrr(amount, unit, field);
  if (unit === 'IRR' && detectTomanSuspicion(amount, referenceIrr)) {
    throw new MashaqelError(
      ERROR_CODES.AMOUNT_TOMAN_SUSPECTED,
      `مبلغ فیلد ${field} به مقدار «${amount}» با واحد ریال ثبت شده اما با مبلغ قانونی مرجع ` +
        `«${referenceIrr} ریال» سازگار نیست و به‌احتمال قوی به تومان وارد شده است. ` +
        `لطفاً واحد TOMAN را اعلام کنید یا مبلغ را به ریال اصلاح نمایید.`,
      { field, amount, referenceIrr, suspectedUnit: 'TOMAN' },
    );
  }
  return converted;
}

/** مقایسه ریالی دو مبلغ با پیام خطای گویا */
export function assertSameCurrency(aUnit: string, bUnit: string, context = 'مقایسه مبالغ'): void {
  const a = assertCurrencyUnit(aUnit, `${context}.a`);
  const b = assertCurrencyUnit(bUnit, `${context}.b`);
  if (a !== b) {
    throw new MashaqelError(
      ERROR_CODES.CURRENCY_MISMATCH,
      `${context}: مقایسه یا جمع دو مبلغ با واحدهای متفاوت (${a} و ${b}) مجاز نیست.`,
      { a, b },
    );
  }
}

/** قالب‌بندی ریالی برای گزارش‌ها */
export function formatIrr(amount: number): string {
  return `${roundMoney(amount).toLocaleString('en-US')} ریال`;
}
