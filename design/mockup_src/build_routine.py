"""Build html_mockups/approved-routine.html: the routine page (Phase E, approved Nov 15).

One file, every mock state (switcher at the bottom left). The page lives in the Areas group: the sidebar gains a
ROUTINES group (LIFE AREAS, PROJECTS, ROUTINES, then Archived). Mock today: Sat, Nov 14, 2026.

Page: header (ring, name, schedule, areas of the steps, period switch, ⋯, Add step), five stat tiles (calculated,
not user metrics), Steps heatmap (All steps row + one row per step), Completion by step, Schedule history, and the
Day card on the right (today by default; clicking a day in the heatmap shows that day; clicking a step's square opens
Done / Skipped / To do). Checkboxes and Skip work in the mock.

No detail panel for routines or steps (review, Nov 15): the routine is edited on its page (click the name to rename,
the schedule chip opens the Repeat picker, then Change schedule), steps are edited in their heatmap row (click the
title to rename; the row's ⋯ holds owner, Feeds metric, Pause, Archive, Delete), and notes sit in a Notes card under
the Day card. routine_panel() and step_panel() are kept only for reference and are not used.

Base CSS: approved-area.html + approved-project.html (cards, heatmap, tiles, panel, pop-ups, menus), the stat-tile
and toast CSS from approved-projects-overview.html / approved-tasks.html, and the rail from approved-tasks.html.

Usage: python build_routine.py <html_mockups dir> <out.html>
"""
import json
import random
import re
import sys
from datetime import date, timedelta
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'approved-routine.html')

TODAY = date(2026, 11, 14)
D = timedelta(days=1)
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December']
WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
AREAS = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'), ('personal', 'Personal'),
         ('relation', 'Relationships'), ('home', 'Home')]
AREA = dict(AREAS)
PROJECTS = [('career', 'Resume &amp; portfolio'), ('career', 'Hackathon prep'), ('career', 'Life OS app'),
            ('finance', 'Emergency fund'), ('health', '5K training'), ('personal', 'Reading challenge'),
            ('home', 'Room makeover')]


def md(d):
    return f'{MON[d.month - 1]} {d.day}'


def wmd(d):
    return f'{WD[d.weekday()]}, {md(d)}'


def iso(d):
    return d.isoformat()


# ---------------------------------------------------------------- icons (2 px stroke)
def svg(p, cls=''):
    c = f' class="{cls}"' if cls else ''
    return f'<svg viewBox="0 0 24 24"{c}>{p}</svg>'


I = dict(
    plus='<path d="M12 5v14M5 12h14"/>',
    more='<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    left='<path d="m15 18-6-6 6-6"/>', right='<path d="m9 18 6-6-6-6"/>', chev='<path d="m6 9 6 6 6-6"/>',
    folder='<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    stats='<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    check='<path d="M20 6 9 17l-5-5"/>', x='<path d="M18 6 6 18M6 6l12 12"/>', dash='<path d="M6 12h12"/>',
    repeat='<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    cal='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    pause='<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play='<path d="m7 4 13 8-13 8z"/>',
    skip='<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    archive='<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
    trash='<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    pencil='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    md='<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15V9l3 3 3-3v6M17 9v6M15 13l2 2 2-2"/>',
    grip='<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    sliders='<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    okc='<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    info='<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
    close='<path d="M18 6 6 18M6 6l12 12"/>',
    settings='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
)


def ic(k, cls=''):
    return svg(I[k], cls)


def ring(frac, size=16, state='on'):
    """Progress ring (accent on n200). state: on | none (not due: empty grey) | paused (pause glyph)."""
    if state == 'paused':
        return f'<span class="rpz" style="width:{size}px;height:{size}px">{ic("pause")}</span>'
    r = size / 2 - 2
    c = 2 * 3.14159 * r
    arc = '' if state == 'none' else (
        f'<circle cx="{size/2}" cy="{size/2}" r="{r}" stroke="var(--acc600)" stroke-width="2.5" fill="none" stroke-linecap="round" '
        f'stroke-dasharray="{c*frac:.2f} {c:.2f}" transform="rotate(-90 {size/2} {size/2})"/>' if frac > 0 else '')
    return (f'<svg class="rring" style="width:{size}px;height:{size}px" viewBox="0 0 {size} {size}">'
            f'<circle cx="{size/2}" cy="{size/2}" r="{r}" stroke="var(--n200)" stroke-width="2.5" fill="none"/>{arc}</svg>')


# ---------------------------------------------------------------- data
def rule_due(rule, d):
    if rule == 'daily':
        return True
    if rule == 'weekdays':
        return d.weekday() < 5
    if rule == 'sun':
        return d.weekday() == 6
    if rule == 'mwf':
        return d.weekday() in (0, 2, 4)
    raise ValueError(rule)


RULE_TXT = {'daily': 'Every day', 'weekdays': 'Every weekday', 'sun': 'Sundays', 'mwf': 'Mon, Wed, Fri'}
MAP7 = {'D': 'd', 'M': 'm', 'S': 's', '-': 'n', '.': 't'}


class Routine:
    def __init__(self, key, name, schedules, steps, pauses=(), created=None, seed=1):
        self.key, self.name = key, name
        self.schedules = schedules  # [(starts_on, rule)]
        self.steps = steps  # dicts: t, a, proj, metric, start, rate, last7
        self.pauses = list(pauses)  # [(start, end_exclusive or None)]
        self.created = created or schedules[0][0]
        rnd = random.Random(seed)
        self.st = {}
        for i, s in enumerate(steps):
            d0 = date(2025, 12, 29)
            while d0 <= date(2027, 1, 3):
                self.st[(i, d0)] = self._status(s, d0, rnd)
                d0 += D

    def rule_on(self, d):
        r = None
        for start, rule in self.schedules:
            if d >= start:
                r = rule
        return r

    def paused(self, d):
        return any(a <= d and (b is None or d < b) for a, b in self.pauses)

    def open_pause(self):
        return next((a for a, b in self.pauses if b is None), None)

    def _status(self, s, d, rnd):
        rule = self.rule_on(d)
        if rule is None or d < s['start'] or d < self.created:
            return 'x'
        if not rule_due(rule, d):
            return 'n'
        if self.paused(d):
            return 'p' if d <= TODAY else 'n'
        if d > TODAY:
            return 'f'
        back = (TODAY - d).days
        l7 = s.get('last7')
        if l7 and back < 7:
            return MAP7[l7[6 - back]]
        r = rnd.random()
        return 'd' if r < s['rate'] else ('s' if r < s['rate'] + .05 else 'm')

    # stats
    def day(self, d):
        return [self.st[(i, d)] for i in range(len(self.steps))]

    def full(self, d):
        """True = full day, False = broken, None = neutral (nothing due, all skipped, paused, or today still to do)."""
        sts = [x for x in self.day(d) if x in 'dsmt']
        if not sts or all(x == 's' for x in sts):
            return None
        if 'm' in sts:
            return False
        if 't' in sts:
            return None
        return True

    def streak(self, upto=TODAY):
        n, d = 0, upto
        while d >= self.created:
            f = self.full(d)
            if f is False:
                break
            if f:
                n += 1
            d -= D
        return n

    def window(self, a, b):
        done = miss = skip = full = due_days = 0
        best = cur = 0
        best_rng = None
        start = None
        d = a
        while d <= min(b, TODAY):
            for x in self.day(d):
                done += x == 'd'
                miss += x == 'm'
                skip += x == 's'
            f = self.full(d)
            if f is not None:
                due_days += 1
            if f:
                full += 1
                if cur == 0:
                    start = d
                cur += 1
                if cur > best:
                    best, best_rng = cur, (start, d)
            elif f is False:
                cur = 0
            d += D
        rate = round(100 * done / (done + miss)) if done + miss else None
        return dict(done=done, miss=miss, skip=skip, full=full, due_days=due_days, rate=rate, best=best, best_rng=best_rng)

    def step_rate(self, i, a, b):
        done = miss = 0
        d = a
        while d <= min(b, TODAY):
            x = self.st[(i, d)]
            done += x == 'd'
            miss += x == 'm'
            d += D
        return done, done + miss

    def step_streak(self, i):
        n, d = 0, TODAY
        while d >= self.created:
            x = self.st[(i, d)]
            if x == 'm':
                break
            n += x == 'd'
            d -= D
        return n

    def areas(self):
        seen = []
        for s in self.steps:
            if s['a'] not in seen:
                seen.append(s['a'])
        return seen

    def today_count(self):
        sts = [x for x in self.day(TODAY) if x in 'dst']
        return sum(x == 'd' for x in sts), len([x for x in sts if x != 's'])

    def next_due(self):
        d = TODAY + D
        while d <= date(2027, 1, 3):
            if any(self.st[(i, d)] == 'f' for i in range(len(self.steps))):
                return d
            d += D
        return None


def S(t, a, rate=.85, proj=None, metric=None, start=date(2026, 8, 3), last7=None):
    return dict(t=t, a=a, proj=proj, metric=metric, start=start, rate=rate, last7=last7)


EVENING_STEPS = [
    S('Practice LeetCode 30 min', 'career', .9, last7='DDDDDDD'),
    S('Read 10 pages', 'personal', .74, proj='Reading challenge', metric='Reading days', last7='DMDDMD.'),
    S("Plan tomorrow’s top task", 'career', .86, last7='DDDDSD.'),
    S('Stretch 10 min', 'health', .62, metric='Stretch days', last7='DMMDDM.'),
    S('Skincare', 'health', .92, start=date(2026, 10, 26), last7='DDDDDD.'),
]
EVENING_SCHED = [(date(2026, 8, 3), 'weekdays'), (date(2026, 10, 5), 'daily')]
EVENING_PAUSE = [(date(2026, 10, 19), date(2026, 10, 26))]

R_EVE = Routine('eve', 'Evening routine', EVENING_SCHED, EVENING_STEPS, EVENING_PAUSE, seed=7)
R_EVE_P = Routine('evep', 'Evening routine', EVENING_SCHED,
                  [dict(s, last7=(s['last7'][:2] + 'ppppp') if s['last7'] else None) for s in EVENING_STEPS],
                  EVENING_PAUSE + [(date(2026, 11, 10), None)], seed=7)
R_WEEK = Routine('wk', 'Weekly reset', [(date(2026, 9, 6), 'sun')], [
    S('Update the job tracker', 'career', .9, last7='D------'),
    S('Review job applications', 'career', .85, last7='D------'),
    S('Plan meals', 'home', .7, last7='S------'),
    S('Review the budget', 'finance', .8, last7='D------'),
], seed=3)
R_NEW = Routine('new', 'Workout', [(TODAY, 'mwf')], [], created=TODAY)
R_NEWS = Routine('news', 'Workout', [(TODAY, 'daily')], [
    S('Warm up 5 min', 'health', start=TODAY, last7='------.'),
    S('Strength circuit', 'health', proj='5K training', start=TODAY, last7='------.'),
    S('Log the workout', 'health', start=TODAY, last7='------.'),
], created=TODAY)
# fix the paused mock: before Nov 10 the board's history holds; Nov 10 onwards is paused
for i, s in enumerate(EVENING_STEPS):
    for back in range(7):
        d = TODAY - timedelta(days=back)
        if d < date(2026, 11, 10):
            R_EVE_P.st[(i, d)] = R_EVE.st[(i, d)]

SIDEBAR_ROUTINES = [('mor', 'Morning routine', 1.0, 'on'), ('eve', 'Evening routine', 0.2, 'on'), ('wk', 'Weekly reset', 0, 'none')]

# ---------------------------------------------------------------- periods
PERIODS = {
    'week': (date(2026, 11, 9), date(2026, 11, 15), 'Nov 9 – 15', (date(2026, 11, 2), date(2026, 11, 8)), 'last week'),
    'month': (date(2026, 11, 1), date(2026, 11, 30), 'November 2026', (date(2026, 10, 1), date(2026, 10, 31)), 'October'),
    'quarter': (date(2026, 10, 1), date(2026, 12, 31), 'Q4 2026', (date(2026, 7, 1), date(2026, 9, 30)), 'Q3'),
    'year': (date(2026, 1, 1), date(2026, 12, 31), '2026', None, None),
}
PNAME = {'week': 'this week', 'month': 'November', 'quarter': 'Q4', 'year': '2026'}


def days(a, b):
    out, d = [], a
    while d <= b:
        out.append(d)
        d += D
    return out


def weeks_of_year():
    out, d = [], date(2025, 12, 29)
    while d <= date(2026, 12, 31):
        out.append(d)
        d += timedelta(days=7)
    return out


# ---------------------------------------------------------------- small charts
def spark(vals, good, tips):
    """Mini line chart in the execution-stats style (104 x 32, wash, end dot)."""
    col = '#328f32' if good else '#cc363c'
    vs = [v for v in vals if v is not None]
    if len(vs) < 2:
        return f'<svg class="mc mini" viewBox="0 0 104 32" style="--lc:{col}"></svg>'
    lo, hi = min(vs), max(vs)
    rng = (hi - lo) or 1
    pts = []
    n = len(vals)
    for k, v in enumerate(vals):
        if v is None:
            continue
        x = 4 + 96 * k / (n - 1)
        y = 26 - 20 * (v - lo) / rng
        pts.append((x, y, tips[k]))
    path = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for (x0, y0, _), (x1, y1, _) in zip(pts, pts[1:]):
        dx = (x1 - x0) / 3
        path += f' C{x0 + dx:.1f},{y0:.1f} {x1 - dx:.1f},{y1:.1f} {x1:.1f},{y1:.1f}'
    wash = path + f' L{pts[-1][0]:.1f},32 L{pts[0][0]:.1f},32Z'
    hits = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" class="hitc" data-tip="{t}"/>' for x, y, t in pts)
    ex, ey, _ = pts[-1]
    return (f'<svg class="mc mini" viewBox="0 0 104 32" preserveAspectRatio="none" style="--lc:{col}"><path d="{wash}" class="wash"/>'
            f'<path d="{path}" class="ln"/>{hits}<circle cx="{ex:.1f}" cy="{ey:.1f}" r="3.5" class="end"/></svg>')


def buckets(period, a, b):
    """Chart buckets for a period: days (week), weeks (month, quarter), months (year); only up to today."""
    if period == 'week':
        return [(d, d, wmd(d)) for d in days(a, min(b, TODAY))]
    if period == 'year':
        out = []
        for m in range(1, 13):
            s = date(2026, m, 1)
            if s > TODAY:
                break
            e = (date(2026, m + 1, 1) - D) if m < 12 else date(2026, 12, 31)
            out.append((s, e, MONTHS[m - 1]))
        return out
    out, d = [], a - timedelta(days=a.weekday())
    while d <= min(b, TODAY):
        s, e = max(d, a), min(d + timedelta(days=6), b)
        out.append((s, e, 'This week' if s <= TODAY <= e else f'Week of {md(d)}'))
        d += timedelta(days=7)
    return out


def tiles(r, period):
    a, b, lab, prev, plab = PERIODS[period]
    w = r.window(a, b)
    pw = r.window(*prev) if prev and prev[1] >= r.created else None
    bk = [x for x in buckets(period, a, b) if x[1] >= r.created]
    ws = [r.window(s, e) for s, e, _ in bk]
    names = [t for _, _, t in bk]

    def delta(cur, old, unit='', better_low=False, pts=False):
        if old is None or cur is None:
            return 'since ' + md(r.created) if pw is None else '—', True
        dv = cur - old
        good = dv <= 0 if better_low else dv >= 0
        sign = '+' if dv > 0 else ('−' if dv < 0 else '±')
        u = ' pts' if pts else unit
        return f'{sign}{abs(dv)}{u} vs {plab}', good

    out = []
    if w['done'] + w['miss'] + w['skip'] == 0:
        names_ = ['Completion rate', 'Full days', 'Current streak', 'Missed', 'Skipped']
        return '<div class="kpis rk">' + ''.join(
            f'<div class="tile stile"><span class="tl">{n}</span><div class="tv"><span class="num dash">—</span></div>'
            f'<span class="t-meta">&nbsp;</span></div>' for n in names_) + '</div>'
    # completion rate
    txt, good = delta(w['rate'], pw['rate'] if pw else None, pts=True)
    out.append(('Completion rate', w['rate'] if w['rate'] is not None else '—', '%' if w['rate'] is not None else '',
                spark([x['rate'] for x in ws], good, [f'{n}: {x["rate"]}%' if x['rate'] is not None else n for n, x in zip(names, ws)]), txt))
    # full days
    out.append(('Full days', w['full'], '', spark([x['full'] for x in ws], (w['full'] >= (pw['full'] if pw else 0)),
                                                   [f'{n}: {x["full"]}' for n, x in zip(names, ws)]),
                f'of {w["due_days"]} due days'))
    # current streak
    cs = r.streak()
    best = w['best']
    br = w['best_rng']
    btxt = f'Best {best} · {md(br[0])} – {br[1].day if br[0].month == br[1].month else md(br[1])}' if br and best > 1 else (
        f'Best {best}' if best else 'No full days yet')
    seq = []
    for s, e, _ in bk:
        seq.append(r.streak(min(e, TODAY - D) if e >= TODAY else e))
    out.append(('Current streak', cs, 'days' if cs != 1 else 'day', spark(seq, cs >= (seq[-2] if len(seq) > 1 else 0),
                                                                          [f'{n}: {v}' for n, v in zip(names, seq)]), btxt))
    # missed
    txt, good = delta(w['miss'], pw['miss'] if pw else None, better_low=True)
    out.append(('Missed', w['miss'], 'steps' if w['miss'] != 1 else 'step', spark([x['miss'] for x in ws], good,
                                                                               [f'{n}: {x["miss"]}' for n, x in zip(names, ws)]), txt))
    # skipped
    out.append(('Skipped', w['skip'], 'steps' if w['skip'] != 1 else 'step', spark([x['skip'] for x in ws], True,
                                                                               [f'{n}: {x["skip"]}' for n, x in zip(names, ws)]),
                f'of {w["done"] + w["miss"] + w["skip"]} due steps'))
    html = ''
    for name, num, unit, chart, line in out:
        html += (f'<div class="tile stile"><span class="tl">{name}</span><div class="tv"><span class="num">{num}</span>'
                 f'<span class="unit">{unit}</span>{chart}</div><span class="t-meta">{line}</span></div>')
    return f'<div class="kpis rk">{html}</div>'


# ---------------------------------------------------------------- shared shell parts
def sidebar(active='eve', routines=SIDEBAR_ROUTINES, variant=''):
    def grp(name, tip, add):
        return (f'<div class="sgroup" title="{tip}"><span class="sg-name">{name}</span><span style="flex:1"></span>'
                f'<span class="icon-btn sg-add" title="{add}">{ic("plus")}</span></div>')
    s = grp('Life areas', 'Open the life areas overview', 'New life area')
    s += ''.join(f'<div class="item {k}"><span class="dot"></span>{n}</div>' for k, n in AREAS)
    s += '<div class="side-divider"></div>' + grp('Projects', 'Open all projects', 'New project')
    s += ''.join(f'<div class="item {k}"><span class="mark sfold">{ic("folder")}</span>{n}</div>' for k, n in PROJECTS)
    s += '<div class="side-divider"></div>' + grp('Routines', 'Open all routines', 'New routine')
    if not routines:
        s += '<div class="sempty">No routines yet.</div>'
    for key, name, frac, st in routines:
        on = ' on' if key == active else ''
        extra = ''
        if variant == 'drag' and key == 'wk':
            continue
        if variant == 'drag' and key == 'eve':
            s += (f'<div class="sdrop"><div class="item rtn lifted"><span class="grip">{ic("grip")}</span>'
                  f'<span class="mark rmk">{ring(0, 16, "none")}</span>Weekly reset</div></div>')
        s += f'<div class="item rtn{on}{extra}" data-r="{key}"><span class="mark rmk">{ring(frac, 16, st)}</span>{name}</div>'
    s += f'<div class="grow"></div><div class="side-divider"></div><div class="item">{ic("archive")}Archived</div>'
    return f'<aside class="side rside">{s}</aside>'


def header(r, period, variant=''):
    a, b, lab, _, _ = PERIODS[period]
    seg = ''.join(f'<span class="{"on" if p == period else ""}" data-p="{p}">{p.capitalize()}</span>'
                  for p in ['week', 'month', 'quarter', 'year'])
    if r.steps:
        dn, due = r.today_count()
        st = 'paused' if r.open_pause() else ('none' if due == 0 else 'on')
        rg = ring(dn / due if due else 0, 18, st)
    else:
        rg = ring(0, 18, 'none')
    sched = RULE_TXT[r.schedules[-1][1]]
    since = r.schedules[-1][0]
    sub = (f'<button class="chip2 schip" data-tip="Change schedule">{ic("repeat")}{sched} · '
           f'{"since " + md(since) if since < TODAY else "from today"}</button>')
    tags = ''.join(f'<span class="tag area {k}"><span class="dot"></span>{AREA[k]}</span>' for k in r.areas())
    chip = ''
    if r.open_pause():
        chip = f'<span class="tag neutral">{ic("pause")}Paused since {md(r.open_pause())}</span>'
    dis = ' disabled' if not r.steps else ''
    return f'''<div class="areahead"><div>
    <div class="ttl"><span class="rhead">{rg}</span><h1 class="t-page rname" title="Rename">{r.name}</h1></div>
    <div class="phead-sub" style="padding-left:28px">{chip}{sub}{tags}</div></div>
    <div class="acts{dis}">
      <div class="seg pseg">{seg}</div>
      <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">{lab}</span><span class="icon-btn">{ic('right')}</span></div>
      <button class="btn icon mbtn" title="Edit, pause, archive or delete">{ic('more')}</button>
    </div><button class="btn primary addstep">{ic('plus')}Add step</button></div>'''


def card(title, sub, body, cls=''):
    s = f'<span class=ssub>{sub}</span>' if sub else ''
    return (f'<section class="scard {cls}"><header class="shead"><div><span class="stitle">{title}</span>{s}</div>'
            f'<div class="sact"><span class="icon-btn cmenu" title="Sort and filter">{ic("sliders")}</span></div></header>'
            f'<div class="sbody">{body}</div></section>')


def eline(text, action=None):
    btn = f'<button class="btn ghost">{ic("plus")}{action}</button>' if action else ''
    return f'<div class="card-empty"><span class="t-meta">{text}</span>{btn}</div>'


EDIT = {'i': None}


def step_label(s, i, actions=True):
    if actions and EDIT['i'] == i:
        return step_edit(s, i)
    meta = ''
    if s['proj']:
        meta += f'<span class="lm"><span class="lf">{ic("folder")}</span>{s["proj"]}</span>'
    if s['metric']:
        meta += f'<span class="lm lmet" data-tip="Feeds {s["metric"]}">{ic("stats")}{s["metric"]}</span>'
    meta = f'<span class="lmeta">{meta}</span>' if meta else ''
    act = f'<span class="hact" title="Step actions">{ic("more")}</span>' if actions else ''
    return (f'<span class="hn {s["a"]}"><span class="hl1"><span class="rbm"></span><span class="hname" title="Rename">{s["t"]}</span>{act}</span>{meta}</span>')


def step_edit(s, i):
    own = (f'<button class="chip2 sm"><span class="ocf {s["a"]}">{ic("folder")}</span>{s["proj"]}</button>' if s['proj']
           else f'<button class="chip2 sm"><span class="ocd {s["a"]}"></span>{AREA[s["a"]]}</button>')
    met = (f'<button class="chip2 sm">{ic("stats")}Feeds {s["metric"]}</button>' if s['metric']
           else f'<button class="chip2 sm ghost">{ic("stats")}Feeds metric</button>')
    menu = (f'<div class="pmenu smenu"><div class="mi">{ic("pause")}Pause step</div><div class="mi">{ic("archive")}Archive step</div>'
            f'<div class="msep"></div><div class="mi dis">{ic("trash")}Delete step<span class="mhint">Feeds {s["metric"]}. Archive it instead.</span></div></div>'
            if s['metric'] else '')
    return (f'<span class="hn hedit {s["a"]}"><span class="hl1"><span class="rbm"></span><span class="inp focus sinp">{s["t"]}<span class="caret"></span></span>'
            f'<span class="hact on">{ic("more")}</span></span><span class="echips">{own}{met}</span>{menu}</span>')


# ---------------------------------------------------------------- heatmap
def cell_tip(r, i, d, x):
    nm = r.steps[i]['t'] if i is not None else 'All steps'
    lab = {'d': 'done', 's': 'skipped', 'm': 'missed', 'p': 'paused', 't': 'to do', 'f': 'upcoming', 'n': 'not due', 'x': 'not started'}[x]
    return f'{nm} · {wmd(d)} · {lab}'


def agg(r, d):
    sts = [x for x in r.day(d) if x not in 'nx']
    if not sts:
        return ('x' if all(x == 'x' for x in r.day(d)) else 'n'), None
    if all(x == 'p' for x in sts):
        return 'p', None
    if d > TODAY:
        return 'f', None
    cnt = [x for x in sts if x in 'dm' or (x == 't')]
    if d == TODAY:
        dn = sum(x == 'd' for x in sts)
        tot = len([x for x in sts if x != 's'])
        return 'q t', (dn, tot)
    tot = len([x for x in sts if x in 'dm'])
    if not tot:
        return 's', None
    dn = sum(x == 'd' for x in sts)
    return 'q', (dn, tot)


def heatmap(r, period):
    a, b, lab, _, _ = PERIODS[period]
    if period == 'year':
        cols = weeks_of_year()
        head = ''.join(f'<span style="left:{100 * k / len(cols):.2f}%">{MON[m]}</span>'
                       for m in range(12) for k, w0 in enumerate(cols) if w0.month == m + 1 and w0.day <= 7 and w0.year == 2026)
        n = len(cols)
    else:
        cols = days(a, b)
        n = len(cols)
        if period == 'quarter':
            head = ''.join(f'<span style="left:{100 * k / n:.2f}%">{MONTHS[d.month - 1]}</span>' for k, d in enumerate(cols) if d.day == 1)
        elif period == 'month':
            head = ''.join(f'<span class="dn{" tdy" if d == TODAY else ""}" style="left:{100 * k / n:.2f}%;width:{100 / n:.2f}%">{d.day}</span>'
                           for k, d in enumerate(cols))
        else:
            head = ''.join(f'<span class="dn wk{" tdy" if d == TODAY else ""}" style="left:{100 * k / n:.2f}%;width:{100 / n:.2f}%">'
                           f'{WD[d.weekday()]} <b>{d.day}</b></span>' for k, d in enumerate(cols))
    rows = f'<div class="hrow hhead"><span class="hn"></span><div class="hmonths {period}">{head}</div></div>'

    def cells(i):
        out = ''
        for d in cols:
            if period == 'year':
                wd = [d + timedelta(days=k) for k in range(7)]
                sts = []
                for x in wd:
                    sts += r.day(x) if i is None else [r.st[(i, x)]]
                dm = [x for x in sts if x in 'dm']
                cur = d <= TODAY <= d + timedelta(days=6)
                if d > TODAY:
                    cls, o = ('f' if any(x == 'f' for x in sts) else 'n'), None
                elif dm:
                    cls, o = 'q', sum(x == 'd' for x in dm) / len(dm)
                elif any(x == 'p' for x in sts):
                    cls, o = 'p', None
                elif cur and any(x == 't' for x in sts):
                    cls, o = 'q', 0
                elif all(x == 'x' for x in sts):
                    cls, o = 'x', None
                else:
                    cls, o = 'n', None
                if cur:
                    cls += ' cw'
                st = f' style="--o:{max(o, .08):.2f}"' if o is not None else ''
                tip = f'Week of {md(d)}' + (f' · {round(100 * o)}% done' if o is not None else '')
                out += f'<i class="{cls}"{st} data-tip="{tip}"></i>'
                continue
            if i is None:
                cls, v = agg(r, d)
                st = ''
                tip = cell_tip(r, None, d, cls.split()[-1] if cls != 'q' else 'd')
                if v:
                    o = v[0] / v[1] if v[1] else 0
                    st = f' style="--o:{max(o, .08):.2f}"'
                    tip = f'All steps · {wmd(d)} · {v[0]} of {v[1]} done'
                out += f'<i class="{cls}"{st} data-d="{iso(d)}" data-tip="{tip}"></i>'
            else:
                x = r.st[(i, d)]
                out += f'<i class="{x}" data-d="{iso(d)}" data-i="{i}" data-tip="{cell_tip(r, i, d, x)}"></i>'
        return f'<div class="hcells" style="grid-template-columns:repeat({n},minmax(0,1fr))">{out}</div>'

    rows += f'<div class="hrow hall"><span class="hn"><span class="hl1"><span class="hname">All steps</span></span></span>{cells(None)}</div>'
    for i, s in enumerate(r.steps):
        rows += f'<div class="hrow {s["a"]}">{step_label(s, i)}{cells(i)}</div>'
    return f'<div class="heat2 rheat p-{period}">{rows}</div>'


def by_step(r, period):
    a, b, _, _, _ = PERIODS[period]
    rows = ''
    for i, s in enumerate(r.steps):
        dn, tot = r.step_rate(i, a, b)
        pct = round(100 * dn / tot) if tot else None
        bar = f'<span class="cbt"><i style="width:{pct or 0}%"></i></span>' if tot else '<span class="cbt"></span>'
        val = f'<span class="cbv">{pct}%</span><span class="t-meta cbn">{dn} of {tot}</span>' if tot else '<span class="t-meta cbn">Nothing due yet</span>'
        rows += f'<div class="cbrow {s["a"]}">{step_label(s, i, False)}{bar}{val}</div>'
    return f'<div class="cbs">{rows}</div>'


def schedule_strip(r, period):
    a, b, _, _, _ = PERIODS[period]
    tot = (b - a).days + 1

    def pos(x, y):
        x0, y0 = max(x, a), min(y, b)
        if x0 > y0:
            return None
        return 100 * (x0 - a).days / tot, 100 * ((y0 - x0).days + 1) / tot

    segs = ''
    for k, (start, rule) in enumerate(r.schedules):
        end = r.schedules[k + 1][0] - D if k + 1 < len(r.schedules) else date(2030, 1, 1)
        p = pos(start, end)
        if not p:
            continue
        cut = ' cutl' if start < a else ''
        open_ = ' openr' if end > b else ''
        if end > date(2029, 1, 1):
            txt = f'{RULE_TXT[rule]} · {"from" if start >= a else "since"} {md(start)}'
        else:
            txt = f'{RULE_TXT[rule]} · {md(start)} – {md(end)}'
        lab_ = f'<span>{txt}</span>' if p[1] >= 8 else ''
        segs += (f'<div class="ssg{cut}{open_}" style="left:{p[0]:.2f}%;width:calc({p[1]:.2f}% - 2px)" data-tip="{txt}">'
                 f'{lab_}</div>')
    pz = ''
    for x, y in r.pauses:
        yy = (y - D) if y else TODAY
        p = pos(x, yy)
        if not p:
            continue
        txt = f'Paused {md(x)} – {yy.day if yy.month == x.month else md(yy)}' if y else f'Paused since {md(x)}'
        pz += f'<div class="psg" style="left:{p[0]:.2f}%;width:{p[1]:.2f}%" data-tip="{txt}"><span>{txt}</span></div>'
    rows = (f'<div class="hrow srow"><span class="hn"><span class="hname">Schedule</span></span><div class="strip">{segs}</div></div>')
    if pz:
        rows += f'<div class="hrow srow"><span class="hn"><span class="hname">Pauses</span></span><div class="strip">{pz}</div></div>'
    nsch = sum(1 for k, (st0, _) in enumerate(r.schedules) if pos(st0, r.schedules[k + 1][0] - D if k + 1 < len(r.schedules) else date(2030, 1, 1)))
    return rows, (nsch, len([1 for x, y in r.pauses if pos(x, (y - D) if y else TODAY)]))


# ---------------------------------------------------------------- day card (rendered by the page script from JSON)
def routine_json(r):
    a = date(2025, 12, 29)
    st = {}
    for d in days(a, date(2027, 1, 3)):
        st[iso(d)] = ''.join(r.day(d)).replace('x', 'n')
    return dict(key=r.key, name=r.name, today=iso(TODAY), pause=iso(r.open_pause()) if r.open_pause() else None,
                next=iso(r.next_due()) if r.steps and r.next_due() else None,
                steps=[dict(t=s['t'], a=s['a'], proj=s['proj'], metric=s['metric'], streak=r.step_streak(i))
                       for i, s in enumerate(r.steps)], st=st)


# ---------------------------------------------------------------- page
def page(r, period='quarter', variant='', app_id=None, active=None, routines=SIDEBAR_ROUTINES):
    EDIT['i'] = 1 if variant == 'editstep' else None
    a, b, lab, _, _ = PERIODS[period]
    app_id = app_id or f'{r.key}-{period}'
    side = sidebar(active or r.key, routines, variant)
    if not r.steps:
        main = f'''<main class="main withagenda rmain"><div class="content">{header(r, period)}
      <div class="scroll">
        {card('Steps', '', eline('No steps yet.', 'Add step'))}
        <div class="split"><div class="leftcol">
          {card('Completion by step', '', eline('Nothing done yet.'))}
        </div>
        <div class="rcol"><aside class="agenda dcard"><header class="ag-head"><span class="stitle">Today</span><span class="t-meta">{wmd(TODAY)}</span></header>
          <div class="ag-body"><div class="ag-empty"><span class="t-meta">No steps yet.</span></div></div></aside>{notes_card(r)}</div></div>
      </div></div></main>'''
        return f'<div class="app rapp" id="{app_id}" data-r="{r.key}">{RAIL}{side}{main}</div>'
    tl = tiles(r, period)
    n_due_today = r.today_count()
    sub_steps = f'{len(r.steps)} steps in {len(r.areas())} areas' if len(r.areas()) > 1 else f'{len(r.steps)} steps in 1 area'
    strip, (ns, np_) = schedule_strip(r, period)
    show_sched = len(r.schedules) > 1 or r.pauses
    w = r.window(a, b)
    sched_sub = ' · '.join(x for x in [f'{ns} schedules' if ns > 1 else '1 schedule', f'{np_} pause' + ('s' if np_ > 1 else '') if np_ else ''] if x) + f' in {PNAME[period]}'
    cb_sub = f'{w["rate"]}% of due steps done in {PNAME[period]}' if w['rate'] is not None else ''
    sched_card = card('Schedule history', sched_sub, f'<div class="heat2 sched">{strip}</div>') if show_sched else ''
    main = f'''<main class="main withagenda rmain"><div class="content">{header(r, period)}
      <div class="scroll">
        {tl}
        <div class="split"><div class="leftcol">
          {card('Steps', sub_steps, heatmap(r, period), 'stepscard')}
          {card('Completion by step', cb_sub, by_step(r, period)) if w['rate'] is not None else card('Completion by step', '', eline('Nothing done yet.'))}
          {sched_card}
        </div>
        <div class="rcol"><aside class="agenda dcard" data-sel="{iso(TODAY)}"></aside>{notes_card(r)}</div></div>
      </div></div></main>'''
    return f'<div class="app rapp" id="{app_id}" data-r="{r.key}" data-period="{period}">{RAIL}{side}{main}</div>'


NOTES = {'eve': '<p>Start by 9 PM so the last step is done before 10:30.</p><ul><li>Phone on the charger first</li><li>LeetCode at the desk, reading in bed</li></ul>',
         'evep': '<p>Paused while travelling for the hackathon.</p>',
         'wk': '<p>Sunday morning, before brunch.</p>'}


def notes_card(r):
    body = NOTES.get(r.key, '<p class="ph">Add notes…</p>')
    return (f'<section class="scard ncard"><header class="shead"><div><span class="stitle">Notes</span></div></header>'
            f'<div class="sbody"><div class="nbody">{body}</div></div></section>')


def first_run():
    side = sidebar(None, [])
    chips = ''.join(f'<span class="qchip">{ring(0, 14, "none")}{n}</span>' for n in ['Morning routine', 'Evening routine', 'Weekly reset', 'Workout'])
    main = f'''<main class="main rmain"><div class="content"><div class="frun">
      <span class="frico">{ring(.66, 40)}</span>
      <h2 class="t-page">Set up your first routine</h2>
      <p class="t-body">A routine is a list of steps you repeat on a schedule. Each step belongs to a life area or a project.</p>
      <button class="btn primary">{ic('plus')}New routine</button>
      <div class="qchips">{chips}</div></div></div></main>'''
    return f'<div class="app rapp" id="none">{RAIL}{side}{main}</div>'


# ---------------------------------------------------------------- overlays
def modal(oid, title, body, foot, w=460, danger=False):
    return (f'<div class="pop2 ov" id="{oid}"><div class="scrim3"></div><div class="modal3" style="width:{w}px" role="dialog">'
            f'<div class="m-head"><h3>{title}</h3><span class="icon-btn" style="margin:0">{ic("close")}</span></div>'
            f'<div class="m-body">{body}</div><div class="m-foot">{foot}</div></div></div>')


def fld(label, body, w=None):
    st = f' style="width:{w}px"' if w else ' style="flex:1"'
    return f'<div class="fld"{st}><span class="fl2">{label}</span>{body}</div>'


def chip(text, icon, cls=''):
    return f'<button class="chip2 {cls}">{icon}{text}</button>'


def owner_chip(a, proj=None, ghost=False):
    if ghost:
        return chip('Owner', f'<span class="ocd ghost"></span>', 'ghost')
    if proj:
        return chip(proj, f'<span class="ocf {a}">{ic("folder")}</span>')
    return chip(AREA[a], f'<span class="ocd {a}"></span>')


def new_routine(filled):
    if filled:
        name = '<span class="inp focus">Workout<span class="caret"></span></span>'
        chips = chip('Mon, Wed, Fri', ic('repeat')) + chip('Starts Mon, Nov 16', ic('cal'))
        steps = ''.join(f'<div class="nstep"><span class="sg2">{ic("grip")}</span><span class="rbm {a}"></span><span class="nst">{t}</span>{owner_chip(a, p)}</div>'
                        for t, a, p in [('Warm up 5 min', 'health', None), ('Strength circuit', 'health', '5K training'), ('Log the workout', 'health', None)])
        steps += f'<div class="nstep add">{ic("plus")}<span>Add step</span></div>'
        prev = f'<div class="item rtn prevrow"><span class="mark rmk">{ring(0, 16, "none")}</span>Workout</div>'
        create = '<button class="btn primary">Create routine</button>'
    else:
        name = '<span class="inp focus"><span class="caret"></span><span class="ph2">Routine name</span></span>'
        chips = chip('Every day', ic('repeat')) + chip('Starts today', ic('cal'))
        steps = f'<div class="nstep add">{ic("plus")}<span>Add step</span></div>'
        prev = f'<div class="item rtn prevrow"><span class="mark rmk">{ring(0, 16, "none")}</span><span class="ph2">Routine name</span></div>'
        create = '<span class="dwrap"><span class="dtip">Add a name</span><button class="btn primary dis">Create routine</button></span>'
    body = (f'<div class="frow2">{fld("Name", name)}</div><div class="ntchips">{chips}</div>'
            f'<div class="lblrow"><span class="t-label">Steps</span>{"<span class=counter>3</span>" if filled else ""}</div>'
            f'<div class="nsteps">{steps}</div><div class="prevw">{prev}</div>')
    return modal('nr1' if filled else 'nr0', 'New routine', body, f'<button class="btn">Cancel</button>{create}', 480)


def new_step():
    body = (f'<div class="frow2">{fld("Title", "<span class=\"inp focus\">Floss<span class=\"caret\"></span></span>")}</div>'
            f'<div class="ntchips">{chip("Evening routine", ring(.2, 13))}{owner_chip("health")}{chip("Starts today", ic("cal"))}</div>')
    return modal('ns', 'New step', body, '<button class="btn">Cancel</button><button class="btn primary">Add step</button>', 440)


def repeat_pick():
    rows = [('Every day', True), ('Every weekday (Mon – Fri)', False), ('Every week (Sat)', False), ('Every month (on the 14th)', False)]
    h = ''.join(f'<div class="mi">{t}{"<span class=ck>" + ic("check") + "</span>" if on else ""}</div>' for t, on in rows)
    return (f'<div class="pmenu ov rpick" id="rpk">{h}<div class="msep"></div><div class="mi">Custom<span class="cr">›</span></div></div>')


def change_schedule():
    body = (f'<div class="cschg"><span class="chip2 static">{ic("repeat")}Every day</span><span class="arr">→</span>'
            f'<span class="chip2 static">{ic("repeat")}Mon – Sat</span></div>'
            f'<div class="opts2"><div class="opt2 on"><span class="radio on"></span><div><div class="o2t">From <span class="inp sel2 mini">Sun, Nov 15{ic("chev")}</span></div>'
            f'<div class="t-meta">Keeps 104 past days as they were</div></div></div>'
            f'<div class="opt2"><span class="radio"></span><div><div class="o2t">All days</div>'
            f'<div class="t-meta">Changes which of 104 past days were due · 15 Sundays no longer due</div></div></div></div>')
    return modal('chs', 'Change schedule?', body, '<button class="btn">Cancel</button><button class="btn primary">Change schedule</button>', 460)


def delete_routine():
    body = ('<p class="t-body">Deleted with it:</p><ul class="cascade"><li><b>4</b> steps</li><li><b>39</b> days of history</li>'
            f'<li><b>1</b> schedule</li></ul><p class="note">{ic("info")}This can\'t be undone.</p>')
    return modal('del', 'Delete Weekly reset?', body, '<button class="btn">Cancel</button><button class="btn danger">Delete routine</button>', 420)


def more_menu(paused=False):
    pz = f'<div class="mi">{ic("play")}Resume routine</div>' if paused else f'<div class="mi">{ic("pause")}Pause routine</div>'
    return (f'<div class="pmenu ov rmore" id="more"><div class="mi">{ic("skip")}Skip today</div>{pz}'
            f'<div class="mi">{ic("archive")}Archive routine</div><div class="msep"></div>'
            f'<div class="mi dis">{ic("trash")}Delete routine<span class="mhint">Steps feed Reading days and Stretch days. Archive it instead.</span></div></div>')


NFB = ('<div class="nfb"><span class="nfg"><button class="nfbtn" title="Bold"><svg viewBox="0 0 24 24"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg></button>'
       '<span class="nfs"></span><button class="nfbtn" title="Italic"><svg viewBox="0 0 24 24"><path d="M19 4h-9M14 20H5M15 4 9 20"/></svg></button></span>'
       '<span class="nfg"><button class="nfbtn" title="Bulleted list"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg></button>'
       '<span class="nfs"></span><button class="nfbtn" title="Checklist"><svg viewBox="0 0 24 24"><path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/></svg></button></span>'
       '<span class="nfg"><button class="nfbtn" title="Link"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></button></span></div>')


def routine_panel(menu=False):
    r = R_EVE
    steps = ''.join(f'<div class="pstep"><span class="sg2">{ic("grip")}</span><span class="rbm {s["a"]}"></span><span class="pst">{s["t"]}</span>'
                    f'{owner_chip(s["a"], s["proj"])}</div>' for s in r.steps)
    steps += f'<div class="pstep add">{ic("plus")}<span>Add step</span></div>'
    sched = (f'<div class="schl"><span>Every day</span><span class="t-meta">since Oct 5</span></div>'
             f'<div class="schl old"><span>Every weekday</span><span class="t-meta">Aug 3 – Oct 4</span></div>'
             f'<div class="schl old"><span>Paused</span><span class="t-meta">Oct 19 – 25</span></div>')
    mm = ''
    if menu:
        mm = (f'<div class="pmenu3 ov2"><div class="mi">{ic("md")}View Markdown</div><div class="msep"></div>'
              f'<div class="mi">{ic("skip")}Skip today</div><div class="mi">{ic("pause")}Pause routine</div><div class="mi">{ic("archive")}Archive routine</div>'
              f'<div class="msep"></div><div class="mi dis">{ic("trash")}Delete routine<span class="mhint">Steps feed Reading days and Stretch days. Archive it instead.</span></div></div>')
    return (f'<aside class="panel dpanel ov rpanel" id="{"rpm" if menu else "rp"}" aria-label="Details"><div class="panel-head"><span class="cring">{ring(.2, 12)}</span>'
            f'<nav class="crumb"><span>Routines</span></nav><span style="flex:1"></span><button class="hbtn" title="More">{ic("more")}</button></div>'
            f'<div class="panel-body"><div class="ttlrow"><span class="mk rmkt">{ring(.2, 16)}</span><h2>Evening routine</h2></div>'
            f'<div class="chips">{chip("Every day", ic("repeat"))}{chip("Since Aug 3", ic("cal"))}{chip("Active", ic("okc"))}</div>'
            f'<div class="subs"><div class="lblrow"><span class="t-label">Steps</span><span class="counter">5</span></div>{steps}</div>'
            f'<div class="subs"><div class="lblrow"><span class="t-label">Schedule</span></div>{sched}</div>'
            f'<section class="nsec"><div class="nh"><span class="t-label">Notes</span><span class="t-meta">Saved</span></div><div class="nbody">'
            f'<p>Start by 9 PM so the last step is done before 10:30.</p><ul><li>Phone on the charger first</li><li>LeetCode at the desk, reading in bed</li></ul></div></section>'
            f'</div>{NFB}{mm}</aside>')


def step_panel():
    r, i = R_EVE, 1
    s = r.steps[i]
    # last 5 weeks, Mon-first, ending this week
    start = TODAY - timedelta(days=TODAY.weekday()) - timedelta(days=28)
    grid = ''.join(f'<span class="wl">{w[0]}</span>' for w in WD)
    for k in range(35):
        d = start + timedelta(days=k)
        x = r.st[(i, d)]
        grid += f'<i class="{x}" data-tip="{wmd(d)} · {cell_tip(r, i, d, x).split(" · ")[-1]}"></i>'
    w = r.window(date(2026, 10, 1), date(2026, 12, 31))
    dn, tot = r.step_rate(i, date(2026, 10, 1), date(2026, 12, 31))
    return (f'<aside class="panel dpanel ov personal" id="sp" aria-label="Details"><div class="panel-head"><span class="cdot"></span>'
            f'<nav class="crumb"><span>Personal</span><span class="cs">/</span><span>Reading challenge</span><span class="cs">/</span><span>Evening routine</span></nav>'
            f'<span style="flex:1"></span><button class="hbtn" title="More">{ic("more")}</button></div>'
            f'<div class="panel-body"><div class="ttlrow"><span class="mk tk" title="Mark done for today"><span class="ib rnd"></span></span><h2>Read 10 pages</h2></div>'
            f'<div class="chips">{chip("Since Aug 3", ic("cal"))}{chip("Active", ic("okc"))}{chip("Feeds Reading days", ic("stats"))}</div>'
            f'<div class="subs"><div class="lblrow"><span class="t-label">History</span><span class="t-meta">Streak {r.step_streak(i)} · {round(100*dn/tot)}% in Q4</span></div>'
            f'<div class="h5w">{grid}</div></div>'
            f'<section class="nsec"><div class="nh"><span class="t-label">Notes</span><span class="t-meta"></span></div><div class="nbody"><p class="ph">Add notes…</p></div></section>'
            f'</div>{NFB}</aside>')


TOAST = (f'<div class="toast2 ov" id="toast"><span class="ok">{ic("check")}</span><span>Read 10 pages skipped for today</span>'
         '<button class="link">Undo</button><kbd>Ctrl Z</kbd></div>')
DAYPOP = '<div class="pmenu daypop" id="daypop"></div>'


# ---------------------------------------------------------------- CSS
def base_css():
    css = ''
    for f in ['approved-area.html', 'approved-project.html']:
        h = (SRC / f).read_text(encoding='utf-8')
        css += h[h.index('<style>') + 7:h.index('</style>')]
    po = (SRC / 'approved-projects-overview.html').read_text(encoding='utf-8')
    pc = po[po.index('<style>') + 7:po.index('</style>')]
    keep = [l for l in re.split(r'(?<=\})', pc) if re.search(r'\.kpis|\.tile|\.tv\b|\.tv\{|\.num\{|\.unit\{|\.mc\b|\.stile|wash|hitc', l)
            and not re.search(r'\.tl\{|\.field', l)]
    css += '\n'.join(keep)
    tk = (SRC / 'approved-tasks.html').read_text(encoding='utf-8')
    tc = tk[tk.index('<style>') + 7:tk.index('</style>')]
    css += '\n'.join(l for l in re.split(r'(?<=\})', tc) if '.toast2' in l)
    return css


def rail():
    tk = (SRC / 'approved-tasks.html').read_text(encoding='utf-8')
    i = tk.index('<nav class="rail"')
    j = tk.index('</nav>', i) + 6
    r = tk[i:j]
    r = re.sub(r'<a class="?on"?', '<a', r)
    r = r.replace('<a title="Areas"', '<a class=on title="Areas"')
    return r


RAIL = None

CSS = r"""
.app.rapp{display:none}
.app.rapp.show{display:flex}
.app{height:100vh}
.tile .tl{font-size:12px;line-height:16px;color:var(--text-tertiary);font-weight:500}
.kpis.rk{grid-template-columns:repeat(5,minmax(0,1fr))}.num.dash{color:var(--text-disabled)}
.mc .ln{stroke:var(--lc)}.mc .wash{fill:var(--lc);opacity:.08}.mc .end{fill:var(--lc);stroke:#fff;stroke-width:2}
/* sidebar routines */
.rside .rmk{display:grid;place-items:center;margin:0}
.rside .item.rtn{cursor:pointer}
.rpz{display:grid;place-items:center;color:var(--n500)}.rpz svg{width:12px;height:12px;fill:var(--n500);stroke:none}
.rside .sempty{font-size:13px;color:var(--text-tertiary);padding:4px 8px 6px}
.rside .sdrop{height:28px;border:1.5px dashed var(--n300);border-radius:6px;margin:1px 0}
.rside{position:relative}
.rside .sdrop{position:relative}
.rside .item.lifted{position:absolute;left:6px;right:-6px;top:-3px;background:#fff;border-radius:6px;z-index:2;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.1)}
.rside .grip{display:grid;color:var(--text-tertiary);margin-left:-6px}.rside .grip svg{width:12px;height:12px}
/* header */
.rhead{display:grid;place-items:center;width:18px}
.areahead .btn.addstep{margin-left:8px}.areahead .btn.addstep svg,.frun .btn svg{width:14px;height:14px}
.phead-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:24px}
.phead-sub .tag svg{width:11px;height:11px;fill:currentColor;stroke:none}
.acts.disabled .seg,.acts.disabled .pnav{opacity:.4;pointer-events:none}
.pseg span{cursor:pointer}
/* heatmap */
.rheat .hrow{grid-template-columns:240px minmax(0,1fr)}
.rheat .hrow+.hrow{margin-top:6px}
.rheat .hn{display:flex;flex-direction:column;min-width:0}
.hl1{display:flex;align-items:center;gap:8px;min-width:0}
.rbm{width:12px;height:12px;border-radius:50%;border:2px solid var(--a-solid);flex:none;box-sizing:border-box}
.lmeta{display:flex;gap:10px;padding-left:20px;font-size:11px;line-height:16px;color:var(--text-tertiary);min-width:0;white-space:nowrap;overflow:hidden}
.lm{display:inline-flex;align-items:center;gap:3px;min-width:0}
.lm svg{width:11px;height:11px;flex:none}.lf{display:grid;color:var(--a-solid)}
.hall .hname{font-weight:600}
.hall{padding-bottom:6px;border-bottom:1px solid #f1f2f4}
.rheat .hcells{gap:2px;cursor:pointer}
.rheat.p-quarter .hcells,.rheat.p-year .hcells{height:12px}
.rheat.p-month .hcells{height:18px;gap:3px}
.rheat.p-week .hcells{height:28px;gap:6px}
.rheat.p-week .hcells i{border-radius:5px}
.rheat.p-month .hcells i{border-radius:3px}
.hcells i.q{background:var(--a-solid);opacity:var(--o)}
.hall .hcells i.q{background:var(--acc600)}
.hall .hcells i.t{box-shadow:inset 0 0 0 1.5px var(--acc600);background:#fff}
.hall .hcells i.q.t{opacity:1;background:color-mix(in oklab,var(--acc600) calc(var(--o)*100%),#fff);box-shadow:inset 0 0 0 1.5px var(--acc600)}
.hall .hcells i.s{background:var(--n300)}
.hcells i.cw{outline:1.5px solid var(--text-primary);outline-offset:1px}
.hcells i.x{background:none}
.hcells i.sel{outline:1.5px solid var(--n900);outline-offset:1px}
.hcells i:hover{outline:1.5px solid var(--n500);outline-offset:1px}
.hmonths{position:relative;height:16px}
.hmonths span{position:absolute;top:0;font-size:11px;color:var(--text-tertiary)}
.hmonths span.dn{text-align:center;font-size:10px;border:0;padding:0;font-weight:500;color:var(--text-tertiary)}
.hmonths .dn.wk{font-size:11px}.hmonths .dn b{font-weight:600;color:var(--text-secondary)}
.hmonths .dn.tdy{color:#fff}.hmonths .dn.tdy b{color:#fff}
.hmonths .dn.tdy::before{content:"";position:absolute;inset:-1px 50%;margin:0 -9px;background:var(--acc600);border-radius:4px;z-index:-1}
.hmonths.week .dn.tdy::before{margin:0 -24px}
.hmonths{z-index:0}
/* completion by step */
.cbs{display:flex;flex-direction:column;gap:6px}
.cbrow{display:grid;grid-template-columns:240px minmax(0,1fr) 40px 64px;gap:12px;align-items:center;min-height:32px}
.cbt{height:8px;border-radius:999px;background:var(--n100);overflow:hidden}.cbt i{display:block;height:100%;background:var(--a-solid);border-radius:999px}
.cbv{font-size:13px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.cbn{white-space:nowrap}
/* schedule strip */
.sched .hrow{grid-template-columns:240px minmax(0,1fr)}
.sched .srow+.srow{margin-top:8px}
.strip{position:relative;height:24px;background:none}
.ssg{position:absolute;top:0;height:24px;border-radius:5px;background:var(--n100);box-shadow:inset 0 0 0 1px var(--n200);display:flex;align-items:center;padding:0 8px;overflow:hidden;margin-left:1px}
.ssg span,.psg span{font-size:12px;font-weight:500;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ssg.cutl{border-top-left-radius:0;border-bottom-left-radius:0}
.ssg.openr{border-top-right-radius:0;border-bottom-right-radius:0}
.psg{position:absolute;top:0;height:24px;border-radius:5px;background:repeating-linear-gradient(135deg,var(--n200) 0 2px,#fff 2px 5px);box-shadow:inset 0 0 0 1px var(--n200);display:flex;align-items:center;overflow:visible}
.psg span{position:absolute;left:calc(100% + 8px);color:var(--text-tertiary);overflow:visible}
/* day card */
.dcard{max-height:calc(100vh - 210px)}
.dcard .ag-head{gap:8px;align-items:center}
.dcard .dh-r{margin-left:auto;display:flex;align-items:center;gap:6px}
.dcard .dh-r .t-meta{font-variant-numeric:tabular-nums}
.dcard .btn.sm{height:24px;padding:0 8px}
.drow{display:flex;gap:10px;padding:7px 8px;border-radius:var(--r-control);align-items:flex-start;position:relative}
.drow:hover{background:var(--n100)}
.drow .rb{width:16px;height:16px;border-radius:50%;border:2px solid var(--a-solid);display:grid;place-items:center;color:#fff;flex:none;box-sizing:border-box;margin-top:2px;cursor:pointer}
.drow .rb svg{width:9px;height:9px;stroke-width:3.5}
.drow .db{flex:1;min-width:0;display:flex;flex-direction:column}
.drow .dt{font-size:14px;line-height:20px;color:var(--text-primary)}
.drow .dm{display:flex;gap:10px;font-size:12px;line-height:16px;color:var(--text-tertiary);flex-wrap:wrap}
.drow .dm svg{width:11px;height:11px}
.drow .dst{font-size:12px;color:var(--text-tertiary);line-height:20px}
.drow .skb{display:none;width:24px;height:24px;border-radius:5px;place-items:center;color:var(--text-tertiary);cursor:pointer;margin-top:-2px}
.drow .skb svg{width:15px;height:15px}.drow .skb:hover{background:var(--n200);color:var(--text-primary)}
.drow:hover .skb{display:grid}
.drow.d .rb{background:var(--a-border);border-color:var(--a-border)}
.drow.d .dt{color:var(--text-disabled);text-decoration:line-through}
.drow.s .rb,.drow.m .rb{border-color:var(--n300);color:var(--n500)}
.drow.s .dt,.drow.m .dt{color:var(--text-tertiary)}
.drow.f .rb{border-color:var(--n300);cursor:default}
.drow.p .rb{border-color:var(--n300);border-style:dotted}
.drow.p .dt{color:var(--text-tertiary)}
.dfoot{display:flex;gap:8px;padding:8px 8px 4px}
.dmsg{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px 8px}
.dmsg .btn svg{width:13px;height:13px}
.ag-head .stitle .dtw{font-weight:600}
/* first run */
.frun{margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:420px;padding-bottom:120px}
.frun .t-body{color:var(--text-secondary);font-size:13px;line-height:20px;margin:0}
.frun h2{margin:6px 0 0}
.qchips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px}
.qchip{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:500;color:var(--text-secondary);cursor:pointer}
.qchip:hover{background:var(--n50)}
.rmain .content{min-height:0}
.main.rmain:not(.withagenda) .content{display:flex}
/* pop-ups */
.ov{display:none}
.ntchips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.nsteps{display:flex;flex-direction:column;gap:2px;margin-top:-4px}
.nstep,.pstep{display:flex;align-items:center;gap:8px;height:32px;padding:0 4px;border-radius:6px}
.nstep:hover,.pstep:hover{background:var(--n50)}
.nstep .nst,.pstep .pst{flex:1;font-size:13px;color:var(--text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nstep.add,.pstep.add{color:var(--text-tertiary);font-size:13px;cursor:pointer}.nstep.add svg,.pstep.add svg{width:14px;height:14px}
.sg2{display:grid;color:var(--n400);cursor:grab}.sg2 svg{width:12px;height:12px}
.ocd{width:8px;height:8px;border-radius:2px;background:var(--a-solid)}.ocd.ghost{background:none;border:1.5px dashed var(--n400)}
.ocf{display:grid;color:var(--a-solid)}.ocf svg{width:13px;height:13px;color:var(--a-solid)!important}
.chip2 .rring{flex:none}
.prevw{display:flex;flex-direction:column;gap:6px;padding-top:4px;border-top:1px solid #f1f2f4}
.prevw .item{width:240px;height:28px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;background:var(--n100);font-size:13px;color:var(--text-primary)}
.prevw .rmk{display:grid;place-items:center;margin:0}
.ph2{color:var(--text-disabled)}
.chip2.static{cursor:default}
.cschg{display:flex;align-items:center;gap:8px}.cschg .arr{color:var(--text-tertiary)}
.opts2{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.opt2{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer}
.opt2.on{border-color:var(--acc600);background:var(--acc100)}
.o2t{font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px;min-height:24px}
.radio{width:16px;height:16px;border-radius:50%;border:2px solid var(--n300);flex:none;margin-top:4px;box-sizing:border-box}
.radio.on{border:5px solid var(--acc600)}
.inp.sel2.mini{height:24px;font-size:12px;display:inline-flex;align-items:center;gap:4px;padding:0 6px}.inp.sel2.mini svg{width:12px;height:12px}
/* panel */
.rpanel .cring,.rpanel .rmkt{display:grid;place-items:center}
.mk.rmkt{background:var(--acc100)}
.ib.rnd{border-radius:50%}
.schl{display:flex;justify-content:space-between;align-items:center;height:28px;padding:0 4px;font-size:13px;color:var(--text-primary)}
.schl.old span:first-child{color:var(--text-tertiary)}
.h5w{display:grid;grid-template-columns:repeat(7,24px);gap:4px;padding:2px 4px}
.h5w .wl{font-size:10px;color:var(--text-tertiary);text-align:center}
.h5w i{display:block;height:24px;border-radius:5px}
.h5w i.x{background:none}
.pmenu3.ov2{display:block;top:48px}
.schip{height:24px}.schip svg{width:12px;height:12px}
body.k-sched .app.show .schip{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200);color:var(--text-primary)}
.rpick{left:340px;top:84px;width:240px}.rpick .mi .ck,.rpick .cr{margin-left:auto;color:var(--acc600);display:grid}.rpick .ck svg{width:14px;height:14px}.rpick .cr{color:var(--text-tertiary)}
.rname{cursor:text;border-radius:6px;padding:0 4px;margin-left:-4px}.rname:hover{background:var(--n100)}
.hname[title]{cursor:text}
.hact{display:none;margin-left:auto;width:22px;height:22px;border-radius:5px;place-items:center;color:var(--text-tertiary);cursor:pointer;flex:none}
.hact svg{width:14px;height:14px}.hact:hover,.hact.on{background:var(--n200);color:var(--text-primary)}
.hrow:hover .hact,.hact.on{display:grid}
.rheat .hn{padding-right:8px;position:relative}
.hedit .sinp{height:26px;font-size:13px;flex:1;min-width:0;padding:0 8px;display:flex;align-items:center}
.hrow:has(.hedit){align-items:start}
.echips{display:flex;gap:6px;padding:6px 0 2px 20px;flex-wrap:wrap}
.chip2.sm{height:22px;font-size:11px;padding:0 6px}.chip2.sm svg{width:12px;height:12px}
.smenu{display:block;position:absolute;left:226px;top:30px;width:250px;z-index:6}
.rcol{display:flex;flex-direction:column;gap:16px;position:sticky;top:0;min-width:0}
.rcol .agenda{position:static;max-height:none}
.ncard .nbody{font-size:13px;line-height:20px;color:var(--text-primary)}
.ncard .nbody p{margin:0 0 6px}.ncard .nbody ul{margin:0;padding-left:18px}.ncard .nbody .ph{color:var(--text-disabled)}
/* day popover */
.daypop{position:fixed;width:200px;z-index:30;display:none}
.daypop .dph{font-size:12px;color:var(--text-tertiary);padding:4px 8px 6px;line-height:16px}
.daypop .dph b{display:block;color:var(--text-primary);font-weight:600;font-size:13px}
.daypop .mi{justify-content:flex-start}
.daypop .mi .ck{margin-left:auto;color:var(--acc600);display:grid}.daypop .mi .ck svg{width:14px;height:14px}
.daypop .mi.dis{opacity:.45;pointer-events:none}
.rmore{right:130px;top:62px;width:260px}
.pop2.ov .dwrap{position:relative}
body:not(.k-hover) .dtip{display:none}
.states{max-width:calc(100vw - 24px)}.states .seg{flex-wrap:wrap;height:auto;row-gap:2px}.states .seg span{white-space:nowrap;height:24px}
"""

JS = r"""
let DATA=__DATA__;const ORIG=JSON.stringify(DATA);
const ICON={check:'<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',x:'<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 dash:'<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',skip:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
 folder:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
 stats:'<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
 play:'<svg viewBox="0 0 24 24"><path d="m7 4 13 8-13 8z"/></svg>',pause:'<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dt=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fmt=s=>{const d=dt(s);return WD[d.getDay()]+', '+MON[d.getMonth()]+' '+d.getDate()};
const LAB={d:'',s:'Skipped',m:'Missed',p:'Paused',t:'',f:'',n:''};
function ring(fr){const r=7,c=2*Math.PI*r;return `<svg class="rring" style="width:18px;height:18px" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="var(--n200)" stroke-width="2.5" fill="none"/>${fr>0?`<circle cx="9" cy="9" r="7" stroke="var(--acc600)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="${(c*fr).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 9 9)"/>`:''}</svg>`}
function renderDay(app){
  const card=app.querySelector('.dcard');if(!card||!DATA[app.dataset.r])return;
  if(!card.dataset.sel)return;const R=DATA[app.dataset.r],sel=card.dataset.sel,sts=(R.st[sel]||'').split('');
  const isT=sel===R.today,past=sel<R.today;
  const title=isT?'Today':fmt(sel).split(',')[0],sub=isT?fmt(sel):fmt(sel).split(', ')[1];
  const due=sts.map((x,i)=>[x,i]).filter(([x])=>x!=='n');
  const cnt=due.filter(([x])=>x!=='s'&&x!=='p'),dn=cnt.filter(([x])=>x==='d').length;
  let h=`<header class="ag-head"><span class="stitle">${title}</span><span class="t-meta">${sub}</span><span class="dh-r">`;
  if(!isT)h+=`<button class="btn sm gotoday">Today</button>`;
  if(cnt.length&&due.every(([x])=>x!=='p'))h+=ring(dn/cnt.length)+`<span class="t-meta">${dn}/${cnt.length}</span>`;
  h+=`</span></header><div class="ag-body">`;
  if(!due.length){h+=`<div class="dmsg"><span class="t-meta">Not due.${isT&&R.next?' Next: '+fmt(R.next)+'.':''}</span></div>`}
  else if(due.every(([x])=>x==='p')){h+=`<div class="dmsg"><span class="t-meta">Paused since ${fmt(R.pause||sel).split(', ')[1]}.</span>${isT?`<button class="btn">${ICON.play}Resume</button>`:''}</div>`}
  else{
    for(const [x,i] of due){const s=R.steps[i];
      let m='';if(s.proj)m+=`<span class="lm"><span class="lf">${ICON.folder}</span>${s.proj}</span>`;
      if(s.metric)m+=`<span class="lm">${ICON.stats}${s.metric}</span>`;
      if(isT&&s.streak>1)m+=`<span>Streak ${s.streak}</span>`;
      const ico=x==='d'?ICON.check:x==='s'?ICON.dash:x==='m'?ICON.x:'';
      const canSkip=(x==='t'||x==='f'||(x==='m'&&past));
      h+=`<div class="drow ${x} ${s.a}" data-i="${i}"><span class="rb" title="${x==='f'?'Can be checked on the day':'Done'}">${ico}</span><div class="db"><span class="dt">${s.t}</span>${m?`<span class="dm">${m}</span>`:''}</div>`
        +(LAB[x]?`<span class="dst">${LAB[x]}</span>`:'')+(canSkip?`<span class="skb" title="Skip">${ICON.skip}</span>`:'')+`</div>`}
    if(due.some(([x])=>x==='t'||x==='f'))h+=`<div class="dfoot"><button class="btn ghost skday">${ICON.skip}Skip day</button></div>`;
  }
  card.innerHTML=h+'</div>';
  app.querySelectorAll('.stepscard .hcells i').forEach(c=>c.classList.toggle('sel',c.dataset.d===sel&&!isT));
}
function setSt(app,i,d,x){window._dirty=1;const R=DATA[app.dataset.r];const a=R.st[d].split('');a[i]=x;R.st[d]=a.join('');
  document.querySelectorAll(`.app[data-r="${app.dataset.r}"]`).forEach(ap=>{
    ap.querySelectorAll(`.stepscard .hcells i[data-i="${i}"][data-d="${d}"]`).forEach(c=>{c.className=x;});renderDay(ap);});}
function toast(msg){const t=document.getElementById('toast');t.querySelector('span:nth-child(2)').textContent=msg;t.style.display='flex';
  clearTimeout(window._tt);window._tt=setTimeout(()=>{if(!document.body.dataset.keep)t.style.display='none'},6000);}
document.addEventListener('click',e=>{
  const app=e.target.closest('.app');const pop=document.getElementById('daypop');
  if(!e.target.closest('#daypop')&&!e.target.closest('.stepscard .hcells i'))pop.style.display='none';
  if(!app)return;
  const seg=e.target.closest('.pseg span');if(seg){showApp(app.dataset.r+'-'+seg.dataset.p);return}
  const rt=e.target.closest('.rside .item.rtn[data-r]');if(rt){const id=rt.dataset.r+'-quarter';if(document.getElementById(id))showApp(id);return}
  const c=e.target.closest('.stepscard .hcells i[data-d]');
  if(c){const card=app.querySelector('.dcard');card.dataset.sel=c.dataset.d;renderDay(app);
    if(c.dataset.i!==undefined)openPop(app,c);return}
  if(e.target.closest('.gotoday')){const card=app.querySelector('.dcard');card.dataset.sel=DATA[app.dataset.r].today;renderDay(app);return}
  const card=app.querySelector('.dcard');if(!card)return;
  const row=e.target.closest('.drow');const sel=card.dataset.sel,R=DATA[app.dataset.r];
  if(row&&e.target.closest('.skb')){setSt(app,+row.dataset.i,sel,'s');toast(R.steps[row.dataset.i].t+' skipped'+(sel===R.today?' for today':' for '+fmt(sel)));return}
  if(row&&e.target.closest('.rb')){const x=R.st[sel][row.dataset.i];if(x==='f'||x==='p')return;
    const back=sel<R.today?'m':'t';setSt(app,+row.dataset.i,sel,x==='d'?back:'d');return}
  if(e.target.closest('.skday')){const a=R.st[sel].split('');a.forEach((x,i)=>{if(x==='t'||x==='f')setSt(app,i,sel,'s')});toast('Day skipped · '+fmt(sel));}
});
function openPop(app,c){const R=DATA[app.dataset.r],i=+c.dataset.i,d=c.dataset.d,x=R.st[d][i];const pop=document.getElementById('daypop');
  if(x==='n'||x==='p'){pop.style.display='none';return}
  const fut=d>R.today,ck='<span class="ck">'+ICON.check+'</span>';
  const it=(k,lab,dis)=>`<div class="mi${dis?' dis':''}" data-x="${k}">${lab}${x===k||(k==='t'&&(x==='m'||x==='f'))?ck:''}</div>`;
  pop.innerHTML=`<div class="dph"><b>${R.steps[i].t}</b>${fmt(d)}</div>`+it('d','Done',fut)+it('s','Skipped',false)+it('t',d<R.today?'Missed':'To do',false);
  const b=c.getBoundingClientRect();pop.style.display='block';pop.style.left=Math.min(b.left-8,innerWidth-220)+'px';pop.style.top=(b.bottom+6)+'px';
  pop.onclick=ev=>{const m=ev.target.closest('.mi[data-x]');if(!m)return;let v=m.dataset.x;if(v==='t')v=d<R.today?'m':(d>R.today?'f':'t');setSt(app,i,d,v);pop.style.display='none';};}
function showApp(id){document.querySelectorAll('.app.rapp').forEach(a=>a.classList.toggle('show',a.id===id));
  const a=document.getElementById(id);if(a)renderDay(a);}
const st=document.getElementById('st');
function setState(sp){st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===sp));
  document.querySelectorAll('.ov').forEach(o=>o.style.display='');document.getElementById('daypop').style.display='none';
  if(window._dirty){DATA=JSON.parse(ORIG);document.querySelectorAll('.stepscard .hcells i[data-i]').forEach(c=>{const R=DATA[c.closest('.app').dataset.r];c.className=R.st[c.dataset.d][c.dataset.i];});window._dirty=0;}
  document.body.className=sp.dataset.b||'';document.body.dataset.keep=sp.dataset.ov&&sp.dataset.ov.includes('toast')?'1':'';
  showApp(sp.dataset.app);const a=document.getElementById(sp.dataset.app);
  if(sp.dataset.sel&&a){a.querySelector('.dcard').dataset.sel=sp.dataset.sel;renderDay(a)}
  (sp.dataset.ov||'').split(' ').filter(Boolean).forEach(id=>{const o=document.getElementById(id);if(o)o.style.display=o.classList.contains('panel')||o.classList.contains('toast2')?'flex':'block'});
  if(sp.dataset.skip&&a){const [i,d]=sp.dataset.skip.split('|');setSt(a,+i,d,'s');}
  if(sp.dataset.pop&&a){const [i,d]=sp.dataset.pop.split('|');const c=a.querySelector(`.stepscard .hcells i[data-i="${i}"][data-d="${d}"]`);if(c)openPop(a,c);}
}
st.onclick=e=>{const sp=e.target.closest('span[data-app]');if(sp)setState(sp)};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.ov').forEach(o=>o.style.display='');document.getElementById('daypop').style.display='none'}});
setState(st.querySelector('span.on'));
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){tip.style.display='none';return}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';});
"""

STATES = [  # label, app, overlays, extra attrs
    ('Normal (Quarter)', 'eve-quarter', '', ''),
    ('Week', 'eve-week', '', ''),
    ('Month', 'eve-month', '', ''),
    ('Year', 'eve-year', '', ''),
    ('Past day selected', 'eve-quarter', '', 'data-sel="2026-11-12"'),
    ('Day popover on a square', 'eve-quarter', '', 'data-sel="2026-11-12" data-pop="1|2026-11-12"'),
    ('Skipped, undo toast', 'eve-quarter', 'toast', 'data-skip="1|2026-11-14"'),
    ('Not due today', 'wk-quarter', '', ''),
    ('Paused', 'evep-quarter', '', ''),
    ('New, no steps', 'new-quarter', '', ''),
    ('New, steps added today', 'news-quarter', '', ''),
    ('No routines', 'none', '', ''),
    ('⋯ menu', 'eve-quarter', 'more', ''),
    ('Add step', 'eve-quarter', 'ns', ''),
    ('New routine', 'eve-quarter', 'nr0', ''),
    ('New routine, filled', 'eve-quarter', 'nr1', ''),
    ('Editing a step', 'eve-editstep', '', ''),
    ('Schedule picker', 'eve-quarter', 'rpk', 'data-b="k-sched"'),
    ('Change schedule', 'eve-quarter', 'chs', ''),
    ('Delete routine', 'wk-quarter', 'del', ''),
    ('Drag to reorder', 'eve-drag', '', ''),
]


def build():
    global RAIL
    RAIL = rail()
    apps = ''
    for p in PERIODS:
        apps += page(R_EVE, p)
    apps += page(R_WEEK, 'quarter', active='wk')
    apps += page(R_EVE_P, 'quarter', active='eve',
                 routines=[('mor', 'Morning routine', 1.0, 'on'), ('eve', 'Evening routine', 0, 'paused'), ('wk', 'Weekly reset', 0, 'none')])
    side_new = SIDEBAR_ROUTINES + [('new', 'Workout', 0, 'none')]
    apps += page(R_NEW, 'quarter', routines=side_new)
    apps += page(R_NEWS, 'quarter', routines=[x if x[0] != 'new' else ('news', 'Workout', 0, 'on') for x in side_new])
    apps += page(R_EVE, 'quarter', variant='drag', app_id='eve-drag')
    apps += page(R_EVE, 'quarter', variant='editstep', app_id='eve-editstep')
    apps += first_run()
    data = {r.key: routine_json(r) for r in [R_EVE, R_EVE_P, R_WEEK, R_NEW, R_NEWS]}
    ovs = (more_menu() + new_step() + new_routine(False) + new_routine(True) + repeat_pick()
           + change_schedule() + delete_routine() + TOAST + DAYPOP)
    sw = ''.join(f'<span{" class=on" if k == 0 else ""} data-app="{a}" data-ov="{o}" {x}>{l}</span>' for k, (l, a, o, x) in enumerate(STATES))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Routine screen, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{base_css()}{CSS}</style></head>
<body>
{apps}
{ovs}
<div class="states"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{JS.replace('__DATA__', json.dumps(data))}</script>
</body></html>'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
