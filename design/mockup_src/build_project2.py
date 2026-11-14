"""Project page v2 (Areas > Projects > Resume & portfolio), aligned with the approved area screen.

Changes from build_project.py (review of Nov 14):
1. No task-stat tiles: a full-width Metrics card on top (same tiles as the area page); progress and days left move into the header.
2. Timeline Metrics lane shows every project metric (per-period segments + reach-by bar with a deadline diamond).
3. Tabbed card uses the area's tabs; rows name their section.
4. Routines card for routine steps the project owns (shown only when there are any).
5. Timeline section rows: checkbox markers only, title in the tooltip; open tasks without a due date are counted at the row end.
6. Sections card: one-line "done / total" value next to the bar, plus a "No section" row.
7. Sample metric deadline moved inside the project window (Nov 30).
9. Nov 14 review: timeline matches the area screen (no project window, no task markers): Project bar, Events, Metrics. Sections card removed.
8. Sidebar PROJECTS lists active projects only; done ones live under Archived.
"""
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_area5 as a5  # noqa: E402  (also builds o3, a4, ...)
o3 = a5.o3
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
D = date
P_START, P_DUE = D(2026, 10, 20), D(2026, 11, 30)  # start = created date until projects get a start_date

# ---------- sidebar ----------
def si(label, area, on=False, folder=False):
    lead = f'<span class="mark sfold">{ic("folder")}</span>' if folder else '<span class="dot"></span>'
    return f'<div class="item{" on" if on else ""} {area}">{lead}{label}</div>'
def group(name, title, add_title, items):
    return (f'<div class="sgroup" title="{title}"><span class="sg-name">{name}</span><span style="flex:1"></span>'
            f'<span class="icon-btn sg-add" title="{add_title}">{ic("plus")}</span></div>' + items)
sidebar = (group('Life areas', 'Open the life areas overview', 'New life area', ''.join(si(n, k) for k, n in [
              ('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
              ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]))
           + '<div class="side-divider"></div>'
           + group('Projects', 'Open all projects', 'New project', ''.join(si(n, k, on, True) for k, n, on in [
              ('career', 'Resume &amp; portfolio', True), ('career', 'Hackathon prep', False), ('career', 'Life OS app', False),
              ('finance', 'Emergency fund', False), ('health', '5K training', False), ('personal', 'Reading challenge', False),
              ('home', 'Room makeover', False)]))
           + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>')

# ---------- header ----------
elapsed = round((a4.TODAY - P_START).days / (P_DUE - P_START).days * 100)
header_progress = (f'<span class="hprog" data-tip="3 of 5 tasks done · {elapsed}% of the project\'s time has passed">'
                   f'<span class="hbar"><i style="width:60%"></i><b style="left:{elapsed}%"></b></span>'
                   f'<span class="t-meta hpt">60% · 3 of 5 tasks · on pace</span></span>')

# ---------- metrics card (same tiles as the area page) ----------
m1 = o3.mtile('career', 'Career', 'Portfolio pieces', '2', '', 'of 4 by Nov 30', 'ok',
              o3.line_chart([(D(2026, 10, 20), 0), (D(2026, 10, 28), 1), (D(2026, 11, 10), 2), (D(2026, 11, 14), 2)], 4, P_DUE),
              'Needs 2 more in 16 days')[2]
m2 = o3.mtile('career', 'Career', 'Recruiter replies', '0', '', 'of 2 this month', 'warn',
              o3.period_line([2, 0], 2, 'month'), 'October met · 16 days left')[2]
metrics_card = a2.card('Metrics', '2 metrics owned by this project · 1 behind',
                       f'<div class="amgrid">{m1}{m2}</div>' + o3.legend)

# ---------- timeline ----------
def task_pt(d, state, tip):
    mk = {'open': '<span class="check"></span>', 'done': '<span class="check done"></span>',
          'over': '<span class="check od"></span>'}[state]
    return f'<div class="tpt task {state}" style="left:{a4.pct(d):.2f}%" data-tip="{tip}">{mk}</div>'
def sec_lane(name, pts, nodue=0):
    extra = (f'<span class="nodue" data-tip="{nodue} open task{"s" if nodue > 1 else ""} without a due date">'
             f'+{nodue} without due date</span>') if nodue else ''
    return a4.lane(name, f'<div class="trow">{"".join(pts)}{extra}</div>')

win_l, win_r = a4.pct(P_START) / 100, a4.pct(P_DUE) / 100
window = f'<div class="pwin" style="left:calc(140px + (100% - 140px) * {win_l:.4f});width:calc((100% - 140px) * {win_r - win_l:.4f})"></div>'

metric_rows = (a4.mrow(a4.seg(P_START, P_DUE, 'reach', 50, tip='Portfolio pieces · reach 4 by Nov 30 · now 2 / 4'),
                       a4.point('', P_DUE, 'target', 'Deadline: Nov 30'))
             + a4.mrow(a4.seg(D(2026, 10, 1), D(2026, 11, 1), 'met', tip='October: met (2 replies per month)'),
                       a4.seg(D(2026, 11, 1), D(2026, 12, 1), 'cur', 0, tip='November: 0 / 2 so far')))
names = ''.join(f'<div class="mname">{ic("stats")}<span>{n}</span></div>' for n in ['Portfolio pieces', 'Recruiter replies'])
metrics_lane = (f'<div class="lane mlane"><div class="ln"><div class="lnt"><span class="lnh">{ic("chev")}Metrics</span></div>{names}</div>'
                f'<div class="lt2"><div class="mspacer"></div>{metric_rows}</div></div>')

lanes = (a4.lane('Project', '<div class="trow">' + a4.bar('Resume &amp; portfolio', P_START, P_DUE, prog=60, tip='Resume &amp; portfolio · Oct 20 – Nov 30 · 60% · 3 of 5 tasks') + '</div>')
       + a4.lane('Events', '<div class="trow">' + a4.point('Mock interview', D(2026, 11, 20), tip='Mock interview with Ana · Fri, Nov 20 · 2:00 PM') + '</div>')
       + metrics_lane)
timeline = (f'<div class="tl">{a4.tl_axis()}<div class="tl-body"><div class="tl-grid">{a4.grid_lines}</div>'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {a4.pct(a4.TODAY)/100:.4f})"><span>Today</span></div>'
            f'{lanes}</div></div>'
            '<div class="tlegend"><span><i class="sw"></i>Progress</span><span><i class="lg met"></i>Target met</span><span><i class="lg up"></i>Upcoming</span></div>')

# ---------- sections ----------
def sections():
    rows = ''
    for n, d, t, cls in [('Resume', 0, 1, ''), ('Portfolio', 2, 2, ''), ('LinkedIn', 1, 1, ''), ('No section', 0, 1, 'nosec')]:
        rows += (f'<div class="secr {cls}" data-tip="{n}: {d} of {t} tasks done"><span class="secn">{n}</span>'
                 f'<span class="secb"><i style="width:{round(d / t * 100)}%"></i></span><span class="secv">{d} / {t}</span></div>')
    return f'<div class="secl">{rows}</div>'

# ---------- routines owned by the project ----------
def routines():
    months = ''.join(f'<span style="left:{(D(2026, m, 1) - a4.START).days / a4.QDAYS * 100:.2f}%">{D(2026, m, 1):%B}</span>' for m in (10, 11, 12))
    head = f'<div class="hrow hhead"><span class="hn"></span><div class="hmonths">{months}</div></div>'
    rows = (a4.hgroup('Weekly reset', 'Sundays', '1 of its 5 steps is in this project')
            + a4.hrow('Post one LinkedIn update', 7, 70, 2, sched='sun', starts=(P_START - a4.START).days))
    legend = ('<div class="hleg"><span><i class="d"></i>Done</span><span><i class="s"></i>Skipped</span><span><i class="m"></i>Missed</span>'
              '<span><i class="p"></i>Paused</span><span><i class="t"></i>Today, to do</span><span><i class="f"></i>Upcoming</span><span><i class="n"></i>Not due</span></div>')
    return f'<div class="heat2">{head}{rows}</div>{legend}'

# ---------- tabbed card (same tabs as the area page) ----------
C = '<span class="check"></span>'
M = f'<span class="mark xm">{ic("stats")}</span>'
rows = ''.join([
    a4.trow(C, 'Update resume', '<span class="sec">Resume · </span>Overdue 10 days', 'danger'),
    a4.trow(M, 'Recruiter replies', '0 of 2 this month'),
])
tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}{f"<span class=counter>{n}</span>" if n else ""}</span>' for i, (t, n) in enumerate(
    [('Needs attention', 2), ('Unscheduled', 1), ('Recurring', 1), ('Completed', ''), ('Notes', '')]))
tab_card = (f'<section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span></div></header>'
            f'<div class="sbody tbody">{rows}</div></section>')

# ---------- agenda ----------
agenda = (a4.aday('Overdue', '1', [a4.arow('task', 'Update resume', '<span class="overdue">Nov 4</span> · Resume', 'high')], danger=True)
          + a4.aday('Fri', 'Nov 20', [a4.arow('event', 'Mock interview with Ana', '2:00 PM')])
          + a4.aday('Thu', 'Nov 26', [a4.arow('task', 'Ask Prof. Reyes for a reference', 'Due')])
          + a4.aday('Mon', 'Nov 30', [
              f'<div class="arow"><span class="mark pmk">{ic("folder")}</span><div class="ab"><span class="at">Resume &amp; portfolio</span><span class="t-meta am">Project due</span></div></div>',
              f'<div class="arow"><span class="mark pmk dia">{ic("diamond")}</span><div class="ab"><span class="at">Portfolio pieces: 4</span><span class="t-meta am">Target deadline · 2 / 4 now</span></div></div>']))
agenda_panel = (f'<aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span>'
                f'<span class="t-meta">Today – Dec 31</span></header><div class="ag-body">{agenda}</div></aside>')

CSS = '''
.sfold{color:var(--a-solid);width:16px;height:16px;margin:0}
.sfold svg{width:14px;height:14px}
.side .item .mark.sfold{display:grid;place-items:center}
.sgroup{cursor:pointer}
.phead-sub{display:flex;align-items:center;gap:8px;margin-top:2px}
.phead-sub .tag .dot{width:6px;height:6px}
.ttl .pfold{color:var(--a-solid);display:grid}
.ttl .pfold svg{width:18px;height:18px}
.hprog{display:flex;align-items:center;gap:8px;margin-left:8px;padding-left:12px;border-left:1px solid var(--border)}
.hbar{position:relative;width:120px;height:4px;border-radius:99px;background:var(--a-tint)}
.hbar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--a-solid)}
.hbar b{position:absolute;top:-3px;width:2px;height:10px;margin-left:-1px;background:var(--text-primary);border-radius:1px}
.hv{color:var(--text-primary);font-weight:500}
.hprog>.hpt{display:inline;white-space:nowrap}
.phead-sub{flex-wrap:nowrap;white-space:nowrap}
.pwin{position:absolute;top:0;bottom:0;background:rgba(53,121,194,.05);border-left:1px dashed var(--a-border);border-right:1px dashed var(--a-border);pointer-events:none}
.pwl{width:16px;height:10px;background:rgba(53,121,194,.08);border:1px dashed #94bbe5;display:inline-block}
.main .tlegend .sw{background:linear-gradient(to right,var(--a-border) 60%,var(--a-tint) 60%)}
.main .tlegend .lg.met{background:var(--a-border)}
.tpt.task{transform:translateX(-7px)}
.tpt.task .check{margin:0;width:14px;height:14px}
.tpt.task.over .check{border-color:var(--danger)}
.nodue{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text-tertiary)}
.secl{display:flex;flex-direction:column}
.secr{display:grid;grid-template-columns:120px minmax(0,1fr) 44px;align-items:center;gap:12px;height:36px}
.secn{font-size:13px;font-weight:500;color:var(--text-primary)}
.secr.nosec .secn{color:var(--text-tertiary);font-weight:400}
.secb{height:4px;border-radius:99px;background:var(--a-tint);position:relative;overflow:hidden}
.secb i{position:absolute;left:0;top:0;bottom:0;background:var(--a-solid);border-radius:99px}
.secv{font-size:12px;font-weight:500;color:var(--text-primary);text-align:right;font-variant-numeric:tabular-nums}
.trr .sec{color:var(--text-tertiary)}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Project · Resume &amp; portfolio (v2)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{o2.CSS}{o3.CSS}{a5.CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{sidebar}</aside>
  <main class="main career withagenda">
    <div class="content">
      <div class="areahead">
        <div>
          <div class="ttl"><span class="pfold">{ic('folder')}</span><h1 class="t-page">Resume &amp; portfolio</h1></div>
          <div class="phead-sub" style="padding-left:28px"><span class="tag area"><span class="dot"></span>Career</span>
            <span class="tag neutral">Active</span>
            <span class="t-meta">Oct 20 – Nov 30 · 16 days left</span>
            {header_progress}</div>
        </div>
        <div class="acts">
          <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
          <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
          <button class="btn icon" title="Edit, complete, archive or delete">{ic('more')}</button>
          <div class="split-btn"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev" title="More to add">{ic('chev')}</button></div>
        </div>
      </div>
      <div class="scroll">
        {metrics_card}
        <div class="split">
          <div class="leftcol">
            {a2.card('Timeline', "1 project · 1 event · 2 metrics in Q4", timeline)}
            {a2.card('Routines', '1 step in 1 routine', routines())}
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
                    f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>')
import rules as _rules
html = _rules.apply(html)
Path('/mnt/user-data/outputs/life-os-mock-project.html').write_text(html)
print('ok', len(html))
