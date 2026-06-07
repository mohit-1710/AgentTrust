# Monad Docs Reference Notes

Captured via Playwright MCP on 2026-05-05.

## Layout

- Topbar height: 56px.
- Desktop left rail: about 264px wide.
- Desktop content starts around x=328-337px, with a right-side table of contents.
- Tablet and mobile collapse the left rail into a breadcrumb/navigation row under the topbar.
- Main content uses generous vertical spacing, hairline borders, and compact page actions.

## Visual System

- Base surface is white with very light gray rails and borders.
- Primary accent is `rgb(131, 110, 249)`, used sparingly for active nav, TOC rail, assistant focus, and small icons.
- Sidebar links are compact: 14px text, 20px line-height, 12px radius, roughly 6px vertical padding.
- Page headings are dense and sans-driven in Monad's implementation; AgentTrust will translate the same craft level into the locked Fraunces + Geist editorial system.

## Components To Match In Spirit

- Search: low-height control with hairline ring, command hint, and blurred overlay dialog.
- Assistant: right sheet around 360px wide on desktop, 16px radius, hairline border, input pinned at bottom.
- Callouts: light tinted surface, thin blue border, compact title row.
- TOC: subtle left border, active item colored with the accent.
- Code/reference pages: dense tables, inline code pills, copy actions, and restrained link underlines.

## Captures

- `01-introduction-desktop-full.png`
- `02-assistant-panel-desktop.png`
- `03-search-dialog-desktop.png`
- `04-dark-mode-desktop.png`
- `05-introduction-tablet-full.png`
- `06-introduction-mobile-full.png`
- `07-code-block-desktop-full.png`
- `computed-style-notes.json`
