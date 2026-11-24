# SideBar UI — Glassmorphism collapsible sidebar

A polished, fully collapsible navigation rail built with **React 18 + Tailwind CSS + lucide-react**.
Dark frosted glass, edge-to-edge red active row, 500 ms spring-ish collapse, keyboard shortcut `⌘B / Ctrl+B`.

## Run it

```bash
cd sidebar-ui
npm install
npm run dev        # http://localhost:5180
```

`npm run build` produces a static bundle in `dist/`.

## Drop it into an existing project

1. `npm i lucide-react`
2. Copy `src/components/Sidebar.jsx` and the avatar (`src/assets/avatar.webp`).
3. Make sure Tailwind scans the file (`content: ['./src/**/*.{js,jsx}']`).
4. Render `<Sidebar />` inside a relatively-positioned, dark container — the glass needs
   something colourful behind it for the `backdrop-blur-xl` to read.

```jsx
import Sidebar from './components/Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-dvh gap-6 bg-[#07070a] p-4">
      <Sidebar />
      <main className="min-w-0 flex-1">{/* your content */}</main>
    </div>
  );
}
```

## Responsive behaviour

| Viewport | Sidebar | Content |
| --- | --- | --- |
| **< 768px** (phones) | Off-canvas drawer, hidden by default, opened from the sticky top bar. Scrim, ESC, scrim-tap and picking a nav item all close it; body scroll locks; focus moves in and returns to the ☰ button; closed drawer is `inert` + `aria-hidden`. | 1-column, full-width buttons, 44px touch targets, safe-area padding. |
| **768–1023px** (tablets) | In-flow icon rail (92px) that expands to 336px in place, pushing the content (no overlay). | Auto-fit card grid, breadcrumb header, condensed meta. |
| **≥ 1024px** (desktop) | In-flow floating glass card, 336px, collapsible with the pill or `⌘B`. | Auto-fit cards (240px min), layout capped at 1560px and centred. |

The demo page (`src/App.jsx`) wires the drawer: it owns `navOpen`, renders the mobile top bar and passes
`mobileOpen` / `onMobileClose` down.

## API

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialCollapsed` | `boolean` | auto (`window.innerWidth < 1024`) | Forces the initial rail state on tablet/desktop. |
| `mobileOpen` | `boolean` | `false` | Drawer visibility **below 768px** (ignored on larger screens). |
| `onMobileClose` | `() => void` | – | Called by the scrim, the ✕ button, `Esc`, or after a nav item is chosen. |

## Behaviour

- **Expanded:** 336 px — traffic lights, title, bell (badge 4), “Collapse” pill, profile, search, grouped nav.
- **Collapsed:** 92 px — icons only, labels/search/profile text fade to zero width, tooltips via `title`,
  badges become dots, section titles become hairlines.
- Active item: `bg-red-600`, edge-to-edge, filled white `Home` icon.
- Hover: `hover:bg-white/5`; focus ring for keyboard users; `aria-expanded` / `aria-current` / `aria-label`.
- `⌘B` / `Ctrl+B` toggles; `prefers`-independent CSS transitions only (no layout libraries).
