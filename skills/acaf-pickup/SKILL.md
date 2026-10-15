---
name: acaf-pickup
description: Cross-session pickup for an ACAF project — read the acaf/ records and report where things stand and the exact next step, without doing any work. Use as the FIRST action in a new session on an ACAF project, after a context compaction, or whenever the user asks "where were we / what's the status".
---

# ACAF Pickup — resume from disk, not from memory

The records are the project's memory. This skill reads them and orients — it changes nothing.

## Step 1 — read, in this order

1. `acaf/initiative_manifest.md` — the active initiative, its criteria, which slices are ticked.
2. `acaf/handoff_summary.md` — the last written orientation.
3. `acaf/change_log.md` (tail) and `acaf/deviation_log.md` (tail) — what recently happened, incl. anything blocked.
4. `acaf/follow_up_backlog.md` — what's parked.
4b. The lessons file (`acaf/lessons.md`, or whatever `acaf/lessons*.md` the project keeps) — how the user has corrected agents on this project before. Carry these habits into the session; don't repeat a recorded lesson.
5. `git log --oneline -10` and `git status` — confirm the records match the repo (uncommitted work or commits missing from the change log = drift; SAY so).

## Step 2 — report (short)

One paragraph: what this project is, what the active initiative is (or "none"), what the last session finished, and anything blocked or drifted.

Then **What's next**, lead option first — recommend in your own voice, don't just vend commands:

- Active initiative with slices remaining → `Say "continue" → I build slice <n>: <name>.`
- Slices done, not accepted → the review is YOUR action, not a command to hand over: `Say "review it" → I run the independent reviewer over the finished slices` (recommended before accepting), then `Say "accept" → I walk the criteria and hand you the human checklist`.
- Nothing active → do the ideation yourself: read `acaf/follow_up_backlog.md`, the contract gaps, the unrealized `vision_principles.md`, and any PRD/intent docs, and present **2–4 concrete candidate initiatives** — each with a one-line why, its source, and the exact words to start it. Recommend the strongest; never end with a bare `Say "/acaf-plan <thing>"` that makes the user supply the idea.
- Drift detected → lead with fixing the records first, and say exactly what's inconsistent.

## Rules

- Don't start building in the pickup turn unless the user already said "continue" — pickup is orientation.
- Don't invent state: if a record is missing or contradictory, report that as the finding.
