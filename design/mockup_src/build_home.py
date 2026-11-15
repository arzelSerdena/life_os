"""Build html_mockups/approved-home.html: Home (Phase F, approved Nov 15).

Home answers "what do I do today, right now". It does not analyse: no charts, heatmaps or period stats. Other
screens' signals show as one line that links to their screen.

Layout (no context sidebar, no period switch; content 1824 px wide at 1920):
- Header: the date as the title, one data line ("6 of 14 done · Next: Demo rehearsal 5 PM"), then on the right a
  quick add field (Enter = a task scheduled today with no owner) and the New split button (Task, Event, Metric entry).
- Today (left): the approved agenda rows for today only. Overdue (red, only when not empty), Schedule (all-day first,
  then timed in order, with a now line), Tasks, then Completed (collapsed). Routine steps are not repeated here.
  Row hover actions: Tomorrow and Pick date.
- Middle: Routines today (one block per routine due today, made from the routine page's Day card; a routine whose
  steps are all done collapses to its header) and Log today (manual metrics with a per-day or per-week target and no
  entry today; inline value field and a check).
- Right (360 px): Needs a push (Inbox count, Projects: due soon / stalled / no next step, Routines: streaks ended
  this week, Metrics: behind target; each heading opens its screen; empty sections are hidden, all empty =
  "Nothing needs a push.") and Coming up (next 7 days, fixed-date items only: events, project due dates, target
  deadlines).

Mock today: Sat, Nov 14, 2026, 2:40 PM. Interactions work: task and step checkboxes, Skip, subtasks, Completed,
routine blocks, quick add (Enter), metric logging, Tomorrow, the New menu, the undo toast.

Reads approved-calendar.html (base CSS, rail, detail panel), approved-projects-overview.html (Next up rows) and
approved-tasks.html (New task pop-up); imports build_routine.py and build_routines_overview.py (routine data).
Usage: python build_home.py <html_mockups dir> <out.html>
"""
import re
import sys
from datetime import timedelta
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'approved-home.html')
sys.argv = [sys.argv[0], str(SRC), '/dev/null']  # the imported builders read their own argv
import build_routine as br  # noqa: E402
import build_routines_overview as bo  # noqa: E402

TODAY, D = br.TODAY, br.D
ic, ring = br.ic, br.ring


def svg(p):
    return f'<svg viewBox="0 0 24 24">{p}</svg>'


I = dict(
    flag='<path d="M4 22V4l7 2 9-2v12l-9 2-7-2"/>',
    roll='<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    notes='<path d="M4 6h16M4 12h16M4 18h10"/>',
    pin='<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    cal='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>',
    calpick='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>',
    tmr='<path d="M5 12h14M13 6l6 6-6 6"/>',
    inbox='<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7H2v-7z"/>',
    plantask='<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
    sched='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>',
    chevr='<path d="m9 18 6-6-6-6"/>',
    house='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    shapes='<circle cx="7" cy="7" r="4"/><rect x="13" y="3" width="8" height="8" rx="1"/><path d="M7 13l4 8H3z"/><rect x="13" y="13" width="8" height="8" rx="4"/>',
    task='<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
    entry='<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/><path d="M17 3v6M14 6h6"/>',
)


def i2(k):
    return svg(I[k])


FOLDER = br.I['folder']
PRI_C = {'high': '#cc363c', 'med': '#d97706'}


# ---------------------------------------------------------------- rows (approved agenda rows)
def task(t, area=None, key='', pri=None, rep=False, notes=False, roll=0, due=None, over=False, proj=None, subs=None,
         done=False, sel=False):
    a = area or 'noarea'
    meta = ''
    if pri:
        meta += f'<svg viewBox="0 0 24 24" class="fl" style="color:{PRI_C[pri]}">{I["flag"]}</svg>'
    if rep:
        meta += f'<span class="mi2" data-tip="Repeats">{svg(br.I["repeat"])}</span>'
    if notes:
        meta += f'<span class="mi2" data-tip="Has notes">{i2("notes")}</span>'
    if roll:
        meta += f'<span class="mi2" data-tip="Rolled over {roll} times">{i2("roll")}{roll}</span>'
    if due:
        meta += f'<span class="{"overdue" if over else ""}">{due}</span>'
    if proj:
        meta += f'<span class="pj">{svg(FOLDER)}{proj}</span>'
    sub_html = tog = ''
    if subs:
        n = sum(1 for _, d in subs if d)
        tog = f'<span class="sbt2">{n}/{len(subs)}{ic("chev")}</span>'
        sub_html = '<div class="asubs">' + ''.join(
            f'<div class="asub{" d" if d else ""}"><span class="scb">{ic("check") if d else ""}</span>{s}</div>' for s, d in subs) + '</div>'
    am = f'<span class="t-meta am">{meta}{tog}</span>' if meta or tog else ''
    acts = ('' if done else
            f'<span class="ract"><button class="rbtn tmr" data-tip="Sun, Nov 15">{i2("tmr")}Tomorrow</button>'
            f'<button class="rbtn ic" data-tip="Pick date">{i2("calpick")}</button></span>')
    cls = f'arow task {a}{" done" if done else ""}{" sel" if sel else ""}'
    return (f'<div class="{cls}" data-k="{key}"><span class="check{" done" if done else ""}"></span>'
            f'<div class="ab"><span class="at">{t}</span>{am}{sub_html}</div>{acts}</div>')


def event(t, area, when, past=False, loc=False, rep=False):
    pre = (f'<span class="mi2">{svg(br.I["repeat"])}</span>' if rep else '') + (f'<span class="mi2">{i2("pin")}</span>' if loc else '')
    return (f'<div class="arow ev {area}{" past" if past else ""}"><span class="ev-icon">{i2("cal")}</span>'
            f'<div class="ab"><span class="at">{t}</span><span class="t-meta am">{pre}{when}</span></div></div>')


def proj_due(t, area, meta='Project due'):
    return (f'<div class="arow {area}"><span class="mark pmk">{svg(FOLDER)}</span>'
            f'<div class="ab"><span class="at">{t}</span><span class="t-meta am">{meta}</span></div></div>')


def target_due(t, area, meta):
    return (f'<div class="arow {area}"><span class="mark pmk tgt">{svg(br.I["stats"])}</span>'
            f'<div class="ab"><span class="at">{t}</span><span class="t-meta am">{meta}</span></div></div>')


NOW = '<div class="nowl"><span>2:40 PM</span><i></i></div>'


def group(label, rows, cls='', count=True, key=''):
    c = f'<span class="counter">{rows.count("arow task")}</span>' if count else ''
    return (f'<div class="aday {cls}" data-g="{key}"><div class="adh"><span class="t-label">{label}</span>{c}</div>'
            f'<div class="gbody">{rows}</div></div>')


def completed(rows, n, open_=False):
    return (f'<div class="aday cgrp{"" if open_ else " collapsed"}" data-g="done"><div class="adh tog">'
            f'<span class="gchev">{ic("chev")}</span><span class="t-label">Completed</span><span class="counter">{n}</span></div>'
            f'<div class="gbody">{rows}</div></div>')


# ---------------------------------------------------------------- data
OVERDUE = lambda sel=False: task('Update resume', 'career', 'ut', pri='high', notes=True, roll=4, due='Nov 4', over=True,
                                 proj='Resume &amp; portfolio', subs=[('Add projects section', True), ('Fix formatting', False),
                                                                      ('Ask a friend to review', False)], sel=sel)
SCHEDULE = [event('Hackathon weekend', 'career', 'All day'),
            event('Brunch with Ana', 'relation', '11 AM – 12:30 PM', past=True, loc=True),
            NOW,
            event('Demo rehearsal', 'career', '5 – 6 PM', loc=True)]
TASKS = [task('Draft the hackathon pitch', 'career', 'pitch', pri='med', due='Nov 15 · 6 PM', proj='Hackathon prep'),
         task('Clean up GitHub profile', 'career', 'gh', roll=3, proj='Life OS app'),
         task('Buy groceries', None, 'groc')]
DONE = [task('Run 5 km', 'health', 'run', rep=True, proj='5K training', done=True)]


def today_card(variant='normal'):
    if variant == 'nothing':
        body = ('<div class="ag-empty tempty"><span class="t-meta">Nothing scheduled today.</span>'
                f'<button class="btn ghost">{i2("inbox")}Plan from Inbox<span class="counter">6</span></button></div>')
        return card('Today', '', body, 'tcard')
    if variant == 'alldone':
        sched = [event('Hackathon weekend', 'career', 'All day'),
                 event('Brunch with Ana', 'relation', '11 AM – 12:30 PM', past=True, loc=True),
                 event('Demo rehearsal', 'career', '5 – 6 PM', past=True, loc=True), NOW.replace('2:40 PM', '9:15 PM')]
        done = [task('Update resume', 'career', 'ut', pri='high', roll=4, proj='Resume &amp; portfolio', done=True),
                task('Draft the hackathon pitch', 'career', 'pitch', pri='med', due='Nov 15 · 6 PM', proj='Hackathon prep', done=True),
                task('Clean up GitHub profile', 'career', 'gh', proj='Life OS app', done=True),
                task('Buy groceries', None, 'groc', done=True), DONE[0]]
        body = (group('Schedule', ''.join(sched), count=False, key='sched')
                + '<div class="alldone"><span class="t-meta">All done for today.</span></div>'
                + completed(''.join(done), len(done)))
        return card('Today', '5 tasks · 3 events', body, 'tcard')
    sel = variant == 'panel'
    body = (group('Overdue', OVERDUE(sel), 'danger', key='over')
            + group('Schedule', ''.join(SCHEDULE), count=False, key='sched')
            + group('Tasks', ''.join(TASKS), key='tasks')
            + completed(''.join(DONE), len(DONE)))
    return card('Today', '5 tasks · 3 events', body, 'tcard')


def card(title, sub, body, cls='', menu=False):
    s = f'<span class="ssub">{sub}</span>' if sub else ''
    m = f'<div class="sact"><span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span></div>' if menu else ''
    return (f'<section class="scard {cls}"><header class="shead"><div><span class="stitle">{title}</span>{s}</div>{m}</header>'
            f'<div class="sbody">{body}</div></section>')


# ---------------------------------------------------------------- routines today
def step_row(s, x, streak):
    meta = ''
    if s['proj']:
        meta += f'<span class="lm"><span class="lf">{ic("folder")}</span>{s["proj"]}</span>'
    if s['metric']:
        meta += f'<span class="lm">{ic("stats")}{s["metric"]}</span>'
    if streak > 1:
        meta += f'<span>Streak {streak}</span>'
    ico = ic('check') if x == 'd' else (ic('dash') if x == 's' else '')
    lab = '<span class="dst">Skipped</span>' if x == 's' else ''
    skip = f'<span class="skb" title="Skip">{ic("skip")}</span>' if x == 't' else ''
    return (f'<div class="drow {x} {s["a"]}"><span class="rb">{ico}</span><div class="db"><span class="dt">{s["t"]}</span>'
            f'{f"<span class=dm>{meta}</span>" if meta else ""}</div>{lab}{skip}</div>')


def routine_block(r, force=None, collapsed=None):
    sts = [force or r.st[(i, TODAY)] for i in range(len(r.steps))]
    due = [(i, x) for i, x in enumerate(sts) if x != 'n']
    cnt = [x for _, x in due if x not in 'sp']
    dn = sum(x == 'd' for x in cnt)
    if collapsed is None:
        collapsed = dn == len(cnt)
    rows = ''.join(step_row(r.steps[i], x, r.step_streak(i)) for i, x in due)
    return (f'<div class="rblk{" collapsed" if collapsed else ""}" data-r="{r.key}">'
            f'<div class="rbh"><span class="rtog">{ic("chev")}</span><span class="rgw">{ring(dn / len(cnt) if cnt else 0, 16)}</span>'
            f'<span class="rbn">{r.name}</span><span class="t-meta rbc">{dn}/{len(cnt)}</span>'
            f'<span class="icon-btn rbm2" title="Skip day">{ic("more")}</span></div><div class="rbb">{rows}</div></div>')


ROUTINES_TODAY = [bo.R_MOR, br.R_EVE]


def routines_card(variant='normal'):
    if variant == 'nothing':
        return card('Routines today', '', '<div class="card-empty"><span class="t-meta">No routines due today.</span></div>', 'rtcard')
    force = 'd' if variant == 'alldone' else None
    blocks = ''.join(routine_block(r, force) for r in ROUTINES_TODAY)
    tot = sum(r.today_count()[1] for r in ROUTINES_TODAY)
    dn = tot if force else sum(r.today_count()[0] for r in ROUTINES_TODAY)
    return card('Routines today', f'<span class="rtsub">{dn} of {tot}</span> steps done', blocks, 'rtcard')


# ---------------------------------------------------------------- log today
METRICS = [  # key, name, area, meta, prefix, unit
    ('water', 'Water', 'health', '8 glasses a day · 4 of 5 days met this week', '', 'glasses'),
    ('study', 'Study hours', 'career', '6 h of 10 h this week', '', 'h'),
    ('spend', 'Spending', 'finance', '₱2,350 of ₱3,000 this week', '₱', ''),
]


def log_card(variant='normal'):
    if variant in ('nothing', 'alldone'):
        return ''
    rows = ''
    for k, n, a, m, pre, u in METRICS:
        rows += (f'<div class="lgrow {a}" data-m="{k}" data-u="{u}" data-p="{pre}"><span class="lgmk">{ic("stats")}</span>'
                 f'<div class="lrb"><span class="lrt">{n}</span><span class="t-meta lgm">{m}</span></div>'
                 f'<label class="lginp">{f"<span class=pre>{pre}</span>" if pre else ""}<input inputmode="decimal">'
                 f'{f"<span class=u>{u}</span>" if u else ""}</label>'
                 f'<button class="btn icon lgok" title="Log">{ic("check")}</button></div>')
    return card('Log today', f'{len(METRICS)} to log', f'<div class="lgs">{rows}</div>', 'lgcard')


# ---------------------------------------------------------------- needs a push
def fold(area):
    return f'<span class="mark sfold {area}">{svg(FOLDER)}</span>'


def streaks_ended():
    wk0 = TODAY - timedelta(days=TODAY.weekday())
    out = []
    for r in [bo.R_MOR, br.R_EVE, br.R_WEEK]:
        for i, s in enumerate(r.steps):
            d = TODAY - D
            while d >= wk0 and r.st[(i, d)] != 'm':
                d -= D
            if d < wk0:
                continue
            run, e = 0, d - D
            while e >= r.created and r.st[(i, e)] != 'm':
                run += r.st[(i, e)] == 'd'
                e -= D
            if run >= 4:
                out.append((s, r, run, d))
    return out


def sec(label, n, rows, link):
    return (f'<div class="csec"><div class="csh"><a class="slink" data-tip="Open {link}"><span class="t-label">{label}</span>'
            f'{i2("chevr")}</a><span class="counter">{n}</span></div>{rows}</div>')


def push_card(variant='normal'):
    if variant == 'calm':
        body = '<div class="ag-empty"><span class="t-meta">Nothing needs a push.</span></div>'
    else:
        inbox = (f'<div class="crow ibx"><span class="mark ibm">{i2("inbox")}</span><div class="lrb"><span class="lrt">Inbox</span></div>'
                 f'<span class="counter">6</span></div>')
        pr = (f'<div class="crow career"><span class="dbadge soon">6d</span>{fold("career")}<div class="lrb"><span class="lrt">Hackathon prep</span>'
              f'<span class="t-meta">Nov 20 · 3 open</span></div></div>'
              f'<div class="crow personal">{fold("personal")}<div class="lrb"><span class="lrt">Reading challenge</span>'
              f'<span class="t-meta">Nothing done for 25 days</span></div><button class="qbtn">{i2("plantask")}Plan task</button></div>'
              f'<div class="crow career">{fold("career")}<div class="lrb"><span class="lrt">Life OS app</span>'
              f'<span class="t-meta">12 open, none scheduled</span></div><button class="qbtn">{i2("sched")}Schedule</button></div>'
              f'<a class="more">+4 more</a>')
        se = streaks_ended()
        rr = ''.join(f'<div class="crow {s["a"]}"><span class="mark"><span class="rbm"></span></span><div class="lrb"><span class="lrt">{s["t"]}</span>'
                     f'<span class="t-meta">{r.name}</span></div><span class="t-meta slr">{run} days · ended {br.WD[d.weekday()]}</span></div>'
                     for s, r, run, d in se[:3])
        mr = (f'<div class="crow career"><span class="mark mmk">{ic("stats")}</span><div class="lrb"><span class="lrt">Job applications</span>'
              f'<span class="t-meta">1 of 5 this month · 16 days left</span></div></div>'
              f'<div class="crow career"><span class="mark mmk">{ic("stats")}</span><div class="lrb"><span class="lrt">Recruiter replies</span>'
              f'<span class="t-meta"><span class="pj">{svg(FOLDER)}Resume &amp; portfolio</span> · 0 of 2 this month</span></div></div>')
        body = inbox + sec('Projects', 7, pr, 'the Projects overview')
        if se:
            body += sec('Routines', len(se), rr, 'the Routines overview')
        body += sec('Metrics', 2, mr, 'Life areas')
    return (f'<aside class="agenda push"><header class="ag-head"><span class="stitle">Needs a push</span></header>'
            f'<div class="ag-body">{body}</div></aside>')


def coming_card():
    days = [('Tomorrow', 'Sun, Nov 15', event('Hackathon weekend', 'career', 'Until 3 PM') + proj_due('Kitchen deep clean', 'home')),
            ('Thu', 'Nov 19', event('Study group', 'career', '7 – 9 PM', rep=True)),
            ('Fri', 'Nov 20', event('Mock interview with Ana', 'career', '2 PM') + proj_due('Hackathon prep', 'career'))]
    body = ''.join(f'<div class="aday"><div class="adh"><span class="t-label">{a}</span><span class="t-meta">{b}</span></div>{r}</div>'
                   for a, b, r in days)
    return card('Coming up', 'Nov 15 – 21 · 5 items', body, 'cucard')


# ---------------------------------------------------------------- page
def header(line, quiet=False):
    return f'''<div class="areahead hhead"><div><div class="ttl"><h1 class="t-page">Saturday, Nov 14</h1></div>
      {f'<div class="hline t-meta">{line}</div>' if line else ''}</div>
      <div class="acts">
        <label class="qadd"><span class="qi">{ic('plus')}</span><input placeholder="Add task"></label>
        <div class="nsplit"><button class="btn primary nmain">{ic('plus')}New task</button><span class="nsep"></span>
          <button class="btn primary ncar" title="More to create">{ic('chev')}</button></div>
      </div></div>'''


def page(app_id, variant='normal'):
    line = {'normal': '<span class="hdone">6 of 14</span> done · Next: Demo rehearsal 5 PM',
            'panel': '<span class="hdone">6 of 14</span> done · Next: Demo rehearsal 5 PM',
            'alldone': '<span class="hdone">14 of 14</span> done',
            'calm': '<span class="hdone">6 of 14</span> done · Next: Demo rehearsal 5 PM',
            'nothing': 'Next: Sun, Nov 15 · Kitchen deep clean due'}[variant]
    main = f'''<main class="main hmain"><div class="content">{header(line)}
      <div class="scroll hgrid">
        <div class="hcol">{today_card(variant)}</div>
        <div class="hcol">{routines_card(variant)}{log_card(variant)}</div>
        <div class="hcol rcol">{push_card(variant)}{coming_card()}</div>
      </div></div></main>'''
    return f'<div class="app happ" id="{app_id}">{RAIL}{main}</div>'


def first_run(step=0):
    def srow(k, label, meta, btn, done):
        mark = (f'<span class="frc ok">{ic("check")}</span>' if done else '<span class="frc"></span>')
        b = '' if done else f'<button class="btn">{ic("plus")}{btn}</button>'
        return (f'<div class="frrow{" done" if done else ""}">{mark}<div class="lrb"><span class="lrt">{label}</span>'
                f'<span class="t-meta">{meta}</span></div>{b}</div>')
    rows = (srow('area', 'Life area', 'Career' if step else 'None yet', 'New area', step > 0)
            + srow('rt', 'Routine', 'None yet', 'New routine', False)
            + srow('task', 'Task', 'None yet', 'New task', False))
    main = f'''<main class="main hmain"><div class="content">{header('')}<div class="frun hfrun">
      <span class="he-icon">{i2('house')}</span>
      <h2 class="t-page">Set up Life OS</h2>
      <p class="t-body">Life areas hold your projects, tasks and metrics. Routines are steps you repeat on a schedule.</p>
      <div class="frlist">{rows}</div></div></div></main>'''
    return f'<div class="app happ" id="{"first1" if step else "first0"}">{RAIL}{main}</div>'


# ---------------------------------------------------------------- overlays
def new_menu():
    items = [('task', 'Task', ''), ('cal', 'Event', ''), ('entry', 'Metric entry', '')]
    return ('<div class="hmenu ov" id="nm">' + ''.join(
        f'<div class="mi">{i2(k)}{t}{f"<kbd>{s}</kbd>" if s else ""}</div>' for k, t, s in items) + '</div>')


def routine_menu():
    return (f'<div class="hmenu ov" id="rm" style="left:auto"><div class="mi">{ic("skip")}Skip day</div>'
            "</div>")


TOAST = (f'<div class="toast2 htoast" id="toast"><span class="ok">{ic("okc")}</span><span class="tmsg"></span>'
         '<button class="link tundo">Undo</button><kbd>Ctrl Z</kbd></div>')


def panel(cal):
    i = cal.index('<aside class="panel dpanel pnl-task career"')
    j = cal.index('</aside>', i) + 8
    p = cal[i:j].replace('<aside class="panel dpanel pnl-task career"', '<aside class="panel dpanel pnl-task career ov" id="pn"', 1)
    # follow the Tasks rule: dates are plain text
    return p.replace('Nov 4 · Overdue', 'Nov 4')


# ---------------------------------------------------------------- CSS / JS
def base_css(cal):
    css = cal[cal.index('<style>') + 7:cal.index('</style>')]
    po = (SRC / 'approved-projects-overview.html').read_text(encoding='utf-8')
    pc = po[po.index('<style>') + 7:po.index('</style>')]
    css += '\n'.join(l for l in re.split(r'(?<=\})', pc) if re.search(r'\.crow|\.dbadge|\.qbtn|\.csec|\.csh|\.lrb|\.lrt|\.neg\b', l))
    rc = br.CSS
    css += '\n'.join(l for l in re.split(r'(?<=\})', rc) if re.search(r'\.drow|\.rpz|\.lm\b|\.lm |\.lf\b|\.rbm\b|\.frun|\.t-body', l))
    return css


CSS = r"""
.app.happ{display:none}.app.happ.show{display:flex}
.hmain .content{display:flex;flex-direction:column;min-height:0;height:100vh}
.hhead{padding:24px 24px 0;align-items:center}
.hhead .ttl{height:28px}
.hline{margin-top:2px;font-size:13px;line-height:20px;color:var(--text-secondary)}
.hline .hdone{font-variant-numeric:tabular-nums}
.hhead .acts{gap:8px}
.qadd{width:340px;height:32px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:text}
.qadd:focus-within,.qadd.focus{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.qadd .qi{display:grid;color:var(--text-tertiary)}.qadd .qi svg{width:15px;height:15px}
.qadd input{border:0;outline:0;flex:1;min-width:0;font:400 13px/20px Inter,sans-serif;color:var(--text-primary);background:none}
.qadd input::placeholder{color:var(--text-disabled)}
.nsplit{display:inline-flex;align-items:stretch;height:32px;border-radius:6px;overflow:hidden;background:var(--acc700)}
.nsplit .btn{height:32px;border:0;border-radius:0;background:var(--acc700)}
.nsplit .btn svg{width:14px;height:14px}
.nsplit .nsep{width:1px;background:rgba(255,255,255,.35);margin:6px 0}
.nsplit .ncar{width:30px;padding:0;justify-content:center}
.nsplit .ncar:hover,.nsplit .nmain:hover{background:#6f5490}
body.k-new .nsplit .ncar{background:#6f5490}
.hgrid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 360px;gap:16px;padding:16px 24px 24px;align-items:start}
.hcol{display:flex;flex-direction:column;gap:16px;min-width:0}
.hcol.rcol .agenda{position:static;max-height:none;width:auto;margin:0}
/* today card */
.tcard .sbody{padding:0 8px 8px}
.tcard .aday:first-child{margin-top:0}
.tcard .gbody{display:flex;flex-direction:column}
.hmain .arow{position:relative;border:1px solid transparent}
.hmain .arow .ab{flex:1;min-width:0}
.hmain .arow .at{font-size:14px;line-height:20px}
.hmain .arow .am{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:1px}
.hmain .arow .am svg{width:12px;height:12px;color:var(--text-tertiary);flex:none}
.hmain .arow .am .fl{width:12px;height:12px}
.hmain .arow .mi2{display:inline-flex;align-items:center;gap:2px}
.hmain .arow .pj{display:inline-flex;align-items:center;gap:4px}
.hmain .arow .pj svg{color:var(--a-solid)}
.hmain .arow .overdue{color:var(--danger)}
.hmain .arow.ev .at{color:var(--text-primary)}
.hmain .arow.ev .am{color:var(--text-secondary)}
.hmain .arow.ev.past .at,.hmain .arow.ev.past .am{color:var(--text-tertiary)}
.hmain .arow.ev+.arow.ev,.hmain .arow.ev+.nowl+.arow.ev{margin-top:4px}
.hmain .arow .sbt2{margin-left:auto}
.hmain .arow.open{border-color:var(--border);background:#fff}
.hmain .arow.open:hover{background:#fff}
.hmain .arow .check{cursor:pointer}
.hmain .arow.task.noarea .check{border-color:var(--n400)}
.hmain .arow.done .check{background:var(--a-border);border-color:var(--a-border)}
.hmain .arow.task.noarea.done .check{background:var(--n300);border-color:var(--n300)}
.arow.sel{box-shadow:0 0 0 2px var(--acc600);background:#fff}
.arow.fresh{animation:fresh 1.6s ease-out}
@keyframes fresh{from{background:var(--acc100)}to{background:transparent}}
.ract{display:none;position:absolute;right:6px;top:5px;gap:2px;background:var(--n100);padding-left:8px;box-shadow:-10px 0 8px -2px var(--n100)}
.arow.task:not(.done):hover .ract,body.k-hover .arow[data-k="ut"] .ract{display:flex}
body.k-hover .arow[data-k="ut"]{background:var(--n100)}
.rbtn{height:24px;display:inline-flex;align-items:center;gap:4px;padding:0 6px;border:1px solid var(--border);border-radius:5px;background:#fff;
  font:500 12px/16px Inter,sans-serif;color:var(--text-secondary);cursor:pointer}
.rbtn svg{width:13px;height:13px;color:var(--text-tertiary)}
.rbtn.ic{width:24px;padding:0;justify-content:center}
.rbtn:hover{color:var(--text-primary);border-color:var(--n300)}
.nowl{position:relative;height:16px;display:flex;align-items:center;gap:6px;padding:0 8px;margin:2px 0}
.nowl span{font-size:11px;font-weight:600;color:var(--acc700);font-variant-numeric:tabular-nums}
.nowl i{flex:1;height:2px;background:var(--acc600);border-radius:1px;position:relative}
.nowl i::before{content:"";position:absolute;left:-3px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--acc600)}
.adh.tog{cursor:pointer;border-radius:6px}.adh.tog:hover{background:var(--n50)}
.gchev{display:grid;color:var(--text-tertiary);margin-left:-4px}.gchev svg{width:14px;height:14px;transition:transform .15s}
.cgrp.collapsed .gbody{display:none}.cgrp.collapsed .gchev svg{transform:rotate(-90deg)}
.cgrp{margin-top:8px!important}
.alldone{padding:14px 8px 4px}
.tempty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:4px 8px 8px;position:static}
.tempty>*{position:static}
.hmain .btn.ghost{position:static;width:auto;transform:none;box-shadow:none;display:inline-flex;z-index:auto;cursor:pointer}
.rtcard .card-empty{padding:0 8px 4px;min-height:0}
.chip2.ghost{display:inline-flex;position:static;width:auto;transform:none;box-shadow:none;z-index:auto;cursor:pointer}
.tempty .btn .counter{margin-left:2px}
.tempty .btn svg{width:14px;height:14px}
/* routines today */
.rtcard .sbody{padding:0 8px 8px}
.rblk+.rblk{margin-top:6px;padding-top:6px;border-top:1px solid #f1f2f4}
.rbh{display:flex;align-items:center;gap:8px;height:36px;padding:0 8px;border-radius:6px;cursor:pointer}
.rbh:hover{background:var(--n50)}
.rtog{display:grid;color:var(--text-tertiary);margin-left:-4px}.rtog svg{width:14px;height:14px;transition:transform .15s}
.rblk.collapsed .rtog svg{transform:rotate(-90deg)}
.rblk.collapsed .rbb{display:none}
.rgw{display:grid;place-items:center}
.rbn{font-size:14px;font-weight:600;color:var(--text-primary)}
.rbn:hover{text-decoration:underline;text-underline-offset:2px}
.rbc{margin-left:auto;font-variant-numeric:tabular-nums}
.rbm2{margin:0;opacity:0}.rbh:hover .rbm2{opacity:1}
.rbb{padding-left:20px}
.rtcard .drow .rb{cursor:pointer}
.rtcard .drow.s .rb{cursor:default}
.rtcard .dm .lm svg{color:var(--text-tertiary)}
.rtcard .dm .lf svg{color:var(--a-solid)}
/* log today */
.lgs{display:flex;flex-direction:column}
.lgrow{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 0 0 2px}
.lgrow+.lgrow{border-top:1px solid #f1f2f4}
.lgmk{display:grid;place-items:center;width:16px;color:var(--a-solid)}.lgmk svg{width:16px;height:16px}
.lgrow .lrt{font-size:14px;font-weight:500}
.lginp{width:132px;height:30px;display:flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:#fff;flex:none;cursor:text}
.lginp:focus-within,.lginp.focus{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.lginp input{border:0;outline:0;flex:1;min-width:0;font:500 13px/20px Inter,sans-serif;text-align:right;color:var(--text-primary);background:none;font-variant-numeric:tabular-nums}
.lginp .u,.lginp .pre{font-size:12px;color:var(--text-tertiary)}
.lgok{width:30px!important;height:30px!important;flex:none}.lgok svg{width:15px;height:15px}
.lgrow.logged .lginp,.lgrow.logged .lgok{display:none}
.lgrow.logged .lgdone{display:inline-flex}
.lgdone{display:none;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);flex:none}
.lgdone svg{width:15px;height:15px;color:#328f32}
/* needs a push */
.push .ag-body{padding:8px 16px 12px}
.push .crow{min-height:44px}
.push .crow .mark{width:16px;height:16px;display:grid;place-items:center;flex:none;margin:0}
.push .crow .mark svg{width:16px;height:16px}
.ibx .ibm{color:var(--text-tertiary)}
.ibx .lrt{font-size:14px}
.ibx{cursor:pointer;border-radius:6px}
.push .csec{margin-top:4px;padding-top:8px;border-top:1px solid var(--border)}
.push .csec+.csec{margin-top:8px}
.slink{display:inline-flex;align-items:center;gap:2px;cursor:pointer;border-radius:4px;padding:2px 4px 2px 0}
.slink svg{width:13px;height:13px;color:var(--text-tertiary)}
.slink:hover .t-label{color:var(--text-primary)}
.mmk{color:var(--a-solid)}
.push .rbm{width:12px;height:12px}
.push .pj{display:inline-flex;align-items:center;gap:3px}.push .pj svg{width:11px;height:11px;color:var(--a-solid)}
.slr{white-space:nowrap;flex:none}
.more{display:inline-block;font-size:12px;font-weight:500;color:var(--text-secondary);padding:4px 0 2px 26px;cursor:pointer}
.more:hover{color:var(--text-primary);text-decoration:underline;text-underline-offset:2px}
.push .ag-empty{padding:8px 0}
/* coming up */
.cucard .sbody{padding:0 8px 8px}
.cucard .aday:first-child{margin-top:0}
.pmk.tgt svg{width:14px;height:14px}
/* first run */
.hfrun{margin:auto;max-width:460px;gap:12px}
.hfrun .he-icon svg{width:24px;height:24px}
.frlist{width:100%;margin-top:12px;border:1px solid var(--border);border-radius:12px;padding:4px 16px;text-align:left}
.frrow{display:flex;align-items:center;gap:12px;min-height:56px}
.frrow+.frrow{border-top:1px solid #f1f2f4}
.frrow .lrt{font-size:14px}
.frc{width:20px;height:20px;border-radius:50%;border:2px dashed var(--n300);flex:none;display:grid;place-items:center;box-sizing:border-box}
.frc.ok{border:0;background:#328f32;color:#fff}.frc.ok svg{width:12px;height:12px;stroke-width:3}
.frrow .btn svg{width:14px;height:14px}
/* overlays */
.ov{display:none}
.hmenu{position:fixed;width:220px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:25;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.10)}
#nm{right:24px;top:64px}
.hmenu .mi{cursor:pointer}
.hmenu .mi kbd{margin-left:auto;font:500 11px/16px Inter,sans-serif;color:var(--text-tertiary);border:1px solid var(--border);border-radius:4px;padding:0 4px}
.htoast{left:calc(48px + (100vw - 48px)/2)!important;bottom:72px}
.htoast.on{display:flex}
#tip{position:fixed;z-index:60;display:none;background:#111827;color:#fff;font-size:11px;padding:4px 7px;border-radius:5px;pointer-events:none;white-space:nowrap}
.states{max-width:calc(100vw - 24px)}.states .seg{flex-wrap:wrap;height:auto;row-gap:2px}.states .seg span{white-space:nowrap;height:24px}
"""

JS = r"""
const ORIG={};document.querySelectorAll('.app.happ').forEach(a=>ORIG[a.id]=a.innerHTML);
const CHECK='<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',DASH='<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>';
const toastEl=document.getElementById('toast');let UNDO=null;
function toast(msg,undo){toastEl.querySelector('.tmsg').textContent=msg;toastEl.classList.add('on');UNDO=undo||null;
  toastEl.querySelector('.tundo').style.display=undo?'':'none';clearTimeout(window._tt);
  window._tt=setTimeout(()=>{if(!document.body.dataset.keep)toastEl.classList.remove('on')},6000)}
toastEl.querySelector('.tundo').onclick=()=>{if(UNDO)UNDO();UNDO=null;toastEl.classList.remove('on')};
function ringSvg(fr){const r=6,c=2*Math.PI*r;return `<svg class="rring" style="width:16px;height:16px" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="var(--n200)" stroke-width="2.5" fill="none"/>${fr>0?`<circle cx="8" cy="8" r="6" stroke="var(--acc600)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="${(c*fr).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 8 8)"/>`:''}</svg>`}
function recount(app){
  app.querySelectorAll('.aday[data-g]').forEach(g=>{const c=g.querySelector('.adh .counter');if(!c)return;
    const n=g.querySelectorAll('.gbody>.arow.task').length;c.textContent=n;
    if(g.dataset.g==='over')g.style.display=n?'':'none'});
  let tot=0,dn=0,st=0,sd=0;
  app.querySelectorAll('.tcard .arow.task').forEach(r=>{tot++;if(r.classList.contains('done'))dn++});
  app.querySelectorAll('.rblk').forEach(b=>{const rows=[...b.querySelectorAll('.drow')].filter(r=>!r.classList.contains('s'));
    const d=rows.filter(r=>r.classList.contains('d')).length;st+=rows.length;sd+=d;
    b.querySelector('.rbc').textContent=d+'/'+rows.length;b.querySelector('.rgw').innerHTML=ringSvg(rows.length?d/rows.length:0)});
  const rs=app.querySelector('.rtsub');if(rs)rs.textContent=sd+' of '+st;
  const h=app.querySelector('.hdone');if(h)h.textContent=(dn+sd)+' of '+(tot+st);}
function moveTo(row,g){const app=row.closest('.app');const body=app.querySelector(`.aday[data-g="${g}"] .gbody`);
  if(g==='done')body.prepend(row);else body.append(row);}
function setTask(row,done){row.classList.toggle('done',done);row.querySelector('.check').classList.toggle('done',done);}
function completeTask(row){const app=row.closest('.app');const from=row.parentElement,next=row.nextSibling;
  setTask(row,true);recount(app);const title=row.querySelector('.at').textContent;
  setTimeout(()=>{if(row.classList.contains('done')){moveTo(row,'done');recount(app)}},450);
  toast(title+' completed',()=>{setTask(row,false);from.insertBefore(row,next&&next.parentElement===from?next:null);recount(app)});}
document.addEventListener('click',e=>{
  if(e.target.closest('.states'))return;
  const app=e.target.closest('.app');
  const nm=document.getElementById('nm'),rm=document.getElementById('rm');
  if(!e.target.closest('#rm')&&!e.target.closest('.rbm2'))rm.style.display='';
  if(e.target.closest('.ncar')){const on=nm.style.display==='block';nm.style.display=on?'':'block';document.body.classList.toggle('k-new',!on);return}
  if(!e.target.closest('#nm')&&nm.style.display==='block'){nm.style.display='';document.body.classList.remove('k-new')}
  if(!app)return;
  const ck=e.target.closest('.arow.task .check');
  if(ck){const row=ck.closest('.arow');if(row.classList.contains('done')){setTask(row,false);moveTo(row,row.dataset.k==='ut'?'over':'tasks');recount(app)}else completeTask(row);return}
  const sb=e.target.closest('.sbt2');if(sb){sb.closest('.arow').classList.toggle('open');return}
  const sc=e.target.closest('.asub .scb');if(sc){const s=sc.parentElement;s.classList.toggle('d');sc.innerHTML=s.classList.contains('d')?CHECK:'';
    const row=s.closest('.arow');const all=row.querySelectorAll('.asub').length,d=row.querySelectorAll('.asub.d').length;
    row.querySelector('.sbt2').firstChild.textContent=d+'/'+all;return}
  const tm=e.target.closest('.rbtn.tmr');if(tm){const row=tm.closest('.arow');const from=row.parentElement,next=row.nextSibling;
    const title=row.querySelector('.at').textContent;row.remove();recount(app);
    toast(title+' moved to tomorrow',()=>{from.insertBefore(row,next&&next.parentElement===from?next:null);recount(app)});return}
  const tg=e.target.closest('.adh.tog');if(tg){tg.parentElement.classList.toggle('collapsed');return}
  if(e.target.closest('.rbm2')){const m=document.getElementById('rm');const b=e.target.closest('.rbm2').getBoundingClientRect();
    m.style.display='block';m.style.left=(b.right-220)+'px';m.style.top=(b.bottom+4)+'px';return}
  const rb=e.target.closest('.rtcard .drow .rb');
  if(rb){const row=rb.closest('.drow');if(row.classList.contains('s'))return;const d=!row.classList.contains('d');
    row.classList.toggle('d',d);row.classList.toggle('t',!d);rb.innerHTML=d?CHECK:'';const sk=row.querySelector('.skb');if(sk)sk.style.display=d?'none':'';
    recount(app);const blk=row.closest('.rblk');const left=[...blk.querySelectorAll('.drow')].filter(r=>!r.classList.contains('d')&&!r.classList.contains('s')).length;
    if(!left)setTimeout(()=>blk.classList.add('collapsed'),500);return}
  const sk=e.target.closest('.rtcard .skb');
  if(sk){const row=sk.closest('.drow');row.classList.remove('t');row.classList.add('s');row.querySelector('.rb').innerHTML=DASH;
    const lab=document.createElement('span');lab.className='dst';lab.textContent='Skipped';sk.replaceWith(lab);recount(app);
    toast(row.querySelector('.dt').textContent+' skipped for today',()=>{row.classList.remove('s');row.classList.add('t');row.querySelector('.rb').innerHTML='';
      lab.outerHTML='<span class="skb" title="Skip"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg></span>';recount(app)});return}
  const rh=e.target.closest('.rbh');if(rh&&!e.target.closest('.rbn')){rh.parentElement.classList.toggle('collapsed');return}
  const ok=e.target.closest('.lgok');if(ok){logMetric(ok.closest('.lgrow'));return}
});
function logMetric(row){const inp=row.querySelector('input');const v=inp.value.trim();if(!v){inp.focus();return}
  const u=row.dataset.u,p=row.dataset.p;const val=(p||'')+v+(u?(u==='h'?' h':' '+u):'');
  row.classList.add('logged');let dd=row.querySelector('.lgdone');if(!dd){dd=document.createElement('span');dd.className='lgdone';row.append(dd)}
  dd.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>'+val+' today';
  const app=row.closest('.app');const sub=app.querySelector('.lgcard .ssub');const left=app.querySelectorAll('.lgrow:not(.logged)').length;
  if(sub)sub.textContent=left?left+' to log':'All logged';
  toast(row.querySelector('.lrt').textContent+': '+val+' logged',()=>{row.classList.remove('logged');inp.value='';
    const l=app.querySelectorAll('.lgrow:not(.logged)').length;if(sub)sub.textContent=l+' to log'});}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){document.querySelectorAll('.ov').forEach(o=>o.style.display='');document.body.classList.remove('k-new');return}
  const q=e.target.closest&&e.target.closest('.qadd input');
  if(q&&e.key==='Enter'&&q.value.trim()){const app=q.closest('.app');const body=app.querySelector('.aday[data-g="tasks"] .gbody');
    if(body){const t=q.value.trim().replace(/</g,'&lt;');body.insertAdjacentHTML('afterbegin',
      `<div class="arow task noarea fresh" data-k="new"><span class="check"></span><div class="ab"><span class="at">${t}</span></div><span class="ract"><button class="rbtn tmr" data-tip="Sun, Nov 15"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>Tomorrow</button><button class="rbtn ic" data-tip="Pick date"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg></button></span></div>`);recount(app)}
    q.value='';return}
  const li=e.target.closest&&e.target.closest('.lginp input');if(li&&e.key==='Enter')logMetric(li.closest('.lgrow'));
  if(e.key==='z'&&(e.ctrlKey||e.metaKey)&&UNDO&&!e.target.closest('input')){UNDO();UNDO=null;toastEl.classList.remove('on')}
});
function showApp(id){document.querySelectorAll('.app.happ').forEach(a=>a.classList.toggle('show',a.id===id))}
const st=document.getElementById('st');
function setState(sp){st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===sp));
  document.querySelectorAll('.app.happ').forEach(a=>{a.innerHTML=ORIG[a.id]});
  document.querySelectorAll('.ov').forEach(o=>o.style.display='');toastEl.classList.remove('on');UNDO=null;
  document.body.className=sp.dataset.b||'';document.body.dataset.keep=sp.dataset.keep||'';
  showApp(sp.dataset.app);const app=document.getElementById(sp.dataset.app);
  (sp.dataset.ov||'').split(' ').filter(Boolean).forEach(id=>{const o=document.getElementById(id);if(o)o.style.display=o.classList.contains('panel')?'flex':'block'});
  const act=sp.dataset.act||'';
  if(act.startsWith('type:')){const q=app.querySelector('.qadd input');q.value=act.slice(5);q.closest('.qadd').classList.add('focus')}
  if(act.startsWith('done:')){completeTask(app.querySelector(`.arow[data-k="${act.slice(5)}"]`));}
  if(act.startsWith('step:')){const [r,i]=act.slice(5).split('|');app.querySelectorAll(`.rblk[data-r="${r}"] .drow`)[+i].querySelector('.rb').click()}
  if(act.startsWith('typelog:')){const [k,v]=act.slice(8).split('|');const row=app.querySelector(`.lgrow[data-m="${k}"]`);row.querySelector('input').value=v;row.querySelector('.lginp').classList.add('focus')}
  if(act.startsWith('log:')){const [k,v]=act.slice(4).split('|');const row=app.querySelector(`.lgrow[data-m="${k}"]`);row.querySelector('input').value=v;logMetric(row)}
  if(act==='open')app.querySelector('.arow[data-k="ut"]').classList.add('open');
  if(act==='more'){const b=app.querySelector('.rblk[data-r="eve"] .rbm2');b.style.opacity=1;b.click()}
}
st.onclick=e=>{const sp=e.target.closest('span[data-app]');if(sp)setState(sp)};
setState(st.querySelector('span.on'));
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){tip.style.display='none';return}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';});
"""

STATES = [  # label, app, overlays, body class, action, keep toast
    ('Normal (2:40 PM)', 'home', '', '', '', ''),
    ('Subtasks open', 'home', '', '', 'open', ''),
    ('Row actions (hover)', 'home', '', 'k-hover', '', ''),
    ('Task completed, undo toast', 'home', '', '', 'done:gh', '1'),
    ('Routine step checked', 'home', '', '', 'step:eve|1', ''),
    ('Quick add, typing', 'home', '', '', 'type:Call the landlord about the lease', ''),
    ('Logging a metric', 'home', '', '', 'typelog:study|2', ''),
    ('Metric logged, undo toast', 'home', '', '', 'log:study|2', '1'),
    ('New menu', 'home', 'nm', 'k-new', '', ''),
    ('Routine ⋯ menu', 'home', '', '', 'more', ''),
    ('New task', 'home', 'nt', '', '', ''),
    ('Detail panel', 'panel', 'pn', '', '', ''),
    ('Nothing needs a push', 'calm', '', '', '', ''),
    ('Nothing scheduled today', 'nothing', '', '', '', ''),
    ('All done', 'alldone', '', '', '', ''),
    ('First run', 'first0', '', '', '', ''),
    ('First run, area added', 'first1', '', '', '', ''),
]

RAIL = ''


def build():
    global RAIL
    cal = (SRC / 'approved-calendar.html').read_text(encoding='utf-8')
    i = cal.index('<nav class="rail"')
    RAIL = cal[i:cal.index('</nav>', i) + 6]
    RAIL = re.sub(r'<a class=on title="Calendar"', '<a title="Calendar"', RAIL).replace('<a title="Home"', '<a class=on title="Home"')
    RAIL = RAIL.replace('title="Execution"', 'title="Tasks"')
    br.RAIL = RAIL
    tk = (SRC / 'approved-tasks.html').read_text(encoding='utf-8')
    j = tk.index('<div class="pop2 nt0">')
    k = tk.index('<div class="pop2 nt1">')
    nt = tk[j:k].replace('<div class="pop2 nt0">', '<div class="pop2 ov" id="nt">', 1)
    # quick context: New task from Home starts scheduled today
    nt = nt.replace('<button class="chip2 ghost"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/>',
                    '<button class="chip2 "><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/>', 1)
    nt = re.sub(r'(<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>)Scheduled',
                r'\1Today', nt, count=1)
    tcss = tk[tk.index('<style>') + 7:tk.index('</style>')]
    ntcss = '\n'.join(l for l in re.split(r'(?<=\})', tcss) if re.search(r'\.ntchips|\.nts|\.ntsubs|\.inp \.ph2|\.caret\{', l))
    apps = (page('home') + page('panel', 'panel') + page('calm', 'calm') + page('nothing', 'nothing') + page('alldone', 'alldone')
            + first_run(0) + first_run(1))
    ovs = new_menu() + routine_menu() + nt + panel(cal) + TOAST
    sw = ''.join(f'<span{" class=on" if n == 0 else ""} data-app="{a}" data-ov="{o}" data-b="{b}" data-act="{x}" data-keep="{kp}">{l}</span>'
                 for n, (l, a, o, b, x, kp) in enumerate(STATES))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Home, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{base_css(cal)}{ntcss}{CSS}</style></head>
<body>
{apps}
{ovs}
<div class="states pstates"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{JS}</script>
</body></html>'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
