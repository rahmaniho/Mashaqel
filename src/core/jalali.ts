/**
 * ابزارهای تاریخ شمسی (جلالی) — تبدیل، اعتبارسنجی و مقایسه.
 * تاریخ‌های ذخیره‌شده در دیتابیس به قالب استاندارد `YYYY-MM-DD` شمسی نگهداری می‌شوند
 * تا مقایسه چندتاریخی (نسخه‌بندی effective_from / effective_to) به‌صورت رشته‌ای و سریع انجام شود.
 */

import { ERROR_CODES, MashaqelError } from './status.ts';

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

interface JalCalResult {
  leap: number;
  gy: number;
  march: number;
  jump: number;
}

function jalCal(jy: number): JalCalResult {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] as number;
  let jump = 0;
  if (jy < jp || jy >= (BREAKS[bl - 1] as number)) {
    throw new MashaqelError(ERROR_CODES.INVALID_DATE, `سال شمسی نامعتبر است: ${jy}`);
  }
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  let leap = 0;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march, jump };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function isLeapJalaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

export interface JalaliParts {
  year: number;
  month: number;
  day: number;
}

/** اعتبارسنجی و تحلیل تاریخ شمسی از قالب `YYYY-MM-DD` یا `YYYY/MM/DD` */
export function parseJalaliDate(input: string): JalaliParts {
  const normalized = String(input).trim().replace(/\//g, '-');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (!match) {
    throw new MashaqelError(ERROR_CODES.INVALID_DATE, `قالب تاریخ شمسی نامعتبر است: ${input}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    throw new MashaqelError(ERROR_CODES.INVALID_DATE, `ماه شمسی نامعتبر است: ${input}`);
  }
  const maxDay = jalaliMonthLength(year, month);
  if (day < 1 || day > maxDay) {
    throw new MashaqelError(ERROR_CODES.INVALID_DATE, `روز شمسی نامعتبر است: ${input}`);
  }
  return { year, month, day };
}

/** نرمال‌سازی تاریخ شمسی به قالب ذخیره‌سازی `YYYY-MM-DD` */
export function normalizeJalaliDate(input: string): string {
  const { year, month, day } = parseJalaliDate(input);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** قالب نمایشی فارسی `YYYY/MM/DD` */
export function formatJalaliDate(input: string): string {
  const n = normalizeJalaliDate(input);
  return n.replace(/-/g, '/');
}

function assertValidJalali(parts: JalaliParts): void {
  const maxDay = jalaliMonthLength(parts.year, parts.month);
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > maxDay) {
    throw new MashaqelError(ERROR_CODES.INVALID_DATE, `تاریخ شمسی نامعتبر است: ${JSON.stringify(parts)}`);
  }
}

export function jalaliToGregorian(parts: JalaliParts): { gy: number; gm: number; gd: number } {
  assertValidJalali(parts);
  return d2g(j2d(parts.year, parts.month, parts.day));
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliParts {
  const { jy, jm, jd } = d2j(g2d(gy, gm, gd));
  return { year: jy, month: jm, day: jd };
}

export function jalaliToIso(parts: JalaliParts): string {
  const g = jalaliToGregorian(parts);
  return `${String(g.gy).padStart(4, '0')}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

export function isoToJalali(iso: string): JalaliParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) throw new MashaqelError(ERROR_CODES.INVALID_DATE, `قالب تاریخ میلادی نامعتبر است: ${iso}`);
  return gregorianToJalali(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** آیا تاریخ `date` در بازه بسته [from, to] قرار دارد؟ (to = null یعنی بدون پایان) */
export function isDateInRange(date: string, from: string, to?: string | null): boolean {
  const d = normalizeJalaliDate(date);
  const f = normalizeJalaliDate(from);
  if (d < f) return false;
  if (to && d > normalizeJalaliDate(to)) return false;
  return true;
}

/** افزودن ماه به یک سال-ماه شمسی (`YYYY-MM`) */
export function addMonthsToYearMonth(yearMonth: string, months: number): string {
  const match = /^(\d{4})-(\d{1,2})$/.exec(yearMonth.trim());
  if (!match) throw new MashaqelError(ERROR_CODES.INVALID_DATE, `سال-ماه نامعتبر است: ${yearMonth}`);
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** لیست سال-ماه‌های یک بازه بسته */
export function enumerateYearMonths(fromYearMonth: string, toYearMonth: string): string[] {
  const result: string[] = [];
  let current = fromYearMonth.trim();
  const end = toYearMonth.trim();
  for (let guard = 0; guard < 600; guard += 1) {
    result.push(current);
    if (current === end) break;
    current = addMonthsToYearMonth(current, 1);
  }
  return result;
}

/** تعداد روزهای یک سال-ماه شمسی */
export function daysInYearMonth(yearMonth: string): number {
  const match = /^(\d{4})-(\d{1,2})$/.exec(yearMonth.trim());
  if (!match) throw new MashaqelError(ERROR_CODES.INVALID_DATE, `سال-ماه نامعتبر است: ${yearMonth}`);
  return jalaliMonthLength(Number(match[1]), Number(match[2]));
}
