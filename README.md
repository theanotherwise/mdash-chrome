# mdash-chrome

A Chrome extension that replaces the New Tab page with a clean, tile-based bookmark dashboard. Everything stays local — no accounts, no sync, no tracking.

## Features

### Dashboard Layout
- Two-column layout that mirrors your bookmark folder structure
- Responsive grid — auto-switches to single column on smaller screens
- Sections keep a clean no-frame look with a uniform white surface layer for clear grouping
- Bookmark tags are premium soft chips (`13px`, `8px` radius, `#F1F5F9` surface) with muted text and lightweight hover lift
- In light mode, bookmark chips use stronger white-surface contrast and clearer borders so they do not blend into section surfaces
- Bookmark tile labels are one-line with adaptive tile width up to 32 characters, and show `...` when longer
- Group sections use a single clean surface treatment (no alternating zebra tint)
- Dark mode uses a neutral graphite palette with consistent section surfaces and softer borders
- Top-right quick actions: 34px circular wrench + gear icons with green success styling
- Color system: bright neutral background (`#F5F7FA`), subtle dividers (`#E6E9EF`), clean white section surfaces, and muted blue/green/orange accents
- Smooth transitions on all interactive elements (hover, focus, drag & drop)
- Theme mode selector: auto / light / dark (auto follows OS)
- Five font sizes: S, M, L, XL, XXL; S starts at the previous L-sized dashboard text
- Font size scaling applies to dashboard content only (settings panel typography stays fixed)
- Box Size selector: compact / large, where compact restores the previous chip height and large doubles the box height without changing font size
- Motion preference toggle (full/reduced)
- Full ARIA accessibility for screen readers

### Spotlight Search
- Quick-launch search modal (Option+F on macOS, Ctrl+F on Windows/Linux)
- Real-time filtering by bookmark title and URL
- Debounced search with cached in-memory index for faster response on large dashboards
- Keyboard navigation (arrow keys, Enter, Escape)
- Highlighted matches in results
- Middle-click or Cmd/Ctrl+click opens in a background tab without leaving Spotlight

### Edit Mode
- Enable/disable edit mode from the top-right wrench button
- Click any bookmark tile to edit its title, URL, or move it to another section
- Edit dialog includes a `DUPLICATE` action to clone a bookmark (in the same or selected section)
- Edit dialog section picker uses a custom styled dropdown with full keyboard navigation (arrows, Enter, Escape)
- Drag & drop bookmarks between sections to reorder
- Drag & drop entire sections between left and right columns
- Rename sections by clicking the section title
- Collapse/expand sections via header chevron (persisted)
- Custom section colors: in edit mode use the `Color` action or click the colored header line to assign a color from a 16-color palette; color is stored in the bookmark folder title as a `#RRGGBB` suffix
- Sort bookmarks within a section A→Z or Z→A via the sort button (↕) in the section header
- Add new bookmarks via the `+` tile at the end of each section
- Create new sections with the bottom `+` button (with optional color selection)
- Delete entire sections (with confirmation)

### Undo
- 30-second undo window for all destructive actions:
  - Bookmark delete, create, edit, and drag & drop move
  - Section create, delete, rename, column move, color change, and sort

### Favicon Handling
- Custom icon mapping for known services (ArgoCD, Grafana, Jenkins, etc.)
- Google S2 favicon service as fallback
- Local favicon caching via Chrome's `_favicon` API + localStorage for offline access
- Quota-aware cache writes (automatic partial favicon-cache eviction + retry)
- Click refresh button to always purge favicon cache and reload for a full rebuild
- Alt+click refresh button to purge cache and rebuild favicons in place (batched for large bookmark sets)

### Privacy
- Zero external data collection
- All data lives in Chrome's built-in bookmarks — nothing leaves your browser
- No accounts, no sync services, no analytics

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Option+F / Ctrl+F | Open Spotlight search |
| Arrow keys | Navigate Spotlight results |
| Enter | Open selected result |
| Escape | Close Spotlight / close open dialog (before leaving edit mode) |
| Middle-click | Open in background tab (Spotlight) |

## Installation

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Build

```bash
./pack.sh
```

Creates a distributable `.zip` in the `build/` directory, ready for Chrome Web Store upload.

## License

Personal use only — no commercial redistribution.
