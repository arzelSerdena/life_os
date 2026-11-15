"""Build html_mockups/draft-next-7-days.html: the untimed day board, moved from Calendar to Tasks › Next 7 days (Phase C).

Built on Nov 15 as the Calendar week board; Arzel then decided Calendar views are real calendars, so this board
becomes the Tasks group's Next 7 days view. Its sidebar and header are still the Calendar ones; Phase C reworks them.

Base: approved-detail-panel.html (shell CSS, rail, the task detail panel). New: the Calendar sidebar (VIEWS, SHOW),
the header (period switch, View menu, Add split button) and the board (Unscheduled + Mon–Sun, 280 px columns that
scroll sideways, an all-day lane). Cards follow docs/All - Area.png. Pickers and menus reuse build_pickers.py.
Today is Sat, Nov 14, 2026; the week is Nov 9 – 15.

Usage: python build_next7.py <approved-detail-panel.html> <approved-area.html> <out.html>
Not run through rules.apply(): its sidebar pass is for the Areas group.
"""
import re
import sys

import build_pickers as bp
import rules

S = bp.svg
I_FLAG = '<path d="M4 22V4l7 2 9-2v12l-9 2-7-2"/>'
I_REP = S('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>')
I_NOTES = S('<path d="M4 6h16M4 12h16M4 18h10"/>')
I_PIN = S('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>')
I_ROLL = S('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>')
I_FOLD = S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')
I_CAL = S('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>')
I_CHEV = S('<path d="m6 9 6 6 6-6"/>')
I_CHK = S('<path d="M20 6 9 17l-5-5"/>')
I_X = S('<path d="M18 6 6 18M6 6l12 12"/>')
I_PLUS = S('<path d="M12 5v14M5 12h14"/>')
I_PREV, I_NEXT = bp.I_PREV, bp.I_NEXT
I_INBOX = bp.I_INBOX
I_VIEW = S('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')
I_LAYERS = S('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>')
I_WEEK = S('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/>')
I_MONTH = S('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M3 15h18M9 9v12M15 9v12"/>')
I_QTR = S('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>')
I_YEAR = S('<path d="M3 5h18M3 9h18M3 13h18M3 17h18M3 21h18"/>')
I_PAUSE = S('<path d="M9 6v12M15 6v12"/>')
I_DASH = S('<path d="M7 12h10"/>')
I_CHART = S('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>')
I_DONE = S('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>')
I_TOK = S('<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>')

AREA = {'career': ('Career', '#3579c2'), 'finance': ('Finance', '#11bbb3'), 'health': ('Health &amp; Beauty', '#ca6a93'),
        'personal': ('Personal', '#b181b4'), 'relation': ('Relationships', '#cba927'), 'home': ('Home', '#cc6b43')}
PRI = {'high': '#cc363c', 'med': '#d97706', 'low': '#9ca3af'}
DAYS = [('Mon', 9), ('Tue', 10), ('Wed', 11), ('Thu', 12), ('Fri', 13), ('Sat', 14), ('Sun', 15)]
TODAY_I = 5


def T(title, area=None, proj=None, pri=None, rep=False, notes=False, due=None, over=False, subs=None, open_=False,
      done=False, cancel=False, roll=0, key=''):
    return dict(t='task', title=title, area=area, proj=proj, pri=pri, rep=rep, notes=notes, due=due, over=over,
                subs=subs, open=open_, done=done, cancel=cancel, roll=roll, key=key)


def E(title, area, time, loc=False, rep=False, notes=False, key=''):
    return dict(t='event', title=title, area=area, time=time, loc=loc, rep=rep, notes=notes, key=key)


def P(title, area, pct, due):
    return dict(t='proj', title=title, area=area, pct=pct, due=due)


def R(title, steps, collapsed=False):
    return dict(t='rout', title=title, steps=steps, collapsed=collapsed)


# ---------------------------------------------------------------- mock data (week Nov 9 – 15)
EVENING_PAST = lambda n_done: R('Evening routine', [('Practice LeetCode 30 min', 'career', 'done'), ('Read 10 pages', 'personal', 'done' if n_done > 1 else 'missed'),
                                                   ("Plan tomorrow's top task", 'career', 'done' if n_done > 2 else 'skipped'),
                                                   ('Stretch 10 min', 'health', 'done' if n_done > 3 else 'missed'),
                                                   ('Skincare', 'health', 'done')], collapsed=True)


def week(scope='all', variant='normal'):
    unsched = [
        T('Write case study for Life OS', 'career', 'Resume &amp; portfolio', pri='med', subs=[('Outline', False), ('Screenshots', False)]),
        T('Research index funds', 'finance', 'Emergency fund', notes=True),
        T('Buy running shoes', 'health', '5K training', due='Nov 20'),
        T('Fix the leaky faucet', 'home', pri='low'),
        T('Call the bank about the card', None, notes=True),
        T('Renew passport', None, due='Dec 1'),
    ]
    days = [
        [E('Dentist appointment', 'health', '10:00 – 11:00 AM', loc=True), EVENING_PAST(5),
         T('Apply to 2 jobs', 'career', 'Life OS app' if False else None, rep=True, done=True)],
        [EVENING_PAST(3), T('Pay credit card bill', 'finance', rep=True, done=True),
         T('Order new phone case', None, done=True)],
        [EVENING_PAST(5), T('Send a birthday gift to Mom', 'relation', done=True)],
        [E('Study group', 'career', '7:00 – 9:00 PM', rep=True, notes=True, key='study'), EVENING_PAST(4),
         T('Draft LinkedIn post', 'career', 'Resume &amp; portfolio', done=True)]
        + ([T('Sell old monitor', 'home', cancel=True)] if variant == 'cancel' else []),
        [EVENING_PAST(2), T('Pack laptop and chargers', 'career', 'Hackathon prep', done=True)]
        + ([T('Book a haircut', 'health', cancel=True)] if variant == 'cancel' else []),
        [E('Brunch with Ana', 'relation', '11:00 AM – 12:30 PM', loc=True),
         R('Evening routine', [('Practice LeetCode 30 min', 'career', 'done'), ('Read 10 pages', 'personal', 'todo'),
                               ("Plan tomorrow's top task", 'career', 'todo'), ('Stretch 10 min', 'health', 'todo'),
                               ('Skincare', 'health', 'todo')]),
         T('Update resume', 'career', 'Resume &amp; portfolio', pri='high', due='Nov 4', over=True, roll=4, notes=True,
           subs=[('Add projects section', True), ('Fix formatting', False), ('Ask a friend to review', False)], open_=True, key='ut'),
         T('Draft the hackathon pitch', 'career', 'Hackathon prep', pri='med', due='Nov 15 · 6:00 PM', key='pitch'),
         T('Clean up GitHub profile', 'career', 'Life OS app', roll=3, done=(variant == 'undo'), key='gh'),
         T('Buy groceries', None),
         T('Run 5 km', 'health', '5K training', rep=True, done=True)],
        [R('Weekly reset', [('Update the job tracker', 'career', 'todo'), ('Review job applications', 'career', 'todo'),
                            ('Post one LinkedIn update', 'career', 'todo'), ('Plan meals', 'home', 'todo'),
                            ('Review the budget', 'finance', 'todo')]),
         T('Submit hackathon registration', 'career', 'Hackathon prep', pri='high', due='Nov 15',
           subs=[('Pick a team name', True), ('Fill in the form', False)]),
         P('Kitchen deep clean', 'home', 50, 'Nov 15'),
         T('Water the plants', 'home', rep=True)],
    ]
    lane = [('Book fair', 'personal', 0, 1, 'since Nov 7', None, ''),
            ("Mom's birthday", 'relation', 2, 2, None, None, ''),
            ('Hackathon weekend', 'career', 4, 6, None, None, 'Fri 6:00 PM – Sun 3:00 PM')]
    if scope == 'career':
        unsched = [c for c in unsched if c['area'] == 'career']
        days = [[c for c in d if c.get('area') == 'career' or (c['t'] == 'rout' and any(s[1] == 'career' for s in c['steps']))] for d in days]
        days = [[dict(c, steps=[s for s in c['steps'] if s[1] == 'career']) if c['t'] == 'rout' else c for c in d] for d in days]
        lane = [b for b in lane if b[1] == 'career']
    if scope == 'inbox':
        unsched = [c for c in unsched if c['t'] == 'task' and c['area'] is None]
        days = [[c for c in d if c['t'] == 'task' and c['area'] is None] for d in days]
        lane = []
    return unsched, days, lane


# ---------------------------------------------------------------- cards
def icon_flag(pri):
    return f'<svg class="fl" viewBox="0 0 24 24" style="color:{PRI[pri]}">{I_FLAG}</svg>'


def task_card(c, inbox_scope=False):
    a = c['area'] or 'noarea'
    st = ' done' if c['done'] else (' cancel' if c['cancel'] else '')
    cb = f'<span class="cb">{I_CHK if c["done"] else (I_X if c["cancel"] else "")}</span>'
    meta = ''
    if c['pri']:
        meta += icon_flag(c['pri'])
    if c['rep']:
        meta += f'<span class="mi2" data-tip="Repeats">{I_REP}</span>'
    if c['notes']:
        meta += f'<span class="mi2" data-tip="Has notes">{I_NOTES}</span>'
    if c['roll']:
        meta += f'<span class="mi2 roll" data-tip="Rolled over {c["roll"]} times">{I_ROLL}{c["roll"]}</span>'
    if c['due']:
        meta += f'<span class="dd{" od" if c["over"] else ""}">{c["due"]}</span>'
    if c['proj']:
        meta += f'<span class="pjn">{I_FOLD}{c["proj"]}</span>'
    elif c['area'] is None and not inbox_scope:
        meta += f'<span class="pjn inb">{I_INBOX}Inbox</span>'
    if c['subs']:
        n = sum(1 for _, d in c['subs'] if d)
        meta += f'<span class="sbt{" op" if c["open"] else ""}">{n}/{len(c["subs"])}{I_CHEV}</span>'
    subs = ''
    if c['subs'] and c['open']:
        subs = '<div class="subl">' + ''.join(
            f'<div class="sub{" d" if d else ""}"><span class="scb">{I_CHK if d else ""}</span>{n}</div>' for n, d in c['subs']) + '</div>'
    key = f' k-{c["key"]}' if c['key'] else ''
    m = f'<div class="wm">{meta}</div>' if meta else ''
    return f'<div class="wc tk {a}{st}{key}"><div class="wt">{cb}<span class="ti">{c["title"]}</span></div>{m}{subs}</div>'


def event_card(c):
    meta = (f'<span class="mi2">{I_PIN}</span>' if c['loc'] else '') + (f'<span class="mi2">{I_REP}</span>' if c['rep'] else '') \
        + (f'<span class="mi2">{I_NOTES}</span>' if c['notes'] else '') + f'<span class="dd">{c["time"]}</span>'
    key = f' k-{c["key"]}' if c['key'] else ''
    return (f'<div class="wc ev {c["area"]}{key}"><div class="wt"><span class="et">{I_CAL}</span><span class="ti">{c["title"]}</span></div>'
            f'<div class="wm">{meta}</div></div>')


def proj_card(c):
    return (f'<div class="wc pj {c["area"]}"><div class="wt"><span class="pf">{I_FOLD}</span><span class="ti">{c["title"]}</span></div>'
            f'<div class="pbar"><i style="width:{c["pct"]}%"></i></div><div class="pft"><span>Due {c["due"]}</span><span>{c["pct"]}%</span></div></div>')


def ring(frac):
    import math
    r = 7
    L = 2 * math.pi * r
    return (f'<svg class="rring" viewBox="0 0 18 18"><circle cx="9" cy="9" r="{r}" stroke="var(--n200)" stroke-width="2.5" fill="none"/>'
            f'<circle cx="9" cy="9" r="{r}" stroke="var(--acc600)" stroke-width="2.5" fill="none" stroke-linecap="round" '
            f'stroke-dasharray="{L * frac:.2f} {L:.2f}" transform="rotate(-90 9 9)"/></svg>')


def rout_card(c):
    n = sum(1 for s in c['steps'] if s[2] == 'done')
    tot = len(c['steps'])
    rows = ''
    if not c['collapsed']:
        for name, a, st in c['steps']:
            ic = {'done': I_CHK, 'skipped': I_DASH, 'missed': I_X, 'paused': I_PAUSE}.get(st, '')
            sel = ' k-step' if name == 'Practice LeetCode 30 min' else ''
            rows += f'<div class="rs {a} {st}{sel}"><span class="rb">{ic}</span>{name}</div>'
    return (f'<div class="wc rt{" col" if c["collapsed"] else ""}"><div class="wt">{ring(n / tot if tot else 0)}<span class="ti">{c["title"]}</span>'
            f'<span class="rc">{n}/{tot}</span><span class="rcv">{I_CHEV}</span></div>{"<div class=rsl>" + rows + "</div>" if rows else ""}</div>')


def card(c, inbox_scope=False):
    return {'task': lambda: task_card(c, inbox_scope), 'event': lambda: event_card(c), 'proj': lambda: proj_card(c),
            'rout': lambda: rout_card(c)}[c['t']]()


def order(cards):
    ev = [c for c in cards if c['t'] == 'event']
    rt = [c for c in cards if c['t'] == 'rout']
    pj = [c for c in cards if c['t'] == 'proj']
    tk = [c for c in cards if c['t'] == 'task']
    tk = [c for c in tk if not (c['done'] or c['cancel'])] + [c for c in tk if c['done'] or c['cancel']]
    return ev + rt + pj + tk


def is_open(c):
    if c['t'] == 'task':
        return not (c['done'] or c['cancel'])
    if c['t'] == 'rout':
        return any(s[2] == 'todo' for s in c['steps'])
    return True


def grouped(cards, inbox_scope=False):
    """Group by project: one label per project, then No project."""
    groups = {}
    for c in cards:
        k = c.get('proj') if c['t'] == 'task' else (c['title'] if c['t'] == 'proj' else None)
        if c['t'] in ('event', 'rout'):
            k = '__top'
        groups.setdefault(k, []).append(c)
    out = ''.join(card(c, inbox_scope) for c in order(groups.pop('__top', [])))
    names = [k for k in groups if k]
    for k in names + ([None] if None in groups else []):
        cs = order(groups[k])
        out += (f'<div class="gl">{I_CHEV}<span>{k or "No project"}</span><span class="cnt">{len(cs)}</span></div>'
                + ''.join(card(c, inbox_scope) for c in cs))
    return out


# ---------------------------------------------------------------- board
def board(variant, scope):
    empty_days = variant in ('empty', 'none')
    unsched, days, lane = week(scope, variant)
    if variant == 'none':
        unsched = []
    if empty_days:
        days, lane = [[] for _ in range(7)], []
    inbox = scope == 'inbox'
    rend = (lambda cs: grouped(cs, inbox)) if variant == 'group' else (lambda cs: ''.join(card(c, inbox) for c in order(cs)))
    cur = variant not in ('empty', 'none')
    # headers
    h = (f'<div class="wch uns" style="grid-column:1;grid-row:1"><span class="dn2">Unscheduled</span>'
         f'<span class="cnt">{sum(1 for c in unsched if is_open(c))}</span><span class="ad">{I_PLUS}</span></div>')
    dlabels = DAYS if variant != 'empty' else [('Mon', 7), ('Tue', 8), ('Wed', 9), ('Thu', 10), ('Fri', 11), ('Sat', 12), ('Sun', 13)]
    for i, (dn, dd) in enumerate(dlabels):
        cls = ('pst' if i < TODAY_I else 'tdc' if i == TODAY_I else '') if cur else ''
        n = sum(1 for c in days[i] if is_open(c))
        h += (f'<div class="wch {cls}" style="grid-column:{i + 2};grid-row:1"><span class="dn">{dn}</span><span class="dd2">{dd}</span>'
              f'{f"<span class=cnt>{n}</span>" if n else ""}<span class="ad">{I_PLUS}</span></div>')
    # lane
    rows = max(1, len(lane)) if lane else 0
    ln = ''
    if lane:
        cells = ''.join(f'<i class="{("pst" if i < TODAY_I else "tdc" if i == TODAY_I else "")}" style="grid-column:{i + 1};grid-row:1/{rows + 1}"></i>'
                        for i in range(7))
        bars = ''
        for r, (t, a, s, e, since, until, tm) in enumerate(lane):
            cut = (' cutl' if since else '') + (' cutr' if until else '')
            extra = f'<span class="lbm">{since}</span>' if since else ''
            extra += f'<span class="lbm">{tm}</span>' if tm else ''
            bars += (f'<div class="lbar {a}{cut}" style="grid-column:{s + 1}/{e + 2};grid-row:{r + 1}">'
                     f'<span class="et2">{I_CAL}</span><span class="lbt">{t}</span>{extra}</div>')
        ln = f'<div class="alane" style="grid-column:2/9;grid-row:2;grid-template-rows:repeat({rows},26px)">{cells}{bars}</div>'
    ln += '<div class="alane-u" style="grid-column:1;grid-row:2"></div>'
    # lists
    li = f'<div class="wcl uns" style="grid-column:1;grid-row:3">{rend(unsched)}</div>'
    for i in range(7):
        cls = ('pst' if i < TODAY_I else 'tdc' if i == TODAY_I else '') if cur else ''
        body = rend(days[i])
        if variant == 'drag' and i == TODAY_I:
            body = body.replace('<div class="wc tk career k-pitch">', '<div class="wc tk career k-pitch src">', 1)
        if variant == 'drag' and i == 6:
            body = body.replace('<div class="wc tk career">', '<div class="slot"></div><div class="wc tk career">', 1)
        li += f'<div class="wcl {cls}" style="grid-column:{i + 2};grid-row:3">{body}</div>'
    msg = ''
    if variant == 'empty':
        msg = '<div class="wempty" style="grid-column:2/9;grid-row:2/4">Nothing planned this week.</div>'
    if variant == 'none':
        msg = (f'<div class="wempty" style="grid-column:1/9;grid-row:2/4"><span>No tasks or events yet.</span>'
               f'<button class="btn primary">{I_PLUS}New task</button></div>')
    return f'<div class="wb"><div class="wg">{h}{ln}{li}{msg}</div></div>'


# ---------------------------------------------------------------- sidebar and header
def sidebar(scope):
    def it(cls, inner, on=False):
        return f'<div class="item{" on" if on else ""} {cls}">{inner}</div>'
    v = ('<div class="sgroup"><span class="sg-name">Views</span></div>'
         + it('', f'<span class="mark si">{I_WEEK}</span>Week', True) + it('', f'<span class="mark si">{I_MONTH}</span>Month')
         + it('', f'<span class="mark si">{I_QTR}</span>Quarter') + it('', f'<span class="mark si">{I_YEAR}</span>Year')
         + '<div class="side-divider"></div><div class="sgroup"><span class="sg-name">Show</span></div>'
         + it('', f'<span class="mark si">{I_LAYERS}</span>All areas', scope == 'all'))
    for k, (n, _) in AREA.items():
        v += it(k, f'<span class="dot"></span>{n}', scope == k)
    v += it('', f'<span class="mark si">{I_INBOX}</span>Inbox', scope == 'inbox')
    return f'<aside class="side">{v}<div class="grow"></div></aside>'


def header(variant, scope, view_dot=False):
    title = {'all': '<h1 class="t-page">All areas</h1>', 'inbox': '<h1 class="t-page">Inbox</h1>'}.get(
        scope, f'<span class="dot"></span><h1 class="t-page">{AREA.get(scope, ("", ""))[0]}</h1>')
    label = 'Dec 7 – 13' if variant == 'empty' else 'Nov 9 – 15'
    today = '<button class="btn tdy">Today</button>' if variant == 'empty' else ''
    dot = '<span class="vdot"></span>' if view_dot else ''
    acc = '' if scope in ('career',) else ' accent'
    return (f'<div class="areahead {scope if scope in AREA else ""}"><div><div class="ttl" style="padding-left:0">{title}</div></div>'
            f'<div class="acts">{today}<div class="pnav"><span class="icon-btn">{I_PREV}</span><span class="pl">{label}</span>'
            f'<span class="icon-btn">{I_NEXT}</span></div>'
            f'<span class="icon-btn vbtn" title="View">{I_VIEW}{dot}</span>'
            f'<div class="split-btn{acc}"><button class="sb-main">{I_PLUS}Add</button><span class="sb-div"></span>'
            f'<button class="sb-chev" title="More to add">{I_CHEV}</button></div></div></div>')


VARIANTS = {  # variant: (scope, board variant, View dot)
    'normal': ('all', 'normal', False), 'career': ('career', 'normal', False), 'group': ('all', 'group', True),
    'cancel': ('all', 'cancel', True), 'empty': ('all', 'empty', False), 'none': ('all', 'none', False),
    'inbox': ('inbox', 'normal', False), 'drag': ('all', 'drag', False), 'undo': ('all', 'undo', False),
}


def app(rail, key):
    scope, bv, dot = VARIANTS[key]
    return (f'<div class="app wv v-{key}">{rail}{sidebar(scope)}<main class="main">{header(bv, scope, dot)}'
            f'{board(bv, scope)}</main></div>')


# ---------------------------------------------------------------- popovers, pop-ups, toast, panel
def sw(label, on=True):
    return f'<div class="r">{label}<span class="sw{" on" if on else ""}" style="margin-left:auto"></span></div>'


def view_menu(inbox=False):
    pr = ''.join(f'<span class="tg on">{(f"<svg class=fl viewBox=\'0 0 24 24\' style=\'color:{PRI[k]}\'>{I_FLAG}</svg>" if k in PRI else "")}{n}</span>'
                 for k, n in [('high', 'High'), ('med', 'Medium'), ('low', 'Low'), ('none', 'None')])
    shows = sw('Events') + sw('Routine steps') + ('' if inbox else sw('Projects')) + sw('Completed') + sw('Cancelled', False)
    gb = bp.fi('None', cls='f' if inbox else '', w=150, chev=True)
    return ('<div class="vr"><span>Group by</span>' + gb + '</div>'
            '<div class="vr"><span>Sort by</span>' + bp.fi('Manual', w=150, chev=True) + '</div>'
            '<div class="sep"></div><div class="lab">Show</div>' + shows
            + '<div class="sep"></div><div class="lab">Priority</div><div class="tgs">' + pr + '</div>'
            '<div class="vr" style="margin-top:4px"><span>Due</span>' + bp.fi('Any', w=150, chev=True) + '</div>'
            '<div class="sep"></div><div class="lab">Columns</div>' + sw('Unscheduled') + sw('Weekends'))


def modal(cls, title, body, foot, w=480):
    return (f'<div class="pop2 {cls}"><div class="scrim3"></div><div class="modal3 mf" style="width:{w}px" role="dialog" aria-label="{title}">'
            f'<div class="m-head"><h3>{title}</h3><span class="icon-btn" style="margin:0">{I_X}</span></div>'
            f'<div class="m-body">{body}</div><div class="m-foot">{foot}</div></div></div>')


def new_task():
    f = rules._fld
    body = (f'<div class="frow2">{f("Name", "<span class=\"inp focus\">Book a table for Sunday<span class=\"caret\"></span></span>")}</div>'
            f'<div class="frow2">{f("Owner", rules._sel(bp.I_INBOX + "Inbox"))}{f("Priority", rules._sel("None"), w=150)}</div>'
            f'<div class="frow2">{f("Scheduled", rules._sel(I_CAL + "Sat, Nov 14"))}{f("Due", rules._sel(I_CAL + "<span style=color:var(--text-disabled)>No due date</span>"))}</div>'
            f'<div class="frow2">{f("Repeat", rules._sel(I_REP + "Does not repeat"))}</div>')
    return modal('s-newtask', 'New task', body, '<button class="btn">Cancel</button><button class="btn primary">Create task</button>')


def series():
    opts = ''.join(f'<label class="ro{" on" if i == 0 else ""}"><span class="rd"></span>{t}</label>'
                   for i, t in enumerate(['This event', 'This and following events', 'All events']))
    return modal('s-series', 'Rename “Study group”?', f'<div class="ros">{opts}</div>',
                 '<button class="btn">Cancel</button><button class="btn primary">Apply</button>', w=380)


def step_panel(task_panel):
    p = task_panel.replace('pnl-task career', 'pnl-step career', 1)
    p = re.sub(r'<nav class="crumb">.*?</nav>', '<nav class="crumb"><span>Career</span><span class="cs">/</span><span>Evening routine</span></nav>', p, count=1, flags=re.S)
    p = p.replace('<span class="mk tk" title="Mark done"><span class="ib"></span></span><h2>Update resume</h2>',
                  f'<span class="mk tk rnd on" title="Done today">{I_CHK}</span><h2>Practice LeetCode 30 min</h2>', 1)
    p = re.sub(r'<div class="chips">.*?</div>', f'<div class="chips"><button class="chip2 ">{I_REP}Every day</button>'
               f'<button class="chip2 ">{I_DONE}Done today</button><button class="chip2 ">{I_CHART}Feeds Study hours</button></div>',
               p, count=1, flags=re.S)
    p = re.sub(r'<div class="subs">.*?</div></div>', '', p, count=1, flags=re.S)
    p = re.sub(r'<div class="nbody">.*?</div></section>', '<div class="nbody"><p>One easy and one medium problem. Start with arrays and strings, then trees.</p>'
               '<ul><li>Write down the pattern after each problem</li><li>Redo any problem that took over 30 min</li></ul></div></section>',
               p, count=1, flags=re.S)
    return p


CSS = """
.app.wv{display:none!important}
.wb{flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;padding:16px 24px 0;position:relative}
.wg{display:grid;grid-template-columns:280px repeat(7,280px);grid-template-rows:auto auto 1fr;column-gap:12px;height:100%;width:max-content;position:relative}
.wch{height:40px;display:flex;align-items:center;gap:8px;padding:0 8px 0 10px;border-radius:10px 10px 0 0}
.wch .dn{font-size:13px;color:var(--text-secondary);font-weight:500}
.wch .dd2{font-size:16px;font-weight:600;color:var(--text-primary);min-width:24px;height:24px;display:grid;place-items:center;border-radius:6px;margin-left:-4px}
.wch .dn2{font-size:16px;font-weight:600}
.wch .cnt,.gl .cnt{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--n200);font-size:11px;font-weight:600;color:var(--text-secondary);display:grid;place-items:center}
.wch .ad{margin-left:auto;width:24px;height:24px;display:grid;place-items:center;border-radius:6px;color:var(--text-secondary);opacity:0}
.wch:hover .ad,.wch.uns .ad{opacity:1}.wch .ad:hover{background:var(--n100)}.wch .ad svg{width:16px;height:16px}
.wch.pst .dn,.wch.pst .dd2{color:var(--text-tertiary)}
.wch.tdc .dd2{background:var(--acc600);color:#fff;padding:0 4px;margin-left:0}
.wch.pst,.wcl.pst,.alane i.pst{background:var(--n50)}
.wch.tdc,.wcl.tdc,.alane i.tdc{background:var(--acc100)}
.uns{position:sticky;left:0;z-index:4;background:#fff}
.wch.uns{box-shadow:-24px 0 0 #fff}
.wcl.uns{box-shadow:-24px 0 0 #fff,8px 0 12px -10px rgba(0,0,0,.25)}
.alane-u{position:sticky;left:0;z-index:4;background:#fff;box-shadow:-24px 0 0 #fff}
.wcl{overflow-y:auto;padding:4px 6px 24px;display:flex;flex-direction:column;gap:8px;min-height:0;border-radius:0 0 10px 10px}
.wcl.uns{padding-left:0;padding-right:0}
.alane{display:grid;grid-template-columns:repeat(7,280px);column-gap:12px;row-gap:4px;padding:2px 0 6px;position:relative}
.alane i{margin:-2px 0 -6px}
.alane i:first-child{}
.lbar{margin:0 6px;height:26px;border-radius:6px;background:var(--a-tint);color:var(--a-ink);display:flex;align-items:center;gap:6px;padding:0 8px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;position:relative;z-index:1}
.lbar .et2{width:14px;height:14px;border-radius:3px;background:var(--a-solid);color:#fff;display:grid;place-items:center;flex:none}
.lbar .et2 svg{width:10px;height:10px}
.lbar .lbm{color:var(--a-text);font-weight:400;font-size:11px;margin-left:4px}
.lbar.cutl{margin-left:-6px;border-top-left-radius:0;border-bottom-left-radius:0;clip-path:polygon(6px 0,100% 0,100% 100%,6px 100%,0 50%)}
.lbar.cutr{margin-right:-6px}
.lbar.relation{background:#f6eea6}
/* cards (docs/All - Area.png) */
.wc{background:#fff;border:1px solid var(--border);border-radius:10px;padding:9px 10px 9px 12px;display:flex;flex-direction:column;gap:5px;cursor:pointer;flex:none}
.wc:hover{border-color:var(--n300)}
.wc .wt{display:flex;align-items:flex-start;gap:9px}
.wc .ti{font-size:14px;line-height:20px;font-weight:500;color:var(--text-primary);flex:1;min-width:0}
.wc .cb{width:16px;height:16px;border:1.5px solid var(--a-solid);border-radius:4px;flex:none;margin-top:2px;display:grid;place-items:center;color:#fff}
.wc.noarea .cb{border-color:var(--n400)}
.wc .cb svg{width:11px;height:11px;stroke-width:3}
.wc.done .cb{background:var(--a-solid)}.wc.noarea.done .cb{background:var(--n400)}
.wc.cancel .cb{border-color:var(--n400);color:var(--n500)}
.wc.done,.wc.cancel{opacity:.55}
.wc.done .ti,.wc.cancel .ti{text-decoration:line-through;color:var(--text-tertiary)}
.wm{display:flex;align-items:center;gap:6px;padding-left:25px;font-size:12px;line-height:16px;color:var(--text-tertiary);min-width:0;white-space:nowrap}
.wm svg{width:13px;height:13px;flex:none}
.wm .mi2{display:inline-flex;align-items:center;gap:2px;color:var(--text-tertiary)}
.wm .roll{font-size:11px}
.wm .dd.od{color:#cc363c}
.wm .pjn{display:inline-flex;align-items:center;gap:4px;color:var(--a-text);overflow:hidden;text-overflow:ellipsis;min-width:0}
.wm .pjn svg{color:var(--a-solid)}
.wm .pjn.inb{color:var(--text-tertiary)}.wm .pjn.inb svg{color:var(--text-tertiary)}
.wm .sbt{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:500;color:var(--text-secondary);background:var(--n100);border-radius:5px;padding:1px 4px 1px 6px}
.wm .sbt svg{width:11px;height:11px}.wm .sbt.op svg{transform:rotate(180deg)}
.subl{padding-left:25px;display:flex;flex-direction:column;gap:3px}
.sub{display:flex;align-items:center;gap:7px;font-size:12px;line-height:18px;color:var(--text-secondary)}
.sub .scb{width:12px;height:12px;border:1.5px solid var(--n400);border-radius:3px;display:grid;place-items:center;color:#fff}
.sub .scb svg{width:9px;height:9px;stroke-width:3}
.sub.d{color:var(--text-disabled);text-decoration:line-through}.sub.d .scb{background:var(--n300);border-color:var(--n300)}
.wc.ev{background:var(--a-tint);border-color:transparent}
.wc.ev.relation{background:#f6eea6}
.wc .et{width:18px;height:18px;border-radius:4px;background:var(--a-solid);color:#fff;display:grid;place-items:center;flex:none;margin-top:1px}
.wc .et svg{width:12px;height:12px}
.wc.ev .wm{color:var(--a-text)}.wc.ev .wm .mi2{color:var(--a-text)}
.wc .pf{color:var(--a-solid);display:grid;place-items:center;margin-top:2px}.wc .pf svg{width:16px;height:16px}
.pbar{height:4px;border-radius:2px;background:var(--n200);margin:2px 0 0 25px}.pbar i{display:block;height:100%;border-radius:2px;background:var(--a-solid)}
.pft{display:flex;justify-content:space-between;padding-left:25px;font-size:12px;color:var(--text-tertiary)}
.wc.rt .rring{width:18px;height:18px;flex:none;margin-top:1px}
.wc.rt .rc{font-size:12px;color:var(--text-tertiary);line-height:20px}
.wc.rt .rcv{display:grid;place-items:center;height:20px;color:var(--text-tertiary)}.wc.rt .rcv svg{width:13px;height:13px;transform:rotate(180deg)}
.wc.rt.col .rcv svg{transform:none}
.rsl{display:flex;flex-direction:column;gap:2px;padding-left:27px}
.rs{display:flex;align-items:center;gap:8px;font-size:12px;line-height:22px;color:var(--text-secondary);border-radius:5px;margin-left:-4px;padding-left:4px}
.rs .rb{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--a-solid);display:grid;place-items:center;color:#fff;flex:none}
.rs .rb svg{width:9px;height:9px;stroke-width:3}
.rs.done .rb{background:var(--a-solid)}.rs.done{color:var(--text-tertiary);text-decoration:line-through}
.rs.skipped .rb,.rs.missed .rb,.rs.paused .rb{border-color:var(--n300);color:var(--n500)}.rs.skipped,.rs.missed{color:var(--text-tertiary)}
.gl{display:flex;align-items:center;gap:6px;height:24px;margin-top:4px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-secondary)}
.gl svg{width:13px;height:13px;color:var(--text-tertiary)}
.slot{height:58px;border:1.5px dashed var(--acc500);border-radius:10px;background:rgba(255,255,255,.6);flex:none}
.wc.src{opacity:.35;border-style:dashed}
.wempty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:13px;color:var(--text-tertiary);padding-bottom:120px;pointer-events:none}
.wempty .btn{pointer-events:auto}
.side .item .mark.si{width:16px;height:16px;display:grid;place-items:center;color:var(--text-tertiary);margin:0 2px 0 0;flex:none}
.side .mark.si svg{width:15px;height:15px}
.areahead .ttl .dot{background:var(--a-solid)}
.vbtn{position:relative}.vdot{position:absolute;right:3px;top:3px;width:7px;height:7px;border-radius:50%;background:var(--acc600);box-shadow:0 0 0 2px #fff}
.btn.tdy{margin:0}
.ghost{display:none;position:fixed;z-index:30;width:268px;transform:rotate(2deg);box-shadow:0 2px 8px rgba(0,0,0,.08),0 18px 36px rgba(0,0,0,.14);cursor:grabbing}
body.s-drag .ghost{display:flex}
.toast2{display:none;position:fixed;bottom:72px;left:calc(288px + (100vw - 288px)/2);transform:translateX(-50%);height:40px;align-items:center;gap:10px;
  padding:0 8px 0 12px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:40;font-size:13px}
body.s-undo .toast2{display:flex}
.toast2 .ok{color:#328f32;display:grid}.toast2 .ok svg{width:18px;height:18px}
.toast2 .link{border:0;background:none;font:600 12px/16px Inter,sans-serif;color:var(--acc700);padding:4px 6px;border-radius:4px}
.toast2 kbd{font:500 11px/16px Inter,sans-serif;color:var(--text-tertiary);border:1px solid var(--border);border-radius:4px;padding:0 4px}
.pk .vr{display:flex;align-items:center;gap:8px;padding:2px 8px;height:36px}.pk .vr>span{font-size:13px;color:var(--text-primary)}.pk .vr .fi{margin-left:auto;height:30px}
.pk .tgs{display:flex;flex-wrap:wrap;gap:6px;padding:2px 8px 4px}
.pk .tg{height:26px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text-secondary)}
.pk .tg.on{border-color:var(--acc500);background:var(--acc100);color:var(--text-primary)}.pk .tg .fl{width:13px;height:13px}
.ros{display:flex;flex-direction:column;gap:4px}
.ro{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px}
.ro .rd{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--n400)}
.ro.on{border-color:var(--acc600);background:var(--acc100)}.ro.on .rd{border:5px solid var(--acc600)}
.mk.rnd{border-radius:50%!important;background:var(--a-solid);color:#fff;display:grid;place-items:center}.mk.rnd svg{width:12px;height:12px;stroke-width:3}
body.p-task .wc.k-ut{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
body.p-step .rs.k-step{background:var(--acc200)}
body.p-step .pnl-step{display:flex}
body.p-task .wg,body.p-step .wg{margin-right:400px}
.pop2.s-newtask,.pop2.s-series{display:none}
body.s-newtask .pop2.s-newtask,body.s-series .pop2.s-series{display:block}
"""

STATES = [  # (label, body classes)
    ('Normal', 's-normal vnormal'), ('Scoped to Career', 's-career vcareer'), ('Grouped by project', 's-group vgroup'),
    ('Cancelled shown', 's-cancel vcancel'), ('Empty week', 's-empty vempty'), ('Nothing created yet', 's-none vnone'),
    ('View menu', 's-view vnormal k-view'), ('View menu, Inbox', 's-vin vinbox k-vin'), ('Add menu', 's-add vnormal k-add'),
    ('Period picker', 's-per vnormal k-wper'), ('New task', 's-newtask vnormal'), ('Series dialog', 's-series vnormal'),
    ('Dragging', 's-drag vdrag'), ('Undo toast', 's-undo vundo'), ('Panel: task', 's-pt vnormal p-task'),
    ('Panel: routine step', 's-ps vnormal p-step'),
]
# popover positions, measured from the rendered header (1920 x 1080)
POS = {'view': (1500, 62), 'add': (1764, 62), 'per': (1490, 62), 'ghost': (1632, 456)}


def build(src, area_html):
    html = src
    head = html[:html.find('<body')]
    rail = re.search(r'<nav class="rail".*?</nav>', html, flags=re.S).group(0)
    rail = rail.replace('<a class=on title="Areas">', '<a title="Areas">').replace('<a title="Calendar">', '<a class=on title="Calendar">')
    tp = re.search(r'<aside class="panel dpanel pnl-task career".*?</aside>', html, flags=re.S).group(0)
    apps = ''.join(app(rail, k) for k in VARIANTS)
    # popovers
    pops = bp.pop('k-view', POS['view'][0], POS['view'][1], 300, view_menu())
    pops += bp.pop('k-vin', POS['view'][0], POS['view'][1], 300, view_menu(inbox=True))
    pops += (f'<div class="pk k-vin" style="left:{POS["view"][0] + 140}px;top:{POS["view"][1] + 42}px;width:150px;z-index:62">'
             + bp.row('None', on=True) + bp.row('Priority') + '</div>')
    pops += bp.pop('k-add', POS['add'][0], POS['add'][1], 140, bp.row('Task', bp.I_CHECK.replace('<path d="M20 6 9 17l-5-5"/>', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>'))
                   + bp.row('Event', I_CAL))
    wk = (bp.row('This week', '', 'Nov 9 – 15', on=True) + '<div class="sep"></div>'
          + bp.cal(2026, 11, rng=((2026, 11, 9), (2026, 11, 15))))
    pops += bp.pop('k-wper', POS['per'][0], POS['per'][1], 252, wk)
    ghost = ('<div class="wc tk career ghost" style="left:{gx}px;top:{gy}px"><div class="wt"><span class="cb"></span><span class="ti">Draft the hackathon pitch</span></div>'
             f'<div class="wm">{icon_flag("med")}<span class="dd">Nov 15 · 6:00 PM</span><span class="pjn">{I_FOLD}Hackathon prep</span></div></div>')
    ghost = ghost.replace('{gx}', str(POS['ghost'][0])).replace('{gy}', str(POS['ghost'][1]))
    toast = (f'<div class="toast2"><span class="ok">{I_TOK}</span><span>Clean up GitHub profile completed</span>'
             '<button class="link">Undo</button><kbd>Ctrl Z</kbd></div>')
    seg = ''.join(f'<span{" class=on" if i == 0 else ""} data-c="{c}">{t}</span>' for i, (t, c) in enumerate(STATES))
    sw_ = f'<div class="states pstates"><span>Mock state</span><div class="seg" id="wst">{seg}</div></div>'
    _, mcss = bp.step_modal(area_html)
    pop2css = ''.join(re.findall(r'\.pop2,\.pmenu\{display:none\}', area_html)[:1])
    shows = ','.join(f'body.v{k} .app.wv.v-{k}' for k in VARIANTS) + '{display:flex!important}'
    pkshow = ','.join(f'body.{k} .pk.{k}' for k in ['k-view', 'k-vin', 'k-add', 'k-wper']) + '{display:block}'
    script = ('<script>const wst=document.getElementById("wst");function go(c){document.body.className=c;'
              'wst.querySelectorAll("span").forEach(x=>x.classList.toggle("on",x.dataset.c===c));'
              'document.querySelectorAll(".wb").forEach(b=>{const t=b.querySelector(".wch.tdc");const u=b.querySelector(".wch.uns");'
              'if(!t){b.scrollLeft=0;return}b.scrollLeft=t.offsetLeft-u.offsetWidth-12-292;'
              'if(/p-(task|step)/.test(c)){b.scrollLeft=t.offsetLeft+t.offsetWidth+48-(1512-b.getBoundingClientRect().left);}});}'
              'wst.onclick=e=>{const c=e.target.dataset.c;if(c)go(c);};go(document.body.className);'
              'const tip=document.getElementById("tip");document.addEventListener("mousemove",e=>{const t=e.target.closest("[data-tip]");'
              'if(!t){tip.style.display="none";return}tip.textContent=t.dataset.tip;tip.style.display="block";'
              'tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY-28)+"px";});</script>')
    body = (f'<body class="s-normal vnormal">{apps}{tp}{step_panel(tp)}{new_task()}{series()}{pops}{ghost}{toast}{sw_}'
            f'<div id="tip"></div>{script}</body></html>')
    head = head.replace('</style>', bp.CSS + mcss + pop2css + CSS + shows + pkshow + '</style>', 1)
    head = re.sub(r'<title>.*?</title>', '<title>Life OS — Tasks · Next 7 days (draft)</title>', head, count=1)
    return head + body


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    area = open(sys.argv[2], encoding='utf-8').read()
    out = build(src, area)
    open(sys.argv[3], 'w', encoding='utf-8').write(out)
    print('wrote', sys.argv[3], len(out))
