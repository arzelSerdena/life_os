"""Areas group > Projects > one project's overview (Resume & portfolio), same family as the area screen."""
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_overview3 as o3  # noqa: E402
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
D = date

# ---------- sidebar: LIFE AREAS group + PROJECTS group ----------
def si(label, area, on=False, folder=False):
    lead = f'<span class="mark sfold">{ic("folder")}</span>' if folder else '<span class="dot"></span>'
    return f'<div class="item{" on" if on else ""} {area}">{lead}{label}</div>'
def group(name, add_title, items):
    return (f'<div class="sgroup"><span class="sg-name">{name}</span><span style="flex:1"></span>'
            f'<span class="icon-btn sg-add" title="{add_title}">{ic("plus")}</span></div>' + items)
sidebar = (group('Life areas', 'New life area', ''.join(si(n, k) for k, n in [
              ('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
              ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]))
           + '<div class="side-divider"></div>'
           + group('Projects', 'New project', ''.join(si(n, k, on, True) for k, n, on in [
              ('career', 'Resume &amp; portfolio', True), ('career', 'Hackathon prep', False), ('career', 'Life OS app', False),
              ('finance', 'Emergency fund', False), ('health', '5K training', False), ('personal', 'Reading challenge', False),
              ('home', 'Room makeover', False)]))
           + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>')

# ---------- tiles ----------
tiles = ''.join([
    a4.tile('Progress', '60', '%', delta='3 of 5 tasks', good=True, note='on pace'),
    a4.tile('Open tasks', '2', delta='1 overdue', good=False, note='1 high'),
    a4.tile('Completed', '3', note='this quarter', trend=[0, 0, 1, 1, 1, 2, 3]),
    a4.tile('On time', '67', '%', delta='−8 pts', good=False, note='vs Q3', trend=[80, 75, 70, 67]),
    a4.tile('Days left', '16', note='due Mon, Nov 30'),
    a4.tile('Rollovers', '1.8', '/ task', note='this quarter'),
])

# ---------- timeline: sections (task due dates), events, metrics ----------
def task_pt(label, d, state='open', tip=''):
    l = a4.pct(d)
    mk = {'open': '<span class="check"></span>', 'done': '<span class="check done"></span>',
          'over': '<span class="check od"></span>'}[state]
    return (f'<div class="tpt task {state}" style="left:{l:.2f}%" data-tip="{tip}">{mk}'
            f'<span class="tpl">{label}</span></div>')
window = (f'<div class="pwin" style="left:calc(140px + (100% - 140px) * {a4.pct(D(2026,10,20))/100:.4f});'
          f'width:calc((100% - 140px) * {(a4.pct(D(2026,11,30))-a4.pct(D(2026,10,20)))/100:.4f})"></div>')
sec = lambda name, rows: a4.lane(name, ''.join(f'<div class="trow">{r}</div>' for r in rows), len(rows))
lanes = (
    sec('Resume', [task_pt('Update resume', D(2026, 11, 4), 'over', 'Update resume · due Nov 4 · overdue'),
                   task_pt('Ask Prof. Reyes for a reference', D(2026, 11, 26), 'open', 'Due Nov 26')])
  + sec('Portfolio', [task_pt('Write case study', D(2026, 11, 8), 'done', 'Done Nov 8'),
                      task_pt('Draft portfolio page', D(2026, 11, 13), 'done', 'Done Nov 13')])
  + sec('LinkedIn', [task_pt('Add featured posts', D(2026, 10, 28), 'done', 'Done Oct 28')])
  + a4.lane('Events', '<div class="trow">' + a4.point('Mock interview', D(2026, 11, 20), tip='Mock interview with Ana · Fri, Nov 20 · 2:00 PM') + '</div>')
  + a4.lane('Metrics', '<div class="trow">' + a4.bar('Portfolio pieces · 2 / 4', D(2026, 10, 1), D(2026, 12, 31), prog=50, tip='Portfolio pieces · 4 by Dec 31')
            + a4.point('', D(2026, 12, 31), 'target', 'Deadline: Dec 31') + '</div>')
)
timeline = (f'<div class="tl">{a4.tl_axis()}<div class="tl-body"><div class="tl-grid">{a4.grid_lines}</div>{window}'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {a4.pct(a4.TODAY)/100:.4f})"><span>Today</span></div>'
            f'{lanes}</div></div>'
            '<div class="tlegend"><span><i class="pwl"></i>Project window (Oct 20 – Nov 30)</span><span><span class="check" style="width:12px;height:12px;margin:0"></span>Task due date</span><span><i class="sw"></i>Metric progress</span></div>')

# ---------- sections ----------
def sections():
    data = [('Resume', 0, 2), ('Portfolio', 2, 2), ('LinkedIn', 1, 1)]
    rows = ''
    for n, d, t in data:
        pct = round(d / t * 100)
        rows += (f'<div class="pr" data-tip="{n}: {d} of {t} tasks done"><span class="drl"><span class="drn">{n}</span></span>'
                 f'<span class="prb"><i style="width:{pct}%"></i></span><span class="prv">{pct}%<span class="t-meta">{d} of {t} tasks</span></span></div>')
    return rows

# ---------- metrics owned by the project (same tile + line style as Outcomes) ----------
m1 = o3.mtile('career', 'Career', 'Portfolio pieces', '2', '', 'of 4 by Dec 31', 'ok',
              o3.line_chart([(D(2026,10,1), 0), (D(2026,10,22), 1), (D(2026,11,10), 2), (D(2026,11,14), 2)], 4, D(2026,12,31)),
              'On pace for the deadline')[2]
m2 = o3.mtile('career', 'Career', 'Recruiter replies', '0', '', 'of 2 this month', 'warn',
              o3.period_line([2, 0], 2, 'month'), 'October met · 16 days left')[2]
metrics = f'<div class="pmgrid">{m1}{m2}</div>'

# ---------- tabbed card ----------
C = '<span class="check"></span>'
rows = ''.join([a4.trow(C, 'Update resume', 'Overdue 10 days', 'danger'),
                a4.trow(C, 'Ask Prof. Reyes for a reference', 'Due in 12 days')])
tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}{f"<span class=counter>{n}</span>" if n else ""}</span>' for i, (t, n) in enumerate(
    [('Open tasks', 2), ('Completed', 3), ('Recurring', 1), ('Notes', '')]))
tab_card = (f'<section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span></div></header>'
            f'<div class="sbody tbody">{rows}</div></section>')

# ---------- agenda ----------
agenda = (a4.aday('Overdue', '1', [a4.arow('task', 'Update resume', '<span class="overdue">Nov 4</span> · Resume', 'high')], danger=True)
          + a4.aday('Fri', 'Nov 20', [a4.arow('event', 'Mock interview with Ana', '2:00 PM')])
          + a4.aday('Thu', 'Nov 26', [a4.arow('task', 'Ask Prof. Reyes for a reference', 'Due · Resume')])
          + a4.aday('Mon', 'Nov 30', [f'<div class="arow"><span class="mark pmk">{ic("folder")}</span><div class="ab"><span class="at">Resume &amp; portfolio</span><span class="t-meta am">Project due</span></div></div>'])
          + a4.aday('Thu', 'Dec 31', [f'<div class="arow"><span class="mark pmk dia">{ic("diamond")}</span><div class="ab"><span class="at">Portfolio pieces: 4</span><span class="t-meta am">Target deadline · 2 / 4 now</span></div></div>']))
agenda_panel = (f'<aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span>'
                f'<span class="t-meta">Today – Dec 31</span></header><div class="ag-body">{agenda}</div></aside>')

CSS = '''
.sfold{color:var(--a-solid);width:16px;height:16px;margin:0}
.sfold svg{width:14px;height:14px}
.side .item .mark.sfold{display:grid;place-items:center}
.phead-sub{display:flex;align-items:center;gap:8px;margin-top:2px}
.phead-sub .tag .dot{width:6px;height:6px}
.ttl .pfold{color:var(--a-solid);display:grid}
.ttl .pfold svg{width:18px;height:18px}
.pwin{position:absolute;top:0;bottom:0;background:rgba(53,121,194,.05);border-left:1px dashed var(--a-border);border-right:1px dashed var(--a-border);pointer-events:none}
.pwin span{position:absolute;bottom:2px;left:6px;font-size:10px;color:var(--a-text);font-weight:500;white-space:nowrap}
.pwl{width:16px;height:10px;background:rgba(53,121,194,.08);border:1px dashed #94bbe5;display:inline-block}
.tlegend .sw{background:linear-gradient(to right,#94bbe5 60%,#e5edf9 60%)}
.tpt.task .check{margin:0;width:14px;height:14px}
.tpt.task.done .tpl{color:var(--text-tertiary)}
.tpt.task.over .check{border-color:var(--danger)}
.tpt.task.over .tpl{color:var(--danger)}
.tpt.lift{top:-10px}
.pmgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pr{grid-template-columns:110px minmax(0,1fr) 112px}
.prb{background:var(--a-tint)}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Project · Resume &amp; portfolio</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{o2.CSS}{o3.CSS}{CSS}</style></head>
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
            <span class="tag neutral">Active</span><span class="t-meta">Oct 20 – Nov 30 · 16 days left</span></div>
        </div>
        <div class="acts">
          <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
          <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
          <button class="btn icon" title="Edit, complete, archive or delete">{ic('more')}</button>
          <div class="split-btn"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev" title="More to add">{ic('chev')}</button></div>
        </div>
      </div>
      <div class="scroll">
        <div class="kpis">{tiles}</div>
        <div class="split">
          <div class="leftcol">
            {a2.card('Timeline', 'Task due dates by section, events and metric targets in Q4', timeline)}
            <div class="row2c">
              {a2.card('Sections', 'Share of the tasks in each section that are done', sections())}
              {a2.card('Metrics', 'Metrics that belong to this project', metrics)}
            </div>
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
Path('/mnt/user-data/outputs/life-os-mock-project.html').write_text(html)
print('ok', len(html))
