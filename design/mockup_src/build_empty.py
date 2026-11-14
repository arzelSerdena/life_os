"""Life areas overview: empty states + New area pop-up."""
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_overview3 as o3  # noqa: E402
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
bw.I.update({
  'grid4': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
})

def sidebar(items):
    rows = ''.join(f'<div class="item {k}"><span class="dot"></span>{n}</div>' for k, n in items)
    empty = '' if items else '<p class="side-empty t-meta">No life areas yet. Use + to add one.</p>'
    return (f'<div class="sgroup on"><span class="sg-name">Life areas</span><span style="flex:1"></span>'
            f'<span class="icon-btn sg-add" title="New life area">{ic("plus")}</span></div>{rows}{empty}'
            f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived areas</div>')

def header(disabled):
    d = ' disabled' if disabled else ''
    return f'''<div class="areahead">
      <div><div class="ttl" style="padding-left:0"><h1 class="t-page">Life areas</h1></div>
      <p class="t-body vision" style="padding-left:0">Are your areas moving toward what you set for them?</p></div>
      <div class="acts{d}">
        <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
        <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
        <button class="btn icon" title="More">{ic('more')}</button>
        <div class="split-btn accent"><button class="sb-main">{ic('plus')}New area</button></div>
      </div></div>'''

# ---------- state 1: no areas ----------
SUGG = [('Career', '#3579c2'), ('Finance', '#11bbb3'), ('Health', '#ca6a93'), ('Personal', '#b181b4'), ('Relationships', '#cba927'), ('Home', '#cc6b43')]
first_run = f'''<div class="hero-empty">
  <div class="he-icon">{ic('grid4')}</div>
  <h2>Set up your first life area</h2>
  <p class="t-body">A life area is a part of your life you want to look after, like your career or your health.
  Projects, tasks, events, routines and metrics all live inside one.</p>
  <button class="btn primary big">{ic('plus')}New area</button>
  <div class="he-sugg"><span class="t-meta">Or start from a common one:</span>
  {''.join(f'<span class="chip"><i style="background:{c}"></i>{n}</span>' for n, c in SUGG)}</div>
</div>'''

# ---------- state 2: areas exist, no data ----------
def empty_line(text, action=None):
    a = f'<button class="btn ghost">{ic("plus")}{action}</button>' if action else ''
    return f'<div class="card-empty"><span class="t-meta">{text}</span>{a}</div>'
def grp(k, n):
    return (f'<div class="mgroup {k}" style="grid-column:span 1"><div class="mg-h">{ic("chev")}<span class="dot"></span><span class="mg-n">{n}</span>'
            f'<span class="t-meta">No metrics</span></div>'
            f'<div class="mt mt-empty">{ic("stats")}<span>Add a metric to see how {n} is going</span><button class="btn ghost">{ic("plus")}Add metric</button></div></div>')
no_data = (
    a2.card('Effort', 'Where your completed tasks went in Q4', empty_line('No tasks completed in Q4 yet. Completed tasks show up here by area.'))
  + a2.card('Outcomes', 'Metrics owned by your areas', f'<div class="ogrid">{grp("career", "Career")}{grp("finance", "Finance")}</div>')
  + '<div class="row3">'
  + a2.card('Projects', 'Progress of active projects in each area', empty_line('No active projects.', 'New project'))
  + a2.card('Routine steps done', 'One square per week', empty_line('No routine steps in these areas.', 'New routine'))
  + a2.card('Wins', 'Targets met and projects finished in Q4', empty_line('Nothing yet this quarter.'))
  + '</div>')

# ---------- pop-up: new area ----------
COLORS = [('blue', 'Blue', '#3579c2', 'Career'), ('teal', 'Teal', '#11bbb3', None), ('rose', 'Rose', '#ca6a93', None),
          ('plum', 'Plum', '#b181b4', None), ('ochre', 'Ochre', '#cba927', None), ('terracotta', 'Terracotta', '#cc6b43', None)]
swatches = ''.join(
    f'<label class="sw2{" on" if k == "teal" else ""}" title="{n}{" · used by " + u if u else ""}">'
    f'<i style="background:{c}">{ic("check") if k == "teal" else ""}</i><span>{n}</span>{f"<em>{u}</em>" if u else ""}</label>'
    for k, n, c, u in COLORS)
modal = f'''<div class="scrim2"></div>
<div class="modal2" role="dialog" aria-label="New life area">
  <div class="m-head"><h3>New life area</h3><span class="icon-btn" style="margin:0">{ic('x')}</span></div>
  <div class="m-body">
    <label class="fld"><span class="fl2">Name</span>
      <span class="inp focus">Finance<span class="caret"></span></span></label>
    <div class="fld"><span class="fl2">Color</span><div class="sws">{swatches}</div>
      <span class="hint2 t-meta">Colors can repeat, but each area is easier to spot with its own.</span></div>
    <label class="fld"><span class="fl2">Vision <em>optional</em></span>
      <span class="inp area">What does doing well in this area look like?</span>
      <span class="hint2 t-meta">Shown under the area's name on its page.</span></label>
    <div class="prev"><span class="t-meta">Preview</span><div class="item teal-prev"><span class="dot" style="background:#11bbb3"></span>Finance</div></div>
  </div>
  <div class="m-foot"><button class="btn">Cancel</button><button class="btn primary">Create area</button></div>
</div>'''

CSS = '''
.acts.disabled .seg,.acts.disabled .pnav,.acts.disabled .btn.icon{opacity:.4;pointer-events:none}
.side-empty{padding:4px 8px;font-size:12px;line-height:16px}
.hero-empty{margin:auto;max-width:520px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:80px}
.he-icon{width:48px;height:48px;border-radius:12px;background:var(--acc100);color:var(--acc700);display:grid;place-items:center}
.he-icon svg{width:24px;height:24px}
.hero-empty h2{font-size:20px;line-height:28px;font-weight:600}
.hero-empty .t-body{font-size:14px;line-height:20px}
.btn.big{height:36px;padding:0 16px;font-size:13px}
.btn.primary{background:#7e61a0;border-color:#7e61a0;color:#fff}
.he-sugg{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;margin-top:8px}
.he-sugg .t-meta{width:100%;margin-bottom:2px}
.chip{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500;cursor:pointer;background:#fff}
.chip:hover{background:var(--n100)}
.chip i{width:8px;height:8px;border-radius:2px}
.card-empty{display:flex;align-items:center;gap:12px;min-height:40px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--text-secondary)}
.btn.ghost:hover{background:var(--n100)}
.mt-empty{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:120px;justify-content:center;color:var(--text-tertiary);font-size:12px;border-style:dashed}
.mt-empty>svg{width:16px;height:16px;color:var(--a-solid)}
.mt-empty .btn{margin-left:-8px}
/* modal */
.scrim2{position:fixed;inset:0;background:rgba(17,24,39,.32);z-index:30;display:none}
.modal2{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;background:#fff;border-radius:12px;z-index:31;display:none;flex-direction:column;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
body.s-modal .scrim2{display:block}body.s-modal .modal2{display:flex}
.m-head{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 20px;border-bottom:1px solid var(--border)}
.m-head h3{font-size:16px;line-height:24px;font-weight:600}
.m-body{padding:16px 20px;display:flex;flex-direction:column;gap:16px}
.fld{display:flex;flex-direction:column;gap:6px}
.fl2{font-size:12px;font-weight:600;color:var(--text-primary)}
.fl2 em{font-style:normal;font-weight:400;color:var(--text-tertiary);margin-left:4px}
.inp{height:32px;display:flex;align-items:center;padding:0 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-primary)}
.inp.focus{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.inp.area{height:64px;align-items:flex-start;padding-top:7px;color:var(--text-disabled)}
.caret{width:1px;height:16px;background:var(--text-primary);margin-left:1px}
.hint2{font-size:11px;line-height:14px}
.sws{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.sw2{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0;border-radius:8px;cursor:pointer;font-size:11px;color:var(--text-secondary)}
.sw2:hover{background:var(--n100)}
.sw2 i{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;color:#fff}
.sw2 i svg{width:14px;height:14px;stroke-width:3}
.sw2.on{background:var(--n100);color:var(--text-primary);font-weight:600}
.sw2 em{font-style:normal;font-size:10px;color:var(--text-tertiary);line-height:12px;margin-top:-2px}
.prev{display:flex;align-items:center;gap:12px;padding-top:12px;border-top:1px solid var(--border)}
.prev .item{flex:1;background:var(--n100);color:var(--text-primary)}
.m-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--border)}
/* state switcher */
.states{position:fixed;left:12px;bottom:12px;z-index:40;display:flex;gap:8px;align-items:center;background:#111827;color:#fff;padding:6px 8px;border-radius:10px;font-size:12px}
.states .seg{background:#374151}.states .seg span{color:#d1d5db;cursor:pointer}.states .seg span.on{background:#fff;color:#111827}
.st-a,.st-b{display:none}
body.s-a .st-a,body.s-modal .st-a{display:flex}
body.s-b .st-b{display:flex}
.st-a .scroll{display:flex}
'''

def page(cls, side, head_disabled, body):
    return (f'<div class="app {cls}"><nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>'
            f'<a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>'
            f'<aside class="side">{side}</aside><main class="main">{header(head_disabled)}'
            f'<div class="scroll wide">{body}</div></main></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Life areas overview, empty states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{o2.CSS}{o3.CSS}{CSS}</style></head>
<body class="s-a">
{page('st-a', sidebar([]), True, first_run)}
{page('st-b', sidebar([('career', 'Career'), ('finance', 'Finance')]), False, no_data)}
{modal}
<div class="states"><span>Mock state</span><div class="seg" id="st">
  <span class="on" data-s="s-a">No areas</span><span data-s="s-b">Areas, no data</span><span data-s="s-modal">New area pop-up</span></div></div>
<script>
const st=document.getElementById('st');
st.onclick=e=>{{const s=e.target.dataset.s;if(!s)return;document.body.className=s;
  st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===e.target));}};
</script>
</body></html>'''
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>')
Path('/mnt/user-data/outputs/life-os-mock-areas-empty.html').write_text(html)
print('ok', len(html))
