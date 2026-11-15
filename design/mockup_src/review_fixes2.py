"""Nov 16, before the Claude Code handoff: neutral accent and plain priority names.
Usage: python review_fixes2.py <html_mockups dir> <out dir>  (reads approved-*.html, writes draft-*.html)"""
import re, sys, os
SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
CSS = """
/* review_fixes2 (Nov 16): neutral accent; purple only for focus, selection, today and the logo */
:root{--acc-solid:#374151!important;--acc500:#6b7280!important;--acc600:#374151!important;--acc700:#111827!important;--acc100:#f3f4f6!important;--acc200:#e5e7eb!important}
.rail,.pk{--acc-solid:#a18ec4;--acc500:#a18ec4;--acc600:#8f74b3;--acc700:#7e61a0;--acc100:#f1f0f7;--acc200:#e6e3f1}
.item.on,.sgroup.on{box-shadow:inset 2px 0 0 #8f74b3!important}
.inp.focus{border-color:#8f74b3!important;box-shadow:0 0 0 2px #e6e3f1!important}
.btn.primary:not(.danger){background:#111827!important;border-color:#111827!important;color:#fff!important}
.split-btn.accent{background:#111827!important}
.qbtn{background:#f9fafb!important;border-color:#d1d5db!important;color:#374151!important}
"""
PRI = [('<span class="cn">Do first</span>', '<span class="cn">High</span>'),
       ('<span class="cn">Schedule</span>', '<span class="cn">Medium</span>'),
       ('<span class="cn">Delegate</span>', '<span class="cn">Low</span>'),
       ('<span class="cn">Eliminate</span>', '<span class="cn">No priority</span>'),
       ('>Do first<', '>High<'), ('>Delegate<', '>Low<'), ('>Eliminate<', '>No priority<'),
       ('<span class="v">Do</span>', ''), ('<span class="v">Schedule</span>', ''), ('<span class="v">Delegate</span>', ''), ('<span class="v">Eliminate</span>', ''),
       ('</svg>None<span', '</svg>No priority<span'), ('<span>None</span>', '<span>No priority</span>')]
SUBS = ['Urgent &amp; important', 'Important, not urgent', 'Urgent, not important', 'Not urgent, not important']
log = {}
for name in sorted(os.listdir(SRC)):
    if not (name.startswith('approved-') and name.endswith('.html')): continue
    f = name[9:-5]; h = open(os.path.join(SRC, name), encoding='utf-8').read(); n = 0
    for a, b in PRI:
        c = h.count(a); h = h.replace(a, b); n += c
    for s_ in SUBS:
        h, c = re.subn(r'<div class="csub2">' + re.escape(s_) + r'</div>', '', h); n += c
    # Low and No priority squares: neutral instead of the accent
    h, c = re.subn(r'(<section class="col" style="--a-solid:)#8f74b3("><div class="chw[^"]*"><div class="ch"><span class="asq" style="background:)#8f74b3', r'\g<1>#9ca3af\g<2>#9ca3af', h); n += c
    h = h.replace('<span class="cn">No priority</span>', '<span class="cn">No priority</span>')
    h = h.replace('</head>', '<style>' + CSS + '</style></head>', 1)
    log[f] = n
    open(os.path.join(OUT, 'draft-' + f + '.html'), 'w', encoding='utf-8').write(h)
print(log)
