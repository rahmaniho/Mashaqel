/**
 * وب‌اپ مشاغل — لایه رابط کاربری
 * داده‌ها از ./data/mashaqel-data.json (خروجی موتور) و محاسبات از ./engine-core.js خوانده می‌شود.
 */

import * as core from './engine-core.js';

const state = {
  data: null,
  digits: 'fa',
  wageResult: null,
  seniorityResult: null,
  groupResult: null,
  evalResult: null,
  evalControls: [],
  store: { workshops: [], activeWorkshopId: null, units: [], jobs: [], employees: [], activityLog: [] },
  started: false,
};

const NUMBER_FORMAT = {
  fa: new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
};

const STATUS_CHIP_CLASS = {
  '1_VERIFIED_USABLE': 'st-1',
  '2_EXTRACTED_NEEDS_VERIFICATION': 'st-2',
  '3_INSUFFICIENT_DOCUMENTATION': 'st-3',
  '4_REQUIRES_WORKSHOP_APPROVED_SCHEME': 'st-4',
};

const STATUS_SHORT = {
  '1_VERIFIED_USABLE': '۱. مستند و قابل استفاده',
  '2_EXTRACTED_NEEDS_VERIFICATION': '۲. نیازمند تطبیق',
  '3_INSUFFICIENT_DOCUMENTATION': '۳. فاقد مستند کافی',
  '4_REQUIRES_WORKSHOP_APPROVED_SCHEME': '۴. نیازمند طرح کارگاه',
};

const CATEGORY_LABELS = {
  JOB_WAGE: 'مزد شغل',
  SENIORITY: 'پایه سنوات',
  BASE_WAGE: 'اجزای مزد مبنا',
  WAGE_ALLOWANCE: 'فوق‌العاده‌ها و مزایای مزدی',
  WELFARE: 'مزایای رفاهی و انگیزشی — جدا از مزد شغل و مزد مبنا',
  DEDUCTION: 'کسورات قانونی',
};

const SHIFT_LABELS = {
  NONE: 'بدون نوبت‌کاری',
  MORNING_EVENING: 'صبح و عصر',
  MORNING_EVENING_NIGHT: 'صبح، عصر و شب',
  DAY_NIGHT: 'صبح و شب',
  ROTATING_24_7: 'گردشی ۲۴ ساعته',
};

const INTENSITY_LABELS = { MODERATE: 'متوسط', HIGH: 'زیاد', SEVERE: 'شدید' };
const BRACKET_LABELS = { B2: 'تا ۲ ساعت', B4: 'تا ۴ ساعت', B6: 'تا ۶ ساعت', B8: 'بیش از ۶ ساعت' };
const PROBABILITY_LABELS = { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد', VERY_HIGH: 'خیلی زیاد' };

const $ = (selector) => document.querySelector(selector);

function fmt(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const formatter = new Intl.NumberFormat(state.digits === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  return formatter.format(Number(value));
}

const ASCII_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function localizeDigits(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (state.digits !== 'fa') return text;
  return text.replace(/[0-9]/g, (digit) => ASCII_DIGITS[Number(digit)]).replace(/,/g, '٬');
}

function selectValue(select, fallback = '') {
  if (!select) return fallback;
  if (select.value !== undefined && select.value !== null && select.value !== '') return select.value;
  const selected = select.querySelector?.('option[selected]') ?? select.querySelector?.('option');
  return selected?.getAttribute?.('value') ?? fallback;
}

function money(value) {
  return `<span class="num">${fmt(value)}</span>`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chip(status) {
  const cls = STATUS_CHIP_CLASS[status] ?? 'neutral';
  return `<span class="chip ${cls}" title="${escapeHtml(core.STATUS_LABELS[status] ?? status)}">${escapeHtml(STATUS_SHORT[status] ?? status)}</span>`;
}

function rateOf(levelId) {
  const scores = state.data.scores
    .filter((row) => row.levelId === levelId)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return scores[0]?.points ?? 0;
}

function subFactorsOf(systemCode) {
  const factorCodes = new Set(state.data.factors.filter((f) => f.systemCode === systemCode).map((f) => f.code));
  return state.data.subFactors
    .filter((row) => factorCodes.has(row.factorCode))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function factorOf(sub) {
  return state.data.factors.find((row) => row.code === sub.factorCode);
}

/* ============================== تب‌ها و ارقام ============================== */

/* ======================= ذخیره‌سازی محلی و مدل کارگاه ======================= */

const STORAGE_KEY = 'mashaqel.state.v2';
const SCHEME_STATUS_LABELS = {
  NOT_STARTED: 'شروع نشده',
  IN_PROGRESS: 'در حال اجرا',
  EXECUTED: 'اجرا شده',
};

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      workshops: Array.isArray(parsed?.workshops) ? parsed.workshops : [],
      activeWorkshopId: parsed?.activeWorkshopId ?? null,
      units: Array.isArray(parsed?.units) ? parsed.units : [],
      jobs: Array.isArray(parsed?.jobs) ? parsed.jobs : [],
      employees: Array.isArray(parsed?.employees) ? parsed.employees : [],
      activityLog: Array.isArray(parsed?.activityLog) ? parsed.activityLog : [],
    };
  } catch {
    return { workshops: [], activeWorkshopId: null, units: [], jobs: [], employees: [], activityLog: [] };
  }
}

function writeStore(patch) {
  const next = {
    workshops: state.store.workshops,
    activeWorkshopId: state.store.activeWorkshopId,
    units: state.store.units ?? [],
    jobs: state.store.jobs ?? [],
    employees: state.store.employees ?? [],
    activityLog: state.store.activityLog ?? [],
    ...patch,
  };
  state.store = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    showToast(`ذخیره‌سازی محلی ناموفق بود: ${error.message}`);
  }
  renderWorkshopPicker();
  renderWorkshopTable();
  if (state.data) {
    renderDashboard();
    renderJobsView();
    renderEvalJobOptions();
    renderGroupJobsComparison();
    renderOrgView();
    renderEmployeesView();
    renderArrearsView();
    renderReportsView();
    renderSettingsMeta();
  }
}

function newId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return `${prefix}-${random.slice(0, 8)}`;
}

function activeWorkshop() {
  const workshop = state.store.workshops.find((row) => row.id === state.store.activeWorkshopId) ?? null;
  if (!workshop) return null;
  return isWorkshopAllowed(workshop.id) ? workshop : null;
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3800);
}

/* ================================= مسیریابی ================================= */

const ROUTES = {
  dashboard: {
    title: 'داشبورد',
    subtitle: 'نمای کلی سامانه و وضعیت داده‌های محاسباتی',
    view: 'view-dashboard',
  },
  workshops: {
    title: 'مدیریت کارگاه‌ها',
    subtitle: 'تعریف کارگاه، شناسه‌ها و وضعیت اجرای طرح طبقه‌بندی',
    view: 'view-workshops',
  },
  org: {
    title: 'ساختار سازمانی',
    subtitle: 'درخت واحدها، کد یکتا، واحد بالادست و اتصال مشاغل به واحدها',
    view: 'view-org',
  },
  employees: {
    title: 'مدیریت کارکنان',
    subtitle: 'پرونده پرسنلی، قرارداد، جایگاه سازمانی، داده مزد و تاریخچه ارتقا',
    view: 'view-employees',
  },
  users: {
    title: 'مدیریت کاربران',
    subtitle: 'نقش‌ها، کارگاه‌های مجاز و گزارش فعالیت',
    view: 'view-users',
  },
  reports: {
    title: 'گزارش‌ها',
    subtitle: 'گزارش‌ساز رسمی با سربرگ کارگاه، خروجی PDF/Excel و مقایسه چندشغلی',
    view: 'view-reports',
  },
  arrears: {
    title: 'محاسبه معوقات',
    subtitle: 'مابه‌التفاوت مزد استحقاقی و پرداختی، ماه‌به‌ماه با تغییرات مؤثر تاریخ‌دار',
    view: 'view-arrears',
  },
  jobs: {
    title: 'بانک مشاغل',
    subtitle: 'پرونده کامل شغل، شناسنامه قابل چاپ و اتصال به نتیجه ارزیابی',
    view: 'view-jobs',
  },
  'job-profile': {
    title: 'شناسنامه شغل',
    subtitle: 'نسخه قابل چاپ پرونده شغل',
    view: 'view-job-profile',
  },
  payroll: {
    title: 'محاسبات حقوق و دستمزد',
    subtitle: 'مزد ۱۴۰۵، پایه سنوات گروهی و خالص پرداختی — واحد ریال',
    view: 'view-payroll',
  },
  group: {
    title: 'تعیین گروه شغلی',
    subtitle: 'تطبیق امتیاز شغل با دامنه امتیاز مصوب گروه‌ها',
    view: 'view-group',
  },
  evaluation: {
    title: 'ارزیابی مشاغل',
    subtitle: 'نظام امتیازی چهارعاملی ۱۳۸۹ با جدول‌های رسمی',
    view: 'view-evaluation',
  },
  settings: {
    title: 'تنظیمات',
    subtitle: 'پشتیبان‌گیری، بازیابی و مشخصات فنی نسخه',
    view: 'view-settings',
  },
};
const DEFAULT_ROUTE = 'dashboard';

function navigate(route, options = {}) {
  const target = ROUTES[route] ? route : DEFAULT_ROUTE;
  document.querySelectorAll('.nav-item').forEach((item) => {
    const isActive = item.dataset.route === target;
    item.classList.toggle('is-active', isActive);
    if (isActive) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('is-active', view.id === ROUTES[target].view);
  });
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');
  if (title) title.textContent = ROUTES[target].title;
  if (subtitle) subtitle.textContent = ROUTES[target].subtitle;
  document.body.classList.remove('sidebar-open');
  if (!options.silent) {
    try {
      const hash = `#/${target}`;
      if (window.location?.hash !== hash) window.location.hash = hash;
    } catch {
      /* محیط‌های بدون location */
    }
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (target === 'dashboard') renderDashboard();
  if (target === 'workshops') {
    renderWorkshopTable();
    renderWorkshopPicker();
  }
  if (target === 'org') renderOrgView();
  if (target === 'employees') renderEmployeesView();
  if (target === 'arrears') renderArrearsView();
  if (target === 'reports') renderReportsView();
  if (target === 'users') renderUsersView();
  applyRouteAccess(target);
  if (target === 'jobs') renderJobsView();
  if (target === 'evaluation') renderEvalJobOptions();
  if (target === 'group') renderGroupJobsComparison();
}

function currentHashRoute() {
  try {
    return (window.location?.hash ?? '').replace('#/', '').replace('#', '');
  } catch {
    return '';
  }
}

function initRouter() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (item.disabled) return;
      navigate(item.dataset.route);
    });
  });
  document.querySelectorAll('[data-route]').forEach((element) => {
    if (element.classList.contains('nav-item')) return;
    element.addEventListener('click', () => navigate(element.dataset.route));
  });
  const toggle = document.getElementById('menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  }
  window.addEventListener('hashchange', () => {
    const route = currentHashRoute();
    if (route) navigate(route, { silent: true });
  });
  const initial = currentHashRoute();
  navigate(initial && ROUTES[initial] ? initial : DEFAULT_ROUTE, { silent: true });
}

function initSubtabs() {
  document.querySelectorAll('.subtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.subtab;
      document.querySelectorAll('.subtab').forEach((item) => {
        item.classList.toggle('is-active', item === tab);
        item.setAttribute('aria-selected', String(item === tab));
      });
      document.querySelectorAll('.subview').forEach((view) => {
        view.classList.toggle('is-active', view.id === `sub-${name}`);
      });
    });
  });
}

/* ================================= داشبورد ================================= */

function wageRowsOf(fiscalYear) {
  return wageRowsCache[fiscalYear] ?? [];
}

const wageRowsCache = {};

function initWageRows() {
  for (const year of [1404, 1405]) {
    wageRowsCache[year] = state.data.wageTables
      .filter((row) => row.fiscalYear === year && row.schemeCode === 'SERVICE_COMPANIES_NATIONWIDE')
      .sort((a, b) => a.groupNumber - b.groupNumber);
  }
}

function renderDashboard() {
  if (!state.data) return;
  const workshop = activeWorkshop();
  const rows1405 = wageRowsOf(1405);
  const rows1404 = wageRowsOf(1404);
  const rateG1 = core.getSeniorityRate(state.data, {
    schemeCode: 'NATIONAL_20_GROUP_1389',
    group: 1,
    fiscalYear: 1405,
    asOfDate: '1405-05-01',
  });
  const params = state.data.annualParameters.find((row) => row.fiscalYear === 1405 && row.version === '1405-v2');
  const systemB = state.data.systems.find((row) => row.code === 'EVAL_1389_POINT_FACTOR');
  const jobs = workshopJobs();
  const evaluatedJobs = jobs.filter((job) => job.evaluation).length;

  const kpiTarget = document.getElementById('kpi-grid');
  if (!kpiTarget) return;
  kpiTarget.innerHTML = `
    <div class="kpi is-navy">
      <span class="kpi-label">کارگاه فعال</span>
      <span class="kpi-value">${workshop ? escapeHtml(workshop.workshopName) : 'تعریف نشده'}</span>
      <span class="kpi-unit">${workshop ? `${escapeHtml(workshop.companyName)} — ${SCHEME_STATUS_LABELS[workshop.schemeStatus] ?? ''}` : 'از بخش مدیریت کارگاه‌ها اضافه کنید'}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">مزد شغل روزانه گروه ۱ (۱۴۰۵)</span>
      <span class="kpi-value">${fmt(rows1405[0]?.dailyJobWage ?? core.MIN_DAILY_1405)}</span>
      <span class="kpi-unit">ریال — کف ${fmt(core.MIN_DAILY_1405)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">نرخ پایه سنوات گروه ۱ (۱۴۰۵)</span>
      <span class="kpi-value">${rateG1.available ? fmt(rateG1.rate) : '—'}</span>
      <span class="kpi-unit">ریال در روز</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">مشاغل بانک شغل</span>
      <span class="kpi-value">${fmt(jobs.length)}</span>
      <span class="kpi-unit">${fmt(evaluatedJobs)} ارزیابی‌شده — امتیاز نظری ${fmt(systemB?.maxTheoreticalScore ?? 1137)}</span>
    </div>`;

  const note = document.getElementById('wage-chart-note');
  if (note) note.textContent = `نسخه پارامتر ${params?.version ?? '1405-v2'} — ${fmt(rows1405.length)} گروه`;

  renderBarChart(rows1405, rows1404);
  renderSeniorityChart();
  renderDataStatus();
  renderLimitations();
}

function renderBarChart(rows1405, rows1404) {
  const container = document.getElementById('wage-chart');
  if (!container) return;
  if (rows1405.length === 0) {
    container.innerHTML = '<div class="empty-state">جدول مزد ۱۴۰۵ بارگذاری نشده است.</div>';
    return;
  }
  const width = 640;
  const height = 230;
  const padding = { top: 14, right: 10, bottom: 26, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(...rows1405.map((row) => row.dailyJobWage)) * 1.05;
  const min = Math.min(...rows1405.map((row) => row.dailyJobWage)) * 0.95;
  const scale = (value) => padding.top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;
  const slot = innerWidth / rows1405.length;
  const barWidth = Math.max(8, slot * 0.62);

  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const value = min + (max - min) * ratio;
      const y = scale(value);
      return `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />
        <text class="axis-label" x="${padding.left - 6}" y="${y + 3}" text-anchor="end">${fmt(Math.round(value / 1000))}ه</text>`;
    })
    .join('');

  const bars = rows1405
    .map((row, index) => {
      const x = padding.left + index * slot + (slot - barWidth) / 2;
      const y = scale(row.dailyJobWage);
      const previous = rows1404[index];
      const growth = previous ? ((row.dailyJobWage - previous.dailyJobWage) / previous.dailyJobWage) * 100 : null;
      const title = `گروه ${row.groupNumber}: ${fmt(row.dailyJobWage)} ریال${growth === null ? '' : ` — رشد ${fmt(growth, 1)}٪`}`;
      return `<rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${padding.top + innerHeight - y}" rx="2">
          <title>${escapeHtml(title)}</title>
        </rect>
        <text class="axis-label" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${fmt(row.groupNumber)}</text>`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار مزد روزانه ۱۴۰۵ به تفکیک گروه">${gridLines}${bars}</svg>`;
}

function renderSeniorityChart() {
  const container = document.getElementById('seniority-chart');
  if (!container) return;
  const rows = state.data.seniorityTables
    .filter((row) => row.tableType === 'CUMULATIVE_PAST_SERVICE' && row.yearsOfService !== null)
    .sort((a, b) => a.yearsOfService - b.yearsOfService);
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty-state">جدول سنوات تجمیعی در دسترس نیست.</div>';
    return;
  }
  const width = 640;
  const height = 230;
  const padding = { top: 14, right: 12, bottom: 26, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxYears = rows[rows.length - 1].yearsOfService;
  const maxValue = Math.max(...rows.map((row) => row.dailySeniorityAmount));
  const x = (years) => padding.left + (years / maxYears) * innerWidth;
  const y = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;

  const points = rows.map((row) => `${x(row.yearsOfService).toFixed(1)},${y(row.dailySeniorityAmount).toFixed(1)}`);
  const area = `M${padding.left},${padding.top + innerHeight} L${points.join(' L')} L${padding.left + innerWidth},${padding.top + innerHeight} Z`;
  const labels = rows
    .filter((row) => row.yearsOfService % 5 === 0)
    .map(
      (row) =>
        `<text class="axis-label" x="${x(row.yearsOfService)}" y="${height - 10}" text-anchor="middle">${fmt(row.yearsOfService)}</text>`,
    )
    .join('');
  const grid = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const value = maxValue * ratio;
      return `<line class="grid-line" x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" />
        <text class="axis-label" x="${padding.left - 6}" y="${y(value) + 3}" text-anchor="end">${fmt(Math.round(value / 1000))}ه</text>`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار سنوات تجمیعی تا پایان ۱۴۰۴">
      ${grid}
      <path class="area-path" d="${area}" />
      <path class="line-path" d="M${points.join(' L')}" />
      ${labels}
    </svg>`;
}

function renderDataStatus() {
  const target = document.getElementById('data-status');
  if (!target) return;
  const counts = [
    ['جدول مزد ۱۴۰۴ و ۱۴۰۵', `${fmt(state.data.wageTables.length)} ردیف`],
    ['نرخ و سنوات تجمیعی', `${fmt(state.data.seniorityTables.length)} ردیف`],
    ['بازه امتیاز گروه‌ها', `${fmt(state.data.groupRanges.length)} بازه`],
    ['سطوح امتیازی بارگذاری‌شده', `${fmt(state.data.levels.length)} سطح`],
    ['امتیازهای ثبت‌شده', `${fmt(state.data.scores.length)} رکورد`],
    ['نسخه پارامترهای سالانه', `${fmt(state.data.annualParameters.filter((row) => row.fiscalYear === 1405).length)} نسخه ۱۴۰۵`],
    ['کارگاه‌های ثبت‌شده', `${fmt(state.store.workshops.length)} کارگاه`],
  ];
  target.innerHTML = counts.map(([label, value]) => `<li><span>${label}</span><b>${value}</b></li>`).join('');
}

function renderLimitations() {
  const target = document.getElementById('limitations');
  if (!target) return;
  const items = [
    'پلکان مالیات بر حقوق ۱۴۰۵ ثبت نشده است؛ مالیات صفر با هشدار محاسبه می‌شود.',
    'جدول رسمی «مسئولیت ایمنی دیگران» در دسترس نیست؛ این زیرعامل غیرفعال است و امتیاز کل «ناقص» علامت می‌خورد.',
    'نظام ارزیابی ۱۳۹۵ بدون «طرح مصوب کارگاه» با شماره تأییدیه اداره کل روابط کار فعال نمی‌شود.',
    'این نسخه بدون Backend است؛ داده‌ها تنها در همین مرورگر ذخیره می‌شوند و پشتیبان‌گیری دستی لازم است.',
  ];
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

/* ============================== مدیریت کارگاه‌ها ============================== */

function renderWorkshopPicker() {
  const select = document.getElementById('active-workshop');
  if (!select) return;
  const options = ['<option value="">بدون کارگاه (پیش‌فرض)</option>'];
  for (const workshop of state.store.workshops.filter((row) => isWorkshopAllowed(row.id))) {
    options.push(
      `<option value="${escapeHtml(workshop.id)}">${escapeHtml(workshop.workshopName)} — ${escapeHtml(workshop.workshopCode)}</option>`,
    );
  }
  select.innerHTML = options.join('');
  setElementValue(select, state.store.activeWorkshopId ?? '');
}

function initWorkshops() {
  const picker = document.getElementById('active-workshop');
  if (picker) {
    picker.addEventListener('change', () => {
      const value = selectValue(picker, '');
      writeStore({ ...state.store, activeWorkshopId: value || null });
      const workshop = activeWorkshop();
      showToast(workshop ? `کارگاه فعال: ${workshop.workshopName}` : 'کارگاه فعال حذف شد');
      renderWorkshopTable();
    });
  }

  const form = document.getElementById('workshop-form');
  const newButton = document.getElementById('workshop-new');
  const cancelButton = document.getElementById('workshop-cancel');

  if (newButton) {
    newButton.addEventListener('click', () => openWorkshopForm(null));
  }
  if (cancelButton) {
    cancelButton.addEventListener('click', () => closeWorkshopForm());
  }
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveWorkshopFromForm();
    });
  }
  const table = document.getElementById('workshop-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const workshop = state.store.workshops.find((row) => row.id === button.dataset.id);
      if (!workshop) return;
      if (button.dataset.action === 'edit') openWorkshopForm(workshop);
      if (button.dataset.action === 'activate') {
        writeStore({ ...state.store, activeWorkshopId: workshop.id });
        renderWorkshopTable();
        showToast(`کارگاه فعال: ${workshop.workshopName}`);
      }
      if (button.dataset.action === 'delete') {
        if (!ensureAdmin('حذف کارگاه')) return;
        const jobCount = state.store.jobs.filter((job) => job.workshopId === workshop.id).length;
        const confirmed = typeof window.confirm === 'function'
          ? window.confirm(
              `حذف کارگاه «${workshop.workshopName}»${jobCount > 0 ? ` همراه با ${jobCount} شغل ثبت‌شده آن` : ''}؟ این عمل قابل بازگشت نیست.`,
            )
          : true;
        if (!confirmed) return;
        const workshops = state.store.workshops.filter((row) => row.id !== workshop.id);
        const activeWorkshopId = state.store.activeWorkshopId === workshop.id ? null : state.store.activeWorkshopId;
        const jobs = state.store.jobs.filter((job) => job.workshopId !== workshop.id);
        logActivity('workshops', 'DELETE', `حذف کارگاه «${workshop.workshopName}» با ${jobCount} شغل وابسته`);
        writeStore({ workshops, activeWorkshopId, jobs });
        renderWorkshopTable();
        renderJobsView();
        showToast('کارگاه و داده‌های وابسته حذف شد');
      }
    });
  }
  renderWorkshopPicker();
  renderWorkshopTable();
}

function openWorkshopForm(workshop) {
  if (!ensureWrite('workshops', 'ویرایش کارگاه')) return;
  const form = document.getElementById('workshop-form');
  if (!form) return;
  form.hidden = false;
  setElementValue(document.getElementById('wf-id'), workshop?.id ?? '');
  setElementValue(document.getElementById('wf-company'), workshop?.companyName ?? '');
  setElementValue(document.getElementById('wf-name'), workshop?.workshopName ?? '');
  setElementValue(document.getElementById('wf-code'), workshop?.workshopCode ?? '');
  setElementValue(document.getElementById('wf-national'), workshop?.nationalId ?? '');
  setElementValue(document.getElementById('wf-activity'), workshop?.activityType ?? 'تولیدی');
  setElementValue(document.getElementById('wf-employees'), workshop?.employeeCount ?? 0);
  setElementValue(document.getElementById('wf-manager'), workshop?.managerName ?? '');
  setElementValue(document.getElementById('wf-phone'), workshop?.phone ?? '');
  setElementValue(document.getElementById('wf-established'), workshop?.establishedDate ?? '');
  setElementValue(document.getElementById('wf-scheme'), workshop?.schemeStatus ?? 'NOT_STARTED');
  setElementValue(document.getElementById('wf-address'), workshop?.address ?? '');
  document.getElementById('workshop-error').textContent = '';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeWorkshopForm() {
  const form = document.getElementById('workshop-form');
  if (form) form.hidden = true;
  const error = document.getElementById('workshop-error');
  if (error) error.textContent = '';
}

function saveWorkshopFromForm() {
  if (!ensureWrite('workshops', 'ذخیره کارگاه')) return;
  const errorTarget = document.getElementById('workshop-error');
  const id = document.getElementById('wf-id').value;
  const draft = {
    id: id || newId('ws'),
    companyName: document.getElementById('wf-company').value.trim(),
    workshopName: document.getElementById('wf-name').value.trim(),
    workshopCode: document.getElementById('wf-code').value.trim(),
    nationalId: document.getElementById('wf-national').value.trim(),
    activityType: document.getElementById('wf-activity').value,
    employeeCount: Number(document.getElementById('wf-employees').value || 0),
    managerName: document.getElementById('wf-manager').value.trim(),
    phone: document.getElementById('wf-phone').value.trim(),
    establishedDate: document.getElementById('wf-established').value.trim(),
    schemeStatus: document.getElementById('wf-scheme').value,
    address: document.getElementById('wf-address').value.trim(),
    createdAt: state.store.workshops.find((row) => row.id === id)?.createdAt ?? new Date().toISOString(),
  };

  const problems = [];
  if (!draft.companyName) problems.push('نام شرکت الزامی است.');
  if (!draft.workshopName) problems.push('نام کارگاه الزامی است.');
  if (!draft.workshopCode) problems.push('کد کارگاه الزامی است.');
  if (draft.workshopCode && !/^[A-Za-z0-9-]{3,20}$/.test(draft.workshopCode)) {
    problems.push('کد کارگاه باید ۳ تا ۲۰ نویسه لاتین/رقم باشد.');
  }
  if (draft.nationalId && !/^\d{10,11}$/.test(draft.nationalId)) {
    problems.push('شناسه ملی باید ۱۰ یا ۱۱ رقم باشد.');
  }
  if (
    draft.workshopCode &&
    state.store.workshops.some((row) => row.id !== draft.id && row.workshopCode === draft.workshopCode)
  ) {
    problems.push('این کد کارگاه قبلاً ثبت شده است.');
  }
  if (draft.establishedDate && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(draft.establishedDate)) {
    problems.push('تاریخ تأسیس باید به شکل 1400-01-01 باشد.');
  }
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }

  const exists = state.store.workshops.some((row) => row.id === draft.id);
  const workshops = exists
    ? state.store.workshops.map((row) => (row.id === draft.id ? draft : row))
    : [...state.store.workshops, draft];
  const activeWorkshopId = state.store.activeWorkshopId ?? draft.id;
  writeStore({ workshops, activeWorkshopId });
  closeWorkshopForm();
  renderWorkshopTable();
  logActivity('workshops', exists ? 'UPDATE' : 'CREATE', `${exists ? 'ویرایش' : 'ایجاد'} کارگاه «${draft.workshopName}» (کد ${draft.workshopCode})`);
  showToast(exists ? 'کارگاه ویرایش شد' : 'کارگاه جدید ثبت شد');
}

function renderWorkshopTable() {
  const table = document.getElementById('workshop-table');
  if (!table) return;
  const scopedWorkshops = state.store.workshops.filter((row) => isWorkshopAllowed(row.id));
  if (scopedWorkshops.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>
            <div class="empty-state">
              هنوز کارگاهی ثبت نشده است. با دکمه «کارگاه جدید» اولین کارگاه را تعریف کنید.
              هر کارگاه داده و جداول مستقل دارد و از نوار بالای صفحه انتخاب می‌شود.
            </div>
          </td>
        </tr>
      </tbody>`;
    return;
  }
  table.innerHTML = `
    <thead>
      <tr>
        <th>کارگاه</th><th>شرکت</th><th>کد کارگاه</th><th>شناسه ملی</th><th>فعالیت</th>
        <th>کارکنان</th><th>مدیر</th><th>اجرای طرح</th><th>عملیات</th>
      </tr>
    </thead>
    <tbody>
      ${scopedWorkshops
        .map((workshop) => {
          const isActive = workshop.id === state.store.activeWorkshopId;
          return `<tr class="${isActive ? 'is-highlight' : ''}">
            <td>
              <strong>${escapeHtml(workshop.workshopName)}</strong>
              ${isActive ? '<div class="chip st-1">کارگاه فعال</div>' : ''}
            </td>
            <td>${escapeHtml(workshop.companyName)}</td>
            <td class="num">${escapeHtml(workshop.workshopCode)}</td>
            <td class="num">${escapeHtml(workshop.nationalId || '—')}</td>
            <td>${escapeHtml(workshop.activityType)}</td>
            <td class="num">${fmt(workshop.employeeCount)}</td>
            <td>${escapeHtml(workshop.managerName || '—')}</td>
            <td>${escapeHtml(SCHEME_STATUS_LABELS[workshop.schemeStatus] ?? '—')}</td>
            <td>
              <button type="button" class="icon-btn" data-action="activate" data-id="${escapeHtml(workshop.id)}" title="فعال‌سازی" ${isActive ? 'disabled' : ''}>✓</button>
              <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(workshop.id)}" title="ویرایش">✎</button>
              <button type="button" class="icon-btn" data-action="delete" data-id="${escapeHtml(workshop.id)}" title="حذف">✕</button>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

/* ================================ تنظیمات ================================ */

function initSettings() {
  const exportButton = document.getElementById('export-data');
  const importInput = document.getElementById('import-data');
  const clearButton = document.getElementById('clear-data');
  const message = document.getElementById('settings-message');

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      if (!ensureWrite('settings', 'پشتیبان‌گیری')) return;
      const payload = {
        schema: 'mashaqel.local-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        currency: 'IRR',
        state: state.store,
      };
      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mashaqel-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        logActivity('settings', 'BACKUP', `پشتیبان‌گیری کامل (${state.store.workshops.length} کارگاه، ${state.store.jobs.length} شغل، ${state.store.employees.length} کارمند)`);
        if (message) message.textContent = 'فایل پشتیبان ساخته شد.';
      } catch {
        if (message) message.textContent = 'ساخت فایل پشتیبان در این مرورگر ممکن نشد.';
      }
    });
  }

  if (importInput) {
    importInput.addEventListener('change', async () => {
      if (!ensureAdmin('بازیابی پشتیبان')) return;
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const incoming = parsed?.state ?? parsed;
        if (!Array.isArray(incoming?.workshops)) throw new Error('ساختار فایل معتبر نیست (workshops یافت نشد).');
        writeStore({
          workshops: incoming.workshops,
          activeWorkshopId: incoming.activeWorkshopId ?? null,
          jobs: Array.isArray(incoming.jobs) ? incoming.jobs : state.store.jobs,
        });
        renderWorkshopTable();
        renderSettingsMeta();
        logActivity('settings', 'RESTORE', `بازیابی پشتیبان با ${incoming.workshops.length} کارگاه`);
        if (message) message.textContent = `بازیابی انجام شد: ${incoming.workshops.length} کارگاه.`;
        showToast('داده‌ها بازیابی شد');
      } catch (error) {
        if (message) message.textContent = `بازیابی ناموفق: ${error.message}`;
      } finally {
        importInput.value = '';
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (!ensureAdmin('پاک‌سازی داده‌ها')) return;
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm('تمام داده‌های محلی (کارگاه‌ها و انتخاب‌ها) پاک شود؟ از فایل پشتیبان مطمئن شوید.')
        : true;
      if (!confirmed) return;
      localStorage.removeItem(STORAGE_KEY);
      state.store = readStore();
      renderWorkshopPicker();
      renderWorkshopTable();
      renderJobsView();
      renderSettingsMeta();
      renderDashboard();
      logActivity('settings', 'CLEAR', 'پاک‌سازی کامل داده‌های محلی');
      if (message) message.textContent = 'داده‌های محلی پاک شد.';
    });
  }
  renderSettingsMeta();
}

function renderSettingsMeta() {
  const target = document.getElementById('settings-meta');
  if (!target || !state.data) return;
  const meta = state.data.meta;
  const items = [
    ['نسخه موتور', meta.engineVersion],
    ['منبع داده', meta.source],
    ['واحد پول', 'IRR (ریال ایران)'],
    ['زمان تولید داده', new Date(meta.generatedAt).toLocaleString('fa-IR')],
    ['کارگاه‌های ثبت‌شده', fmt(state.store.workshops.length)],
    ['واحدهای سازمانی', fmt(state.store.units.length)],
    ['کارکنان ثبت‌شده', fmt(state.store.employees.length)],
    ['مشاغل ثبت‌شده', fmt(state.store.jobs.length)],
    ['مشاغل ارزیابی‌شده', fmt(state.store.jobs.filter((job) => job.evaluation).length)],
    ['کلید ذخیره‌سازی محلی', STORAGE_KEY],
  ];
  target.innerHTML = items
    .map(([label, value]) => `<li><span>${label}</span><b dir="auto">${escapeHtml(String(value))}</b></li>`)
    .join('');
}

function initDigits() {
  const saved = localStorage.getItem('mashaqel-digits');
  state.digits = saved === 'en' ? 'en' : 'fa';
  const button = $('#digits-toggle');
  const sync = () => {
    button.textContent = state.digits === 'fa' ? 'ارقام: فارسی' : 'ارقام: لاتین';
  };
  sync();
  button.addEventListener('click', () => {
    state.digits = state.digits === 'fa' ? 'en' : 'fa';
    localStorage.setItem('mashaqel-digits', state.digits);
    sync();
    refreshFormattedViews();
  });
}

function refreshFormattedViews() {
  renderSeniorityTables();
  renderGroupTable();
  if (state.data) {
    renderDashboard();
    renderWorkshopTable();
    renderSettingsMeta();
  }
  if (state.wageResult) renderWage(state.wageResult);
  if (state.seniorityResult) calcSeniority();
  if (state.groupResult) calcGroup();
  if (state.evalResult) {
    try {
      computeEval();
    } catch {
      /* ورودی نامعتبر را نادیده بگیر */
    }
  }
}

/* ================================ مزد ۱۴۰۵ ================================ */

function initWage() {
  const schemeSelect = $('#w-scheme');
  const schemes = core.listWageSchemes(state.data);
  const preferred = schemes.some((row) => row.schemeCode === 'SERVICE_COMPANIES_NATIONWIDE')
    ? 'SERVICE_COMPANIES_NATIONWIDE'
    : schemes[0]?.schemeCode;
  schemeSelect.innerHTML = schemes
    .map(
      (scheme) =>
        `<option value="${scheme.schemeCode}" ${scheme.schemeCode === preferred ? 'selected' : ''}>${escapeHtml(scheme.schemeTitle)}</option>`,
    )
    .join('');

  const groupSelect = $('#w-group');
  groupSelect.innerHTML = Array.from({ length: 20 }, (_, index) => {
    const group = index + 1;
    return `<option value="${group}" ${group === 8 ? 'selected' : ''}>گروه ${fmt(group)}</option>`;
  }).join('');

  const paramSelect = $('#w-param-version');
  const params = state.data.annualParameters.filter((row) => row.fiscalYear === 1405);
  paramSelect.innerHTML =
    `<option value="">خودکار (آخرین نسخه معتبر تا تاریخ)</option>` +
    params
      .map(
        (row) =>
          `<option value="${row.version}">${row.version} — مسکن ${fmt(row.housingAllowanceMonthly)} ریال (${STATUS_SHORT[row.validityStatus]})</option>`,
      )
      .join('');

  $('#w-married').checked = true;
  $('#w-children').value = 1;
  $('#w-acc').value = 166_667;
  $('#w-service').value = 2;

  const syncPrior = () => {
    const group = Number(selectValue(groupSelect, '8'));
    const prior = core.findWageTable(state.data, {
      schemeCode: selectValue(schemeSelect, 'SERVICE_COMPANIES_NATIONWIDE'),
      fiscalYear: 1404,
      group,
      asOfDate: $('#w-date').value || '1405-03-15',
    });
    if (prior) {
      if (!$('#w-prior').dataset.touched) {
        $('#w-prior').value = prior.dailyJobWage;
      }
      $('#w-prior-hint').textContent = `مزد مصوب همین گروه در ۱۴۰۴: ${fmt(prior.dailyJobWage)} ریال (قابل ویرایش)`;
    } else {
      $('#w-prior-hint').textContent = 'جدول مزد ۱۴۰۴ برای این گروه در دسترس نیست.';
    }
    const rate = core.getSeniorityRate(state.data, {
      schemeCode: selectValue(schemeSelect, 'SERVICE_COMPANIES_NATIONWIDE'),
      group,
      fiscalYear: 1405,
      asOfDate: $('#w-date').value || '1405-03-15',
    });
    const serviceField = document.getElementById('w-service')?.closest('.field');
    const hint = serviceField?.querySelector('.hint');
    if (hint) {
      hint.textContent = rate.available
        ? `نرخ پایه سنوات گروه ${fmt(group)}: ${fmt(rate.rate)} ریال در روز`
        : core.SENIORITY_TABLE_UNAVAILABLE_MESSAGE;
    }
  };

  schemeSelect.addEventListener('change', syncPrior);
  groupSelect.addEventListener('change', () => {
    $('#w-prior').dataset.touched = '';
    syncPrior();
  });
  $('#w-date').addEventListener('change', syncPrior);
  $('#w-prior').addEventListener('input', (event) => {
    event.target.dataset.touched = '1';
  });
  $('#wage-calc').addEventListener('click', computeWage);
  $('#wage-reset').addEventListener('click', () => {
    $('#w-prior').value = '';
    $('#w-prior').dataset.touched = '';
    $('#w-group').dataset.touched = '';
    $('#w-acc').value = 166_667;
    $('#w-service').value = 2;
    $('#w-days').value = 30;
    $('#w-rank').value = 0;
    $('#w-other').value = 0;
    $('#w-ot').value = 0;
    $('#w-night').value = 0;
    $('#w-children').value = 1;
    $('#w-shift').value = 'NONE';
    $('#w-married').checked = true;
    $('#w-welfare').checked = true;
    $('#w-param-version').value = '';
    $('#w-date').value = '1405-03-15';
    syncPrior();
    computeWage();
  });

  syncPrior();
  computeWage();
}

function computeWage() {
  const target = $('#wage-results');
  try {
    const result = core.computeWage(state.data, {
      schemeCode: selectValue($('#w-scheme'), 'SERVICE_COMPANIES_NATIONWIDE'),
      jobGroup: Number(selectValue($('#w-group'), '8')),
      priorDailyJobWage: Number($('#w-prior').value || 0),
      priorAccumulatedDailySeniority: Number($('#w-acc').value || 0),
      serviceYearsInWorkshop: Number($('#w-service').value || 0),
      payableDays: Number($('#w-days').value || 30),
      priorDailyRankWage: Number($('#w-rank').value || 0),
      priorOtherFixedDailyWage: Number($('#w-other').value || 0),
      overtimeHours: Number($('#w-ot').value || 0),
      shiftType: selectValue($('#w-shift'), 'NONE'),
      nightWorkHours: Number($('#w-night').value || 0),
      isMarried: $('#w-married').checked,
      eligibleChildrenCount: Number($('#w-children').value || 0),
      includeWelfareBenefits: $('#w-welfare').checked,
      computationDate: $('#w-date').value,
      parameterVersion: selectValue($('#w-param-version'), '') || undefined,
    });
    state.wageResult = result;
    renderWage(result);
  } catch (error) {
    state.wageResult = null;
    target.innerHTML = `<div class="warnings"><h4>خطای محاسبه</h4><ul><li>${escapeHtml(error.message)}</li></ul></div>`;
  }
}

function renderWage(result) {
  const target = $('#wage-results');
  const categories = ['JOB_WAGE', 'SENIORITY', 'BASE_WAGE', 'WAGE_ALLOWANCE', 'WELFARE', 'DEDUCTION'];

  const summary = `
    <div class="summary-grid">
      <div class="summary-card is-accent">
        <span class="label">مزد شغل روزانه</span>
        <span class="value">${fmt(result.dailyJobWage)}</span><span class="unit">ریال</span>
      </div>
      <div class="summary-card">
        <span class="label">مزد مبنا روزانه</span>
        <span class="value">${fmt(result.dailyBaseWage)}</span><span class="unit">ریال</span>
      </div>
      <div class="summary-card is-neutral">
        <span class="label">مجموع دریافتی ماهانه</span>
        <span class="value">${fmt(result.grossTotal)}</span><span class="unit">ریال</span>
      </div>
      <div class="summary-card is-neutral">
        <span class="label">خالص پرداختی</span>
        <span class="value">${fmt(result.netPayable)}</span><span class="unit">ریال</span>
      </div>
    </div>`;

  const details = `
    <div class="card">
      <h3 class="card-title">ریز محاسبه — دوره ${escapeHtml(localizeDigits(result.periodYearMonth))} (${fmt(result.payableDays)} روز، نسخه ${escapeHtml(localizeDigits(result.parameterVersion))})</h3>
      ${categories
        .map((category) => {
          const rows = result.breakdown.filter((line) => line.category === category && (line.monthly || line.daily));
          if (rows.length === 0) return '';
          return `
            <div class="breakdown-group">
              <h4>${CATEGORY_LABELS[category]}</h4>
              <div class="table-wrap" style="max-height:none">
                <table class="data-table">
                  <thead>
                    <tr><th>عنوان</th><th>روزانه (ریال)</th><th>ماهانه (ریال)</th><th>فرمول</th><th>مبنا / توضیح</th></tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (line) => `
                      <tr>
                        <td>${escapeHtml(line.title)}</td>
                        <td class="num">${line.daily !== undefined ? fmt(line.daily) : '—'}</td>
                        <td class="num">${fmt(line.monthly)}</td>
                        <td><code>${escapeHtml(line.formula)}</code></td>
                        <td class="desc">${escapeHtml(localizeDigits(line.note ?? ''))}</td>
                      </tr>`,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        })
        .join('')}
      <div class="table-wrap" style="max-height:none;margin-top:6px">
        <table class="data-table">
          <tbody>
            <tr><td>جمع مزد و مزایای مزدی</td><td class="num">${fmt(result.wageSubtotal)}</td></tr>
            <tr><td>جمع مزایای رفاهی و انگیزشی</td><td class="num">${fmt(result.welfareSubtotal)}</td></tr>
            <tr><td><strong>مجموع دریافتی</strong></td><td class="num"><strong>${fmt(result.grossTotal)}</strong></td></tr>
            <tr><td>بیمه سهم کارگر (۷٪) / سهم کارفرما (۲۳٪)</td><td class="num">${fmt(result.workerInsurance)} / ${fmt(result.employerInsurance)}</td></tr>
            <tr><td>مالیات بر حقوق</td><td class="num">${fmt(result.tax)}</td></tr>
            <tr><td><strong>خالص پرداختی</strong></td><td class="num"><strong>${fmt(result.netPayable)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div class="ok-note">
        پایه سنوات: سنوات تجمیعی ۱۴۰۴ (${fmt(result.accumulatedInflated)} ریال) با ضریب ۱٫۴۵ +
        ${fmt(result.newYearRateAddition)} ریال نرخ گروه ${fmt(result.jobGroup)} =
        <strong>${fmt(result.dailySeniorityWage)} ریال در روز</strong>
        ${result.rateAvailable ? '' : ' — جدول پایه سنوات این طرح در دسترس نیست.'}
      </div>
    </div>`;

  const warnings =
    result.warnings.length > 0
      ? `<div class="warnings"><h4>هشدارهای کارشناسی</h4><ul>${result.warnings
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></div>`
      : '';

  target.innerHTML = summary + details + warnings;
}

/* ================================ سنوات ================================ */

function initSeniority() {
  $('#s-group').innerHTML = Array.from({ length: 20 }, (_, index) => {
    const group = index + 1;
    return `<option value="${group}" ${group === 8 ? 'selected' : ''}>گروه ${fmt(group)}</option>`;
  }).join('');
  $('#s-acc').value = 166_667;
  $('#s-calc').addEventListener('click', calcSeniority);
  renderSeniorityTables();
  calcSeniority();
}

function renderSeniorityTables() {
  const rates = [];
  for (let group = 1; group <= 20; group += 1) {
    const rate = core.getSeniorityRate(state.data, {
      schemeCode: 'NATIONAL_20_GROUP_1389',
      group,
      fiscalYear: 1405,
      asOfDate: '1405-05-01',
    });
    rates.push({ group, rate });
  }

  $('#s-rate-table').innerHTML = `
    <thead>
      <tr><th>گروه</th><th>نرخ پایه سنوات روزانه ۱۴۰۵ (ریال)</th><th>معادل ۳۰ روز (ریال)</th><th>گام نسبت به گروه قبل</th><th>وضعیت</th></tr>
    </thead>
    <tbody>
      ${rates
        .map((row, index) => {
          const step = index === 0 ? null : row.rate.rate - rates[index - 1].rate.rate;
          return `<tr>
            <td class="num">${fmt(row.group)}</td>
            <td class="num">${fmt(row.rate.rate)}</td>
            <td class="num">${fmt((row.rate.rate ?? 0) * 30)}</td>
            <td class="num">${step === null ? '—' : `+${fmt(step)}`}</td>
            <td>${chip(row.rate.validityStatus ?? '1_VERIFIED_USABLE')}</td>
          </tr>`;
        })
        .join('')}
    </tbody>`;

  const cumulative = state.data.seniorityTables
    .filter(
      (row) =>
        row.schemeCode === 'NATIONAL_20_GROUP_1389' &&
        row.tableType === 'CUMULATIVE_PAST_SERVICE' &&
        row.yearsOfService !== null,
    )
    .sort((a, b) => a.yearsOfService - b.yearsOfService);

  $('#s-cumulative-table').innerHTML = `
    <thead><tr><th>سابقه (سال)</th><th>مزد سنوات روزانه تا پایان ۱۴۰۴</th><th>معادل ۱۴۰۵ (× ۱٫۴۵)</th></tr></thead>
    <tbody>
      ${cumulative
        .map(
          (row) => `<tr>
            <td class="num">${fmt(row.yearsOfService)}</td>
            <td class="num">${fmt(row.dailySeniorityAmount)}</td>
            <td class="num">${fmt(Math.round(row.dailySeniorityAmount * 1.45))}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;
}

function calcSeniority() {
  const group = Number(selectValue($('#s-group'), '8'));
  const date = $('#s-date').value || '1405-03-15';
  const accumulated = Number($('#s-acc').value || 0);
  const service = Number($('#s-service').value || 0);
  const rate = core.getSeniorityRate(state.data, {
    schemeCode: 'NATIONAL_20_GROUP_1389',
    group,
    fiscalYear: 1405,
    asOfDate: date,
  });
  const eligible = service >= 1;
  const accumulated1405 = Math.round(accumulated * 1.45);
  const newRate = eligible && rate.available ? rate.rate : 0;
  const total = accumulated1405 + newRate;
  const cumulativeEq = core.computeCumulativeSeniority(state.data, {
    schemeCode: 'NATIONAL_20_GROUP_1389',
    yearsOfService: service,
    asOfDate: date,
  });

  state.seniorityResult = { group, total };
  $('#s-result').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><span class="label">نرخ پایه سنوات گروه ${fmt(group)}</span>
        <span class="value">${rate.available ? fmt(rate.rate) : '—'}</span><span class="unit">ریال/روز</span></div>
      <div class="summary-card is-neutral"><span class="label">سنوات تجمیعی ۱۴۰۴ (× ۱٫۴۵)</span>
        <span class="value">${fmt(accumulated1405)}</span><span class="unit">ریال/روز</span></div>
      <div class="summary-card is-accent"><span class="label">کل پایه سنوات ۱۴۰۵</span>
        <span class="value">${fmt(total)}</span><span class="unit">ریال/روز</span></div>
      <div class="summary-card is-neutral"><span class="label">معادل ماهانه (۳۰ روز)</span>
        <span class="value">${fmt(total * 30)}</span><span class="unit">ریال</span></div>
    </div>
    <div class="${rate.available ? 'ok-note' : 'warnings'}">
      ${
        rate.available
          ? `نرخ مصوب گروه ${fmt(group)} اعمال شد${eligible ? '' : ' — اما سابقه کمتر از یک سال است، نرخ سال جدید اعمال نشد.'}`
          : `<h4>${core.SENIORITY_TABLE_UNAVAILABLE_MESSAGE}</h4><p class="small">برای این گروه/طرح جدول رسمی پایه سنوات ثبت نشده است؛ هیچ مقدار پیش‌فرضی (از جمله ۱۶۶٬۶۶۷ ریال) اعمال نمی‌شود.</p>`
      }
      ${
        cumulativeEq.available
          ? `<br><span class="small">مزد سنوات تجمیعی متناظر با ${fmt(service, 2)} سال سابقه (جدول رسمی، با درون‌یابی): ${fmt(cumulativeEq.amount)} ریال در روز</span>`
          : ''
      }
    </div>`;
}

/* ================================ گروه‌بندی ================================ */

const GROUP_SCHEME_LABELS = {
  NATIONAL_20_GROUP_1389: 'نظام ۲۰ گروهی ۱۳۸۹ (ماده ۵ آیین‌نامه)',
};

function initGroup() {
  const schemes = [...new Set(state.data.groupRanges.map((row) => row.schemeCode))];
  $('#g-scheme').innerHTML = schemes
    .map((code) => `<option value="${code}">${escapeHtml(GROUP_SCHEME_LABELS[code] ?? code)}</option>`)
    .join('');
  $('#g-calc').addEventListener('click', () => calcGroup());
  renderGroupTable();
  calcGroup();
  renderGroupJobsComparison();
}

function calcGroup() {
  const score = Number($('#g-score').value || 0);
  const scheme = selectValue($('#g-scheme'), 'NATIONAL_20_GROUP_1389');
  const date = $('#g-date').value || '1405-03-15';
  const result = core.matchGroup(state.data, { schemeCode: scheme, score, asOfDate: date });
  state.groupResult = result;
  renderGroupResult(result, score);
  highlightGroupRow(result.group);
}

function renderGroupResult(result, score) {
  const range = result.range;
  const rows = [
    `<div class="summary-card is-accent"><span class="label">گروه پیشنهادی</span>
      <span class="value">${result.group === null ? '—' : fmt(result.group)}</span></div>`,
    `<div class="summary-card is-neutral"><span class="label">بازه امتیاز</span>
      <span class="value">${range ? `${fmt(range.minScore)} – ${fmt(range.maxScore)}` : '—'}</span></div>`,
    `<div class="summary-card"><span class="label">سقف امتیاز گروه (Xn)</span>
      <span class="value">${range ? fmt(range.ceilingScoreXn) : '—'}</span></div>`,
    `<div class="summary-card"><span class="label">مازاد بر گروه ۱ (Bn)</span>
      <span class="value">${range ? fmt(range.excessOverG1Bn) : '—'}</span></div>`,
  ].join('');

  $('#g-result').innerHTML = `
    <div class="summary-grid">${rows}</div>
    <div class="${result.matched ? 'ok-note' : 'warnings'}">
      ${
        result.matched
          ? `امتیاز ${fmt(score)} با بازه گروه ${fmt(result.group)} از نسخه ${escapeHtml(result.tableVersion ?? '')} تطبیق کامل دارد.`
          : `<h4>تطبیق کامل انجام نشد</h4><ul>${result.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      }
      <br><span class="small">گروه حاصل «پیشنهادی» است؛ قطعی‌شدن آن نیازمند بررسی کارشناس و تأیید کمیته طبقه‌بندی مشاغل و اداره کل روابط کار است.</span>
    </div>`;
}

function renderGroupTable() {
  const scheme = selectValue($('#g-scheme'), 'NATIONAL_20_GROUP_1389');
  const rows = state.data.groupRanges
    .filter((row) => row.schemeCode === scheme)
    .sort((a, b) => a.version.localeCompare(b.version) || a.groupNumber - b.groupNumber);

  $('#g-table').innerHTML = `
    <thead>
      <tr><th>گروه</th><th>حداقل امتیاز</th><th>حداکثر امتیاز</th><th>سقف (Xn)</th><th>مازاد (Bn)</th><th>تفاوت متوالی (Δn)</th><th>نسخه</th><th>وضعیت</th></tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr data-group="${row.groupNumber}" data-version="${escapeHtml(row.version)}">
            <td class="num">${fmt(row.groupNumber)}</td>
            <td class="num">${fmt(row.minScore)}</td>
            <td class="num">${fmt(row.maxScore)}</td>
            <td class="num">${fmt(row.ceilingScoreXn)}</td>
            <td class="num">${fmt(row.excessOverG1Bn)}</td>
            <td class="num">${fmt(row.consecutiveDiffDelta)}</td>
            <td class="small">${escapeHtml(row.version)}</td>
            <td>${chip(row.validityStatus)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;
}

function highlightGroupRow(group) {
  document.querySelectorAll('#g-table tbody tr').forEach((row) => {
    row.classList.toggle('is-highlight', group !== null && Number(row.dataset.group) === group);
  });
}

/* ================================ بانک مشاغل ================================ */

const JOB_STATUS_LABELS = { ACTIVE: 'فعال', VACANT: 'بلاتصدی', ARCHIVED: 'بایگانی' };
const APPROVAL_STATUS_LABELS = {
  PENDING_COMMITTEE_APPROVAL: 'در انتظار تأیید کمیته',
  COMMITTEE_APPROVED: 'تأیید کمیته',
  MINISTRY_APPROVED: 'تأیید اداره کل روابط کار',
  REJECTED: 'رد شده',
};
const APPROVAL_CHIP_CLASS = {
  PENDING_COMMITTEE_APPROVAL: 'st-2',
  COMMITTEE_APPROVED: 'st-1',
  MINISTRY_APPROVED: 'st-1',
  REJECTED: 'st-3',
};

function normalizeApproval(evaluation) {
  if (!evaluation) return null;
  const approval = evaluation.approval ?? {};
  return {
    status: APPROVAL_STATUS_LABELS[approval.status] ? approval.status : 'PENDING_COMMITTEE_APPROVAL',
    finalGroup: approval.finalGroup ?? null,
    expertName: approval.expertName ?? null,
    committeeRef: approval.committeeRef ?? null,
    decisionDate: approval.decisionDate ?? null,
    changeReason: approval.changeReason ?? null,
    approvedAt: approval.approvedAt ?? null,
    history: Array.isArray(approval.history) ? approval.history : [],
  };
}

function todayJalali() {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parts.replace(/\//g, '/');
  } catch {
    return '1405-03-15';
  }
}
const jobsFilter = { search: '', unit: '', group: '' };
let profileJobId = null;

function workshopJobs() {
  const workshop = activeWorkshop();
  if (!workshop) return [];
  return state.store.jobs.filter((job) => job.workshopId === workshop.id);
}

function jobByCode(code) {
  return workshopJobs().find((job) => job.jobCode === code) ?? null;
}

function jobById(id) {
  return state.store.jobs.find((job) => job.id === id) ?? null;
}

function initJobs() {
  const newButton = document.getElementById('job-new');
  if (newButton) newButton.addEventListener('click', () => openJobForm(null));

  const form = document.getElementById('job-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveJobFromForm();
    });
  }
  for (const id of ['job-cancel', 'job-cancel-2']) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => closeJobForm());
  }

  const search = document.getElementById('jobs-search');
  if (search) {
    search.addEventListener('input', () => {
      jobsFilter.search = search.value.trim();
      renderJobsTable();
    });
  }

  const unitFilter = document.getElementById('jobs-filter-unit');
  if (unitFilter) {
    unitFilter.addEventListener('change', () => {
      jobsFilter.unit = selectValue(unitFilter, '');
      renderJobsTable();
    });
  }
  const groupFilter = document.getElementById('jobs-filter-group');
  if (groupFilter) {
    groupFilter.addEventListener('change', () => {
      jobsFilter.group = selectValue(groupFilter, '');
      renderJobsTable();
    });
  }

  const table = document.getElementById('jobs-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const job = jobById(button.dataset.id);
      if (!job) return;
      const action = button.dataset.action;
      if (action === 'profile') openJobProfile(job.id);
      if (action === 'edit') openJobForm(job);
      if (action === 'copy') duplicateJob(job);
      if (action === 'delete') deleteJob(job);
    });
  }

  const printList = document.getElementById('jobs-print-list');
  if (printList) {
    printList.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
  const profilePrint = document.getElementById('profile-print');
  if (profilePrint) {
    profilePrint.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
  const profileBack = document.getElementById('profile-back');
  if (profileBack) profileBack.addEventListener('click', () => navigate('jobs'));

  renderJobsView();
}

function renderJobsView() {
  const workspace = document.getElementById('jobs-workspace');
  const emptyState = document.getElementById('jobs-empty-workshop');
  if (!workspace || !emptyState) return;
  const workshop = activeWorkshop();
  const hasWorkshop = Boolean(workshop);
  emptyState.hidden = hasWorkshop;
  workspace.hidden = !hasWorkshop;
  if (!hasWorkshop) return;
  renderJobsFilters();
  renderJobsTable();
  renderJobUnitOptions(selectValue(document.getElementById('jf-unit-link'), ''));
}

function renderJobsFilters() {
  const jobs = workshopJobs();
  const unitSelect = document.getElementById('jobs-filter-unit');
  if (unitSelect) {
    const units = [
      ...new Set([
        ...workshopUnits().map((unit) => unit.title),
        ...jobs.map((job) => job.orgUnit),
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'fa'));
    unitSelect.innerHTML =
      '<option value="">همه واحدها</option>' +
      units.map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join('');
    setElementValue(unitSelect, jobsFilter.unit);
  }
  const groupSelect = document.getElementById('jobs-filter-group');
  if (groupSelect) {
    groupSelect.innerHTML =
      '<option value="">همه گروه‌ها</option><option value="NONE">بدون ارزیابی</option>' +
      Array.from({ length: 20 }, (_, index) => {
        const group = index + 1;
        return `<option value="${group}">گروه ${fmt(group)}</option>`;
      }).join('');
    setElementValue(groupSelect, jobsFilter.group);
  }
}

function filteredJobs() {
  const search = jobsFilter.search;
  return workshopJobs().filter((job) => {
    if (jobsFilter.unit && job.orgUnit !== jobsFilter.unit) return false;
    const group = job.evaluation?.proposedGroup ?? null;
    if (jobsFilter.group === 'NONE' && group !== null) return false;
    if (jobsFilter.group && jobsFilter.group !== 'NONE' && String(group) !== jobsFilter.group) return false;
    if (!search) return true;
    const haystack = `${job.jobCode} ${job.title} ${job.titleEn} ${job.orgUnit} ${job.supervisorJobCode ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
}

function renderJobsTable() {
  const table = document.getElementById('jobs-table');
  if (!table) return;
  const counter = document.getElementById('jobs-count');
  const rows = filteredJobs();
  if (counter) {
    counter.textContent = `${fmt(rows.length)} شغل از ${fmt(workshopJobs().length)}`;
  }
  if (rows.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>
            <div class="empty-state">
              ${workshopJobs().length === 0
                ? 'هنوز شغلی ثبت نشده است. با دکمه «شغل جدید» اولین شناسنامه شغل را بسازید.'
                : 'شغلی با این فیلترها یافت نشد.'}
            </div>
          </td>
        </tr>
      </tbody>`;
    return;
  }
  table.innerHTML = `
    <thead>
      <tr>
        <th>کد شغل</th><th>عنوان شغل</th><th>واحد سازمانی</th><th>سرپرست</th>
        <th>تعداد نیرو</th><th>امتیاز</th><th>گروه پیشنهادی</th><th>گروه نهایی</th><th>وضعیت تأیید</th><th>عملیات</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((job) => {
          const evaluation = job.evaluation;
          return `<tr>
            <td class="num">${escapeHtml(job.jobCode)}</td>
            <td>
              <strong>${escapeHtml(job.title)}</strong>
              ${job.titleEn ? `<div class="small muted" dir="ltr">${escapeHtml(job.titleEn)}</div>` : ''}
            </td>
            <td>
              ${escapeHtml(job.orgUnit)}
              ${job.unitId && unitById(job.unitId) ? `<div class="small muted">کد واحد: ${escapeHtml(unitById(job.unitId).code)}</div>` : ''}
            </td>
            <td class="num">${escapeHtml(job.supervisorJobCode || '—')}</td>
            <td class="num">${fmt(job.headcount)}</td>
            <td class="num">${evaluation ? fmt(evaluation.totalScore, 1) : '—'}</td>
            <td class="num">${evaluation?.proposedGroup ? fmt(evaluation.proposedGroup) : '—'}</td>
            <td class="num">${normalizeApproval(evaluation)?.finalGroup ? fmt(normalizeApproval(evaluation).finalGroup) : '—'}</td>
            <td>${
              evaluation
                ? `<span class="chip ${APPROVAL_CHIP_CLASS[normalizeApproval(evaluation).status] ?? 'neutral'}">${escapeHtml(APPROVAL_STATUS_LABELS[normalizeApproval(evaluation).status] ?? '')}</span>`
                : '<span class="chip neutral">بدون ارزیابی</span>'
            }</td>
            <td class="actions-cell">
              <button type="button" class="icon-btn" data-action="profile" data-id="${escapeHtml(job.id)}" title="شناسنامه شغل">▤</button>
              <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(job.id)}" title="ویرایش">✎</button>
              <button type="button" class="icon-btn" data-action="copy" data-id="${escapeHtml(job.id)}" title="تکثیر">⧉</button>
              <button type="button" class="icon-btn" data-action="delete" data-id="${escapeHtml(job.id)}" title="حذف">✕</button>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

function openJobForm(job) {
  if (!ensureWrite('jobs', 'ویرایش پرونده شغل')) return;
  const form = document.getElementById('job-form');
  if (!form) return;
  form.hidden = false;
  const title = document.getElementById('job-form-title');
  if (title) title.textContent = job ? `ویرایش شغل ${job.jobCode}` : 'شغل جدید';
  setElementValue(document.getElementById('jf-id'), job?.id ?? '');
  setElementValue(document.getElementById('jf-code'), job?.jobCode ?? '');
  setElementValue(document.getElementById('jf-title'), job?.title ?? '');
  setElementValue(document.getElementById('jf-title-en'), job?.titleEn ?? '');
  setElementValue(document.getElementById('jf-unit'), job?.orgUnit ?? '');
  renderJobUnitOptions(job?.unitId ?? '');
  setElementValue(document.getElementById('jf-supervisor'), job?.supervisorJobCode ?? '');
  setElementValue(document.getElementById('jf-headcount'), job?.headcount ?? 0);
  setElementValue(document.getElementById('jf-status'), job?.status ?? 'ACTIVE');
  setElementValue(document.getElementById('jf-objective'), job?.objective ?? '');
  setElementValue(document.getElementById('jf-duties'), job?.dutiesMain ?? '');
  setElementValue(document.getElementById('jf-duties-secondary'), job?.dutiesSecondary ?? '');
  setElementValue(document.getElementById('jf-responsibilities'), job?.responsibilities ?? '');
  setElementValue(document.getElementById('jf-authorities'), job?.authorities ?? '');
  setElementValue(document.getElementById('jf-communications'), job?.communications ?? '');
  setElementValue(document.getElementById('jf-education'), job?.education ?? 'کارشناسی');
  setElementValue(document.getElementById('jf-field'), job?.fieldOfStudy ?? '');
  setElementValue(document.getElementById('jf-experience'), job?.experienceYears ?? 0);
  setElementValue(document.getElementById('jf-knowledge'), job?.knowledge ?? '');
  setElementValue(document.getElementById('jf-skills'), job?.skills ?? '');
  setElementValue(document.getElementById('jf-conditions'), job?.workingConditions ?? '');
  setElementValue(document.getElementById('jf-tools'), job?.tools ?? '');
  const error = document.getElementById('job-error');
  if (error) error.textContent = '';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeJobForm() {
  const form = document.getElementById('job-form');
  if (form) form.hidden = true;
  const error = document.getElementById('job-error');
  if (error) error.textContent = '';
}

function saveJobFromForm() {
  if (!ensureWrite('jobs', 'ذخیره شغل')) return;
  const workshop = activeWorkshop();
  const errorTarget = document.getElementById('job-error');
  if (!workshop) {
    if (errorTarget) errorTarget.textContent = 'ابتدا یک کارگاه انتخاب کنید.';
    return;
  }
  const id = document.getElementById('jf-id').value;
  const existing = id ? jobById(id) : null;
  const draft = {
    id: existing?.id ?? newId('job'),
    workshopId: workshop.id,
    jobCode: document.getElementById('jf-code').value.trim(),
    title: document.getElementById('jf-title').value.trim(),
    titleEn: document.getElementById('jf-title-en').value.trim(),
    unitId: selectValue(document.getElementById('jf-unit-link'), '') || null,
    orgUnit: (() => {
      const linked = unitById(selectValue(document.getElementById('jf-unit-link'), ''));
      return linked ? linked.title : document.getElementById('jf-unit').value.trim();
    })(),
    supervisorJobCode: document.getElementById('jf-supervisor').value.trim(),
    headcount: Number(document.getElementById('jf-headcount').value || 0),
    status: selectValue(document.getElementById('jf-status'), 'ACTIVE'),
    objective: document.getElementById('jf-objective').value.trim(),
    dutiesMain: document.getElementById('jf-duties').value.trim(),
    dutiesSecondary: document.getElementById('jf-duties-secondary').value.trim(),
    responsibilities: document.getElementById('jf-responsibilities').value.trim(),
    authorities: document.getElementById('jf-authorities').value.trim(),
    communications: document.getElementById('jf-communications').value.trim(),
    education: selectValue(document.getElementById('jf-education'), 'کارشناسی'),
    fieldOfStudy: document.getElementById('jf-field').value.trim(),
    experienceYears: Number(document.getElementById('jf-experience').value || 0),
    knowledge: document.getElementById('jf-knowledge').value.trim(),
    skills: document.getElementById('jf-skills').value.trim(),
    workingConditions: document.getElementById('jf-conditions').value.trim(),
    tools: document.getElementById('jf-tools').value.trim(),
    version: existing?.version ?? '1.0',
    evaluation: existing?.evaluation ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const problems = [];
  if (!draft.jobCode) problems.push('کد شغل الزامی است.');
  if (draft.jobCode && !/^[A-Za-z0-9-]{2,24}$/.test(draft.jobCode)) {
    problems.push('کد شغل باید ۲ تا ۲۴ نویسه لاتین/رقم باشد.');
  }
  if (!draft.title) problems.push('عنوان شغل الزامی است.');
  if (!draft.orgUnit) problems.push('واحد سازمانی الزامی است.');
  if (!draft.objective) problems.push('هدف شغل الزامی است.');
  if (!draft.dutiesMain) problems.push('شرح وظایف اصلی الزامی است.');
  if (
    draft.jobCode &&
    workshopJobs().some((job) => job.id !== draft.id && job.jobCode === draft.jobCode)
  ) {
    problems.push('این کد شغل در همین کارگاه قبلاً ثبت شده است.');
  }
  if (draft.supervisorJobCode && !workshopJobs().some((job) => job.jobCode === draft.supervisorJobCode && job.id !== draft.id)) {
    problems.push('کد سرپرست مستقیم در بانک مشاغل این کارگاه یافت نشد.');
  }
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }

  const jobs = existing
    ? state.store.jobs.map((job) => (job.id === draft.id ? draft : job))
    : [...state.store.jobs, draft];
  writeStore({ ...state.store, jobs });
  closeJobForm();
  renderJobsView();
  showToast(existing ? 'شغل ویرایش شد' : 'شغل جدید ثبت شد');
}

function duplicateJob(job) {
  const jobs = workshopJobs();
  let suffix = 2;
  let code = `${job.jobCode}-${suffix}`;
  while (jobs.some((row) => row.jobCode === code)) {
    suffix += 1;
    code = `${job.jobCode}-${suffix}`;
  }
  const copy = {
    ...job,
    id: newId('job'),
    jobCode: code,
    title: `${job.title} (تکثیر)`,
    evaluation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore({ ...state.store, jobs: [...state.store.jobs, copy] });
  renderJobsView();
  showToast(`شغل تکثیر شد: ${code}`);
}

function deleteJob(job) {
  if (!ensureAdmin('حذف شغل')) return;
  const confirmed = typeof window.confirm === 'function'
    ? window.confirm(`حذف شغل «${job.title}»؟ این عمل قابل بازگشت نیست.`)
    : true;
  if (!confirmed) return;
  writeStore({ ...state.store, jobs: state.store.jobs.filter((row) => row.id !== job.id) });
  renderJobsView();
  logActivity('jobs', 'DELETE', `حذف شغل «${job.title}» (${job.jobCode})`);
  showToast('شغل حذف شد');
}

/* ----------------------------- شناسنامه شغل ----------------------------- */

function openJobProfile(jobId) {
  profileJobId = jobId;
  const job = jobById(jobId);
  if (!job) return;
  navigate('job-profile', { silent: true });
  const title = document.getElementById('page-title');
  if (title) title.textContent = `شناسنامه شغل ${job.jobCode}`;
  renderJobProfile(job);
}

function profileSection(number, title, content) {
  return `
    <section class="profile-section">
      <h3><span class="profile-number">${fmt(number)}</span>${escapeHtml(title)}</h3>
      <div class="profile-content">${content}</div>
    </section>`;
}

function multiline(value) {
  if (!value) return '<span class="muted">— ثبت نشده —</span>';
  return `<ul class="profile-list">${String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('')}</ul>`;
}

function renderJobProfile(job) {
  const target = document.getElementById('job-profile-body');
  if (!target) return;
  const workshop = activeWorkshop();
  const evaluation = job.evaluation;
  const factors = state.data.factors.filter((row) => row.systemCode === 'EVAL_1389_POINT_FACTOR');
  const systemB = state.data.systems.find((row) => row.code === 'EVAL_1389_POINT_FACTOR');

  const generalTable = `
    <table class="data-table profile-table">
      <tbody>
        <tr><th>کد شغل</th><td class="num">${escapeHtml(job.jobCode)}</td><th>عنوان شغل</th><td>${escapeHtml(job.title)}</td></tr>
        <tr><th>عنوان انگلیسی</th><td dir="ltr">${escapeHtml(job.titleEn || '—')}</td><th>واحد سازمانی</th><td>${escapeHtml(job.orgUnit)}${job.unitId && unitById(job.unitId) ? `<span class="small muted"> — کد واحد ${escapeHtml(unitById(job.unitId).code)} (سطح ${fmt(unitDepth(unitById(job.unitId)))})</span>` : ''}</td></tr>
        <tr><th>کارگاه</th><td>${escapeHtml(workshop?.workshopName ?? '—')}</td><th>شرکت</th><td>${escapeHtml(workshop?.companyName ?? '—')}</td></tr>
        <tr><th>سرپرست مستقیم</th><td class="num">${escapeHtml(job.supervisorJobCode || '—')}</td><th>تعداد نیرو تحت سرپرستی</th><td class="num">${fmt(job.headcount)}</td></tr>
        <tr><th>وضعیت شغل</th><td>${JOB_STATUS_LABELS[job.status] ?? job.status}</td><th>نسخه شناسنامه</th><td class="num">${escapeHtml(job.version)}</td></tr>
      </tbody>
    </table>`;

  const qualificationTable = `
    <table class="data-table profile-table">
      <tbody>
        <tr><th>تحصیلات موردنیاز</th><td>${escapeHtml(job.education || '—')}</td><th>رشته تحصیلی</th><td>${escapeHtml(job.fieldOfStudy || '—')}</td></tr>
        <tr><th>سابقه موردنیاز</th><td class="num">${fmt(job.experienceYears, 1)} سال</td><th>دانش تخصصی</th><td>${escapeHtml(job.knowledge || '—')}</td></tr>
        <tr><th>مهارت‌های فنی</th><td colspan="3">${escapeHtml(job.skills || '—')}</td></tr>
      </tbody>
    </table>`;

  const evaluationContent = evaluation
    ? `<div class="summary-grid profile-summary">
        <div class="summary-card is-accent"><span class="label">امتیاز کل</span><span class="value">${fmt(evaluation.totalScore, 1)}</span></div>
        <div class="summary-card"><span class="label">گروه پیشنهادی</span><span class="value">${evaluation.proposedGroup ? fmt(evaluation.proposedGroup) : '—'}</span></div>
        <div class="summary-card is-neutral"><span class="label">تاریخ ارزیابی</span><span class="value">${escapeHtml(localizeDigits(evaluation.evaluatedAt ?? ''))}</span></div>
        <div class="summary-card is-neutral"><span class="label">نسخه جدول گروه</span><span class="value">${escapeHtml(localizeDigits(evaluation.tableVersion ?? '—'))}</span></div>
      </div>`
    : `<div class="empty-state">این شغل هنوز ارزیابی نشده است. از بخش «ارزیابی مشاغل» با انتخاب این شغل، امتیاز و گروه پیشنهادی محاسبه و در شناسنامه ثبت شود.</div>
       <ul class="data-list">
         ${factors.map((factor) => `<li><span>${escapeHtml(factor.name)}</span><b>سقف ${fmt(factor.maxScore)}</b></li>`).join('')}
         <li><span>مجموع نظری نظام ۱۳۸۹</span><b>${fmt(systemB?.maxTheoreticalScore ?? 1137)} امتیاز</b></li>
       </ul>`;

  const scoresContent = evaluation?.factorScores?.length
    ? `<table class="data-table profile-table">
        <thead><tr><th>عامل</th><th>امتیاز کسب‌شده</th><th>سقف عامل</th><th>وزن رسمی</th></tr></thead>
        <tbody>
          ${evaluation.factorScores
            .map(
              (factor) => `<tr>
                <td>${escapeHtml(factor.factorName)}</td>
                <td class="num">${fmt(factor.points, 1)}</td>
                <td class="num">${fmt(factor.maxScore)}</td>
                <td class="num">${fmt(factor.officialWeightPct, 1)}٪</td>
              </tr>`,
            )
            .join('')}
          <tr>
            <td><strong>مجموع</strong></td>
            <td class="num"><strong>${fmt(evaluation.totalScore, 1)}</strong></td>
            <td colspan="2" class="small muted">${evaluation.scoringComplete ? 'امتیازدهی کامل' : 'امتیازدهی ناقص — زیرعامل بدون جدول رسمی'}</td>
          </tr>
        </tbody>
      </table>`
    : '<p class="muted">ریز امتیاز عوامل پس از ارزیابی ثبت می‌شود.</p>';

  const approval = normalizeApproval(evaluation);
  const finalGroup = approval?.finalGroup ?? null;
  const groupDelta = finalGroup && evaluation?.proposedGroup ? finalGroup - evaluation.proposedGroup : 0;

  const groupContent = `
    <table class="data-table profile-table">
      <tbody>
        <tr>
          <th>گروه پیشنهادی</th>
          <td class="num">${evaluation?.proposedGroup ? fmt(evaluation.proposedGroup) : '— تعیین نشده'}</td>
          <th>گروه نهایی مصوب</th>
          <td class="num">${finalGroup ? fmt(finalGroup) : '— تأیید نشده'}</td>
        </tr>
        <tr>
          <th>بازه امتیاز</th>
          <td class="num">${evaluation?.rangeMin !== null && evaluation?.rangeMin !== undefined ? `${fmt(evaluation.rangeMin)}–${fmt(evaluation.rangeMax)}` : '—'}</td>
          <th>اختلاف با پیشنهاد</th>
          <td class="num">${finalGroup ? `${groupDelta > 0 ? '+' : ''}${fmt(groupDelta)} گروه` : '—'}</td>
        </tr>
        <tr>
          <th>دلیل تغییر گروه</th>
          <td colspan="3">${escapeHtml(approval?.changeReason || '—')}</td>
        </tr>
      </tbody>
    </table>
    <div class="ok-note">
      گروه پیشنهادی قطعی نیست؛ گروه نهایی تنها پس از بررسی کارشناس طبقه‌بندی مشاغل و تأیید کمیته و مرجع مسئول ثبت می‌شود.
    </div>`;

  const approvalHistory = (approval?.history ?? [])
    .slice()
    .reverse()
    .slice(0, 8)
    .map(
      (entry) => `<tr>
        <td class="small">${escapeHtml(localizeDigits(entry.decisionDate || (entry.at ? new Date(entry.at).toLocaleDateString('fa-IR') : '—')))}</td>
        <td class="small">${escapeHtml(APPROVAL_STATUS_LABELS[entry.status] ?? entry.status ?? '—')}</td>
        <td class="num">${entry.finalGroup ? fmt(entry.finalGroup) : '—'}</td>
        <td class="small">${escapeHtml(entry.expertName || '—')}</td>
        <td class="small">${escapeHtml(entry.committeeRef || '—')}</td>
        <td class="desc">${escapeHtml(entry.changeReason || '—')}</td>
      </tr>`,
    )
    .join('');

  const approvalContent = evaluation
    ? `<table class="data-table profile-table">
        <tbody>
          <tr><th>وضعیت تأیید</th><td><span class="chip ${APPROVAL_CHIP_CLASS[approval.status] ?? 'neutral'}">${escapeHtml(APPROVAL_STATUS_LABELS[approval.status] ?? approval.status)}</span></td></tr>
          <tr><th>نام کارشناس</th><td>${escapeHtml(approval.expertName || '— ثبت نشده —')}</td></tr>
          <tr><th>شماره صورت‌جلسه کمیته</th><td>${escapeHtml(approval.committeeRef || '— ثبت نشده —')}</td></tr>
          <tr><th>تاریخ تصمیم</th><td>${escapeHtml(localizeDigits(approval.decisionDate || '—'))}</td></tr>
        </tbody>
      </table>
      ${
        (approval.history ?? []).length > 0
          ? `<h4>تاریخچه تصمیم‌ها</h4>
             <div class="table-wrap" style="max-height:220px">
               <table class="data-table">
                 <thead><tr><th>تاریخ</th><th>وضعیت</th><th>گروه نهایی</th><th>کارشناس</th><th>صورت‌جلسه</th><th>دلیل / یادداشت</th></tr></thead>
                 <tbody>${approvalHistory}</tbody>
               </table>
             </div>`
          : ''
      }
      <div class="card no-print approval-form">
        <h4>ثبت نظر کارشناس / کمیته</h4>
        <div class="form-grid">
          <label class="field">
            <span>تصمیم</span>
            <select id="approval-status">
              <option value="PENDING_COMMITTEE_APPROVAL">در انتظار تأیید کمیته</option>
              <option value="COMMITTEE_APPROVED">تأیید کمیته طبقه‌بندی مشاغل</option>
              <option value="MINISTRY_APPROVED">تأیید اداره کل روابط کار</option>
              <option value="REJECTED">رد پیشنهاد</option>
            </select>
          </label>
          <label class="field">
            <span>گروه نهایی</span>
            <select id="approval-final-group">
              <option value="">— تعیین نشده —</option>
              ${Array.from({ length: 20 }, (_, index) => {
                const group = index + 1;
                return `<option value="${group}">گروه ${fmt(group)}</option>`;
              }).join('')}
            </select>
          </label>
          <label class="field"><span>نام کارشناس *</span><input id="approval-expert" placeholder="نام و نام خانوادگی" /></label>
          <label class="field"><span>شماره صورت‌جلسه کمیته *</span><input id="approval-ref" dir="ltr" placeholder="مثلاً 1405/COMM-12" /></label>
          <label class="field"><span>تاریخ تصمیم</span><input id="approval-date" dir="ltr" value="${escapeHtml(todayJalali())}" /></label>
          <label class="field field-wide"><span>دلیل تغییر گروه / یادداشت کارشناس</span><textarea id="approval-reason" rows="2" placeholder="در صورت تغییر گروه نسبت به پیشنهاد، دلیل الزامی است"></textarea></label>
          <div class="form-actions field-wide">
            <button class="primary-btn" type="button" id="approval-save">ثبت تصمیم</button>
            <button class="ghost-btn" type="button" id="approval-reopen">بازگشت به «در انتظار تأیید»</button>
            <span class="form-error" id="approval-msg" role="status"></span>
          </div>
        </div>
      </div>`
    : '<div class="empty-state">برای این شغل ارزیابی امتیازی ثبت نشده است؛ تأیید کارشناسی پس از ارزیابی و تعیین گروه پیشنهادی ممکن است.</div>';

  target.innerHTML = `
    <article class="profile" id="job-profile-print">
      <header class="profile-header">
        <div>
          <p class="small muted">${escapeHtml(workshop?.companyName ?? '')} — ${escapeHtml(workshop?.workshopName ?? '')}</p>
          <h2>شناسنامه شغل</h2>
          <p class="muted small">سامانه جامع ارزیابی و طبقه‌بندی مشاغل — واحد پول: ریال ایران (IRR)</p>
        </div>
        <div class="profile-header-meta">
          <span class="badge badge-currency">${escapeHtml(job.jobCode)}</span>
          <p class="small muted">آخرین ویرایش: ${new Date(job.updatedAt).toLocaleDateString('fa-IR')}</p>
        </div>
      </header>
      ${profileSection(1, 'مشخصات عمومی', generalTable)}
      ${profileSection(2, 'هدف شغل', `<p>${escapeHtml(job.objective || '—')}</p>`)}
      ${profileSection(3, 'شرح وظایف', `<h4>وظایف اصلی</h4>${multiline(job.dutiesMain)}<h4>وظایف فرعی</h4>${multiline(job.dutiesSecondary)}`)}
      ${profileSection(4, 'مسئولیت‌ها', multiline(job.responsibilities))}
      ${profileSection(5, 'اختیارات', multiline(job.authorities))}
      ${profileSection(6, 'ارتباطات سازمانی', `<p>${escapeHtml(job.communications || '— ثبت نشده —')}</p>`)}
      ${profileSection(7, 'شرایط احراز', qualificationTable)}
      ${profileSection(8, 'مهارت‌ها', `<p>${escapeHtml(job.skills || '— ثبت نشده —')}</p>`)}
      ${profileSection(9, 'شرایط محیط کار و تجهیزات', `<p>${escapeHtml(job.workingConditions || '—')}</p><p class="small muted">ابزار: ${escapeHtml(job.tools || '—')}</p>`)}
      ${profileSection(10, 'عوامل ارزیابی', `<p class="small muted">نظام چهارعاملی ۱۳۸۹ — ${fmt(factors.length)} عامل، ۱۴ زیرعامل</p>${evaluationContent}`)}
      ${profileSection(11, 'امتیازات', scoresContent)}
      ${profileSection(12, 'گروه شغلی', groupContent)}
      ${profileSection(13, 'تأیید کارشناسی', approvalContent)}
      <footer class="profile-footer small muted">
        این شناسنامه خروجی سامانه است و جایگزین صورت‌جلسه کمیته طبقه‌بندی مشاغل و حکم کارگزینی نیست.
      </footer>
    </article>`;

  const approvalSelect = document.getElementById('approval-status');
  if (approvalSelect && approval) {
    setElementValue(approvalSelect, approval.status);
    setElementValue(document.getElementById('approval-final-group'), approval.finalGroup ?? '');
    setElementValue(document.getElementById('approval-expert'), approval.expertName ?? '');
    setElementValue(document.getElementById('approval-ref'), approval.committeeRef ?? '');
    if (approval.changeReason) setElementValue(document.getElementById('approval-reason'), approval.changeReason);
    if (approval.decisionDate) setElementValue(document.getElementById('approval-date'), approval.decisionDate);
  }
  const approvalSave = document.getElementById('approval-save');
  if (approvalSave) approvalSave.addEventListener('click', () => saveApproval(job.id));
  const approvalReopen = document.getElementById('approval-reopen');
  if (approvalReopen) approvalReopen.addEventListener('click', () => reopenApproval(job.id));
}

function saveApproval(jobId) {
  if (!ensureWrite('approval', 'ثبت تصمیم تأیید گروه')) return;
  const job = jobById(jobId);
  const message = document.getElementById('approval-msg');
  if (!job?.evaluation) {
    if (message) message.textContent = 'این شغل ارزیابی ثبت‌شده ندارد.';
    return;
  }
  const status = selectValue(document.getElementById('approval-status'), 'PENDING_COMMITTEE_APPROVAL');
  const finalGroupRaw = selectValue(document.getElementById('approval-final-group'), '');
  const finalGroup = finalGroupRaw ? Number(finalGroupRaw) : null;
  const expertName = document.getElementById('approval-expert').value.trim();
  const committeeRef = document.getElementById('approval-ref').value.trim();
  const decisionDate = document.getElementById('approval-date').value.trim() || todayJalali();
  const changeReason = document.getElementById('approval-reason').value.trim();
  const proposed = job.evaluation.proposedGroup ?? null;

  const problems = [];
  const approve = status === 'COMMITTEE_APPROVED' || status === 'MINISTRY_APPROVED';
  if (approve) {
    if (!expertName) problems.push('نام کارشناس الزامی است.');
    if (!committeeRef) problems.push('شماره صورت‌جلسه کمیته الزامی است.');
    if (!finalGroup) problems.push('برای تأیید، تعیین گروه نهایی الزامی است.');
    if (finalGroup && proposed && finalGroup !== proposed && !changeReason) {
      problems.push('گروه نهایی با پیشنهاد متفاوت است؛ ثبت دلیل تغییر گروه الزامی است.');
    }
  }
  if (status === 'REJECTED') {
    if (!expertName) problems.push('نام کارشناس الزامی است.');
    if (!changeReason) problems.push('دلیل رد پیشنهاد الزامی است.');
  }
  if (problems.length > 0) {
    if (message) message.textContent = problems.join(' ');
    return;
  }

  const previous = normalizeApproval(job.evaluation);
  const history = [
    ...(previous.history ?? []),
    {
      at: new Date().toISOString(),
      decisionDate,
      status,
      finalGroup: status === 'REJECTED' || status === 'PENDING_COMMITTEE_APPROVAL' ? null : finalGroup,
      expertName: expertName || null,
      committeeRef: committeeRef || null,
      changeReason: changeReason || null,
    },
  ].slice(-30);

  const approval = {
    status,
    finalGroup: status === 'REJECTED' || status === 'PENDING_COMMITTEE_APPROVAL' ? null : finalGroup,
    expertName: expertName || null,
    committeeRef: committeeRef || null,
    decisionDate: status === 'PENDING_COMMITTEE_APPROVAL' ? null : decisionDate,
    changeReason: changeReason || null,
    approvedAt: approve ? new Date().toISOString() : null,
    history,
  };

  const jobs = state.store.jobs.map((row) =>
    row.id === job.id
      ? { ...row, evaluation: { ...row.evaluation, approval }, updatedAt: new Date().toISOString() }
      : row,
  );
  writeStore({ ...state.store, jobs });
  renderJobProfile(jobById(job.id));
  renderJobsTable();
  renderGroupJobsComparison();
  const freshMessage = document.getElementById('approval-msg');
  if (freshMessage) {
    freshMessage.textContent = approve
      ? `تصمیم تأیید ثبت شد: گروه نهایی ${finalGroup ? fmt(finalGroup) : '—'} — ${APPROVAL_STATUS_LABELS[status] ?? status}`
      : `تصمیم ثبت شد: ${APPROVAL_STATUS_LABELS[status] ?? status}`;
  }
  logActivity('approval', approve ? 'APPROVE' : 'UPDATE', `ثبت تصمیم «${APPROVAL_STATUS_LABELS[status] ?? status}» برای شغل ${job.jobCode}${finalGroup ? ` — گروه نهایی ${finalGroup}` : ''}`);
  showToast(approve ? 'تصمیم تأیید گروه ثبت شد' : 'تصمیم کارشناسی ثبت شد');
}

function reopenApproval(jobId) {
  if (!ensureWrite('approval', 'بازگشت تأیید به انتظار')) return;
  const job = jobById(jobId);
  if (!job?.evaluation) return;
  const confirmed = typeof window.confirm === 'function'
    ? window.confirm('تأیید فعلی لغو و پرونده به وضعیت «در انتظار تأیید کمیته» برگردد؟ سابقه در تاریخچه می‌ماند.')
    : true;
  if (!confirmed) return;
  const previous = normalizeApproval(job.evaluation);
  const history = [
    ...(previous.history ?? []),
    {
      at: new Date().toISOString(),
      decisionDate: todayJalali(),
      status: 'PENDING_COMMITTEE_APPROVAL',
      finalGroup: null,
      expertName: null,
      committeeRef: null,
      changeReason: 'لغو تأیید پیشین و بازگشت به وضعیت بررسی',
    },
  ].slice(-30);
  const jobs = state.store.jobs.map((row) =>
    row.id === job.id
      ? {
          ...row,
          evaluation: {
            ...row.evaluation,
            approval: {
              status: 'PENDING_COMMITTEE_APPROVAL',
              finalGroup: null,
              expertName: null,
              committeeRef: null,
              decisionDate: null,
              changeReason: null,
              approvedAt: null,
              history,
            },
          },
          updatedAt: new Date().toISOString(),
        }
      : row,
  );
  writeStore({ ...state.store, jobs });
  renderJobProfile(jobById(job.id));
  renderJobsTable();
  renderGroupJobsComparison();
  showToast('پرونده به وضعیت «در انتظار تأیید» بازگشت');
}

function renderGroupJobsComparison() {
  const table = document.getElementById('group-jobs-table');
  if (!table) return;
  const jobs = workshopJobs().filter((job) => job.evaluation);
  const note = document.getElementById('group-jobs-note');
  if (note) note.textContent = `${fmt(jobs.length)} شغل ارزیابی‌شده`;
  if (jobs.length === 0) {
    table.innerHTML = `<tbody><tr><td><div class="empty-state">هنوز شغلی در بانک مشاغل این کارگاه ارزیابی نشده است.</div></td></tr></tbody>`;
    return;
  }
  table.innerHTML = `
    <thead>
      <tr>
        <th>کد شغل</th><th>عنوان</th><th>امتیاز کل</th><th>گروه پیشنهادی</th>
        <th>گروه نهایی</th><th>اختلاف</th><th>وضعیت تأیید</th><th>کارشناس / صورت‌جلسه</th>
      </tr>
    </thead>
    <tbody>
      ${jobs
        .map((job) => {
          const approval = normalizeApproval(job.evaluation);
          const proposed = job.evaluation.proposedGroup ?? null;
          const final = approval?.finalGroup ?? null;
          const delta = final && proposed ? final - proposed : null;
          return `<tr>
            <td class="num">${escapeHtml(job.jobCode)}</td>
            <td>${escapeHtml(job.title)}</td>
            <td class="num">${fmt(job.evaluation.totalScore, 1)}</td>
            <td class="num">${proposed ? fmt(proposed) : '—'}</td>
            <td class="num">${final ? `<strong>${fmt(final)}</strong>` : '—'}</td>
            <td class="num">${delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}</td>
            <td><span class="chip ${APPROVAL_CHIP_CLASS[approval.status] ?? 'neutral'}">${escapeHtml(APPROVAL_STATUS_LABELS[approval.status] ?? '')}</span></td>
            <td class="small">${escapeHtml(approval.expertName || '—')}${approval.committeeRef ? ` / ${escapeHtml(approval.committeeRef)}` : ''}</td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

/* ================================ ارزیابی ================================ */

function renderEvalJobOptions() {
  const select = document.getElementById('e-job');
  if (!select) return;
  const current = selectValue(select, '');
  const jobs = workshopJobs();
  select.innerHTML =
    '<option value="">بدون اتصال به شغل</option>' +
    jobs
      .map(
        (job) =>
          `<option value="${escapeHtml(job.id)}">${escapeHtml(job.jobCode)} — ${escapeHtml(job.title)}</option>`,
      )
      .join('');
  const preferred = jobs.some((job) => job.id === current) ? current : '';
  setElementValue(select, preferred);
}

function initEval() {
  renderEvalForm();
  renderEvalJobOptions();
  $('#e-calc').addEventListener('click', () => {
    try {
      computeEval();
    } catch (error) {
      $('#eval-results').innerHTML = `<div class="warnings"><h4>خطای امتیازدهی</h4><ul><li>${escapeHtml(error.message)}</li></ul></div>`;
    }
  });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });
  applyPreset('welder');
}

function renderEvalForm() {
  const container = $('#eval-form');
  const subs = subFactorsOf('EVAL_1389_POINT_FACTOR');
  state.evalControls = [];
  container.innerHTML = '';

  for (const sub of subs) {
    const factor = factorOf(sub);
    const card = document.createElement('div');
    card.className = `eval-card${sub.scoringEnabled ? '' : ' is-disabled'}`;
    card.dataset.code = sub.code;

    const head = `
      <div class="eval-card-head">
        <h4>${escapeHtml(sub.name)}</h4>
        <span class="meta">سقف ${fmt(sub.maxScore)} · وزن ${fmt(sub.officialWeightPct, 1)}٪</span>
      </div>
      <div class="small muted">${escapeHtml(factor?.name ?? '')}</div>`;

    if (!sub.scoringEnabled || sub.scoringMechanism === 'DISABLED_PENDING_OFFICIAL_TABLE') {
      card.innerHTML = `${head}
        <div class="disabled-note">جدول رسمی سطوح این زیرعامل در دسترس نیست؛ امتیازدهی خودکار غیرفعال است و امتیاز آن صفر لحاظ می‌شود.</div>
        <div>${chip(sub.validityStatus)}</div>`;
      container.appendChild(card);
      continue;
    }

    const levels = state.data.levels
      .filter((row) => row.subFactorId === sub.id)
      .sort((a, b) => a.levelNumber - b.levelNumber);
    const control = { sub, card, levels };

    switch (sub.scoringMechanism) {
      case 'SINGLE_DEGREE': {
        const options = levelOptionsHtml(
          uniqueLevelObjects(levels.filter((row) => row.secondaryDimensionCode === 'DEFAULT')),
          true,
        );
        card.innerHTML = `${head}
          <label class="field"><span>سطح ${escapeHtml(sub.name)}</span>
            <select data-role="level">${options}</select>
          </label>
          <div class="small muted">${escapeHtml(sub.definition ?? '')}</div>`;
        control.kind = 'LEVEL';
        control.levelSelect = card.querySelector('[data-role="level"]');
        break;
      }
      case 'MATRIX_2D': {
        const optionLevels = levelOptionsHtml(uniqueLevelObjects(levels));
        const dims = [...new Set(levels.map((row) => row.secondaryDimensionCode))];
        card.innerHTML = `${head}
          <label class="field"><span>سطح</span><select data-role="level">${optionLevels}</select></label>
          <label class="field"><span>درجه / احتمال</span><select data-role="dim">${dims
            .map((dim) => {
              const level = levels.find((row) => row.secondaryDimensionCode === dim);
              return `<option value="${dim}">${escapeHtml(level?.secondaryDimensionTitle ?? dim)}</option>`;
            })
            .join('')}</select></label>`;
        control.kind = 'MATRIX';
        control.levelSelect = card.querySelector('[data-role="level"]');
        control.dimSelect = card.querySelector('[data-role="dim"]');
        break;
      }
      case 'DOMINANT_ACTIVITY_ROW': {
        const rows = levelOptionsHtml(uniqueLevelObjects(levels));
        const dims = [...new Set(levels.map((row) => row.secondaryDimensionCode))];
        card.innerHTML = `${head}
          <label class="field"><span>جزء غالب فعالیت جسمانی</span><select data-role="level">${rows}</select></label>
          <label class="field"><span>مدت انجام در روز</span><select data-role="dim">${dims
            .map((dim) => {
              const level = levels.find((row) => row.secondaryDimensionCode === dim);
              return `<option value="${dim}">${escapeHtml(level?.secondaryDimensionTitle ?? BRACKET_LABELS[dim] ?? dim)}</option>`;
            })
            .join('')}</select></label>
          <div class="small muted">فقط یک ردیف غالب امتیاز می‌گیرد (جدول رسمی ۸ ستون ساعتی).</div>`;
        control.kind = 'DOMINANT';
        control.levelSelect = card.querySelector('[data-role="level"]');
        control.dimSelect = card.querySelector('[data-role="dim"]');
        break;
      }
      case 'SUPERVISION_COMPOSITE': {
        const direct = levels.filter((row) => row.secondaryDimensionCode === 'DIRECT');
        const indirectHint = levels.find((row) => row.secondaryDimensionCode === 'INDIRECT');
        card.innerHTML = `${head}
          <div class="small muted">سرپرستی مستقیم (به ازای هر نفر بر حسب درجه) — سقف ۴۰ امتیاز</div>
          <div class="sup-grid">
            ${direct
              .map((level) => {
                const rule = ruleOf(level.id);
                return `<label class="field"><span>${escapeHtml(level.levelCode)} · ${fmt(rule?.pointsPerPerson ?? 1)} امتیاز/نفر</span>
                  <input type="number" min="0" step="1" value="0" data-grade="${level.levelCode}" />
                </label>`;
              })
              .join('')}
          </div>
          <label class="field"><span>تعداد نفرات تحت سرپرستی غیرمستقیم</span>
            <input type="number" min="0" step="1" value="0" data-role="indirect" />
          </label>
          <div class="small muted">${escapeHtml(indirectHint?.secondaryDimensionTitle ?? 'پلکانی، سقف ۳۰ امتیاز')}</div>`;
        control.kind = 'SUPERVISION';
        control.gradeInputs = [...card.querySelectorAll('[data-grade]')];
        control.indirectInput = card.querySelector('[data-role="indirect"]');
        break;
      }
      case 'MULTI_ITEM_SUM_CAPPED': {
        const items = uniqueLevelObjects(levels);
        const intensities = ['MODERATE', 'HIGH', 'SEVERE'];
        const brackets = [...new Set(levels.map((row) => row.secondaryDimensionCode.split('_')[1]))];
        card.innerHTML = `${head}
          <div class="small muted">هر جزء با شدت و ساعات مواجهه؛ حداکثر ۱۲ جزء و سقف ۱۲۰ امتیاز.</div>
          <div class="env-rows" data-role="rows"></div>
          <button type="button" class="add-row-btn" data-role="add">+ افزودن جزء</button>`;
        control.kind = 'ENV';
        control.envItems = items;
        control.intensities = intensities;
        control.brackets = brackets;
        control.rowsContainer = card.querySelector('[data-role="rows"]');
        card.querySelector('[data-role="add"]').addEventListener('click', () => addEnvRow(control));
        addEnvRow(control);
        addEnvRow(control);
        break;
      }
      case 'INJURY_PLUS_DISEASE_CAPPED': {
        const injuries = levelOptionsHtml(uniqueLevelObjects(levels.filter((row) => row.levelCode !== 'HZ_DISEASE')));
        card.innerHTML = `${head}
          <label class="field"><span>سطح صدمات جسمی</span><select data-role="injury">${injuries}</select></label>
          <label class="field"><span>احتمال صدمات</span><select data-role="injury-prob">
            <option value="LOW">کم</option><option value="MEDIUM" selected>متوسط</option><option value="HIGH">زیاد</option>
          </select></label>
          <label class="field"><span>امراض ناشی از کار</span><select data-role="disease">
            <option value="">بدون امراض</option>
            <option value="LOW">کم</option><option value="MEDIUM" selected>متوسط</option>
            <option value="HIGH">زیاد</option><option value="VERY_HIGH">خیلی زیاد</option>
          </select></label>`;
        control.kind = 'HAZARD';
        control.injurySelect = card.querySelector('[data-role="injury"]');
        control.injuryProbSelect = card.querySelector('[data-role="injury-prob"]');
        control.diseaseSelect = card.querySelector('[data-role="disease"]');
        break;
      }
      default: {
        card.innerHTML = `${head}<div class="disabled-note">سازوکار ${escapeHtml(sub.scoringMechanism)} در وب پشتیبانی نمی‌شود.</div>`;
        break;
      }
    }

    container.appendChild(card);
    state.evalControls.push(control);
  }
}

function ruleOf(levelId) {
  const score = state.data.scores.find((row) => row.levelId === levelId);
  if (!score?.rule) return null;
  try {
    return JSON.parse(score.rule);
  } catch {
    return null;
  }
}

function uniqueLevelObjects(levels) {
  const seen = new Set();
  const options = [];
  for (const level of levels) {
    if (seen.has(level.levelCode)) continue;
    seen.add(level.levelCode);
    options.push(level);
  }
  return options;
}

function levelOptionsHtml(levels, showPoints = false) {
  return levels
    .map((level) => {
      const points = showPoints ? ` — ${fmt(rateOf(level.id))} امتیاز` : '';
      return `<option value="${level.levelCode}">${escapeHtml(level.title)}${points}</option>`;
    })
    .join('');
}

function addEnvRow(control) {
  const rows = control.rowsContainer.querySelectorAll('.env-row');
  if (rows.length >= 12) return;
  const row = document.createElement('div');
  row.className = 'env-row';
  row.innerHTML = `
    <select data-role="item">${control.envItems
      .map((level) => `<option value="${level.levelCode}">${escapeHtml(level.title)}</option>`)
      .join('')}</select>
    <select data-role="intensity">${control.intensities
      .map((code) => `<option value="${code}">${INTENSITY_LABELS[code]}</option>`)
      .join('')}</select>
    <select data-role="bracket">${control.brackets
      .map((code) => `<option value="${code}">${BRACKET_LABELS[code] ?? code}</option>`)
      .join('')}</select>
    <button type="button" class="icon-btn" title="حذف">✕</button>`;
  row.querySelector('.icon-btn').addEventListener('click', () => {
    if (control.rowsContainer.querySelectorAll('.env-row').length > 1) row.remove();
  });
  control.rowsContainer.appendChild(row);
}

function controlByCode(code) {
  return state.evalControls.find((control) => control.sub.code === code);
}

function setElementValue(element, value) {
  if (!element) return;
  try {
    element.value = value;
  } catch {
    element.setAttribute('value', value);
  }
  if (element.tagName === 'INPUT' && element.getAttribute('value') === null) {
    element.setAttribute('value', value);
  }
  if (element.tagName === 'SELECT') {
    const options = [...(element.options ?? [])];
    const option = options.find((item) => item.value === value || item.getAttribute('value') === value);
    if (option) {
      options.forEach((item) => item.removeAttribute('selected'));
      option.setAttribute('selected', 'selected');
    }
  }
}

function setSelectByValue(select, value) {
  if (!select || value === undefined || value === null) return;
  setElementValue(select, value);
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  for (const control of state.evalControls) {
    const value = preset[control.sub.code];
    if (value === undefined) continue;
    switch (control.kind) {
      case 'LEVEL':
        setSelectByValue(control.levelSelect, value.levelCode);
        break;
      case 'MATRIX':
        setSelectByValue(control.levelSelect, value.levelCode);
        setSelectByValue(control.dimSelect, value.dim);
        break;
      case 'DOMINANT':
        setSelectByValue(control.levelSelect, value.levelCode);
        setSelectByValue(control.dimSelect, value.dim);
        break;
      case 'SUPERVISION':
        for (const input of control.gradeInputs) {
          setElementValue(input, value.grades?.[input.dataset.grade] ?? 0);
        }
        setElementValue(control.indirectInput, value.indirect ?? 0);
        break;
      case 'ENV':
        control.rowsContainer.innerHTML = '';
        for (const item of value.items) {
          addEnvRow(control);
          const row = control.rowsContainer.querySelector('.env-row:last-child');
          setSelectByValue(row.querySelector('[data-role="item"]'), item.itemCode);
          setSelectByValue(row.querySelector('[data-role="intensity"]'), item.intensityCode);
          setSelectByValue(row.querySelector('[data-role="bracket"]'), item.hoursBracketCode);
        }
        break;
      case 'HAZARD':
        setSelectByValue(control.injurySelect, value.injuryLevelCode);
        setSelectByValue(control.injuryProbSelect, value.injuryProbabilityCode);
        setSelectByValue(control.diseaseSelect, value.diseaseProbabilityCode ?? '');
        break;
    }
  }
  computeEval();
}

const PRESETS = {
  welder: {
    EDU: { levelCode: 'EDU_3' },
    EXP: { levelCode: 'EXP_3' },
    SUP: { grades: {}, indirect: 0 },
    MAT_PRD: { levelCode: 'L2', dim: 'P_MEDIUM' },
    MCH_EQP: { levelCode: 'L3', dim: 'P_HIGH' },
    COM_REL: { levelCode: 'L1', dim: 'C_LOW' },
    FIN_AST: { levelCode: 'L1', dim: 'P_LOW' },
    FRM_RPT: { levelCode: 'L1', dim: 'V_LOW' },
    SPC_RSP: { levelCode: 'L2', dim: 'I_LOW' },
    MNT_EFF: { levelCode: 'L2', dim: 'I_MEDIUM' },
    PHY_EFF: { levelCode: 'PHY_6B', dim: 'H5' },
    ENV_CND: {
      items: [
        { itemCode: 'ENV_TEMP', intensityCode: 'HIGH', hoursBracketCode: 'B8' },
        { itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
        { itemCode: 'ENV_DUST', intensityCode: 'SEVERE', hoursBracketCode: 'B4' },
        { itemCode: 'ENV_SMOKE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
      ],
    },
    OCC_HAZ: { injuryLevelCode: 'HZ_INJ_3', injuryProbabilityCode: 'HIGH', diseaseProbabilityCode: 'MEDIUM' },
  },
  supervisor: {
    EDU: { levelCode: 'EDU_4' },
    EXP: { levelCode: 'EXP_6' },
    SUP: { grades: { G1: 8, G2: 3, G3: 1 }, indirect: 25 },
    MAT_PRD: { levelCode: 'L3', dim: 'P_MEDIUM' },
    MCH_EQP: { levelCode: 'L2', dim: 'P_MEDIUM' },
    COM_REL: { levelCode: 'L3', dim: 'C_MEDIUM' },
    FIN_AST: { levelCode: 'L2', dim: 'P_MEDIUM' },
    FRM_RPT: { levelCode: 'L3', dim: 'V_MEDIUM' },
    SPC_RSP: { levelCode: 'L3', dim: 'I_MEDIUM' },
    MNT_EFF: { levelCode: 'L4', dim: 'I_MEDIUM' },
    PHY_EFF: { levelCode: 'PHY_2', dim: 'H4' },
    ENV_CND: { items: [{ itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B4' }] },
    OCC_HAZ: { injuryLevelCode: 'HZ_INJ_2', injuryProbabilityCode: 'MEDIUM', diseaseProbabilityCode: 'LOW' },
  },
};

function collectSelections() {
  const selections = [];
  for (const control of state.evalControls) {
    if (!control.kind) continue;
    switch (control.kind) {
      case 'LEVEL':
        selections.push({ subFactorCode: control.sub.code, kind: 'LEVEL', levelCode: selectValue(control.levelSelect) });
        break;
      case 'MATRIX':
        selections.push({
          subFactorCode: control.sub.code,
          kind: 'MATRIX',
          levelCode: selectValue(control.levelSelect),
          secondaryDimensionCode: selectValue(control.dimSelect),
        });
        break;
      case 'DOMINANT':
        selections.push({
          subFactorCode: control.sub.code,
          kind: 'DOMINANT_ROW',
          levelCode: selectValue(control.levelSelect),
          hoursBracketCode: selectValue(control.dimSelect),
        });
        break;
      case 'SUPERVISION': {
        const grades = {};
        for (const input of control.gradeInputs) {
          const count = Number(input.value || 0);
          if (count > 0) grades[input.dataset.grade] = count;
        }
        selections.push({
          subFactorCode: control.sub.code,
          kind: 'SUPERVISION',
          directHeadcountByGrade: grades,
          indirectHeadcount: Number(control.indirectInput.value || 0),
        });
        break;
      }
      case 'ENV': {
        const items = [...control.rowsContainer.querySelectorAll('.env-row')].map((row) => ({
          itemCode: selectValue(row.querySelector('[data-role="item"]')),
          intensityCode: selectValue(row.querySelector('[data-role="intensity"]')),
          hoursBracketCode: selectValue(row.querySelector('[data-role="bracket"]')),
        }));
        selections.push({ subFactorCode: control.sub.code, kind: 'ENV_ITEMS', items });
        break;
      }
      case 'HAZARD': {
        const selection = {
          subFactorCode: control.sub.code,
          kind: 'HAZARD',
          injuryProbabilityCode: selectValue(control.injuryProbSelect),
        };
        const injuryLevel = selectValue(control.injurySelect);
        if (injuryLevel) selection.injuryLevelCode = injuryLevel;
        const disease = selectValue(control.diseaseSelect);
        if (disease) selection.diseaseProbabilityCode = disease;
        selections.push(selection);
        break;
      }
      default:
        break;
    }
  }
  return selections;
}

function computeEval() {
  const date = $('#e-date').value || '1405-03-15';
  const result = core.evaluatePointBased(state.data, {
    systemCode: 'EVAL_1389_POINT_FACTOR',
    evaluationDate: date,
    selections: collectSelections(),
  });
  const match = core.matchGroup(state.data, {
    schemeCode: 'NATIONAL_20_GROUP_1389',
    score: result.totalScore,
    asOfDate: date,
  });
  state.evalResult = result;
  renderEval(result, match);
}

function renderEval(result, match) {
  const target = $('#eval-results');
  const summary = `
    <div class="summary-grid">
      <div class="summary-card is-accent"><span class="label">امتیاز کل شغل</span>
        <span class="value">${fmt(result.totalScore, 1)}</span><span class="unit">از ${fmt(result.maxTheoreticalScore)}</span></div>
      <div class="summary-card"><span class="label">گروه پیشنهادی</span>
        <span class="value">${match.group === null ? '—' : fmt(match.group)}</span>
        <span class="unit">${match.range ? `بازه ${fmt(match.range.minScore)}–${fmt(match.range.maxScore)}` : ''}</span></div>
      <div class="summary-card is-neutral"><span class="label">کامل بودن امتیازدهی</span>
        <span class="value">${result.scoringComplete ? 'کامل' : 'ناقص'}</span>
        <span class="unit">${result.unscoredSubFactors.length} زیرعامل بدون جدول</span></div>
      <div class="summary-card is-neutral"><span class="label">نسبت از سقف نظری</span>
        <span class="value">${fmt((result.totalScore / result.maxTheoreticalScore) * 100, 1)}٪</span></div>
    </div>`;

  const factorTable = `
    <div class="card">
      <h3 class="card-title">امتیاز عوامل اصلی</h3>
      <div class="table-wrap" style="max-height:none">
        <table class="data-table">
          <thead><tr><th>عامل</th><th>امتیاز کسب‌شده</th><th>سقف عامل</th><th>وزن رسمی</th></tr></thead>
          <tbody>
            ${result.factorScores
              .map(
                (factor) => `<tr>
                  <td>${escapeHtml(factor.factorName)} <span class="small muted">(${escapeHtml(factor.factorCode)})</span></td>
                  <td class="num">${fmt(factor.points, 1)}</td>
                  <td class="num">${fmt(factor.maxScore)}</td>
                  <td class="num">${fmt(factor.officialWeightPct, 1)}٪</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const subTable = `
    <div class="card">
      <h3 class="card-title">ریز امتیاز ۱۴ زیرعامل</h3>
      <div class="table-wrap tall">
        <table class="data-table">
          <thead><tr><th>زیرعامل</th><th>سقف</th><th>امتیاز</th><th>شرح انتخاب</th><th>وضعیت</th></tr></thead>
          <tbody>
            ${result.subFactorScores
              .map(
                (sub) => `<tr>
                  <td>${escapeHtml(sub.subFactorName)}
                    <div class="small muted">${escapeHtml(sub.factorName)}</div></td>
                  <td class="num">${fmt(sub.maxScore)}</td>
                  <td class="num"><strong>${fmt(sub.points, 1)}</strong></td>
                  <td class="desc">${escapeHtml(localizeDigits(sub.selectionDescription))}</td>
                  <td>${chip(sub.validityStatus)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const warnings =
    result.warnings.length > 0
      ? `<div class="warnings"><h4>هشدارها و محدودیت‌های مستندسازی</h4><ul>${result.warnings
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></div>`
      : '';

  const approvalNote = `
    <div class="ok-note">
      گروه پیشنهادی <strong>${match.group === null ? '—' : fmt(match.group)}</strong> است و وضعیت آن
      «در انتظار تأیید کمیته طبقه‌بندی مشاغل و اداره کل روابط کار» است؛ بدون نام کارشناس و شماره صورت‌جلسه، گروه قطعی نمی‌شود.
    </div>`;

  const selectedJobId = selectValue(document.getElementById('e-job'), '');
  state.evalJobId = selectedJobId || null;
  const job = selectedJobId ? jobById(selectedJobId) : null;
  const savePanel = `
    <div class="card no-print">
      <h3 class="card-title">ثبت نتیجه در شناسنامه شغل</h3>
      ${
        job
          ? `<p class="small">شغل انتخاب‌شده: <strong>${escapeHtml(job.jobCode)} — ${escapeHtml(job.title)}</strong>
              ${job.evaluation ? `<span class="muted">(ارزیابی قبلی: ${fmt(job.evaluation.totalScore, 1)} امتیاز — گروه ${fmt(job.evaluation.proposedGroup)} در ${escapeHtml(localizeDigits(job.evaluation.evaluatedAt ?? ''))})</span>` : ''}
            </p>
            <button class="primary-btn" type="button" id="eval-save">ثبت امتیاز و گروه در شناسنامه</button>`
          : `<p class="muted small">برای ثبت در شناسنامه، ابتدا از نوار بالای همین بخش «شغل مرتبط» را انتخاب کنید.</p>`
      }
      <p class="form-error" id="eval-save-msg" role="status"></p>
    </div>`;

  target.innerHTML = summary + factorTable + subTable + warnings + approvalNote + savePanel;

  const saveButton = document.getElementById('eval-save');
  if (saveButton) {
    saveButton.addEventListener('click', () => saveEvaluationToJob(result, match));
  }
}

function saveEvaluationToJob(result, match) {
  const job = jobById(state.evalJobId ?? '');
  const message = document.getElementById('eval-save-msg');
  if (!job) {
    if (message) message.textContent = 'شغل مرتبط انتخاب نشده است.';
    return;
  }
  const previousApproval = normalizeApproval(job.evaluation);
  const evaluation = {
    totalScore: result.totalScore,
    proposedGroup: match.group ?? null,
    rangeMin: match.range?.minScore ?? null,
    rangeMax: match.range?.maxScore ?? null,
    tableVersion: match.tableVersion ?? null,
    evaluationDate: document.getElementById('e-date').value || '1405-03-15',
    evaluatedAt: new Date().toISOString(),
    scoringComplete: result.scoringComplete,
    systemVersion: result.systemVersion,
    factorScores: result.factorScores.map((factor) => ({
      factorCode: factor.factorCode,
      factorName: factor.factorName,
      points: factor.points,
      maxScore: factor.maxScore,
      officialWeightPct: factor.officialWeightPct,
    })),
    subFactorScores: result.subFactorScores.map((sub) => ({
      code: sub.subFactorCode,
      name: sub.subFactorName,
      points: sub.points,
      maxScore: sub.maxScore,
      validityStatus: sub.validityStatus,
      selectionDescription: sub.selectionDescription,
    })),
    approval: {
      status: 'PENDING_COMMITTEE_APPROVAL',
      finalGroup: null,
      expertName: null,
      committeeRef: null,
      decisionDate: null,
      changeReason: null,
      approvedAt: null,
      history: [
        ...(previousApproval?.history ?? []),
        {
          at: new Date().toISOString(),
          decisionDate: document.getElementById('e-date').value || '1405-03-15',
          status: 'PENDING_COMMITTEE_APPROVAL',
          finalGroup: null,
          expertName: null,
          committeeRef: null,
          changeReason: 'ثبت/به‌روزرسانی ارزیابی امتیازی',
        },
      ].slice(-30),
    },
  };
  const jobs = state.store.jobs.map((row) =>
    row.id === job.id ? { ...row, evaluation, updatedAt: new Date().toISOString() } : row,
  );
  writeStore({ ...state.store, jobs });
  if (message) message.textContent = `ثبت شد: ${fmt(evaluation.totalScore, 1)} امتیاز — گروه پیشنهادی ${evaluation.proposedGroup ? fmt(evaluation.proposedGroup) : 'نامشخص'}`;
  showToast('نتیجه ارزیابی در شناسنامه شغل ثبت شد');
  renderJobsTable();
}


/* ============================ ساختار سازمانی ============================ */

const UNIT_TYPE_LABELS = { LINE: 'صفی', STAFF: 'ستادی', PRODUCTION: 'تولیدی', SUPPORT: 'پشتیبانی' };
const UNIT_STATUS_LABELS = { ACTIVE: 'فعال', INACTIVE: 'غیرفعال' };
const UNIT_MAX_DEPTH = 6;
const UNIT_CODE_PATTERN = /^[0-9A-Za-z\u0600-\u06FF][0-9A-Za-z\u0600-\u06FF_-]{1,23}$/;

function workshopUnits() {
  const workshop = activeWorkshop();
  if (!workshop) return [];
  return state.store.units.filter((unit) => unit.workshopId === workshop.id);
}

function unitById(id) {
  return state.store.units.find((unit) => unit.id === id) ?? null;
}

function unitDepth(unit) {
  let depth = 1;
  let cursor = unit;
  const seen = new Set([unit.id]);
  while (cursor?.parentId) {
    const parent = unitById(cursor.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    depth += 1;
    cursor = parent;
  }
  return depth;
}

function unitPath(unit) {
  const titles = [];
  let cursor = unit;
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    titles.unshift(cursor.title);
    cursor = cursor.parentId ? unitById(cursor.parentId) : null;
  }
  return titles.join(' ← ');
}

function unitDescendantIds(id) {
  const collected = [];
  const queue = [id];
  const seen = new Set([id]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const unit of state.store.units) {
      if (unit.parentId === current && !seen.has(unit.id)) {
        seen.add(unit.id);
        collected.push(unit.id);
        queue.push(unit.id);
      }
    }
  }
  return collected;
}

/** ترتیب نمایش درختی: ریشه‌ها و سپس فرزندان به ترتیب کد. */
function unitsTreeOrder(units) {
  const known = new Set(units.map((unit) => unit.id));
  const childrenOf = new Map();
  for (const unit of units) {
    const key = unit.parentId && known.has(unit.parentId) ? unit.parentId : null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(unit);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => String(a.code).localeCompare(String(b.code), 'fa'));
  }
  const ordered = [];
  const seen = new Set();
  const walk = (parentId, depth) => {
    for (const unit of childrenOf.get(parentId) ?? []) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      ordered.push({ unit, depth });
      walk(unit.id, depth + 1);
    }
  };
  walk(null, 0);
  return ordered;
}

function renderJobUnitOptions(selectedId = '') {
  const select = document.getElementById('jf-unit-link');
  if (!select) return;
  const options = unitsTreeOrder(workshopUnits())
    .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.code)} — ${escapeHtml(unit.title)}</option>`)
    .join('');
  select.innerHTML = `<option value="">— بدون اتصال (متن آزاد) —</option>${options}`;
  setElementValue(select, selectedId ?? '');
}

function initOrg() {
  const newButton = document.getElementById('org-new');
  if (newButton) newButton.addEventListener('click', () => openOrgForm(null));

  const form = document.getElementById('org-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveUnitFromForm();
    });
  }
  for (const id of ['org-cancel', 'org-cancel-2']) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => closeOrgForm());
  }

  const tree = document.getElementById('org-tree');
  if (tree) {
    tree.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const unit = unitById(button.dataset.id);
      if (!unit) return;
      if (button.dataset.action === 'edit') openOrgForm(unit);
      if (button.dataset.action === 'delete') deleteUnit(unit);
    });
  }

  const print = document.getElementById('org-print');
  if (print) {
    print.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }

  renderOrgView();
}

function openOrgForm(unit) {
  if (!ensureWrite('org', 'ویرایش ساختار سازمانی')) return;
  const form = document.getElementById('org-form');
  if (!form) return;
  form.hidden = false;
  const title = document.getElementById('org-form-title');
  if (title) title.textContent = unit ? `ویرایش واحد ${unit.code}` : 'واحد سازمانی جدید';
  setElementValue(document.getElementById('of-id'), unit?.id ?? '');
  setElementValue(document.getElementById('of-code'), unit?.code ?? '');
  setElementValue(document.getElementById('of-title'), unit?.title ?? '');
  setElementValue(document.getElementById('of-type'), unit?.unitType ?? 'LINE');
  setElementValue(document.getElementById('of-manager'), unit?.managerName ?? '');
  setElementValue(document.getElementById('of-headcount'), unit?.approvedHeadcount ?? 0);
  setElementValue(document.getElementById('of-location'), unit?.location ?? '');
  setElementValue(document.getElementById('of-status'), unit?.active === false ? 'INACTIVE' : 'ACTIVE');
  setElementValue(document.getElementById('of-description'), unit?.description ?? '');
  renderOrgParentOptions(unit?.id ?? null, unit?.parentId ?? '');
  const error = document.getElementById('org-error');
  if (error) error.textContent = '';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeOrgForm() {
  const form = document.getElementById('org-form');
  if (form) form.hidden = true;
  const error = document.getElementById('org-error');
  if (error) error.textContent = '';
}

function renderOrgParentOptions(excludeId, selectedId = '') {
  const select = document.getElementById('of-parent');
  if (!select) return;
  const blocked = excludeId ? new Set([excludeId, ...unitDescendantIds(excludeId)]) : new Set();
  const options = unitsTreeOrder(workshopUnits())
    .filter(({ unit }) => !blocked.has(unit.id))
    .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.code)} — ${escapeHtml(unit.title)}</option>`)
    .join('');
  select.innerHTML = `<option value="">— سطح اول (بدون بالادست) —</option>${options}`;
  setElementValue(select, selectedId ?? '');
}

function saveUnitFromForm() {
  if (!ensureWrite('org', 'ذخیره واحد سازمانی')) return;
  const workshop = activeWorkshop();
  const errorTarget = document.getElementById('org-error');
  if (!workshop) {
    if (errorTarget) errorTarget.textContent = 'ابتدا یک کارگاه انتخاب کنید.';
    return;
  }
  const id = document.getElementById('of-id').value;
  const existing = id ? unitById(id) : null;
  const code = document.getElementById('of-code').value.trim();
  const title = document.getElementById('of-title').value.trim();
  const parentId = selectValue(document.getElementById('of-parent'), '') || null;

  const problems = [];
  if (!UNIT_CODE_PATTERN.test(code)) {
    problems.push('کد واحد باید ۲ تا ۲۴ نویسه باشد و فقط حروف، رقم، خط تیره و زیرخط بپذیرد.');
  }
  if (!title) problems.push('عنوان واحد الزامی است.');
  const duplicate = workshopUnits().find(
    (unit) => unit.id !== existing?.id && unit.code.toLowerCase() === code.toLowerCase(),
  );
  if (duplicate && code) problems.push(`کد واحد «${code}» قبلاً برای «${duplicate.title}» ثبت شده است.`);
  if (parentId && parentId === existing?.id) problems.push('واحد نمی‌تواند واحد بالادست خودش باشد.');
  if (parentId && existing?.id && unitDescendantIds(existing.id).includes(parentId)) {
    problems.push('واحد بالادست نمی‌تواند از زیرمجموعه‌های همین واحد باشد (ایجاد حلقه ممنوع است).');
  }
  const parent = parentId ? unitById(parentId) : null;
  if (parent && unitDepth(parent) + 1 > UNIT_MAX_DEPTH) {
    problems.push(`عمق ساختار سازمانی بیش از ${fmt(UNIT_MAX_DEPTH)} سطح مجاز نیست.`);
  }
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }

  const now = new Date().toISOString();
  const unit = {
    id: existing?.id ?? newId('unit'),
    workshopId: existing?.workshopId ?? workshop.id,
    code,
    title,
    parentId,
    unitType: selectValue(document.getElementById('of-type'), 'LINE'),
    managerName: document.getElementById('of-manager').value.trim(),
    approvedHeadcount: Math.max(0, Number(document.getElementById('of-headcount').value || 0)),
    location: document.getElementById('of-location').value.trim(),
    active: selectValue(document.getElementById('of-status'), 'ACTIVE') === 'ACTIVE',
    description: document.getElementById('of-description').value.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const units = existing
    ? state.store.units.map((row) => (row.id === unit.id ? unit : row))
    : [...state.store.units, unit];
  writeStore({ ...state.store, units });
  closeOrgForm();
  renderOrgView();
  logActivity('org', existing ? 'UPDATE' : 'CREATE', `${existing ? 'ویرایش' : 'ایجاد'} واحد «${unit.title}» (کد ${unit.code})`);
  showToast(existing ? 'واحد سازمانی به‌روزرسانی شد' : 'واحد سازمانی ثبت شد');
}

function deleteUnit(unit) {
  if (!ensureWrite('org', 'حذف واحد سازمانی')) return;
  const errorTarget = document.getElementById('org-error');
  const children = workshopUnits().filter((row) => row.parentId === unit.id);
  if (children.length > 0) {
    const message = `واحد «${unit.title}» ${fmt(children.length)} زیرمجموعه دارد؛ ابتدا زیرمجموعه‌ها را جابه‌جا یا حذف کنید.`;
    if (errorTarget) errorTarget.textContent = message;
    showToast(message);
    return;
  }
  const linkedJobs = workshopJobs().filter((job) => job.unitId === unit.id);
  if (linkedJobs.length > 0) {
    const message = `به واحد «${unit.title}» ${fmt(linkedJobs.length)} شغل متصل است؛ ابتدا اتصال مشاغل را تغییر دهید.`;
    if (errorTarget) errorTarget.textContent = message;
    showToast(message);
    return;
  }
  const confirmed = typeof window.confirm === 'function'
    ? window.confirm(`حذف واحد «${unit.title}»؟ این عمل قابل بازگشت نیست.`)
    : true;
  if (!confirmed) return;
  writeStore({ ...state.store, units: state.store.units.filter((row) => row.id !== unit.id) });
  renderOrgView();
  logActivity('org', 'DELETE', `حذف واحد «${unit.title}» (کد ${unit.code})`);
  showToast('واحد سازمانی حذف شد');
}

function renderOrgView() {
  const workspace = document.getElementById('org-workspace');
  const empty = document.getElementById('org-empty-workshop');
  if (!workspace || !empty) return;
  const hasWorkshop = Boolean(activeWorkshop());
  empty.hidden = hasWorkshop;
  workspace.hidden = !hasWorkshop;
  if (!hasWorkshop) return;
  renderOrgKpis();
  renderOrgTree();
  renderOrgJobsTable();
}

function renderOrgKpis() {
  const target = document.getElementById('org-kpis');
  if (!target) return;
  const units = workshopUnits();
  const ordered = unitsTreeOrder(units);
  const maxDepth = ordered.reduce((max, row) => Math.max(max, row.depth + 1), 0);
  const staff = units.filter((unit) => unit.unitType === 'STAFF').length;
  const line = units.filter((unit) => unit.unitType !== 'STAFF').length;
  const linkedJobs = workshopJobs().filter((job) => job.unitId && unitById(job.unitId)).length;
  const cards = [
    ['واحدهای سازمانی', fmt(units.length)],
    ['عمق درخت', maxDepth > 0 ? `${fmt(maxDepth)} سطح` : '—'],
    ['صفی / ستادی', `${fmt(line)} / ${fmt(staff)}`],
    ['مشاغل متصل به واحد', `${fmt(linkedJobs)} از ${fmt(workshopJobs().length)}`],
  ];
  target.innerHTML = `<div class="summary-grid">${cards
    .map(([label, value]) => `<div class="summary-card"><span class="label">${label}</span><span class="value">${value}</span></div>`)
    .join('')}</div>`;
}

function renderOrgTree() {
  const table = document.getElementById('org-tree');
  if (!table) return;
  const counter = document.getElementById('org-count');
  const units = workshopUnits();
  const ordered = unitsTreeOrder(units);
  if (counter) counter.textContent = `${fmt(units.length)} واحد`;
  if (ordered.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>
            <div class="empty-state">
              هنوز واحدی تعریف نشده است. با دکمه «واحد جدید» ریشه ساختار (مثلاً «مدیریت عامل») و سپس زیرمجموعه‌ها را بسازید.
            </div>
          </td>
        </tr>
      </tbody>`;
    return;
  }
  const rows = ordered
    .map(({ unit, depth }) => {
      const jobCount = workshopJobs().filter((job) => job.unitId === unit.id).length;
      return `<tr class="${unit.active === false ? 'is-inactive' : ''}">
        <td>
          <span class="org-indent" style="padding-right:${depth * 20}px"></span>
          ${depth > 0 ? '<span class="org-branch">└</span> ' : ''}
          <strong>${escapeHtml(unit.title)}</strong>
          ${unit.parentId ? `<div class="small muted">${escapeHtml(unitPath(unit))}</div>` : ''}
        </td>
        <td class="num" dir="ltr">${escapeHtml(unit.code)}</td>
        <td>${UNIT_TYPE_LABELS[unit.unitType] ?? escapeHtml(unit.unitType ?? '')}</td>
        <td class="num">${fmt(depth + 1)}</td>
        <td>${escapeHtml(unit.managerName || '—')}</td>
        <td class="num">${fmt(unit.approvedHeadcount ?? 0)}</td>
        <td class="num">${fmt(jobCount)}</td>
        <td>${unit.active === false ? '<span class="chip neutral">غیرفعال</span>' : '<span class="chip st-1">فعال</span>'}</td>
        <td class="actions-cell no-print">
          <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(unit.id)}" title="ویرایش">✎</button>
          <button type="button" class="icon-btn" data-action="delete" data-id="${escapeHtml(unit.id)}" title="حذف">✕</button>
        </td>
      </tr>`;
    })
    .join('');
  table.innerHTML = `
    <thead>
      <tr>
        <th>واحد سازمانی</th><th>کد واحد</th><th>نوع</th><th>سطح</th>
        <th>مسئول</th><th>نیروی مصوب</th><th>مشاغل</th><th>وضعیت</th><th class="no-print">عملیات</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function renderOrgJobsTable() {
  const table = document.getElementById('org-jobs-table');
  if (!table) return;
  const units = workshopUnits();
  const jobs = workshopJobs();
  const ordered = unitsTreeOrder(units);
  if (ordered.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr><td><div class="empty-state">پس از تعریف واحدها، شمار مشاغل هر واحد در این جدول نمایش داده می‌شود.</div></td></tr>
      </tbody>`;
    return;
  }
  let totalJobs = 0;
  let totalApproved = 0;
  let totalCurrent = 0;
  const rows = ordered
    .map(({ unit, depth }) => {
      const unitJobs = jobs.filter((job) => job.unitId === unit.id);
      const current = unitJobs.reduce((sum, job) => sum + Number(job.headcount || 0), 0);
      const approved = Number(unit.approvedHeadcount ?? 0);
      totalJobs += unitJobs.length;
      totalApproved += approved;
      totalCurrent += current;
      const gap = approved - current;
      return `<tr>
        <td>
          <span class="org-indent" style="padding-right:${depth * 20}px"></span>
          ${depth > 0 ? '<span class="org-branch">└</span> ' : ''}
          ${escapeHtml(unit.title)}
        </td>
        <td class="num" dir="ltr">${escapeHtml(unit.code)}</td>
        <td class="num">${fmt(unitJobs.length)}</td>
        <td class="small muted">${escapeHtml(unitJobs.map((job) => job.jobCode).join('، ') || '—')}</td>
        <td class="num">${fmt(approved)}</td>
        <td class="num">${fmt(current)}</td>
        <td class="num">${gap === 0 ? '۰' : `${gap > 0 ? '+' : ''}${fmt(gap)}`}</td>
      </tr>`;
    })
    .join('');
  const unlinked = jobs.filter((job) => !job.unitId || !unitById(job.unitId));
  const unlinkedCurrent = unlinked.reduce((sum, job) => sum + Number(job.headcount || 0), 0);
  table.innerHTML = `
    <thead>
      <tr>
        <th>واحد سازمانی</th><th>کد</th><th>تعداد مشاغل</th><th>کدهای شغل</th>
        <th>نیروی مصوب</th><th>نیروی فعلی</th><th>شکاف</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <td><strong>بدون اتصال به ساختار</strong></td>
        <td class="num">—</td>
        <td class="num">${fmt(unlinked.length)}</td>
        <td class="small muted">${escapeHtml(unlinked.map((job) => job.jobCode).join('، ') || '—')}</td>
        <td class="num">—</td>
        <td class="num">${fmt(unlinkedCurrent)}</td>
        <td class="num">—</td>
      </tr>
      <tr>
        <td><strong>جمع</strong></td>
        <td></td>
        <td class="num"><strong>${fmt(totalJobs + unlinked.length)}</strong></td>
        <td></td>
        <td class="num"><strong>${fmt(totalApproved)}</strong></td>
        <td class="num"><strong>${fmt(totalCurrent + unlinkedCurrent)}</strong></td>
        <td></td>
      </tr>
    </tbody>`;
}


/* ============================ مدیریت کارکنان ============================ */

const CONTRACT_TYPE_LABELS = {
  PERMANENT: 'دائم',
  TEMPORARY: 'موقت',
  SERVICE: 'پیمانی / خدماتی',
  HOURLY: 'ساعتی',
  APPRENTICE: 'کارآموزی',
};
const EMPLOYEE_STATUS_LABELS = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  SUSPENDED: 'تعلیق',
  TERMINATED: 'پایان کار',
};
const EMPLOYEE_STATUS_CHIP = { ACTIVE: 'st-1', INACTIVE: 'neutral', SUSPENDED: 'st-3', TERMINATED: 'st-3' };
const GENDER_LABELS = { M: 'مرد', F: 'زن' };
const MARITAL_LABELS = { MARRIED: 'متأهل', SINGLE: 'مجرد' };
const EMPLOYEE_CODE_PATTERN = /^[0-9A-Za-z\u0600-\u06FF][0-9A-Za-z\u0600-\u06FF_-]{1,23}$/;
const JALALI_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

const employeeFilter = { search: '', unit: '', status: '', contract: '' };
let employeeProfileId = null;

function toLatinDigitsLocal(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function isValidJalaliDate(value) {
  const match = JALALI_DATE_PATTERN.exec(String(value ?? '').trim());
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function serviceYearsFromHireDate(hireDate) {
  if (!isValidJalaliDate(hireDate)) return 0;
  const [hy, hm] = hireDate.split('-').map(Number);
  const today = todayJalali().replace(/\//g, '-');
  if (!isValidJalaliDate(today)) return 0;
  const [ty, tm] = today.split('-').map(Number);
  const months = (ty - hy) * 12 + (tm - hm);
  return Math.max(0, Math.round((months / 12) * 4) / 4);
}

function workshopEmployees() {
  const workshop = activeWorkshop();
  if (!workshop) return [];
  return state.store.employees.filter((employee) => employee.workshopId === workshop.id);
}

function employeeById(id) {
  return state.store.employees.find((employee) => employee.id === id) ?? null;
}

function employeeJob(employee) {
  return employee?.jobId ? jobById(employee.jobId) : null;
}

function employeeServiceYears(employee) {
  if (employee?.priorServiceYears !== undefined && employee?.priorServiceYears !== null && employee?.priorServiceYears !== '') {
    return Number(employee.priorServiceYears);
  }
  return serviceYearsFromHireDate(employee?.hireDate ?? '');
}

function initEmployees() {
  const newButton = document.getElementById('emp-new');
  if (newButton) newButton.addEventListener('click', () => openEmployeeForm(null));

  const form = document.getElementById('employee-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveEmployeeFromForm();
    });
  }
  for (const id of ['emp-cancel', 'emp-cancel-2']) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => closeEmployeeForm());
  }

  const search = document.getElementById('emp-search');
  if (search) {
    search.addEventListener('input', () => {
      employeeFilter.search = search.value.trim();
      renderEmployeesTable();
    });
  }
  for (const [id, key] of [
    ['emp-filter-unit', 'unit'],
    ['emp-filter-status', 'status'],
    ['emp-filter-contract', 'contract'],
  ]) {
    const select = document.getElementById(id);
    if (select) {
      select.addEventListener('change', () => {
        employeeFilter[key] = selectValue(select, '');
        renderEmployeesTable();
      });
    }
  }

  const table = document.getElementById('emp-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const employee = employeeById(button.dataset.id);
      if (!employee) return;
      if (button.dataset.action === 'profile') openEmployeeProfile(employee.id);
      if (button.dataset.action === 'edit') openEmployeeForm(employee);
      if (button.dataset.action === 'calc') prefillWageFromEmployee(employee);
      if (button.dataset.action === 'delete') deleteEmployee(employee);
    });
  }

  const profileClose = document.getElementById('emp-profile-close');
  if (profileClose) {
    profileClose.addEventListener('click', () => {
      employeeProfileId = null;
      const card = document.getElementById('emp-profile');
      if (card) card.hidden = true;
    });
  }

  const jobSelect = document.getElementById('ef-job');
  if (jobSelect) {
    jobSelect.addEventListener('change', () => {
      const job = jobById(selectValue(jobSelect, ''));
      const groupSelect = document.getElementById('ef-group');
      const hint = document.getElementById('ef-group-hint');
      const suggested = normalizeApproval(job?.evaluation)?.finalGroup ?? job?.evaluation?.proposedGroup ?? null;
      if (job && groupSelect && !selectValue(groupSelect, '')) {
        setElementValue(groupSelect, suggested ? String(suggested) : '');
      }
      if (hint) {
        hint.textContent = job
          ? suggested
            ? `گروه پیشنهادی/نهایی شغل «${job.title}»: ${fmt(suggested)}`
            : `برای شغل «${job.title}» هنوز ارزیابی ثبت نشده است؛ گروه را دستی تعیین کنید.`
          : 'گروه پیشنهادی/نهایی شغل انتخاب‌شده به‌صورت خودکار پیشنهاد می‌شود.';
      }
    });
  }

  const importToggle = document.getElementById('emp-import-toggle');
  if (importToggle) {
    importToggle.addEventListener('click', () => {
      const card = document.getElementById('emp-import-card');
      if (card) card.hidden = !card.hidden;
    });
  }
  const importCancel = document.getElementById('emp-import-cancel');
  if (importCancel) {
    importCancel.addEventListener('click', () => {
      const card = document.getElementById('emp-import-card');
      if (card) card.hidden = true;
    });
  }
  const importRun = document.getElementById('emp-import-run');
  if (importRun) {
    importRun.addEventListener('click', () => {
      const textarea = document.getElementById('emp-import-text');
      const message = document.getElementById('emp-import-msg');
      const outcome = importEmployeesCsv(textarea?.value ?? '');
      if (message) {
        message.textContent = [outcome.summary, ...outcome.errors.slice(0, 5)].join(' ');
        message.dataset.state = outcome.added > 0 ? 'ok' : 'error';
      }
      if (outcome.added > 0) {
        if (textarea) textarea.value = '';
        renderEmployeesView();
      }
    });
  }
  const exportButton = document.getElementById('emp-export');
  if (exportButton) exportButton.addEventListener('click', () => exportEmployeesCsv());

  const printButton = document.getElementById('emp-print');
  if (printButton) {
    printButton.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }

  const promoButton = document.getElementById('promo-save');
  if (promoButton) {
    promoButton.addEventListener('click', () => promoteEmployee(employeeProfileId));
  }

  renderEmployeesView();
}

function renderEmployeesView() {
  const workspace = document.getElementById('emp-workspace');
  const empty = document.getElementById('emp-empty-workshop');
  if (!workspace || !empty) return;
  const hasWorkshop = Boolean(activeWorkshop());
  empty.hidden = hasWorkshop;
  workspace.hidden = !hasWorkshop;
  if (!hasWorkshop) return;
  renderEmployeeFilters();
  renderEmployeeKpis();
  renderEmployeesTable();
  if (employeeProfileId) {
    const employee = employeeById(employeeProfileId);
    if (employee) renderEmployeeProfile(employee);
    else {
      employeeProfileId = null;
      const card = document.getElementById('emp-profile');
      if (card) card.hidden = true;
    }
  }
}

function renderEmployeeFilters() {
  const select = document.getElementById('emp-filter-unit');
  if (!select) return;
  const units = unitsTreeOrder(workshopUnits());
  select.innerHTML =
    '<option value="">همه واحدها</option><option value="NONE">بدون واحد</option>' +
    units
      .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.title)}</option>`)
      .join('');
  setElementValue(select, employeeFilter.unit);
}

function filteredEmployees() {
  const search = employeeFilter.search.toLowerCase();
  return workshopEmployees().filter((employee) => {
    if (employeeFilter.unit === 'NONE' && employee.unitId) return false;
    if (employeeFilter.unit && employeeFilter.unit !== 'NONE' && employee.unitId !== employeeFilter.unit) return false;
    if (employeeFilter.status && employee.status !== employeeFilter.status) return false;
    if (employeeFilter.contract && employee.contractType !== employeeFilter.contract) return false;
    if (!search) return true;
    const job = employeeJob(employee);
    const haystack = `${employee.personnelCode} ${employee.firstName} ${employee.lastName} ${employee.nationalId ?? ''} ${job?.jobCode ?? ''} ${job?.title ?? ''}`.toLowerCase();
    return haystack.includes(search);
  });
}

function renderEmployeeKpis() {
  const target = document.getElementById('emp-kpis');
  if (!target) return;
  const employees = workshopEmployees();
  const active = employees.filter((employee) => employee.status === 'ACTIVE').length;
  const serviceSum = employees.reduce((sum, employee) => sum + employeeServiceYears(employee), 0);
  const average = employees.length > 0 ? serviceSum / employees.length : 0;
  const missingPlacement = employees.filter((employee) => !employee.jobId || !employee.group).length;
  const cards = [
    ['کل کارکنان', fmt(employees.length)],
    ['کارکنان فعال', fmt(active)],
    ['میانگین سابقه', employees.length > 0 ? `${fmt(average, 1)} سال` : '—'],
    ['بدون شغل یا گروه', fmt(missingPlacement)],
  ];
  target.innerHTML = `<div class="summary-grid">${cards
    .map(([label, value]) => `<div class="summary-card"><span class="label">${label}</span><span class="value">${value}</span></div>`)
    .join('')}</div>`;
}

function renderEmployeesTable() {
  const table = document.getElementById('emp-table');
  if (!table) return;
  const counter = document.getElementById('emp-count');
  const rows = filteredEmployees();
  if (counter) counter.textContent = `${fmt(rows.length)} نفر از ${fmt(workshopEmployees().length)}`;
  if (rows.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>
            <div class="empty-state">
              ${workshopEmployees().length === 0
                ? 'هنوز کارمندی ثبت نشده است. با دکمه «کارمند جدید» اولین پرونده پرسنلی را بسازید یا از «ورود گروهی» استفاده کنید.'
                : 'کارمندی با این فیلترها یافت نشد.'}
            </div>
          </td>
        </tr>
      </tbody>`;
    return;
  }
  table.innerHTML = `
    <thead>
      <tr>
        <th>کد پرسنلی</th><th>نام و نام خانوادگی</th><th>واحد سازمانی</th><th>شغل</th>
        <th>گروه</th><th>قرارداد</th><th>استخدام</th><th>سابقه (سال)</th><th>وضعیت</th><th>عملیات</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((employee) => {
          const job = employeeJob(employee);
          const unit = employee.unitId ? unitById(employee.unitId) : null;
          return `<tr>
            <td class="num" dir="ltr">${escapeHtml(employee.personnelCode)}</td>
            <td>
              <strong>${escapeHtml(`${employee.firstName} ${employee.lastName}`.trim())}</strong>
              ${employee.nationalId ? `<div class="small muted" dir="ltr">${escapeHtml(employee.nationalId)}</div>` : ''}
            </td>
            <td>${unit ? `${escapeHtml(unit.title)}<div class="small muted">کد ${escapeHtml(unit.code)}</div>` : '—'}</td>
            <td>${job ? `${escapeHtml(job.title)}<div class="small muted">${escapeHtml(job.jobCode)}</div>` : '—'}</td>
            <td class="num">${employee.group ? fmt(employee.group) : '—'}</td>
            <td>${escapeHtml(CONTRACT_TYPE_LABELS[employee.contractType] ?? employee.contractType ?? '—')}</td>
            <td class="num">${escapeHtml(localizeDigits(employee.hireDate || '—'))}</td>
            <td class="num">${fmt(employeeServiceYears(employee), 1)}</td>
            <td><span class="chip ${EMPLOYEE_STATUS_CHIP[employee.status] ?? 'neutral'}">${escapeHtml(EMPLOYEE_STATUS_LABELS[employee.status] ?? employee.status ?? '—')}</span></td>
            <td class="actions-cell">
              <button type="button" class="icon-btn" data-action="profile" data-id="${escapeHtml(employee.id)}" title="پرونده کارمند">▤</button>
              <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(employee.id)}" title="ویرایش">✎</button>
              <button type="button" class="icon-btn" data-action="calc" data-id="${escapeHtml(employee.id)}" title="بارگذاری در ماشین‌حساب مزد">﷼</button>
              <button type="button" class="icon-btn" data-action="delete" data-id="${escapeHtml(employee.id)}" title="حذف">✕</button>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

function renderEmployeeFormOptions(employee) {
  const unitSelect = document.getElementById('ef-unit');
  if (unitSelect) {
    unitSelect.innerHTML =
      '<option value="">— بدون واحد —</option>' +
      unitsTreeOrder(workshopUnits())
        .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.code)} — ${escapeHtml(unit.title)}</option>`)
        .join('');
  }
  const jobSelect = document.getElementById('ef-job');
  if (jobSelect) {
    jobSelect.innerHTML =
      '<option value="">— بدون شغل —</option>' +
      workshopJobs()
        .map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.jobCode)} — ${escapeHtml(job.title)}</option>`)
        .join('');
  }
  const groupSelect = document.getElementById('ef-group');
  if (groupSelect) {
    groupSelect.innerHTML =
      '<option value="">تعیین نشده</option>' +
      Array.from({ length: 20 }, (_, index) => {
        const group = index + 1;
        return `<option value="${group}">گروه ${fmt(group)}</option>`;
      }).join('');
  }
  setElementValue(unitSelect, employee?.unitId ?? '');
  setElementValue(jobSelect, employee?.jobId ?? '');
  setElementValue(groupSelect, employee?.group ? String(employee.group) : '');
}

function openEmployeeForm(employee) {
  if (!ensureWrite('employees', 'ویرایش پرونده کارمند')) return;
  const form = document.getElementById('employee-form');
  if (!form) return;
  renderEmployeeFormOptions(employee);
  form.hidden = false;
  const title = document.getElementById('employee-form-title');
  if (title) title.textContent = employee ? `ویرایش کارمند ${employee.personnelCode}` : 'کارمند جدید';
  setElementValue(document.getElementById('ef-id'), employee?.id ?? '');
  setElementValue(document.getElementById('ef-code'), employee?.personnelCode ?? '');
  setElementValue(document.getElementById('ef-first'), employee?.firstName ?? '');
  setElementValue(document.getElementById('ef-last'), employee?.lastName ?? '');
  setElementValue(document.getElementById('ef-father'), employee?.fatherName ?? '');
  setElementValue(document.getElementById('ef-national'), employee?.nationalId ?? '');
  setElementValue(document.getElementById('ef-idnumber'), employee?.idNumber ?? '');
  setElementValue(document.getElementById('ef-birth'), employee?.birthDate ?? '');
  setElementValue(document.getElementById('ef-gender'), employee?.gender ?? 'M');
  setElementValue(document.getElementById('ef-marital'), employee?.maritalStatus ?? 'MARRIED');
  setElementValue(document.getElementById('ef-children'), employee?.childrenCount ?? 0);
  setElementValue(document.getElementById('ef-contract'), employee?.contractType ?? 'TEMPORARY');
  setElementValue(document.getElementById('ef-hire'), employee?.hireDate ?? todayJalali().replace(/\//g, '-'));
  setElementValue(document.getElementById('ef-contract-end'), employee?.contractEndDate ?? '');
  setElementValue(document.getElementById('ef-service'), employee?.priorServiceYears ?? 0);
  setElementValue(document.getElementById('ef-status'), employee?.status ?? 'ACTIVE');
  setElementValue(document.getElementById('ef-supervisor'), employee?.supervisorName ?? '');
  setElementValue(document.getElementById('ef-wage'), employee?.dailyJobWage ?? '');
  setElementValue(document.getElementById('ef-acc'), employee?.priorAccumulatedSeniority ?? '');
  setElementValue(document.getElementById('ef-other'), employee?.otherDailyComponents ?? 0);
  const insured = document.getElementById('ef-insured');
  if (insured) insured.checked = employee?.insured !== false;
  setElementValue(document.getElementById('ef-insurance-no'), employee?.insuranceNumber ?? '');
  setElementValue(document.getElementById('ef-notes'), employee?.notes ?? '');
  const error = document.getElementById('emp-error');
  if (error) error.textContent = '';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeEmployeeForm() {
  const form = document.getElementById('employee-form');
  if (form) form.hidden = true;
  const error = document.getElementById('emp-error');
  if (error) error.textContent = '';
}

function saveEmployeeFromForm() {
  if (!ensureWrite('employees', 'ذخیره پرونده کارمند')) return;
  const workshop = activeWorkshop();
  const errorTarget = document.getElementById('emp-error');
  if (!workshop) {
    if (errorTarget) errorTarget.textContent = 'ابتدا یک کارگاه انتخاب کنید.';
    return;
  }
  const id = document.getElementById('ef-id').value;
  const existing = id ? employeeById(id) : null;
  const hireDate = toLatinDigitsLocal(document.getElementById('ef-hire').value.trim()).replace(/\//g, '-');
  const birthDate = toLatinDigitsLocal(document.getElementById('ef-birth').value.trim()).replace(/\//g, '-');
  const contractEndDate = toLatinDigitsLocal(document.getElementById('ef-contract-end').value.trim()).replace(/\//g, '-');
  const jobId = selectValue(document.getElementById('ef-job'), '') || null;
  const groupValue = selectValue(document.getElementById('ef-group'), '');
  const draft = {
    id: existing?.id ?? newId('emp'),
    workshopId: existing?.workshopId ?? workshop.id,
    personnelCode: document.getElementById('ef-code').value.trim(),
    firstName: document.getElementById('ef-first').value.trim(),
    lastName: document.getElementById('ef-last').value.trim(),
    fatherName: document.getElementById('ef-father').value.trim(),
    nationalId: toLatinDigitsLocal(document.getElementById('ef-national').value.trim()),
    idNumber: document.getElementById('ef-idnumber').value.trim(),
    birthDate,
    gender: selectValue(document.getElementById('ef-gender'), 'M'),
    maritalStatus: selectValue(document.getElementById('ef-marital'), 'MARRIED'),
    childrenCount: Math.max(0, Number(document.getElementById('ef-children').value || 0)),
    contractType: selectValue(document.getElementById('ef-contract'), 'TEMPORARY'),
    hireDate,
    contractEndDate,
    priorServiceYears: Math.max(0, Number(document.getElementById('ef-service').value || 0)),
    status: selectValue(document.getElementById('ef-status'), 'ACTIVE'),
    unitId: selectValue(document.getElementById('ef-unit'), '') || null,
    jobId,
    group: groupValue ? Number(groupValue) : null,
    supervisorName: document.getElementById('ef-supervisor').value.trim(),
    dailyJobWage: Math.max(0, Number(document.getElementById('ef-wage').value || 0)),
    priorAccumulatedSeniority: Math.max(0, Number(document.getElementById('ef-acc').value || 0)),
    otherDailyComponents: Math.max(0, Number(document.getElementById('ef-other').value || 0)),
    insured: Boolean(document.getElementById('ef-insured').checked),
    insuranceNumber: document.getElementById('ef-insurance-no').value.trim(),
    notes: document.getElementById('ef-notes').value.trim(),
    jobChanges: existing?.jobChanges ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const problems = [];
  if (!EMPLOYEE_CODE_PATTERN.test(draft.personnelCode)) {
    problems.push('کد پرسنلی باید ۲ تا ۲۴ نویسه باشد و فقط حروف، رقم، خط تیره و زیرخط بپذیرد.');
  }
  const duplicate = workshopEmployees().find(
    (employee) =>
      employee.id !== existing?.id &&
      employee.personnelCode.toLowerCase() === draft.personnelCode.toLowerCase(),
  );
  if (draft.personnelCode && duplicate) {
    problems.push(`کد پرسنلی «${draft.personnelCode}» قبلاً برای «${duplicate.firstName} ${duplicate.lastName}» ثبت شده است.`);
  }
  if (!draft.firstName) problems.push('نام الزامی است.');
  if (!draft.lastName) problems.push('نام خانوادگی الزامی است.');
  if (draft.nationalId && !/^\d{10}$/.test(draft.nationalId)) problems.push('کد ملی باید ۱۰ رقم باشد.');
  if (!isValidJalaliDate(draft.hireDate)) problems.push('تاریخ استخدام باید به شکل 1400-01-01 و معتبر باشد.');
  if (draft.birthDate && !isValidJalaliDate(draft.birthDate)) problems.push('تاریخ تولد معتبر نیست (نمونه: 1370-01-01).');
  if (draft.contractEndDate && !isValidJalaliDate(draft.contractEndDate)) {
    problems.push('تاریخ پایان قرارداد معتبر نیست (نمونه: 1405-12-29).');
  }
  if (draft.contractEndDate && isValidJalaliDate(draft.hireDate) && draft.contractEndDate < draft.hireDate) {
    problems.push('تاریخ پایان قرارداد نمی‌تواند پیش از تاریخ استخدام باشد.');
  }
  if (draft.unitId && !unitById(draft.unitId)) problems.push('واحد سازمانی انتخاب‌شده معتبر نیست.');
  if (draft.jobId && !jobById(draft.jobId)) problems.push('شغل انتخاب‌شده معتبر نیست.');
  if (draft.group !== null && (draft.group < 1 || draft.group > 20)) problems.push('گروه شغلی باید بین ۱ و ۲۰ باشد.');
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }

  const employees = existing
    ? state.store.employees.map((row) => (row.id === draft.id ? draft : row))
    : [...state.store.employees, draft];
  writeStore({ ...state.store, employees });
  closeEmployeeForm();
  renderEmployeesView();
  logActivity('employees', existing ? 'UPDATE' : 'CREATE', `${existing ? 'ویرایش' : 'ایجاد'} پرونده «${draft.firstName} ${draft.lastName}» (${draft.personnelCode})`);
  showToast(existing ? 'پرونده کارمند به‌روزرسانی شد' : 'کارمند جدید ثبت شد');
}

function deleteEmployee(employee) {
  if (!ensureAdmin('حذف پرونده کارمند')) return;
  const confirmed = typeof window.confirm === 'function'
    ? window.confirm(`حذف پرونده «${employee.firstName} ${employee.lastName}»؟ تاریخچه نیز حذف می‌شود.`)
    : true;
  if (!confirmed) return;
  writeStore({ ...state.store, employees: state.store.employees.filter((row) => row.id !== employee.id) });
  if (employeeProfileId === employee.id) {
    employeeProfileId = null;
    const card = document.getElementById('emp-profile');
    if (card) card.hidden = true;
  }
  renderEmployeesView();
  logActivity('employees', 'DELETE', `حذف پرونده «${employee.firstName} ${employee.lastName}» (${employee.personnelCode})`);
  showToast('پرونده کارمند حذف شد');
}

function renderEmployeeProfile(employee) {
  const card = document.getElementById('emp-profile');
  const body = document.getElementById('emp-profile-body');
  const title = document.getElementById('emp-profile-title');
  if (!card || !body) return;
  card.hidden = false;
  if (title) title.textContent = `پرونده کارمند — ${employee.firstName} ${employee.lastName} (${employee.personnelCode})`;
  const job = employeeJob(employee);
  const unit = employee.unitId ? unitById(employee.unitId) : null;
  const history = [...(employee.jobChanges ?? [])].reverse();

  body.innerHTML = `
    <h3 class="profile-name">${escapeHtml(`${employee.firstName} ${employee.lastName}`.trim())} <span class="small muted" dir="ltr">${escapeHtml(employee.personnelCode)}</span></h3>
    <div class="summary-grid profile-summary">
      <div class="summary-card is-accent"><span class="label">گروه شغلی فعلی</span><span class="value">${employee.group ? fmt(employee.group) : '—'}</span></div>
      <div class="summary-card"><span class="label">سابقه مؤثر</span><span class="value">${fmt(employeeServiceYears(employee), 1)} سال</span></div>
      <div class="summary-card is-neutral"><span class="label">نوع قرارداد</span><span class="value">${escapeHtml(CONTRACT_TYPE_LABELS[employee.contractType] ?? '—')}</span></div>
      <div class="summary-card is-neutral"><span class="label">وضعیت</span><span class="value">${escapeHtml(EMPLOYEE_STATUS_LABELS[employee.status] ?? '—')}</span></div>
    </div>

    <table class="data-table profile-table">
      <tbody>
        <tr><th>کد پرسنلی</th><td dir="ltr">${escapeHtml(employee.personnelCode)}</td><th>کد ملی</th><td dir="ltr">${escapeHtml(employee.nationalId || '—')}</td></tr>
        <tr><th>نام پدر</th><td>${escapeHtml(employee.fatherName || '—')}</td><th>تاریخ تولد</th><td class="num">${escapeHtml(localizeDigits(employee.birthDate || '—'))}</td></tr>
        <tr><th>وضعیت تأهل</th><td>${escapeHtml(MARITAL_LABELS[employee.maritalStatus] ?? '—')}</td><th>تعداد فرزند</th><td class="num">${fmt(employee.childrenCount ?? 0)}</td></tr>
        <tr><th>تاریخ استخدام</th><td class="num">${escapeHtml(localizeDigits(employee.hireDate || '—'))}</td><th>پایان قرارداد</th><td class="num">${escapeHtml(localizeDigits(employee.contractEndDate || '—'))}</td></tr>
        <tr><th>واحد سازمانی</th><td>${unit ? `${escapeHtml(unit.title)} (کد ${escapeHtml(unit.code)})` : '—'}</td><th>شغل</th><td>${job ? `${escapeHtml(job.title)} (${escapeHtml(job.jobCode)})` : '—'}</td></tr>
        <tr><th>سرپرست</th><td>${escapeHtml(employee.supervisorName || '—')}</td><th>بیمه</th><td>${employee.insured ? `بیمه‌شده${employee.insuranceNumber ? ` — ${escapeHtml(employee.insuranceNumber)}` : ''}` : 'غیربیمه'}</td></tr>
        <tr><th>مزد شغل روزانه</th><td class="num">${employee.dailyJobWage ? fmt(employee.dailyJobWage) : '—'}</td><th>سنوات تجمیعی</th><td class="num">${employee.priorAccumulatedSeniority ? fmt(employee.priorAccumulatedSeniority) : '—'}</td></tr>
      </tbody>
    </table>

    <h4>تاریخچه ارتقا و تغییر شغل</h4>
    ${
      history.length === 0
        ? '<p class="muted small">هنوز تغییری ثبت نشده است. با فرم پایین، ارتقا یا تغییر گروه را با دلیل ثبت کنید.</p>'
        : `<div class="table-wrap">
            <table class="data-table profile-table">
              <thead><tr><th>تاریخ</th><th>شغل قبلی</th><th>شغل جدید</th><th>گروه قبلی</th><th>گروه جدید</th><th>دلیل</th></tr></thead>
              <tbody>
                ${history
                  .map(
                    (row) => `<tr>
                      <td class="num">${escapeHtml(localizeDigits(row.date || '—'))}</td>
                      <td>${escapeHtml(row.fromJobTitle || row.fromJobCode || '—')}</td>
                      <td>${escapeHtml(row.toJobTitle || row.toJobCode || '—')}</td>
                      <td class="num">${row.fromGroup ? fmt(row.fromGroup) : '—'}</td>
                      <td class="num">${row.toGroup ? fmt(row.toGroup) : '—'}</td>
                      <td>${escapeHtml(row.reason || '—')}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
    }`;

  const promoJob = document.getElementById('promo-job');
  if (promoJob) {
    promoJob.innerHTML =
      '<option value="">— بدون تغییر —</option>' +
      workshopJobs()
        .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.jobCode)} — ${escapeHtml(row.title)}</option>`)
        .join('');
    setElementValue(promoJob, employee.jobId ?? '');
  }
  const promoGroup = document.getElementById('promo-group');
  if (promoGroup) {
    promoGroup.innerHTML =
      '<option value="">— بدون تغییر —</option>' +
      Array.from({ length: 20 }, (_, index) => {
        const group = index + 1;
        return `<option value="${group}">گروه ${fmt(group)}</option>`;
      }).join('');
    setElementValue(promoGroup, employee.group ? String(employee.group) : '');
  }
  setElementValue(document.getElementById('promo-date'), todayJalali().replace(/\//g, '-'));
  const message = document.getElementById('promo-msg');
  if (message) message.textContent = '';
}

function openEmployeeProfile(id) {
  const employee = employeeById(id);
  if (!employee) return;
  employeeProfileId = id;
  renderEmployeeProfile(employee);
  document.getElementById('emp-profile')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function promoteEmployee(employeeId) {
  if (!ensureWrite('employees', 'ثبت ارتقا/تغییر شغل')) return;
  const employee = employeeById(employeeId);
  const message = document.getElementById('promo-msg');
  if (!employee) {
    if (message) message.textContent = 'ابتدا پرونده یک کارمند را باز کنید.';
    return;
  }
  const date = toLatinDigitsLocal(document.getElementById('promo-date').value.trim()).replace(/\//g, '-');
  const newJobId = selectValue(document.getElementById('promo-job'), '') || employee.jobId || null;
  const groupValue = selectValue(document.getElementById('promo-group'), '');
  const newGroup = groupValue ? Number(groupValue) : employee.group ?? null;
  const reason = document.getElementById('promo-reason').value.trim();

  const problems = [];
  if (!isValidJalaliDate(date)) problems.push('تاریخ تغییر معتبر نیست (نمونه: 1405-04-01).');
  if (!newJobId) problems.push('برای ثبت تغییر، شغل جدید را انتخاب کنید.');
  if (newJobId === employee.jobId && newGroup === (employee.group ?? null)) {
    problems.push('شغل و گروه جدید با وضعیت فعلی یکسان است.');
  }
  if (!reason) problems.push('دلیل یا مستند تغییر الزامی است.');
  if (problems.length > 0) {
    if (message) message.textContent = problems.join(' ');
    return;
  }

  const currentJob = employeeJob(employee);
  const newJob = jobById(newJobId);
  const entry = {
    at: new Date().toISOString(),
    date,
    fromJobId: employee.jobId ?? null,
    fromJobCode: currentJob?.jobCode ?? null,
    fromJobTitle: currentJob?.title ?? null,
    toJobId: newJob?.id ?? null,
    toJobCode: newJob?.jobCode ?? null,
    toJobTitle: newJob?.title ?? null,
    fromGroup: employee.group ?? null,
    toGroup: newGroup,
    reason,
  };
  const updated = {
    ...employee,
    jobId: newJob?.id ?? employee.jobId ?? null,
    group: newGroup,
    jobChanges: [...(employee.jobChanges ?? []), entry].slice(-50),
    updatedAt: new Date().toISOString(),
  };
  writeStore({
    ...state.store,
    employees: state.store.employees.map((row) => (row.id === employee.id ? updated : row)),
  });
  renderEmployeeProfile(updated);
  renderEmployeesTable();
  const success = document.getElementById('promo-msg');
  if (success) {
    success.textContent = `تغییر ثبت شد: گروه ${updated.group ? fmt(updated.group) : '—'} — ${escapeHtml(newJob?.title ?? '')}`;
  }
  document.getElementById('promo-reason').value = '';
  logActivity('employees', 'PROMOTE', `ارتقا «${employee.firstName} ${employee.lastName}» از گروه ${employee.group ?? '—'} به ${newGroup ?? '—'} — ${reason}`);
  showToast('تاریخچه ارتقا ثبت شد');
}

function prefillWageFromEmployee(employee) {
  const group = employee.group ?? employeeJob(employee)?.evaluation?.proposedGroup ?? null;
  if (!group) {
    showToast('برای این کارمند گروه شغلی تعیین نشده است؛ ابتدا گروه را ثبت کنید.');
    return;
  }
  const groupSelect = document.getElementById('w-group');
  if (groupSelect) setElementValue(groupSelect, String(group));
  const accInput = document.getElementById('w-acc');
  if (accInput && employee.priorAccumulatedSeniority) accInput.value = employee.priorAccumulatedSeniority;
  const otherInput = document.getElementById('w-other');
  if (otherInput && employee.otherDailyComponents) otherInput.value = employee.otherDailyComponents;
  const serviceInput = document.getElementById('w-service');
  if (serviceInput) serviceInput.value = employeeServiceYears(employee);
  navigate('payroll');
  showToast(`داده مزد ${employee.firstName} ${employee.lastName} در ماشین‌حساب بارگذاری شد`);
}

/* --------------------------- ورود و خروجی CSV --------------------------- */

const CSV_HEADER_ALIASES = {
  personnelcode: 'personnelCode',
  'کد پرسنلی': 'personnelCode',
  firstname: 'firstName',
  'نام': 'firstName',
  lastname: 'lastName',
  'نام خانوادگی': 'lastName',
  unitcode: 'unitCode',
  'کد واحد': 'unitCode',
  jobcode: 'jobCode',
  'کد شغل': 'jobCode',
  group: 'group',
  'گروه': 'group',
  contracttype: 'contractType',
  'نوع قرارداد': 'contractType',
  hiredate: 'hireDate',
  'تاریخ استخدام': 'hireDate',
  priorserviceyears: 'priorServiceYears',
  'سابقه': 'priorServiceYears',
  status: 'status',
  'وضعیت': 'status',
};
const CSV_FIELDS = ['personnelCode', 'firstName', 'lastName', 'unitCode', 'jobCode', 'group', 'contractType', 'hireDate', 'priorServiceYears', 'status'];
const CONTRACT_TYPE_FROM_FA = {
  'دائم': 'PERMANENT',
  'موقت': 'TEMPORARY',
  'پیمانی': 'SERVICE',
  'خدماتی': 'SERVICE',
  'ساعتی': 'HOURLY',
  'کارآموزی': 'APPRENTICE',
};
const EMPLOYEE_STATUS_FROM_FA = {
  'فعال': 'ACTIVE',
  'غیرفعال': 'INACTIVE',
  'تعلیق': 'SUSPENDED',
  'پایان کار': 'TERMINATED',
};

function splitCsvLine(line) {
  const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function importEmployeesCsv(rawText) {
  if (!ensureWrite('employees', 'ورود گروهی کارکنان')) return { added: 0, skipped: 0, errors: [], summary: 'دسترسی لازم را ندارید.' };
  const text = String(rawText ?? '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const outcome = { added: 0, skipped: 0, errors: [], summary: '' };
  if (lines.length === 0) {
    outcome.summary = 'متنی برای پردازش وارد نشده است.';
    return outcome;
  }
  const firstCells = splitCsvLine(lines[0]);
  const headerKeys = firstCells.map((cell) => CSV_HEADER_ALIASES[cell.toLowerCase()] ?? CSV_HEADER_ALIASES[cell] ?? null);
  const hasHeader = headerKeys.filter(Boolean).length >= 3;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) {
    outcome.summary = 'ردیف داده‌ای پس از سرستون پیدا نشد.';
    return outcome;
  }

  const created = [];
  dataLines.forEach((line, index) => {
    const cells = splitCsvLine(line);
    const record = {};
    CSV_FIELDS.forEach((field, fieldIndex) => {
      const mappedIndex = hasHeader ? headerKeys.indexOf(field) : fieldIndex;
      record[field] = mappedIndex >= 0 ? toLatinDigitsLocal(cells[mappedIndex] ?? '').trim() : '';
    });
    const rowNumber = index + (hasHeader ? 2 : 1);
    if (!record.personnelCode) {
      outcome.skipped += 1;
      outcome.errors.push(`ردیف ${fmt(rowNumber)}: کد پرسنلی خالی است.`);
      return;
    }
    if (!EMPLOYEE_CODE_PATTERN.test(record.personnelCode)) {
      outcome.skipped += 1;
      outcome.errors.push(`ردیف ${fmt(rowNumber)}: کد پرسنلی «${record.personnelCode}» معتبر نیست.`);
      return;
    }
    const duplicate = [...workshopEmployees(), ...created].find(
      (employee) => employee.personnelCode.toLowerCase() === record.personnelCode.toLowerCase(),
    );
    if (duplicate) {
      outcome.skipped += 1;
      outcome.errors.push(`ردیف ${fmt(rowNumber)}: کد «${record.personnelCode}» تکراری است.`);
      return;
    }
    if (!record.firstName || !record.lastName) {
      outcome.skipped += 1;
      outcome.errors.push(`ردیف ${fmt(rowNumber)}: نام و نام خانوادگی الزامی است.`);
      return;
    }
    const unit = record.unitCode ? workshopUnits().find((row) => row.code.toLowerCase() === record.unitCode.toLowerCase()) : null;
    const job = record.jobCode ? workshopJobs().find((row) => row.jobCode.toLowerCase() === record.jobCode.toLowerCase()) : null;
    const groupNumber = Number(record.group || 0);
    const contract = CONTRACT_TYPE_FROM_FA[record.contractType] ?? (CONTRACT_TYPE_LABELS[record.contractType] ? record.contractType : 'TEMPORARY');
    const status = EMPLOYEE_STATUS_FROM_FA[record.status] ?? (EMPLOYEE_STATUS_LABELS[record.status] ? record.status : 'ACTIVE');
    const hireDate = record.hireDate && isValidJalaliDate(record.hireDate) ? record.hireDate : todayJalali().replace(/\//g, '-');
    created.push({
      id: newId('emp'),
      workshopId: activeWorkshop()?.id ?? null,
      personnelCode: record.personnelCode,
      firstName: record.firstName,
      lastName: record.lastName,
      fatherName: '',
      nationalId: '',
      idNumber: '',
      birthDate: '',
      gender: 'M',
      maritalStatus: 'MARRIED',
      childrenCount: 0,
      contractType: contract,
      hireDate,
      contractEndDate: '',
      priorServiceYears: Math.max(0, Number(record.priorServiceYears || 0)),
      status,
      unitId: unit?.id ?? null,
      jobId: job?.id ?? null,
      group: groupNumber >= 1 && groupNumber <= 20 ? groupNumber : null,
      supervisorName: '',
      dailyJobWage: 0,
      priorAccumulatedSeniority: 0,
      otherDailyComponents: 0,
      insured: true,
      insuranceNumber: '',
      notes: 'ورود گروهی CSV',
      jobChanges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    outcome.added += 1;
  });

  if (created.length > 0) {
    writeStore({ ...state.store, employees: [...state.store.employees, ...created] });
  }
  const parts = [];
  if (outcome.added > 0) parts.push(`${fmt(outcome.added)} کارمند افزوده شد.`);
  if (outcome.skipped > 0) parts.push(`${fmt(outcome.skipped)} ردیف رد شد.`);
  outcome.summary = parts.join(' ') || 'هیچ ردیفی افزوده نشد.';
  return outcome;
}

function exportEmployeesCsv() {
  const employees = workshopEmployees();
  if (employees.length === 0) {
    showToast('کارمندی برای خروجی وجود ندارد.');
    return false;
  }
  const unitCode = (employee) => (employee.unitId ? unitById(employee.unitId)?.code ?? '' : '');
  const jobCode = (employee) => (employee.jobId ? jobById(employee.jobId)?.jobCode ?? '' : '');
  const lines = [
    CSV_FIELDS.join(','),
    ...employees.map((employee) =>
      [
        employee.personnelCode,
        employee.firstName,
        employee.lastName,
        unitCode(employee),
        jobCode(employee),
        employee.group ?? '',
        employee.contractType ?? '',
        employee.hireDate ?? '',
        employee.priorServiceYears ?? '',
        employee.status ?? '',
      ]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];
  const content = lines.join('\r\n');
  const ok = downloadTextFile('employees.csv', content, 'text/csv;charset=utf-8');
  if (ok) showToast(`خروجی CSV برای ${fmt(employees.length)} کارمند آماده شد`);
  return ok;
}

function downloadTextFile(filename, content, mime) {
  try {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      showToast('خروجی فایل در این محیط پشتیبانی نمی‌شود.');
      return false;
    }
    const blob = new Blob([`\uFEFF${content}`], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    showToast(`خروجی فایل ناموفق بود: ${error.message}`);
    return false;
  }
}


/* ====================== حقوق ماهانه کارکنان و معوقات ====================== */

const JALALI_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

const payrollState = { rows: [], period: '1405-01' };
let arrearsState = { rows: [], employeeId: null, from: '1405-01', to: '1405-03' };

function periodLabel(period) {
  const [year, month] = String(period ?? '').split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return String(period ?? '—');
  return `${JALALI_MONTH_NAMES[month - 1]} ${localizeDigits(String(year))}`;
}

function periodsForYear(year = 1405) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

function periodsBetween(from, to) {
  const [fromYear, fromMonth] = String(from).split('-').map(Number);
  const [toYear, toMonth] = String(to).split('-').map(Number);
  if (!fromYear || !fromMonth || !toYear || !toMonth) return [];
  const result = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (result.length > 60) break;
  }
  return result;
}

function employeePayrollGroup(employee) {
  if (!employee) return null;
  if (employee.group) return Number(employee.group);
  const job = employeeJob(employee);
  const approval = normalizeApproval(job?.evaluation);
  return approval?.finalGroup ?? job?.evaluation?.proposedGroup ?? null;
}

function payrollSchemeCode() {
  const select = document.getElementById('pr-scheme');
  const value = selectValue(select, '');
  if (value) return value;
  const schemes = core.listWageSchemes(state.data ?? { wageTables: [] });
  const preferred = schemes.find((scheme) => scheme.schemeCode === 'SERVICE_COMPANIES_NATIONWIDE');
  return preferred?.schemeCode ?? schemes[0]?.schemeCode ?? 'SERVICE_COMPANIES_NATIONWIDE';
}

function payrollInputFor(employee, period, { schemeCode, days = 30, group } = {}) {
  const jobGroup = group ?? employeePayrollGroup(employee);
  if (!jobGroup) return null;
  const service = employeeServiceYears(employee);
  const computationDate = `${period}-01`;
  const cumulative = Number(employee.priorAccumulatedSeniority || 0)
    || core.computeCumulativeSeniority(state.data, { schemeCode, yearsOfService: service, asOfDate: computationDate }).amount
    || 0;
  return {
    schemeCode,
    jobGroup,
    priorAccumulatedDailySeniority: cumulative,
    priorOtherFixedDailyWage: Number(employee.otherDailyComponents || 0),
    serviceYearsInWorkshop: service,
    payableDays: days,
    isMarried: employee.maritalStatus === 'MARRIED',
    eligibleChildrenCount: Number(employee.childrenCount || 0),
    includeWelfareBenefits: true,
    computationDate,
    periodYearMonth: period,
  };
}

function computeEmployeePayroll(employee, period, options) {
  const input = payrollInputFor(employee, period, options);
  if (!input) return { employee, error: 'گروه شغلی تعیین نشده است.' };
  try {
    const result = core.computeWage(state.data, input);
    const priorTable = core.findWageTable(state.data, {
      schemeCode: input.schemeCode,
      fiscalYear: input.computationDate.slice(0, 4) - 1,
      group: input.jobGroup,
      asOfDate: input.computationDate,
    });
    const priorMonthlyJobWage = priorTable ? core.roundMoney(priorTable.dailyJobWage * input.payableDays) : null;
    const growthPct = priorMonthlyJobWage ? ((result.monthlyJobWage - priorMonthlyJobWage) / priorMonthlyJobWage) * 100 : null;
    const mismatch = employee.dailyJobWage > 0 && Math.abs(employee.dailyJobWage - result.dailyJobWage) > 1;
    return { employee, group: input.jobGroup, result, priorMonthlyJobWage, growthPct, mismatch };
  } catch (error) {
    return { employee, error: error.message };
  }
}

function initPayrollMonthly() {
  const periodSelect = document.getElementById('pr-period');
  if (periodSelect) {
    periodSelect.innerHTML = periodsForYear(1405)
      .map((period) => `<option value="${period}">${periodLabel(period)}</option>`)
      .join('');
    setElementValue(periodSelect, payrollState.period);
  }
  const schemeSelect = document.getElementById('pr-scheme');
  if (schemeSelect) {
    const schemes = core.listWageSchemes(state.data ?? { wageTables: [] });
    schemeSelect.innerHTML = schemes
      .map((scheme) => `<option value="${scheme.schemeCode}">${escapeHtml(scheme.schemeTitle)}</option>`)
      .join('');
    const preferred = schemes.some((scheme) => scheme.schemeCode === 'SERVICE_COMPANIES_NATIONWIDE')
      ? 'SERVICE_COMPANIES_NATIONWIDE'
      : schemes[0]?.schemeCode;
    setElementValue(schemeSelect, preferred ?? '');
  }
  const calc = document.getElementById('pr-calc');
  if (calc) calc.addEventListener('click', () => computeMonthlyPayroll());
  const print = document.getElementById('pr-print');
  if (print) {
    print.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
  const exportButton = document.getElementById('pr-export');
  if (exportButton) exportButton.addEventListener('click', () => exportPayrollCsv());
  const close = document.getElementById('pr-detail-close');
  if (close) {
    close.addEventListener('click', () => {
      const card = document.getElementById('pr-detail-card');
      if (card) card.hidden = true;
    });
  }
  const table = document.getElementById('pr-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-detail]');
      if (!button) return;
      const index = Number(button.dataset.detail);
      renderPayrollDetail(index);
    });
  }
}

function computeMonthlyPayroll() {
  const message = document.getElementById('pr-msg');
  const period = selectValue(document.getElementById('pr-period'), '1405-01');
  const days = Number(document.getElementById('pr-days').value || 30);
  const schemeCode = payrollSchemeCode();
  const employees = workshopEmployees();
  if (employees.length === 0) {
    if (message) message.textContent = 'کارمندی برای محاسبه ثبت نشده است.';
    renderPayrollTable();
    return;
  }
  if (!(days >= 1 && days <= 31)) {
    if (message) message.textContent = 'روزهای قابل پرداخت باید بین ۱ و ۳۱ باشد.';
    return;
  }
  const rows = [];
  const skipped = [];
  for (const employee of employees) {
    const outcome = computeEmployeePayroll(employee, period, { schemeCode, days });
    if (outcome.error) skipped.push(`${employee.firstName} ${employee.lastName}: ${outcome.error}`);
    else rows.push(outcome);
  }
  payrollState.rows = rows;
  payrollState.period = period;
  if (message) {
    message.textContent = [
      rows.length > 0 ? `حقوق ${fmt(rows.length)} کارمند برای ${periodLabel(period)} محاسبه شد.` : 'هیچ کارمندی قابل محاسبه نبود.',
      ...skipped.slice(0, 3),
    ].join(' ');
    message.dataset.state = rows.length > 0 ? 'ok' : 'error';
  }
  renderPayrollSummary();
  renderPayrollTable();
  logActivity('payroll', 'COMPUTE', `محاسبه حقوق ${periodLabel(period)} برای ${rows.length} کارمند`);
  showToast('حقوق ماهانه محاسبه شد');
}

function renderPayrollSummary() {
  const target = document.getElementById('pr-summary');
  const counter = document.getElementById('pr-count');
  if (!target) return;
  const rows = payrollState.rows;
  if (counter) counter.textContent = `${fmt(rows.length)} فیش — ${periodLabel(payrollState.period)}`;
  if (rows.length === 0) {
    target.innerHTML = '';
    return;
  }
  const sum = (key) => rows.reduce((total, row) => total + Number(row.result[key] || 0), 0);
  const cards = [
    ['جمع مزد و مزایای مزدی', fmt(sum('wageSubtotal'))],
    ['جمع مزایای رفاهی', fmt(sum('welfareSubtotal'))],
    ['جمع کسور (بیمه و مالیات)', fmt(sum('workerInsurance') + sum('tax'))],
    ['جمع خالص پرداختی', fmt(sum('netPayable'))],
  ];
  target.innerHTML = `<div class="summary-grid">${cards
    .map(([label, value]) => `<div class="summary-card"><span class="label">${label}</span><span class="value">${value}</span></div>`)
    .join('')}</div>`;
}

function renderPayrollTable() {
  const table = document.getElementById('pr-table');
  if (!table) return;
  const rows = payrollState.rows;
  const empty = document.getElementById('pr-empty');
  if (empty) empty.hidden = rows.length > 0 || workshopEmployees().length > 0;
  if (rows.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr><td><div class="empty-state">برای مشاهده فیش‌ها، دوره را انتخاب و دکمه «محاسبه حقوق ماه» را بزنید. کارمندان بدون گروه شغلی در محاسبه نمی‌آیند.</div></td></tr>
      </tbody>`;
    return;
  }
  const totals = rows.reduce(
    (acc, row) => {
      acc.jobWage += row.result.monthlyJobWage;
      acc.seniority += row.result.monthlySeniorityWage;
      acc.baseWage += row.result.monthlyBaseWage;
      acc.allowances += row.result.overtimePay + row.result.shiftPay + row.result.nightWorkPay + row.result.otherWageAllowances;
      acc.welfare += row.result.welfareSubtotal;
      acc.insurance += row.result.workerInsurance;
      acc.tax += row.result.tax;
      acc.net += row.result.netPayable;
      return acc;
    },
    { jobWage: 0, seniority: 0, baseWage: 0, allowances: 0, welfare: 0, insurance: 0, tax: 0, net: 0 },
  );
  table.innerHTML = `
    <thead>
      <tr>
        <th>کد پرسنلی</th><th>نام</th><th>گروه</th><th>مزد شغل</th><th>پایه سنوات</th><th>مزد مبنا</th>
        <th>فوق‌العاده‌ها</th><th>مزایای رفاهی</th><th>بیمه</th><th>مالیات</th><th>خالص</th><th>رشد مزد شغل</th><th>عملیات</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((row, index) => {
          const result = row.result;
          const growth = row.growthPct === null ? '—' : `${row.growthPct >= 0 ? '+' : ''}${fmt(row.growthPct, 1)}٪`;
          return `<tr>
            <td class="num" dir="ltr">${escapeHtml(row.employee.personnelCode)}</td>
            <td>
              <strong>${escapeHtml(`${row.employee.firstName} ${row.employee.lastName}`.trim())}</strong>
              ${row.mismatch ? '<div class="chip st-2">مغایرت مزد ثبت‌شده با جدول</div>' : ''}
            </td>
            <td class="num">${fmt(row.group)}</td>
            <td class="num">${fmt(result.monthlyJobWage)}</td>
            <td class="num">${fmt(result.monthlySeniorityWage)}</td>
            <td class="num">${fmt(result.monthlyBaseWage)}</td>
            <td class="num">${fmt(result.overtimePay + result.shiftPay + result.nightWorkPay + result.otherWageAllowances)}</td>
            <td class="num">${fmt(result.welfareSubtotal)}</td>
            <td class="num">${fmt(-result.workerInsurance)}</td>
            <td class="num">${result.tax === 0 ? '۰ (بدون پلکان)' : fmt(-result.tax)}</td>
            <td class="num"><strong>${fmt(result.netPayable)}</strong></td>
            <td class="num">${growth}</td>
            <td class="actions-cell no-print">
              <button type="button" class="ghost-btn small" data-detail="${index}">جزئیات</button>
            </td>
          </tr>`;
        })
        .join('')}
      <tr>
        <td colspan="3"><strong>جمع</strong></td>
        <td class="num"><strong>${fmt(totals.jobWage)}</strong></td>
        <td class="num"><strong>${fmt(totals.seniority)}</strong></td>
        <td class="num"><strong>${fmt(totals.baseWage)}</strong></td>
        <td class="num"><strong>${fmt(totals.allowances)}</strong></td>
        <td class="num"><strong>${fmt(totals.welfare)}</strong></td>
        <td class="num"><strong>${fmt(-totals.insurance)}</strong></td>
        <td class="num"><strong>${fmt(-totals.tax)}</strong></td>
        <td class="num"><strong>${fmt(totals.net)}</strong></td>
        <td></td><td class="no-print"></td>
      </tr>
    </tbody>`;
}

function renderPayrollDetail(index) {
  const row = payrollState.rows[index];
  const card = document.getElementById('pr-detail-card');
  const body = document.getElementById('pr-detail');
  const title = document.getElementById('pr-detail-title');
  if (!row || !card || !body) return;
  card.hidden = false;
  if (title) {
    title.textContent = `جزئیات فیش — ${row.employee.firstName} ${row.employee.lastName} — ${periodLabel(payrollState.period)}`;
  }
  const result = row.result;
  body.innerHTML = `
    <div class="mini-results">
      <div class="summary-card is-accent"><span class="label">خالص پرداختی</span><span class="value">${fmt(result.netPayable)}</span></div>
      <div class="summary-card"><span class="label">نسخه پارامترها</span><span class="value">${escapeHtml(result.parameterVersion ?? '—')}</span></div>
      <div class="summary-card is-neutral"><span class="label">سابقه مؤثر</span><span class="value">${fmt(employeeServiceYears(row.employee), 1)} سال</span></div>
      <div class="summary-card is-neutral"><span class="label">روزهای پرداخت</span><span class="value">${fmt(result.payableDays)}</span></div>
    </div>
    <div class="table-wrap">
      <table class="data-table profile-table">
        <thead><tr><th>مؤلفه</th><th>دسته</th><th>روزانه</th><th>ماهانه</th><th>فرمول</th><th>مبنا</th></tr></thead>
        <tbody>
          ${(result.breakdown ?? [])
            .map(
              (line) => `<tr>
                <td>${escapeHtml(line.title)}</td>
                <td>${escapeHtml(CATEGORY_LABELS[line.category] ?? line.category ?? '')}</td>
                <td class="num">${line.daily !== undefined ? fmt(line.daily) : '—'}</td>
                <td class="num">${fmt(line.monthly)}</td>
                <td><code dir="ltr">${escapeHtml(line.formula ?? '')}</code></td>
                <td class="small muted">${escapeHtml(line.note ?? '')}</td>
              </tr>`,
            )
            .join('')}
          <tr>
            <td colspan="3"><strong>مجموع دریافتی</strong></td>
            <td class="num"><strong>${fmt(result.grossTotal)}</strong></td>
            <td colspan="2" class="small muted">مزد و مزایای مزدی ${fmt(result.wageSubtotal)} + مزایای رفاهی ${fmt(result.welfareSubtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${(result.warnings ?? []).length > 0
      ? `<div class="warnings"><h4>هشدارهای محاسبه</h4><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></div>`
      : ''}`;
}

function exportPayrollCsv() {
  const rows = payrollState.rows;
  if (rows.length === 0) {
    showToast('ابتدا حقوق ماه را محاسبه کنید.');
    return false;
  }
  const header = ['personnelCode', 'name', 'group', 'jobWage', 'seniority', 'baseWage', 'allowances', 'welfare', 'insurance', 'tax', 'net', 'period'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.employee.personnelCode,
        `${row.employee.firstName} ${row.employee.lastName}`,
        row.group,
        row.result.monthlyJobWage,
        row.result.monthlySeniorityWage,
        row.result.monthlyBaseWage,
        row.result.overtimePay + row.result.shiftPay + row.result.nightWorkPay + row.result.otherWageAllowances,
        row.result.welfareSubtotal,
        row.result.workerInsurance,
        row.result.tax,
        row.result.netPayable,
        payrollState.period,
      ]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];
  const ok = downloadTextFile('payroll.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
  if (ok) showToast('خروجی CSV حقوق ماهانه آماده شد');
  return ok;
}

/* ------------------------------ معوقات ------------------------------ */

function arrearsSchemeCode() {
  const schemes = core.listWageSchemes(state.data ?? { wageTables: [] });
  const preferred = schemes.find((scheme) => scheme.schemeCode === 'SERVICE_COMPANIES_NATIONWIDE');
  return preferred?.schemeCode ?? schemes[0]?.schemeCode ?? 'SERVICE_COMPANIES_NATIONWIDE';
}

function initArrears() {
  const fromSelect = document.getElementById('ar-from');
  const toSelect = document.getElementById('ar-to');
  const months = [...periodsForYear(1405), ...periodsForYear(1406)];
  const optionsHtml = months.map((period) => `<option value="${period}">${periodLabel(period)}</option>`).join('');
  for (const select of [fromSelect, toSelect]) {
    if (select) select.innerHTML = optionsHtml;
  }
  if (fromSelect) setElementValue(fromSelect, arrearsState.from);
  if (toSelect) setElementValue(toSelect, arrearsState.to);

  for (const id of ['ar-group-effective', 'ar-increase-effective']) {
    const select = document.getElementById(id);
    if (select) select.innerHTML = optionsHtml;
  }
  if (document.getElementById('ar-group-effective')) setElementValue(document.getElementById('ar-group-effective'), arrearsState.from);
  if (document.getElementById('ar-increase-effective')) setElementValue(document.getElementById('ar-increase-effective'), arrearsState.from);

  const groupSelect = document.getElementById('ar-group-to');
  if (groupSelect) {
    groupSelect.innerHTML =
      '<option value="">— بدون تغییر گروه —</option>' +
      Array.from({ length: 20 }, (_, index) => {
        const group = index + 1;
        return `<option value="${group}">گروه ${fmt(group)}</option>`;
      }).join('');
  }

  const employeeSelect = document.getElementById('ar-employee');
  if (employeeSelect) {
    employeeSelect.addEventListener('change', () => {
      arrearsState.employeeId = selectValue(employeeSelect, '');
      const employee = employeeById(arrearsState.employeeId);
      const group = employeePayrollGroup(employee);
      const groupTo = document.getElementById('ar-group-to');
      if (groupTo && group) setElementValue(groupTo, String(group));
    });
  }

  const calc = document.getElementById('ar-calc');
  if (calc) calc.addEventListener('click', () => computeArrears());
  const print = document.getElementById('ar-print');
  if (print) {
    print.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
  const exportButton = document.getElementById('ar-export');
  if (exportButton) exportButton.addEventListener('click', () => exportArrearsCsv());
  const close = document.getElementById('ar-detail-close');
  if (close) {
    close.addEventListener('click', () => {
      const card = document.getElementById('ar-detail-card');
      if (card) card.hidden = true;
    });
  }
  const table = document.getElementById('ar-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-ar-detail]');
      if (!button) return;
      renderArrearsDetail(Number(button.dataset.arDetail));
    });
  }

  renderArrearsView();
}

function renderArrearsView() {
  const workspace = document.getElementById('ar-workspace');
  const empty = document.getElementById('ar-empty-workshop');
  if (!workspace || !empty) return;
  const employees = workshopEmployees();
  const hasWorkshop = Boolean(activeWorkshop());
  empty.hidden = hasWorkshop;
  workspace.hidden = !hasWorkshop;
  if (!hasWorkshop) return;

  const select = document.getElementById('ar-employee');
  if (select) {
    const previous = arrearsState.employeeId || selectValue(select, '');
    select.innerHTML =
      employees.length === 0
        ? '<option value="">— کارمندی ثبت نشده —</option>'
        : employees
            .map((employee) => {
              const group = employeePayrollGroup(employee);
              return `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.personnelCode)} — ${escapeHtml(`${employee.firstName} ${employee.lastName}`.trim())}${group ? ` (گروه ${fmt(group)})` : ' (بدون گروه)'}</option>`;
            })
            .join('');
    const next = employees.some((employee) => employee.id === previous) ? previous : employees[0]?.id ?? '';
    setElementValue(select, next);
    arrearsState.employeeId = next;
  }
}

function computeArrears() {
  const errorTarget = document.getElementById('ar-error');
  const employee = employeeById(arrearsState.employeeId || selectValue(document.getElementById('ar-employee'), ''));
  const from = selectValue(document.getElementById('ar-from'), '1405-01');
  const to = selectValue(document.getElementById('ar-to'), '1405-03');
  const groupToRaw = selectValue(document.getElementById('ar-group-to'), '');
  const groupEffective = selectValue(document.getElementById('ar-group-effective'), from);
  const increasePct = Number(document.getElementById('ar-increase').value || 0);
  const increaseEffective = selectValue(document.getElementById('ar-increase-effective'), from);
  const paidOverrideRaw = document.getElementById('ar-paid').value;

  const problems = [];
  if (!employee) problems.push('ابتدا یک کارمند انتخاب کنید.');
  if (!from || !to || from > to) problems.push('بازه دوره معتبر نیست؛ دوره شروع باید پیش از پایان باشد.');
  const months = from <= to ? periodsBetween(from, to) : [];
  if (months.length === 0) problems.push('بازه دوره خالی است.');
  if (months.length > 24) problems.push('حداکثر بازه محاسبه معوقات ۲۴ ماه است.');
  if (!(increasePct >= 0 && increasePct <= 100)) problems.push('درصد افزایش باید بین ۰ و ۱۰۰ باشد.');
  const currentGroup = employeePayrollGroup(employee);
  if (employee && !currentGroup) problems.push('برای این کارمند گروه شغلی تعیین نشده است.');
  const groupTo = groupToRaw ? Number(groupToRaw) : currentGroup;
  if (groupToRaw && !(groupTo >= 1 && groupTo <= 20)) problems.push('گروه جدید باید بین ۱ و ۲۰ باشد.');
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }
  if (errorTarget) errorTarget.textContent = '';

  const schemeCode = arrearsSchemeCode();
  const paidOverride = paidOverrideRaw === '' ? null : Math.max(0, Number(paidOverrideRaw));
  if (paidOverride !== null && (!Number.isFinite(paidOverride) || paidOverride < 0)) {
    if (errorTarget) errorTarget.textContent = 'مبلغ پرداختی معتبر نیست.';
    return;
  }

  const rows = [];
  try {
    for (const period of months) {
      const groupChanged = period >= groupEffective && groupTo !== currentGroup;
      const effectiveGroup = groupChanged ? groupTo : currentGroup;
      const base = core.computeWage(state.data, payrollInputFor(employee, period, { schemeCode, group: currentGroup }));
      const entitled = core.computeWage(state.data, payrollInputFor(employee, period, { schemeCode, group: effectiveGroup }));
      const increaseApplies = increasePct > 0 && period >= increaseEffective;
      const wageSubtotal = increaseApplies ? core.roundMoney(entitled.wageSubtotal * (1 + increasePct / 100)) : entitled.wageSubtotal;
      const entitlement = wageSubtotal + entitled.welfareSubtotal;
      const paid = paidOverride ?? base.grossTotal;
      const difference = entitlement - paid;
      rows.push({
        period,
        group: effectiveGroup,
        groupChanged,
        increaseApplies,
        increasePct: increaseApplies ? increasePct : 0,
        jobWage: entitled.monthlyJobWage,
        seniority: entitled.monthlySeniorityWage,
        baseWage: entitled.monthlyBaseWage,
        allowances: entitled.overtimePay + entitled.shiftPay + entitled.nightWorkPay + entitled.otherWageAllowances,
        welfare: entitled.welfareSubtotal,
        wageSubtotal,
        entitlement,
        paid,
        difference,
        base,
        entitled,
      });
    }
  } catch (error) {
    if (errorTarget) errorTarget.textContent = `خطای محاسبه: ${error.message}`;
    return;
  }

  arrearsState = { ...arrearsState, employeeId: employee.id, from, to, rows };
  renderArrearsSummary(employee);
  renderArrearsTable(employee);
  logActivity('arrears', 'COMPUTE', `محاسبه معوقات ${employee.firstName} ${employee.lastName} از ${periodLabel(from)} تا ${periodLabel(to)}`);
  showToast('معوقات محاسبه شد');
}

function renderArrearsSummary(employee) {
  const target = document.getElementById('ar-summary');
  const counter = document.getElementById('ar-count');
  const title = document.getElementById('ar-title');
  if (!target) return;
  const rows = arrearsState.rows;
  if (title) {
    title.textContent = rows.length > 0
      ? `جدول ماه‌به‌ماه معوقات — ${employee.firstName} ${employee.lastName} (${employee.personnelCode})`
      : 'جدول ماه‌به‌ماه معوقات';
  }
  if (counter) counter.textContent = rows.length > 0 ? `${fmt(rows.length)} ماه` : '';
  if (rows.length === 0) {
    target.innerHTML = '';
    return;
  }
  const entitlement = rows.reduce((sum, row) => sum + row.entitlement, 0);
  const paid = rows.reduce((sum, row) => sum + row.paid, 0);
  const difference = entitlement - paid;
  const cards = [
    ['جمع مزد استحقاقی', fmt(entitlement)],
    ['جمع مزد پرداختی', fmt(paid)],
    [`مابه‌التفاوت (${difference >= 0 ? 'بستانکار کارگر' : 'بدهکار کارگر'})`, `${difference < 0 ? '−' : ''}${fmt(Math.abs(difference))}`],
    ['تعداد ماه', fmt(rows.length)],
  ];
  target.innerHTML = `<div class="summary-grid">${cards
    .map(
      ([label, value], index) =>
        `<div class="summary-card ${index === 2 ? 'is-accent' : ''}"><span class="label">${escapeHtml(label)}</span><span class="value">${value}</span></div>`,
    )
    .join('')}</div>`;
}

function renderArrearsTable(employee) {
  const table = document.getElementById('ar-table');
  if (!table) return;
  const rows = arrearsState.rows;
  if (rows.length === 0) {
    table.innerHTML = `
      <tbody><tr><td><div class="empty-state">برای مشاهده معوقات، کارمند و بازه را انتخاب و دکمه «محاسبه معوقات» را بزنید.</div></td></tr></tbody>`;
    return;
  }
  const totals = rows.reduce(
    (acc, row) => {
      acc.jobWage += row.jobWage;
      acc.seniority += row.seniority;
      acc.baseWage += row.baseWage;
      acc.welfare += row.welfare;
      acc.entitlement += row.entitlement;
      acc.paid += row.paid;
      acc.difference += row.difference;
      return acc;
    },
    { jobWage: 0, seniority: 0, baseWage: 0, welfare: 0, entitlement: 0, paid: 0, difference: 0 },
  );
  table.innerHTML = `
    <thead>
      <tr>
        <th>دوره</th><th>گروه مؤثر</th><th>مزد شغل</th><th>پایه سنوات</th><th>مزد مبنا</th>
        <th>مزایای رفاهی</th><th>جمع استحقاقی</th><th>پرداختی</th><th>مابه‌التفاوت</th><th>توضیح</th><th class="no-print">جزئیات</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((row, index) => {
          const notes = [
            row.groupChanged ? `ارتقا به گروه ${fmt(row.group)}` : '',
            row.increaseApplies ? `افزایش ${fmt(row.increasePct, 1)}٪ بخشنامه` : '',
          ].filter(Boolean).join(' • ') || 'بدون تغییر مؤثر';
          return `<tr>
            <td>${escapeHtml(periodLabel(row.period))}</td>
            <td class="num">${fmt(row.group)}</td>
            <td class="num">${fmt(row.jobWage)}</td>
            <td class="num">${fmt(row.seniority)}</td>
            <td class="num">${fmt(row.baseWage)}</td>
            <td class="num">${fmt(row.welfare)}</td>
            <td class="num"><strong>${fmt(row.entitlement)}</strong></td>
            <td class="num">${fmt(row.paid)}</td>
            <td class="num ${row.difference < 0 ? 'text-danger' : ''}">${row.difference < 0 ? '−' : ''}${fmt(Math.abs(row.difference))}</td>
            <td class="small muted">${escapeHtml(notes)}</td>
            <td class="no-print"><button type="button" class="ghost-btn small" data-ar-detail="${index}">جزئیات</button></td>
          </tr>`;
        })
        .join('')}
      <tr>
        <td colspan="2"><strong>جمع</strong></td>
        <td class="num"><strong>${fmt(totals.jobWage)}</strong></td>
        <td class="num"><strong>${fmt(totals.seniority)}</strong></td>
        <td class="num"><strong>${fmt(totals.baseWage)}</strong></td>
        <td class="num"><strong>${fmt(totals.welfare)}</strong></td>
        <td class="num"><strong>${fmt(totals.entitlement)}</strong></td>
        <td class="num"><strong>${fmt(totals.paid)}</strong></td>
        <td class="num"><strong>${totals.difference < 0 ? '−' : ''}${fmt(Math.abs(totals.difference))}</strong></td>
        <td colspan="2" class="small muted">${escapeHtml(employee ? `${employee.firstName} ${employee.lastName} — ${employee.personnelCode}` : '')}</td>
      </tr>
    </tbody>`;
}

function renderArrearsDetail(index) {
  const row = arrearsState.rows[index];
  const card = document.getElementById('ar-detail-card');
  const body = document.getElementById('ar-detail');
  const title = document.getElementById('ar-detail-title');
  if (!row || !card || !body) return;
  card.hidden = false;
  if (title) title.textContent = `جزئیات ${periodLabel(row.period)}`;
  body.innerHTML = `
    <div class="mini-results">
      <div class="summary-card is-accent"><span class="label">مابه‌التفاوت ماه</span><span class="value">${row.difference < 0 ? '−' : ''}${fmt(Math.abs(row.difference))}</span></div>
      <div class="summary-card"><span class="label">استحقاقی</span><span class="value">${fmt(row.entitlement)}</span></div>
      <div class="summary-card is-neutral"><span class="label">پرداختی</span><span class="value">${fmt(row.paid)}</span></div>
      <div class="summary-card is-neutral"><span class="label">گروه مؤثر</span><span class="value">${fmt(row.group)}</span></div>
    </div>
    <div class="table-wrap">
      <table class="data-table profile-table">
        <thead><tr><th>مؤلفه</th><th>دسته</th><th>ماهانه</th><th>فرمول</th><th>مبنا</th></tr></thead>
        <tbody>
          ${(row.entitled.breakdown ?? [])
            .map(
              (line) => `<tr>
                <td>${escapeHtml(line.title)}</td>
                <td>${escapeHtml(CATEGORY_LABELS[line.category] ?? line.category ?? '')}</td>
                <td class="num">${fmt(line.monthly)}</td>
                <td><code dir="ltr">${escapeHtml(line.formula ?? '')}</code></td>
                <td class="small muted">${escapeHtml(line.note ?? '')}</td>
              </tr>`,
            )
            .join('')}
          ${row.increaseApplies
            ? `<tr>
                <td><strong>افزایش بخشنامه ${fmt(row.increasePct, 1)}٪</strong></td>
                <td>افزایش مزدی</td>
                <td class="num">${fmt(row.wageSubtotal - row.entitled.wageSubtotal)}</td>
                <td><code dir="ltr">FRM-WAGE-INCREASE</code></td>
                <td class="small muted">${escapeHtml(periodLabel(row.period))} — مستند بخشنامه افزایش مزد</td>
              </tr>`
            : ''}
          <tr>
            <td colspan="2"><strong>جمع استحقاقی ماه</strong></td>
            <td class="num"><strong>${fmt(row.entitlement)}</strong></td>
            <td colspan="2" class="small muted">مزد و مزایای مزدی ${fmt(row.wageSubtotal)} + مزایای رفاهی ${fmt(row.welfare)}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>مزد پرداختی ماه</strong></td>
            <td class="num"><strong>${fmt(row.paid)}</strong></td>
            <td colspan="2" class="small muted">${escapeHtml(row.paid === row.base.grossTotal ? 'مبنای پیش‌فرض: استحقاقی پرونده بدون تغییرات اعلام‌شده' : 'مبلغ دستی واردشده')}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="form-note">
      استحقاقی = مزد و مزایای مزدی${row.increaseApplies ? ` × (۱ + ${fmt(row.increasePct, 1)}٪ افزایش بخشنامه)` : ''} + مزایای رفاهی.
      پرداختی مبنای مقایسه: ${row.paid === row.base.grossTotal ? 'استحقاقی پرونده بدون تغییرات اعلام‌شده' : 'مبلغ دستی واردشده'}.
    </p>`;
}

function exportArrearsCsv() {
  const rows = arrearsState.rows;
  if (rows.length === 0) {
    showToast('ابتدا معوقات را محاسبه کنید.');
    return false;
  }
  const header = ['period', 'group', 'jobWage', 'seniority', 'baseWage', 'welfare', 'entitlement', 'paid', 'difference'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [row.period, row.group, row.jobWage, row.seniority, row.baseWage, row.welfare, row.entitlement, row.paid, row.difference]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
    ['TOTAL', '', '', '', '', '', rows.reduce((sum, row) => sum + row.entitlement, 0), rows.reduce((sum, row) => sum + row.paid, 0), rows.reduce((sum, row) => sum + row.difference, 0)]
      .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
      .join(','),
  ];
  const ok = downloadTextFile('arrears.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
  if (ok) showToast('خروجی CSV معوقات آماده شد');
  return ok;
}


/* ============================== گزارش‌ساز ============================== */

const REPORT_TYPES = [
  { code: 'JOBS_LIST', title: 'فهرست مشاغل کارگاه' },
  { code: 'JOBS_EVALUATED', title: 'مشاغل ارزیابی‌شده' },
  { code: 'GROUP_ASSIGNMENT', title: 'گروه‌بندی مشاغل و مغایرت‌ها' },
  { code: 'COMMITTEE', title: 'صورت‌جلسه تصمیم‌های کمیته' },
  { code: 'ORG', title: 'ساختار سازمانی و نیروی مصوب' },
  { code: 'EMPLOYEES', title: 'فهرست کارکنان' },
  { code: 'EMPLOYEE_DOSSIER', title: 'پرونده پرسنلی کارمند' },
  { code: 'DISTRIBUTION', title: 'توزیع کارکنان بر اساس گروه و واحد' },
  { code: 'PAYROLL', title: 'فیش حقوقی ماهانه کارکنان' },
  { code: 'ARREARS', title: 'خلاصه معوقات دوره' },
  { code: 'YEAR_COMPARE', title: 'مقایسه مزد ۱۴۰۴ و ۱۴۰۵' },
  { code: 'OVERVIEW', title: 'گزارش جامع کارگاه' },
];

const COMPARE_CRITERIA = [
  { code: 'TOTAL', title: 'امتیاز کل', short: 'امتیاز', max: 1137 },
  { code: 'GROUP', title: 'گروه شغلی', short: 'گروه', max: 20 },
  { code: 'SKILL', title: 'امتیاز مهارت‌ها', short: 'مهارت', max: 372 },
  { code: 'RESP', title: 'امتیاز مسئولیت‌ها', short: 'مسئولیت', max: 380 },
  { code: 'EFFORT', title: 'امتیاز کوشش‌ها', short: 'کوشش', max: 185 },
  { code: 'COND', title: 'امتیاز شرایط کار', short: 'شرایط', max: 200 },
  { code: 'EXPERIENCE', title: 'سابقه موردنیاز (سال)', short: 'سابقه', max: 10 },
  { code: 'EDUCATION', title: 'سطح تحصیلات موردنیاز', short: 'تحصیلات', max: 6 },
  { code: 'HEADCOUNT', title: 'نیرو تحت سرپرستی', short: 'نیرو', max: 20 },
  { code: 'DUTIES', title: 'تعداد وظایف اصلی', short: 'وظایف', max: 15 },
];

const EDUCATION_LEVELS = {
  'زیر دیپلم': 1,
  'دیپلم': 2,
  'کاردانی': 3,
  'کارشناسی': 4,
  'کارشناسی ارشد': 5,
  'دکتری': 6,
};

const RADAR_COLORS = ['#0b1c3a', '#d4af37', '#2f6f8f'];
const reportState = { type: 'JOBS_LIST', period: '1405-01', employeeId: '', unitId: '', columns: [], rows: [], title: '' };

function compareValue(job, code) {
  const evaluation = job.evaluation;
  const approval = normalizeApproval(evaluation);
  switch (code) {
    case 'TOTAL':
      return Number(evaluation?.totalScore ?? 0);
    case 'GROUP':
      return Number(approval?.finalGroup ?? evaluation?.proposedGroup ?? 0);
    case 'SKILL':
    case 'RESP':
    case 'EFFORT':
    case 'COND': {
      const factorCode = { SKILL: 'SYS_B_F1', RESP: 'SYS_B_F2', EFFORT: 'SYS_B_F3', COND: 'SYS_B_F4' }[code];
      return Number((evaluation?.factorScores ?? []).find((factor) => factor.factorCode === factorCode)?.points ?? 0);
    }
    case 'EXPERIENCE':
      return Number(job.experienceYears ?? 0);
    case 'EDUCATION':
      return EDUCATION_LEVELS[job.education] ?? 0;
    case 'HEADCOUNT':
      return Number(job.headcount ?? 0);
    case 'DUTIES':
      return String(job.dutiesMain ?? '').split('\n').map((line) => line.trim()).filter(Boolean).length;
    default:
      return 0;
  }
}

function initReports() {
  const typeSelect = document.getElementById('rp-type');
  if (typeSelect) {
    typeSelect.innerHTML = REPORT_TYPES.map((type) => `<option value="${type.code}">${escapeHtml(type.title)}</option>`).join('');
    setElementValue(typeSelect, reportState.type);
  }
  const periodSelect = document.getElementById('rp-period');
  if (periodSelect) {
    periodSelect.innerHTML = periodsForYear(1405).map((period) => `<option value="${period}">${periodLabel(period)}</option>`).join('');
    setElementValue(periodSelect, reportState.period);
  }
  const unitSelect = document.getElementById('rp-unit');
  if (unitSelect) {
    unitSelect.innerHTML =
      '<option value="">همه واحدها</option>' +
      unitsTreeOrder(workshopUnits())
        .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.title)}</option>`)
        .join('');
  }

  const build = document.getElementById('rp-build');
  if (build) build.addEventListener('click', () => buildReport());
  const print = document.getElementById('rp-print');
  if (print) {
    print.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
  const exportButton = document.getElementById('rp-export');
  if (exportButton) exportButton.addEventListener('click', () => exportReportCsv());
  const compareButton = document.getElementById('cmp-build');
  if (compareButton) compareButton.addEventListener('click', () => buildComparison());

  renderReportsView();
}

function renderReportsView() {
  const sheet = document.getElementById('rp-sheet');
  const empty = document.getElementById('rp-empty-workshop');
  if (!sheet || !empty) return;
  const hasWorkshop = Boolean(activeWorkshop());
  empty.hidden = hasWorkshop;
  if (!hasWorkshop) {
    sheet.hidden = true;
    return;
  }

  const employeeSelect = document.getElementById('rp-employee');
  if (employeeSelect) {
    const previous = reportState.employeeId || selectValue(employeeSelect, '');
    const employees = workshopEmployees();
    employeeSelect.innerHTML =
      employees.length === 0
        ? '<option value="">— کارمندی ثبت نشده —</option>'
        : employees
            .map((employee) => `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.personnelCode)} — ${escapeHtml(`${employee.firstName} ${employee.lastName}`.trim())}</option>`)
            .join('');
    const next = employees.some((employee) => employee.id === previous) ? previous : employees[0]?.id ?? '';
    setElementValue(employeeSelect, next);
    reportState.employeeId = next;
  }

  const unitSelect = document.getElementById('rp-unit');
  if (unitSelect) {
    const previous = reportState.unitId || selectValue(unitSelect, '');
    unitSelect.innerHTML =
      '<option value="">همه واحدها</option>' +
      unitsTreeOrder(workshopUnits())
        .map(({ unit, depth }) => `<option value="${escapeHtml(unit.id)}">${'—'.repeat(depth)} ${escapeHtml(unit.title)}</option>`)
        .join('');
    setElementValue(unitSelect, previous);
  }

  const jobsSelect = document.getElementById('cmp-jobs');
  if (jobsSelect) {
    const previouslySelected = new Set(
      [...(jobsSelect.options ?? [])].filter((option) => option.selected || option.hasAttribute('selected')).map((option) => option.getAttribute('value')),
    );
    jobsSelect.innerHTML = workshopJobs()
      .map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.jobCode)} — ${escapeHtml(job.title)}</option>`)
      .join('');
    for (const option of jobsSelect.options ?? []) {
      const selected = previouslySelected.has(option.getAttribute('value'));
      option.selected = selected;
      if (selected) option.setAttribute('selected', 'selected');
    }
  }
}

function reportTableHtml(columns, rows) {
  return `<div class="table-wrap">
    <table class="data-table report-table">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? '—'))}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>
  </div>`;
}

function buildReportContent({ type, period, employeeId, unitId, workshop }) {
  const unitFilter = unitId ? unitById(unitId) : null;
  const unitLabel = unitFilter ? ` — واحد ${unitFilter.title}` : '';
  const jobs = workshopJobs();
  const employees = workshopEmployees();

  switch (type) {
    case 'JOBS_LIST': {
      const rows = jobs
        .filter((job) => !unitId || job.unitId === unitId)
        .map((job) => {
          const approval = normalizeApproval(job.evaluation);
          return [
            job.jobCode,
            job.title,
            job.orgUnit || '—',
            job.supervisorJobCode || '—',
            fmt(job.headcount ?? 0),
            job.evaluation ? fmt(job.evaluation.totalScore, 1) : '—',
            job.evaluation?.proposedGroup ? fmt(job.evaluation.proposedGroup) : '—',
            approval?.finalGroup ? fmt(approval.finalGroup) : '—',
            job.evaluation ? APPROVAL_STATUS_LABELS[approval.status] ?? '—' : 'بدون ارزیابی',
          ];
        });
      return {
        title: 'فهرست مشاغل کارگاه',
        subtitle: `${workshop.workshopName}${unitLabel}`,
        columns: ['کد شغل', 'عنوان شغل', 'واحد سازمانی', 'سرپرست', 'تعداد نیرو', 'امتیاز', 'گروه پیشنهادی', 'گروه نهایی', 'وضعیت تأیید'],
        rows,
      };
    }
    case 'JOBS_EVALUATED': {
      const rows = jobs
        .filter((job) => job.evaluation)
        .filter((job) => !unitId || job.unitId === unitId)
        .map((job) => {
          const approval = normalizeApproval(job.evaluation);
          return [
            job.jobCode,
            job.title,
            fmt(job.evaluation.totalScore, 1),
            `${fmt(job.evaluation.rangeMin ?? 0)}–${fmt(job.evaluation.rangeMax ?? 0)}`,
            job.evaluation.proposedGroup ? fmt(job.evaluation.proposedGroup) : '—',
            approval?.finalGroup ? fmt(approval.finalGroup) : '—',
            APPROVAL_STATUS_LABELS[approval.status] ?? '—',
            approval?.expertName ?? '—',
            approval?.committeeRef ?? '—',
          ];
        });
      return {
        title: 'گزارش مشاغل ارزیابی‌شده',
        subtitle: `${workshop.workshopName}${unitLabel} — ${fmt(rows.length)} شغل ارزیابی‌شده`,
        columns: ['کد شغل', 'عنوان', 'امتیاز کل', 'بازه امتیاز', 'گروه پیشنهادی', 'گروه نهایی', 'وضعیت تأیید', 'کارشناس', 'شماره صورت‌جلسه'],
        rows,
      };
    }
    case 'GROUP_ASSIGNMENT': {
      const rows = jobs
        .filter((job) => job.evaluation)
        .filter((job) => !unitId || job.unitId === unitId)
        .map((job) => {
          const approval = normalizeApproval(job.evaluation);
          const delta = approval?.finalGroup && job.evaluation.proposedGroup
            ? approval.finalGroup - job.evaluation.proposedGroup
            : 0;
          return [
            job.jobCode,
            job.title,
            job.evaluation.proposedGroup ? fmt(job.evaluation.proposedGroup) : '—',
            approval?.finalGroup ? fmt(approval.finalGroup) : '—',
            delta === 0 ? '۰' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`,
            APPROVAL_STATUS_LABELS[approval.status] ?? '—',
            approval?.changeReason ?? '—',
          ];
        });
      return {
        title: 'گروه‌بندی مشاغل و مغایرت‌ها',
        subtitle: `${workshop.workshopName} — مبنا: گروه پیشنهادی موتور در برابر گروه مصوب کمیته`,
        columns: ['کد شغل', 'عنوان', 'گروه پیشنهادی', 'گروه نهایی', 'اختلاف', 'وضعیت تأیید', 'دلیل تغییر'],
        rows,
      };
    }
    case 'COMMITTEE': {
      const rows = [];
      for (const job of jobs) {
        const approval = normalizeApproval(job.evaluation);
        for (const entry of approval?.history ?? []) {
          if (entry.status === 'PENDING_COMMITTEE_APPROVAL') continue;
          rows.push([
            entry.decisionDate ?? '—',
            job.jobCode,
            job.title,
            APPROVAL_STATUS_LABELS[entry.status] ?? entry.status,
            entry.finalGroup ? fmt(entry.finalGroup) : '—',
            entry.expertName ?? '—',
            entry.committeeRef ?? '—',
            entry.changeReason ?? '—',
          ]);
        }
      }
      return {
        title: 'صورت‌جلسه تصمیم‌های کمیته طبقه‌بندی',
        subtitle: `${workshop.workshopName} — ${fmt(rows.length)} تصمیم ثبت‌شده`,
        columns: ['تاریخ تصمیم', 'کد شغل', 'عنوان', 'تصمیم', 'گروه نهایی', 'کارشناس', 'شماره صورت‌جلسه', 'دلیل / توضیح'],
        rows,
      };
    }
    case 'ORG': {
      const ordered = unitsTreeOrder(workshopUnits());
      const rows = ordered.map(({ unit, depth }) => [
        `${'—'.repeat(depth)} ${unit.code}`,
        unit.title,
        UNIT_TYPE_LABELS[unit.unitType] ?? '—',
        fmt(depth + 1),
        unit.managerName || '—',
        fmt(unit.approvedHeadcount ?? 0),
        fmt(workshopJobs().filter((job) => job.unitId === unit.id).length),
        unit.active === false ? 'غیرفعال' : 'فعال',
      ]);
      return {
        title: 'ساختار سازمانی و نیروی مصوب',
        subtitle: `${workshop.workshopName} — ${fmt(ordered.length)} واحد`,
        columns: ['کد واحد', 'عنوان واحد', 'نوع', 'سطح', 'مسئول', 'نیروی مصوب', 'مشاغل', 'وضعیت'],
        rows,
      };
    }
    case 'EMPLOYEES': {
      const rows = employees
        .filter((employee) => !unitId || employee.unitId === unitId)
        .map((employee) => {
          const job = employeeJob(employee);
          const unit = employee.unitId ? unitById(employee.unitId) : null;
          return [
            employee.personnelCode,
            `${employee.firstName} ${employee.lastName}`.trim(),
            unit?.title ?? '—',
            job ? `${job.title} (${job.jobCode})` : '—',
            employee.group ? fmt(employee.group) : '—',
            CONTRACT_TYPE_LABELS[employee.contractType] ?? '—',
            employee.hireDate || '—',
            fmt(employeeServiceYears(employee), 1),
            EMPLOYEE_STATUS_LABELS[employee.status] ?? '—',
          ];
        });
      return {
        title: 'فهرست کارکنان',
        subtitle: `${workshop.workshopName}${unitLabel} — ${fmt(rows.length)} نفر`,
        columns: ['کد پرسنلی', 'نام و نام خانوادگی', 'واحد', 'شغل', 'گروه', 'قرارداد', 'تاریخ استخدام', 'سابقه (سال)', 'وضعیت'],
        rows,
      };
    }
    case 'EMPLOYEE_DOSSIER': {
      const employee = employeeById(employeeId) ?? employees[0] ?? null;
      if (!employee) {
        return { title: 'پرونده پرسنلی کارمند', subtitle: workshop.workshopName, columns: [], rows: [], html: '<p class="muted">کارمندی ثبت نشده است.</p>' };
      }
      const job = employeeJob(employee);
      const unit = employee.unitId ? unitById(employee.unitId) : null;
      const history = [...(employee.jobChanges ?? [])].reverse();
      const identity = [
        ['کد پرسنلی', employee.personnelCode],
        ['نام و نام خانوادگی', `${employee.firstName} ${employee.lastName}`.trim()],
        ['نام پدر', employee.fatherName || '—'],
        ['کد ملی', employee.nationalId || '—'],
        ['تاریخ تولد', employee.birthDate || '—'],
        ['وضعیت تأهل', MARITAL_LABELS[employee.maritalStatus] ?? '—'],
        ['تعداد فرزند', fmt(employee.childrenCount ?? 0)],
      ];
      const placement = [
        ['واحد سازمانی', unit ? `${unit.title} (${unit.code})` : '—'],
        ['شغل', job ? `${job.title} (${job.jobCode})` : '—'],
        ['گروه شغلی', employee.group ? fmt(employee.group) : '—'],
        ['سرپرست', employee.supervisorName || '—'],
        ['نوع قرارداد', CONTRACT_TYPE_LABELS[employee.contractType] ?? '—'],
        ['تاریخ استخدام', employee.hireDate || '—'],
        ['سابقه مؤثر', `${fmt(employeeServiceYears(employee), 1)} سال`],
        ['وضعیت', EMPLOYEE_STATUS_LABELS[employee.status] ?? '—'],
        ['مزد شغل روزانه', employee.dailyJobWage ? fmt(employee.dailyJobWage) : '—'],
        ['سنوات تجمیعی', employee.priorAccumulatedSeniority ? fmt(employee.priorAccumulatedSeniority) : '—'],
        ['بیمه', employee.insured ? `بیمه‌شده${employee.insuranceNumber ? ` — ${employee.insuranceNumber}` : ''}` : 'غیربیمه'],
      ];
      const html = `
        <h4 class="report-section-title">۱. هویت</h4>
        ${reportTableHtml(['عنوان', 'مقدار'], identity)}
        <h4 class="report-section-title">۲. استخدام و جایگاه سازمانی</h4>
        ${reportTableHtml(['عنوان', 'مقدار'], placement)}
        <h4 class="report-section-title">۳. تاریخچه ارتقا و تغییر شغل</h4>
        ${history.length === 0
          ? '<p class="muted">تغییری ثبت نشده است.</p>'
          : reportTableHtml(
              ['تاریخ', 'شغل قبلی', 'شغل جدید', 'گروه قبلی', 'گروه جدید', 'دلیل'],
              history.map((row) => [
                row.date || '—',
                row.fromJobTitle || row.fromJobCode || '—',
                row.toJobTitle || row.toJobCode || '—',
                row.fromGroup ? fmt(row.fromGroup) : '—',
                row.toGroup ? fmt(row.toGroup) : '—',
                row.reason || '—',
              ]),
            )}`;
      return {
        title: 'پرونده پرسنلی کارمند',
        subtitle: `${employee.firstName} ${employee.lastName} — ${employee.personnelCode}`,
        columns: ['عنوان', 'مقدار'],
        rows: [...identity, ...placement],
        html,
      };
    }
    case 'DISTRIBUTION': {
      const byGroup = Array.from({ length: 20 }, (_, index) => index + 1).map((group) => {
        const members = employees.filter((employee) => Number(employee.group) === group);
        return [
          `گروه ${fmt(group)}`,
          fmt(members.length),
          employees.length > 0 ? `${fmt((members.length / employees.length) * 100, 1)}٪` : '۰٪',
          members.map((employee) => employee.personnelCode).join('، ') || '—',
        ];
      }).filter((row) => row[1] !== '۰');
      const byUnit = unitsTreeOrder(workshopUnits()).map(({ unit }) => {
        const members = employees.filter((employee) => employee.unitId === unit.id);
        return [unit.title, unit.code, fmt(members.length), members.map((employee) => employee.personnelCode).join('، ') || '—'];
      });
      const html = `
        <h4 class="report-section-title">توزیع بر اساس گروه شغلی</h4>
        ${reportTableHtml(['گروه', 'تعداد کارکنان', 'سهم', 'کدهای پرسنلی'], byGroup)}
        <h4 class="report-section-title">توزیع بر اساس واحد سازمانی</h4>
        ${reportTableHtml(['واحد', 'کد', 'تعداد کارکنان', 'کدهای پرسنلی'], byUnit)}`;
      return {
        title: 'توزیع کارکنان بر اساس گروه و واحد',
        subtitle: `${workshop.workshopName} — ${fmt(employees.length)} نفر`,
        columns: ['گروه', 'تعداد کارکنان', 'سهم', 'کدهای پرسنلی'],
        rows: byGroup,
        html,
      };
    }
    case 'PAYROLL': {
      const schemeCode = arrearsSchemeCode();
      const rows = [];
      let totalNet = 0;
      for (const employee of employees) {
        const outcome = computeEmployeePayroll(employee, period, { schemeCode, days: 30 });
        if (outcome.error) continue;
        totalNet += outcome.result.netPayable;
        rows.push([
          employee.personnelCode,
          `${employee.firstName} ${employee.lastName}`.trim(),
          fmt(outcome.group),
          fmt(outcome.result.monthlyJobWage),
          fmt(outcome.result.monthlySeniorityWage),
          fmt(outcome.result.monthlyBaseWage),
          fmt(outcome.result.overtimePay + outcome.result.shiftPay + outcome.result.nightWorkPay + outcome.result.otherWageAllowances),
          fmt(outcome.result.welfareSubtotal),
          fmt(-outcome.result.workerInsurance),
          outcome.result.tax === 0 ? '۰' : fmt(-outcome.result.tax),
          fmt(outcome.result.netPayable),
        ]);
      }
      rows.push(['—', 'جمع کل', '', '', '', '', '', '', '', '', fmt(totalNet)]);
      return {
        title: 'فیش حقوقی ماهانه کارکنان',
        subtitle: `${workshop.workshopName} — ${periodLabel(period)} — ${fmt(rows.length - 1)} فیش`,
        columns: ['کد پرسنلی', 'نام', 'گروه', 'مزد شغل', 'پایه سنوات', 'مزد مبنا', 'فوق‌العاده‌ها', 'مزایای رفاهی', 'بیمه', 'مالیات', 'خالص'],
        rows,
      };
    }
    case 'ARREARS': {
      const rows = arrearsState.rows;
      if (rows.length === 0) {
        return {
          title: 'خلاصه معوقات دوره',
          subtitle: workshop.workshopName,
          columns: [],
          rows: [],
          html: '<p class="muted">ابتدا در ماژول «محاسبه معوقات» دوره را محاسبه کنید تا گزارش ساخته شود.</p>',
        };
      }
      const employee = employeeById(arrearsState.employeeId);
      const totalDifference = rows.reduce((sum, row) => sum + row.difference, 0);
      const tableRows = rows.map((row) => [
        periodLabel(row.period),
        fmt(row.group),
        fmt(row.jobWage),
        fmt(row.seniority),
        fmt(row.welfare),
        fmt(row.entitlement),
        fmt(row.paid),
        `${row.difference < 0 ? '−' : ''}${fmt(Math.abs(row.difference))}`,
      ]);
      tableRows.push(['جمع', '', '', '', '', fmt(rows.reduce((sum, row) => sum + row.entitlement, 0)), fmt(rows.reduce((sum, row) => sum + row.paid, 0)), `${totalDifference < 0 ? '−' : ''}${fmt(Math.abs(totalDifference))}`]);
      return {
        title: 'خلاصه معوقات دوره',
        subtitle: `${employee ? `${employee.firstName} ${employee.lastName} — ${employee.personnelCode}` : ''} — ${periodLabel(arrearsState.from)} تا ${periodLabel(arrearsState.to)}`,
        columns: ['دوره', 'گروه', 'مزد شغل', 'پایه سنوات', 'مزایای رفاهی', 'استحقاقی', 'پرداختی', 'مابه‌التفاوت'],
        rows: tableRows,
      };
    }
    case 'YEAR_COMPARE': {
      const rows = [];
      for (let group = 1; group <= 20; group += 1) {
        const table1405 = core.findWageTable(state.data, { schemeCode: arrearsSchemeCode(), fiscalYear: 1405, group, asOfDate: '1405-03-15' });
        const table1404 = core.findWageTable(state.data, { schemeCode: arrearsSchemeCode(), fiscalYear: 1404, group, asOfDate: '1405-03-15' });
        const rate = core.getSeniorityRate(state.data, { schemeCode: arrearsSchemeCode(), group, fiscalYear: 1405, asOfDate: '1405-03-15' });
        const growth = table1405 && table1404
          ? ((table1405.dailyJobWage - table1404.dailyJobWage) / table1404.dailyJobWage) * 100
          : null;
        rows.push([
          fmt(group),
          table1404 ? fmt(table1404.dailyJobWage) : '—',
          table1405 ? fmt(table1405.dailyJobWage) : '—',
          growth === null ? '—' : `${growth >= 0 ? '+' : '−'}${fmt(Math.abs(growth), 1)}٪`,
          rate.available ? fmt(rate.rate) : '—',
          rate.available ? fmt(rate.rate * 30) : '—',
        ]);
      }
      return {
        title: 'مقایسه مزد ۱۴۰۴ و ۱۴۰۵',
        subtitle: `${workshop.workshopName} — ۲۰ گروه شغلی (ریال)`,
        columns: ['گروه', 'مزد شغل روزانه ۱۴۰۴', 'مزد شغل روزانه ۱۴۰۵', 'رشد', 'نرخ پایه سنوات ۱۴۰۵', 'سنوات ماهانه (۳۰ روز)'],
        rows,
      };
    }
    case 'OVERVIEW':
    default: {
      const evaluated = jobs.filter((job) => job.evaluation).length;
      const approved = jobs.filter((job) => normalizeApproval(job.evaluation)?.status === 'COMMITTEE_APPROVED' || normalizeApproval(job.evaluation)?.status === 'MINISTRY_APPROVED').length;
      const units = workshopUnits().length;
      const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE').length;
      const cards = [
        ['واحدهای سازمانی', fmt(units)],
        ['مشاغل', `${fmt(jobs.length)} (${fmt(evaluated)} ارزیابی‌شده)`],
        ['گروه‌های تأییدشده', fmt(approved)],
        ['کارکنان', `${fmt(employees.length)} (${fmt(activeEmployees)} فعال)`],
      ];
      const unassigned = employees.filter((employee) => !employeePayrollGroup(employee)).length;
      const html = `
        <div class="summary-grid profile-summary">
          ${cards.map(([label, value]) => `<div class="summary-card"><span class="label">${label}</span><span class="value">${value}</span></div>`).join('')}
        </div>
        <h4 class="report-section-title">وضعیت تکمیل داده‌ها</h4>
        ${reportTableHtml(
          ['شاخص', 'مقدار', 'وضعیت'],
          [
            ['مشاغل دارای سرپرست معتبر', fmt(jobs.filter((job) => job.supervisorJobCode && jobs.some((row) => row.jobCode === job.supervisorJobCode)).length), '—'],
            ['مشاغل بدون واحد سازمانی متصل', fmt(jobs.filter((job) => !job.unitId).length), 'نیازمند تکمیل'],
            ['مشاغل بدون ارزیابی', fmt(jobs.length - evaluated), 'نیازمند تکمیل'],
            ['کارکنان بدون گروه شغلی', fmt(unassigned), 'نیازمند تکمیل'],
            ['کارکنان بدون قرارداد ثبت‌شده', fmt(employees.filter((employee) => !employee.contractType).length), '—'],
          ],
        )}
        <h4 class="report-section-title">توزیع مشاغل بر اساس واحد</h4>
        ${reportTableHtml(
          ['واحد', 'تعداد شغل', 'نیروی مصوب', 'نیروی فعلی'],
          unitsTreeOrder(workshopUnits()).map(({ unit }) => {
            const unitJobs = jobs.filter((job) => job.unitId === unit.id);
            return [unit.title, fmt(unitJobs.length), fmt(unit.approvedHeadcount ?? 0), fmt(unitJobs.reduce((sum, job) => sum + Number(job.headcount || 0), 0))];
          }),
        )}`;
      return {
        title: 'گزارش جامع کارگاه',
        subtitle: `${workshop.workshopName} — ارزیابی، ساختار و نیروی انسانی`,
        columns: ['شاخص', 'مقدار', 'وضعیت'],
        rows: cards,
        html,
      };
    }
  }
}

function buildReport() {
  const workshop = activeWorkshop();
  const message = document.getElementById('rp-msg');
  if (!workshop) {
    if (message) message.textContent = 'ابتدا یک کارگاه انتخاب کنید.';
    return;
  }
  const type = selectValue(document.getElementById('rp-type'), 'JOBS_LIST');
  const period = selectValue(document.getElementById('rp-period'), '1405-01');
  const employeeId = selectValue(document.getElementById('rp-employee'), '');
  const unitId = selectValue(document.getElementById('rp-unit'), '');
  reportState.type = type;
  reportState.period = period;
  reportState.employeeId = employeeId;
  reportState.unitId = unitId;

  const content = buildReportContent({ type, period, employeeId, unitId, workshop });
  reportState.columns = content.columns ?? [];
  reportState.rows = content.rows ?? [];
  reportState.title = content.title;

  const sheet = document.getElementById('rp-sheet');
  const letterhead = document.getElementById('rp-letterhead');
  const body = document.getElementById('rp-body');
  const footer = document.getElementById('rp-footer');
  if (!sheet || !letterhead || !body) return;
  sheet.hidden = false;
  const reportNo = `${period.replace('-', '')}/${String(REPORT_TYPES.findIndex((row) => row.code === type) + 1).padStart(2, '0')}`;
  letterhead.innerHTML = `
    <div class="report-brand">
      <strong>${escapeHtml(workshop.companyName || workshop.workshopName)}</strong>
      <span>${escapeHtml(workshop.workshopName)} — کد کارگاه ${escapeHtml(workshop.workshopCode)}</span>
      <span class="small muted">شناسه ملی: ${escapeHtml(workshop.nationalId || '—')} — واحد پول: ریال (IRR)</span>
    </div>
    <div class="report-head-meta">
      <strong>${escapeHtml(content.title)}</strong>
      <span>شماره گزارش: <span dir="ltr">${escapeHtml(localizeDigits(reportNo))}</span></span>
      <span>تاریخ گزارش: ${escapeHtml(localizeDigits(todayJalali()))}</span>
    </div>`;
  body.innerHTML = `
    <div class="report-subtitle">${escapeHtml(content.subtitle ?? '')}</div>
    ${content.html ?? reportTableHtml(content.columns ?? [], content.rows ?? [])}
    ${reportState.rows.length === 0 && !content.html ? '<p class="muted">داده‌ای برای این گزارش وجود ندارد.</p>' : ''}`;
  if (footer) {
    footer.textContent = `تولیدشده در سامانه جامع ارزیابی و طبقه‌بندی مشاغل — ${fmt(reportState.rows.length)} ردیف داده — داده محلی (بدون Backend)`;
  }
  if (message) {
    message.textContent = `گزارش «${content.title}» با ${fmt(reportState.rows.length)} ردیف ساخته شد.`;
    message.dataset.state = 'ok';
  }
  logActivity('reports', 'CREATE', `ساخت گزارش «${content.title}» با ${reportState.rows.length} ردیف`);
  sheet.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function exportReportCsv() {
  if (!reportState.columns || reportState.columns.length === 0 || !reportState.rows.length) {
    showToast('ابتدا گزارشی با جدول داده بسازید.');
    return false;
  }
  const lines = [
    reportState.columns.map((column) => `"${column}"`).join(','),
    ...reportState.rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ];
  const ok = downloadTextFile(`report-${reportState.type}.csv`, lines.join('\r\n'), 'text/csv;charset=utf-8');
  if (ok) showToast('خروجی Excel (CSV) گزارش آماده شد');
  return ok;
}

function buildComparison() {
  const message = document.getElementById('cmp-msg');
  const select = document.getElementById('cmp-jobs');
  const ids = [...(select?.options ?? [])]
    .filter((option) => option.selected || option.hasAttribute('selected'))
    .map((option) => option.getAttribute('value'));
  const jobs = ids.map((id) => jobById(id)).filter(Boolean);
  if (jobs.length < 2) {
    if (message) message.textContent = 'برای مقایسه، حداقل دو شغل را انتخاب کنید.';
    return;
  }
  if (jobs.length > 5) {
    if (message) message.textContent = 'حداکثر ۵ شغل قابل مقایسه است.';
    return;
  }
  if (message) message.textContent = '';

  const criteria = COMPARE_CRITERIA.map((criterion) => {
    const values = jobs.map((job) => compareValue(job, criterion.code));
    const normalized = values.map((value) => Math.max(0, Math.min(100, (value / criterion.max) * 100)));
    return { ...criterion, values, normalized, spread: Math.max(...values) - Math.min(...values) };
  });

  renderRadar(jobs, criteria);
  renderCompareTable(jobs, criteria);
  showToast(`مقایسه ${fmt(jobs.length)} شغل ساخته شد`);
}

function renderRadar(jobs, criteria) {
  const container = document.getElementById('cmp-chart');
  const legend = document.getElementById('cmp-legend');
  if (!container) return;
  const size = 360;
  const center = size / 2;
  const radius = 118;
  const angleFor = (index) => (-90 + (360 / criteria.length) * index) * (Math.PI / 180);
  const pointFor = (index, value) => {
    const angle = angleFor(index);
    const distance = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [center + distance * Math.cos(angle), center + distance * Math.sin(angle)];
  };

  const rings = [25, 50, 75, 100]
    .map((ratio) => {
      const points = criteria
        .map((_, index) => pointFor(index, ratio).map((value) => value.toFixed(1)).join(','))
        .join(' ');
      return `<polygon class="radar-ring" points="${points}" />`;
    })
    .join('');

  const axes = criteria
    .map((criterion, index) => {
      const [x, y] = pointFor(index, 100);
      const [labelX, labelY] = pointFor(index, 128);
      return `<line class="radar-axis" x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />
        <text class="radar-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${escapeHtml(criterion.short)}</text>`;
    })
    .join('');

  const polygons = jobs
    .map((job, jobIndex) => {
      const points = criteria
        .map((criterion, index) => pointFor(index, criterion.normalized[jobIndex]).map((value) => value.toFixed(1)).join(','))
        .join(' ');
      return `<polygon class="radar-series radar-series-${jobIndex}" style="stroke:${RADAR_COLORS[jobIndex % RADAR_COLORS.length]};fill:${RADAR_COLORS[jobIndex % RADAR_COLORS.length]}22" points="${points}" />`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="نمودار رادار مقایسه مشاغل">
    ${rings}${axes}${polygons}
  </svg>`;
  if (legend) {
    legend.innerHTML = jobs
      .map(
        (job, index) => `<span class="cmp-legend-item">
          <i style="background:${RADAR_COLORS[index % RADAR_COLORS.length]}"></i>
          ${escapeHtml(job.title)} (${escapeHtml(job.jobCode)})
        </span>`,
      )
      .join('');
  }
}

function renderCompareTable(jobs, criteria) {
  const table = document.getElementById('cmp-table');
  if (!table) return;
  table.innerHTML = `
    <thead>
      <tr>
        <th>معیار (سقف)</th>
        ${jobs.map((job, index) => `<th><span class="cmp-head" style="border-color:${RADAR_COLORS[index % RADAR_COLORS.length]}">${escapeHtml(job.title)}</span></th>`).join('')}
        <th>اختلاف</th>
      </tr>
    </thead>
    <tbody>
      ${criteria
        .map(
          (criterion) => `<tr>
            <td>${escapeHtml(criterion.title)} <span class="small muted">(${fmt(criterion.max)})</span></td>
            ${criterion.values
              .map(
                (value, index) => `<td class="num">
                  <strong>${fmt(value, value % 1 === 0 ? 0 : 1)}</strong>
                  <div class="small muted">${fmt(criterion.normalized[index], 0)}٪ از سقف</div>
                </td>`,
              )
              .join('')}
            <td class="num">${fmt(criterion.spread, criterion.spread % 1 === 0 ? 0 : 1)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;
}


/* ======================= امنیت، نقش‌ها و گزارش فعالیت ======================= */

const AUTH_KEY = 'mashaqel.auth.v1';
const SESSION_KEY = 'mashaqel.session.v1';
const SESSION_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const ACTIVITY_LIMIT = 400;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z\u0600-\u06FF])(?=.*\d).{8,64}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,20}$/;

const ROLE_LABELS = {
  ADMIN: 'مدیر سامانه',
  EXPERT: 'کارشناس طبقه‌بندی',
  PAYROLL: 'کارشناس حقوق و دستمزد',
  VIEWER: 'بازدیدکننده',
};

const ROLE_MODULES = {
  ADMIN: ['dashboard', 'workshops', 'org', 'jobs', 'job-profile', 'evaluation', 'group', 'employees', 'payroll', 'arrears', 'reports', 'settings', 'users'],
  EXPERT: ['dashboard', 'workshops', 'org', 'jobs', 'job-profile', 'evaluation', 'group', 'reports', 'settings'],
  PAYROLL: ['dashboard', 'employees', 'payroll', 'arrears', 'reports', 'settings'],
  VIEWER: ['dashboard', 'jobs', 'job-profile', 'group', 'reports'],
};

const ROLE_WRITE = {
  ADMIN: ['workshops', 'org', 'jobs', 'evaluation', 'approval', 'employees', 'payroll', 'arrears', 'reports', 'settings', 'users'],
  EXPERT: ['org', 'jobs', 'evaluation', 'approval', 'reports'],
  PAYROLL: ['employees', 'payroll', 'arrears', 'reports'],
  VIEWER: [],
};

const ACTIVITY_ACTION_LABELS = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  APPROVE: 'تأیید',
  REOPEN: 'بازگشت به انتظار تأیید',
  COMPUTE: 'محاسبه',
  EXPORT: 'خروجی',
  IMPORT: 'ورود گروهی',
  BACKUP: 'پشتیبان‌گیری',
  RESTORE: 'بازیابی',
  CLEAR: 'پاک‌سازی',
  DENIED: 'رد دسترسی',
  SETUP: 'راه‌اندازی',
  PROMOTE: 'ارتقا/تغییر شغل',
};

const MODULE_LABELS = {
  security: 'امنیت',
  workshops: 'کارگاه‌ها',
  org: 'ساختار سازمانی',
  jobs: 'بانک مشاغل',
  approval: 'تأیید گروه',
  employees: 'کارکنان',
  payroll: 'حقوق ماهانه',
  arrears: 'معوقات',
  reports: 'گزارش‌ها',
  settings: 'تنظیمات',
  users: 'کاربران',
};

const authState = { user: null };
let activityFilter = '';

/* ---------------------- سرور مرکزی (فاز ۱۱) ---------------------- */

const BACKEND_KEY = 'mashaqel.backend.v1';
const BACKEND_TOKEN_KEY = 'mashaqel.backend.token';
const backendState = { mode: 'local', base: './api', token: null, health: null, users: [], verified: null, lastError: '', status: null, sso: null };
const SYNC_KEY = 'mashaqel.sync.v1';
const syncState = { version: 0, at: null };

function backendBase() {
  try {
    const saved = JSON.parse(localStorage.getItem(BACKEND_KEY) ?? 'null');
    if (saved?.base) return String(saved.base).replace(/\/+$/, '');
  } catch {
    /* پیکربندی نامعتبر */
  }
  return backendState.base;
}

function saveBackendConfig(base) {
  backendState.base = base;
  try {
    localStorage.setItem(BACKEND_KEY, JSON.stringify({ base }));
  } catch {
    /* ذخیره‌سازی محلی در دسترس نیست */
  }
}

function readBackendToken() {
  try {
    return sessionStorage.getItem(BACKEND_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeBackendToken(token) {
  backendState.token = token || null;
  try {
    if (token) sessionStorage.setItem(BACKEND_TOKEN_KEY, token);
    else sessionStorage.removeItem(BACKEND_TOKEN_KEY);
  } catch {
    /* sessionStorage در دسترس نیست */
  }
}

async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth && backendState.token) headers.authorization = `Bearer ${backendState.token}`;
  const response = await fetch(`${backendBase()}${path}`, {
    method,
    headers,
    cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload = {};
  try {
    const raw = await response.text();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.message ?? `خطای سرور (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
}

async function detectBackend() {
  backendState.mode = 'local';
  backendState.health = null;
  try {
    const response = await fetch(`${backendBase()}/health`, { cache: 'no-store' });
    if (!response.ok) return false;
    const payload = await response.json();
    if (payload?.service !== 'mashaqel-backend') return false;
    backendState.mode = 'server';
    backendState.health = payload;
    return true;
  } catch (error) {
    backendState.lastError = error?.message ?? '';
    return false;
  }
}

function mapServerUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    workshopIds: user.workshopIds ?? [],
    active: user.active !== false,
    createdAt: user.createdAt ?? new Date().toISOString(),
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

async function refreshServerStatus() {
  if (backendState.mode !== 'server') return null;
  try {
    backendState.status = await apiFetch('/auth/status', { auth: false });
    return backendState.status;
  } catch {
    return null;
  }
}

async function loadSsoStatus() {
  if (backendState.mode !== 'server') {
    backendState.sso = null;
    renderSsoUi();
    return null;
  }
  try {
    backendState.sso = await apiFetch('/auth/sso/status', { auth: false });
  } catch {
    backendState.sso = null;
  }
  renderSsoUi();
  return backendState.sso;
}

function renderSsoUi() {
  const row = document.getElementById('sso-row');
  const button = document.getElementById('sso-login');
  const note = document.getElementById('sso-note');
  if (!row || !button) return;
  const sso = backendState.sso;
  const enabled = backendState.mode === 'server' && Boolean(sso?.enabled);
  row.hidden = !enabled;
  const localFields = document.querySelectorAll('#auth-login input, #auth-login button[type="submit"]');
  const localDisabled = enabled && sso?.localLogin === false;
  localFields.forEach((element) => {
    element.hidden = localDisabled;
  });
  if (!enabled) {
    if (note) note.textContent = '';
    return;
  }
  button.textContent = sso.provider ? `ورود با ${sso.provider}` : 'ورود با حساب سازمانی';
  if (note) {
    note.textContent = localDisabled
      ? 'ورود با رمز محلی در این نصب غیرفعال است؛ فقط از حساب سازمانی استفاده کنید.'
      : 'با حساب سازمانی (SSO) وارد شوید؛ نقش و دسترسی به‌صورت خودکار از سرویس هویت گرفته می‌شود.';
  }
}

function startSsoLogin() {
  if (backendState.mode !== 'server') {
    showToast('ورود سازمانی فقط در حالت سرور در دسترس است.');
    return;
  }
  const redirect = encodeURIComponent(window.location?.pathname || '/');
  try {
    window.location.href = `${backendBase()}/auth/sso/start?redirect=${redirect}`;
  } catch {
    showToast('انتقال به سرویس هویت ممکن نشد.');
  }
}

async function handleSsoCallback() {
  if (backendState.mode !== 'server') return false;
  let params;
  try {
    params = new URLSearchParams(window.location?.search ?? '');
  } catch {
    return false;
  }
  const code = params.get('sso');
  if (!code) return false;
  try {
    const payload = await apiFetch('/auth/sso/exchange', { method: 'POST', auth: false, body: { code } });
    writeBackendToken(payload.token);
    authState.user = mapServerUser(payload.user);
    hideAuthGate();
    startApp();
    await refreshServerUsers();
    renderUsersTable();
    renderBackendPanel();
    const next = params.get('next');
    const route = String(next ?? '').replace(/^\//, '');
    if (route && ROUTES[route]) navigate(route);
    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('sso');
      clean.searchParams.delete('next');
      window.history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
    } catch {
      /* پاک‌سازی نشانی ممکن نیست */
    }
    showToast(`خوش آمدید، ${payload.user.fullName}`);
    return true;
  } catch (error) {
    showAuthGate('login');
    const message = document.getElementById('auth-login-msg');
    if (message) message.textContent = error.message;
    return false;
  }
}

async function refreshServerUsers() {
  if (backendState.mode !== 'server' || !backendState.token) return [];
  try {
    const payload = await apiFetch('/users');
    backendState.users = (payload.users ?? []).map(mapServerUser);
  } catch {
    backendState.users = [];
  }
  return backendState.users;
}

function currentUsers() {
  return backendState.mode === 'server' ? backendState.users : authUsers();
}

/* ---------------------- همگام‌سازی چنددستگاهی (فاز ۱۲) ---------------------- */

function readSyncState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null');
    syncState.version = Number(saved?.version ?? 0);
    syncState.at = saved?.at ?? null;
  } catch {
    syncState.version = 0;
    syncState.at = null;
  }
  return syncState;
}

function writeSyncState(version) {
  syncState.version = Number(version ?? 0);
  syncState.at = new Date().toISOString();
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ version: syncState.version, at: syncState.at }));
  } catch {
    /* ذخیره‌سازی محلی در دسترس نیست */
  }
  renderBackendPanel();
}

function stateSnapshot() {
  return {
    workshops: state.store.workshops ?? [],
    activeWorkshopId: state.store.activeWorkshopId ?? null,
    units: state.store.units ?? [],
    jobs: state.store.jobs ?? [],
    employees: state.store.employees ?? [],
  };
}

function applyServerState(payload, scoped) {
  if (!scoped) {
    writeStore({
      workshops: Array.isArray(payload.workshops) ? payload.workshops : [],
      activeWorkshopId: payload.activeWorkshopId ?? null,
      units: Array.isArray(payload.units) ? payload.units : [],
      jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
      employees: Array.isArray(payload.employees) ? payload.employees : [],
    });
    return;
  }
  const scope = new Set((payload.workshops ?? []).map((workshop) => workshop.id));
  const keepOutside = (rows) => (rows ?? []).filter((row) => !scope.has(row.workshopId));
  writeStore({
    workshops: [...(state.store.workshops ?? []).filter((workshop) => !scope.has(workshop.id)), ...(payload.workshops ?? [])],
    activeWorkshopId: payload.activeWorkshopId ?? state.store.activeWorkshopId ?? null,
    units: [...keepOutside(state.store.units), ...(payload.units ?? [])],
    jobs: [...keepOutside(state.store.jobs), ...(payload.jobs ?? [])],
    employees: [...keepOutside(state.store.employees), ...(payload.employees ?? [])],
  });
}

async function syncPull({ silent = false } = {}) {
  if (backendState.mode !== 'server' || !backendState.token) {
    if (!silent) setBackendNote('برای همگام‌سازی، ابتدا به سرور مرکزی متصل و وارد شوید.', 'warn');
    return false;
  }
  try {
    const result = await apiFetch('/state');
    if (!result.state) {
      if (!silent) setBackendNote('وضعیت سازمانی هنوز روی سرور ثبت نشده است؛ ابتدا از یک دستگاه «ارسال» کنید.', 'warn');
      return false;
    }
    applyServerState(result.state.payload ?? {}, Boolean(result.state.scoped));
    if (backendState.health) backendState.health.stateVersion = result.state.version;
    writeSyncState(result.state.version);
    if (!silent) {
      setBackendNote(
        `وضعیت نسخه ${fmt(result.state.version)} از سرور دریافت شد (${fmt(result.state.payload?.workshops?.length ?? 0)} کارگاه).`,
        'ok',
      );
      logActivity('settings', 'RESTORE', `دریافت وضعیت سازمان از سرور — نسخه ${result.state.version}`);
    }
    return true;
  } catch (error) {
    if (!silent) setBackendNote(`دریافت وضعیت ناموفق بود: ${error.message}`, 'error');
    return false;
  }
}

async function syncPush({ silent = false } = {}) {
  if (backendState.mode !== 'server' || !backendState.token) {
    if (!silent) setBackendNote('برای همگام‌سازی، ابتدا به سرور مرکزی متصل و وارد شوید.', 'warn');
    return false;
  }
  if (currentRole() === 'VIEWER') {
    if (!silent) setBackendNote('نقش بازدیدکننده اجازه ارسال وضعیت را ندارد.', 'warn');
    return false;
  }
  try {
    const result = await apiFetch('/state', {
      method: 'PUT',
      body: { baseVersion: syncState.version, payload: stateSnapshot() },
    });
    if (backendState.health) backendState.health.stateVersion = result.version;
    writeSyncState(result.version);
    if (!silent) {
      setBackendNote(`وضعیت سازمان به‌صورت نسخه ${fmt(result.version)} روی سرور ذخیره شد.`, 'ok');
      logActivity('settings', 'BACKUP', `ارسال وضعیت سازمان به سرور — نسخه ${result.version}`);
    }
    return true;
  } catch (error) {
    if (error.status === 409) {
      setBackendNote('نسخه سرور جلوتر است؛ ابتدا «دریافت وضعیت از سرور» را بزنید و سپس ارسال کنید.', 'warn');
      return false;
    }
    if (!silent) setBackendNote(`ارسال وضعیت ناموفق بود: ${error.message}`, 'error');
    return false;
  }
}

function webcrypto() {
  return (typeof crypto !== 'undefined' ? crypto : globalThis.crypto) ?? null;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(size = 16) {
  const bytes = new Uint8Array(size);
  const source = webcrypto();
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let index = 0; index < size; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return bytesToHex(bytes);
}

async function hashPassword(password, saltHex, iterations = 60000) {
  const source = webcrypto();
  if (!source?.subtle) throw new Error('رمزنگاری مرورگر در دسترس نیست؛ از مرورگر به‌روز استفاده کنید.');
  const encoder = new TextEncoder();
  const keyMaterial = await source.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await source.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function readAuth() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null');
    return { users: Array.isArray(parsed?.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

function writeAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ users: auth.users ?? [] }));
}

function authUsers() {
  return readAuth().users;
}

function readSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    if (!parsed?.userId) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(user) {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expiresAt, issuedAt: new Date().toISOString() }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  authState.user = null;
}

function currentUser() {
  if (authState.user) return authState.user;
  const session = readSession();
  if (!session) return null;
  const user = authUsers().find((row) => row.id === session.userId);
  if (!user || user.active === false) return null;
  authState.user = user;
  return user;
}

function currentRole() {
  return currentUser()?.role ?? null;
}

function allowedWorkshopIds() {
  const user = currentUser();
  return Array.isArray(user?.workshopIds) ? user.workshopIds : [];
}

function isWorkshopAllowed(workshopId) {
  const ids = allowedWorkshopIds();
  if (ids.length === 0) return true;
  return ids.includes(workshopId);
}

function canAccessModule(module) {
  const modules = ROLE_MODULES[currentRole()] ?? [];
  return modules.includes(module);
}

function canWrite(module) {
  const modules = ROLE_WRITE[currentRole()] ?? [];
  return modules.includes(module);
}

function logActivity(module, action, detail = '', extra = {}) {
  const user = currentUser();
  const entry = {
    at: new Date().toISOString(),
    userId: user?.id ?? extra.userId ?? null,
    username: user?.username ?? extra.username ?? 'system',
    fullName: user?.fullName ?? extra.fullName ?? 'سیستم',
    role: user?.role ?? extra.role ?? null,
    module,
    action,
    detail,
    workshopId: state.store.activeWorkshopId ?? null,
  };
  state.store = { ...state.store, activityLog: [...(state.store.activityLog ?? []), entry].slice(-ACTIVITY_LIMIT) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.store));
  } catch {
    /* ذخیره‌سازی محلی در دسترس نیست */
  }
  renderActivityLog();
  if (backendState.mode === 'server' && backendState.token && extra.mirror !== false) {
    apiFetch('/activity', {
      method: 'POST',
      body: { module: entry.module, action: entry.action, detail: entry.detail, workshopId: entry.workshopId },
    }).catch(() => {
      /* آینه‌سازی سرور اختیاری است؛ گزارش محلی از دست نمی‌رود */
    });
  }
}

function ensureWrite(module, label = '') {
  if (canWrite(module)) return true;
  showToast('دسترسی لازم برای این عملیات را ندارید.');
  logActivity(module, 'DENIED', label || `تلاش برای تغییر در ${MODULE_LABELS[module] ?? module}`);
  return false;
}

function ensureAdmin(label = '') {
  if (currentRole() === 'ADMIN') return true;
  showToast('این عملیات فقط برای مدیر سامانه مجاز است.');
  logActivity('security', 'DENIED', label || 'عملیات مدیریتی');
  return false;
}

function serverUserCount() {
  return backendState.status?.users ?? backendState.health?.users ?? 0;
}

function showAuthGate(mode) {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  const userCount = backendState.mode === 'server' ? serverUserCount() : authUsers().length;
  const setup = document.getElementById('auth-setup');
  const login = document.getElementById('auth-login');
  const wantsSetup = mode === 'setup' || userCount === 0;
  gate.hidden = false;
  document.body.classList.add('is-auth');
  if (setup) setup.hidden = !wantsSetup;
  if (login) login.hidden = wantsSetup;
  if (backendState.mode === 'server') {
    void loadSsoStatus();
    void refreshServerStatus().then((status) => {
      if (!status || gate.hidden) return;
      const setupRequired = Boolean(status.setupRequired);
      const setupForm = document.getElementById('auth-setup');
      const loginForm = document.getElementById('auth-login');
      if (setupForm) setupForm.hidden = !setupRequired;
      if (loginForm) loginForm.hidden = setupRequired;
    });
  }
}

function hideAuthGate() {
  const gate = document.getElementById('auth-gate');
  if (gate) gate.hidden = true;
  document.body.classList.remove('is-auth');
}

function bindAuthForms() {
  const setupForm = document.getElementById('auth-setup');
  if (setupForm) {
    setupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await createFirstAdmin();
    });
  }
  const loginForm = document.getElementById('auth-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await loginWithForm();
    });
  }
  const logout = document.getElementById('logout-btn');
  if (logout) logout.addEventListener('click', () => logoutCurrentUser());
  const ssoLogin = document.getElementById('sso-login');
  if (ssoLogin) ssoLogin.addEventListener('click', () => startSsoLogin());
}

async function createFirstAdmin() {
  const message = document.getElementById('auth-setup-msg');
  const name = document.getElementById('au-name').value.trim();
  const username = document.getElementById('au-username').value.trim();
  const password = document.getElementById('au-password').value;
  const confirm = document.getElementById('au-password2').value;
  const problems = [];
  if (!name) problems.push('نام و نام خانوادگی الزامی است.');
  if (!USERNAME_PATTERN.test(username)) problems.push('نام کاربری باید ۳ تا ۲۰ نویسه لاتین، رقم، نقطه، خط تیره یا زیرخط باشد.');
  if (!PASSWORD_PATTERN.test(password)) problems.push('رمز عبور حداقل ۸ نویسه و شامل حرف و رقم باشد.');
  if (password !== confirm) problems.push('تکرار رمز عبور مطابقت ندارد.');
  const existingUsers = backendState.mode === 'server' ? serverUserCount() : readAuth().users.length;
  if (existingUsers > 0) problems.push('حساب مدیر قبلاً ساخته شده است.');
  if (problems.length > 0) {
    if (message) message.textContent = problems.join(' ');
    return;
  }
  if (backendState.mode === 'server') {
    try {
      const payload = await apiFetch('/auth/setup', { method: 'POST', auth: false, body: { fullName: name, username, password } });
      writeBackendToken(payload.token);
      authState.user = mapServerUser(payload.user);
      hideAuthGate();
      startApp();
      await refreshServerStatus();
      await refreshServerUsers();
      renderUsersTable();
      renderBackendPanel();
      if ((state.store.workshops ?? []).length === 0) void syncPull({ silent: true });
      if (message) message.textContent = '';
    } catch (error) {
      if (message) message.textContent = error.message;
    }
    return;
  }
  try {
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    const user = {
      id: newId('user'),
      fullName: name,
      username,
      role: 'ADMIN',
      workshopIds: [],
      active: true,
      password: { salt, hash, iterations: 60000, algo: 'PBKDF2-SHA256' },
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    };
    writeAuth({ users: [user] });
    const users = readAuth().users;
    writeAuth({ users });
    writeSession(user);
    authState.user = user;
    hideAuthGate();
    startApp();
    logActivity('security', 'SETUP', `ساخت حساب مدیر سامانه: ${username}`);
    if (message) message.textContent = '';
  } catch (error) {
    if (message) message.textContent = `ساخت حساب ناموفق بود: ${error.message}`;
  }
}

async function loginWithForm() {
  const message = document.getElementById('auth-login-msg');
  const username = document.getElementById('al-username').value.trim();
  const password = document.getElementById('al-password').value;
  if (backendState.mode === 'server') {
    try {
      const payload = await apiFetch('/auth/login', { method: 'POST', auth: false, body: { username, password } });
      writeBackendToken(payload.token);
      authState.user = mapServerUser(payload.user);
      hideAuthGate();
      document.getElementById('al-password').value = '';
      if (message) message.textContent = '';
      startApp();
      await refreshServerUsers();
      renderUsersTable();
      renderBackendPanel();
      applyAccessControl();
      showToast(`خوش آمدید، ${payload.user.fullName}`);
    } catch (error) {
      const text = error.status === 423 ? error.message : error.message;
      if (message) message.textContent = text;
    }
    return;
  }
  const users = authUsers();
  const user = users.find((row) => row.username.toLowerCase() === username.toLowerCase());
  const fail = (text) => {
    if (message) message.textContent = text;
  };
  if (!user) {
    fail('نام کاربری یا رمز عبور نادرست است.');
    logActivity('security', 'DENIED', `تلاش ورود ناموفق با نام کاربری «${username}»`, { username });
    return;
  }
  if (user.active === false) {
    fail('این حساب غیرفعال شده است. با مدیر سامانه تماس بگیرید.');
    logActivity('security', 'DENIED', `تلاش ورود به حساب غیرفعال «${username}»`, { username, userId: user.id });
    return;
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    fail('حساب به دلیل تلاش‌های ناموفق موقتاً قفل شده است؛ چند دقیقه بعد تلاش کنید.');
    return;
  }
  try {
    const hash = await hashPassword(password, user.password.salt, user.password.iterations);
    if (hash !== user.password.hash) {
      const failedAttempts = Number(user.failedAttempts ?? 0) + 1;
      const lockedUntil = failedAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;
      writeAuth({ users: users.map((row) => (row.id === user.id ? { ...row, failedAttempts, lockedUntil } : row)) });
      fail(
        lockedUntil
          ? `رمز نادرست است؛ حساب برای ${fmt(LOCK_MINUTES)} دقیقه قفل شد.`
          : `نام کاربری یا رمز عبور نادرست است. (${fmt(failedAttempts)} از ${fmt(MAX_LOGIN_ATTEMPTS)})`,
      );
      logActivity('security', 'DENIED', `رمز نادرست برای «${username}»`, { username, userId: user.id });
      return;
    }
    const updated = { ...user, failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() };
    writeAuth({ users: users.map((row) => (row.id === user.id ? updated : row)) });
    authState.user = updated;
    writeSession(updated);
    hideAuthGate();
    startApp();
    document.getElementById('al-password').value = '';
    if (message) message.textContent = '';
    logActivity('security', 'LOGIN', `ورود موفق ${updated.fullName} (${ROLE_LABELS[updated.role]})`);
    applyAccessControl();
    showToast(`خوش آمدید، ${updated.fullName}`);
  } catch (error) {
    fail(`ورود ناموفق بود: ${error.message}`);
  }
}

function logoutCurrentUser() {
  const user = currentUser();
  if (user && backendState.mode !== 'server') logActivity('security', 'LOGOUT', `خروج ${user.fullName}`);
  if (backendState.mode === 'server' && backendState.token) {
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => {
      /* حتی اگر سرور پاسخ ندهد، نشست محلی بسته می‌شود */
    });
    writeBackendToken('');
    backendState.users = [];
    backendState.verified = null;
  }
  clearSession();
  applyAccessControl();
  showAuthGate('login');
  const chip = document.getElementById('user-chip');
  if (chip) chip.textContent = '';
  showToast('از حساب خارج شدید');
}

function refreshScopedViews() {
  if (!state.started) return;
  renderWorkshopPicker();
  renderWorkshopTable();
  renderJobsView();
  renderEmployeesView();
  renderDashboard();
  renderEvalJobOptions();
  renderGroupJobsComparison();
  renderOrgView();
}

function applyAccessControl() {
  const role = currentRole();
  const scoped = state.store.workshops.filter((row) => isWorkshopAllowed(row.id));
  if (state.store.activeWorkshopId && !scoped.some((row) => row.id === state.store.activeWorkshopId)) {
    state.store = { ...state.store, activeWorkshopId: scoped[0]?.id ?? null };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.store));
    } catch {
      /* ذخیره‌سازی محلی در دسترس نیست */
    }
  }
  const modules = ROLE_MODULES[role] ?? [];
  document.querySelectorAll('.nav-item').forEach((item) => {
    const route = item.dataset.route;
    const allowed = modules.includes(route);
    if (!allowed) {
      item.disabled = true;
      item.setAttribute('title', `نقش «${ROLE_LABELS[role] ?? role}» به این ماژول دسترسی ندارد`);
    } else {
      item.disabled = false;
      item.removeAttribute('title');
    }
  });
  const user = currentUser();
  const chip = document.getElementById('user-chip');
  if (chip && user) chip.textContent = `${user.fullName} — ${ROLE_LABELS[user.role] ?? user.role}`;
  document.body.classList.toggle('is-readonly', (ROLE_WRITE[role] ?? []).length === 0);
  if (state.started) refreshScopedViews();
}

function applyRouteAccess(route) {
  if (!currentUser()) return;
  if (route !== 'job-profile' && !canAccessModule(route)) {
    showToast('دسترسی به این ماژول برای نقش شما مجاز نیست.');
    const target = ROLE_MODULES[currentRole()]?.[0] ?? 'dashboard';
    if (route !== target) navigate(target);
  }
}

/* --------------------------- گزارش فعالیت --------------------------- */

function activityRows() {
  const search = activityFilter.toLowerCase();
  const rows = [...(state.store.activityLog ?? [])].reverse();
  if (!search) return rows;
  return rows.filter((row) =>
    `${row.username} ${row.fullName} ${row.module} ${row.action} ${row.detail}`.toLowerCase().includes(search),
  );
}

function renderActivityLog() {
  const table = document.getElementById('activity-table');
  if (!table) return;
  const counter = document.getElementById('activity-count');
  const rows = activityRows().slice(0, 200);
  if (counter) counter.textContent = `${fmt(rows.length)} رویداد`;
  if (rows.length === 0) {
    table.innerHTML = '<tbody><tr><td><div class="empty-state">رویدادی ثبت نشده است.</div></td></tr></tbody>';
    return;
  }
  table.innerHTML = `
    <thead><tr><th>زمان</th><th>کاربر</th><th>نقش</th><th>ماژول</th><th>اقدام</th><th>جزئیات</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            <td class="small">${escapeHtml(localizeDigits(new Date(row.at).toLocaleString('fa-IR')))}</td>
            <td>${escapeHtml(row.fullName)}<div class="small muted" dir="ltr">${escapeHtml(row.username)}</div></td>
            <td>${escapeHtml(ROLE_LABELS[row.role] ?? row.role ?? '—')}</td>
            <td>${escapeHtml(MODULE_LABELS[row.module] ?? row.module ?? '—')}</td>
            <td>${escapeHtml(ACTIVITY_ACTION_LABELS[row.action] ?? row.action ?? '—')}</td>
            <td class="small">${escapeHtml(row.detail ?? '')}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;
}

function exportActivityCsv() {
  const rows = activityRows();
  if (rows.length === 0) {
    showToast('رویدادی برای خروجی وجود ندارد.');
    return false;
  }
  const lines = [
    ['at', 'username', 'fullName', 'role', 'module', 'action', 'detail', 'workshopId'].join(','),
    ...rows.map((row) =>
      [row.at, row.username, row.fullName, row.role, row.module, row.action, row.detail, row.workshopId]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];
  const ok = downloadTextFile('activity-log.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
  if (ok) {
    logActivity('security', 'EXPORT', 'خروجی گزارش فعالیت');
    showToast('گزارش فعالیت خروجی گرفته شد');
  }
  return ok;
}

/* ---------------------------- کاربران ---------------------------- */

function initUsers() {
  const newButton = document.getElementById('user-new');
  if (newButton) newButton.addEventListener('click', () => openUserForm(null));
  const form = document.getElementById('user-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveUserFromForm();
    });
  }
  for (const id of ['user-cancel', 'user-cancel-2']) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => closeUserForm());
  }
  const table = document.getElementById('users-table');
  if (table) {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-user-action]');
      if (!button) return;
      const user = authUsers().find((row) => row.id === button.dataset.id);
      if (!user) return;
      if (button.dataset.userAction === 'edit') openUserForm(user);
      if (button.dataset.userAction === 'delete') deleteUser(user);
    });
  }
  const exportButton = document.getElementById('activity-export');
  if (exportButton) exportButton.addEventListener('click', () => exportActivityCsv());
  const refresh = document.getElementById('activity-refresh');
  if (refresh) refresh.addEventListener('click', () => renderActivityLog());
  const search = document.getElementById('activity-search');
  if (search) {
    search.addEventListener('input', () => {
      activityFilter = search.value.trim();
      renderActivityLog();
    });
  }
  renderUsersView();
}

function renderUsersView() {
  renderUsersTable();
  renderActivityLog();
  if (backendState.mode === 'server' && backendState.token) {
    void refreshServerUsers().then(() => {
      renderUsersTable();
      renderBackendPanel();
    });
  }
}

function renderUsersTable() {
  const table = document.getElementById('users-table');
  if (!table) return;
  const users = currentUsers();
  const counter = document.getElementById('users-count');
  if (counter) counter.textContent = `${fmt(users.length)} کاربر`;
  if (users.length === 0) {
    table.innerHTML = '<tbody><tr><td><div class="empty-state">کاربری ثبت نشده است.</div></td></tr></tbody>';
    return;
  }
  const me = currentUser();
  table.innerHTML = `
    <thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>کارگاه‌های مجاز</th><th>وضعیت</th><th>آخرین ورود</th><th>عملیات</th></tr></thead>
    <tbody>
      ${users
        .map((user) => {
          const scope = (user.workshopIds ?? []).length === 0
            ? 'همه کارگاه‌ها'
            : user.workshopIds.map((id) => state.store.workshops.find((row) => row.id === id)?.workshopName ?? id).join('، ');
          return `<tr>
            <td>${escapeHtml(user.fullName)}${me?.id === user.id ? ' <span class="chip st-1">شما</span>' : ''}</td>
            <td dir="ltr">${escapeHtml(user.username)}</td>
            <td>${escapeHtml(ROLE_LABELS[user.role] ?? user.role)}</td>
            <td class="small">${escapeHtml(scope)}</td>
            <td>${user.active === false ? '<span class="chip neutral">غیرفعال</span>' : '<span class="chip st-1">فعال</span>'}</td>
            <td class="small">${user.lastLoginAt ? escapeHtml(localizeDigits(new Date(user.lastLoginAt).toLocaleString('fa-IR'))) : '—'}</td>
            <td class="actions-cell">
              <button type="button" class="icon-btn" data-user-action="edit" data-id="${escapeHtml(user.id)}" title="ویرایش">✎</button>
              <button type="button" class="icon-btn" data-user-action="delete" data-id="${escapeHtml(user.id)}" title="حذف">✕</button>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

function openUserForm(user) {
  if (!ensureAdmin('مدیریت کاربران')) return;
  const form = document.getElementById('user-form');
  if (!form) return;
  form.hidden = false;
  const title = document.getElementById('user-form-title');
  if (title) title.textContent = user ? `ویرایش کاربر ${user.username}` : 'کاربر جدید';
  setElementValue(document.getElementById('uf-id'), user?.id ?? '');
  setElementValue(document.getElementById('uf-name'), user?.fullName ?? '');
  setElementValue(document.getElementById('uf-username'), user?.username ?? '');
  setElementValue(document.getElementById('uf-role'), user?.role ?? 'EXPERT');
  setElementValue(document.getElementById('uf-active'), user?.active === false ? 'INACTIVE' : 'ACTIVE');
  setElementValue(document.getElementById('uf-password'), '');
  const workshops = document.getElementById('uf-workshops');
  if (workshops) {
    workshops.innerHTML = state.store.workshops
      .map((workshop) => `<option value="${escapeHtml(workshop.id)}">${escapeHtml(workshop.workshopName)} — ${escapeHtml(workshop.workshopCode)}</option>`)
      .join('');
    const selected = new Set(user?.workshopIds ?? []);
    for (const option of workshops.options ?? []) {
      const isSelected = selected.has(option.getAttribute('value'));
      option.selected = isSelected;
      if (isSelected) option.setAttribute('selected', 'selected');
    }
  }
  const error = document.getElementById('user-error');
  if (error) error.textContent = '';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeUserForm() {
  const form = document.getElementById('user-form');
  if (form) form.hidden = true;
  const error = document.getElementById('user-error');
  if (error) error.textContent = '';
}

async function saveUserFromForm() {
  if (!ensureAdmin('ذخیره کاربر')) return;
  const errorTarget = document.getElementById('user-error');
  const id = document.getElementById('uf-id').value;
  const users = currentUsers();
  const existing = id ? users.find((row) => row.id === id) : null;
  const fullName = document.getElementById('uf-name').value.trim();
  const username = document.getElementById('uf-username').value.trim();
  const role = selectValue(document.getElementById('uf-role'), 'EXPERT');
  const active = selectValue(document.getElementById('uf-active'), 'ACTIVE') === 'ACTIVE';
  const password = document.getElementById('uf-password').value;
  const workshopsSelect = document.getElementById('uf-workshops');
  const workshopIds = [...(workshopsSelect?.options ?? [])]
    .filter((option) => option.selected || option.hasAttribute('selected'))
    .map((option) => option.getAttribute('value'));

  const problems = [];
  if (!fullName) problems.push('نام و نام خانوادگی الزامی است.');
  if (!USERNAME_PATTERN.test(username)) problems.push('نام کاربری باید ۳ تا ۲۰ نویسه لاتین، رقم، نقطه، خط تیره یا زیرخط باشد.');
  if (users.some((row) => row.id !== existing?.id && row.username.toLowerCase() === username.toLowerCase())) {
    problems.push('این نام کاربری قبلاً ثبت شده است.');
  }
  if (!existing && !PASSWORD_PATTERN.test(password)) problems.push('رمز عبور حداقل ۸ نویسه و شامل حرف و رقم باشد.');
  if (existing && password && !PASSWORD_PATTERN.test(password)) problems.push('رمز جدید حداقل ۸ نویسه و شامل حرف و رقم باشد.');
  if (!ROLE_LABELS[role]) problems.push('نقش انتخاب‌شده معتبر نیست.');
  const admins = users.filter((row) => row.role === 'ADMIN' && row.active !== false);
  if (existing?.role === 'ADMIN' && (role !== 'ADMIN' || !active) && admins.length <= 1) {
    problems.push('حداقل یک مدیر فعال باید باقی بماند.');
  }
  if (problems.length > 0) {
    if (errorTarget) errorTarget.textContent = problems.join(' ');
    return;
  }

  if (backendState.mode === 'server') {
    const payload = { fullName, username, role, active, workshopIds, ...(password ? { password } : {}) };
    try {
      if (existing) await apiFetch(`/users/${existing.id}`, { method: 'PATCH', body: payload });
      else await apiFetch('/users', { method: 'POST', body: payload });
      closeUserForm();
      await refreshServerUsers();
      renderUsersTable();
      logActivity('users', existing ? 'UPDATE' : 'CREATE', `${existing ? 'ویرایش' : 'ایجاد'} کاربر «${username}» با نقش ${ROLE_LABELS[role]}`);
      showToast(existing ? 'کاربر به‌روزرسانی شد' : 'کاربر جدید ثبت شد');
    } catch (error) {
      if (errorTarget) errorTarget.textContent = error.message;
    }
    return;
  }

  const base = existing ?? {
    id: newId('user'),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    password: null,
  };
  let passwordField = base.password;
  if (password || !existing) {
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    passwordField = { salt, hash, iterations: 60000, algo: 'PBKDF2-SHA256' };
  }
  const user = {
    ...base,
    fullName,
    username,
    role,
    active,
    workshopIds,
    password: passwordField,
  };
  const nextUsers = existing ? users.map((row) => (row.id === user.id ? user : row)) : [...users, user];
  writeAuth({ users: nextUsers });
  if (authState.user?.id === user.id) authState.user = user;
  closeUserForm();
  renderUsersTable();
  logActivity('users', existing ? 'UPDATE' : 'CREATE', `${existing ? 'ویرایش' : 'ایجاد'} کاربر «${username}» با نقش ${ROLE_LABELS[role]}`);
  showToast(existing ? 'کاربر به‌روزرسانی شد' : 'کاربر جدید ثبت شد');
}

function deleteUser(user) {
  if (!ensureAdmin('حذف کاربر')) return;
  const me = currentUser();
  if (me?.id === user.id) {
    showToast('حذف حساب جاری مجاز نیست.');
    return;
  }
  const users = currentUsers();
  const admins = users.filter((row) => row.role === 'ADMIN' && row.active !== false);
  if (user.role === 'ADMIN' && admins.length <= 1) {
    showToast('حذف آخرین مدیر سامانه مجاز نیست.');
    return;
  }
  const confirmed = typeof window.confirm === 'function' ? window.confirm(`حذف کاربر «${user.username}»؟`) : true;
  if (!confirmed) return;
  if (backendState.mode === 'server') {
    apiFetch(`/users/${user.id}`, { method: 'DELETE' })
      .then(async () => {
        await refreshServerUsers();
        renderUsersTable();
        logActivity('users', 'DELETE', `حذف کاربر «${user.username}»`);
        showToast('کاربر حذف شد');
      })
      .catch((error) => showToast(error.message));
    return;
  }
  writeAuth({ users: users.filter((row) => row.id !== user.id) });
  renderUsersTable();
  logActivity('users', 'DELETE', `حذف کاربر «${user.username}»`);
  showToast('کاربر حذف شد');
}


/* ---------------------- پنل سرور مرکزی (فاز ۱۱) ---------------------- */

function setBackendNote(message, tone = '') {
  const note = document.getElementById('backend-note');
  if (!note) return;
  note.textContent = message;
  note.dataset.tone = tone;
}

function renderBackendPanel() {
  const server = backendState.mode === 'server';
  const status = document.getElementById('backend-status');
  const chip = document.getElementById('mode-chip');
  const urlInput = document.getElementById('backend-url');
  const health = backendState.health;
  if (urlInput && document.activeElement !== urlInput) urlInput.value = backendBase();
  if (status) {
    status.textContent = server
      ? `متصل به سرور مرکزی — نسخه ${health?.version ?? '—'} — ${fmt(health?.users ?? 0)} کاربر و ${fmt(health?.audit ?? 0)} رویداد در سرور`
      : 'حالت محلی — بدون سرور؛ کاربران، داده‌ها و گزارش فعالیت فقط در همین مرورگر';
  }
  if (chip) {
    chip.hidden = false;
    chip.textContent = server ? 'سرور مرکزی' : 'حالت محلی';
    chip.classList.toggle('st-1', server);
    chip.classList.toggle('neutral', !server);
    chip.title = server ? 'احراز هویت و گزارش فعالیت روی سرور' : 'نسخه استاتیک؛ احراز هویت در مرورگر';
  }
  const canPush = server && Boolean(backendState.token) && currentRole() !== 'VIEWER';
  for (const id of ['backend-verify', 'backend-backup', 'backend-restore', 'backend-sync-audit']) {
    const button = document.getElementById(id);
    if (button) button.disabled = !server || !backendState.token;
  }
  for (const id of ['sync-pull', 'sync-refresh']) {
    const button = document.getElementById(id);
    if (button) button.disabled = !server || !backendState.token;
  }
  const push = document.getElementById('sync-push');
  if (push) push.disabled = !canPush;
  const syncStatus = document.getElementById('sync-status');
  if (syncStatus) {
    const localVersion = fmt(syncState.version);
    const serverVersion = fmt(health?.stateVersion ?? 0);
    syncStatus.textContent = server
      ? `نسخه محلی ${localVersion} — نسخه سرور ${serverVersion}${syncState.at ? ` — آخرین همگام‌سازی ${localizeDigits(new Date(syncState.at).toLocaleString('fa-IR'))}` : ''}`
      : `نسخه محلی ${localVersion} — بدون سرور`;
  }
}

function backendSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workshops: state.store.workshops,
    activeWorkshopId: state.store.activeWorkshopId ?? null,
    units: state.store.units ?? [],
    jobs: state.store.jobs ?? [],
    employees: state.store.employees ?? [],
  };
}

function initBackendPanel() {
  const connect = document.getElementById('backend-connect');
  if (connect) {
    connect.addEventListener('click', async () => {
      const urlInput = document.getElementById('backend-url');
      const base = (urlInput?.value || './api').trim().replace(/\/+$/, '');
      saveBackendConfig(base);
      setBackendNote('در حال بررسی سرور…');
      const found = await detectBackend();
      renderBackendPanel();
      if (!found) {
        setBackendNote('سروری یافت نشد؛ حالت محلی فعال است. برای راه‌اندازی: npm run serve:api', 'warn');
        return;
      }
      await refreshServerStatus();
      setBackendNote('سرور مرکزی در دسترس است. برای استفاده، خارج و با حساب سروری وارد شوید.', 'ok');
      backendState.token = readBackendToken() || null;
      if (!backendState.token) showAuthGate();
    });
  }

  const refresh = document.getElementById('backend-refresh');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      await detectBackend();
      renderBackendPanel();
      setBackendNote(backendState.mode === 'server' ? 'وضعیت سرور به‌روزرسانی شد.' : 'سروری در دسترس نیست؛ حالت محلی.', backendState.mode === 'server' ? 'ok' : 'warn');
    });
  }

  const verify = document.getElementById('backend-verify');
  if (verify) {
    verify.addEventListener('click', async () => {
      if (backendState.mode !== 'server' || !backendState.token) return;
      try {
        const result = await apiFetch('/audit/verify');
        backendState.verified = result;
        setBackendNote(
          result.ok
            ? `زنجیره گزارش فعالیت سرور سالم است: ${fmt(result.count)} رویداد پیاپی بدون شکست.`
            : `زنجیره گزارش فعالیت در رویداد ${fmt(result.brokenAt)} شکسته است؛ گزارش سرور قابل اتکا نیست.`,
          result.ok ? 'ok' : 'error',
        );
        logActivity('security', 'EXPORT', `بازبینی زنجیره گزارش سرور: ${result.ok ? 'سالم' : 'شکسته'} (${result.count} رویداد)`);
      } catch (error) {
        setBackendNote(`بازبینی ناموفق بود: ${error.message}`, 'error');
      }
    });
  }

  const backup = document.getElementById('backend-backup');
  if (backup) {
    backup.addEventListener('click', async () => {
      if (backendState.mode !== 'server' || !backendState.token) return;
      try {
        const result = await apiFetch('/backup', { method: 'PUT', body: { snapshot: backendSnapshot() } });
        setBackendNote(`پشتیبان مرکزی نسخه ${fmt(result.version)} ثبت شد.`, 'ok');
        logActivity('settings', 'BACKUP', `ارسال پشتیبان به سرور — نسخه ${result.version}`);
      } catch (error) {
        setBackendNote(`ثبت پشتیبان ناموفق بود: ${error.message}`, 'error');
      }
    });
  }

  const restore = document.getElementById('backend-restore');
  if (restore) {
    restore.addEventListener('click', async () => {
      if (backendState.mode !== 'server' || !backendState.token) return;
      try {
        const result = await apiFetch('/backup');
        if (!result.backup) {
          setBackendNote('هیچ پشتیبانی روی سرور ثبت نشده است.', 'warn');
          return;
        }
        const confirmed = typeof window.confirm === 'function'
          ? window.confirm(`بازیابی پشتیبان نسخه ${result.backup.version} از سرور؟ داده‌های محلی جایگزین می‌شوند.`)
          : true;
        if (!confirmed) return;
        const snapshot = result.backup.snapshot ?? {};
        writeStore({
          workshops: Array.isArray(snapshot.workshops) ? snapshot.workshops : [],
          activeWorkshopId: snapshot.activeWorkshopId ?? null,
          units: Array.isArray(snapshot.units) ? snapshot.units : [],
          jobs: Array.isArray(snapshot.jobs) ? snapshot.jobs : [],
          employees: Array.isArray(snapshot.employees) ? snapshot.employees : [],
        });
        renderSettingsMeta();
        setBackendNote(`پشتیبان نسخه ${fmt(result.backup.version)} از سرور بازیابی شد.`, 'ok');
        logActivity('settings', 'RESTORE', `بازیابی پشتیبان سرور — نسخه ${result.backup.version}`);
      } catch (error) {
        setBackendNote(`بازیابی ناموفق بود: ${error.message}`, 'error');
      }
    });
  }

  const pull = document.getElementById('sync-pull');
  if (pull) pull.addEventListener('click', () => void syncPull());

  const push = document.getElementById('sync-push');
  if (push) push.addEventListener('click', () => void syncPush());

  const syncRefresh = document.getElementById('sync-refresh');
  if (syncRefresh) {
    syncRefresh.addEventListener('click', async () => {
      await detectBackend();
      if (backendState.mode === 'server') {
        await refreshServerStatus();
        try {
          backendState.health = await apiFetch('/health', { auth: false });
        } catch {
          /* بی‌اهمیت */
        }
      }
      renderBackendPanel();
      setBackendNote(
        backendState.mode === 'server'
          ? `نسخه سرور: ${fmt(backendState.health?.stateVersion ?? 0)} — نسخه محلی: ${fmt(syncState.version)}`
          : 'سروری در دسترس نیست؛ حالت محلی.',
        backendState.mode === 'server' ? 'ok' : 'warn',
      );
    });
  }

  const sync = document.getElementById('backend-sync-audit');
  if (sync) {
    sync.addEventListener('click', async () => {
      if (backendState.mode !== 'server' || !backendState.token) return;
      const rows = [...(state.store.activityLog ?? [])].slice(-200);
      if (rows.length === 0) {
        setBackendNote('رویداد محلی برای ارسال وجود ندارد.', 'warn');
        return;
      }
      let sent = 0;
      for (const row of rows) {
        try {
          await apiFetch('/activity', {
            method: 'POST',
            body: { module: row.module, action: row.action, detail: `[آینه محلی] ${row.detail}`, workshopId: row.workshopId ?? null },
          });
          sent += 1;
        } catch (error) {
          setBackendNote(`ارسال رویدادها در ${fmt(sent)} متوقف شد: ${error.message}`, 'error');
          return;
        }
      }
      setBackendNote(`${fmt(sent)} رویداد محلی به گزارش سرور آینه شد.`, 'ok');
    });
  }

  renderBackendPanel();
}

/* ================================== شروع ================================== */

async function boot() {
  state.store = readStore();
  try {
    const response = await fetch('./data/mashaqel-data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`دریافت داده ناموفق بود (${response.status})`);
    state.data = await response.json();
  } catch (error) {
    const target = document.getElementById('main-content');
    if (target) {
      target.innerHTML = `
        <div class="warnings">
          <h4>داده‌های محاسباتی بارگذاری نشد</h4>
          <ul><li>${escapeHtml(error.message)}</li>
            <li>برای ساخت داده‌ها دستور <code>npm run export:web</code> را اجرا کنید و پوشه <code>web</code> را سرو نمایید.</li>
          </ul>
        </div>`;
    }
    return;
  }

  await detectBackend();
  if (backendState.mode === 'server') {
    backendState.token = readBackendToken() || null;
    await refreshServerStatus();
    if (backendState.token) {
      try {
        const payload = await apiFetch('/auth/me');
        authState.user = mapServerUser(payload.user);
        await refreshServerUsers();
      } catch {
        writeBackendToken('');
      }
    }
  }

  await loadSsoStatus();
  const ssoHandled = await handleSsoCallback();

  bindAuthForms();
  if (!ssoHandled && !currentUser()) {
    showAuthGate();
    renderBackendPanel();
    return;
  }
  startApp();
}

function startApp() {
  applyAccessControl();
  if (state.started) return;
  state.started = true;
  initWageRows();
  initRouter();
  initSubtabs();
  initDigits();
  initWage();
  initSeniority();
  initGroup();
  initEval();
  initWorkshops();
  initOrg();
  initJobs();
  initEmployees();
  initPayrollMonthly();
  initArrears();
  initReports();
  initSettings();
  initUsers();
  initBackendPanel();

  const printButton = document.getElementById('print-btn');
  if (printButton) {
    printButton.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }

  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = false;

  const meta = state.data.meta;
  const dataMeta = document.getElementById('data-meta');
  if (dataMeta) {
    dataMeta.textContent =
      `داده‌ها از موتور ${meta.source} — نسخه ${meta.engineVersion} — تولید ${new Date(meta.generatedAt).toLocaleString('fa-IR')} — ` +
      `${fmt(state.data.levels.length)} سطح امتیازی، ${fmt(state.data.wageTables.length)} ردیف مزد، ${fmt(state.data.seniorityTables.length)} ردیف سنوات`;
  }
}

boot();
