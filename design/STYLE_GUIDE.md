<!--
Generated from the Claude doc "Life OS — UI Style Guide" (https://claude.ai/artifact/Bb3NAbhoLLYgNwSqDxzMEh).
Do not edit by hand: Claude updates the doc and re-saves this file.
How to read it: the guide grew over time. Dated sections further down ("Update, Nov 13", "Approved: … (Nov 14)")
replace earlier rules wherever they disagree. "Approved" sections are final screen designs; their HTML mock-ups
are in design/html_mockups/.
-->

# Life OS — UI Style Guide

Nov 10, 2026 · @Arzel

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
| Calendar | Week, Month, Quarter and Year views, switched in the page header | Week: untimed day columns (Unscheduled + 7 days, dnd-kit). Month: month grid. Quarter: three month grids side by side. Year: linear calendar, 12 rows (one per month) with days in a line, events and projects as bars across days. A toggleable agenda panel docks on the right (360 px, resizable) and lists the selected range's items in date order. |
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

Current files: approved-area.html (area page, all states; earlier sections call it approved-area-states.html), approved-areas-overview.html (Life areas overview, all states; earlier sections call it approved-areas-overview-states.html or approved-areas-empty.html), approved-project.html (project page).
