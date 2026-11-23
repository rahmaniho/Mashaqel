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

function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.panel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.id === `panel-${name}`);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
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
  renderReference();
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

/* ================================ ارزیابی ================================ */

function initEval() {
  renderEvalForm();
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

  target.innerHTML = summary + factorTable + subTable + warnings + approvalNote;
}

/* ================================ مرجع ================================ */

function initReference() {
  $('#status-legend').innerHTML = Object.entries(STATUS_SHORT)
    .map(
      ([status, label]) =>
        `<span class="legend-item"><span class="chip ${STATUS_CHIP_CLASS[status] ?? 'neutral'}">${escapeHtml(label)}</span></span>`,
    )
    .join('');
  renderReference();
}

function renderReference() {
  const formulas = state.data.formulaVersions;
  $('#f-table').innerHTML = `
    <thead><tr><th>کد فرمول</th><th>عنوان</th><th>نسخه</th><th>رابطه</th><th>منبع قانونی</th><th>واحد</th><th>وضعیت</th></tr></thead>
    <tbody>
      ${formulas
        .map(
          (row) => `<tr>
            <td><code>${escapeHtml(row.code)}</code></td>
            <td>${escapeHtml(row.name)}</td>
            <td class="small">${escapeHtml(row.version)}</td>
            <td class="desc"><code>${escapeHtml(row.expression)}</code></td>
            <td class="desc">${escapeHtml(row.legalSource)}${row.circularNumber ? ` <span class="small muted">— ${escapeHtml(row.circularNumber)}</span>` : ''}</td>
            <td class="small">${escapeHtml(row.currency)}</td>
            <td>${chip(row.status)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;

  $('#doc-table').innerHTML = `
    <thead><tr><th>کد</th><th>عنوان سند</th><th>مرجع</th><th>شماره / تاریخ</th><th>وضعیت</th></tr></thead>
    <tbody>
      ${state.data.legalDocuments
        .map(
          (row) => `<tr>
            <td><code>${escapeHtml(row.code)}</code></td>
            <td>${escapeHtml(row.title)}<div class="small muted">${escapeHtml(row.notes ?? '')}</div></td>
            <td class="small">${escapeHtml(row.authority)}</td>
            <td class="small">${row.circularNumber ? escapeHtml(row.circularNumber) + ' — ' : ''}${escapeHtml(row.approvalDate)}</td>
            <td>${chip(row.status)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>`;
}

/* ================================== شروع ================================== */

async function boot() {
  try {
    const response = await fetch('./data/mashaqel-data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`دریافت داده ناموفق بود (${response.status})`);
    state.data = await response.json();
  } catch (error) {
    document.querySelector('main').innerHTML = `
      <div class="warnings">
        <h4>داده‌های محاسباتی بارگذاری نشد</h4>
        <ul><li>${escapeHtml(error.message)}</li>
          <li>برای ساخت داده‌ها دستور <code>npm run export:web</code> را اجرا کنید و پوشه <code>web</code> را سرو نمایید.</li>
        </ul>
      </div>`;
    return;
  }

  initTabs();
  initDigits();
  initWage();
  initSeniority();
  initGroup();
  initEval();
  initReference();

  const meta = state.data.meta;
  $('#data-meta').textContent =
    `داده‌ها از موتور ${meta.source} — تولید ${new Date(meta.generatedAt).toLocaleString('fa-IR')} — ` +
    `${fmt(state.data.levels.length)} سطح امتیازی، ${fmt(state.data.formulaVersions.length)} فرمول، ${fmt(state.data.legalDocuments.length)} سند`;
}

boot();
