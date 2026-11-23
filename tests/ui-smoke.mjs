/**
 * آزمون دودی رابط کاربری وب‌اپ (بدون مرورگر واقعی).
 * صفحه web/index.html را با linkedom رندر می‌کند، app.js را اجرا می‌کند و
 * اعداد نمایش‌داده‌شده را با هسته محاسباتی مرورگر مقایسه می‌کند.
 * اجرا: npm run test:web-ui   (پیش‌نیاز: npm run export:web)
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');
const { window, document } = parseHTML(html);

window.scrollTo = () => {};
globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};

const data = JSON.parse(readFileSync(resolve(root, 'web/data/mashaqel-data.json'), 'utf8'));
globalThis.fetch = async (url) => {
  const raw = readFileSync(resolve(root, 'web', String(url).replace(/^\.\//, '')), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(raw) };
};

const core = await import(pathToFileURL(resolve(root, 'web/engine-core.js')).href);

const errors = [];
process.on('unhandledRejection', (error) => errors.push(error));

await import(`${pathToFileURL(resolve(root, 'web/app.js')).href}?t=${Date.now()}`);
await new Promise((resolve) => setTimeout(resolve, 300));

const text = (selector) =>
  (document.querySelector(selector)?.innerHTML ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fa = (value) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value);
const en = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const click = (selector) => document.querySelector(selector).dispatchEvent(new window.Event('click'));
const setSelect = (selector, value) => {
  const select = document.querySelector(selector);
  for (const option of [...(select.options ?? [])]) {
    option.selected = option.getAttribute('value') === value;
    if (option.selected) option.setAttribute('selected', 'selected');
    else option.removeAttribute('selected');
  }
  select.dispatchEvent(new window.Event('change'));
};

const checks = [];
const assert = (label, condition, detail = '') => checks.push({ label, ok: Boolean(condition), detail });
const contains = (label, haystack, needle) => assert(label, haystack.includes(needle), needle);

/* ------------------------------- مزد پیش‌فرض ------------------------------- */
const expectedWage = core.computeWage(data, {
  schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
  jobGroup: 8,
  priorDailyJobWage: 3_518_406,
  priorAccumulatedDailySeniority: 166_667,
  serviceYearsInWorkshop: 2,
  payableDays: 30,
  isMarried: true,
  eligibleChildrenCount: 1,
  includeWelfareBenefits: true,
  computationDate: '1405-03-15',
});
const wageText = text('#wage-results');
for (const field of ['dailyJobWage', 'dailyBaseWage', 'grossTotal', 'netPayable', 'tax', 'dailySeniorityWage']) {
  contains(`مزد.${field}`, wageText, fa(expectedWage[field]));
}
contains('مزد.پایه سنوات ماهانه', wageText, fa(expectedWage.monthlySeniorityWage));

/* ------------------------------ تغییر گروه ------------------------------ */
setSelect('#w-group', '20');
click('#wage-calc');
const prior = Number(document.querySelector('#w-prior').value);
assert('تغییر گروه → مزد ۱۴۰۴ گروه ۲۰', prior === 3_741_615, String(prior));
const g20 = core.computeWage(data, {
  schemeCode: 'SERVICE_COMPANIES_NATIONWIDE',
  jobGroup: 20,
  priorDailyJobWage: prior,
  priorAccumulatedDailySeniority: 166_667,
  serviceYearsInWorkshop: 2,
  payableDays: 30,
  isMarried: true,
  eligibleChildrenCount: 1,
  includeWelfareBenefits: true,
  computationDate: '1405-03-15',
});
contains('گروه ۲۰ → مزد شغل روزانه', text('#wage-results'), fa(g20.dailyJobWage));
setSelect('#w-group', '8');

/* --------------------------------- سنوات --------------------------------- */
click('#s-calc');
const seniorityText = text('#s-result');
contains('سنوات.نرخ گروه ۸', seniorityText, fa(168_067));
contains('سنوات.کل پایه سنوات', seniorityText, fa(Math.round(166_667 * 1.45) + 168_067));

/* --------------------------------- گروه --------------------------------- */
setSelect('#g-scheme', 'NATIONAL_20_GROUP_1389');
click('#g-calc');
contains('گروه.امتیاز ۳۲۳ → گروه ۱۲', text('#g-result'), fa(12));

/* -------------------------------- ارزیابی -------------------------------- */
const welder = core.evaluatePointBased(data, {
  systemCode: 'EVAL_1389_POINT_FACTOR',
  evaluationDate: '1405-03-15',
  selections: [
    { subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_3' },
    { subFactorCode: 'EXP', kind: 'LEVEL', levelCode: 'EXP_3' },
    { subFactorCode: 'SUP', kind: 'SUPERVISION', directHeadcountByGrade: {}, indirectHeadcount: 0 },
    { subFactorCode: 'MAT_PRD', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
    { subFactorCode: 'MCH_EQP', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'P_HIGH' },
    { subFactorCode: 'COM_REL', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'C_LOW' },
    { subFactorCode: 'FIN_AST', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'P_LOW' },
    { subFactorCode: 'FRM_RPT', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'V_LOW' },
    { subFactorCode: 'SPC_RSP', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_LOW' },
    { subFactorCode: 'MNT_EFF', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_MEDIUM' },
    { subFactorCode: 'PHY_EFF', kind: 'DOMINANT_ROW', levelCode: 'PHY_6B', hoursBracketCode: 'H5' },
    {
      subFactorCode: 'ENV_CND',
      kind: 'ENV_ITEMS',
      items: [
        { itemCode: 'ENV_TEMP', intensityCode: 'HIGH', hoursBracketCode: 'B8' },
        { itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
        { itemCode: 'ENV_DUST', intensityCode: 'SEVERE', hoursBracketCode: 'B4' },
        { itemCode: 'ENV_SMOKE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
      ],
    },
    { subFactorCode: 'OCC_HAZ', kind: 'HAZARD', injuryLevelCode: 'HZ_INJ_3', injuryProbabilityCode: 'HIGH', diseaseProbabilityCode: 'MEDIUM' },
  ],
});
const evalText = text('#eval-results');
contains('ارزیابی.امتیاز کل جوشکار', evalText, fa(welder.totalScore));
contains('ارزیابی.زیرعامل EDU', evalText, fa(welder.subFactorScores.find((row) => row.subFactorCode === 'EDU').points));
assert('ارزیابی.۱۴ کارت زیرعامل', document.querySelectorAll('#eval-form .eval-card').length === 14);

click('[data-preset="supervisor"]');
const supervisorText = text('#eval-results');
contains('ارزیابی.امتیاز کل سرپرست', supervisorText, fa(472));
contains('ارزیابی.گروه سرپرست ۱۶', supervisorText, fa(16));
const safName = data.subFactors.find((row) => row.code === 'SAF_OTH').name;
contains('ارزیابی.هشدار زیرعامل بدون جدول', supervisorText, safName);

/* --------------------------------- مرجع --------------------------------- */
assert('مرجع.۲۶ فرمول', document.querySelectorAll('#f-table tbody tr').length === 26);
assert('مرجع.۱۲ سند', document.querySelectorAll('#doc-table tbody tr').length === 12);
assert(
  'مرجع.چهار وضعیت اعتبار',
  document.querySelectorAll('#status-legend .chip').length === 4,
  String(document.querySelectorAll('#status-legend .chip').length),
);

/* ------------------------------ تب و ارقام ------------------------------ */
click('.tab[data-tab="eval"]');
assert('تب ارزیابی فعال شد', document.querySelector('#panel-eval').classList.contains('is-active'));
click('#digits-toggle');
assert('ارقام لاتین', text('#wage-results').includes(en(g20.dailyJobWage)), en(g20.dailyJobWage));
click('#digits-toggle');
assert('بازگشت به ارقام فارسی', text('#wage-results').includes(fa(g20.dailyJobWage)));

/* --------------------------------- نتیجه --------------------------------- */
const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.label}${check.ok ? '' : ` → ${check.detail}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} بررسی رابط کاربری موفق.`);
console.log(`خطاهای زمان اجرا: ${errors.length}`);
for (const error of errors) console.log(error?.stack ?? error);
if (failed.length > 0 || errors.length > 0) process.exitCode = 1;
