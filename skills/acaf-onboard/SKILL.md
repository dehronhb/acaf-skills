---
name: acaf-onboard
description: Set up the ACAF project-memory scaffold (the acaf/ folder) on a new or existing project — interview the user for intent, write the functional contract, and build an HONEST functionality index from the real code. Use before any feature work on a project that has no acaf/ folder, or when the user says "onboard", "set up acaf", or "initialize the method".
---

# ACAF Onboard — create the project's durable memory

You are setting up the file-based memory this project will run on. Everything later skills do depends on these files being honest. Don't start feature work in the same turn — onboarding is its own deliverable.

## Step 0 — check

If `acaf/` already exists with an `intent_brief.md`, stop and tell the user this project is already onboarded (offer `/acaf-pickup` instead).

## Step 1 — interview the user (short)

Ask, conversationally or via the question tool, only what you cannot infer:

1. What is this project, in one or two sentences? Who is it for?
2. What does a successful first version DO — the 3–7 behaviors that matter?
3. Any hard constraints (tech stack, platforms, integrations, things it must never do)?
4. What do you care about most: speed of iteration, correctness, polish, cost? (This seeds the principles.)

## Step 2 — survey the real code (existing projects only)

If the project has source code, READ it before writing anything — the entry points, the main modules, `package.json`/`Makefile`/build config. The functionality index must list what actually exists, verified by your own reading. Don't infer functionality from a README alone, and don't invent an entry. If the project is empty, the honest index says nothing is built yet — that is correct, not a gap.

Also note the project's REAL verification commands (test/lint/build) from its config. If none exist, record "no toolchain yet — verification is by inspection" honestly.

## Step 3 — write the scaffold

Create these files (keep every one SHORT — a record, not an essay):

- `acaf/intent_brief.md` — the interview answers: purpose, audience, the v1 behaviors, constraints.
- `acaf/functional_contract.md` — the promises table. Rows only for behavior that is **accepted as required**; it may start near-empty. If the project has a PRD/requirements docs, you MAY seed rows from them — but every seeded row's History cell must read `seeded from <doc>, not yet verified` (whether the behavior is already BUILT is the index's business; the contract tracks verification), so a seed can never be mistaken for a verified promise (acceptance flips it later). Seeding is optional — an empty contract is equally honest, especially on an existing codebase. Columns: `| ID | Criterion (present tense) | Verification | History |`. Add a `<!-- verification: commands=... -->` comment naming the project's real gate commands (or `inspection-only`).
- `acaf/functionality_index.md` — the as-built truth. Existing project: one row per real capability you verified by reading (`| ID | What it does | Where it lives | Related tests |`). Empty project: a heading plus "Nothing is built yet." This file must never claim more than the code contains.
- `acaf/vision_principles.md` — 5–8 numbered principles, seeded from the interview plus these defaults: (1) If it isn't recorded, it didn't happen. (2) Report honestly — a step that changed nothing is a failure, not a success. (3) Small bounded slices; do obvious small fixes right after the slice, and park only non-trivial discoveries — never derail. (4) The user decides direction; the agent decides implementation detail. (5) Verify with the project's real commands, never invented ones.
- `acaf/initiative_manifest.md` — sections `## Active Initiative` ("None.") and `## Completed`.
- `acaf/follow_up_backlog.md` — "Parked ideas land here as `FB-<n>` entries with one-line context."
- `acaf/change_log.md`, `acaf/deviation_log.md` — headed, empty. Deviations will be `DEV-<n>` entries: what diverged from the plan and why.
- `acaf/decisions/` — empty folder (plan writes into it).
- `acaf/handoff_summary.md` — two lines: what this project is, and "Next: plan the first initiative (`/acaf-plan`)."

If the project uses git and `acaf/` should be committed (default: yes), make one commit: `chore: onboard the ACAF method (acaf/ scaffold)`. **Before the first commit you make here, verify the repo-local identity:** run `git config user.email` and confirm it matches the account this project belongs to — on multi-account machines the GLOBAL identity is often a different (e.g. work) account, and an un-overridden repo silently mis-attributes every commit. If the project's CLAUDE.md has a machine-specific git note, follow it exactly; if the identity is wrong or unset and you cannot determine the right one from the records, ASK the user rather than committing.

**If the repo has NO commits yet** (a fresh init with the source untracked), the scaffold commit cannot stand alone — make TWO commits: (1) the project baseline, (2) the `acaf/` scaffold on its own. Before staging the baseline, sweep what `git status` would include and harden `.gitignore` FIRST: secrets (`.env*`, keys, tokens) must be excluded; large or regenerable artifacts (binaries, build output, generated data/logs) should be excluded; and content the user may not have the right to publish (proprietary or third-party material) is a decision you must ask about — never publish it on your own judgment. Everything else about the two-commit default needs no question. Push only if the user asked for a push; after any push, verify attribution per the CLAUDE.md machine note.

## Step 4 — report

End with:

- What you wrote, in one sentence per file that carries content.
- For an existing project: the functionality index's row count and anything surprising you found.
- **What's next:** `Say "/acaf-plan <your first feature>" → I turn it into a bounded, planned initiative.`
