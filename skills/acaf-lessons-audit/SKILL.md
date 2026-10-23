---
name: acaf-lessons-audit
description: "Condense an ACAF project's lessons file into broad principles an agent can actually read before acting: merge lessons that share a cause, ask the user about lessons that conflict, move tool facts into topic notes read only when doing that kind of work, and move the old detailed entries to an archive. Use when the ACAF mod says the lessons file has grown past about 6,000 words, at the end of an initiative if the file grew, or when the user says \"audit the lessons\" or \"consolidate lessons\". Run it at a natural break, not in the middle of a task."
---

# ACAF Lessons Audit: from a pile of incidents to wisdom an agent can use

**Why this exists.** A lessons file that only grows stops working. In the D&D project, the file reached
about 51,000 words and 280 entries: thinking habits, tool facts and step-by-step stories of single incidents,
all mixed together. That's about 70,000 tokens. No agent reads it before a choice, so the same mistakes came
back while the file grew. The audit turns it back into something a session can read in a few minutes and act
on.

**What it is not.** It is not deleting lessons. Every old entry moves, word for word, to an archive. And it is
not rewording the user's decisions: a principle keeps the user's own words and intent. Where two lessons
disagree, the user decides, not the auditor.

## The shape it produces

- **`acaf/<the lessons file>`** keeps its name, so `CLAUDE.md` and skills still find it. It holds:
  - `## Top habits`: at most 10 one-line habits, as now (see `acaf-lesson` Step 4).
  - `## Principles`: grouped under a few headings by kind of work (for example "Working with the user",
    "Checking my work", "Prompts for other models", "Pictures and art"). Each principle has:
    - **the rule** in one sentence, as an instruction to yourself;
    - **why**, in one line (the problem it prevents);
    - **what it does not mean**, when it could be read two ways;
    - **one or two short examples** from this project, a line each;
    - **from:** the archive entries it condenses (e.g. "from: L-12, L-40, 2026-10-22 refusal").
  - `## Reference notes`: one line per topic file, saying when to read it ("Read `acaf/notes/aams.md` before
    building or debugging a movement").
  - Target: under about 4,000 words for the whole file, a few minutes of reading.
- **`acaf/notes/<topic>.md`**: facts about tools and systems (an engine's quirks, an API's limits, a vendor's
  steps). Deduplicate them, drop superseded ones (they go to the archive), and keep each fact with its date.
  Agents read these only when doing that kind of work.
- **`acaf/lessons_archive.md`**: every original entry, word for word, under a header that says what the file
  is, that agents don't need to read it by default, and where each entry's principle now lives.

## Step 1: inventory

Read the whole file. List every entry in your notes with:
- its id or heading;
- its kind: **habit** (how to think or act), **fact** (how a tool or system behaves), or **story** (one
  incident with no habit beyond the ones it illustrates);
- its area (the kind of work it is about).

For a very large file, split the reading across helper agents by section. Give each one this skill and the
same output format, then merge their lists yourself.

## Step 2: group habits by their underlying cause

Many entries are the same lesson learned in different places. Group habits that would lead to the same action
in the next similar moment. *Example:* "check the DM pages next to the survey", "compare a new picture with
the one the user loves" and "look at the live page before saying done" are one principle: judge the result
the way the user meets it, beside what they already approved.

For each group, write one principle in the shape above. Keep the user's own words where they gave them. Keep
the most telling example, not every one. Don't widen a principle past what the entries support. A habit about
picture prompts stays about pictures unless several entries show it wider.

Drop a habit from the principles (it stays in the archive) when:
- the user's every-project list (`~/.claude/CLAUDE.md`, "Top habits (every project)") or the kit's own rules
  already say it in full; or
- it was superseded by a later lesson. Say so in the archive header for that entry.

## Step 3: find conflicts, and ask the user

List every pair of entries that would tell an agent to do different things in the same moment. *Example:*
"keep asking until every choice is settled" vs "don't stop me with questions while I'm away". Often the
nuance resolves it: one applies when the user is present, the other when they're away. Write that nuance in
if the entries themselves show it.

When the entries don't settle it, ask the user, all such questions in one round:
- one question per conflict;
- quote both lessons in a line each;
- give 2 to 4 multiple-choice answers, each a possible nuance;
- put your recommended answer first.

Use the `AskUserQuestion` tool when you have it. Write their answer into the principle, quoting them with the
date.

## Step 4: move facts into topic notes

Group facts by topic into `acaf/notes/<topic>.md`. Start each file with what it covers and when to read it.
Merge facts that repeat. When a later fact corrects an earlier one, keep the later one and move the earlier
one to the archive. Keep dates.

## Step 5: check the draft before replacing anything

Write the new files next to the real ones first, for example in your scratch folder or as `*.draft.md`.

1. **Nothing lost:** every original entry is either in the archive with a pointer to its principle or note,
   or marked superseded. Check by id or heading, and count them.
2. **It still leads to the right choices.** Take 5 real recent situations from the project's sessions or
   change log where a lesson mattered. Give a fresh agent only the new file and each situation, and ask what
   it would do. Where it would choose wrong, the principle is too vague or a nuance was lost. Fix it.
3. **Size:** report the old and new word counts.

## Step 6: apply, record, tell

- Get the user's OK before replacing the real file the first time an audit runs on a project. After that,
  apply and tell.
- Move the originals to the archive, write the new lessons file and the notes, and update the Top habits.
- Commit only those files, by path, with a message that names the counts.
- Tell the user in a few lines:
  - old size and new size;
  - how many principles and notes files came out of it;
  - anything you dropped as superseded;
  - their answers to the conflict questions, as recorded.

Kit-scope principles (useful on any project) go in your message to the user as candidates for their
every-project list. That list holds at most 10, so propose a merge, never an eleventh.
