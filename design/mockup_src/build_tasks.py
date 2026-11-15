"""Build html_mockups/approved-tasks.html: the Tasks group (approved Nov 15).

One file, every Tasks screen and its mock states (switcher at the bottom left): All (Priority and Area groups),
Today, Inbox (with drop targets), Next 7 days, Routines (all routines on one board), Projects (one column per
project), a project (Section group), Completed, Cancelled and Archived; plus the filter-and-sort menu, New task,
a picker opened from New task, the detail panel, the undo toast, drag states and the empty states.

Placement rule: a task sits on its scheduled date; if none, on its due date (its card then shows a Due chip, red when
past = overdue, shown in Today); if neither, it is Unscheduled. Today is Sat, Nov 14, 2026; Next 7 days is rolling
(Sat, Nov 14 – Fri, Nov 20).

Base: approved-detail-panel.html (shell CSS, rail, the task detail panel). Pickers come from build_pickers.py, the
New task chips from the detail panel, icons and the routine ring from build_next7.py.

Notes for the style guide (record with "Approved: Tasks"):
- The filter menu's SHOW section lists Routine steps wherever routine steps can appear (Next 7 days); not drawn in the mock-up.
- Date picker (New task): Today, Tomorrow and Next week are three icon buttons side by side under the date field; no "Unscheduled" row.
- Counters are the grey pill everywhere, except in the Inbox's right container, where they take a light tint of their area (or priority) colour.
  Apply the same change to approved-pickers.html when Tasks is approved.

Usage: python build_tasks.py <approved-detail-panel.html> <approved-area.html> <out.html>
"""
import re
import sys

import build_next7 as nb
import build_pickers as bp
import rules

S = bp.svg
I_FLAG = nb.I_FLAG
I_REP, I_NOTES, I_PIN, I_ROLL, I_FOLD, I_CAL = nb.I_REP, nb.I_NOTES, nb.I_PIN, nb.I_ROLL, nb.I_FOLD, nb.I_CAL
I_CHEV, I_CHK, I_X, I_PLUS, I_INBOX = nb.I_CHEV, nb.I_CHK, nb.I_X, nb.I_PLUS, nb.I_INBOX
I_FILTER = nb.I_VIEW
I_SUN = bp.I_SUN
I_WEEK7 = S('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h2M14 14h2M8 18h2"/>')
I_ROUT = S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
I_DONEB = S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>')
I_CANB = S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 9 6 6M15 9l-6 6"/>')
I_ARCH = S('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>')
I_DUE = S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
I_GRIP = S('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>')
I_SECT = bp.I_SECTION
I_SUBADD = S('<path d="M12 5v14M5 12h14"/>')

AREAS = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'), ('personal', 'Personal'),
         ('relation', 'Relationships'), ('home', 'Home')]
AREA_NAME = dict(AREAS)
PRIS = [('high', 'High', 'Do'), ('med', 'Medium', 'Schedule'), ('low', 'Low', 'Delegate'), (None, 'None', 'Eliminate')]
PRI_COL = {'high': '#cc363c', 'med': '#c9510c', 'low': '#8f74b3'}
TODAY = 14
WEEK = list(range(14, 21))  # rolling: Sat, Nov 14 – Fri, Nov 20
DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def dow(d):
    return DOW[(d - 9) % 7]


def md(d):
    return f'Nov {d}' if d <= 30 else f'Dec {d - 30}'


# ---------------------------------------------------------------- mock data
PROJECTS = [  # key, name, area, done, total, due day, sections
    ('rp', 'Resume &amp; portfolio', 'career', 3, 5, 30, ['Resume', 'Portfolio', 'LinkedIn']),
    ('hp', 'Hackathon prep', 'career', 2, 4, 15, []),
    ('lo', 'Life OS app', 'career', 1, 6, 50, []),
    ('ef', 'Emergency fund', 'finance', 2, 5, 61, []),
    ('5k', '5K training', 'health', 3, 8, 36, []),
    ('kc', 'Kitchen deep clean', 'home', 1, 2, 15, []),
]
PROJ = {p[0]: p for p in PROJECTS}


def T(title, area=None, proj=None, sec=None, pri=None, sched=None, due=None, dtime=None, rep=False, notes=False, roll=0,
      subs=None, st='todo', on=None, key=''):
    if proj:
        area = PROJ[proj][2]
    return dict(t='task', title=title, area=area, proj=proj, sec=sec, pri=pri, sched=sched, due=due, dtime=dtime, rep=rep,
                notes=notes, roll=roll, subs=subs, st=st, on=on, key=key)


TASKS = [
    # career
    T('Update resume', proj='rp', sec='Resume', pri='high', sched=14, due=4, notes=True, roll=4, key='ut',
      subs=[('Add projects section', True), ('Fix formatting', False), ('Ask a friend to review', False)]),
    T('Reply to the recruiter email', 'career', pri='high', sched=14, key='rr'),
    T('Draft the hackathon pitch', proj='hp', pri='med', due=15, dtime='6:00 PM', key='pitch'),
    T('Submit hackathon registration', proj='hp', pri='high', sched=15, due=15, subs=[('Pick a team name', True), ('Fill in the form', False)]),
    T('Clean up GitHub profile', proj='lo', sched=14, roll=3, key='gh'),
    T('Set up the FastAPI project', proj='lo', pri='med', sched=17),
    T('Write case study for Life OS', proj='rp', sec='Portfolio', pri='med', subs=[('Outline', False), ('Screenshots', False)], key='cs'),
    T('Tailor resume for the Shopee role', proj='rp', sec='Resume', pri='med', sched=17, due=19),
    T('Add Life OS screenshots', proj='rp', sec='Portfolio', sched=18),
    T('Update LinkedIn headline', proj='rp', sec='LinkedIn', pri='low'),
    T('Apply to 2 jobs', 'career', rep=True, sched=16),
    # finance
    T('Transfer ₱2,000 to savings', proj='ef', pri='med', due=14),
    T('Research index funds', proj='ef', notes=True),
    T('Pay credit card bill', 'finance', pri='high', rep=True, sched=17, due=17),
    T('Review budget categories', 'finance', pri='low', sched=19),
    # health
    T('Book a dentist cleaning', 'health', pri='med', due=12, key='dent'),
    T('Buy running shoes', proj='5k', due=20),
    T('Run 5 km', proj='5k', rep=True, sched=14, st='done', on=14),
    T('Run 3 km easy', proj='5k', rep=True, sched=16),
    # personal
    T('Read Atomic Habits ch. 4', 'personal', sched=16),
    T('Start a sketchbook', 'personal', pri='low'),
    # relationships
    T('Call Mom', 'relation', rep=True, sched=15),
    T("Plan Ana's birthday dinner", 'relation', pri='med', sched=18, due=21),
    # home
    T('Fix the leaky faucet', 'home', pri='low'),
    T('Water the plants', 'home', rep=True, sched=15),
    T('Clean the oven', proj='kc', sched=15),
    # inbox (no owner)
    T('Call the bank about the card', notes=True, key='bank'),
    T('Renew passport', due=31),
    T('Buy groceries', sched=14),
    T('Look up dentist reviews', pri='low'),
    T('Buy a birthday card for Ana', due=18),
    # finished
    T('Draft LinkedIn post', proj='rp', sec='LinkedIn', st='done', on=12, sched=12),
    T('Get feedback from a mentor', proj='rp', sec='Resume', pri='med', st='done', on=11, sched=11),
    T('Pack laptop and chargers', proj='hp', st='done', on=13, sched=13),
    T('Pay the electricity bill', 'finance', pri='high', st='done', on=10, sched=10),
    T('Send a birthday gift to Mom', 'relation', st='done', on=11, sched=11),
    T('Order new phone case', st='done', on=10, sched=10),
    T('Declutter the pantry', proj='kc', st='done', on=12, sched=12),
    T('Sell old monitor', 'home', st='cancel', on=12),
    T('Book a haircut', 'health', pri='low', st='cancel', on=13),
    T('Sign up for a pottery class', 'personal', st='cancel', on=9),
    T('Learn Rust basics', 'personal', pri='low', st='arch', on=8),
    T('Plan a garage sale', 'home', st='arch', on=2),
    T('Compare phone plans', st='arch', on=5),
]


def E(title, area, day, time, end=None, proj=None, loc=False, rep=False):
    if proj:
        area = PROJ[proj][2]
    return dict(t='event', title=title, area=area, proj=proj, day=day, end=end or day, time=time, loc=loc, rep=rep)


EVENTS = [
    E('Hackathon weekend', 'career', 13, 'Fri 6:00 PM – Sun 3:00 PM', end=15, proj='hp'),
    E('Brunch with Ana', 'relation', 14, '11:00 AM – 12:30 PM', loc=True),
    E('Dentist appointment', 'health', 17, '10:00 – 11:00 AM', loc=True),
    E('Budgeting webinar', 'finance', 18, '7:00 – 8:00 PM'),
    E('Study group', 'career', 19, '7:00 – 9:00 PM', rep=True),
    E('Book club', 'personal', 20, '6:30 – 8:00 PM', loc=True, rep=True),
]

ROUTINES = [  # name, schedule, steps: (title, area, 7-day history Sun..Sat ending today, today's state)
    ('Morning routine', 'Daily', [('Drink a glass of water', 'health', 'DDDDDDD'), ('Make the bed', 'home', 'DDMDDDD'),
                                  ('Review today’s plan', 'career', 'DDDSDDD'), ('Journal 5 min', 'personal', 'DMDMDDD')]),
    ('Evening routine', 'Daily', [('Practice LeetCode 30 min', 'career', 'DDDDDDD'), ('Read 10 pages', 'personal', 'DMDDMD.'),
                                  ("Plan tomorrow's top task", 'career', 'DDDDSD.'), ('Stretch 10 min', 'health', 'DMMDDM.'),
                                  ('Skincare', 'health', 'DDDDDD.')]),
    ('Weekly reset', 'Sundays', [('Update the job tracker', 'career', 'D------'), ('Review job applications', 'career', 'D------'),
                                 ('Plan meals', 'home', 'S------'), ('Review the budget', 'finance', 'D------')]),
]


def is_open(t):
    return t['st'] == 'todo'


def placed(t):
    """Day a task sits on, by the placement rule."""
    return t['sched'] if t['sched'] else t['due']


def overdue(t):
    return is_open(t) and t['due'] is not None and t['due'] < TODAY


def in_inbox(t):
    return is_open(t) and (t['area'] is None or t['sched'] is None)


# ---------------------------------------------------------------- small parts
def flag(pri):
    return f'<svg class="fl" viewBox="0 0 24 24" style="color:{PRI_COL[pri]}">{I_FLAG}</svg>' if pri in PRI_COL else ''


def counter(n, plus=False):
    return f'<span class="counter">{n}{"<b class=cplus>+1</b>" if plus else ""}</span>'


def ring(frac, size=16):
    return nb.ring(frac).replace('class="rring"', f'class="rring" style="width:{size}px;height:{size}px"')


def due_chip(t, short=False):
    """The due date as plain text (no word, icon or fill); red when overdue."""
    if t['due'] is None:
        return ''
    tm = f' · {t["dtime"]}' if t['dtime'] else ''
    return f'<span class="due{" od" if overdue(t) else ""}">{md(t["due"])}{tm}</span>'


def owner_bit(t, hide):
    """Only a project name is ever shown: the checkbox colour already says the area (grey = no area)."""
    if t['proj'] and 'proj' not in hide:
        return f'<span class="own {t["area"]}"><span class="ofold">{I_FOLD}</span><span class="otx">{PROJ[t["proj"]][1]}</span></span>'
    return ''


def task_card(t, ctx):
    """ctx: hide (set of proj), noflag (grouped by priority), finished, open_key. Icons first, then text."""
    hide = ctx.get('hide', set())
    a = t['area'] or 'noarea'
    st = {'done': ' done', 'cancel': ' cancel', 'arch': ' arch'}.get(t['st'], '')
    mark = I_CHK if t['st'] == 'done' else (I_X if t['st'] == 'cancel' else '')
    cb = f'<span class="cb" title="Mark done">{mark}</span>'
    icons = flag(t['pri']) if (t['pri'] in ('high', 'med') and not ctx.get('noflag')) else ''
    if t['rep']:
        icons += f'<span class="kmi" data-tip="Repeats">{I_REP}</span>'
    if t['notes']:
        icons += f'<span class="kmi" data-tip="Has notes">{I_NOTES}</span>'
    if t['roll'] and is_open(t):
        icons += f'<span class="kmi roll" data-tip="Rolled over {t["roll"]} times">{I_ROLL}{t["roll"]}</span>'
    text = ''
    if ctx.get('finished'):
        word = {'done': 'Done', 'cancel': 'Cancelled', 'arch': 'Archived'}[t['st']]
        text += f'<span class="sdt">{word} {md(t["on"])}</span>'
    elif not (ctx.get('day') and t['sched'] is None and t['due'] == ctx.get('day')):
        text += due_chip(t)
    else:
        text += due_chip(t)
    text += owner_bit(t, hide)
    subs = ''
    if t['subs']:
        n = sum(1 for _, d in t['subs'] if d)
        text += f'<span class="sbt">{n}/{len(t["subs"])}{I_CHEV}</span>'
        subs = '<div class="subl">' + ''.join(
            f'<div class="sub{" d" if d else ""}"><span class="scb">{I_CHK if d else ""}</span>{s_}</div>' for s_, d in t['subs']) + '</div>'
    opened = ' open' if (t['subs'] and ctx.get('open_key') == t['key']) else ''
    key = f' k-{t["key"]}' if t['key'] else ''
    meta = icons + text
    m = f'<div class="km">{meta}</div>' if meta else ''
    return f'<div class="kc tk {a}{st}{key}{opened}"><div class="kt">{cb}<span class="ti">{t["title"]}</span></div>{m}{subs}</div>'


def event_card(e, ctx):
    d = ctx.get('day')
    if e['day'] != e['end']:
        if d:
            when = 'All day' if d not in (e['day'], e['end']) else ('Until 3:00 PM' if d == e['end'] else 'From 6:00 PM')
        else:
            when = e['time']
    elif d or ctx.get('today'):
        when = e['time']
    else:
        when = f'{"Today" if e["day"] == TODAY else dow(e["day"])} · {e["time"]}'
    icons = (f'<span class="kmi">{I_REP}</span>' if e['rep'] else '') + (f'<span class="kmi">{I_PIN}</span>' if e['loc'] else '')
    proj = ''
    if e.get('proj') and 'proj' not in ctx.get('hide', set()):
        proj = f'<span class="own {e["area"]}"><span class="ofold">{I_FOLD}</span><span class="otx">{PROJ[e["proj"]][1]}</span></span>'
    return (f'<div class="kc ev {e["area"]}"><div class="kt"><span class="eb">{I_CAL}</span><span class="ti">{e["title"]}</span></div>'
            f'<div class="km">{icons}<span>{when}</span>{proj}</div></div>')


def proj_card(p, ctx):
    k, name, area, done, tot, due, _ = p
    pct = round(done * 100 / tot)
    if ctx.get('day'):
        left = f'<span class="due{"" if due >= TODAY else " od"}">{md(due)}</span>'
    else:
        left = f'<span>{md(due)} · {due - TODAY}d</span>'
    return (f'<div class="kc pj {area}"><div class="kt"><span class="pf">{I_FOLD}</span><span class="ti">{name}</span></div>'
            f'<div class="pbar"><i style="width:{pct}%"></i></div><div class="pft">{left}<span>{done} / {tot}</span></div></div>')


def rout_card(r, day, opened=False):
    name, sched, steps = r
    if name == 'Weekly reset' and dow(day) != 'Sun':
        return ''
    if day == TODAY:
        states = [s[2][-1] for s in steps]
    elif day < TODAY:
        states = ['D'] * len(steps)
    else:
        states = ['.'] * len(steps)
    if name == 'Morning routine' and day == TODAY:
        states = ['D'] * len(steps)
    n = sum(1 for s in states if s == 'D')
    rows = ''
    for (title, a, _), s in zip(steps, states):
        cls = {'D': 'done', 'S': 'skipped', 'M': 'missed'}.get(s, '')
        ic = {'D': I_CHK, 'S': nb.I_DASH, 'M': I_X}.get(s, '')
        rows += f'<div class="rs {a} {cls}"><span class="rb">{ic}</span>{title}</div>'
    return (f'<div class="kc rt{" open" if opened else ""}"><div class="kt">{ring(n / len(steps), 18)}<span class="ti">{name}</span>'
            f'<span class="rc">{n}/{len(steps)}</span><span class="rcv">{I_CHEV}</span></div><div class="rsl">{rows}</div></div>')


def sgroup(label, marker, items, cls='', n=None, red=False, add=True, tone=''):
    n = len(items) if n is None else n
    body = ''.join(items)
    plus = f'<span class="sga" title="Add task">{I_PLUS}</span>' if add else ''
    return (f'<div class="sg{(" " + cls) if cls else ""}"{tone}><div class="sgh{" red" if red else ""}"><span class="sgv">{I_CHEV}</span>{marker}'
            f'<span class="sgl">{label}</span><span class="counter">{n}</span>{plus}</div><div class="sgb">{body}</div></div>')


def column(marker, name, body, n, add=True, cls='', plus=False, extra='', sub='', style=''):
    """Column title as in the reference: colour square, title, counter pill, + on the right; optional data line under it."""
    cnt = counter(n, plus) if n or plus else ''
    ad = f'<span class="icon-btn cadd" title="Add task">{I_PLUS}</span>' if add else ''
    sl = f'<div class="csub2">{sub}</div>' if sub else ''
    st_ = f' style="{style}"' if style else ''
    return (f'<section class="col{(" " + cls) if cls else ""}"{st_}><div class="chw{" two" if sub else ""}"><div class="ch">{marker}<span class="cn">{name}</span>{extra}{cnt}{ad}</div>{sl}</div>'
            f'<div class="cbody">{body}</div></section>')


def area_sq(a):
    return f'<span class="asq {a}"></span>'


PRI_SQ = {'high': '#e05359', 'med': '#fc8514', 'low': '#8f74b3', None: '#9ca3af'}
PRI_TITLE = {'high': ('Do first', 'Urgent &amp; important'), 'med': ('Schedule', 'Important, not urgent'),
             'low': ('Delegate', 'Urgent, not important'), None: ('Eliminate', 'Not urgent, not important')}


def pri_sq(k):
    return f'<span class="asq" style="background:{PRI_SQ[k]}"></span>'


def fold(a):
    return f'<span class="cfold {a}">{I_FOLD}</span>'


# ---------------------------------------------------------------- grouping engine
def order_items(items):
    ev = [i for i in items if i['t'] == 'event']
    pj = [i for i in items if i['t'] == 'proj']
    tk = [i for i in items if i['t'] == 'task']
    tk = [i for i in tk if is_open(i)] + [i for i in tk if not is_open(i)]
    return ev + pj + tk


def render(item, ctx):
    if item['t'] == 'task':
        return task_card(item, ctx)
    if item['t'] == 'event':
        return event_card(item, ctx)
    if item['t'] == 'proj':
        return proj_card(PROJ[item['k']], ctx)
    return ''


def sub_key(item, by):
    if by == 'area':
        return item['area']
    if by == 'pri':
        return item.get('pri')
    if by == 'proj':
        return item.get('proj') if item['t'] != 'proj' else item['k']
    if by == 'sec':
        return item.get('sec')


def sub_label(by, k):
    if by == 'area':
        return (AREA_NAME[k], area_sq(k)) if k else ('No area', area_sq('noarea'))
    if by == 'pri':
        return PRI_TITLE[k][0], pri_sq(k)
    if by == 'proj':
        return (PROJ[k][1], fold(PROJ[k][2])) if k else ('No project', '')
    if by == 'sec':
        return (k, '') if k else ('No section', '')


def sub_order(by, keys):
    if by == 'area':
        ref = [a for a, _ in AREAS] + [None]
    elif by == 'pri':
        ref = ['high', 'med', 'low', None]
    elif by == 'proj':
        ref = [p[0] for p in PROJECTS] + [None]
    else:
        ref = [None] + [s for p in PROJECTS for s in p[6]]
        ref = [s for s in ref if s] + [None]
    return [k for k in ref if k in keys]


def col_body(items, by, ctx, top=None, collapsed=(), hover=None, slot=None):
    """top: (label, items) fixed first subgroup (OVERDUE)."""
    out = ''
    if top and top[1]:
        out += sgroup(top[0], '', [render(i, ctx) for i in top[1]], cls='ovd', red=True, add=False)
    if not by:
        cards = [render(i, ctx) for i in order_items(items)]
        if slot is not None:
            cards.insert(slot, '<div class="slot"></div>')
        return out + ''.join(cards)
    groups = {}
    for i in items:
        groups.setdefault(sub_key(i, by), []).append(i)
    for k in sub_order(by, groups.keys()):
        lab, mk = sub_label(by, k)
        its = order_items(groups[k])
        n = sum(1 for i in its if i['t'] != 'task' or is_open(i))
        cards = [render(i, ctx) for i in its]
        if slot is not None and slot[0] == k:
            cards.insert(slot[1], '<div class="slot"></div>')
        cls = ('col-d' if lab in collapsed else '') + (' hov' if lab == hover else '')
        tone = ''
        if by == 'area':
            tone = f' data-a="{k or "noarea"}"'
        elif by == 'proj' and k:
            tone = f' data-a="{PROJ[k][2]}"'
        elif by == 'pri':
            tone = f' style="--a-solid:{PRI_SQ[k]}"'
        if tone.startswith(' data-a'):
            a_ = tone.split('"')[1]
            cls = (cls + ' ' + a_).strip()
            tone = ''
        out += sgroup(lab, mk, cards, cls=cls.strip(), n=n, tone=tone)
    return out


def hide_for(group, sub):
    h = set()
    if 'proj' in (group, sub):
        h.add('proj')
    return h


def ctx_for(group, sub, **kw):
    return dict(hide=hide_for(group, sub), noflag='pri' in (group, sub), **kw)


# ---------------------------------------------------------------- screens (boards)
def task_items(pred):
    return [t for t in TASKS if pred(t)]


def proj_items():
    return [dict(t='proj', k=p[0], area=p[2], proj=p[0], pri=None, sec=None) for p in PROJECTS]


def events_in_week():
    return [e for e in EVENTS if e['end'] >= TODAY and e['day'] <= WEEK[-1]]


def pri_columns(items, sub, ctx, top_pred=None, **kw):
    cols = ''
    for k, name, eis in PRIS:
        if kw.get('only') and k not in kw['only']:
            continue
        its = [i for i in items if i['t'] == 'task' and i['pri'] == k]
        top = None
        if top_pred:
            ov = [i for i in its if top_pred(i)]
            its = [i for i in its if not top_pred(i)]
            top = ('Overdue', ov)
        n = sum(1 for i in its if is_open(i)) + (len(top[1]) if top else 0)
        body = col_body(its, sub, ctx, top=top, **(kw.get(k) or {}))
        t, st = PRI_TITLE[k]
        cols += column(pri_sq(k), t, body, n, add=not ctx.get('finished'), plus=('plus' in kw and kw['plus'] == k), sub=st,
                       style=f'--a-solid:{PRI_SQ[k]}')
    return cols


def empty_pri_cols():
    return ''.join(column(pri_sq(k), PRI_TITLE[k][0], '', 0, sub=PRI_TITLE[k][1], style=f'--a-solid:{PRI_SQ[k]}') for k, _, _ in PRIS)


def area_columns(items, sub, ctx, top_pred=None, colkw=None):
    colkw = colkw or {}
    cols = ''
    for k, name in [(None, 'No area')] + AREAS:
        its = [i for i in items if i['area'] == k]
        top = None
        if top_pred:
            ov = [i for i in its if i['t'] == 'task' and top_pred(i)]
            its = [i for i in its if not (i['t'] == 'task' and top_pred(i))]
            top = ('Overdue', ov)
        n = sum(1 for i in its if i['t'] == 'task' and (is_open(i) or ctx.get('finished'))) + (len(top[1]) if top else 0)
        body = col_body(its, sub, ctx, top=top, **colkw.get(k, {}))
        cols += column(area_sq(k or 'noarea'), name, body, n, add=not ctx.get('finished'), cls=k or 'noarea')
    return cols


def board(cols, cls='', msg=''):
    return f'<div class="bd {cls}"><div class="cols">{cols}</div>{msg}</div>'


def scr_all(group, v=''):
    if v == 'none':
        return board(empty_pri_cols(), msg=f'<div class="bmsg"><span>No tasks yet.</span><button class="btn primary">{I_PLUS}New task</button></div>')
    if v == 'nomatch':
        return board(empty_pri_cols(), msg='<div class="bmsg"><span>No tasks match the filters.</span><button class="btn">Clear filters</button></div>')
    if group == 'pri':
        sub = 'area'
        items = task_items(is_open)
        ctx = ctx_for('pri', sub)
        kw = {}
        if v == 'filtered':
            items = [i for i in items if i['pri'] in ('high', 'med')]
            kw = {'only': ('high', 'med')}
        if v == 'drag':
            items = [i for i in items if i['key'] != 'pitch']
            kw = {'high': dict(slot=('career', 1)), 'plus': 'high'}
        return board(pri_columns(items, sub, ctx, **kw))
    sub = 'proj'
    items = task_items(is_open) + events_in_week() + proj_items()
    ctx = ctx_for('area', sub)
    colkw = {}
    if v == 'collapsed':
        colkw = {'career': dict(collapsed=('Life OS app',), hover='Hackathon prep')}
    return board(area_columns(items, sub, ctx, colkw=colkw))


def scr_today(v=''):
    sub = 'area'
    ctx = ctx_for('pri', sub, today=True, open_key='ut' if v == 'subs' else None)
    if v == 'done':
        return board(empty_pri_cols(), msg='<div class="bmsg"><span>All done for today.</span></div>')
    items = task_items(lambda t: is_open(t) and (placed(t) == TODAY or overdue(t)))
    return board(pri_columns(items, sub, ctx, top_pred=overdue))


def month_grid(drop=None):
    import calendar as _c
    weeks = _c.Calendar(0).monthdatescalendar(2026, 11)
    head = ''.join(f'<span class="mgw">{w}</span>' for w in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    cells = ''
    for wk in weeks:
        for d in wk:
            n = d.day if d.month == 11 else (d.day + 30 if d.month == 12 else None)
            cls = ['mc']
            if d.month != 11:
                cls.append('out')
            if n is not None and n < TODAY:
                cls.append('past')
            if n == TODAY:
                cls.append('tdy')
            if n == drop:
                cls.append('drop')
            cnt = sum(1 for t in TASKS if is_open(t) and n is not None and n >= TODAY and placed(t) == n)
            c = f'<span class="counter">{cnt}</span>' if cnt else ''
            cells += f'<div class="{" ".join(cls)}"><span class="mn">{d.day}</span>{c}</div>'
    nav = f'<span class="icon-btn">{bp.I_PREV}</span><span class="icon-btn">{bp.I_NEXT}</span>'
    return (f'<div class="mcal"><div class="mch"><b>November 2026</b><span class="mnav">{nav}</span></div>'
            f'<div class="mgh">{head}</div><div class="mgr">{cells}</div></div>')


def scr_inbox(v=''):
    mode = {'dragD': 'cal', 'dragP': 'pri'}.get(v, 'areas')
    ctx = dict(hide=set())
    if v == 'empty':
        left = '<div class="ibempty">Inbox is empty.</div>'
    else:
        noarea = task_items(lambda t: is_open(t) and t['area'] is None)
        nosched = task_items(lambda t: is_open(t) and t['area'] is not None and t['sched'] is None)
        if v == 'dragA':
            noarea = [t for t in noarea if t['key'] != 'bank']
        if v in ('dragD', 'dragP'):
            nosched = [t for t in nosched if t['key'] != 'cs']
        left = (sgroup('No area', '', [task_card(t, ctx) for t in noarea])
                + sgroup('No scheduled date', '', [task_card(t, ctx) for t in nosched]))
    lcol = f'<section class="col ibcol"><div class="cbody">{left}</div></section>'
    sw = '<div class="gsw ibsw">' + ''.join(f'<span{" class=on" if m == mode else ""}>{t}</span>'
                                          for m, t in [('areas', 'Areas'), ('cal', 'Calendar'), ('pri', 'Priority')]) + '</div>'
    if mode == 'areas':
        cards = ''
        for a, name in AREAS:
            nopen = sum(1 for t in TASKS if is_open(t) and t['area'] == a)
            rows = ''.join(f'<div class="dr{" on" if (v == "dragA" and p[0] == "rp") else ""}">{fold(a)}<span>{p[1]}</span>'
                           f'<span class="counter">{sum(1 for t in TASKS if is_open(t) and t["proj"] == p[0])}</span></div>'
                           for p in PROJECTS if p[2] == a)
            cards += (f'<div class="dc {a}"><div class="dh">{area_sq(a)}<span class="dn">{name}</span><span class="counter">{nopen}</span></div>'
                      f'{("<div class=drs>" + rows + "</div>") if rows else ""}</div>')
        panel = f'<div class="drops">{cards}</div>'
    elif mode == 'cal':
        panel = month_grid(drop=18 if v == 'dragD' else None)
    else:
        cards = ''
        for k, _, _ in PRIS:
            t, st = PRI_TITLE[k]
            n = sum(1 for x in TASKS if is_open(x) and x['pri'] == k)
            on = ' on' if (v == 'dragP' and k == 'med') else ''
            cards += (f'<div class="pcard{on}" style="--a-solid:{PRI_SQ[k]}"><div class="ch">{pri_sq(k)}<span class="cn">{t}</span><span class="counter">{n}</span></div>'
                      f'<div class="csub2">{st}</div></div>')
        panel = f'<div class="pcards">{cards}</div>'
    return f'<div class="bd ibbd"><div class="cols">{lcol}<div class="dropw"><div class="dwh">{sw}</div><div class="dpanel2">{panel}</div></div></div></div>'


def day_items(d, v):
    its = [t for t in TASKS if placed(t) == d and t['st'] in ('todo', 'done') and not (d == TODAY and overdue(t))]
    its += [e for e in EVENTS if e['day'] <= d <= e['end']]
    its += [dict(t='proj', k=p[0], area=p[2], proj=p[0], pri=None, sec=None) for p in PROJECTS if p[5] == d]
    return its


DAYNAME = {'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'}


def scr_next7(v=''):
    sub = {'area': 'area', 'pri': 'pri'}.get(v)
    uns = task_items(lambda t: is_open(t) and t['sched'] is None and t['due'] is None)
    if v == 'drag':
        uns = [t for t in uns if t['key'] != 'cs']
    cols = column('', 'No date', col_body(uns, sub, ctx_for(None, sub)), len(uns), sub='Schedule')
    for d in WEEK:
        ctx = ctx_for(None, sub, day=d)
        if v == 'empty':
            its, top = [], []
        else:
            its = day_items(d, v)
            top = [t for t in TASKS if overdue(t)] if d == TODAY else []
        n = sum(1 for x in its if x['t'] == 'task' and is_open(x)) + len(top)
        plus = v == 'drag' and d == 16
        title = 'Today' if d == TODAY else ('Tomorrow' if d == TODAY + 1 else DAYNAME[dow(d)])
        subl = f'{dow(d)}, {md(d)}' if d <= TODAY + 1 else md(d)
        body = ''
        if top:
            body += sgroup('Overdue', '', [task_card(t, ctx) for t in top], cls='ovd', red=True, add=False)
        if v != 'empty':
            body += ''.join(rout_card(r, d, opened=(d == TODAY and r[0] == 'Evening routine')) for r in ROUTINES)
        body += col_body(its, sub, ctx, slot=(0 if plus else None))
        cols += column('', title, body, n, plus=plus, sub=subl)
    return board(cols, cls='n7bd')


HIST_LAB = {'D': 'Done', 'S': 'Skipped', 'M': 'Missed', '-': 'Not due', '.': 'Today'}


def scr_routines(v=''):
    cols = ''
    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for name, sched, steps in ROUTINES:
        weekly = name == 'Weekly reset'
        today_states = ['-'] * len(steps) if weekly else [s_[2][-1] for s_ in steps]
        n = sum(1 for x in today_states if x == 'D')
        due = sum(1 for x in today_states if x != '-')
        cards = ''
        for title, a, hist in steps:
            st = '-' if weekly else hist[-1]
            cls = {'D': ' done', 'S': ' skipped', 'M': ' missed', '-': ' nd'}.get(st, '')
            ic = {'D': I_CHK, 'S': nb.I_DASH, 'M': I_X}.get(st, '')
            sq = ''.join(f'<i class="{ {"D": "h-d", "S": "h-s", "M": "h-m", "-": "h-n", ".": "h-t"}[h] }" data-tip="{days[j]} · {HIST_LAB[h]}"></i>'
                         for j, h in enumerate(hist))
            dn = sum(1 for h in hist if h == 'D')
            dd = sum(1 for h in hist if h in 'DSM.')
            nxt = '<span>Sun, Nov 15</span>' if weekly else ''
            cards += (f'<div class="kc stp {a}{cls}"><div class="kt"><span class="rb">{ic}</span><span class="ti">{title}</span></div>'
                      f'<div class="km">{nxt}<span class="hst">{sq}</span><span class="hn">{dn}/{dd}</span></div></div>')
        cols += column(ring(n / due if due else 0, 16), name, cards, 0, extra=(f'<span class="counter">{n}/{due}</span>' if due else ''),
                       sub=sched)
    return board(cols)


def scr_projects(v=''):
    cols = ''
    for p in PROJECTS:
        its = task_items(lambda t: is_open(t) and t['proj'] == p[0])
        body = col_body(its, 'sec' if p[6] else None, ctx_for('proj', 'sec'))
        cols += column(fold(p[2]), p[1], body, len(its), cls=p[2])
    return board(cols)


def scr_project(v=''):
    p = PROJ['rp']
    ctx = ctx_for('proj', 'pri')
    cols = ''
    for sct in [None] + p[6]:
        its = task_items(lambda t: is_open(t) and t['proj'] == 'rp' and t['sec'] == sct)
        cols += column('', sct or 'No section', col_body(its, 'pri', ctx), len(its), cls='career')
    return board(cols)


def scr_finished(st):
    ctx = dict(hide=set(), finished=True)
    items = sorted(task_items(lambda t: t['st'] == st), key=lambda t: -t['on'])
    return board(area_columns(items, None, ctx))


# ---------------------------------------------------------------- sidebar and header
def sidebar(active, empty=False):
    def it(key, inner, n=None, cls=''):
        cnt = f'<span class="sct">{n}</span>' if (n and not empty) else ''
        return f'<div class="item{" on" if active == key else ""} {cls}" data-go="{key}">{inner}{cnt}</div>'

    def ic(svg):
        return f'<span class="mark sfold sic">{svg}</span>'
    n_all = sum(1 for t in TASKS if is_open(t))
    n_inbox = sum(1 for t in TASKS if in_inbox(t))
    n_today = sum(1 for t in TASKS if is_open(t) and (placed(t) == TODAY or overdue(t)))
    n_7 = sum(1 for t in TASKS if is_open(t) and (placed(t) in WEEK or overdue(t)))
    n_rt = sum(1 for r in ROUTINES[:2] for x in r[2] if x[2][-1] == '.')
    s_ = (f'<div class="sgroup{" on" if active == "allpri" else ""}" data-go="allpri"><span class="sg-name">All</span>'
          f'{"" if empty else f"<span class=sct>{n_all}</span>"}</div>'
          + it('inbox', ic(I_INBOX) + 'Inbox', n_inbox)
          + it('today', ic(I_SUN) + 'Today', n_today)
          + it('n7', ic(I_WEEK7) + 'Next 7 days', n_7)
          + it('routines', ic(I_ROUT) + 'Routines', n_rt)
          + '<div class="side-divider"></div>'
          + f'<div class="sgroup{" on" if active == "projects" else ""}" data-go="projects"><span class="sg-name">Projects</span></div>')
    if empty:
        s_ += '<div class="sempty">No projects yet.</div>'
    else:
        for p in PROJECTS:
            n = sum(1 for t in TASKS if is_open(t) and t['proj'] == p[0])
            s_ += it('project' if p[0] == 'rp' else 'x', f'<span class="mark sfold">{I_FOLD}</span>{p[1]}', n, p[2])
    s_ += ('<div class="grow"></div><div class="side-divider"></div>'
           + it('completed', ic(I_DONEB) + 'Completed') + it('cancelled', ic(I_CANB) + 'Cancelled') + it('archived', ic(I_ARCH) + 'Archived'))
    return f'<aside class="side tside">{s_}</aside>'


def header(title, sw=None, new=True, dot=False):
    sw_html = ''
    if sw:
        opts, on = sw
        sw_html = '<span class="hdiv"></span><div class="gsw">' + ''.join(
            f'<span{" class=on" if o == on else ""}{f" data-go={g}" if g else ""}>{o}</span>' for o, g in opts) + '</div>'
    d = '<span class="fdot"></span>' if dot else ''
    nb_ = f'<button class="btn primary nt">{I_PLUS}New task</button>' if new else ''
    return (f'<div class="thead"><div class="tl">{title}{sw_html}</div><div class="tr">'
            f'<span class="icon-btn fbtn" title="Filter and sort">{I_FILTER}{d}</span>{nb_}</div></div>')


def h1(t, mk=''):
    return f'{mk}<h1 class="t-page">{t}</h1>'


SW_ALL = lambda on, pg='all': ([('Priority', pg + 'pri' if pg == 'all' else None), ('Area', pg + 'area' if pg == 'all' else None)], on)

# key: (sidebar active, header, board)
APPS = {
    'allpri': ('allpri', lambda: header(h1('All'), SW_ALL('Priority')), lambda: scr_all('pri')),
    'allarea': ('allpri', lambda: header(h1('All'), SW_ALL('Area')), lambda: scr_all('area')),
    'allcol': ('allpri', lambda: header(h1('All'), SW_ALL('Area')), lambda: scr_all('area', 'collapsed')),
    'allfilt': ('allpri', lambda: header(h1('All'), SW_ALL('Priority'), dot=True), lambda: scr_all('pri', 'filtered')),
    'alldrag': ('allpri', lambda: header(h1('All'), SW_ALL('Priority')), lambda: scr_all('pri', 'drag')),
    'nomatch': ('allpri', lambda: header(h1('All'), SW_ALL('Priority'), dot=True), lambda: scr_all('pri', 'nomatch')),
    'none': ('allpri', lambda: header(h1('All'), SW_ALL('Priority')), lambda: scr_all('pri', 'none')),
    'today': ('today', lambda: header(h1('Today'), ([('Priority', None), ('Area', None)], 'Priority')), lambda: scr_today()),
    'todaysubs': ('today', lambda: header(h1('Today'), ([('Priority', None), ('Area', None)], 'Priority')), lambda: scr_today('subs')),
    'todaydone': ('today', lambda: header(h1('Today'), ([('Priority', None), ('Area', None)], 'Priority')), lambda: scr_today('done')),
    'inbox': ('inbox', lambda: header(h1('Inbox')), lambda: scr_inbox()),
    'inboxA': ('inbox', lambda: header(h1('Inbox')), lambda: scr_inbox('dragA')),
    'inboxD': ('inbox', lambda: header(h1('Inbox')), lambda: scr_inbox('dragD')),
    'inboxP': ('inbox', lambda: header(h1('Inbox')), lambda: scr_inbox('dragP')),
    'inboxE': ('inbox', lambda: header(h1('Inbox')), lambda: scr_inbox('empty')),
    'n7': ('n7', lambda: header(h1('Next 7 days')), lambda: scr_next7()),
    'n7area': ('n7', lambda: header(h1('Next 7 days')), lambda: scr_next7('area')),
    'n7drag': ('n7', lambda: header(h1('Next 7 days')), lambda: scr_next7('drag')),
    'n7empty': ('n7', lambda: header(h1('Next 7 days')), lambda: scr_next7('empty')),
    'routines': ('routines', lambda: header(h1('Routines'), new=False), lambda: scr_routines()),
    'projects': ('projects', lambda: header(h1('Projects')), lambda: scr_projects()),
    'project': ('project', lambda: header(h1('Resume &amp; portfolio', fold('career')), ([('Priority', None), ('Section', None)], 'Section')),
                lambda: scr_project()),
    'completed': ('completed', lambda: header(h1('Completed'), new=False), lambda: scr_finished('done')),
    'cancelled': ('cancelled', lambda: header(h1('Cancelled'), new=False), lambda: scr_finished('cancel')),
    'archived': ('archived', lambda: header(h1('Archived'), new=False), lambda: scr_finished('arch')),
}


def app(rail, key):
    act, hd, bd = APPS[key]
    return (f'<div class="app tapp v-{key}">{rail}{sidebar(act, empty=(key == "none"))}<main class="main tmain">{hd()}{bd()}</main></div>')


# ---------------------------------------------------------------- overlays
def fxr(label, on=True, icon=''):
    return f'<div class="fxr"><span class="fx{" on" if on else ""}">{I_CHK}</span>{icon}<span>{label}</span></div>'


def filter_menu(filtered=False):
    s = ('<div class="vr"><span>Subgroup</span>' + bp.fi('Area', w=150, chev=True) + '</div>'
         + '<div class="vr"><span>Sort by</span>' + bp.fi('Manual', w=150, chev=True) + '</div>'
         + '<div class="sep"></div><div class="lab">Priority</div>')
    for k, n, e in PRIS:
        s += fxr(n, (k in ('high', 'med')) if filtered else True, flag(k) or '<span class="fl0"></span>')
    s += '<div class="sep"></div><div class="lab">Life areas</div>'
    for a, n in [(None, 'No area')] + AREAS:
        s += fxr(n, True, area_sq(a or 'noarea'))
    s += '<div class="sep"></div><div class="lab">Show</div>' + fxr('Completed', False) + fxr('Cancelled', False)
    if filtered:
        s += '<div class="sep"></div>' + bp.row('Clear filters', I_X)
    return s


def subgroup_menu():
    return (bp.row('Area', '', on=True) + bp.row('Project') + bp.row('None'))


def chip(text, icon, cls=''):
    return f'<button class="chip2 {cls}">{icon}{text}</button>'


def new_task(filled=False, picker=False):
    f = rules._fld
    if filled:
        title = '<span class="inp focus">Tailor resume for the Grab role<span class="caret"></span></span>'
        chips = (chip('Resume &amp; portfolio', f'<span class="cf career">{I_FOLD}</span>')
                 + chip('Resume', I_SECT) + chip('High', f'<svg viewBox="0 0 24 24">{I_FLAG}</svg>', 'hi')
                 + chip('Sun, Nov 15' if not picker else 'Scheduled', I_SUN, 'op' if picker else ('' if not picker else 'ghost'))
                 + chip('Due', I_DUE, 'ghost') + chip('Repeat', I_REP, 'ghost'))
        if picker:
            chips = chips.replace('<button class="chip2 op">', '<button class="chip2 ghost op">')
        subs = ('<div class="ntsubs"><div class="nts"><span class="scb"></span><span>Match keywords to the job post</span></div>'
                '<div class="nts"><span class="scb"></span><span>Export as PDF</span></div>'
                f'<div class="nts add">{I_SUBADD}<span>Add subtask</span></div></div>')
        create = '<button class="btn primary">Create task</button>'
    else:
        title = '<span class="inp focus"><span class="caret"></span><span class="ph2">Task title</span></span>'
        chips = (chip('Inbox', I_INBOX) + chip('Priority', f'<svg viewBox="0 0 24 24">{I_FLAG}</svg>', 'ghost')
                 + chip('Scheduled', I_SUN, 'ghost') + chip('Due', I_DUE, 'ghost') + chip('Repeat', I_REP, 'ghost'))
        subs = f'<div class="ntsubs"><div class="nts add">{I_SUBADD}<span>Add subtask</span></div></div>'
        create = '<button class="btn primary dis">Create task</button>'
    body = f'<div class="frow2">{f("Title", title)}</div><div class="ntchips">{chips}</div>{subs}'
    cls = 'nt1' if filled and not picker else ('nt2' if picker else 'nt0')
    return nb.modal(cls, 'New task', body, f'<button class="btn">Cancel</button>{create}', w=480)


STATES = [  # (label, body classes)
    ('All · Priority', 'v-allpri'), ('All · Area', 'v-allarea'), ('Subgroup collapsed, + on hover', 'v-allcol'),
    ('Filter and sort', 'v-allfilt k-filter'), ('Filters hide all', 'v-nomatch'), ('Dragging', 'v-alldrag s-drag'),
    ('Today', 'v-today'), ('Subtasks open', 'v-todaysubs'), ('Today, all done', 'v-todaydone'),
    ('Inbox', 'v-inbox'), ('Inbox: drop on a project', 'v-inboxA s-drag'), ('Inbox: calendar, drop on a day', 'v-inboxD s-drag'), ('Inbox: priority, drop on a card', 'v-inboxP s-drag'), ('Inbox empty', 'v-inboxE'),
    ('Next 7 days', 'v-n7'), ('Next 7 days by area', 'v-n7area'), ('Next 7 days: dragging', 'v-n7drag s-drag'), ('Nothing planned', 'v-n7empty'),
    ('Routines', 'v-routines'), ('Projects', 'v-projects'), ('A project', 'v-project'),
    ('Completed', 'v-completed'), ('Cancelled', 'v-cancelled'), ('Archived', 'v-archived'),
    ('New task', 'v-allpri s-nt0'), ('New task, filled', 'v-allpri s-nt1'), ('Picker in New task', 'v-allpri s-nt2 k-ntp'),
    ('Panel: task', 'v-today p-task'), ('Undo toast', 'v-allpri s-toast'), ('No tasks yet', 'v-none'),
]


CSS = """
.app.tapp{display:none!important}
.noarea{--a-solid:#9ca3af;--a-tint:#f3f4f6;--a-border:#d1d5db;--a-past:#f9fafb;--a-text:#4b5563}
/* sidebar */
.tside .item{position:relative;cursor:pointer}
.tside .sct{margin-left:auto;font-size:12px;color:var(--text-tertiary);font-weight:400}
.tside .sic{color:var(--text-tertiary)}.tside .sgroup .sct{margin-left:auto}
.tside .item .mark.si{width:16px;height:16px;display:grid;place-items:center;color:var(--text-tertiary);flex:none}
.tside .mark.si svg{width:15px;height:15px}
.tside .item.allrow .allw{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding-left:2px}
.tside .sempty{font-size:13px;color:var(--text-tertiary);padding:4px 8px}
.tside .sgroup{cursor:pointer}.tside .sgroup.on{background:var(--n100)}
/* header */
.thead .t-page{color:var(--text-primary)}
.pstates{left:300px!important;right:12px;align-items:flex-start}.pstates .seg{flex-wrap:wrap;height:auto;row-gap:2px}.pstates .seg span{white-space:nowrap;height:24px}
.tmain{position:relative}
.thead{height:32px;margin-top:24px;flex:none;display:flex;align-items:center;padding:0 24px;gap:12px}
.thead .tl{display:flex;align-items:center;gap:10px;min-width:0}
.thead .tr{margin-left:auto;display:flex;align-items:center;gap:8px}
.thead .hdiv{width:1px;height:20px;background:var(--border);margin:0 2px}
.gsw{display:flex;background:var(--n200);border-radius:var(--r-control);padding:2px;height:28px}
.gsw span{padding:0 12px;display:flex;align-items:center;font-size:12px;font-weight:500;color:var(--text-secondary);border-radius:4px;cursor:pointer}
.gsw span.on{background:#fff;color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.fbtn{position:relative;margin-left:0;width:28px;height:28px}.fbtn svg{width:16px;height:16px}
.fdot{position:absolute;right:3px;top:3px;width:7px;height:7px;border-radius:50%;background:var(--acc600);box-shadow:0 0 0 2px #fff}
body.k-filter .v-allfilt .fbtn{background:var(--n100);color:var(--text-primary)}
.btn.nt{margin:0}.btn.nt svg{width:14px;height:14px}
.cfold,.cf{display:grid;place-items:center;color:var(--a-solid)}.cfold svg,.cf svg{width:16px;height:16px}
.thead .cfold svg{width:18px;height:18px}
/* board */
.bd{flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;padding:16px 24px 0;position:relative;container-type:inline-size}
.bd .cols{display:flex;gap:16px;height:100%;min-width:min-content}
.col{flex:0 0 calc((100cqw - 64px) / 5);min-width:260px;display:flex;flex-direction:column;min-height:0}
.chw{flex:none;padding:0 2px}.ch{height:28px;flex:none;display:flex;align-items:center;gap:8px}
.csub2{font-size:12px;line-height:16px;color:var(--text-tertiary);margin-top:-2px}
.ch .asq+.cn~*,.x{}
.chw .asq,.chw .rring,.chw .cfold{margin-right:0}
.chw:has(.asq) .csub2,.chw:has(.rring) .csub2,.chw:has(.cfold) .csub2{padding-left:20px}
.ch .asq{width:12px;height:12px;border-radius:3px}
.ch .counter{margin-left:0}
.ch .cn{font-size:16px;line-height:24px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch .csub{font-size:12px;color:var(--text-tertiary)}
.ch .cadd{margin-left:auto;width:28px;height:28px;color:var(--text-secondary)}.ch .cadd svg{width:16px;height:16px}
.ch .fl,.ch .fl0{width:16px;height:16px;flex:none}
.ch .cico{display:grid;color:var(--text-tertiary)}.ch .cico svg{width:16px;height:16px}
.cplus{font-weight:600;color:var(--acc700);margin-left:3px}
.asq{width:10px;height:10px;border-radius:3px;background:var(--a-solid);flex:none;display:inline-block}
.cbody{flex:1;min-height:0;overflow-y:auto;padding:14px 0 32px;display:flex;flex-direction:column;gap:6px}
.cbody[data-fb]{-webkit-mask-image:linear-gradient(#000 calc(100% - 16px),transparent);mask-image:linear-gradient(#000 calc(100% - 16px),transparent)}
.bd[data-fr]{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent)}
.bmsg{position:absolute;inset:48px 0 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:13px;color:var(--text-tertiary);padding-bottom:140px;pointer-events:none}
.bmsg .btn{pointer-events:auto}
/* subgroups */
.sg{display:flex;flex-direction:column;gap:6px;flex:none}
.sg+.sg{margin-top:6px}
.sgh{height:24px;display:flex;align-items:center;gap:6px;padding:0 2px;border-radius:6px;cursor:pointer;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-tertiary)}
.sgh:hover,.sg.hov .sgh{background:var(--n100)}
.sgh .sgv{display:grid;color:var(--text-tertiary)}.sgh .sgv svg{width:12px;height:12px;transition:transform .12s}
.sgh .asq{width:8px;height:8px;border-radius:2px}
.sgh .fl{width:12px;height:12px}
.sgh .cfold svg{width:13px;height:13px}
.sgh .sgl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sgh .counter{letter-spacing:0;text-transform:none}
.sgh .sga{margin-left:auto;width:20px;height:20px;border-radius:5px;display:none;place-items:center;color:var(--text-secondary)}
.sgh .sga svg{width:14px;height:14px}.sgh:hover .sga,.sg.hov .sga{display:grid}.sgh .sga:hover{background:var(--n200)}
.sgh.red,.sgh.red .sgv{color:#cc363c}
.sg.col-d .sgb{display:none}.sg.col-d .sgv svg{transform:rotate(-90deg)}
.sgb{display:flex;flex-direction:column;gap:6px}
/* cards */
.kc{background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 12px;display:flex;flex-direction:column;gap:2px;cursor:pointer;flex:none}
.kc:hover{border-color:var(--n300)}
.kc .kt{display:flex;align-items:flex-start;gap:8px}
.kc .ti{font-size:14px;line-height:20px;font-weight:500;color:var(--text-primary);flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kc .cb{width:16px;height:16px;border:2px solid var(--a-solid);border-radius:4px;flex:none;margin-top:2px;display:grid;place-items:center;color:#fff;box-sizing:border-box}
.kc .cb svg{width:10px;height:10px;stroke-width:3.5}
.kc.done .cb{background:var(--a-border);border-color:var(--a-border)}
.kc.cancel .cb{border-color:var(--n300);color:var(--n400)}
.kc.done .ti,.kc.cancel .ti{text-decoration:line-through;color:var(--text-disabled)}
.kc.arch .ti{color:var(--text-tertiary)}.kc.arch .cb{border-color:var(--n300)}
.km{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px;row-gap:2px;padding-left:24px;font-size:12px;line-height:18px;color:var(--text-tertiary);min-width:0}
.km svg{width:12px;height:12px;flex:none}
.km .fl{width:12px;height:12px}
.km .kmi{display:inline-flex;align-items:center;gap:2px}
.km .kmi.roll{font-size:11px}
.km .sdt{display:inline-flex;align-items:center;gap:4px}
.km .due{color:var(--text-tertiary);white-space:nowrap}
.km .due svg{width:11px;height:11px}
.km .due.od,.pft .due.od{color:#cc363c}
.km .own{display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%;color:var(--text-tertiary)}
.km .own .otx{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.km .own .ofold{display:grid;color:var(--a-solid)}
.km .own .osq{width:8px;height:8px;border-radius:2px;background:var(--a-solid);flex:none}
.km .sbt{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:500;color:var(--text-secondary);background:var(--n100);border-radius:5px;padding:1px 4px 1px 6px;cursor:pointer}
.km .sbt:hover{background:var(--n200)}
.km .sbt svg{width:11px;height:11px}
.subl{display:none;padding:4px 0 2px 24px;flex-direction:column;gap:2px}
.kc.open .subl{display:flex}.kc.open .sbt svg{transform:rotate(180deg)}
.sub{display:flex;align-items:center;gap:7px;font-size:12px;line-height:18px;color:var(--text-secondary)}
.sub .scb,.nts .scb{width:14px;height:14px;border:2px solid var(--n400);border-radius:4px;display:grid;place-items:center;color:#fff;flex:none;box-sizing:border-box}
.sub .scb{width:12px;height:12px;border-width:1.5px;border-radius:3px}
.sub .scb svg{width:8px;height:8px;stroke-width:3.5}
.sub.d{color:var(--text-disabled);text-decoration:line-through}.sub.d .scb{background:var(--n300);border-color:var(--n300)}
.kc.ev{background:var(--a-tint);border-color:transparent}
.kc.ev.relation{background:#f6eea6}
.kc .eb{width:16px;height:16px;border-radius:4px;background:var(--a-solid);color:#fff;display:grid;place-items:center;flex:none;margin-top:2px}
.kc .eb svg{width:11px;height:11px}
.kc.ev .km{color:var(--text-secondary)}
.kc .pf{color:var(--a-solid);display:grid;place-items:center;margin-top:2px}.kc .pf svg{width:16px;height:16px}
.pbar{height:4px;border-radius:2px;background:var(--a-tint);margin:4px 0 2px 24px}.pbar i{display:block;height:100%;border-radius:2px;background:var(--a-solid)}
.pft{display:flex;justify-content:space-between;align-items:center;padding-left:24px;font-size:12px;line-height:16px;color:var(--text-tertiary)}
.pft .due{color:var(--text-tertiary)}
.pft .due svg{width:11px;height:11px}
.kc.rt .rring{flex:none;margin-top:1px}
.kc.rt .rc{font-size:12px;color:var(--text-tertiary);line-height:20px}
.kc.rt .rcv{display:grid;place-items:center;height:20px;color:var(--text-tertiary)}.kc.rt .rcv svg{width:13px;height:13px}
.kc.rt.open .rcv svg{transform:rotate(180deg)}
.rsl{display:none;flex-direction:column;gap:0;padding:4px 0 0 26px}.kc.rt.open .rsl{display:flex}
.rs{display:flex;align-items:center;gap:8px;font-size:12px;line-height:22px;color:var(--text-secondary)}
.rs .rb,.kc.stp .rb{width:14px;height:14px;border-radius:50%;border:2px solid var(--a-solid);display:grid;place-items:center;color:#fff;flex:none;box-sizing:border-box}
.rs .rb svg,.kc.stp .rb svg{width:8px;height:8px;stroke-width:3.5}
.rs.done .rb{background:var(--a-border);border-color:var(--a-border)}.rs.done{color:var(--text-disabled);text-decoration:line-through}
.rs.skipped .rb,.rs.missed .rb{border-color:var(--n300);color:var(--n500)}.rs.skipped,.rs.missed{color:var(--text-tertiary)}
/* routine step cards */
.kc.stp .rb{width:16px;height:16px;margin-top:2px}
.kc.stp.done .rb{background:var(--a-border);border-color:var(--a-border)}
.kc.stp.done .ti{color:var(--text-disabled);text-decoration:line-through}
.kc.stp.nd .rb{border-color:var(--n300)}
.hst{margin-left:auto;display:inline-flex;gap:2px}
.hst i{width:9px;height:9px;border-radius:2px;display:block;background:var(--n200)}
.hst i.h-d{background:var(--a-solid)}.hst i.h-s{background:var(--n300)}
.hst i.h-m{background:#fff;box-shadow:inset 0 0 0 1.5px var(--n300)}
.hst i.h-n{background:none;position:relative}.hst i.h-n:after{content:"";position:absolute;left:3px;top:3px;width:3px;height:3px;border-radius:50%;background:var(--n300)}
.hst i.h-t{background:#fff;box-shadow:inset 0 0 0 1.5px var(--acc500)}.hst i.h-today{box-shadow:0 0 0 1.5px var(--acc500)}
.hn{font-size:11px;color:var(--text-tertiary);min-width:22px;text-align:right}
/* next 7 days */
.n7bd .n7g{display:grid;grid-template-columns:repeat(8,260px);grid-template-rows:32px auto 1fr;column-gap:16px;height:100%;width:max-content;position:relative}
.n7h .dw{font-size:13px;font-weight:500;color:var(--text-secondary)}
.n7h .dd{font-size:16px;font-weight:600;min-width:24px;height:24px;display:grid;place-items:center;border-radius:6px;margin-left:-4px}
.n7h.tdy .dd{background:var(--acc600);color:#fff;margin-left:0;padding:0 4px}
.n7g>.cbody{padding-top:6px}
.lane{display:flex;padding-top:6px}
.lbar{flex:1;height:24px;border-radius:6px;background:var(--a-tint);color:var(--text-primary);display:flex;align-items:center;gap:6px;padding:0 8px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden}
.lbar .eb{width:14px;height:14px;border-radius:3px;background:var(--a-solid);color:#fff;display:grid;place-items:center;flex:none}.lbar .eb svg{width:10px;height:10px}
.lbar .lbm{color:var(--text-secondary);font-weight:400;font-size:11px}
.lbar.cutl{border-top-left-radius:0;border-bottom-left-radius:0;clip-path:polygon(6px 0,100% 0,100% 100%,6px 100%,0 50%);padding-left:14px}
.n7m{position:static!important;padding:0 0 160px!important}
/* inbox */
.ibbd .cols{gap:24px}
.ibcol{flex:0 0 calc((100cqw - 64px) / 5)}
.ibempty{font-size:13px;color:var(--text-tertiary);padding:8px 2px}
.dropw{flex:1;min-width:0;display:flex;flex-direction:column;margin:14px 0 24px;min-height:0;border:1px solid var(--border);border-radius:12px;background:#fff}
.dwh{height:56px;flex:none;display:flex;align-items:center;padding:0 16px}
.dpanel2{padding:0 16px 16px}
.ibsw{flex:none}
.dpanel2{flex:1;min-height:0;overflow-y:auto}
.mcal{display:flex;flex-direction:column;height:100%;border:1px solid var(--border);border-radius:10px;overflow:hidden}
.dropw .counter,.pcard .counter{background:color-mix(in oklab,var(--a-solid,#9ca3af) 16%,#fff);color:var(--text-secondary)}
.pk.k-ntp .qrow{display:flex;gap:6px;align-items:center;padding:6px 2px 0}.pk.k-ntp .qrow .qb{flex:1;width:auto}
.qb{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:6px;border:1px solid var(--border);color:var(--text-secondary);cursor:pointer}.qb:hover{background:var(--n100)}.qb svg{width:15px;height:15px}
.mch{height:44px;flex:none;display:flex;align-items:center;padding:0 8px 0 14px;font-size:14px}.mch b{font-weight:600}.mnav{margin-left:auto;display:flex;gap:2px}.mnav .icon-btn{margin:0}
.mgh{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid var(--border)}
.mgw{font-size:12px;color:var(--text-tertiary);padding:6px 10px;font-weight:500}
.mgr{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr}
.mc{border-top:1px solid var(--border);border-left:1px solid var(--border);padding:6px 8px;display:flex;align-items:flex-start;justify-content:space-between;min-height:84px}
.mc:nth-child(7n+1){border-left:0}
.mc .mn{font-size:13px;font-weight:500;min-width:22px;height:22px;display:grid;place-items:center;border-radius:6px}
.mc.out .mn,.mc.past .mn{color:var(--text-disabled)}
.mc.tdy .mn{background:var(--acc600);color:#fff;padding:0 4px}
.mc.drop{box-shadow:inset 0 0 0 2px var(--acc600);background:#f8f7fb}
.pcards{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.pcard{height:160px;border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.pcard .ch .cn{font-size:16px;font-weight:600}.pcard .csub2{padding-left:20px}
.pcard.on{border:2px solid var(--acc600);background:#f8f7fb;padding:11px 13px}
.drops{columns:3;column-gap:16px}.drops .dc{break-inside:avoid;margin-bottom:16px}
.dr .counter{margin-left:auto}.dh .counter{margin-left:4px}
.dc{border-radius:10px;background:var(--a-past);border:1px solid color-mix(in oklab,var(--a-solid) 28%,#fff);padding:4px;display:flex;flex-direction:column}
.dc.dsch,.dc.dpri{background:#fff;border:1px solid var(--border)}
.dh{height:36px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:7px;font-size:14px;font-weight:600;border:2px solid transparent}
.dh .asq{width:10px;height:10px}.dh .dcn{margin-left:auto;font-size:12px;color:var(--text-tertiary);font-weight:400}
.dh .cico{display:grid;color:var(--text-tertiary)}.dh .cico svg{width:15px;height:15px}
.drs{display:flex;flex-direction:column;gap:2px;padding:0 0 4px}
.dr{height:30px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;font-size:13px;color:var(--text-primary);border:2px solid transparent;background:rgba(255,255,255,.75)}
.dc.dsch .dr,.dc.dpri .dr{background:none}
.dr .cfold svg{width:14px;height:14px}.dr .fl,.dr .fl0{width:14px;height:14px;flex:none}.dr .dv{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.dr.on,.dh.on{border-color:var(--acc600);background:#f8f7fb}
.pk.inl{position:static;display:block;box-shadow:none;border:0;padding:0 2px 4px;width:auto}
.pk.inl .cal .d.drop i{box-shadow:0 0 0 2px var(--acc200)}
/* drag */
.slot{height:56px;border:1.5px dashed var(--acc500);border-radius:8px;flex:none;background:#fff}
.dghost{display:none;position:fixed;z-index:80;width:300px;box-shadow:0 2px 8px rgba(0,0,0,.08),0 18px 36px rgba(0,0,0,.14);cursor:grabbing;pointer-events:none}
.dghost.on{display:flex}
/* menus and pop-ups */
.pk .vr{display:flex;align-items:center;gap:8px;padding:2px 8px;height:36px}.pk .vr>span{font-size:13px;color:var(--text-primary)}.pk .vr .fi{margin-left:auto;height:30px}
.fxr{display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;border-radius:6px;font-size:13px;color:var(--text-primary);cursor:pointer}
.fxr:hover{background:var(--n100)}
.fx{width:15px;height:15px;border-radius:4px;border:1.5px solid var(--n400);display:grid;place-items:center;color:#fff;flex:none;box-sizing:border-box}
.fx svg{width:10px;height:10px;stroke-width:3;opacity:0}
.fx.on{background:var(--acc600);border-color:var(--acc600)}.fx.on svg{opacity:1}
.fxr .fl,.fxr .fl0{width:13px;height:13px;flex:none}.fxr .asq{width:9px;height:9px}
.pop2{display:none}
body.s-nt0 .pop2.nt0,body.s-nt1 .pop2.nt1,body.s-nt2 .pop2.nt2{display:block}
.ntchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}
.ntchips .cf svg{width:13px;height:13px;color:var(--a-solid)}
.ntsubs{display:flex;flex-direction:column;gap:2px;margin-top:-4px}
.nts{height:30px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;font-size:13px;color:var(--text-primary)}
.nts:hover{background:var(--n100)}
.nts.add{color:var(--text-tertiary);cursor:pointer}.nts.add svg{width:14px;height:14px}
.inp .ph2{color:var(--text-disabled)}
.btn.dis{opacity:1;background:var(--n200);border-color:var(--n200);color:var(--text-disabled);position:relative;cursor:not-allowed}
.dtip{position:absolute;bottom:calc(100% + 8px);right:0;background:#111827;color:#fff;font-size:12px;font-weight:500;padding:4px 8px;border-radius:6px;white-space:nowrap}
.dtip:after{content:"";position:absolute;top:100%;right:24px;border:5px solid transparent;border-top-color:#111827}
body.p-task .dpanel.pnl-task{display:flex}
body.p-task .v-today .kc.k-ut{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}
.toastd{display:none;position:fixed;bottom:72px;left:calc(288px + (100vw - 288px)/2);transform:translateX(-50%);height:40px;align-items:center;gap:12px;
  padding:0 8px 0 14px;background:#111827;color:#fff;border-radius:10px;box-shadow:0 14px 28px rgba(0,0,0,.18);z-index:40;font-size:13px}
body.s-toast .toast2{display:flex;bottom:112px;left:calc(288px + (100vw - 288px)/2)}
.toast2{display:none;position:fixed;bottom:72px;left:calc(288px + (100vw - 288px)/2);transform:translateX(-50%);height:40px;align-items:center;gap:10px;
  padding:0 8px 0 12px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:40;font-size:13px}
.toast2 .ok{color:#328f32;display:grid}.toast2 .ok svg{width:18px;height:18px}
.toast2 .link{border:0;background:none;font:600 12px/16px Inter,sans-serif;color:var(--acc700);padding:4px 6px;border-radius:4px}
.toast2 kbd{font:500 11px/16px Inter,sans-serif;color:var(--text-tertiary);border:1px solid var(--border);border-radius:4px;padding:0 4px}
.toastd .link{border:0;background:none;font:600 13px/16px Inter,sans-serif;color:#d4cce6;padding:4px 6px;border-radius:4px;cursor:pointer}
.toastd .link:hover{background:rgba(255,255,255,.1)}
.toastd kbd{font:500 11px/16px Inter,sans-serif;color:#9ca3af;border:1px solid #374151;border-radius:4px;padding:0 5px}
"""


def build(src, area_html):
    html = src
    head = html[:html.find('<body')]
    rail = re.search(r'<nav class="rail".*?</nav>', html, flags=re.S).group(0)
    rail = rail.replace('<a class=on title="Areas">', '<a title="Areas">').replace('<a title="Execution">', '<a class=on title="Tasks">')
    tp = re.search(r'<aside class="panel dpanel pnl-task career".*?</aside>', html, flags=re.S).group(0)
    apps = ''.join(app(rail, k) for k in APPS)
    pops = f'<div class="pk k-filter" data-anc=".fbtn" data-right="1" style="width:280px">{filter_menu(True)}</div>'
    quick = ''.join(f'<span class="qb" data-tip="{t} · {d}">{ic}</span>' for t, d, ic in
                    [('Today', 'Sat, Nov 14', bp.I_SUN), ('Tomorrow', 'Sun, Nov 15', bp.I_SUNRISE), ('Next week', 'Mon, Nov 16', bp.I_NEXTWK)])
    dp = (f'<div class="pk k-ntp" data-anc=".pop2.nt2 .chip2.op" style="width:252px"><div class="top">{bp.fi("Pick a date", bp.I_CAL, "f")}</div>'
          f'<div class="qrow">{quick}</div><div class="sep"></div>{bp.cal(2026, 11)}</div>')
    pops += dp
    ghosts = ''
    gd = {'alldrag': ('pitch', '.slot'), 'inboxA': ('bank', '.dr.on'), 'inboxD': ('cs', '.mc.drop'), 'inboxP': ('cs', '.pcard.on'), 'n7drag': ('cs', '.slot')}
    for k, (key, anc) in gd.items():
        t = next(x for x in TASKS if x['key'] == key)
        ctx = dict(hide=set(), noflag=(k == 'alldrag'))
        g = task_card(t, ctx).replace('<div class="kc ', f'<div data-anc2="{anc}" data-for="v-{k}" class="dghost kc ', 1)
        ghosts += g
    toast = (f'<div class="toast2"><span class="ok">{nb.I_TOK}</span><span>Clean up GitHub profile completed</span>'
             '<button class="link">Undo</button><kbd>Ctrl Z</kbd></div>')
    seg = ''.join(f'<span{" class=on" if i == 0 else ""} data-c="{c}">{t}</span>' for i, (t, c) in enumerate(STATES))
    sw_ = f'<div class="states pstates"><span>Mock state</span><div class="seg" id="wst">{seg}</div></div>'
    _, mcss = bp.step_modal(area_html)
    shows = ','.join(f'body.v-{k} .app.tapp.v-{k}' for k in APPS) + '{display:flex!important}'
    pkshow = 'body.k-filter .pk.k-filter,body.k-ntp .pk.k-ntp{display:block}'
    script = """<script>
const wst=document.getElementById('wst');
function vis(){return document.querySelector('.app.tapp:not([style*=none])')}
function curApp(){const c=document.body.className.match(/v-([A-Za-z0-9]+)/);return c?document.querySelector('.app.tapp.v-'+c[1]):null}
function fades(root){root.querySelectorAll('.cbody').forEach(b=>{b.toggleAttribute('data-fb',b.scrollHeight>b.clientHeight+b.scrollTop+2)});
  root.querySelectorAll('.bd').forEach(b=>{b.toggleAttribute('data-fr',b.scrollWidth>b.clientWidth+b.scrollLeft+2)})}
function place(){const a=curApp();if(!a)return;fades(a);
  document.querySelectorAll('.pk[data-anc]').forEach(p=>{const sel=p.dataset.anc;let t=null;
    if(sel.startsWith('.pop2'))t=document.querySelector(sel);else t=a.querySelector(sel);if(!t)return;const r=t.getBoundingClientRect();
    const w=p.offsetWidth||parseInt(p.style.width)||252;p.style.top=(r.bottom+6)+'px';p.style.left=(p.dataset.right?r.right-w:r.left)+'px'});
  document.querySelectorAll('.dghost').forEach(g=>{const on=document.body.classList.contains(g.dataset.for)&&document.body.classList.contains('s-drag');
    g.classList.toggle('on',on);if(!on)return;const t=a.querySelector(g.dataset.anc2);if(!t)return;const r=t.getBoundingClientRect();
    const sl=g.dataset.anc2==='.slot';if(sl)g.style.width=r.width+'px';const dy=g.dataset.anc2!=='.dr.on';g.style.left=(r.left+(sl?10:(dy?18:r.width*0.5)))+'px';g.style.top=(r.top+(sl?12:(dy?14:22)))+'px'})}
function go(c){document.body.className=c;wst.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x.dataset.c===c));requestAnimationFrame(place)}
wst.onclick=e=>{const c=e.target.dataset.c;if(c)go(c)};
const MAP={allpri:'v-allpri',allarea:'v-allarea',today:'v-today',inbox:'v-inbox',n7:'v-n7',routines:'v-routines',projects:'v-projects',project:'v-project',completed:'v-completed',cancelled:'v-cancelled',archived:'v-archived'};
document.addEventListener('click',e=>{
  const s=e.target.closest('.sbt');if(s){s.closest('.kc').classList.toggle('open');fades(curApp());return}
  const r=e.target.closest('.kc.rt .kt');if(r){r.parentElement.classList.toggle('open');return}
  const h=e.target.closest('.sgh');if(h&&!e.target.closest('.sga')){h.parentElement.classList.toggle('col-d');fades(curApp());return}
  const g=e.target.closest('[data-go]');if(g&&MAP[g.dataset.go]){go(MAP[g.dataset.go]);return}
  const cb=e.target.closest('.kc.tk .cb');if(cb){cb.closest('.kc').classList.toggle('done');return}
});
document.addEventListener('scroll',e=>{if(e.target.classList&&(e.target.classList.contains('cbody')||e.target.classList.contains('bd')))fades(curApp())},true);
go(document.body.className);
const tip=document.getElementById('tip');document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
if(!t){tip.style.display='none';return}tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';});
</script>"""
    body = (f'<body class="v-allpri">{apps}{tp}{new_task()}{new_task(True)}{new_task(True, True)}{pops}{ghosts}{toast}{sw_}'
            f'<div id="tip"></div>{script}</body></html>')
    head = head.replace('</style>', bp.CSS + mcss + CSS + shows + pkshow + '</style>', 1)
    head = re.sub(r'<title>.*?</title>', '<title>Life OS — Tasks</title>', head, count=1)
    return head + body


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    area = open(sys.argv[2], encoding='utf-8').read()
    out = build(src, area)
    open(sys.argv[3], 'w', encoding='utf-8').write(out)
    print('wrote', sys.argv[3], len(out))
