"""Build html_mockups/approved-calendar.html: the Calendar screen, Week, Month, Quarter and Year (all approved Nov 15;
Month, Quarter and Year live in build_cal_views.py).

One screen. The header has the Week / Month / Quarter / Year switch on the left and the range beside it; no page
title, no Add button. The sidebar is the filter menu (life areas, what to show, priority) and switches the right
panel between Agenda and Inbox. The agenda lists exactly what the calendar shows. Clicking a day cell opens an add
menu where you clicked. Past events and done items are lighter. Multi-day bars are packed into as few lines as fit.
Today is Sat, Nov 14, 2026; the week is Nov 9 – 15.

Usage: python build_calendar.py <approved-detail-panel.html> <approved-area.html> <out.html>
"""
import re
import sys

TIME_00 = re.compile(r'(?<![\d:])(\d{1,2}):00(?=\s?(?:AM|PM)\b|\s–)')


def short_times(html):
    """Times on the hour drop their :00 (10 AM, 7 – 9 PM); 12:30 PM stays."""
    return TIME_00.sub(r'\1', html)

import build_cal_views as cv
import build_cal_week as cw
import build_next7 as nb
import build_pickers as bp
import rules

S = bp.svg
I_CAL, I_REP, I_FOLD, I_CHK, I_X, I_PLUS, I_CHEV = nb.I_CAL, nb.I_REP, nb.I_FOLD, nb.I_CHK, nb.I_X, nb.I_PLUS, nb.I_CHEV
I_AGENDA = S('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>')
I_CLOSE_P = S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18M10 9l3 3-3 3"/>')
I_SUBS = S('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18h4"/>')
I_TASK = S('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>')
DAYS = nb.DAYS
TODAY_I = nb.TODAY_I
MONTH_DAY = ['Nov 9', 'Nov 10', 'Nov 11', 'Nov 12', 'Nov 13', 'Nov 14', 'Nov 15']
INBOX = [('Call the bank about the card', None, True), ('Renew passport', 'Dec 1', False),
         ('Look up dentist reviews', None, False), ('Buy a birthday card for Ana', 'Nov 18', False)]

# variant: (area filter, data variant, right panel)
VARIANTS = {'normal': ('all', 'normal', 'agenda'), 'collapsed': ('all', 'normal', None), 'inbox': ('all', 'normal', 'inbox'),
            'career': ('career', 'normal', 'agenda'), 'cancel': ('all', 'cancel', 'agenda'), 'empty': ('all', 'empty', 'agenda'),
            'none': ('all', 'none', 'agenda'), 'drag': ('all', 'drag', 'inbox'), 'undo': ('all', 'undo', 'agenda'), 'inboxdue': ('all', 'normal', 'inboxdue'), 'subs': ('all', 'subs', 'agenda')}


# ---------------------------------------------------------------- data
def data(scope, v):
    _, days, lane = nb.week(scope, v if v in ('cancel', 'undo') else 'normal')
    if v in ('empty', 'none'):
        days, lane = [[] for _ in range(7)], []
    return days, lane


def pack(lane):
    """Give each multi-day bar the first line where it fits, so short bars share a line."""
    rows, out = [], []
    for b in sorted(lane, key=lambda b: (b[2], -(b[3] - b[2]))):
        for r, end in enumerate(rows):
            if b[2] > end:
                rows[r] = b[3]
                out.append((r, b))
                break
        else:
            rows.append(b[3])
            out.append((len(rows) - 1, b))
    return len(rows), out


# ---------------------------------------------------------------- week grid
def week_grid(scope, v):
    days, lane = data(scope, v)
    cur = v not in ('empty', 'none')
    start = 7 if v == 'empty' else 9
    out = ''
    for i, (dn, _) in enumerate(DAYS):
        we = ' we' if i >= 5 else ''
        cls = (' pst' if i < TODAY_I else ' tdc' if i == TODAY_I else '') if cur else ''
        out += f'<div class="ccol{we}{cls}{" last" if i == 6 else ""} c{i}" style="grid-column:{i + 1};grid-row:1/-1"></div>'
        out += (f'<div class="cdh{cls}" style="grid-column:{i + 1};grid-row:1"><span class="cwd">{dn}</span>'
                f'<span class="cdn">{start + i}</span></div>')
    nrows, placed = pack(lane)
    entries = []
    for i in range(7):
        body = []
        for c in cw.order(days[i]):
            e = re.sub(r'<svg class="fl"[^>]*>.*?</svg>', '', cw.entry(c, i), flags=re.S)
            if c['t'] == 'task' and c['subs']:
                n = sum(1 for _, d in c['subs'] if d)
                opened = v == 'subs' and c['key'] == 'ut'
                e = e[:-6] + f'<span class="sbc">{n}/{len(c["subs"])}{I_CHEV}</span></div>'
                e = (f'<div class="etk{" open" if opened else ""}">{e}<div class="esubs">' + ''.join(
                    f'<div class="esub{" d" if d else ""}"><span class="scb">{I_CHK if d else ""}</span><span class="nm">{t}</span></div>'
                    for t, d in c['subs']) + '</div></div>')
            if i < TODAY_I and cur:
                e = e.replace('class="ent ', 'class="ent past ', 1)
            body.append(e)
        if v == 'drag' and i == 6:
            k = next(n for n, h in enumerate(body) if '<div class="ent tk career">' in h)
            body.insert(k, '<div class="slot2"></div>')
        entries.append(body)
    # entries fill the free lines beside the bars first, so no day starts with a blank line
    lanes, gaps, rest, start = cv.fill_lanes(7, [(r, b[2], b[3]) for r, b in placed], entries)
    for r, (t, a, s, e, since, until, tm) in placed:
        cut = (' cutl' if since else '') + (' cutr' if until else '')
        past = ' past' if e < TODAY_I else ''
        extra = (f'<span class="lbm">{since}</span>' if since else '') + (f'<span class="lbm">{tm}</span>' if tm else '')
        out += (f'<div class="cwbar wl {a}{cut}{past}" style="grid-column:{s + 1}/{e + 2};grid-row:{r + 3}">'
                f'<span class="lbt">{t}</span>{extra}</div>')
    for i in range(7):
        for r, h in gaps[i]:
            out += f'<div class="wgap c{i}" style="grid-column:{i + 1};grid-row:{r + 3}">{h}</div>'
        out += f'<div class="ccel c{i}" style="grid-column:{i + 1};grid-row:{start[i] + 3}/-1">{"".join(rest[i])}</div>'
    rows = f'36px 6px {"repeat(%d,auto) " % lanes if lanes else ""}minmax(0,1fr)'
    if v == 'none':
        out += (f'<div class="wempty" style="grid-column:1/8;grid-row:2/-1"><span>No events or tasks yet.</span>'
                f'<button class="btn primary">{I_PLUS}New event</button></div>')
    return f'<div class="cwk"><div class="cwg" style="grid-template-rows:{rows}">{out}</div></div>'


# ---------------------------------------------------------------- agenda and inbox panels (approved agenda design)
DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
FULL = ['Mon, Nov 9', 'Tue, Nov 10', 'Wed, Nov 11', 'Thu, Nov 12', 'Fri, Nov 13', 'Sat, Nov 14', 'Sun, Nov 15']


def sub_toggle(n, tot, opened=False):
    return f'<span class="sbt2">{n}/{tot}{I_CHEV}</span>'


def sub_list(subs):
    return '<div class="asubs">' + ''.join(f'<div class="asub{" d" if d else ""}"><span class="scb">{I_CHK if d else ""}</span>{t}</div>'
                                           for t, d in subs) + '</div>'


def arow(kind, area, title, meta, past=False, done=False, mark='', tail='', below='', opened=False):
    cls = f'arow{" ev" if kind == "ev" else ""} {area or "noarea"}{" past" if past else ""}{" done" if done else ""}{" open" if opened else ""}'
    if kind == 'ev':
        m = f'<span class="ev-icon">{I_CAL}</span>'
    elif kind == 'task':
        m = f'<span class="check{" done" if done else ""}"></span>'
    else:
        m = f'<span class="mark pmk">{mark}</span>'
    meta = f'<span class="t-meta am">{meta}{tail}</span>' if (meta or tail) else ''
    return f'<div class="{cls}">{m}<div class="ab"><span class="at">{title}</span>{meta}{below}</div></div>'


OPEN_SUBS = [False]


def ag_rows(c, i):
    past = i < TODAY_I
    if c['t'] == 'event':
        return arow('ev', c['area'], c['title'], c['time'], past)
    if c['t'] == 'rout':
        n = sum(1 for s in c['steps'] if s[2] == 'done')
        return arow('mark', 'noarea', c['title'], f'Routine · {n}/{len(c["steps"])}', past, mark=nb.ring(n / len(c['steps'])))
    if c['t'] == 'proj':
        return arow('mark', c['area'], c['title'], 'Project due', past, mark=I_FOLD)
    meta = []
    if c['due']:
        meta.append(f'<span class="{"overdue" if c["over"] else ""}">Due {c["due"]}</span>')
    if c['proj']:
        meta.append(f'{I_FOLD}{c["proj"]}')
    elif c['area'] is None:
        meta.append('Inbox')
    tail = below = ''
    if c['subs']:
        opened = OPEN_SUBS[0] and c['key'] == 'ut'
        tail = sub_toggle(sum(1 for _, d in c['subs'] if d), len(c['subs']))
        below = sub_list(c['subs'])
        return arow('task', c['area'], c['title'], ' · '.join(meta), past, c['done'] or c['cancel'], tail=tail, below=below, opened=opened)
    return arow('task', c['area'], c['title'], ' · '.join(meta), past, c['done'] or c['cancel'])


def ag_card(title, extra, body):
    return (f'<aside class="agenda"><header class="ag-head"><span class="stitle">{title}</span>{extra}'
            f'<span class="icon-btn" style="margin-left:auto" title="Hide panel">{I_CLOSE_P}</span></header>'
            f'<div class="ag-body">{body}</div></aside>')


def agenda(scope, v):
    OPEN_SUBS[0] = v == 'subs'
    days, lane = data(scope, v)
    body = ''
    for i in range(7):
        rows = ''
        for t, a, s, e, since, until, tm in lane:
            if s == i or (i == 0 and since):
                meta = tm or (f'All day · until {MONTH_DAY[e]}' if since else ('All day' if s == e else f'All day · until {MONTH_DAY[e]}'))
                rows += arow('ev', a, t, meta, e < TODAY_I)
        rows += ''.join(ag_rows(c, i) for c in cw.order(days[i]))
        if not rows:
            continue
        lab = 'Today' if i == TODAY_I else ('Tomorrow' if i == TODAY_I + 1 else DOW[i])
        meta = FULL[i] if i in (TODAY_I, TODAY_I + 1) else MONTH_DAY[i]
        body += (f'<div class="aday{" isday" if i == TODAY_I else ""}"><div class="adh"><span class="t-label">{lab}</span>'
                 f'<span class="t-meta">{meta}</span></div>{rows}</div>')
    if not body:
        body = '<div class="ag-empty"><span class="t-meta">Nothing scheduled.</span></div>'
    return ag_card('Agenda', '', body)


# tasks with no scheduled date / with no due date (owned or not)
NO_SCHED = [('Write case study for Life OS', 'career', f'{I_FOLD}Resume &amp; portfolio'), ('Research index funds', 'finance', f'{I_FOLD}Emergency fund'),
            ('Buy running shoes', 'health', f'Due Nov 20 · {I_FOLD}5K training'), ('Fix the leaky faucet', 'home', 'Home'),
            ('Call the bank about the card', None, 'Inbox'), ('Renew passport', None, 'Due Dec 1 · Inbox')]
NO_DUE = [('Write case study for Life OS', 'career', f'{I_FOLD}Resume &amp; portfolio'), ('Research index funds', 'finance', f'{I_FOLD}Emergency fund'),
          ('Clean up GitHub profile', 'career', f'Sat, Nov 14 · {I_FOLD}Life OS app'), ('Buy groceries', None, 'Sat, Nov 14 · Inbox'),
          ('Water the plants', 'home', 'Sun, Nov 15 · Home'), ('Fix the leaky faucet', 'home', 'Home'), ('Call the bank about the card', None, 'Inbox')]


def inbox(v, mode='sched'):
    items = NO_SCHED if mode == 'sched' else NO_DUE
    rows = ''
    for t, a, meta in items:
        ws = t.startswith('Write case study')
        r = arow('task', a, t, meta, tail=sub_toggle(0, 2) if ws else '', below=sub_list([('Outline', False), ('Screenshots', False)]) if ws else '')
        if v == 'drag' and t == 'Renew passport':
            r = r.replace('class="arow ', 'class="arow src ', 1)
        rows += r
    seg = f'<div class="sg2"><span{" class=on" if mode == "sched" else ""}>Scheduled</span><span{" class=on" if mode == "due" else ""}>Due</span></div>'
    return ag_card('Inbox', f'<span class="counter">{len(items)}</span>{seg}', f'<div class="ibl">{rows}</div>')


# ---------------------------------------------------------------- sidebar and header
def fx(label, on=True, color=None, icon=''):
    st = f' style="--c:{color}"' if color else ''
    return f'<div class="fxr"><span class="fx{" on" if on else ""}"{st}>{I_CHK}</span>{icon}<span>{label}</span></div>'


def sidebar(scope, v, panel, we=True, routines=True):
    def it(inner, on):
        return f'<div class="item{" on" if on else ""}">{inner}</div>'
    s = ('<div class="sgroup"><span class="sg-name">Panel</span></div>'
         + it(f'<span class="mark si">{I_AGENDA}</span>Agenda', panel == 'agenda')
         + it(f'<span class="mark si">{nb.I_INBOX}</span>Inbox<span class="sct">{len(NO_SCHED)}</span>', panel in ('inbox', 'inboxdue'))
         + '<div class="side-divider"></div><div class="sgroup"><span class="sg-name">Life areas</span></div>')
    for k, (n, col) in nb.AREA.items():
        s += fx(n, scope == 'all' or scope == k, col)
    s += fx('No area', scope == 'all', '#9ca3af')
    s += ('<div class="side-divider"></div><div class="sgroup"><span class="sg-name">Show</span></div>'
          + fx('Events') + fx('Tasks') + (fx('Routine steps') + fx('Project due dates') if routines else fx('Projects')) + fx('Completed')
          + fx('Cancelled', v == 'cancel') + fx('Weekends', we)
          + '<div class="side-divider"></div><div class="sgroup"><span class="sg-name">Priority</span></div>')
    for k, n in [('high', 'High'), ('med', 'Medium'), ('low', 'Low'), ('none', 'None')]:
        s += fx(n, True, None, nb.icon_flag(k) if k in nb.PRI else '<span style="width:13px"></span>')
    return f'<aside class="side cal-side">{s}<div class="grow"></div></aside>'


def header(v, view='Week', label=None, today=None):
    label = label or ('Dec 7 – 13' if v == 'empty' else 'Nov 9 – 15')
    today = '<button class="btn tdy">Today</button>' if (v == 'empty' if today is None else today) else ''
    vs = ''.join(f'<span{" class=\"on\"" if x == view else ""}>{x}</span>' for x in ('Week', 'Month', 'Quarter', 'Year'))
    return (f'<div class="calhead"><div class="vsw">{vs}</div>'
            f'<div class="rng"><span class="icon-btn">{nb.I_PREV}</span><span class="rl">{label}</span>'
            f'<span class="icon-btn">{nb.I_NEXT}</span></div>{today}</div>')


def app(rail, key):
    scope, v, panel = VARIANTS[key]
    rp = agenda(scope, v) if panel == 'agenda' else (inbox(v) if panel == 'inbox' else (inbox(v, 'due') if panel == 'inboxdue' else ''))
    return (f'<div class="app wv v-{key}">{rail}{sidebar(scope, v, panel)}<main class="main calmain">'
            f'<div class="calleft">{header(v)}<div class="calbody">{week_grid(scope, v)}</div></div>{rp}</main></div>')


def new_event():
    f = rules._fld

    def dt(d, t):
        return f'<div class="dtp">{rules._sel(I_CAL + d)}{rules._sel(bp.I_CLOCK + t)}</div>'
    body = (f'<div class="frow2">{f("Name", "<span class=\"inp focus\">Coffee with Mia<span class=\"caret\"></span></span>")}'
            '</div>'
            f'<div class="frow2">{f("Owner", rules._sel("<span class=\"tag area relation\"><span class=\"dot\"></span>Relationships</span>"))}</div>'
            '<div class="frow2 ad"><span class="fl2">All day</span><span class="sw2"></span></div>'
            f'<div class="frow2 se">{f("Starts", dt("Sun, Nov 15", "10:00 AM"))}<span class="arr">{bp.I_ARROW}</span>'
            f'{f("Ends", dt("Sun, Nov 15", "11:00 AM"))}</div>'
            f'<div class="frow2">{f("Repeat", rules._sel(I_REP + "Does not repeat"))}{f("Location", "<span class=\"inp\"><span style=color:var(--text-disabled)>Add a place</span></span>")}</div>')
    return nb.modal('s-newev', 'New event', body, '<button class="btn">Cancel</button><button class="btn primary">Create event</button>', w=480)


CSS = """
.calmain{display:flex;flex-direction:row}
.calleft{flex:1;min-width:0;display:flex;flex-direction:column}
.calhead{height:72px;flex:none;display:flex;align-items:center;gap:20px;padding:0 24px}
.vsw{display:flex;background:var(--n200);border-radius:8px;padding:2px;height:32px}
.vsw span{padding:0 14px;display:flex;align-items:center;font-size:13px;font-weight:500;color:var(--text-secondary);border-radius:6px;cursor:pointer}
.vsw span.on{background:#fff;color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.rng{display:flex;align-items:center;gap:4px}
.rng .rl{font-size:22px;line-height:28px;font-weight:600;letter-spacing:-.01em;padding:0 6px;border-radius:6px;cursor:pointer;min-width:132px;text-align:center}
.rng .rl:hover{background:var(--n100)}
.rng .icon-btn svg{width:18px;height:18px}
.calbody{flex:1;min-height:0;display:flex}
.calbody .cwk{padding:0 12px 0 24px}
.v-collapsed .calbody .cwk{padding-right:24px}
.rpan{width:360px;flex:none;border-left:1px solid var(--border);display:flex;flex-direction:column;background:#fff;margin-top:-72px}
.rph{height:72px;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px 0 20px}
.rph b{font-size:16px;font-weight:600}.rph .rpm{font-size:13px;color:var(--text-tertiary)}
.rph .icon-btn{margin-left:auto}
.rph .cnt{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--n200);font-size:11px;font-weight:600;color:var(--text-secondary);display:grid;place-items:center}
.rpb{flex:1;overflow-y:auto;padding:0 12px 24px}
.agd{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-secondary);padding:14px 8px 6px}
.agd.tdy{color:var(--acc700)}.agd.past{color:var(--text-tertiary)}
.agr{display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;border-radius:6px;font-size:13px;cursor:pointer;min-width:0}
.agr:hover{background:var(--n100)}
.agr .agt{width:62px;flex:none;font-size:12px;color:var(--text-tertiary)}
.agr .sq{width:10px;height:10px;border-radius:3px;background:var(--a-solid);flex:none}
.agr .agn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.agr .agm{font-size:12px;color:var(--text-tertiary);flex:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.agr .rring{width:14px;height:14px;flex:none}
.agr .pf{display:grid;color:var(--a-solid)}.agr .pf svg{width:14px;height:14px}
.agr .cb{width:13px;height:13px;border:1.5px solid var(--a-solid);border-radius:3px;flex:none;display:grid;place-items:center;color:#fff}
.agr .cb svg{width:9px;height:9px;stroke-width:3}
.agr.noarea .cb{border-color:var(--n400)}
.agr.done .cb{background:var(--a-solid)}.agr.noarea.done .cb{background:var(--n400)}
.agr.done .agn,.agr.cancel .agn{text-decoration:line-through;color:var(--text-tertiary);font-weight:400}
.agr.past,.agr.done,.agr.cancel{opacity:.5}
.rpb.ibx{display:flex;flex-direction:column;gap:8px;padding-top:4px}
.ibc{border:1px solid var(--border);border-radius:10px;padding:9px 10px 9px 12px;display:flex;flex-direction:column;gap:5px;cursor:grab}
.ibc .wt{display:flex;gap:9px;align-items:flex-start}.ibc .ti{font-size:14px;line-height:20px;font-weight:500}
.ibc .cb{width:16px;height:16px;border:1.5px solid var(--n400);border-radius:4px;flex:none;margin-top:2px}
.ibc .wm{display:flex;align-items:center;gap:6px;padding-left:25px;font-size:12px;color:var(--text-tertiary)}
.ibc .wm svg{width:13px;height:13px}
.ibc.src{opacity:.35;border-style:dashed}
/* panels: the approved agenda card */
.calmain>.agenda{position:static;max-height:none;margin:16px 24px 24px 0;width:360px}
.sg2{display:flex;background:var(--n200);border-radius:6px;padding:2px;height:26px;margin-left:4px}
.sg2 span{padding:0 10px;display:flex;align-items:center;font-size:12px;font-weight:500;color:var(--text-secondary);border-radius:4px}
.sg2 span.on{background:#fff;color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ibl{display:flex;flex-direction:column;gap:2px;padding-top:4px}.ibl .arow{cursor:grab}
.arow.ev.past{background:var(--a-past)}.arow.ev.past .ev-icon{background:var(--a-border)}
.arow.past:not(.ev) .at{color:var(--text-tertiary)}
.arow .mark .rring{width:16px;height:16px}.arow .mark .rring circle{fill:none!important}
.arow.done .check{background:var(--a-border);border-color:var(--a-border)}
.arow.done .at{color:var(--text-disabled);text-decoration:line-through}
.arow.src{opacity:.35}
.ghost3{display:none!important;position:fixed;z-index:30;width:300px;background:#fff;border:1px solid var(--border);transform:rotate(2deg);
  box-shadow:0 2px 8px rgba(0,0,0,.08),0 18px 36px rgba(0,0,0,.14);cursor:grabbing}
body.s-drag .ghost3{display:flex!important}
/* past and done: the approved lighter colours, no fading */
.ent.ev.past,.cwbar.past{background:var(--a-past)!important;box-shadow:inset 3px 0 0 var(--a-border)}
.ent.ev.past .tm,.ent.ev.past .nm,.ent.ev.past .ci,.cwbar.past,.cwbar.past .lbm{color:var(--a-text)}
.cwbar.past.cutl{box-shadow:none}
.ent.rt.past .nm,.ent.rt.past .ct{color:var(--text-tertiary)}
.ent.tk.done .cb{background:var(--a-border);border-color:var(--a-border)}
.ent.tk.noarea.done .cb{background:var(--n300);border-color:var(--n300)}
.ent.done .nm,.ent.cancel .nm{color:var(--text-disabled)}
.ccol.we,.ccol.tdc{background:none}
/* text never takes area colours: area colour stays on markers, edges and fills */
.ent.ev,.ent.ev .nm,.cwbar,.cwbar .lbt{color:var(--text-primary)}
.ent.ev .tm,.ent.ev .ci,.cwbar .lbm{color:var(--text-secondary)}
.ent.ev.past .nm,.ent.ev.past .tm,.ent.ev.past .ci,.cwbar.past,.cwbar.past .lbt,.cwbar.past .lbm{color:var(--text-tertiary)}
.calmain .arow.ev .at{color:var(--text-primary)}.calmain .arow.ev .am{color:var(--text-secondary)}
.calmain .arow.ev.past .at{color:var(--text-tertiary)}.calmain .arow.ev.past .am{color:var(--text-tertiary)}
.calmain .arow .am svg{color:var(--text-tertiary)}
/* subtasks in the panels (as on the Kanban cards) */
.calmain .arow .ab{flex:1;min-width:0}
.calmain .arow .am{flex-wrap:nowrap;min-width:0}
.sbt2{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:500;color:var(--text-secondary);background:var(--n100);border-radius:5px;padding:1px 4px 1px 6px;flex:none}
.sbt2 svg{width:11px;height:11px}.sbt2.op svg{transform:rotate(180deg)}
.calmain .arow:not(.ev){border:1px solid transparent}
.calmain .arow.open{border-color:var(--border);background:#fff}
.calmain .arow.open:hover{background:#fff}
.asubs{display:none;flex-direction:column;gap:3px;margin-top:6px}.arow.open .asubs{display:flex}.arow.open .sbt2 svg{transform:rotate(180deg)}
.asub{display:flex;align-items:center;gap:7px;font-size:12px;line-height:18px;color:var(--text-secondary)}
.asub .scb{width:12px;height:12px;border:1.5px solid var(--n400);border-radius:3px;display:grid;place-items:center;color:#fff;flex:none}
.asub .scb svg{width:9px;height:9px;stroke-width:3}
.asub.d{color:var(--text-disabled);text-decoration:line-through}.asub.d .scb{background:var(--n300);border-color:var(--n300)}
/* subtasks */
.ent .sbc{display:inline-flex;align-items:center;gap:1px;font-size:11px;font-weight:500;color:var(--text-secondary);background:var(--n100);border-radius:4px;padding:0 3px 0 5px;height:16px;flex:none}
.ent .sbc svg{width:10px;height:10px}.ent .sbc.op svg{transform:rotate(180deg)}
.etk{flex:none;display:flex;flex-direction:column;border:1px solid transparent;border-radius:6px}
.etk .esubs{display:none;flex-direction:column}
.etk.open{border-color:var(--border);background:#fff;padding-bottom:4px}.etk.open>.ent{border-radius:5px 5px 0 0}
.etk.open .esubs{display:flex}.etk.open .sbc svg{transform:rotate(180deg)}
.etk>.ent{margin:-1px}.etk.open>.ent{margin:0}
.sbc,.sbt2{cursor:pointer}.sbc:hover,.sbt2:hover{background:var(--n200)}
.esub{height:20px;display:flex;align-items:center;gap:6px;padding:0 6px 0 25px;font-size:11px;color:var(--text-secondary);flex:none}
.esub .scb{width:11px;height:11px;border:1.5px solid var(--n400);border-radius:3px;display:grid;place-items:center;color:#fff;flex:none}
.esub .scb svg{width:8px;height:8px;stroke-width:3}
.esub .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.esub.d .scb{background:var(--n300);border-color:var(--n300)}.esub.d .nm{color:var(--text-disabled);text-decoration:line-through}
/* sidebar filters */
.cal-side .sct{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.fxr{display:flex;align-items:center;gap:10px;height:30px;padding:0 10px;margin:0 8px;border-radius:6px;font-size:13px;color:var(--text-primary);cursor:pointer}
.fxr:hover{background:var(--n100)}
.fx{--c:var(--acc600);width:15px;height:15px;border-radius:4px;border:1.5px solid var(--n400);display:grid;place-items:center;color:#fff;flex:none}
.fx svg{width:10px;height:10px;stroke-width:3;opacity:0}
.fx.on{background:var(--c);border-color:var(--c)}.fx.on svg{opacity:1}
.fxr .fl{width:13px;height:13px;flex:none;margin-left:-2px}
.ccol.clk{box-shadow:inset 0 0 0 2px var(--acc500)}
body.k-cell .v-normal .ccol.c6{background:var(--acc100)!important;box-shadow:inset 0 0 0 2px var(--acc500)}
.frow2.se{align-items:flex-end}.frow2.se .arr{display:flex;height:70px;align-items:center;color:var(--text-tertiary)}
.frow2.ad{align-items:center;gap:10px}.frow2.ad .fl2{margin:0}.frow2.se .arr svg{width:16px;height:16px}
.dtp{display:flex;flex-direction:column;gap:6px}.dtp .inp.pick{white-space:nowrap;width:100%;box-sizing:border-box}
.frow2.se>.fld{flex:1 1 0!important;width:auto!important;min-width:0}.dtp .inp.pick:first-child{flex:none}
.toast2{left:calc(288px + (100vw - 288px - 360px)/2)!important}
.cwg>.cwbar.wl{margin:0 6px 3px;position:relative;z-index:1}
.cwg>.wgap{padding:0 6px 3px;min-width:0;display:flex;flex-direction:column;position:relative;z-index:1}
.cwg>.ccel{padding:0 6px 12px}
"""

STATES = [('Normal', 's-normal vnormal'), ('Agenda hidden', 's-col vcollapsed'), ('Inbox: no scheduled date', 's-ib vinbox'), ('Inbox: no due date', 's-ibd vinboxdue'),
          ('Subtasks open', 's-subs vsubs'), ('Filtered: Career', 's-car vcareer'), ('Cancelled shown', 's-cancel vcancel'), ('Empty week', 's-empty vempty'),
          ('Nothing created yet', 's-none vnone'), ('Click on a day', 's-cell vnormal k-cell'), ('Period picker', 's-per vnormal k-wper'),
          ('New event', 's-newev vnormal'), ('Routine', 's-rp vnormal k-rp'), ('Dragging from Inbox', 's-drag vdrag'),
          ('Undo toast', 's-undo vundo'), ('Panel: task', 's-pt vnormal p-task'), ('Panel: event', 's-pe vnormal p-event'),
          ('Series dialog', 's-series vnormal p-event')]
POS = {'per': (560, 60), 'rp': (1178, 200), 'cell': (1362, 420), 'ghost': (1356, 204)}


def build(src, area_html):
    html = src
    head = html[:html.find('<body')]
    rail = re.search(r'<nav class="rail".*?</nav>', html, flags=re.S).group(0)
    rail = rail.replace('<a class=on title="Areas">', '<a title="Areas">').replace('<a title="Calendar">', '<a class=on title="Calendar">')
    tp = re.search(r'<aside class="panel dpanel pnl-task career".*?</aside>', html, flags=re.S).group(0)
    apps = ''.join(app(rail, k) for k in VARIANTS) + ''.join(cv.app(rail, k) for k in cv.VIEWS)
    pops = bp.pop('k-wper', POS['per'][0], POS['per'][1], 252, bp.row('This week', '', 'Nov 9 – 15', on=True) + '<div class="sep"></div>'
                  + bp.cal(2026, 11, rng=((2026, 11, 9), (2026, 11, 15))))
    pops += bp.pop('k-cell', POS['cell'][0], POS['cell'][1], 180, '<div class="lab">Sun, Nov 15</div>' + bp.row('Event', I_CAL) + bp.row('Task', I_TASK))
    steps = [('Practice LeetCode 30 min', 'career', True), ('Read 10 pages', 'personal', False), ("Plan tomorrow's top task", 'career', False),
             ('Stretch 10 min', 'health', False), ('Skincare', 'health', False)]
    rp = (f'<div class="rh">{nb.ring(0.2)}<b>Evening routine</b><span>Daily · 1/5</span></div><div class="sep"></div>'
          + ''.join(f'<div class="rs2 {a}{" done" if d else ""}"><span class="rb">{I_CHK if d else ""}</span>{n}</div>' for n, a, d in steps))
    pops += bp.pop('k-rp', POS['rp'][0], POS['rp'][1], 260, rp)
    pops += cv.popovers()
    ghost = arow('task', None, 'Renew passport', 'Due Dec 1 · Inbox').replace('<div class="arow ', f'<div style="left:{POS["ghost"][0]}px;top:{POS["ghost"][1]}px" class="arow ghost3 ', 1)
    toast = (f'<div class="toast2"><span class="ok">{nb.I_TOK}</span><span>Clean up GitHub profile completed</span>'
             '<button class="link">Undo</button><kbd>Ctrl Z</kbd></div>')
    groups = [('Week', STATES), ('Month', cv.MONTH_STATES), ('Quarter', cv.QUARTER_STATES), ('Year', cv.YEAR_STATES)]
    gseg = ''.join(f'<span{" class=on" if i == 0 else ""} data-g="{g}" data-c="{st[0][1]}">{g}</span>' for i, (g, st) in enumerate(groups))
    seg = ''.join(f'<span class="{"on " if (g == "Week" and i == 0) else ""}g-{g}" data-g="{g}" data-c="{c}">{t}</span>'
                  for g, st in groups for i, (t, c) in enumerate(st))
    sw_ = (f'<div class="states pstates"><span>View</span><div class="seg" id="wgrp">{gseg}</div>'
           f'<span>Mock state</span><div class="seg" id="wst">{seg}</div></div>')
    _, mcss = bp.step_modal(area_html)
    shows = ','.join(f'body.v{k} .app.wv.v-{k}' for k in list(VARIANTS) + list(cv.VIEWS)) + '{display:flex!important}'
    pkshow = ','.join(f'body.{k} .pk.{k}' for k in ['k-wper', 'k-cell', 'k-rp'] + cv.PK_KEYS) + '{display:block}'
    script = """<script>
const wst=document.getElementById('wst'),wgrp=document.getElementById('wgrp');
function curApp(){return [...document.querySelectorAll('.app.wv')].find(a=>a.offsetParent!==null||getComputedStyle(a).display!=='none')}
function group(g){wgrp.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x.dataset.g===g));
  wst.querySelectorAll('span').forEach(x=>x.style.display=x.dataset.g===g?'':'none')}
function fitBox(c,mo,lab){const kids=[...c.children].filter(x=>x!==mo);kids.forEach(k=>k.style.display='');mo.hidden=true;if(c.scrollHeight<=c.clientHeight+1&&c.scrollWidth<=c.clientWidth+1)return;mo.hidden=false;let n=0;for(let i=kids.length-1;i>=0&&(c.scrollHeight>c.clientHeight+1||c.scrollWidth>c.clientWidth+1);i--){kids[i].style.display='none';n++;mo.textContent=lab(n)}}
function fit(a){a.querySelectorAll('.mcel').forEach(c=>{const mo=c.querySelector('.more');if(mo)fitBox(c,mo,n=>'+'+n+' more')});a.querySelectorAll('.lin-mk').forEach(c=>{const mo=c.querySelector('.lin-mm');if(mo)fitBox(c,mo,n=>'+'+n)})}
function place(){const a=curApp();if(!a)return;fit(a);const B=document.body.classList;
  document.querySelectorAll('.pk[data-anc],.dg,.dlab').forEach(p=>{
    if(p.dataset.for){const on=B.contains(p.dataset.for);p.classList.toggle('on',on);if(!on)return}
    const t=a.querySelector(p.dataset.anc);if(!t)return;const r=t.getBoundingClientRect();
    const dx=+(p.dataset.dx||0),dy=+(p.dataset.dy||0);
    p.style.left=((p.dataset.at==='right'?r.right:r.left)+dx)+'px';p.style.top=((p.dataset.at==='below'?r.bottom:p.dataset.at==='above'?r.top-p.offsetHeight:r.top)+dy)+'px'});
  const ag=a.querySelector('.agenda.ascroll .ag-body');if(ag){const t=ag.querySelector('[data-now]');const m=ag.querySelector('.amon');ag.scrollTop=t?t.offsetTop-ag.offsetTop-(m?44:8):0}}
function go(c){document.body.className=c;const s=[...wst.querySelectorAll('span')].find(x=>x.dataset.c===c);
  wst.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===s));if(s)group(s.dataset.g);requestAnimationFrame(place)}
wst.onclick=e=>{const c=e.target.dataset.c;if(c)go(c)};
wgrp.onclick=e=>{const c=e.target.dataset.c;if(c)go(c)};
const VMAP={Week:'s-normal vnormal',Month:'s-mnormal vmnormal',Quarter:'s-qnormal vqnormal',Year:'s-ynormal vynormal'};
document.addEventListener('click',e=>{const v=e.target.closest('.vsw span');if(v){go(VMAP[v.textContent]);return}
  const t=e.target.closest('.sbc,.sbt2');if(!t)return;e.stopPropagation();t.closest('.etk,.arow').classList.toggle('open')});
window.addEventListener('resize',place);group('Week');
const tip=document.getElementById('tip');document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
  if(!t){tip.style.display='none';return}tip.textContent=t.dataset.tip;tip.style.display='block';
  tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px'});
</script>"""
    body = (f'<body class="s-normal vnormal">{apps}{tp}{cw.event_panel(html)}{new_event()}{nb.series()}{pops}{ghost}{cv.ghosts()}{toast}{sw_}'
            f'<div id="tip"></div>{script}</body></html>')
    body = short_times(body)
    css = bp.CSS + mcss + '.pop2,.pmenu{display:none}' + nb.CSS + cw.CSS + CSS + cv.CSS + shows + pkshow
    css = css.replace('body.p-task .cwk,body.p-event .cwk{padding-right:424px}', '')
    head = head.replace('</style>', css + '</style>', 1)
    head = re.sub(r'<title>.*?</title>', '<title>Life OS — Calendar</title>', head, count=1)
    return head + body


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    area = open(sys.argv[2], encoding='utf-8').read()
    out = build(src, area)
    open(sys.argv[3], 'w', encoding='utf-8').write(out)
    print('wrote', sys.argv[3], len(out))
