"""Mock data for the Calendar's Month, Quarter and Year views (Phase D).

One year of entries (2026) in the same card format as build_next7.py (T, E, P, R). The week of Nov 9 – 15 comes
straight from build_next7.week(), so every view agrees with the approved Week view. Oct 26 – Dec 6 (the month grid)
is written out by hand; the rest of the year is filled in with a seeded generator so Quarter and Year look lived in.
Today is Sat, Nov 14, 2026.
"""
import datetime as dt
import random

import build_next7 as nb

T, E, P, R = nb.T, nb.E, nb.P, nb.R
D = dt.date
TODAY = D(2026, 11, 14)
WEEK0 = D(2026, 11, 9)
MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December']
DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def md(d):
    return f'{MON3[d.month - 1]} {d.day}'


def span_label(s, e):
    if s == e:
        return md(s)
    if s.month == e.month:
        return f'{md(s)} – {e.day}'
    return f'{md(s)} – {md(e)}'


# ---------------------------------------------------------------- projects (bars in Quarter and Year, due dates elsewhere)
# (title, area, start, due, % done)
PROJECTS = [
    ('Read 24 books', 'personal', D(2026, 1, 1), D(2026, 12, 31), 75),
    ('Learn Python basics', 'career', D(2026, 1, 12), D(2026, 4, 30), 100),
    ('Tax filing', 'finance', D(2026, 2, 2), D(2026, 4, 15), 100),
    ('Spring cleaning', 'home', D(2026, 3, 2), D(2026, 3, 29), 100),
    ('Photography course', 'personal', D(2026, 5, 4), D(2026, 7, 26), 100),
    ('Emergency fund', 'finance', D(2026, 6, 1), D(2026, 12, 31), 64),
    ('Family reunion', 'relation', D(2026, 6, 15), D(2026, 8, 22), 100),
    ('Portfolio website', 'career', D(2026, 7, 20), D(2026, 9, 30), 100),
    ('Home office setup', 'home', D(2026, 8, 10), D(2026, 9, 5), 100),
    ('Life OS app', 'career', D(2026, 9, 14), D(2027, 1, 31), 30),
    ('5K training', 'health', D(2026, 10, 5), D(2026, 12, 13), 45),
    ('Resume &amp; portfolio', 'career', D(2026, 10, 20), D(2026, 11, 30), 70),
    ('Hackathon prep', 'career', D(2026, 10, 26), D(2026, 11, 8), 90),
    ('Kitchen deep clean', 'home', D(2026, 11, 1), D(2026, 11, 15), 50),
    ('Room makeover', 'home', D(2026, 11, 16), D(2026, 12, 20), 0),
]

# ---------------------------------------------------------------- all-day and multi-day events (bars in every view)
# (title, area, start, end, time label for events that start or end at a time)
BARS = [
    ('Hiking trip', 'health', D(2026, 3, 20), D(2026, 3, 22), ''),
    ('Holy Week at home', 'relation', D(2026, 3, 30), D(2026, 4, 5), ''),
    ('Tech conference', 'career', D(2026, 5, 14), D(2026, 5, 16), ''),
    ('Beach weekend', 'relation', D(2026, 7, 24), D(2026, 7, 26), ''),
    ('Family reunion weekend', 'relation', D(2026, 8, 21), D(2026, 8, 23), ''),
    ('Regional hackathon', 'career', D(2026, 9, 18), D(2026, 9, 20), ''),
    ('Camping trip', 'relation', D(2026, 10, 9), D(2026, 10, 11), ''),
    ("Dad's birthday", 'relation', D(2026, 10, 19), D(2026, 10, 19), ''),
    ('Visit grandparents', 'relation', D(2026, 10, 31), D(2026, 11, 2), ''),
    ('Book fair', 'personal', D(2026, 11, 7), D(2026, 11, 10), ''),
    ("Mom's birthday", 'relation', D(2026, 11, 11), D(2026, 11, 11), ''),
    ('Hackathon weekend', 'career', D(2026, 11, 13), D(2026, 11, 15), 'Fri 6:00 PM – Sun 3:00 PM'),
    ('Beach trip', 'relation', D(2026, 11, 26), D(2026, 11, 28), ''),
    ('Design conference', 'career', D(2026, 12, 3), D(2026, 12, 4), ''),
    ('Holidays with family', 'relation', D(2026, 12, 24), D(2026, 12, 27), ''),
]

# ---------------------------------------------------------------- timed events
EVENTS = {
    D(2026, 10, 28): [E('Haircut', 'health', '3:00 – 3:45 PM')],
    D(2026, 10, 31): [E('Halloween party', 'relation', '8:00 – 11:00 PM', loc=True)],
    D(2026, 11, 2): [E('Career fair', 'career', '10:00 AM – 1:00 PM', loc=True)],
    D(2026, 11, 6): [E('Bank appointment', 'finance', '2:00 – 2:30 PM', loc=True)],
    D(2026, 11, 17): [E('Call with recruiter', 'career', '4:00 – 4:30 PM')],
    D(2026, 11, 20): [E('Mock interview with Ana', 'career', '2:00 – 3:00 PM')],
    D(2026, 11, 21): [E('Dinner with Mia', 'relation', '6:00 – 8:00 PM', loc=True, key='mia')],
    D(2026, 11, 24): [E('Dentist follow-up', 'health', '9:30 – 10:00 AM', loc=True)],
    D(2026, 11, 27): [E('Plumber visit', 'home', '9:00 – 10:00 AM')],
    D(2026, 12, 1): [E('Passport appointment', 'personal', '11:00 – 11:30 AM', loc=True)],
    D(2026, 12, 5): [E("Friends' game night", 'relation', '7:00 – 10:00 PM', loc=True)],
}
EV_POOL = [('Coffee with Mia', 'relation', '10:00 – 11:00 AM'), ('Doctor check-up', 'health', '9:00 – 9:30 AM'),
           ('Networking meetup', 'career', '6:00 – 8:00 PM'), ('Movie night', 'relation', '7:00 – 9:30 PM'),
           ('Yoga class', 'health', '7:00 – 8:00 AM'), ('Budget review call', 'finance', '5:00 – 5:30 PM'),
           ('Online workshop', 'career', '1:00 – 3:00 PM'), ('Pottery class', 'personal', '3:00 – 5:00 PM')]

# ---------------------------------------------------------------- tasks
POOL = {
    'career': ['Practice system design', 'Email the recruiter', 'Update LinkedIn headline', 'Fix the Life OS sidebar bug',
               'Write unit tests for the tasks API', 'Prepare interview stories', 'Read a chapter of Clean Code'],
    'finance': ['Log expenses', 'Transfer to savings', 'Check bank statement', 'Pay internet bill'],
    'health': ['Meal prep', 'Buy vitamins', 'Book a dental cleaning', 'Stretch after the run'],
    'personal': ['Journal', 'Practice guitar', 'Organize photos', 'Finish the novel'],
    'relation': ['Call Grandma', 'Plan date night', 'Reply to Ana', 'Buy a gift for Mia'],
    'home': ['Do laundry', 'Clean the bathroom', 'Fix the shelf', 'Take out recycling', 'Buy light bulbs'],
    None: ['Buy groceries', 'Return library books', 'Pick up the package'],
}
PROJ_OF = {'Practice system design': 'Resume &amp; portfolio', 'Fix the Life OS sidebar bug': 'Life OS app',
           'Write unit tests for the tasks API': 'Life OS app', 'Transfer to savings': 'Emergency fund',
           'Stretch after the run': '5K training', 'Prepare interview stories': 'Resume &amp; portfolio',
           'Fix the shelf': 'Room makeover', 'Buy light bulbs': 'Room makeover', 'Finish the novel': 'Read 24 books'}
AREAS = list(POOL)
# hand-written days in the month grid (open tasks from today on, done before)
HAND = {
    D(2026, 11, 16): [T('Measure the room', 'home', 'Room makeover'), T('Email the recruiter', 'career'), T('Log expenses', 'finance')],
    D(2026, 11, 17): [T('Prepare interview stories', 'career', 'Resume &amp; portfolio', pri='high'), T('Do laundry', 'home')],
    D(2026, 11, 18): [T('Buy a birthday card for Ana', None), T('Practice guitar', 'personal'), T('Meal prep', 'health', rep=True)],
    D(2026, 11, 19): [T('Fix the Life OS sidebar bug', 'career', 'Life OS app')],
    D(2026, 11, 20): [T('Buy running shoes', 'health', '5K training'), T('Review mock interview notes', 'career')],
    D(2026, 11, 22): [T('Plan meals', 'home'), T('Call Grandma', 'relation')],
    D(2026, 11, 23): [T('Pick paint colours', 'home', 'Room makeover'), T('Update LinkedIn headline', 'career', 'Resume &amp; portfolio'),
                      T('Transfer to savings', 'finance', 'Emergency fund'), T('Pick up the package', None)],
    D(2026, 11, 25): [T('Pack for the beach trip', 'relation'), T('Write unit tests for the tasks API', 'career', 'Life OS app'),
                      T('Buy sunscreen', 'health')],
    D(2026, 11, 29): [T('Publish portfolio site', 'career', 'Resume &amp; portfolio', pri='high')],
    D(2026, 11, 30): [T('Final resume review', 'career', 'Resume &amp; portfolio', pri='med'), T('Pay internet bill', 'finance'),
                      T('Do laundry', 'home')],
    D(2026, 12, 1): [T('Renew passport', None)],
    D(2026, 12, 2): [T('Order the new rug', 'home', 'Room makeover'), T('Journal', 'personal')],
    D(2026, 12, 3): [T('Bring business cards', 'career')],
    D(2026, 12, 4): [T('Log expenses', 'finance')],
}
DETAIL = (D(2026, 10, 26), D(2026, 12, 6))
STEPS_EVE = [('Practice LeetCode 30 min', 'career'), ('Read 10 pages', 'personal'), ("Plan tomorrow's top task", 'career'),
             ('Stretch 10 min', 'health'), ('Skincare', 'health')]
STEPS_WK = [('Update the job tracker', 'career'), ('Review job applications', 'career'), ('Post one LinkedIn update', 'career'),
            ('Plan meals', 'home'), ('Review the budget', 'finance')]


def _routine(d, rng):
    steps, title = (STEPS_WK, 'Weekly reset') if d.weekday() == 6 else (STEPS_EVE, 'Evening routine')
    if d >= TODAY:
        n = 0
    else:
        n = rng.choice([2, 3, 4, 5, 5, 5])
    return R(title, [(s, a, 'done' if i < n else 'missed') for i, (s, a) in enumerate(steps)], collapsed=True)


def _recurring(d):
    out = []
    past = d < TODAY
    if d.weekday() == 0 and d >= D(2026, 9, 1):
        out.append(T('Apply to 2 jobs', 'career', rep=True, done=past))
    if d.day == 10:
        out.append(T('Pay credit card bill', 'finance', rep=True, done=past))
    if d.weekday() == 5 and D(2026, 10, 5) <= d <= D(2026, 12, 13):
        out.append(T('Run 5 km', 'health', '5K training', rep=True, done=past))
    if d.weekday() == 6:
        out.append(T('Water the plants', 'home', rep=True, done=past))
    return out


def _random_tasks(d, rng, k):
    out = []
    for _ in range(k):
        a = rng.choice(AREAS)
        t = rng.choice(POOL[a])
        if any(c['title'] == t for c in out):
            continue
        out.append(T(t, a, PROJ_OF.get(t), done=d < TODAY))
    return out


def _build():
    days = {}
    wk_unsched, wk_days, _ = nb.week('all', 'normal')
    d = D(2026, 1, 1)
    while d <= D(2026, 12, 31):
        rng = random.Random(d.toordinal())
        if WEEK0 <= d <= WEEK0 + dt.timedelta(6):
            days[d] = [dict(c) for c in wk_days[(d - WEEK0).days]]
            d += dt.timedelta(1)
            continue
        cards = list(EVENTS.get(d, []))
        if d.weekday() == 3 and D(2026, 9, 3) <= d <= D(2026, 12, 17):
            cards.append(E('Study group', 'career', '7:00 – 9:00 PM', rep=True))
        if not (DETAIL[0] <= d <= DETAIL[1]) and rng.random() < 0.09:
            t, a, tm = rng.choice(EV_POOL)
            cards.append(E(t, a, tm))
        if d <= D(2026, 12, 31):
            cards.append(_routine(d, rng))
        for title, area, s, due, pct in PROJECTS:
            if due == d:
                cards.append(P(title, area, pct, md(due)))
        cards += _recurring(d)
        if d in HAND:
            cards += [dict(c) for c in HAND[d]]
        elif DETAIL[0] <= d <= DETAIL[1]:
            if d < TODAY:
                cards += _random_tasks(d, rng, rng.choice([1, 2, 2, 3]))
        elif d < TODAY:
            cards += _random_tasks(d, rng, rng.choice([0, 1, 1, 2]))
        else:
            cards += _random_tasks(d, rng, rng.choice([0, 0, 0, 1]))
        days[d] = cards
        d += dt.timedelta(1)
    return days


DAYS = _build()
BAR_LIST = [dict(kind='ev', title=t, area=a, s=s, e=e, tm=tm) for t, a, s, e, tm in BARS]
PROJ_LIST = [dict(kind='pj', title=t, area=a, s=s, e=e, pct=p) for t, a, s, e, p in PROJECTS]


def scoped(cards, scope):
    """Apply the sidebar's life-area filter: 'all', one area key, or 'nomatch' (every area unchecked)."""
    if scope == 'all':
        return cards
    if scope == 'nomatch':
        return []
    out = []
    for c in cards:
        if c['t'] == 'rout':
            steps = [s for s in c['steps'] if s[1] == scope]
            if steps:
                out.append(dict(c, steps=steps))
        elif c.get('area') == scope:
            out.append(c)
    return out


def day(d, scope='all'):
    return scoped(DAYS.get(d, []), scope)


def bars(scope='all', projects=False):
    lst = BAR_LIST + (PROJ_LIST if projects else [])
    if scope == 'all':
        return lst
    if scope == 'nomatch':
        return []
    return [b for b in lst if b['area'] == scope]
