<!--
Generated from the Claude doc "Life OS — UI Style Guide" (https://claude.ai/artifact/Bb3NAbhoLLYgNwSqDxzMEh).
Do not edit by hand: Claude updates the doc and re-saves this file.
How to read it: the guide grew over time. Dated sections further down ("Update, Nov 13", "Approved: … (Nov 14)")
replace earlier rules wherever they disagree. "Approved" sections are final screen designs; their HTML mock-ups
are in design/html_mockups/.
-->

# Life OS — UI Style Guide

Nov 10, 2026 · @Arzel

## Current rules (read this first)

This section sums up the rules in force as of Nov 16. Where it and an older section below disagree, this section wins; the dated sections below are kept as history and detail. The newest dated section is "Update: UX review decisions (Nov 16)" at the end.

- **Shell:** a 48 px rail (Home, Tasks, Calendar, Plan, then Settings at the bottom) and a 240 px context sidebar (200–320, collapses to an overlay below 1440 px). No top bar; each page has its own 32 px header row. Detail panel 400 px (360–560), floating, with ×, Esc and click-outside to close.
- **Clicking an existing entity opens the detail panel; pop-ups are only for creating and confirming.** Exception: routines and routine steps are edited on their own page. A project always opens its project page.
- **Colour means life area.** Status is shown with neutral chips, icons and text. The accent is neutral (near-black). Action buttons are solid with white text: the accent, or the area's 500 colour inside an area (area and project pages); brand purple only for focus, selection, the today marker and the logo. Text never takes area colours. Red only for overdue and for behind or missed targets.
- **Type:** 20 page title, 16 card and column titles, 14 card titles, 13 body, 12 metadata, 11 labels and tags (caps, +0.04em). Nothing below 11 px. Text colours: primary #111827, secondary #4b5563, tertiary #6b7280 (lightest text), disabled #9ca3af for controls only.
- **Spacing:** 4 px grid (2 and 6 for small inner gaps), 24 px page gutter, 16 px between cards.
- **Show data, not guidance:** data-only subtitles, no hints or info icons, one legend only (the routine key). Status messages that explain why an action is unavailable stay. One chart style per card.
- **Times:** 12-hour by default; on-the-hour times drop ":00" (10 AM, 7 – 9 PM).
- **Dashed borders** = a placeholder, an unset value or a drop spot.
- **Undo:** the shared toast (white, green check, message, Undo, Ctrl Z), bottom centre, 6 s. Deletes that can't be undone ask first in the red confirmation.
- **Screens:** see the Approved sections below for each screen, as changed by the Nov 16 decisions.

## Purpose

This is the single source of truth for how Life OS looks and behaves on screen. Claude Code reads it before building or changing any UI; the code lives in `frontend/` (HeroUI v3, Tailwind v4).

Each rule carries a status:

| Status | Meaning |
| --- | --- |
| Decided | Arzel chose it. Build it as written. |
| Proposed | Recommended default. Build it, but flag it in the PR so Arzel can confirm. |
| Open | Not settled. Ask before building anything that depends on it. |

To use it in code, export this doc to Markdown and save it as `docs/STYLE_GUIDE.md`. Then add a line to `CLAUDE.md` under Source documents pointing to it.

## Foundations

Life OS is built on HeroUI v3 defaults and overrides only what it needs. The feel is clean, modern and slightly dense.

| Item | Rule | Status |
| --- | --- | --- |
| Component library | HeroUI v3, themed with CSS variables (`--accent`, `--surface`, `--field-*`, `--separator`, `--success`, `--warning`, `--danger`). No `HeroUIProvider`. | Decided |
| Feel | Clean, modern, slightly dense | Decided |
| Target screen | 1920 × 1080 at 100% scaling: 1 CSS px = 1 screen px. Plan for about 950 px of usable height. | Decided |
| Font | Inter (HeroUI default). Bundle it locally with `@fontsource-variable/inter` so it works offline in the Tauri build. | Proposed |
| Theme file | All overrides in one `src/theme.css`, imported after `@heroui/styles` in `index.css`. Components never hard-code colors. | Proposed |
| Dark mode | Define dark values for every token from day one, even before a theme toggle exists. | Proposed |
| Icons | `lucide-react` (already installed), 16 px in rows, 20 px in nav. | Proposed |

## Color

Color means life area and nothing else. Status uses neutral chips, icons and progress; the accent is near-black; brand purple appears only as the focus ring, the selected marker and the logo.

### Palette (Decided)

Every color has 11 steps, 50 to 950, with 600 as the main shade. Exact values:

```csv
name,50,100,200,300,400,500,600,700,800,900,950
brand,#f8f7fb,#f1f0f7,#e6e3f1,#d4cce6,#bbafd6,#a18ec4,#8f74b3,#7e61a0,#695186,#57446e,#382c49
neutral,#f9fafb,#f3f4f6,#e5e7eb,#d1d5db,#9ca3af,#6b7280,#4b5563,#374151,#1f2937,#111827,#030712
career,#f3f6fc,#e5edf9,#c6d9f1,#94bbe5,#5a97d6,#3579c2,#255fa4,#1f4c85,#1d416f,#1d385d,#14253d
finance,#f0fdfb,#cbfcf4,#98f7eb,#5cece0,#2ad7cd,#11bbb3,#0b9895,#0d7876,#105f5f,#124f4f,#032e30
health,#fbf4f8,#f8ebf1,#f2d8e5,#e8b9d0,#d98db0,#ca6a93,#b64c74,#9c3a5c,#81334d,#6d2e43,#411624
personal,#fbf8fb,#f5f0f7,#ece0ee,#ddc7e0,#c9a5cd,#b181b4,#98659b,#7a4f7c,#654266,#553a55,#341e34
relationships,#fbfbeb,#f6f4cb,#eee79a,#e4d460,#dbbf34,#cba927,#aa821e,#8c621c,#754f1e,#64431f,#3a230e
home,#fbf6f1,#f7e9dd,#edd0bb,#e2af8f,#d58862,#cc6b43,#be5638,#9e4330,#7f372d,#672f27,#371713
positive,#f2fbf2,#e2f6e2,#c7ecc6,#9adc99,#66c365,#40a740,#328f32,#296c29,#255625,#204721,#0d260e
negative,#fdf3f3,#fce4e5,#faced0,#f4adb0,#ec7d81,#e05359,#cc363c,#a5282d,#8e262a,#772528,#400f11
warning,#fff7ed,#ffedd5,#fed7aa,#fdba74,#fc9947,#fc8514,#c9510c,#9a3412,#7c2d12,#581f07,#391303
```

The palette also has neutral-alpha (#1f2937 at 5–95%) and white-alpha (#ffffff at 5–95%) scales for overlays.

### Using area colors (Proposed)

| Role | Light theme | Dark theme |
| --- | --- | --- |
| Dots, checkboxes, icons, chart marks | 600 | 400 |
| Area text on white | 700 (600 fails 4.5:1 for finance and relationships) | 300 |
| Tinted card or event background | 50–100 | 900–950 |
| Text on a tint | 800 | 100 |
| Border on a tinted card | 300 | 700 |

A life area stores one hex (its 600). Store the area's palette name too, or derive tints in CSS with `color-mix(in oklab, var(--area) 12%, var(--surface))` from a `--area` custom property set on the element.

### HeroUI token mapping (Proposed)

| HeroUI token | Light | Dark |
| --- | --- | --- |
| `--background` | neutral-100 #f3f4f6 | #0d0f14 |
| `--surface` | #ffffff | #151821 |
| `--foreground` | neutral-900 #111827 | neutral-100 #f3f4f6 |
| `--muted` | neutral-500 #6b7280 | neutral-400 #9ca3af |
| `--accent` (primary buttons) | neutral-900 #111827 | neutral-100 #f3f4f6 |
| `--focus` | brand-600 #8f74b3 | brand-500 #a18ec4 |
| `--success` | positive-600 #328f32 | positive-400 |
| `--warning` | warning-600 #c9510c | warning-400 |
| `--danger` | negative-600 #cc363c | negative-400 |
| `--border` / `--separator` | neutral-200 #e5e7eb / #eceef1 | #262b36 / #20242e |

### Priority and status (Proposed)

Priority is a flag icon: High negative-600, Medium warning-600, Low neutral-400, None = no flag. The four levels map to the Eisenhower matrix (see Tasks under Screens). Status is a neutral chip (Active, Upcoming, Done) or the entity's own control (checkbox, progress bar), never an area-like color.

### Known color problems (Open)

- Brand purple and Personal mauve are nearly the same color (the closest pair in the palette). Keeping brand to the focus ring avoids most confusion; changing one of them would remove it.
- Home terracotta sits close to negative red and warning orange. Overdue and priority must always pair color with text or an icon.
- The Fun and Others areas have no palette. Others can use neutral; Fun needs a hue that isn't close to Relationships gold.
- Personal 100 and 200 are now filled in (#f5f0f7, #ece0ee).
- Typo in the source file: "Career Aresa".

## Typography, spacing and radius

Type follows HeroUI's Tailwind-based scale, tightened for density. Nothing renders below 12 px.

### Type roles (Proposed)

| Role | Size / line height | Weight | Tailwind |
| --- | --- | --- | --- |
| Page title | 24 / 32 (30 / 36 is the roomier option) | 600 | `text-2xl font-semibold` |
| Panel and column header | 18 / 28 | 600 | `text-lg font-semibold` |
| Section card title | 16 / 24 | 600 | `text-base font-semibold` |
| Item title (task, card) | 14 / 20 | 500 | `text-sm font-medium` |
| Body in the detail panel | 16 / 24 | 400 | `text-base` |
| Body in lists | 14 / 20 | 400 | `text-sm` |
| Metadata, counts, chips | 12 / 16 | 400–500 | `text-xs` |
| Group label (OVERDUE · 2) | 12 / 16, uppercase, tracking 0.04em | 500 | `text-xs font-medium uppercase tracking-wide` |

### Spacing and sizing (Proposed)

- Spacing runs on a 4 px grid: 4, 8, 12, 16, 24, 32.
- Card padding 12–16; gap between list items 8; gap between cards 16; page padding 24.
- Heights: list rows 36, nav items 36, buttons and inputs 40 (small 32), icon buttons 28, section card header 40, page header row 48 (no top bar).

### Radius (Proposed)

HeroUI's `--radius` stays at 0.5rem (8 px).

| Element | Radius |
| --- | --- |
| Cards, panels, modals | 12 px (`rounded-xl`) |
| Buttons, inputs, menus | 8 px (`rounded-lg`) |
| Checkboxes | 4 px |
| Chips, pills, progress bars | full |

## Effects and scrolling

Every scrolling area hides its scrollbar and shows a scroll shadow instead (Decided). One shared `<Scroll>` component does both; no component uses a raw `overflow: auto`.

### Scroll shadows (Decided)

- A 16 px fade appears on any edge with more content past it, and disappears at that edge's end.
- It fades in and out over 150 ms.
- It is a CSS `mask-image`, not a colored overlay, so it works on any background, tint and theme.
- Vertical areas fade top and bottom; horizontal areas (the week board) fade left and right.
- Applies to card bodies, board columns, the board itself, the detail panel, the navbar's area list, tables, menus and modals.
- Implementation note: a hook watches `scroll` and size (ResizeObserver) and sets `data-fade-top`, `data-fade-bottom`, `data-fade-left`, `data-fade-right` on the element; CSS animates registered `@property` lengths into the mask.

### Hidden scrollbars (Decided)

- Hide them globally (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`), and set HeroUI's `--scrollbar-width: none`.
- Scrolling still works with wheel, trackpad and keyboard.
- Horizontal areas also scroll with Shift + wheel and by click-dragging empty space.

### Shadows and focus (Proposed)

- Use HeroUI's built-in shadows only: `--surface-shadow`, `--field-shadow`, `--overlay-shadow`. Cards on the page get a 1 px `--border` and no shadow; floating things (menus, modals, the dragged card) get the overlay shadow.
- The focus ring is HeroUI's: 2 px with a 2 px offset, in `--focus` (brand purple).
- No gradients, glows or blur except HeroUI's modal backdrop.

## Layout

The app shell is a navbar on the left, a content area on a 12-column grid, and an optional detail panel on the right. Sizes below assume the 1920 px target.

### App shell

| Region | Size | Behavior | Status |
| --- | --- | --- | --- |
| Navbar, collapsed | 48 px, fixed | Icon rail; tooltips show labels | Decided |
| Navbar, expanded | 240 px default, drag 200–320 | Drag below 160 px snaps to the rail; double-click the handle resets to 240; `Ctrl + B` toggles; width and state persist (localStorage) | Width Decided, rest Proposed |
| Content | 1632 px (nav expanded) or 1824 px (collapsed) | 24 px padding, 12-column grid, 16 px gutters | Proposed |
| Detail panel | 400 px, drag 360–560 | Opens from the right when an item is clicked and floats as an overlay; `Esc` closes | Decided |

### Navbar items (Decided)

1. Home
2. Tasks
3. Calendar
4. Areas
5. Projects
6. Routines
7. Settings (pinned to the bottom, above the collapse toggle)

There is no top bar: each page puts its title and actions in a 48 px header row at the top of its own content. Life areas are not listed in the navbar; the Areas page has its own area tab bar. Suggested icons (lucide): House, SquareKanban, Calendar, Shapes, Folder, Repeat, Settings (Proposed). Only routes that exist get a nav item; the list grows phase by phase.

### Adjustable cards (Decided: adjustable; approach Proposed)

- v1: resizable panes with `react-resizable-panels`. Dividers between docked regions (for example the calendar and its agenda panel) can be dragged; the floating detail panel resizes from its left edge; the layout itself is fixed.
- Later, Home only: free move-and-resize cards with `react-grid-layout`, in an "Edit layout" mode.
- Divider: 8 px invisible grab area, 1 px brand line on hover, `col-resize`/`row-resize` cursor, double-click resets.
- Minimums: card 280 × 120, right rail 280–480, detail panel 360–560.
- Every section card can collapse to its 40 px header and expand to fill the content area (`Esc` returns).
- Sizes persist per screen (localStorage first; a settings table later).

### Screens (list Decided, layouts Proposed)

Screens split into time views (what to do, when) and structure views (what it serves).

| Screen | What it shows | Layout |
| --- | --- | --- |
| Home | Today: overdue, today's tasks, events and routine steps, plus goal progress and the next 7 days | Page header (date, next up, done count); main column: Overdue (only when not empty), Schedule, Tasks by area; 360 px right rail: routine steps, goal progress, 7-day strip |
| Tasks | One Kanban board with two views, switched in the page header: **Priority** and **Area** | Priority view: 4 columns, one per priority level, each labeled with its Eisenhower quadrant. Area view: one column per life area plus an Inbox column for tasks with no area. Dragging a card between columns changes its priority or area. Columns at least 260 px; the board scrolls sideways when they don't fit. |
| Calendar | Week, Month, Quarter and Year views, switched in the page header | One screen (see Approved: Calendar, Nov 15). Week: seven day cells with no time axis, multi-day bars across the top. Month: month grid. Quarter and Year: linear calendar, one row per month with days in a line under repeating weekday columns, events and projects as bars across days. The sidebar is the filter menu; the right panel is the Agenda or the Inbox. |
| Areas | Each life area's page | An area tab bar at the top of the page (area dot, name, % done) picks the area. Below it: the area's vision, then section cards for goals, projects, upcoming tasks, events and routines. |
| Projects | All projects, organized by area then project group | Collapsible area sections, project-group subheaders inside each, and one 36 px row per project: name, status chip, progress bar, due date, milestone count. |
| Routines | Routines and their steps | 320 px routine list + the selected routine's steps, schedule and a history heatmap from `routine_logs`. |
| Settings | App settings | Simple form page. |

### Eisenhower mapping for priority (Proposed)

| Priority | Eisenhower quadrant | Meaning |
| --- | --- | --- |
| High | Do | Urgent and important |
| Medium | Schedule | Important, not urgent |
| Low | Delegate | Urgent, not important |
| None | Eliminate | Neither urgent nor important |

Any item clicked on any screen opens the floating detail panel on the right.

## Components and entity rules

Every entity must be recognizable at a glance, and still distinguishable in grayscale. Three visual channels each have one job: marker shape says what it is, the container says how it relates to time, and color says which area.

### Shared components (Proposed)

| Component | Spec |
| --- | --- |
| Section card | White surface, 1 px border, 12 px radius, 16 px padding. 40 px header: title (16/600) + muted count ("2 active · 3 total") + 28 px "+" icon button. Body scrolls with `<Scroll>`. Empty state: one muted line ("No goals in this area."). Collapsible and expandable. |
| Group label | Uppercase 12/500 label with a count (OVERDUE · 2). Only Overdue is red. |
| List row | 36 px tall: marker, title (14/500), metadata line (12, muted) joined with " · ". Row actions appear on hover and on keyboard focus. |
| Progress bar | 4 px tall, full radius, area-600 fill on neutral-200 track, % at the right (12/500). |
| Progress ring | For goals on overview screens; same colors as the bar. |
| Status chip | Neutral soft chip: Active, Upcoming, Done, Archived. |
| Area pill | Area dot + name + %, with a soft area-tint fill sized to the %. |
| Nav item | 36 px; 20 px icon, 12 px gap, label 14/500; active = neutral-100 background + 2 px brand marker on the left edge. Area items use an area-600 square dot and a muted count. |
| Icon button | 28 px, ghost variant, with a tooltip and an `aria-label`. |

### Entity visuals (Proposed)

| Entity | Marker (16–20 px) | Container | Extra signal |
| --- | --- | --- | --- |
| Task | Square checkbox, 4 px radius, area-600 border | Plain row | Project and priority flag in the metadata |
| Subtask | Smaller square checkbox (14 px), indented 24 px | Plain row, no metadata | Parent shows "1/3" |
| Recurring task | Square checkbox | Plain row | Repeat icon in the metadata |
| Event | 20 px filled area-600 square with a white calendar icon | Filled block: area tint, no border | Time range; all-day events pinned to the top of the day |
| Routine | Ring icon | Outlined card: surface + 1 px area-300 border | Step progress "2/5" |
| Routine step | Round checkbox | Plain row inside its routine | Round never means task |
| Milestone | Diamond ◆ | Light card, area-50 fill, solid 1 px area-300 border | "Due Nov 5" + "3/5 tasks" |
| Goal | Target ◎ | Row + progress bar | "1/12 books · 8%" |
| Goal deadline (timeline) | Diamond ◆ | Point on the timeline | ◆ on a timeline means any deadline point |
| Project | Stack icon | Group header or metadata, not a card in lists | Progress bar on its own page |
| Life area | Square dot | Column or section header | Source of all item colors |

### States for every entity (Proposed)

| State | Look |
| --- | --- |
| Done | Title struck through, row at 50% opacity |
| Overdue | Date text in negative-600, listed under OVERDUE |
| Selected | 2 px brand ring |
| Archived | 60% opacity + Archived chip |
| Dragging | Card lifts with the overlay shadow; the drop spot shows a dashed outline. Dashed borders mean drag-and-drop only. |

## Open decisions

These need Arzel's answer before the parts that depend on them are built.

- [ ] Brand purple vs Personal mauve: keep brand to the focus ring only, or change one of the two?
- [ ] Home terracotta vs warning orange: shift Home toward brown, or Warning toward amber?
- [ ] Colors for the Fun and Others areas.
- [ ] Confirm the Eisenhower mapping for priority levels (table under Screens).
- [ ] Which screens and views ship first (for example, Calendar's Quarter and Year views later)?
- [ ] Add a weekly Review screen?
- [ ] Home's right rail: routine steps, goal progress and a 7-day strip, or something else?
- [ ] Page title size: 24 px (denser) or 30 px.
- [x] Real values for Personal 100 and 200.
- [x] Navigation and screen list.

## Update, Nov 13: Figma library plan and compact spec

The Figma library is a neutral + accent wireframe system; real area colors live only in code. Everything below is Proposed until checked in the one-screen mock-up, and replaces earlier values where they differ.

### Working rules

- Ask Arzel before any high-usage or time-consuming task (Figma calls, large builds). Figma account: Starter plan, View seat (about 20 Figma calls a month for Claude, one mode per variable collection).
- Tokens go into Figma through a JSON file + import plugin (Option C), not through Claude's Figma calls.
- Claude builds the small parts and the Task card later, with permission; Arzel builds the Event, Project and Routine cards following that pattern.

### Color in Figma

- Neutral ramp for everything structural; accent = brand purple for interactive and selected things (selected nav, focus, drag, primary button). Filled buttons use accent/700 so white text stays readable.
- Area role tokens (`area/solid` = 500, `area/tint` = 100, `area/text` = 700, `area/text-on-tint` = 800, `area/border` = 300) point to the accent ramp as a stand-in. Code swaps in the real area palette per item.
- Priority has fixed colors not tied to areas: High = negative, Medium = warning, Low = neutral, None = no flag.
- Group labels are neutral text with a small area dot, never colored text.
- One event style (tint, no border) for all events including birthdays; one progress bar style everywhere.

### Area palette (Open)

Arzel's 6 starting ramps (blue, teal, pink, mauve, gold, terracotta) stay. More ramps will be added that stay clearly distinct; first candidates were sky, olive and khaki, with optional fixes for mauve (too close to brand) and terracotta (too close to warning and negative). Not finalized.

### Compact type

| Token | Size / line | Weight | Color |
| --- | --- | --- | --- |
| `type/page-title` | 20 / 28 | 600 | text/primary |
| `type/heading` | 14 / 20 | 600 | text/primary |
| `type/card-title` | 13 / 18 | 500 | text/primary |
| `type/body` | 13 / 18 | 400 | text/secondary |
| `type/subtask` | 12 / 16 | 400 | text/secondary |
| `type/meta` | 12 / 16 | 400 | text/tertiary |
| `type/label` | 11 / 16, caps, +0.04em | 600 | text/tertiary |
| `type/tag` | 11 / 16 | 500 | per tag |

Text colors: primary #111827, secondary #4b5563, tertiary #6b7280 (lightest allowed for text), disabled #9ca3af (done and cancelled only).

### Compact spacing and sizes

| Token | Value |
| --- | --- |
| `card/padding` | 8 vertical, 12 horizontal |
| `card/gap` | 2 |
| `subtask/row` | 20 tall, 2 gap |
| `column/stack-gap` | 6 |
| `column/padding` | 8 |
| `column/width` | 260 |
| `board/gap` | 8 |
| `group/gap` | 12 |
| `sidebar/item-height` | 28 |
| `tag/height` | 20, 8 side padding |
| `counter/height` | 18, 6 side padding |
| Radius | card 8, control 6, checkbox 4, tag full |

Figma uses auto layout everywhere, with gaps and padding bound to these tokens; Grid auto layout for calendars and galleries; column layout grids only on full-screen frames.

### Navigation

A 48 px icon rail (Home, Tasks, Calendar, Areas, Projects, Routines, Settings) plus a 240 px context sidebar with the views of the current section, matching the existing Figma draft.

### Components

One Task card with properties (state, status, priority, subtasks, meta, progress) instead of separate drawings; small reusable parts: checkbox, tag, counter, meta row, progress bar, group header, column header, nav item, segmented control.

### Mock-up review changes (Nov 13)

- Card titles go up to 14 / 20, weight 500; metadata stays 12 / 16 tertiary, and column headings stay 14 / 20 weight 600, so no other heading changes.
- Cards show the priority flag only for High (red) and Medium (orange). Low and None show no flag on cards, but keep their Eisenhower meaning in the Priority view columns and in the detail panel.
- Checkboxes use a 2 px border (task 16 px, subtask 14 px).
- Navigation rail keeps the Figma draft's style: a lavender (accent/200) rounded pill inset 4 px inside the 48 px column, accent/600 icons, the active icon on a white circle.
- Routine step cards have no outline; a round checkbox marks them as routine steps.
- Board content follows the updated data model: goals, milestones and project groups are gone. Area columns group by project (with "x/y done" in the group header) and Others; metrics with targets show as cards with a progress bar ("12/20 km", "35%"); routine steps appear in their own area; the sidebar adds Templates. The detail panel shows Project › Section, Status (To do / Done / Cancelled), Scheduled date with rollover count, and Due date.

### Second review (Nov 13)

- No repeated information on cards: the icon and card style already say what an item is, so cards drop words like "Target" and "Completed". Metric cards show the period or deadline ("This week", "By Dec 31") with the value against the target on the bar ("12 / 20 km"); completed tasks show only their date; routine steps show only their routine's name. The detail panel drops the breadcrumb because Area and Project rows already show it.
- Area (column) names go up to 16 / 24, weight 600, with a 10 px area square.
- Group names (projects and Others) go up to 14 / 20, weight 600, in sentence case and text/primary, with the item count beside them. Project progress is shown on the project page, not in board group headers.
- Entities follow `docs/project_details.md` and `docs/schema.sql` as of Nov 13: life areas, projects with sections, tasks with subtasks, task templates (recurring when they have a repeat rule), events with exceptions, metrics with entries and targets (reach-by or per-period), routines with schedules, steps, pauses and logs.

### Consistency pass (Nov 13)

- Group names (projects and Others) go back to the caps label style: 11 / 16, weight 600, uppercase, tertiary, with a plain count.
- Icon sizes: 12 inline (metadata, tags, counters, chevrons), 16 for UI (rows, buttons, sidebar, panel properties, card markers), 18 in the rail.
- Counters: a grey pill in headers (columns, panel sections); a plain number in lists (sidebar, groups).
- Hover: neutral-100 on white surfaces, neutral-200 on grey columns.
- Spacing stays on a 4 px grid, with 2 and 6 allowed for small inner gaps; buttons and segmented controls use 12 px side padding.
- Six font sizes in use: 20 page title, 16 column and panel titles, 14 card titles, 13 sidebar and panel body, 12 metadata and board subtasks, 11 labels and tags.
- Open: cards show dates without saying whether they are scheduled or due. Proposed rule: a plain date is the scheduled date; a due date carries a small due icon, and turns red when overdue.

### Third review (Nov 13)

- The spacing and text sizes are approved (Decided). Placement of elements and icons inside cards is still to be brainstormed.
- Cards show only the due date, never the scheduled date. A card with no due date shows no date. Overdue = the due date in red with "Overdue"; the card's background never changes for overdue items.
- The Kanban board always sorts cards by scheduled date; cards with no scheduled date sort by due date.
- Section labels (group names, sidebar and panel section labels) go up to 12 / 16, weight 600, caps.
- Being tested: a white main frame with no grey column backgrounds, so each card is defined by its 1 px border alone. Columns lose their padding, and the gap between columns goes to 16. Routine steps take the same neutral border as other cards, since the border is now the only edge (the earlier area-colored outline stays removed).

* The first group label sits 6 px under the column header, the same gap the Inbox column has before its first card. The 12 px group gap applies only between groups.
* Inside a card every vertical step is 2 px: title → metadata → progress bar or subtasks.

- A 16 px gap separates the 48 px page header from the board (`board/padding-top` = 16).

* Page gutter is 24 px on the top, sides and bottom. The page header row is 32 px tall, starting 24 px from the top of the window; the sidebar's section title lines up with it.

- The 24 px top gutter applies to the main content only; the expanded sidebar keeps its own header position.
- Sidebar labels all start at the same x: area dots sit in the same 16 px slot as icons, with the same 8 px gap.
- Metric cards: title, then the progress bar, then one metadata row with the period on the left and the value on the right ("This week … 12 / 20 km"). The bar has 2 px extra above and below so it looks evenly spaced against the text lines.
- The subtask toggle ("1/3") sits at the right end of the metadata row, not beside the title.

* The expanded sidebar has no title; the rail already shows which section is open. Its groups (views, Projects, Routines, and Completed/Archived at the bottom) are separated by 1 px dividers with 8 px above and below and no side inset.

- Expanded sidebar gutter: 16 px top and bottom, 12 px sides; dividers have 12 px above and below.
- Detail panel: the title comes first, then subtasks and notes. The properties (area, project and section, priority, status, scheduled and due dates) live in a "Details" section at the bottom, collapsed by default.

* Detail panel, replacing the collapsed "Details" section: the header shows a breadcrumb (area dot › area › project › section) with actions on the right. Under the title, one row of 28 px icon buttons (no borders, grey hover) holds the properties: priority flag in its color (icon only, tooltip names the level), due date (red when overdue), scheduled date, and repeat. Clicking one edits that property. The row lines up with the title text.
* No border between the rail and the expanded sidebar. Sidebar dividers have 16 px above and below.

- Detail panel, final layout for now. Header: the done checkbox, a short vertical divider, the priority flag (icon only, in its color), another divider, the due date (red when overdue), then only the "⋯" menu on the right; no close button and no breadcrumb. Body: the title, then the property list (Area, Project › Section, Scheduled with its rollover count), then subtasks and notes. Status is not listed (the checkbox shows it); priority and due date aren't repeated in the list because the header shows them.

### Design tokens file (Nov 13)

Tokens are exported as DTCG JSON in three collections: Primitives (113 tokens: color ramps, alpha, space, radius, size, font), Semantic (26: text, bg, border, accent, focus, priority, area stand-in) and Component (96: rail, sidebar, page, board, column, group, card, event, checkbox, subtask, progress, tag, counter, panel, button, icon button). A separate styles file holds 12 text styles and 3 effects (overlay, raised, focus ring). In the wireframe, `area/solid` points to brand-600 instead of brand-500, so checkboxes and progress bars stay visible on white. Area palettes stay out of Figma and live only in code.

- Phase A done in the Figma file "Life OS App": 235 variables in Primitives / Semantic / Component, with scopes and WEB code syntax (`var(--name)`) set and Primitives hidden from publishing. There are 12 text styles and 3 effect styles under "Life OS/"; font size, line height and weight are linked to the font variables, and the focus ring color to brand-600.

## Approved: Area screen (Nov 14)

The Career mock-up (life-os-approved-area.html) is the approved design for every life area's page. Decided.

- Navigation: the rail icon is a group and the sidebar lists the screens in that group. The Areas group's sidebar has a LIFE AREAS group heading (13 px, semibold, caps; clicking it opens the all-areas overview) with a + on the right to add an area, then one row per area with its color dot. No counts in the sidebar. Archived areas sits at the bottom. The sidebar has a 1 px right border, and the last group has no divider under it.
- Header: area dot + name (20/28), the vision underneath, then on the right one period switch (Week / Month / Quarter / Year with ‹ › and a label such as Q4 2026), a ⋯ menu, and an Add split button in the area's 500 color with a divider before the ▾.
- One period for the whole screen: tiles count within it and compare with the previous period; the timeline spans it; the agenda runs from today to its end; routine squares cover it.
- KPI tiles: open tasks, completed, on time, rollovers, routine steps done, active projects. Number 24/32 semibold. Trend lines are positive-600 when the trend is good and negative-600 when it is bad.
- Below the tiles: a left column (Timeline, Projects, Routines, then one tabbed card) and a 360 px Agenda on the right.
- Timeline: collapsible Projects, Events and Metrics sections. Bars use soft area colors (300 fill on a 100 track). Projects run from start to due date with progress; events are markers; each metric is a row drawn from its targets: per-period targets as one segment per period (met = full, not met or current = filled to the amount reached, upcoming = outline), reach-by targets as one bar with ◆ at the deadline, and a dashed "No target" line when there is none. Missed deadlines are not marked.
- Projects: board-style cards with the strong area-500 progress bar.
- Routines: one heatmap row per step in this area, grouped under its routine ("3 of its 5 steps are in Career"). One square per day: done, skipped, missed, paused, today, upcoming (empty outline), not due (dot). No rate or streak columns. Steps are yes or no.
- Tabbed card: Needs attention, Unscheduled, Recurring, Completed, Notes. One 36 px row per item with one short note on the right; only overdue is red.
- Agenda: overdue first, then each day; tasks, events, project due dates and target deadlines; no routine steps. Every marker is a 16 px box.
- Counts everywhere (agenda groups, tabs, Kanban column headers) use the same grey counter pill.
- Each card has one corner icon that opens a sort, filter and view-as-table menu. Icons are drawn with a 2 px stroke.
- Open: whether cards can be moved, and whether projects get a real start date (the timeline uses the created date until then).

## Approved: Life areas overview (Nov 14)

The overview behind the LIFE AREAS heading (life-os-approved-areas-overview.html) is approved. Decided. It compares areas instead of repeating an area page.

- Header: "Life areas", the same period switch, a ⋯ menu and a New area button in brand 700.
- Effort (top): one 24 px split bar of completed tasks by area, solid area colors, only the white percentage inside each segment. Under each segment, aligned to it: the area name, the task count and the change in share vs the previous period.
- Outcomes: every metric as a small tile (five per row), grouped into one light grey panel per area so membership is clear. Tile: name, value with its target in words, a smooth line chart, and one summary line. No status tags: the line is positive-600 when on track, met or improving and negative-600 when behind. Per-period targets plot one point per finished period with the current period as a hollow dot (no line to it); reach-by targets plot the value over time with a target line and ◆ at the deadline; metrics without a target plot the line only. One chart style for the whole card.
- Projects: one bar per area showing the share of tasks done in its active projects (area 500 on 100), a black pace mark for how much of those projects' time has passed, and "N pts ahead of / behind pace" (positive or negative text) or "On pace".
- Routine steps done: one row per area, one square per week of the period; shade = share of due steps done (darker = more), this week outlined, upcoming weeks as empty outlines; this week's % on the right.
- Wins: targets met and projects finished in the period, each with a green check and its area.
- Every colored mark also carries its area's name: plum and rose fail the color-distance check, so color is never the only cue.
- Each card keeps one chart style; the card's corner menu holds sort, filter and view as table.

## Update: metrics belong to their owner (Nov 14)

Replaces the KPI tiles and timeline rules in "Approved: Area screen" and the Outcomes rule in "Approved: Life areas overview". Decided.

- A metric shows only on its owner's screens. Area-owned metrics appear on the area page and the Life areas overview; project-owned metrics appear only on that project's page.
- Area page: the top card is Metrics, the area's own metrics as the same small tiles used in the overview's Outcomes (five per row; smooth positive or negative line; value with its target in words; one summary line). The six task-statistics tiles (open tasks, completed, on time, rollovers, routine steps done, active projects) are removed.
- Area page timeline: Projects, Events and Metrics sections. The Metrics section shows the area's own metrics only, one row each: per-period targets as one segment per period (met = full, not met or current = filled to the amount reached, upcoming = outline) and a dashed "No target" line when a metric has none. Section labels are sentence case, 13 px semibold.
- Area page agenda: tasks and events from the area and from every project inside it, plus project due dates. Target deadlines appear only for the area's own metrics.
- Life areas overview, Outcomes: area-owned metrics only, grouped by area.

## Approved: Life areas empty states and New area pop-up (Nov 14)

Mock-up: design/html\_mockups/approved-areas-empty.html (switch states at the bottom left). Decided.

- No areas: the sidebar shows the LIFE AREAS heading with + and one muted line ("No life areas yet. Use + to add one."). The header's period switch and ⋯ are faded; New area stays active. The page shows a centered message ("Set up your first life area"), one explanatory line, a New area button, and quick-start chips (Career, Finance, Health, Personal, Relationships, Home) that open the pop-up with the name and color filled in.
- Areas but no data: every card keeps its title and place; its body is one muted line saying what will appear there, plus a ghost action where useful (New project, New routine, Add metric). Outcomes shows each area's panel with a dashed placeholder tile.
- New area pop-up (460 px, 12 px radius, overlay shadow, 32% backdrop): Name (required), Color (the six palette colors with names; a color in use shows the area that uses it; repeats allowed with a hint), Vision (optional), a sidebar-row preview, then Cancel and Create area (brand 700). The area color is stored as its palette name.

## Working rule: every screen mock-up includes its mock states (Nov 14)

Decided. Every new screen mock-up ships with a dark "Mock state" switcher at the bottom left (as in approved-areas-empty.html and draft-week-board.html) covering at least:

- The normal state with realistic data.
- Empty states: nothing created yet, and items created but no data yet. Every card keeps its title and place, with one muted line and a ghost action where useful.
- The screen's pop-ups and overlays: create and edit forms, menus, confirm dialogs, the detail panel, and the undo popup where they apply.
- Interaction states that matter on that screen, such as dragging, selected, or a collapsed section.

## Approved: Project screen (Nov 14)

Mock-up: design/html\_mockups/approved-project.html (Resume & portfolio, Career). It is the approved design for every project's page and follows the area screen. Decided.

- Navigation: the Areas group's sidebar has two groups, LIFE AREAS and PROJECTS, each a caps heading with a + on the right. PROJECTS lists active projects only, each with a folder icon in its area's color; clicking the heading opens the all-projects overview. Done and cancelled projects live under Archived at the bottom.
- Header: folder icon in the area color + project name (20/28). Under it: the area tag, a status chip, the date range with days left, then a 120 px progress bar (area 500 on 100) with a black pace mark and "60% · 3 of 5 tasks · on pace". On the right: the same period switch, a ⋯ menu (edit, complete, archive, delete) and the Add split button in the area's 500 color.
- Top card: Metrics, the project's own metrics as the same tiles as the area page. No task-statistics tiles.
- Timeline, the same as the area page's: Project (one bar from start to due date with its progress), Events (the project's events) and Metrics (the project's metrics, same segment and reach-by rules). No shaded project window, no task markers.
- Routines: the routine steps the project owns, in the area page's heatmap. The card shows only when the project owns steps.
- Tabbed card: the area page's tabs (Needs attention, Unscheduled, Recurring, Completed, Notes). Each row's note starts with its section ("Resume · Overdue 10 days").
- Agenda (360 px, right): the project's overdue and upcoming tasks, its events, its due date and its metrics' target deadlines.
- No Sections card; sections show in the tabbed card's row notes.
- Open: projects have no start date yet, so the start is the created date. Proposed: add a nullable `start_date` that falls back to the created date.
- Mock states (same file, switcher at the bottom left), following the area screen and the presentation rules (data-only subtitles, no legends except the routine key, "Sort and filter" card menus): Normal; New project with no data (Started Nov 14 · no due date, "No tasks yet", each card with one muted line and a ghost action, no Routines card); Add menu (Task, Section, Event, then Metric and Routine step); ⋯ menu (Edit project, Complete project, Cancel project, Archive project, then Delete project, disabled with "Only empty projects can be deleted. Archive it instead." while the project has items); Edit project pop-up (Name, Life area, Start and Due, Notes in Markdown); Complete project confirmation listing the cascade (open tasks and upcoming events cancelled; recurring tasks, routine steps and metrics archived with entries kept), and Cancel project uses the same confirmation; Archive project confirmation; New metric pop-up with the project as owner.

## Approved: Area screen mock states (Nov 14)

Mock-up: design/html\_mockups/approved-area-states.html. Decided.

- New area, no data: every card keeps its title and place with one muted line and a ghost action (Add metric, New project, New event, New routine step, Add task). The Metrics card shows a dashed tile explaining what metrics are for.
- Add menu (the ▾ of the Add split button): Task, Event, Project, then Metric and Routine step, with a footer saying everything added belongs to this area.
- ⋯ menu: Edit area, Archive area, then Delete area. Delete is disabled with "Only empty areas can be deleted. Archive it instead." while the area has items (the API refuses with 409); for an empty area it opens a red delete confirmation.
- Edit area pop-up: the New area form pre-filled (name, color with the area using each color, vision) plus Notes (Markdown); Cancel and Save changes.
- Archive area confirmation: lists what is archived with it (active projects, open tasks, upcoming events, metrics with entries and targets kept, routine steps) and notes that nothing is deleted and it can be restored from Archived areas; Cancel and Archive area.
- New metric pop-up (520 px): owner tag (the area), Name, Unit (optional), Combine entries by (Sum / Average / Latest, each explained), Better when (Higher / Lower), and an optional Target (No target / Every period: value per day, week or month with a start date / Reach by a date), with a hint for how it will look on the tile and timeline; Cancel and Create metric.

## Note: the sidebar is responsive and collapsible (Nov 14)

Decided; replaces the earlier "Navbar, expanded" row in App shell where they differ.

- Collapsible: a toggle (and `Ctrl + B`) hides the 240 px sidebar so only the 48 px rail shows. The rail icon of the open group shows the sidebar again. The choice is remembered.
- Resizable: drag the sidebar's right border between 200 and 320 px; double-click resets it to 240. Dragging below 160 collapses it.
- Responsive: when the window is narrower than about 1440 px, the sidebar collapses on its own and opens as an overlay on top of the page when needed, closing again after a choice. At 1920 px it stays docked.

## Approved: Life areas overview mock states, and presentation rules for every screen (Nov 14)

Mock-up: design/html\_mockups/approved-areas-overview-states.html. It supersedes approved-areas-overview.html and approved-areas-empty.html, which are kept only for history. Decided.

- States: Normal, No areas, Areas with no data, New area pop-up, ⋯ menu (Reorder areas, Archived areas, Export as CSV), Reorder areas pop-up (drag handles; the order is used in the sidebar and every overview; Cancel and Save order), and the card menu.
- Card menu (one corner icon per card, tooltip "Sort and filter"): Sort by, Show filters and, on Outcomes, an Areas filter with one checkbox per area; Group by area. Checkboxes in menus use the accent (brand 600). No "View as table" for now.
- Outcomes groups do not collapse; hiding areas is done with the card menu's Areas filter. Group headers show the area dot, name and a data summary only.

Presentation rules, applied to the overview and to the approved area screens (approved-area.html, approved-area-states.html):

- Show data, not guidance. Card subtitles carry data only (for example "10 metrics owned by 6 areas · 6 on track or met, 4 behind", "Where your completed tasks went in Q4 · 132 in total", "5 steps in 2 routines"). Explanatory sentences, chart legends, form hints and menu footers are removed; there are no info icons. Empty states keep a short status line ("No metrics yet", "Nothing in Q4 yet.") plus their action. The first-run "Set up your first life area" message keeps its explanation.
- Card titles sit 4 px closer to the card content (body top padding 4 px).
- Status messages that explain why an action is unavailable stay (for example "Only empty areas can be deleted. Archive it instead.").
- Requires a sort\_order on life areas for Reorder areas, if it doesn't exist yet.

## Working rule: one mock-up file per screen (Nov 14)

Decided. Each screen has exactly one approved file, design/html\_mockups/approved-\<screen>.html, holding every mock state. When a new version is approved it overwrites that file, and outdated files (older approved versions, drafts that were approved) are deleted. Drafts are named draft-\<screen>.html until approved.

Current files: approved-area.html (area page, all states; earlier sections call it approved-area-states.html), approved-areas-overview.html (Life areas overview, all states; earlier sections call it approved-areas-overview-states.html or approved-areas-empty.html), approved-project.html (project page), approved-projects-overview.html (Projects overview), approved-detail-panel.html (detail panel).

## Approved: Projects overview (Nov 14)

Mock-up: design/html\_mockups/approved-projects-overview.html, opened from the PROJECTS heading in the Areas sidebar. Decided. It compares projects and shows what needs a push, without repeating the timeline.

- Header: "Projects", the period switch, a ⋯ menu and a New project button (brand 700). No question line under the title.
- Execution stats (top row, 6 tiles): Tasks done, On time, Overdue now, Rollovers per task, Open tasks, Projects finished, all counted from project tasks. These are stats, not user-set metrics, so they are allowed here. Each tile: label, number, a mini line chart to the right of the number (the metric-tile style: smooth line, light wash, end dot; positive-600 when improving, negative-600 when getting worse; one point per week, value on hover; no targets or periods), and one short data line ("+6 vs Q3", "in 2 projects").
- Timeline: one lane per area, one bar per project (the area-page bar style); finished projects grey; projects without a due date fade out at the end.
- Next up (360 px, right of the timeline, same height): one card with three sections, each with a caps label and a counter. Due next: a days-left badge (red when 7 days or less), folder icon, name, "Nov 30 · 2 open · 1 overdue". Stalled: projects with nothing done in 14+ days ("Nothing done for 25 days") and a Plan task button. No next step: projects with nothing scheduled in the next 7 days ("12 open, none scheduled") and a Schedule button. Sections with nothing in them are hidden.
- Projects board (full width, under the timeline): project cards in columns. Card: folder icon, name, progress bar (area 500 on 100), "Due Nov 30 · 16d" and "3 / 5". No pace on the board. Finished projects are shown struck through and greyed out.
- Board menu (the card's corner icon, "Group, sort and filter"): Group by Area / Pace / Due date (columns: areas; Behind pace, On pace, Ahead, No due date, Finished; This month, Next month, Later, No due date, Finished), Sort by Due date / Progress / Name, and Show finished projects. No switch tabs in the card header.
- Area: shown by the folder icon's color only; rows and cards carry no area tag. This replaces "every colored mark also carries its area's name" for project rows and cards on this screen.
- Quick action buttons: 28 px, icon + word (Plan task, Schedule, Add task), brand-50 background with a solid 1 px brand-400 outline and brand-700 text.
- Mock states: Projects, No projects (first-run message and New project button), Projects with no tasks (zero and dash tiles, short status lines, Add task buttons), Board menu, New project pop-up (Name, Life area chips, Start and Due optional, Notes in Markdown, sidebar preview; Cancel and Create project).
- Open: thresholds for Stalled (14 days) and No next step (7 days) are defaults.

## Update: edit in the side panel, and empty states say it once (Nov 14)

Decided. Replaces the Edit area and Edit project pop-ups in the approved area and project screens.

- Clicking or editing an existing entity (area, project, task, recurring task, event, metric, routine, routine step) opens the detail panel on the right, never a pop-up. "Edit area" and "Edit project" in the ⋯ menus open the panel. Pop-ups are only for creating something new (New area, New project, New metric) and for confirmations (Complete, Archive, Delete).
- The mock-ups show this as the "Edit area (side panel)" and "Edit project (side panel)" states.
- Empty states say their status once. A card whose body is an empty line or an empty tile has no subtitle; an Outcomes group with only the empty tile has no "No metrics" in its header; the agenda says "Nothing scheduled." (its header already shows the range); an empty project's header shows no "No tasks yet"; a project without tasks shows that only in No next step, not again in Due next or on its board card.
- Card corner icons are always the sort-and-filter icon, including on empty cards.
- These rules live in design/mockup\_src/rules.py and are applied to every approved screen.

## Approved: Detail panel (Nov 14)

Mock-up: design/html\_mockups/approved-detail-panel.html (shown over the Projects overview). Decided. One panel for every entity with notes: life area, project, task, recurring task, event, metric, routine, routine step. Clicking or editing any of them opens it; clicking an area or project in the sidebar still opens its page. The Notes tab on the area and project pages is removed; notes live in the panel.

- Frame: floats over the page on the right, 400 px (drag 360–560 from the left edge: hovering the edge shows a brand line and handle; no expand button), overlay shadow, Esc closes.
- Padding: 24 px sides, 56 px header, 12 px above the title, 14 px between sections, notes end about 40 px above the toolbar.
- Header, identical for every entity: area-color dot + quiet breadcrumb (12 px, tertiary; for example Career / Resume & portfolio / Resume) on the left, only the ⋯ menu on the right. No border under it. The ⋯ menu holds View Markdown, then Complete and Archive; no Open page or Copy link for now.
- Title row: a 22 px marker tile in the area tint (task: checkbox outline, click to mark done; project: folder; area: solid square; event: filled calendar badge; metric: chart) + the title at 20/28 semibold.
- Under the title: one row of small outlined chips instead of a properties table (24 px, 6 px radius, icon + text, click to edit). High priority and overdue chips are red-tinted; an unset optional property (Repeat) is a dashed chip. Areas show their vision line above the chips.
- Content: subtasks (tasks only), then Notes with a caps label and "Saved" / "Saving…" on the right. Repeating events add a "Notes for: This event / All events" switch.
- Notes editor: Markdown, no toolbar inside the text. One floating toolbar at the bottom centre of the panel, always in the same place: rounded grey groups on a white pill (Bold, Italic, Underline, Strikethrough | Bulleted, Numbered, Checklist | Link, Inline code). Typing "/" on an empty line opens Heading 1–3, Quote, Code block and Divider. Underline is stored as \<u>; text alignment is not offered (Markdown can't store it). Empty notes show "Add notes…".
- Mock states: Task, Typing, "/" menu, Project, ⋯ menu, Area, Event (repeating), Empty notes, Resize.

## Update: consistency pass (Nov 14)

Decided. Brings every approved mock-up in line with the later sections above. The rules live in design/mockup\_src/rules.py and are applied to approved-area.html, approved-areas-overview.html, approved-project.html, approved-projects-overview.html and approved-detail-panel.html.

- One sidebar for the whole Areas group (area page, project page, both overviews): LIFE AREAS, then PROJECTS, then Archived at the bottom. "Archived areas" becomes "Archived": it holds archived areas and done or cancelled projects, and the Archive area confirmation points there.
- The tabbed card on the area and project pages has no Notes tab (Needs attention, Unscheduled, Recurring, Completed); notes live in the detail panel.
- Show data, not guidance: the Reorder areas pop-up drops its explanation line, and an empty sidebar group says only "No life areas yet." or "No projects yet." (the + beside its heading is the action).
- When no projects exist (no areas, or areas with no data), the PROJECTS group shows its heading with "No projects yet."

## Update: palette names and reordering areas (Nov 14)

Decided. Replaces the Reorder areas pop-up and the ⋯ menu item in "Approved: Life areas overview mock states". Mock-up: approved-areas-overview.html.

- Area colors are shown with their stored palette names: Blue, Teal, Pink, Mauve, Gold, Terracotta. Earlier mentions of rose, plum and ochre mean pink, mauve and gold.
- Areas are reordered by dragging their rows in the sidebar's LIFE AREAS group, on any Areas screen; the order still drives the sidebar and every overview, and saves on drop. There is no Reorder areas pop-up and no Reorder areas item in the overview's ⋯ menu (which keeps Archived areas and Export as CSV).
- While dragging, the row lifts with the overlay shadow and shows its grip, and the drop spot is a dashed outline (dashed borders mean drag-and-drop only). The mock state is "Drag to reorder".

## Update: create forms, metric fields and Delete (Nov 14)

Decided. Applies to every create pop-up and to the detail panel. The rules live in design/mockup\_src/rules.py (`forms()`), applied to all approved mock-ups. Data rules for these (metric format and source, current value, deleting) are recorded by Claude Code in docs/DOMAIN.md and docs/schema.sql.

### Create forms

- The Create button stays disabled until every required field is filled. Hovering it names what is missing ("Choose a routine step"); this is a status message, so it is allowed.
- No field is labelled "optional". Fields with a sensible default come filled in; the rest can stay empty.
- Enter submits once Create is enabled; Esc cancels.

### New metric pop-up (520 px)

| Field | Rule |
| --- | --- |
| Name | Required. |
| Owner | Filled in from the page (area or project tag); changed with the owner picker. |
| Source | Manual entries (default) or Routine step. Can't be changed after creation. |
| Measure as | Manual only. Presets: Number, Money, Percentage, Time, Distance, Weight, Pages, Chapters, Times. The menu shows each preset's icon, name and a sample value as it will display (₱1,500, 35%, 1 h 30 m, 5 km). |
| Unit / Currency | Number shows a Unit field (free text, shown after the value: "2 pieces"); Money shows Currency (default PHP, symbol before the value: "₱12,500"); Percentage and Time have none. |
| Each period shows | Total, Average or Latest. For a routine step: Days done or Completion rate. |
| Better when | Higher or Lower. Hidden for a routine step (always higher). |
| Current value | Manual only. Logs the first entry today; inputs show the currency symbol or unit. |
| Target | No target, Every period (value per day, week or month, starting a date) or Reach by a date (value by a date). |

- A routine-step metric shows Routine step (choose a step) instead of Measure as, Better when and Current value. Create stays disabled until a step is chosen.
- Values are formatted by the metric's format everywhere: tiles, timeline, agenda and the panel.

### Delete

- The detail panel's ⋯ menu is View Markdown, then Complete and Archive, then Delete last, in red. For a project or area that still has items it is disabled with "Only empty projects can be deleted. Archive it instead."
- One-off tasks, subtasks, metric entries and targets delete at once with an undo toast. Metrics, routines, routine steps, recurring series, events and sections ask first in a red confirmation that lists what goes with them ("9 entries · 1 target") and says it can't be undone; the button is red (negative-600) and names the action (Delete metric). A repeating event asks This event / This and following / All.
- A recurring occurrence has no Delete, only Cancel.

### Mock states added

- approved-area.html: New metric (Money, reach by), Measure as menu, New metric with a routine step (Create disabled), Delete metric confirmation.
- approved-project.html: New metric (Number with a unit, reach by).
- approved-detail-panel.html: ⋯ menu with Delete project disabled.
- New area and New project pop-ups lose their "optional" tags.

### Next

Pickers (date, date range, time, repeat, period, owner, section, priority, Measure as, routine step) get their own draft-pickers.html, then Phase B continues with the week board.

## Approved: Pickers (Nov 15)

Decided. Reference: design/html\_mockups/approved-pickers.html (13 mock states, built by mockup\_src/build\_pickers.py). Every picker is a popover anchored under the chip, breadcrumb item or field it edits; that chip gets the focus ring (accent-600 border, 2 px accent-200 halo) while it is open. Popovers: white, 1 px border, 10 px radius, 6 px padding, the menu shadow; rows 30 px, 13 px text, a value or date right-aligned in 12 px tertiary, a check in accent-600 for the current choice. Clicking a row or a day applies it and closes the picker; only Custom repeat has Cancel and Done.

### Calendar grid (shared)

- Monday first; 32 px columns; header "November 2026" with ‹ › on the right (a two-month picker shows ‹ on the first month and › on the second).
- Today: accent-700 bold number with a 1 px accent-500 ring. Chosen day: accent-600 fill, white bold number. Days outside the month: disabled text.
- A range is shaded accent-100 from start to end, both ends filled. While typing, the matched day gets an accent-600 outline on accent-100.

### Pickers

| Picker | Opens from | Contents |
| --- | --- | --- |
| Date | Due or scheduled chip, any date field | Typed date field on top; Today, Tomorrow, Next week with their dates; the month grid; then "No due date" (due) or "Unscheduled" (scheduled). Typing ("fri", "nov 20", "+3d") shows the match as the one row and outlines it on the grid. |
| Date range | Project's dates chip | Start → Due fields (the active one focused), two months side by side, the number of days and "No due date" in the footer. |
| Event date and time | Event's date chip | Starts and Ends rows (date field + time field), an All day switch. The time list drops from a time field in 15-minute steps; the end list shows durations ("3:00 PM · 1 h"). |
| Event over several days | Same, All day on | Starts and Ends dates only, and a month grid with the range shaded. |
| Repeat | Repeat chip | Does not repeat, then Every day, Every weekday (Mon – Fri), Every week (Sat), Every month (on the 14th), Every year (Nov 14), taken from the item's date; then Custom ›. |
| Custom repeat | Custom › | Every \[n\] \[day/week/month/year\]; On: weekday toggles; From: Schedule or Completion (tasks only); Ends: Never, On a date or After \[n\]. Footer: the rule as data ("Tue, Sat · until Feb 27"), Cancel, Done. |
| Priority | Priority chip | High, Medium, Low, None with their flags and Eisenhower names (Do, Schedule, Delegate, Eliminate). |
| Owner | Area or project in the breadcrumb | Search, Inbox (tasks only), then each life area with its active projects indented under it. An area or a project can be picked. |
| Section | Section in the breadcrumb | No section, then the project's sections in order. |
| Period | The page header's period label | Quarter view: a year switcher and Q1–Q4 tiles with their months. Week, month and year versions come with the Calendar screens. |
| Routine step | New metric, Source = Routine step | Search, then steps grouped under "ROUTINE · schedule" labels, each with its area's color square. |
| Measure as, Currency, Color | Their fields | Approved earlier (Nov 14 and the palette update). |

## Approved: Calendar (Nov 15)

Decided. Reference: design/html\_mockups/approved-calendar.html (Week view, 18 mock states, built by mockup\_src/build\_calendar.py). The Calendar is one screen; Month, Quarter and Year are added to the same file in Phase D. Week and Month use FullCalendar's free day-grid view (no time grid); Quarter and Year are custom.

### Layout

- Header, left to right: the Week / Month / Quarter / Year switch, then the range as ‹ Nov 9 – 15 › in 22 px semibold (clicking it opens the period picker), then Today only when the range is not the current one. No page title, no Add button, nothing on the right.
- Sidebar = the filter menu, top to bottom: PANEL (Agenda, Inbox with its count; clicking the open one hides the panel), LIFE AREAS (a checkbox in each area's colour, plus No area), SHOW (Events, Tasks, Routine steps, Project due dates, Completed, Cancelled, Weekends; all on except Cancelled), PRIORITY (High, Medium, Low, None). The filters apply to the calendar and the panel alike. No sort option: order is fixed (events by time, then routines, project due dates, tasks; done last).
- Right panel (360 px, from the top of the screen to the bottom, 12 px from the calendar): the approved agenda card. Agenda lists exactly what the calendar shows, grouped by day (Mon · Nov 9, Today · Sat, Nov 14), with no range in its header; an empty range says "Nothing scheduled.". Inbox lists every task without a date, owned or not, with a Scheduled / Due switch (no scheduled date, or no due date); dragging a task onto a day sets that date.

### Week view

- Seven equal day cells with thin dividers; no background on today, weekend or upcoming columns. Today is shown only by its date in the accent square.
- Multi-day and all-day events are bars across the top, packed so bars that do not overlap share a line; a bar covers only its own days. A bar that started before the range shows a cut edge and "since Nov 7".
- Day entries are 24 px rows: timed events (time, title, area tint with an area-coloured edge), routines (progress ring, name, 2/5), project due dates (folder, name, Due, dashed border), tasks (area checkbox, title). No priority flags in the calendar.
- Clicking an empty spot in a day opens a small Event / Task menu at that spot, with the date on top.
- An empty week shows nothing in the grid. Nothing created yet shows "No events or tasks yet." and a New event button.

### Rules introduced here

- Text never takes area colours, on every screen: titles, metadata, timeline labels and area tags are neutral; area colour stays on markers, icons, edges, fills and tints. Applied to every approved screen by rules.py (neutral\_text()).
- Past events and bars use the area's past tint (--a-past) with the icon or edge in --a-border, and grey text. Done tasks have a light checkbox (--a-border) and grey struck-through text. Nothing is faded with opacity.
- Subtasks always belong to their task: a grey "1/3 ⌄" toggle at the end of the task (calendar row, agenda and inbox second line). Clicking it turns the task into one bordered white box with its subtasks listed inside; clicking again closes it.
- New event pop-up (480 px): Name, Owner, then All day beside its switch, then Starts and Ends side by side, each with its time under its date, the arrow centred between them; then Repeat and Location.

### Moved

- The untimed day board (Unscheduled + 7 day columns with the Kanban cards) moves to Tasks › Next 7 days in Phase C. Draft: design/html\_mockups/draft-next-7-days.html.

## Approved: Tasks (Nov 15)

Decided. Reference: design/html\_mockups/approved-tasks.html (30 mock states, built by mockup\_src/build\_tasks.py). It covers the whole Tasks group and replaces the Tasks row in Screens, the Eisenhower table's use on boards and the card date rules of Nov 13 where they differ.

### Placement and terms

- Placement rule, everywhere (Tasks, Calendar, agenda): a task sits on its scheduled date; if it has none, on its due date; if neither, it is Unscheduled. Overdue = an open task whose due date is past; it is listed in Today, in a red OVERDUE subgroup at the top of each column.
- A group sets the board's columns and is picked with the header switch. A subgroup is a collapsible block inside a column, picked in the filter-and-sort menu, never the same as the group. Project is never a group in All, Inbox, Today or Next 7 days; it can be a subgroup.
- Inbox (this screen) = open tasks with no owner or no scheduled date. DOMAIN.md still defines the Inbox as "no life area"; Claude Code should record the wider meaning.

### Sidebar and header

- Sidebar: ALL (caps, like the PROJECTS heading), Inbox, Today, Next 7 days, Routines; then PROJECTS with the active projects (folders in their area colour); Completed, Cancelled and Archived at the bottom. Every icon sits in the same 16 px slot with the same gap, so all labels line up. Rows show open-task counts as plain numbers; the bottom three have none.
- Header: the screen title, a divider and the group switch (All and Today: Priority | Area; a project: Priority | Section). Right: the filter-and-sort icon (an accent dot when filters are on) and New task (brand 700). Completed, Cancelled, Archived and Routines have no switch and no New task.

### Screens

| Screen | Columns | Subgroups | Filters | Sort |
| --- | --- | --- | --- | --- |
| All | Priority: Do first, Schedule, Delegate, Eliminate · Area: No area + one per area | Priority group: Area or None · Area group: Project, Priority or None | Priority, Life areas, Show completed / cancelled | Manual, Priority, Date, Due date, Created |
| Today | as All | as All | as All | as All |
| Inbox | one list + the right container | No area, No scheduled date (fixed) | Priority, Life areas | Created, Priority, Due date |
| Next 7 days | No date + 7 day columns, rolling from today | Area, Priority or None | Priority, Life areas; Show events, routine steps, project due dates, completed, cancelled | Manual, Priority, Due date, Created |
| Routines | one per routine | none | — | — |
| Projects (heading) | one per active project | Section, Priority or None | Life areas, Priority, Show completed / cancelled | as All |
| A project | Priority or Section | the other one, or None | Priority, Section, Show completed / cancelled | as All |
| Completed, Cancelled, Archived | Area only: No area + one per area | none | as All | newest first |

Sort never includes Title. Filters are multi-select accent checkboxes. The SHOW section lists Routine steps wherever routine steps can appear.

### Board layout

- Each column is one fifth of the board wide (at least 260 px). Fewer groups leave the remaining width empty; more columns scroll sideways.
- Column title: a 12 px colour square, the title (16/600), the grey counter pill and the + on the right (always visible); an optional data line under it (12 px, tertiary). 14 px separates the title from the first subgroup or card.
- Priority columns: Do first / Urgent & important, Schedule / Important, not urgent, Delegate / Urgent, not important, Eliminate / Not urgent, not important. Squares: High negative-500, Medium warning-500, Low the accent (brand 600), None neutral-400.
- Next 7 days titles: No date / Schedule, Today / Sat, Nov 14, Tomorrow / Sun, Nov 15, then the weekday / Nov 16. No accent square on today.
- Subgroup header: chevron, marker (area square, priority square, folder or none), 12/600 caps label, the grey counter pill, and a + on hover. Collapsible; empty subgroups are hidden except the Inbox's two.
- Counters are the grey pill everywhere, except in the Inbox's right container, where they take a light tint of their area or priority colour.

### Cards

- Task card: checkbox in the area colour (grey = no area), title (14/500, two lines max), then one metadata line that wraps instead of cutting off. Icons come first (flag, repeat, notes, rollover count), then text: the due date as plain text with no word, icon or fill ("Nov 20", "Nov 15 · 6:00 PM"; red when overdue), the project name with its folder, and the subtask toggle "1/3 ⌄" at the right.
- Cards never repeat what the column or subgroup shows. No scheduled date, no area name and no "Inbox" label: the checkbox colour already says the area. Flags show only for High and Medium, and are hidden when the board is grouped or subgrouped by priority.
- Event card: the approved tint card; icons (repeat, location) before the time. Multi-day items are repeated as a card on each day they cover ("All day", "Until 3:00 PM", "From 6:00 PM"); there are no range bars on Tasks boards.
- Project card: folder, name, progress bar, "Nov 30 · 16d" and "3 / 5"; on a day column it sits on its due date.
- Done and cancelled cards use the approved light checkbox and grey struck-through title; archived cards are grey with no strike.

### Inbox

- Left: one column (one fifth wide) with the No area and No scheduled date subgroups. A task missing both is listed under No area only.
- Right: one bordered container whose header holds an Areas | Calendar | Priority switch. Areas: a card per area with its projects as rows, stacked in three columns with no gaps; dropping on the area header sets the area, on a row sets the project. Calendar: the month as a grid, each date with its count of scheduled tasks; dropping on a date sets the scheduled date. Priority: four large cards; dropping sets the priority. A drop target shows an accent-600 2 px border on brand-50.

### Next 7 days and Routines

- Next 7 days: routine cards come first in each day (today's Evening routine open), then events, project due dates and tasks. Area or Priority subgroups are available. An empty week shows the empty columns with no message.
- Routines: one column per routine (progress ring, name, today's n/total, the schedule as the data line). Step card: round checkbox in the area colour, the title, and the last seven days as small squares with a done count ("6/7"); no area name and no highlight on today's square. A step not due today shows its next date ("Sun, Nov 15").

### Interactions

- Add: the column + is always visible; a subgroup's + appears on hover. Both open New task pre-filled with that spot (priority, owner, section or scheduled date).
- Drag between columns changes the grouped property (priority, area, section, day); dropping into a subgroup also sets its property; inside a column it reorders (Manual sort). The card lifts with the overlay shadow; the drop spot is a dashed outline; the target counter shows +1.
- New task pop-up (480 px): Title (required; Create stays disabled until it is filled, with no tooltip), a chip row reusing the detail-panel chips (Owner, Section only when the project has sections, Priority, Scheduled, Due, Repeat; unset chips dashed), Add subtask rows, then Cancel and Create task. Enter submits, Esc cancels. No notes.
- Date picker: the date field, then Today, Tomorrow and Next week as three icon buttons side by side under it (the date shows on hover), then the month. No "Unscheduled" row. This replaces the date picker in Approved: Pickers; approved-pickers.html still shows the old layout until it is rebuilt.
- Undo toast: the Calendar toast design everywhere in the app (white, green check, the message, Undo, Ctrl Z), bottom centre, 6 s; after a delete, completing a card that leaves the board, filing from the Inbox and drag moves.
- Empty states say their status once: "No tasks yet." with New task, "All done for today.", "Inbox is empty.", "No tasks match the filters." with Clear filters.

### Open (defaults kept)

- The rail's Routines icon stays until Phase E.
- "From template" in New task comes later.

## Approved: Calendar Month, Quarter and Year (Nov 15)

Decided. Reference: design/html\_mockups/approved-calendar.html (Week 18, Month 14, Quarter 8 and Year 6 mock states; the mock-state bar has a View switch), built by mockup\_src/build\_calendar.py with build\_cal\_views.py and cal\_data.py. It completes the Calendar screen; the layout, header, sidebar and panel rules of Approved: Calendar still hold.

### Month

- FullCalendar's day grid, Monday first, as many week rows as the month needs. A weekday row (Mon … Sun) on top; each day shows its number ("Nov 1" on the first of a month), greyed outside the month, today in the accent square.
- Routines are not rows: one small progress ring beside the date counts every routine step due that day ("Routines · 3/8" on hover).
- Multi-day and all-day events are bars across each week row, packed; a bar that continues into the next week is cut and repeats its title; one that started before the visible range shows "since Oct 24". Project due dates are rows, as in Week.
- Day entries are the Week view's 24 px rows. A full day ends with "+3 more", which opens the day popover (the date, + for Event / Task, close; the approved agenda rows). Clicking an empty spot opens the Event / Task menu.
- Weekends off removes the Saturday and Sunday columns.

### Quarter and Year (linear calendar)

- One row per month: the month label (OCT) in a 48 px column, then 37 day slots under repeating M T W T F S S letters, a divider before every Monday, blank slots before the 1st and after the last day. Today in the accent square; no weekend shading.
- Bars: events over several days (area tint and edge), then projects from start date (or creation) to due date (white, dashed area border, folder icon). Bars of 1–2 days show only the colour, with the title on hover. A bar crossing a month is cut and repeats its title on the next row.
- Single-day entries are small marks under that day's own bars: event = filled area square, task = area checkbox outline (light when done), project due date = a tiny folder.
- Quarter shows every bar. Year keeps 3 lanes (events first, then the shortest projects) and puts "+n" under the month name; it opens a popover listing the hidden bars.
- Routines are not shown. Clicking a day opens the day popover beside it. Weekends off shrinks Saturday and Sunday to 8 px strips that bars still pass through.

### Panel, pickers and drag

- The agenda lists exactly what the calendar shows, grouped by day, and opens scrolled to today (or the next day shown). Quarter and Year add month headings that stay in view; they leave out routines. Empty range: "Nothing scheduled."; filters hiding everything: "Nothing matches the filters." with Clear filters. The Inbox works the same in every view.
- Period pickers: Month = a year switcher and 12 month tiles; Quarter = the approved Q1–Q4 tiles; Year = 2021 – 2032 and 12 year tiles. The shown period uses the selected-tile style. Header labels: November 2026, Q4 2026, 2026.
- Drag: an event moves and keeps its length; bar ends resize (event dates, a project's start or due date); in Quarter and Year single-day items are dragged from the day popover. The lifted item takes the overlay shadow, covered days the accent-100 shading, the target day the accent-600 border on brand-50, and a dark label shows the new dates ("Thu, Nov 26 – Sun, Nov 29 · 4 days"). Then the Undo toast.
- Sidebar SHOW follows the view: Week and Month list Events, Tasks, Routine steps, Project due dates, Completed, Cancelled, Weekends; Quarter and Year list Events, Tasks, Projects, Completed, Cancelled, Weekends.

### Rules introduced here

- No day starts with a blank line: entries first fill the free lines beside the bars that cover that day, then continue below its last bar (Week and Month; the same for the marks in Quarter and Year). Applied to the Week view too.
- Cells fit their content at any window size: Month shows as many rows as fit, then "+n more"; Quarter and Year marks wrap and end with "+n". Nothing spills out of its cell.
- Times on the hour drop ":00" everywhere in the app (10 AM, 7 – 9 PM, Fri 6 PM – Sun 3 PM); 12:30 PM stays. Applied in the Calendar; approved-tasks.html still shows ":00" until it is rebuilt.
- Date picker (rebuilt in approved-pickers.html): the date field, then Today, Tomorrow and Next week as three icon buttons (the date on hover), then the month. No "Unscheduled" row; the due picker keeps "No due date".

## Approved: Routines (Nov 15)

Decided. References: design/html\_mockups/approved-routine.html (the routine page, 21 mock states, built by mockup\_src/build\_routine.py) and approved-routines-overview.html (the Routines overview, 9 mock states, built by build\_routines\_overview.py). Phase E is complete.

### Data decisions

- Routines have no area. The routine shows the areas of its steps ("5 steps in 3 areas" and their area tags); no schema change.
- Routines don't own metrics. The routine page shows calculated stats, like the Projects overview's execution stats. A metric fed by a step shows as a link on that step (chart icon + metric name). A metric still shows only on its owner's screens.
- Full day: a day on which every due step was done. Skipped steps are left out of the day; a day where every step was skipped, a paused day and today (still to do) are neutral. A routine's streak = full days in a row; a day with a missed step breaks it.
- The rail's Routines icon is removed. Routines live in the Areas sidebar and on the Tasks › Routines board.

### Sidebar

- The Areas sidebar is LIFE AREAS, PROJECTS, ROUTINES, then Archived. ROUTINES works like the other groups: a caps heading that opens the Routines overview, with a + for New routine.
- Each row: a 16 px ring with today's progress (accent on n200), then the name. Not due today = an empty grey ring; paused = a pause icon in the same slot. No counts. Rows reorder by dragging (lifted row, dashed drop spot). Archived routines go under Archived.

### Routine page

- Header: ring + name (20/28; click to rename in place). Under it: a paused chip when paused ("Paused since Nov 10"), the schedule chip ("Every day · since Oct 5"), then the area tags of the steps. Right: the period switch, a ⋯ menu (Skip today, Pause / Resume routine, Archive routine, then Delete routine) and Add step (brand 700, since routines have no colour).
- Stat tiles (five, the execution-stats style): Completion rate (done out of done + missed), Full days (of due days), Current streak (with the best streak and its dates), Missed, Skipped. A routine with no history shows "—" in every tile.
- Steps card: an All steps row (each day shaded by the share of due steps done, accent) then one row per step in routine order: a round marker in the area colour, the title, and under it the project folder and the fed metric. Week, Month and Quarter show one square per day; Year shows one square per week, shaded, with this week outlined. Squares: done, skipped, missed (the approved grey), paused (hatched), today, upcoming, not due (dot); days before a step existed are blank.
- Completion by step: one bar per step for the period (area 500 on n100), the % and "34 of 35".
- Schedule history: a strip per period with each schedule as a labelled segment and pauses hatched ("Paused Oct 19 – 25"). Hidden when the routine has had one schedule and no pauses.
- Right column (360 px): the Day card, then a Notes card. The Day card shows today's due steps (round checkbox in the area colour, title, project, fed metric, streak), a ring with n/total, and Skip day. Clicking a day in the heatmap shows that day (with a Today button back); done is allowed up to today, skip on any due day. Not due: "Not due. Next: Sun, Nov 15." Paused: "Paused." with Resume.
- Clicking a step's square opens a popover: the step and date, then Done, Skipped and To do (Missed for a past day); Done is disabled on future days.

### Editing on the page (exception to the detail-panel rule)

- Routines and routine steps never open the detail panel. This is the one exception to "clicking or editing an existing entity opens the detail panel".
- Routine: click the name to rename; the schedule chip opens the Repeat picker; choosing a new rule opens Change schedule. Notes live in the Notes card on the page.
- Step: click its title in the Steps card to rename it in place. Hovering a row shows a ⋯; in edit mode the row shows the owner chip and a Feeds metric chip (dashed when none), and the ⋯ holds Pause step, Archive step and Delete step. Delete is disabled while the step feeds a metric ("Feeds Reading days. Archive it instead.").

### Pop-ups

- New routine (480 px): Name (required; Create stays disabled with "Add a name" on hover), a Repeat chip (default Every day) and a Starts chip (today), Add step rows (title + owner chip; drag handles), and a sidebar-row preview; Cancel and Create routine.
- New step (440 px): Title, then chips for the routine, the owner and Starts today; Cancel and Add step.
- Change schedule (460 px): the old and new rule as chips, then From \[date\] (default; "Keeps 104 past days as they were") or All days ("Changes which of 104 past days were due"); Cancel and Change schedule.
- Delete routine: the red confirmation with counts (steps, days of history, schedules). Disabled from the ⋯ menu while a step feeds a metric ("Steps feed Reading days and Stretch days. Archive it instead.").
- Skipping a step or a day shows the app's undo toast ("Read 10 pages skipped for today").

### Routines overview

- Opened from the ROUTINES heading. Header: "Routines", the period switch, a ⋯ menu (Archived routines, Export as CSV) and New routine.
- Stat tiles across every routine: Completion rate, Steps done, Full days, Missed, Longest streak (with the routine's name).
- Routines card: one heatmap row per routine, each day shaded by the share of its due steps done (accent); beside the name: today's ring, the schedule and the step count. The name opens the routine page. Card menu: Sort by Manual, Completion rate or Name; Show paused routines.
- Completion by routine: one accent bar per routine, under the heatmap.
- Slipping (360 px, right): Open today (routines with steps left), Most missed (top 3 steps in the period), Streaks ended this week (a run of 4+ done days ended by a miss). Empty sections are hidden; all empty = "Nothing slipping."
- Empty states: routines with no history (tiles show "—", Completion by routine says "Nothing done yet.") and no routines (the first-run message, New routine and quick-start chips: Morning routine, Evening routine, Weekly reset, Workout).

### Open (defaults kept)

- The 4-day threshold for Streaks ended this week is a default.
- Routine metrics elsewhere: the area and project page heatmaps stay as approved, their routine headings should link to the routine page, and a metric tile fed by a step could show a small routine icon before its summary line; not drawn yet.

## Approved: Home (Nov 15)

Decided. Reference: design/html\_mockups/approved-home.html (17 mock states, built by mockup\_src/build\_home.py). Phase F is complete. Home covers today, right now: you do things there, you don't analyse. It shows no charts, heatmaps or period stats, and another screen's signal appears as one line that opens that screen. This section replaces the Home row in Screens and answers the open decision on Home's right rail.

### Layout

- No context sidebar (the rail only, content 1824 px wide) and no period switch. Home is always today.
- Header: the date as the title ("Saturday, Nov 14"), one data line under it ("6 of 14 done · Next: Demo rehearsal 5 PM"; done = today's tasks plus today's due routine steps). On the right: a quick add field ("Add task"; Enter creates a task scheduled today with no owner, so it is in the Inbox too) and the New split button in brand 700 (New task; ▾ = Task, Event, Metric entry).
- Three columns: Today (left), Routines today and Log today (middle), and a 360 px right column with Needs a push and Coming up.

### Today

- The approved agenda rows for today only. Groups: OVERDUE (red label, only when not empty), Schedule (all-day and multi-day events first, then timed items in order, with an accent now line and its time between past and upcoming), Tasks, then Completed (collapsed, with its counter).
- Routine steps are not repeated here. Metadata follows the Tasks rules (icons first, due date as plain text, red when overdue, no scheduled date).
- Row hover actions on open tasks: Tomorrow and Pick date (a rollover). Clicking a row opens the detail panel. Checking a task moves it to Completed and shows the undo toast.
- Empty: "Nothing scheduled today." with a ghost Plan from Inbox button and the Inbox counter. All done: "All done for today." with Completed kept. While anything is overdue there is no all-done message.

### Routines today

- One block per routine due today, made from the routine page's Day card: chevron, today's ring, the name (opens the routine page), n/total, and a ⋯ on hover (Skip day). The due steps have round checkboxes in the area colour, the project and fed metric, the streak and Skip on hover.
- A routine whose steps are all done collapses to its header. Routines not due today are left out. Empty: "No routines due today."

### Log today

- Manual metrics with a per-day or per-week target and no entry today. Row: the chart icon in the owner's colour, the name, the period's progress ("6 h of 10 h this week"), an inline value field with its currency or unit, and a check button. Enter or the check logs the entry and shows the undo toast.
- Metrics fed by a routine step are left out (checking the step logs them). The card is hidden when nothing needs a log.

### Needs a push and Coming up

- Needs a push: an Inbox row with its counter, then Projects (due within 7 days, Stalled, No next step, with Plan task and Schedule; the Projects overview's rules), Routines (Streaks ended this week) and Metrics (behind target). At most 3 rows per section, then "+n more". Each heading is a link to its screen (the caps label with a ›) plus a counter. Empty sections are hidden; all empty = "Nothing needs a push."
- Coming up: the next 7 days, fixed-date items only (events, project due dates, target deadlines), grouped by day. Tasks are left out because Tasks › Next 7 days has them.

### Rules introduced here

- Exception to "a metric shows only on its owner's screens": Home lists metrics from any owner, as one line each (Log today and Needs a push), never as tiles.
- New task opened from Home is pre-filled with Scheduled = Today (the Tasks pre-fill rule: New task starts from the spot it was opened in).

### First run

- No areas, routines or tasks: a centred "Set up Life OS" message with one line of explanation and three rows (Life area, Routine, Task), each with its status ("None yet" or the first item's name) and its New button. A row gets a green check once that kind exists. The message is replaced by the normal Home once there is an area and at least one task or routine.

### Mock states

Normal (2:40 PM), Subtasks open, Row actions (hover), Task completed with undo toast, Routine step checked, Quick add typing, Logging a metric, Metric logged with undo toast, New menu, Routine ⋯ menu, New task, Detail panel, Nothing needs a push, Nothing scheduled today, All done, First run, First run with an area added.

### Later

- Free move-and-resize cards on Home (an Edit layout mode with react-grid-layout) stay a later item.
- The Metric entry pop-up from the New menu is not drawn yet.

## Approved: Confirmations (Nov 15)

Decided. Reference: design/html\_mockups/approved-confirmations.html (17 mock states, built by mockup\_src/build\_confirmations.py). One dialog design for every confirmation that lists what goes with an action: Archive area, Complete, Cancel and Archive project, Archive routine, and every Delete that has contents. It replaces the separate Complete, Archive and Delete confirmations drawn earlier.

### Dialog

- 480 px, the approved modal frame. Title: the action and the name in quotes (Complete “Resume & portfolio”?). No lead sentence and no info note.
- Optional choice slot on top: a repeating event's This event / This and following / All events as radio rows (36 px, the selected one accent-100 with an accent-600 border, each with its date data on the right). The list below follows the choice; This event shows no list.
- What goes with it, grouped by effect: CANCELLED, ENDS FROM TODAY, ARCHIVED, DELETED (red label), and KEPT or STOPS UPDATING where the rules keep something (a recurring task's done occurrences; a metric fed by an archived routine's step). Each group: caps label + grey counter, then 28 px rows: the entity icon (task and step checkboxes, folder, event, repeat and metric icons in the owner's colour; history and schedule icons grey), the name, and its data on the right (dates as plain text, red when overdue; owner or routine; counts such as "2 entries · 1 target"). Rows never repeat what the group says.
- A group folds after 3 rows with "+n more", which expands in place; it only folds when 2 or more rows would be hidden. The list scrolls inside the dialog (max 360 px) with scroll shadows and no scrollbar.
- An archived area lists each project as one row with its contents as data ("5 tasks · 2 events · 2 metrics"), then the items the area owns directly.
- Footer: one data line on the left (Restore from Archived for archives, Undo for 6 s for complete and cancel, Can't be undone in red for deletes), then Go back and the named action (Complete project). The action is brand 700; red (negative-600) only for Delete. Cancel project is not red.

### Behaviour

- Loading the preview: skeleton rows, the action disabled.
- If nothing goes with an archive or status change, it applies at once with the undo toast and no dialog. Delete always asks.
- A refused action stays a disabled menu item with its reason ("Only empty projects can be deleted. Archive it instead.").
- After confirming, the app's toast summarises the change (Completed “Resume & portfolio” · 2 tasks cancelled) with Undo and Ctrl Z; deletes show no Undo.
- Go back, × and clicking outside close the dialog without changes.

### Mock states

Complete project, Cancel project, Archive project (and list open), Archive area (and list open, scrolling), Archive routine, Delete routine, Delete recurring task, Delete event (This event, This and following, All events), Delete with nothing going with it, Loading the preview, Refused (disabled item), Confirmed with undo toast, Nothing goes with it (applied at once).

## Approved: Settings (Nov 15)

Decided. Reference: design/html\_mockups/approved-settings.html (10 mock states, built by mockup\_src/build\_settings.py). Phase G step 1. This section replaces the Settings row in Screens ("Simple form page").

### Layout

- Rail → Settings (pinned to the bottom of the rail). The context sidebar lists the sections (General, Data, About), each with an icon; clicking one scrolls to its card and the row follows the scroll.
- Header: "Settings" as the page title, no actions. Content: a 720 px column of section cards (card title style), left-aligned under the header.
- Rows: label on the left, control on the right, a hairline between rows. No descriptions. A muted data line under the label only when it shows data (a path, a time, a size, what differs from the defaults); red when it reports a problem.
- Controls: the segmented group switch for 2–3 choices, the HeroUI Switch (brand 600 when on), a select for longer lists (28 px field with a chevron; its list marks the current value with a check). Disabled controls are faded.
- Changes save at once: no Save button and no toast. The one exception is Reset layout (undo toast).

### General

- Open on start: Home | Tasks | Calendar (default Home).
- Time format: 12-hour | 24-hour (default 12-hour). The ":00" rule applies to 12-hour only (3 AM, but 03:00). Every time in the app follows it, the Settings page included.
- Day ends at: select, 12 AM (default) or 1–4 AM. A check-off before that hour counts for the previous day. It shifts "today" for Home, rollover, routine logs, completed dates and streaks.
- Reset layout: Reset button. The data line shows what differs from the defaults ("Sidebar 280 px · 4 cards resized"). When nothing differs, there is no data line and Reset is disabled. Resetting puts the sidebar width and card sizes back and shows the undo toast ("Layout reset", Undo, Ctrl Z).

### Data

- Automatic backups: Switch (default on). Data line: "Daily, 3 AM".
- Keep last: select, 7 / 14 / 30 backups (default 14). Disabled while automatic backups are off.
- Backup folder: the path as the data line; Open folder (icon button) and Change. A missing folder turns the data line red ("Folder not found: D:\\Backups\\Life OS") and disables Open folder and Back up now.
- Last backup: data line "Today, 3 AM · 2.4 MB" and a Back up now button. While backing up the button shows a spinner and "Backing up" (disabled); when done, the data line updates. No backups yet: "No backups yet". Failed: a red data line ("Failed today, 2:12 PM · couldn't write to the backup folder") and the button becomes Retry.
- Export all data: Export button (a zip of CSVs). When done, the toast shows the file and its size ("Exported life-os-2026-11-14.zip · 1.8 MB") with no Undo.
- No in-app restore.

### About

- Version (the number as data on the right) and Database (the path as the data line, Open folder). Keyboard shortcuts are not listed for now.

### Storage

- Settings live in a new single-row settings table. Sidebar width and card sizes stay in localStorage.

### Mock states

Normal (defaults), Changed values, Day ends at select, Keep last select, No backups yet, Backing up, Backup failed, Backup folder missing, Reset layout with undo toast, Export done toast.

### Not now

- Week start (Monday stays fixed), theme / dark mode, AI section (Phase 7), Desktop section (Phase 8), a streak-threshold setting, the keyboard shortcuts list.

## Approved: Archived (Nov 15)

Decided. Reference: design/html\_mockups/approved-archived.html (16 mock states, built by mockup\_src/build\_archived.py). Phase G step 2. One screen for archived areas, finished or archived projects, and archived routines.

### Layout

- Opened from Archived at the bottom of the Areas sidebar (the row is active). "Archived areas" (areas overview ⋯) and "Archived routines" (routines overview ⋯) open it on that tab.
- Header: "Archived", a divider, then the switch Areas | Projects | Routines with grey counters (no counter at 0). Right: the filter icon on Projects only (by area; archived areas are listed too).
- One list card (960 px, left-aligned), newest first, 44 px rows with hairlines between them. Projects are grouped DONE, CANCELLED and ARCHIVED (caps label + grey counter); rows never repeat the status.

### Rows

- Icons first. Area: colour dot, name, "Archived Oct 2 · 1 project · 41 tasks · 2 metrics" ("Empty" when it holds nothing). Project: folder in the area colour, name, "Health & Beauty · Nov 3 · 18/20 tasks" (the area name as neutral text, then the date of its status). Routine: repeat icon in the accent, name, "Every day · 5 steps · Archived Nov 1 · best streak 21 days".
- Hover shows a small button and a ⋯: Restore for areas, archived projects and routines; Reopen for done and cancelled projects. The ⋯ menu: Restore area / project / routine, then Delete; done or cancelled projects: Reopen project, Archive project, then Delete project.
- Restore and Reopen apply at once with the undo toast ("Restored “Language learning” · 1 project, 41 tasks back"). Archive moves a done or cancelled project into ARCHIVED with the undo toast.
- Restore is disabled while the parent is archived, with the reason as tooltip and menu hint ("Restore Language learning first.").
- Restoring an area brings back what its archive took (its projects come back with it) and puts the area back in LIFE AREAS.

### Opening an item

- Area or project: the detail panel, read-only. An Archived chip with the date, static chips (date range, progress), Notes. Its ⋯: View Markdown, Restore area / project, then Delete (disabled with its reason while it has items).
- Routine: its routine page, read-only, opened on the period that holds the archive date. Header: the Archived chip ("Archived Nov 1"), the schedule as a static chip with its date range ("Every day · Jul 6 – Nov 1"), the area tags, the period switch, and Restore (brand 700) in place of Add step. No ⋯ menu and no rename.
- On that page "Current streak" reads "Final streak". The Day card opens on the archive date and shows statuses only (no checkboxes, Skip, Skip day or Today). Clicking a square shows that day without the popover. Steps have no ⋯.

### Delete

- Areas and projects keep "only when empty": "Only empty areas can be deleted." / "Only empty projects can be deleted." ("Archive it instead." is dropped here: the item is already archived). An empty area opens the approved confirm dialog with nothing listed.
- Routines use the approved confirm dialog (DELETED: its steps, History with logs and days, Schedules), unless a step feeds a metric ("A step feeds Weekly runs.").
- Deletes show the toast without Undo.

### Restore rules

- Restoring a routine brings back the steps its archive took. Steps archived on their own stay archived, and a step whose owner area or project is still inactive stays archived.

### Empty states

- "No archived areas.", "No finished or archived projects.", "No archived routines."

### Mock states

Areas, Projects, Routines, Row hover, ⋯ menu, Restored with undo toast, Restore disabled, Detail panel (archived project), Detail panel ⋯ menu, Archived routine page, Delete confirmation, Delete disabled, Filter menu, Empty: Areas, Empty: Projects, Empty: Routines.

## Update: UX review decisions (Nov 16)

Decided. Arzel accepted the recommendations of the UX review (Claude doc "Life OS — UX Review", Nov 15). These replace earlier rules wherever they disagree. Phase 2 drafts apply the execution fixes; the bigger items are built in later phases.

### Navigation

- One destination per entity: clicking a project anywhere opens its project page. The project page gets a Board view (the Tasks board for that project). The Tasks sidebar no longer lists PROJECTS.
- The rail's Areas item becomes **Plan** (lucide `LayoutGrid`). Its sidebar keeps LIFE AREAS, PROJECTS, ROUTINES and the archive at the bottom.
- One archive: the Plan sidebar's "Archived" is renamed **Finished & archived**. Tasks keeps Completed and Cancelled; Tasks › Archived is removed (archived tasks are listed with their archived project or area).
- `Ctrl K` opens a command palette: jump to any area, project, routine or task, and run commands (New task, Go to Today). `Ctrl N` opens quick add on every screen.
- Right-click on any row, card, bar or heatmap square opens that item's ⋯ menu.

### Inbox and priority

- **Inbox** = open tasks with no life area, nothing else. Tasks with an area but no scheduled date are listed in a new **Unscheduled** view in the Tasks sidebar.
- Inbox cards get hover actions (Area ▾, Today, Date) and keys `A`, `T`, `D` while focused. Dragging stays.
- Priority columns are **High, Medium, Low, No priority**. The Eisenhower names (Do first, Schedule, Delegate, Eliminate) are dropped everywhere, including the Priority picker.

### Colour

- The accent is neutral: primary buttons neutral-900 with white text; checkboxes in menus and filters neutral-700. Brand purple is kept only for the focus ring, the selected marker, the today marker (brand 700) and the logo.
- Action buttons are solid with white text: the accent (neutral-900), or the area's 500 colour on area and project pages, the Add split button included. No ghost, tinted or outlined action buttons (this replaces the Projects overview's brand-50 quick action buttons). Cancel, ⋯ menus and switches stay neutral; delete confirmations keep the red button.
- Personal gets a new colour that is clearly apart from brand purple (two options to be shown in Phase 3).
- The Effort bar uses the area's 400 shade with white percentages (700 was too dark; Arzel chose white text knowing it is below 4.5:1 on the lighter areas).
- Red is only for overdue items and targets the user set that are behind or missed. Trend lines are neutral grey with an up or down arrow.

### Text, contrast and targets

- Nothing renders below 11 px, chart axis labels included.
- Done and cancelled text is neutral-500 (#6b7280) with the strike-through; disabled controls keep 3:1 against their background.
- Every clickable thing has a 24 × 24 px hit area, even when it draws smaller (checkboxes, heatmap squares).
- Keyboard focus is drawn on every interactive element (the brand focus ring).

### Wording

- Due dates: rows show the date with a small due icon, red when overdue ("Nov 4"); the panel chip says "Due Nov 4"; projects show "Nov 30 · 16d", and only the project header says "16 days left".
- Multi-day events say "Until 3 PM" on their last day, everywhere.
- Toasts: Verb + “name” + · effect (Completed “Clean up GitHub profile”; Skipped “Read 10 pages” today; Logged 2 h · Study hours). Deletes end with "Can’t be undone".
- "Streak" means a routine step's done days in a row. A routine's full days in a row is a **run** (Current run, Best run, Longest run). When the current run is 0, the best run is shown first.
- Routines overview's Slipping card is renamed **Pick up**. Home's Needs a push drops Streaks ended this week.

### Components and behaviour

- Dashed borders mean a placeholder, an unset value or a drop spot. Project bars and project due rows use a solid 1 px area-300 border.
- The detail panel gets a 28 px × beside ⋯; clicking outside the panel closes it.
- Every routine heatmap shows the routine key (Done, Skipped, Missed, Paused, Today, Upcoming, Not due), including the routine page and the Routines overview.
- The agenda opens scrolled to today in every Calendar view.
- The Calendar's right panel opens on Inbox by default; Agenda stays available.
- The sidebar collapses to an overlay below 1440 px (the Nov 14 rule stands; the build's always-docked change is reverted). Minimum window: 1280 × 720.
- Settings › Data gets Restore from backup: pick a backup, confirm with its date and size; the app backs up the current data first.
- Keyboard: `1`–`4` switch Week / Month / Quarter / Year, `T` goes to today, `←` `→` move the period, `?` lists the shortcuts.

* **One card look everywhere.** Agenda rows (Calendar agenda and day popover, Area and Project agendas, Home's Today and Coming up) use the Kanban card: 1 px border, 8 px radius, 8 × 12 px padding, white (events keep their tint and have no border), title 14/500, a 6 px gap between cards.
* **Priority flags in the Calendar:** shown on cards in the agenda panel (High and Medium only), never on entries inside the calendar grid.
* **Pickers fit their content:** no empty space on the right (Date range shrinks to its two months; the several-days month grid fills the popover). A dropdown list (the event time list) opens aligned to its field's right edge and stays inside the screen.

**Approved Nov 16:** the Phase 2 drafts (built by `design/mockup_src/review_fixes.py`) were approved and now replace every approved-\*.html file.

### Later phases (decided direction, designs to come)

- Area and Project pages: the actionable task list moves above the analysis cards.
- Projects overview: the repeated project views are reduced (timeline + Next up kept).
- Calendar Week: titles wrap to 2 lines and routines show as a ring beside the date. Quarter and Year: single-day task marks become a per-day count shade.
- Home: tasks can be pulled into today from Home (Inbox in Needs a push expands with a Today action); quick add parses `#area`, `@project`, `!1`–`!3`.
- Next 7 days fits all 8 columns in the width.
- Missing states for every screen: loading, error, long content, many items, keyboard focus, 1440 and 1280 px.
- Week stays untimed. A Day view with hours for today is a later item, not decided.
