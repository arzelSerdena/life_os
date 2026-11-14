"""Life areas overview v2: compare areas (effort split, scorecard, small-multiple trends)."""
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_overview as ov  # noqa: E402 (reuses sidebar + CSS)
a4, bw, a2, ic = ov.a4, ov.bw, ov.a2, ov.ic
bw.I.update({
  'ok': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'warn': '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  'moon': '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
})
SOLID = {'career': '#3579c2', 'finance': '#11bbb3', 'health': '#ca6a93', 'personal': '#b181b4', 'relation': '#cba927', 'home': '#cc6b43'}

# key, name, completed, prev share %, open, overdue, on time, routine %, projects, metrics (on, total), last activity, weekly done
ROWS = [
  ('career', 'Career', 46, 31, 9, 1, 78, 86, 3, (1, 3), 'Today', [3,5,4,6,2,5,7,6,4,8,5,7]),
  ('health', 'Health &amp; Beauty', 31, 26, 6, 1, 70, 79, 1, (1, 2), 'Today', [4,3,3,2,3,2,3,2,2,3,2,2]),
  ('finance', 'Finance', 18, 13, 4, 0, 92, 95, 1, (1, 1), 'Yesterday', [1,1,2,2,2,1,2,1,2,1,2,1]),
  ('home', 'Home', 16, 15, 5, 2, 64, 71, 1, (0, 1), '2 days ago', [2,2,1,2,1,1,2,1,1,1,1,1]),
  ('personal', 'Personal', 12, 9, 3, 0, 88, 90, 1, (0, 1), 'Yesterday', [1,1,0,1,1,2,1,1,1,1,1,1]),
  ('relation', 'Relationships', 9, 6, 2, 0, 100, None, 0, (0, 0), '6 days ago', [1,0,1,1,0,1,1,0,1,1,1,1]),
]
TOTAL = sum(r[2] for r in ROWS)

def status(r):
    k, name, done, prev, open_, od, ontime, rt, pj, (mo, mt), last, wk = r
    if last.endswith('days ago') and int(last.split()[0]) >= 5:
        return '<span class="stt quiet">' + ic('moon') + 'Quiet</span>', f'No activity for {last.split()[0]} days'
    if od or ontime < 75:
        why = []
        if od: why.append(f'{od} overdue')
        if ontime < 75: why.append(f'{ontime}% on time')
        return '<span class="stt warn">' + ic('warn') + 'Needs attention</span>', ' · '.join(why)
    return '<span class="stt ok">' + ic('ok') + 'On track</span>', ''

# ---------- effort split ----------
def effort():
    segs, legend = '', ''
    for r in ROWS:
        k, name, done = r[0], r[1], r[2]
        share = done / TOTAL * 100
        segs += (f'<div class="es" style="flex:{done};background:{SOLID[k]}" data-tip="{name}: {done} tasks completed ({share:.0f}%)">'
                 + (f'<span{" class=dk" if k in ("finance", "relation") else ""}>{share:.0f}%</span>' if share >= 6 else '') + '</div>')
        delta = round(share - r[3] * 100 / sum(x[3] for x in ROWS))
        d = f'<span class="t-meta">{("+" if delta > 0 else "")}{delta} pt{"s" if abs(delta) != 1 else ""} vs Q3</span>' if delta else '<span class="t-meta">same as Q3</span>'
        legend += (f'<div class="el"><span class="dot" style="background:{SOLID[k]}"></span><span class="eln">{name}</span>'
                   f'<span class="elv">{done}</span>{d}</div>')
    return (f'<div class="ebar">{segs}</div><div class="elegend">{legend}</div>')

# ---------- scorecard ----------
def scorecard():
    head = ('<tr><th>Area</th><th>Status</th><th class="n">Open</th><th class="n">Completed</th><th class="n">On time</th>'
            '<th class="n">Routine steps</th><th class="n">Projects</th><th class="n">Targets met</th><th class="n">Last activity</th><th></th></tr>')
    body = ''
    mx = max(r[2] for r in ROWS)
    for r in ROWS:
        k, name, done, prev, open_, od, ontime, rt, pj, (mo, mt), last, wk = r
        st, why = status(r)
        odc = ''
        rts = f'{rt}%' if rt is not None else '<span class="z">—</span>'
        tg = f'{mo} / {mt}' if mt else '<span class="z">—</span>'
        pjs = str(pj) if pj else '<span class="z">0</span>'
        body += (f'<tr class="{k}"><td><span class="arn"><span class="dot"></span>{name}</span></td>'
                 f'<td>{st}{f"<span class=why>{why}</span>" if why else ""}</td>'
                 f'<td class="n">{open_}{odc}</td>'
                 f'<td class="n"><span class="cbar"><i style="width:{done/mx*100:.0f}%"></i></span>{done}</td>'
                 f'<td class="n">{ontime}%</td><td class="n">{rts}</td><td class="n">{pjs}</td><td class="n">{tg}</td>'
                 f'<td class="n t3">{last}</td><td class="go">{ic("right")}</td></tr>')
    return f'<table class="dt sc"><thead>{head}</thead><tbody>{body}</tbody></table>'

# ---------- small multiples: completed per week, same scale ----------
def multiples():
    ymax = max(max(r[11][-7:]) for r in ROWS)
    out = ''
    for r in ROWS:
        k, name, done, wk = r[0], r[1], r[2], r[11][-7:]
        bars = ''.join(f'<i style="height:{v/ymax*100:.0f}%" data-tip="{name}, week {i+1}: {v} done"></i>' for i, v in enumerate(wk))
        out += (f'<div class="sm {k}"><div class="smh"><span class="dot"></span><span class="smn">{name}</span>'
                f'<span class="smv">{done}</span></div><div class="smc">{bars}</div>'
                f'<div class="smx t-meta"><span>Oct 5</span><span>Nov 9</span></div></div>')
    return f'<div class="smgrid">{out}</div>'

CSS = '''
.wide{display:flex;flex-direction:column;gap:16px}
/* effort split */
.ebar{display:flex;gap:2px;height:28px;border-radius:6px;overflow:hidden}
.es{display:flex;align-items:center;padding:0 8px;min-width:0;cursor:default}
.es:first-child{border-radius:6px 0 0 6px}.es:last-child{border-radius:0 6px 6px 0}
.es span{font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.es span.dk{color:#111827}
.elegend{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:12px}
.el{display:grid;grid-template-columns:10px 1fr auto;column-gap:8px;row-gap:0;align-items:center}
.el .dot{width:10px;height:10px;border-radius:2px}
.eln{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.elv{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.el .t-meta{grid-column:2 / 4}
/* scorecard */
.sc td{height:52px}
.arn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14px}
.arn .dot{width:10px;height:10px;border-radius:2px}
.stt{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--text-primary)}
.stt svg{width:14px;height:14px}
.stt.ok svg{color:#328f32}.stt.warn svg{color:#c9510c}.stt.quiet svg{color:var(--n500)}
.why{display:block;font-size:11px;color:var(--text-tertiary);margin-left:20px;line-height:14px}
.cbar{display:inline-block;width:64px;height:6px;border-radius:999px;background:var(--a-tint);margin-right:10px;vertical-align:middle;overflow:hidden}
.cbar i{display:block;height:100%;background:var(--a-solid);border-radius:999px}
.sc .go{width:24px;color:var(--text-tertiary)}
.sc .go svg{width:16px;height:16px;vertical-align:middle}
.sc tbody tr{cursor:pointer}
/* small multiples */
.smgrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}
.smh{display:flex;align-items:center;gap:6px;height:20px}
.smh .dot{width:8px;height:8px}
.smn{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smv{margin-left:auto;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.smc{height:72px;display:flex;align-items:flex-end;gap:2px;margin-top:8px;border-bottom:1px solid var(--border)}
.smc i{flex:1;background:var(--a-solid);border-radius:3px 3px 0 0;min-height:1px}
.smx{display:flex;justify-content:space-between;font-size:11px;margin-top:4px}
'''

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Life areas overview v2</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{bw.V13}{bw.NEW_CSS}{a2.CSS}{a4.CSS}{ov.CSS}{CSS}</style></head>
<body>
<div class="app">
  <nav class="rail" aria-label="Groups"><div class="rail-pill"><div class="logo">L</div>{a2.rail}<div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{bw.SETTINGS}</svg></a></div></nav>
  <aside class="side">{ov.sidebar}</aside>
  <main class="main">
    <div class="areahead">
      <div>
        <div class="ttl" style="padding-left:0"><h1 class="t-page">Life areas</h1></div>
        <p class="t-body vision" style="padding-left:0">How your areas compare this quarter.</p>
      </div>
      <div class="acts">
        <div class="seg"><span>Week</span><span>Month</span><span class="on">Quarter</span><span>Year</span></div>
        <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">Q4 2026</span><span class="icon-btn">{ic('right')}</span></div>
        <button class="btn icon" title="More">{ic('more')}</button>
        <div class="split-btn accent"><button class="sb-main">{ic('plus')}New area</button></div>
      </div>
    </div>
    <div class="scroll wide">
      {a2.card('Where your effort went', f'{TOTAL} tasks completed in Q4, split by area', effort())}
      {a2.card('Scorecard', 'One row per area · click a row to open the area', scorecard())}
      {a2.card('Completed per week', 'Each week of Q4 so far · same scale for every area', multiples())}
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
                    f'<span class="icon-btn cmenu" title="Sort, filter and view">{ic("sliders")}</span>')
Path('/mnt/user-data/outputs/life-os-mock-areas-overview.html').write_text(html)
print('ok', len(html))
