---
name: acaf-direction
description: The direction check, for any fork in the road on an ACAF project. Understand the problem in the user's terms, find what already exists, lay out the real options with cost and confidence, then decide by "how sure × how costly" whether to act, tell, test small, or stop and ask. Use when you are about to choose a route, approach, tool, library, vendor or test plan; spend real money; change scope or what the product does; drop an approach; or conclude that something can't be done. It applies mid-build as much as at the start, scaled to the size of the fork (see "How much of this to do").
---

# ACAF Direction — choose the route on purpose

Most wrong turns don't happen when a project starts. They happen mid-work, when an agent reaches a fork and quietly takes the nearest path: the one flagged spot instead of every spot like it, the cheaper version, its own guess, its own test. This check makes the fork visible, keeps the cheap and certain choices yours, and puts the unsure and costly ones in front of the user with the real options.

The user owns direction, taste and spend. You own the mechanics, and the thinking that comes before any of it.

## How much of this to do

Scale the check to the fork. Make a quick first call with the Step 4 table:

- **Cheap and sure** (most small choices): decide in your head and mention it in one line in your final message. No write-up. *Example:* reusing the project's existing date helper instead of writing a new one.
- **Cheap but not sure:** run the smallest test that could prove you wrong (the table's cell), then decide. No write-up.
- **Costly:** run Steps 1 to 6, one line per bullet, skipping any bullet that's obvious for this fork. If you're sure, Step 5 is just the one-line cost and reason; if you're not, it's the full options. *Example:* switching the speech-to-text vendor; a study that would cost $8 in API calls; dropping a feature the user asked for.

## Step 1 — understand the problem in the user's terms

Write it down (in the decision record, the study file, or your working notes), one line per bullet:

- **Who it's for and what they're doing**, step by step, as a real person would. Start from the person, not the mechanism. *Example:* "The DM clicks a ledge, picks 'Climb here', and watches Stryder get there," not "add a route planner."
- **What "good" looks like to the user**: the outcome they would judge by, not a metric that's easy for you to check. *Example:* "his feet step, no sliding," not "speed within 5% of target."
- **How big real use is**: how many people, how often, how much. When the answer would change how much work this deserves and you don't know it, ask the user before going deep: one question with 2 to 4 multiple-choice answers, and what each answer means for the work. *Example:* "How many players will use the portrait button? (a) just my 3 test players, (b) up to 10, (c) a public launch" — "only 3 players, about 20 pictures each" can turn hours of worst-case work into none.
- **What you're assuming.** Separate facts you believe about the world, the user or the product from decisions you're making. Check each fact you can check; ask about the ones you can't, in plain words. A guessed fact never goes into a design, a document or a test without being marked as a guess. *Examples of facts that turned out wrong:* "every business has a counter," "the user runs one session per project," "the photo always arrives before the question."
- **Whose limits these are.** A limit the user set (a budget, a platform, a date) binds. A limit you introduced (a length cap, a sample, a smaller scope, privacy caution about fake data, "I can't run that") doesn't bind. You may use it to test, but don't ship it or report results as complete until the user agrees. *Fine:* "Tested on 10 of 400 videos." *Not fine:* "Works," after only that test.

## Step 2 — find what already exists

Before inventing anything, look, in this order, and spend a search in proportion to the fork:

1. **This codebase:** shared components, an earlier solution to the same problem, a test harness, a setup script. (For a helper function, a search of the code is enough.)
2. **The references the user named:** another project, a design file, a doc folder, an old app.
3. **The world:** established patterns, existing projects or assets, real catalogues (a platform's own list of types rather than one you write), how well-known products solve it. Check current offerings on their real pages, not from memory. (Do this for a library, a vendor, an asset, or a new kind of feature.)

Assume someone has solved it until your search says otherwise. *Example:* before hand-building climbing moves, search for an existing movement system (that's how AAMS was found).

## Step 3 — lay out the real options

Two to four genuinely different routes, not variations on one. Make sure these are covered (one option can fill several roles: "simplest = what exists: reuse `AudioQueue`"):

- **The best, whatever it costs.**
- **The simplest thing that fully meets the need.** Simple means less machinery, not less outcome. *Not simplest:* the same thing with half the features.
- **What already exists**, if Step 2 found something.
- **A cheap model, whenever the task involves judging meaning** (whether two texts mean the same, relevance, quality, tone, what kind of thing something is), with its cost per call. Agents lean toward keyword lists, patterns and thresholds for this, then spend hours patching them, so put the model option on the table first. *Needs it:* "is this player's suggestion appropriate for the campaign?" *Doesn't:* parsing a date, checking a field is filled in.

For each option: what it gets the user, what it gives up, what it costs (money now, money at scale, time), how sure you are it works and why, and the cheapest way to find out. Cost is reported for every option; it never quietly removes one.

## Step 4 — decide by how sure × how costly

**Costly** means any of:
- **real money:** more than the project's spend threshold (set under "This project" in its `CLAUDE.md`), or more than $1 the user hasn't already approved if no threshold is set;
- **hard to undo:** something git or a settings change can't reverse, such as deleting data, sending a message to someone, publishing, or merging;
- **a change the user would notice in the product:** what it does or how it feels to use, such as dropping a feature, swapping the transcription engine, or changing a screen's layout.

It doesn't mean big. Renaming internals, or refactoring 20 files behind passing tests, is a big change that is cheap. And it's about choices you would make on your own: a change the user asked for, or an idea they described and you said back, already has their yes.

**Sure** means you've checked it works (or it's a known, proven pattern here) and no option from Step 3 beats it on what the user judges by. Anything less is **not sure**.

| | Cheap | Costly |
|---|---|---|
| **Sure** | Do it. Say it in one line in your final message. | State the cost and why in one line, then **wait for the user's explicit yes** before spending or changing direction. |
| **Not sure** | Run the smallest, cheapest test that could prove you wrong, then come back to this table. | **Stop.** Show the user you understand the problem and the options (Step 5). Don't spend until they choose. |

Before concluding "I can't" or "it can't be done", make at least one real attempt: run it, read the error, search the docs or the web, and report what you tried. *Not a try:* "this tool probably can't do X." That conclusion is itself a route choice (it hands work back to the user or drops an option), so it goes through this table too.

## Step 5 — when you stop, make the choice easy to scan

The user skims and reads mainly your last message, so the choice goes at the top of it (after any one- or two-line lesson note from `acaf-lesson`). If the `direction` tool is available (from the ACAF mod), call it with the problem, the options (for each: a short label, what the user gets, what they give up, the cost, and how sure you are), your recommendation and why. It shows the user a card with each option's trade-offs as bullets, and returns their choice. Otherwise put the same thing at the top of your final message, short:

- The problem, in one line.
- Each option: what it gets you, what you give up, what it costs, how sure you are.
- Your recommendation, the one-line reason, and the exact words to pick it.

Explain every option in plain words. Never drop an option because it's hard to explain; Step 3's "cost never removes an option" applies to difficulty too.

## Step 6 — record the choice

- **In planning:** the choice and its alternatives go in the decision record.
- **Mid-build:** a route change is a `DEV-<n>` entry in `acaf/deviation_log.md` (the next number), with the options and the user's choice.
- **No initiative active:** say the choice in your final message.

The mod also logs each answered card in `acaf/decisions/direction_log.md`.
