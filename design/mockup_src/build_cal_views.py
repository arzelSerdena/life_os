"""Month, Quarter and Year views of the Calendar screen (Phase D, draft Nov 15). Imported by build_calendar.py.

Month: FullCalendar's day grid (no time grid), Monday first. Multi-day and all-day events are bars across the top of
each week row (packed, cut where they continue). Day entries are the Week view's 24 px rows; routines are one small
progress ring beside the date (all routine steps due that day). A full cell ends with "+3 more", which opens the day
popover. Project due dates are rows, as in Week.

Quarter and Year: a linear calendar, one row per month, days in a line under repeating weekday columns (37 slots,
Monday first, a divider before every Monday). Events over several days and projects (start to due) are bars;
single-day entries are small marks (event square, task checkbox, project folder) under the bars. Routines are not
shown. Quarter has room for every bar; Year keeps 3 lanes and puts "+n" under the month name.

The right panel (Agenda / Inbox) works in every view: the agenda lists exactly what the calendar shows, grouped by day
(and by month in Quarter and Year) and opens scrolled to today.
"""
import calendar
import datetime as dt
import re

import build_cal_week as cw
import build_next7 as nb
import build_pickers as bp
import cal_data as cd

D = cd.D
TODAY = cd.TODAY
I_CAL, I_FOLD, I_CHK, I_CHEV, I_PLUS, I_X = nb.I_CAL, nb.I_FOLD, nb.I_CHK, nb.I_CHEV, nb.I_PLUS, nb.I_X
I_TASK = bp.svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>')
FLAG_RE = re.compile(r'<svg class="fl"[^>]*>.*?</svg>', re.S)
WEEKDAY = [0, 1, 2, 3, 4]

# key: (view, area filter, data variant, right panel, weekends shown)
VIEWS = {
    'mnormal': ('Month', 'all', 'normal', 'agenda', True), 'mcollapsed': ('Month', 'all', 'normal', None, True),
    'minbox': ('Month', 'all', 'normal', 'inbox', True), 'mdrag': ('Month', 'all', 'drag', 'agenda', True),
    'mresize': ('Month', 'all', 'resize', 'agenda', True), 'mibdrag': ('Month', 'all', 'ibdrag', 'inbox', True),
    'mwe': ('Month', 'all', 'normal', 'agenda', False), 'mcareer': ('Month', 'career', 'normal', 'agenda', True),
    'mnomatch': ('Month', 'nomatch', 'normal', 'agenda', True), 'mempty': ('Month', 'all', 'empty', 'agenda', True),
    'mnone': ('Month', 'all', 'none', 'agenda', True),
    'qnormal': ('Quarter', 'all', 'normal', 'agenda', True), 'qcollapsed': ('Quarter', 'all', 'normal', None, True),
    'qdrag': ('Quarter', 'all', 'resize', 'agenda', True), 'qibdrag': ('Quarter', 'all', 'ibdrag', 'inbox', True),
    'qwe': ('Quarter', 'all', 'normal', 'agenda', False), 'qempty': ('Quarter', 'all', 'empty', 'agenda', True),
    'ynormal': ('Year', 'all', 'normal', 'agenda', True), 'ycollapsed': ('Year', 'all', 'normal', None, True),
    'yempty': ('Year', 'all', 'empty', 'agenda', True),
}


def past_i(d):
    """Day index for the week helpers (only 'before today' matters to them)."""
    return 0 if d < TODAY else (nb.TODAY_I if d == TODAY else 6)


def lab_day(d):
    return f'{cd.DOW[d.weekday()]}, {cd.md(d)}'


# ---------------------------------------------------------------- shared entry pieces
def ent_html(c, d):
    """A day entry row, exactly as in the Week view (no priority flags, subtask toggle, past colours)."""
    e = FLAG_RE.sub('', cw.entry(c, -1))
    if c['t'] == 'task' and c['subs']:
        n = sum(1 for _, x in c['subs'] if x)
        e = e[:-6] + f'<span class="sbc">{n}/{len(c["subs"])}{I_CHEV}</span></div>'
        e = (f'<div class="etk">{e}<div class="esubs">' + ''.join(
            f'<div class="esub{" d" if x else ""}"><span class="scb">{I_CHK if x else ""}</span><span class="nm">{t}</span></div>'
            for t, x in c['subs']) + '</div></div>')
    if d < TODAY:
        e = e.replace('class="ent ', 'class="ent past ', 1)
    return e


def routine_ring(cards, d):
    rs = [c for c in cards if c['t'] == 'rout']
    if not rs:
        return ''
    n = sum(1 for c in rs for s in c['steps'] if s[2] == 'done')
    tot = sum(len(c['steps']) for c in rs)
    return f'<span class="rgw" data-tip="Routines · {n}/{tot}">{nb.ring(n / tot if tot else 0)}</span>'


def pack(items):
    """items: (s, e, payload) slot ranges. Each gets the first lane where it fits. Returns (lanes, [(lane, item)])."""
    ends, out = [], []
    for it in items:
        for r, end in enumerate(ends):
            if it[0] > end:
                ends[r] = it[1]
                out.append((r, it))
                break
        else:
            ends.append(it[1])
            out.append((len(ends) - 1, it))
    return len(ends), out


def bar_meta(b, d):
    """Agenda meta for an event bar listed on day d."""
    if b['tm']:
        return b['tm']
    if b['s'] == b['e']:
        return 'All day'
    return f'All day · until {cd.md(b["e"])}'


# ---------------------------------------------------------------- data for a variant
def has_data(v):
    return v not in ('empty', 'none')


def view_range(view, v):
    if view == 'Month':
        y, m = (2027, 2) if v == 'empty' else (2026, 11)
        weeks = calendar.Calendar(0).monthdatescalendar(y, m)
        return weeks[0][0], weeks[-1][-1]
    if view == 'Quarter':
        return (D(2027, 4, 1), D(2027, 6, 30)) if v == 'empty' else (D(2026, 10, 1), D(2026, 12, 31))
    return (D(2028, 1, 1), D(2028, 12, 31)) if v == 'empty' else (D(2026, 1, 1), D(2026, 12, 31))


def day_cards(d, scope, v, we=True, routines=True):
    if not has_data(v) or (not we and d.weekday() >= 5):
        return []
    cards = cd.day(d, scope)
    if not routines:
        cards = [c for c in cards if c['t'] != 'rout']
    return cards


# ---------------------------------------------------------------- Month grid
def fill_lanes(nc, placed, entries):
    """Lay out one week row: bars keep their lanes; each day's entries first fill the free lines beside the bars
    that cover that day (so no day starts with a blank line), then continue in the day's column below its last bar.
    placed: [(lane, s, e)], entries: per column, a list of html strings.
    Returns (lanes, gaps: per column [(lane, html)], rest: per column [html], start: per column first lane of the column)."""
    occ = [set() for _ in range(nc)]
    for lane, s, e in placed:
        for i in range(s, e + 1):
            occ[i].add(lane)
    lanes = max((l for l, _, _ in placed), default=-1) + 1
    gaps, rest, start = [], [], []
    for i in range(nc):
        top = max(occ[i], default=-1)
        free = [r for r in range(top) if r not in occ[i]]
        es = list(entries[i])
        g = []
        for r in free:
            if not es or es[0].startswith('<div class="slot2"'):
                break
            g.append((r, es.pop(0)))
        gaps.append(g)
        rest.append(es)
        start.append(top + 1)
    return lanes, gaps, rest, start


def month_grid(scope, v, we=True):
    y, m = (2027, 2) if v == 'empty' else (2026, 11)
    weeks = calendar.Calendar(0).monthdatescalendar(y, m)
    cols = list(range(7)) if we else WEEKDAY
    nc = len(cols)
    tpl = f'repeat({nc},minmax(0,1fr))'
    hd = ''.join(f'<span>{cd.DOW[c]}</span>' for c in cols)
    out = f'<div class="mhd" style="grid-template-columns:{tpl}">{hd}</div>'
    blist = cd.bars(scope) if has_data(v) else []
    for wk in weeks:
        days = [wk[c] for c in cols]
        first, last = days[0], days[-1]
        bg = ''
        for i, d in enumerate(days):
            cls = ' out' if d.month != m else ''
            cls += ' pst' if (d < TODAY and has_data(v)) else (' tdy' if d == TODAY else '')
            extra = ''
            if v == 'drag' and d == D(2026, 11, 22):
                extra = ' dropx'
            if v == 'ibdrag' and d == D(2026, 11, 25):
                extra = ' dropx'
            if v == 'resize' and D(2026, 11, 26) <= d <= D(2026, 11, 29):
                extra = ' inr'
            if v == 'normal' and d == D(2026, 11, 19):
                extra = ' k-clk'
            bg += f'<div class="mcl{cls}{extra}{" last" if i == nc - 1 else ""} k-m{d.month:02d}{d.day:02d}"></div>'
        cells = f'<div class="mbg" style="grid-template-columns:{tpl}">{bg}</div>'
        # bars, packed into lanes
        items = []
        for b in blist:
            e_ = D(2026, 11, 29) if (v == 'resize' and b['title'] == 'Beach trip') else b['e']
            idx = [i for i, d in enumerate(days) if b['s'] <= d <= e_]
            if not idx:
                continue
            items.append((idx[0], idx[-1], dict(b, e2=e_)))
        items.sort(key=lambda it: (it[0], -(it[1] - it[0])))
        _, placed = pack(items)
        entries = []
        for i, d in enumerate(days):
            cards = day_cards(d, scope, v, we)
            ring = routine_ring(cards, d)
            dn = f'{cd.MON3[d.month - 1]} {d.day}' if d.day == 1 else str(d.day)
            cls = ' out' if d.month != m else ''
            cls += ' pst' if (d < TODAY and has_data(v)) else (' tdy' if d == TODAY else '')
            cells += f'<div class="mdh{cls}" style="grid-column:{i + 1}"><span class="dn">{dn}</span>{ring}</div>'
            html = [ent_html(c, d) for c in cw.order(cards) if c['t'] != 'rout']
            if v == 'drag' and d == D(2026, 11, 21):
                html = [h.replace('class="ent ev relation k-mia"', 'class="ent ev relation k-mia src"', 1) for h in html]
            if v in ('drag', 'ibdrag') and d == (D(2026, 11, 22) if v == 'drag' else D(2026, 11, 25)):
                html.insert(0, '<div class="slot2"></div>')
            entries.append(html)
        lanes, gaps, rest, start = fill_lanes(nc, [(r, s, e) for r, (s, e, _) in placed], entries)
        for r, (s, e, b) in placed:
            cutl = b['s'] < days[s]
            cutr = b['e2'] > days[e]
            past = b['e'] < TODAY
            since = f'<span class="lbm">since {cd.md(b["s"])}</span>' if (cutl and wk is weeks[0]) else ''
            tm = f'<span class="lbm">{b["tm"]}</span>' if b['tm'] and not cutl else ''
            rz = ' rsz2' if (v == 'resize' and b['title'] == 'Beach trip') else ''
            grip = '<span class="grip2"></span>' if rz else ''
            cells += (f'<div class="cwbar {b["area"]}{" cutl" if cutl else ""}{" cutr" if cutr else ""}{" past" if past else ""}{rz}" '
                      f'style="grid-column:{s + 1}/{e + 2};grid-row:{r + 2}" data-tip="{b["title"]} · {cd.span_label(b["s"], b["e"])}">'
                      f'<span class="lbt">{b["title"]}</span>{since}{tm}{grip}</div>')
        for i in range(nc):
            d = days[i]
            for r, h in gaps[i]:
                cells += f'<div class="mgap" style="grid-column:{i + 1};grid-row:{r + 2}">{h}</div>'
            more = f'<div class="more k-more{d.month:02d}{d.day:02d}" hidden></div>'
            cells += f'<div class="mcel" style="grid-column:{i + 1};grid-row:{start[i] + 2}/-1">{"".join(rest[i])}{more}</div>'
        rows = f'28px {"repeat(%d,auto) " % lanes if lanes else ""}minmax(0,1fr)'
        out += f'<div class="mwk" style="grid-template-columns:{tpl};grid-template-rows:{rows}">{cells}</div>'
    if v == 'none':
        out += (f'<div class="wempty mwe2"><span>No events or tasks yet.</span>'
                f'<button class="btn primary">{I_PLUS}New event</button></div>')
    return f'<div class="mwrap"><div class="mogrid">{out}</div></div>'


# ---------------------------------------------------------------- Linear calendar (Quarter and Year)
LETTERS = 'MTWTFSS'


def slot_tpl(we):
    return ' '.join('minmax(0,1fr)' if (we or j % 7 < 5) else '8px' for j in range(37))


def mark(c, d):
    past = d < TODAY
    if c['t'] == 'event':
        return f'<i class="lin-m ev {c["area"]}{" past" if past else ""}" data-tip="{c["title"]} · {c["time"]}"></i>'
    if c['t'] == 'proj':
        return f'<i class="lin-m pj {c["area"]}" data-tip="{c["title"]} · project due">{I_FOLD}</i>'
    a = c['area'] or 'noarea'
    st = ' done' if (c['done'] or c['cancel']) else ''
    return f'<i class="lin-m tk {a}{st}" data-tip="{c["title"]}"></i>'


def linear(view, scope, v, we=True):
    s0, e0 = view_range(view, v)
    yr = s0.year
    months = list(range(s0.month, e0.month + 1))
    q = view == 'Quarter'
    maxl = None if q else 3
    tpl = f'48px {slot_tpl(we)}'
    hd = '<span class="lin-hl"></span>' + ''.join(
        f'<span class="{"mon" if j % 7 == 0 else ""}{" ws" if (not we and j % 7 >= 5) else ""}">{"" if (not we and j % 7 >= 5) else LETTERS[j % 7]}</span>'
        for j in range(37))
    out = f'<div class="lin-hd" style="grid-template-columns:{tpl}">{hd}</div>'
    blist = cd.bars(scope, projects=True) if has_data(v) else []
    for m in months:
        off = D(yr, m, 1).weekday()
        nd = calendar.monthrange(yr, m)[1]
        first, last = D(yr, m, 1), D(yr, m, nd)
        cells = ''
        for j in range(37):
            dn = j - off + 1
            mon = ' mon' if j % 7 == 0 else ''
            ws = ' ws' if (not we and j % 7 >= 5) else ''
            if 1 <= dn <= nd:
                d = D(yr, m, dn)
                cls = ' pst' if (d < TODAY and has_data(v)) else (' tdy' if d == TODAY else '')
                extra = ''
                if v == 'ibdrag' and d == D(2026, 11, 25):
                    extra = ' dropx'
                if v == 'resize' and D(2026, 12, 21) <= d <= D(2026, 12, 23):
                    extra = ' inr'
                cells += f'<div class="lin-c{mon}{ws}{cls}{extra} k-d{m:02d}{dn:02d}" style="grid-column:{j + 2}"></div>'
                if not ws:
                    cells += f'<div class="lin-num{cls}" style="grid-column:{j + 2}"><i>{dn}</i></div>'
            else:
                cells += f'<div class="lin-c out{mon}{ws}" style="grid-column:{j + 2}"></div>'
        # bars: events first, then projects, each by start
        evs, pjs = [], []
        for b in blist:
            e_ = b['e']
            if v == 'resize' and b['title'] == 'Room makeover':
                e_ = D(2026, 12, 23)
            if e_ < first or b['s'] > last:
                continue
            s = max(b['s'], first).day + off - 1
            e = min(e_, last).day + off - 1
            (evs if b['kind'] == 'ev' else pjs).append((s, e, dict(b, e2=e_)))
        pkey = (lambda it: (it[0], -(it[1] - it[0]))) if q else (lambda it: ((it[2]['e2'] - it[2]['s']).days, it[0]))
        items = sorted(evs, key=lambda it: (it[0], -(it[1] - it[0]))) + sorted(pjs, key=pkey)
        lanes, placed = pack(items)
        hidden = [b for r, (s, e, b) in placed if maxl is not None and r >= maxl]
        nl = min(lanes, maxl) if maxl is not None else lanes
        bars = ''
        top = {}
        for r, (s, e, b) in placed:
            if maxl is not None and r >= maxl:
                continue
            for j in range(s, e + 1):
                top[j] = max(top.get(j, -1), r)
            cutl = b['s'] < first
            cutr = b['e2'] > last
            past = b['e2'] < TODAY
            since = ''
            if cutl and m == months[0] and q:
                since = f'<span class="lbm">since {cd.md(b["s"])}</span>'
            icon = f'{I_FOLD}' if b['kind'] == 'pj' else ''
            rz = ' rsz2' if (v == 'resize' and b['title'] == 'Room makeover' and m == 12) else ''
            grip = '<span class="grip2"></span>' if rz else ''
            tip = f'{b["title"]} · {cd.span_label(b["s"], b["e2"])}'
            short = e - s < 2 and not cutl and not cutr
            lbl = '' if short else f'{icon}<span class="lbt">{b["title"]}</span>{since}'
            bars += (f'<div class="lin-bar {b["kind"]} {b["area"]}{" cutl" if cutl else ""}{" cutr" if cutr else ""}{" past" if past else ""}{rz}" '
                     f'style="grid-column:{s + 2}/{e + 3};grid-row:{r + 2}" data-tip="{tip}">{lbl}{grip}</div>')
        lh = 22 if q else 16
        cells += bars
        # marks
        for dn in range(1, nd + 1):
            d = D(yr, m, dn)
            j = off + dn - 1
            if not we and j % 7 >= 5:
                continue
            cards = [c for c in cw.order(day_cards(d, scope, v, we, routines=False))]
            if not cards:
                continue
            mks = ''.join(mark(c, d) for c in cards) + '<span class="lin-mm" hidden></span>'
            cells += f'<div class="lin-mk" style="grid-column:{j + 2};grid-row:{top.get(j, -1) + 3}/-1">{mks}</div>'
        more = f'<span class="lin-more k-ym{m:02d}">+{len(hidden)}</span>' if hidden else ''
        cells += f'<div class="lin-ml"><span>{cd.MON3[m - 1].upper()}</span>{more}</div>'
        rows = f'{24 if q else 18}px {"repeat(%d,%dpx) " % (nl, lh) if nl else ""}minmax(0,1fr)'
        out += f'<div class="lin-row" style="grid-template-columns:{tpl};grid-template-rows:{rows}">{cells}</div>'
        if v == 'normal' and scope == 'all' and we:
            HIDDEN[(view, m)] = hidden
    if v == 'none':
        out += (f'<div class="wempty mwe2"><span>No events or tasks yet.</span>'
                f'<button class="btn primary">{I_PLUS}New event</button></div>')
    return f'<div class="lwrap"><div class="lin-grid {"lq" if q else "ly"}">{out}</div></div>'


HIDDEN = {}


# ---------------------------------------------------------------- agenda over a range
def agenda(view, scope, v, we=True):
    import build_calendar as bc
    s0, e0 = view_range(view, v)
    routines = view == 'Month'
    blist = cd.bars(scope) if has_data(v) else []
    body, cur_m, marked = '', None, False
    d = s0
    while d <= e0:
        rows = ''
        for b in blist:
            if b['s'] == d or (d == s0 and b['s'] < s0 <= b['e']):
                if not we and d.weekday() >= 5 and b['s'] == b['e']:
                    continue
                rows += bc.arow('ev', b['area'], b['title'], bar_meta(b, d), b['e'] < TODAY)
        rows += ''.join(bc.ag_rows(c, past_i(d)) for c in cw.order(day_cards(d, scope, v, we, routines)))
        if rows:
            if view != 'Month' and d.month != cur_m:
                cur_m = d.month
                body += f'<div class="amon">{cd.MONTHS[d.month - 1]}</div>'
            lab = 'Today' if d == TODAY else ('Tomorrow' if d == TODAY + dt.timedelta(1) else cd.DOW[d.weekday()])
            meta = lab_day(d) if lab in ('Today', 'Tomorrow') else cd.md(d)
            now = '' if (marked or d < TODAY) else ' data-now="1"'
            marked = marked or d >= TODAY
            body += (f'<div class="aday{" isday" if d == TODAY else ""}"{now}><div class="adh"><span class="t-label">{lab}</span>'
                     f'<span class="t-meta">{meta}</span></div>{rows}</div>')
        d += dt.timedelta(1)
    if not body:
        if scope == 'nomatch':
            body = ('<div class="ag-empty"><span class="t-meta">Nothing matches the filters.</span>'
                    '<button class="btn" style="margin-top:10px">Clear filters</button></div>')
        else:
            body = '<div class="ag-empty"><span class="t-meta">Nothing scheduled.</span></div>'
    return bc.ag_card('Agenda', '', body).replace('<aside class="agenda"', '<aside class="agenda ascroll"', 1)


# ---------------------------------------------------------------- header labels
def label(view, v):
    if view == 'Month':
        return 'February 2027' if v == 'empty' else 'November 2026'
    if view == 'Quarter':
        return 'Q2 2027' if v == 'empty' else 'Q4 2026'
    return '2028' if v == 'empty' else '2026'


def app(rail, key):
    import build_calendar as bc
    view, scope, v, panel, we = VIEWS[key]
    if panel == 'agenda':
        rp = agenda(view, scope, v, we)
    elif panel == 'inbox':
        rp = bc.inbox('drag' if v == 'ibdrag' else 'normal')
    else:
        rp = ''
    grid = month_grid(scope, v, we) if view == 'Month' else linear(view, scope, v, we)
    side = bc.sidebar(scope, v, panel, we=we, routines=(view == 'Month'))
    hdr = bc.header(v, view=view, label=label(view, v), today=(v == 'empty'))
    np_ = ' nopanel' if panel is None else ''
    return (f'<div class="app wv v-{key}{np_}">{rail}{side}<main class="main calmain">'
            f'<div class="calleft">{hdr}<div class="calbody">{grid}</div></div>{rp}</main></div>')


# ---------------------------------------------------------------- popovers and ghosts (placed by script, anchored to elements)
def apop(state, anchor, width, body, dx=0, dy=6, at='below', z=None):
    zz = f';z-index:{z}' if z else ''
    return (f'<div class="pk {state}" data-anc="{anchor}" data-dx="{dx}" data-dy="{dy}" data-at="{at}" '
            f'style="width:{width}px{zz}">{body}</div>')


def day_pop(d, routines):
    import build_calendar as bc
    rows = ''
    for b in cd.bars('all'):
        if b['s'] <= d <= b['e']:
            rows += bc.arow('ev', b['area'], b['title'], bar_meta(b, d), b['e'] < TODAY)
    rows += ''.join(bc.ag_rows(c, past_i(d)) for c in cw.order(day_cards(d, 'all', 'normal', True, routines)))
    return (f'<div class="dph"><b>{lab_day(d)}</b><span class="icon-btn" title="Add">{I_PLUS}</span>'
            f'<span class="icon-btn" title="Close">{I_X}</span></div><div class="dpb">{rows}</div>')


def hidden_pop(view, m):
    import build_calendar as bc
    rows = ''
    for b in HIDDEN.get((view, m), []):
        meta = cd.span_label(b['s'], b['e2'])
        if b['kind'] == 'pj':
            rows += bc.arow('mark', b['area'], b['title'], meta, b['e2'] < TODAY, mark=I_FOLD)
        else:
            rows += bc.arow('ev', b['area'], b['title'], meta, b['e2'] < TODAY)
    n = len(HIDDEN.get((view, m), []))
    return (f'<div class="dph"><b>{cd.MONTHS[m - 1]}</b><span class="counter">{n}</span>'
            f'<span class="icon-btn" style="margin-left:auto" title="Close">{I_X}</span></div><div class="dpb">{rows}</div>')


def tiles(items, on):
    return '<div class="mtl">' + ''.join(f'<div class="{"on" if t == on else ""}{" tdy" if tdy else ""}">{t}</div>' for t, tdy in items) + '</div>'


def popovers():
    p = ''
    # period pickers
    nav = f'<span class="nav"><span>{bp.I_PREV}</span><span>{bp.I_NEXT}</span></span>'
    p += apop('k-mper', '.rl', 252, f'<div class="ch2" style="padding:0 2px 4px 8px">2026{nav}</div>'
              + tiles([(t, t == 'Nov') for t in cd.MON3], 'Nov'))
    p += apop('k-qper', '.rl', 252, f'<div class="ch2" style="padding:0 2px 4px 8px">2026{nav}</div>'
              '<div class="q"><div><b>Q1</b><span>Jan – Mar</span></div><div><b>Q2</b><span>Apr – Jun</span></div>'
              '<div><b>Q3</b><span>Jul – Sep</span></div><div class="on"><b>Q4</b><span>Oct – Dec</span></div></div>')
    p += apop('k-yper', '.rl', 252, f'<div class="ch2" style="padding:0 2px 4px 8px">2021 – 2032{nav}</div>'
              + tiles([(str(y), y == 2026) for y in range(2021, 2033)], '2026'))
    # month: +n more, click on a day
    p += apop('k-mmore', '.k-more1114', 320, day_pop(TODAY, True), dx=-6, dy=-150, at='top')
    p += apop('k-mcell', '.mcl.k-clk', 180, f'<div class="lab">{lab_day(D(2026, 11, 19))}</div>' + bp.row('Event', I_CAL) + bp.row('Task', I_TASK),
              dx=40, dy=96, at='top')
    # quarter and year: day popover, hidden bars
    p += apop('k-qday', '.lin-c.k-d1114', 320, day_pop(TODAY, False), dx=6, dy=0, at='right')
    p += apop('k-yday', '.lin-c.k-d1114', 320, day_pop(TODAY, False), dx=6, dy=-430, at='right')
    p += apop('k-yover', '.lin-more.k-ym11', 300, hidden_pop('Year', 11), dx=0, dy=-6, at='above')
    return p


def ghosts():
    import build_calendar as bc
    g = (f'<div class="ent ev relation dg" data-for="s-mdrag" data-anc=".mcl.k-m1122" data-dx="30" data-dy="58">'
         f'<span class="tm">6:00 PM</span><span class="nm">Dinner with Mia</span></div>')
    row = bc.arow('task', None, 'Renew passport', 'Due Dec 1 · Inbox')
    g += row.replace('<div class="arow ', '<div data-for="s-mibdrag" data-anc=".mcl.k-m1125" data-dx="40" data-dy="62" class="arow dg dgw ', 1)
    g += row.replace('<div class="arow ', '<div data-for="s-qibdrag" data-anc=".lin-c.k-d1125" data-dx="14" data-dy="40" class="arow dg dgw ', 1)
    g += ('<div class="dlab" data-for="s-mresize" data-anc=".cwbar.rsz2" data-at="below" data-dx="0" data-dy="6">Thu, Nov 26 – Sun, Nov 29 · 4 days</div>')
    g += ('<div class="dlab" data-for="s-qdrag" data-anc=".lin-bar.rsz2" data-at="right" data-dx="8" data-dy="-3">Nov 16 – Dec 23 · 38 days</div>')
    g += ('<div class="dlab" data-for="s-mibdrag" data-anc=".mcl.k-m1125" data-dx="40" data-dy="30">Wed, Nov 25</div>')
    g += ('<div class="dlab" data-for="s-qibdrag" data-anc=".lin-c.k-d1125" data-dx="14" data-dy="92">Wed, Nov 25</div>')
    return g


CSS = """
.app.nopanel .mwrap,.app.nopanel .lwrap{padding-right:24px}
/* month */
.mwrap{flex:1;min-height:0;padding:0 12px 24px 24px;display:flex}
.mogrid{flex:1;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;position:relative}
.mhd{height:32px;flex:none;display:grid}
.mhd span{display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:500;color:var(--text-tertiary)}
.mwk{flex:1 1 0;min-height:0;display:grid;border-top:1px solid var(--border);position:relative;overflow:hidden}
.mbg{position:absolute;inset:0;display:grid}
.mcl{border-right:1px solid var(--border);cursor:pointer}.mcl.last{border-right:0}
.mwk>.cwbar{margin:0 6px 3px;position:relative;z-index:1}
.mgap{padding:0 6px 3px;min-width:0;display:flex;flex-direction:column;position:relative;z-index:1}

.mcl.dropx{box-shadow:inset 0 0 0 2px var(--acc600);background:#f8f7fb}
.mcl.inr{background:var(--acc100)}
body.k-mcell .mcl.k-clk{background:var(--acc100);box-shadow:inset 0 0 0 2px var(--acc500)}
.mdh{grid-row:1;display:flex;align-items:center;gap:6px;padding:0 8px 0 6px;height:28px;position:relative;z-index:1;pointer-events:none}
.mdh .dn{font-size:13px;font-weight:600;color:var(--text-primary);min-width:22px;height:22px;display:grid;place-items:center;border-radius:6px;padding:0 4px;white-space:nowrap}
.mdh.pst .dn{color:var(--text-tertiary)}.mdh.out .dn{color:var(--text-disabled)}
.mdh.tdy .dn{background:var(--acc600);color:#fff}
.mdh .rgw{margin-left:auto;display:grid;pointer-events:auto;cursor:pointer}.mdh .rgw .rring{width:14px;height:14px}
.mcel{display:flex;flex-direction:column;gap:3px;padding:0 6px 6px;min-width:0;overflow:hidden;position:relative;z-index:1}
.more{height:18px;flex:none;font-size:12px;font-weight:500;color:var(--text-secondary);padding:0 6px;display:flex;align-items:center;border-radius:5px;cursor:pointer}
.more:hover{background:var(--n100);color:var(--text-primary)}
body.k-mmore .more.k-more1114{background:var(--n100);color:var(--text-primary)}
.cwbar.cutr{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.cwbar .lbt{overflow:hidden;text-overflow:ellipsis}
.cwbar.rsz2,.lin-bar.rsz2{box-shadow:inset 3px 0 0 var(--a-solid),0 0 0 2px var(--acc600);position:relative}
.lin-bar.pj.rsz2{box-shadow:0 0 0 2px var(--acc600)}
.grip2{position:absolute;right:2px;top:4px;bottom:4px;width:3px;border-radius:2px;background:var(--acc600);cursor:ew-resize}
.wempty.mwe2{position:absolute;inset:32px 0 0 0}
.more[hidden],.lin-mm[hidden]{display:none}
/* linear calendar: quarter and year */
.lwrap{flex:1;min-height:0;padding:0 12px 24px 24px;display:flex}
.lin-grid{flex:1;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;position:relative}
.lin-hd{height:28px;flex:none;display:grid}
.lin-hd span{display:grid;place-items:center;font-size:11px;font-weight:500;color:var(--text-tertiary)}
.lin-hd span.mon{box-shadow:inset 1px 0 0 var(--border)}
.lin-hd .lin-hl{border-right:1px solid var(--border)}
.lin-row{flex:1 1 0;min-height:0;display:grid;border-top:1px solid var(--border);position:relative}
.lin-ml{grid-column:1;grid-row:1/-1;padding:5px 0 0 10px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;border-right:1px solid var(--border)}
.lin-ml>span:first-child{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.04em;color:var(--text-secondary)}
.lin-more{font-size:11px;font-weight:500;color:var(--text-secondary);background:var(--n100);border-radius:5px;padding:0 5px;line-height:16px;cursor:pointer}
.lin-more:hover,body.k-yover .lin-more.k-ym11{background:var(--n200);color:var(--text-primary)}
.lin-c{grid-row:1/-1;cursor:pointer}.lin-c:hover{background:var(--n50)}
.lin-c.mon{box-shadow:inset 1px 0 0 var(--border)}
.lin-c.out{cursor:default}.lin-c.out:hover{background:none}
.lin-c.ws{background:var(--n50)}.lin-c.ws:hover{background:var(--n50)}
.lin-c.dropx{box-shadow:inset 0 0 0 2px var(--acc600);background:#f8f7fb}
.lin-c.inr{background:var(--acc100)}
body.k-qday .lin-c.k-d1114,body.k-yday .lin-c.k-d1114{background:var(--acc100)}
.lin-num{grid-row:1;display:grid;place-items:center;position:relative;z-index:1;pointer-events:none;font-size:12px;color:var(--text-primary)}
.lin-num i{font-style:normal;min-width:20px;height:20px;display:grid;place-items:center;border-radius:5px;font-weight:500}
.lin-num.pst{color:var(--text-tertiary)}
.lin-num.tdy i{background:var(--acc600);color:#fff;font-weight:600}
.lin-bar{position:relative;z-index:1;align-self:start;height:20px;margin:0 1px;border-radius:4px;background:var(--a-tint);box-shadow:inset 3px 0 0 var(--a-solid);display:flex;align-items:center;gap:4px;
  padding:0 6px 0 7px;font-size:11px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;cursor:pointer;min-width:0}
.lin-bar .lbt{overflow:hidden;text-overflow:ellipsis}
.lin-bar .lbm{font-weight:400;color:var(--text-secondary)}
.lin-bar.relation{background:#f6eea6}
.lin-bar.pj{background:#fff;border:1px dashed var(--a-border);box-shadow:none;padding-left:5px}
.lin-bar.pj svg{width:11px;height:11px;color:var(--a-solid);flex:none}
.lin-bar.past{background:var(--a-past);box-shadow:inset 3px 0 0 var(--a-border);color:var(--text-tertiary)}
.lin-bar.pj.past{background:var(--a-past);box-shadow:none}.lin-bar.pj.past svg{color:var(--a-border)}
.lin-bar.cutl{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0;box-shadow:none}
.lin-bar.pj.cutl{border-left-style:none}
.lin-bar.cutr{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}.lin-bar.pj.cutr{border-right-style:none}
.lin-mk{display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:center;gap:3px;padding:3px 2px 2px;position:relative;z-index:1;min-width:0;min-height:0;overflow:hidden}
.lin-m{width:9px;height:9px;border-radius:2px;flex:none;box-sizing:border-box;cursor:pointer}
.lin-m.ev{background:var(--a-solid)}.lin-m.ev.past{background:var(--a-border)}
.lin-m.tk{border:1.5px solid var(--a-solid)}.lin-m.tk.done{background:var(--a-border);border-color:var(--a-border)}
.lin-m.pj{display:grid;place-items:center;color:var(--a-solid)}.lin-m.pj svg{width:10px;height:10px}
.lin-mm{flex-basis:100%;text-align:center;font-size:10px;line-height:12px;font-weight:500;color:var(--text-tertiary)}
.ly .lin-num{font-size:10px}.ly .lin-num i{min-width:16px;height:16px;border-radius:4px}
.ly .lin-bar{height:14px;font-size:10px;border-radius:3px;padding:0 4px 0 6px}.ly .lin-bar.pj{padding-left:4px}.ly .lin-bar.pj svg{width:9px;height:9px}
.ly .lin-ml{padding-top:2px}
.ly .lin-mk{gap:2px;padding-top:2px;align-items:center}
.ly .lin-m{width:6px;height:6px;border-radius:1.5px}.ly .lin-m.tk{border-width:1px}.ly .lin-m.pj svg{width:7px;height:7px}
.ly .lin-mm{flex-basis:auto;font-size:9px;line-height:10px}
/* agenda over a range: month labels */
.amon{position:sticky;top:-8px;z-index:2;background:#fff;margin:4px -8px 0;padding:8px 16px 6px;font-size:13px;font-weight:600;color:var(--text-primary);border-bottom:1px solid var(--border)}
.ag-empty .btn{display:inline-flex}
/* day popover */
.pk .dph{display:flex;align-items:center;gap:6px;padding:4px 4px 6px 8px;border-bottom:1px solid var(--border);margin:-6px -6px 6px;padding:10px 8px 8px 14px}
.pk .dph b{font-size:13px;font-weight:600}.pk .dph .icon-btn:first-of-type{margin-left:auto}
.pk .dph .counter{margin-left:4px}
.pk .dpb{display:flex;flex-direction:column;gap:2px;max-height:420px;overflow:auto}
.pk .dpb .arow{cursor:pointer}
.pk .mtl{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:2px 4px 4px}
.pk .mtl div{height:36px;border:1px solid var(--border);border-radius:8px;display:grid;place-items:center;font-size:13px;font-weight:500;cursor:pointer}
.pk .mtl div:hover{background:var(--n100)}
.pk .mtl div.tdy{color:var(--acc700);box-shadow:inset 0 0 0 1px var(--acc500);border-color:var(--acc500)}
.pk .mtl div.on{border-color:var(--acc600);background:var(--acc100);color:var(--acc700);font-weight:600}
.pk .q{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:2px 4px 4px}
.pk .q div{height:52px;border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;justify-content:center;padding:0 12px;cursor:pointer}
.pk .q div b{font-size:13px;font-weight:600}.pk .q div span{font-size:12px;color:var(--text-tertiary)}
.pk .q div.on{border-color:var(--acc600);background:var(--acc100)}.pk .q div.on b{color:var(--acc700)}
/* drag */
.dg{display:none!important;position:fixed;z-index:30;transform:rotate(2deg);cursor:grabbing;box-shadow:0 2px 8px rgba(0,0,0,.08),0 14px 28px rgba(0,0,0,.14)}
.dg.on{display:flex!important}
.ent.dg{width:150px;background:var(--a-tint)}
.arow.dg.dgw{width:280px;background:#fff;border:1px solid var(--border)}
.dlab{display:none;position:fixed;z-index:30;height:24px;align-items:center;padding:0 8px;border-radius:6px;background:var(--n900,#111827);color:#fff;font-size:12px;font-weight:500;white-space:nowrap}
.dlab.on{display:flex}
.ent.src{opacity:.35}
.vsw span{user-select:none}
"""

MONTH_STATES = [('Normal', 's-mnormal vmnormal'), ('Agenda hidden', 's-mcol vmcollapsed'), ('Inbox', 's-mib vminbox'),
                ('+3 more', 's-mmore vmnormal k-mmore'), ('Click on a day', 's-mcell vmnormal k-mcell'),
                ('Drag an event', 's-mdrag vmdrag'), ('Resize a bar', 's-mresize vmresize'),
                ('Dragging from Inbox', 's-mibdrag vmibdrag'), ('Weekends off', 's-mwe vmwe'), ('Filtered: Career', 's-mcar vmcareer'),
                ('Filters hide everything', 's-mnm vmnomatch'), ('Empty month', 's-mempty vmempty'),
                ('Nothing created yet', 's-mnone vmnone'), ('Period picker', 's-mper vmnormal k-mper')]
QUARTER_STATES = [('Normal', 's-qnormal vqnormal'), ('Agenda hidden', 's-qcol vqcollapsed'), ('Day popover', 's-qday vqnormal k-qday'),
                  ('Drag a project bar', 's-qdrag vqdrag'), ('Dragging from Inbox', 's-qibdrag vqibdrag'),
                  ('Weekends off', 's-qwe vqwe'), ('Empty quarter', 's-qempty vqempty'), ('Period picker', 's-qper vqnormal k-qper')]
YEAR_STATES = [('Normal', 's-ynormal vynormal'), ('Agenda hidden', 's-ycol vycollapsed'), ('Day popover', 's-yday vynormal k-yday'),
               ('Bar overflow', 's-yover vynormal k-yover'), ('Empty year', 's-yempty vyempty'), ('Period picker', 's-yper vynormal k-yper')]
PK_KEYS = ['k-mper', 'k-qper', 'k-yper', 'k-mmore', 'k-mcell', 'k-qday', 'k-yday', 'k-yover']
