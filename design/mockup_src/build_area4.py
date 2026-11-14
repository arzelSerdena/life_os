"""Areas > Career, v3: KPI tiles, timeline, slim projects table, docked agenda panel."""
import sys
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_area2 as a2  # noqa: E402
bw, ic = a2.bw, a2.ic
bw.I.update({'diamond': '<path d="M12 3 21 12 12 21 3 12z"/>', 'collapse': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18M10 9l-3 3 3 3"/>'})

POS, NEG = '#328f32', '#cc363c'

# ---------- sidebar: group header doubles as "All areas", + to add ----------
def _si(label, area, count, on=False):
    return f'<div class="item{" on" if on else ""} {area}"><span class="dot"></span>{label}</div>'
a2.sidebar = (
    f'<div class="sgroup" title="All areas"><span class="sg-name">Life areas</span><span style="flex:1"></span>'
    f'<span class="icon-btn sg-add" title="New life area">{ic("plus")}</span></div>'
    + _si('Career', 'career', 9, on=True) + _si('Finance', 'finance', 4) + _si('Health &amp; Beauty', 'health', 6)
    + _si('Personal', 'personal', 3) + _si('Relationships', 'relation', 2) + _si('Home', 'home', 5)
    + '<div class="grow"></div><div class="side-divider"></div>'
    + f'<div class="item">{ic("archive")}Archived areas</div>')


# ---------- KPI tiles with good/bad colored sparklines ----------
def spark(vals, color, w=64, h=24):
    lo, hi = min(vals), max(vals)
    rng = (hi - lo) or 1
    pts = [(2 + i * (w - 6) / (len(vals) - 1), h - 4 - (v - lo) / rng * (h - 8)) for i, v in enumerate(vals)]
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    lx, ly = pts[-1]
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path d="{d}" fill="none" stroke="{color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3.5" fill="{color}" stroke="#fff" stroke-width="2"/></svg>')

def tile(label, value, unit='', delta=None, good=None, note=None, trend=None):
    color = POS if good else NEG
    d = ''
    if delta:
        cls = 'good' if good is True else 'bad' if good is False else ''
        arrow = ic('up') if delta.startswith('+') else ic('down') if delta.startswith('−') else ''
        d = f'<span class="delta {cls}">{arrow}{delta}</span>'
    n = f'<span class="t-meta">{note}</span>' if note else ''
    t = spark(trend, color) if trend else ''
    return (f'<div class="tile"><span class="tl">{label}</span><div class="tv"><span class="num">{value}</span>'
            f'<span class="unit">{unit}</span>{t}</div><div class="td">{d}{n}</div></div>')

tiles = ''.join([
  tile('Open tasks', '9', delta='1 overdue', good=False, note='2 high'),
  tile('Completed', '46', delta='+8', good=True, note='vs Q3', trend=[3,5,4,6,2,5,7,6,4,8,5,7]),
  tile('On time', '78', '%', delta='−6 pts', good=False, note='vs Q3', trend=[90,85,88,86,84,78]),
  tile('Rollovers', '1.4', '/ task', note='this quarter'),
  tile('Routine steps done', '86', '%', delta='+4 pts', good=True, note='vs Q3', trend=[70,75,80,78,82,86]),
  tile('Active projects', '3', note='1 done this quarter'),
])

# ---------- timeline ----------
START, END, TODAY = date(2026, 10, 1), date(2027, 1, 1), date(2026, 11, 14)
DAYS = (END - START).days
def pct(d):
    return max(0.0, min(100.0, (d - START).days / DAYS * 100))

def tl_axis():
    ticks, d = [], START
    while d <= END:
        if d.weekday() == 0:
            ticks.append(f'<span class="wk" style="left:{pct(d):.2f}%">{d.day}</span>')
        d += timedelta(days=1)
    months, m = [], date(2026, 10, 1)
    while m <= END:
        nxt = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
        a, b = max(m, START), min(nxt, END)
        if pct(b) > pct(a): months.append(f'<span class="mo" style="left:{pct(a):.2f}%;width:{pct(b)-pct(a):.2f}%">{m.strftime("%B")}</span>')
        m = nxt
    return f'<div class="tl-axis"><div class="mos">{"".join(months)}</div><div class="wks">{"".join(ticks)}</div></div>'

def bar(label, s, e, prog=None, done=False, open_end=False, tip=''):
    l, r = pct(s), pct(e)
    cls = 'tbar' + (' done' if done else '') + (' open' if open_end else '')
    fill = f'<i style="width:{prog}%"></i>' if prog is not None else ''
    p = f'<span class="tp">{prog}%</span>' if prog is not None and not done else ''
    return (f'<div class="{cls}" style="left:{l:.2f}%;width:{r-l:.2f}%" data-tip="{tip}">{fill}'
            f'<span class="tb-l">{label}</span>{p}</div>')

def point(label, d, kind='event', tip='', missed=False):
    mk = f'<span class="ev-icon">{ic("cal")}</span>' if kind == 'event' else f'<span class="dia{" missed" if missed else ""}">{ic("diamond")}</span>'
    flip = ' flip' if pct(d) > 85 else ''
    return f'<div class="tpt {kind}{flip}" style="left:{pct(d):.2f}%" data-tip="{tip}">{mk}<span class="tpl">{label}</span></div>'

def lane(name, items, h=1):
    return f'<div class="lane" style="--rows:{h}"><div class="ln"><span class="lnh">{ic("chev")}{name}</span></div><div class="lt2">{items}</div></div>'

proj_rows = ''.join(f'<div class="trow">{b}</div>' for b in [
    bar('Life OS app', date(2026, 9, 1), END, prog=40, open_end=True, tip='Life OS app · started Sep 1 · no due date · 40%'),
    bar('Interview prep', date(2026, 9, 28), date(2026, 10, 30), prog=100, done=True, tip='Interview prep · done Oct 30'),
    bar('Resume &amp; portfolio', date(2026, 10, 20), date(2026, 11, 30), prog=60, tip='Resume &amp; portfolio · Oct 20 – Nov 30 · 60%'),
    bar('Hackathon prep', date(2026, 11, 2), date(2026, 11, 20), prog=25, tip='Hackathon prep · Nov 2 – Nov 20 · 25%'),
])
event_row = ('<div class="trow">'
    + point('Mock interview', date(2026, 11, 20), tip='Mock interview with Ana · Fri, Nov 20 · 2:00 PM')
    + '</div><div class="trow">'
    + bar('Hackathon weekend', date(2026, 11, 13), date(2026, 11, 16), tip='Hackathon weekend · Nov 13 – 15').replace('tbar', 'tbar ev')
    + point('Career fair', date(2026, 12, 5), tip='Career fair · Sat, Dec 5 · All day')
    + '</div>')
def seg(s_, e_, state, fill=None, tip=''):
    l, r = pct(s_), pct(e_)
    f = f'<i style="width:{fill}%"></i>' if fill is not None else ''
    return f'<div class="mseg {state}" style="left:calc({l:.2f}% + 1px);width:calc({r-l:.2f}% - 2px)" data-tip="{tip}">{f}</div>'

def mrow(*parts):
    return '<div class="trow">' + ''.join(parts) + '</div>'

weeks_ = []
d0 = date(2026, 9, 28)
import random as _rr
_rr.seed(11)
while d0 < END:
    e0 = d0 + timedelta(days=7)
    if e0 <= TODAY:
        ok = _rr.random() < .65
        weeks_.append(seg(max(d0, START), e0, 'met' if ok else 'miss', tip=f'Week of {d0:%b %-d}: {"met" if ok else "missed"} (10 h)'))
    elif d0 <= TODAY:
        weeks_.append(seg(d0, e0, 'cur', 60, tip=f'This week: 6 / 10 h'))
    else:
        weeks_.append(seg(d0, e0, 'up', tip=f'Week of {d0:%b %-d}: upcoming'))
    d0 = e0

import random as _rr
_rr.seed(11)
def periods(kind, s_, e_, goal):
    """Segments for a per-period target active from s_ to e_ (exclusive)."""
    out, d0 = [], s_
    while d0 < e_:
        if kind == 'week':
            e0 = d0 + timedelta(days=7)
        else:
            e0 = date(d0.year + (d0.month == 12), d0.month % 12 + 1, 1)
        e0 = min(e0, e_)
        lab = f'Week of {d0:%b %-d}' if kind == 'week' else f'{d0:%B}'
        if e0 <= TODAY:
            ok = _rr.random() < .7
            if ok:
                out.append(seg(max(d0, START), e0, 'met', tip=f'{lab}: met ({goal})'))
            else:
                p_ = _rr.choice([40, 50, 60, 70, 80])
                out.append(seg(max(d0, START), e0, 'cur', p_, tip=f'{lab}: not met, reached {p_}% ({goal})'))
        elif d0 <= TODAY:
            out.append(seg(d0, e0, 'cur', 60 if kind == 'week' else 20, tip=f'{lab}: in progress ({goal})'))
        else:
            out.append(seg(d0, e0, 'up', tip=f'{lab}: upcoming ({goal})'))
        d0 = e0
    return ''.join(out)

metric_rows = (
    mrow(periods('month', date(2026, 10, 1), END, '5 applications per month'))
  + mrow(periods('week', date(2026, 9, 28), date(2026, 10, 26), '8 h per week') + periods('week', date(2026, 10, 26), END, '10 h per week'))
  + mrow(seg(date(2026, 10, 1), date(2026, 12, 31), 'reach', 50, tip='Reach 4 by Dec 31 · now 2 / 4'), point('', date(2026, 12, 31), 'target', 'Deadline: Dec 31'))
  + mrow('<div class="notarget" data-tip="No target set"><span>No target</span></div>')
)
metric_names = ''.join(f'<div class="mname">{ic("stats")}<span>{n}</span></div>' for n in
    ['Job applications', 'Study hours', 'Portfolio pieces', 'LinkedIn followers'])
metrics_lane = (f'<div class="lane mlane"><div class="ln"><div class="lnt"><span class="lnh">{ic("chev")}Metrics</span></div>{metric_names}</div>'
                f'<div class="lt2"><div class="mspacer"></div>{metric_rows}</div></div>')


grid_lines = ''.join(f'<i style="left:{pct(START + timedelta(days=k)):.2f}%"></i>' for k in range((7 - START.weekday()) % 7, DAYS, 7))
timeline = (f'<div class="tl">{tl_axis()}<div class="tl-body"><div class="tl-grid">{grid_lines}</div>'
            f'<div class="today" style="left:calc(140px + (100% - 140px) * {pct(TODAY)/100:.4f})"><span>Today</span></div>'
            + lane('Projects', proj_rows, 4) + lane('Events', event_row, 2) + metrics_lane + '</div></div>')

# ---------- projects table (slim) ----------
def ptable():
    rows = [('Resume &amp; portfolio', 60, 'Nov 30', 'in 16 days', ''),
            ('Hackathon prep', 25, 'Nov 20', 'in 6 days', ''),
            ('Life OS app', 40, '—', '', ''),
            ('Interview prep', 100, 'Oct 30', 'done', 'done')]
    body = ''.join(
        f'<tr class="{c}"><td><span class="pn2">{ic("folder", "pi")}{n}</span></td>'
        f'<td><div class="pbar"><span class="bar"><i style="width:{p}%"></i></span><span class="pv">{p}%</span></div></td>'
        f'<td class="n">{d} <span class="t-meta">{rel}</span></td></tr>' for n, p, d, rel, c in rows)
    return ('<table class="dt"><thead><tr><th>Project</th><th style="width:55%">Progress</th><th class="n">Due</th></tr></thead>'
            f'<tbody>{body}</tbody></table>')

# ---------- agenda panel ----------
def arow(kind, title, meta='', pr=None, state='todo'):
    if kind == 'event':
        mk = f'<span class="ev-icon">{ic("cal")}</span>'
    elif kind == 'step':
        mk = f'<span class="check round{" done" if state == "done" else ""}"></span>'
    else:
        mk = f'<span class="check{" done" if state == "done" else ""}"></span>'
    f = ic('flag', 'flag-high' if pr == 'high' else 'flag-med') if pr else ''
    cls = 'arow' + (' done' if state == 'done' else '') + (' ev' if kind == 'event' else '')
    return f'<div class="{cls}">{mk}<div class="ab"><span class="at">{title}</span><span class="t-meta am">{f}{meta}</span></div></div>'

def aday(label, sub, rows, danger=False, today=False):
    return (f'<div class="aday{" danger" if danger else ""}{" isday" if today else ""}"><div class="adh"><span class="t-label">{label}</span>'
            + (f'<span class="counter">{sub}</span>' if sub.isdigit() else f'<span class="t-meta">{sub}</span>') + f'</div>{"".join(rows)}</div>')

agenda = (
    aday('Overdue', '1', [arow('task', 'Update resume', '<span class="overdue">Nov 4</span> · Resume &amp; portfolio', 'high')], danger=True)
  + aday('Today', 'Sat, Nov 14', [
        arow('event', 'Hackathon weekend', 'All day · day 2 of 3'),
        arow('task', 'Draft the hackathon pitch', 'Hackathon prep', 'med'),
        ], today=True)
  + aday('Tomorrow', 'Sun, Nov 15', [
        arow('event', 'Hackathon weekend ends', '3:00 PM'),
        arow('task', 'Submit hackathon registration', 'Due · Hackathon prep', 'high')])
  + aday('Wed', 'Nov 18', [arow('task', 'Write week board tests', 'Due · Life OS app')])
  + aday('Fri', 'Nov 20', [arow('event', 'Mock interview with Ana', '2:00 PM'),
                           arow('task', 'Prepare mock interview answers', 'Due'),
                           arow('task', 'Hackathon prep', 'Project due')]).replace('<span class="check"></span><div class="ab"><span class="at">Hackathon prep', f'<span class="mark pmk">{ic("folder")}</span><div class="ab"><span class="at">Hackathon prep')
  + aday('Mon', 'Nov 30', [arow('task', 'Resume &amp; portfolio', 'Project due')]).replace('<span class="check"></span><div class="ab"><span class="at">Resume', f'<span class="mark pmk">{ic("folder")}</span><div class="ab"><span class="at">Resume')
  + aday('Thu', 'Dec 3', [arow('task', 'Ask Prof. Reyes for a reference', 'Due')])
  + aday('Sat', 'Dec 5', [arow('event', 'Career fair', 'All day')])
  + aday('Thu', 'Dec 10', [arow('task', 'Update LinkedIn profile', 'Due · Resume &amp; portfolio')])
  + aday('Thu', 'Dec 31', [f'<div class="arow"><span class="mark pmk dia">{ic("diamond")}</span><div class="ab"><span class="at">Portfolio pieces: 4</span><span class="t-meta am">Target deadline · 2 / 4 now</span></div></div>'])
)
agenda_panel = (f'<aside class="agenda"><header class="ag-head"><span class="stitle">Agenda</span>'
                f'<span class="t-meta">Today – Dec 31</span>'
                f'</header>'
                f'<div class="ag-body">{agenda}</div></aside>')


# ---------- project cards (board card design) ----------
def pcards():
    rows = [('Resume &amp; portfolio', 60, 'Due Nov 30 · in 16 days', '3 / 5', ''),
            ('Hackathon prep', 25, 'Due Nov 20 · in 6 days', '1 / 4', ''),
            ('Life OS app', 40, 'No due date', '8 / 20', ''),
            ('Interview prep', 100, 'Done Oct 30', '6 / 6', 'done')]
    cards = ''.join(
        f'<div class="card pcard {c}"><span class="mark">{ic("folder")}</span><div class="body">'
        f'<span class="t-card">{n}</span><span class="bar"><i style="width:{p}%"></i></span>'
        f'<div class="meta-row"><span class="t-meta">{d}</span><span class="pct">{v}</span></div></div></div>'
        for n, p, d, v, c in rows)
    return f'<div class="pgrid">{cards}</div>'

# ---------- routines: one heatmap row per step ----------
import random as _r
QDAYS = 92
TODAY_I = (TODAY - START).days
def hrow(name, seed, rate, streak, sched='daily', starts=0, paused=(), note=''):
    _r.seed(seed)
    cells = []
    for i in range(QDAYS):
        d = START + timedelta(days=i)
        due = (sched == 'daily') or (d.weekday() == 6)
        if i < starts or not due:
            cells.append('<i class="n"></i>'); continue
        if i > TODAY_I:
            cells.append(f'<i class="f" data-tip="{d:%a, %b %-d}: upcoming"></i>'); continue
        if i in paused:
            cells.append(f'<i class="p" data-tip="{d:%b %-d}: paused"></i>'); continue
        if i == TODAY_I:
            cells.append(f'<i class="t" data-tip="{d:%b %-d}: to do"></i>'); continue
        x = _r.random()
        st = 'd' if x < rate / 100 else ('s' if x < rate / 100 + .05 else 'm')
        lbl = {'d': 'done', 's': 'skipped', 'm': 'missed'}[st]
        cells.append(f'<i class="{st}" data-tip="{name}: {d:%a, %b %-d}, {lbl}"></i>')
    n = f'<span class="t-meta">{note}</span>' if note else ''
    return (f'<div class="hrow"><span class="hn"><span class="hname">{name}</span>{n}</span><div class="hcells">{"".join(cells)}</div>'
            f'</div>')

def hgroup(name, sched, others):
    return (f'<div class="hgroup"><span class="hn"><span class="t-label">{name}</span><span class="t-meta">{sched}</span></span>'
            f'<span class="t-meta hother">{others}</span></div>')

def rcards():
    months = ''.join(f'<span style="left:{(date(2026, m, 1) - START).days / QDAYS * 100:.2f}%">{date(2026, m, 1):%B}</span>' for m in (10, 11, 12))
    head = (f'<div class="hrow hhead"><span class="hn"></span><div class="hmonths">{months}'
            f'</div></div>')
    pause = range(18, 22)
    rows = (hgroup('Evening routine', 'Daily', '3 of its 5 steps are in Career')
        + hrow('Practice LeetCode 30 min', 1, 91, 6, paused=pause)
        + hrow('Read 10 pages', 2, 74, 2, paused=pause)
        + hrow("Plan tomorrow's top task", 3, 82, 4, starts=11, paused=pause)
        + hgroup('Weekly reset', 'Sundays', '2 of its 5 steps are in Career')
        + hrow('Update the job tracker', 4, 77, 3, sched='sun')
        + hrow('Review job applications', 5, 62, 1, sched='sun'))
    legend = ('<div class="hleg"><span><i class="d"></i>Done</span><span><i class="s"></i>Skipped</span><span><i class="m"></i>Missed</span>'
              '<span><i class="p"></i>Paused</span><span><i class="t"></i>Today, to do</span><span><i class="f"></i>Upcoming</span><span><i class="n"></i>Not due</span></div>')
    return f'<div class="heat2">{head}{rows}</div>{legend}'

# ---------- extra cards ----------
def xrow(mark, title, right='', sub='', cls=''):
    sb = f'<span class="t-meta xs">{sub}</span>' if sub else ''
    return f'<div class="xrow {cls}">{mark}<div class="xb"><span class="lt">{title}</span>{sb}</div><span class="xr">{right}</span></div>'
CHK = '<span class="check"></span>'
CHKD = '<span class="check done"></span>'
def FOLD(): return f'<span class="mark xm">{ic("folder")}</span>'
def MET(): return f'<span class="mark xm">{ic("stats")}</span>'
def REP(): return f'<span class="mark xm">{ic("repeat")}</span>'
def chip(t, danger=False): return f'<span class="tag neutral{" dz" if danger else ""}">{t}</span>'

def attention():
    return '<div class="xlist">' + ''.join([
        xrow(CHK, 'Update resume', chip('Overdue 10 days', True), 'Resume &amp; portfolio · rolled over 4×'),
        xrow(CHK, 'Clean up GitHub profile', chip('Rolled over 3×'), 'No project'),
        xrow(FOLD(), 'Hackathon prep', chip('Due in 6 days'), '25% done · 3 open tasks'),
        xrow(MET(), 'Job applications', chip('Behind target'), '1 of 5 this month · 16 days left'),
    ]) + '</div>'

def notes_card():
    return ('<div class="md"><p>What a good month looks like:</p><ul><li>At least 5 job applications sent</li>'
            '<li>One portfolio piece finished</li><li>Life OS used every day</li></ul>'
            '<p style="margin-top:8px">Ask Ana for interview tips before Nov 20.</p>'
            '<p class="t-meta" style="margin-top:8px">Edited Nov 12</p></div>')

def recurring():
    return '<div class="xlist">' + ''.join([
        xrow(REP(), 'Read one AI engineering article', '<span class="t-meta">Next: today</span>', 'Every day'),
        xrow(REP(), 'Review job leads', '<span class="t-meta">Next: Fri, Nov 20</span>', 'Weekly on Friday · Resume &amp; portfolio'),
        xrow(REP(), 'Update portfolio stats', '<span class="t-meta">Next: Dec 1</span>', 'Monthly on the 1st'),
        xrow(REP(), 'Renew portfolio domain', chip('Paused'), 'Yearly on Mar 3', 'paused'),
    ]) + '</div>'

def unscheduled():
    return '<div class="xlist">' + ''.join([
        xrow(CHK, 'Collect project screenshots', f'<span class="t-meta">{ic("folder")}Life OS app</span>'),
        xrow(CHK, 'Clean up GitHub profile', f'<span class="t-meta">{bw.ic("flag","flag-med")}</span>'),
        xrow(CHK, 'Learn Docker basics', ''),
        xrow(CHK, 'Write a blog post about the thesis', ''),
    ]) + '</div>'

def recent():
    return '<div class="xlist">' + ''.join([
        xrow(CHKD, 'Draft portfolio page', '<span class="t-meta">Fri, Nov 13</span>', 'Resume &amp; portfolio', 'done'),
        xrow(CHKD, 'Apply to 5 jobs', '<span class="t-meta">Tue, Nov 10</span>', '', 'done'),
        xrow(CHKD, 'Review the Phase 2 PR', '<span class="t-meta">Tue, Nov 10</span>', 'Life OS app', 'done'),
        xrow(FOLD(), 'Interview prep', '<span class="t-meta">Oct 30</span>', 'Project completed', 'done'),
    ]) + '</div>'

bw.I['sliders'] = '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
def trow(mark, title, right, rcls=''):
    return f'<div class="trw">{mark}<span class="lt">{title}</span><span class="trr {rcls}">{right}</span></div>'
def tabcard():
    C = '<span class="check"></span>'
    F = f'<span class="mark xm">{ic("folder")}</span>'
    M = f'<span class="mark xm">{ic("stats")}</span>'
    rows = ''.join([
        trow(C, 'Update resume', 'Overdue 10 days', 'danger'),
        trow(C, 'Clean up GitHub profile', 'Rolled over 3 times'),
        trow(F, 'Hackathon prep', 'Due in 6 days · 25% done'),
        trow(M, 'Job applications', '1 of 5 this month'),
    ])
    tabs = ''.join(f'<span class="tb{" on" if i == 0 else ""}">{t}{f'<span class="counter">{n}</span>' if n else ""}</span>' for i, (t, n) in enumerate(
        [('Needs attention', 4), ('Unscheduled', 4), ('Recurring', 4), ('Completed', ''), ('Notes', '')]))
    return (f'<section class="scard"><header class="tabhead"><div class="tabs">{tabs}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span></div></header>'
            f'<div class="sbody tbody">{rows}</div></section>')

CSS = '''
.main.withagenda{flex-direction:row}
.content{flex:1;min-width:0;display:flex;flex-direction:column}
.kpis{grid-template-columns:repeat(6,minmax(0,1fr))}
.tile .tl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.td{white-space:nowrap;overflow:hidden}
.btn.on{background:var(--n100);color:var(--text-primary)}
/* timeline */
.tl{--lab:140px;position:relative}
.tl-axis{margin-left:var(--lab);position:relative;height:40px;border-bottom:1px solid var(--border)}
.mos,.wks{position:absolute;left:0;right:0}
.mos{top:0;height:20px}.wks{top:20px;height:20px}
.mo{position:absolute;top:0;font-size:12px;font-weight:600;color:var(--text-secondary);padding-left:4px;border-left:1px solid var(--border);height:20px;line-height:18px;white-space:nowrap;overflow:hidden}
.wk{position:absolute;font-size:11px;color:var(--text-tertiary);transform:translateX(-50%);line-height:20px}
.tl-body{position:relative}
.tl-grid{position:absolute;left:var(--lab);right:0;top:0;bottom:0;pointer-events:none}
.tl-grid i{position:absolute;top:0;bottom:0;width:1px;background:#f1f2f4}
.today{position:absolute;top:-40px;bottom:0;width:0;border-left:1.5px solid var(--n900);z-index:2;pointer-events:none}
.today span{position:absolute;top:-2px;left:-22px;background:var(--n900);color:#fff;font-size:11px;font-weight:600;line-height:16px;padding:0 6px;border-radius:4px}
.lane{display:flex;border-bottom:1px solid #f1f2f4;position:relative}
.lane:last-child{border-bottom:0}
.ln{width:var(--lab);flex:none;padding:10px 0 0;font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.04em}
.lt2{flex:1;position:relative;padding:6px 0}
.trow{position:relative;height:28px}
.tbar{position:absolute;top:4px;height:20px;border-radius:4px;background:var(--a-tint);overflow:hidden;display:flex;align-items:center;cursor:default}
.tbar i{position:absolute;left:0;top:0;bottom:0;background:var(--a-border)}
.tbar .tb-l{position:relative;padding:0 8px;font-size:12px;font-weight:500;color:var(--a-ink);white-space:nowrap}
.tbar .tp{position:relative;margin-left:auto;padding-right:8px;font-size:11px;font-weight:600;color:var(--a-ink)}
.tbar.done{background:var(--n100)}.tbar.done i{background:var(--n200)}.tbar.done .tb-l{color:var(--text-tertiary)}
.tbar.open{border-radius:4px 0 0 4px;-webkit-mask:linear-gradient(to right,#000 85%,transparent);mask:linear-gradient(to right,#000 92%,transparent)}
.tbar.open .tp{padding-right:9%}
.tbar.ev{background:var(--a-solid)}.tbar.ev .tb-l{color:#fff}
.tbar.ev .tb-l{position:absolute;left:100%;color:var(--text-primary);padding-left:6px}
.tbar.ev{overflow:visible}
.tpt{position:absolute;top:4px;display:flex;align-items:center;gap:6px;transform:translateX(-10px);white-space:nowrap;cursor:default}
.tpt .ev-icon{margin:0;width:20px;height:20px}
.tpt .tpl{font-size:12px;font-weight:500;color:var(--text-primary)}
.dia{width:20px;height:20px;display:grid;place-items:center;color:var(--a-solid)}
.dia svg{width:16px;height:16px;fill:var(--a-solid);stroke:#fff;stroke-width:1.5}
.dia.missed svg{fill:#fff;stroke:var(--danger);stroke-width:2}
.tlegend{display:flex;gap:16px;align-items:center;margin-top:12px;font-size:12px;color:var(--text-secondary)}
.tlegend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:18px;height:10px;border-radius:3px;background:linear-gradient(to right,var(--a-border) 60%,var(--a-tint) 60%)}
.tlegend svg{width:12px;height:12px}
/* agenda panel */
.agenda{width:360px;flex:none;margin:16px 24px 24px 0;border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;min-height:0;background:#fff}
.ag-head{height:52px;flex:none;display:flex;align-items:center;gap:12px;padding:0 8px 0 16px;border-bottom:1px solid var(--border)}
.ag-body{overflow:auto;padding:8px 8px 16px;min-height:0}
.aday{margin-top:12px}.aday:first-child{margin-top:4px}
.adh{height:24px;display:flex;align-items:center;gap:8px;padding:0 8px}
.aday.danger .t-label{color:var(--danger)}
.aday.isday .t-label{color:var(--acc700)}
.arow{display:flex;gap:8px;padding:6px 8px;border-radius:var(--r-control);align-items:flex-start}
.arow:hover{background:var(--n100)}
.arow .check,.arow .ev-icon,.arow .mark{margin-top:2px}
.ab{display:flex;flex-direction:column;min-width:0;gap:0}
.at{font-size:13px;line-height:20px;font-weight:500;color:var(--text-primary)}
.am{display:flex;align-items:center;gap:4px}
.am svg{width:12px;height:12px}
.arow.done .at{color:var(--text-disabled);text-decoration:line-through}
.arow.ev{background:var(--a-tint)}
.arow.ev .at{color:var(--a-ink)}.arow.ev .am{color:var(--a-text)}
.arow.ev + .arow.ev{margin-top:4px}
.pmk{color:var(--a-solid)}
.side{border-right:1px solid var(--border)!important}

.sgroup{height:32px;display:flex;align-items:center;gap:8px;padding:0 4px 0 8px;border-radius:var(--r-control);cursor:pointer;margin-bottom:2px}
.sgroup:hover{background:var(--n100)}
.sg-name{font-size:13px;line-height:18px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-primary)}
.sg-c{margin-left:auto;font-size:11px;font-weight:500;color:var(--text-tertiary)}
.sg-add{margin:0;width:22px;height:22px}
.sg-add svg{width:14px;height:14px}
.side .item .dot{margin:0 4px}

svg{stroke-width:2}
/* one marker size: everything in the agenda is a 16px box centered on the title line */
.arow{align-items:flex-start}
.arow>.check,.arow>.ev-icon,.arow>.mark{width:16px;height:16px;margin-top:2px;flex:none;display:grid;place-items:center}
.arow>.mark svg{width:16px;height:16px}
.arow>.dia{width:16px;height:16px}
.arow>.dia svg{width:14px;height:14px}
.ev-icon svg{width:11px;height:11px;stroke-width:2.2}
.trw>.check,.trw>.mark{width:16px;height:16px;display:grid;place-items:center}
.trw>.mark svg{width:16px;height:16px}
.mlane .mname svg{position:static;margin-right:6px;width:14px;height:14px;flex:none}
.mlane .mname{padding-left:0}
.pn2 .pi,.prow .ptop .pi{width:16px;height:16px}
/* counters: one design everywhere (same as Kanban column headers) */
.adh .counter{height:18px}
.tb .counter{margin-left:2px}

/* area-colored split button */
.split-btn{display:inline-flex;align-items:stretch;height:28px;border-radius:var(--r-control);background:var(--a-solid);color:#fff;overflow:hidden}
.split-btn button{border:0;background:transparent;color:#fff;font:500 12px/16px Inter,sans-serif;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.split-btn button svg{width:16px;height:16px}
.sb-main{padding:0 10px 0 10px}
.sb-chev{padding:0 6px}
.split-btn button:hover{background:rgba(255,255,255,.12)}
.sb-div{width:1px;background:rgba(255,255,255,.35);margin:6px 0}

.tabhead{display:flex;align-items:center;height:48px;padding:0 8px 0 12px;border-bottom:1px solid var(--border)}
.tabs{display:flex;gap:2px;height:100%}
.tb{display:flex;align-items:center;gap:6px;padding:0 10px;font-size:13px;font-weight:500;color:var(--text-tertiary);cursor:default;position:relative}
.tb b{font-weight:500;font-size:11px;color:var(--text-tertiary)}
.tb:hover{color:var(--text-primary)}
.tb.on{color:var(--text-primary)}
.tb.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:var(--text-primary)}
.tbody{padding:6px 8px 8px}
.trw{display:flex;align-items:center;gap:10px;height:36px;padding:0 8px;border-radius:var(--r-control)}
.trw:hover{background:var(--n100)}
.trw .check,.trw .mark{margin:0}
.trw .lt{font-size:13px;font-weight:500;flex:1}
.trr{font-size:12px;color:var(--text-tertiary);white-space:nowrap}
.trr.danger{color:var(--danger)}
.shead>div:not(.sact){display:flex;flex-direction:column}
.md{padding:0}.md ul{margin:4px 0 0 20px}

.cgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.xlist{display:flex;flex-direction:column}
.xrow{display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 8px;margin:0 -8px;border-radius:var(--r-control)}
.xrow:hover{background:var(--n100)}
.xrow .check,.xrow .mark{margin:0}
.xm{color:var(--a-solid)}
.xb{display:flex;flex-direction:column;min-width:0;flex:1}
.xb .lt{font-size:13px;line-height:18px}
.xs{font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xr{flex:none;display:flex;align-items:center;gap:4px}
.xr .t-meta{display:inline-flex;align-items:center;gap:4px}
.xr svg{width:12px;height:12px}
.tag.dz{background:#fce4e5;color:#a5282d}
.xrow.done .lt{color:var(--text-tertiary)}
.xrow.paused .lt{color:var(--text-tertiary)}
.scard{position:relative}
.shead{position:relative}
.grip{position:absolute;left:4px;top:15px;width:8px;height:16px;cursor:grab;opacity:.55;
  background-image:radial-gradient(circle,var(--n400) 1.2px,transparent 1.4px);background-size:4px 4px}
.scard:hover .grip,.agenda:hover .grip{opacity:1}
.ag-head{position:relative}
.ag-head .grip{top:18px}
.rsz{position:absolute;right:3px;bottom:3px;width:10px;height:10px;cursor:nwse-resize;opacity:.5;z-index:2;
  background:linear-gradient(135deg,transparent 45%,var(--n400) 45%,var(--n400) 55%,transparent 55%,transparent 70%,var(--n400) 70%,var(--n400) 80%,transparent 80%)}
.scard:hover .rsz{opacity:1}

.lnh{display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-left:-4px}
.lnh svg{width:12px;height:12px;color:var(--text-tertiary)}
.sact{position:relative}
.cmenu.open{background:var(--n100)}
.menu{position:absolute;right:0;top:32px;width:200px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:10;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.mh{height:24px;display:flex;align-items:center;padding:0 8px}
.mi{height:28px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;font-size:13px;color:var(--text-primary)}
.mi:hover{background:var(--n100)}
.mi.on{font-weight:500}
.mi>svg{width:14px;height:14px;color:var(--text-tertiary)}
.mi.on>svg{margin-left:auto;color:var(--acc600)}
.msep{height:1px;background:var(--border);margin:4px 0}

.mlane .mseg.met{background:var(--a-border)}
.mlane .mseg.miss{background:var(--n200)}
.mlane .mseg.cur{background:var(--a-tint);box-shadow:none}
.mlane .mseg.cur i{background:var(--a-border)}
.mseg.up{background:#fff;box-shadow:inset 0 0 0 1px var(--n300)}
.mseg.reach{background:var(--a-tint)}.mseg.reach i{background:var(--a-border)}
.tlegend .lg.met{background:var(--a-border)}.tlegend .lg.cur{background:linear-gradient(to right,var(--a-border) 50%,var(--a-tint) 50%);box-shadow:none}
.mlane .mname{flex-direction:row;align-items:center;justify-content:flex-start;gap:0}
.mname span{font-size:12px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mname svg{top:7px}
.notarget{position:absolute;left:0;right:0;top:13px;border-top:1px dashed var(--n300)}
.notarget span{position:absolute;left:8px;top:-9px;background:#fff;padding:0 6px;font-size:11px;color:var(--text-tertiary)}
.tbar.short{overflow:visible}.tbar.short .tb-l{position:absolute;left:100%;padding-left:6px;color:var(--text-primary)}
.pcard.done .bar i{background:var(--n300)!important}.pcard.done .bar{background:var(--n100)!important}

.mlane .ln{text-transform:none;letter-spacing:0;font-weight:400;padding-top:6px}
.lnt{height:20px;font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.04em;padding-top:4px}
.mspacer{height:20px}
.mname{height:28px;display:flex;flex-direction:column;justify-content:center;padding-right:8px;position:relative;padding-left:20px}
.mname svg{position:absolute;left:0;top:7px;width:14px;height:14px;color:var(--a-solid)}
.mname span:nth-child(2){font-size:12px;font-weight:500;color:var(--text-primary);line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mname .t-meta{font-size:11px;line-height:12px}
.mseg{position:absolute;top:6px;height:16px;border-radius:3px;overflow:hidden;cursor:default}
.mseg i{position:absolute;left:0;top:0;bottom:0;background:var(--a-solid)}
.mseg.met{background:var(--a-solid)}
.mseg.miss{background:var(--n200)}
.mseg.cur{background:#fff;box-shadow:inset 0 0 0 1.5px var(--a-solid)}
.mseg.up{background:#fff;box-shadow:inset 0 0 0 1px var(--n300)}
.mseg.reach{background:var(--a-tint)}
.mseg.reach i{background:var(--a-border)}
.mseg.reach.done{background:var(--n100)}.mseg.reach.done i{background:var(--n200)}
.mlane .tpt{top:4px;transform:translateX(-10px)}
.lg{width:14px;height:10px;border-radius:2px;display:inline-block}
.lg.met{background:var(--a-solid)}.lg.miss{background:var(--n200)}
.lg.cur{box-shadow:inset 0 0 0 1.5px var(--a-solid)}.lg.up{box-shadow:inset 0 0 0 1px var(--n300)}
.tlegend{flex-wrap:wrap}

.heat2{display:flex;flex-direction:column}
.hrow{display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;align-items:center;min-height:24px}
.hn{display:flex;flex-direction:column;min-width:0}
.hname{font-size:13px;line-height:18px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hrow .hn .t-meta{font-size:11px;line-height:14px}
.hcells{display:grid;grid-template-columns:repeat(92,minmax(0,1fr));gap:2px;height:10px}
.hcells i,.hleg i{display:block;border-radius:2px;height:100%}
.hleg i{width:12px;height:12px}
i.d{background:var(--a-solid)}
i.s{background:var(--a-border)}
i.m{background:var(--n200)}
i.p{background:repeating-linear-gradient(135deg,var(--n200) 0 1.5px,#fff 1.5px 3.5px)}
i.n{background:transparent;position:relative}
i.n::after{content:"";position:absolute;left:50%;top:50%;width:2px;height:2px;margin:-1px;border-radius:1px;background:var(--n300)}
i.t{background:#fff;box-shadow:inset 0 0 0 1.5px var(--a-solid)}
i.f{background:#fff;box-shadow:inset 0 0 0 1px var(--n300)}
.hrow + .hrow{margin-top:4px}
.hv{font-size:12px;font-weight:600;color:var(--text-primary);text-align:right;font-variant-numeric:tabular-nums;display:flex;align-items:center;justify-content:flex-end;gap:2px}
.hv.hs{font-weight:500;color:var(--text-secondary)}
.hv svg{width:12px;height:12px;color:var(--n500)}
.hhead{min-height:20px;margin-bottom:2px}
.hhead .hv{font-weight:500}
.hmonths{position:relative;height:20px}
.hmonths span{position:absolute;top:0;font-size:12px;font-weight:600;color:var(--text-secondary);line-height:20px;padding-left:4px;border-left:1px solid var(--border)}
.hmonths .htoday{border:0;background:var(--n900);color:#fff;font-size:11px;line-height:16px;top:2px;padding:0 6px;border-radius:4px;transform:translateX(-50%)}
.hgroup{display:flex;align-items:center;gap:12px;height:32px;margin-top:10px;border-top:1px solid #f1f2f4;padding-top:8px}
.hgroup .hn{flex-direction:row;align-items:center;gap:8px}
.hother{margin-left:auto}
.hleg{display:flex;gap:16px;margin-top:14px;font-size:12px;color:var(--text-secondary);flex-wrap:wrap}
.hleg span{display:inline-flex;align-items:center;gap:6px}

.pnav{display:flex;align-items:center;gap:2px}
.pnav .icon-btn{margin:0;width:28px;height:28px}
.pnav .pl{font-size:13px;font-weight:600;min-width:64px;text-align:center}
.split{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
.leftcol{display:flex;flex-direction:column;gap:16px;min-width:0}
.agenda{margin:0;position:sticky;top:0;max-height:calc(100vh - 220px)}
.tpt.flip{flex-direction:row-reverse;transform:translateX(calc(-100% + 10px))}
/* project cards */
.pgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.pcard .mark{color:var(--a-solid)}
.pcard.done .t-card{color:var(--text-tertiary)}
.pcard.done .bar i{background:var(--n300)}
.pcard .bar{background:var(--a-tint)}
/* routines */
.rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.rcard{border:1px solid var(--border);border-radius:var(--r-card);padding:8px 12px 10px}
.rc-head{display:flex;align-items:center;gap:8px;height:28px}
.rc-head .pring{margin:0}
.rc-head .sp{flex:1}
.rc-cols,.rstep{display:grid;grid-template-columns:minmax(0,1fr) 120px 40px;align-items:center;gap:12px}
.rc-cols{height:24px;margin-top:4px;padding-left:24px;border-bottom:1px solid #f1f2f4}
.rc-cols span:nth-child(3){text-align:right}
.rstep{min-height:32px;grid-template-columns:16px minmax(0,1fr) 120px 40px;gap:8px}
.rc-cols{grid-template-columns:minmax(0,1fr) 120px 40px}
.rstep .check{margin:0}
.rs-name{font-size:13px;font-weight:500;color:var(--text-primary);display:flex;flex-direction:column;line-height:18px}
.rstep.done .rs-name{color:var(--text-disabled);text-decoration:line-through}
.rstep.later .check{border-color:var(--n300)}
.rs-note{font-weight:400}
.rs-rate{display:flex;align-items:center;gap:6px}
.rs-rate .bar{flex:1;height:4px;background:var(--a-tint)}
.rs-rate .pv{min-width:32px}
.rs-streak{display:flex;align-items:center;justify-content:flex-end;gap:2px}
.rs-streak svg{width:12px;height:12px}
.rc-foot{margin-top:6px;padding-left:24px}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Career (data view v3)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{a2.sidebar}</aside>
  <main class="main career withagenda">
    <div class="content">
      <div class="areahead">
        <div>
          <div class="ttl"><span class="dot"></span><h1 class="t-page">Career</h1></div>
          <p class="t-body vision">Build a steady career in AI engineering, and keep learning something new every week.</p>
        </div>
        <div class="acts">
          <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
          <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
          <button class="btn icon" title="Edit, archive or delete">{ic('more')}</button>
          <div class="split-btn"><button class="sb-main">{ic('plus')}Add</button><span class="sb-div"></span><button class="sb-chev" title="More to add">{ic('chev')}</button></div>
        </div>
      </div>
      <div class="scroll">
        <div class="kpis">{tiles}</div>
        <div class="split">
          <div class="leftcol">
            {a2.card('Timeline', 'Projects, events and metric targets in Q4', timeline + '<div class="tlegend"><span><i class="sw"></i>Progress</span><span><i class="lg met"></i>Target met</span><span><i class="lg up"></i>Upcoming</span><span><span class="dia" style="width:12px;height:12px">' + ic('diamond') + '</span>Deadline</div>')}
            {a2.card('Projects', '3 active · 1 done this quarter', pcards())}
            {a2.card('Routines', 'Routine steps in Career · one square per day of Q4', rcards())}
            {tabcard()}
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
bw.I['sliders'] = '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view">{ic("sliders")}</span>')
menu = f"""<div class="menu"><div class="mh t-label">Sort by</div>
<div class="mi on">Due date{ic('check')}</div><div class="mi">Progress</div><div class="mi">Name</div>
<div class="msep"></div><div class="mh t-label">Show</div>
<div class="mi"><span class="mini-check on">{ic('check')}</span>Active</div><div class="mi"><span class="mini-check on">{ic('check')}</span>Done</div><div class="mi"><span class="mini-check"></span>Cancelled</div>
<div class="msep"></div><div class="mi">{ic('table')}View as table</div></div>"""
Path('/mnt/user-data/outputs/life-os-mock-area.html').write_text(html)
print('ok', len(html))
