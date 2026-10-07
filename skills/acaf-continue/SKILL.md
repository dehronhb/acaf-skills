---
name: acaf-continue
description: The one "next move" entry point for an ACAF project — read the current state from the records, then advance the active initiative by exactly one step (build the next slice, run the review, or do the acceptance walk), or, if nothing is in flight, propose sourced next directions for the user to pick. This is the router/orchestrator. Use for "continue", "next", "keep going", or when the user is unsure what to do next.
---

# ACAF Continue — one key: read the state, take the next step, or propose

This is the router — the ACAF IDE's **Orchestrator** role, ported. It does not do a phase's work in its own voice; it reads the records, decides WHICH phase is next, and runs that skill's procedure — or, when the path is genuinely open, proposes directions. **One invocation = one step forward, then report.**

## Step 1 — orient from disk (not from memory)

Read enough to know the true state: `acaf/initiative_manifest.md` (is an initiative active? which slices are ticked? reviewed? accepted?), the tail of `acaf/change_log.md`, and `git status` (uncommitted drift?). This is a fast pickup — resume from the files, never from a hunch about last turn.

## Step 2 — route (like the Orchestrator): pick the ONE next step

In this order:

1. **Drift first.** If the records or git are inconsistent (uncommitted work not logged, a stale handoff), fix that before new work, and say what was off.
2. **A challenge with no proven approach, or an approach failing its goal / getting worse** → run the `acaf-explore` procedure (the option study: every option, its levers, a trial of each, a cost and trade-off report) — the user's choice then goes to `acaf-plan`.
3. **Slices remaining** → run the `acaf-build` procedure, honoring the manifest's `build-mode`: `one-at-a-time` builds the next slice (gates, records, one commit); `all-at-once` builds all remaining slices back-to-back, each gated/recorded/committed, halting on the first failure.
4. **All slices built, not reviewed** → run the `acaf-review` procedure yourself (spawn the reviewer). Don't hand back a command — run it, then report findings.
5. **Reviewed, not accepted** → run the `acaf-accept` procedure: criteria against evidence, graduate the met ones, hand back the batched human checklist.
6. **Nothing in flight** → the open fork. Do NOT start work. Propose 2–4 sourced candidate directions (backlog, contract gaps, unrealized vision principles, PRD/intent) — each with a one-line why, its source, and the exact words to pick it — and let the user choose.

If the last turn already named a clear lead action (`Say "continue" → I do X`), continue means **do X** — honor it, don't re-derive a different move.

## Step 3 — the boundary (what continue will NOT do on its own)

- **One phase per invocation, then stop and report.** Don't cascade across phases — build → review → accept — in a single turn; each produces something the user should see (a slice diff, review findings, the human checklist) before the next. (Building several slices under `build-mode: all-at-once` is still one phase, not a cascade — it runs the build phase to the end, then stops at the review boundary.)
- **Don't invent scope.** At the idle fork you propose and the user disposes; "continue" is not a licence to start a new initiative on your own.
- **The user still owns direction** (a core principle). This skill only removes two frictions: having to name the obvious next step, and the passivity of an empty "what now?". It does not remove the human from the decisions that are theirs.

## Step 4 — report

Report in the style of whichever step you ran (build / review / accept), and always end with the **What's next** block in your own voice — the lead action the next `continue` will take, or the proposed directions when you are at a fork.
