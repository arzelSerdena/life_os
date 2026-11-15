"""(v4: stat charts right of the number, one Next up card, projects board with group-by.)
Areas group > PROJECTS heading: the all-projects overview (draft v2), with mock states.

Approved card picks (Nov 14): execution stats on top (counted from tasks, not user-set metrics), the timeline,
Due next, Stalled projects, No next step, Finished in this period. No tables; presentation rules apply.
Mock states: Projects, No projects, Projects with no tasks, New project pop-up.
"""
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_empty as em  # noqa: E402  (also builds o3, a4, ...)
import rules as _rules  # noqa: E402
o3 = em.o3
a4, a2, bw, ic = o3.a4, o3.a2, o3.bw, o3.ic
D = date
TODAY = a4.TODAY

# key, area, project, start (created), due, done, total, status
P = [
    ('career', 'Career', 'Resume &amp; portfolio', D(2026, 10, 20), D(2026, 11, 30), 3, 5, 'active'),
    ('career', 'Career', 'Hackathon prep', D(2026, 11, 2), D(2026, 11, 20), 1, 4, 'active'),
    ('career', 'Career', 'Life OS app', D(2026, 9, 1), None, 8, 20, 'active'),
    ('career', 'Career', 'Interview prep', D(2026, 9, 28), D(2026, 10, 30), 6, 6, 'done'),
    ('finance', 'Finance', 'Emergency fund', D(2026, 10, 1), D(2026, 12, 31), 4, 11, 'active'),
    ('health', 'Health &amp; Beauty', '5K training', D(2026, 10, 25), D(2027, 1, 25), 9, 20, 'active'),
    ('personal', 'Personal', 'Reading challenge', D(2026, 9, 1), D(2026, 12, 15), 1, 12, 'active'),
    ('home', 'Home', 'Room makeover', D(2026, 10, 15), D(2027, 1, 23), 3, 10, 'active'),
]
P2 = [('career', 'Career', 'Portfolio site', D(2026, 11, 12), None, 0, 0, 'active'),
      ('finance', 'Finance', 'Emergency fund', D(2026, 11, 13), D(2026, 12, 31), 0, 0, 'active')]
AREAS = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'),
         ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]
def prog(p): return round(p[5] / p[6] * 100) if p[6] else 0
FOLD = lambda: f'<span class="mark sfold">{ic("folder")}</span>'

# ---------- shell ----------
def si(label, area, on=False, folder=False):
    lead = FOLD() if folder else '<span class="dot"></span>'
    return f'<div class="item{" on" if on else ""} {area}">{lead}{label}</div>'
def sidebar(projects):
    g = lambda name, add, items, on=False: (f'<div class="sgroup{" on" if on else ""}"><span class="sg-name">{name}</span><span style="flex:1"></span>'
                                           f'<span class="icon-btn sg-add" title="{add}">{ic("plus")}</span></div>' + items)
    rows = ''.join(si(p[2], p[0], False, True) for p in projects if p[7] == 'active')
    empty = '' if rows else '<p class="side-empty t-meta">No projects yet. Use + to add one.</p>'
    return (g('Life areas', 'New life area', ''.join(si(n, k) for k, n in AREAS)) + '<div class="side-divider"></div>'
            + g('Projects', 'New project', rows + empty, on=True)
            + f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>')
def header(disabled=False):
    d = ' disabled' if disabled else ''
    return f'''<div class="areahead">
  <div><div class="ttl" style="padding-left:0"><h1 class="t-page">Projects</h1></div></div>
  <div class="acts{d}">
    <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
    <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
    <button class="btn icon" title="More">{ic('more')}</button>
    <div class="split-btn accent"><button class="sb-main">{ic('plus')}New project</button></div>
  </div></div>'''
menu_icon = f'<span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span>'
def card(title, sub, body):
    return a2.card(title, sub, body).replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>', menu_icon)
eline = em.empty_line

# ---------- 1. execution stats (from project tasks), mini line charts in the metric-tile style ----------
def mini(vals, labels):
    W, H, P_ = 104, 32, 4
    lo, hi = min(vals), max(vals)
    pad = (hi - lo) * .2 or 1
    lo, hi = lo - pad, hi + pad
    X = lambda i: P_ + i * (W - 2 * P_) / (len(vals) - 1)
    Y = lambda v: H - P_ - (v - lo) / (hi - lo) * (H - 2 * P_)
    pts = [(X(i), Y(v)) for i, v in enumerate(vals)]
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i else pts[i]; p1, p2 = pts[i], pts[i + 1]; p3 = pts[i + 2] if i + 2 < len(pts) else p2
        d += (f' C{p1[0] + (p2[0] - p0[0]) / 6:.1f},{p1[1] + (p2[1] - p0[1]) / 6:.1f} '
              f'{p2[0] - (p3[0] - p1[0]) / 6:.1f},{p2[1] - (p3[1] - p1[1]) / 6:.1f} {p2[0]:.1f},{p2[1]:.1f}')
    hits = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" class="hitc" data-tip="{l}: {v:g}"/>' for (x, y), v, l in zip(pts, vals, labels))
    lx, ly = pts[-1]
    return (f'<svg class="mc mini" viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img">'
            f'<path d="{d} L{lx:.1f},{H} L{pts[0][0]:.1f},{H}Z" class="wash"/><path d="{d}" class="ln"/>{hits}'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3.5" class="end"/></svg>')
WK = ['Week of Sep 28', 'Week of Oct 5', 'Week of Oct 12', 'Week of Oct 19', 'Week of Oct 26', 'Week of Nov 2', 'This week']
def stile(label, value, unit='', note='', vals=None, good=None):
    lc = '#328f32' if good else '#cc363c'
    chart = mini(vals, WK[-len(vals):]) if vals else ''
    return (f'<div class="tile stile" style="--lc:{lc}"><span class="tl">{label}</span>'
            f'<div class="tv"><span class="num">{value}</span><span class="unit">{unit}</span>{chart}</div>'
            f'<span class="t-meta">{note}</span></div>')
tiles = ''.join([
    stile('Tasks done', '31', '', '+6 vs Q3', [3, 4, 2, 5, 4, 6, 7], True),
    stile('On time', '74', '%', '−5 pts vs Q3', [82, 80, 79, 76, 74, 72, 70], False),
    stile('Overdue now', '3', '', 'in 2 projects', [1, 1, 2, 2, 3, 2, 3], False),
    stile('Rollovers', '1.4', '/ task', '−0.3 vs Q3', [1.9, 1.8, 1.6, 1.5, 1.4, 1.3, 1.4], True),
    stile('Open tasks', '39', '', 'in 6 projects', [30, 33, 35, 36, 38, 40, 39], False),
    stile('Projects finished', '1', '', '1 on time', [0, 0, 0, 0, 1, 1, 1], True),
])
tiles0 = ''.join([stile('Tasks done', '0', '', 'in Q4'), stile('On time', '—', '', 'no tasks due yet'),
                  stile('Overdue now', '0'), stile('Rollovers', '—', '', 'no tasks yet'),
                  stile('Open tasks', '0'), stile('Projects finished', '0', '', 'in Q4')])

# ---------- 2. timeline ----------
def timeline(projects):
    lanes = ''
    for k, n in AREAS:
        ps = [p for p in projects if p[0] == k]
        if not ps: continue
        rows = ''
        for p in ps:
            _, _, name, s, e, d, t, st = p
            end = e or a4.END
            if st == 'done':
                b = a4.bar(name, s, end, prog=100, done=True, tip=f'{name} · done {e:%b %-d}')
            elif e is None:
                b = a4.bar(name, s, end, prog=prog(p), open_end=True, tip=f'{name} · started {s:%b %-d} · no due date · {prog(p)}%')
            else:
                b = a4.bar(name, s, end, prog=prog(p), tip=f'{name} · {s:%b %-d} – {e:%b %-d} · {prog(p)}%')
            rows += f'<div class="trow">{b}</div>'
        lanes += a4.lane(f'<span class="dot"></span>{n}', rows, len(ps)).replace('<div class="lane"', f'<div class="lane {k}"', 1)
    return (f'<div class="tl">{a4.tl_axis()}<div class="tl-body"><div class="tl-grid">{a4.grid_lines}</div>'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {a4.pct(TODAY)/100:.4f})"><span>Today</span></div>'
            f'{lanes}</div></div>')

# ---------- compact rows (no area tags: the folder color shows the area) ----------
bw.I.setdefault('calplus', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/>')
def qa(icon, label):
    return f'<button class="qbtn">{ic(icon)}{label}</button>'
def crow(k, name, meta, lead=None, action=None):
    return (f'<div class="crow {k}">{lead or FOLD()}<div class="lrb"><span class="lrt">{name}</span>'
            f'<span class="t-meta">{meta}</span></div>{action or ""}</div>')
def dleft(n): return f'<span class="dbadge{" soon" if n <= 7 else ""}">{n}d</span>' + FOLD()
def sec(label, n, rows):
    return f'<div class="csec"><div class="csh"><span class="t-label">{label}</span><span class="counter">{n}</span></div>{rows}</div>'
look = (sec('Due next', 3,
            crow('career', 'Hackathon prep', 'Nov 20 · 3 open', dleft(6))
            + crow('career', 'Resume &amp; portfolio', 'Nov 30 · 2 open · <span class="neg">1 overdue</span>', dleft(16))
            + crow('personal', 'Reading challenge', 'Dec 15 · 11 open · <span class="neg">2 overdue</span>', dleft(31)))
        + sec('Stalled', 2,
            crow('personal', 'Reading challenge', 'Nothing done for 25 days', None, qa('calplus', 'Plan task'))
            + crow('home', 'Room makeover', 'Nothing done for 14 days', None, qa('calplus', 'Plan task')))
        + sec('No next step', 2,
            crow('career', 'Life OS app', '12 open, none scheduled', None, qa('calplus', 'Schedule'))
            + crow('finance', 'Emergency fund', '7 open, none scheduled', None, qa('calplus', 'Schedule'))))
look0 = (sec('Due next', 1, crow('finance', 'Emergency fund', 'Dec 31', dleft(47)))
         + sec('No next step', 2, crow('career', 'Portfolio site', 'No tasks yet', None, qa('plus', 'Add task'))
                                  + crow('finance', 'Emergency fund', 'No tasks yet', None, qa('plus', 'Add task'))))

# ---------- board of all projects, with a group-by switch ----------
def pace(p): return None if p[4] is None or p[7] != 'active' else max(0, min(100, round((TODAY - p[3]).days / (p[4] - p[3]).days * 100)))
def pstatus(p):
    if p[7] == 'done': return 'done'
    pc = pace(p)
    if pc is None: return 'nodue'
    d = prog(p) - pc
    return 'on' if abs(d) < 5 else ('ahead' if d > 0 else 'behind')
def bcard(p):
    k, an, name, s_, e, d, t, st = p
    pc, ps = pace(p), pstatus(p)
    mark = ''  # pace is not shown on the board
    if st == 'done': due = f'Done {e:%b %-d}'
    elif e is None: due = 'No due date'
    else: due = f'Due {e:%b %-d} · {(e - TODAY).days}d'
    if t == 0: val, line = '', ''
    else:
        val = f'{d} / {t}'
        dd = prog(p) - (pc or 0)
        line = ''
    return (f'<div class="card pcard {k}{" done" if st == "done" else ""}"><span class="mark">{ic("folder")}</span><div class="body">'
            f'<span class="t-card">{name}</span><span class="bar"><i style="width:{100 if st == "done" else prog(p)}%"></i>{mark}</span>'
            f'<div class="meta-row"><span class="t-meta">{due}</span><span class="pct">{val}</span></div>'
            + (f'<div class="meta-row">{line}</div>' if line else '') + '</div></div>')
def board(projects):
    def cols(groups):
        out = ''
        for title, ps in groups:
            if not ps: continue
            out += (f'<div class="bcol"><div class="colh"><span class="t-col">{title}</span><span class="counter">{len(ps)}</span></div>'
                    f'<div class="colb">{"".join(bcard(p) for p in ps)}</div></div>')
        return f'<div class="pboard">{out}</div>'
    by_area = [(f'<span class="cdot {k}"></span>{n}', [p for p in projects if p[0] == k]) for k, n in AREAS]
    by_pace = [(n, sorted([p for p in projects if pstatus(p) == key], key=lambda p: prog(p) - (pace(p) or 0))) for key, n in
               [('behind', 'Behind pace'), ('on', 'On pace'), ('ahead', 'Ahead'), ('nodue', 'No due date'), ('done', 'Finished')]]
    def bucket(p):
        if p[7] == 'done': return 'Finished'
        if p[4] is None: return 'No due date'
        if p[4] < D(2026, 12, 1): return 'This month'
        if p[4] < D(2027, 1, 1): return 'Next month'
        return 'Later'
    by_due = [(n, [p for p in projects if bucket(p) == n]) for n in ['This month', 'Next month', 'Later', 'No due date', 'Finished']]
    return (f'<div class="gb gb-area">{cols(by_area)}</div><div class="gb gb-pace">{cols(by_pace)}</div>'
            f'<div class="gb gb-due">{cols(by_due)}</div>')
CHK = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
def mi(label, on=False, attr=''):
    return f'<div class="mi{" on" if on else ""}"{attr}>{label}{CHK if on else ""}</div>'
board_menu = ('<div class="menu bmenu"><div class="mh t-label">Group by</div>'
              + mi('Area', True, ' data-g="area"') + mi('Pace', False, ' data-g="pace"') + mi('Due date', False, ' data-g="due"')
              + '<div class="msep"></div><div class="mh t-label">Sort by</div>'
              + mi('Due date', True) + mi('Progress') + mi('Name')
              + '<div class="msep"></div>'
              + f'<div class="mi"><span class="mini-check on">{CHK}</span>Show finished projects</div></div>')
def board_card(projects, sub):
    return _board_card(card('Projects', sub, board(projects)))
def _board_card(c):
    i = c.index('<span class="icon-btn cmenu"')
    j = c.index('</span>', c.index('</svg>', i)) + len('</span>')
    btn = c[i:j].replace('title="Sort and filter"', 'title="Group, sort and filter"').replace('class="icon-btn cmenu"', 'class="icon-btn cmenu bm"')
    return c[:i] + f'<span class="cmwrap">{btn}{board_menu}</span>' + c[j:]

def page_body(stat_tiles, projects, lk, lk_sub, tl_sub, b_sub):
    return (f'<div class="kpis">{stat_tiles}</div>'
            + '<div class="tlsplit">' + card('Timeline', tl_sub, timeline(projects)) + card('Next up', lk_sub, lk) + '</div>'
            + board_card(projects, b_sub))

normal = page_body(tiles, P, look, '3 due soon · 2 stalled · 2 with no next step',
                   '7 active projects in 5 areas · 1 finished in Q4', '7 active · 1 finished in Q4')
no_data = page_body(tiles0, P2, look0, '1 due in Q4 · 2 without tasks', '2 active projects in 2 areas', '2 active')
first_run = f'''<div class="hero-empty">
  <div class="he-icon">{ic('folder')}</div>
  <h2>Start your first project</h2>
  <p class="t-body">A project is a piece of work with an end, like a portfolio or a room makeover.
  It lives in one life area and holds its own tasks, sections, events, routine steps and metrics.</p>
  <button class="btn primary big">{ic('plus')}New project</button>
</div>'''

# ---------- pop-up ----------
area_opts = ''.join(f'<span class="opt{" on" if k == "career" else ""} {k}"><span class="dot"></span>{n}</span>' for k, n in AREAS)
modal = f'''<div class="scrim2"></div>
<div class="modal2" role="dialog" aria-label="New project">
  <div class="m-head"><h3>New project</h3><span class="icon-btn" style="margin:0">{ic('x')}</span></div>
  <div class="m-body">
    <label class="fld"><span class="fl2">Name</span><span class="inp focus">Portfolio site<span class="caret"></span></span></label>
    <div class="fld"><span class="fl2">Life area</span><div class="opts">{area_opts}</div></div>
    <div class="fld2">
      <label class="fld"><span class="fl2">Start <em>optional</em></span><span class="inp dt">{ic('cal')}Today</span></label>
      <label class="fld"><span class="fl2">Due <em>optional</em></span><span class="inp dt ph">{ic('cal')}No due date</span></label></div>
    <label class="fld"><span class="fl2">Notes <em>optional · Markdown</em></span><span class="inp area"></span></label>
    <div class="prev"><span class="t-meta">Preview</span><div class="item career pv">{FOLD()}Portfolio site</div></div>
  </div>
  <div class="m-foot"><button class="btn">Cancel</button><button class="btn primary">Create project</button></div>
</div>'''

CSS = '''
.sfold{color:var(--a-solid);width:16px;height:16px;margin:0;display:grid;place-items:center;flex:none}
.sfold svg{width:14px;height:14px}
.side .item .mark.sfold{display:grid;place-items:center}
.lane .lnh .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid);margin-right:6px;flex:none}
.lane .lnh{display:flex;align-items:center}
.kpis{margin-bottom:0}
/* due next */
.dngrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dncard{border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;background:#fff}
.dn-top{display:flex;align-items:baseline;gap:4px;margin-bottom:4px}
.dn-num{font-size:24px;line-height:32px;font-weight:600}
.dn-u{font-size:13px;color:var(--text-secondary)}
.dn-date{margin-left:auto}
.dn-name{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;line-height:20px}
.dn-area{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-tertiary);padding-left:24px}
.dncard>.t-meta{padding-left:24px}
.dn-area .dot,.lrow .dot{width:6px;height:6px;border-radius:2px;background:var(--a-solid)}
.dn-next{display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:13px}
.dn-next .check{margin:0;width:14px;height:14px}
.neg{color:var(--danger);font-weight:500}
/* lists */
.lrow{display:flex;align-items:center;gap:10px;min-height:44px}
.lrb{display:flex;flex-direction:column;min-width:0;flex:1}
.lrb .lrt{font-size:13px;font-weight:500}
.lrb .t-meta{display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn.ghost.sm{height:28px;padding:0 8px;font-size:12px;white-space:nowrap}
.lrow .wi{color:#328f32;display:grid;place-items:center;width:16px}
.lrow .wi svg{width:16px;height:16px}
/* pop-up */
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500}
.opt .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid)}
.opt.on{border-color:var(--a-solid);background:var(--a-tint);color:var(--a-ink)}
.fld2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.inp.dt{gap:6px}.inp.dt svg{width:14px;height:14px;color:var(--text-tertiary)}
.inp.ph{color:var(--text-disabled)}
.prev .item.pv{display:flex;align-items:center;gap:8px}
/* v3: mini charts, compact cards, layout */
.stile .tv{display:flex;align-items:flex-end;gap:2px}
.stile .mc.mini{width:104px;height:32px;margin-left:auto;display:block;overflow:visible}
.tlsplit{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:stretch}
.rcol{display:flex;flex-direction:column;gap:16px}
.row2b{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.crow{display:flex;align-items:center;gap:10px;min-height:40px}
.crow .lrb{display:flex;flex-direction:column;min-width:0;flex:1}
.crow .lrt{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crow .t-meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dbadge{flex:none;min-width:36px;height:22px;padding:0 6px;border-radius:6px;background:var(--n100);font-size:12px;font-weight:600;
  display:grid;place-items:center;font-variant-numeric:tabular-nums}
.dbadge.soon{background:#fce4e5;color:#a5282d}
.icon-btn.qa{flex:none;color:var(--text-tertiary)}
.icon-btn.qa:hover{color:var(--text-primary)}
.crow .wi{color:#328f32;display:grid;place-items:center;width:16px}
.crow .wi svg{width:16px;height:16px}
.qbtn{flex:none;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;
  background:#f8f7fb;border:1px solid #bbafd6;color:#7e61a0;font:500 12px/1 Inter,sans-serif;cursor:pointer;white-space:nowrap}
.qbtn:hover{background:#f1f0f7}
.qbtn svg{width:14px;height:14px}
.csec+.csec{margin-top:8px;padding-top:8px;border-top:1px solid var(--border)}
.csh{display:flex;align-items:center;gap:6px;height:24px}
.pboard{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
.colh{display:flex;align-items:center;gap:8px;height:28px;margin-bottom:6px}
.t-col{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.cdot{width:10px;height:10px;border-radius:2px;background:var(--a-solid)}
.colb{display:flex;flex-direction:column;gap:8px}
.pcard{background:#fff}
.pcard .bar{position:relative;overflow:visible}
.pcard .bar b{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:var(--n900);border-radius:1px}
.pcard .pos{font-size:12px;color:#296c29;font-weight:500}.pcard .neg{font-size:12px}
.cmwrap{position:relative;display:inline-flex}
.bmenu{display:none;width:220px;text-align:left}
body.m-open .bmenu,body.s-menu .st-n .bmenu{display:block}
body.m-open .icon-btn.bm,body.s-menu .icon-btn.bm{background:var(--n100);color:var(--text-primary)}
.bmenu .mi{cursor:pointer}
.bmenu .mini-check.on{background:#8f74b3;border-color:#8f74b3}
.gb{display:none}.gb.gb-area{display:block}
body.g-pace .gb{display:none}body.g-pace .gb-pace{display:block}
body.g-due .gb{display:none}body.g-due .gb-due{display:block}
/* states */
.st-n, .st-a, .st-b{display:none}
body.s-n .st-n,body.s-modal .st-n,body.s-menu .st-n,body.s-a .st-a,body.s-b .st-b{display:flex}
.st-a .scroll{display:flex}
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
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{o3.ov.CSS}{o3.o2.CSS}{o3.CSS}{em.CSS}{CSS}</style></head>
<body class="s-n">
{page('st-n', P, False, normal)}
{page('st-a', [], True, first_run)}
{page('st-b', P2, False, no_data)}
{modal}
<div class="states"><span>Mock state</span><div class="seg" id="st">
  <span class="on" data-s="s-n">Projects</span><span data-s="s-a">No projects</span><span data-s="s-b">Projects, no tasks</span><span data-s="s-menu">Board menu</span><span data-s="s-modal">New project pop-up</span></div></div>
<div id="tip"></div>
<script>
const st=document.getElementById('st');
st.onclick=e=>{{const s=e.target.dataset.s;if(!s)return;document.body.classList.remove('s-n','s-a','s-b','s-modal','s-menu');document.body.classList.add(s);
  st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===e.target));}};
const CHK='<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
document.querySelectorAll('.icon-btn.bm').forEach(b=>b.onclick=e=>{{e.stopPropagation();document.body.classList.toggle('m-open');}});
document.addEventListener('click',e=>{{if(!e.target.closest('.bmenu'))document.body.classList.remove('m-open');}});
document.querySelectorAll('.bmenu [data-g]').forEach(m=>m.onclick=()=>{{const v=m.dataset.g;
  document.body.classList.remove('g-area','g-pace','g-due');document.body.classList.add('g-'+v);
  document.querySelectorAll('.bmenu [data-g]').forEach(x=>{{const on=x.dataset.g===v;x.classList.toggle('on',on);
    x.innerHTML=x.textContent+(on?CHK:'');}});}});
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){{tip.style.display='none';return}}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';}});
</script>
</body></html>'''
html = html.replace('.st-a,.st-b{display:none}', '')
html = _rules.apply(html)
Path('/mnt/user-data/outputs/approved-projects-overview.html').write_text(html)
print('ok', len(html))
