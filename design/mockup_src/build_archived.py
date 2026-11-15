"""Build html_mockups/approved-archived.html: the Archived screen (Phase G step 2, approved Nov 15).

Opened from Archived at the bottom of the Areas sidebar (row active). "Archived areas" (areas overview ⋯) and
"Archived routines" (routines overview ⋯) open it on that tab.

- Header: "Archived", a divider, the switch Areas | Projects | Routines with grey counters; right: the filter icon
  (Projects only: by area).
- One list card of rows, newest first. Projects are grouped DONE, CANCELLED, ARCHIVED; rows don't repeat the status.
- Rows (icons first): area = colour dot, name, "Archived Oct 2 · 3 projects · 41 tasks · 2 metrics"; project = folder
  in the area colour, name, "Health & Beauty · Nov 3 · 18/20 tasks"; routine = repeat icon, name,
  "Every day · 5 steps · Archived Nov 1 · best streak 21 days".
- Hover actions + ⋯: areas and archived projects Restore, Delete; done or cancelled projects Reopen, Archive, Delete.
  Restore and Reopen apply at once with the undo toast. Restore is disabled while the parent is archived
  ("Restore Language learning first.").
- Clicking an area or project opens the detail panel (⋯ holds Restore); a routine opens its routine page read-only
  (Archived chip + Restore in the header, no checkboxes, no step actions).
- Delete keeps "only when empty" for areas and projects; routines delete with the approved confirm dialog unless a
  step feeds a metric.

Reuses build_routine.py (shell, sidebar, routine page, CSS, JS) and build_confirmations.py (the confirm dialog).
Mock today: Sat, Nov 14, 2026.
Usage: python build_archived.py <html_mockups dir> <out.html>
"""
import json
import sys
from datetime import date
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'approved-archived.html')
sys.argv = sys.argv[:1] + [str(SRC), str(OUT)]

import build_routine as br  # noqa: E402
import build_confirmations as bc  # noqa: E402

br.SRC = SRC
bc.SRC = SRC
ic = br.ic
br.I.update(
    restore='<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    reopen='<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    filter='<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
)
D = br.D
SEED = 3
ARCH_DAY = date(2026, 11, 1)

# ---------------------------------------------------------------- the archived routine (its page is read-only)
R_ARC = br.Routine('arc', 'Study sprint', [(date(2026, 7, 6), 'daily')], [
    br.S('Anki review, 20 cards', 'career', .92, start=date(2026, 7, 6)),
    br.S('Read one paper section', 'career', .88, start=date(2026, 7, 6)),
    br.S('Practice SQL 30 min', 'career', .9, proj='Hackathon prep', start=date(2026, 7, 6)),
    br.S('Summarise today’s notes', 'personal', .87, start=date(2026, 7, 6)),
    br.S('Walk 15 min', 'health', .91, start=date(2026, 8, 3)),
], seed=SEED)
for (i, d) in list(R_ARC.st):
    if d > ARCH_DAY:
        R_ARC.st[(i, d)] = 'x'
W_ARC = R_ARC.window(R_ARC.created, ARCH_DAY)
LOGS = sum(1 for (i, d), x in R_ARC.st.items() if x in 'dsm')
DAYS = W_ARC['due_days']
br.NOTES['arc'] = '<p>For the summer term. Bring it back before the next exam season.</p>'

# ---------------------------------------------------------------- mock data
# areas: key, palette class, name, archived, meta, delete reason (None = empty, can be deleted)
AREAS = [
    ('lang', 'finance', 'Language learning', 'Oct 2', '1 project · 41 tasks · 2 metrics', 'Only empty areas can be deleted.',
     '1 project, 41 tasks back'),
    ('free', 'career', 'Freelance', 'Aug 14', '1 project · 18 tasks', 'Only empty areas can be deleted.', '1 project, 18 tasks back'),
    ('side', 'relation', 'Side projects', 'Jun 30', 'Empty', None, ''),
]
AREA_NAME = dict(br.AREAS)
AREA_NAME.update(finance='Finance')
# projects: group, key, palette class, owner name, name, date, tasks, parent archived (blocks Restore), delete reason
PROJECTS = [
    ('done', 'c5k', 'health', 'Health &amp; Beauty', 'Couch to 5K', 'Nov 3', '18/20 tasks', None),
    ('done', 'pw1', 'career', 'Career', 'Portfolio website v1', 'Oct 20', '14/14 tasks', None),
    ('done', 'q3b', 'finance', 'Finance', 'Q3 budget review', 'Sep 30', '6/6 tasks', None),
    ('cancelled', 'kit', 'home', 'Home', 'Kitchen repaint', 'Oct 11', '3/9 tasks', None),
    ('archived', 'jlp', 'finance', 'Language learning', 'Japanese N4 exam', 'Oct 2', '12/30 tasks', 'Language learning'),
    ('archived', 'ets', 'career', 'Freelance', 'Etsy print shop', 'Aug 14', '7/16 tasks', 'Freelance'),
    ('archived', 'blg', 'personal', 'Personal', 'Old blog', 'Jul 8', '5/11 tasks', None),
]
GROUPS = [('done', 'Done'), ('cancelled', 'Cancelled'), ('archived', 'Archived')]
# routines: key, name, schedule, steps, archived, best streak, feeds (blocks Delete)
ROUTINES = [
    ('arc', 'Study sprint', 'Every day', 5, 'Nov 1', W_ARC['best'], None),
    ('run', 'Morning run', 'Mon, Wed, Fri', 3, 'Sep 12', 9, 'Weekly runs'),
    ('wind', 'Night shift wind-down', 'Every weekday', 4, 'Jul 20', 15, None),
]


def act_btns(kind, block=None):
    if kind == 'dproj':
        b = f'<button class="btn sm abtn" data-a="reopen">{ic("reopen")}Reopen</button>'
    elif block:
        b = (f'<span class="abw"><button class="btn sm abtn dis" data-tip="Restore {block} first.">{ic("restore")}Restore</button>'
             f'<span class="atip">Restore {block} first.</span></span>')
    else:
        b = f'<button class="btn sm abtn" data-a="restore">{ic("restore")}Restore</button>'
    return f'<span class="aacts">{b}<span class="icon-btn amore" title="More">{ic("more")}</span></span>'


def area_row(a):
    k, pal, name, when, meta, delr, back = a
    attrs = (f'data-id="{k}" data-kind="area" data-name="{name}" data-done="Restored “{name}”{" · " + back if back else ""}"'
             + (f' data-del="{delr}"' if delr else ' data-dlg="d-dela"'))
    return (f'<div class="arow {pal}" {attrs}><span class="aic"><span class="adot"></span></span><span class="an">{name}</span>'
            f'<span class="am">Archived {when} · {meta}</span>{act_btns("area")}</div>')


def proj_row(p):
    g, k, pal, owner, name, when, tasks, block = p
    kind = 'aproj' if g == 'archived' else 'dproj'
    verb = 'Restored' if kind == 'aproj' else 'Reopened'
    attrs = (f'data-id="{k}" data-kind="{kind}" data-name="{name}" data-done="{verb} “{name}”" '
             f'data-del="Only empty projects can be deleted."' + (f' data-block="{block}"' if block else ''))
    return (f'<div class="arow {pal}" {attrs}><span class="aic">{ic("folder")}</span><span class="an">{name}</span>'
            f'<span class="am">{owner} · {when} · {tasks}</span>{act_btns(kind, block)}</div>')


def rout_row(r):
    k, name, sched, n, when, best, feeds = r
    attrs = (f'data-id="{k}" data-kind="routine" data-name="{name}" data-done="Restored “{name}” · {n} steps back"'
             + (f' data-del="A step feeds {feeds}."' if feeds else f' data-dlg="d-del-{k}"'))
    return (f'<div class="arow rt" {attrs}><span class="aic">{ic("repeat")}</span><span class="an">{name}</span>'
            f'<span class="am">{sched} · {n} steps · Archived {when} · best streak {best} days</span>{act_btns("routine")}</div>')


def counter(n):
    return f'<span class="counter">{n}</span>' if n else ''


def head(tab, counts):
    sw = ''.join(f'<span class="{"on" if t == tab else ""}" data-go="{t}">{lab}{counter(counts[t])}</span>'
                 for t, lab in [('areas', 'Areas'), ('projects', 'Projects'), ('routines', 'Routines')])
    flt = (f'<span class="icon-btn fbtn" title="Filter by area">{ic("filter")}</span>' if tab == 'projects' and counts['projects'] else '')
    return (f'<div class="thead"><div class="tl"><h1 class="t-page">Archived</h1><span class="hdiv"></span>'
            f'<div class="gsw">{sw}</div></div><div class="tr">{flt}</div></div>')


EMPTY = {'areas': 'No archived areas.', 'projects': 'No finished or archived projects.', 'routines': 'No archived routines.'}


def list_body(tab, skip=()):
    if tab == 'areas':
        rows = [area_row(a) for a in AREAS if a[0] not in skip]
        return ''.join(rows), len(rows)
    if tab == 'routines':
        rows = [rout_row(r) for r in ROUTINES if r[0] not in skip]
        return ''.join(rows), len(rows)
    out, n = '', 0
    for g, lab in GROUPS:
        rows = [proj_row(p) for p in PROJECTS if p[0] == g and p[1] not in skip]
        if rows:
            out += (f'<div class="agrp" data-g="{g}"><div class="agh"><span class="t-label">{lab}</span>{counter(len(rows))}</div>'
                    f'{"".join(rows)}</div>')
            n += len(rows)
    return out, n


def sidebar(extra_area=None):
    s = br.sidebar(None)
    s = s.replace('<div class="item"><svg', '<div class="item on arch-item"><svg', 1)
    if extra_area:
        pal, name = extra_area
        s = s.replace('Home</div><div class="side-divider">',
                      f'Home</div><div class="item {pal} justback"><span class="dot"></span>{name}</div><div class="side-divider">', 1)
    return s


def list_app(app_id, tab, empty=False, skip=(), extra_area=None):
    counts = {}
    for t in ('areas', 'projects', 'routines'):
        counts[t] = 0 if empty else list_body(t, skip)[1]
    body, n = list_body(tab, skip) if not empty else ('', 0)
    inner = body if n else f'<div class="card-empty aempty"><span class="t-meta">{EMPTY[tab]}</span></div>'
    main = (f'<main class="main amain">{head(tab, counts)}<div class="scroll"><section class="scard alist" data-tab="{tab}">'
            f'{inner}</section></div></main>')
    grp = 'em' if empty else 'ar'
    return (f'<div class="app rapp alapp" id="{app_id}" data-r="none" data-grp="{grp}" data-tab="{tab}">'
            f'{br.RAIL}{sidebar(extra_area)}{main}</div>')


# ---------------------------------------------------------------- archived routine page
def arch_header(r, period):
    a, b, lab, _, _ = br.PERIODS[period]
    seg = ''.join(f'<span class="{"on" if p == period else ""}" data-p="{p}">{p.capitalize()}</span>'
                  for p in ['week', 'month', 'quarter', 'year'])
    tags = ''.join(f'<span class="tag area {k}"><span class="dot"></span>{br.AREA[k]}</span>' for k in r.areas())
    return f'''<div class="areahead"><div>
    <div class="ttl"><span class="rhead">{br.ring(0, 18, 'none')}</span><h1 class="t-page">{r.name}</h1></div>
    <div class="phead-sub" style="padding-left:28px"><span class="tag neutral">{ic('archive')}Archived {br.md(ARCH_DAY)}</span>
      <span class="chip2 schip static">{ic('repeat')}Every day · {br.md(r.created)} – {br.md(ARCH_DAY)}</span>{tags}</div></div>
    <div class="acts">
      <div class="seg pseg">{seg}</div>
      <div class="pnav"><span class="icon-btn">{ic('left')}</span><span class="pl">{lab}</span><span class="icon-btn">{ic('right')}</span></div>
    </div><button class="btn primary rrestore" data-done="Restored “Study sprint” · 5 steps back">{ic('restore')}Restore</button></div>'''


def arch_pages():
    orig = br.header
    br.header = arch_header
    out = ''
    for p in br.PERIODS:
        h = br.page(R_ARC, p, active=None)
        h = h.replace('<div class="app rapp"', '<div class="app rapp arch"', 1)
        h = h.replace(br.sidebar(None), sidebar(), 1)
        h = h.replace('>Current streak<', '>Final streak<')
        h = h.replace(f'data-sel="{br.iso(br.TODAY)}"', f'data-sel="{br.iso(ARCH_DAY)}"')
        out += h
    br.header = orig
    return out


# ---------------------------------------------------------------- detail panels (read-only, ⋯ holds Restore)
def panel(pid, pal, crumb, mark, title, chips, notes, restore, delete, reason):
    menu = (f'<div class="pmenu3 apm"><div class="mi">{ic("md")}View Markdown</div><div class="msep"></div>'
            f'<div class="mi" data-a="prestore">{ic("restore")}{restore}</div><div class="msep"></div>'
            f'<div class="mi dis">{ic("trash")}{delete}<span class="mhint">{reason}</span></div></div>')
    ch = ''.join(f'<span class="chip2 static">{c}</span>' for c in chips)
    return (f'<aside class="panel dpanel ov apanel {pal}" id="{pid}" aria-label="Details"><div class="panel-head"><span class="cdot"></span>'
            f'<nav class="crumb">{crumb}</nav><span style="flex:1"></span><button class="hbtn apmb" title="More">{ic("more")}</button></div>'
            f'<div class="panel-body"><div class="ttlrow">{mark}<h2>{title}</h2></div><div class="chips">{ch}</div>'
            f'<section class="nsec"><div class="nh"><span class="t-label">Notes</span></div><div class="nbody">{notes}</div></section></div>{menu}</aside>')


def panels():
    p = panel('pp', 'personal', '<span>Personal</span><span class="cs">/</span><span>Projects</span>',
              f'<span class="mk fold">{ic("folder")}</span>', 'Old blog',
              [f'{ic("archive")}Archived Jul 8', f'{ic("cal")}Mar 2 – Jul 8', f'{ic("stats")}5 of 11 tasks · 45%'],
              '<p>Move the best posts to the portfolio site, then retire the old domain.</p><ul><li>Export posts as Markdown</li><li>Pick 5 posts to keep</li></ul>',
              'Restore project', 'Delete project', 'Only empty projects can be deleted.')
    p_menu = p.replace('id="pp"', 'id="ppm"').replace('apanel ', 'apanel mopen ')
    a = panel('pa', 'finance', '<span>Life areas</span>', '<span class="mk adotl"></span>', 'Language learning',
              [f'{ic("archive")}Archived Oct 2', f'{ic("folder")}1 project · 41 tasks · 2 metrics'],
              '<p>Reach JLPT N4 and hold a 10-minute conversation in Japanese.</p>',
              'Restore area', 'Delete area', 'Only empty areas can be deleted.')
    return p + p_menu + a


# ---------------------------------------------------------------- confirm dialogs (approved pattern)
def dialogs():
    steps = [bc.row('step', s['t'], s['proj'] or AREA_NAME[s['a']], area=s['a']) for s in R_ARC.steps]
    d = bc.dialog('d-del-arc', 'Delete “Study sprint”?',
                  bc.group('Deleted', steps + [bc.row('history', 'History', f'{LOGS} logs · {DAYS} days'),
                                               bc.row('sched', 'Schedules', '1')]),
                  'Can’t be undone', 'Delete routine', danger=True)
    wind = [bc.row('step', 'No screens after 11 PM', 'Personal', area='personal'),
            bc.row('step', 'Herbal tea', 'Health &amp; Beauty', area='health'),
            bc.row('step', 'Blackout curtains shut', 'Home', area='home'),
            bc.row('step', 'Set two alarms', 'Career', area='career')]
    d += bc.dialog('d-del-wind', 'Delete “Night shift wind-down”?',
                   bc.group('Deleted', wind + [bc.row('history', 'History', '214 logs · 58 days'), bc.row('sched', 'Schedules', '1')]),
                   'Can’t be undone', 'Delete routine', danger=True)
    d += bc.dialog('d-dela', 'Delete “Side projects”?', '', 'Can’t be undone', 'Delete area', danger=True, area='relation')
    d = d.replace('<div class="xg "><div class="xgh"><span class="t-label">Deleted',
                  '<div class="xg del"><div class="xgh"><span class="t-label">Deleted')
    return d.replace('class="cx ov"', 'class="cx ov acx"')


FILTER = ('<div class="pmenu ov fmenu" id="fm"><div class="fmh"><span class="t-label">Area</span><button class="link">Clear</button></div>'
          + ''.join(f'<div class="mi fi {pal}"><span class="mini-check on">{ic("check")}</span><span class="dot"></span>{n}'
                    f'<span class="fc">{c}</span></div>'
                    for pal, n, c in [('career', 'Career', 1), ('finance', 'Finance', 1), ('health', 'Health &amp; Beauty', 1),
                                      ('personal', 'Personal', 1), ('home', 'Home', 1),
                                      ('finance', 'Language learning', 1), ('career', 'Freelance', 1)])
          + '</div>')
ROWMENU = '<div class="pmenu amenu" id="rowmenu"></div>'
TOAST = (f'<div class="toast2 ov" id="toast"><span class="ok">{ic("check")}</span><span></span>'
         '<button class="link tundo">Undo</button><kbd>Ctrl Z</kbd></div>')

CSS = r"""
/* Archived list */
.amain{position:relative}
.amain .scroll{padding:16px 24px 24px}
.alist{width:960px;padding:4px 0}
.gsw .counter{margin-left:6px}
.thead .tr{min-height:28px}
.agrp+.agrp{margin-top:4px}
.agh{height:32px;display:flex;align-items:center;gap:6px;padding:8px 16px 0}
.agh .t-label{padding:0;height:auto}
.arow{height:44px;display:flex;align-items:center;gap:10px;padding:0 12px 0 16px;cursor:pointer;position:relative;transition:opacity .15s}
.arow+.arow{box-shadow:inset 0 1px 0 var(--n100)}
.arow:hover,.arow.hv{background:var(--n50)}
.arow.gone{opacity:0}
.aic{width:16px;height:16px;flex:none;display:grid;place-items:center;color:var(--a-solid)}
.arow.rt .aic{color:var(--acc600)}
.aic svg{width:16px;height:16px}
.adot{width:10px;height:10px;border-radius:3px;background:var(--a-solid)}
.an{font-size:13px;line-height:20px;font-weight:500;color:var(--text-primary);white-space:nowrap}
.am{font-size:12px;line-height:16px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;font-variant-numeric:tabular-nums}
.aacts{display:none;align-items:center;gap:4px;margin-left:auto;flex:none}
.arow:hover .aacts,.arow.hv .aacts{display:flex}
.abtn svg{width:14px;height:14px}
.abtn.dis{opacity:.45;cursor:not-allowed}
.abw{position:relative;display:inline-flex}
.atip{display:none;position:absolute;bottom:calc(100% + 6px);right:0;white-space:nowrap;background:#1f2937;color:#fff;font-size:12px;line-height:16px;padding:4px 8px;border-radius:6px;z-index:6}
.arow.tipon .atip{display:block}
.amore{width:24px;height:24px}
.aempty{padding:20px 16px}
.rside{padding-bottom:56px}  /* keeps Archived above the mock-state bar */
/* menus */
.amenu{width:240px}
.amenu .mi{cursor:pointer}
.amenu .mi:hover:not(.dis){background:var(--n100)}
.mi.neg{color:var(--danger)}.mi.neg>svg{color:var(--danger)!important}
.mi.dis{opacity:1;color:var(--text-disabled,#9ca3af);flex-wrap:wrap;height:auto;padding-top:5px;padding-bottom:5px;cursor:default}
.fmenu{width:260px}
.fmh{display:flex;align-items:center;justify-content:space-between;padding:4px 8px 6px}
.fmh .link{border:0;background:none;font:500 12px/16px Inter,sans-serif;color:var(--acc700);cursor:pointer}
.fi .dot{width:8px;height:8px;border-radius:2px;background:var(--a-solid);flex:none}
.fi .mini-check{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--n400);display:grid;place-items:center;flex:none}
.fi .mini-check.on{background:var(--acc700);border-color:var(--acc700);color:#fff}
.fi .mini-check svg{width:10px;height:10px;stroke-width:3}
.fi .fc{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
/* read-only detail panel */
.apanel .chip2.static{cursor:default}
.apanel .pmenu3{display:none;width:220px}
.apanel.mopen .pmenu3{display:block}
.apanel .mk.adotl{width:14px;height:14px;border-radius:4px;background:var(--a-solid);flex:none;margin:0 3px}
.apanel .mi[data-a]{cursor:pointer}
/* archived routine page: read-only */
.app.arch .hact,.app.arch .gotoday,.app.arch .skb,.app.arch .dfoot,.app.arch .cmenu{display:none!important}
.app.arch .hname{cursor:default}
.app.arch .drow .rb{pointer-events:none;cursor:default}
.app.arch .chip2.static{cursor:default}
.app.arch .chip2.static:hover{background:transparent}
.rrestore svg{width:16px;height:16px}
.acx .xmore{cursor:pointer}
.toast2.noundo .tundo,.toast2.noundo kbd{display:none}
"""

JS = r"""
(function(){
const toastEl=document.getElementById('toast'),menu=document.getElementById('rowmenu'),stEl=document.getElementById('st');
const IC={restore:'__RESTORE__',reopen:'__REOPEN__',archive:'__ARCHIVE__',trash:'__TRASH__'};
let undoStack=[];
function showToast(msg,undo){toastEl.querySelector('span:nth-child(2)').textContent=msg;toastEl.classList.toggle('noundo',!undo);toastEl.style.display='flex';
  clearTimeout(window._tt);window._tt=setTimeout(()=>{if(!document.body.dataset.keep)toastEl.style.display='none'},6000);}
function closeMenus(){menu.style.display='none';document.querySelectorAll('.arow.hv').forEach(r=>r.classList.remove('hv'));
  document.querySelectorAll('.apanel.mopen').forEach(p=>p.classList.remove('mopen'));const f=document.getElementById('fm');if(f)f.style.display='';}
function recount(app){const list=app.querySelector('.alist');if(!list)return;
  list.querySelectorAll('.agrp').forEach(g=>{const n=g.querySelectorAll('.arow').length;const c=g.querySelector('.agh .counter');
    if(c)c.textContent=n;g.style.display=n?'':'none'});
  const n=list.querySelectorAll('.arow').length;const tab=list.dataset.tab;
  document.querySelectorAll('.alapp[data-grp="'+app.dataset.grp+'"] .gsw [data-go="'+tab+'"] .counter').forEach(c=>{if(n)c.textContent=n;else c.remove()});
  let em=list.querySelector('.aempty');
  if(!n&&!em){list.insertAdjacentHTML('beforeend','<div class="card-empty aempty"><span class="t-meta">'+EMPTY[tab]+'</span></div>')}
  if(n&&em)em.remove();}
const EMPTY=__EMPTY__;
function removeRow(row,msg,undo){const app=row.closest('.app');const parent=row.parentNode,next=row.nextSibling;row.classList.add('gone');
  setTimeout(()=>{row.remove();recount(app)},150);if(undo)undoStack.push({row,parent,next,app});showToast(msg,undo);}
function archiveRow(row){const app=row.closest('.app');const g=app.querySelector('.agrp[data-g="archived"]');
  row.dataset.kind='aproj';row.dataset.done='Restored “'+row.dataset.name+'”';
  row.querySelector('.abtn').outerHTML='<button class="btn sm abtn" data-a="restore">'+IC.restore+'Restore</button>';
  g.insertBefore(row,g.querySelector('.arow'));recount(app);showToast('Archived “'+row.dataset.name+'”',true);}
function openMenu(row){closeMenus();row.classList.add('hv');const k=row.dataset.kind;let h='';
  const del=row.dataset.del;
  if(k==='dproj'){h+='<div class="mi" data-a="reopen">'+IC.reopen+'Reopen project</div><div class="mi" data-a="archive">'+IC.archive+'Archive project</div>'}
  else{const lab={area:'Restore area',aproj:'Restore project',routine:'Restore routine'}[k];
    h+=row.dataset.block?'<div class="mi dis">'+IC.restore+lab+'<span class="mhint">Restore '+row.dataset.block+' first.</span></div>':'<div class="mi" data-a="restore">'+IC.restore+lab+'</div>'}
  const dl={area:'Delete area',aproj:'Delete project',dproj:'Delete project',routine:'Delete routine'}[k];
  h+='<div class="msep"></div>'+(del?'<div class="mi dis">'+IC.trash+dl+'<span class="mhint">'+del+'</span></div>':'<div class="mi neg" data-a="delete">'+IC.trash+dl+'</div>');
  menu.innerHTML=h;menu._row=row;const b=row.querySelector('.amore').getBoundingClientRect();
  menu.style.display='block';menu.style.left=(b.right-240)+'px';menu.style.top=(b.bottom+4)+'px';}
function doAct(row,a){
  if(a==='restore'||a==='reopen'){removeRow(row,row.dataset.done,true);return}
  if(a==='archive'){archiveRow(row);return}
  if(a==='delete'){const d=document.getElementById(row.dataset.dlg);if(d){d._row=row;d.style.display='block'}}}
document.addEventListener('click',e=>{
  // read-only routine page: a square selects the day, no popover
  const sq=e.target.closest('.app.arch .stepscard .hcells i[data-d]');
  if(sq){e.stopPropagation();const app=sq.closest('.app');const c=app.querySelector('.dcard');c.dataset.sel=sq.dataset.d;renderDay(app);return}
},true);
document.addEventListener('click',e=>{
  if(e.target.closest('.states'))return;
  const go=e.target.closest('.gsw [data-go]');if(go){const app=go.closest('.app');showApp(app.dataset.grp+'-'+go.dataset.go);closeMenus();return}
  if(e.target.closest('.arch-item')){showApp('ar-areas');closeMenus();return}
  if(e.target.closest('.rrestore')){showToast(e.target.closest('.rrestore').dataset.done,true);return}
  const mi=e.target.closest('#rowmenu .mi[data-a]');if(mi){const row=menu._row;closeMenus();doAct(row,mi.dataset.a);return}
  if(e.target.closest('#rowmenu'))return;
  const pm=e.target.closest('.apmb');if(pm){const p=pm.closest('.apanel');const o=p.classList.contains('mopen');closeMenus();p.classList.toggle('mopen',!o);return}
  const pmi=e.target.closest('.apanel .mi[data-a="prestore"]');if(pmi){const p=pmi.closest('.apanel');p.style.display='';p.classList.remove('mopen');
    const app=document.querySelector('.app.show');const name=p.querySelector('h2').textContent;
    const row=app&&[...app.querySelectorAll('.arow')].find(r=>r.dataset.name===name);
    if(row)removeRow(row,row.dataset.done,true);else showToast('Restored “'+name+'”',true);return}
  if(e.target.closest('.apanel'))return;
  const fb=e.target.closest('.fbtn');if(fb){const f=document.getElementById('fm');const o=f.style.display==='block';closeMenus();
    if(!o){const b=fb.getBoundingClientRect();f.style.display='block';f.style.left=(b.right-260)+'px';f.style.top=(b.bottom+4)+'px'}return}
  if(e.target.closest('#fm'))return;
  const row=e.target.closest('.arow');
  if(row){
    if(e.target.closest('.amore')){openMenu(row);return}
    const btn=e.target.closest('.abtn');if(btn){if(!btn.classList.contains('dis'))doAct(row,btn.dataset.a);return}
    closeMenus();
    if(row.dataset.kind==='routine'){if(row.dataset.id==='arc'){showApp('arc-quarter');const a=document.getElementById('arc-quarter');a.querySelector('.dcard').dataset.sel='2026-11-01';renderDay(a)}return}
    document.querySelectorAll('.apanel').forEach(p=>p.style.display='');
    const p=document.getElementById(row.dataset.kind==='area'?'pa':'pp');if(p)p.style.display='flex';return}
  const cx=e.target.closest('.acx');
  if(cx){if(e.target.closest('.xback,.xclose,.scrim3')){cx.style.display='';return}
    const m=e.target.closest('.xmore');if(m){m.closest('.xg').classList.add('open');return}
    if(e.target.closest('.xgo')){cx.style.display='';const row=cx._row;const nm=cx.querySelector('h3').textContent.replace(/^Delete /,'').replace(/\?$/,'');
      if(row)removeRow(row,'Deleted '+nm,false);else showToast('Deleted '+nm,false);return}
    return}
  if(e.target.closest('.tundo')){const u=undoStack.pop();toastEl.style.display='none';
    if(u){u.row.classList.remove('gone');u.parent.insertBefore(u.row,u.next&&u.next.parentNode===u.parent?u.next:null);recount(u.app)}return}
  if(!e.target.closest('.panel'))document.querySelectorAll('.apanel').forEach(p=>p.style.display='');
  closeMenus();
});
// state switcher: runs after the routine page's own handler
stEl.addEventListener('click',e=>{const sp=e.target.closest('span[data-app]');if(!sp)return;
  closeMenus();undoStack=[];document.querySelectorAll('.arow.tipon').forEach(r=>r.classList.remove('tipon'));
  document.querySelectorAll('.acx .xg.open').forEach(g=>g.classList.remove('open'));
  toastEl.classList.remove('noundo');
  if(sp.dataset.toast)toastEl.querySelector('span:nth-child(2)').textContent=sp.dataset.toast;
  const app=document.getElementById(sp.dataset.app);
  if(sp.dataset.ov==='ppm')document.getElementById('ppm').classList.add('mopen');
  if(sp.dataset.fm){const f=document.getElementById('fm');const b=app.querySelector('.fbtn').getBoundingClientRect();f.style.left=(b.right-260)+'px';f.style.top=(b.bottom+4)+'px';f.style.display='block'}
  if(sp.dataset.hover){const r=app.querySelector('.arow[data-id="'+sp.dataset.hover+'"]');r.classList.add('hv');if(sp.dataset.tipon)r.classList.add('tipon')}
  if(sp.dataset.menu){openMenu(app.querySelector('.arow[data-id="'+sp.dataset.menu+'"]'))}
});
stEl.querySelector('span.on').click();
})();
"""

STATES = [  # label, app, overlays, extra attrs
    ('Areas', 'ar-areas', '', ''),
    ('Projects', 'ar-projects', '', ''),
    ('Routines', 'ar-routines', '', ''),
    ('Row hover', 'ar-projects', '', 'data-hover="c5k"'),
    ('⋯ menu', 'ar-projects', '', 'data-menu="c5k"'),
    ('Restored, undo toast', 'ar-areas-r', 'toast', 'data-toast="Restored “Language learning” · 1 project, 41 tasks back"'),
    ('Restore disabled', 'ar-projects', '', 'data-hover="jlp" data-tipon="1"'),
    ('Detail panel (archived project)', 'ar-projects', 'pp', ''),
    ('Detail panel, ⋯ menu', 'ar-projects', 'ppm', ''),
    ('Archived routine page', 'arc-quarter', '', 'data-sel="2026-11-01"'),
    ('Delete confirmation', 'ar-routines', 'd-del-arc', ''),
    ('Delete disabled', 'ar-areas', '', 'data-menu="lang"'),
    ('Filter menu', 'ar-projects', 'fm', 'data-fm="1"'),
    ('Empty: Areas', 'em-areas', '', ''),
    ('Empty: Projects', 'em-projects', '', ''),
    ('Empty: Routines', 'em-routines', '', ''),
]


def build():
    br.RAIL = br.rail()
    apps = ''
    for t in ('areas', 'projects', 'routines'):
        apps += list_app(f'ar-{t}', t)
    apps += list_app('ar-areas-r', 'areas', skip=('lang', 'jlp'), extra_area=('finance', 'Language learning'))
    for t in ('areas', 'projects', 'routines'):
        apps += list_app(f'em-{t}', t, empty=True)
    apps += arch_pages()
    data = {'arc': br.routine_json(R_ARC)}
    ovs = panels() + dialogs() + FILTER + ROWMENU + TOAST + br.DAYPOP
    sw = ''.join(f'<span{" class=on" if k == 0 else ""} data-app="{a}" data-ov="{o}" {x}>{l}</span>'
                 for k, (l, a, o, x) in enumerate(STATES))
    js = (JS.replace('__EMPTY__', json.dumps(EMPTY))
          .replace('__RESTORE__', ic('restore')).replace('__REOPEN__', ic('reopen'))
          .replace('__ARCHIVE__', ic('archive')).replace('__TRASH__', ic('trash')))
    tasks = (SRC / 'approved-tasks.html').read_text(encoding='utf-8')
    tcss = tasks[tasks.index('<style>') + 7:tasks.index('</style>')]
    import re
    head_css = '\n'.join(l for l in re.split(r'(?<=\})', tcss) if re.search(r'\.thead|\.gsw|\.fbtn\{|\.fbtn svg', l))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Archived, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{br.base_css()}{br.CSS}{bc.CSS}{head_css}{CSS}</style></head>
<body>
{apps}
{ovs}
<div class="states"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{br.JS.replace('__DATA__', json.dumps(data))}</script>
<script>{js}</script>
</body></html>'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
