"""Detail panel (side panel) for every entity with notes -> approved-detail-panel.html

Same structure for every entity, shown floating over the approved Projects overview:
  header   = quiet breadcrumb (area > project) + the ... menu
  title    = entity marker (task checkbox, project folder, area square, event badge, metric icon) + title
  chips    = one row of small click-to-edit chips instead of a properties table
  content  = subtasks (tasks only), then Markdown notes
  toolbar  = one floating pill at the bottom centre of the panel (reference: rounded grey groups); "/" opens block types
Resize from the left edge (360-560 px).
"""
import sys
from pathlib import Path
sys.path.insert(0, '/home/claude')
import build_week as bw  # noqa: E402  (icons)
ic = bw.ic
bw.I.update({
    'bold': '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    'italic': '<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>',
    'strike': '<path d="M5 12h14M16 7a4 3 0 0 0-8 0c0 4 8 3 8 7a4 3 0 0 1-8 0"/>',
    'code': '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
    'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    'ul': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    'ol': '<path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 14.5a1.2 1.2 0 0 1 2 1L4 19h2.2"/>',
    'tasks': '<rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1 1 2-2M13 7h8M3 15h6v6H3zM13 18h8"/>',
    'quote': '<path d="M5 6v12M10 8h10M10 12h10M10 16h7"/>',
    'cblock': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
    'hr': '<path d="M3 12h18M7 7h10M7 17h10" opacity=".9"/>',
    'expand': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    'open': '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    'pin': '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    'stats': '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    'underline': '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
})
for k in ('area', 'sun', 'repeat', 'cal', 'folder', 'flag', 'more', 'chev', 'ok', 'check'):
    bw.I.setdefault(k, bw.I.get('check'))
bw.I['repeat'] = bw.I.get('repeat') or bw.I['check']
base = Path('/mnt/user-data/outputs/approved-projects-overview.html').read_text()

def crumb(*parts):
    p = '<span class="cs">/</span>'.join(f'<span>{x}</span>' for x in parts)
    return f'<div class="panel-head"><span class="cdot"></span><nav class="crumb">{p}</nav><span style="flex:1"></span><button class="hbtn" title="More">{ic("more")}</button></div>'
def chip(icon, text, cls=''):
    return f'<button class="chip2 {cls}">{ic(icon) if icon else ""}{text}</button>'
def chips(*c): return f'<div class="chips">{"".join(c)}</div>'
def fbar(on=()):
    g = lambda items: '<span class="nfg">' + '<span class="nfs"></span>'.join(
        f'<button class="nfbtn{" on" if k in on else ""}" title="{t}">{ic(k)}</button>' for k, t in items) + '</span>'
    return ('<div class="nfb">' + g([('bold', 'Bold'), ('italic', 'Italic'), ('underline', 'Underline'), ('strike', 'Strikethrough')])
            + g([('ul', 'Bulleted list'), ('ol', 'Numbered list'), ('tasks', 'Checklist')]) + g([('link', 'Link'), ('code', 'Inline code')]) + '</div>')
def panel(cls, area, hd, marker, title, ch, content, notes_html, on=(), saved='Saved'):
    return (f'<aside class="panel dpanel {cls} {area}" aria-label="Details">{hd}<div class="panel-body">'
            f'<div class="ttlrow">{marker}<h2>{title}</h2></div>{ch}{content}'
            f'<section class="nsec"><div class="nh"><span class="t-label">Notes</span><span class="t-meta">{saved}</span></div>'
            f'<div class="nbody">{notes_html}</div></section></div>{fbar(on)}</aside>')
MK = lambda cls, icon='': f'<span class="mk {cls}">{ic(icon) if icon else ""}</span>'

TASK_MD = """<h3>What to change</h3><ul><li>Move the Life OS project to the top</li><li>Cut the summary to two lines</li></ul>
<ul class="chk"><li class="done"><span class="cb on">{ok}</span>Update contact info</li><li><span class="cb"></span>Export as PDF</li></ul>
<p>Use the {b}one-page{eb} template from the <a>career folder</a>.</p>"""
task_md = TASK_MD.format(ok=ic('check'), b='<b>', eb='</b>')
task_type = TASK_MD.format(ok=ic('check'), b='<b><span class="nsel">', eb='</span></b><span class="caret2"></span>')
task_slash = task_md + '<p class="slashline">/<span class="caret2"></span></p>' + (
    '<div class="slash">' + ''.join(f'<div class="si{" on" if i == 0 else ""}">{f"<b class=hg>{c}</b>" if c[0] == "H" else ic(c)}<span>{n}</span><span class="t-meta">{k}</span></div>'
        for i, (c, n, k) in enumerate([('H1', 'Heading 1', '#'), ('H2', 'Heading 2', '##'), ('H3', 'Heading 3', '###'), ('quote', 'Quote', '>'),
                                       ('cblock', 'Code block', '```'), ('hr', 'Divider', '---')])) + '</div>')
t_head = crumb('Career', 'Resume &amp; portfolio', 'Resume')
t_chips = chips(chip('flag', 'High', 'hi'), chip('cal', 'Nov 4 · Overdue', 'od'), chip('sun', 'Sat, Nov 14 · 4 rollovers'), chip('repeat', 'Repeat', 'ghost'))
subtasks = ('<div class="subs"><div class="lblrow"><span class="t-label">Subtasks</span><span class="counter">1/3</span></div>'
            '<div class="subtask done"><span class="check done"></span><span>Add projects section</span></div>'
            '<div class="subtask"><span class="check"></span><span>Fix formatting</span></div>'
            '<div class="subtask"><span class="check"></span><span>Ask a friend to review</span></div></div>')
def task(cls, notes_html, on=(), saved='Saved'):
    return panel(cls, 'career', t_head, '<span class="mk tk" title="Mark done"><span class="ib"></span></span>', 'Update resume', t_chips, subtasks, notes_html, on, saved)

proj = panel('pnl-project', 'career', crumb('Career', 'Projects'), MK('fold', 'folder'), 'Resume &amp; portfolio',
             chips(chip('', 'Active'), chip('cal', 'Oct 20 – Nov 30 · 16d left'), chip('stats', '3 of 5 tasks · 60%')), '',
             '<p>Get the resume and portfolio ready before the hackathon and the mock interview.</p><h3>Done looks like</h3>'
             '<ul><li>One-page resume, exported as PDF</li><li>Two case studies on the portfolio page</li><li>LinkedIn featured section updated</li></ul>'
             '<blockquote>Ask Ana which projects to lead with.</blockquote>')
menu = ('<div class="pmenu3">' + ''.join(f'<div class="mi">{ic(i)}{t}</div>' for i, t in [('code', 'View Markdown')])
        + f'<div class="msep"></div><div class="mi">{ic("check")}Complete project</div><div class="mi">{ic("folder")}Archive project</div></div>')
proj_menu = proj.replace('pnl-project', 'pnl-menu', 1).replace('</aside>', menu + '</aside>', 1)
area = panel('pnl-area', 'career', crumb('Life areas'), MK('sq'), 'Career',
             '<p class="psub">Build a steady career in AI engineering, and keep learning something new every week.</p>'
             + chips(chip('folder', '3 projects'), chip('tasks', '9 open tasks'), chip('stats', '3 metrics')), '',
             '<h3>What a good month looks like</h3><ul><li>At least 5 job applications sent</li><li>One portfolio piece finished</li>'
             '<li>Life OS used every day</li></ul><p>Ask Ana for interview tips before Nov 20.</p>')
event = panel('pnl-event', 'career', crumb('Career', 'Resume &amp; portfolio'), MK('ev', 'cal'), 'Mock interview with Ana',
              chips(chip('cal', 'Fri, Nov 20 · 2:00 – 3:00 PM'), chip('repeat', 'Weekly'), chip('pin', 'Google Meet')),
              '<div class="scope"><span class="t-meta">Notes for</span><div class="seg"><span class="on">This event</span><span>All events</span></div></div>',
              '<h3>Questions to practice</h3><ol><li>Walk me through a project you led.</li><li>Why AI engineering?</li>'
              '<li>Tell me about a time something failed.</li></ol><p>Bring the <code>resume_v3.pdf</code> link.</p>')
metric = panel('pnl-empty', 'career', crumb('Career', 'Resume &amp; portfolio'), MK('fold', 'stats'), 'Recruiter replies',
               chips(chip('', '0 of 2 this month'), chip('', 'Sum'), chip('', 'Target · 2 per month')), '',
               '<p class="ph">Add notes…</p>', saved='')
resize = task('pnl-resize', task_md).replace('<aside class="panel', '<aside class="panel rz', 1).replace(
    'aria-label="Details">', 'aria-label="Details"><div class="ngrip" title="Drag to resize · 360–560 px"><span class="ngl"></span><span class="ngh"></span></div>', 1)
panels = (task('pnl-task', task_md) + task('pnl-type', task_type, ('bold',), 'Saving…') + task('pnl-slash', task_slash)
          + proj + proj_menu + area + event + metric + resize)

PANEL_CSS = """
.dpanel{display:none;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.10);flex-direction:column;overflow:hidden}
body.p-task .pnl-task,body.p-type .pnl-type,body.p-slash .pnl-slash,body.p-project .pnl-project,body.p-menu .pnl-menu,
body.p-area .pnl-area,body.p-event .pnl-event,body.p-empty .pnl-empty,body.p-resize .pnl-resize{display:flex}
.dpanel .panel-head{height:56px;border-bottom:0;padding:12px 16px 0 24px;gap:8px}
.cdot{width:8px;height:8px;border-radius:2px;background:var(--a-solid);flex:none}
.crumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);min-width:0;white-space:nowrap;overflow:hidden}
.crumb span:last-child{color:var(--text-secondary)}
.cs{color:var(--n300)}
.hbtn{width:28px;height:28px;display:grid;place-items:center;border:0;background:none;border-radius:6px;color:var(--text-tertiary);cursor:pointer}
.hbtn:hover{background:var(--n100);color:var(--text-primary)}.hbtn svg{width:16px;height:16px}
.dpanel .panel-body{flex:1;min-height:0;padding:12px 24px 112px;gap:14px}
.ttlrow{display:flex;align-items:flex-start;gap:10px}
.dpanel h2{font-size:20px;line-height:28px;font-weight:600;letter-spacing:-.01em}
.mkchk{width:18px;height:18px;margin:5px 0 0;border-radius:5px}
.mk{width:22px;height:22px;margin-top:3px;flex:none;display:grid;place-items:center;border-radius:6px;color:var(--a-solid);background:var(--a-tint)}
.mk svg{width:14px;height:14px}
.mk.tk{cursor:pointer}.mk.tk:hover{background:var(--a-border)}
.ib{width:11px;height:11px;border:1.75px solid var(--a-solid);border-radius:3px}
.mk.sq::after{content:'';width:10px;height:10px;border-radius:3px;background:var(--a-solid)}
.mk.ev{background:var(--a-solid);color:#fff}
.psub{font-size:13px;line-height:19px;color:var(--text-secondary);margin:-6px 0 0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip2{height:24px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid var(--border);background:#fff;border-radius:6px;
  font:500 12px Inter,sans-serif;color:var(--text-secondary);cursor:pointer}
.chip2:hover{background:var(--n50);color:var(--text-primary)}
.chip2 svg{width:13px;height:13px;color:var(--text-tertiary)}
.chip2.hi,.chip2.hi svg,.chip2.od,.chip2.od svg{color:#a5282d}
.chip2.hi,.chip2.od{border-color:#f4adb0;background:#fdf3f3}
.chip2.ghost{border-style:dashed;color:var(--text-tertiary)}
.subs{margin:4px 0 0}
.lblrow{display:flex;align-items:center;gap:6px;height:24px;margin-bottom:2px}
.panel .subtask.done span:last-child{color:var(--text-tertiary);text-decoration:line-through}
.nsec{display:flex;flex-direction:column;gap:4px;margin:4px 0 0;padding-top:12px;border-top:1px solid var(--border)}
.nh{display:flex;align-items:center;justify-content:space-between;height:20px}
""" + """.nbody{padding:4px 0 24px;font-size:13px;line-height:20px;color:var(--text-primary);position:relative}
.nbody h3{font-size:14px;line-height:20px;font-weight:600;margin:8px 0 2px}
.nbody h3:first-child{margin-top:2px}
.nbody p{margin:4px 0}
.nbody ul,.nbody ol{margin:2px 0 6px 20px}
.nbody ul.chk{list-style:none;margin-left:0}
.nbody ul.chk li{display:flex;align-items:center;gap:8px;height:24px}
.nbody ul.chk li.done{color:var(--text-tertiary);text-decoration:line-through}
.cb{width:14px;height:14px;border:1.5px solid var(--n400);border-radius:4px;display:grid;place-items:center;color:#fff}
.cb.on{background:#8f74b3;border-color:#8f74b3}.cb svg{width:10px;height:10px;stroke-width:3}
.nbody a{color:#7e61a0;text-decoration:underline;text-underline-offset:2px}
.nbody code{font:12px ui-monospace,Menlo,Consolas,monospace;background:var(--n100);border-radius:4px;padding:1px 4px}
.nbody blockquote{border-left:3px solid var(--n200);padding:2px 10px;color:var(--text-secondary);margin:6px 0}
.nsec.editing .nbody{box-shadow:inset 0 0 0 1px #d4cce6;border-radius:8px;padding:6px 8px 24px}
.sel{background:#e6e3f1;border-radius:2px}
.caret2{display:inline-block;width:1px;height:16px;background:var(--text-primary);vertical-align:-3px;margin-left:1px}
.slashline{color:var(--text-tertiary)}
.slash{position:absolute;left:8px;top:calc(100% - 20px);width:240px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:3}
.si{height:30px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;font-size:13px}
.si svg{width:15px;height:15px;color:var(--text-tertiary)}
.si .t-meta{margin-left:auto;font-family:ui-monospace,Menlo,Consolas,monospace}
.si.on{background:var(--n100)}
.pnl-slash .panel-body{overflow:visible}
pre.raw{font:12px/20px ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;color:var(--text-primary);background:var(--n50);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin:0}
.ph{color:var(--text-disabled);cursor:text}
.scope{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.scope .seg span{height:24px;font-size:12px}
.slashline{color:var(--text-tertiary)}
.slash{position:absolute;left:8px;top:calc(100% - 20px);width:240px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:3}
.si{height:30px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px;font-size:13px}
.si svg{width:15px;height:15px;color:var(--text-tertiary)}
.si .t-meta{margin-left:auto;font-family:ui-monospace,Menlo,Consolas,monospace}
.si.on{background:var(--n100)}
.pnl-slash .panel-body{overflow:visible}
""" + """
.pnl-slash .panel-body{overflow:visible}
.slash{top:calc(100% - 22px)}
.ph{color:var(--text-disabled);cursor:text}
.scope{display:flex;align-items:center;gap:8px}
.scope .seg span{height:24px;font-size:12px}
.nsel{background:#e6e3f1;border-radius:2px}
.caret2{display:inline-block;width:1px;height:16px;background:var(--text-primary);vertical-align:-3px;margin-left:1px}
/* toolbar: one floating pill, bottom centre of the panel */
.nfb{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:6px;padding:4px;margin-bottom:8px;background:#fff;width:max-content;
  border:1px solid var(--border);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 10px 24px rgba(0,0,0,.08);z-index:4}
.nfg{display:flex;align-items:center;background:var(--n100);border-radius:9px;padding:0 2px}
.nfbtn{width:28px;height:28px;border:0;background:none;border-radius:7px;display:grid;place-items:center;color:var(--text-primary);cursor:pointer;flex:none}
.nfbtn svg{width:15px;height:15px}.nfbtn:hover{background:var(--n200)}
.nfbtn.on{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.nfs{width:1px;height:14px;background:var(--n300);flex:none}
.pmenu3{position:absolute;right:12px;top:40px;width:200px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;z-index:5;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.pmenu3 .mi>svg{width:15px;height:15px;color:var(--text-tertiary)}
.panel.rz{width:480px;overflow:visible}
.ngrip{position:absolute;left:-5px;top:0;bottom:0;width:10px;cursor:col-resize;z-index:6}
.ngl{position:absolute;left:4px;top:12px;bottom:12px;width:2px;border-radius:2px;background:#bbafd6}
.ngh{position:absolute;left:1px;top:50%;width:8px;height:36px;margin-top:-18px;border-radius:4px;background:#8f74b3}
"""
SWITCH_CSS = """
.pstates{position:fixed;left:12px;bottom:12px;z-index:40;display:flex;gap:8px;align-items:center;background:#111827;color:#fff;padding:6px 8px;border-radius:10px;font-size:12px}
.pstates .seg{background:#374151}.pstates .seg span{color:#d1d5db;cursor:pointer}.pstates .seg span.on{background:#fff;color:#111827}
.states:not(.pstates){display:none}
"""
STATES = [('p-task', 'Task'), ('p-type', 'Typing'), ('p-slash', '"/" menu'), ('p-project', 'Project'), ('p-menu', '⋯ menu'),
          ('p-area', 'Area'), ('p-event', 'Event, repeating'), ('p-empty', 'Empty notes'), ('p-resize', 'Resize')]
switch = ('<div class="states pstates"><span>Mock state</span><div class="seg" id="pst">'
          + ''.join(f'<span{" class=on" if i == 0 else ""} data-p="{k}">{n}</span>' for i, (k, n) in enumerate(STATES)) + '</div></div>'
          '<script>const pst=document.getElementById("pst");pst.onclick=e=>{const p=e.target.dataset.p;if(!p)return;'
          'document.body.className="s-n "+p;pst.querySelectorAll("span").forEach(x=>x.classList.toggle("on",x===e.target));};</script>')
CSS = PANEL_CSS + SWITCH_CSS
html = base.replace('<body class="s-n">', '<body class="s-n p-task">', 1).replace('</style>', CSS + '</style>', 1)
html = html.replace('<title>Life OS — Areas · Projects overview</title>', '<title>Life OS — Detail panel</title>')
html = html.replace('</body>', panels + switch + '</body>', 1)
Path('/mnt/user-data/outputs/approved-detail-panel.html').write_text(html)
print('ok', len(html))
