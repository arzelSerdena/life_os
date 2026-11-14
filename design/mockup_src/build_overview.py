"""Areas > Life areas overview (all areas), built from the approved area screen's parts."""
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_area4 as a4  # noqa: E402  (also rebuilds the area mock)
bw, a2, ic = a4.bw, a4.a2, a4.ic

AREAS = [  # key, name, vision, open, done, on_time, overdue, projects, trend, good
    ('career', 'Career', 'A steady career in AI engineering', 9, 46, 78, 1, 3, [3,5,4,6,2,5,7,6,4,8,5,7], True),
    ('finance', 'Finance', 'Six months of savings by next year', 4, 18, 92, 0, 1, [1,1,2,2,2,2,3,3,3,3,4,4], True),
    ('health', 'Health &amp; Beauty', 'Run a 5K and sleep 7 hours', 6, 31, 70, 1, 1, [5,5,4,4,4,3,3,3,3,2,2,2], False),
    ('personal', 'Personal', 'Read more and speak with confidence', 3, 12, 88, 0, 1, [1,1,1,1,2,2,2,2,2,3,3,3], True),
    ('relation', 'Relationships', 'Show up for family and friends', 2, 9, 100, 0, 0, [0,1,1,1,1,1,2,1,2,2,2,2], True),
    ('home', 'Home', 'A calm, tidy place to live', 5, 16, 64, 2, 1, [3,3,3,2,2,2,2,1,1,1,1,1], False),
]

# ---------- sidebar: heading selected, no area selected ----------
def _si(label, area):
    return f'<div class="item {area}"><span class="dot"></span>{label}</div>'
sidebar = (f'<div class="sgroup on" title="All areas"><span class="sg-name">Life areas</span><span style="flex:1"></span>'
           f'<span class="icon-btn sg-add" title="New life area">{ic("plus")}</span></div>'
           + ''.join(_si(n, k) for k, n, *_ in AREAS)
           + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived areas</div>')

# ---------- tiles ----------
tiles = ''.join([
    a4.tile('Open tasks', '29', delta='4 overdue', good=False, note='3 high'),
    a4.tile('Completed', '132', delta='+15', good=True, note='vs Q3', trend=[9,11,10,12,8,12,13,12,11,14,12,13]),
    a4.tile('On time', '81', '%', delta='−2 pts', good=False, note='vs Q3', trend=[84,85,83,84,82,81]),
    a4.tile('Rollovers', '1.2', '/ task', note='this quarter'),
    a4.tile('Routine steps done', '84', '%', delta='+3 pts', good=True, note='vs Q3', trend=[76,78,80,79,82,84]),
    a4.tile('Active projects', '7', note='2 done this quarter'),
])

# ---------- area cards ----------
def acard(k, name, vision, open_, done, ontime, overdue, projects, trend, good):
    od = f'<span class="od2">{overdue} overdue</span>' if overdue else '<span class="t-meta">Nothing overdue</span>'
    pj = f'{projects} active project{"s" if projects != 1 else ""}' if projects else 'No active projects'
    return (f'<a class="acard {k}"><div class="ac-head"><span class="dot"></span><span class="ac-name">{name}</span>'
            f'<span class="ac-go">{ic("right")}</span></div>'
            f'<p class="ac-vision t-meta">{vision}</p>'
            f'<div class="ac-stats"><div><span class="ac-n">{open_}</span><span class="t-meta">Open</span></div>'
            f'<div><span class="ac-n">{done}</span><span class="t-meta">Completed</span></div>'
            f'<div><span class="ac-n">{ontime}<small>%</small></span><span class="t-meta">On time</span></div>'
            f'<div class="ac-spark">{a4.spark(trend, a4.POS if good else a4.NEG, 72, 28)}</div></div>'
            f'<div class="ac-foot">{od}<span class="sep">·</span><span class="t-meta">{pj}</span></div></a>')
areas_card = a2.card('Areas', '6 areas · Q4 2026', '<div class="agrid">' + ''.join(acard(*a) for a in AREAS) + '</div>')

# ---------- timeline: projects by area ----------
D = date
def alane(k, name, rows):
    body = ''.join(f'<div class="trow">{r}</div>' for r in rows) if rows else '<div class="trow"><div class="notarget"><span>No projects</span></div></div>'
    return f'<div class="{k}">' + a4.lane(f'<span class="dot"></span>{name}', body, max(1, len(rows))) + '</div>'

lanes = (
    alane('career', 'Career', [
        a4.bar('Life OS app', D(2026, 9, 1), a4.END, prog=40, open_end=True, tip='Career · Life OS app · no due date · 40%'),
        a4.bar('Resume &amp; portfolio', D(2026, 10, 20), D(2026, 11, 30), prog=60, tip='Career · Resume &amp; portfolio · due Nov 30 · 60%'),
        a4.bar('Hackathon prep', D(2026, 11, 2), D(2026, 11, 20), prog=25, tip='Career · Hackathon prep · due Nov 20 · 25%')])
  + alane('finance', 'Finance', [a4.bar('Emergency fund', D(2026, 10, 1), D(2026, 12, 31), prog=35, tip='Finance · Emergency fund · due Dec 31 · 35%')])
  + alane('health', 'Health &amp; Beauty', [a4.bar('5K training', D(2026, 10, 12), a4.END, prog=45, open_end=True, tip='Health &amp; Beauty · 5K training · due Mar 21 · 45%')])
  + alane('personal', 'Personal', [a4.bar('Reading challenge', D(2026, 9, 1), D(2026, 12, 31), prog=8, tip='Personal · Reading challenge · due Dec 31 · 8%')])
  + alane('relation', 'Relationships', [])
  + alane('home', 'Home', [a4.bar('Room makeover', D(2026, 11, 1), D(2026, 12, 15), prog=30, tip='Home · Room makeover · due Dec 15 · 30%')])
)
timeline = (f'<div class="tl">{a4.tl_axis()}<div class="tl-body"><div class="tl-grid">{a4.grid_lines}</div>'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {a4.pct(a4.TODAY)/100:.4f})"><span>Today</span></div>'
            f'{lanes}</div></div>'
            '<div class="tlegend"><span><i class="sw"></i>Progress</span><span class="t-meta">Each row is labeled with its area</span></div>')
timeline_card = a2.card('Timeline', 'Projects by area in Q4', timeline)

# ---------- tabbed card across areas ----------
def trow(k, mark, title, area, right, rcls=''):
    return (f'<div class="trw {k}">{mark}<span class="lt">{title}</span><span class="tarea"><span class="dot"></span>{area}</span>'
            f'<span class="trr {rcls}">{right}</span></div>')
C = '<span class="check"></span>'
F = f'<span class="mark xm">{ic("folder")}</span>'
M = f'<span class="mark xm">{ic("stats")}</span>'
tab_rows = ''.join([
    trow('career', C, 'Update resume', 'Career', 'Overdue 10 days', 'danger'),
    trow('home', C, 'Fix the leaking faucet', 'Home', 'Overdue 2 days', 'danger'),
    trow('home', C, 'Organize the closet', 'Home', 'Overdue 1 day', 'danger'),
    trow('health', C, 'Buy running shoes', 'Health &amp; Beauty', 'Rolled over 4 times'),
    trow('career', F, 'Hackathon prep', 'Career', 'Due in 6 days · 25% done'),
    trow('personal', M, 'Books read', 'Personal', '1 of 12 by Dec 31'),
])
tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}{f"<span class=counter>{n}</span>" if n else ""}</span>' for i, (t, n) in enumerate(
    [('Needs attention', 6), ('Unscheduled', 11), ('Recurring', 14), ('Completed', '')]))
tab_card = (f'<section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span></div></header>'
            f'<div class="sbody tbody">{tab_rows}</div></section>')

# ---------- agenda across areas ----------
def arow(k, kind, title, area, meta='', pr=None):
    r = a4.arow(kind, title, f'<span class="adot"><span class="dot"></span>{area}</span>' + (f' · {meta}' if meta else ''), pr)
    return r.replace('<div class="arow', f'<div class="arow {k}', 1)
agenda = (
    a4.aday('Overdue', '4', [arow('career', 'task', 'Update resume', 'Career', '<span class="overdue">Nov 4</span>', 'high'),
                             arow('home', 'task', 'Fix the leaking faucet', 'Home', '<span class="overdue">Nov 12</span>', 'high'),
                             arow('home', 'task', 'Organize the closet', 'Home', '<span class="overdue">Nov 13</span>'),
                             arow('health', 'task', 'Buy running shoes', 'Health &amp; Beauty', '<span class="overdue">Nov 7</span>', 'med')], danger=True)
  + a4.aday('Today', 'Sat, Nov 14', [arow('career', 'event', 'Hackathon weekend', 'Career', 'All day'),
                                     arow('career', 'task', 'Draft the hackathon pitch', 'Career', '', 'med'),
                                     arow('finance', 'task', 'Pay insurance', 'Finance')], today=True)
  + a4.aday('Tomorrow', 'Sun, Nov 15', [arow('health', 'task', 'Long run', 'Health &amp; Beauty'),
                                        arow('career', 'task', 'Submit hackathon registration', 'Career', 'Due', 'high')])
  + a4.aday('Mon', 'Nov 16', [arow('home', 'task', 'Clean the gutters', 'Home', 'Due')])
  + a4.aday('Thu', 'Nov 19', [arow('personal', 'event', 'My birthday', 'Personal', 'All day')])
  + a4.aday('Fri', 'Nov 20', [arow('career', 'event', 'Mock interview with Ana', 'Career', '2:00 PM'),
                              arow('relation', 'event', 'Dinner with family', 'Relationships', '7:00 PM')])
  + a4.aday('Sat', 'Nov 21', [arow('relation', 'task', 'Buy a gift for Mia', 'Relationships', 'Due')])
)
agenda_panel = (f'<aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span>'
                f'<span class="t-meta">Today – Dec 31</span></header><div class="ag-body">{agenda}</div></aside>')

CSS = '''
.sgroup.on{background:var(--n100);box-shadow:inset 2px 0 0 var(--acc600)}
.agrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.acard{display:flex;flex-direction:column;gap:6px;border:1px solid var(--border);border-radius:var(--r-card);padding:10px 12px 10px;cursor:pointer;text-decoration:none;color:inherit}
.acard:hover{background:var(--n50);border-color:var(--n300)}
.ac-head{display:flex;align-items:center;gap:8px;height:24px}
.ac-head .dot{width:10px;height:10px;border-radius:2px}
.ac-name{font-size:14px;line-height:20px;font-weight:600}
.ac-go{margin-left:auto;color:var(--text-tertiary);display:grid}
.ac-go svg{width:16px;height:16px}
.ac-vision{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-4px}
.ac-stats{display:flex;align-items:flex-end;gap:20px;margin-top:2px}
.ac-stats>div{display:flex;flex-direction:column}
.ac-n{font-size:20px;line-height:28px;font-weight:600;font-variant-numeric:tabular-nums}
.ac-n small{font-size:12px;font-weight:500;color:var(--text-tertiary);margin-left:1px}
.ac-spark{margin-left:auto;align-self:center}
.ac-foot{display:flex;align-items:center;gap:6px;font-size:12px;border-top:1px solid #f1f2f4;padding-top:8px;margin-top:2px}
.ac-foot .sep{color:var(--n300)}
.od2{color:var(--danger);font-weight:500}
.lane .lnh .dot{width:8px;height:8px;border-radius:2px;margin-right:2px}
.lane .ln{text-transform:none;letter-spacing:0;font-size:13px;font-weight:600;color:var(--text-primary)}
.tarea{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);width:150px;flex:none}
.tarea .dot{width:8px;height:8px}
.adot{display:inline-flex;align-items:center;gap:4px}
.adot .dot{width:6px;height:6px}
.arow .am{flex-wrap:wrap}
.split-btn.accent{background:#7e61a0}
.tlegend .sw{background:linear-gradient(to right,var(--n300) 60%,var(--n100) 60%)}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Life areas overview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{sidebar}</aside>
  <main class="main withagenda">
    <div class="content">
      <div class="areahead">
        <div>
          <div class="ttl" style="padding-left:0"><h1 class="t-page">Life areas</h1></div>
          <p class="t-body vision" style="padding-left:0">How every area is doing this quarter.</p>
        </div>
        <div class="acts">
          <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
          <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
          <button class="btn icon" title="More">{ic('more')}</button>
          <div class="split-btn accent"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev" title="More to add">{ic('chev')}</button></div>
        </div>
      </div>
      <div class="scroll">
        <div class="kpis">{tiles}</div>
        <div class="split">
          <div class="leftcol">
            {areas_card}
            {timeline_card}
            {tab_card}
          </div>
          {agenda_panel}
        </div>
      </div>
    </div>
  </main>
</div>
<div id="tip"></div>
<script>
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){{tip.style.display='none';return}}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';}});
</script>
</body></html>'''
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view">{ic("sliders")}</span>')
Path('/mnt/user-data/outputs/life-os-mock-areas-overview.html').write_text(html)
print('ok', len(html))
