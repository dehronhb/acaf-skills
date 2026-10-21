---
name: acaf-brief
description: A skimmable brief for the user, on request only - where the project stands, the real options from here, and the trade-off of each, in plain words. Run only when the user types /acaf-brief.
disable-model-invocation: true
---

# Brief: where we are, the options, the trade-offs

The user asked for this because they want to understand and decide, fast. They will skim it. Everything below serves one goal: after a ten-second read they know where things stand and what each choice gets and costs them.

This changes nothing. Don't start any work in this turn.

## First, find out (don't answer from memory)

- If the project has an `acaf/` folder, read `initiative_manifest.md`, `handoff_summary.md`, the last ~5 entries of `change_log.md` and `deviation_log.md`, `follow_up_backlog.md`, and the lessons file (`lessons*.md`) if present.
- Run `git status` and `git log --oneline -5`.
- Use this conversation for anything the files don't hold yet: decisions just made, questions still open.
- If anything is unclear or the records disagree with the code, say so in the brief rather than guessing.

## Then write exactly this, and nothing else

```
## Where we are
<2-3 plain sentences: what we're building, what's done, what's in progress, anything stuck, and any place the records disagree with the code.>

## Your options

**1. <short name>** (recommended)
- You get: <the outcome, as you'd notice it>
- It costs: <$ spend; about N min of my work; about N min of yours (testing, reviewing)>
- How sure: <sure / fairly sure / a guess, and why in a few words>
- You give up: <the trade-off>

**2. <short name>**
...

## My pick
<One sentence: which one and why.>
Say "1" → <what I'll do>. Say "2" → <what I'll do>.
```

## Rules

- **2 to 4 options, recommended first, and every one is a real choice** the user might pick. Include "stop here" or "wait" only when it's genuinely reasonable: for example, the next step needs the user's own test on a device, or spend is waiting for their yes. Not just because work is unfinished.
- **Plain words, as if for a smart 10-year-old.** No jargon, no internal names (no FB-12, no slice numbers, no file names) unless the user needs one to act. If you must use a term, explain it in five words.
- **Real numbers:** dollars, minutes, hours. Not "cheap" or "a while". If you don't know a cost, say "unknown" and why.
- **"How sure" is honest.** A guess is labelled a guess.
- **Short.** The whole brief fits on one screen (about 25 lines). Cut anything that doesn't help the user choose.
- **Nothing after "My pick."** No extra notes, caveats or summaries below it.
