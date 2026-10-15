---
name: acaf-build
description: Execute the active ACAF initiative's slices — one at a time (default) or all at once, per the manifest's build-mode. Each slice: declare the files to change (source first), implement, run the project's real gates, verify the definition of done honestly (a step that changed nothing is a FAILURE), record, and make one commit. Use to advance the active initiative ("build", "next slice", "continue the initiative").
---

# ACAF Build — one slice, honestly

One slice = small, verified, recorded, committed. Check `build-mode` in the manifest: **one-at-a-time** (default) builds a single slice, then stops and reports; **all-at-once** builds the remaining slices back-to-back — each still fully gated, recorded, and committed on its own — stopping only on a failure (Step 7). Never collapse two slices into one commit.

## Step 0 — orient

Read `acaf/initiative_manifest.md` (the active initiative + its slice checkboxes), the decision record, and the project's lessons file (`acaf/lessons*.md`) if present. If no initiative is `in_progress`, stop and point to `/acaf-plan`. Pick the first unchecked slice.

## Step 1 — declare the writes

Before touching anything, state the slice's expected writes from its definition of done — **source files first, then tests, then records**. If the DoD has no source file for a behavior-changing slice, the plan is wrong: fix the plan first (and note the correction), don't improvise.

## Step 2 — implement

- Read every file you will change before changing it. Match the surrounding style.
- **Before writing any check, ask whether the question has an exact answer.** If it's about meaning or context, a cheap model call under a written rule makes the call and gives its reason; code only gathers candidates for it. If you catch yourself tuning a heuristic (a threshold, a word list, an overlap score) to make code judge meaning, stop and use the model instead.
- Stay inside the declared writes. Needing an undeclared file mid-slice is fine ONCE — declare it out loud, add it to the DoD, continue. Needing many means the slice was mis-planned: stop, re-plan.
- **Discoveries mid-slice:** if the fix is common sense — small, obvious, and you know exactly what to build — just do it, right after the current slice lands, as its own change (its own `change_log.md` row and commit; fold it into the slice only when it's on-topic). Reserve `FB-<n>` entries in `acaf/follow_up_backlog.md` for the user's own ideas they aren't ready to build, and for genuinely non-trivial discoveries that need their own plan. Don't derail the slice, and don't park the obvious.
- **Fixing a reported problem** (a bug, a review finding, a piece of feedback): first ask what it's an example of. Search for every place the same pattern appears and fix them all, or fix the shared cause, and add a test that would catch the whole class. Fixing only the instance someone pointed at guarantees another round.
- **A fork mid-slice** (a new library or service, a paid call, a scope change, a deviation the user would notice, or an urge to say "I can't"): run `acaf-direction`. Cheap and certain choices are yours; unsure and costly ones go to the user. Before concluding you can't do something (run a build, use a tool, reach a service), really try, and look for a way.
- **If the approach itself is failing the goal** (the results are not what the user needs, or are getting worse, even with every gate green), or two fixes in a row haven't worked, or you catch yourself building a fix for a fix to keep it alive: stop. Record a `DEV-<n>` and run `acaf-explore` before another slice goes into that approach. Green gates on a worsening outcome are a failure, not progress.

## Step 3 — the honest postcondition (the no-op rule)

After implementing, verify mechanically, before claiming anything:

1. Every declared file **exists**.
2. Every declared file **actually changed** (diff it). A slice that "completed" while its declared files are byte-identical is a failed slice — report it plainly and either fix it or mark the slice blocked. Don't report a no-op as done; here your honesty is the only enforcement.
3. The change is the change *requested* — if partway you solved a different problem than the slice names, say so.
4. **It works the way the user will meet it.** Passing tests isn't done. Run the real thing the way the user does (the built app, the real launch path or shortcut, the real output) and look at it; for anything visual, take a screenshot and compare it with what was asked. Do this yourself rather than leaving it as a human check.

## Step 4 — gates

Run the project's real verification commands (the contract's `<!-- verification -->` marker). All output is evidence:

- **Green** → proceed.
- **Red** → fix if the failure is yours; if it pre-existed, record it honestly (a `DEV-<n>` entry) and tell the user — never bury a red gate in a green report.

## Step 5 — record

- `acaf/change_log.md`: one row — date, slice, what changed, why (a reader who wasn't here must understand it).
- `acaf/deviation_log.md`: a `DEV-<n>` entry for ANY divergence from the plan (skipped deliverable, changed approach, discovered constraint) with the why. No deviation is too small to record; unrecorded drift is how projects rot.
- Tick the slice checkbox in the manifest.
- If `acaf/functionality_index.md` gained or changed a capability in this slice, update its row NOW (the index must track the as-built truth continuously, not at the end).

## Step 6 — commit

One commit for the slice. Message: what and why in plain language, first line under ~70 chars, e.g. `feat(auth): add password reset flow (slice 2 of INIT_AUTH)`.

## Step 7 — report, then continue or stop

Report this slice, Run-Status style:
- **Slice:** which one, and its verdict (done / failed / blocked — never soften a failure).
- **What changed:** the files, one line each.
- **Gates:** the actual result ("tests 42 → 45 passed"), not adjectives.
- **Parked / deviations / obvious fixes:** any FB-/DEV- entries made, and any obvious fixes done after the slice (with their commits).

**Halt conditions (BOTH modes) — stop and report now; never carry a failure into the next slice:** a red gate you can't fix, a no-op / failed / blocked slice, a slice that needed many undeclared files (re-plan), or an approach failing its goal (→ `acaf-explore`).

Then branch on `build-mode`:
- **one-at-a-time:** stop here. **What's next:** if a slice remains → `Say "continue" → I build slice <n+1>: <name>.` If this was the last slice, the review is yours to run — run it now or offer it: `Say "review it" → I run an independent reviewer` (recommended before accepting), then `Say "accept" → I close the initiative against its criteria and hand you the human checklist`.
- **all-at-once:** if a slice remains and no halt condition fired, go straight back to Step 1 for the next slice — no pause. After the last slice, stop at the phase boundary (do NOT auto-run review or accept): give a one-line-per-slice summary with gate results, then offer the review: `Say "review it" → I run an independent reviewer over the finished slices` (recommended before accepting).
