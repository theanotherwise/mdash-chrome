# mdash-chrome

A Chrome extension that replaces the New Tab page with a clean, tile-based bookmark dashboard. Everything stays local — no accounts, no sync, no tracking.

## Features

### Dashboard Layout
- Two-column layout that mirrors your bookmark folder structure
- Responsive grid — auto-switches to single column on smaller screens
- Collapsible top-right controls pill with animated expand/collapse and frosted glass effect
- Dark-green accent color for focus, action buttons, and highlights
- Smooth transitions on all interactive elements (hover, focus, drag & drop)
- Light and dark themes (fully themed dialogs, notifications, and context menus)
- Three font sizes: small, medium, large
- Full ARIA accessibility for screen readers

### Spotlight Search
- Quick-launch search modal (Option+F on macOS, Ctrl+F on Windows/Linux)
- Real-time filtering by bookmark title and URL
- Keyboard navigation (arrow keys, Enter, Escape)
- Highlighted matches in results
- Middle-click or Cmd/Ctrl+click opens in a background tab without leaving Spotlight

### Edit Mode
- Click any bookmark tile to edit its title, URL, or move it to another section
- Edit dialog section picker uses a custom styled dropdown with full keyboard navigation (arrows, Enter, Escape)
- Drag & drop bookmarks between sections to reorder
- Drag & drop entire sections between left and right columns
- Rename sections by clicking the section title
- Custom section colors: click the color dot next to a section title to assign a color from a 16-color palette; color is stored in the bookmark folder title as a `#RRGGBB` suffix
- Sort bookmarks within a section A→Z or Z→A via the sort button (↕) in the section header
- Add new bookmarks via the `+` tile at the end of each section
- Create new sections with the bottom `+` button (with optional color selection)
- Delete entire sections (with confirmation)

### Click Statistics
- Per-bookmark click counter tracks how often you use each bookmark
- Subtle badge on tiles shows click count
- Tracks clicks from both dashboard tiles and Spotlight search results
- Data persisted locally in `localStorage`

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
