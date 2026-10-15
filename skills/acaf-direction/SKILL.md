---
name: acaf-direction
description: The direction check, for any fork in the road on an ACAF project. Understand the problem in the user's terms, find what already exists, lay out the real options with cost and confidence, then decide by "how sure × how costly" whether to act, tell, test small, or stop and ask. Use whenever you are about to choose a route, approach, tool, library, vendor or test plan; spend real money; change scope or the product's direction; drop an approach; or conclude that something can't be done. It applies mid-build as much as at the start.
---

# ACAF Direction — choose the route on purpose

Most wrong turns don't happen when a project starts. They happen mid-work, when an agent reaches a fork and quietly takes the nearest path: the one flagged spot instead of every spot like it, the cheaper version, its own guess, its own test. This check makes the fork visible, keeps the cheap and certain choices yours, and puts the unsure and costly ones in front of the user with the real options.

The user owns direction, taste and spend. You own the mechanics, and the thinking that comes before any of it.

## Step 1 — understand the problem in the user's terms

Write it down (in the decision record, the study file, or your own working notes), short:

- **Who it's for and what they're doing**, step by step, as a real person would. Start from the person, not the mechanism.
- **What "good" looks like to the user**: the outcome they would judge by, not a metric that's easy for you to check.
- **What you're assuming.** Separate facts you believe about the world, the user or the product (every business has a counter; the user runs one session per project; the photo arrives before the question) from decisions you're making. Check each fact you can check. Ask about the ones you can't, in plain words. A guessed fact never goes into a design, a document or a test without being marked as a guess.
- **Whose limits these are.** A limit the user set (a budget, a platform, a date) binds. A limit you introduced (a length cap, a sample, a smaller scope, privacy caution about fake data, "I can't run that") doesn't, until the user agrees to it.

## Step 2 — find what already exists

Before inventing anything, look, in this order:

1. **This codebase:** shared components, an earlier solution to the same problem, a test harness, a setup script.
2. **The references the user named:** another project, a design file, a doc folder, an old app.
3. **The world:** established patterns, existing projects or assets, real catalogues (a platform's own list of types rather than one you write), how well-known products solve it. Check current offerings on their real pages, not from memory.

"Someone has probably solved this" is the default assumption until a search says otherwise.

## Step 3 — lay out the real options

Two to four genuinely different routes, not variations on one. Always include:

- **The best, whatever it costs.**
- **The simplest thing that fully meets the need.** Simple means less machinery, not less outcome.
- **What already exists**, if Step 2 found something.

For each: what it gets the user, what it costs (money now, money at scale, time), how sure you are it works and why, and the cheapest way to find out. Cost is reported for every option; it never quietly removes one.

## Step 4 — decide by how sure × how costly

**Costly** means real money, harm that's hard to undo, or a change of direction the user would notice in the product. It doesn't mean big. A large change that's cheap to undo and unlikely to make things worse is cheap.

| | Cheap | Costly |
|---|---|---|
| **Sure it's the best route** | Do it. Say what you did in the report. | State the cost and why in one line, then go on the user's yes. |
| **Not sure it will work** | Run the smallest, cheapest test that could prove you wrong, then come back to this table. | **Stop.** Show the user you understand the problem and the options (Step 5). Don't spend until they choose. |

The project's `CLAUDE.md` may set a spend threshold under "This project". Without one, treat any spend the user hasn't already approved as costly when you aren't sure it will work.

Before concluding "I can't" or "it can't be done", try. That conclusion is itself a route choice: it hands work back to the user or drops an option, so it goes through this table, with what you tried.

## Step 5 — when you stop, make the choice easy to scan

The user skims, and reads mainly your last message. If the `direction` tool is available (from the ACAF mod), call it with the problem, the options (label, cost, confidence, trade-off), your recommendation and why. It shows the user a card and returns their choice. Otherwise end your message with the same thing, short:

- The problem, in one line.
- Each option: what it gets you, what it costs, how sure you are.
- Your recommendation and the one-line reason, and the exact words to pick it.

No jargon, and no option the user would need you to explain first.

## Step 6 — record the choice

In planning, the choice and its alternatives go in the decision record. Mid-build, a route change is a `DEV-<n>` entry with the options and the user's choice. The mod also logs each answered card in `acaf/decisions/direction_log.md`.
