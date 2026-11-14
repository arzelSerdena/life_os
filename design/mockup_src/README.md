# Mock-up sources

Python scripts that generate the HTML mock-ups in `design/html_mockups/`. They import each other, so keep them in one folder and run from it.

Paths inside the scripts point to `/home/claude/` (input) and `/mnt/user-data/outputs/` (output) from the Claude session that wrote them; change those two paths to run them elsewhere.

| Script | Builds |
| --- | --- |
| `build_week.py` | Calendar week board draft (`draft-week-board.html`). Also holds the shared base CSS, icons and card helpers. `v13.css` is the original approved mock-up CSS it loads. |
| `build_area2.py`, `build_area4.py` | Shared parts for the area screen (sidebar, cards, timeline, agenda, routines). |
| `build_overview.py`, `build_overview2.py`, `build_overview3.py` | Life areas overview (approved). `build_overview3.py` is the final one. |
| `build_area5.py` | Area screen (approved). |
| `build_project.py` | Project page draft (`draft-project.html`). |
| `build_empty.py` | Life areas overview empty states and the New area pop-up (`approved-areas-empty.html`). |
