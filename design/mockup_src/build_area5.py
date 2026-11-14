"""Area screen v2: the top row is the area's own metrics (same tiles as the overview's Outcomes)."""
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_overview3 as o3  # noqa: E402  (builds a4 too)
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
D = date

def tile(*args, project=None, **kw):
    h = o3.mtile(*args, **kw)[2]
    if project:  # metric owned by a project inside this area
        h = h.replace('</span></div><div class="mt-v">',
                      f'</span></div><div class="mt-p">{ic("folder")}{project}</div><div class="mt-v">', 1)
    return h

tiles = ''.join([
    tile('career', 'Career', 'Job applications', '1', '', 'of 5 this month', 'warn',
         o3.period_line([5, 1], 5, 'month'), 'Oct met · 16 days left in Nov'),
    tile('career', 'Career', 'Study hours', '6', 'h', 'of 10 h this week', 'warn',
         o3.period_line([8, 7, 9, 11, 10, 12, 6], 10, unit='h'), '3 of 6 weeks met'),
    tile('career', 'Career', 'Networking chats', '3', '', 'this month so far', None,
         o3.period_line([2, 3], None, 'month'), 'No target set · up from October', good=True),
])
metrics_card = a2.card('Metrics', '3 metrics owned by Career · 2 behind, 1 without a target', f'<div class="amgrid">{tiles}</div>' + o3.legend)

html = a4.html
# 1. replace the task-statistics tiles with the metrics card
old_kpis = f'<div class="kpis">{a4.tiles}</div>'
assert old_kpis in html
html = html.replace(old_kpis, metrics_card)
# project metrics belong on the project screen: drop the project target deadline from the agenda
import re as _re
html = _re.sub(r'<div class="aday"><div class="adh"><span class="t-label">Thu</span><span class="t-meta">Dec 31</span></div>.*?</div></div></div>', '', html, count=1, flags=_re.S)
# 2. metrics now live at the top: drop the Metrics row from the timeline
assert a4.metrics_lane in html
area_rows = (a4.mrow(a4.periods('month', D(2026, 10, 1), a4.END, '5 applications per month'))
           + a4.mrow(a4.periods('week', D(2026, 9, 28), D(2026, 10, 26), '8 h per week') + a4.periods('week', D(2026, 10, 26), a4.END, '10 h per week'))
           + a4.mrow('<div class="notarget" data-tip="No target set"><span>No target</span></div>'))
names = ''.join(f'<div class="mname">{ic("stats")}<span>{n}</span></div>' for n in ['Job applications', 'Study hours', 'Networking chats'])
area_lane = (f'<div class="lane mlane"><div class="ln"><div class="lnt"><span class="lnh">{ic("chev")}Metrics</span></div>{names}</div>'
             f'<div class="lt2"><div class="mspacer"></div>{area_rows}</div></div>')
html = html.replace(a4.metrics_lane, area_lane)
html = html.replace("'Projects, events and metric targets in Q4'", "")
html = html.replace('Projects, events and metric targets in Q4', 'Projects, events and Career\'s metric targets in Q4')
# timeline legend: only project progress is left
import re
html = re.sub(r'<div class="tlegend">.*?</div>(?=</div></section>)', '<div class="tlegend"><span><i class="sw"></i>Progress</span><span><i class="lg met"></i>Target met</span><span><i class="lg up"></i>Upcoming</span></div>', html, count=1, flags=re.S)
CSS = '''
.main .tlegend .sw{background:linear-gradient(to right,var(--a-border) 60%,var(--a-tint) 60%)}
.main .tlegend .lg.met{background:var(--a-border)}
.lnt{text-transform:none;letter-spacing:0;font-size:13px;font-weight:600;color:var(--text-primary);padding-top:0;height:24px;display:flex;align-items:center}
.amgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.mt-p{display:flex;align-items:center;gap:4px;font-size:11px;line-height:14px;color:var(--text-tertiary)}
.mt-p svg{width:12px;height:12px;color:var(--a-solid)}
'''
html = html.replace('</style>', ov.CSS + o2.CSS + o3.CSS + CSS + '</style>', 1)
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>')
import rules as _rules
html = _rules.apply(html)
Path('/mnt/user-data/outputs/life-os-mock-area.html').write_text(html)
print('ok', len(html))
