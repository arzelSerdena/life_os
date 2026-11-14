"""Areas > Career as a data screen. Rail = groups, sidebar = screens in the group."""
import sys, random
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_week as bw  # noqa: E402

ic = bw.ic
bw.I.update({
  'stats': '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  'board': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
  'archive': '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  'up': '<path d="M7 17 17 7M8 7h9v9"/>', 'down': '<path d="M7 7l10 10M17 8v9H8"/>',
  'grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'bolt': '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  'met': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'miss': '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  'prog': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'table': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
})
BLUE = {50: '#f3f6fc', 100: '#e5edf9', 200: '#c6d9f1', 300: '#94bbe5', 400: '#5a97d6', 500: '#3579c2', 600: '#255fa4', 700: '#1f4c85'}

# ---------- rail: groups ----------
groups = [
  ('Home', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  ('Execution', bw.I['board']),
  ('Calendar', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  ('Areas', '<circle cx="7" cy="7" r="4"/><rect x="13" y="3" width="8" height="8" rx="1"/><path d="M7 13l4 8H3z"/><rect x="13" y="13" width="8" height="8" rx="4"/>'),
]
rail = ''.join(f'<a{" class=on" if n == "Areas" else ""} title="{n}"><svg viewBox="0 0 24 24">{p}</svg></a>' for n, p in groups)

def sitem(label, *, icon=None, area=None, count=None, on=False):
    lead = '<span class="dot"></span>' if area else ic(icon)
    c = f'<span class="c">{count}</span>' if count is not None else ''
    return f'<div class="item{" on" if on else ""}{" " + area if area else ""}">{lead}{label}{c}</div>'

sidebar = (sitem('All areas', icon='grid')
  + '<div class="side-divider"></div><div class="sec"><div class="t-label">Life areas</div>'
  + sitem('Career', area='career', count=9, on=True) + sitem('Finance', area='finance', count=4)
  + sitem('Health &amp; Beauty', area='health', count=6) + sitem('Personal', area='personal', count=3)
  + sitem('Relationships', area='relation', count=2) + sitem('Home', area='home', count=5)
  + '<div class="item add">' + ic('plus') + 'New life area</div></div>'
  + '<div class="grow"></div><div class="side-divider"></div>' + sitem('Archived areas', icon='archive', count=1))

# ---------- stat tiles ----------
def spark(vals, w=72, h=24):
    mx = max(vals) or 1
    pts = [(i * w / (len(vals) - 1), h - 2 - (v / mx) * (h - 4)) for i, v in enumerate(vals)]
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    lx, ly = pts[-1]
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path d="{d}" fill="none" stroke="{bw_n(400)}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3" fill="var(--a-solid)" stroke="#fff" stroke-width="2"/></svg>')

def bw_n(step):
    return {300: '#d1d5db', 400: '#9ca3af', 200: '#e5e7eb'}[step]

def tile(label, value, unit='', delta=None, good=None, note=None, trend=None):
    d = ''
    if delta:
        cls = 'good' if good is True else 'bad' if good is False else ''
        arrow = ic('up') if delta.startswith('+') else ic('down') if delta.startswith('−') else ''
        d = f'<span class="delta {cls}">{arrow}{delta}</span>'
    n = f'<span class="t-meta">{note}</span>' if note else ''
    t = spark(trend) if trend else ''
    return (f'<div class="tile"><span class="tl">{label}</span><div class="tv"><span class="num">{value}</span>'
            f'<span class="unit">{unit}</span>{t}</div><div class="td">{d}{n}</div></div>')

tiles = ''.join([
  tile('Open tasks', '9', delta='1 overdue', good=False, note='2 high priority'),
  tile('Completed this week', '7', delta='+2', good=True, note='vs last week', trend=[3,5,4,6,2,5,7,6,4,8,5,7]),
  tile('On time', '78', '%', delta='−6 pts', good=False, note='last 30 days', trend=[90,85,88,80,84,78]),
  tile('Rollovers', '1.4', '/ task', note='avg, last 30 days'),
  tile('Routine steps done', '86', '%', delta='+4 pts', good=True, note='last 30 days', trend=[70,75,80,78,82,86]),
  tile('Active projects', '3', note='1 done this quarter'),
])

# ---------- weekly completed bar chart ----------
weeks = ['Aug 24','Aug 31','Sep 7','Sep 14','Sep 21','Sep 28','Oct 5','Oct 12','Oct 19','Oct 26','Nov 2','Nov 9']
done = [3,5,4,6,2,5,7,6,4,8,5,7]
def bars():
    W, H, L, B, T = 1000, 200, 28, 24, 10
    pw, ph = W - L - 8, H - B - T
    ymax = 10
    slot = pw / len(done)
    bwid = min(24, slot - 10)
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Tasks completed per week">']
    for v in (0, 5, 10):
        y = T + ph - v / ymax * ph
        out.append(f'<line x1="{L}" x2="{W-8}" y1="{y:.1f}" y2="{y:.1f}" stroke="#eef0f3" stroke-width="1"/>')
        out.append(f'<text x="{L-8}" y="{y+4:.1f}" text-anchor="end" class="ax">{v}</text>')
    for i, (w, v) in enumerate(zip(weeks, done)):
        x = L + i * slot + (slot - bwid) / 2
        h = v / ymax * ph
        y = T + ph - h
        cur = i == len(done) - 1
        fill = 'url(#hatch)' if cur else 'var(--a-solid)'
        r = 4
        out.append(f'<path class="hit" data-tip="Week of {w}: {v} done{" (so far)" if cur else ""}" d="M{x:.1f},{T+ph} V{y+r:.1f} Q{x:.1f},{y:.1f} {x+r:.1f},{y:.1f} H{x+bwid-r:.1f} Q{x+bwid:.1f},{y:.1f} {x+bwid:.1f},{y+r:.1f} V{T+ph}Z" fill="{fill}"/>')
        if i % 2 == 1 or cur:
            out.append(f'<text x="{x+bwid/2:.1f}" y="{H-6}" text-anchor="middle" class="ax">{w}</text>')
        if cur:
            out.append(f'<text x="{x+bwid/2:.1f}" y="{y-6:.1f}" text-anchor="middle" class="vl">{v}</text>')
    out.insert(1, f'<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="{BLUE[200]}"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--a-solid)" stroke-width="2.5"/></pattern></defs>')
    out.append('</svg>')
    return ''.join(out)

# ---------- open tasks by priority ----------
prio = [('High', 'Do first', 2, 'flag-high'), ('Medium', 'Schedule', 2, 'flag-med'), ('Low', 'Delegate', 1, ''), ('None', 'Eliminate', 4, '')]
def prio_bars():
    mx = 4
    rows = []
    for name, q, v, fc in prio:
        f = ic('flag', fc) if fc else '<span class="noflag"></span>'
        rows.append(f'<div class="hb" data-tip="{name} · {q}: {v} open"><span class="hbl">{f}{name}<span class="t-meta">{q}</span></span>'
                    f'<span class="hbt"><i style="width:{v/mx*100:.0f}%"></i></span><span class="hbv">{v}</span></div>')
    return ''.join(rows)

# ---------- routine heatmap (12 weeks x 7 days) ----------
random.seed(7)
def heat():
    cols = []
    for wk in range(12):
        cells = []
        for d in range(7):
            idx = wk * 7 + d
            today = 11 * 7 + 5  # Sat of the last week
            if idx > today:
                cells.append('<i class="fut"></i>'); continue
            if d == 6 and wk in (3,):
                cells.append('<i class="pause" data-tip="Paused"></i>'); continue
            r = random.random()
            v = 1.0 if r < .62 else .5 if r < .85 else 0.0
            if idx == today: v = .5
            step = {1.0: 500, .5: 300, 0.0: 100}[v]
            lbl = {1.0: '2 of 2 done', .5: '1 of 2 done', 0.0: '0 of 2 done (missed)'}[v]
            cells.append(f'<i style="background:{BLUE[step]}" data-tip="{weeks[wk][:3]} wk, day {d+1}: {lbl}"{" class=today" if idx == today else ""}></i>')
        cols.append(f'<div class="hc">{"".join(cells)}</div>')
    days = ''.join(f'<span>{d}</span>' for d in 'MTWTFSS')
    legend = (f'<div class="hlegend"><span class="t-meta">Missed</span><i style="background:{BLUE[100]}"></i><i style="background:{BLUE[300]}"></i>'
              f'<i style="background:{BLUE[500]}"></i><span class="t-meta">All done</span><span class="sp"></span><i class="pause"></i><span class="t-meta">Paused</span></div>')
    return f'<div class="heat"><div class="hd">{days}</div>{"".join(cols)}</div>{legend}'

# ---------- projects table ----------
def ptable():
    rows = [
      ('Resume &amp; portfolio', 'Active', 3, 5, 1, 'Nov 30', ''),
      ('Hackathon prep', 'Active', 1, 4, 0, 'Nov 20', 'soon'),
      ('Life OS app', 'Active', 8, 20, 0, '—', ''),
      ('Interview prep', 'Done', 6, 6, 0, 'Oct 30', 'done'),
    ]
    body = ''
    for n, st, d, t, od, due, flagc in rows:
        pct = round(100 * d / t)
        odc = f'<span class="od">{od}</span>' if od else '<span class="z">0</span>'
        body += (f'<tr class="{flagc}"><td><span class="pn2">{ic("folder","pi")}{n}</span></td><td><span class="tag neutral">{st}</span></td>'
                 f'<td><div class="pbar"><span class="bar"><i style="width:{pct}%"></i></span><span class="pv">{pct}%</span></div></td>'
                 f'<td class="n">{t-d}</td><td class="n">{d}</td><td class="n">{odc}</td><td class="n">{due}{" <span class=t-meta>in 6 days</span>" if flagc=="soon" else ""}</td></tr>')
    return ('<table class="dt"><thead><tr><th>Project</th><th>Status</th><th style="width:200px">Progress</th>'
            '<th class="n">Open</th><th class="n">Done</th><th class="n">Overdue</th><th class="n">Due</th></tr></thead>'
            f'<tbody>{body}</tbody></table>')

# ---------- metrics table ----------
def state(kind, text):
    icn = {'met': 'met', 'miss': 'miss', 'prog': 'prog'}[kind]
    return f'<span class="st {kind}">{ic(icn)}{text}</span>'

def mtable():
    rows = [
      ('Job applications', '5 per month', '1 / 5', 20, [4,5,2,5,6,3,1], state('prog', 'In progress'), '3 of 6 months met'),
      ('Study hours', '10 h per week', '6 / 10 h', 60, [8,11,10,7,12,10,9,11,6], state('prog', 'In progress'), '5 of 8 weeks met'),
      ('Portfolio pieces', '4 by Dec 31', '2 / 4', 50, [0,0,1,1,1,2,2], state('prog', 'In progress'), 'Needs 2 in 47 days'),
      ('LeetCode solved', '30 by Oct 31', '24 / 30', 80, [3,8,12,15,19,22,24], state('miss', 'Missed'), 'Ended Oct 31'),
    ]
    body = ''.join(
      f'<tr><td><span class="pn2"><span class="mark">{ic("stats")}</span>{n}</span></td><td class="t2">{tg}</td>'
      f'<td><div class="pbar"><span class="bar"><i style="width:{p}%"></i></span><span class="pv">{v}</span></div></td>'
      f'<td>{spark(s, 88, 22)}</td><td>{stt}</td><td class="t3">{h}</td></tr>'
      for n, tg, v, p, s, stt, h in rows)
    return ('<table class="dt"><thead><tr><th>Metric</th><th>Target</th><th style="width:180px">Current period</th><th>Trend</th><th>State</th><th>History</th></tr></thead>'
            f'<tbody>{body}</tbody></table>')

# ---------- next 7 days ----------
def upcoming():
    items = [
      ('Today', 'task', 'Draft the hackathon pitch', 'Hackathon prep', 'med'),
      ('Sun 15', 'event', 'Hackathon weekend ends', '3:00 PM', None),
      ('Sun 15', 'task', 'Submit hackathon registration', 'Hackathon prep', 'high'),
      ('Wed 18', 'task', 'Write week board tests', 'Life OS app', None),
      ('Fri 20', 'event', 'Mock interview with Ana', '2:00 PM', None),
      ('Fri 20', 'task', 'Prepare mock interview answers', 'Due', None),
    ]
    out = ''
    for d, k, t, m, p in items:
        mk = f'<span class="ev-icon">{ic("cal")}</span>' if k == 'event' else '<span class="check"></span>'
        f = ic('flag', 'flag-high' if p == 'high' else 'flag-med') if p else ''
        out += f'<div class="urow"><span class="ud{" now" if d=="Today" else ""}">{d}</span>{mk}<span class="lt">{t}</span><span class="t-meta um">{f}{m}</span></div>'
    return out

def card(title, sub, body, right='', cls=''):
    return (f'<section class="scard {cls}"><header class="shead"><div><span class="stitle">{title}</span>'
            f'{f"<span class=ssub>{sub}</span>" if sub else ""}</div><div class="sact">{right}<span class="icon-btn" title="Show as table">{ic("table")}</span></div></header>'
            f'<div class="sbody">{body}</div></section>')

CSS = '''
.side{border-right:0}
.item.add{color:var(--text-tertiary)}
.areahead{display:flex;align-items:flex-start;gap:16px;padding:24px 24px 0}
.areahead .ttl{display:flex;align-items:center;gap:10px;height:32px}
.areahead .ttl .dot{width:12px;height:12px;border-radius:3px}
.vision{margin-top:0;padding-left:22px;max-width:760px}
.areahead .acts{margin-left:auto;display:flex;gap:8px;align-items:center}
.scroll{flex:1;min-height:0;overflow:auto;padding:16px 24px 24px;display:flex;flex-direction:column;gap:16px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.tile{border:1px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:4px;background:#fff}
.tl{font-size:12px;line-height:16px;color:var(--text-tertiary);font-weight:500}
.tv{display:flex;align-items:baseline;gap:4px;height:32px}
.num{font-size:24px;line-height:32px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums}
.unit{font-size:13px;color:var(--text-tertiary);font-weight:500}
.tv .spark{margin-left:auto;align-self:center}
.td{display:flex;align-items:center;gap:6px;font-size:12px;line-height:16px}
.delta{display:inline-flex;align-items:center;gap:2px;font-weight:500;color:var(--text-secondary)}
.delta svg{width:12px;height:12px}
.delta.good{color:#296c29}.delta.bad{color:var(--danger)}
.row2{display:grid;grid-template-columns:2fr 1fr;gap:16px}
.scard{background:#fff;border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;min-width:0}
.shead{min-height:48px;display:flex;align-items:flex-start;gap:8px;padding:12px 8px 4px 16px}
.shead>div:first-child{display:flex;flex-direction:column}
.stitle{font-size:16px;line-height:24px;font-weight:600}
.ssub{font-size:12px;line-height:16px;color:var(--text-tertiary)}
.sact{margin-left:auto;display:flex;align-items:center;gap:8px}
.sact .icon-btn{margin:0}
.sbody{padding:8px 16px 16px;position:relative}
.chart{width:100%;height:auto;display:block;overflow:visible;stroke:none}
svg.spark{width:auto;height:auto;stroke:none;flex:none}
.ax{font-size:11px;fill:#6b7280;font-family:Inter,sans-serif}
.vl{font-size:12px;font-weight:600;fill:#111827;font-family:Inter,sans-serif}
.hit{cursor:default}.hit:hover{opacity:.85}
.legend{display:flex;gap:12px;align-items:center;font-size:12px;color:var(--text-secondary)}
.legend i{width:10px;height:10px;border-radius:2px;display:inline-block;margin-right:4px;vertical-align:-1px}
/* horizontal bars */
.hb{display:grid;grid-template-columns:150px 1fr 24px;align-items:center;gap:12px;height:36px}
.hbl{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--text-primary)}
.hbl svg{width:14px;height:14px}
.hbl .t-meta{font-weight:400}
.noflag{width:14px}
.hbt{height:12px;background:transparent;display:block}
.hbt i{display:block;height:100%;background:var(--a-solid);border-radius:0 4px 4px 0}
.hbv{font-size:12px;font-weight:600;color:var(--text-primary);text-align:right;font-variant-numeric:tabular-nums}
/* heatmap */
.heat{display:flex;gap:4px}
.hd{display:flex;flex-direction:column;gap:4px;margin-right:4px}
.hd span{height:16px;font-size:11px;line-height:16px;color:var(--text-tertiary);width:10px}
.hc{display:flex;flex-direction:column;gap:4px;flex:1}
.hc i{height:16px;border-radius:3px;display:block}
.hc i.fut{background:transparent;border:1px dashed transparent}
i.pause{background:repeating-linear-gradient(135deg,#e5e7eb 0 2px,#fff 2px 5px);border-radius:3px;height:16px;display:block}
.hc i.today{box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--n900)}
.hlegend{display:flex;align-items:center;gap:4px;margin-top:12px}
.hlegend i{width:14px;height:14px;border-radius:3px;display:inline-block}
.hlegend .sp{flex:1}
.hlegend i.pause{width:14px;height:14px}
/* tables */
.dt{width:100%;border-collapse:collapse;font-size:13px}
.dt th{font-size:12px;line-height:16px;font-weight:500;color:var(--text-tertiary);text-align:left;padding:0 8px 8px;border-bottom:1px solid var(--border);white-space:nowrap}
.dt td{height:40px;padding:0 8px;border-bottom:1px solid #f0f1f3;color:var(--text-primary);white-space:nowrap}
.dt tr:last-child td{border-bottom:0}
.dt tbody tr:hover td{background:var(--n50)}
.dt .n{text-align:right;font-variant-numeric:tabular-nums}
.dt .t2{color:var(--text-secondary)}.dt .t3{color:var(--text-tertiary);font-size:12px}
.dt tr.done td{color:var(--text-tertiary)}
.pn2{display:inline-flex;align-items:center;gap:8px;font-weight:500}
.pn2 .pi{color:var(--a-solid)}
.pn2 .mark{margin:0}
.pbar{display:flex;align-items:center;gap:8px}
.pbar .bar{flex:1;height:6px;background:var(--a-tint)}
.pv{font-size:12px;font-weight:500;color:var(--text-secondary);min-width:44px;text-align:right;font-variant-numeric:tabular-nums}
.od{color:var(--danger);font-weight:600}
.z{color:var(--text-disabled)}
.st{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500}
.st svg{width:14px;height:14px}
.st.met{color:#296c29}.st.miss{color:var(--danger)}.st.prog{color:var(--text-secondary)}
/* upcoming */
.urow{display:flex;align-items:center;gap:8px;height:36px;padding:0 8px;margin:0 -8px;border-radius:var(--r-control)}
.urow:hover{background:var(--n100)}
.ud{width:52px;flex:none;font-size:12px;color:var(--text-tertiary);font-weight:500}
.ud.now{color:var(--acc700);font-weight:600}
.urow .check,.urow .ev-icon{margin:0}
.urow .lt{font-size:13px;line-height:18px;font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.um{display:flex;align-items:center;gap:4px;flex:none}
.um svg{width:12px;height:12px}
/* tooltip */
#tip{position:fixed;pointer-events:none;background:#111827;color:#fff;font-size:12px;line-height:16px;padding:4px 8px;border-radius:6px;display:none;z-index:50;white-space:nowrap}
.seg.sm{height:28px}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Career (data view)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{sidebar}</aside>
  <main class="main career">
    <div class="areahead">
      <div>
        <div class="ttl"><span class="dot"></span><h1 class="t-page">Career</h1></div>
        <p class="t-body vision">Build a steady career in AI engineering, and keep learning something new every week.</p>
      </div>
      <div class="acts">
        <div class="seg"><span>7 days</span><span class="on">30 days</span><span>90 days</span><span>Year</span></div>
        <button class="btn">{ic('board')}Open board</button>
        <button class="btn icon" title="Edit, archive or delete">{ic('more')}</button>
        <button class="btn primary">{ic('plus')}New{ic('chev')}</button>
      </div>
    </div>
    <div class="scroll">
      <div class="kpis">{tiles}</div>
      <div class="row2">
        {card('Tasks completed per week', 'Last 12 weeks · this week so far is hatched', bars())}
        {card('Open tasks by priority', '9 open', prio_bars())}
      </div>
      <div class="row2">
        {card('Projects', '3 active · 1 done', ptable())}
        {card('Routine steps', 'Steps in this area, last 12 weeks', heat())}
      </div>
      <div class="row2">
        {card('Metrics and targets', '4 metrics', mtable())}
        {card('Next 7 days', '6 items', upcoming())}
      </div>
    </div>
  </main>
</div>
<div id="tip"></div>
<script>
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{{const t=e.target.closest('[data-tip]');
  if(!t){{tip.style.display='none';return}}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';}});
</script>
</body></html>'''
Path('/mnt/user-data/outputs/life-os-mock-area.html').write_text(html)
print('ok', len(html))
