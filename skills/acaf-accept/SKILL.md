---
name: acaf-accept
description: Close the active ACAF initiative — walk every acceptance criterion against real evidence, graduate verified criteria into the functional contract, true-up the as-built functionality index, write the handoff summary, and hand the user the batched list of human-only checks. Use when an initiative's slices are built ("accept", "close the initiative", "wrap this up").
---

# ACAF Accept — the completion gate

Acceptance is evidence-based. Nothing graduates on memory or good intentions.

## Step 1 — the criteria walk

For EACH acceptance criterion on the active initiative (from `acaf/initiative_manifest.md`):

- **Find the evidence and exercise it.** Run the relevant test, or run the code path, or open the file and trace it. "The slice that was supposed to do this is checked off" is not evidence. For anything the user will use, exercise it the way they will: the built app, the real launch path, the real output, looked at (screenshots for anything visual).
- Verdict per criterion: **met** (with the evidence, one line) / **not met** (what's missing) / **human-only** (only a person can judge taste and feel, such as whether it looks right or reads well). Anything you can check yourself is not human-only: run it.
- Any **not met** → the initiative does not close. Report which, and offer to plan the gap as remaining slices. Don't close over an unmet criterion, and don't quietly delete one — if a criterion was wrong, record the correction as a `DEV-<n>` entry with the user's sign-off.

## Step 2 — graduate into the contract

For each **met** criterion, add (or update) a row in `acaf/functional_contract.md` — the criterion in present tense, its verification method, and a History cell citing this initiative and date. A SEEDED row (History marked seeded / not yet verified, in any phrasing) is updated IN PLACE — flip its History to verified-by-this-initiative; never duplicate it. The contract only ever contains promises that were verified real.

## Step 3 — true-up the as-built index

Re-read the touched source and make `acaf/functionality_index.md` match reality: new capabilities added, changed rows updated. The index states what IS; the contract states what MUST BE; do not blur them.

## Step 4 — regression spot-check

Re-verify the existing contract rows this initiative could affect: every verified row whose verification touches a file this initiative changed, plus rows that share behaviour with the change (a login change → the session-timeout row) (run their tests / exercise them) — **only rows previously VERIFIED**; a seeded-not-yet-built row has nothing to regress and must not be reported as a failure. A new feature that silently broke an old promise is a failed acceptance — surface it, don't ship it.

## Step 5 — close the records

- Move the initiative to `## Completed` in the manifest (date + one-line outcome). Close it with human-only checks still pending, and list them in the handoff; a human check that later fails becomes an `FB-<n>` entry (or a new initiative if the user says so), not a reopening of this one.
- Rewrite `acaf/handoff_summary.md`: what the project now is, what just shipped, what's parked, the recommended next initiative. Written for a reader with NO access to this conversation.
- One commit: `docs: close <initiative> (accepted against criteria)`.

## Step 6 — the batched human checklist

List every **human-only** verdict from Step 1 (plus any perceptual checks noted during the build) as one checklist the user can run in a single sitting — each item: what to open/do, and what "good" looks like. Do not interleave these during builds; batching them here is the method.

## Step 7 — report, then propose the next directions

- Criteria: met / human-only counts (and the evidence lines).
- What graduated into the contract; what the index now says.
- The human checklist.
- **What's next — you propose, the user picks.** The initiative just closed, so the genuine open question is *which direction next* — and that is yours to source from the records, not the user's to invent. Read `acaf/follow_up_backlog.md` (parked `FB-` items), the gaps and unmet rows in `acaf/functional_contract.md`, principles in `acaf/vision_principles.md` not yet realized, and any PRD/intent docs, then present **2–4 concrete candidate initiatives**. For each: a short name, one line on why it matters now, its source (`FB-2` / `PRD §4` / "contract gap: X"), and the exact words to start it — e.g. `Say "canvas parity" → I plan the gold-standard zoom/pan/device-switching work (FB-2)`. Lead with the one you'd recommend and say why in a phrase, but make them real choices. Don't end with a bare `Say "/acaf-plan <thing>"` that puts the ideation back on the user.
