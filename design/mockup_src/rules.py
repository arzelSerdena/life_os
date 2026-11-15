"""Shared presentation rules (Nov 14): data-only subtitles, no guide text or legends,
sort-and-filter card menus with accent checkboxes, titles 4px closer to content."""
import re

SUBS = {
    "Projects, events and Career's metric targets in Q4": '4 projects · 3 events · 3 metrics in Q4',
    "Projects, events and Finance's metric targets in Q4": 'Nothing in Q4 yet',
    'Routine steps in Career · one square per day of Q4': '5 steps in 2 routines',
    'Routine steps in Finance': 'No routine steps',
}
LINES = {
    'Nothing in Q4 yet. Projects, events and metric targets will appear on the timeline.': 'Nothing in Q4 yet.',
    'No routine steps in Finance. Add a step to a routine to track it here.': 'No routine steps in Finance.',
    'No tasks completed in Q4 yet. Completed tasks show up here by area.': 'No tasks completed in Q4 yet.',
    'Nothing scheduled from today to Dec 31.': 'Nothing scheduled.',
}
CSS = ('.scard>.sbody{padding-top:4px}'
       '.pmenu2 .mini-check.on,.pmenu .mini-check.on{background:#8f74b3;border-color:#8f74b3}')

EMPTY_MARKS = ('class="card-empty"', 'mt mt-empty', 'class="ag-empty"', 'class="ph"')
def _drop_repeated_subtitles(html):
    """An empty card says its status once: in the body. Its subtitle is dropped."""
    def fix(m):
        sec = m.group(0)
        body = sec.split('<div class="sbody', 1)[-1]
        if any(k in body for k in EMPTY_MARKS):
            sec = re.sub(r'<span class=ssub>[^<]*</span>', '', sec, count=1)
        return sec
    return re.sub(r'<section class="scard.*?</section>', fix, html, flags=re.S)

def apply(html):
    for a, b in SUBS.items():
        html = html.replace(f'<span class=ssub>{a}</span>', f'<span class=ssub>{b}</span>')
    for a, b in LINES.items():
        html = html.replace(f'<span class="t-meta">{a}</span>', f'<span class="t-meta">{b}</span>')
    html = html.replace('Owned by Career. Shown on its page and the Life areas overview.', 'Owned by Career')
    # legends and form hints are guide text
    html = re.sub(r'<div class="mleg">.*?</div>(?=</div></section>)', '', html, flags=re.S)
    html = re.sub(r'<div class="tlegend">.*?</div>(?=</div></section>)', '', html, flags=re.S)
    html = re.sub(r'<span class="hint2 t-meta">[^<]*</span>', '', html)
    html = re.sub(r'<div class="mfoot t-meta">[^<]*</div>', '', html)
    # metric placeholder tiles: just the action
    html = re.sub(r'(<div class="mt mt-empty"><svg viewBox="0 0 24 24">.*?</svg>)<span>[^<]*</span>', r'\1<span>No metrics yet</span>', html, flags=re.S)
    # card menus: sort and filter only
    for t in ('Sort, filter and view as table', 'Sort, filter and view', 'Show as table'):
        html = html.replace(f'title="{t}"', 'title="Sort and filter"')
    html = _drop_repeated_subtitles(html)
    # a group whose only tile is the empty "No metrics yet" tile doesn't say "No metrics" in its header too
    html = re.sub(r'(<span class="mg-n">[^<]*</span>)<span class="t-meta">No metrics</span>(?=</div><div class="mt mt-empty")', r'\1', html)
    # card menu icon is always the sort-and-filter icon (empty-state cards used the old table icon)
    html = re.sub(r'(title="Sort and filter"><svg viewBox="0 0 24 24">)<rect x="3" y="4" width="18" height="16" rx="2"/>.*?(</svg>)',
                  r'\1<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>\2', html)
    if CSS not in html:
        html = html.replace('</style>', CSS + '</style>', 1)
    return consistency(html)


# ---- Consistency pass (Nov 14, evening): rules from the later approved sections ----
FOLDER = ('<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>')
PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
ACTIVE_PROJECTS = [('career', 'Resume &amp; portfolio'), ('career', 'Hackathon prep'), ('career', 'Life OS app'),
                   ('finance', 'Emergency fund'), ('health', '5K training'), ('personal', 'Reading challenge'),
                   ('home', 'Room makeover')]
SIDE_CSS = ('.sfold{color:var(--a-solid);width:16px;height:16px;margin:0;display:grid;place-items:center;flex:none}'
            '.sfold svg{width:14px;height:14px}.side .item .mark.sfold{display:grid;place-items:center}')

def _projects_group(has_projects):
    head = ('<div class="side-divider"></div><div class="sgroup" title="Open all projects"><span class="sg-name">Projects</span>'
            f'<span style="flex:1"></span><span class="icon-btn sg-add" title="New project">{PLUS}</span></div>')
    if not has_projects:
        return head + '<p class="side-empty t-meta">No projects yet.</p>'
    return head + ''.join(f'<div class="item {a}"><span class="mark sfold">{FOLDER}</span>{n}</div>' for a, n in ACTIVE_PROJECTS)

def _areas_sidebar(html):
    """The Areas group has one sidebar on every screen: LIFE AREAS, PROJECTS, then Archived at the bottom."""
    def fix(m):
        a = m.group(0)
        if 'sg-name">Projects' not in a:
            # mock data: projects exist only in the full six-area data set (not in "no areas" / "areas, no data")
            has_projects = 'Health &amp; Beauty' in a
            a = a.replace('<div class="grow"></div>', _projects_group(has_projects) + '<div class="grow"></div>', 1)
        return a.replace('</svg>Archived areas</div>', '</svg>Archived</div>')
    return re.sub(r'<aside class="side[^"]*">.*?</aside>', fix, html, flags=re.S)

def consistency(html):
    # Notes live in the detail panel; the tabbed card has no Notes tab (Approved: Detail panel)
    html = re.sub(r'<span class="tb">Notes</span>', '', html)
    html = _areas_sidebar(html)
    html = _palette_names(html)
    html = _sidebar_reorder(html)
    html = html.replace('from Archived areas.', 'from Archived.')
    # data, not guidance: no hint lines in pop-ups or empty sidebars
    html = html.replace('<p class="t-meta">Drag to change the order. It is used in the sidebar and on every overview.</p>', '')
    html = html.replace(' Use + to add one.</p>', '</p>')
    if '.sfold{' not in html:
        html = html.replace('</style>', SIDE_CSS + '</style>', 1)
    return forms(html)


# ---- Nov 14 (late): stored palette names, reorder by dragging in the sidebar ----
PALETTE_NAMES = {'Rose': 'Pink', 'Plum': 'Mauve', 'Ochre': 'Gold'}
SHADOW = '0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)'
REORDER_CSS = ('.rdrop,.rghost{display:none}'
               'body.s-reorder .side .item.rsrc{display:none}'
               'body.s-reorder .rdrop{display:block;position:relative;height:var(--side-item);margin-bottom:2px;'
               'border:1px dashed var(--n300);border-radius:var(--r-control)}'
               'body.s-reorder .rghost{display:flex;position:absolute;left:6px;right:-6px;top:5px;background:#fff;'
               f'color:var(--text-primary);box-shadow:{SHADOW};cursor:grabbing;z-index:5}}'
               '.rgrip{position:absolute;left:-1px;top:50%;width:8px;height:16px;margin-top:-8px;'
               'background-image:radial-gradient(circle,var(--n400) 1.2px,transparent 1.4px);background-size:4px 4px}')

def _palette_names(html):
    for a, b in PALETTE_NAMES.items():
        html = html.replace(f'title="{a}"', f'title="{b}"').replace(f'<span>{a}</span>', f'<span>{b}</span>')
    return html

def _sidebar_reorder(html):
    """Areas are reordered by dragging them in the sidebar; no Reorder areas pop-up or menu item."""
    if 'class="pop2 s-reorder"' not in html:
        return html
    html = re.sub(r'<div class="pop2 s-reorder">.*?(?=\n<div class="states">)', '', html, flags=re.S)
    html = re.sub(r'\s*<div class="mi"><svg viewBox="0 0 24 24">(?:(?!</div>).)*?</svg>Reorder areas</div>', '', html, flags=re.S)
    html = html.replace('<span data-s="s-reorder">Reorder areas</span>', '<span data-s="s-reorder">Drag to reorder</span>')
    # the normal sidebar (first aside): Health & Beauty lifted and dragged above Finance
    m = re.search(r'<aside class="side">.*?</aside>', html, flags=re.S)
    a = m.group(0)
    if 'class="rdrop"' not in a:
        ghost = ('<div class="rdrop"><div class="item health rghost"><span class="rgrip"></span>'
                 '<span class="dot"></span>Health &amp; Beauty</div></div>')
        a = a.replace('<div class="item career"><span class="dot"></span>Career</div>',
                      '<div class="item career"><span class="dot"></span>Career</div>' + ghost, 1)
        a = a.replace('<div class="item health"><span class="dot"></span>Health &amp; Beauty</div>',
                      '<div class="item health rsrc"><span class="dot"></span>Health &amp; Beauty</div>', 1)
        html = html[:m.start()] + a + html[m.end():]
    if '.rdrop,' not in html:
        html = html.replace('</style>', REORDER_CSS + '</style>', 1)
    return html


# ---- Nov 14 (night): create forms, metric fields and Delete ----
# - Create buttons stay disabled until the required fields are filled; no "optional" tags.
# - New metric: Owner, Source (Manual entries / Routine step), Measure as (format presets),
#   Each period shows, Better when, Current value, Target.
# - Delete in the detail panel's ⋯ menu; a red delete confirmation for metrics.
def _svg(d):
    return f'<svg viewBox="0 0 24 24">{d}</svg>'

CHEV = _svg('<path d="m6 9 6 6 6-6"/>')
CAL = _svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>')
CLOSE = _svg('<path d="M18 6 6 18M6 6l12 12"/>')
CHECK = _svg('<path d="M20 6 9 17l-5-5"/>')
TRASH = _svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>')
RING = _svg('<circle cx="12" cy="12" r="8"/>')
MEASURES = [  # preset, icon, sample value as it will be shown
    ('Number', '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>', '12.5'),
    ('Money', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>', '₱1,500'),
    ('Percentage', '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>', '35%'),
    ('Time', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', '1 h 30 m'),
    ('Distance', '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>', '5 km'),
    ('Weight', '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>', '70 kg'),
    ('Pages', '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>', '497 pages'),
    ('Chapters', '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', '10 chapters'),
    ('Times', '<path d="M5 4v16M10 4v16M15 4v16M3 16 18 8"/>', '12 times'),
]
MICON = {n: _svg(d) for n, d, _ in MEASURES}

FORM_CSS = (
    '.btn.primary.dis{opacity:.45;cursor:not-allowed}'
    '.btn.danger{background:#cc363c;border-color:#cc363c;color:#fff}'
    '.dwrap{position:relative;display:inline-flex}'
    '.dtip{position:absolute;bottom:calc(100% + 8px);right:0;white-space:nowrap;background:#111827;color:#fff;'
    'font-size:12px;line-height:16px;padding:4px 8px;border-radius:6px}'
    '.mhint{width:100%;font-size:11px;line-height:14px;color:var(--text-tertiary);padding-left:24px}'
    '.mi.danger,.mi.danger>svg{color:#cc363c}'
    '.mi.dis{color:var(--text-disabled);flex-wrap:wrap;height:auto;padding:6px 8px;cursor:default}.mi.dis svg{color:var(--text-disabled)}'
    # New metric form
    '.mf .inp{gap:6px}.mf .inp svg{width:14px;height:14px;color:var(--text-tertiary);flex:none}'
    '.mf .inp .chev{margin-left:auto}.mf .inp .chev svg{width:12px;height:12px}'
    '.mf .pfx{color:var(--text-tertiary)}.mf .sfx{color:var(--text-tertiary);margin-left:4px}'
    '.mf .inp.pick .tag{margin-left:-4px}'
    '.mf .inp.open{border-color:var(--acc600);box-shadow:0 0 0 2px var(--acc200)}'
    '.mf .seg{background:var(--n200)}.mf .seg span{color:var(--text-secondary)}'
    '.mf .seg span.on{background:#fff;color:var(--text-primary)}'
    '.mf .tgt-row{align-items:center}'
    '.mf .rel{position:relative}'
    '.msel{position:absolute;left:0;top:58px;width:260px;background:#fff;border:1px solid var(--border);border-radius:10px;'
    'padding:6px;z-index:5;box-shadow:0 2px 8px rgba(0,0,0,.06),0 14px 28px rgba(0,0,0,.08)}'
    '.msel .mi{gap:8px}.msel .mi .mv{margin-left:auto;font-size:12px;color:var(--text-tertiary)}'
    '.msel .mi.on{background:var(--n100);font-weight:500}'
    '.msel .mi>svg,.msel .mi.on>svg{width:16px;height:16px;color:var(--text-tertiary);margin-left:0}'
)

def _block(html, start):
    """Return the end index of the <div> element that opens at `start`."""
    depth, i = 0, start
    while True:
        o = html.find('<div', i)
        c = html.find('</div>', i)
        if o != -1 and o < c:
            depth += 1
            i = o + 4
        else:
            depth -= 1
            i = c + 6
            if depth == 0:
                return i

def _no_optional(html):
    """Required fields are enforced by the disabled Create button, so nothing is labelled optional."""
    return re.sub(r'\s*<em>optional(?: · Markdown)?</em>', '', html)

def _sel(inner, cls='', w=None):
    style = f' style="width:{w}px"' if w else ''
    return f'<span class="inp pick{cls}"{style}>{inner}<span class="chev">{CHEV}</span></span>'

def _fld(label, body, w=None, extra=''):
    style = f' style="width:{w}px"' if w else ' style="flex:1"'
    return f'<div class="fld{extra}"{style}><span class="fl2">{label}</span>{body}</div>'

def _seg(opts, on):
    return '<div class="seg">' + ''.join(f'<span{" class=on" if o == on else ""}>{o}</span>' for o in opts) + '</div>'

def _metric_modal(state, owner_tag, f, foot):
    return (f'<div class="pop2 {state}"><div class="scrim3"></div><div class="modal3 career mf" style="width:520px" role="dialog" '
            f'aria-label="New metric"><div class="m-head"><h3>New metric</h3><span class="icon-btn" style="margin:0">{CLOSE}</span></div>'
            f'<div class="m-body">{f}</div><div class="m-foot">{foot}</div></div></div>')

def _metric_forms(html):
    m = re.search(r'<div class="pop2 s-metric">', html)
    if not m or 'class="modal3 career mf"' in html:
        return html
    end = _block(html, m.start())
    old = html[m.start():end]
    owner = re.search(r'<div class="owner t-meta">(<span class="tag area">(?:<span class="dot"></span>|<svg.*?</svg>)[^<]*</span>)', old, flags=re.S).group(1)
    is_project = 'Resume &amp; portfolio' in owner
    owner_f = _fld('Owner', _sel(owner, w=None), w=200)
    create = '<button class="btn">Cancel</button><button class="btn primary">Create metric</button>'
    if is_project:
        name, measure, unit_f = 'Portfolio pieces', 'Number', _fld('Unit', '<span class="inp">pieces</span>', w=150)
        cur = '<span class="inp">2<span class="sfx">pieces</span></span>'
        tgt = ('<span class="inp num2" style="width:100px">6<span class="sfx">pieces</span></span><span class="t-body">by</span>'
               f'<span class="inp sel2">Dec 15, 2026{CAL}</span>')
    else:
        name, measure, unit_f = 'Freelance income', 'Money', _fld('Currency', _sel('PHP · ₱'), w=150)
        cur = '<span class="inp"><span class="pfx">₱</span>12,500</span>'
        tgt = ('<span class="inp num2" style="width:110px"><span class="pfx">₱</span>100,000</span><span class="t-body">by</span>'
               f'<span class="inp sel2">Dec 31, 2026{CAL}</span>')

    def manual(menu=''):
        measure_cls = ' open' if menu else ''
        return (
            f'<div class="frow2">{_fld("Name", f"<span class=\"inp focus\">{name}<span class=\"caret\"></span></span>")}</div>'
            f'<div class="frow2">{owner_f}{_fld("Source", _seg(["Manual entries", "Routine step"], "Manual entries"))}</div>'
            f'<div class="frow2">{_fld("Measure as", _sel(MICON[measure] + measure, measure_cls), extra=" rel" if menu else "")[:-6]}{menu}</div>{unit_f}</div>'
            f'<div class="frow2">{_fld("Each period shows", _seg(["Total", "Average", "Latest"], "Total"))}'
            f'{_fld("Better when", _seg(["Higher", "Lower"], "Higher"), w=150)}</div>'
            f'<div class="frow2">{_fld("Current value", cur, w=200)}</div>'
            f'<div class="tbox"><div class="fld"><span class="fl2">Target</span>{_seg(["No target", "Every period", "Reach by a date"], "Reach by a date")}</div>'
            f'<div class="frow2 tgt-row">{tgt}</div></div>')

    out = _metric_modal('s-metric', owner, manual(), create)
    if not is_project:
        menu = '<div class="msel">' + ''.join(
            f'<div class="mi{" on" if n == "Money" else ""}">{MICON[n]}{n}<span class="mv">{v}</span></div>'
            for n, _, v in MEASURES) + '</div>'
        out += _metric_modal('s-metric-measure', owner, manual(menu), create)
        step = (
            f'<div class="frow2">{_fld("Name", "<span class=\"inp\">Daily job search</span>")}</div>'
            f'<div class="frow2">{owner_f}{_fld("Source", _seg(["Manual entries", "Routine step"], "Routine step"))}</div>'
            f'<div class="frow2">{_fld("Routine step", _sel(RING + "<span style=\"color:var(--text-disabled)\">Choose a step</span>"))}</div>'
            f'<div class="frow2">{_fld("Each period shows", _seg(["Days done", "Completion rate"], "Days done"))}</div>'
            f'<div class="tbox"><div class="fld"><span class="fl2">Target</span>{_seg(["No target", "Every period", "Reach by a date"], "Every period")}</div>'
            f'<div class="frow2 tgt-row"><span class="inp num2" style="width:90px">5<span class="sfx">days</span></span><span class="t-body">per</span>'
            f'<span class="inp sel2">week{CHEV}</span><span class="t-body" style="margin-left:8px">starting</span>'
            f'<span class="inp sel2">Nov 16, 2026{CAL}</span></div></div>')
        foot = ('<button class="btn">Cancel</button><span class="dwrap"><span class="dtip">Choose a routine step</span>'
                '<button class="btn primary dis" data-tip="Choose a routine step">Create metric</button></span>')
        out += _metric_modal('s-metric-step', owner, step, foot)
        out += ('<div class="pop2 s-delmetric"><div class="scrim3"></div><div class="modal3 career" style="width:420px" role="dialog" '
                f'aria-label="Delete Networking chats?"><div class="m-head"><h3>Delete Networking chats?</h3><span class="icon-btn" style="margin:0">{CLOSE}</span></div>'
                '<div class="m-body"><p class="t-body">Deleted with it:</p><ul class="cascade"><li><b>9</b> entries</li><li><b>1</b> target</li></ul>'
                "<p class=\"note\">" + _svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>') + "This can't be undone.</p></div>"
                '<div class="m-foot"><button class="btn">Cancel</button><button class="btn danger">Delete metric</button></div></div></div>')
    html = html[:m.start()] + out + html[end:]
    if not is_project:
            html = html.replace('<span data-s="s-metric">New metric</span>',
                                '<span data-s="s-metric">New metric</span><span data-s="s-metric-measure">Measure as menu</span>'
                                '<span data-s="s-metric-step">New metric, routine step</span><span data-s="s-delmetric">Delete metric</span>')
            html = html.replace('</style>', 'body.s-metric-measure .pop2.s-metric-measure,body.s-metric-step .pop2.s-metric-step,'
                                'body.s-delmetric .pop2.s-delmetric{display:block}</style>', 1)
    return html

def _panel_delete(html):
    """The detail panel's ⋯ menu ends with Delete (disabled for a project that still has items)."""
    def fix(m):
        menu = m.group(0)
        if 'Delete' in menu:
            return menu
        if 'project</div>' in menu:
            item = (f'<div class="mi dis">{TRASH}Delete project<span class="mhint">Only empty projects can be deleted. '
                    'Archive it instead.</span></div>')
        else:
            item = f'<div class="mi danger">{TRASH}Delete</div>'
        return menu[:-6] + '<div class="msep"></div>' + item + '</div>'
    if 'class="pmenu3"' in html and '.pmenu3.pmenu3{' not in html:
        html = html.replace('</style>', '.pmenu3.pmenu3{width:250px}</style>', 1)
    return re.sub(r'<div class="pmenu3">.*?</div></div>(?=</aside>)', fix, html, flags=re.S)

# ---- Nov 15: text never takes area colours ----
# Area colour stays on markers, icons, edges, fills and tints; titles, metadata, labels and chip text are neutral.
TEXT_CSS = ('body .card.event .t-card,body .arow.ev .at,body .tbar .tb-l,body .tbar .tp,body .tag.area,body .opt.on'
            '{color:var(--text-primary)}'
            'body .card.event .t-meta,body .arow.ev .am{color:var(--text-secondary)}')


def neutral_text(html):
    if TEXT_CSS not in html:
        html = html.replace('</style>', TEXT_CSS + '</style>', 1)
    return html


def forms(html):
    html = neutral_text(html)
    html = _no_optional(html)
    html = _metric_forms(html)
    html = _panel_delete(html)
    if '.btn.primary.dis{' not in html:
        html = html.replace('</style>', FORM_CSS + '</style>', 1)
    return html
