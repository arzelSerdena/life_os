"""Life areas overview with all mock states: normal, no areas, areas with no data, New area pop-up,
⋯ menu, card menu, Outcomes as a table, a collapsed area group, Reorder areas pop-up."""
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_empty as be  # noqa: E402  (also builds o3, the approved overview)
o3 = be.o3
a4, a2, bw, ic, ov, o2 = o3.a4, o3.a2, o3.bw, o3.ic, o3.ov, o3.o2
bw.I.update({
  'grip': '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  'sort': '<path d="M3 6h13M3 12h9M3 18h5M17 8V20M14 17l3 3 3-3"/>',
  'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'download': '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  'chart': '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
})

normal = Path('/mnt/user-data/outputs/life-os-mock-areas-overview.html').read_text()
head_css = normal[normal.index('<style>') + 7: normal.index('</style>')]
body = normal[normal.index('<body>') + 6: normal.index('<div id="tip">')]
body = body.replace('<div class="app">', '<div class="app st-normal">', 1)

# card menu inside the Outcomes card header
i = body.index('<span class="stitle">Outcomes</span>')
j = body.index('<span class="icon-btn cmenu"', i)
k = body.index('</span>', body.index('</svg>', j)) + 7
card_menu = f'''<div class="pmenu2 cardmenu">
  <div class="mh t-label">Sort by</div>
  <div class="mi on">Area order{ic('check')}</div><div class="mi">Behind first</div><div class="mi">Name</div>
  <div class="msep"></div><div class="mh t-label">Show</div>
  <div class="mi"><span class="mini-check on">{ic('check')}</span>On track or met</div>
  <div class="mi"><span class="mini-check on">{ic('check')}</span>Behind</div>
  <div class="mi"><span class="mini-check on">{ic('check')}</span>Without a target</div>
  <div class="msep"></div><div class="mh t-label">Areas</div>
  {''.join(f'<div class="mi"><span class="mini-check{" on" if k != "home" else ""}">{ic("check") if k != "home" else ""}</span><span class="mdot {k}"><span class="dot"></span></span>{n}</div>' for k, n in [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'), ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')])}
  <div class="msep"></div>
  <div class="mi"><span class="mini-check on">{ic('check')}</span>Group by area</div></div>'''
body = body[:k] + card_menu + body[k:]

# Outcomes as a table: shown instead of the tile groups in the table state
rows = [
  ('career', 'Career', 'Job applications', '1', '5 per month', 'Behind', 'neg', 'Oct met · 16 days left'),
  ('career', 'Career', 'Study hours', '6 h', '10 h per week', 'Behind', 'neg', '3 of 6 weeks met'),
  ('finance', 'Finance', 'Savings', '₱10,500', '₱30,000 by Dec 31', 'Behind', 'neg', 'Needs ₱19,500 more in 47 days'),
  ('finance', 'Finance', 'Monthly spending', '₱6,500', 'Under ₱15,000 per month', 'On track', 'pos', 'Oct stayed under'),
  ('health', 'Health &amp; Beauty', 'Distance run', '17 km', '20 km per week', 'On track', 'pos', '4 of 6 weeks met'),
  ('health', 'Health &amp; Beauty', 'Sleep', '7.2 h', '7 h average per week', 'On track', 'pos', '3 of 6 weeks met'),
  ('health', 'Health &amp; Beauty', 'Body weight', '72.5 kg', '70 kg by Mar 1', 'On track', 'pos', 'Ahead of pace'),
  ('personal', 'Personal', 'Books read', '1', '12 by Dec 31', 'Behind', 'neg', 'Needs 11 more in 47 days'),
  ('relation', 'Relationships', 'Calls with family', '2', '2 per week', 'Met', 'pos', '4 of 6 weeks met'),
  ('home', 'Home', 'Electricity use', '182 kWh', 'No target', 'Improving', 'pos', 'Down from October'),
]
tb = ''.join(f'<tr class="{k}"><td><span class="arn2"><span class="dot"></span>{a}</span></td><td class="mn">{n}</td><td class="n">{v}</td>'
             f'<td>{t}</td><td><span class="st2 {c}">{s}</span></td><td class="t3">{h}</td></tr>' for k, a, n, v, t, s, c, h in rows)
table = ('<table class="dt otable"><thead><tr><th>Area</th><th>Metric</th><th class="n">Current</th><th>Target</th><th>Status</th><th>Note</th></tr></thead>'
         f'<tbody>{tb}</tbody></table>')
og = body.index('<div class="ogrid">')


# ⋯ menu in the header
more_menu = f'''<div class="pmenu moremenu2">
  <div class="mi">{ic('sort')}Reorder areas</div>
  <div class="mi">{ic('archive')}Archived areas</div>
  <div class="msep"></div>
  <div class="mi">{ic('download')}Export as CSV</div></div>'''

# reorder pop-up
areas = [('career', 'Career'), ('finance', 'Finance'), ('health', 'Health &amp; Beauty'), ('personal', 'Personal'), ('relation', 'Relationships'), ('home', 'Home')]
ritems = ''.join(f'<div class="ro {k}{" lifted" if k == "health" else ""}"><span class="rg2">{ic("grip")}</span><span class="dot"></span>{n}</div>' for k, n in areas)
reorder = (f'<div class="pop2 s-reorder"><div class="scrim3"></div><div class="modal3" style="width:360px" role="dialog" aria-label="Reorder areas">'
           f'<div class="m-head"><h3>Reorder areas</h3><span class="icon-btn" style="margin:0">{ic("x")}</span></div>'
           f'<div class="m-body"><p class="t-meta">Drag to change the order. It is used in the sidebar and on every overview.</p><div class="rlist">{ritems}</div></div>'
           f'<div class="m-foot"><button class="btn">Cancel</button><button class="btn primary">Save order</button></div></div></div>')

# empty states and New area pop-up from the approved empty-states mock
none_app = be.page('st-none', be.sidebar([]), True, be.first_run)
nodata_app = be.page('st-nodata', be.sidebar([('career', 'Career'), ('finance', 'Finance')]), False, be.no_data)
new_area = be.modal.replace('class="scrim2"', 'class="scrim2 na"').replace('class="modal2"', 'class="modal2 na"')

CSS = '''
.st-normal,.st-none,.st-nodata{display:none}
body.s-normal .st-normal,body.s-more .st-normal,body.s-card .st-normal,body.s-table .st-normal,body.s-collapse .st-normal,body.s-reorder .st-normal{display:flex}
body.s-none .st-none,body.s-newarea .st-none{display:flex}
body.s-nodata .st-nodata{display:flex}
.st-none .scroll{display:flex}
.scrim2.na,.modal2.na{display:none}
body.s-newarea .scrim2.na{display:block}body.s-newarea .modal2.na{display:flex}
.pop2,.pmenu,.pmenu2{display:none}
body.s-reorder .pop2.s-reorder{display:block}
body.s-more .moremenu2,body.s-card .cardmenu{display:block}
.scrim3{position:fixed;inset:0;background:rgba(17,24,39,.32);z-index:30}
.modal3{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;z-index:31;display:flex;flex-direction:column;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.pmenu,.pmenu2{background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:25;width:220px;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.pmenu{position:fixed;right:142px;top:62px}
.pmenu2{position:absolute;right:0;top:32px}
.pmenu .mi>svg,.pmenu2 .tview>svg{width:16px;height:16px;color:var(--text-tertiary);margin-left:0}
body.s-card .cmenu,body.s-more .st-normal .acts .btn.icon{background:var(--n100)}
/* table state */
.otable-wrap{display:none}
body.s-table .otable-wrap{display:block}
body.s-table .st-normal .ogrid,body.s-table .st-normal .mleg{display:none}
.otable td{height:40px}
.arn2{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500}
.arn2 .dot{width:8px;height:8px;border-radius:2px}
.otable .mn{font-weight:500}
.st2{font-size:12px;font-weight:600}.st2.pos{color:#296c29}.st2.neg{color:var(--danger)}
.back{margin-top:8px;margin-left:-8px}
/* card menu checkboxes use the accent */
.pmenu2 .mini-check.on{background:#8f74b3;border-color:#8f74b3}
/* info icons */
.sttl{display:flex;align-items:center;gap:6px;flex-direction:row !important}
.info{display:inline-grid;place-items:center;width:16px;height:16px;color:var(--text-tertiary);cursor:help;margin-left:4px;vertical-align:-2px}
.info svg{width:14px;height:14px}
.info:hover{color:var(--text-secondary)}
.ttl .info{margin-left:2px}
.fl2 .info{width:14px;height:14px}.fl2 .info svg{width:12px;height:12px}
#tip{white-space:normal !important;max-width:300px;line-height:16px}
.shead{min-height:44px;align-items:center;padding-top:8px;padding-bottom:4px}
.scard>.sbody{padding-top:4px}
.mdot{display:inline-flex}.mdot .dot{width:8px;height:8px}
.pmenu2{max-height:560px;overflow:auto}
/* group headers (no collapse) */
.mg-n{white-space:nowrap}
.mg-h{padding-left:4px}
/* collapsed group */
body.s-collapse .mgroup.health .mt{display:none}
body.s-collapse .mgroup.health{grid-column:span 1 !important}
body.s-collapse .mgroup.health .mg-h>svg{transform:rotate(-90deg);opacity:1}
body.s-collapse .mgroup.health .mg-h{background:#e9ebef}
/* reorder */
.rlist{display:flex;flex-direction:column;gap:4px}
.ro{height:36px;display:flex;align-items:center;gap:10px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-weight:500;background:#fff}
.ro .dot{width:8px;height:8px;border-radius:2px}
.rg2{color:var(--text-tertiary);display:grid;cursor:grab}.rg2 svg{width:16px;height:16px}
.ro.lifted{box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);transform:rotate(-1deg);border-color:var(--n300)}
'''

states = [('s-normal', 'Normal'), ('s-none', 'No areas'), ('s-nodata', 'Areas, no data'), ('s-newarea', 'New area'),
          ('s-more', '⋯ menu'), ('s-reorder', 'Reorder areas'), ('s-card', 'Card menu')]
switch = ('<div class="states"><span>Mock state</span><div class="seg" id="st">'
          + ''.join(f'<span{" class=on" if i == 0 else ""} data-s="{k}">{n}</span>' for i, (k, n) in enumerate(states)) + '</div></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Areas · Life areas overview, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{head_css}{be.CSS.replace('.st-a,.st-b{display:none}', '')}{CSS}</style></head>
<body class="s-normal">
{body}
{none_app}
{nodata_app}
{new_area}{more_menu}{reorder}
{switch}
<div id="tip"></div>
<script>
const st=document.getElementById('st');
st.onclick=e=>{{const s=e.target.dataset.s;if(!s)return;document.body.className=s;
  st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===e.target));}};
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{{const t=e.target.closest('[data-tip]');
  if(!t||!t.dataset.tip){{tip.style.display='none';return}}
  tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-28)+'px';}});
</script>
</body></html>'''
html = html.replace('title="Sort, filter and view as table"', 'title="Sort and filter"').replace('title="Sort, filter and view"', 'title="Sort and filter"')
html = html.replace('body.s-modal .scrim2{display:block}body.s-modal .modal2{display:flex}', '')

# ---------- guide text moves into hover info icons; groups no longer collapse ----------
import re as _re
INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
def info(text):
    return f'<span class="info" data-tip="{text}">{INFO}</span>'
EXTRA = {
    'Outcomes': ' Green line: on track, met or improving. Red line: behind. Hollow dot: the current period so far. Grey line: the target. Diamond: a deadline.',
    'Projects': ' The bar is the share of tasks done in the area\'s active projects; the black mark is how much of their time has passed.',
    'Routine steps done': ' Darker squares mean more of the due steps were done; the outlined square is this week and empty squares are weeks still to come.',
}
DATA = {  # subtitle -> data-only subtitle ('' = none)
    'Progress of active projects in each area, against their pace': '7 active projects in 5 areas · 1 ahead of pace, 3 behind, 1 on pace',
    "One square per week: the share of the area's due routine steps you completed": '84% of due steps done in Q4',
    'Targets met and projects finished in Q4': '5 in Q4',
    'Where your completed tasks went in Q4': 'No tasks completed in Q4 yet',
    'Metrics owned by your areas': 'No metrics yet',
    'Progress of active projects in each area': 'No active projects',
    'One square per week': 'No routine steps',
}
def _card_info(m):
    title, sub = m.group(1), m.group(2)
    sub = DATA.get(sub, sub)
    sub_html = f'<span class=ssub>{sub}</span>' if sub else ''
    return f'<span class="stitle">{title}</span>{sub_html}'
html = _re.sub(r'<span class="stitle">([^<]+)</span></div>', r'<span class="stitle">\1</span></div>', html)
html = _re.sub(r'<div><span class="stitle">([^<]+)</span><span class=ssub>([^<]+)</span></div>',
               lambda m: f'<div>{_card_info(m)}</div>', html)
html = _re.sub(r'<div class="mleg">.*?</div>(?=</div></section>)', '', html, flags=_re.S)
html = _re.sub(r'<div class="t-meta" style="margin-top:8px">Bar: share.*?</div>', '', html, flags=_re.S)
html = _re.sub(r'<div class="rgleg t-meta">.*?</span></div>', '', html, flags=_re.S)
# page header: the subtitle becomes an info icon beside the title
html = html.replace('<h1 class="t-page">Life areas</h1></div>\n      <p class="t-body vision" style="padding-left:0">Are your areas moving toward what you set for them?</p>',
                    '<h1 class="t-page">Life areas</h1></div>')
html = html.replace('<h1 class="t-page">Life areas</h1></div>\n        <p class="t-body vision" style="padding-left:0">Are your areas moving toward what you set for them?</p>',
                    '<h1 class="t-page">Life areas</h1></div>')
html = html.replace('<p class="t-body vision" style="padding-left:0">Are your areas moving toward what you set for them?</p>', '')
# form hints become info icons on their labels
html = _re.sub(r'<span class="hint2 t-meta">[^<]*</span>', '', html)
# group headers: no chevron, no collapse
html = _re.sub(r'(<div class="mg-h">)<svg viewBox="0 0 24 24">.*?</svg>', r'\1', html)
_i = html.rfind('<span class=ssub>5 in Q4</span>')
html = html[:_i] + '<span class=ssub>None in Q4 yet</span>' + html[_i + len('<span class=ssub>5 in Q4</span>'):]
import rules as _rules
html = _rules.apply(html)
Path('/mnt/user-data/outputs/life-os-mock-areas-overview-states.html').write_text(html)
print('ok', len(html))
