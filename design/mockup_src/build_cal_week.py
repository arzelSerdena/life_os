"""Build html_mockups/draft-week.html: the Calendar Week view (Phase B, redone Nov 15).

A real calendar week with no time axis: seven day cells side by side, all-day and multi-day events as bars
across the top, then each day's entries as compact calendar rows (timed events, routines, project due dates,
tasks). Shares the shell, sidebar, header, data, pickers and panels with build_next7.py (the board that moved
to Tasks › Next 7 days). Today is Sat, Nov 14, 2026; the week is Nov 9 – 15.

Usage: python build_cal_week.py <approved-detail-panel.html> <approved-area.html> <out.html>
"""
import re
import sys

import build_next7 as nb
import build_pickers as bp
import rules

S = bp.svg
I_CAL, I_REP, I_FOLD, I_CHK, I_X, I_PLUS, I_CHEV = nb.I_CAL, nb.I_REP, nb.I_FOLD, nb.I_CHK, nb.I_X, nb.I_PLUS, nb.I_CHEV
DAYS = nb.DAYS
TODAY_I = nb.TODAY_I
WK_START = {'normal': 9, 'empty': 7}


def start_time(c):
    """Start of an event's time range as (minutes, label), e.g. '10:00 – 11:00 AM' -> (600, '10:00 AM')."""
    a, b = c['time'].split(' – ')
    suf = 'AM' if 'AM' in a else 'PM' if 'PM' in a else b.split()[-1]
    hh, mm = a.split()[0].split(':')
    h = int(hh) % 12 + (12 if suf == 'PM' else 0)
    return h * 60 + int(mm), f"{a.split()[0]} {suf}"


def entry(c, day_i):
    if c['t'] == 'event':
        _, st = start_time(c)
        rep = f'<span class="ci">{I_REP}</span>' if c['rep'] else ''
        k = f' k-{c["key"]}' if c['key'] else ''
        return (f'<div class="ent ev {c["area"]}{k}" data-tip="{c["title"]} · {c["time"]}"><span class="tm">{st}</span>'
                f'<span class="nm">{c["title"]}</span>{rep}</div>')
    if c['t'] == 'rout':
        n = sum(1 for s in c['steps'] if s[2] == 'done')
        k = ' k-rout' if day_i == TODAY_I and c['title'] == 'Evening routine' else ''
        return (f'<div class="ent rt{k}">{nb.ring(n / len(c["steps"]) if c["steps"] else 0)}<span class="nm">{c["title"]}</span>'
                f'<span class="ct">{n}/{len(c["steps"])}</span></div>')
    if c['t'] == 'proj':
        return (f'<div class="ent pj {c["area"]}"><span class="pf">{I_FOLD}</span><span class="nm">{c["title"]}</span>'
                f'<span class="ct">Due</span></div>')
    a = c['area'] or 'noarea'
    st = ' done' if c['done'] else (' cancel' if c['cancel'] else '')
    cb = f'<span class="cb">{I_CHK if c["done"] else (I_X if c["cancel"] else "")}</span>'
    fl = nb.icon_flag(c['pri']) if c['pri'] in ('high', 'med') and not (c['done'] or c['cancel']) else ''
    k = f' k-{c["key"]}' if c['key'] else ''
    return f'<div class="ent tk {a}{st}{k}">{cb}<span class="nm">{c["title"]}</span>{fl}</div>'


def order(cards):
    ev = sorted([c for c in cards if c['t'] == 'event'], key=lambda c: start_time(c)[0])
    rt = [c for c in cards if c['t'] == 'rout']
    pj = [c for c in cards if c['t'] == 'proj']
    tk = [c for c in cards if c['t'] == 'task']
    tk = [c for c in tk if not (c['done'] or c['cancel'])] + [c for c in tk if c['done'] or c['cancel']]
    return ev + rt + pj + tk


def week_grid(variant, scope):
    _, days, lane = nb.week(scope, 'cancel' if variant == 'cancel' else ('undo' if variant == 'undo' else 'normal'))
    cur = variant not in ('empty', 'none')
    if not cur:
        days, lane = [[] for _ in range(7)], []
    start = 7 if variant == 'empty' else 9
    out = ''
    for i, (dn, _) in enumerate(DAYS):
        we = ' we' if i >= 5 else ''
        cls = (' pst' if i < TODAY_I else ' tdc' if i == TODAY_I else '') if cur else ''
        out += f'<div class="ccol{we}{cls}{" last" if i == 6 else ""}" style="grid-column:{i + 1};grid-row:1/5"></div>'
        out += (f'<div class="cdh{cls}" style="grid-column:{i + 1};grid-row:1"><span class="cwd">{dn}</span>'
                f'<span class="cdn">{start + i}</span><span class="ad">{I_PLUS}</span></div>')
    rows = len(lane)
    if lane:
        bars = ''
        for r, (t, a, s, e, since, until, tm) in enumerate(lane):
            cut = (' cutl' if since else '') + (' cutr' if until else '')
            extra = f'<span class="lbm">{since}</span>' if since else ''
            extra += f'<span class="lbm">{tm}</span>' if tm else ''
            bars += (f'<div class="cwbar {a}{cut}" style="grid-column:{s + 1}/{e + 2};grid-row:{r + 1}">'
                     f'<span class="lbt">{t}</span>{extra}</div>')
        out += f'<div class="cbars" style="grid-column:1/8;grid-row:2;grid-template-rows:repeat({rows},24px)">{bars}</div>'
    for i in range(7):
        body = ''.join(entry(c, i) for c in order(days[i]))
        if variant == 'drag' and i == TODAY_I:
            body = body.replace('<div class="ent tk career k-pitch">', '<div class="ent tk career k-pitch src">', 1)
        if variant == 'drag' and i == 6:
            body = body.replace('<div class="ent tk career">', '<div class="slot2"></div><div class="ent tk career">', 1)
        out += f'<div class="ccel" style="grid-column:{i + 1};grid-row:3">{body}</div>'
    if variant == 'empty':
        out += '<div class="wempty" style="grid-column:1/8;grid-row:2/5">Nothing planned this week.</div>'
    if variant == 'none':
        out += (f'<div class="wempty" style="grid-column:1/8;grid-row:2/5"><span>No events or tasks yet.</span>'
                f'<button class="btn primary">{I_PLUS}New event</button></div>')
    return f'<div class="cwk"><div class="cwg">{out}</div></div>'


VARIANTS = {'normal': ('all', 'normal', False), 'career': ('career', 'normal', False), 'cancel': ('all', 'cancel', True),
            'empty': ('all', 'empty', False), 'none': ('all', 'none', False), 'drag': ('all', 'drag', False),
            'undo': ('all', 'undo', False)}


def app(rail, key):
    scope, v, dot = VARIANTS[key]
    return (f'<div class="app wv v-{key}">{rail}{nb.sidebar(scope)}<main class="main">{nb.header(v, scope, dot)}'
            f'{week_grid(v, scope)}</main></div>')


def view_menu():
    pr = ''.join(f'<span class="tg on">{(f"<svg class=fl viewBox=\'0 0 24 24\' style=\'color:{nb.PRI[k]}\'>{nb.I_FLAG}</svg>" if k in nb.PRI else "")}{n}</span>'
                 for k, n in [('high', 'High'), ('med', 'Medium'), ('low', 'Low'), ('none', 'None')])
    return ('<div class="lab">Show</div>' + nb.sw('Events') + nb.sw('Tasks') + nb.sw('Routine steps') + nb.sw('Project due dates')
            + nb.sw('Completed') + nb.sw('Cancelled', False)
            + '<div class="sep"></div><div class="lab">Priority</div><div class="tgs">' + pr + '</div>'
            '<div class="sep"></div><div class="lab">Columns</div>' + nb.sw('Weekends'))


def new_event():
    f = rules._fld
    body = (f'<div class="frow2">{f("Name", "<span class=\"inp focus\">Coffee with Mia<span class=\"caret\"></span></span>")}</div>'
            f'<div class="frow2">{f("Owner", rules._sel("<span class=\"tag area relation\"><span class=\"dot\"></span>Relationships</span>"))}</div>'
            f'<div class="frow2">{f("Starts", rules._sel(I_CAL + "Sun, Nov 15"))}{f("&nbsp;", rules._sel(bp.I_CLOCK + "10:00 AM"), w=140)}</div>'
            f'<div class="frow2">{f("Ends", rules._sel(I_CAL + "Sun, Nov 15"))}{f("&nbsp;", rules._sel(bp.I_CLOCK + "11:00 AM"), w=140)}</div>'
            '<div class="frow2" style="align-items:center"><span class="fl2" style="flex:1">All day</span><span class="sw2"></span></div>'
            f'<div class="frow2">{f("Repeat", rules._sel(I_REP + "Does not repeat"))}{f("Location", "<span class=\"inp\"><span style=color:var(--text-disabled)>Add a place</span></span>")}</div>')
    return nb.modal('s-newev', 'New event', body, '<button class="btn">Cancel</button><button class="btn primary">Create event</button>')


def event_panel(html):
    p = re.search(r'<aside class="panel dpanel pnl-event career".*?</aside>', html, flags=re.S).group(0)
    p = p.replace('Mock interview with Ana', 'Study group').replace('Fri, Nov 20 · 2:00 – 3:00 PM', 'Thu, Nov 12 · 7:00 – 9:00 PM')
    p = p.replace('Google Meet', 'Library, room 3')
    p = re.sub(r'<nav class="crumb">.*?</nav>', '<nav class="crumb"><span>Career</span></nav>', p, count=1, flags=re.S)
    p = re.sub(r'<div class="nbody">.*?</div></section>', '<div class="nbody"><h3>This week</h3><ul><li>Graph problems: BFS and DFS</li>'
               '<li>Bring two questions from the mock interview list</li></ul></div></section>', p, count=1, flags=re.S)
    return p


CSS = """
.cwk{flex:1;min-height:0;padding:16px 24px 0;display:flex}
.cwg{flex:1;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:36px auto 1fr 0;border:1px solid var(--border);border-radius:10px;overflow:hidden;position:relative;margin-bottom:24px}
.ccol{border-right:1px solid var(--border)}.ccol.last{border-right:0}
.ccol.we{background:var(--n50)}
.ccol.tdc{background:var(--acc100)}
.cdh{display:flex;align-items:center;gap:6px;padding:0 8px 0 10px;border-bottom:1px solid var(--border);position:relative;z-index:1}
.cdh .cwd{font-size:12px;font-weight:500;color:var(--text-tertiary)}
.cdh .cdn{font-size:14px;font-weight:600;color:var(--text-primary);min-width:22px;height:22px;display:grid;place-items:center;border-radius:6px}
.cdh.pst .cdn{color:var(--text-tertiary)}
.cdh.tdc .cwd{color:var(--acc700)}.cdh.tdc .cdn{background:var(--acc600);color:#fff;padding:0 4px}
.cdh .ad{margin-left:auto;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--text-secondary);opacity:0}
.cdh:hover .ad{opacity:1}.cdh .ad svg{width:15px;height:15px}
.cbars{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));row-gap:3px;padding:6px 0 2px;position:relative;z-index:1}
.cwbar{margin:0 6px;height:24px;border-radius:5px;background:var(--a-tint);color:var(--a-ink);display:flex;align-items:center;gap:6px;padding:0 8px;
  font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;box-shadow:inset 3px 0 0 var(--a-solid);cursor:pointer}
.cwbar .lbm{font-weight:400;color:var(--a-text);font-size:11px}
.cwbar.cutl{margin-left:0;border-top-left-radius:0;border-bottom-left-radius:0;box-shadow:none}
.cwbar.relation{background:#f6eea6}
.ccel{display:flex;flex-direction:column;gap:3px;padding:6px 6px 12px;min-width:0;overflow-y:auto;position:relative;z-index:1}
.ent{height:24px;display:flex;align-items:center;gap:6px;padding:0 6px;border-radius:5px;font-size:12px;line-height:16px;color:var(--text-primary);min-width:0;cursor:pointer;flex:none}
.ent:hover{background:rgba(17,24,39,.05)}
.ent .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.ent svg{width:13px;height:13px;flex:none}
.ent.ev{background:var(--a-tint);color:var(--a-ink);box-shadow:inset 3px 0 0 var(--a-solid);padding-left:9px}
.ent.ev.relation{background:#f6eea6}
.ent.ev .tm{font-size:11px;color:var(--a-text);flex:none}
.ent.ev .ci{display:grid;color:var(--a-text)}.ent.ev .ci svg{width:11px;height:11px}
.ent.rt .rring{width:14px;height:14px}.ent.rt{background:#fff;border:1px solid var(--border)}
.ent .ct{font-size:11px;color:var(--text-tertiary);flex:none}
.ent.pj .pf{display:grid;color:var(--a-solid)}.ent.pj{border:1px dashed var(--a-border);background:#fff}
.ent.tk .cb{width:13px;height:13px;border:1.5px solid var(--a-solid);border-radius:3px;flex:none;display:grid;place-items:center;color:#fff}
.ent.tk.noarea .cb{border-color:var(--n400)}
.ent.tk .cb svg{width:9px;height:9px;stroke-width:3}
.ent.tk .fl{width:12px;height:12px}
.ent.tk.done .cb{background:var(--a-solid)}.ent.tk.noarea.done .cb{background:var(--n400)}
.ent.tk.cancel .cb{border-color:var(--n400);color:var(--n500)}
.ent.done .nm,.ent.cancel .nm{text-decoration:line-through;color:var(--text-tertiary);font-weight:400}
.ccol.pst+.x{}
.slot2{height:24px;border:1.5px dashed var(--acc500);border-radius:5px;flex:none}
.ent.src{opacity:.35}
.ghost2{display:none;position:fixed;z-index:30;width:200px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08),0 14px 28px rgba(0,0,0,.14);transform:rotate(2deg);cursor:grabbing}
body.s-drag .ghost2{display:flex}
.sw2{width:28px;height:16px;border-radius:8px;background:var(--n300);position:relative}
.sw2::after{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#fff}
.pop2.s-newev{display:none}body.s-newev .pop2.s-newev{display:block}
body.p-event .pnl-event{display:flex}
body.p-task .cwk,body.p-event .cwk{padding-right:424px}
body.p-task .ent.k-ut,body.p-event .ent.k-study,body.k-rp .ent.k-rout{box-shadow:0 0 0 2px var(--acc500)}
body.p-event .ent.k-study{box-shadow:inset 3px 0 0 var(--a-solid),0 0 0 2px var(--acc500)}
.pk .rs2{display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;border-radius:6px;font-size:13px}
.pk .rs2 .rb{width:15px;height:15px;border-radius:50%;border:1.5px solid var(--a-solid);display:grid;place-items:center;color:#fff;flex:none}
.pk .rs2 .rb svg{width:10px;height:10px;stroke-width:3}
.pk .rs2.done .rb{background:var(--a-solid)}.pk .rs2.done{color:var(--text-tertiary);text-decoration:line-through}
.pk .rh{display:flex;align-items:center;gap:8px;padding:6px 8px 4px}.pk .rh b{font-size:13px}.pk .rh span{font-size:12px;color:var(--text-tertiary)}
.pk .rh .rring{width:16px;height:16px}
"""

STATES = [('Normal', 's-normal vnormal'), ('Scoped to Career', 's-career vcareer'), ('Cancelled shown', 's-cancel vcancel'),
          ('Empty week', 's-empty vempty'), ('Nothing created yet', 's-none vnone'), ('View menu', 's-view vnormal k-view'),
          ('Add menu', 's-add vnormal k-add'), ('Period picker', 's-per vnormal k-wper'), ('New event', 's-newev vnormal'),
          ('Routine', 's-rp vnormal k-rp'), ('Dragging', 's-drag vdrag'), ('Undo toast', 's-undo vundo'),
          ('Panel: task', 's-pt vnormal p-task'), ('Panel: event', 's-pe vnormal p-event'), ('Series dialog', 's-series vnormal p-event')]
POS = {'view': (1494, 62), 'add': (1756, 62), 'per': (1480, 62), 'ghost': (1688, 256), 'rp': (1452, 252)}


def build(src, area_html):
    html = src
    head = html[:html.find('<body')]
    rail = re.search(r'<nav class="rail".*?</nav>', html, flags=re.S).group(0)
    rail = rail.replace('<a class=on title="Areas">', '<a title="Areas">').replace('<a title="Calendar">', '<a class=on title="Calendar">')
    tp = re.search(r'<aside class="panel dpanel pnl-task career".*?</aside>', html, flags=re.S).group(0)
    apps = ''.join(app(rail, k) for k in VARIANTS)
    pops = bp.pop('k-view', POS['view'][0], POS['view'][1], 280, view_menu())
    pops += bp.pop('k-add', POS['add'][0], POS['add'][1], 140, bp.row('Event', I_CAL)
                   + bp.row('Task', S('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>')))
    pops += bp.pop('k-wper', POS['per'][0], POS['per'][1], 252, bp.row('This week', '', 'Nov 9 – 15', on=True) + '<div class="sep"></div>'
                   + bp.cal(2026, 11, rng=((2026, 11, 9), (2026, 11, 15))))
    steps = [('Practice LeetCode 30 min', 'career', True), ('Read 10 pages', 'personal', False), ("Plan tomorrow's top task", 'career', False),
             ('Stretch 10 min', 'health', False), ('Skincare', 'health', False)]
    rp = (f'<div class="rh">{nb.ring(0.2)}<b>Evening routine</b><span>Daily · 1/5</span></div><div class="sep"></div>'
          + ''.join(f'<div class="rs2 {a}{" done" if d else ""}"><span class="rb">{I_CHK if d else ""}</span>{n}</div>' for n, a, d in steps))
    pops += bp.pop('k-rp', POS['rp'][0], POS['rp'][1], 260, rp)
    ghost = (f'<div class="ent tk career ghost2" style="left:{POS["ghost"][0]}px;top:{POS["ghost"][1]}px"><span class="cb"></span>'
             f'<span class="nm">Draft the hackathon pitch</span>{nb.icon_flag("med")}</div>')
    toast = (f'<div class="toast2"><span class="ok">{nb.I_TOK}</span><span>Clean up GitHub profile completed</span>'
             '<button class="link">Undo</button><kbd>Ctrl Z</kbd></div>')
    seg = ''.join(f'<span{" class=on" if i == 0 else ""} data-c="{c}">{t}</span>' for i, (t, c) in enumerate(STATES))
    sw_ = f'<div class="states pstates"><span>Mock state</span><div class="seg" id="wst">{seg}</div></div>'
    _, mcss = bp.step_modal(area_html)
    shows = ','.join(f'body.v{k} .app.wv.v-{k}' for k in VARIANTS) + '{display:flex!important}'
    pkshow = ','.join(f'body.{k} .pk.{k}' for k in ['k-view', 'k-add', 'k-wper', 'k-rp']) + '{display:block}'
    script = ('<script>const wst=document.getElementById("wst");function go(c){document.body.className=c;'
              'wst.querySelectorAll("span").forEach(x=>x.classList.toggle("on",x.dataset.c===c));}'
              'wst.onclick=e=>{const c=e.target.dataset.c;if(c)go(c);};'
              'const tip=document.getElementById("tip");document.addEventListener("mousemove",e=>{const t=e.target.closest("[data-tip]");'
              'if(!t){tip.style.display="none";return}tip.textContent=t.dataset.tip;tip.style.display="block";'
              'tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY-28)+"px";});</script>')
    body = (f'<body class="s-normal vnormal">{apps}{tp}{event_panel(html)}{new_event()}{nb.series()}{pops}{ghost}{toast}{sw_}'
            f'<div id="tip"></div>{script}</body></html>')
    head = head.replace('</style>', bp.CSS + mcss + '.pop2,.pmenu{display:none}' + nb.CSS + CSS + shows + pkshow + '</style>', 1)
    head = re.sub(r'<title>.*?</title>', '<title>Life OS — Calendar · Week (draft)</title>', head, count=1)
    return head + body


if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    area = open(sys.argv[2], encoding='utf-8').read()
    out = build(src, area)
    open(sys.argv[3], 'w', encoding='utf-8').write(out)
    print('wrote', sys.argv[3], len(out))
