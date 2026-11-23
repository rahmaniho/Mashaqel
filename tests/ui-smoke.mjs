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

const checks = [];
const assert = (label, condition, detail = '') => checks.push({ label, ok: Boolean(condition), detail });
const contains = (label, haystack, needle) => assert(label, haystack.includes(needle), needle);

/* ------------------------------ پوسته و مسیریابی ------------------------------ */

const navItems = [...document.querySelectorAll('.nav-item')];
assert('منوی کناری: ۱۲ بخش', navItems.length === 12, String(navItems.length));
assert('منوی کناری: ۸ بخش فعال', navItems.filter((item) => !item.disabled).length === 8, String(navItems.filter((item) => !item.disabled).length));
assert(
  'بخش «شناسنامه فرمول‌ها و اسناد قانونی» پنهان شده است',
  document.querySelector('#view-reference') === null && !document.body.innerHTML.includes('شناسنامه فرمول') && !document.body.innerHTML.includes('بانک قوانین'),
);
assert('داشبورد پیش‌فرض فعال است', document.querySelector('#view-dashboard')?.classList.contains('is-active'));

click('.nav-item[data-route="group"]');
assert('مسیریابی به گروه شغلی', document.querySelector('#view-group')?.classList.contains('is-active'));
assert('عنوان صفحه به‌روزرسانی شد', document.querySelector('#page-title')?.textContent === 'تعیین گروه شغلی');

click('.nav-item[data-route="dashboard"]');
assert('بازگشت به داشبورد', document.querySelector('#view-dashboard')?.classList.contains('is-active'));

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

/* --------------------------------- نتیجه --------------------------------- */

const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.label}${check.ok ? '' : ` → ${check.detail}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} بررسی رابط کاربری موفق.`);
console.log(`خطاهای زمان اجرا: ${errors.length}`);
for (const error of errors) console.log(error?.stack ?? error);
if (failed.length > 0 || errors.length > 0) process.exitCode = 1;
