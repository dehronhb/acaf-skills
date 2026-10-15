---
name: acaf-review
description: Independent lead review of recently built ACAF slices — spawn a fresh-context reviewer subagent to adversarially check the diff against the slice plan, the acceptance criteria, and the principles, then act on the verdict. Use after building (especially before /acaf-accept), or when the user says "review this / get it reviewed".
---

# ACAF Review — a fresh pair of eyes, on purpose

The builder must not grade their own homework. The reviewer gets a **fresh context** (a subagent) so it judges the diff and the records — not the intentions of the conversation that produced them.

## Step 1 — assemble the review packet

- The diff: `git diff <base>..HEAD` for the slice commit(s) under review (or `git show` per commit).
- The slice's definition of done + the initiative's acceptance criteria (from `acaf/initiative_manifest.md`).
- The decision record for the initiative, `acaf/vision_principles.md`, and the project's lessons file (`acaf/lessons*.md`) if present.

## Step 2 — spawn the reviewer

Use the `lead-reviewer` agent (in `.claude/agents/`) if present; otherwise a general subagent with the same charge. Give it the packet and this charge, verbatim:

> Review this diff adversarially: your job is to find the ways it does NOT satisfy the definition of done and the acceptance criteria. Check: (1) every DoD deliverable is really present and really changed; (2) the acceptance criteria this slice claims to advance are actually advanced — trace the code path, don't trust names; (3) tests test the real behavior (a test that would pass even if the feature were broken is a finding); (4) nothing outside the declared scope was changed without a recorded deviation (an obvious fix done after the slice as its own recorded change — its own change-log row and commit — is in bounds); (5) no principle from vision_principles.md is silently violated; (6) the approach and the outcome: if this solves a problem new to the project, it was chosen from an option study (`acaf/explorations/`), not by dismissing untried options on assumed cost or effort — and for anything user-facing, the RESULT itself serves the user's goal, judged directly, not only through its tests; (7) the right tool makes every check: code only for questions with exact answers, a cheap model under a written rule (with a stated reason) for anything about meaning or context — a heuristic that approximates meaning (word overlap, similarity thresholds, keyword or regex lists, length cut-offs) is a finding, with an example input it gets wrong; (8) the thinking behind the work, judged against the user's goal: a limit the user never set (a cap, a sample, a cut scope, a cheaper path that lowers quality); a fix to the one reported instance where the same pattern lives elsewhere; something rebuilt that already exists in the codebase or the references; a design resting on an unchecked guess about the user or the world; work handed back to the user that the agent could have done; "done" judged only by the agent's own checks, not by running the real thing. Each is a finding with the evidence. **Before flagging a failure, verify your instrument:** confirm the requirement you're checking is actually required and that your reproduction is valid — a wrong finding costs as much as a missed one. Return a verdict: `pass`, or `return` with a numbered list of concrete findings (file + line + why it fails).

Don't run the review inline in your own context if a subagent is available — independence is the point.

## Step 3 — act on the verdict

- **pass** → record one line in `acaf/change_log.md` ("Reviewed: <slices> — pass") and report.
- **return** → for each finding: fix it (a normal small change: implement → gates → commit) or, if you believe the finding is wrong, verify that with evidence and record the disagreement honestly in `acaf/deviation_log.md` (`DEV-<n>`: the finding, your evidence, the disposition). Never silently drop a finding. Then offer a re-review.

## Step 4 — report

- The verdict, the findings (if any) and what you did about each.
- **What's next:** on pass at initiative end → `Say "/acaf-accept" → I close the initiative against its criteria.` On fixes applied → `Say "/acaf-review" → re-review the fixes` (recommended) or continue building.
