"""Life areas overview v3: outcomes first (every metric vs its target), effort second."""
import sys
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_overview2 as o2  # noqa: E402
ov, a4, bw, a2, ic = o2.ov, o2.a4, o2.bw, o2.a2, o2.ic

wk = ['Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2', 'Nov 9', 'Nov 16']
Q0, Q1, TODAY = date(2026, 10, 1), date(2026, 12, 31), date(2026, 11, 14)
W, H, PL, PR, PT, PB = 300, 64, 4, 4, 6, 14

def chip(kind):
    lab = {'ok': 'On track', 'warn': 'Behind', 'met': 'Met'}[kind]
    icn = {'ok': 'ok', 'warn': 'warn', 'met': 'ok'}[kind]
    return f'<span class="stt {kind}">{ic(icn)}{lab}</span>'

def fmt(v, unit):
    if unit == '₱':
        return f'₱{v:,.0f}'
    return f'{v:g}{(" " + unit) if unit else ""}'

def bars_chart(vals, target=None, labels=None, lower=False, unit='', cur=None, wk_labels=False):
    if wk_labels: labels = wk[:len(vals)]
    """Per-period target: one column per period, solid when met, soft when not, outlined for the current period."""
    ymax = max(max(vals), target or 0) * 1.18
    n = len(vals)
    pw = W - PL - PR
    slot = pw / n
    bwid = min(24, slot - 6)
    base = H - PB
    out = [f'<svg class="mc" viewBox="0 0 {W} {H}" role="img">']
    ty = base - (target or 0) / ymax * (base - PT)
    for i, (v, lab) in enumerate(zip(vals, labels)):
        x = PL + i * slot + (slot - bwid) / 2
        h = max(1.5, v / ymax * (base - PT))
        y = base - h
        met = True if target is None else ((v <= target) if lower else (v >= target))
        if i == cur:
            cls = 'cur'
        else:
            cls = 'met' if met else 'miss'
        r = min(4, h)
        d = f'M{x:.1f},{base} V{y+r:.1f} Q{x:.1f},{y:.1f} {x+r:.1f},{y:.1f} H{x+bwid-r:.1f} Q{x+bwid:.1f},{y:.1f} {x+bwid:.1f},{y+r:.1f} V{base}Z'
        state = 'so far' if i == cur else ('met' if met else 'not met')
        out.append(f'<path class="b {cls}" d="{d}" data-tip="{lab}: {fmt(v, unit)} ({state})"/>')
        if n <= 4 or i in (0, n - 1):
            out.append(f'<text x="{x+bwid/2:.1f}" y="{H-4}" text-anchor="middle" class="ax">{lab}</text>')
    if target is not None: out.append(f'<line x1="{PL}" x2="{W-PR}" y1="{ty:.1f}" y2="{ty:.1f}" class="tgt"/>')
    out.append(f'<line x1="{PL}" x2="{W-PR}" y1="{base}" y2="{base}" class="base"/>')
    out.append('</svg>')
    return ''.join(out)

def line_chart(points, target, deadline=None, lower=False, unit='', start_val=None, partial=False, tips=None):
    """Reach-by target (or none): the metric's value over the quarter, with the target as a reference line."""
    vals = [v for _, v in points] + ([target] if target is not None else [])
    lo, hi = min(vals), max(vals)
    pad = (hi - lo) * .15 or 1
    lo, hi = lo - pad, hi + pad
    if not lower and min(v for _, v in points) >= 0 and lo < 0:
        lo = 0
    span = (Q1 - Q0).days
    X = lambda d: PL + (d - Q0).days / span * (W - PL - PR)
    Y = lambda v: (H - PB) - (v - lo) / (hi - lo) * (H - PB - PT)
    out = [f'<svg class="mc" viewBox="0 0 {W} {H}" role="img">']
    for m, lab in ((date(2026, 11, 1), 'Nov'), (date(2026, 12, 1), 'Dec')):
        out.append(f'<line x1="{X(m):.1f}" x2="{X(m):.1f}" y1="{PT}" y2="{H-PB}" class="grid"/>')
        out.append(f'<text x="{X(m)+3:.1f}" y="{H-4}" class="ax">{lab}</text>')
    out.append(f'<text x="{PL}" y="{H-4}" class="ax">Oct</text>')
    if target is not None:
        out.append(f'<line x1="{PL}" x2="{W-PR}" y1="{Y(target):.1f}" y2="{Y(target):.1f}" class="tgt"/>')
    full = points[:-1] if partial else points
    P = [(X(dd), Y(v)) for dd, v in full]
    if len(P) > 1:
        d = f'M{P[0][0]:.1f},{P[0][1]:.1f}'
        for i in range(len(P) - 1):
            p0 = P[i - 1] if i > 0 else P[i]; p1, p2 = P[i], P[i + 1]; p3 = P[i + 2] if i + 2 < len(P) else p2
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
        out.append(f'<path d="{d} L{P[-1][0]:.1f},{H-PB} L{P[0][0]:.1f},{H-PB}Z" class="wash"/>')
        out.append(f'<path d="{d}" class="ln"/>')
    for i, (dd, v) in enumerate(points):
        t = tips[i] if tips else f'{dd:%b %-d}: {fmt(v, unit)}'
        out.append(f'<circle cx="{X(dd):.1f}" cy="{Y(v):.1f}" r="8" class="hitc" data-tip="{t}"/>')
        if tips and i < len(points) - 1:
            out.append(f'<circle cx="{X(dd):.1f}" cy="{Y(v):.1f}" r="2.5" class="pt"/>')
    ld, lv = points[-1]
    out.append(f'<circle cx="{X(ld):.1f}" cy="{Y(lv):.1f}" r="4" class="end{" hollow" if partial else ""}"/>')
    out.append(f'<line x1="{X(TODAY):.1f}" x2="{X(TODAY):.1f}" y1="{PT}" y2="{H-PB}" class="today2"/>')
    if deadline and Q0 <= deadline <= Q1 and target is not None:
        out.append(f'<path d="M{X(deadline):.1f},{Y(target)-5:.1f} l5,5 -5,5 -5,-5z" class="dl"/>')
    out.append('</svg>')
    return ''.join(out)


WEEK_X = [date(2026, 10, 2), date(2026, 10, 8), date(2026, 10, 15), date(2026, 10, 22), date(2026, 10, 29), date(2026, 11, 5), date(2026, 11, 12)]
WEEK_L = ['Week of Sep 28', 'Week of Oct 5', 'Week of Oct 12', 'Week of Oct 19', 'Week of Oct 26', 'Week of Nov 2', 'This week']
MON_X, MON_L = [date(2026, 10, 15), date(2026, 11, 15)], ['October', 'This month']
def period_line(vals, target, kind='week', lower=False, unit=''):
    xs, ls = (WEEK_X, WEEK_L) if kind == 'week' else (MON_X, MON_L)
    tips = []
    for i, (v, l) in enumerate(zip(vals, ls)):
        if i == len(vals) - 1:
            tips.append(f'{l}: {fmt(v, unit)} so far')
        elif target is None:
            tips.append(f'{l}: {fmt(v, unit)}')
        else:
            met = v <= target if lower else v >= target
            tips.append(f'{l}: {fmt(v, unit)}, {"met" if met else "not met"}')
    return line_chart(list(zip(xs, vals)), target, lower=lower, unit=unit, partial=True, tips=tips)

def mtile(area, aname, name, value, unit, ctx, state, chart, foot, good=None):
    good = (state in ('ok', 'met')) if good is None else good
    lc = '#328f32' if good else '#cc363c'
    html_ = (f'<div class="mt {area}" style="--lc:{lc}"><div class="mt-h"><span class="mt-n">{name}</span></div>'
            f'<div class="mt-v"><span class="mt-num">{value}</span><span class="mt-u">{unit}</span><span class="t-meta">{ctx}</span></div>'
            f'{chart}<div class="mt-f t-meta">{foot}</div></div>')
    return (area, aname, html_, good, state is not None)

D = date
wk = ['Oct 1', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2', 'Nov 9', 'Nov 16']
def weeks(vals):
    return vals, wk[:len(vals)]

tiles = [
  # Finance
  mtile('finance', 'Finance', 'Savings', '₱10,500', '', 'of ₱30,000 by Dec 31', 'warn',
        line_chart([(D(2026,10,1), 6000), (D(2026,10,15), 7200), (D(2026,10,31), 8800), (D(2026,11,14), 10500)], 30000, D(2026,12,31), unit='₱'),
        'Needs ₱19,500 more in 47 days'),
  mtile('finance', 'Finance', 'Monthly spending', '₱6,500', '', 'of ₱15,000 limit this month', 'ok',
        period_line([14200, 6500], 15000, 'month', lower=True, unit='₱'),
        'Lower is better · Oct stayed under'),
  # Health
  mtile('health', 'Health &amp; Beauty', 'Distance run', '17', 'km', 'of 20 km this week', 'ok',
        period_line([14, 21, 22, 0, 20, 23, 17], 20, unit='km'), '4 of 6 weeks met'),
  mtile('health', 'Health &amp; Beauty', 'Sleep', '7.2', 'h', 'average this week · target 7 h', 'ok',
        period_line([6.5, 6.8, 7.1, 6.2, 7.3, 7.0, 7.2], 7, unit='h'), '3 of 6 weeks met'),
  mtile('health', 'Health &amp; Beauty', 'Body weight', '72.5', 'kg', 'target 70 kg by Mar 1', 'ok',
        line_chart([(D(2026,10,1), 74.0), (D(2026,10,12), 73.6), (D(2026,10,26), 73.1), (D(2026,11,7), 72.8), (D(2026,11,14), 72.5)], 70, D(2027,3,1), lower=True, unit='kg'),
        'Lower is better · ahead of pace'),
  # Career
  mtile('career', 'Career', 'Job applications', '1', '', 'of 5 this month', 'warn',
        period_line([5, 1], 5, 'month'),
        'Oct met · 16 days left in Nov'),
  mtile('career', 'Career', 'Study hours', '6', 'h', 'of 10 h this week', 'warn',
        period_line([8, 7, 9, 11, 10, 12, 6], 10, unit='h'), '3 of 6 weeks met'),
  # Personal
  mtile('personal', 'Personal', 'Books read', '1', '', 'of 12 by Dec 31', 'warn',
        line_chart([(D(2026,10,1), 0), (D(2026,10,28), 1), (D(2026,11,14), 1)], 12, D(2026,12,31)),
        'Needs 11 more in 47 days'),
  # Relationships
  mtile('relation', 'Relationships', 'Calls with family', '2', '', 'of 2 this week', 'met',
        period_line([2, 1, 2, 3, 2, 1, 2], 2), '4 of 6 weeks met'),
  # no target example
  mtile('home', 'Home', 'Electricity use', '182', 'kWh', 'this month so far', None,
        period_line([310, 182], None, 'month', lower=True, unit='kWh'),
        'Lower is better · down from October', good=True),
]

ORDER = ['career', 'finance', 'health', 'personal', 'relation', 'home']
groups = ''
for k in ORDER:
    items = [t for t in tiles if t[0] == k]
    if not items:
        continue
    aname = items[0][1]
    targeted = [t for t in items if t[4]]
    good = sum(1 for t in targeted if t[3])
    bad = len(targeted) - good
    summ = ' · '.join(x for x in [f'{good} on track' if good else '', f'{bad} behind' if bad else '',
                                  f'{len(items) - len(targeted)} without a target' if len(items) > len(targeted) else ''] if x)
    groups += (f'<div class="mgroup {k}" style="grid-column:span {len(items)}"><div class="mg-h">{ic("chev")}<span class="dot"></span><span class="mg-n">{aname}</span>'
               f'<span class="t-meta">{len(items)} metric{"s" if len(items) != 1 else ""} · {summ}</span></div>'
               f'{"".join(t[2] for t in items)}</div>')
outcomes = f'<div class="ogrid">{groups}</div>'
legend = ('<div class="mleg"><span><i class="lpos"></i>On track, met, or improving</span><span><i class="lneg"></i>Behind</span><span><i class="lhol"></i>Current period so far</span>'
          '<span><i class="lt1"></i>Target</span>'
          '<span><i class="ld"></i>Deadline</span></div>')

def effort_bars():
    mx = max(r[2] for r in o2.ROWS)
    tot = sum(r[3] for r in o2.ROWS)
    rows = ''
    for r in o2.ROWS:
        k, name, done, prev = r[0], r[1], r[2], r[3]
        share = done / o2.TOTAL * 100
        delta = round(share - prev * 100 / tot)
        d = f'{"+" if delta > 0 else ""}{delta} pt{"s" if abs(delta) != 1 else ""}' if delta else 'same'
        rows += (f'<div class="ebr {k}" data-tip="{name}: {done} tasks, {share:.0f}% of all completed tasks; {d} vs Q3">'
                 f'<span class="ebn"><span class="dot"></span>{name}</span>'
                 f'<span class="ebt"><i style="width:calc(64px + (100% - 64px) * {done/mx:.3f})"><b>{done}</b><em>{share:.0f}%</em></i></span>'
                 f'<span class="ebd t-meta">{d} vs Q3</span></div>')
    return f'<div class="ebars">{rows}</div>'

# ---------- effort: labels inside their own segment, change aligned under it ----------
def effort2():
    rows = o2.ROWS
    ptot = sum(x[3] for x in rows)
    segs, under = '', ''
    for r in rows:
        k, name, done, prev = r[0], r[1], r[2], r[3]
        share = done / o2.TOTAL * 100
        delta = round(share - prev * 100 / ptot)
        d = f'{"+" if delta > 0 else ""}{delta} pt{"s" if abs(delta) != 1 else ""} vs Q3' if delta else 'Same as Q3'
        small = share < 6
        segs += (f'<div class="es4" style="flex:{done};background:{o2.SOLID[k]}" data-tip="{name}: {done} tasks, {share:.0f}%, {d}">'
                 f'<span class="es4p">{share:.0f}%</span></div>')
        under += (f'<div class="eu4" style="flex:{done}"><span class="eu4n">{name}</span>'
                  f'<span class="t-meta">{done} tasks · {d}</span></div>')
    return f'<div class="ebar4">{segs}</div><div class="eunder4">{under}</div>'

# ---------- upcoming deadlines (dot plot on the rest of the quarter) ----------
def deadlines():
    s0, s1 = TODAY, Q1
    span = (s1 - s0).days
    items = [  # area key, area, label, kind, date
        ('career', 'Career', 'Hackathon prep', 'project', date(2026, 11, 20)),
        ('career', 'Career', 'Resume &amp; portfolio', 'project', date(2026, 11, 30)),
        ('home', 'Home', 'Room makeover', 'project', date(2026, 12, 15)),
        ('finance', 'Finance', 'Savings: ₱30,000', 'target', date(2026, 12, 31)),
        ('career', 'Career', 'Portfolio pieces: 4', 'target', date(2026, 12, 31)),
        ('personal', 'Personal', 'Books read: 12', 'target', date(2026, 12, 31)),
        ('finance', 'Finance', 'Emergency fund', 'project', date(2026, 12, 31)),
    ]
    ticks = ''.join(f'<span style="left:{(d - s0).days / span * 100:.1f}%">{lab}</span>' for d, lab in
                    [(date(2026, 11, 14), 'Today'), (date(2026, 12, 1), 'Dec 1'), (date(2026, 12, 31), 'Dec 31')])
    rows = ''
    for k, an, lab, kind, d in items:
        left = (d - s0).days / span * 100
        icon = ic('folder') if kind == 'project' else ic('diamond')
        rows += (f'<div class="dr {k}" data-tip="{an} · {lab} · {d:%b %-d} · in {(d - s0).days} days">'
                 f'<span class="drl"><span class="dot"></span><span class="drn">{lab}</span></span>'
                 f'<span class="drt"><i class="drm {kind}" style="left:{left:.1f}%">{icon}</i></span>'
                 f'<span class="drd t-meta">{(d - s0).days} days</span></div>')
    return f'<div class="dax">{ticks}</div>{rows}'

# ---------- routine consistency (one line per area, same line style as Outcomes) ----------
def consistency():
    data = [('career', 'Career', [72, 80, 78, 85, 88, 84, 86]), ('finance', 'Finance', [90, 92, 95, 93, 96, 95, 95]),
            ('health', 'Health &amp; Beauty', [85, 82, 80, 78, 76, 80, 79]), ('personal', 'Personal', [80, 84, 86, 88, 90, 89, 90]),
            ('home', 'Home', [78, 75, 74, 70, 72, 70, 71])]
    out = ''
    for k, n, v in data:
        good = v[-1] >= v[0]
        col = '#328f32' if good else '#cc363c'
        sp = a4.spark(v, col, 160, 28)
        sp = sp.replace('<svg class="spark"', '<svg class="spark" preserveAspectRatio="none"').replace('stroke-width="2"', 'stroke-width="2" vector-effect="non-scaling-stroke"', 1)
        ch = v[-1] - v[0]
        chs = f'{"+" if ch > 0 else ""}{ch} pts since Oct 1' if ch else 'Same as Oct 1'
        out += (f'<div class="cr {k}" data-tip="{n}: {v[-1]}% of due steps done this week, {v[0]}% the week of Oct 1">'
                f'<span class="drl"><span class="dot"></span><span class="drn">{n}</span></span>{sp}'
                f'<span class="crv">{v[-1]}%<span class="t-meta">{chs}</span></span></div>')
    axis = ('<div class="crax"><span></span><div><span>Oct 1</span><span>Oct 19</span><span>This week</span></div><span></span></div>')
    return (out + axis + '<div class="t-meta" style="margin-top:8px">Green: doing more of your routines than in early October. '
            'Red: doing fewer. Relationships has no routine steps.</div>')

# ---------- wins ----------
def wins():
    w = [('relation', 'Relationships', 'Calls with family', 'Weekly target met 4 times', 'target'),
         ('finance', 'Finance', 'Monthly spending', 'Stayed under ₱15,000 in October', 'target'),
         ('career', 'Career', 'Interview prep', 'Project finished Oct 30', 'project'),
         ('career', 'Career', 'Job applications', 'October target met', 'target'),
         ('health', 'Health &amp; Beauty', 'Distance run', '20 km week met 4 times', 'target')]
    return ''.join(f'<div class="wr {k}"><span class="wi">{ic("ok")}</span><div class="wb"><span class="wn">{n}</span>'
                   f'<span class="t-meta">{t}</span></div><span class="wa"><span class="dot"></span>{an}</span></div>' for k, an, n, t, _ in w)

# ---------- projects by area: progress vs pace ----------
def projects_by_area():
    # key, name, projects, done tasks, total tasks, share of their time window used (%)
    data = [('career', 'Career', 3, 12, 29, 58), ('finance', 'Finance', 1, 4, 11, 48),
            ('health', 'Health &amp; Beauty', 1, 9, 20, 22), ('personal', 'Personal', 1, 1, 12, 70),
            ('home', 'Home', 1, 3, 10, 30)]
    rows = ''
    for k, n, pj, d, t, pace in data:
        pct = round(d / t * 100)
        diff = pct - pace
        good = diff >= 0
        lab = 'On pace' if diff == 0 else f'{abs(diff)} pts {"ahead of" if good else "behind"} pace'
        rows += (f'<div class="pr {k}" data-tip="{n}: {d} of {t} project tasks done ({pct}%); {pace}% of the time window has passed">'
                 f'<span class="drl"><span class="dot"></span><span class="drn">{n}</span></span>'
                 f'<span class="prb"><i style="width:{pct}%"></i><b style="left:{pace}%"></b></span>'
                 f'<span class="prv">{pct}%<span class="{"pos" if good else "neg"}">{lab}</span></span></div>')
    return (rows + '<div class="t-meta" style="margin-top:8px">Bar: share of the tasks in the area\'s active projects that are done. '
            'Mark: how much of those projects\' time has passed. Relationships has no active projects.</div>')

# ---------- routines: one square per week, darker = more done ----------
def routine_grid():
    data = [('career', 'Career', [72, 80, 78, 85, 88, 84, 86]), ('finance', 'Finance', [90, 92, 95, 93, 96, 95, 95]),
            ('health', 'Health &amp; Beauty', [85, 82, 80, 78, 76, 80, 79]), ('personal', 'Personal', [80, 84, 86, 88, 90, 89, 90]),
            ('home', 'Home', [78, 75, 74, 70, 72, 70, 71])]
    weeks_ = ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2', 'Nov 9']
    rows = ''
    for k, n, v in data:
        cells = ''
        for i, x in enumerate(v):
            op = max(.15, min(1, (x - 50) / 50))
            cur = ' cur' if i == len(v) - 1 else ''
            cells += f'<i class="rg{cur}" style="--o:{op:.2f}" data-tip="{n}, week of {weeks_[i]}: {x}% of due steps done{" so far" if cur else ""}"></i>'
        cells += ''.join('<i class="rg up"></i>' for _ in range(6))
        rows += (f'<div class="rgr {k}"><span class="drl"><span class="dot"></span><span class="drn">{n}</span></span>'
                 f'<span class="rgc">{cells}</span><span class="crv">{v[-1]}%<span class="t-meta">this week</span></span></div>')
    axis = '<div class="rgax"><span></span><div><span>Oct</span><span>Nov</span><span>Dec</span></div><span></span></div>'
    legend = ('<div class="rgleg t-meta">Fewer done<i style="--o:.15"></i><i style="--o:.5"></i><i style="--o:1"></i>All done'
              '<span style="margin-left:12px"><i class="up"></i>Upcoming</span></div>')
    return rows + axis + legend + '<div class="t-meta" style="margin-top:6px">Relationships has no routine steps.</div>'

effort = a2.card('Effort', 'Where your completed tasks went in Q4 · 132 in total', effort2())
extras = ('<div class="row3">' + a2.card('Projects', 'Progress of active projects in each area, against their pace', projects_by_area()) + a2.card('Routine steps done', 'One square per week: the share of the area\'s due routine steps you completed', routine_grid()) + a2.card('Wins', 'Targets met and projects finished in Q4', wins()) + '</div>')

CSS = '''
.mgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.mt{border:1px solid var(--border);border-radius:var(--r-card);padding:12px 14px 10px;display:flex;flex-direction:column;gap:2px;cursor:pointer}
.mt:hover{border-color:var(--n300)}
.mt-h{display:flex;align-items:center;gap:6px;height:20px}
.mt-h .dot{width:8px;height:8px}
.mt-a{font-size:12px;color:var(--text-tertiary);font-weight:500}
.mt-h .stt{margin-left:auto}
.mt-n{font-size:14px;line-height:20px;font-weight:600}
.mt-v{display:flex;align-items:baseline;gap:4px;margin:2px 0 6px;flex-wrap:wrap}
.mt-num{font-size:24px;line-height:32px;font-weight:600;font-variant-numeric:tabular-nums}
.mt-u{font-size:13px;color:var(--text-tertiary);font-weight:500;margin-right:4px}
.mt-f{margin-top:4px}
.stt.met svg{color:#328f32}
.mc{width:100%;height:auto;display:block;overflow:visible;stroke:none}
.mc .ax{font-size:10px;fill:#6b7280;font-family:Inter,sans-serif}
.mc .b.met{fill:var(--a-solid)}
.mc .b.miss{fill:var(--a-border)}
.mc .b.cur{fill:var(--a-tint);stroke:var(--a-solid);stroke-width:1.5}
.mc .b:hover{opacity:.85}
.mc .tgt{stroke:#4b5563;stroke-width:1.25}
.mc .base{stroke:var(--n200);stroke-width:1}
.mc .grid{stroke:#f1f2f4;stroke-width:1}
.mc .ln{fill:none;stroke:var(--a-solid);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.mc .end{fill:var(--a-solid);stroke:#fff;stroke-width:2}
.mc .hitc{fill:transparent}
.mc .today2{stroke:var(--n900);stroke-width:1}
.mc .dl{fill:#fff;stroke:#4b5563;stroke-width:1.5}
.mleg{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--text-secondary)}
.mleg span{display:inline-flex;align-items:center;gap:6px}
.lb{width:10px;height:10px;border-radius:2px;display:inline-block}
.lb.met{background:var(--n500)}.lb.miss{background:var(--n300)}.lb.cur{background:#fff;box-shadow:inset 0 0 0 1.5px var(--n500)}
.lt1{width:16px;height:0;border-top:1.25px solid #4b5563;display:inline-block}
.ll{width:16px;height:0;border-top:2px solid var(--n500);display:inline-block}
.lhol{width:9px;height:9px;border-radius:50%;border:2px solid var(--n500);background:#fff;display:inline-block}
.lpart{width:16px;height:0;border-top:2px solid var(--n500);opacity:.4;display:inline-block}
.lpos{width:16px;height:0;border-top:2px solid #328f32;display:inline-block}.lneg{width:16px;height:0;border-top:2px solid #cc363c;display:inline-block}
.ld{width:8px;height:8px;border:1.5px solid #4b5563;transform:rotate(45deg);display:inline-block;background:#fff}
.mc .ln.part{opacity:.4}
.mc .end.hollow{fill:#fff;stroke:var(--a-solid);stroke-width:2}
.mc .pt{fill:var(--a-solid)}
.ebars{display:flex;flex-direction:column;gap:8px}
.ebr{display:grid;grid-template-columns:170px minmax(0,1fr) 110px;gap:16px;align-items:center;cursor:default}
.ebn{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500}
.ebn .dot{width:10px;height:10px;border-radius:2px}
.ebt{display:block;height:24px}
.ebt i{font-style:normal;display:flex;align-items:center;justify-content:space-between;height:100%;background:var(--a-solid);border-radius:0 6px 6px 0;padding:0 10px;color:#fff}
.ebt b{font-size:12px;font-weight:600}
.ebt em{font-style:normal;font-size:12px;font-weight:500;opacity:.9}
.ebd{text-align:right}
.mgrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.mt{padding:8px 10px 8px;gap:0}
.mt-h{display:flex;align-items:center;gap:6px;height:20px}
.mt-h .mt-n{font-size:13px;line-height:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mt-h .stt{margin-left:auto;flex:none;font-size:11px}
.mt-h .stt svg{width:12px;height:12px}
.mt-a{display:flex;align-items:center;gap:6px;font-size:11px;line-height:14px;color:var(--text-tertiary);font-weight:500}
.mt-a .dot{width:6px;height:6px}
.mt-v{margin:4px 0 2px;gap:4px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden}
.mt-v .t-meta{overflow:hidden;text-overflow:ellipsis;font-size:11px}
.mt-num{font-size:20px;line-height:26px}
.mt-u{font-size:12px;margin-right:2px}
.mt-f{margin-top:2px;font-size:11px;line-height:14px}
.mc .ln{stroke:var(--lc)}
.mc .wash{fill:var(--lc);opacity:.08}
.mc .pt,.mc .end{fill:var(--lc)}
.mc .end.hollow{fill:#fff;stroke:var(--lc)}
.mc .ax{font-size:9px}
.mc .tgt{stroke:#6b7280;stroke-width:1}
.ogrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px 8px;grid-auto-flow:dense}
.mgroup{display:grid;grid-template-columns:subgrid;row-gap:0;align-content:start}
.mg-h{grid-column:1 / -1}
.mg-h{display:flex;align-items:center;gap:8px;height:28px;margin-bottom:6px;cursor:pointer}
.mg-h>svg{width:12px;height:12px;color:var(--text-tertiary)}
.mg-h .dot{width:10px;height:10px;border-radius:2px}
.mg-n{font-size:14px;font-weight:600}
.mg-h .t-meta{margin-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ogrid{gap:12px}
.mgroup{background:var(--n50);border:1px solid #eef0f3;border-radius:12px;padding:6px 8px 8px;column-gap:8px}
.mgroup .mt{background:#fff}
.mg-h{margin-bottom:4px;padding-left:2px}
/* effort v2 */
.ebar2{display:flex;gap:2px;height:44px}
.es2{display:flex;flex-direction:column;justify-content:center;padding:0 10px;min-width:0;color:#fff;cursor:default;overflow:hidden}
.es2:first-child{border-radius:8px 0 0 8px}.es2:last-child{border-radius:0 8px 8px 0}
.esn{font-size:12px;font-weight:600;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.esv{font-size:11px;font-weight:500;line-height:14px;opacity:.9;white-space:nowrap}
.eunder{display:flex;gap:2px;margin-top:6px}
.eu{min-width:0;padding:0 10px;display:flex;flex-direction:column}
.eu .t-meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.eun{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500}
.eun .dot{width:6px;height:6px}
/* three cards */
.row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.dax{position:relative;height:18px;margin-left:170px;margin-right:56px;border-bottom:1px solid var(--border)}
.dax span{position:absolute;transform:translateX(-50%);font-size:10px;color:var(--text-tertiary);white-space:nowrap}
.dax span:first-child{transform:none}.dax span:last-child{transform:translateX(-100%)}
.dr,.cr{display:grid;grid-template-columns:160px minmax(0,1fr) 46px;gap:10px;align-items:center;height:30px;cursor:default}
.drl{display:flex;align-items:center;gap:6px;min-width:0}
.drl .dot{width:6px;height:6px;flex:none}
.drn{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drt{position:relative;height:100%;border-left:1px solid var(--n200)}
.drt::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px solid #f1f2f4}
.drm{position:absolute;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;display:grid;place-items:center;color:var(--a-solid);background:#fff}
.drm svg{width:14px;height:14px}
.drm.target svg{fill:var(--a-solid);stroke:#fff}
.drd{text-align:right;font-size:11px}
.cr svg.spark{width:100%;height:28px;overflow:visible}
.cr svg.spark circle{display:none}
.crv{font-size:12px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.wr{display:flex;align-items:center;gap:10px;min-height:40px}
.wi{color:#328f32;display:grid}.wi svg{width:16px;height:16px}
.wb{display:flex;flex-direction:column;min-width:0;flex:1}
.wn{font-size:13px;font-weight:500}
.wa{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);flex:none}
.wa .dot{width:6px;height:6px}
.row2c{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cr{grid-template-columns:150px minmax(0,1fr) 120px;height:36px}
.crv{display:flex;flex-direction:column;align-items:flex-end;line-height:16px}
.crv .t-meta{font-size:11px;font-weight:400;line-height:14px}
.crax{display:grid;grid-template-columns:150px minmax(0,1fr) 120px;gap:10px;margin-top:2px}
.crax>div{display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:3px}
.crax>div span{font-size:10px;color:var(--text-tertiary)}
.pr,.rgr{display:grid;grid-template-columns:130px minmax(0,1fr) 112px;gap:10px;align-items:center;height:40px}
.prb{position:relative;height:8px;border-radius:999px;background:var(--a-tint)}
.prb i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--a-solid)}
.prb b{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--n900);border-radius:1px}
.prv{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;font-weight:600;line-height:16px;font-variant-numeric:tabular-nums}
.prv span{font-size:11px;font-weight:500;line-height:14px}
.prv .pos{color:#296c29}.prv .neg{color:var(--danger)}
.rgc{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:3px}
.rg{display:block;height:18px;border-radius:3px;background:var(--a-solid);opacity:var(--o)}
.rg.cur{box-shadow:inset 0 0 0 1.5px #fff,0 0 0 1.5px var(--a-solid)}
.rg.up{background:#fff;opacity:1;box-shadow:inset 0 0 0 1px var(--n300)}
.rgax{display:grid;grid-template-columns:130px minmax(0,1fr) 112px;gap:10px}
.rgax>div{display:grid;grid-template-columns:4.5fr 4fr 4.5fr;font-size:10px;color:var(--text-tertiary);border-top:1px solid var(--border);padding-top:3px}
.rgleg{display:flex;align-items:center;gap:4px;margin-top:10px;font-size:11px}
.rgleg i{width:12px;height:12px;border-radius:2px;background:var(--n600);opacity:var(--o);display:inline-block}
.rgleg i.up{background:#fff;opacity:1;box-shadow:inset 0 0 0 1px var(--n300);margin-right:4px;vertical-align:-2px}
.eabove{display:flex;gap:2px}
.eu3{min-width:0;padding:0 2px 8px;display:flex;flex-direction:column;cursor:default}
.eu3n{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eu3v{font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eu3v b{font-weight:600;color:var(--text-primary)}
.eu3 .t-meta{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ebar3{display:flex;gap:2px;height:8px}
.es3{border-radius:999px;cursor:default}
.ebar4{display:flex;gap:2px;height:24px}
.es4{display:flex;align-items:center;gap:6px;padding:0 8px;min-width:0;color:#fff;cursor:default}
.es4:first-child{border-radius:6px 0 0 6px}.es4:last-child{border-radius:0 6px 6px 0}
.es4n{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.es4p{font-size:12px;font-weight:600;flex:none}
.eunder4{display:flex;gap:2px;margin-top:4px}
.eu4{min-width:0;padding:0 8px;display:flex;flex-direction:column}
.eu4n{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eu4 .t-meta{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Life areas overview v3</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{o2.CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{ov.sidebar}</aside>
  <main class="main">
    <div class="areahead">
      <div>
        <div class="ttl" style="padding-left:0"><h1 class="t-page">Life areas</h1></div>
        <p class="t-body vision" style="padding-left:0">Are your areas moving toward what you set for them?</p>
      </div>
      <div class="acts">
        <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
        <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
        <button class="btn icon" title="More">{ic('more')}</button>
        <div class="split-btn accent"><button class="sb-main">{ic('plus')}New area</button></div>
      </div>
    </div>
    <div class="scroll wide">
      {effort}
      {a2.card('Outcomes', '10 metrics owned by 6 areas · 6 on track or met, 4 behind', outcomes + legend)}
      {extras}
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
html = html.replace(f'<span class="icon-btn" title="Show as table">{ic("table")}</span>',
                    f'<span class="icon-btn cmenu" title="Sort, filter and view as table">{ic("sliders")}</span>')
Path('/mnt/user-data/outputs/life-os-mock-areas-overview.html').write_text(html)
print('ok', len(html))
