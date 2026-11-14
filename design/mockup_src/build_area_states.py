"""Area screen with all mock states: normal, new area with no data, Add menu, ⋯ menu,
Edit area pop-up, Archive confirm, New metric pop-up."""
import re
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_area5 as a5  # noqa: E402  (approved normal state)
import build_empty as be  # noqa: E402  (modal + empty-state styles)
a4, a2, bw, ic, ov, o2, o3 = a5.a4, a5.a2, a5.bw, a5.ic, a5.ov, a5.o2, a5.o3
bw.I.update({
  'pencil': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  'trash': '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
})

# ---------- normal state: the approved page, unchanged ----------
normal = a5.html
body = normal[normal.index('<body>') + 6: normal.index('<div id="tip">')]
body = body.replace('<div class="app">', '<div class="app st-normal">', 1)
head_css = normal[normal.index('<style>') + 7: normal.index('</style>')]

# ---------- empty state: Finance, just created ----------
def sbar(selected):
    rows = ''.join(f'<div class="item {k}{" on" if k == selected else ""}"><span class="dot"></span>{n}</div>' for k, n in [
        ('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
        ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')])
    return (f'<div class="sgroup"><span class="sg-name">Life areas</span><span style="flex:1"></span>'
            f'<span class="icon-btn sg-add" title="New life area">{ic("plus")}</span></div>{rows}'
            f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived areas</div>')

def eline(text, *actions):
    acts = ''.join(f'<button class="btn ghost">{ic("plus")}{a}</button>' for a in actions)
    return f'<div class="card-empty"><span class="t-meta">{text}</span>{acts}</div>'

menu_icon = f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>'
def ecard(title, sub, inner):
    return a2.card(title, sub, inner).replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>', menu_icon)

metric_ph = (f'<div class="amgrid"><div class="mt mt-empty">{ic("stats")}<span>Metrics are the outcomes you want to track in Finance, like savings or monthly spending.</span>'
             f'<button class="btn ghost">{ic("plus")}Add metric</button></div></div>')
tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(['Needs attention', 'Unscheduled', 'Recurring', 'Completed', 'Notes']))
empty_main = f'''<main class="main finance withagenda"><div class="content">
  <div class="areahead"><div>
    <div class="ttl"><span class="dot"></span><h1 class="t-page">Finance</h1></div>
    <p class="t-body vision">Six months of savings by next year.</p></div>
    <div class="acts">
      <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
      <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
      <button class="btn icon" title="Edit, archive or delete">{ic('more')}</button>
      <div class="split-btn"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev">{ic('chev')}</button></div>
    </div></div>
  <div class="scroll">
    {ecard('Metrics', 'No metrics yet', metric_ph)}
    <div class="split"><div class="leftcol">
      {ecard('Timeline', 'Projects, events and Finance\'s metric targets in Q4', eline('Nothing in Q4 yet. Projects, events and metric targets will appear on the timeline.', 'New project', 'New event'))}
      {ecard('Projects', 'No projects yet', eline('No projects in Finance.', 'New project'))}
      {ecard('Routines', 'Routine steps in Finance', eline('No routine steps in Finance. Add a step to a routine to track it here.', 'New routine step'))}
      <section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div><div class="sact">{menu_icon}</div></header>
        <div class="sbody tbody">{eline('Nothing needs attention.')}</div></section>
    </div>
    <aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span><span class="t-meta">Today – Dec 31</span></header>
      <div class="ag-body"><div class="ag-empty"><span class="t-meta">Nothing scheduled from today to Dec 31.</span>
      <button class="btn ghost">{ic('plus')}Add task</button></div></div></aside>
    </div>
  </div></div></main>'''
empty_app = (f'<div class="app st-empty"><nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>'
             f'<a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>'
             f'<aside class="side">{sbar("finance")}</aside>{empty_main}</div>')

# ---------- menus ----------
add_menu = f'''<div class="pmenu addmenu">
  <div class="mi">{ic('check')}Task</div><div class="mi">{ic('cal')}Event</div><div class="mi">{ic('folder')}Project</div>
  <div class="msep"></div><div class="mi">{ic('stats')}Metric</div><div class="mi">{ic('repeat')}Routine step</div>
  <div class="mfoot t-meta">Everything you add here belongs to Career.</div></div>'''
more_menu = f'''<div class="pmenu moremenu">
  <div class="mi">{ic('pencil')}Edit area</div><div class="mi">{ic('archive')}Archive area</div><div class="msep"></div>
  <div class="mi dis">{ic('trash')}Delete area<span class="mhint">Only empty areas can be deleted. Archive it instead.</span></div></div>'''

# ---------- pop-ups ----------
def modal(cls, title, inner, foot, width=460):
    return (f'<div class="pop2 {cls}"><div class="scrim3"></div><div class="modal3 career" style="width:{width}px" role="dialog" aria-label="{title}">'
            f'<div class="m-head"><h3>{title}</h3><span class="icon-btn" style="margin:0">{ic("x")}</span></div>'
            f'<div class="m-body">{inner}</div><div class="m-foot">{foot}</div></div></div>')

COLORS = [('blue', 'Blue', '#3579c2', None), ('teal', 'Teal', '#11bbb3', 'Finance'), ('rose', 'Rose', '#ca6a93', 'Health'),
          ('plum', 'Plum', '#b181b4', 'Personal'), ('ochre', 'Ochre', '#cba927', 'Relationships'), ('terracotta', 'Terracotta', '#cc6b43', 'Home')]
sw = ''.join(f'<label class="sw2{" on" if k == "blue" else ""}"><i style="background:{c}">{ic("check") if k == "blue" else ""}</i><span>{n}</span>{f"<em>{u}</em>" if u else ""}</label>'
             for k, n, c, u in COLORS)
edit = modal('s-edit', 'Edit life area', f'''
  <label class="fld"><span class="fl2">Name</span><span class="inp">Career</span></label>
  <div class="fld"><span class="fl2">Color</span><div class="sws">{sw}</div></div>
  <label class="fld"><span class="fl2">Vision <em>optional</em></span>
    <span class="inp area filled">Build a steady career in AI engineering, and keep learning something new every week.</span></label>
  <label class="fld"><span class="fl2">Notes <em>optional · Markdown</em></span>
    <span class="inp area filled">What a good month looks like: at least 5 job applications sent, one portfolio piece finished…</span></label>''',
    '<button class="btn">Cancel</button><button class="btn primary">Save changes</button>')

archive = modal('s-archive', 'Archive Career?', f'''
  <p class="t-body">Everything in Career is archived with it:</p>
  <ul class="cascade"><li><b>3</b> active projects</li><li><b>9</b> open tasks</li><li><b>4</b> upcoming events</li>
  <li><b>3</b> metrics, with their entries and targets kept</li><li><b>5</b> routine steps</li></ul>
  <p class="note">{ic('info')}Nothing is deleted. You can restore Career any time from Archived areas.</p>''',
    '<button class="btn">Cancel</button><button class="btn primary">Archive area</button>', 420)

seg = lambda opts, on: '<div class="seg">' + ''.join(f'<span{" class=on" if o == on else ""}>{o}</span>' for o in opts) + '</div>'
metric = modal('s-metric', 'New metric', f'''
  <div class="owner t-meta"><span class="tag area"><span class="dot"></span>Career</span>Owned by Career. Shown on its page and the Life areas overview.</div>
  <div class="frow2"><label class="fld" style="flex:1"><span class="fl2">Name</span><span class="inp focus">Job applications<span class="caret"></span></span></label>
    <label class="fld" style="width:120px"><span class="fl2">Unit <em>optional</em></span><span class="inp ph">e.g. km, h, ₱</span></label></div>
  <div class="frow2"><div class="fld" style="flex:1"><span class="fl2">Combine entries by</span>{seg(["Sum", "Average", "Latest"], "Sum")}
      <span class="hint2 t-meta">Sum adds every entry in a period. Average for things like sleep. Latest for things like weight or savings.</span></div>
    <div class="fld" style="width:150px"><span class="fl2">Better when</span>{seg(["Higher", "Lower"], "Higher")}</div></div>
  <div class="tbox"><div class="fld"><span class="fl2">Target <em>optional</em></span>{seg(["No target", "Every period", "Reach by a date"], "Every period")}</div>
    <div class="frow2 tgt-row"><span class="inp num2">5</span><span class="t-body">per</span><span class="inp sel2">month{ic('chev')}</span>
      <span class="t-body" style="margin-left:8px">starting</span><span class="inp sel2">Nov 1, 2026{ic('cal')}</span></div>
    <span class="hint2 t-meta">Shows as one segment per month on the timeline, and as "1 of 5 this month" on the tile.</span></div>''',
    '<button class="btn">Cancel</button><button class="btn primary">Create metric</button>', 520)

CSS = '''
.st-normal,.st-empty{display:none}
body.s-normal .st-normal,body.s-add .st-normal,body.s-more .st-normal,body.s-edit .st-normal,body.s-archive .st-normal,body.s-metric .st-normal{display:flex}
body.s-empty .st-empty{display:flex}
.pop2,.pmenu{display:none}
body.s-edit .pop2.s-edit,body.s-archive .pop2.s-archive,body.s-metric .pop2.s-metric{display:block}
body.s-add .addmenu,body.s-more .moremenu{display:block}
.scrim3{position:fixed;inset:0;background:rgba(17,24,39,.32);z-index:30}
.modal3{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;z-index:31;display:flex;flex-direction:column;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.inp.area.filled{color:var(--text-primary);height:auto;min-height:44px;padding-bottom:7px;line-height:18px}
.inp.ph{color:var(--text-disabled)}
.frow2{display:flex;gap:12px;align-items:flex-start}
.tgt-row{align-items:center;gap:8px;margin-top:2px}
.inp.num2{width:56px;justify-content:center}
.inp.sel2{gap:6px}.inp.sel2 svg{width:12px;height:12px;color:var(--text-tertiary)}
.tbox{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--n50)}
.owner{display:flex;align-items:center;gap:8px}
.owner .tag .dot{width:6px;height:6px}
.cascade{margin:4px 0 0 18px;font-size:13px;line-height:22px;color:var(--text-secondary)}
.cascade b{color:var(--text-primary);font-weight:600}
.note{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--text-secondary);background:var(--n50);border-radius:6px;padding:8px 10px;line-height:16px}
.note svg{width:14px;height:14px;flex:none;margin-top:1px}
.pmenu{position:fixed;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:25;width:220px;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.addmenu{right:24px;top:62px}
.moremenu{right:110px;top:62px;width:250px}
.pmenu .mi>svg{width:16px;height:16px;color:var(--text-tertiary);margin-left:0}
.mi.dis{color:var(--text-disabled);flex-wrap:wrap;height:auto;padding:6px 8px;cursor:default}
.mi.dis svg{color:var(--text-disabled)}
.mhint{width:100%;font-size:11px;line-height:14px;color:var(--text-tertiary);padding-left:24px}
.mfoot{padding:6px 8px 2px;font-size:11px;border-top:1px solid var(--border);margin-top:4px}
.tbody .card-empty{padding:0 8px}
.ag-empty{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px 8px}
.st-empty .agenda{min-height:420px}
.st-empty .mt-empty{min-height:110px;max-width:none}
.st-empty .amgrid .mt-empty{grid-column:span 2}
'''

states = [('s-normal', 'Normal'), ('s-empty', 'New area, no data'), ('s-add', 'Add menu'), ('s-more', '⋯ menu'),
          ('s-edit', 'Edit area'), ('s-archive', 'Archive area'), ('s-metric', 'New metric')]
switch = ('<div class="states"><span>Mock state</span><div class="seg" id="st">'
          + ''.join(f'<span{" class=on" if i == 0 else ""} data-s="{k}">{n}</span>' for i, (k, n) in enumerate(states)) + '</div></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Area screen, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{head_css}{be.CSS}{CSS}</style></head>
<body class="s-normal">
{body}
{empty_app}
{add_menu}{more_menu}{edit}{archive}{metric}
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
# the empty-state module hides its own states; neutralise those rules here
html = html.replace('.st-a,.st-b{display:none}', '')
import rules as _rules
html = _rules.apply(html)
Path('/mnt/user-data/outputs/life-os-mock-area-states.html').write_text(html)
print('ok', len(html))
