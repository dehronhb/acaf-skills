---
name: acaf-lesson
description: "Turn a course correction into a lesson. When the user steers you back (a wrong assumption, a rejected approach, a misread request, a shortcut they didn't ask for, work handed back, something rebuilt that already exists, something called done that isn't, or a bug they found that your own checks should have caught), name what you assumed and what is true, find everywhere else that assumption shaped the work, fix the route, and record the lesson as a thinking habit in the project's lessons file (acaf/lessons.md or the one it already keeps). Questions like \"why did you…\", \"are you sure…\" or \"is this the right path?\" are possible redirects: check the work first, and record a lesson only if an assumption of yours was actually wrong."
---

# ACAF Lesson — learn the thinking, not just the fix

A correction is the most useful thing the user gives you. Each one shows a way you were thinking about the problem that didn't match theirs. Fixing only the instance they pointed at wastes it: the same assumption usually shaped other parts of the work, and it will shape the next decision too.

## Step 0 — is it a lesson?

Check the work before you agree with the question. Then:

- **An assumption of yours was wrong** → a lesson. *Examples:* you built the walk from navigation when AAMS's own animations existed; you said "fixed" without trying it; you capped summaries at 6,000 words when the user never asked for a cap; the user hit a bug your checks should have caught.
- **You were right** → say why in one or two plain lines, with the evidence, and record nothing. Don't rewrite correct work to please the question.
- **Not a lesson:** the user changing their mind ("actually, make it blue"), or a fact you couldn't have looked up or reasonably asked about, such as a new preference. Just do it. *But:* a fact you guessed and the user corrected is a lesson (trap 6), because you could have checked or asked.

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
13. **Out of proportion:** went deep (hours, money, polish) without one quick question about real use that would have sized the work.

## Step 1b — when the user found a bug: why didn't I find it first?

A bug the user hits is two mistakes: the one that made the bug, and the gap in your checking that let it through. Answer both:

- **Why the bug happened:** the assumption behind it (Step 1).
- **Why your checks missed it:** what you tested and what you didn't. *Examples:* the happy path but not the trip back down the ladder; one starting spot but not the corner; a script but not the real mouse click; a log line but not the screen.
- **The check that would have caught it:** add it now for the whole class of bug, run it, and use it whenever you verify this kind of change. *Example:* not "test the ladder from the platform," but "run every menu choice from every place the character can stand, both directions."

## Step 2 — find everywhere else it applies

Search the work for the same assumption: other files with the same bug, other screens with the same pattern, other plans or records built on the same belief, earlier decisions that rest on it. List what you find.

- **Fix it now** only if it passes the user's small-fix test (in `~/.claude/CLAUDE.md`: the same cause or a plain error, changes nothing the user set or chose, takes a few minutes) and sits in the area the current task already touches. *Example:* the same off-by-one in three sibling files of the feature you're working on.
- **List it instead** when it's in a different area, needs a design change, or means rewriting a record. Those go through `acaf-direction` (and into the plan, or an `FB-<n>` entry in `acaf/follow_up_backlog.md`).

## Step 3 — correct the route

The correction changes the approach when the right fix uses a different method, tool or scope. *Example:* a keyword list → a cheap model judging meaning. *Not a change of approach:* fixing the same method in more places. When it changes the approach, run `acaf-direction` on the new route before building; don't paste a fix onto the old route. If an initiative is active, record the change as a `DEV-<n>` entry in `acaf/deviation_log.md`.

## Step 4 — record the lesson

The project's lessons file is `acaf/lessons.md`, or the one the project already keeps (any `acaf/lessons*.md`, such as `lessons_learned.md`, or one its `CLAUDE.md` names; if several exist, use the one `CLAUDE.md` names, else the largest, and mention the others to the user). Never start a second lessons file. Create `acaf/lessons.md` with a `# Lessons` heading only if none exists.

**First, look at what's already there.** A lessons file that only grows stops being read: one project's reached 51,000 words of near-repeats. So before writing, search the file (its principles, Top habits and entries; skip `lessons_archive.md`) for lessons about the same cause or the same kind of work, and read them. Then do exactly one of these:
- **Already covered:** don't add an entry. Add this case to the existing one as a one-line example with its date, and sharpen its wording if this case showed a gap. *Example:* a second "I called it done from the tests" goes under the existing "check it the way the user meets it" lesson.
- **A refinement:** the existing lesson is right but missed a nuance this case shows. Rewrite that lesson to include it, in place, and note the date of the change.
- **A conflict:** an existing lesson would have told you to do the opposite here. *Example:* an old "always ask before spending" against the user now saying "just run the cheap test". Don't pick one yourself. Ask the user one question in plain words: quote both lessons in a line each, give 2 to 4 multiple-choice answers that are possible nuances (who, when, how much), and put your pick first. Then rewrite the lesson as one entry with their answer and the date, quoting them.
- **New:** nothing related exists. Add an entry.

**Facts are not lessons.** How a tool, engine or service behaves ("this API caps uploads at 8 MB") goes in the project's topic notes (`acaf/notes/<topic>.md`, created if needed, with one line under `## Reference notes` in the lessons file saying when to read it). The lessons file holds how to think and act.

Follow the file's layout and numbering for a new entry, and include these parts. Keep it to about six lines: the story belongs in the change log or deviation log, not here.

```
## L-<n> — <the habit, as an instruction to yourself> (<date>)
- Trap: <number and name from Step 1>
- What happened: <one line: what I did, what the user said>
- The habit: <how to think next time, general enough to apply beyond this case>
- The check (for a bug the user found): <how I'll catch this kind of bug myself from now on>
- Scope: project | kit
```

Write the habit at the right height:
- **Too narrow:** "Check the badge logic on all screens." (One case; won't transfer.)
- **Too vague:** "Be more careful with fixes." (No agent can act on it.)
- **Right:** "Before fixing a reported bug, search for every place the same pattern appears, and fix those in the same pass."

Mark **kit** when the habit would help on any project; those get folded into the user's every-project habits or the ACAF kit later.

**Then update the file's `## Top habits` list**, at the very top under the title, even if the file never had one. It holds at most 10 one-line habits: the ones that would most change how an agent works on this project's next tasks. Don't repeat a habit that's already in the user's every-project list (`~/.claude/CLAUDE.md`, "Top habits (every project)"); a mod reads both lists together. If the lesson isn't already covered: add it as a new line while the list has fewer than 10; at 10, merge it into a habit it repeats or replace the weakest one. The weakest one is the habit least likely to change what an agent does on this project's next tasks. Only its Top-habits line goes; its full entry stays.

Why the list exists: a long lessons file gets recorded but not absorbed. In one project a 700-line file sat beside the same struggles repeating. The list is what every session reads and a mod reminds agents of; the full entries below it are the evidence, and project facts to look up when doing that kind of work.

Lessons go in the project's records, not private memory, so every future session and every other agent on the project reads them.

If the lessons file is now over about 6,000 words, say so in your reply and suggest running `acaf-lessons-audit` at the next natural break (the ACAF mod also reminds you).

## Step 5 — tell the user, briefly

One or two lines at the very start of your reply: what you'd assumed, what you've changed, and where else it applied. Any decision you need from the user comes right after those lines. Then get on with the corrected work.
