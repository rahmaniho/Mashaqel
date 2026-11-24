/**
 * آزمون دودی رابط کاربری وب‌اپ (بدون مرورگر واقعی).
 * صفحه web/index.html را با linkedom رندر می‌کند، app.js را اجرا می‌کند و
 * اعداد نمایش‌داده‌شده را با هسته محاسباتی مرورگر مقایسه می‌کند.
 * اجرا: npm run test:web-ui   (پیش‌نیاز: npm run export:web)
 */

import { existsSync, readFileSync } from 'node:fs';
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
  removeItem: (key) => store.delete(key),
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

const waitFor = async (predicate, timeout = 5000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
};

const fa = (value) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value);
const en = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const click = (selector) =>
  document.querySelector(selector).dispatchEvent(new window.Event('click', { bubbles: true }));
const selectOption = (select, value) => {
  const options = [...(select.options ?? [])];
  const match = options.find((option) => option.getAttribute('value') === String(value));
  for (const option of options) {
    option.selected = false;
    option.removeAttribute('selected');
  }
  if (match) {
    match.selected = true;
    match.setAttribute('selected', 'selected');
  }
};

const setSelect = (selector, value) => {
  const select = document.querySelector(selector);
  selectOption(select, value);
  select.dispatchEvent(new window.Event('change'));
};

const selectValueOf = (selector) => {
  const select = document.querySelector(selector);
  if (!select) return '';
  if (select.value) return select.value;
  const selected = select.querySelector?.('option[selected]');
  return selected?.getAttribute?.('value') ?? '';
};

const selectMulti = (selector, values) => {
  const select = document.querySelector(selector);
  const options = [...(select.options ?? [])];
  for (const option of options) {
    option.selected = false;
    option.removeAttribute('selected');
  }
  const matches = options.filter((option) => values.map(String).includes(option.getAttribute('value')));
  for (const option of matches) option.selected = true;
  /* linkedom تنها یک گزینه را selected نگه می‌دارد؛ نشانه‌گذاری صفتی پس از همه انتخاب‌ها انجام می‌شود */
  for (const option of matches) option.setAttribute('selected', 'selected');
  select.dispatchEvent(new window.Event('change'));
};

const checks = [];
const assert = (label, condition, detail = '') => checks.push({ label, ok: Boolean(condition), detail });
const contains = (label, haystack, needle) => assert(label, haystack.includes(needle), needle);

const setField = (id, value) => {
  const input = document.querySelector(`#${id}`);
  if (input.options) {
    selectOption(input, value);
    input.dispatchEvent(new window.Event('change'));
    return;
  }
  input.setAttribute('value', String(value));
  try {
    input.value = String(value);
  } catch {
    /* linkedom */
  }
};

const setTextArea = (id, value) => {
  const element = document.querySelector(`#${id}`);
  element.textContent = String(value);
  try {
    element.value = String(value);
  } catch {
    /* linkedom */
  }
};


/* ------------------------------ پوسته و مسیریابی ------------------------------ */

const navItems = [...document.querySelectorAll('.nav-item')];
assert('منوی کناری: ۱۳ بخش', navItems.length === 13, String(navItems.length));
assert('منوی کناری: ۱۳ آیتم در حالت اولیه', navItems.length === 13, String(navItems.length));
assert(
  'بخش «شناسنامه فرمول‌ها و اسناد قانونی» پنهان شده است',
  document.querySelector('#view-reference') === null && !document.body.innerHTML.includes('شناسنامه فرمول') && !document.body.innerHTML.includes('بانک قوانین'),
);
/* ------------------------ فاز ۱۰: راه‌اندازی امنیتی ------------------------ */

assert('SSO: دکمه ورود سازمانی در حالت محلی پنهان است', document.querySelector('#sso-row')?.hidden === true && document.querySelector('#sso-login') !== null);
assert('امنیت: صفحه راه‌اندازی اولیه', document.querySelector('#auth-gate')?.hidden === false && document.querySelector('#auth-setup')?.hidden === false);
assert('امنیت: ورود تا تکمیل راه‌اندازی مسدود است', document.querySelector('#auth-gate')?.hidden === false && document.querySelectorAll('.nav-item').length === 13);

setField('au-name', 'مدیر نمونه');
setField('au-username', 'admin');
setField('au-password', 'Admin@1405');
setField('au-password2', 'Admin@1405');
document.querySelector('#auth-setup').dispatchEvent(new window.Event('submit'));
const setupDone = await waitFor(() => document.querySelector('#auth-gate')?.hidden === true);
assert('امنیت: راه‌اندازی و ورود مدیر', setupDone);
assert('امنیت: منوی کامل برای مدیر', [...document.querySelectorAll('.nav-item')].filter((item) => !item.disabled).length === 13, String([...document.querySelectorAll('.nav-item')].filter((item) => !item.disabled).length));
contains('امنیت: نشان کاربر', text('#user-chip'), 'مدیر نمونه');
assert('کارت کاربر منو: نام', text('#sidebar-user-name') === 'مدیر نمونه', text('#sidebar-user-name'));
assert('کارت کاربر منو: نقش', text('#sidebar-user-role') === 'مدیر سامانه', text('#sidebar-user-role'));

const navFilter = document.querySelector('#nav-filter');
navFilter.value = 'حقوق';
navFilter.dispatchEvent(new window.Event('input'));
assert('جست‌وجوی منو: فیلتر ماژول', [...document.querySelectorAll('.nav-item')].filter((item) => !item.hidden).length === 1, String([...document.querySelectorAll('.nav-item')].filter((item) => !item.hidden).length));
navFilter.value = '';
navFilter.dispatchEvent(new window.Event('input'));
assert('جست‌وجوی منو: بازگشت به ۱۳ ماژول', [...document.querySelectorAll('.nav-item')].filter((item) => !item.hidden).length === 13, String([...document.querySelectorAll('.nav-item')].filter((item) => !item.hidden).length));

/* --------------------- کشوی منوی موبایل (رفع باگ «منو باز می‌ماند») --------------------- */

assert('کشو: پردهٔ تاریک وجود دارد', document.querySelector('#sidebar-scrim') !== null);
assert('کشو: در حالت اولیه بسته است', document.body.classList.contains('sidebar-open') === false && document.querySelector('#sidebar-scrim')?.hidden === true);
click('#menu-toggle');
assert(
  'کشو: باز شدن با کلید ☰',
  document.body.classList.contains('sidebar-open') &&
    document.querySelector('#sidebar-scrim')?.hidden === false &&
    document.querySelector('#menu-toggle')?.getAttribute('aria-expanded') === 'true',
);
click('.nav-item[data-route="guide"]');
assert(
  'کشو: پس از انتخاب «آموزش سامانه» بسته می‌شود',
  document.body.classList.contains('sidebar-open') === false && document.querySelector('#sidebar-scrim')?.hidden === true,
);
click('#menu-toggle');
const escapeEvent = new window.Event('keydown');
escapeEvent.key = 'Escape';
document.dispatchEvent(escapeEvent);
assert('کشو: بسته شدن با Esc', document.body.classList.contains('sidebar-open') === false);
click('#menu-toggle');
click('#sidebar-scrim');
assert('کشو: بسته شدن با لمس پرده', document.body.classList.contains('sidebar-open') === false);
click('#sidebar-close');
assert('کشو: بسته ماندن پس از دکمهٔ ✕', document.body.classList.contains('sidebar-open') === false);
click('.nav-item[data-route="dashboard"]');
assert('کشو: بازگشت به داشبورد پس از آزمون کشو', document.querySelector('#view-dashboard')?.classList.contains('is-active'));

/* --------------------- محافظ‌های چیدمان موبایل (قواعد CSS) --------------------- */

const webCss = readFileSync(resolve(root, 'web/style.css'), 'utf8');
assert('موبایل: ستون شبکهٔ راهنما مقید شده است', /\.guide-sections\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s.test(webCss));
assert('موبایل: فهرست گام‌های راهنما مقید شده است', /\.guide-steps\s*li[^{]*\{[^}]*overflow-wrap:\s*anywhere/s.test(webCss));
assert('موبایل: ورودی فایل از عرض کارت بیرون نمی‌زند', /input\[type='file'\]\s*\{[^}]*max-width:\s*100%/s.test(webCss));
assert('موبایل: نوار بالا در ارتفاع کم جمع می‌شود', /\.topbar-actions\s*\{[^}]*overflow-x:\s*auto/s.test(webCss));
assert('موبایل: متن ورودی‌ها ۱۶px است (بدون بزرگ‌نمایی iOS)', /font-size:\s*16px/.test(webCss));
assert('موبایل: اسکرول پس‌زمینه با کشوی باز قفل می‌شود', /body\.sidebar-open\s*\{[^}]*overflow:\s*hidden/s.test(webCss));

assert('داشبورد پیش‌فرض فعال است', document.querySelector('#view-dashboard')?.classList.contains('is-active'));

click('.nav-item[data-route="group"]');
assert('مسیریابی به گروه شغلی', document.querySelector('#view-group')?.classList.contains('is-active'));
assert('عنوان صفحه به‌روزرسانی شد', document.querySelector('#page-title')?.textContent === 'تعیین گروه شغلی');

click('.nav-item[data-route="dashboard"]');
assert('بازگشت به داشبورد', document.querySelector('#view-dashboard')?.classList.contains('is-active'));

/* ------------------------------ آموزش سامانه ------------------------------ */

const guideNav = document.querySelector('.nav-item[data-route="guide"]');
assert('آموزش: آیتم منو موجود و فعال', guideNav !== null && guideNav.disabled === false);
click('.nav-item[data-route="guide"]');
assert('آموزش: مسیریابی', document.querySelector('#view-guide')?.classList.contains('is-active'));
assert('آموزش: عنوان صفحه', document.querySelector('#page-title')?.textContent === 'آموزش سامانه', document.querySelector('#page-title')?.textContent);
assert('آموزش: ۱۹ بخش', document.querySelectorAll('#guide-sections .guide-section').length === 19, String(document.querySelectorAll('#guide-sections .guide-section').length));
assert('آموزش: فهرست موضوعی', document.querySelectorAll('#guide-toc .guide-chip').length === 19, String(document.querySelectorAll('#guide-toc .guide-chip').length));
assert('آموزش: هر بخش گام دارد', [...document.querySelectorAll('#guide-sections .guide-steps')].every((list) => list.querySelectorAll('li').length >= 4));
assert('آموزش: هر بخش خطاهای رایج دارد', [...document.querySelectorAll('#guide-sections .guide-errors')].every((list) => list.querySelectorAll('li').length >= 1));
assert('آموزش: تصویر واقعی برای هر بخش', document.querySelectorAll('#guide-sections .guide-figure').length === 19, String(document.querySelectorAll('#guide-sections .guide-figure').length));
assert('آموزش: هر بخش تصویر دارد', document.querySelectorAll('#guide-sections .guide-figure img').length === 19, String(document.querySelectorAll('#guide-sections .guide-figure img').length));
assert('آموزش: عنوان تصویرها', [...document.querySelectorAll('#guide-sections .guide-figure figcaption')].every((caption) => caption.textContent.includes('تصویر واقعی')));
assert('آموزش: متن جانشین توصیفی', [...document.querySelectorAll('#guide-sections .guide-figure img')].every((img) => (img.getAttribute('alt') ?? '').includes('تصویر واقعی صفحه')));
assert('آموزش: مسیر محلی تصویرها', [...document.querySelectorAll('#guide-sections .guide-figure img')].every((img) => /^\.\/assets\/guide\/[a-z-]+\.webp$/.test(img.getAttribute('src') ?? '')));
assert('آموزش: بدون منبع خارجی', [...document.querySelectorAll('#guide-sections .guide-figure img')].every((img) => !/^https?:/i.test(img.getAttribute('src') ?? '')));
{
  const sources = [...document.querySelectorAll('#guide-sections .guide-figure img')].map((img) => img.getAttribute('src'));
  assert('آموزش: تصویر یکتا برای هر بخش', new Set(sources).size === 19, String(new Set(sources).size));
  assert(
    'آموزش: فایل تصویرها موجود است',
    sources.every((src) => existsSync(resolve(root, 'web', (src ?? '').replace('./', '')))),
    sources.filter((src) => !existsSync(resolve(root, 'web', (src ?? '').replace('./', '')))).join(', '),
  );
}
contains('آموزش: اطلاعات نسخه', text('#guide-meta'), 'نسخه سامانه');
contains('آموزش: نقش کاربر', text('#guide-meta'), 'مدیر سامانه');
contains('آموزش: راهنمای چاپ', text('#view-guide'), 'چاپ راهنما');
contains('آموزش: موضوع حقوق', text('#view-guide'), 'محاسبات حقوق و دستمزد');
contains('آموزش: موضوع معوقات', text('#view-guide'), 'مابه‌التفاوت');
contains('آموزش: موضوع SSO', text('#view-guide'), 'ورود سازمانی');
contains('آموزش: محدودیت مالیات', text('#view-guide'), 'پلکان مالیات ۱۴۰۵');

const setGuideSearch = (value) => {
  const input = document.querySelector('#guide-search');
  input.setAttribute('value', value);
  try {
    input.value = value;
  } catch {
    /* linkedom */
  }
  input.dispatchEvent(new window.Event('input'));
};

setGuideSearch('کد ملی');
assert('آموزش: جستجو نتیجه را محدود می‌کند', document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length < 19 && document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length >= 1, String(document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length));
contains('آموزش: شمارش جستجو', text('#guide-count'), 'مطابقت دارد');
setGuideSearch('واژه‌ای که وجود ندارد');
assert('آموزش: جستجوی بی‌نتیجه', document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length === 0, String(document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length));
setGuideSearch('');
assert('آموزش: بازگشت همه بخش‌ها', document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length === 19, String(document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length));

setGuideSearch('چاپ');
click('#guide-print');
contains('آموزش: چاپ عمودی', document.querySelector('#print-page-style')?.textContent ?? '', 'portrait');
assert('آموزش: پاک‌سازی فیلتر هنگام چاپ', selectValueOf('#guide-search') === '', selectValueOf('#guide-search'));
assert('آموزش: نمایش همه بخش‌ها پس از چاپ', document.querySelectorAll('#guide-sections .guide-section:not([hidden])').length === 19);

click('.nav-item[data-route="dashboard"]');

/* --------------------------------- داشبورد --------------------------------- */

assert('داشبورد: ۴ کارت شاخص', document.querySelectorAll('#kpi-grid .kpi').length === 4);
assert('داشبورد: نمودار مزد', document.querySelectorAll('#wage-chart svg rect.bar').length === 20, String(document.querySelectorAll('#wage-chart svg rect.bar').length));
assert('داشبورد: نمودار سنوات', document.querySelector('#seniority-chart svg path.line-path') !== null);
assert('داشبورد: فهرست محدودیت‌ها', document.querySelectorAll('#limitations li').length === 4);
contains('داشبورد: مزد گروه ۱', text('#kpi-grid'), fa(core.MIN_DAILY_1405));

/* -------------------------------- کارگاه‌ها -------------------------------- */

click('.nav-item[data-route="workshops"]');
assert('مسیریابی به کارگاه‌ها', document.querySelector('#view-workshops')?.classList.contains('is-active'));
assert('جدول کارگاه‌ها خالی است', text('#workshop-table').includes('هنوز کارگاهی ثبت نشده'));


const setInput = (id, value) => {
  const input = document.querySelector(`#${id}`);
  input.setAttribute('value', String(value));
  try {
    input.value = String(value);
  } catch {
    /* linkedom */
  }
  input.dispatchEvent(new window.Event('input'));
};

const submitWorkshop = (values) => {
  for (const [id, value] of Object.entries(values)) setField(id, value);
  document.querySelector('#workshop-form').dispatchEvent(new window.Event('submit'));
};

submitWorkshop({
  'wf-company': 'شرکت نمونه صنعت',
  'wf-name': 'کارگاه شماره یک',
  'wf-code': 'WS-1001',
  'wf-national': '10101234567',
  'wf-employees': 120,
  'wf-manager': 'مهندس نمونه',
  'wf-established': '1398-04-01',
  'wf-scheme': 'IN_PROGRESS',
});
await new Promise((resolve) => setTimeout(resolve, 20));

assert('ثبت کارگاه: یک ردیف', document.querySelectorAll('#workshop-table tbody tr').length === 1, String(document.querySelectorAll('#workshop-table tbody tr').length));
assert('ثبت کارگاه: نام در جدول', text('#workshop-table').includes('کارگاه شماره یک'));
assert('انتخابگر کارگاه: ۲ گزینه', document.querySelectorAll('#active-workshop option').length === 2);
assert('کارگاه فعال روی داشبورد', text('#kpi-grid').includes('کارگاه شماره یک'));
assert('ذخیره‌سازی محلی کارگاه', (localStorage.getItem('mashaqel.state.v2') ?? '').includes('WS-1001'));

submitWorkshop({
  'wf-company': 'شرکت دوم',
  'wf-name': 'کارگاه تکراری',
  'wf-code': 'WS-1001',
});
assert('اعتبارسنجی: کد تکراری رد شد', text('#workshop-error').includes('قبلاً ثبت شده'), text('#workshop-error'));
assert('اعتبارسنجی: کارگاه دوم ثبت نشد', document.querySelectorAll('#workshop-table tbody tr').length === 1);
click('#workshop-cancel');


/* -------------------------------- بانک مشاغل -------------------------------- */

click('.nav-item[data-route="jobs"]');
assert('مسیریابی به بانک مشاغل', document.querySelector('#view-jobs')?.classList.contains('is-active'));
assert('بانک مشاغل: پیام خالی', text('#jobs-table').includes('هنوز شغلی ثبت نشده'));

const submitJob = (values) => {
  for (const [id, value] of Object.entries(values)) setField(id, value);
  document.querySelector('#job-form').dispatchEvent(new window.Event('submit'));
};

submitJob({
  'jf-code': 'J-1001',
  'jf-title': 'جوشکار تأسیسات',
  'jf-title-en': 'Welder',
  'jf-unit': 'تولید — مونتاژ',
  'jf-headcount': 4,
  'jf-objective': 'اتصال قطعات فلزی مطابق نقشه و استاندارد جوش',
  'jf-duties': 'جوشکاری قطعات بر اساس نقشه\nبازرسی بصری درز جوش',
  'jf-responsibilities': 'کیفیت اتصال و رعایت ایمنی',
  'jf-education': 'دیپلم',
  'jf-experience': 2,
});
await new Promise((resolve) => setTimeout(resolve, 20));

assert('ثبت شغل: یک ردیف', document.querySelectorAll('#jobs-table tbody tr').length === 1, String(document.querySelectorAll('#jobs-table tbody tr').length));
assert('ثبت شغل: عنوان در جدول', text('#jobs-table').includes('جوشکار تأسیسات'));
assert('ثبت شغل: شمارنده', text('#jobs-count').includes('۱ شغل'), text('#jobs-count'));
assert('ذخیره‌سازی شغل', (localStorage.getItem('mashaqel.state.v2') ?? '').includes('J-1001'));
assert('نشان منو: شمارش بانک مشاغل', text('.nav-badge[data-badge="jobs"]') === fa(1), text('.nav-badge[data-badge="jobs"]'));
assert(
  'نشان منو: شغل در انتظار ارزیابی',
  document.querySelector('.nav-badge[data-badge="evaluation"]')?.hidden === false &&
    text('.nav-badge[data-badge="evaluation"]') === fa(1),
  text('.nav-badge[data-badge="evaluation"]'),
);
assert('فیلتر واحد سازمانی', (document.querySelector('#jobs-filter-unit')?.innerHTML ?? '').includes('تولید — مونتاژ'));

submitJob({
  'jf-code': 'J-1001',
  'jf-title': 'شغل تکراری',
  'jf-unit': 'تولید',
  'jf-objective': 'نمونه',
  'jf-duties': 'نمونه',
});
assert('اعتبارسنجی شغل: کد تکراری رد شد', text('#job-error').includes('قبلاً ثبت شده'), text('#job-error'));
assert('اعتبارسنجی شغل: شغل دوم ثبت نشد', document.querySelectorAll('#jobs-table tbody tr').length === 1);
click('#job-cancel-2');

click('#jobs-table button[data-action="copy"]');
assert('تکثیر شغل', document.querySelectorAll('#jobs-table tbody tr').length === 2, String(document.querySelectorAll('#jobs-table tbody tr').length));
assert('کد شغل تکثیرشده', text('#jobs-table').includes('J-1001-2'));

click('#jobs-table button[data-action="edit"]');
setField('jf-title', 'جوشکار تأسیسات (ویرایش‌شده)');
document.querySelector('#job-form').dispatchEvent(new window.Event('submit'));
assert('ویرایش شغل', text('#jobs-table').includes('ویرایش‌شده'));

click('#jobs-table button[data-action="profile"]');
assert('شناسنامه شغل باز شد', document.querySelector('#view-job-profile')?.classList.contains('is-active'));
for (const section of ['مشخصات عمومی', 'هدف شغل', 'شرح وظایف', 'مسئولیت‌ها', 'اختیارات', 'ارتباطات سازمانی', 'شرایط احراز', 'مهارت‌ها', 'شرایط محیط کار', 'عوامل ارزیابی', 'امتیازات', 'گروه شغلی', 'تأیید کارشناسی']) {
  contains(`شناسنامه: بخش ${section}`, text('#job-profile-body'), section);
}
contains('شناسنامه: متن هدف شغل', text('#job-profile-body'), 'اتصال قطعات فلزی');
assert('شناسنامه: ۱۳ بخش', document.querySelectorAll('#job-profile-body .profile-section').length === 13, String(document.querySelectorAll('#job-profile-body .profile-section').length));
assert('شناسنامه: دکمه چاپ', document.querySelector('#profile-print') !== null);
click('#profile-back');
assert('بازگشت به بانک مشاغل', document.querySelector('#view-jobs')?.classList.contains('is-active'));

/* ------------------------- تفکیک داده بین کارگاه‌ها ------------------------- */

click('.nav-item[data-route="workshops"]');
submitWorkshop({ 'wf-company': 'شرکت دوم', 'wf-name': 'کارگاه دوم', 'wf-code': 'WS-2002' });
await new Promise((resolve) => setTimeout(resolve, 20));
const secondWorkshopId = JSON.parse(localStorage.getItem('mashaqel.state.v2')).workshops[1].id;
setSelect('#active-workshop', secondWorkshopId);
click('.nav-item[data-route="jobs"]');
assert('تفکیک کارگاهی: کارگاه دوم بدون شغل', text('#jobs-table').includes('هنوز شغلی ثبت نشده'), text('#jobs-table'));
const firstWorkshopId = JSON.parse(localStorage.getItem('mashaqel.state.v2')).workshops[0].id;
setSelect('#active-workshop', firstWorkshopId);
assert('بازگشت به کارگاه اول: شغل موجود', text('#jobs-table').includes('J-1001'));

/* --------------------- اتصال ارزیابی به شناسنامه شغل --------------------- */

click('.nav-item[data-route="evaluation"]');
const storedJobId = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs[0].id;
setField('e-job', storedJobId);
click('#e-calc');
click('#eval-save');
assert('ثبت ارزیابی در شغل', text('#eval-save-msg').includes('ثبت شد'), text('#eval-save-msg'));
const savedJob = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.id === storedJobId);
assert('ارزیابی ذخیره‌شده: امتیاز ۳۲۳', savedJob?.evaluation?.totalScore === 323, String(savedJob?.evaluation?.totalScore));
assert('ارزیابی ذخیره‌شده: گروه ۱۲', savedJob?.evaluation?.proposedGroup === 12, String(savedJob?.evaluation?.proposedGroup));
assert('نشان منو: دو شغل ثبت‌شده', text('.nav-badge[data-badge="jobs"]') === fa(2), text('.nav-badge[data-badge="jobs"]'));
assert(
  'نشان منو: یک شغل هنوز ارزیابی نشده',
  document.querySelector('.nav-badge[data-badge="evaluation"]')?.hidden === false &&
    text('.nav-badge[data-badge="evaluation"]') === fa(1),
  text('.nav-badge[data-badge="evaluation"]'),
);

click('.nav-item[data-route="jobs"]');
const firstJobRow = [...document.querySelectorAll('#jobs-table tbody tr')][0]?.textContent?.replace(/\s+/g, ' ') ?? '';
assert('نمایش امتیاز در جدول مشاغل', firstJobRow.includes(fa(323)), firstJobRow);
assert('نمایش گروه در جدول مشاغل', firstJobRow.includes(fa(12)), firstJobRow);

setInput('jobs-search', 'J-1001-2');
assert('جستجوی شغل', document.querySelectorAll('#jobs-table tbody tr').length === 1, String(document.querySelectorAll('#jobs-table tbody tr').length));
setInput('jobs-search', 'شغل ناموجود');
assert('جستجوی بدون نتیجه', text('#jobs-table').includes('یافت نشد'));
setInput('jobs-search', '');

click('#jobs-table button[data-action="delete"]');
assert('حذف شغل', document.querySelectorAll('#jobs-table tbody tr').length === 1, String(document.querySelectorAll('#jobs-table tbody tr').length));


/* ------------------- فاز ۵: تأیید کارشناسی و گروه نهایی ------------------- */

click('.nav-item[data-route="jobs"]');
click('#job-new');
submitJob({
  'jf-code': 'J-2001',
  'jf-title': 'کارشناس ایمنی و بهداشت',
  'jf-unit': 'HSE',
  'jf-objective': 'حفاظت نیروی انسانی و پیشگیری از حوادث',
  'jf-duties': 'بازرسی روزانه کارگاه\nتدوین دستورالعمل ایمنی',
  'jf-education': 'کارشناسی',
});
await new Promise((resolve) => setTimeout(resolve, 20));

const targetJob = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('فاز ۵: شغل هدف ساخته شد', Boolean(targetJob), 'J-2001');

click('.nav-item[data-route="evaluation"]');
setField('e-job', targetJob.id);
click('#e-calc');
click('#eval-save');
const evaluatedTarget = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('فاز ۵: ارزیابی شغل هدف ثبت شد', evaluatedTarget?.evaluation?.totalScore === 323, String(evaluatedTarget?.evaluation?.totalScore));

const openJobProfileRow = (code) => {
  const row = [...document.querySelectorAll('#jobs-table tbody tr')].find((item) => item.textContent.includes(code));
  row?.querySelector('button[data-action="profile"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
};

click('.nav-item[data-route="jobs"]');
openJobProfileRow('J-2001');
const approvalText = text('#job-profile-body');
contains('تأیید: وضعیت اولیه در انتظار', approvalText, 'در انتظار تأیید کمیته');
assert('تأیید: فرم ثبت وجود دارد', document.querySelector('#approval-save') !== null);

setField('approval-status', 'COMMITTEE_APPROVED');
click('#approval-save');
assert('تأیید: الزام نام کارشناس', text('#approval-msg').includes('نام کارشناس'), text('#approval-msg'));

setField('approval-expert', 'کارشناس نمونه');
setField('approval-ref', '1405-COMM-12');
click('#approval-save');
assert('تأیید: الزام گروه نهایی', text('#approval-msg').includes('گروه نهایی'), text('#approval-msg'));

setField('approval-final-group', '13');
click('#approval-save');
assert('تأیید: الزام دلیل تغییر گروه', text('#approval-msg').includes('دلیل تغییر'), text('#approval-msg'));

setTextArea('approval-reason', 'پیچیدگی وظایف و شرایط احراز بالاتر از پیشنهاد');
click('#approval-save');
assert('تأیید: پیام موفقیت', text('#approval-msg').includes('ثبت شد'), text('#approval-msg'));

const approvedJob = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('تأیید: وضعیت کمیته', approvedJob?.evaluation?.approval?.status === 'COMMITTEE_APPROVED', String(approvedJob?.evaluation?.approval?.status));
assert('تأیید: گروه نهایی ۱۳', approvedJob?.evaluation?.approval?.finalGroup === 13, String(approvedJob?.evaluation?.approval?.finalGroup));
assert('تأیید: نام کارشناس ذخیره شد', approvedJob?.evaluation?.approval?.expertName === 'کارشناس نمونه', String(approvedJob?.evaluation?.approval?.expertName));
assert('تأیید: شماره صورت‌جلسه ذخیره شد', approvedJob?.evaluation?.approval?.committeeRef === '1405-COMM-12', String(approvedJob?.evaluation?.approval?.committeeRef));
assert('تأیید: تاریخچه تصمیم‌ها', (approvedJob?.evaluation?.approval?.history ?? []).length >= 2, String(approvedJob?.evaluation?.approval?.history?.length));

const profileAfterApproval = text('#job-profile-body');
contains('شناسنامه: وضعیت تأییدشده', profileAfterApproval, 'تأیید کمیته');
contains('شناسنامه: گروه نهایی', profileAfterApproval, 'گروه نهایی مصوب');
contains('شناسنامه: اختلاف گروه', profileAfterApproval, '+۱');
contains('شناسنامه: دلیل تغییر', profileAfterApproval, 'شرایط احراز بالاتر');

click('#profile-back');
const approvedRow = [...document.querySelectorAll('#jobs-table tbody tr')].find((item) => item.textContent.includes('J-2001'));
const approvedRowText = approvedRow?.textContent?.replace(/\s+/g, ' ') ?? '';
assert('جدول مشاغل: گروه نهایی', approvedRowText.includes(fa(13)), approvedRowText);
assert('جدول مشاغل: وضعیت تأیید', approvedRowText.includes('تأیید کمیته'), approvedRowText);

click('.nav-item[data-route="group"]');
const compareText = text('#group-jobs-table');
contains('مقایسه گروه: ردیف شغل', compareText, 'J-2001');
contains('مقایسه گروه: گروه نهایی', compareText, fa(13));
contains('مقایسه گروه: کارشناس', compareText, 'کارشناس نمونه');
assert('مقایسه گروه: تعداد', text('#group-jobs-note').includes('۱ شغل'), text('#group-jobs-note'));

click('.nav-item[data-route="jobs"]');
openJobProfileRow('J-2001');
click('#approval-reopen');
const reopened = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('بازگشت به در انتظار تأیید', reopened?.evaluation?.approval?.status === 'PENDING_COMMITTEE_APPROVAL', String(reopened?.evaluation?.approval?.status));
assert('بازگشت: گروه نهایی پاک شد', reopened?.evaluation?.approval?.finalGroup === null, String(reopened?.evaluation?.approval?.finalGroup));

setField('approval-status', 'REJECTED');
setField('approval-expert', 'کارشناس نمونه');
click('#approval-save');
assert('رد: الزام دلیل', text('#approval-msg').includes('دلیل رد'), text('#approval-msg'));
setTextArea('approval-reason', 'مغایرت شرح وظایف با شرح مصوب کارگاه');
click('#approval-save');
const rejected = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('رد: وضعیت ثبت شد', rejected?.evaluation?.approval?.status === 'REJECTED', String(rejected?.evaluation?.approval?.status));
assert('رد: گروه نهایی خالی', rejected?.evaluation?.approval?.finalGroup === null, String(rejected?.evaluation?.approval?.finalGroup));
contains('شناسنامه: نمایش رد', text('#job-profile-body'), 'رد شده');
click('#profile-back');


/* --------------------------- فاز ۶: ساختار سازمانی --------------------------- */

const orgNav = document.querySelector('.nav-item[data-route="org"]');
assert('ساختار سازمانی: آیتم منو فعال شد', orgNav?.disabled === false && orgNav?.querySelector('.nav-badge') === null);

click('.nav-item[data-route="org"]');
assert('مسیریابی به ساختار سازمانی', document.querySelector('#view-org')?.classList.contains('is-active'));
assert('ساختار سازمانی: عنوان صفحه', document.querySelector('#page-title')?.textContent === 'ساختار سازمانی');
assert('ساختار سازمانی: حالت خالی', text('#org-tree').includes('هنوز واحدی تعریف نشده'));

const submitUnit = (values) => {
  for (const [id, value] of Object.entries(values)) setField(id, value);
  document.querySelector('#org-form').dispatchEvent(new window.Event('submit'));
};
const unitsStore = () => JSON.parse(localStorage.getItem('mashaqel.state.v2')).units ?? [];
const unitByCode = (code) => unitsStore().find((unit) => unit.code === code);

click('#org-new');
submitUnit({
  'of-code': '1000',
  'of-title': 'مدیریت عامل',
  'of-type': 'STAFF',
  'of-manager': 'علی رضایی',
  'of-headcount': 5,
  'of-location': 'ساختمان مرکزی',
});
assert('واحد ریشه ثبت شد', unitsStore().length === 1, String(unitsStore().length));
const rootUnit = unitByCode('1000');
assert('واحد ریشه: سطح ۱', rootUnit && document.querySelectorAll('#org-tree tbody tr').length === 1);
contains('واحد ریشه در درخت', text('#org-tree'), 'مدیریت عامل');

click('#org-new');
submitUnit({ 'of-code': '1100', 'of-title': 'مدیریت تولید', 'of-parent': rootUnit.id, 'of-type': 'PRODUCTION', 'of-headcount': 40 });
click('#org-new');
const productionUnit = unitByCode('1100');
submitUnit({ 'of-code': '1110', 'of-title': 'خط مونتاژ', 'of-parent': productionUnit.id, 'of-type': 'LINE', 'of-headcount': 25 });
assert('سه واحد ثبت شد', unitsStore().length === 3, String(unitsStore().length));
const assemblyUnit = unitByCode('1110');
assert('سطح واحد سوم: ۳', document.querySelectorAll('#org-tree tbody tr').length === 3 && text('#org-tree').includes('└'), text('#org-tree').slice(0, 60));
contains('نمایش مسیر واحد در درخت', text('#org-tree'), 'مدیریت عامل ← مدیریت تولید ← خط مونتاژ');
assert('شاخص عمق درخت', text('#org-kpis').includes('۳ سطح'), text('#org-kpis'));

click('#org-new');
submitUnit({ 'of-code': '1100', 'of-title': 'واحد تکراری' });
assert('اعتبارسنجی: کد واحد تکراری', text('#org-error').includes('قبلاً'), text('#org-error'));
assert('اعتبارسنجی: واحد تکراری ثبت نشد', unitsStore().length === 3, String(unitsStore().length));

setField('of-code', 'a b');
setField('of-title', 'کد نامعتبر');
document.querySelector('#org-form').dispatchEvent(new window.Event('submit'));
assert('اعتبارسنجی: الگوی کد واحد', text('#org-error').includes('کد واحد'), text('#org-error'));
click('#org-cancel');

/* جلوگیری از حلقه: ویرایش ریشه و انتخاب نواده به‌عنوان بالادست */
click('#org-tree button[data-action="edit"]');
const parentSelectValues = [...document.querySelectorAll('#of-parent option')].map((option) => option.getAttribute('value'));
assert('گزینه‌های بالادست: خود و زیرمجموعه‌ها حذف شدند', !parentSelectValues.includes(rootUnit.id) && !parentSelectValues.includes(assemblyUnit.id), parentSelectValues.join(','));
/* حتی اگر مقدار نامعتبر به‌زور تزریق شود، اعتبارسنجی حلقه باید جلوی ثبت را بگیرد */
const parentSelect = document.querySelector('#of-parent');
const forcedOption = document.createElement('option');
forcedOption.setAttribute('value', assemblyUnit.id);
parentSelect.appendChild(forcedOption);
selectOption(parentSelect, assemblyUnit.id);
parentSelect.dispatchEvent(new window.Event('change'));
document.querySelector('#org-form').dispatchEvent(new window.Event('submit'));
assert('اعتبارسنجی: حلقه سازمانی رد شد', text('#org-error').includes('حلقه'), text('#org-error'));
const rootAfterCycle = unitByCode('1000');
assert('اعتبارسنجی: ساختار بدون تغییر ماند', rootAfterCycle?.parentId === null, String(rootAfterCycle?.parentId));
click('#org-cancel');

/* حذف محافظت‌شده: واحد دارای زیرمجموعه */
click('#org-tree button[data-action="delete"]');
contains('حذف محافظت‌شده: زیرمجموعه', text('#org-error'), 'زیرمجموعه');
assert('حذف محافظت‌شده: واحدی حذف نشد', unitsStore().length === 3, String(unitsStore().length));

/* اتصال شغل به واحد سازمانی */
click('.nav-item[data-route="jobs"]');
const jobRowForUnit = [...document.querySelectorAll('#jobs-table tbody tr')].find((row) => row.textContent.includes('J-2001'));
jobRowForUnit?.querySelector('button[data-action="edit"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
setSelect('#jf-unit-link', assemblyUnit.id);
document.querySelector('#job-form').dispatchEvent(new window.Event('submit'));
const linkedJob = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs.find((job) => job.jobCode === 'J-2001');
assert('اتصال شغل به واحد', linkedJob?.unitId === assemblyUnit.id, String(linkedJob?.unitId));
assert('جای‌گذاری نام واحد از درخت', linkedJob?.orgUnit === 'خط مونتاژ', String(linkedJob?.orgUnit));

click('.nav-item[data-route="org"]');
contains('جدول مشاغل واحد', text('#org-jobs-table'), 'J-2001');
assert('شاخص مشاغل متصل', text('#org-kpis').includes('۱ از ۲'), text('#org-kpis'));

/* حذف محافظت‌شده: واحد دارای شغل متصل */
const assemblyRow = [...document.querySelectorAll('#org-tree tbody tr')].find((row) => row.textContent.includes('خط مونتاژ'));
assemblyRow?.querySelector('button[data-action="delete"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
contains('حذف محافظت‌شده: شغل متصل', text('#org-error'), 'شغل متصل');
assert('حذف محافظت‌شده: واحد دارای شغل باقی ماند', unitsStore().length === 3, String(unitsStore().length));

/* حذف برگ مجاز و پایداری داده */
const leafUnit = unitByCode('1110');
assert('حذف برگ مسدود است تا شغل جدا شود', Boolean(leafUnit));

assert('پایداری واحدها در ذخیره‌سازی', (JSON.parse(localStorage.getItem('mashaqel.state.v2')).units ?? []).length === 3);
assert('چاپ درخت موجود است', document.querySelector('#org-print') !== null);


/* --------------------------- فاز ۷: مدیریت کارکنان --------------------------- */

const empNav = document.querySelector('.nav-item[data-route="employees"]');
assert('مدیریت کارکنان: آیتم منو فعال شد', empNav?.disabled === false && empNav?.querySelector('.nav-badge') === null);

click('.nav-item[data-route="employees"]');
assert('مسیریابی به کارکنان', document.querySelector('#view-employees')?.classList.contains('is-active'));
assert('کارکنان: حالت خالی', text('#emp-table').includes('هنوز کارمندی ثبت نشده'));

const employeesStore = () => JSON.parse(localStorage.getItem('mashaqel.state.v2')).employees ?? [];
const employeeByCode = (code) => employeesStore().find((employee) => employee.personnelCode === code);
const submitEmployee = (values) => {
  for (const [id, value] of Object.entries(values)) setField(id, value);
  document.querySelector('#employee-form').dispatchEvent(new window.Event('submit'));
};

click('#emp-new');
setSelect('#ef-unit', assemblyUnit.id);
setSelect('#ef-job', linkedJob.id);
assert('کارکنان: پیشنهاد خودکار گروه از شغل', selectValueOf('#ef-group') === '12', String(selectValueOf('#ef-group')));
submitEmployee({
  'ef-code': 'EMP-1001',
  'ef-first': 'مریم',
  'ef-last': 'احمدی',
  'ef-national': '0012345678',
  'ef-birth': '1370-05-12',
  'ef-contract': 'PERMANENT',
  'ef-hire': '1398-04-01',
  'ef-service': 7,
  'ef-status': 'ACTIVE',
  'ef-wage': 6000000,
  'ef-acc': 200000,
});

assert('کارکنان: یک پرونده ثبت شد', employeesStore().length === 1, String(employeesStore().length));
const firstEmployee = employeeByCode('EMP-1001');
assert('کارکنان: واحد سازمانی ذخیره شد', firstEmployee?.unitId === assemblyUnit.id, String(firstEmployee?.unitId));
assert('کارکنان: شغل ذخیره شد', firstEmployee?.jobId === linkedJob.id, String(firstEmployee?.jobId));
assert('کارکنان: گروه ۱۲ ذخیره شد', firstEmployee?.group === 12, String(firstEmployee?.group));
assert('کارکنان: سابقه ۷ سال', firstEmployee?.priorServiceYears === 7, String(firstEmployee?.priorServiceYears));

click('#emp-new');
submitEmployee({ 'ef-code': 'EMP-1001', 'ef-first': 'تکراری', 'ef-last': 'کارمند', 'ef-hire': '1400-01-01' });
assert('کارکنان: کد پرسنلی تکراری رد شد', text('#emp-error').includes('قبلاً'), text('#emp-error'));
assert('کارکنان: پرونده تکراری ثبت نشد', employeesStore().length === 1, String(employeesStore().length));

setField('ef-code', 'EMP-9999');
setField('ef-national', '12345');
document.querySelector('#employee-form').dispatchEvent(new window.Event('submit'));
assert('کارکنان: کد ملی نامعتبر رد شد', text('#emp-error').includes('کد ملی'), text('#emp-error'));
setField('ef-national', '0012345678');
setField('ef-first', 'کارمند');
setField('ef-last', 'تکراری');
setField('ef-hire', '1400-01-01');
document.querySelector('#employee-form').dispatchEvent(new window.Event('submit'));
contains('کارکنان: کد ملی تکراری رد شد', text('#emp-error'), 'کد ملی');
assert('کارکنان: پرونده با کد ملی تکراری ثبت نشد', employeesStore().length === 1, String(employeesStore().length));
setField('ef-hire', '1400/13/40');
document.querySelector('#employee-form').dispatchEvent(new window.Event('submit'));
assert('کارکنان: تاریخ استخدام نامعتبر رد شد', text('#emp-error').includes('تاریخ استخدام'), text('#emp-error'));
setField('ef-hire', '1400-01-01');
setField('ef-first', 'رضا');
setField('ef-last', 'کریمی');
setField('ef-national', '0012345670');
document.querySelector('#employee-form').dispatchEvent(new window.Event('submit'));
assert('کارکنان: پرونده دوم ثبت شد', employeesStore().length === 2, String(employeesStore().length));

const firstRow = [...document.querySelectorAll('#emp-table tbody tr')].find((row) => row.textContent.includes('EMP-1001'));
assert('جدول کارکنان: نام', firstRow?.textContent?.includes('مریم احمدی'), firstRow?.textContent?.slice(0, 40));
assert('جدول کارکنان: واحد', firstRow?.textContent?.includes('خط مونتاژ'), firstRow?.textContent?.slice(0, 60));
assert('جدول کارکنان: وضعیت', firstRow?.textContent?.includes('فعال'), firstRow?.textContent?.slice(0, 60));
assert('شاخص کارکنان', text('#emp-kpis').includes('کل کارکنان'), text('#emp-kpis'));

setSelect('#emp-filter-unit', assemblyUnit.id);
assert('فیلتر واحد: یک نفر', document.querySelectorAll('#emp-table tbody tr').length === 1, String(document.querySelectorAll('#emp-table tbody tr').length));
setSelect('#emp-filter-unit', 'NONE');
assert('فیلتر بدون واحد: یک نفر', document.querySelectorAll('#emp-table tbody tr').length === 1, String(document.querySelectorAll('#emp-table tbody tr').length));
setSelect('#emp-filter-unit', '');
setSelect('#emp-filter-status', 'TERMINATED');
assert('فیلتر وضعیت: بدون نتیجه', text('#emp-table').includes('یافت نشد'), text('#emp-table').slice(0, 60));
setSelect('#emp-filter-status', '');

/* حفاظت از حذف شغل دارای کارمند */
click('.nav-item[data-route="jobs"]');
const jobsBeforeGuard = document.querySelectorAll('#jobs-table tbody tr').length;
const linkedJobRow = [...document.querySelectorAll('#jobs-table tbody tr')].find((row) => row.textContent.includes(linkedJob.jobCode));
linkedJobRow?.querySelector('button[data-action="delete"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('حذف شغل: شغل دارای کارمند حذف نشد', document.querySelectorAll('#jobs-table tbody tr').length === jobsBeforeGuard, String(document.querySelectorAll('#jobs-table tbody tr').length));
contains('حذف شغل: پیام اتصال کارمند', text('#toast'), 'کارمند به این شغل متصل است');
click('.nav-item[data-route="employees"]');
setInput('emp-search', 'کریمی');
assert('جستجوی کارمند', document.querySelectorAll('#emp-table tbody tr').length === 1, String(document.querySelectorAll('#emp-table tbody tr').length));
setInput('emp-search', '');

/* پرونده و تاریخچه ارتقا */
const profileButton = [...document.querySelectorAll('#emp-table tbody tr')]
  .find((row) => row.textContent.includes('EMP-1001'))
  ?.querySelector('button[data-action="profile"]');
profileButton?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('پرونده کارمند باز شد', document.querySelector('#emp-profile')?.hidden === false);
contains('پرونده: نام', text('#emp-profile-body'), 'مریم احمدی');
contains('پرونده: بدون تاریخچه', text('#emp-profile-body'), 'هنوز تغییری ثبت نشده');

setField('promo-date', '1405-04-01');
setSelect('#promo-group', '14');
click('#promo-save');
assert('ارتقا: الزام دلیل', text('#promo-msg').includes('دلیل'), text('#promo-msg'));
setField('promo-reason', 'ارتقا مطابق صورت‌جلسه ۱۴۰۵/۱۲');
click('#promo-save');
const promotedEmployee = employeeByCode('EMP-1001');
assert('ارتقا: گروه ۱۴ شد', promotedEmployee?.group === 14, String(promotedEmployee?.group));
assert('ارتقا: تاریخچه ثبت شد', (promotedEmployee?.jobChanges ?? []).length === 1, String(promotedEmployee?.jobChanges?.length));
contains('ارتقا: نمایش در تاریخچه', text('#emp-profile-body'), 'ارتقا مطابق صورت‌جلسه');
assert('ارتقا: گروه قبلی در تاریخچه', text('#emp-profile-body').includes(fa(12)), '۱۲');

setField('promo-reason', 'بدون تغییر');
click('#promo-save');
assert('ارتقا: تغییر یکسان رد شد', text('#promo-msg').includes('یکسان'), text('#promo-msg'));

/* ورود گروهی CSV */
click('#emp-import-toggle');
const csv = [
  'personnelCode,firstName,lastName,unitCode,jobCode,group,contractType,hireDate,priorServiceYears,status',
  'EMP-2001,سعید,نوری,1110,J-2001,10,TEMPORARY,1402-02-01,3,ACTIVE',
  'EMP-1001,تکراری,ردیف,1110,J-2001,10,TEMPORARY,1402-02-01,3,ACTIVE',
  'EMP-2002,زهرا,موسوی,,,12,دائم,1401-06-15,4,فعال',
].join('\n');
setTextArea('emp-import-text', csv);
click('#emp-import-run');
assert('ورود گروهی: یک نفر افزوده شد', employeesStore().length === 4, String(employeesStore().length));
contains('ورود گروهی: پیام', text('#emp-import-msg'), 'افزوده شد');
contains('ورود گروهی: ردیف تکراری', text('#emp-import-msg'), 'تکراری');
const importedEmployee = employeeByCode('EMP-2001');
assert('ورود گروهی: کد واحد به واحد تبدیل شد', importedEmployee?.unitId === assemblyUnit.id, String(importedEmployee?.unitId));
assert('ورود گروهی: نوع قرارداد', importedEmployee?.contractType === 'TEMPORARY', String(importedEmployee?.contractType));
const importedPersian = employeeByCode('EMP-2002');
assert('ورود گروهی: مقادیر فارسی', importedPersian?.contractType === 'PERMANENT' && importedPersian?.status === 'ACTIVE', `${importedPersian?.contractType}/${importedPersian?.status}`);
click('#emp-import-cancel');

/* خروجی CSV و بارگذاری در ماشین‌حساب */
let exportOk = true;
try {
  click('#emp-export');
} catch {
  exportOk = false;
}
assert('خروجی CSV بدون خطا', exportOk);

const calcButton = [...document.querySelectorAll('#emp-table tbody tr')]
  .find((row) => row.textContent.includes('EMP-1001'))
  ?.querySelector('button[data-action="calc"]');
calcButton?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('بارگذاری مزد: رفتن به حقوق', document.querySelector('#view-payroll')?.classList.contains('is-active'));
assert('بارگذاری مزد: گروه کارمند', selectValueOf('#w-group') === '14', String(selectValueOf('#w-group')));
assert('بارگذاری مزد: سابقه کارمند', String(document.querySelector('#w-service')?.value) === '7', String(document.querySelector('#w-service')?.value));

click('.nav-item[data-route="employees"]');
const deleteTarget = [...document.querySelectorAll('#emp-table tbody tr')].find((row) => row.textContent.includes('EMP-2002'));
deleteTarget?.querySelector('button[data-action="delete"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('حذف کارمند', employeesStore().length === 3, String(employeesStore().length));


/* ------------------- فاز ۸: حقوق ماهانه و محاسبه معوقات ------------------- */

const PAY_SCHEME = 'SERVICE_COMPANIES_NATIONWIDE';
const cumulativeFor = (years, asOfDate) =>
  core.computeCumulativeSeniority(data, { schemeCode: PAY_SCHEME, yearsOfService: years, asOfDate }).amount ?? 0;
const expectedPayrollWage = ({ group, years, accumulated = 0, period = '1405-01', married = true, children = 0 }) =>
  core.computeWage(data, {
    schemeCode: PAY_SCHEME,
    jobGroup: group,
    priorAccumulatedDailySeniority: accumulated,
    priorOtherFixedDailyWage: 0,
    serviceYearsInWorkshop: years,
    payableDays: 30,
    isMarried: married,
    eligibleChildrenCount: children,
    includeWelfareBenefits: true,
    computationDate: `${period}-01`,
    periodYearMonth: period,
  });

click('.nav-item[data-route="payroll"]');
click('.subtab[data-subtab="payroll"]');
assert('حقوق ماهانه: زیرتب فعال شد', document.querySelector('#sub-payroll')?.classList.contains('is-active'));
assert('حقوق ماهانه: ۱۲ دوره', document.querySelectorAll('#pr-period option').length === 12, String(document.querySelectorAll('#pr-period option').length));

click('#pr-calc');
assert('حقوق ماهانه: دو فیش (کارمند بدون گروه حذف شد)', payrollRowsCount() === 2, String(payrollRowsCount()));
function payrollRowsCount() {
  return [...document.querySelectorAll('#pr-table tbody tr')].filter((row) => row.textContent.includes('EMP-')).length;
}
contains('حقوق ماهانه: پیام', text('#pr-msg'), 'کارمند');
contains('حقوق ماهانه: شمارش فیش', text('#pr-count'), '۲ فیش');
const employeeOnePay = expectedPayrollWage({ group: 14, years: 7, accumulated: 200000, period: '1405-01' });
const payrollRowOne = [...document.querySelectorAll('#pr-table tbody tr')].find((row) => row.textContent.includes('EMP-1001'));
assert('حقوق ماهانه: مزد شغل گروه ۱۴', payrollRowOne?.textContent?.includes(fa(employeeOnePay.monthlyJobWage)), payrollRowOne?.textContent?.slice(0, 80));
assert('حقوق ماهانه: خالص فیش', payrollRowOne?.textContent?.includes(fa(employeeOnePay.netPayable)), payrollRowOne?.textContent?.slice(0, 120));
assert('حقوق ماهانه: رشد مزد شغل', payrollRowOne?.textContent?.includes('٪'), payrollRowOne?.textContent?.slice(-60));
const employeeTwoPay = expectedPayrollWage({ group: 10, years: 3, accumulated: cumulativeFor(3, '1405-01-01'), period: '1405-01' });
contains('حقوق ماهانه: جمع خالص', text('#pr-summary'), fa(employeeOnePay.netPayable + employeeTwoPay.netPayable));

payrollRowOne?.querySelector('button[data-detail="0"]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('حقوق ماهانه: جزئیات فیش', document.querySelector('#pr-detail-card')?.hidden === false);
contains('حقوق ماهانه: ریز مؤلفه‌ها', text('#pr-detail'), 'مزد شغل');
contains('حقوق ماهانه: فرمول', text('#pr-detail'), 'FRM-JOB-WAGE-1405');
assert('حقوق ماهانه: چاپ و خروجی', document.querySelector('#pr-print') !== null && document.querySelector('#pr-export') !== null);
let payrollExportOk = true;
try {
  click('#pr-export');
} catch {
  payrollExportOk = false;
}
assert('حقوق ماهانه: خروجی CSV بدون خطا', payrollExportOk);

/* ------------------------------ معوقات ------------------------------ */

const arrearsNav = document.querySelector('.nav-item[data-route="arrears"]');
assert('معوقات: آیتم منو فعال شد', arrearsNav?.disabled === false && arrearsNav?.querySelector('.nav-badge') === null);
click('.nav-item[data-route="arrears"]');
assert('مسیریابی به معوقات', document.querySelector('#view-arrears')?.classList.contains('is-active'));
assert('معوقات: فهرست کارکنان', document.querySelectorAll('#ar-employee option').length === 3, String(document.querySelectorAll('#ar-employee option').length));

const arrearsBase = expectedPayrollWage({ group: 14, years: 7, accumulated: 200000, period: '1405-01' });
const arrearsGroup15 = expectedPayrollWage({ group: 15, years: 7, accumulated: 200000, period: '1405-02' });
const arrearsGroup15Month1 = expectedPayrollWage({ group: 15, years: 7, accumulated: 200000, period: '1405-01' });

setSelect('#ar-from', '1405-01');
setSelect('#ar-to', '1405-03');
setSelect('#ar-group-to', '15');
setSelect('#ar-group-effective', '1405-02');
setField('ar-increase', 0);
click('#ar-calc');
const arrearsRows = [...document.querySelectorAll('#ar-table tbody tr')];
assert('معوقات: سه ردیف ماه', arrearsRows.length === 4, String(arrearsRows.length));
const farvardinRow = arrearsRows.find((row) => row.textContent.includes('فروردین'));
assert('معوقات: ماه اول بدون تغییر', farvardinRow?.textContent?.includes('بدون تغییر مؤثر'), farvardinRow?.textContent?.slice(0, 80));
const ordibeheshtRow = arrearsRows.find((row) => row.textContent.includes('اردیبهشت'));
assert('معوقات: ارتقای گروه از اردیبهشت', ordibeheshtRow?.textContent?.includes('ارتقا به گروه ۱۵'), ordibeheshtRow?.textContent?.slice(0, 90));
const expectedDiff = arrearsGroup15.grossTotal - arrearsBase.grossTotal;
assert('معوقات: مابه‌التفاوت اردیبهشت', ordibeheshtRow?.textContent?.includes(fa(expectedDiff)), `${fa(expectedDiff)} | ${ordibeheshtRow?.textContent?.slice(0, 120)}`);
contains('معوقات: شاخص جمع استحقاقی', text('#ar-summary'), 'جمع مزد استحقاقی');
contains('معوقات: جمع مابه‌التفاوت', text('#ar-summary'), 'مابه‌التفاوت');

setSelect('#ar-increase-effective', '1405-03');
setField('ar-increase', 10);
click('#ar-calc');
const khordadRow = [...document.querySelectorAll('#ar-table tbody tr')].find((row) => row.textContent.includes('خرداد'));
assert('معوقات: افزایش بخشنامه در خرداد', khordadRow?.textContent?.includes('افزایش ۱۰'), khordadRow?.textContent?.slice(0, 110));
const expectedKhordad = core.roundMoney(arrearsGroup15Month1.wageSubtotal * 1.1) + arrearsGroup15Month1.welfareSubtotal;
assert('معوقات: استحقاقی خرداد با افزایش', khordadRow?.textContent?.includes(fa(expectedKhordad)), `${fa(expectedKhordad)} | ${khordadRow?.textContent?.slice(0, 140)}`);
const expectedTotal = expectedKhordad - arrearsBase.grossTotal;
assert('معوقات: مابه‌التفاوت خرداد', khordadRow?.textContent?.includes(fa(expectedTotal)), `${fa(expectedTotal)}`);

khordadRow?.querySelector('button[data-ar-detail]')?.dispatchEvent(new window.Event('click', { bubbles: true }));
assert('معوقات: جزئیات ماه', document.querySelector('#ar-detail-card')?.hidden === false);
contains('معوقات: ریز فرمول', text('#ar-detail'), 'FRM-JOB-WAGE-1405');
contains('معوقات: توضیح افزایش', text('#ar-detail'), 'افزایش');
contains('معوقات: ردیف افزایش با شناسه فرمول', text('#ar-detail'), 'FRM-WAGE-INCREASE');
contains('معوقات: جمع استحقاقی ماه در جزئیات', text('#ar-detail'), fa(expectedKhordad));

setSelect('#ar-to', '1405-01');
setSelect('#ar-from', '1405-03');
click('#ar-calc');
assert('معوقات: بازه نامعتبر رد شد', text('#ar-error').includes('بازه دوره'), text('#ar-error'));
setSelect('#ar-from', '1405-01');
setSelect('#ar-to', '1405-03');
setField('ar-increase', 150);
click('#ar-calc');
assert('معوقات: درصد افزایش نامعتبر رد شد', text('#ar-error').includes('درصد افزایش'), text('#ar-error'));
setField('ar-increase', 10);
click('#ar-calc');

let arrearsExportOk = true;
try {
  click('#ar-export');
} catch {
  arrearsExportOk = false;
}
assert('معوقات: خروجی CSV بدون خطا', arrearsExportOk);
assert('معوقات: چاپ موجود است', document.querySelector('#ar-print') !== null);


/* --------------------------- فاز ۹: گزارش‌ساز --------------------------- */

const reportsNav = document.querySelector('.nav-item[data-route="reports"]');
assert('گزارش‌ها: آیتم منو فعال شد', reportsNav?.disabled === false && reportsNav?.querySelector('.nav-badge') === null);
click('.nav-item[data-route="reports"]');
assert('مسیریابی به گزارش‌ها', document.querySelector('#view-reports')?.classList.contains('is-active'));
assert('گزارش‌ساز: ۱۲ نوع گزارش', document.querySelectorAll('#rp-type option').length === 12, String(document.querySelectorAll('#rp-type option').length));

click('#rp-print');
contains('چاپ گزارش: جلوگیری از چاپ برگه خالی', text('#toast'), 'ابتدا گزارش را بسازید');

click('#rp-build');
assert('گزارش: برگه ساخته شد', document.querySelector('#rp-sheet')?.hidden === false);
contains('گزارش: سربرگ شرکت', text('#rp-letterhead'), 'شرکت نمونه صنعت');
contains('گزارش: سربرگ کارگاه', text('#rp-letterhead'), 'کارگاه شماره یک');
contains('گزارش: تاریخ گزارش', text('#rp-letterhead'), 'تاریخ گزارش');
contains('گزارش: عنوان گزارش', text('#rp-letterhead'), 'فهرست مشاغل کارگاه');
assert('گزارش مشاغل: دو ردیف', document.querySelectorAll('#rp-body tbody tr').length === 2, String(document.querySelectorAll('#rp-body tbody tr').length));

setSelect('#rp-type', 'JOBS_EVALUATED');
click('#rp-build');
assert('گزارش مشاغل ارزیابی‌شده: یک ردیف', document.querySelectorAll('#rp-body tbody tr').length === 1, String(document.querySelectorAll('#rp-body tbody tr').length));
contains('گزارش مشاغل ارزیابی‌شده: کد شغل', text('#rp-body'), 'J-2001');

setSelect('#rp-type', 'GROUP_ASSIGNMENT');
click('#rp-build');
contains('گزارش گروه‌بندی: وضعیت رد', text('#rp-body'), 'رد شده');
contains('گزارش گروه‌بندی: گروه پیشنهادی', text('#rp-body'), fa(12));

setSelect('#rp-type', 'COMMITTEE');
click('#rp-build');
contains('صورت‌جلسه: تأیید کمیته', text('#rp-body'), 'تأیید کمیته');
contains('صورت‌جلسه: شماره صورت‌جلسه', text('#rp-body'), '1405-COMM-12');
assert('صورت‌جلسه: دو تصمیم', document.querySelectorAll('#rp-body tbody tr').length === 2, String(document.querySelectorAll('#rp-body tbody tr').length));

setSelect('#rp-type', 'ORG');
click('#rp-build');
contains('گزارش ساختار: ریشه', text('#rp-body'), 'مدیریت عامل');
contains('گزارش ساختار: خط مونتاژ', text('#rp-body'), 'خط مونتاژ');

setSelect('#rp-type', 'EMPLOYEES');
click('#rp-build');
assert('گزارش کارکنان: سه ردیف', document.querySelectorAll('#rp-body tbody tr').length === 3, String(document.querySelectorAll('#rp-body tbody tr').length));
contains('گزارش کارکنان: نام', text('#rp-body'), 'مریم احمدی');

setSelect('#rp-type', 'EMPLOYEE_DOSSIER');
setSelect('#rp-employee', employeeByCode('EMP-1001').id);
click('#rp-build');
contains('پرونده پرسنلی: نام', text('#rp-body'), 'مریم احمدی');
contains('پرونده پرسنلی: تاریخچه', text('#rp-body'), 'تاریخچه ارتقا');
contains('پرونده پرسنلی: دلیل ارتقا', text('#rp-body'), 'ارتقا مطابق صورت‌جلسه');

setSelect('#rp-type', 'DISTRIBUTION');
click('#rp-build');
contains('گزارش توزیع: گروه ۱۴', text('#rp-body'), 'گروه ۱۴');
contains('گزارش توزیع: واحد', text('#rp-body'), 'خط مونتاژ');

setSelect('#rp-type', 'PAYROLL');
setSelect('#rp-period', '1405-01');
click('#rp-build');
contains('گزارش حقوق: کد پرسنلی', text('#rp-body'), 'EMP-1001');
contains('گزارش حقوق: جمع کل', text('#rp-body'), 'جمع کل');
contains('گزارش حقوق: مزد شغل', text('#rp-body'), fa(expectedPayrollWage({ group: 14, years: 7, accumulated: 200000, period: '1405-01' }).monthlyJobWage));

setSelect('#rp-type', 'ARREARS');
click('#rp-build');
contains('گزارش معوقات: عنوان', text('#rp-letterhead'), 'خلاصه معوقات دوره');
contains('گزارش معوقات: مابه‌التفاوت', text('#rp-body'), 'مابه‌التفاوت');
assert('گزارش معوقات: سه ماه + جمع', document.querySelectorAll('#rp-body tbody tr').length === 4, String(document.querySelectorAll('#rp-body tbody tr').length));

setSelect('#rp-type', 'YEAR_COMPARE');
click('#rp-build');
assert('گزارش مقایسه سال: ۲۰ گروه', document.querySelectorAll('#rp-body tbody tr').length === 20, String(document.querySelectorAll('#rp-body tbody tr').length));
contains('گزارش مقایسه سال: رشد', text('#rp-body'), '٪');

setSelect('#rp-type', 'OVERVIEW');
click('#rp-build');
contains('گزارش جامع: عنوان', text('#rp-letterhead'), 'گزارش جامع کارگاه');
contains('گزارش جامع: داده ناقص', text('#rp-body'), 'کارکنان بدون گروه شغلی');

setSelect('#rp-type', 'JOBS_LIST');
setSelect('#rp-unit', assemblyUnit.id);
click('#rp-build');
assert('گزارش با فیلتر واحد: یک ردیف', document.querySelectorAll('#rp-body tbody tr').length === 1, String(document.querySelectorAll('#rp-body tbody tr').length));
setSelect('#rp-unit', '');

let reportExportOk = true;
try {
  click('#rp-export');
} catch {
  reportExportOk = false;
}
assert('گزارش: خروجی CSV بدون خطا', reportExportOk);
assert('گزارش: چاپ موجود است', document.querySelector('#rp-print') !== null);
click('#rp-print');
contains('چاپ گزارش: جهت افقی صفحه', document.querySelector('#print-page-style')?.textContent ?? '', 'landscape');
assert('چاپ گزارش: کلاس جهت روی body', document.body.classList.contains('print-landscape'));
click('#print-btn');
contains('چاپ کلی: گزارش در حالت افقی', document.querySelector('#print-page-style')?.textContent ?? '', 'landscape');

/* مقایسه مشاغل با ۱۰ معیار */
const jobsForCompare = JSON.parse(localStorage.getItem('mashaqel.state.v2')).jobs;
selectMulti('#cmp-jobs', jobsForCompare.map((job) => job.id));
click('#cmp-build');
assert('مقایسه: دو چندضلعی رادار', document.querySelectorAll('#cmp-chart svg polygon.radar-series').length === 2, String(document.querySelectorAll('#cmp-chart svg polygon.radar-series').length));
assert('مقایسه: ۱۰ معیار', document.querySelectorAll('#cmp-table tbody tr').length === 10, String(document.querySelectorAll('#cmp-table tbody tr').length));
contains('مقایسه: معیار امتیاز کل', text('#cmp-table'), 'امتیاز کل');
contains('مقایسه: راهنمای نمودار', text('#cmp-legend'), 'J-2001');
contains('مقایسه: نرمال‌شده', text('#cmp-table'), '٪ از سقف');

selectMulti('#cmp-jobs', [jobsForCompare[0].id]);
click('#cmp-build');
assert('مقایسه: حداقل دو شغل', text('#cmp-msg').includes('حداقل دو شغل'), text('#cmp-msg'));

/* -------------------------- حقوق و دستمزد و ارقام -------------------------- */

click('.nav-item[data-route="payroll"]');
assert('مسیریابی به حقوق و دستمزد', document.querySelector('#view-payroll')?.classList.contains('is-active'));

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

click('#digits-toggle');
assert('ارقام لاتین', text('#wage-results').includes(en(g20.dailyJobWage)), en(g20.dailyJobWage));
click('#digits-toggle');
assert('بازگشت به ارقام فارسی', text('#wage-results').includes(fa(g20.dailyJobWage)));
setSelect('#w-group', '8');

/* --------------------------------- سنوات --------------------------------- */

click('.subtab[data-subtab="seniority"]');
assert('زیرتب سنوات فعال شد', document.querySelector('#sub-seniority')?.classList.contains('is-active'));
click('#s-calc');
const seniorityText = text('#s-result');
contains('سنوات.نرخ گروه ۸', seniorityText, fa(168_067));
contains('سنوات.کل پایه سنوات', seniorityText, fa(Math.round(166_667 * 1.45) + 168_067));
assert('سنوات.جدول تجمیعی', document.querySelectorAll('#s-cumulative-table tbody tr').length === 31, String(document.querySelectorAll('#s-cumulative-table tbody tr').length));
assert('سنوات.جدول نرخ ۲۰ گروه', document.querySelectorAll('#s-rate-table tbody tr').length === 20);

/* --------------------------------- گروه --------------------------------- */

click('.nav-item[data-route="group"]');
setSelect('#g-scheme', 'NATIONAL_20_GROUP_1389');
click('#g-calc');
contains('گروه.امتیاز ۳۲۳ → گروه ۱۲', text('#g-result'), fa(12));

/* -------------------------------- ارزیابی -------------------------------- */

click('.nav-item[data-route="evaluation"]');
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

/* -------------------------------- تنظیمات -------------------------------- */

click('.nav-item[data-route="settings"]');
assert('مسیریابی به تنظیمات', document.querySelector('#view-settings')?.classList.contains('is-active'));
contains('تنظیمات: نسخه موتور', text('#settings-meta'), data.meta.engineVersion);
contains('تنظیمات: کلید ذخیره‌سازی', text('#settings-meta'), 'mashaqel.state.v2');
contains('تنظیمات: مشخصات داده', text('#data-meta'), fa(data.levels.length));

/* ---------------------- سرور مرکزی — حالت محلی (فاز ۱۱) ---------------------- */

assert('سرور: نشان حالت محلی', document.querySelector('#mode-chip')?.textContent === 'حالت محلی', text('#mode-chip'));
contains('سرور: وضعیت پنل محلی', text('#backend-status'), 'حالت محلی');
assert('سرور: دکمه بازبینی در حالت محلی غیرفعال', document.querySelector('#backend-verify')?.disabled === true);
assert('سرور: دکمه پشتیبان مرکزی در حالت محلی غیرفعال', document.querySelector('#backend-backup')?.disabled === true);
click('#backend-refresh');
assert('سرور: پیام بررسی وضعیت محلی', await waitFor(() => text('#backend-note').includes('سروری در دسترس نیست'), 3000), text('#backend-note'));

/* ------------- بازنشانی نتایج موقت با تغییر کارگاه فعال ------------- */

click('.nav-item[data-route="payroll"]');
assert('تغییر کارگاه: فیش‌های کارگاه اول موجود است', payrollRowsCount() > 0, String(payrollRowsCount()));
click('.nav-item[data-route="arrears"]');
setField('ar-increase', 10);
click('#ar-calc');
assert('تغییر کارگاه: معوقات کارگاه اول محاسبه شد', document.querySelectorAll('#ar-table tbody tr').length === 4, String(document.querySelectorAll('#ar-table tbody tr').length));
setSelect('#active-workshop', secondWorkshopId);
assert('تغییر کارگاه: پاک شدن فیش‌های کارگاه قبلی', payrollRowsCount() === 0, String(payrollRowsCount()));
assert('تغییر کارگاه: پنهان شدن گزارش قبلی', document.querySelector('#rp-sheet')?.hidden === true);
contains('تغییر کارگاه: پیام ساخت گزارش جدید', text('#rp-msg'), 'کارگاه فعال تغییر کرد');
click('#pr-print');
contains('چاپ حقوق: جلوگیری از چاپ فیش خالی', text('#toast'), 'ابتدا حقوق ماه را محاسبه کنید');
click('#ar-print');
contains('چاپ معوقات: جلوگیری از چاپ جدول خالی', text('#toast'), 'ابتدا معوقات دوره را محاسبه کنید');
assert('تغییر کارگاه: پاک شدن فیلتر واحد مشاغل', selectValueOf('#jobs-filter-unit') === '');
setSelect('#active-workshop', firstWorkshopId);
assert('تغییر کارگاه: بازگشت به کارگاه اول', text('#jobs-table').includes('J-1001') || document.querySelector('#view-payroll') !== null);

/* --------------------------- امنیت و نقش‌ها (فاز ۱۰) --------------------------- */

const loginAs = async (username, password) => {
  setField('al-username', username);
  setField('al-password', password);
  document.querySelector('#auth-login').dispatchEvent(new window.Event('submit'));
  await new Promise((resolve) => setTimeout(resolve, 40));
  return waitFor(() => document.querySelector('#auth-gate')?.hidden === true, 4000);
};
const logout = () => click('#logout-btn');
const userRowCount = () => document.querySelectorAll('#users-table tbody tr').length;
const enabledRoutes = () =>
  [...document.querySelectorAll('.nav-item')].filter((item) => !item.disabled).map((item) => item.dataset.route);
const scopeWorkshopId = (JSON.parse(localStorage.getItem('mashaqel.state.v2') ?? '{}').workshops ?? []).find((row) => row.workshopCode === 'WS-1001')?.id;
const submitUser = async (fields) => {
  click('#user-new');
  setField('uf-name', fields.name);
  setField('uf-username', fields.username);
  setSelect('#uf-role', fields.role ?? 'EXPERT');
  setSelect('#uf-active', fields.active ?? 'ACTIVE');
  setField('uf-password', fields.password ?? 'Pass1234');
  selectMulti('#uf-workshops', fields.workshops ?? []);
  document.querySelector('#user-form').dispatchEvent(new window.Event('submit'));
  await new Promise((resolve) => setTimeout(resolve, 200));
};

click('.nav-item[data-route="users"]');
assert('امنیت: مسیریابی به کاربران', document.querySelector('#view-users')?.classList.contains('is-active'));
assert('امنیت: حساب مدیر اولیه', userRowCount() === 1, String(userRowCount()));
contains('امنیت: نقش مدیر در فهرست', text('#users-table'), 'مدیر سامانه');

await submitUser({ name: 'کارشناس نمونه', username: 'expert', role: 'EXPERT', password: 'Expert@1405', workshops: [scopeWorkshopId] });
assert('امنیت: ایجاد کاربر کارشناس', userRowCount() === 2, String(userRowCount()));
contains('امنیت: محدوده کارگاه کاربر', text('#users-table'), 'کارگاه شماره یک');
contains('امنیت: جدول کاربران نقش کارشناس', text('#users-table'), 'کارشناس طبقه‌بندی');

await submitUser({ name: 'کاربر تکراری', username: 'expert', role: 'VIEWER' });
contains('امنیت: رد نام کاربری تکراری', text('#user-error'), 'قبلاً ثبت شده');
await submitUser({ name: 'کاربر ضعیف', username: 'weakuser', role: 'VIEWER', password: '123' });
contains('امنیت: رد رمز ضعیف', text('#user-error'), 'حداقل ۸');
await submitUser({ name: 'بازدیدکننده نمونه', username: 'viewer', role: 'VIEWER', password: 'Viewer@1405' });
await submitUser({ name: 'کارشناس حقوق', username: 'payroll', role: 'PAYROLL', password: 'Payroll@1405' });
assert('امنیت: چهار کاربر ثبت شد', userRowCount() === 4, String(userRowCount()));
contains('امنیت: شمارنده کاربران', text('#users-count'), fa(4));

click('#activity-refresh');
assert('امنیت: گزارش فعالیت ثبت شده است', document.querySelectorAll('#activity-table tbody tr').length >= 5, String(document.querySelectorAll('#activity-table tbody tr').length));
contains('امنیت: رویداد ایجاد کاربر', text('#activity-table'), 'ایجاد کاربر');
const actAll = text('#activity-table');
contains('امنیت: رویداد راه‌اندازی', text('#activity-table'), 'راه‌اندازی');

setField('activity-search', 'expert');
document.querySelector('#activity-search').dispatchEvent(new window.Event('input'));
const filteredActivity = [...document.querySelectorAll('#activity-table tbody tr')];
assert(
  'امنیت: جستجوی گزارش فعالیت',
  filteredActivity.length > 0 && filteredActivity.every((row) => row.textContent.includes('expert')),
  String(filteredActivity.length),
);
setField('activity-search', '');
document.querySelector('#activity-search').dispatchEvent(new window.Event('input'));

const adminRow = [...document.querySelectorAll('#users-table tbody tr')].find((row) => row.textContent.includes('admin'));
adminRow.querySelector('button[data-user-action="edit"]').dispatchEvent(new window.Event('click', { bubbles: true }));
setSelect('#uf-active', 'INACTIVE');
document.querySelector('#user-form').dispatchEvent(new window.Event('submit'));
await new Promise((resolve) => setTimeout(resolve, 200));
contains('امنیت: حفاظت از آخرین مدیر', text('#user-error'), 'حداقل یک مدیر');
click('#user-cancel');
assert('امنیت: مدیر غیرفعال نشد', text('#users-table').includes('مدیر سامانه'));

logout();
assert('امنیت: خروج و نمایش فرم ورود', document.querySelector('#auth-gate')?.hidden === false && document.querySelector('#auth-login')?.hidden === false);
assert('امنیت: پاک شدن نشان کاربر', text('#user-chip') === '');

assert('امنیت: ورود کارشناس', await loginAs('expert', 'Expert@1405'));
contains('امنیت: نشان کاربر کارشناس', text('#user-chip'), 'کارشناس طبقه‌بندی');
contains('امنیت: رویداد ورود', text('#activity-table'), 'ورود موفق');
const expertRoutes = enabledRoutes();
assert(
  'امنیت: دسترسی ماژول‌های کارشناس',
  expertRoutes.includes('jobs') && expertRoutes.includes('evaluation') && !expertRoutes.includes('users') && !expertRoutes.includes('employees'),
  expertRoutes.join(','),
);

click('.nav-item[data-route="workshops"]');
assert('امنیت: کارشناس فقط کارگاه مجاز را می‌بیند', document.querySelectorAll('#workshop-table tbody tr').length === 1, String(document.querySelectorAll('#workshop-table tbody tr').length));
assert('امنیت: انتخابگر کارگاه محدود شد', document.querySelectorAll('#active-workshop option').length === 2, String(document.querySelectorAll('#active-workshop option').length));
click('#workshop-new');
assert('امنیت: جلوگیری از تغییر کارگاه توسط کارشناس', document.querySelector('#workshop-form')?.hidden === true);
contains('امنیت: پیام رد دسترسی', text('#toast'), 'دسترسی لازم');

click('.nav-item[data-route="jobs"]');
const jobsBeforeDeniedDelete = document.querySelectorAll('#jobs-table tbody tr').length;
click('#jobs-table button[data-action="delete"]');
assert('امنیت: حذف شغل برای کارشناس مسدود شد', document.querySelectorAll('#jobs-table tbody tr').length === jobsBeforeDeniedDelete, String(document.querySelectorAll('#jobs-table tbody tr').length));
contains('امنیت: پیام حذف فقط مدیر', text('#toast'), 'فقط برای مدیر');

logout();
assert('امنیت: ورود کارشناس حقوق', await loginAs('payroll', 'Payroll@1405'));
const payrollRoutes = enabledRoutes();
assert(
  'امنیت: دسترسی ماژول‌های حقوق و دستمزد',
  payrollRoutes.includes('payroll') && payrollRoutes.includes('arrears') && !payrollRoutes.includes('jobs') && !payrollRoutes.includes('users'),
  payrollRoutes.join(','),
);

logout();
assert('امنیت: ورود بازدیدکننده', await loginAs('viewer', 'Viewer@1405'));
assert('امنیت: نقش بازدیدکننده فقط خواندنی', document.body.classList.contains('is-readonly'));
const viewerRoutes = enabledRoutes();
assert(
  'امنیت: دسترسی ماژول‌های بازدیدکننده',
  viewerRoutes.length === 5 && viewerRoutes.includes('dashboard') && viewerRoutes.includes('guide') && viewerRoutes.includes('reports') && !viewerRoutes.includes('employees'),
  viewerRoutes.join(','),
);
assert('امنیت: آیتم کاربران برای بازدیدکننده غیرفعال', document.querySelector('.nav-item[data-route="users"]')?.disabled === true);
click('.nav-item[data-route="jobs"]');
click('#job-new');
assert('امنیت: بازدیدکننده نمی‌تواند شغل بسازد', document.querySelector('#job-form')?.hidden === true);
contains('امنیت: پیام فقط‌خواندنی', text('#toast'), 'دسترسی لازم');

click('.nav-item[data-route="guide"]');
assert('امنیت: دسترسی بازدیدکننده به آموزش', document.querySelector('.nav-item[data-route="guide"]')?.disabled === false && document.querySelector('#view-guide')?.classList.contains('is-active'));
contains('امنیت: نقش بازدیدکننده در آموزش', text('#guide-meta'), 'بازدیدکننده');

logout();
let lockedMessage = '';
for (let attempt = 0; attempt < 5; attempt += 1) {
  await loginAs('viewer', 'Wrong1234');
  lockedMessage = text('#auth-login-msg');
}
contains('امنیت: قفل حساب پس از ۵ تلاش ناموفق', lockedMessage, 'قفل');

assert('امنیت: ورود مجدد مدیر', await loginAs('admin', 'Admin@1405'));
click('.nav-item[data-route="users"]');
contains('امنیت: گزارش رویدادهای رد دسترسی', text('#activity-table'), 'رد دسترسی');

const expertRow = [...document.querySelectorAll('#users-table tbody tr')].find((row) => row.textContent.includes('expert'));
expertRow.querySelector('button[data-user-action="edit"]').dispatchEvent(new window.Event('click', { bubbles: true }));
setSelect('#uf-active', 'INACTIVE');
document.querySelector('#user-form').dispatchEvent(new window.Event('submit'));
await new Promise((resolve) => setTimeout(resolve, 200));
contains('امنیت: غیرفعال‌سازی کاربر', text('#users-table'), 'غیرفعال');
logout();
assert('امنیت: حساب غیرفعال اجازه ورود ندارد', (await loginAs('expert', 'Expert@1405')) === false);
contains('امنیت: پیام حساب غیرفعال', text('#auth-login-msg'), 'غیرفعال شده');

/* --------------------------------- نتیجه --------------------------------- */

const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.label}${check.ok ? '' : ` → ${check.detail}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} بررسی رابط کاربری موفق.`);
console.log(`خطاهای زمان اجرا: ${errors.length}`);
for (const error of errors) console.log(error?.stack ?? error);
if (failed.length > 0 || errors.length > 0) process.exitCode = 1;
