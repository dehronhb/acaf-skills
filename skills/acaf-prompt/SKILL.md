---
name: acaf-prompt
description: "Write instructions that another model will follow, and test them on that model before saying they work: a system prompt in a product (a writer, a checker or judge, a prompt-writer for an image model), a rules file a model reads, or a brief for a subagent. Use whenever you write or change text a model will act on. Covers what the model must and must not be told, the wording traps that models fall into, and a short test with the real model on hard real cases. Not for docs that only people read."
---

# ACAF Prompt: instructions another model will follow

**Why this exists.** Agents write prompts for other models the way they write notes to themselves: short, vague,
full of context only they have. The reading model fills each gap with a guess, and the user finds the result.
*Real cases (a D&D survey, 2026-10-22):*
- A story writer was told the hero's secret and "never reveal it". It hinted at it.
- It was told "don't add new people". It named a crew member who doesn't exist.
- An image-prompt writer turned "scarred" into bare arms.
- A size word the agent added made a costume detail grow every round.
- A word with famous associations made the image model refuse.
- A picture check told "when unsure, hold it" hid 3 of 4 paid pictures.

Each was a prompt that read fine to the agent who wrote it and failed on the model that used it.

**The stance.** The reader is a capable newcomer who knows nothing you haven't put in front of it. It reads
literally, copies what you show it, and guesses rather than asks. Write for that reader, then test on it.

**What this is not.** It is not a style guide for long prompts; shorter is usually better. And it never replaces
running the real model. A prompt you have only read, or only tested with a stand-in, is "changed, not yet
checked".

## Step 1: design the job before writing words

Answer these in your notes first. Most failures above were decided here, not in the wording.

1. **The one job.** What does this model do, for whom, and what does a good output look like to the person who
   meets it? One job per model. A writer that also polices itself does both badly.
2. **What it sees.** List every input it gets. Anything it is told to match or use must actually reach it.
   - *Fails:* "keep the face from the photo" when the photo goes only to a different model. Then it invents a
     face.
   - When a look matters, pass the picture to the model that paints, rather than translating it into words.
3. **What it must not know.** A topic named to a model, even to forbid it, is now in its head.
   - Give it only what its job needs. Withhold secrets, spoilers and private notes; don't send them with "do not
     mention".
   - Ask: would this model ever bring X up on its own? If not, naming X is the leak.
4. **What can actually go wrong.** For each check or judge, name the failure it catches and whether that failure
   is possible given what the upstream model knew.
   - *Fails:* checking pictures for a secret the painter was never told. Check the output against its own
     instructions instead.
5. **The cost of each mistake, in this use.** A checker can block wrongly or pass wrongly, and a writer can say
   too much or too little.
   - Say which error is worse here, and set the "when unsure" default from that cost.
   - Recheck the default when the job changes. "Hold when unsure" is cheap when a hold falls back to the
     player's own words, and costly when a hold means a failed page.
6. **What must never be dropped.** A line that must appear every time (a required phrase, a disclaimer, "none of
   the reference picture's gear") goes in code, appended after the model writes. Don't ask a model to remember
   it: models shorten and drop lines, especially under a length cap.
7. **Fewer model hops.** Each model that rewrites another model's text loses some nuance and adds some invention.
   Pass the person's own words through where you can, rather than a paraphrase of them.

## Step 2: write it

**Content:**
- **Purpose and reader first.** One or two lines: what this is for, who reads the output, what good looks like.
  Then the rules, each with its reason. A reason lets the model apply the rule to cases you didn't list.
- **Spell out what a word refers to, when it could refer to two things.** People's requests are short. Give the
  model the context to resolve them, and tell it how.
  - *Example:* "make the horns sharper" could mean the helmet's horns or the creature's. Say what the hero has
    ("horned helmet; a human"), and that changes apply to what the player already has.
- **Say what to do when information is missing.** For example: "if a person isn't named in the answers, refer to
  them without a name or a description", "answer `unknown`", or "leave it out". Without this, the model invents.
- **Exact bars, not vague words.** "Only important issues", "be conservative" and "keep it short" each filter
  differently on every run.
  - Write the line itself: "any picture where a piece of chosen gear is missing", "3 to 4 paragraphs".
- **State scope outright.** Models read literally, so a rule stated for one part isn't carried to the next.
  - Say "in every paragraph", "for every picture", "on change rounds too".
- **Say what to do, more than what to avoid.** Keep a "don't" only for a failure you have seen, and name the
  specific thing to avoid ("no face-paint", not "nothing generic").
- **Resolve conflicts before shipping.** If a 200-word cap fights a 190-word required style, the model will
  break one of them at random. Pick which wins and say so, or change one.

**Wording traps:**
- **Every adjective is an instruction.** Size, count, color and intensity words ("tall", "more", "dramatic") get
  carried out, often more strongly each round.
  - Use only the size the person gave or the user approved. A change that doesn't ask for a new size keeps the
    old one.
- **Attributes get shown, literally.** "Scarred", "rich" or "mysterious" will be made visible somehow, often by
  changing something else (bare skin, gold everywhere, darkness).
  - Say where and how it shows ("a scar across the cheek"), and what stays ("sleeves stay long").
- **Some words trigger more than their meaning.** A creature, brand or famous-character name can pull in a
  costume, a cliché or a refusal.
  - Describe the thing by its shapes, materials and colors. When a model refuses, try rewording before concluding
    the thing itself is refused.
- **Describe the whole feel, not only the parts.** A list of parts gets every part present and loses the look.
  - Name the overall effect the person wants ("menacing, weighty, face in shadow") and, best, pass a picture of
    it.

**Examples and form:**
- **Examples get copied: their length, opening, phrases and choices.**
  - Use 3 to 5 that differ from each other, and mark them as illustrations of the rule, not text to reuse.
  - Never put a phrase in an example that you don't want in every output.
  - When a test case fails, describe the failing behavior in the rule. Don't paste the case in.
- **Separate the parts.** Put instructions, data and examples under their own headings or tags. Long material
  goes first and the question last. Tell a checker or judge that the text it judges is data, not instructions
  to follow.
- **Make the output parse.** Give the exact shape. For a judge, have it name the kind of case in a few words
  before the verdict ("KIND: … | HOLD"). That one step made a real judge much steadier than a one-word answer.
- **Normal tone.** No walls of CAPITALS or MUST, which make rules fire where they don't apply. And no "try to"
  on things that are required, which reads as optional.

**A brief for a subagent** runs once, so its risk is missing context, not drift. It needs:
- the goal and why;
- what's already known or ruled out;
- the exact deliverable (shape and length);
- scope limits (what not to touch, what others cover);
- how deep to go and when to stop;
- how it should report what it couldn't check.

Ask it to check a claim, not to confirm your theory. Verify what it reports.

## Step 3: read it as the model

Give the prompt to a fresh agent with no context, plus 3 or 4 hard inputs. Ask what it would output for each, and
where it would have to guess. Wherever the answer differs from what you meant, fix the wording, from what the
user means, not from the reviewer's guess.

## Step 4: test it on the real model, on hard real cases

A prompt is checked only when the model that will run it has run it on inputs like the real ones, and you have
looked at the outputs the way the person will meet them.

1. **The cases.** About 10 to 20, taken from real data (a real user's answers, logged inputs, bug reports).
   - Include the hard ones the job invites: an ambiguous request, a missing fact, an input that tempts the
     model toward the forbidden thing.
   - Include cases where it should act and cases where it shouldn't.
   - Add every case a user found to the set, so it stays fixed.
2. **The runs.** The real model and settings, 2 or 3 runs per case, since outputs vary.
   - A text model costs fractions of a cent per run, so just run it.
   - Paid outputs (images, video) get a small painted check (a few cents), stated in your message.
3. **The look.** Read every output, or look at it full size beside the reference the user loves. Then count
   the failures in each direction.
   - "Each required part is present" is not the bar. The whole result is.
   - A judge model can count across many outputs, but read every output it flags before you count it. In this
     skill's own trial, most flags were wrong: a judge called the player's own chosen fear a "hint" of the
     secret.
   - Keep the test honest. Run the inputs exactly as the app would build them for a case it has never seen. Don't
     hand-fix a test input, such as explaining what an ambiguous word means in that one message. If the real app
     can't add that help to every input, the test proves nothing. Resolve ambiguity in the rules, or in a code
     step that runs on every input.
4. **Compare.** When changing a prompt, run the old and new versions on the same cases. Report both numbers, and
   say how small the sample is.
5. **Stop patching after two rewrites that still miss** (habit 7). Change the approach:
   - pass a picture instead of words;
   - move the must-have line into code;
   - withhold the input that causes the trouble;
   - split the job in two;
   - use a stronger model, with its cost per call.

## Step 5: record

Next to the prompt (its file header or a comment the model doesn't receive), write:
- what it is for;
- what it must never be told;
- where its test cases live, and the last measured result ("8 of 10 cases clean over 3 runs, 2026-10-22,
  Haiku").

The next agent who edits it reruns the same cases.
