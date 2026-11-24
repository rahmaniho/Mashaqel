import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Film,
  Flame,
  Gamepad2,
  Home,
  ListVideo,
  LogOut,
  PlayCircle,
  Search,
  Settings,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';

import useMediaQuery from '../hooks/useMediaQuery';
import avatar from '../assets/avatar.webp';

/* -------------------------------------------------------------------------- */
/*                                  Nav data                                  */
/* -------------------------------------------------------------------------- */

const SECTIONS = [
  {
    title: 'Menu',
    items: [
      { id: 'home', label: 'Home', icon: Home, filledWhenActive: true },
      { id: 'continue', label: 'Continue watching', icon: PlayCircle },
      { id: 'list', label: 'My List', icon: ListVideo, badge: 7 },
      { id: 'series', label: 'Series', icon: Tv },
      { id: 'movies', label: 'Movies', icon: Film },
      { id: 'games', label: 'Games', icon: Gamepad2 },
    ],
  },
  {
    title: 'Discovery',
    items: [
      { id: 'releases', label: 'Releases', icon: Sparkles },
      { id: 'popular', label: 'Popular', icon: Flame },
    ],
  },
  {
    title: 'General',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'logout', label: 'Log out', icon: LogOut, danger: true },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                                   Pieces                                   */
/* -------------------------------------------------------------------------- */

/** Animated text: collapses its own width + opacity, so the icon never moves. */
function Label({ show, className = '', children }) {
  return (
    <span
      className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ease-out ${
        show ? 'ml-3 max-w-[190px] opacity-100' : 'ml-0 max-w-0 opacity-0'
      } ${className}`}
      aria-hidden={!show}
    >
      {children}
    </span>
  );
}

function TrafficLights({ small }) {
  const dot = small ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className={`${dot} rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.35)] transition-all duration-500`} />
      <span className={`${dot} rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.35)] transition-all duration-500`} />
      <span className={`${dot} rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.35)] transition-all duration-500`} />
    </div>
  );
}

function NavItem({ item, active, rail, onSelect }) {
  const Icon = item.icon;
  const isDanger = item.danger && !active;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? 'page' : undefined}
        title={rail ? item.label : undefined}
        className={[
          'group relative flex h-11 w-full items-center text-[13px] font-medium transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40',
          rail ? 'justify-center px-0' : 'gap-0 px-4',
          active
            ? 'bg-red-600 text-white shadow-[0_10px_28px_-12px_rgba(239,68,68,0.95)]'
            : isDanger
              ? 'text-gray-400 hover:bg-white/5 hover:text-red-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white',
        ].join(' ')}
      >
        <span className="relative grid shrink-0 place-items-center">
          <Icon
            size={19}
            strokeWidth={active ? 2 : 1.75}
            fill={active && item.filledWhenActive ? 'currentColor' : 'none'}
            className={`transition-colors duration-200 ${
              active ? 'text-white' : isDanger ? 'text-gray-500 group-hover:text-red-300' : 'text-gray-400 group-hover:text-white'
            }`}
          />
          {item.badge && rail ? (
            <span className="pointer-events-none absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#16161b]" />
          ) : null}
        </span>

        <Label show={!rail} className="text-left">
          {item.label}
        </Label>

        {item.badge && !rail ? (
          <span className="ml-auto shrink-0 rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-[18px] text-white">
            {item.badge}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Sidebar                                   */
/* -------------------------------------------------------------------------- */

/**
 * Responsive glass navigation.
 *  · phone  (<768px)   → off-canvas drawer, opened from the page header
 *  · tablet (768–1023) → in-flow icon rail, expandable in place
 *  · desktop (≥1024)   → in-flow expanded floating card
 */
export default function Sidebar({ initialCollapsed, mobileOpen = false, onMobileClose }) {
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isDrawer = !isTabletUp;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof initialCollapsed === 'boolean') return initialCollapsed;
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const [activeId, setActiveId] = useState('home');

  const asideRef = useRef(null);

  // The rail only exists on tablet/desktop; the drawer always shows full labels.
  const rail = collapsed && !isDrawer;

  const toggle = useCallback(() => setCollapsed((value) => !value), []);

  const select = useCallback(
    (id) => {
      setActiveId(id);
      if (isDrawer) onMobileClose?.();
    },
    [isDrawer, onMobileClose],
  );

  // ⌘B / Ctrl+B collapses the rail (desktop/tablet only)
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && !isDrawer) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawer, toggle]);

  // Drawer: ESC to close, scroll lock, focus in/out, and a light focus trap.
  useEffect(() => {
    if (!isDrawer || !mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = asideRef.current;
    const focusables = () =>
      [...(node?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

    // move focus into the drawer
    const first = focusables()[0];
    first?.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMobileClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawer, mobileOpen, onMobileClose]);

  // A closed drawer must be unreachable for keyboard + screen readers.
  useEffect(() => {
    const node = asideRef.current;
    if (!node) return;
    node.inert = isDrawer ? !mobileOpen : false;
  }, [isDrawer, mobileOpen]);

  // Give focus back to the page when the drawer closes.
  useEffect(() => {
    if (!isDrawer || mobileOpen) return;
    if (asideRef.current?.contains(document.activeElement)) {
      document.activeElement?.blur?.();
    }
  }, [isDrawer, mobileOpen]);

  const shell = useMemo(() => {
    const base = [
      'flex shrink-0 flex-col overflow-hidden rounded-[28px]',
      'border border-white/10 bg-gray-900/60 backdrop-blur-xl backdrop-saturate-150',
      'shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.03)_inset]',
      'transition-[width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
    ];

    if (isDrawer) {
      return [
        ...base,
        'fixed inset-y-3 left-3 z-50 h-auto max-h-[calc(100dvh-1.5rem)]',
        'w-[min(336px,calc(100vw-1.5rem))]',
        mobileOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-[115%] opacity-0',
      ].join(' ');
    }

    return [
      ...base,
      'relative z-10 h-[calc(100dvh-2rem)]',
      collapsed ? 'w-[92px]' : 'w-[336px]',
    ].join(' ');
  }, [collapsed, isDrawer, mobileOpen]);

  return (
    <>
      {/* drawer scrim */}
      <div
        onClick={() => onMobileClose?.()}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isDrawer && mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="app-sidebar"
        ref={asideRef}
        className={shell}
        aria-label="Main navigation"
        aria-modal={isDrawer && mobileOpen ? 'true' : undefined}
        aria-hidden={isDrawer && !mobileOpen ? 'true' : undefined}
        role={isDrawer ? 'dialog' : undefined}
        data-collapsed={rail}
        data-drawer-open={isDrawer ? mobileOpen : undefined}
      >
        {/* glass highlights */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/[0.055] via-transparent to-black/20" />
        <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-red-500/10 blur-3xl" />

        {/* ------------------------------- header ------------------------------ */}
        <header className={`relative flex items-center transition-all duration-500 ${rail ? 'flex-col gap-3 px-2 pt-4' : 'gap-3 px-4 pt-4'}`}>
          <div className={rail ? 'flex w-full justify-center' : 'flex'}>
            <TrafficLights small={rail} />
          </div>

          <Label show={!rail} className="!ml-0 flex-1">
            <span className="text-[15px] font-semibold tracking-tight text-white">SideBar UI</span>
          </Label>

          <div className={`flex items-center ${rail ? 'gap-1' : 'ml-auto gap-2'}`}>
            <button
              type="button"
              aria-label="Notifications — 4 unread"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-gray-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Bell size={rail ? 15 : 16} strokeWidth={1.8} />
              <span
                className={`absolute grid place-items-center rounded-full bg-red-600 font-bold text-white ring-2 ring-[#101014] transition-all duration-300 ${
                  rail
                    ? '-right-0.5 -top-0.5 h-2.5 w-2.5 ring-2'
                    : '-right-1 -top-1 h-[18px] min-w-[18px] px-1 text-[10px] leading-none'
                }`}
              >
                {rail ? '' : '4'}
              </span>
            </button>

            {isDrawer ? (
              <button
                type="button"
                onClick={() => onMobileClose?.()}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-gray-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <X size={16} strokeWidth={2} />
              </button>
            ) : rail ? (
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar (⌘B)"
                title="Expand sidebar — ⌘B"
                aria-expanded={false}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-gray-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar (⌘B)"
                title="Collapse sidebar — ⌘B"
                aria-expanded
                className="flex h-9 items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[11.5px] font-medium text-gray-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Collapse
                <ChevronLeft size={14} strokeWidth={2.2} className="text-gray-400" />
              </button>
            )}
          </div>
        </header>

        {/* -------------------------------- user ------------------------------- */}
        <div className={`relative mt-4 ${rail ? 'px-2' : 'px-3'}`}>
          <button
            type="button"
            title={rail ? 'Dorian — switch account' : undefined}
            className={`group flex w-full items-center rounded-2xl p-2 text-left transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              rail ? 'justify-center' : 'gap-3'
            }`}
          >
            <span className="relative shrink-0">
              <img
                src={avatar}
                alt="Dorian"
                className={`rounded-full object-cover ring-1 ring-white/15 transition-all duration-500 ${rail ? 'h-10 w-10' : 'h-11 w-11'}`}
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#141418]" />
            </span>

            <span className={`flex min-w-0 flex-col ${rail ? 'hidden' : ''}`}>
              <Label show={!rail} className="!ml-0">
                <span className="text-[13.5px] font-semibold text-white">Dorian</span>
              </Label>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 transition group-hover:text-gray-300">
                <ChevronsUpDown size={12} strokeWidth={1.9} />
                <span className="truncate">Switch account</span>
                <ChevronRight size={12} strokeWidth={2} className="ml-auto opacity-60" />
              </span>
            </span>
          </button>
        </div>

        {/* ------------------------------- search ------------------------------ */}
        <div
          className={`relative overflow-hidden transition-all duration-500 ease-out ${
            rail ? 'pointer-events-none max-h-0 opacity-0' : 'max-h-16 opacity-100'
          }`}
          aria-hidden={rail}
        >
          <div className="relative px-3 pt-3">
            <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 ml-3 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              placeholder="SEARCH..."
              aria-label="Search"
              tabIndex={rail ? -1 : 0}
              className="h-11 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-12 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-100 outline-none transition placeholder:text-gray-500 hover:bg-white/[0.07] focus:border-white/20 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/5 md:h-10"
            />
            <kbd className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[9px] font-medium text-gray-400 md:block">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* -------------------------------- nav -------------------------------- */}
        <nav className="relative mt-4 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent]">
          {SECTIONS.map((section, index) => (
            <div key={section.title} className={index === 0 ? '' : 'mt-4'}>
              <div className={`mb-1.5 flex items-center ${rail ? 'justify-center' : 'px-4'}`}>
                {rail ? (
                  <span className="h-px w-6 bg-white/10" />
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{section.title}</span>
                )}
              </div>

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.id} item={item} active={activeId === item.id} rail={rail} onSelect={select} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* ------------------------------- footer ------------------------------ */}
        <div className={`relative border-t border-white/[0.07] pb-[max(0.75rem,env(safe-area-inset-bottom))] ${rail ? 'px-2 pt-3' : 'px-4 pt-3'}`}>
          <div className={`flex items-center ${rail ? 'justify-center' : 'gap-2'} text-[10.5px] text-gray-500`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
            <Label show={!rail} className="!ml-1.5">
              <span className="whitespace-nowrap">All systems operational</span>
            </Label>
          </div>
        </div>
      </aside>
    </>
  );
}
