# Mock-up sources

Python scripts that generate the HTML mock-ups in `design/html_mockups/`. They import each other, so keep them in one folder and run from it.

Paths inside the scripts point to `/home/claude/` (input) and `/mnt/user-data/outputs/` (output) from the Claude session that wrote them; change those two paths to run them elsewhere.

| Script | Builds |
| --- | --- |
| `build_week.py` | Calendar week board draft (`draft-week-board.html`). Also holds the shared base CSS, icons and card helpers. `v13.css` is the original approved mock-up CSS it loads. |
| `build_area2.py`, `build_area4.py` | Shared parts for the area screen (sidebar, cards, timeline, agenda, routines). |
| `build_overview.py`, `build_overview2.py`, `build_overview3.py` | Life areas overview (approved). `build_overview3.py` is the final one. |
| `build_area5.py` | Area screen (approved). |
| `build_project2.py` | Project screen, normal state (presentation rules applied). |
| `build_project_states.py` | Project screen with all mock states (`approved-project.html`). |
| `build_projects_overview.py` | Projects overview with mock states (`draft-projects-overview.html`). |
| `build_empty.py` | Life areas overview empty states and the New area pop-up (`approved-areas-empty.html`). |
| `build_area_states.py` | Area screen with all mock states (`approved-area-states.html`). |
| `build_overview_states.py` | Life areas overview with all mock states (`approved-areas-overview-states.html`). |
| `rules.py` | Shared presentation rules applied to every approved screen (data-only subtitles, no guide text, sort-and-filter menus, spacing). |
