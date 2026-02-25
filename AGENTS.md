# AGENTS.md — mdash-chrome

## Project Overview

**mdash-chrome** is a Chrome extension (Manifest V3) that replaces the browser's "New Tab" page with a minimal, tile-based bookmark dashboard. Bookmarks are organized into sections (folders) displayed in a two-column layout. The extension syncs directly with the Chrome Bookmarks API — all data stays local in the browser.

**Version**: 1.6.4
**License**: Personal use only (no commercial redistribution)

## Key Features

- Two-column bookmark dashboard (left / right, controlled by `+` / `-` prefix in folder names)
- Responsive CSS Grid layout for columns (auto-switches to one column on smaller screens)
- Edit button as a standalone pill to the left of the controls menu for instant one-click access
- Collapsible top-right controls pill with glass-style surface; expands downward on click
- Edit mode: inline editing, adding, deleting, and renaming sections
- Edit bookmark dialog uses a custom-styled section dropdown with full keyboard navigation (arrows + Enter/Space)
- Edit mode bottom CTA (`+`) to create a new section/folder directly from dashboard UI
- Edit mode section-header remove button (`×`) to delete an entire section/folder (including nested bookmarks) with confirmation
- Drag & drop reordering of bookmarks between sections
- Drag & drop sections between columns (left ↔ right); automatically updates `+`/`-` prefix
- Custom section colors: colored dot next to section title, stored as `#RRGGBB` suffix in folder name (e.g. `+Productivity #4CAF50`); editable via color palette popup in edit mode
- Sort bookmarks within a section (A→Z / Z→A toggle button in edit mode); reorders via Chrome Bookmarks API with full undo support
- Click statistics: per-bookmark click counter persisted in `localStorage`, subtle badge on tiles, tracks clicks from both dashboard and Spotlight
- Undo for all destructive/mutating operations (30-second window): bookmark delete, update, create, drag & drop move; section create, delete, rename, column move, color change, sort
- Spotlight search modal (Option+F on macOS, Ctrl+F on Windows) with results list, keyboard navigation, highlighted matches, and background-tab open via middle-click / Cmd/Ctrl+click without navigating the current tab
- Light and dark themes (persisted in localStorage)
- Font size control: small, medium, large (persisted in localStorage)
- Improved keyboard accessibility with visible focus rings on interactive controls
- In edit mode, `Escape` closes an open add/edit dialog before leaving edit mode
- Smooth animated transitions: controls panel expand/collapse, bookmark remove, custom select dropdown, drag placeholders with pulse animation
- Full ARIA support: spotlight search, edit toggle, controls panel, help button, column regions, get-started dialog
- Custom favicon mapping for known services (ArgoCD, Grafana, Jenkins, etc.) via `icons/icons.json`
- Favicon caching via Chrome `_favicon` API + `localStorage` — icons are converted to base64 via canvas and served from cache on subsequent visits (including offline); writes are quota-aware, and `refresh icons` always purges `fav:*` cache first, then rebuilds
- Google S2 favicon fallback for all other bookmarks
- `ICON_OVERRIDE` suffix in bookmark titles to force icon map lookup
- `[VPN]` marker in titles to skip hostname normalization for favicons
- Privacy-first: zero external data collection

## File Structure

```
mdash-chrome/
├── manifest.json              # Chrome Extension manifest (v3)
├── html/
│   └── dashboard.html         # Main HTML — new tab override
├── js/
│   ├── mdash.js               # Application logic (all modules)
│   ├── mdash-ui.js            # UI toolkit (Dialog, Overlay, Notification, etc.)
│   └── jquery-3.7.1.min.js    # jQuery (only external dependency)
├── css/
│   ├── styles.css             # Main styles: layout, tiles, themes, search, controls
│   └── ui.css                 # UI toolkit styles: dialogs, overlays, notifications
├── icons/
│   └── icons.json             # Keyword → icon filename mapping for custom favicons
├── pack.sh                    # Build script — creates distributable .zip
├── PRIVACY                    # Privacy policy
├── LICENSE                    # License (personal use only)
└── .gitignore
```

## Functional Architecture

All application modules live in `js/mdash.js` as IIFE (Immediately Invoked Function Expressions) sharing the `window.mdash` namespace. The UI toolkit in `js/mdash-ui.js` exposes the global `ui` object.

### Module Dependency Graph

```
Dashboard (orchestrator)
├── Manager          — Chrome Bookmarks API wrapper (parses section colors)
├── Column (×2)      — Renders sections (with color dot) and bookmark tiles (with click count)
│   └── AddBtn       — "Add bookmark" modal per section
├── FontCtrl         — Font size dropdown
├── HelpCtrl         — Help/get-started toggle
├── ThemeCtrl        — Light/dark theme dropdown
├── EditCtrl         — Edit mode, drag & drop, delete, rename, color palette, sort
├── Stats            — Click statistics tracker (localStorage)
├── KeyboardManager  — Keyboard shortcuts (currently disabled)
└── Spotlight        — Spotlight-style search modal (tracks clicks)
```

### Module Descriptions

| Module | Namespace | Responsibility |
|---|---|---|
| **Manager** | `mdash.Manager` | Wraps `chrome.bookmarks` API. Locates or creates the `[Dashboard]` root folder and its `[MDASH_DO_NOT_DELETE]` placeholder. Fetches sections and their bookmarks. Determines side assignment (`+` → left, `-` → right). Parses optional `#RRGGBB` color suffix from folder titles. |
| **Column** | `mdash.Column` | Renders one column (left or right) by iterating sections and calling `renderSection()` / `renderBookmark()`. Appends an `AddBtn` to each section. Manages column visibility. |
| **FontCtrl** | `mdash.FontCtrl` | Dropdown control for font sizes (`small`, `medium`, `large`). Persists selection in `localStorage.fontSize`. Applies CSS class to `<body>`. |
| **HelpCtrl** | `mdash.HelpCtrl` | Toggles visibility between the help/get-started panel and the bookmarks interface. |
| **EditCtrl** | `mdash.EditCtrl` | Toggles edit mode (`html.edit` class). In edit mode: click tile to edit (title, URL, section), Delete key to remove, click section title to rename, click section color dot to open color palette, use sort button to sort bookmarks A→Z/Z→A, use section-header `button.section-remove` to delete a whole section via `chrome.bookmarks.removeTree()`, use bottom `#add-section-cta` to create a new section (with column + color selection), drag & drop tiles between sections, and drag & drop sections between columns. The bookmark edit dialog uses a custom in-dialog section picker. Provides undo for all operations. |
| **ThemeCtrl** | `mdash.ThemeCtrl` | Dropdown for light/dark theme. Toggles `theme-light` / `theme-dark` on `<html>`. Persists in `localStorage['mdash:theme']`. |
| **KeyboardManager** | `mdash.KeyboardManager` | Keyboard-driven tile filtering. Guarded by `isEnabled()` check (disabled by default in localStorage). |
| **AddBtn** | `mdash.AddBtn` | Per-section "+" button rendered as a tile at the end of the section list in edit mode. Opens a confirmation dialog to add a new bookmark. Normalizes URLs (prepends `http://` if needed). |
| **Spotlight** | `mdash.Spotlight` | Spotlight-style search modal (Option+F / Ctrl+F). Shows a centered overlay with input + results list. Matches by title and URL. Keyboard navigation (↑/↓/Enter/Esc). Results show favicon, title (with highlighted match), URL, and section name. Tracks click statistics on open. Supports opening in a background tab (`chrome.tabs.create` with `active: false`) using middle-click or Cmd/Ctrl+click while keeping the current tab on Spotlight. |
| **Stats** | `mdash.stats` | Click statistics tracker. Persists per-URL click counts in `localStorage['mdash:clicks']` as a JSON object. Provides `trackClick(url)` and `getCount(url)`. |
| **Dashboard** | `mdash.Dashboard` | Main orchestrator. Initializes all modules, preloads the icon map, loads bookmarks into two columns, sets up the UI toolkit, sets up click tracking, handles the collapsible controls panel, and handles the "refresh icons" action. Works with the responsive grid/controls layout defined in CSS. |

### UI Toolkit (`js/mdash-ui.js`)

The `ui` global provides:

| Component | Description |
|---|---|
| `ui.Emitter` | Simple event emitter (on/off/emit/once) |
| `ui.Dialog` | Modal/non-modal dialog with effects (fade/slide/scale) |
| `ui.Confirmation` | Dialog with OK/Cancel buttons and callback |
| `ui.Overlay` | Full-screen overlay backdrop |
| `ui.Notification` | Toast notifications (auto-hide, closable, types: info/warn/error) |
| `ui.ContextMenu` | Right-click context menu |
| `ui.ColorPicker` | Canvas-based color picker (unused by the extension) |
| `ui.Card` | Flip card component (unused by the extension) |

### Favicon Resolution Strategy

1. On init, the icons map (`icons/icons.json`) is loaded locally first (via `chrome.runtime.getURL`), with remote GitHub fallback.
2. For each bookmark tile:
   - If title contains `ICON_OVERRIDE` suffix → look up icons map only.
   - Otherwise → try icons map by keyword match (title + hostname), fall back to Google S2 favicon service.
   - If title contains `[VPN]` → skip hostname normalization (use exact subdomain).
3. On image load error, the next candidate URL from the fallback list is tried.

### Data Model (Chrome Bookmarks)

```
Bookmarks Root
└── Other Bookmarks (or any parent)
    └── [Dashboard]                         ← root folder (auto-created)
        ├── [MDASH_DO_NOT_DELETE]           ← placeholder bookmark (about:blank)
        ├── +Section Name                   ← folder → left column section
        │   ├── Bookmark 1
        │   └── Bookmark 2
        ├── +Productivity #4CAF50           ← folder with custom color
        │   └── Bookmark 3
        └── -Another Section               ← folder → right column section
            └── Bookmark 4
```

Section titles support an optional color suffix: `+Title #RRGGBB` or `-Title #RRGGBB`. The `#RRGGBB` is parsed at load time, stripped from the display title, and rendered as a colored dot next to the section header.

### Persistence

| Key | Storage | Value |
|---|---|---|
| `fontSize` | localStorage | `small` / `medium` / `large` |
| `mdash:theme` | localStorage | `light` / `dark` |
| `mdash:keyboard:isEnabled` | localStorage | `enabled` / `disabled` |
| `mdash:clicks` | localStorage | JSON object `{ "url": count, ... }` — per-URL click statistics |

### Build & Packaging

`pack.sh` reads the version from `manifest.json` and creates a zip archive excluding `.git`, `.DS_Store`, `node_modules`, `pack.sh`, and `icons/`.

```bash
./pack.sh   # produces ../mdash-chrome-<version>.zip
```

## Design System (v2 — Minimal Elegant)

Visual direction: clean, airy, Linear/Vercel-inspired. Near-white backgrounds, crisp typography, ultra-subtle shadows, generous whitespace. Dark theme uses true grey (not navy).

### Design Tokens (CSS Custom Properties)

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg-color` | `#F5F5F7` | `#1C1C1E` | Page background |
| `--text-color` | `#1C1C1E` | `#F5F5F7` | Primary text |
| `--muted-color` | `#8E8E93` | `#A1A1A6` | Secondary/muted text (WCAG AA in dark) |
| `--accent-color` | `#2E7D32` | `#3E9443` | Links, accents, active states |
| `--tile-bg` | `#FFFFFF` | `#2C2C2E` | Tile background |
| `--tile-hover-bg` | `#F2F2F7` | `#3A3A3C` | Tile hover background |
| `--tile-shadow` | ultra-subtle `0 1px 3px` | `0 1px 3px` darker | Tile resting shadow |
| `--tile-radius` | `12px` | `12px` | Tile border-radius |
| `--surface-border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | Subtle borders |
| `--surface-strong` | `rgba(255,255,255,0.82)` | `rgba(44,44,46,0.72)` | Glass surfaces |
| `--hover-shadow` | `0 4px 12px` | `0 4px 12px` darker | Hover elevation |
| `--section-color` | `#3C3C43` | `#AEAEB2` | Section header text |
| `--focus-ring` | green 42% | green 48% | Focus indicators |

### Key Visual Rules

- No background pattern — flat solid `--bg-color`
- Section headers: sentence case (no uppercase), font-weight 600, letter-spacing 0.03em
- Tiles: 12px radius, 10.5em width, ultra-subtle shadows, gentle hover lift (-1px)
- Controls pill: frosted glass with 12px blur, compact collapsed state, expands downward in a single rounded box
- Spotlight modal: 14px radius, consistent shadow language
- Edit-mode hover: soft warm tint (`#FFF3E0` light / `#FFF8E1` dark)
- Grid gap: 24px row / 32px column
- Scrollbars: 6px wide, very low opacity
- DnD placeholders: pulsing animation for clear visual feedback
- Controls panel: animated expand/collapse (opacity + scale + transform, 120ms)
- All interactive elements: smooth transition on hover/focus (80-120ms)

## Documentation Policy

- **`README.md`** contains the user-facing feature list of the extension. Whenever a feature is added, removed, or significantly changed, `README.md` must be updated to reflect the current state.
- **`AGENTS.md`** contains the technical architecture and internal conventions. Keep both files in sync.

## Version Bumping Policy

Version follows **semver** (`MAJOR.MINOR.PATCH`). The version must be updated in **three places** simultaneously:

1. `manifest.json` → `"version"`
2. `js/mdash.js` → `Dashboard.VERSION`
3. `AGENTS.md` → `**Version**` field at the top

### When to bump automatically

| Change type | Bump | Examples |
|---|---|---|
| Bug fix, style tweak, refactor, internal cleanup | **PATCH** (+0.0.1) | CSS fix, CORS fix, cache logic fix |
| New user-facing feature, new UI element, new permission | **MINOR** (+0.1.0, reset patch to 0) | Spotlight search, undo, favicon caching, drag & drop sections |
| Breaking change, major architecture rewrite, data migration | **MAJOR** (+1.0.0, reset minor+patch to 0) | Manifest version change, storage format migration |

### Rules

- **MANDATORY**: After every code change (fix, feature, refactor), bump the version according to the table above. This is not optional — every change must end with a version bump.
- **MANDATORY**: When finishing a batch of changes (before ending your turn or moving on to a different topic), always perform the version bump as the final step. Never leave a session with unbumped changes.
- If multiple changes are made in one session, bump once at the end covering all changes.
- Never skip a bump when the extension zip would need to be re-uploaded to Chrome Web Store.
- Do not wait for the user to ask — bump proactively after completing changes.

## Development Conventions

- **No build system / bundler** — vanilla JS, no transpilation, no npm dependencies.
- **Module pattern** — each module is an IIFE adding to `window.mdash`.
- **Prototype-based OOP** — constructors with `.prototype` methods.
- **jQuery 3.7.1** — used for DOM manipulation (loaded from `js/`).
- **No template engine** — sections and bookmarks are built with direct jQuery DOM construction (safe by default).
- **CSS custom properties** — design tokens in `:root` for theming (v2 minimal elegant palette).
- **No tests** — no test framework or test files.

## DnD Architecture

Two independent drag & drop systems coexist in edit mode:

| System | Event namespace | Flag | Drag handle | Drop target |
|---|---|---|---|---|
| **Tile DnD** | `.mdash` | `_dragging` | Bookmark `<a>` tiles | `<section>` elements |
| **Section DnD** | `.mdash-section` | `_sectionDragging` | Section `<h1>` titles | `.left` / `.right` columns |

Guards prevent interference: tile handlers check `if( self._sectionDragging ) return;` and section handlers check `if( !self._sectionDragging ) return;`.

When a section is moved between columns:
1. DOM `<section>` element is repositioned at the placeholder location.
2. Chrome bookmark folder title prefix is updated (`+` ↔ `-`) via `chrome.bookmarks.update()`.
3. Manager's cached `folder.children` is invalidated.

## Security Hardening (v1.4.2)

- **URL validation**: `mdash.util.isSafeUrl()` rejects `javascript:`, `data:`, `vbscript:` URIs. Applied in `renderBookmark`, `normalizeUrl`, `Spotlight.openHref`.
- **DOM injection prevention**: All undo notifications (`_undoNotify`, remove, update) build content via `document.createTextNode()` / `$().text()` instead of HTML string concatenation. Section `<select>` uses `$('<option>').val().text()`.
- **ICanHaz.js / Mustache.js removed**: Replaced `ich.section()` / `ich.bookmark()` with direct DOM construction via `$('<element>').attr().text()`. Eliminates all template-based injection vectors.
- **Explicit CSP**: `manifest.json` defines `content_security_policy` restricting `img-src`, `style-src`, `connect-src` to known origins (including explicit Google favicon CDN hosts: `www.gstatic.com`, `t0.gstatic.com`…`t3.gstatic.com`).
- **Local icons map**: `icons/icons.json` loaded via `chrome.runtime.getURL()` first, remote GitHub fallback only if local is unavailable.
- **jQuery 3.7.1**: Upgraded from 3.2.1 (addresses CVE-2020-11022, CVE-2020-11023, CVE-2019-11358).
- **mdash-ui.js**: ContextMenu `.add()` and Card `.render()` use safe DOM construction instead of HTML string concatenation.
- **Removed**: `contextMenus` permission (unused), `keymaster.min.js` (unused dead code).
- **Favicon stability fix**: `_favicon` background load validates icon quality (opaque + dark pixel thresholds), caches valid results, and upgrades the visible icon immediately when valid to avoid requiring a second page refresh after cache purge.
- **Refresh behavior fix**: `refresh icons` now always purges favicon cache (`localStorage` `fav:*` + memory). Normal click purges then reloads page (full rebuild); `Alt+click` purges then rebuilds favicons in place with full title/override/VPN-aware resolution logic.
- **Local dev favicon correctness fix**: cache key now uses full page origin (protocol + host + port), preventing collisions across `127.0.0.1:*` / `localhost:*`; host normalization for S2 fallback is skipped for IP/localhost hosts so `127.0.0.1` is never collapsed to invalid roots (e.g. `0.1`).
- **Cache resilience/performance fix**: `_saveFaviconToLocalStorage()` handles `QuotaExceededError` by evicting a controlled fraction of `fav:*` entries (~20%) and retrying once; in-place refresh uses a concurrency guard and batched processing; background favicon loaders clean up handlers on `load`/`error`.
- **Top-gap layout fix**: controls are now a compact, fixed top-right pill that expands downward on demand; right-column-only offset was removed so left/right columns start aligned.

## UI Polish (v1.5.0)

- **Animated transitions**: controls panel expand/collapse (opacity + scale + transform, 120ms), bookmark remove (opacity + scale + max-height collapse), custom select dropdown (opacity + translateY, 100ms).
- **Dark mode completeness**: `ui.css` rewritten to use CSS custom properties with fallbacks — dialogs, notifications, context menu, overlay, close buttons, and card component all inherit theme tokens automatically.
- **Custom select keyboard**: full arrow-key navigation (↑/↓), Enter/Space to select, Escape to close, focused-option highlighting with scroll-into-view.
- **ARIA accessibility**: spotlight input (`aria-label`, `aria-controls`), results list (`role="listbox"`), edit toggle (`aria-pressed`), controls toggle (`aria-controls`, `role="button"`), help button (`aria-label`), column regions (`role="region"`), get-started overlay (`role="dialog"`, `aria-labelledby`), refresh icons (`aria-label`).
- **Visual polish**: link hover feedback (opacity fade), controls/dropdown items hover transition (100ms), drop placeholder pulse animation, stronger section header underline, higher muted-color contrast in dark mode (`#A1A1A6` vs `#8E8E93`).
- **Consistency**: unified `outline-offset: 2px` on all focus rings, input `border-radius: 10px` matching custom select, `width: 100%` + `box-sizing: border-box` on all form inputs.
- **Performance**: `requestAnimationFrame` for drag-start class and spotlight focus instead of `setTimeout`, smooth `scrollIntoView` for spotlight keyboard navigation.
- **Removed**: legacy `-webkit-` only prefixes in `ui.css` replaced with standard properties (with `-webkit-` kept where needed for older Chromium).

## Known Issues

- Drag & drop handler code for tiles is duplicated in three places (enableDragAndDrop, remove undo, AddBtn).
- `img/icon.png` referenced but not in repository.
