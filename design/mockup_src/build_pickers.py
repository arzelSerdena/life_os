"""Build html_mockups/approved-pickers.html (approved Nov 15): every picker, opened from the chip or field it belongs to.

Base: approved-detail-panel.html (projects overview page + floating detail panel). Each mock state shows one
panel (task, event or project) with one picker open under its chip. Pickers are fixed-position popovers so
they can sit over the page as well as the panel. Today is Sat, Nov 14, 2026 in every mock.

Usage: python build_pickers.py <approved-detail-panel.html> <approved-area.html> <out.html>
"""
import calendar
import re
import sys

import rules

TODAY = (2026, 11, 14)
MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
       'November', 'December']


def svg(d, w=None):
    return f'<svg viewBox="0 0 24 24">{d}</svg>'


I_CAL = svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>')
I_PREV = svg('<path d="m15 18-6-6 6-6"/>')
I_NEXT = svg('<path d="m9 18 6-6-6-6"/>')
I_CHEV = svg('<path d="m6 9 6 6 6-6"/>')
I_CHECK = svg('<path d="M20 6 9 17l-5-5"/>')
I_X = svg('<path d="M18 6 6 18M6 6l12 12"/>')
I_SUN = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>')
I_ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
I_SUNRISE = svg('<path d="M12 2v6M4.9 10.9l1.4 1.4M2 18h20M17.7 12.3l1.4-1.4M8 18a4 4 0 0 1 8 0"/>')
I_NEXTWK = svg('<path d="M3 12h13M12 6l6 6-6 6M21 5v14"/>')
I_FLAG = '<path d="M4 22V4l7 2 9-2v12l-9 2-7-2"/>'
I_INBOX = svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7H2v-7z"/>')
I_FOLDER = svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')
I_SEARCH = svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')
I_SECTION = svg('<path d="M4 6h16M4 12h16M4 18h10"/>')
I_REPEAT = svg('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>')
I_CLOCK = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')

CSS = """
.states:not(.pstates){display:none}
.pk{display:none;position:fixed;z-index:60;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.10);font:400 13px/18px Inter,sans-serif;color:var(--text-primary)}
.pk svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pk .r{height:30px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;cursor:pointer;white-space:nowrap}
.pk .r:hover,.pk .r.hov{background:var(--n100)}
.pk .r.on{font-weight:500}
.pk .r>svg{width:15px;height:15px;color:var(--text-tertiary);flex:none}
.pk .r .v{margin-left:auto;font-size:12px;color:var(--text-tertiary);font-weight:400}
.pk .r .ck{margin-left:auto;width:15px;height:15px;color:var(--acc600)}
.pk .r .v+.ck{margin-left:8px}
.pk .r.ind{padding-left:28px}
.pk .sep{height:1px;background:var(--border);margin:6px -6px}
.pk .lab{font-size:11px;line-height:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-tertiary);padding:8px 8px 4px}
.pk .fi{height:32px;display:flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:6px;background:#fff;
  font-size:13px;color:var(--text-primary);white-space:nowrap}
.pk .fi>svg{width:14px;height:14px;color:var(--text-tertiary);flex:none}
.pk .fi .ch{margin-left:auto;display:flex}.pk .fi .ch svg{width:12px;height:12px;color:var(--text-tertiary)}
.pk .fi.f{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.pk .fi .ph{color:var(--text-disabled)}
.pk .fi .caret{width:1px;height:16px;background:var(--text-primary);margin-left:-5px}
.pk .top{padding:2px 2px 6px}
.pk .cal{padding:4px 6px 2px}
.pk .ch2{display:flex;align-items:center;height:28px;padding:0 2px 0 4px;font-weight:600;font-size:13px}
.pk .ch2 .nav{margin-left:auto;display:flex;gap:2px}
.pk .ch2 .nav span{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:var(--text-tertiary)}
.pk .ch2 .nav span:hover{background:var(--n100)}
.pk .ch2 .nav svg{width:14px;height:14px}
.pk .gr{display:grid;grid-template-columns:repeat(7,32px);row-gap:2px}
.pk .pkw{height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-tertiary)}
.pk .d{height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;position:relative;cursor:pointer}
.pk .d i{font-style:normal;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;position:relative;z-index:1}
.pk .d:hover i{background:var(--n100)}
.pk .d.out{color:var(--text-disabled)}
.pk .d.tdy i{color:var(--acc700);font-weight:600;box-shadow:inset 0 0 0 1px var(--acc500)}
.pk .d.sel i{background:var(--acc600);color:#fff;font-weight:600;box-shadow:none}
.pk .d.pv i{box-shadow:inset 0 0 0 1px var(--acc600);background:var(--acc100)}
.pk .d.inr{background:var(--acc100)}
.pk .d.rs{background:linear-gradient(90deg,transparent 50%,var(--acc100) 50%)}
.pk .d.re{background:linear-gradient(90deg,var(--acc100) 50%,transparent 50%)}
.pk .d.rs.re{background:none}
.pk .two{display:flex;gap:16px}
.pk .row{display:flex;align-items:center;gap:8px}
.pk .row .k{width:44px;font-size:12px;color:var(--text-secondary)}
.pk .foot{display:flex;align-items:center;gap:8px;padding:6px 4px 2px}
.pk .foot .meta{font-size:12px;color:var(--text-tertiary)}
.pk .bt{height:28px;display:inline-flex;align-items:center;padding:0 12px;border-radius:6px;font:500 12px/16px Inter,sans-serif;
  border:1px solid var(--border);background:#fff;color:var(--text-secondary)}
.pk .bt.p{background:var(--acc700);border-color:var(--acc700);color:#fff}
.pk .sg{display:flex;background:var(--n200);border-radius:6px;padding:2px;height:28px}
.pk .sg span{flex:1;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:var(--text-secondary);border-radius:4px}
.pk .sg span.on{background:#fff;color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.pk .sw{width:28px;height:16px;border-radius:8px;background:var(--n300);position:relative;flex:none}
.pk .sw::after{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#fff}
.pk .sw.on{background:var(--acc600)}.pk .sw.on::after{left:14px}
.pk .days{display:flex;gap:4px}
.pk .days span{width:30px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--border);
  font-size:12px;font-weight:500;color:var(--text-secondary)}
.pk .days span.on{background:var(--acc600);border-color:var(--acc600);color:#fff}
.pk .num{width:56px;justify-content:center}
.pk .q{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:2px 4px 4px}
.pk .q div{height:52px;border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;justify-content:center;padding:0 12px;cursor:pointer}
.pk .q div b{font-size:13px;font-weight:600}.pk .q div span{font-size:12px;color:var(--text-tertiary)}
.pk .q div.on{border-color:var(--acc600);background:var(--acc100)}.pk .q div.on b{color:var(--acc700)}
.pk .dt{width:8px;height:8px;border-radius:2px;flex:none}
.pk .flag{width:15px;height:15px;flex:none}
.pk .lst{max-height:none}
.pkx{display:none;position:fixed;z-index:61}
.chip2.op,.crumb span.op,.pnav .pl.op{box-shadow:0 0 0 2px var(--acc200);border-color:var(--acc600);border-radius:6px;color:var(--text-primary)}
.crumb span.op{background:var(--n100);padding:0 4px;margin:0 -4px}
"""

AREAS = [('Career', '#3579c2', ['Resume &amp; portfolio', 'Hackathon prep', 'Life OS app']),
         ('Finance', '#11bbb3', ['Emergency fund']),
         ('Health &amp; Beauty', '#ca6a93', ['5K training']),
         ('Personal', '#b181b4', ['Reading challenge']),
         ('Relationships', '#cba927', []),
         ('Home', '#cc6b43', ['Room makeover'])]


def cal(y, m, sel=(), today=TODAY, rng=None, pv=None, nav='both'):
    """Month grid, Monday first. sel: day numbers in this month; rng: ((y,m,d),(y,m,d)) shaded range."""
    weeks = calendar.Calendar(0).monthdatescalendar(y, m)
    cells = ''.join(f'<span class="pkw">{w}</span>' for w in 'MTWTFSS')
    for wk in weeks:
        for d in wk:
            c = ['d']
            t = (d.year, d.month, d.day)
            if d.month != m:
                c.append('out')
            if t == today:
                c.append('tdy')
            if d.month == m and d.day in sel:
                c.append('sel')
            if pv and t == pv:
                c.append('pv')
            if rng and d.month == m:
                a, b = rng
                if a <= t <= b:
                    c.append('inr')
                    if t == a:
                        c.append('rs')
                    if t == b:
                        c.append('re')
                    if t in (a, b):
                        c.append('sel')
            cells += f'<span class="{" ".join(c)}"><i>{d.day}</i></span>'
    navh = ('<span class="nav">' + (f'<span>{I_PREV}</span>' if nav in ('both', 'prev') else '')
            + (f'<span>{I_NEXT}</span>' if nav in ('both', 'next') else '') + '</span>')
    return f'<div class="cal"><div class="ch2">{MON[m - 1]} {y}{navh}</div><div class="gr">{cells}</div></div>'


def row(label, icon='', v='', on=False, cls='', check=None):
    ck = f'<span class="ck">{I_CHECK}</span>' if (on if check is None else check) else ''
    vv = f'<span class="v">{v}</span>' if v else ''
    return f'<div class="r{" on" if on else ""}{" " + cls if cls else ""}">{icon}{label}{vv}{ck}</div>'


def fi(text, icon='', cls='', w=None, chev=False, ph=False):
    st = f' style="width:{w}px"' if w else ''
    t = f'<span class="ph">{text}</span>' if ph else text
    ch = f'<span class="ch">{I_CHEV}</span>' if chev else ''
    return f'<div class="fi{" " + cls if cls else ""}"{st}>{icon}{t}{ch}</div>'


def pop(state, left, top, width, body, extra=''):
    return f'<div class="pk {state}" style="left:{left}px;top:{top}px;width:{width}px{extra}">{body}</div>'


def date_picker(state, left, top, value, sel_day, clear_label, typed=None, hover=None):
    if typed:
        top_f = fi(f'{typed}<span class="caret"></span>', I_CAL, 'f')
        quick = row('Friday', I_CAL, 'Fri, Nov 20', cls='hov')
        grid = cal(2026, 11, sel=(), pv=(2026, 11, 20))
    else:
        top_f = fi(value, I_CAL, 'f')
        # Approved: Tasks (Nov 15): Today, Tomorrow, Next week as three icon buttons under the field; the date shows on hover
        quick = '<div class="qrow">' + ''.join(
            f'<span class="qb{" hov" if (hover == t) else ""}" data-tip="{t} · {d}">{ic}</span>'
            for t, d, ic in [('Today', 'Sat, Nov 14', I_SUN), ('Tomorrow', 'Sun, Nov 15', I_SUNRISE), ('Next week', 'Mon, Nov 16', I_NEXTWK)]) + '</div>'
        grid = cal(2026, 11, sel=(sel_day,))
    # no "Unscheduled" row; the due picker keeps "No due date"
    clear = f'<div class="sep"></div>{row(clear_label, I_X)}' if clear_label else ''
    body = f'<div class="top">{top_f}</div>{quick}<div class="sep"></div>{grid}{clear}'
    return pop(state, left, top, 252, body)


QCSS = """
.pk .qrow{display:flex;gap:6px;align-items:center;padding:0 2px}
.pk .qrow .qb{flex:1;height:30px;display:grid;place-items:center;border-radius:6px;border:1px solid var(--border);color:var(--text-secondary);cursor:pointer;position:relative}
.pk .qrow .qb:hover,.pk .qrow .qb.hov{background:var(--n100);color:var(--text-primary)}.pk .qrow .qb svg{width:15px;height:15px}
.pk .qb[data-tip]:hover::after,.pk .qb.hov::after{content:attr(data-tip);position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#111827;color:#fff;
  font-size:12px;line-height:16px;font-weight:500;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:5;pointer-events:none}
"""


STEP_GROUPS = [('Evening routine', 'Daily', [('Practice LeetCode 30 min', '#3579c2'), ('Read 10 pages', '#b181b4'),
                                            ("Plan tomorrow's top task", '#3579c2')]),
               ('Weekly reset', 'Sundays', [('Update the job tracker', '#3579c2'), ('Review job applications', '#3579c2'),
                                            ('Post one LinkedIn update', '#3579c2')])]


def step_modal(area_html):
    m = re.search(r'<div class="pop2 s-metric-step">', area_html)
    blk = area_html[m.start():rules._block(area_html, m.start())]
    blk = blk.replace('pop2 s-metric-step', 'pop2 s-kstep', 1)
    # the Routine step field shows as open while its picker is showing
    i = blk.find('<span class="inp pick">', blk.find('<span class="inp pick">') + 1)
    blk = blk[:i] + '<span class="inp pick open">' + blk[i + len('<span class="inp pick">'):]
    css = ''.join(re.findall(r'\.(?:mf|tbox|fld|fl2|frow2|dwrap|dtip|scrim3|modal3|m-head|m-body|m-foot)[^{]*\{[^}]*\}', area_html))
    return blk, css


def build(src, area_html):
    html = src
    pops = []
    # 1 Due date (task, chip 2)
    pops.append(date_picker('k-due', 1605, 149, 'Nov 4, 2026', 4, 'No due date', hover='Tomorrow'))
    # 2 Typing a date
    pops.append(date_picker('k-type', 1605, 149, '', None, 'No due date', typed='fri'))
    # 3 Scheduled date (task, chip 3)
    pops.append(date_picker('k-sched', 1537, 179, 'Sat, Nov 14', 14, None))
    # 4 Date range (project, chip 2): start → due
    rng = ((2026, 10, 20), (2026, 11, 30))
    body = (f'<div class="top row">{fi("Oct 20, 2026", I_CAL, w=230)}<span style="display:flex;color:var(--text-tertiary)">'
            f'{I_ARROW}</span>{fi("Nov 30, 2026", I_CAL, "f", w=230)}</div>'
            f'<div class="two">{cal(2026, 10, rng=rng, nav="prev")}{cal(2026, 11, rng=rng, nav="next")}</div><div class="sep"></div>'
            '<div class="foot"><span class="meta">42 days</span><span style="flex:1"></span>'
            f'<span class="r" style="height:28px">{I_X}No due date</span></div>')
    pops.append(pop('k-range', 1241, 149, 536, body))
    # 5 Event date and time, end-time list open
    evt = (f'<div class="top" style="display:flex;flex-direction:column;gap:8px;padding:6px">'
           f'<div class="row"><span class="k">Starts</span>{fi("Fri, Nov 20", I_CAL, w=136)}{fi("2:00 PM", I_CLOCK, w=104)}</div>'
           f'<div class="row"><span class="k">Ends</span>{fi("Fri, Nov 20", I_CAL, w=136)}{fi("3:00 PM", I_CLOCK, "f", w=104)}</div>'
           '<div class="sep" style="margin:2px -12px"></div>'
           '<div class="row"><span class="k" style="width:auto">All day</span><span style="flex:1"></span><span class="sw"></span></div></div>')
    pops.append(pop('k-time', 1537, 149, 316, evt))
    times = [('2:15 PM', '15 m'), ('2:30 PM', '30 m'), ('2:45 PM', '45 m'), ('3:00 PM', '1 h'), ('3:15 PM', '1 h 15 m'),
             ('3:30 PM', '1 h 30 m'), ('3:45 PM', '1 h 45 m'), ('4:00 PM', '2 h')]
    tl = ''.join(row(t, '', d, on=(t == '3:00 PM')) for t, d in times)
    pops.append(f'<div class="pk k-time" style="left:1735px;top:233px;width:180px;z-index:62">{tl}</div>')
    # 6 Event, all day over several days (panel clone with its chip text)
    ev2 = (f'<div class="top" style="display:flex;flex-direction:column;gap:8px;padding:6px">'
           f'<div class="row"><span class="k">Starts</span>{fi("Fri, Nov 20", I_CAL, w=244)}</div>'
           f'<div class="row"><span class="k">Ends</span>{fi("Sun, Nov 22", I_CAL, "f", w=244)}</div>'
           '<div class="sep" style="margin:2px -12px"></div>'
           '<div class="row"><span class="k" style="width:auto">All day</span><span style="flex:1"></span><span class="sw on"></span></div></div>'
           f'<div class="sep"></div>{cal(2026, 11, rng=((2026, 11, 20), (2026, 11, 22)))}')
    pops.append(pop('k-days', 1537, 149, 316, ev2))
    # 7 Repeat presets (task Repeat chip, right-aligned)
    rep = (row('Does not repeat', on=True) + '<div class="sep"></div>' + row('Every day') + row('Every weekday', v='Mon – Fri')
           + row('Every week', v='Sat') + row('Every month', v='on the 14th') + row('Every year', v='Nov 14')
           + '<div class="sep"></div>' + f'<div class="r">Custom<span class="v" style="display:flex">{I_NEXT}</span></div>')
    pops.append(pop('k-rep', 1530, 179, 260, rep))
    # 8 Custom repeat
    days = ''.join(f'<span{" class=on" if i in (1, 5) else ""}>{d}</span>' for i, d in enumerate(['M', 'T', 'W', 'T', 'F', 'S', 'S']))
    cus = ('<div style="display:flex;flex-direction:column;gap:12px;padding:8px 8px 4px">'
           f'<div class="row"><span class="k">Every</span>{fi("1", cls="num")}{fi("week", w=120, chev=True)}</div>'
           f'<div class="row"><span class="k">On</span><div class="days">{days}</div></div>'
           '<div class="row"><span class="k">From</span><div class="sg" style="flex:1"><span class="on">Schedule</span><span>Completion</span></div></div>'
           '<div class="row" style="align-items:flex-start"><span class="k" style="line-height:28px">Ends</span><div style="flex:1;display:flex;flex-direction:column;gap:6px">'
           '<div class="sg"><span>Never</span><span class="on">On a date</span><span>After</span></div>'
           f'{fi("Feb 27, 2027", I_CAL, "f")}</div></div>'
           '</div><div class="sep"></div><div class="foot"><span class="meta">Tue, Sat · until Feb 27</span><span style="flex:1"></span>'
           '<span class="bt">Cancel</span><span class="bt p">Done</span></div>')
    pops.append(pop('k-custom', 1470, 179, 320, cus))
    # 9 Priority
    pr = [('High', '#cc363c', 'Do'), ('Medium', '#d97706', 'Schedule'), ('Low', '#9ca3af', 'Delegate'), ('None', None, 'Eliminate')]
    prb = ''.join(row(n, (f'<svg class="flag" viewBox="0 0 24 24" style="color:{c}">{I_FLAG}</svg>' if c else
                          '<svg class="flag" viewBox="0 0 24 24"></svg>'), q, on=(n == 'High')) for n, c, q in pr)
    pops.append(pop('k-pri', 1537, 149, 220, prb))
    # 10 Owner (crumb: area / project)
    ob = f'<div class="top">{fi("Search", I_SEARCH, "f", ph=True)}</div>' + row('Inbox', I_INBOX) + '<div class="sep"></div>'
    for a, col, projects in AREAS:
        ob += row(a, f'<span class="dt" style="background:{col}"></span>')
        for p in projects:
            ob += row(p, I_FOLDER, cls='ind', on=(p == 'Resume &amp; portfolio'))
    pops.append(pop('k-owner', 1553, 58, 280, ob))
    # 11 Section (crumb: section)
    sb = (row('No section', I_SECTION) + '<div class="sep"></div>' + row('Resume', I_SECTION, on=True)
          + row('Portfolio', I_SECTION) + row('LinkedIn', I_SECTION))
    pops.append(pop('k-sec', 1586, 58, 200, sb))
    # 12 Period (page header label), quarter view
    qb = (f'<div class="ch2" style="padding:0 2px 4px 8px">2026<span class="nav"><span>{I_PREV}</span><span>{I_NEXT}</span></span></div>'
          '<div class="q"><div><b>Q1</b><span>Jan – Mar</span></div><div><b>Q2</b><span>Apr – Jun</span></div>'
          '<div><b>Q3</b><span>Jul – Sep</span></div><div class="on"><b>Q4</b><span>Oct – Dec</span></div></div>')
    pops.append(pop('k-per', 1600, 53, 252, qb))

    # 13 Routine step (New metric pop-up, Source = Routine step)
    sb2 = f'<div class="top">{fi("Search", I_SEARCH, "f", ph=True)}</div>'
    for name, sched, steps in STEP_GROUPS:
        sb2 += f'<div class="lab">{name} · {sched}</div>'
        sb2 += ''.join(row(st, f'<span class="dt" style="background:{c}"></span>') for st, c in steps)
    pops.append(pop('k-step', 720, 544, 320, sb2))
    modal, mcss = step_modal(area_html)
    html = html.replace('</body>', modal + '</body>', 1)

    # Event panel clone for the multi-day state
    m = re.search(r'<aside class="panel dpanel pnl-event career"', html)
    end = html.find('</aside>', m.start()) + 8
    ev = html[m.start():end].replace('pnl-event career', 'pnl-event2 career', 1)
    ev = re.sub(r'<button class="chip2 ">(<svg[^>]*><path d="M17 2l3 3-3 3"/>.*?</svg>)Weekly</button>',
                r'<button class="chip2 ghost">\1Repeat</button>', ev, count=1, flags=re.S)
    ev = ev.replace('Fri, Nov 20 · 2:00 – 3:00 PM', 'Fri – Sun, Nov 20 – 22 · All day').replace('Mock interview with Ana', 'Hackathon weekend')
    html = html[:end] + ev + html[end:]

    states = [('p-task k-due', 'Due date'), ('p-task k-type', 'Typing a date'), ('p-task k-sched', 'Scheduled date'),
              ('p-project k-range', 'Date range'), ('p-event k-time', 'Event time'), ('p-event2 k-days', 'Event, several days'),
              ('p-task k-rep', 'Repeat'), ('p-task k-custom', 'Custom repeat'), ('p-task k-pri', 'Priority'),
              ('p-task k-owner', 'Owner'), ('p-task k-sec', 'Section'), ('k-per', 'Period'), ('k-step', 'Routine step')]
    seg = ''.join(f'<span{" class=on" if i == 0 else ""} data-p="{c}">{t}</span>' for i, (c, t) in enumerate(states))
    html = re.sub(r'(<div class="seg" id="pst">).*?(</div>)', lambda mm: mm.group(1) + seg + mm.group(2), html, count=1, flags=re.S)
    # open-chip highlights
    opens = ('body.k-due .pnl-task .chips .chip2:nth-child(2),body.k-type .pnl-task .chips .chip2:nth-child(2),'
             'body.k-sched .pnl-task .chips .chip2:nth-child(3),body.k-rep .pnl-task .chips .chip2:nth-child(4),'
             'body.k-custom .pnl-task .chips .chip2:nth-child(4),body.k-pri .pnl-task .chips .chip2:nth-child(1),'
             'body.k-range .pnl-project .chips .chip2:nth-child(2),body.k-time .pnl-event .chips .chip2:nth-child(1),'
             'body.k-days .pnl-event2 .chips .chip2:nth-child(1)'
             '{box-shadow:0 0 0 2px var(--acc200);border-color:var(--acc600);color:var(--text-primary)}'
             'body.k-owner .pnl-task .crumb span:nth-child(3),body.k-sec .pnl-task .crumb span:nth-child(5),'
             'body.k-per .pnav .pl{background:var(--n100);border-radius:4px;box-shadow:0 0 0 2px var(--acc200);color:var(--text-primary)}'
             'body.p-event2 .pnl-event2{display:flex}')
    shows = ','.join(f'body.{k} .pk.{k}' for k in ['k-due', 'k-type', 'k-sched', 'k-range', 'k-time', 'k-days', 'k-rep',
                                                     'k-custom', 'k-pri', 'k-owner', 'k-sec', 'k-per', 'k-step']) + '{display:block}.pop2.s-kstep{display:none}body.k-step .pop2.s-kstep{display:block}.s-kstep .dtip{display:none}'
    html = html.replace('</style>', CSS + QCSS + mcss + opens + shows + '</style>', 1)
    html = html.replace('</body>', ''.join(pops) + '</body>', 1)
    html = re.sub(r'<title>.*?</title>', '<title>Life OS — Pickers</title>', html, count=1)
    html = re.sub(r'<body class="[^"]*"', '<body class="s-n p-task k-due"', html, count=1)
    return rules.apply(html)


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    area = open(sys.argv[2], encoding='utf-8').read()
    out = build(src, area)
    assert out == rules.apply(out)
    open(sys.argv[3], 'w', encoding='utf-8').write(out)
    print('wrote', sys.argv[3], len(out))
