"""Build html_mockups/approved-routines-overview.html: the Routines overview (Phase E, approved Nov 15).

Opened from the ROUTINES heading in the Areas sidebar. It compares routines rather than repeating a routine page:
- Header: "Routines", the period switch, a ⋯ menu (Archived routines, Export as CSV) and New routine (brand 700).
- Five stat tiles across every routine (completion rate, steps done, full days, missed, longest current streak).
- Routines (left): one heatmap row per routine, each square shaded by the share of its due steps done that day
  (accent, since routines have no area colour); ring with today's progress, schedule and step count beside the name.
- Slipping (right, 360 px, same height): Open today, Most missed (steps) and Streaks ended this week; empty
  sections are hidden, and the card says "Nothing slipping." once when all are empty.
- Completion by routine (left column, under the heatmap): one bar per routine, accent on n100.
Mock states: Normal (Quarter), Week, Month, Year, Routines card menu, ⋯ menu, New routine, Routines with no history,
No routines.

Reuses build_routine.py (data, tiles, ring, sidebar, CSS, New routine pop-up).
Usage: python build_routines_overview.py <html_mockups dir> <out.html>
"""
import sys
from datetime import date, timedelta

import build_routine as br

OUT = sys.argv[2] if len(sys.argv) > 2 else 'approved-routines-overview.html'
TODAY, D = br.TODAY, br.D
ic, ring, md, wmd, iso = br.ic, br.ring, br.md, br.wmd, br.iso

R_MOR = br.Routine('mor', 'Morning routine', [(date(2026, 7, 6), 'daily')], [
    br.S('Drink a glass of water', 'health', .95, start=date(2026, 7, 6), last7='DDDDDDD'),
    br.S('Make the bed', 'home', .85, start=date(2026, 7, 6), last7='DDMDDDD'),
    br.S('Review today’s plan', 'career', .82, start=date(2026, 7, 6), last7='DDDSDDD'),
    br.S('Journal 5 min', 'personal', .7, start=date(2026, 9, 1), last7='DMDMDDD'),
], seed=11)
ROUTINES = [R_MOR, br.R_EVE, br.R_WEEK]


def sidebar(routines=br.SIDEBAR_ROUTINES):
    s = br.sidebar(None, routines)
    return s.replace('<div class="sgroup" title="Open all routines">', '<div class="sgroup on" title="Open all routines">', 1)


def header(period, disabled=False):
    a, b, lab, _, _ = br.PERIODS[period]
    seg = ''.join(f'<span class="{"on" if p == period else ""}" data-p="{p}">{p.capitalize()}</span>'
                  for p in ['week', 'month', 'quarter', 'year'])
    dis = ' disabled' if disabled else ''
    return f'''<div class="areahead"><div><div class="ttl" style="padding-left:0"><h1 class="t-page">Routines</h1></div></div>
    <div class="acts{dis}">
      <div class="seg pseg">{seg}</div>
      <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">{lab}</span><span class="icon-btn">{ic('right')}</span></div>
      <button class="btn icon mbtn" title="More">{ic('more')}</button>
    </div><button class="btn primary addstep">{ic('plus')}New routine</button></div>'''


# ---------------------------------------------------------------- stats across routines
def total(rs, a, b):
    t = dict(done=0, miss=0, skip=0, full=0, due_days=0)
    for r in rs:
        w = r.window(a, b)
        for k in t:
            t[k] += w[k]
    t['rate'] = round(100 * t['done'] / (t['done'] + t['miss'])) if t['done'] + t['miss'] else None
    return t


def tiles(rs, period):
    a, b, lab, prev, plab = br.PERIODS[period]
    w = total(rs, a, b)
    if w['done'] + w['miss'] + w['skip'] == 0:
        names = ['Completion rate', 'Steps done', 'Full days', 'Missed', 'Longest streak']
        return '<div class="kpis rk">' + ''.join(
            f'<div class="tile stile"><span class="tl">{n}</span><div class="tv"><span class="num dash">—</span></div>'
            f'<span class="t-meta">&nbsp;</span></div>' for n in names) + '</div>'
    created = min(r.created for r in rs)
    pw = total(rs, *prev) if prev and prev[1] >= created else None
    bk = [x for x in br.buckets(period, a, b) if x[1] >= created]
    ws = [total(rs, s, e) for s, e, _ in bk]
    names = [t for _, _, t in bk]

    def delta(cur, old, better_low=False, pts=False):
        if old is None or cur is None:
            return f'since {md(created)}', True
        dv = cur - old
        good = dv <= 0 if better_low else dv >= 0
        sign = '+' if dv > 0 else ('−' if dv < 0 else '±')
        return f'{sign}{abs(dv)}{" pts" if pts else ""} vs {plab}', good

    out = []
    txt, good = delta(w['rate'], pw['rate'] if pw else None, pts=True)
    out.append(('Completion rate', w['rate'], '%', br.spark([x['rate'] for x in ws], good,
               [f'{n}: {x["rate"]}%' for n, x in zip(names, ws)]), txt))
    txt, good = delta(w['done'], pw['done'] if pw else None)
    out.append(('Steps done', w['done'], '', br.spark([x['done'] for x in ws], good, [f'{n}: {x["done"]}' for n, x in zip(names, ws)]),
                f'of {w["done"] + w["miss"] + w["skip"]} due'))
    txt, good = delta(w['full'], pw['full'] if pw else None)
    out.append(('Full days', w['full'], '', br.spark([x['full'] for x in ws], good, [f'{n}: {x["full"]}' for n, x in zip(names, ws)]),
                f'of {w["due_days"]} routine days'))
    txt, good = delta(w['miss'], pw['miss'] if pw else None, better_low=True)
    out.append(('Missed', w['miss'], 'steps', br.spark([x['miss'] for x in ws], good, [f'{n}: {x["miss"]}' for n, x in zip(names, ws)]), txt))
    st = sorted(((r.streak(), r) for r in rs), key=lambda x: -x[0])[0]
    seq = [st[1].streak(min(e, TODAY - D) if e >= TODAY else e) for s, e, _ in bk]
    out.append(('Longest streak', st[0], 'days' if st[0] != 1 else 'day', br.spark(seq, True, [f'{n}: {v}' for n, v in zip(names, seq)]),
                st[1].name))
    html = ''.join(f'<div class="tile stile"><span class="tl">{n}</span><div class="tv"><span class="num">{v}</span>'
                   f'<span class="unit">{u}</span>{c}</div><span class="t-meta">{m}</span></div>' for n, v, u, c, m in out)
    return f'<div class="kpis rk">{html}</div>'


# ---------------------------------------------------------------- routines heatmap
def head(period):
    a, b, lab, _, _ = br.PERIODS[period]
    if period == 'year':
        cols = br.weeks_of_year()
        n = len(cols)
        h = ''.join(f'<span style="left:{100 * k / n:.2f}%">{br.MON[w0.month - 1]}</span>'
                    for k, w0 in enumerate(cols) if w0.day <= 7 and w0.year == 2026)
        return cols, h
    cols = br.days(a, b)
    n = len(cols)
    if period == 'quarter':
        h = ''.join(f'<span style="left:{100 * k / n:.2f}%">{br.MONTHS[d.month - 1]}</span>' for k, d in enumerate(cols) if d.day == 1)
    elif period == 'month':
        h = ''.join(f'<span class="dn{" tdy" if d == TODAY else ""}" style="left:{100 * k / n:.2f}%;width:{100 / n:.2f}%">{d.day}</span>'
                    for k, d in enumerate(cols))
    else:
        h = ''.join(f'<span class="dn wk{" tdy" if d == TODAY else ""}" style="left:{100 * k / n:.2f}%;width:{100 / n:.2f}%">'
                    f'{br.WD[d.weekday()]} <b>{d.day}</b></span>' for k, d in enumerate(cols))
    return cols, h


def routine_cells(r, period, cols):
    out = ''
    for d in cols:
        if period == 'year':
            sts = []
            for k in range(7):
                sts += r.day(d + timedelta(days=k))
            dm = [x for x in sts if x in 'dm']
            cur = d <= TODAY <= d + timedelta(days=6)
            if d > TODAY:
                cls, o = ('f' if 'f' in sts else 'n'), None
            elif dm:
                cls, o = 'q', sum(x == 'd' for x in dm) / len(dm)
            elif 'p' in sts:
                cls, o = 'p', None
            elif all(x == 'x' for x in sts):
                cls, o = 'x', None
            else:
                cls, o = 'n', None
            if cur:
                cls += ' cw'
            st = f' style="--o:{max(o, .08):.2f}"' if o is not None else ''
            out += f'<i class="{cls}"{st} data-tip="{r.name} · week of {md(d)}{f" · {round(100 * o)}% done" if o is not None else ""}"></i>'
            continue
        cls, v = br.agg(r, d)
        st, tip = '', f'{r.name} · {wmd(d)}'
        if v:
            st = f' style="--o:{max(v[0] / v[1] if v[1] else 0, .08):.2f}"'
            tip += f' · {v[0]} of {v[1]} done'
        else:
            tip += {'n': ' · not due', 'x': '', 'p': ' · paused', 'f': ' · upcoming', 's': ' · skipped'}.get(cls, '')
        out += f'<i class="{cls}"{st} data-tip="{tip}"></i>'
    return f'<div class="hcells" style="grid-template-columns:repeat({len(cols)},minmax(0,1fr))">{out}</div>'


def rlabel(r):
    dn, due = r.today_count()
    st = 'paused' if r.open_pause() else ('none' if due == 0 else 'on')
    rule = br.RULE_TXT[r.schedules[-1][1]]
    n = len(r.steps)
    return (f'<span class="hn"><span class="hl1"><span class="rmk2">{ring(dn / due if due else 0, 16, st)}</span>'
            f'<span class="hname rlink">{r.name}</span></span><span class="lmeta">{rule} · {n} step{"s" if n != 1 else ""}</span></span>')


def routines_card(rs, period):
    cols, h = head(period)
    rows = f'<div class="hrow hhead"><span class="hn"></span><div class="hmonths {period}">{h}</div></div>'
    for r in rs:
        rows += f'<div class="hrow">{rlabel(r)}{routine_cells(r, period, cols)}</div>'
    a, b, _, _, _ = br.PERIODS[period]
    nsteps = sum(len(r.steps) for r in rs)
    sub = f'{len(rs)} routine{"s" if len(rs) != 1 else ""} · {nsteps} steps'
    return br.card('Routines', sub, f'<div class="heat2 rheat rov p-{period}">{rows}</div>', 'rovcard')


def by_routine(rs, period):
    a, b, _, _, _ = br.PERIODS[period]
    rows = ''
    for r in rs:
        w = r.window(a, b)
        tot = w['done'] + w['miss']
        if tot:
            bar = f'<span class="cbt acc"><i style="width:{w["rate"]}%"></i></span>'
            val = f'<span class="cbv">{w["rate"]}%</span><span class="t-meta cbn">{w["done"]} of {tot}</span>'
        else:
            bar, val = '<span class="cbt"></span>', '<span></span><span class="t-meta cbn">Nothing due yet</span>'
        rows += f'<div class="cbrow">{rlabel(r)}{bar}{val}</div>'
    w = total(rs, a, b)
    sub = f'{w["rate"]}% of due steps done in {br.PNAME[period]}' if w['rate'] is not None else ''
    if w['rate'] is None:
        return br.card('Completion by routine', '', br.eline('Nothing done yet.'))
    return br.card('Completion by routine', sub, f'<div class="cbs">{rows}</div>')


# ---------------------------------------------------------------- slipping
def slipping(rs, period):
    a, b, _, _, _ = br.PERIODS[period]
    secs = []
    # open today
    rows = ''
    for r in rs:
        dn, due = r.today_count()
        if due and dn < due and not r.open_pause():
            rows += (f'<div class="slrow"><span class="slm">{ring(dn / due, 16)}</span><div class="slb"><span class="slt">{r.name}</span>'
                     f'<span class="t-meta">{due - dn} of {due} steps left</span></div></div>')
    if rows:
        secs.append(('Open today', rows.count('slrow'), rows))
    # most missed in the period
    miss = []
    for r in rs:
        for i, s in enumerate(r.steps):
            m = sum(1 for d in br.days(a, min(b, TODAY)) if r.st[(i, d)] == 'm')
            if m:
                miss.append((m, s, r))
    miss.sort(key=lambda x: -x[0])
    rows = ''.join(f'<div class="slrow {s["a"]}"><span class="slm"><span class="rbm"></span></span><div class="slb"><span class="slt">{s["t"]}</span>'
                   f'<span class="t-meta">{r.name}</span></div><span class="t-meta slr">{m} missed</span></div>' for m, s, r in miss[:3])
    if rows:
        secs.append(('Most missed', min(3, len(miss)), rows))
    # streaks that ended this week (a miss this week after a run of 4+ done days)
    wk0 = TODAY - timedelta(days=TODAY.weekday())
    rows, n = '', 0
    for r in rs:
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
                n += 1
                rows += (f'<div class="slrow {s["a"]}"><span class="slm"><span class="rbm"></span></span><div class="slb"><span class="slt">{s["t"]}</span>'
                         f'<span class="t-meta">{r.name}</span></div><span class="t-meta slr">{run} days · ended {br.WD[d.weekday()]}</span></div>')
    if rows:
        secs.append(('Streaks ended this week', n, rows))
    if not secs:
        body = '<div class="ag-empty"><span class="t-meta">Nothing slipping.</span></div>'
    else:
        body = ''.join(f'<div class="slsec"><div class="adh"><span class="t-label">{t}</span><span class="counter">{c}</span></div>{r}</div>'
                       for t, c, r in secs)
    return (f'<aside class="agenda slip"><header class="ag-head"><span class="stitle">Slipping</span></header>'
            f'<div class="ag-body">{body}</div></aside>')


# ---------------------------------------------------------------- pages and states
def page(rs, period, app_id, routines=br.SIDEBAR_ROUTINES):
    main = f'''<main class="main rmain"><div class="content">{header(period)}
      <div class="scroll">
        {tiles(rs, period)}
        <div class="split ovsplit"><div class="leftcol">{routines_card(rs, period)}{by_routine(rs, period)}</div>{slipping(rs, period)}</div>
      </div></div></main>'''
    return f'<div class="app rapp" id="{app_id}" data-period="{period}">{br.RAIL}{sidebar(routines)}{main}</div>'


def first_run():
    chips = ''.join(f'<span class="qchip">{ring(0, 14, "none")}{n}</span>' for n in ['Morning routine', 'Evening routine', 'Weekly reset', 'Workout'])
    main = f'''<main class="main rmain"><div class="content">{header('quarter', True)}<div class="frun">
      <span class="frico">{ring(.66, 40)}</span>
      <h2 class="t-page">Set up your first routine</h2>
      <p class="t-body">A routine is a list of steps you repeat on a schedule. Each step belongs to a life area or a project.</p>
      <button class="btn primary">{ic('plus')}New routine</button>
      <div class="qchips">{chips}</div></div></div></main>'''
    return f'<div class="app rapp" id="ov-none">{br.RAIL}{sidebar([]).replace("No routines yet.", "No routines yet.")}{main}</div>'


def card_menu():
    def cb(t, on=True):
        return f'<div class="fxr"><span class="mini-check{" on" if on else ""}">{ic("check") if on else ""}</span>{t}</div>'
    return ('<div class="pmenu ov cmenu2" id="cm"><div class="lab">Sort by</div>'
            + ''.join(f'<div class="mi">{t}{"<span class=ck>" + ic("check") + "</span>" if t == "Manual" else ""}</div>'
                      for t in ['Manual', 'Completion rate', 'Name'])
            + '<div class="msep"></div><div class="lab">Show</div>' + cb('Paused routines') + '</div>')


def more_menu():
    return (f'<div class="pmenu ov omore" id="om"><div class="mi">{ic("archive")}Archived routines</div>'
            f'<div class="mi"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Export as CSV</div></div>')


CSS = r"""
.rov .hcells i.q{background:var(--acc600);opacity:var(--o)}
.rov .hcells i.q.t{opacity:1;background:color-mix(in oklab,var(--acc600) calc(var(--o)*100%),#fff);box-shadow:inset 0 0 0 1.5px var(--acc600)}
.rov .hcells i.t{background:#fff;box-shadow:inset 0 0 0 1.5px var(--acc600)}
.rov .hcells i.s{background:var(--n300)}
.rov .hrow+.hrow{margin-top:10px}
.rov .hcells{cursor:default}
.rmk2{display:grid;place-items:center;width:16px;flex:none}
.lmeta{padding-left:24px}
.rlink{cursor:pointer}.rlink:hover{text-decoration:underline;text-underline-offset:2px}
.cbt.acc i{background:var(--acc600)}
.ovsplit{align-items:stretch}
.slip{position:static;max-height:none}
.slsec+.slsec{margin-top:10px}
.slsec .adh{display:flex;align-items:center;gap:6px;padding:6px 8px 2px}
.slrow{display:flex;gap:10px;align-items:flex-start;padding:7px 8px;border-radius:6px;cursor:pointer}
.slrow:hover{background:var(--n100)}
.slm{width:16px;height:20px;display:grid;place-items:center;flex:none}
.slm .rbm{width:14px;height:14px}
.slb{flex:1;min-width:0;display:flex;flex-direction:column}
.slt{font-size:14px;line-height:20px;color:var(--text-primary)}
.slr{white-space:nowrap;line-height:20px}.slr.red{color:var(--danger)}
.omore{right:150px;top:62px;width:200px}
.cmenu2{left:auto;right:410px;top:262px;width:220px}
.cmenu2 .lab{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-tertiary);padding:6px 8px 4px}
.cmenu2 .mi .ck{margin-left:auto;color:var(--acc600);display:grid}.cmenu2 .mi .ck svg{width:14px;height:14px}
.fxr{display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;font-size:13px;border-radius:6px}
.fxr .mini-check{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--n400);display:grid;place-items:center;color:#fff;box-sizing:border-box}
.fxr .mini-check.on{background:#8f74b3;border-color:#8f74b3}.fxr .mini-check svg{width:9px;height:9px;stroke-width:3.5}
.frun{flex:1}
"""

JS = r"""
document.addEventListener('click',e=>{const app=e.target.closest('.app');if(!app)return;
  const seg=e.target.closest('.pseg span');if(seg&&app.id.startsWith('ov-')&&app.id!=='ov-none'&&app.id!=='ov-new'){showApp('ov-'+seg.dataset.p)}});
function showApp(id){document.querySelectorAll('.app.rapp').forEach(a=>a.classList.toggle('show',a.id===id))}
const st=document.getElementById('st');
function setState(sp){st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===sp));
  document.querySelectorAll('.ov').forEach(o=>o.style.display='');showApp(sp.dataset.app);
  (sp.dataset.ov||'').split(' ').filter(Boolean).forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='block'});}
st.onclick=e=>{const sp=e.target.closest('span[data-app]');if(sp)setState(sp)};
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ov').forEach(o=>o.style.display='')});
setState(st.querySelector('span.on'));
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){tip.style.display='none';return}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';});
"""

STATES = [
    ('Normal (Quarter)', 'ov-quarter', ''), ('Week', 'ov-week', ''), ('Month', 'ov-month', ''), ('Year', 'ov-year', ''),
    ('Routines card menu', 'ov-quarter', 'cm'), ('⋯ menu', 'ov-quarter', 'om'), ('New routine', 'ov-quarter', 'nr0'),
    ('Routines with no history', 'ov-new', ''), ('No routines', 'ov-none', ''),
]


def build():
    br.RAIL = br.rail()
    apps = ''.join(page(ROUTINES, p, f'ov-{p}') for p in br.PERIODS)
    apps += page([br.R_NEWS], 'quarter', 'ov-new', routines=[('news', 'Workout', 0, 'on')])
    apps += first_run()
    ovs = card_menu() + more_menu() + br.new_routine(False)
    sw = ''.join(f'<span{" class=on" if k == 0 else ""} data-app="{a}" data-ov="{o}">{l}</span>' for k, (l, a, o) in enumerate(STATES))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Routines overview, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{br.base_css()}{br.CSS}{CSS}</style></head>
<body>
{apps}
{ovs}
<div class="states"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{JS}</script>
</body></html>'''
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
