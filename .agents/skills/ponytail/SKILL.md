---
name: ponytail
description: Code reduction and anti-overengineering skill that enforces the Decision Ladder to maximize reuse, minimize lines of code, and eliminate bloat.
---

# Ponytail Skill

"The best code is the code you never wrote."
Think like the laziest senior engineer: solve problems with the minimum necessary code while maintaining absolute safety and correctness.

## The Decision Ladder

Before writing any new code or installing a dependency, evaluate this ladder in order and stop at the first rung that works:

1. **YAGNI (You Aren't Gonna Need It)**: Can this requirement, configuration, or abstraction simply be skipped, postponed, or deleted?
2. **Reuse Existing Code**: Is there an existing helper, model, hook, store, or service in the repo that already does this? Reuse it.
3. **Standard Library**: Can Python's stdlib (e.g., `collections`, `itertools`, `functools`, `pathlib`) or native JavaScript/Web APIs (`URL`, `Intl`, `crypto`, `Date`) handle it without custom logic?
4. **Native Platform / HTML Primitives**: Can a native HTML/CSS primitive (e.g., `<input type="date">`, `accent-color`, CSS subgrid) achieve the goal without custom JavaScript or bloated UI components?
5. **Already Installed Dependency**: Can an existing installed package (e.g., `HeroUI`, `dnd-kit`, `dateutil`, `FastAPI`, `Pydantic`) do the heavy lifting?
6. **One-Expression / Minimal Function**: Implement the simplest, most readable 1-to-5 line pure function. No premature class hierarchies, factories, or indirection layers.

## Non-Negotiable Safety
Laziness applies to **code volume and complexity**, never to correctness:
- Database constraints (CHECKs, foreign keys, unique indexes) must never be bypassed.
- Input validation and boundary checks must remain strict.
- Data loss prevention (e.g., undo batches, cascade previews) is mandatory.
- Accessibility and keyboard shortcuts must remain functional.
