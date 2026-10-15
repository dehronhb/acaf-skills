---
name: acaf-lesson
description: Turn a course correction into a lesson. When the user steers you back (a wrong assumption, a rejected approach, a misread request, a shortcut they didn't ask for, work handed back, something rebuilt that already exists, something called done that isn't), name what you assumed and what is true, find everywhere else that assumption shaped the work, fix the route, and record the lesson as a thinking habit in acaf/lessons.md. Use on any redirect, including "why did you…", "are you sure…" and "is this the right path?".
---

# ACAF Lesson — learn the thinking, not just the fix

A correction is the most useful thing the user gives you. Each one shows a way you were thinking about the problem that didn't match theirs. Fixing only the instance they pointed at wastes it: the same assumption usually shaped other parts of the work, and it will shape the next decision too.

## Step 1 — name the wrong assumption

One sentence: "I assumed X; actually Y." Name the assumption, not the symptom. "I fixed the wrong file" is a symptom. "I assumed the flagged line was the only place this bug lives" is the assumption.

Then name which trap it was (more than one can apply):

1. **The example, not the problem:** fixed the instance pointed at, not every instance or the shared cause.
2. **Shrinking the goal:** cut quality, length, scope or completeness to fit the easy path, or invented a limit.
3. **"I can't":** handed work back, or dropped an option, without really trying.
4. **Mechanism before person:** designed from the machinery, not from what the person is doing.
5. **Inventing instead of finding:** built what already exists in the code, a reference, or the world.
6. **An unchecked belief about the world:** designed on a guessed fact about the user, the product or how things work.
7. **Big before small:** scaled up, or spent, before the hardest small case worked.
8. **Doubling down:** kept patching an approach that kept failing.
9. **Grading my own homework:** called it done by my own check, not by the user's experience.
10. **The letter of a rule:** followed a rule or an old constraint against its purpose.
11. **Code for judgment:** used rules, templates or thresholds where a model should judge meaning.

## Step 2 — find everywhere else it applies

Search the work for the same assumption: other files with the same bug, other screens with the same pattern, other plans or records built on the same belief, earlier decisions that rest on it. List what you find. Fix what's small and obvious now. Anything bigger becomes part of the corrected plan.

## Step 3 — correct the route

If the correction changes the approach, run `acaf-direction` on the new route before building. Don't paste a fix onto the old route. Record the change as a `DEV-<n>` entry if an initiative is active.

## Step 4 — record the lesson

Append to `acaf/lessons.md` (create it with a `# Lessons` heading if missing):

```
## L-<n> — <the habit, as an instruction to yourself> (<date>)
- Trap: <number and name from Step 1>
- What happened: <one line: what I did, what the user said>
- The habit: <how to think next time, general enough to apply beyond this case>
- Scope: project | kit
```

Write the habit as a way of thinking, not a rule about this one case: "Before fixing a reported bug, search for every place the same pattern appears", not "Check the badge logic on all screens". Mark **kit** when the habit would help on any project; those get folded into the ACAF kit later.

Lessons go in the project's records, not private memory, so every future session and every other agent on the project reads them. `acaf-pickup` reads this file at the start of each session.

## Step 5 — tell the user, briefly

One or two lines at the start of your reply: what you'd assumed, what you've changed, and where else it applied. Then get on with the corrected work.
