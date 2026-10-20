---
name: acaf-lesson
description: Turn a course correction into a lesson. When the user steers you back (a wrong assumption, a rejected approach, a misread request, a shortcut they didn't ask for, work handed back, something rebuilt that already exists, something called done that isn't, or a bug they found that your own checks should have caught), name what you assumed and what is true, find everywhere else that assumption shaped the work, fix the route, and record the lesson as a thinking habit in the project's lessons file (acaf/lessons.md or the one it already keeps). Use on any redirect, including "why did you…", "are you sure…" and "is this the right path?".
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
12. **The user found my bug:** a problem reached the user that my own checks should have caught first.

## Step 1b — when the user found a bug: why didn't I find it first?

A bug the user hits is two mistakes: the one that made the bug, and the gap in your checking that let it through. Bugs should be caught before they reach the user, so answer both:

- **Why the bug happened:** the assumption behind it (Step 1).
- **Why your checks missed it:** what you tested and what you didn't, such as the happy path but not the trip back, one starting spot but not others, a script but not the real click, a log but not the screen.
- **The check that would have caught it:** add it now, for the whole class of bug, not just this instance: a test, a scripted run from several starting points, a screenshot from the user's view. Run it, and make it part of how you verify this kind of change from now on.

## Step 2 — find everywhere else it applies

Search the work for the same assumption: other files with the same bug, other screens with the same pattern, other plans or records built on the same belief, earlier decisions that rest on it. List what you find. Fix what's small and obvious now. Anything bigger becomes part of the corrected plan.

## Step 3 — correct the route

If the correction changes the approach, run `acaf-direction` on the new route before building. Don't paste a fix onto the old route. Record the change as a `DEV-<n>` entry if an initiative is active.

## Step 4 — record the lesson

Append to the project's lessons file. That's `acaf/lessons.md`, or the one the project already keeps (any `acaf/lessons*.md`, such as `lessons_learned.md`, or one its `CLAUDE.md` names). Never start a second lessons file. Create `acaf/lessons.md` with a `# Lessons` heading only if none exists. In an existing file, follow its layout and numbering, and include these parts:

```
## L-<n> — <the habit, as an instruction to yourself> (<date>)
- Trap: <number and name from Step 1>
- What happened: <one line: what I did, what the user said>
- The habit: <how to think next time, general enough to apply beyond this case>
- The check (for a bug the user found): <how I'll catch this kind of bug myself from now on>
- Scope: project | kit
```

**Then update the file's `## Top habits` list**, at the very top under the title (create it if missing). It holds at most 10 one-line habits: the ones that would most change how an agent works on this project. Fold the new lesson in by merging it with a habit it repeats, or by replacing the weakest one if it matters more. This list is the part every session actually reads and keeps in mind. The full entries below it are the reference: the evidence, and project facts to look up when doing that kind of work. Why: a long lessons file gets recorded but not absorbed. In one project a 250-line file sat beside the same struggles repeating.

Write the habit as a way of thinking, not a rule about this one case: "Before fixing a reported bug, search for every place the same pattern appears", not "Check the badge logic on all screens". Mark **kit** when the habit would help on any project; those get folded into the ACAF kit later.

Lessons go in the project's records, not private memory, so every future session and every other agent on the project reads them. `acaf-pickup` reads this file at the start of each session.

## Step 5 — tell the user, briefly

One or two lines at the start of your reply: what you'd assumed, what you've changed, and where else it applied. Then get on with the corrected work.
