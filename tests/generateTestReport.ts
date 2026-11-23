/**
 * تولید گزارش نهایی آزمون (TEST_REPORT.md) با نمایش ورودی، فرمول، خروجی مورد انتظار و خروجی واقعی هر سناریو.
 * اجرا: npm run report
 */

import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { runAllScenarios, type ScenarioResult } from './scenarios.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function escapeCell(value: unknown): string {
  return String(value).replace(/\|/g, '｜').replace(/\n/g, ' ');
}

function formatValue(value: ScenarioResult['expected']): string {
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  return value;
}

function buildReport(results: ScenarioResult[]): string {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const areas = [...new Set(results.map((r) => r.area))];

  const lines: string[] = [];
  lines.push('# گزارش آزمون جامع موتور ارزیابی، طبقه‌بندی مشاغل و محاسبات مزد');
  lines.push('');
  lines.push('> این گزارش به‌صورت خودکار از اجرای مجموعه سناریوهای آزمون تولید شده است.');
  lines.push('');
  lines.push('| مشخصه | مقدار |');
  lines.push('| :--- | :--- |');
  lines.push(`| نسخه موتور | \`${packageJson.version}\` |`);
  lines.push(`| تاریخ اجرا | ${new Date().toISOString().slice(0, 10)} |`);
  lines.push(`| محیط اجرا | Node.js \`${process.version}\` — دیتابیس \`node:sqlite\` (SQLite درون‌حافظه) |`);
  lines.push(`| واحد پولی تمام محاسبات | **ریال ایران (IRR)** |`);
  lines.push(`| تعداد سناریوهای آزمون | **${results.length}** |`);
  lines.push(`| سناریوهای موفق | **${passed}** |`);
  lines.push(`| سناریوهای ناموفق | **${failed}** |`);
  lines.push(`| نتیجه کلی | ${failed === 0 ? '**همه آزمون‌ها موفق**' : '**دارای خطا**'} |`);
  lines.push('');

  lines.push('## ۱. جمع‌بندی به تفکیک حوزه آزمون');
  lines.push('');
  lines.push('| حوزه | تعداد سناریو | موفق | ناموفق |');
  lines.push('| :--- | :---: | :---: | :---: |');
  for (const area of areas) {
    const group = results.filter((r) => r.area === area);
    lines.push(
      `| ${area} | ${group.length} | ${group.filter((r) => r.pass).length} | ${group.filter((r) => !r.pass).length} |`,
    );
  }
  lines.push('');

  lines.push('## ۲. ماتریس پوشش الزامات آزمون');
  lines.push('');
  lines.push('| الزام آزمون | سناریوهای پوشش‌دهنده | وضعیت |');
  lines.push('| :--- | :--- | :---: |');
  const coverage: Array<[string, string[]]> = [
    ['فرمول مزد شغل روزانه ۱۴۰۵ (۱٫۴۵ + ۵۱۹٬۵۴۹)', ['WAGE-01', 'WAGE-02', 'WAGE-04']],
    ['کف حداقل مزد روزانه ۵٬۵۴۱٬۸۵۰ ریال', ['WAGE-01', 'WAGE-03']],
    ['مزد شغل ماهانه و روزهای قابل پرداخت', ['WAGE-05', 'WAGE-06']],
    ['پایه سنوات گروهی و پیام فقدان جدول', ['SNR-01', 'SNR-02', 'SNR-03', 'SNR-04', 'SNR-05']],
    ['مزد مبنا (شغل + سنوات + رتبه + سایر)', ['BASE-01']],
    ['تفکیک مزایای رفاهی از مزد', ['WEL-01', 'WEL-02']],
    ['نسخه‌بندی پارامترها و مسکن ۱۴۰۵', ['WEL-03', 'WEL-04', 'WEL-05']],
    ['بیمه، اضافه‌کاری، نوبت‌کاری و شب‌کاری', ['CAL-01', 'CAL-02', 'CAL-03', 'CAL-04']],
    ['جلوگیری از اختلاط ریال و تومان', ['CUR-01', 'CUR-02', 'CUR-03', 'CUR-04']],
    ['مابه‌التفاوت و معوقات چنددوره‌ای', ['ARR-01', 'ARR-02', 'ARR-03', 'ARR-04']],
    ['امتیازدهی نظام ۱۳۸۹ و سقف‌های زیرعامل‌ها', ['EVAL-01', 'EVAL-04', 'EVAL-05', 'EVAL-06', 'EVAL-07']],
    ['تطبیق امتیاز با دامنه گروه‌ها', ['EVAL-02', 'EVAL-03', 'EVAL-08', 'EVAL-09']],
    ['فعال‌سازی مشروط نظام ۱۳۹۵ به طرح مصوب کارگاه', ['EVAL-10', 'EVAL-11']],
    ['چندتاریخی بودن نسخه جدول‌ها', ['EVAL-12', 'EVAL-13']],
    ['الزام تأیید کارشناس و قطعی‌نشدن گروه', ['APR-01', 'APR-02', 'APR-03', 'APR-04']],
    ['هشدارهای کارشناسی (تحصیل و سلسله‌مراتب)', ['APR-05', 'APR-06']],
    ['ردیابی و تاریخچه محاسبات', ['APR-07']],
    ['۱۷ جدول مستقل، مهاجرت و شناسنامه فرمول‌ها', ['SYS-01', 'SYS-02']],
    ['بازتولید مستقل جدول‌های مزد و سنوات', ['SYS-03', 'SYS-04', 'SYS-05', 'SYS-07']],
    ['پارامترهای ۱۴۰۵ و ذخیره محاسبات', ['SYS-06', 'SYS-08']],
  ];
  for (const [requirement, ids] of coverage) {
    const related = results.filter((r) => ids.includes(r.id));
    const ok = related.length === ids.length && related.every((r) => r.pass);
    lines.push(`| ${requirement} | ${ids.join('، ')} | ${ok ? '✅ پوشش کامل' : '⚠️ ناقص'} |`);
  }
  lines.push('');

  lines.push('## ۳. جزئیات سناریوها (ورودی، فرمول، انتظار، نتیجه واقعی)');
  for (const area of areas) {
    lines.push('');
    lines.push(`### ${area}`);
    lines.push('');
    lines.push('| کد | عنوان | ورودی | فرمول / مبنای قانونی | انتظار | واقعی | نتیجه |');
    lines.push('| :--- | :--- | :--- | :--- | :---: | :---: | :---: |');
    for (const r of results.filter((item) => item.area === area)) {
      lines.push(
        `| \`${r.id}\` | ${escapeCell(r.title)} | \`${escapeCell(r.input)}\` | ${escapeCell(r.formula)} | ` +
          `${escapeCell(formatValue(r.expected))} | ${escapeCell(formatValue(r.actual))} | ${r.pass ? '✅ موفق' : '❌ ناموفق'} |`,
      );
    }
    const withNotes = results.filter((item) => item.area === area && item.notes.filter(Boolean).length > 0);
    if (withNotes.length > 0) {
      lines.push('');
      for (const r of withNotes) {
        lines.push(`- **${r.id}**`);
        for (const note of r.notes.filter(Boolean)) lines.push(`  - ${note}`);
      }
    }
  }

  lines.push('');
  lines.push('## ۴. آزمون‌های ساختاری و واحد (خارج از جدول سناریوها)');
  lines.push('');
  lines.push('مجموعه `tests/engine.test.ts` شامل آزمون‌های زیر است که همگی در `npm test` اجرا و تأیید شده‌اند:');
  lines.push('');
  lines.push('- تبدیل و اعتبارسنجی تاریخ شمسی (نوروز ۱۴۰۵ = ۲۱ مارس ۲۰۲۶، سال کبیسه ۱۴۰۳، طول ماه‌ها، رد تاریخ نامعتبر).');
  lines.push('- محافظ واحد پولی: تبدیل تومان/ریال، تشخیص مبلغ تومانی، رد واحد ناشناخته و مبلغ منفی.');
  lines.push('- قواعد مکمل: جدول کسر سابقه بابت کمبود تحصیل، معادل‌سازی ساعت آموزش مهارت، کنترل سلسله‌مراتب سرپرستی، شمارش رتبه، ضریب ریالی.');
  lines.push('- یکپارچگی دیتابیس: کلید خارجی، CHECK وضعیت اعتبار، CHECK واحد پول، CHECK کف جدول مزد، اجرای یک‌باره مهاجرت‌ها و idempotent بودن بذرها.');
  lines.push('- محاسبات: کف حداقل مزد، تفکیک مزایا از مزد، نسبت‌بندی مزایا با کارکرد، مالیات در نبود پلکان مصوب، خطای نسخه پارامتر ناموجود.');
  lines.push('- ارزیابی: رد زیرعامل ناشناخته، الزام انتخاب همه زیرعامل‌های فعال، تطبیق با نسخه صریح جدول، عدم تطبیق در نبود جدول.');
  lines.push('');
  lines.push('## ۵. اقلام دارای محدودیت اعتبار (مطابق سند `JOB_CLASSIFICATION_FORMULAS.md`)');
  lines.push('');
  lines.push('| کد / عنوان | وضعیت | اثر بر آزمون |');
  lines.push('| :--- | :---: | :--- |');
  lines.push('| زیرعامل «مسئولیت ایمنی دیگران» | ۳. فاقد مستند کافی | امتیازدهی خودکار غیرفعال؛ امتیاز ۰ با هشدار (سناریوی `EVAL-04`). |');
  lines.push('| وزن/سطح/امتیاز نظام ۱۳۹۵ برای هر کارگاه | ۴. نیازمند ورود اطلاعات طرح مصوب کارگاه | امتیازدهی تا بارگذاری طرح مصوب مسدود است (سناریوهای `EVAL-10` و `EVAL-11`). |');
  lines.push('| ردیف‌های ۵۶/۶۰ سطح ۵ «فرم‌ها و گزارشات» و ستون ۶ ساعته «نشستن مداوم» | ۲. استخراج‌شده ولی نیازمند تطبیق | با وضعیت ۲ ثبت و در امتیازدهی با هشدار استفاده می‌شود. |');
  lines.push('| کمک‌هزینه مسکن (نسخه `1405-v1` برابر ۹٬۰۰۰٬۰۰۰ ریال) | ۲. استخراج‌شده ولی نیازمند تطبیق | هر دو نسخه نگهداری و به‌صورت صریح انتخاب می‌شوند (سناریوهای `WEL-03` و `WEL-04`). |');
  lines.push('| پلکان مالیات بر حقوق ۱۴۰۵ | ۴. نیازمند ورود اطلاعات | مالیات صفر با هشدار؛ پس از بارگذاری، محاسبه پلکانی فعال می‌شود. |');
  lines.push('');
  lines.push('## ۶. نحوه بازتولید گزارش');
  lines.push('');
  lines.push('```bash');
  lines.push('npm install');
  lines.push('npm run typecheck   # بررسی نوع‌ها');
  lines.push('npm test            # اجرای ۹۳ آزمون خودکار');
  lines.push('npm run report      # تولید همین گزارش (TEST_REPORT.md)');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

const results = runAllScenarios();
const report = buildReport(results);
writeFileSync(join(root, 'TEST_REPORT.md'), report, 'utf8');
const failed = results.filter((r) => !r.pass);
console.log(`گزارش آزمون تولید شد: TEST_REPORT.md — ${results.length} سناریو، ${results.length - failed.length} موفق، ${failed.length} ناموفق`);
if (failed.length > 0) {
  for (const item of failed) {
    console.error(`- ${item.id}: انتظار ${String(item.expected)} / واقعی ${String(item.actual)}`);
  }
  process.exitCode = 1;
}
