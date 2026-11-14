"""Builds the batch A mock-up: Calendar > Week board, repeat picker, series dialog, undo popup."""
from pathlib import Path

V13 = Path('/home/claude/v13.css').read_text()

# ---------- icons ----------
I = {
  'flag': '<path d="M4 22V4l7 2 9-2v12l-9 2-7-2"/>',
  'folder': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'repeat': '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  'cal': '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>',
  'chev': '<path d="m6 9 6 6 6-6"/>',
  'left': '<path d="m15 18-6-6 6-6"/>',
  'right': '<path d="m9 18 6-6-6-6"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'flame': '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-6-12-2 3-6 6-6 11 0 1 .2 2 .6 3A3 3 0 0 1 6 14c-1 1-1 2.5-1 3 0 3 3 5 7 5z"/>',
  'inbox': '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  'layers': '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  'agenda': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  'filter': '<path d="M3 5h18M6 12h12M10 19h4"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'checkc': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'more': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>',
  'area': '<circle cx="7" cy="7" r="4"/><rect x="13" y="13" width="8" height="8" rx="4"/>',
  'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}
def ic(name, cls=''):
    c = f' class="{cls}"' if cls else ''
    return f'<svg viewBox="0 0 24 24"{c}>{I[name]}</svg>'

# ---------- card builders ----------
def meta(*parts):
    parts = [p for p in parts if p]
    return f'<span class="meta t-meta">{" ".join(parts)}</span>' if parts else ''

def proj(name):
    return f'<span class="mp">{ic("folder", "pi")}<span class="pn">{name}</span></span>'

def flag(level):
    return ic('flag', {'high': 'flag-high', 'med': 'flag-med'}[level]) if level else ''

def task(title, area, *, pr=None, project=None, due=None, overdue=False, rep=False,
         done=False, subs=None, sub_open=False, extra=''):
    lead = []
    if pr: lead.append(flag(pr))
    if rep: lead.append(ic('repeat'))
    if due:
        lead.append(f'<span class="overdue">{due} · Overdue</span>' if overdue else f'<span class="dd">{due}</span>')
    m = []
    if lead: m.append(f'<span class="lead">{"".join(lead)}</span>')
    if project: m.append(proj(project))
    metahtml = meta(*m)
    sub_html = ''
    if subs:
        n = sum(1 for d, _ in subs if d)
        counter = f'<span class="sub-counter">{n}/{len(subs)}{ic("chev")}</span>'
        metahtml = meta(*m, counter)
        if sub_open:
            rows = ''.join(f'<div class="subtask{" done" if d else ""}"><span class="check{" done" if d else ""}"></span><span class="t-subtask">{t}</span></div>' for d, t in subs)
            sub_html = f'<div class="subtasks">{rows}</div>'
    cls = 'card' + (' done' if done else '') + (f' {extra}' if extra else '')
    return (f'<div class="{cls} {area}"><span class="check{" done" if done else ""}"></span>'
            f'<div class="body"><span class="t-card">{title}</span>{metahtml}{sub_html}</div></div>')

def event(title, area, when, past=False, rep=False):
    m = meta(ic('repeat') if rep else '', when)
    return (f'<div class="card event{" past" if past else ""} {area}"><span class="ev-icon">{ic("cal")}</span>'
            f'<div class="body"><span class="t-card">{title}</span>{m}</div></div>')

def routine(title, steps, streak=None, open_=True):
    """steps: list of (state, area, text) with state in todo/done/missed/skipped."""
    done = sum(1 for s, _, _ in steps if s == 'done')
    due = sum(1 for s, _, _ in steps if s != 'skipped')
    pct = round(100 * done / due) if due else 0
    rows = ''.join(
        f'<div class="subtask step {s}"><span class="check round {a}{" done" if s == "done" else ""}"></span><span class="t-subtask">{t}</span></div>'
        for s, a, t in steps)
    left = f'<span class="meta t-meta">{ic("flame")}{streak} days</span>' if streak else '<span></span>'
    return (f'<div class="card routine"><span class="pring" style="--p:{pct}%"></span><div class="body">'
            f'<span class="t-card">{title}</span>'
            f'<div class="meta-row">{left}<span class="sub-counter">{done}/{due}{ic("chev")}</span></div>'
            f'{"<div class=subtasks>" + rows + "</div>" if open_ else ""}</div></div>')

def col(head, cards, cls='', count=None, today=False, past=False, num=None, extra_inside=''):
    cnt = f'<span class="counter">{count}</span>' if count else ''
    if num is not None:
        title = f'<span class="t-heading">{head}</span><span class="daynum">{num}</span>'
    else:
        title = f'<span class="t-heading">{head}</span>'
    c = 'col day' + (' today' if today else '') + (' past' if past else '') + (f' {cls}' if cls else '')
    return (f'<section class="{c}"><div class="col-head">{title}{cnt}'
            f'<span class="icon-btn">{ic("plus")}</span></div>'
            f'<div class="stack">{"".join(cards)}</div>{extra_inside}</section>')

# ---------- data: week of Mon Nov 9 – Sun Nov 15, 2026; today = Sat Nov 14 ----------
MORNING = ['Stretch 10 minutes', 'Drink a glass of water', 'Review today\'s plan', 'Journal 5 minutes']
MAREA = ['health', 'health', 'personal', 'personal']
def morning(states, streak=None, open_=False):
    return routine('Morning routine', [(s, a, t) for s, a, t in zip(states, MAREA, MORNING)], streak, open_)

unsched = col('Unscheduled', [
    task('Collect project screenshots', 'career', project='Life OS app', extra='src'),
    task('Research weekly review apps', 'noarea', due='Nov 18'),
    task('Open a savings account', 'finance', project='Emergency fund', due='Dec 1'),
    task('Research speaking clubs', 'personal'),
    task('Organize the closet', 'home', pr='med'),
    task('Sort downloads folder', 'noarea'),
], cls='unsched', count=6)

mon = col('Mon', [
    event('Dentist appointment', 'health', '10:00 AM', past=True),
    morning(['done'] * 4),
    task('Pay internet bill', 'finance', rep=True, done=True),
    task('Clean the fridge', 'home', done=True),
], past=True, num=9)

tue = col('Tue', [
    morning(['done', 'done', 'missed', 'done']),
    task('Review the Phase 2 PR', 'career', project='Life OS app', done=True),
    task('Laundry', 'home', done=True),
], past=True, num=10)

wed = col('Wed', [
    event('Coffee with Mia', 'relation', '4:00 PM', past=True),
    morning(['done'] * 4),
    task('Run 5 km', 'health', project='5K training', done=True),
], past=True, num=11)

thu = col('Thu', [
    event('Hackathon info session', 'career', '7:00 PM', past=True),
    morning(['done', 'missed', 'missed', 'done']),
    task('Plan the first meetup', 'relation', done=True),
], past=True, num=12)

fri = col('Fri', [
    event('Hackathon weekend', 'career', 'Nov 13 – 15 · 6:00 PM'),
    morning(['done', 'done', 'skipped', 'done']),
    task('Weekly budget check', 'finance', rep=True, done=True),
    task('Draft portfolio page', 'career', project='Resume & portfolio', done=True),
], past=True, num=13)

sat = col('Sat', [
    event('Hackathon weekend', 'career', 'Nov 13 – 15 · All day'),
    morning(['done', 'todo', 'todo', 'todo'], streak=4, open_=True),
    task('Update resume', 'career', pr='high', project='Resume & portfolio', due='Nov 4', overdue=True,
         subs=[(True, 'Add projects section'), (False, 'Fix formatting'), (False, 'Ask a friend to review')], sub_open=True),
    task('Buy running shoes', 'health', pr='med', project='5K training', due='Nov 7', overdue=True),
    task('Fix the leaking faucet', 'home', pr='high', due='Nov 16'),
    task('Reply to Kuya\'s message', 'noarea', pr='med'),
    task('Pay insurance', 'finance', rep=True, due='Nov 15', done=True),
], today=True, count=4, num=14)

sun = col('Sun', [
    event('Hackathon weekend', 'career', 'Nov 13 – 15 · Ends 3:00 PM'),
    routine('Weekly reset', [('todo', 'home', 'Tidy the desk'), ('todo', 'finance', 'Log expenses'), ('todo', 'personal', 'Plan next week')], open_=False),
    task('Long run', 'health', rep=True, project='5K training', extra='sel'),
    task('Meal prep', 'home'),
], count=2, num=15,
   extra_inside='<div class="drag-ghost card career"><span class="check"></span><div class="body"><span class="t-card">Collect project screenshots</span>'
                f'<span class="meta t-meta">{proj("Life OS app")}</span></div></div>')

# the drop placeholder goes after the first task card in Sunday
sun = sun.replace('<div class="card  health', '<div class="drop"></div><div class="card  health', 1) if False else sun
sun = sun.replace('<div class="card sel health">', '<div class="drop"></div><div class="card sel health">', 1)

board = ''.join([unsched, '<div class="week">', mon, tue, wed, thu, fri, sat, sun, '</div>'])

# ---------- mini month ----------
def minimonth():
    # November 2026 starts on Sunday -> Monday-first grid begins Oct 26
    cells = []
    days = list(range(26, 32)) + list(range(1, 31)) + list(range(1, 7))
    for i, d in enumerate(days):
        other = i < 6 or i >= 36
        wk = 'w' if 14 <= i <= 20 else ''
        cls = ' '.join(c for c in ['o' if other else '', wk, 't' if (not other and d == 14) else ''] if c)
        cells.append(f'<span class="{cls}">{d}</span>')
    rows = ''.join(cells)
    return (f'<div class="mm"><div class="mm-head"><span class="t-heading">November 2026</span>'
            f'<span class="icon-btn" style="margin-left:auto">{ic("left")}</span><span class="icon-btn" style="margin:0">{ic("right")}</span></div>'
            f'<div class="mm-grid"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>{rows}</div></div>')

def sitem(label, area=None, count=None, on=False, icon=None, check=None):
    lead = ''
    if area: lead = '<span class="dot"></span>'
    elif icon: lead = ic(icon)
    if check is not None:
        lead = f'<span class="mini-check{" on" if check else ""}">{ic("check") if check else ""}</span>'
    c = f'<span class="c">{count}</span>' if count is not None else ''
    return f'<div class="item{" on" if on else ""}{" " + area if area else ""}">{lead}{label}{c}</div>'

sidebar = (minimonth() + '<div class="side-divider"></div>'
  '<div class="sec"><div class="t-label">Areas</div>'
  + sitem('All areas', icon='layers', count=27, on=True)
  + sitem('Career', 'career', 6) + sitem('Finance', 'finance', 4) + sitem('Health &amp; Beauty', 'health', 4)
  + sitem('Personal', 'personal', 2) + sitem('Relationships', 'relation', 2) + sitem('Home', 'home', 5)
  + sitem('Inbox', icon='inbox', count=3) + '</div>'
  '<div class="side-divider"></div>'
  '<div class="sec"><div class="t-label">Show</div>'
  + sitem('Events', check=True) + sitem('Routine steps', check=True) + sitem('Completed tasks', check=True)
  + sitem('Cancelled tasks', check=False) + '</div>')

rail_icons = [
  ('Home', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  ('Tasks', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>'),
  ('Calendar', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  ('Areas', '<circle cx="7" cy="7" r="4"/><rect x="13" y="3" width="8" height="8" rx="1"/><path d="M7 13l4 8H3z"/><rect x="13" y="13" width="8" height="8" rx="4"/>'),
  ('Projects', I['folder']),
  ('Routines', I['repeat']),
  ('Stats', '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
]
rail = ''.join(f'<a{" class=on" if n == "Calendar" else ""} title="{n}"><svg viewBox="0 0 24 24">{p}</svg></a>' for n, p in rail_icons)
SETTINGS = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'

# ---------- detail panel for "Long run" + repeat picker ----------
panel = f'''
<aside class="panel health" aria-label="Task details">
  <div class="panel-head">
    <span class="check head-check" title="Mark done"></span>
    <span class="vdiv"></span>
    <button class="qbtn" title="Priority: None · Eliminate">{ic('flag')}</button>
    <span class="vdiv"></span>
    <button class="qbtn" title="Due date">{ic('cal')}No due date</button>
    <span style="flex:1"></span>
    <span class="icon-btn" style="margin:0">{ic('more')}</span>
  </div>
  <div class="panel-body">
    <h2>Long run</h2>
    <div class="props">
      <span class="k">{ic('area')}Area</span><span class="v"><span class="tag area"><span class="dot"></span>Health &amp; Beauty</span></span>
      <span class="k">{ic('folder')}Project</span><span class="v"><span class="tag neutral">5K training</span></span>
      <span class="k">{ic('sun')}Scheduled</span><span class="v">Sun, Nov 15</span>
      <span class="k">{ic('repeat')}Repeat</span><span class="v"><span class="prop-btn on">Weekly on Sunday{ic('chev')}</span></span>
    </div>
    <div class="divider"></div>
    <div>
      <div style="display:flex;align-items:center;gap:6px;height:24px;margin-bottom:4px"><span class="t-label">Subtasks</span><span class="counter">0/2</span></div>
      <div class="subtask"><span class="check"></span><span>Warm up 10 minutes</span></div>
      <div class="subtask"><span class="check"></span><span>Run 8 km at easy pace</span></div>
    </div>
    <div class="divider"></div>
    <div><div class="t-label" style="margin-bottom:6px">Notes</div><p class="notes">Keep the pace conversational. Log the distance in the Distance run metric.</p></div>
  </div>
</aside>'''

days = ''.join(f'<span class="wd{" on" if d == "S2" else ""}">{d[0]}</span>' for d in ['M', 'T', 'W', 'T', 'F', 'S', 'S2'])
picker = f'''
<div class="pop picker health">
  <div class="pop-sec">
    <div class="opt">Does not repeat</div>
    <div class="opt">Daily</div>
    <div class="opt">Every weekday (Mon – Fri)</div>
    <div class="opt on">Weekly on Sunday{ic('check')}</div>
    <div class="opt">Monthly on the 15th</div>
    <div class="opt">Yearly on Nov 15</div>
  </div>
  <div class="divider"></div>
  <div class="pop-sec custom">
    <div class="t-label">Custom</div>
    <div class="frow"><span class="fl">Every</span><span class="field num">1</span><span class="field sel">week{ic('chev')}</span></div>
    <div class="frow"><span class="fl">On</span><div class="wds">{days}</div></div>
    <div class="frow"><span class="fl">Repeat from</span><div class="seg"><span class="on">Schedule</span><span>Completion</span></div></div>
    <div class="frow"><span class="fl">Starts</span><span class="field sel">Nov 15, 2026{ic('cal')}</span></div>
    <div class="frow top"><span class="fl">Ends</span>
      <div class="radios">
        <label class="r on"><span class="rd"></span>Never</label>
        <label class="r"><span class="rd"></span>On<span class="field sel dim">Mar 21, 2027{ic('cal')}</span></label>
        <label class="r"><span class="rd"></span>After<span class="field num dim">12</span>times</label>
      </div>
    </div>
    <p class="hint t-meta">Every week on Sunday, from Nov 15</p>
  </div>
  <div class="pop-foot"><button class="btn">Cancel</button><button class="btn primary">Save</button></div>
</div>'''

series = f'''
<div class="scrim"></div>
<div class="modal" role="dialog" aria-label="Change recurring task">
  <h3 class="t-heading" style="font-size:16px;line-height:24px">Change recurring task</h3>
  <p class="t-body">“Long run” repeats every week. Apply the new repeat rule to:</p>
  <div class="radios big">
    <label class="r"><span class="rd"></span><span><b>This task</b><span class="t-meta">Only Sun, Nov 15</span></span></label>
    <label class="r on"><span class="rd"></span><span><b>This and following tasks</b><span class="t-meta">From Nov 15 on. Earlier tasks stay as they are.</span></span></label>
    <label class="r"><span class="rd"></span><span><b>All tasks</b><span class="t-meta">Every unfinished task in the series</span></span></label>
  </div>
  <p class="warn t-meta">{ic('clock')}Changing the series can't be undone.</p>
  <div class="pop-foot" style="padding:0;border:0"><button class="btn">Cancel</button><button class="btn primary">Apply</button></div>
</div>'''

toast = f'''
<div class="toast" role="status">
  <span class="ok">{ic('checkc')}</span>
  <span class="msg">Completed “Pay insurance”</span>
  <button class="link">Undo</button><kbd>Ctrl Z</kbd>
  <span class="icon-btn" style="margin:0">{ic('x')}</span>
</div>'''

NEW_CSS = '''
/* ---------- batch A additions ---------- */
svg{stroke-width:2}
:root{--acc-solid:#a18ec4}
.career{--a-past:#f3f6fc}.finance{--a-past:#f0fdfb}.health{--a-past:#fbf4f8}.personal{--a-past:#fbf8fb}.relation{--a-past:#fbfbeb}.home{--a-past:#fbf6f1}.noarea{--a-past:var(--n50)}
.side{border-right:0;overflow:auto}
.board{mask-image:none;overflow:hidden;min-height:0;align-items:stretch}
.col{min-height:0}
.col .stack{overflow:auto;min-height:0;padding-bottom:4px}
.col.unsched{width:240px;flex:none;padding-right:16px;border-right:1px solid var(--border)}
.week{flex:1;min-width:0;display:flex;gap:var(--board-gap)}
.col.day:not(.unsched){flex:1;min-width:176px;width:auto;position:relative}
.col-head .icon-btn{opacity:0}.col:hover .col-head .icon-btn,.col.today .col-head .icon-btn{opacity:1}
.daynum{font-size:16px;line-height:24px;font-weight:600;color:var(--text-primary);min-width:24px;height:24px;border-radius:999px;display:inline-grid;place-items:center;margin-left:-4px}
.col.past .col-head .t-heading,.col.past .daynum{color:var(--text-tertiary)}
.col.today .daynum{background:var(--acc-solid);color:#fff;padding:0 6px;margin-left:-2px}
/* meta project */
.mp{display:inline-flex;align-items:center;gap:4px;min-width:0}
.mp .pi{color:var(--a-solid)}
.card.done .mp .pi{color:var(--text-disabled)}
.meta{flex-wrap:wrap;min-width:0;white-space:nowrap;row-gap:0}
.meta .lead{display:inline-flex;align-items:center;gap:6px;flex:none}
.meta .mp{max-width:100%}
.meta .sub-counter{margin-left:auto;flex:none}
.meta:has(.sub-counter) .mp{max-width:calc(100% - 52px)}
.meta-row .meta{flex:1;min-width:0}
.mp .pn{overflow:hidden;text-overflow:ellipsis;min-width:0}
.meta .overdue,.meta .dd,.meta .sep,.meta>svg{flex:none}
.card.event .meta{white-space:normal;flex-wrap:wrap}
.card .subtask{height:auto;min-height:20px;align-items:flex-start;padding:2px 0}
.card .subtask .check{margin-top:1px}
.card .subtasks{gap:0}
/* events */
.card.event.past{background:var(--a-past)}
.card.event.past .ev-icon{background:var(--a-border)}
/* routine card */
.pring{width:16px;height:16px;border-radius:50%;flex:none;margin-top:2px;background:conic-gradient(var(--n500) var(--p),var(--n200) 0);
  -webkit-mask:radial-gradient(circle,transparent 4.5px,#000 5px);mask:radial-gradient(circle,transparent 4.5px,#000 5px)}
.card.routine .t-card{font-weight:500}
.step .check{margin:0}
.step.done span.t-subtask{color:var(--text-disabled);text-decoration:line-through}
.step.missed .check,.step.skipped .check{border-color:var(--n300);position:relative}
.step.missed .check::after{content:"×";font-size:12px;line-height:10px;color:var(--n400);font-weight:600}
.step.skipped .check::after{content:"";width:6px;height:2px;background:var(--n400);border-radius:1px}
.step.missed span.t-subtask,.step.skipped span.t-subtask{color:var(--text-tertiary)}
.meta svg.flame{color:var(--n500)}
/* mini month */
.mm{padding:0 4px}
.mm-head{height:28px;display:flex;align-items:center;gap:2px;margin-bottom:4px}
.mm-head .t-heading{font-size:13px}
.mm-grid{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px;text-align:center;font-size:11px;line-height:16px}
.mm-grid b{font-weight:600;color:var(--text-tertiary);height:20px;display:grid;place-items:center}
.mm-grid span{height:24px;display:grid;place-items:center;color:var(--text-secondary);font-weight:500;position:relative}
.mm-grid span.o{color:var(--n400)}
.mm-grid span.w{background:var(--n100)}
.mm-grid span.w:nth-child(7n+1){border-radius:var(--r-control) 0 0 var(--r-control)}
.mm-grid span.w:nth-child(7n){border-radius:0 var(--r-control) var(--r-control) 0}
.mm-grid span.t{color:#fff}
.mm-grid span.t::before{content:"";position:absolute;width:22px;height:22px;border-radius:50%;background:var(--acc-solid);z-index:0}
.mm-grid span.t{z-index:0}
.mm-grid span.t{isolation:isolate}
.mm-grid span.t::before{z-index:-1}
.mini-check{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--n400);display:grid;place-items:center;margin:0 1px}
.mini-check.on{background:var(--n600);border-color:var(--n600);color:#fff}
.mini-check svg{width:10px;height:10px;stroke-width:3}
/* header */
.page-head .nav{display:flex;gap:2px;margin-left:-6px}
.page-head .nav .icon-btn{margin:0;width:28px;height:28px}
.btn.icon{width:28px;padding:0;justify-content:center}
.btn.primary{background:var(--acc-solid);border-color:var(--acc-solid)}
/* selected card */
.card.sel{box-shadow:0 0 0 2px var(--acc600);border-color:transparent}
/* drag */
.drop{height:38px;border:1.5px dashed var(--acc500);border-radius:var(--r-card);background:var(--acc100);display:none}
.drag-ghost{display:none;position:absolute;left:14px;top:178px;width:calc(100% - 6px);background:#fff;transform:rotate(-2deg);
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:3}
body.s-drag .drop,body.s-drag .drag-ghost{display:flex}
body.s-drag .card.src{opacity:.4}
/* panel/picker visibility */
.panel,.picker,.scrim,.modal,.toast{display:none}
body.s-panel .panel,body.s-panel .picker{display:flex}
body.s-series .panel{display:flex}
body.s-series .scrim,body.s-series .modal{display:flex}
body.s-toast .toast{display:flex}
body:not(.s-panel):not(.s-series) .card.sel{box-shadow:none;border-color:var(--border)}
.prop-btn{height:24px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:var(--r-control);font-size:12px;font-weight:500;color:var(--text-primary);background:var(--n100)}
.prop-btn svg{width:12px;height:12px;color:var(--text-tertiary)}
/* popover */
.pop{position:fixed;background:#fff;border:1px solid var(--border);border-radius:12px;flex-direction:column;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08);z-index:6}
.picker{right:416px;top:206px;width:320px}
.pop-sec{padding:6px}
.opt{height:28px;display:flex;align-items:center;padding:0 8px;border-radius:var(--r-control);color:var(--text-primary);font-size:13px}
.opt:hover{background:var(--n100)}
.opt.on{background:var(--n100);font-weight:500}
.opt svg{margin-left:auto;width:16px;height:16px;color:var(--acc600)}
.custom{padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px}
.custom .t-label{height:20px;display:flex;align-items:center}
.frow{display:flex;align-items:center;gap:8px;min-height:28px}
.frow.top{align-items:flex-start}
.fl{width:84px;flex:none;font-size:12px;color:var(--text-tertiary)}
.frow.top .fl{line-height:28px}
.field{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 8px;border:1px solid var(--border);border-radius:var(--r-control);font-size:12px;font-weight:500;color:var(--text-primary);background:#fff}
.field svg{width:12px;height:12px;color:var(--text-tertiary)}
.field.num{width:44px;justify-content:center}
.field.dim{color:var(--text-disabled)}
.wds{display:flex;gap:4px}
.wd{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--text-secondary);background:var(--n100)}
.wd.on{background:var(--a-solid);color:#fff}
.radios{display:flex;flex-direction:column;gap:4px}
.r{display:flex;align-items:center;gap:8px;min-height:28px;font-size:12px;color:var(--text-primary)}
.rd{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--n400);flex:none}
.r.on .rd{border:4px solid var(--acc600)}
.hint{padding-top:4px;border-top:1px solid var(--border);margin-top:2px;padding-top:8px}
.pop-foot{display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid var(--border)}
/* modal */
.scrim{position:fixed;inset:0;background:rgba(17,24,39,.32);z-index:7}
.modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:400px;background:#fff;border-radius:12px;padding:16px;
  flex-direction:column;gap:12px;z-index:8;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.radios.big{gap:2px}
.radios.big .r{align-items:flex-start;padding:6px 8px;border-radius:var(--r-control)}
.radios.big .r:hover{background:var(--n100)}
.radios.big .r .rd{margin-top:2px}
.radios.big .r span b{display:block;font-weight:500;font-size:13px;line-height:18px}
.radios.big .r.on{background:var(--acc100)}
.warn{display:flex;align-items:center;gap:6px}
.warn svg{width:12px;height:12px}
/* toast */
.toast{position:fixed;bottom:24px;left:calc(288px + (100vw - 288px)/2);transform:translateX(-50%);height:40px;align-items:center;gap:10px;
  padding:0 8px 0 12px;background:#fff;border:1px solid var(--border);border-radius:var(--r-card);z-index:9;
  box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}
.toast .ok{color:#328f32;display:grid}
.toast .msg{font-size:13px;color:var(--text-primary)}
.toast .link{border:0;background:none;font:600 12px/16px Inter,sans-serif;color:var(--acc700);cursor:pointer;padding:4px 6px;border-radius:4px}
.toast .link:hover{background:var(--acc100)}
.toast kbd{font:500 11px/16px Inter,sans-serif;color:var(--text-tertiary);border:1px solid var(--border);border-radius:4px;padding:0 4px}
/* state switcher */
.states{position:fixed;left:12px;bottom:12px;z-index:20;display:flex;gap:8px;align-items:center;background:#111827;color:#fff;padding:6px 8px;border-radius:10px;font-size:12px}
.states .seg{background:#374151}
.states .seg span{color:#d1d5db;cursor:pointer}
.states .seg span.on{background:#fff;color:#111827}
.states label{display:flex;align-items:center;gap:4px;cursor:pointer}
.states .sp-btn{background:#374151;border:0;color:#d1d5db;font:500 12px/16px Inter,sans-serif;padding:4px 8px;border-radius:6px;cursor:pointer}
'''

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Life OS — Calendar · Week board (batch A mock)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{V13}
{NEW_CSS}
</style>
</head>
<body class="s-toast">
<div class="app">
  <nav class="rail" aria-label="Sections"><div class="rail-pill">
    <div class="logo">L</div>
    {rail}
    <div class="sp"></div>
    <a title="Settings"><svg viewBox="0 0 24 24">{SETTINGS}</svg></a>
  </div></nav>
  <aside class="side">{sidebar}</aside>
  <main class="main">
    <header class="page-head">
      <div class="nav"><span class="icon-btn">{ic('left')}</span><span class="icon-btn">{ic('right')}</span></div>
      <h1 class="t-page">Nov 9 – 15, 2026</h1>
      <button class="btn">Today</button>
      <div class="seg"><span class="on">Week</span><span>Month</span><span>Quarter</span><span>Year</span></div>
      <div class="head-sp"></div>
      <button class="btn icon" title="Agenda panel">{ic('agenda')}</button>
      <button class="btn">{ic('filter')}Filter</button>
      <button class="btn primary">{ic('plus')}New task</button>
    </header>
    <div class="board">{board}</div>
  </main>
</div>
{panel}
{picker}
{series}
{toast}
<div class="states">
  <span>Mock state</span>
  <div class="seg" id="st">
    <span class="on" data-s="">Board</span><span data-s="s-drag">Dragging</span><span data-s="s-panel">Panel + repeat</span><span data-s="s-series">Series dialog</span>
  </div>
  <label><input type="checkbox" id="tt" checked> Undo popup</label>
  <button class="sp-btn" onclick="document.body.classList.toggle('inspect')">Spacing</button>
</div>
<script>
const st=document.getElementById('st');
st.onclick=e=>{{const s=e.target.dataset.s;if(s===undefined)return;
  ['s-drag','s-panel','s-series'].forEach(c=>document.body.classList.remove(c));if(s)document.body.classList.add(s);
  st.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x===e.target));}};
document.getElementById('tt').onchange=e=>document.body.classList.toggle('s-toast',e.target.checked);
</script>
</body>
</html>'''

Path('/mnt/user-data/outputs/life-os-mock-week.html').write_text(html)
print('ok', len(html))
