import { useCallback, useRef, useState } from 'react';
import { Briefcase, Building2, ChevronLeft, Menu, Printer, Users, Wallet } from 'lucide-react';

import Sidebar from './components/Sidebar';

const KPIS = [
  { label: 'مشاغل بانک شغل', value: '۳', hint: '۱ شغل ارزیابی‌نشده', icon: Briefcase },
  { label: 'مزد شغل روزانه — گروه ۱ (۱۴۰۵)', value: '۱۶۶٬۶۶۷', hint: 'ریال', icon: Wallet },
  { label: 'حداقل مزد ۱۴۰۵', value: '۵٬۵۴۱٬۸۵۰', hint: 'ریال در روز', icon: Building2 },
  { label: 'کارکنان ثبت‌شده', value: '۳', hint: '۲ قرارداد دائم', icon: Users },
];

const WAGE_BARS = [46, 50, 53, 57, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 100, 100, 100, 100, 100];

const DATA_ROWS = [
  ['جدول مزد ۱۴۰۴ و ۱۴۰۵', '۴۰ ردیف'],
  ['نرخ و سنوات تجمیعی', '۱۰۲ ردیف'],
  ['بازه امتیاز گروه‌ها', '۲۰ بازه'],
  ['سطوح امتیازی بارگذاری‌شده', '۳۹۳ سطح'],
  ['نسخه پارامترهای سالانه', '۲ نسخه (۱۴۰۵)'],
];

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef(null);

  const closeNav = useCallback(() => {
    setNavOpen(false);
    menuButtonRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div dir="rtl" className="relative min-h-dvh overflow-x-hidden bg-[#070b14] text-white">
      {/* ---------------------------- abstract backdrop --------------------------- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-28 h-[620px] w-[620px] rounded-full bg-[#0f2247]/80 blur-[130px]" />
        <div className="absolute right-[6%] top-[16%] h-[420px] w-[420px] rounded-full bg-amber-500/15 blur-[120px]" />
        <div className="absolute -left-24 top-[6%] h-[520px] w-[520px] rounded-full bg-[#17305f]/70 blur-[150px]" />
        <div className="absolute bottom-[-12%] left-[24%] h-[460px] w-[460px] rounded-full bg-red-700/15 blur-[140px]" />

        {/* “3D” glass shapes */}
        <div className="absolute left-[18%] top-[10%] hidden h-[380px] w-[380px] rotate-[18deg] rounded-[38%] bg-gradient-to-br from-white/[0.12] via-white/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/10 sm:block" />
        <div className="absolute bottom-[14%] left-[36%] hidden h-[240px] w-[240px] -rotate-12 rounded-[44%] bg-gradient-to-tr from-amber-400/20 via-white/[0.04] to-transparent ring-1 ring-white/10 backdrop-blur-sm lg:block" />
        <div className="absolute right-[40%] top-[46%] hidden h-[170px] w-[170px] rotate-45 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md lg:block" />

        {/* grain */}
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/60" />
      </div>

      {/* -------------------------------- layout -------------------------------- */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1560px] gap-3 p-3 sm:gap-5 sm:p-4 lg:gap-6 lg:p-6">
        <Sidebar mobileOpen={navOpen} onMobileClose={closeNav} direction="rtl" />

        <main className="min-w-0 flex-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* mobile top bar */}
          <div className="sticky top-2 z-20 mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a1120]/85 p-2 shadow-lg shadow-black/30 backdrop-blur-xl md:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={navOpen}
              aria-controls="app-sidebar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Menu size={18} />
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-[#d4af37] text-[14px] font-bold text-[#0f2247]">
                م
              </span>
              <span className="truncate text-[13px] font-semibold tracking-tight">مشاغل</span>
            </div>

            <span className="ms-auto truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10.5px] text-gray-300">
              کارگاه شماره یک
            </span>
          </div>

          {/* desktop page head */}
          <header className="hidden items-center gap-3 md:flex">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>سامانه مشاغل</span>
                <ChevronLeft size={12} />
                <span className="text-gray-300">داشبورد</span>
              </div>
              <h1 className="mt-1 text-[19px] font-bold tracking-tight text-white">داشبورد</h1>
            </div>

            <div className="ms-auto flex items-center gap-2">
              <span className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[11.5px] text-gray-300">
                <Building2 size={14} className="text-amber-300/80" />
                کارگاه شماره یک — WS-1001
              </span>
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-[12px] font-medium text-gray-200 transition hover:bg-white/10"
              >
                <Printer size={14} /> چاپ
              </button>
            </div>
          </header>

          {/* KPI strip */}
          <section className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 lg:grid-cols-4">
            {KPIS.map(({ label, value, hint, icon: Icon }) => (
              <div
                key={label}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl sm:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10.5px] leading-5 text-gray-400 sm:text-[11px]">{label}</p>
                  <Icon size={15} className="mt-0.5 shrink-0 text-amber-300/70" />
                </div>
                <p className="mt-2 text-[19px] font-bold tracking-tight text-white sm:text-[23px]">{value}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>
              </div>
            ))}
          </section>

          {/* chart + data status */}
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-white">مزد شغل روزانه ۱۴۰۵ به تفکیک گروه</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                  ۲۰ گروه
                </span>
              </div>

              <div className="mt-5 flex h-36 items-end gap-1 sm:gap-1.5">
                {WAGE_BARS.map((height, index) => (
                  <div key={index} className="group flex h-full flex-1 flex-col justify-end">
                    <div
                      className={`w-full rounded-t-[3px] ${
                        index === 0 ? 'bg-[#d4af37]' : 'bg-[#21407c]'
                      } transition-colors duration-300 group-hover:bg-amber-300/80`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[9.5px] text-gray-500">
                <span>گروه ۱</span>
                <span>گروه ۱۰</span>
                <span>گروه ۲۰</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
              <h2 className="text-[13px] font-semibold text-white">وضعیت داده‌های پایه</h2>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {DATA_ROWS.map(([label, value]) => (
                  <li key={label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[11.5px] text-gray-400">{label}</span>
                    <span className="shrink-0 text-[11.5px] font-semibold text-gray-200">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* jobs table */}
          <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 pb-3 pt-4 sm:px-5">
              <h2 className="text-[13px] font-semibold text-white">بانک مشاغل کارگاه</h2>
              <button type="button" className="text-[11px] font-medium text-gray-400 transition hover:text-white">
                مشاهده همه
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-start">
                <thead>
                  <tr className="bg-[#0f2247]/70 text-[10.5px] text-gray-300">
                    <th className="px-4 py-2.5 text-start font-medium">کد شغل</th>
                    <th className="px-4 py-2.5 text-start font-medium">عنوان شغل</th>
                    <th className="px-4 py-2.5 text-start font-medium">واحد سازمانی</th>
                    <th className="px-4 py-2.5 text-start font-medium">گروه</th>
                    <th className="px-4 py-2.5 text-start font-medium">وضعیت تأیید</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-[11.5px]">
                  {[
                    ['J-1001', 'جوشکار تأسیسات', 'خط مونتاژ', '۱۲', 'تأیید کمیته', 'ok'],
                    ['J-1002', 'سرپرست خط مونتاژ', 'خط مونتاژ', '—', 'بدون ارزیابی', 'idle'],
                    ['J-2001', 'کارشناس کنترل کیفیت', 'کنترل کیفیت', '۱۶', 'در انتظار تأیید', 'warn'],
                  ].map(([code, title, unit, group, status, tone]) => (
                    <tr key={code} className="transition-colors hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-200">{code}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-200">{title}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-400">{unit}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-300">{group}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                            tone === 'ok'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : tone === 'warn'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-white/10 text-gray-300'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-center text-[10.5px] leading-6 text-gray-500">
            نمای دمو — منوی شیشه‌ای هماهنگ با سامانه مشاغل (۱۳ آیتم، RTL، وزیرمتن) · نسخه ۱.۰.۰
          </p>
        </main>
      </div>
    </div>
  );
}
