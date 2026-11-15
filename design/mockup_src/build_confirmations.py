"""Build html_mockups/approved-confirmations.html: the cascade confirm pattern (Phase G, approved Nov 15).

One dialog design for every confirmation that lists what goes with an action: Archive area, Complete / Cancel /
Archive project, Archive routine, and every Delete that has contents.

Dialog (480 px, the approved modal3 frame):
- Title: the action and the name in quotes, e.g. Complete “Resume & portfolio”?
- Optional choice slot on top (repeating event: This event / This and following / All events).
- What goes with it, grouped by effect: CANCELLED, ENDS FROM TODAY, ARCHIVED, DELETED, plus KEPT and STOPS UPDATING
  where the rules keep something. Each group: caps label + grey counter, then rows (entity icon, name, metadata on
  the right). More than 3 rows end with "+n more", which expands in place. The list scrolls inside the dialog
  (max 360 px) with scroll shadows and no scrollbar.
- Footer: one data line on the left (Restore from Archived / Undo for 6 s / Can't be undone, red), then Go back and
  the named action (brand 700; red only for Delete).
- Loading the preview shows skeleton rows with the action disabled. If nothing goes with an archive or status change
  it applies at once with the undo toast (no dialog); Delete always asks. A refused action stays a disabled menu
  item with its reason.

Backdrop: the approved project page (approved-project.html, its Normal state); the dialogs are a pattern sheet,
like approved-pickers.html. Mock today: Sat, Nov 14, 2026.
Usage: python build_confirmations.py <html_mockups dir> <out.html>
"""
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'approved-confirmations.html')


def svg(p, cls=''):
    return f'<svg viewBox="0 0 24 24"{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{p}</svg>'


I = dict(
    cal='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    repeat='<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    metric='<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    folder='<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    history='<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    sched='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M12 12v5M9.5 14.5h5"/>',
    routine='<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    x='<path d="M18 6 6 18M6 6l12 12"/>',
    check='<path d="m5 12 5 5 9-10"/>',
    okc='<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    ex='<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
)


def ic(k):
    return svg(I[k])


# ---------------------------------------------------------------- rows
def row(kind, name, meta='', area='career', done=False, over=False):
    """kind: task, sub, step, event, rep, metric, folder, history, sched, occ."""
    if kind in ('task', 'sub', 'occ'):
        mark = f'<span class="xk {area}{" sm" if kind == "sub" else ""}{" on" if done else ""}">{ic("check") if done else ""}</span>'
    elif kind == 'step':
        mark = f'<span class="xk round {area}"></span>'
    elif kind == 'folder':
        mark = f'<span class="xi {area} col">{ic("folder")}</span>'
    elif kind == 'metric':
        mark = f'<span class="xi {area} col">{ic("metric")}</span>'
    elif kind == 'event':
        mark = f'<span class="xi {area} col">{ic("cal")}</span>'
    else:
        col = f' {area} col' if kind == 'rep' else ''
        mark = f'<span class="xi{col}">{ic({"rep": "repeat", "history": "history", "sched": "sched"}[kind])}</span>'
    m = f'<span class="xm{" over" if over else ""}">{meta}</span>' if meta else ''
    return f'<div class="xr{" dn" if done else ""}">{mark}<span class="xn">{name}</span>{m}</div>'


def group(label, rows, cls='', limit=3):
    if len(rows) <= limit + 1:
        limit = len(rows)
    shown, rest = rows[:limit], rows[limit:]
    more = ''
    if rest:
        more = (f'<div class="xhid">{"".join(rest)}</div>'
                f'<button class="xmore">+{len(rest)} more</button>')
    return (f'<div class="xg {cls}"><div class="xgh"><span class="t-label">{label}</span>'
            f'<span class="counter">{len(rows)}</span></div>{"".join(shown)}{more}</div>')


def dialog(did, title, body, line, action, danger=False, area='career', loading=False, choice=''):
    btn = f'<button class="btn {"danger" if danger else "primary"} xgo{" dis" if loading else ""}">{action}</button>'
    lc = ' neg' if danger else ''
    return (f'<div class="cx ov" id="{did}"><div class="scrim3"></div>'
            f'<div class="modal3 cxm {area}" role="dialog" aria-label="{title}">'
            f'<div class="m-head"><h3>{title}</h3><span class="icon-btn xclose" style="margin:0">{ic("x")}</span></div>'
            f'<div class="m-body cxb">{choice}{f"<div class={chr(34)}xs{chr(34)}><div class={chr(34)}xl{chr(34)}>{body}</div></div>" if body else ""}</div>'
            f'<div class="m-foot"><span class="xline{lc}">{line}</span><button class="btn xback">Go back</button>{btn}</div></div></div>')


# ---------------------------------------------------------------- data (project: Resume & portfolio, Career)
CANCEL_ROWS = [row('task', 'Update resume', 'Nov 4', over=True),
               row('task', 'Ask Prof. Reyes for a reference', 'Nov 26'),
               row('event', 'Mock interview with Ana', 'Fri, Nov 20 · 2 PM')]
ENDS_ROWS = [row('event', 'Portfolio check-in', 'Every Sun · last on Nov 8')]
ARCH_PART = [row('rep', 'Check job boards', 'Every Mon'),
             row('step', 'Post one LinkedIn update', 'Weekly reset'),
             row('metric', 'Portfolio pieces', '2 entries · 1 target'),
             row('metric', 'Recruiter replies', '3 entries · 1 target')]


def status_body():
    return (group('Cancelled', CANCEL_ROWS) + group('Ends from today', ENDS_ROWS) + group('Archived', ARCH_PART))


ARCH_PROJECT = [row('task', 'Update resume', 'Nov 4', over=True),
                row('task', 'Ask Prof. Reyes for a reference', 'Nov 26'),
                row('task', 'Write the About page', done=True),
                row('task', 'Export portfolio PDF', done=True),
                row('task', 'Collect project screenshots', done=True),
                row('event', 'Mock interview with Ana', 'Fri, Nov 20 · 2 PM'),
                row('event', 'Portfolio check-in', 'Every Sun'),
                ] + ARCH_PART

AREA_ROWS = [row('folder', 'Resume &amp; portfolio', '5 tasks · 2 events · 2 metrics'),
             row('folder', 'Hackathon prep', '8 tasks · 1 event'),
             row('task', 'Draft the hackathon pitch', 'Nov 15'),
             row('task', 'Reply to the recruiter at Lumen', 'Nov 17'),
             row('task', 'Read the Rust book, ch. 4'),
             row('task', 'Renew the Coursera plan', 'Nov 30'),
             row('event', 'Career fair', 'Thu, Nov 26 · 9 AM – 4 PM'),
             row('event', 'Mentor call', 'Every other Wed'),
             row('rep', 'Weekly applications review', 'Every Fri'),
             row('step', 'Study 30 minutes', 'Morning routine'),
             row('step', 'Post one LinkedIn update', 'Weekly reset'),
             row('metric', 'Study hours', '41 entries · 1 target'),
             row('metric', 'Networking chats', '9 entries · 1 target')]

ROUT_STEPS = [row('step', 'Plan the week', 'Personal', area='personal'),
              row('step', 'Clean the desk', 'Home', area='home'),
              row('step', 'Review finances', 'Finance', area='finance'),
              row('step', 'Post one LinkedIn update', 'Resume &amp; portfolio'),
              row('step', 'Laundry', 'Home', area='home')]

EVE_STEPS = [row('step', 'Read 10 pages', 'Personal', area='personal'),
             row('step', 'Stretch', 'Health', area='health'),
             row('step', 'Journal', 'Personal', area='personal'),
             row('step', 'Lay out tomorrow’s clothes', 'Home', area='home')]


def ev_body(which):
    if which == 'one':
        return ''
    if which == 'follow':
        return group('Deleted', [row('event', 'Portfolio check-in', 'Sun, Nov 15 and later'),
                                 row('sched', 'Moved occurrence', 'Nov 29 → Sat, Nov 28')])
    return group('Deleted', [row('event', 'Portfolio check-in', 'Every Sun · from Oct 4'),
                             row('sched', 'Moved occurrence', 'Nov 29 → Sat, Nov 28'),
                             row('sched', 'Skipped occurrence', 'Oct 18')])


def choice(sel):
    opts = [('one', 'This event', 'Sun, Nov 15'), ('follow', 'This and following', 'From Sun, Nov 15'),
            ('all', 'All events', '7 past · upcoming')]
    return '<div class="xc">' + ''.join(
        f'<label class="xco{" on" if k == sel else ""}" data-c="{k}"><span class="rad"></span><span class="xn">{t}</span>'
        f'<span class="xm">{m}</span></label>' for k, t, m in opts) + '</div>'


def ev_dialog(did, sel):
    bodies = ''.join(f'<div class="xev" data-c="{k}"{"" if k == sel else " hidden"}>{ev_body(k)}</div>' for k in ('one', 'follow', 'all'))
    return dialog(did, 'Delete “Portfolio check-in”?', bodies, 'Can’t be undone', 'Delete event', danger=True, choice=choice(sel))


SKEL = '<div class="xg"><div class="xgh"><span class="sk" style="width:72px"></span></div>' + ''.join(
    f'<div class="xr"><span class="sk sq"></span><span class="sk" style="width:{w}px"></span></div>' for w in (180, 220, 150)) + '</div>'


def dialogs():
    d = ''
    d += dialog('d-complete', 'Complete “Resume &amp; portfolio”?', status_body(), 'Undo for 6 s', 'Complete project')
    d += dialog('d-cancel', 'Cancel “Resume &amp; portfolio”?', status_body(), 'Undo for 6 s', 'Cancel project')
    d += dialog('d-archp', 'Archive “Resume &amp; portfolio”?', group('Archived', ARCH_PROJECT), 'Restore from Archived', 'Archive project')
    d += dialog('d-archa', 'Archive “Career”?', group('Archived', AREA_ROWS), 'Restore from Archived', 'Archive area')
    d += dialog('d-archr', 'Archive “Weekly reset”?',
                group('Archived', ROUT_STEPS) + group('Stops updating', [row('metric', 'Weekly resets done', '12 days kept', area='personal')]),
                'Restore from Archived', 'Archive routine')
    d += dialog('d-delr', 'Delete “Evening routine”?',
                group('Deleted', EVE_STEPS + [row('history', 'History', '286 logs · 104 days'),
                                              row('sched', 'Schedules', '2')]),
                'Can’t be undone', 'Delete routine', danger=True)
    d += dialog('d-delt', 'Delete “Check job boards”?',
                group('Deleted', [row('sub', 'Open LinkedIn Jobs'), row('sub', 'Save 3 postings'),
                                  row('occ', 'Check job boards', 'Mon, Nov 16')])
                + group('Kept', [row('occ', 'Check job boards', '9 done · 1 cancelled', done=True)]),
                'Can’t be undone', 'Delete recurring task', danger=True)
    d += ev_dialog('d-ev1', 'one') + ev_dialog('d-ev2', 'follow') + ev_dialog('d-ev3', 'all')
    d += dialog('d-dela', 'Delete “Side projects”?', '', 'Can’t be undone', 'Delete area', danger=True, area='personal')
    d += dialog('d-load', 'Archive “Resume &amp; portfolio”?', SKEL, 'Restore from Archived', 'Archive project', loading=True)
    return d


TOAST = (f'<div class="xtoast" id="toast"><span class="ok">{ic("okc")}</span><span class="tmsg"></span>'
         '<button class="link tundo">Undo</button><kbd>Ctrl Z</kbd></div>')

CSS = r"""
.cx{display:none}.cx.on{display:block}
.cxm{width:480px;max-height:calc(100vh - 96px)}
.cxb{gap:12px;padding:12px 20px 16px;min-height:0;flex:1;display:flex;flex-direction:column}
.cxm .m-head h3{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
.m-foot{align-items:center}
.xline{margin-right:auto;font-size:12px;line-height:16px;color:var(--text-tertiary)}
.xline.neg{color:var(--danger)}
.btn.danger{background:#cc363c;border-color:#cc363c;color:#fff}
.btn.dis{opacity:.45;cursor:not-allowed}
/* list: scrolls inside the dialog, scroll shadows, no scrollbar */
.xs{position:relative;min-height:0;display:flex;flex-direction:column}
.xl{max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:12px;scrollbar-width:none}
.xs::before,.xs::after{content:"";position:absolute;left:-20px;right:-20px;height:12px;pointer-events:none;opacity:0;transition:opacity .15s;z-index:1}
.xs::before{top:0;background:linear-gradient(rgba(17,24,39,.08),rgba(17,24,39,0))}
.xs::after{bottom:0;background:linear-gradient(rgba(17,24,39,0),rgba(17,24,39,.08))}
.xs.st::before,.xs.sb::after{opacity:1}
.xg{display:flex;flex-direction:column}
.xgh{height:24px;display:flex;align-items:center;gap:6px}
.xg.del .t-label{color:var(--danger)}
.xr{height:28px;display:flex;align-items:center;gap:8px;padding:0 8px;margin:0 -8px;border-radius:6px}
.xr:hover{background:var(--n50)}
.xn{font-size:13px;line-height:20px;color:var(--text-primary);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xm{font-size:12px;line-height:16px;color:var(--text-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.xm.over{color:var(--danger)}
.xr.dn .xn{color:var(--text-tertiary);text-decoration:line-through}
.xk{width:14px;height:14px;flex:none;border-radius:4px;border:1.5px solid var(--a-solid);display:grid;place-items:center;margin:0 1px}
.xk.sm{width:12px;height:12px;border-radius:3px;margin:0 2px;border-color:var(--n400)}
.xk.round{border-radius:50%}
.xk.on{background:var(--n300);border-color:var(--n300);color:#fff}
.xk svg{width:10px;height:10px;stroke-width:3}
.xi{width:16px;height:16px;flex:none;display:grid;place-items:center;color:var(--text-tertiary)}
.xi.col{color:var(--a-solid)}
.xi svg{width:14px;height:14px}
.xhid{display:none;flex-direction:column}
.xg.open .xhid{display:flex}
.xg.open .xmore{display:none}
.xmore{align-self:flex-start;height:24px;margin:2px 0 0 -6px;padding:0 6px;border:0;border-radius:4px;background:none;font:500 12px/16px Inter,sans-serif;color:var(--text-secondary);cursor:pointer}
.xmore:hover{background:var(--n100);color:var(--text-primary)}
/* choice slot (repeating event) */
.xc{display:flex;flex-direction:column;gap:4px}
.xco{height:36px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer}
.xco.on{border-color:var(--acc600);background:var(--acc100)}
.rad{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--n400);flex:none;display:grid;place-items:center}
.xco.on .rad{border-color:var(--acc700)}
.xco.on .rad::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--acc700)}
.xev[hidden]{display:none}
/* skeleton */
.sk{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--n100),var(--n200),var(--n100));background-size:200% 100%;animation:sk 1.2s linear infinite}
.sk.sq{width:14px;height:14px;border-radius:4px}
@keyframes sk{to{background-position:-200% 0}}
/* toast: the app's one toast */
.xtoast{display:none;position:fixed;bottom:72px;left:calc(288px + (100vw - 288px)/2);transform:translateX(-50%);height:40px;align-items:center;gap:10px;
  padding:0 8px 0 12px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);
  z-index:40;font-size:13px;line-height:20px;color:var(--text-primary);white-space:nowrap}
.xtoast.on{display:flex}
.xtoast .ok{color:#328f32;display:grid}.xtoast .ok svg{width:18px;height:18px}
.xtoast .link{border:0;background:none;font:600 12px/16px Inter,sans-serif;color:var(--acc700);padding:4px 6px;border-radius:4px;cursor:pointer}
.xtoast .link:hover{background:var(--acc100)}
.xtoast kbd{font:500 11px/16px Inter,sans-serif;color:var(--text-tertiary);border:1px solid var(--border);border-radius:4px;padding:0 4px}
.states .seg{flex-wrap:wrap}
"""

JS = r"""
const st=document.getElementById('st'),toast=document.getElementById('toast');
function shadows(){document.querySelectorAll('.cx.on .xs').forEach(s=>{const l=s.firstElementChild;
  s.classList.toggle('st',l.scrollTop>0);s.classList.toggle('sb',l.scrollTop+l.clientHeight<l.scrollHeight-1)})}
function closeAll(){document.querySelectorAll('.cx').forEach(c=>c.classList.remove('on'));}
function showToast(m){toast.querySelector('.tmsg').textContent=m;toast.classList.add('on')}
function setState(sp){st.querySelectorAll('span[data-ov]').forEach(x=>x.classList.toggle('on',x===sp));
  closeAll();toast.classList.remove('on');document.body.className=sp.dataset.b||'s-normal';
  document.querySelectorAll('.xg.open').forEach(g=>g.classList.remove('open'));
  const o=sp.dataset.ov;if(o){const d=document.getElementById(o);d.classList.add('on');
    if(sp.dataset.act==='expand'){d.querySelectorAll('.xg').forEach(g=>g.classList.add('open'))}}
  if(sp.dataset.toast)showToast(sp.dataset.toast);
  requestAnimationFrame(shadows)}
st.onclick=e=>{const sp=e.target.closest('span[data-ov]');if(sp)setState(sp)};
document.addEventListener('click',e=>{
  const m=e.target.closest('.xmore');if(m){m.closest('.xg').classList.add('open');shadows();return}
  const c=e.target.closest('.xco');if(c){const d=c.closest('.cx');d.querySelectorAll('.xco').forEach(x=>x.classList.toggle('on',x===c));
    d.querySelectorAll('.xev').forEach(x=>x.hidden=x.dataset.c!==c.dataset.c);shadows();return}
  if(e.target.closest('.xback,.xclose,.scrim3')){closeAll();return}
  const g=e.target.closest('.xgo');if(g&&!g.classList.contains('dis')){const d=g.closest('.cx');closeAll();
    showToast(d.dataset.done||'Done');return}
  if(e.target.closest('.tundo'))toast.classList.remove('on');
});
document.querySelectorAll('.xl').forEach(l=>l.addEventListener('scroll',shadows));
setState(st.querySelector('span.on'));
"""

# what the toast says after confirming
DONE = {
    'd-complete': 'Completed “Resume & portfolio” · 2 tasks cancelled',
    'd-cancel': 'Cancelled “Resume & portfolio” · 2 tasks cancelled',
    'd-archp': 'Archived “Resume & portfolio”',
    'd-archa': 'Archived “Career”',
    'd-archr': 'Archived “Weekly reset”',
    'd-delr': 'Deleted “Evening routine”',
    'd-delt': 'Deleted “Check job boards”',
    'd-ev1': 'Deleted “Portfolio check-in” on Nov 15',
    'd-ev2': 'Deleted “Portfolio check-in” from Nov 15',
    'd-ev3': 'Deleted “Portfolio check-in”',
    'd-dela': 'Deleted “Side projects”',
}

STATES = [  # label, dialog, body class, action, toast
    ('Complete project', 'd-complete', '', '', ''),
    ('Cancel project', 'd-cancel', '', '', ''),
    ('Archive project', 'd-archp', '', '', ''),
    ('Archive project, list open', 'd-archp', '', 'expand', ''),
    ('Archive area', 'd-archa', '', '', ''),
    ('Archive area, list open (scrolls)', 'd-archa', '', 'expand', ''),
    ('Archive routine', 'd-archr', '', '', ''),
    ('Delete routine', 'd-delr', '', '', ''),
    ('Delete recurring task', 'd-delt', '', '', ''),
    ('Delete event: This event', 'd-ev1', '', '', ''),
    ('Delete event: This and following', 'd-ev2', '', '', ''),
    ('Delete event: All events', 'd-ev3', '', '', ''),
    ('Delete, nothing goes with it', 'd-dela', '', '', ''),
    ('Loading the preview', 'd-load', '', '', ''),
    ('Refused (disabled item)', '', 's-more', '', ''),
    ('Confirmed, undo toast', '', '', '', DONE['d-complete']),
    ('Nothing goes with it: applied at once', '', '', '', 'Archived “Side quest”'),
]


def build():
    base = (SRC / 'approved-project.html').read_text(encoding='utf-8')
    head_css = base[base.index('<style>') + 7:base.index('</style>')]
    body = base[base.index('<body'):base.index('<div class="states"')]
    body = re.sub(r'<body class="[^"]*">', '', body, count=1)
    ds = dialogs()
    for k, v in DONE.items():
        ds = ds.replace(f'id="{k}"', f'id="{k}" data-done="{v}"', 1)
    # DELETED labels in red
    ds = ds.replace('<div class="xg "><div class="xgh"><span class="t-label">Deleted', '<div class="xg del"><div class="xgh"><span class="t-label">Deleted')
    sw = ''.join(f'<span{" class=on" if n == 0 else ""} data-ov="{o}" data-b="{b or "s-normal"}" data-act="{a}" data-toast="{t}">{l}</span>'
                 for n, (l, o, b, a, t) in enumerate(STATES))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Life OS — Confirmations, all states</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{head_css}{CSS}</style></head>
<body class="s-normal">
{body}
{ds}
{TOAST}
<div class="states"><span>Mock state</span><div class="seg" id="st">{sw}</div></div>
<div id="tip"></div>
<script>{JS}</script>
</body></html>'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT, len(html))


if __name__ == '__main__':
    build()
