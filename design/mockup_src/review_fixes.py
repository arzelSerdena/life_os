"""Phase 2 quick wins from the UX review (Nov 16). Post-processes approved-*.html into draft-*.html.
Usage: python review_fixes.py <html_mockups dir> <out dir>"""
import re, sys, os
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
log = {}
def sub(f, html, pat, rep, flags=0, label=None, literal=False):
    if literal:
        n = html.count(pat); html = html.replace(pat, rep)
    else:
        html, n = re.subn(pat, rep, html, flags=flags)
    if n: log.setdefault(f, []).append(f"{label or pat[:40]} ×{n}")
    return html

routine = open(os.path.join(SRC, 'approved-routine.html'), encoding='utf-8').read()
i = routine.find('<div class="side-divider"></div><div class="sgroup" title="Open all routines">')
j = routine.find('<div class="grow"></div>', i)
PRIORITY = {'Update resume':'high','Reply to the recruiter email':'high','Submit hackathon registration':'high','Pay credit card bill':'high','Draft the hackathon pitch':'med','Set up the FastAPI project':'med','Write case study for Life OS':'med','Tailor resume for the Shopee role':'med','Transfer ₱2,000 to savings':'med','Book a dentist cleaning':'med',"Plan Ana's birthday dinner":'med'}
ROUTINES_BLOCK = routine[i:j].replace('class="item rtn on"', 'class="item rtn"')
area = open(os.path.join(SRC, 'approved-area.html'), encoding='utf-8').read()
k = area.find('<div class="hleg">'); LEGEND = area[k:area.find('</div>', k) + 6].replace('<div class="hleg">', '<div class="hleg" style="--a-solid:#4b5563;--a-tint:#e5e7eb;--a-border:#9ca3af;--a-text:#374151">')

EFFORT_700 = {'#3579c2': '#5a97d6', '#11bbb3': '#2ad7cd', '#ca6a93': '#d98db0', '#b181b4': '#c9a5cd',
              '#cba927': '#dbbf34', '#cc6b43': '#d58862'}  # 400 fills with near-black labels (Nov 16 feedback: 700 too dark)
CLOSE_BTN = ('<button class="hbtn" title="Close (Esc)"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>')
CSS = """
/* review_fixes (Nov 16) */
.mc .ax{font-size:12.5px}
.dax span,.crax>div span,.rgax>div{font-size:11px}
.career .split-btn,.finance .split-btn,.health .split-btn,.personal .split-btn,.relation .split-btn,.home .split-btn{background:var(--a-text)!important}
.cdh.tdc .cdn,.lin-num.tdy i,.mdh.tdy .dn,.col.today .daynum{background:#7e61a0!important}
.btn:disabled,.btn[disabled]{opacity:.55!important}
.ent.done .nm,.done .nm{color:#6b7280!important}
.amain .thead{max-width:960px}
.rside .hleg,.main .hleg{margin-top:12px}
.es4 .es4p{color:#fff!important}
/* agenda rows look like the Kanban cards (Nov 16) */
.aday .arow{border:1px solid var(--border)!important;border-radius:8px!important;padding:8px 12px!important;margin:0 0 6px!important;align-items:flex-start}
.aday .arow:not(.ev){background:#fff!important}
.aday .arow.ev{border-color:transparent!important}
.aday .arow .at{font-size:14px!important;font-weight:500!important;line-height:20px!important}
.aday .arow .am{margin-top:2px}
.am svg.flag-high{color:#cc363c!important}.am svg.flag-med{color:#c9510c!important}
/* pickers: no empty space on the right, time list inside the screen */
.pk.k-range{width:auto!important}
.pk.k-days .gr{grid-template-columns:repeat(7,1fr)}
"""
AGENDA_JS = """<script>/* review_fixes: agenda opens at today in every view */
(function(){function go(){document.querySelectorAll('.ag-body').forEach(function(b){if(!b.offsetParent)return;
var h=[].find.call(b.querySelectorAll('.adh'),function(x){return /^today$/i.test((x.querySelector('.t-label')||{}).textContent||'')});
if(!h)return;var top=h.getBoundingClientRect().top-b.getBoundingClientRect().top+b.scrollTop;b.scrollTop=top;});}
window.addEventListener('load',function(){go();setTimeout(go,300)});document.addEventListener('click',function(e){if(e.target.closest('.states'))setTimeout(go,60)});})();</script>"""

for name in sorted(os.listdir(SRC)):
    if not (name.startswith('approved-') and name.endswith('.html')): continue
    f = name[9:-5]
    h = open(os.path.join(SRC, name), encoding='utf-8').read(); orig = h
    if f != 'settings':  # 12-hour ":00" drop (settings draws 24-hour states itself)
        h = sub(f, h, r'\b(1[0-2]|[1-9]):00(?=\s?(?:[AP]M\b|[–-]\s?\d))', r'\1', label='drop :00')
    # ROUTINES group in the Areas sidebar
    if 'Open all routines' not in h and 'Room makeover</div><div class="grow"></div>' in h:
        h = sub(f, h, 'Room makeover</div><div class="grow"></div>',
                'Room makeover</div>' + ROUTINES_BLOCK.replace('class="item rtn"', 'class="item rtn" style="cursor:pointer"') + '<div class="grow"></div>',
                label='ROUTINES group', literal=True)
        h = h.replace('</style>', '.side .rmk{display:grid;place-items:center;margin:0}</style>', 1)
    # archive renamed
    h = sub(f, h, r'(</svg>)Archived(</div>(?:\s*</aside>))', r'\1Finished &amp; archived\2', label='Finished & archived (sidebar)')
    if f == 'archived':
        h = sub(f, h, '<h1 class="t-page">Archived</h1>', '<h1 class="t-page">Finished &amp; archived</h1>', literal=True, label='page title')
    # contrast: Effort fills 700
    for a, b in EFFORT_700.items():
        h = sub(f, h, r'(class="es4" style="flex:\d+;background:)' + a, r'\g<1>' + b, label='Effort 400 ' + a)
    # done text #6b7280
    def fix_rule(m):
        sel, body = m.group(1), m.group(2)
        body = re.sub(r'(?<![-\w])color:\s*(var\(--text-disabled\)|#9ca3af|var\(--n400\))', 'color:#6b7280', body)
        return sel + '{' + body + '}'
    def fix_style(m):
        parts = m.group(2).split('}')
        for ix, p in enumerate(parts):
            if 'line-through' in p:
                parts[ix] = re.sub(r'(?<![-\w])color:\s*(var\(--text-disabled\)|#9ca3af|var\(--n400\))', 'color:#6b7280', p)
        return m.group(1) + '}'.join(parts) + m.group(3)
    h2 = re.sub(r'(<style[^>]*>)(.*?)(</style>)', fix_style, h, flags=re.S)
    if h2 != h: log.setdefault(f, []).append('done text #6b7280'); h = h2
    # copy
    h = sub(f, h, "This can't be undone.", 'Can’t be undone', literal=True, label='Can’t be undone')
    h = sub(f, h, r'(<button class="chip2 od"><svg[^<]*(?:<(?!/svg)[^<]*)*</svg>)([A-Z][a-z]{2} \d{1,2}) · Overdue', r'\1Due \2', label='chip Due', flags=re.S)
    h = sub(f, h, 'Undo for 6 s', 'You can undo this', literal=True)
    h = sub(f, h, 'Restore from Archived', 'You can restore it from Finished &amp; archived', literal=True)
    h = sub(f, h, r'Hackathon weekend ends(</[^>]+>(?:\s*<[^>]+>)*?)3 PM', r'Hackathon weekend\1Until 3 PM', label='Until 3 PM')
    h = sub(f, h, 'Clean up GitHub profile completed', 'Completed “Clean up GitHub profile”', literal=True)
    h = sub(f, h, 'Read 10 pages skipped for today', 'Skipped “Read 10 pages” today', literal=True)
    for a_, b_ in [("toast(title+' completed'", "toast('Completed “'+title+'”'"),
                   ("toast(title+' moved to tomorrow'", "toast('Moved “'+title+'” to tomorrow'"),
                   ("toast(row.querySelector('.dt').textContent+' skipped for today'", "toast('Skipped “'+row.querySelector('.dt').textContent+'” today'"),
                   ("toast(row.querySelector('.lrt').textContent+': '+val+' logged'", "toast('Logged '+val+' · '+row.querySelector('.lrt').textContent"),
                   ("toast(R.steps[row.dataset.i].t+' skipped'+(sel===R.today?' for today':' for '+fmt(sel)))", "toast('Skipped “'+R.steps[row.dataset.i].t+'”'+(sel===R.today?' today':' on '+fmt(sel)))"),
                   ("toast('Day skipped · '+fmt(sel))", "toast('Skipped day · '+fmt(sel))")]:
        h = sub(f, h, a_, b_, literal=True, label='toast ' + b_[7:22])
    # detail panel close button
    h = sub(f, h, r'(<button class="hbtn" title="More"><svg[^<]*(?:<circle[^>]*>(?:</circle>)?){3}</svg></button>)(</div><div class="panel-body">)',
            r'\1' + CLOSE_BTN + r'\2', flags=re.S, label='panel ×')
    # routine key on routine page / routines overview
    if f in ('routine', 'routines-overview', 'archived'):
        key = 'stitle">Steps<' if f != 'routines-overview' else 'stitle">Routines<'
        pos = 0; n = 0
        while True:
            a_ = h.find(key, pos)
            if a_ < 0: break
            e_ = h.find('</section>', a_)
            if '<div class="hleg">' not in h[a_:e_]:
                ins = h.rfind('</div>', a_, e_)
                h = h[:ins] + LEGEND + h[ins:]; n += 1
            pos = h.find('</section>', a_) + 1
        if n: log.setdefault(f, []).append(f'routine key ×{n}')
    if f == 'pickers':
        h = sub(f, h, 'class="pk k-time" style="left:1735px;', 'class="pk k-time" style="left:1660px;', literal=True, label='time list inside the screen')
    if f == 'projects-overview':
        h = h.replace('</style>', 'html,body{overflow:hidden}</style>', 1); log.setdefault(f, []).append('no page scroll in pop-up state')
    if f == 'calendar':
        tasks_src = open(os.path.join(SRC, 'approved-tasks.html'), encoding='utf-8').read()
        FLAG = '<svg viewBox="0 0 24 24" class="flag-{}"><path d="M4 22V4l7 2 9-2v12l-9 2-7-2"/></svg>'
        for title, pr in PRIORITY.items():
            for tt in {title, title.replace("'", "\\'"), title.replace("&", "&amp;")}:
                h = sub(f, h, '(<span class="check"></span><div class="ab"><span class="at">' + re.escape(tt) + '</span><span class="t-meta am">)',
                        r'\1' + FLAG.format(pr), label='agenda flag')
        h = h.replace('</body>', AGENDA_JS + '</body>', 1); log.setdefault(f, []).append('agenda scroll to today')
        h = sub(f, h, '<span style="width:13px"></span><span>None</span>', '<span style="width:13px;flex:none"></span><span>None</span>', literal=True, label='None align')
    if h != orig:
        h = h.replace('</head>', '<style>' + CSS + '</style></head>', 1)
        open(os.path.join(OUT, 'draft-' + f + '.html'), 'w', encoding='utf-8').write(h)
for f, v in log.items(): print(f, '|', '; '.join(v))
