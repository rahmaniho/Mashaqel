/**
 * بازبینی سبک چاپ و PDF (فاز ۱۴ — رفع باگ چاپ).
 * تضمین می‌کند قواعد کلیدی چاپ (A4، جدول‌های بلند، تکرار سرستون، رنگ پس‌زمینه،
 * پنهان‌سازی نوار ابزار، صفحه گزارش خالی، دروازه ورود) در CSS/JS/HTML حفظ شوند.
 * اجرا: npm run check:print
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
const check = (label: string, ok: boolean, detail = ''): void => {
  checks.push({ label, ok, ...(detail ? { detail } : {}) });
};

const css = read('web/style.css');
const app = read('web/app.js');
const html = read('web/index.html');

const printBlocks = css.match(/@media print\s*\{/g) ?? [];
check('CSS: یک بلوک @media print یکپارچه', printBlocks.length === 1, String(printBlocks.length));

const printStart = css.indexOf('@media print');
const printCss = printStart >= 0 ? css.slice(printStart) : '';
check('CSS: قاعده @page در بلوک چاپ', /@page\s*\{/.test(printCss));
check('CSS: اندازه A4 عمودی پیش‌فرض', /size:\s*A4 portrait/.test(printCss));
check('CSS: حاشیه ۱۲ میلی‌متر', /margin:\s*12mm/.test(printCss));
check('CSS: صفر شدن max-height جدول‌های بلند با !important', /\.table-wrap\.tall[\s\S]{0,200}max-height:\s*none\s*!important/.test(printCss));
check('CSS: جریان overflow در چاپ', /overflow:\s*visible\s*!important/.test(printCss));
check('CSS: تکرار سرستون جدول در صفحات', /thead\s*\{\s*display:\s*table-header-group/.test(printCss));
check('CSS: جلوگیری از شکستن ردیف‌ها', /tr,[\s\S]{0,120}break-inside:\s*avoid/.test(printCss));
check('CSS: چاپ رنگ پس‌زمینه سرستون', /print-color-adjust:\s*exact/.test(printCss));
check('CSS: پنهان‌سازی .no-print', /\.no-print/.test(printCss));
check('CSS: پنهان‌سازی نوار ابزار', /\.toolbar/.test(printCss));
check('CSS: پنهان‌سازی فرم‌های ورودی', /input,[\s\S]{0,40}button/.test(printCss));
check('CSS: فقط نمای فعال چاپ می‌شود', /\.view:not\(\.is-active\)/.test(printCss));
check('CSS: دروازه ورود در چاپ پنهان است', /body\.is-auth \.app-shell\s*\{\s*display:\s*none/.test(printCss));
check('CSS: گزارش خالی چاپ نمی‌شود', /#rp-sheet\.report-sheet\[hidden\]/.test(printCss));
check('CSS: گزارش ساخته‌شده در چاپ دیده می‌شود', /#rp-sheet\.report-sheet:not\(\[hidden\]\)/.test(printCss));
check('CSS: پرونده پرسنلی صفحه‌بندی امن', /\.profile-section\s*\{\s*break-inside:\s*avoid/.test(printCss));

const open = (printCss.match(/\{/g) ?? []).length;
const close = (printCss.match(/\}/g) ?? []).length;
check('CSS: توازن آکولاد در بلوک چاپ', open === close, `${open}/${close}`);

check('HTML: استایل جهت کاغذ', html.includes('id="print-page-style"'));
check('HTML: جهت چاپ پیش از پایان head', html.indexOf('id="print-page-style"') < html.indexOf('</head>'));

check('JS: تابع جهت کاغذ', app.includes('function setPrintOrientation'));
check('JS: تابع چاپ مشترک', app.includes('function doPrint'));
check('JS: کلاس جهت افقی روی body', app.includes("classList.toggle('print-landscape'"));

const barePrint = (app.match(/window\.print\(\)/g) ?? []).length;
check('JS: تنها یک فراخوانی window.print در doPrint', barePrint === 1, String(barePrint));

const routes = app.match(/const LANDSCAPE_ROUTES = new Set\(\[([^\]]*)\]\)/);
check('JS: مسیرهای افقی تعریف شده', Boolean(routes));
const landscapeList = routes?.[1] ?? '';
for (const route of ['jobs', 'org', 'employees', 'payroll', 'arrears', 'reports']) {
  check(`JS: مسیر ${route} در چاپ افقی`, landscapeList.includes(`'${route}'`));
}

for (const id of ['jobs-print-list', 'profile-print', 'org-print', 'emp-print', 'pr-print', 'ar-print', 'rp-print']) {
  check(`HTML: دکمه چاپ #${id}`, html.includes(`id="${id}"`));
  check(`JS: اتصال #${id} به doPrint`, new RegExp(`getElementById\\('${id}'\\)[\\s\\S]{0,320}doPrint\\(`).test(app));
}
check('JS: دکمه چاپ کلی به doPrint متصل است', /printButton\.addEventListener\('click'[\s\S]{0,220}doPrint\(/.test(app));
check('JS: محافظ چاپ گزارش خالی', app.includes('reportSheetReady'));
check('JS: محافظ چاپ شناسنامه خالی', /profilePrint[\s\S]{0,320}job-profile-body/.test(app));
check('JS: بازنشانی جهت پس از چاپ', app.includes("'afterprint'"));

const failures = checks.filter((row) => !row.ok);
for (const row of checks) {
  if (!row.ok) console.error(`✗ ${row.label}${row.detail ? ` → ${row.detail}` : ''}`);
}
console.log(`${checks.length - failures.length}/${checks.length} بررسی سبک چاپ موفق.`);
if (failures.length > 0) process.exitCode = 1;
