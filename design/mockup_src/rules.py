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
}
CSS = ('.scard>.sbody{padding-top:4px}'
       '.pmenu2 .mini-check.on,.pmenu .mini-check.on{background:#8f74b3;border-color:#8f74b3}')

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
    if CSS not in html:
        html = html.replace('</style>', CSS + '</style>', 1)
    return html
