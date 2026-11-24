import { ChevronRight, Play, Plus, Search } from 'lucide-react';

import Sidebar from './components/Sidebar';

const CARDS = [
  { title: 'Neon Districts', meta: 'S2 · E4', from: 'from-rose-500/70', to: 'to-orange-400/40', ring: 'ring-rose-400/20' },
  { title: 'Silent Orbit', meta: 'Film · 2h 14m', from: 'from-indigo-500/70', to: 'to-sky-400/40', ring: 'ring-indigo-400/20' },
  { title: 'Paper Kingdom', meta: 'S1 · E1', from: 'from-emerald-500/60', to: 'to-teal-400/40', ring: 'ring-emerald-400/20' },
];

export default function App() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#07070a] text-white">
      {/* ---------------------------- abstract backdrop --------------------------- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-28 h-[620px] w-[620px] rounded-full bg-red-600/30 blur-[150px]" />
        <div className="absolute left-[6%] top-[16%] h-[420px] w-[420px] rounded-full bg-amber-500/25 blur-[110px]" />
        <div className="absolute bottom-[-10%] left-[-6%] h-[460px] w-[460px] rounded-full bg-fuchsia-600/25 blur-[130px]" />
        <div className="absolute right-[-12%] top-[6%] h-[560px] w-[560px] rounded-full bg-fuchsia-600/20 blur-[160px]" />
        <div className="absolute bottom-[-25%] left-[22%] h-[620px] w-[620px] rounded-full bg-indigo-500/20 blur-[170px]" />

        {/* “3D” glass shapes */}
        <div className="absolute right-[16%] top-[10%] h-[420px] w-[420px] rotate-[18deg] rounded-[38%] bg-gradient-to-br from-white/[0.14] via-white/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/10" />
        <div className="absolute bottom-[12%] right-[32%] h-[260px] w-[260px] -rotate-12 rounded-[44%] bg-gradient-to-tr from-red-500/25 via-white/[0.04] to-transparent ring-1 ring-white/10 backdrop-blur-sm" />
        <div className="absolute left-[38%] top-[42%] h-[180px] w-[180px] rotate-45 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md" />

        {/* grain */}
        <div
          className="absolute inset-0 opacity-[0.16] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-transparent to-[#07070a]/60" />
      </div>

      {/* -------------------------------- layout -------------------------------- */}
      <div className="relative z-10 flex min-h-dvh gap-6 p-4 sm:p-6">
        <Sidebar />

        <main className="min-w-0 flex-1 pb-6">
          <header className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-500 sm:flex">
              Library <ChevronRight size={12} /> <span className="text-gray-300">Tonight</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="hidden h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10 hover:text-white sm:grid"
                aria-label="Search"
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-semibold text-gray-950 transition hover:bg-gray-200"
              >
                <Play size={14} fill="currentColor" /> Resume
              </button>
            </div>
          </header>

          <section className="relative mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl sm:rounded-[28px] sm:p-10">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-red-400/90">Featured tonight</p>
            <h1 className="mt-3 max-w-xl text-[26px] font-semibold leading-[1.2] tracking-tight text-white sm:text-[40px] sm:leading-tight">
              The glass sidebar, rebuilt for people who skim.
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-gray-400 sm:text-sm">
              A frosted, edge-to-edge navigation shell with a red active row, animated collapse and buttery 500&nbsp;ms
              transitions — hit <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-gray-300">Collapse</span> to
              see the icons-only state.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-full bg-red-600 px-5 text-[12.5px] font-semibold text-white shadow-[0_14px_40px_-14px_rgba(239,68,68,0.9)] transition hover:bg-red-500"
              >
                <Play size={15} fill="currentColor" /> Start watching
              </button>
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-[12.5px] font-medium text-gray-200 backdrop-blur transition hover:bg-white/10"
              >
                <Plus size={15} /> Add to My List
              </button>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CARDS.map((card) => (
              <article
                key={card.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className={`mb-4 h-28 w-full rounded-2xl bg-gradient-to-br ${card.from} ${card.to} ring-1 ${card.ring} transition duration-500 group-hover:scale-[1.01]`}>
                  <div className="h-full w-full rounded-2xl bg-[radial-gradient(120%_120%_at_20%_0%,rgba(255,255,255,0.35),transparent_55%)] opacity-70" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[13.5px] font-semibold text-white">{card.title}</h2>
                    <p className="mt-0.5 text-[11px] text-gray-500">{card.meta}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Play ${card.title}`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-200 transition hover:bg-white/10 hover:text-white"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-white">Continue watching</h2>
              <button type="button" className="text-[11px] font-medium text-gray-400 transition hover:text-white">
                See all
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {[
                ['Neon Districts', 'S2 · E4 · 24 min left', 'w-[68%]', 'bg-red-500'],
                ['Silent Orbit', '1h 06m left', 'w-[42%]', 'bg-indigo-400'],
                ['Paper Kingdom', 'S1 · E1 · 39 min left', 'w-[18%]', 'bg-emerald-400'],
              ].map(([title, meta, width, color]) => (
                <div key={title} className="flex items-center gap-4">
                  <div className="h-11 w-16 shrink-0 rounded-xl bg-white/[0.06] ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[12.5px] font-medium text-gray-200">{title}</p>
                      <p className="hidden shrink-0 text-[10.5px] text-gray-500 sm:block">{meta}</p>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full ${width} ${color} rounded-full`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
