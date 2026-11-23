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
  store: { workshops: [], activeWorkshopId: null, jobs: [] },
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
      jobs: Array.isArray(parsed?.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { workshops: [], activeWorkshopId: null, jobs: [] };
  }
}

function writeStore(patch) {
  const next = {
    workshops: state.store.workshops,
    activeWorkshopId: state.store.activeWorkshopId,
    jobs: state.store.jobs ?? [],
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
    renderSettingsMeta();
  }
}

function newId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return `${prefix}-${random.slice(0, 8)}`;
}

function activeWorkshop() {
  return state.store.workshops.find((row) => row.id === state.store.activeWorkshopId) ?? null;
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
  if (target === 'jobs') renderJobsView();
  if (target === 'evaluation') renderEvalJobOptions();
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
  for (const workshop of state.store.workshops) {
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
  showToast(exists ? 'کارگاه ویرایش شد' : 'کارگاه جدید ثبت شد');
}

function renderWorkshopTable() {
  const table = document.getElementById('workshop-table');
  if (!table) return;
  if (state.store.workshops.length === 0) {
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
      ${state.store.workshops
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
        if (message) message.textContent = 'فایل پشتیبان ساخته شد.';
      } catch {
        if (message) message.textContent = 'ساخت فایل پشتیبان در این مرورگر ممکن نشد.';
      }
    });
  }

  if (importInput) {
    importInput.addEventListener('change', async () => {
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
}

function renderJobsFilters() {
  const jobs = workshopJobs();
  const unitSelect = document.getElementById('jobs-filter-unit');
  if (unitSelect) {
    const units = [...new Set(jobs.map((job) => job.orgUnit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'));
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
        <th>تعداد نیرو</th><th>امتیاز</th><th>گروه پیشنهادی</th><th>وضعیت</th><th>عملیات</th>
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
            <td>${escapeHtml(job.orgUnit)}</td>
            <td class="num">${escapeHtml(job.supervisorJobCode || '—')}</td>
            <td class="num">${fmt(job.headcount)}</td>
            <td class="num">${evaluation ? fmt(evaluation.totalScore, 1) : '—'}</td>
            <td class="num">${evaluation && evaluation.proposedGroup ? fmt(evaluation.proposedGroup) : '—'}</td>
            <td>${JOB_STATUS_LABELS[job.status] ?? job.status}</td>
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
    orgUnit: document.getElementById('jf-unit').value.trim(),
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
  const confirmed = typeof window.confirm === 'function'
    ? window.confirm(`حذف شغل «${job.title}»؟ این عمل قابل بازگشت نیست.`)
    : true;
  if (!confirmed) return;
  writeStore({ ...state.store, jobs: state.store.jobs.filter((row) => row.id !== job.id) });
  renderJobsView();
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
        <tr><th>عنوان انگلیسی</th><td dir="ltr">${escapeHtml(job.titleEn || '—')}</td><th>واحد سازمانی</th><td>${escapeHtml(job.orgUnit)}</td></tr>
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

  const groupContent = `
    <p>
      گروه پیشنهادی: <strong>${evaluation?.proposedGroup ? fmt(evaluation.proposedGroup) : '— تعیین نشده'}</strong>
      ${evaluation?.proposedGroup ? ` (بازه ${fmt(evaluation.rangeMin ?? 0)}–${fmt(evaluation.rangeMax ?? 0)} امتیاز)` : ''}
    </p>
    <div class="ok-note">
      گروه پیشنهادی قطعی نیست. گروه نهایی تنها پس از بررسی کارشناس طبقه‌بندی مشاغل و تأیید کمیته و مرجع مسئول ثبت می‌شود.
    </div>`;

  const approvalContent = `
    <table class="data-table profile-table">
      <tbody>
        <tr><th>وضعیت تأیید</th><td>در انتظار بررسی کارشناس و کمیته طبقه‌بندی مشاغل</td></tr>
        <tr><th>نام کارشناس</th><td class="muted">— تکمیل در فاز ۵ (ثبت نظر کارشناس) —</td></tr>
        <tr><th>شماره صورت‌جلسه کمیته</th><td class="muted">— تکمیل در فاز ۵ —</td></tr>
        <tr><th>تاریخ تأیید</th><td class="muted">—</td></tr>
      </tbody>
    </table>`;

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
  };
  const jobs = state.store.jobs.map((row) =>
    row.id === job.id ? { ...row, evaluation, updatedAt: new Date().toISOString() } : row,
  );
  writeStore({ ...state.store, jobs });
  if (message) message.textContent = `ثبت شد: ${fmt(evaluation.totalScore, 1)} امتیاز — گروه پیشنهادی ${evaluation.proposedGroup ? fmt(evaluation.proposedGroup) : 'نامشخص'}`;
  showToast('نتیجه ارزیابی در شناسنامه شغل ثبت شد');
  renderJobsTable();
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

  initWageRows();
  initRouter();
  initSubtabs();
  initDigits();
  initWage();
  initSeniority();
  initGroup();
  initEval();
  initWorkshops();
  initJobs();
  initSettings();

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
