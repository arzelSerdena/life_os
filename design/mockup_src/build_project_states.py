"""Project screen with all mock states -> approved-project.html.

States: Normal, New project (no data), Add menu, ⋯ menu, Edit project, Complete project, Archive project, New metric.
Normal state = build_project2.py (presentation rules applied). Menus and pop-ups reuse the area-states styles.
"""
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_project2 as p2  # noqa: E402  (normal state, writes life-os-mock-project.html)
import build_area_states as ast  # noqa: E402  (menu + modal styles, writes its own file)
import rules as _rules  # noqa: E402
be, a2, bw, ic = ast.be, ast.a2, ast.bw, ast.ic

normal = Path('/mnt/user-data/outputs/life-os-mock-project.html').read_text()
body = normal[normal.index('<body>') + 6: normal.index('<div id="tip">')]
body = body.replace('<div class="app">', '<div class="app st-normal">', 1)
head_css = normal[normal.index('<style>') + 7: normal.index('</style>')]

# ---------- new project, no data (Portfolio site, created today) ----------
def sidebar(selected):
    areas = ''.join(p2.si(n, k) for k, n in [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
                                           ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')])
    projs = ''.join(p2.si(n, k, n == selected, True) for k, n in [
        ('career', 'Resume &amp; portfolio'), ('career', 'Hackathon prep'), ('career', 'Life OS app'), ('career', 'Portfolio site'),
        ('finance', 'Emergency fund'), ('health', '5K training'), ('personal', 'Reading challenge'), ('home', 'Room makeover')])
    return (p2.group('Life areas', 'Open the life areas overview', 'New life area', areas) + '<div class="side-divider"></div>'
            + p2.group('Projects', 'Open all projects', 'New project', projs)
            + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>')

eline = ast.eline
menu_icon = f'<span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span>'
def ecard(title, sub, inner):
    return a2.card(title, sub, inner).replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>', menu_icon)
metric_ph = (f'<div class="amgrid"><div class="mt mt-empty">{ic("stats")}<span>No metrics yet</span>'
             f'<button class="btn ghost">{ic("plus")}Add metric</button></div></div>')
tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(['Needs attention', 'Unscheduled', 'Recurring', 'Completed', 'Notes']))
empty_main = f'''<main class="main career withagenda"><div class="content">
  <div class="areahead"><div>
    <div class="ttl"><span class="pfold">{ic('folder')}</span><h1 class="t-page">Portfolio site</h1></div>
    <div class="phead-sub" style="padding-left:28px"><span class="tag area"><span class="dot"></span>Career</span>
      <span class="tag neutral">Active</span><span class="t-meta">Started Nov 14 · no due date</span>
      <span class="hprog"><span class="t-meta hpt">No tasks yet</span></span></div></div>
    <div class="acts">
      <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
      <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
      <button class="btn icon" title="Edit, complete, archive or delete">{ic('more')}</button>
      <div class="split-btn"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev">{ic('chev')}</button></div>
    </div></div>
  <div class="scroll">
    {ecard('Metrics', 'No metrics yet', metric_ph)}
    <div class="split"><div class="leftcol">
      {ecard('Timeline', 'No events or metrics in Q4', eline('Nothing in Q4 yet.', 'New event'))}
      <section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div><div class="sact">{menu_icon}</div></header>
        <div class="sbody tbody">{eline('No tasks yet.', 'Add task')}</div></section>
    </div>
    <aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span><span class="t-meta">Today – Dec 31</span></header>
      <div class="ag-body"><div class="ag-empty"><span class="t-meta">Nothing scheduled from today to Dec 31.</span>
      <button class="btn ghost">{ic('plus')}Add task</button></div></div></aside>
    </div>
  </div></div></main>'''
empty_app = (f'<div class="app st-empty"><nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>'
             f'<a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>'
             f'<aside class="side">{sidebar("Portfolio site")}</aside>{empty_main}</div>')

# ---------- menus ----------
bw.I.setdefault('xcircle', '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>')
bw.I.setdefault('section', '<path d="M4 6h16M4 12h10M4 18h7"/>')
add_menu = f'''<div class="pmenu addmenu">
  <div class="mi">{ic('check')}Task</div><div class="mi">{ic('section')}Section</div><div class="mi">{ic('cal')}Event</div>
  <div class="msep"></div><div class="mi">{ic('stats')}Metric</div><div class="mi">{ic('repeat')}Routine step</div></div>'''
more_menu = f'''<div class="pmenu moremenu">
  <div class="mi">{ic('pencil')}Edit project</div><div class="mi">{ic('ok')}Complete project</div>
  <div class="mi">{ic('xcircle')}Cancel project</div><div class="mi">{ic('archive')}Archive project</div><div class="msep"></div>
  <div class="mi dis">{ic('trash')}Delete project<span class="mhint">Only empty projects can be deleted. Archive it instead.</span></div></div>'''

# ---------- pop-ups ----------
modal = ast.modal
AREAS = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'), ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]
area_opts = ''.join(f'<span class="opt{" on" if k == "career" else ""} {k}"><span class="dot"></span>{n}</span>' for k, n in AREAS)
edit = modal('s-edit', 'Edit project', f'''
  <label class="fld"><span class="fl2">Name</span><span class="inp">Resume &amp; portfolio</span></label>
  <div class="fld"><span class="fl2">Life area</span><div class="opts">{area_opts}</div></div>
  <div class="fld2">
    <label class="fld"><span class="fl2">Start <em>optional</em></span><span class="inp dt">{ic('cal')}Oct 20, 2026</span></label>
    <label class="fld"><span class="fl2">Due <em>optional</em></span><span class="inp dt">{ic('cal')}Nov 30, 2026</span></label></div>
  <label class="fld"><span class="fl2">Notes <em>optional · Markdown</em></span>
    <span class="inp area filled">Get the resume and portfolio ready before the hackathon and the mock interview…</span></label>''',
    '<button class="btn">Cancel</button><button class="btn primary">Save changes</button>')

complete = modal('s-complete', 'Complete Resume &amp; portfolio?', f'''
  <p class="t-body">2 tasks are still open. Completing the project also:</p>
  <ul class="cascade"><li>cancels <b>2</b> open tasks</li><li>cancels <b>1</b> upcoming event</li>
  <li>archives <b>1</b> recurring task, <b>1</b> routine step and <b>2</b> metrics, with their entries and targets kept</li></ul>
  <p class="note">{ic('info')}You can reopen the project later. Cancelled tasks stay cancelled.</p>''',
    '<button class="btn">Cancel</button><button class="btn primary">Complete project</button>', 440)

archive = modal('s-archive', 'Archive Resume &amp; portfolio?', f'''
  <p class="t-body">Everything in the project is archived with it:</p>
  <ul class="cascade"><li><b>5</b> tasks in <b>3</b> sections</li><li><b>1</b> event</li><li><b>1</b> recurring task</li>
  <li><b>2</b> metrics, with their entries and targets kept</li><li><b>1</b> routine step</li></ul>
  <p class="note">{ic('info')}Nothing is deleted. You can restore the project any time from Archived.</p>''',
    '<button class="btn">Cancel</button><button class="btn primary">Archive project</button>', 420)

seg = ast.seg
metric = modal('s-metric', 'New metric', f'''
  <div class="owner t-meta"><span class="tag area">{ic("folder")}Resume &amp; portfolio</span>Owned by Resume &amp; portfolio</div>
  <div class="frow2"><label class="fld" style="flex:1"><span class="fl2">Name</span><span class="inp focus">Portfolio pieces<span class="caret"></span></span></label>
    <label class="fld" style="width:120px"><span class="fl2">Unit <em>optional</em></span><span class="inp ph">e.g. km, h, ₱</span></label></div>
  <div class="frow2"><div class="fld" style="flex:1"><span class="fl2">Combine entries by</span>{seg(["Sum", "Average", "Latest"], "Latest")}</div>
    <div class="fld" style="width:150px"><span class="fl2">Better when</span>{seg(["Higher", "Lower"], "Higher")}</div></div>
  <div class="tbox"><div class="fld"><span class="fl2">Target <em>optional</em></span>{seg(["No target", "Every period", "Reach by a date"], "Reach by a date")}</div>
    <div class="frow2 tgt-row"><span class="inp num2">4</span><span class="t-body">by</span><span class="inp sel2">Nov 30, 2026{ic('cal')}</span></div></div>''',
    '<button class="btn">Cancel</button><button class="btn primary">Create metric</button>', 520)

CSS = '''
.st-normal,.st-empty{display:none}
body.s-normal .st-normal,body.s-add .st-normal,body.s-more .st-normal,body.s-edit .st-normal,body.s-complete .st-normal,
body.s-archive .st-normal,body.s-metric .st-normal{display:flex}
body.s-empty .st-empty{display:flex}
body.s-complete .pop2.s-complete{display:block}
.owner .tag svg{width:12px;height:12px;color:var(--a-solid)}
.st-empty .amgrid .mt-empty{grid-column:span 1}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500;cursor:pointer}
.opt .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid)}
.opt.on{border-color:var(--a-solid);background:var(--a-tint);color:var(--a-ink)}
.fld2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.inp.dt{gap:6px}.inp.dt svg{width:14px;height:14px;color:var(--text-tertiary)}
'''
CSS_PROJ = p2.CSS  # header and sidebar styles for the empty state
states = [('s-normal', 'Normal'), ('s-empty', 'New project, no data'), ('s-add', 'Add menu'), ('s-more', '⋯ menu'),
          ('s-edit', 'Edit project'), ('s-complete', 'Complete project'), ('s-archive', 'Archive project'), ('s-metric', 'New metric')]
switch = ('<div class="states"><span>Mock state</span><div class="seg" id="st">'
          + ''.join(f'<span{" class=on" if i == 0 else ""} data-s="{k}">{n}</span>' for i, (k, n) in enumerate(states)) + '</div></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Project screen, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{head_css}{be.CSS}{ast.CSS}{CSS_PROJ}{CSS}</style></head>
<body class="s-normal">
{body}
{empty_app}
{add_menu}{more_menu}{edit}{complete}{archive}{metric}
{switch}
<div id="tip"></div>
<script>
const st=document.getElementById('st');
st.onclick=e=>{{const s=e.target.dataset.s;if(!s)return;document.body.className=s;
  st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===e.target));}};
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){{tip.style.display='none';return}}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';}});
</script>
</body></html>'''
html = html.replace('.st-a,.st-b{display:none}', '')
html = _rules.apply(html)
Path('/mnt/user-data/outputs/approved-project.html').write_text(html)
print('ok', len(html))
