---
name: acaf-plan
description: Turn a feature or fix request into a bounded ACAF initiative — a decision record with alternatives and a principles cross-check, acceptance criteria captured UPFRONT in present tense, and a slice plan where every slice names its files (source first) and its definition of done. Use when starting any non-trivial piece of work on an ACAF project ("plan X", "let's add Y", "start an initiative for Z").
---

# ACAF Plan — from request to bounded initiative

Planning is a deliverable, not a preamble. The output is files, so any future session can execute without this conversation.

## Step 0 — gates

- `acaf/` must exist (else: run `/acaf-onboard` first — say so and stop).
- Read `acaf/initiative_manifest.md`. **One initiative at a time**: if one is `in_progress`, ask the user — finish it first (recommended), park the new request to the backlog, or explicitly supersede it. Don't run two at once.

## Step 1 — understand the request, against the records and the person

Read `intent_brief.md`, `functional_contract.md`, `functionality_index.md`, the lessons file (`lessons*.md`, if present), and the relevant source files. Then do Steps 1–2 of `acaf-direction` before choosing anything:

- **The person and their steps:** who uses this, and what they do, step by step. For anything with a user experience, map the flows they'll go through (including the messy ones) before designing a screen or a pipeline.
- **What "good" means to the user,** in their terms.
- **Your assumptions,** facts separated from decisions. Check each fact you can; list the ones only the user can answer.
- **What already exists:** in this codebase, in the references the user named, and in the world.

- **Conflict check, early:** if the request contradicts a recorded contract criterion, surface it now as one plain question that names the request, names the conflicting criterion, and leads with your recommendation. Don't build first and argue about it in review.
- **Degenerate check:** if the requested thing already exists (per the index and the real code), say so instead of "building" it — ask what the user actually wants changed.
- **Novelty check:** if the records hold no proven approach for this problem, or its outcome will be judged by quality or taste, run **`acaf-explore`** (the option study) before Step 3, and plan from what it found. Planning a new problem from the first approach that comes to mind is how a low-ceiling approach gets polished for days. When the route is clear and proven, `acaf-direction`'s options are enough: don't run a study to confirm the obvious.

## Step 2 — capture acceptance criteria (upfront, present tense)

Write 2–6 testable, present-tense statements of what will be true when this is done (e.g. "`POST /login` returns 401 for a wrong password"). These go in the initiative file — not the contract yet. They graduate to `functional_contract.md` only when `/acaf-accept` verifies them. This is the contract-vs-as-built split: promises enter the contract only once they are real.

## Step 3 — the decision record

Write `acaf/decisions/<slug>.md`:

- **Context** — the request in plain words; who it's for and what they're doing; what the records, code and outside search found already exists.
- **Assumptions** — each fact the approach relies on, and how it was checked (read in code, found in docs, asked the user). A fact nobody checked is marked as a guess, and a guess the plan depends on is a question for the user before building.
- **Decision** — the approach, numbered points, concrete (name real files, real libraries, real commands).
- **Alternatives considered** — 2–3 genuinely different routes, including the best one whatever it costs, the simplest one that fully meets the need, and anything that already exists. Each gets its cost, how sure you are, and the one-line reason it lost. For a problem that went through `acaf-explore`, this section is the study: the options that were tried, with their results and costs (cite `acaf/explorations/<slug>.md`). An alternative rejected on cost, effort or UX without a trial is not an alternative considered — try it, or say exactly what blocks the trial.
- **Principles cross-check** — for each principle in `acaf/vision_principles.md`, one clause: served, neutral, or strained (and if strained, why it's acceptable).
- **Checks cross-check** — list every check or judgment the approach adds or changes, and for each say which tool makes the call: **code**, only when the question has an exact answer (text present, a number matches, schema valid, items counted), or **a cheap model** under a written rule with a stated reason, for anything about meaning or context (sameness, relevance, accuracy in context, quality, classification). A heuristic that approximates meaning (overlap scores, keyword or regex lists, length cut-offs) doesn't get to make the call.

## Step 4 — the slice plan

Break the work into small slices (each completable in one focused pass). For EACH slice write a definition of done:

- **Deliverables, source first:** the source files that implement the behavior come first, then test files, then records (`acaf/change_log.md`). A slice whose deliverables are only a test file or only bookkeeping is incomplete — the behavior never actually gets built. The source-first ordering is load-bearing for exactly that reason.
- **Verification:** the project's REAL commands (from the contract's `<!-- verification -->` marker). Never invent a command the project cannot run.
- **Done means:** the acceptance criteria this slice advances.

Append the initiative to `acaf/initiative_manifest.md` under `## Active Initiative`: name, goal, the criteria, the slice list with `[ ]` checkboxes, status `in_progress`, and `build-mode: one-at-a-time` (the default — Step 6 may switch it to `all-at-once`).

## Step 5 — confirm by how sure × how costly

Apply Step 4 of `acaf-direction` to the plan as a whole. The plan is written for your own thinking, and the user rarely reads it, so what they need from this step is the choice, not the document.

- **Sure and cheap** (a precise, small request with an obvious route): don't stop. Report and proceed on the user's next "continue".
- **Sure but costly** (real money, hard to undo, or a change they'd notice): one line with the cost and why, then go on their yes.
- **Not sure** (the route rests on an unchecked guess, or the user might not expect the judgment call): end with the direction check, the options with cost and confidence and your recommendation, plus any question only the user can answer. Wait.

## Step 6 — report, and pick the build cadence

- The initiative name, the criteria, the slice list (one line each).
- **Ask the build cadence once, here:** one slice at a time, or all at once? Say it plainly — *one-at-a-time* (default): you see each slice's diff and say "continue" between them, best for unfamiliar or risky work. *all-at-once*: I build every slice back-to-back — each still gets its own gates, no-op check, record, and commit — and stop the moment a gate fails, a slice no-ops, or the approach is failing; best when you trust the plan. Record the answer as `build-mode:` in the manifest entry.
- **What's next:** one-at-a-time → `Say "continue" → I build slice 1: <name>.` · all-at-once → `Say "continue" → I build all <N> slices, stopping only on a failure.`
