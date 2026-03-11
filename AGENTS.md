# AGENTS.md — mdash-chrome

## Project Overview

**mdash-chrome** is a Chrome extension (Manifest V3) that replaces the browser's "New Tab" page with a minimal, tile-based bookmark dashboard. Bookmarks are organized into sections (folders) displayed in a two-column layout. The extension syncs directly with the Chrome Bookmarks API — all data stays local in the browser.

**Version**: 1.8.80
**License**: Personal use only (no commercial redistribution)

## Key Features

- Two-column bookmark dashboard (left / right, controlled by `+` / `-` prefix in folder names)
- Responsive CSS Grid layout for columns (auto-switches to one column on smaller screens)
- Bookmark links render as compact, low-noise pills (solid surface, subtle 1px divider border)
- Bookmark tile titles are rendered on a single line with adaptive tile width up to a 32-character cap; longer titles are truncated with `...`
- Subtle alternating group background in bookmark columns with phase offset: left starts dark/light, right starts light/dark
- Top-right quick actions: 34px circular wrench/gear icons at top-right; wrench toggles edit mode, gear opens the right-side slide-in settings panel
- Quick-action icons use local SVG assets (`icons/dashboard-edit.svg`, `icons/dashboard-gear.svg`)
- Edit mode: inline editing, adding, deleting, and renaming sections
- Sections can be collapsed/expanded via a chevron in each section header; state is persisted
- Edit bookmark dialog uses a custom-styled section dropdown with full keyboard navigation (arrows + Enter/Space)
- Edit bookmark dialog includes `DUPLICATE` action to clone bookmarks into the same or selected section
- Edit mode bottom CTA (`+`) to create a new section/folder directly from dashboard UI
- Edit mode section-header remove button (`×`) to delete an entire section/folder (including nested bookmarks) with confirmation
- Drag & drop reordering of bookmarks between sections (edit mode only; disabled in normal mode)
- Drag & drop sections between columns (left ↔ right) in edit mode; automatically updates `+`/`-` prefix
- Custom section colors: colored dot next to section title, stored as `#RRGGBB` suffix in folder name (e.g. `+Productivity #4CAF50`); editable via color palette popup in edit mode
- Sort bookmarks within a section (A→Z / Z→A toggle button in edit mode); reorders via Chrome Bookmarks API with full undo support
- Settings toggle for reduced/full motion preference
- Undo for all destructive/mutating operations (30-second window): bookmark delete, update, create, drag & drop move; section create, delete, rename, column move, color change, sort
- Spotlight search modal (Option+F on macOS, Ctrl+F on Windows) with debounced input, cached in-memory index, keyboard navigation, highlighted matches, and background-tab open via middle-click / Cmd/Ctrl+click without navigating the current tab
- Theme mode selector: auto/light/dark (`auto` follows OS preference and reacts to live system theme changes)
- Font size control: XXS, XS, S, M, L, XL, XXL, XXXL (persisted in localStorage; `S` maps to `small`, `M` maps to `medium`, `L` maps to `large`; bookmark tiles scale with bounded clamps and distinct low-end steps; XXS/XS remain readable)
- Settings-panel typography is fixed and does not scale with dashboard font-size selection
- XL+ dashboard presets use lighter text weights to avoid a visually over-bold look
- Improved keyboard accessibility with visible focus rings on interactive controls
- In edit mode, `Escape` closes an open add/edit dialog before leaving edit mode
- Holding `Option`/`Alt` while already in edit mode no longer exits persistent edit mode on key release
- Smooth animated transitions: settings panel slide-in/out, compact tag hover lift, bookmark remove, custom select dropdown, drag placeholders with pulse animation
- Full ARIA support: spotlight search, edit toggle, settings panel, help button, column regions, get-started dialog
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
│   ├── styles.css             # Main styles: layout, tiles, themes, search, settings panel
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
├── SectionState     — Persists collapsed section state by section ID
├── Column (×2)      — Renders sections (with color dot) and bookmark tiles
│   └── AddBtn       — "Add bookmark" modal per section
├── FontCtrl         — Font size selector
├── HelpCtrl         — Help/get-started toggle
├── ThemeCtrl        — Auto/light/dark theme selector
├── MotionCtrl       — Reduced-motion toggle
├── EditCtrl         — Edit mode, drag & drop, delete, rename, color palette, sort
├── KeyboardManager  — Keyboard shortcuts (currently disabled)
└── Spotlight        — Spotlight-style search modal
```

### Module Descriptions

| Module | Namespace | Responsibility |
|---|---|---|
| **Manager** | `mdash.Manager` | Wraps `chrome.bookmarks` API. Locates or creates the `[Dashboard]` root folder and its `[MDASH_DO_NOT_DELETE]` placeholder. Fetches sections and their bookmarks. Determines side assignment (`+` → left, `-` → right). Parses optional `#RRGGBB` color suffix from folder titles. |
| **SectionState** | `mdash.sectionState` | Persists collapsed/expanded section state in `localStorage['mdash:sections:collapsed']`. |
| **Column** | `mdash.Column` | Renders one column (left or right) by iterating sections and calling `renderSection()` / `renderBookmark()`. Appends an `AddBtn` to each section. Manages column visibility. |
| **FontCtrl** | `mdash.FontCtrl` | Settings-panel selector for font sizes (`xxs`, `xs`, `small`, `medium`, `large`, `xl`, `xxl`, `xxxl`). Persists selection in `localStorage.fontSize`. Applies CSS class to `<body>` for dashboard content only. |
| **HelpCtrl** | `mdash.HelpCtrl` | Toggles visibility between the help/get-started panel and the bookmarks interface. |
| **EditCtrl** | `mdash.EditCtrl` | Toggles edit mode (`html.edit` class). In edit mode: click tile to edit (title, URL, section), duplicate from the edit dialog (`DUPLICATE`), Delete key to remove, click section title to rename, click section color dot to open color palette, use sort button to sort bookmarks A→Z/Z→A, use section-header `button.section-remove` to delete a whole section via `chrome.bookmarks.removeTree()`, use bottom `#add-section-cta` to create a new section (with column + color selection), drag & drop tiles between sections, and drag & drop sections between columns. Also controls section collapse toggles and persists collapse state. The bookmark edit dialog uses a custom in-dialog section picker. Provides undo for all operations. |
| **ThemeCtrl** | `mdash.ThemeCtrl` | Settings-panel selector for `auto` / `light` / `dark` theme. In `auto`, listens to `prefers-color-scheme` changes and applies `theme-light` / `theme-dark` on `<html>`. Persists in `localStorage['mdash:theme']`. |
| **MotionCtrl** | `mdash.MotionCtrl` | Settings-panel selector for motion level (`full` / `reduced`). Toggles `html.reduced-motion`. Persists in `localStorage['mdash:motion']`. |
| **KeyboardManager** | `mdash.KeyboardManager` | Keyboard-driven tile filtering. Guarded by `isEnabled()` check (disabled by default in localStorage). |
| **AddBtn** | `mdash.AddBtn` | Per-section "+" button rendered as a tile at the end of the section list in edit mode. Opens a confirmation dialog to add a new bookmark. Normalizes URLs (prepends `http://` if needed). |
| **Spotlight** | `mdash.Spotlight` | Spotlight-style search modal (Option+F / Ctrl+F). Shows a centered overlay with input + results list. Uses a cached in-memory index rebuilt on open, with debounced input handling. Matches by title and URL. Keyboard navigation (↑/↓/Enter/Esc). Results show favicon, title (with highlighted match), URL, and section name. Supports opening in a background tab (`chrome.tabs.create` with `active: false`) using middle-click or Cmd/Ctrl+click while keeping the current tab on Spotlight. |
| **Dashboard** | `mdash.Dashboard` | Main orchestrator. Initializes all modules, preloads the icon map, loads bookmarks into two columns, sets up the UI toolkit, handles the right-side slide-in settings panel, and handles the "refresh icons" action. Works with the responsive grid/settings layout defined in CSS. |

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
| `fontSize` | localStorage | `xxs` / `xs` / `small` / `medium` / `large` / `xl` / `xxl` / `xxxl` |
| `mdash:theme` | localStorage | `auto` / `light` / `dark` |
| `mdash:motion` | localStorage | `full` / `reduced` |
| `mdash:sections:collapsed` | localStorage | JSON object map of collapsed section IDs |
| `mdash:keyboard:isEnabled` | localStorage | `enabled` / `disabled` |

### Build & Packaging

`pack.sh` reads the version from `manifest.json` and creates a zip archive excluding `.git`, `.DS_Store`, `node_modules`, `pack.sh`, and `icons/`.

```bash
./pack.sh   # produces ../mdash-chrome-<version>.zip
```

## Design System (v3 — Minimal Developer Dashboard)

Visual direction: clean, intentional, and low-noise (Linear/Raycast/Vercel-like). Whitespace drives hierarchy; tags are compact functional pills; sections avoid heavy card chrome.

### Design Tokens (CSS Custom Properties)

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg-color` | `#F5F7FA` | `#0f1115` | Page background |
| `--text-color` | `#1F2937` | `#e5e7eb` | Primary text |
| `--muted-color` | `#6b7280` | `#9ca3af` | Secondary text |
| `--accent-color` | `#3B82F6` | `#60a5fa` | Interactive/link accent |
| `--success-color` | `#22c55e` | `#22c55e` | Positive actions (`Add`, quick-action icon base) |
| `--danger-color` | `#ef4444` | `#ef4444` | Destructive actions (`Delete`) |
| `--tile-bg` | `#ffffff` | `#12161d` | Surface/tag background |
| `--tile-hover-bg` | `#F8FAFC` | `#171c24` | Hovered surface/tag background |
| `--bookmark-tile-bg` | `#F1F5F9` | `#12161d` | Bookmark tag background |
| `--bookmark-tile-hover-bg` | `#E2E8F0` | `#171c24` | Bookmark tag hover background |
| `--tile-shadow` | `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)` | subtle `0 1px 2px rgba(0,0,0,0.35)` | Resting shadow |
| `--tile-radius` | `8px` | `8px` | Tag radius |
| `--bookmark-tile-min-height` | `28px` | `28px` | Compact single-line tag height |
| `--bookmark-tile-max-width` | `calc(32ch + 1em + 28px)` | `calc(32ch + 1em + 28px)` | Max tile width for one-line, 32-char bookmark labels |
| `--surface-border` | `#E6E9EF` | `rgba(255,255,255,0.10)` | Subtle dividers |
| `--surface-strong` | `#ffffff` | `#10141a` | Panel/dialog surfaces |
| `--hover-shadow` | `0 2px 8px rgba(15,23,42,0.08)` | `0 2px 8px rgba(0,0,0,0.25)` | Hover elevation |
| `--section-color` | `#374151` | `#f3f4f6` | Section header text |
| `--section-alt-bg` | `#EEF1F5` | `rgba(255,255,255,0.03)` | Zebra section tint |
| `--focus-ring` | `rgba(37,99,235,0.35)` | `rgba(96,165,250,0.45)` | Focus indicators |

### Key Visual Rules

- Background is flat and bright (`--bg-color`) with no decorative gradient noise
- Section headers use a clearer hierarchy (`13px` min / `19px` max clamp with `+1px` offset vs tags, weight `600`) with thin divider line and increased gap above bookmark tags
- Bookmark tags are premium soft chips with stronger light-mode separation (white chip surface with clearer border/shadow contrast against zebra backgrounds), adaptive width (content-fit with 32-char max), single-line ellipsis, and subtle hover lift (`translateY(-1px)`)
- Left/right columns keep no outer frame and no nested section card frame; sections alternate zebra tint (`#EEF1F5`) with transparent gaps (`dark / empty`), phase-offset by column
- Settings UI: compact top-right quick actions (wrench + gear), where gear opens a right-side slide-in minimal panel
- Quick-action icons use local SVG assets (`dashboard-edit.svg`, `dashboard-gear.svg`) sized to 34px controls
- Edit-mode section action buttons (`Add` / `Sort` / `Delete`) are compact icon+label pills (`34px` high), right-aligned in section headers, with accent icon/text colors (success / neutral / danger) and consistent horizontal spacing
- Section action buttons keep fixed widths (with responsive text sizing) across all font presets, preventing `add/sort/delete` overlap at larger dashboard font sizes
- Entering/leaving edit mode does not reflow section layout: action-space reservation and border box metrics stay constant between states
- Spotlight modal: 14px radius, consistent shadow language
- Edit mode state: sections receive a subtle dashed outline; tag hover brightens to signal editability
- Zebra phase is offset by column: left tints 1st/3rd/5th... sections, right tints 2nd/4th/6th... sections
- Balanced spacing pass: section-to-section gaps were increased from the ultra-compact mode for better visual separation
- Grid gap: 16px row / 32px column
- Scrollbars: 6px wide, very low opacity
- DnD placeholders: pulsing animation for clear visual feedback
- Settings panel: animated slide-in/out from right (with backdrop)
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
- **CSS custom properties** — design tokens in `:root` for theming (v3 minimal developer dashboard palette).
- **No tests** — no test framework or test files.

## DnD Architecture

Two independent drag & drop systems coexist in edit mode:

| System | Event namespace | Flag | Drag handle | Drop target |
|---|---|---|---|---|
| **Tile DnD** | `.mdash` | `_dragging` | Bookmark `<a>` tiles | `<section>` elements |
| **Section DnD** | `.mdash-section` | `_sectionDragging` | Section `<h1>` titles | `.left` / `.right` columns |

Guards prevent interference: tile handlers check `if( self._sectionDragging ) return;` and section handlers check `if( !self._sectionDragging ) return;`.

### Tile DnD Runtime Behavior (current)

1. **Drag start and source capture**
   - Tile drag is active only in edit mode and only on bookmark anchor elements (`a`).
   - Child nodes are drag-safe: bookmark icons are `draggable="false"` and tile children are non-interactive in edit mode (`pointer-events: none`) so drag always starts from the tile anchor handler.
   - On `dragstart`, the controller stores source metadata: source tile ID, source tile bounding box, and pointer-down coordinates captured from `mousedown`.
   - `dataTransfer` is initialized with bookmark ID (`application/x-mdash-bookmark-id`) and `effectAllowed='move'`.
   - Drag preview uses native `setDragImage(this, hotX, hotY)` with hotspot aligned to pointer-down position relative to the tile.

2. **Hover targeting and insertion marker model**
   - Reordering is gated by `_canRepositionOnDragOver()`:
     - ignores invalid synthetic coordinates (e.g. `0,0`),
     - requires an initial movement threshold (~4px) from drag start,
     - blocks reposition while pointer is still inside source tile bounds.
   - For non-empty sections, the hovered target tile receives `drop-hover-target` (visible dashed highlight on the tile itself).
   - Internal insertion marker is still `a.drop-placeholder`, but when targeting a tile it is collapsed (`display:none`) and used only as a logical index marker.
   - For empty sections, `drop-placeholder` is rendered visibly (before `a.add` when present, otherwise appended).

3. **Same-section direction and cross-section behavior**
   - In same-section moves, insertion side is directional:
     - source index < target index: insert **after** hovered tile,
     - source index > target index: insert **before** hovered tile.
   - If jQuery index lookup is unavailable, relative DOM order fallback (`compareDocumentPosition`) is used.
   - In cross-section moves, marker placement follows hovered tile/section targeting logic without same-section directional assumptions.

4. **Drop index computation, commit, and rollback**
   - Drop index is computed by iterating section children until the internal marker, skipping:
     - `.add` tiles,
     - the dragged tile itself,
     - temporary dragging classes.
   - For same-parent forward moves, the API index is adjusted (`+1`) before `chrome.bookmarks.move(...)` so persisted bookmark order matches the visual order after refresh.
   - Same-section no-op is short-circuited when computed target index equals original source index.
   - UI commits immediately by replacing marker with the dragged tile, then persists via `chrome.bookmarks.move(...)`.
   - On API failure, DOM is rolled back to original section/index and error reporting is surfaced through existing error handlers.

5. **Cleanup and guardrails**
   - `_cleanupTileDrag()` resets all tile drag transient state:
     - flags (`_dragging`, placement flags),
     - source geometry and pointer baselines,
     - temporary classes (`dragging`, `drop-hover-target`, section `drop-target`),
     - placeholder detachment.
   - Tile and section DnD are isolated with guards:
     - tile handlers return early when `_sectionDragging` is active,
     - section handlers run only for section drag namespace (`.mdash-section`).
   - Global container-level `dragover`/`drop` handlers cover whitespace drops and keep insertion behavior deterministic across tile gaps.

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
- **Top-gap layout fix**: quick actions (wrench + gear) are compact and fixed top-right; right-column-only offset was removed so left/right columns start aligned.

## UI Polish (v1.5.0)

- **Animated transitions**: settings panel slide-in/out, bookmark remove (opacity + scale + max-height collapse), custom select dropdown (opacity + translateY, 100ms).
- **Dark mode completeness**: `ui.css` rewritten to use CSS custom properties with fallbacks — dialogs, notifications, context menu, overlay, close buttons, and card component all inherit theme tokens automatically.
- **Custom select keyboard**: full arrow-key navigation (↑/↓), Enter/Space to select, Escape to close, focused-option highlighting with scroll-into-view.
- **ARIA accessibility**: spotlight input (`aria-label`, `aria-controls`), results list (`role="listbox"`), edit toggle (`aria-pressed`), settings toggle (`aria-controls`, `aria-expanded`), help button (`aria-label`), column regions (`role="region"`), get-started overlay (`role="dialog"`, `aria-labelledby`), refresh icons (`aria-label`).
- **Visual polish**: link hover feedback (opacity fade), settings-option hover/selected states, drop placeholder pulse animation, stronger section header underline, higher muted-color contrast in dark mode (`#A1A1A6` vs `#8E8E93`).
- **Consistency**: unified `outline-offset: 2px` on all focus rings, input `border-radius: 10px` matching custom select, `width: 100%` + `box-sizing: border-box` on all form inputs.
- **Performance**: `requestAnimationFrame` for drag-start class and spotlight focus instead of `setTimeout`, smooth `scrollIntoView` for spotlight keyboard navigation.
- **Removed**: legacy `-webkit-` only prefixes in `ui.css` replaced with standard properties (with `-webkit-` kept where needed for older Chromium).

## Known Issues

- `img/icon.png` referenced but not in repository.
