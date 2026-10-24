---
name: acaf-grill
description: "Ask the user first: before building or changing anything the user (or the people they build for) will see or use, ask the questions only they can answer about the experience they expect, as multiple-choice questions with your pick first, and build only once those choices are settled. One round for a change to something that exists; round by round for something new, starting with the bar (how impressive it should be, and a reference the user loves). Use when a request adds or changes a screen, a page, a flow, navigation, what players, friends or customers see, who has to sign in, or how the user will try it out, and the request leaves those choices open. Also when the user says \"grill me\" or \"ask me first\". Skip it for a fix whose right behavior is obvious, for work the user won't see, and when the request already settles the choices."
---

# ACAF Grill: ask about the experience before building it

**Why this exists.** Agents are at their best when they ask first, and most of the user's worst waits come from
agents that didn't. They guess the experience, build it, and the user then has to explain what they wanted and
wait for a rebuild. *Real cases:* asked for a way to test the survey as each player, an agent built a route
from the DM page through "Test" to "Make profile", when the user expected a link that opens that player's survey;
another put a Cloudflare sign-in in front of a page without asking who should have to sign in. One question each
would have saved the rebuild: "When you test as Brad, should it (a) open his survey exactly as he'll see it,
(b) start from a button on your DM page, (c) both?"

**What it is not.** It is not a plan review, and not a reason to stall. You ask only about choices the user would
care about, look up facts yourself, and keep each question quick to answer. Modeled on Matt Pocock's `grilling`
skill (questions in rounds, each with a recommended answer).

## Step 1: should you ask at all?

Ask when the request adds or changes something the user, or the people they build for, will see or use, and it
leaves choices about that open. Look for choices in:

- **What they see:** layout, wording, what's on the screen, and whether it should match screens they already approved.
- **What they do:** where they start, what they click, what happens next, how they get back.
- **Who:** who uses it, who has to sign in or set anything up (friends, players, customers, only the user).
- **How they'll try it:** how the user will test it before real people use it.
- **The bar:** how impressive it should be, and a reference they love. This sets everything else, and agents
  guess it low. *Real case:* website stories built as a tidy slideshow with narration, when the user wanted
  "something that would win website awards", with characters moving through the story. Ask it as: "How far
  should this go? (a) a working draft to react to, (b) polished, like <something they already approved>,
  (c) showcase level, like <a known example of the kind>", plus "Is there one you love that I should match or
  beat?" Ask it in the first round of anything new, and for a change when the change is to how something looks
  or feels.
- **How big real use is** (how many people, how often, how much), only when the answer would change how much to
  build (habit 9). Not a standing question for every round.

**Skip it, and say the idea back in one sentence and start, when:**
- the request already settles these choices ("make the button gold like the survey's");
- it's a fix whose right behavior is obvious: the user already knows what it should do (a crash, a typo, a link
  that goes nowhere, a Save button that doesn't save). If the fix itself needs a choice they'll see (what
  message to show when saving fails), ask that one question;
- the user won't see the work (a refactor, a test, a script's internals that don't change what it produces);
- the user already answered these questions earlier in the session.

## Step 2: look up what you can first

Read the code, the records (`acaf/intent_brief.md`, `functional_contract.md`, decisions), and anything the user
pointed at, so you ask only what they alone can answer. *Don't ask:* "Do you already have a DM page?" (look).
*Ask:* "Should your test links live on the DM page or be sent to you separately?" (their choice).

## Step 3: ask in rounds

- **Each question:** one plain sentence about the experience, 2 to 4 answers that are really different, your
  recommended answer first with "(Recommended)", and a few words on what each answer means for them. Use the
  `AskUserQuestion` tool when you have it; otherwise number the questions and letter the answers so the user can
  reply "1a, 2b".
- **A round** holds the questions whose answers don't depend on each other, up to 4. Questions that depend on an
  earlier answer wait for the next round.
- **How many rounds:**
  - *A change to something that exists* (a screen, a flow, a setting): one round, then build.
  - *Something new* (a new page, feature or flow, such as a leaderboard): keep going round by round until every
    choice the user would care about is settled. Usually two or three rounds.
- **While you wait,** you may do groundwork that doesn't depend on the answers (reading code, setting up a test
  copy), but build nothing the answers could change.

## Step 4: say it back, then build

Once the choices are settled, say back the experience in two or three plain lines ("You open Brad's link; it
starts at his first card; your answers show on the DM page as 'DM test'"). Then start building, without waiting
for another yes, unless an answer turned the work into a costly fork (then `acaf-direction`). This covers
building only: anything hard to undo or that other people will see (putting it live, sending a message,
merging) still waits for the user's yes, as always.

**A promise to show first is a stop.** If you told the user you'd show a sample before making the rest (a few
pictures before a batch, one page before the others, a draft before the build), make only the sample, show it
(link and open it beside the chat), and wait for their answer before making more. *Real case:* "I thought you
were going to ask me for my opinion on them first before you created images for all the other classes?" Doing
the rest while you wait wastes their money if the sample was wrong, and breaks their trust in what you say
you'll do.

On an ACAF project, record the answers where the work's other decisions live: the initiative's decision record
when planning, or a line in the slice notes mid-build. That way a later session doesn't ask again or guess
differently.
