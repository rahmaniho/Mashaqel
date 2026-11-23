/**
 * آزمون یکپارچه «حالت سرور مرکزی» (فاز ۱۱).
 * سرور واقعی (server/server.mjs) روی پورت موقت اجرا می‌شود، سپس پوسته وب با linkedom
 * بارگذاری می‌شود و مسیرهای احراز هویت، کاربران، گزارش فعالیت و پشتیبان مرکزی با
 * فراخوانی واقعی HTTP بررسی می‌شوند.
 *
 * اجرا: npm run test:web-server
 */

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import { createApp } from '../server/server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');
const { window, document } = parseHTML(html);

window.scrollTo = () => {};
globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;

/* ------------------------------ سرور واقعی ------------------------------ */

const dbPath = join(tmpdir(), `mashaqel-test-${Date.now()}.sqlite`);
const app = createApp({ dbPath, corsOrigin: '*' });
await new Promise((resolveListen) => app.server.listen(0, '127.0.0.1', resolveListen));
const apiBase = `http://127.0.0.1:${app.server.address().port}`;

/* ------------------------------ محیط شبیه‌سازی ------------------------------ */

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
const sessionStore = new Map();
globalThis.sessionStorage = {
  getItem: (key) => (sessionStore.has(key) ? sessionStore.get(key) : null),
  setItem: (key, value) => sessionStore.set(key, String(value)),
  removeItem: (key) => sessionStore.delete(key),
};

localStorage.setItem('mashaqel.backend.v1', JSON.stringify({ base: `${apiBase}/api` }));

const dataUrl = pathToFileURL(resolve(root, 'web/data/mashaqel-data.json')).href;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('http://') || url.startsWith('https://')) return nativeFetch(input, init);
  return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(dataUrl.replace('file://', ''), 'utf8')) };
};

const errors = [];
process.on('unhandledRejection', (error) => errors.push(error));

await import(`${pathToFileURL(resolve(root, 'web/app.js')).href}?server=${Date.now()}`);
await new Promise((resolveWait) => setTimeout(resolveWait, 400));

/* -------------------------------- ابزارها -------------------------------- */

const checks = [];
const assert = (label, condition, detail = '') => checks.push({ label, ok: Boolean(condition), detail });
const contains = (label, haystack, needle) => assert(label, haystack.includes(needle), `${needle} :: ${String(haystack).slice(0, 160)}`);
const text = (selector) =>
  (document.querySelector(selector)?.innerHTML ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const waitFor = async (predicate, timeout = 6000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 30));
  }
  return predicate();
};
const click = (selector) =>
  document.querySelector(selector).dispatchEvent(new window.Event('click', { bubbles: true }));
const setField = (id, value) => {
  const element = document.querySelector(`#${id}`);
  element.setAttribute('value', String(value));
  try {
    element.value = String(value);
  } catch {
    /* linkedom */
  }
};
const submit = (selector) => document.querySelector(selector).dispatchEvent(new window.Event('submit'));
const setSelectValue = (selector, value) => {
  const select = document.querySelector(selector);
  const options = [...(select.options ?? [])];
  for (const option of options) {
    option.selected = false;
    option.removeAttribute('selected');
  }
  const match = options.find((option) => option.getAttribute('value') === String(value));
  if (match) {
    match.selected = true;
    match.setAttribute('selected', 'selected');
  }
  select.dispatchEvent(new window.Event('change'));
};
const countRows = (selector) => document.querySelectorAll(`${selector} tbody tr`).length;

/* -------------------------------- سناریو -------------------------------- */

assert('سرور: حالت اتصال تشخیص داده شد', document.querySelector('#mode-chip')?.textContent === 'سرور مرکزی', text('#mode-chip'));
assert('سرور: صفحه راه‌اندازی اولیه', document.querySelector('#auth-gate')?.hidden === false && document.querySelector('#auth-setup')?.hidden === false);
assert('سرور: دکمه‌های مرکزی در حالت مهمان غیرفعال', document.querySelector('#backend-backup')?.disabled === true);
assert('SSO: بدون پیکربندی، دکمه سازمانی پنهان و ورود محلی فعال است', document.querySelector('#sso-row')?.hidden === true && document.querySelector('#al-username')?.hidden === false);

setField('au-name', 'مدیر سرور');
setField('au-username', 'server.admin');
setField('au-password', 'Server@1405');
setField('au-password2', 'Server@1405');
submit('#auth-setup');
assert('سرور: راه‌اندازی حساب مدیر از طریق API', await waitFor(() => document.querySelector('#auth-gate')?.hidden === true));
contains('سرور: نشان کاربر', text('#user-chip'), 'مدیر سرور');

const health = await (await nativeFetch(`${apiBase}/api/health`)).json();
assert('سرور: حساب مدیر روی سرور ثبت شد', health.users === 1, String(health.users));
assert('سرور: گیت محلی (localStorage) خالی ماند', localStorage.getItem('mashaqel.auth.v1') === null);

click('.nav-item[data-route="settings"]');
assert('سرور: وضعیت پنل تنظیمات', text('#backend-status').includes('متصل به سرور مرکزی'), text('#backend-status'));
assert('سرور: دکمه‌های مرکزی فعال شد', document.querySelector('#backend-verify')?.disabled === false);

click('#backend-verify');
assert('سرور: بازبینی زنجیره گزارش', await waitFor(() => text('#backend-note').includes('سالم')), text('#backend-note'));

click('#backend-backup');
assert('سرور: پشتیبان مرکزی ثبت شد', await waitFor(() => text('#backend-note').includes('پشتیبان مرکزی نسخه')), text('#backend-note'));

/* همگام‌سازی چنددستگاهی (فاز ۱۲) */

click('#sync-push');
assert('سرور: ارسال وضعیت سازمان', await waitFor(() => text('#backend-note').includes('روی سرور ذخیره شد')), text('#backend-note'));
const stateAfterPush = await (async () => {
  const response = await nativeFetch(`${apiBase}/api/state`, {
    headers: { authorization: `Bearer ${sessionStore.get('mashaqel.backend.token')}` },
  });
  return response.json();
})();
assert('سرور: نسخه وضعیت روی سرور', stateAfterPush.state?.version === 1, JSON.stringify(stateAfterPush));

click('#sync-refresh');
assert('سرور: بررسی نسخه‌ها', await waitFor(() => text('#backend-note').includes('نسخه سرور: ۱')), text('#backend-note'));
contains('سرور: نشان نسخه همگام‌سازی', text('#sync-status'), 'نسخه سرور ۱');

click('#sync-pull');
assert('سرور: دریافت وضعیت از سرور', await waitFor(() => text('#backend-note').includes('دریافت شد')), text('#backend-note'));

click('.nav-item[data-route="users"]');
await waitFor(() => countRows('#users-table') === 1, 4000);
assert('سرور: فهرست کاربران از سرور', countRows('#users-table') === 1, String(countRows('#users-table')));
contains('سرور: نقش مدیر در فهرست سرور', text('#users-table'), 'مدیر سامانه');

click('#user-new');
setField('uf-name', 'کارشناس سرور');
setField('uf-username', 'server.expert');
setSelectValue('#uf-role', 'EXPERT');
setField('uf-password', 'Expert@1405');
submit('#user-form');
assert('سرور: ایجاد کاربر از رابط', await waitFor(() => countRows('#users-table') === 2, 5000), String(countRows('#users-table')));
contains('سرور: کاربر جدید در فهرست', text('#users-table'), 'server.expert');

await waitFor(() => text('#activity-count').length > 0, 3000);
contains('سرور: آینه‌سازی رویداد در گزارش محلی', text('#activity-table'), 'ایجاد کاربر');

const audit = await (async () => {
  const token = sessionStore.get('mashaqel.backend.token');
  const response = await nativeFetch(`${apiBase}/api/activity?limit=50`, { headers: { authorization: `Bearer ${token}` } });
  return response.json();
})();
assert('سرور: رویداد ایجاد کاربر روی سرور ثبت شد', audit.events.some((event) => event.detail.includes('server.expert')), JSON.stringify(audit.events?.slice(0, 2)));

click('#logout-btn');
assert('سرور: خروج، دروازه ورود را نشان می‌دهد', document.querySelector('#auth-gate')?.hidden === false && document.querySelector('#auth-login')?.hidden === false);

setField('al-username', 'server.admin');
setField('al-password', 'Wrong1234');
submit('#auth-login');
assert('سرور: پیام رمز نادرست از سرور', await waitFor(() => text('#auth-login-msg').includes('نادرست')), text('#auth-login-msg'));

setField('al-username', 'server.admin');
setField('al-password', 'Server@1405');
submit('#auth-login');
assert('سرور: ورود مجدد موفق', await waitFor(() => document.querySelector('#auth-gate')?.hidden === true));

/* -------------------------------- نتیجه -------------------------------- */

const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.label}${check.ok ? '' : ` → ${check.detail}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} بررسی حالت سرور موفق.`);
console.log(`خطاهای زمان اجرا: ${errors.length}`);
for (const error of errors) console.log(error?.stack ?? error);

await new Promise((resolveClose) => app.server.close(resolveClose));
try {
  readFileSync(dbPath);
  const { unlinkSync } = await import('node:fs');
  unlinkSync(dbPath);
} catch {
  /* فایل موقت وجود ندارد */
}

if (failed.length > 0 || errors.length > 0) process.exitCode = 1;
