"""Areas group > PROJECTS heading: the all-projects overview, with mock states.

Compares projects instead of repeating a project page:
- Timeline: one lane per area, one bar per project (same bars as the area and project timelines).
- All projects: tabbed card (Active / Finished / Archived), grouped by area, one 36 px row per project
  with a progress bar + black pace mark, tasks done, pace, due date and open/overdue tasks.
- Right column (360 px): Needs attention and Wins.
Project metrics are not shown here (metrics show only on their owner's screens).
Mock states: normal, no projects, projects without tasks, New project pop-up.
"""
import sys
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_empty as em  # noqa: E402  (also builds o3, a4, ...)
o3 = em.o3
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
D = date
TODAY = a4.TODAY

# ---------- sample data ----------
# key, area name, project, start (created), due, done, total, status, overdue tasks
P = [
    ('career', 'Career', 'Resume &amp; portfolio', D(2026, 10, 20), D(2026, 11, 30), 3, 5, 'active', 1),
    ('career', 'Career', 'Hackathon prep', D(2026, 11, 2), D(2026, 11, 20), 1, 4, 'active', 0),
    ('career', 'Career', 'Life OS app', D(2026, 9, 1), None, 8, 20, 'active', 0),
    ('career', 'Career', 'Interview prep', D(2026, 9, 28), D(2026, 10, 30), 6, 6, 'done', 0),
    ('finance', 'Finance', 'Emergency fund', D(2026, 10, 1), D(2026, 12, 31), 4, 11, 'active', 0),
    ('health', 'Health &amp; Beauty', '5K training', D(2026, 10, 25), D(2027, 1, 25), 9, 20, 'active', 0),
    ('personal', 'Personal', 'Reading challenge', D(2026, 9, 1), D(2026, 12, 15), 1, 12, 'active', 2),
    ('home', 'Home', 'Room makeover', D(2026, 10, 15), D(2027, 1, 23), 3, 10, 'active', 0),
]
AREAS = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
         ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]

def pace(s, e):
    return None if e is None else max(0, min(100, round((TODAY - s).days / (e - s).days * 100)))
def days_left(e):
    n = (e - TODAY).days
    return f'in {n} days' if n > 1 else ('tomorrow' if n == 1 else ('today' if n == 0 else f'{-n} days late'))

# ---------- sidebar ----------
def si(label, area, on=False, folder=False):
    lead = f'<span class="mark sfold">{ic("folder")}</span>' if folder else '<span class="dot"></span>'
    return f'<div class="item{" on" if on else ""} {area}">{lead}{label}</div>'
def group(name, add_title, items, on=False, empty=''):
    return (f'<div class="sgroup{" on" if on else ""}"><span class="sg-name">{name}</span><span style="flex:1"></span>'
            f'<span class="icon-btn sg-add" title="{add_title}">{ic("plus")}</span></div>' + items + empty)
def sidebar(projects):
    areas = ''.join(si(n, k) for k, n in AREAS)
    rows = ''.join(si(n, k, False, True) for k, _, n, *_r, st, _o in projects if st == 'active')
    empty = '' if rows else '<p class="side-empty t-meta">No projects yet. Use + to add one.</p>'
    return (group('Life areas', 'New life area', areas) + '<div class="side-divider"></div>'
            + group('Projects', 'New project', rows, on=True, empty=empty)
            + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>')

def header(disabled=False):
    d = ' disabled' if disabled else ''
    return f'''<div class="areahead">
      <div><div class="ttl" style="padding-left:0"><h1 class="t-page">Projects</h1></div>
      <p class="t-body vision" style="padding-left:0">Are your projects on pace to finish on time?</p></div>
      <div class="acts{d}">
        <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
        <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
        <button class="btn icon" title="More">{ic('more')}</button>
        <div class="split-btn accent"><button class="sb-main">{ic('plus')}New project</button></div>
      </div></div>'''

# ---------- timeline: one lane per area ----------
def timeline(projects):
    lanes = ''
    for k, n in AREAS:
        ps = [p for p in projects if p[0] == k]
        if not ps:
            continue
        rows = ''
        for _, _, name, s, e, d, t, st, _o in ps:
            prog = round(d / t * 100) if t else 0
            end = e or a4.END
            if st == 'done':
                b = a4.bar(name, s, end, prog=100, done=True, tip=f'{name} · done {e:%b %-d}')
            elif e is None:
                b = a4.bar(name, s, end, prog=prog, open_end=True, tip=f'{name} · started {s:%b %-d} · no due date · {prog}%')
            else:
                b = a4.bar(name, s, end, prog=prog, tip=f'{name} · {s:%b %-d} – {e:%b %-d} · {prog}%')
            rows += f'<div class="trow">{b}</div>'
        lane = a4.lane(f'<span class="dot"></span>{n}', rows, len(ps))
        lanes += lane.replace('<div class="lane"', f'<div class="lane {k}"', 1)
    return (f'<div class="tl">{a4.tl_axis()}<div class="tl-body"><div class="tl-grid">{a4.grid_lines}</div>'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {a4.pct(TODAY)/100:.4f})"><span>Today</span></div>'
            f'{lanes}</div></div>'
            '<div class="tlegend"><span><i class="sw"></i>Progress</span><span><i class="lg dn"></i>Done</span>'
            '<span><i class="lg op"></i>No due date</span></div>')

# ---------- all projects (tabbed card, grouped by area) ----------
def prow(p):
    k, an, name, s, e, d, t, st, od = p
    prog = round(d / t * 100) if t else 0
    pc = pace(s, e)
    if t == 0:
        bar, val, pl = '<span class="t-meta">No tasks yet</span>', '', '<span class="t-meta">—</span>'
    else:
        mark = f'<b style="left:{pc}%"></b>' if pc is not None and st == 'active' else ''
        bar = f'<span class="prb"><i style="width:{prog}%"></i>{mark}</span>'
        val = f'{d} / {t}'
        if st == 'done':
            pl = '<span class="t-meta">Done</span>'
        elif pc is None:
            pl = '<span class="t-meta">No due date</span>'
        else:
            diff = prog - pc
            pl = ('<span class="t-meta">On pace</span>' if abs(diff) < 5 else
                  f'<span class="{"pos" if diff > 0 else "neg"}">{abs(diff)} pts {"ahead" if diff > 0 else "behind"}</span>')
    due = (f'Done {e:%b %-d}' if st == 'done' else f'{e:%b %-d} · {days_left(e)}') if e else 'No due date'
    dcls = ' neg' if e and st == 'active' and e < TODAY else ''
    odt = f'<span class="neg">{od} overdue</span>' if od else ''
    tip = f'{name}: {d} of {t} tasks done' + (f'; {pc}% of its time has passed' if pc is not None and st == 'active' else '')
    return (f'<div class="pjr {k}{" done" if st == "done" else ""}" data-tip="{tip}"><span class="pjn"><span class="mark sfold">{ic("folder")}</span>'
            f'<span class="pjt">{name}</span></span>{bar}<span class="pjv">{val}</span><span class="pjp">{pl}</span>'
            f'<span class="pjd{dcls}">{due}</span><span class="pjo">{odt}</span></div>')

def plist(projects, status='active'):
    out = '<div class="pjh"><span>Project</span><span>Progress · pace mark</span><span>Tasks</span><span>Pace</span><span>Due</span><span></span></div>'
    for k, n in AREAS:
        ps = [p for p in projects if p[0] == k and p[7] == status]
        if ps:
            out += f'<div class="pjg {k}"><span class="dot"></span><span class="t-label">{n}</span><span class="t-meta">{len(ps)}</span></div>'
            out += ''.join(prow(p) for p in ps)
    return out

def tabcard(body, counts):
    tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}{f"<span class=counter>{c}</span>" if c else ""}</span>'
                   for i, (t, c) in enumerate(zip(['Active', 'Finished', 'Archived'], counts)))
    return (f'<section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span></div></header>'
            f'<div class="sbody tbody">{body}</div></section>')

# ---------- right column ----------
def xr(k, an, name, note, right, danger=False):
    return (f'<div class="nar {k}"><span class="mark sfold">{ic("folder")}</span><div class="nab"><span class="lt">{name}</span>'
            f'<span class="t-meta"><span class="dot"></span>{an} · {note}</span></div>'
            f'<span class="tag neutral{" dz" if danger else ""}">{right}</span></div>')
attention = (xr('personal', 'Personal', 'Reading challenge', 'due Dec 15', '62 pts behind', True)
             + xr('career', 'Career', 'Hackathon prep', 'due Nov 20', '42 pts behind', True)
             + xr('career', 'Career', 'Resume &amp; portfolio', '1 task 10 days late', '1 overdue', True)
             + xr('career', 'Career', 'Life OS app', 'started Sep 1', 'No due date'))
wins = ('<div class="wr career"><span class="wi">' + ic('ok') + '</span><div class="wb"><span class="wn">Interview prep</span>'
        '<span class="t-meta">Finished Oct 30 · on time · 6 tasks</span></div><span class="wa"><span class="dot"></span>Career</span></div>')

def side_col(att, win):
    return (f'<aside class="pcol">{a2.card("Needs attention", "Behind pace, overdue tasks or no due date", att)}'
            f'{a2.card("Wins", "Projects finished in Q4", win)}</aside>')

normal = (a2.card('Timeline', 'Every project in Q4, by area', timeline(P))
          + f'<div class="psplit">{tabcard(plist(P), [7, 1, ""])}{side_col(attention, wins)}</div>')

# ---------- state: no projects ----------
first_run = f'''<div class="hero-empty">
  <div class="he-icon">{ic('folder')}</div>
  <h2>Start your first project</h2>
  <p class="t-body">A project is a piece of work with an end, like a portfolio or a room makeover.
  It lives in one life area and holds its own tasks, sections, events, routine steps and metrics.</p>
  <button class="btn primary big">{ic('plus')}New project</button>
  <p class="t-meta">Projects need a life area. You have 6.</p>
</div>'''

# ---------- state: projects, no tasks ----------
P2 = [('career', 'Career', 'Portfolio site', D(2026, 11, 12), None, 0, 0, 'active', 0),
      ('finance', 'Finance', 'Emergency fund', D(2026, 11, 13), D(2026, 12, 31), 0, 0, 'active', 0)]
no_data = (a2.card('Timeline', 'Every project in Q4, by area', timeline(P2))
           + f'<div class="psplit">{tabcard(plist(P2), [2, "", ""])}'
           + side_col(em.empty_line('Nothing needs attention.'), em.empty_line('No projects finished in Q4 yet.')) + '</div>')

# ---------- pop-up: new project ----------
area_opts = ''.join(f'<span class="opt{" on" if k == "career" else ""} {k}"><span class="dot"></span>{n}</span>' for k, n in AREAS)
modal = f'''<div class="scrim2"></div>
<div class="modal2" role="dialog" aria-label="New project">
  <div class="m-head"><h3>New project</h3><span class="icon-btn" style="margin:0">{ic('x')}</span></div>
  <div class="m-body">
    <label class="fld"><span class="fl2">Name</span>
      <span class="inp focus">Portfolio site<span class="caret"></span></span></label>
    <div class="fld"><span class="fl2">Life area</span><div class="opts">{area_opts}</div>
      <span class="hint2 t-meta">Everything in the project takes this area's color.</span></div>
    <div class="fld2">
      <label class="fld"><span class="fl2">Start <em>optional</em></span><span class="inp dt">{ic('cal')}Today</span></label>
      <label class="fld"><span class="fl2">Due <em>optional</em></span><span class="inp dt ph">{ic('cal')}No due date</span></label>
    </div>
    <span class="hint2 t-meta" style="margin-top:-10px">Without a due date the project has no pace mark.</span>
    <label class="fld"><span class="fl2">Notes <em>optional</em></span>
      <span class="inp area">What is this project for, and what does done look like?</span></label>
    <div class="prev"><span class="t-meta">Preview</span><div class="item career pv"><span class="mark sfold">{ic('folder')}</span>Portfolio site</div></div>
  </div>
  <div class="m-foot"><button class="btn">Cancel</button><button class="btn primary">Create project</button></div>
</div>'''

CSS = '''
.sfold{color:var(--a-solid);width:16px;height:16px;margin:0;display:grid;place-items:center;flex:none}
.sfold svg{width:14px;height:14px}
.side .item .mark.sfold{display:grid;place-items:center}
.lane .lnh .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid);margin-right:6px;flex:none}
.lane .lnh{display:flex;align-items:center}
.main .tlegend .sw{background:linear-gradient(to right,#94bbe5 60%,#e5edf9 60%)}
.main .tlegend .lg.dn{background:var(--n200)}
.main .tlegend .lg.op{background:linear-gradient(to right,#e5edf9 60%,transparent)}
.psplit{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
.pcol{display:flex;flex-direction:column;gap:16px}
.pjh,.pjr{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(160px,1fr) 56px 104px 150px 80px;align-items:center;gap:16px}
.pjh{height:28px;padding:0 8px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-tertiary);border-bottom:1px solid var(--border)}
.pjg{display:flex;align-items:center;gap:6px;height:32px;padding:8px 8px 0}
.pjg .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid)}
.pjr{height:36px;padding:0 8px;border-radius:var(--r-control);cursor:pointer}
.pjr:hover{background:var(--n100)}
.pjn{display:flex;align-items:center;gap:8px;min-width:0}
.pjt{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pjr .prb{height:6px}
.pjv{font-size:12px;font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.pjp,.pjd,.pjo{font-size:12px;white-space:nowrap;color:var(--text-secondary)}
.pjo{text-align:right}
.pjr .pos{color:#296c29;font-weight:500}.pjr .neg,.pjd.neg{color:var(--danger);font-weight:500}
.pjr.done .pjt{color:var(--text-tertiary)}
.nar{display:flex;align-items:center;gap:10px;min-height:44px}
.nab{display:flex;flex-direction:column;min-width:0;flex:1}
.nab .lt{font-size:13px;font-weight:500}
.nab .t-meta{display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden}
.nab .dot{width:6px;height:6px;border-radius:2px;background:var(--a-solid)}
.nar .tag{white-space:nowrap}
/* pop-up extras */
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500;cursor:pointer}
.opt .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid)}
.opt.on{border-color:var(--a-solid);background:var(--a-tint);color:var(--a-ink)}
.fld2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.inp.dt{gap:6px}.inp.dt svg{width:14px;height:14px;color:var(--text-tertiary)}
.inp.ph{color:var(--text-disabled)}
.prev .item.pv{display:flex;align-items:center;gap:8px}
/* states: normal (s-n), no projects (s-a), no tasks (s-b), pop-up (s-modal over normal) */
.st-n{display:none}
body.s-n .st-n,body.s-modal .st-n{display:flex}
body.s-modal .st-a{display:none}
'''

def page(cls, projects, head_disabled, body):
    return (f'<div class="app {cls}"><nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>'
            f'<a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>'
            f'<aside class="side">{sidebar(projects)}</aside><main class="main">{header(head_disabled)}'
            f'<div class="scroll wide">{body}</div></main></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Projects overview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{o2.CSS}{o3.CSS}{em.CSS}{CSS}</style></head>
<body class="s-n">
{page('st-n', P, False, normal)}
{page('st-a', [], True, first_run)}
{page('st-b', P2, False, no_data)}
{modal}
<div class="states"><span>Mock state</span><div class="seg" id="st">
  <span class="on" data-s="s-n">Projects</span><span data-s="s-a">No projects</span><span data-s="s-b">Projects, no tasks</span><span data-s="s-modal">New project pop-up</span></div></div>
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
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>')
Path('/mnt/user-data/outputs/draft-projects-overview.html').write_text(html)
print('ok', len(html))
