// The next-steps mod. It loads in every session (ACAF projects and others, Snugit included) and
// does five jobs: the panel and the done/habit check after each reply (1, 2), habit reminders when
// the user sends a message (3), and the judgment-in-code and gut checks after tool calls (4, 5).
//
// 1. The panel: a plain-language panel above the prompt, so the user can see at a glance what
//    Claude is waiting on.
//    - A cheap model reads the reply and writes a short summary: what the user can do next and
//      what each choice does, or that background work is running and there is nothing to do but
//      wait, or that nothing is needed.
//    - Background agents still running always show as "wait", whatever the reply says.
//    - Claude Code's own guess at the user's next prompt (the dim text in the empty prompt box) is
//      passed to the model too, so a real next step it names is not missing from the panel. The
//      model decides whether it is new or a repeat of an option in other words; code can't judge that.
//    - Each option's short phrase is a button; pressing it sends those words as the user's next
//      message. If sending is refused, the words go into the prompt box instead.
//    - The panel hides while Claude is working and comes back when the reply ends.
//
// 2. The done check: the user's most common problem with agents is "it's fixed" when it isn't
//    (a review of ~3,000 of their messages, 2026-10-20). A cheap model reads the reply beside the
//    list of actions the agent took that turn. If the reply says something is fixed, working,
//    built, sent or finished, and nothing the agent did shows it tried that thing the way the user
//    will, the mod sends the agent a prompt to check it now, before the user relies on the claim.
//    - It judges claims, not wording: a reply that honestly says "changed, not yet checked" passes.
//    - One check per claim: the reply to a done-check prompt is never checked again, so it can't loop.
//    - If the prompt can't be sent, the panel says the claim isn't checked yet, so the user knows.
//    - Each judgment is written to debug.log beside the mod, to measure how well it catches.
//    The same call also checks the reply against the user's top habits (below): one clear break of
//    a habit sends the agent back, the same way, once.
//
// 3. Habit reminders: a lesson read once at the start of a session fades by the time it matters
//    (lessons were recorded and then broken anyway). The habits come from two lists: the "## Top
//    habits (every project)" section of ~/.claude/CLAUDE.md, and the "## Top habits" section of the
//    project's acaf/lessons*.md file when there is one. When the user sends a message, a cheap model
//    picks the habits (0 to 3, usually 0 or 1) that this next step could break and attaches them.
//
// 4. Judgment-in-code catch: agents reach for keyword lists, patterns and thresholds where a cheap
//    model would judge meaning better, and keep patching that route. After an edit to a code file
//    that looks like it might be doing that (a cheap code pre-filter gathers candidates), a cheap
//    model judges it. If it is, the agent is told to propose the model option, with its cost. At most
//    once per file per session, so it informs without nagging.
//
// 5. Gut check: agents keep going for hours, perfecting a worst case, when one quick question
//    ("only 3 players, about 20 pictures each?") would have shrunk the work to nothing. After 30 minutes
//    of work since the user last spoke, the agent is asked once to check the work is in proportion, and
//    to ask the user one multiple-choice question about real use if the answer could shrink it. Then
//    again every 30 minutes. Only time triggers it; whether to ask stays the agent's judgment.

// How long to wait after a reply ends before summarizing, so Claude Code's
// next-prompt guess, which is written just after the reply, can be included.
const SUGGESTION_WAIT_MS = 2500

// How many of the user's recent turns the reply check looks back over, so a claim tried a turn or two ago
// counts as tried.
const RECENT_TURNS = 4

const SUMMARY_SYSTEM = [
  "You summarize the end of an AI coding agent's reply for a busy person who only skims.",
  'Say what the person can do next, in plain words a smart 10-year-old would follow. No jargon, no file',
  'names, no internal IDs.',
  '',
  'Reply with JSON only, in this shape:',
  '{"state": "choose" | "wait" | "nothing", "headline": "...", "options": [{"say": "...", "does": "..."}], "waitFor": "..."}',
  '',
  "- \"choose\": the agent can't go on until the person decides, answers, or does something only they can (sign in,",
  '  try it on their phone). headline: the decision or the ask, at most 12 words.',
  '  options: only choices the agent itself offered, best first, at most 4. If it asked an open question (a name,',
  "  a number, a preference), options: []. Never invent an answer: each option is sent as the person's own words.",
  "  say: the exact words to send, in the person's voice, at most 6 words (use the agent's own suggested words",
  '  when it gave some). does: what happens then, at most 14 words.',
  '- "wait": the agent says work is still running in the background (a test run, a build, a helper agent) and',
  '  it will report back, so the person should not reply yet. waitFor: what is running, at most 12 words.',
  '  options: [] unless the agent also offers something to do meanwhile.',
  '- "nothing": the work is finished and needs nothing from the person. headline: what was done, at most 12',
  '  words. options: at most 2 optional next steps the agent offered (a closing "want me to add tests?" is one).',
  '',
  "You may also get Claude Code's own guess at what the person will type next. Add it as an option (say set to",
  'its exact words) only if it is a real next step for this reply that no option already means. Skip it in',
  '"wait", when it is a pleasantry ("thanks"), or when the agent advised against it. At most 4 options in all.',
].join('\n')

const DONE_CHECK_SYSTEM = [
  "You check an AI coding agent's final reply for a claim the person may act on that the agent never tried.",
  "You get the reply and the agent's recent actions, each marked (this turn) or (earlier turn); commands and files",
  'only, you cannot see their output. The person skims: a wrong "it works" leads them to test, ship, decide or tell',
  'someone on a false basis. That is the only thing this check is for; it should stay quiet otherwise.',
  '',
  'Reply with JSON only: {"claim": "...", "needsCheck": true | false}',
  '- claim: something the agent itself built, changed or worked out in this session that the reply says now works,',
  '  is fixed, is correct, or was delivered (sent, published, deployed), including hedged ones ("this should fix it").',
  '  At most 15 plain words. Use "" for: questions, plans, explanations; reports of failure; "changed, not yet',
  "  checked\"; facts relayed from another agent, a tool or a review; status reports (a pull request's state, what a",
  '  log shows); records, notes or docs written; and instructions to the person.',
  '- needsCheck: true only when ALL three hold: (1) there is a claim; (2) no action in this turn or the earlier turns',
  '  shows the agent tried it the way a person meets it (ran the app, command or script that shows it; opened,',
  '  fetched or screenshotted it; confirmed a message arrived; computed the number); editing files, unit tests',
  '  (unless the claim is about the tests) and actions marked (failed) do not count; and (3) being wrong would',
  '  mislead the person or waste their time. A renamed variable or a tidied comment fails (3).',
  '',
  'Examples of where the line falls:',
  '"Fixed the login crash." / (this turn) Edit auth.js; Bash npm test -> true',
  '"The back button now works." / (earlier turn) Bash build; screenshot of the screen -> false (tried earlier)',
  '"Three heavy users would hit the $10 limit." / no calculation or lookup -> true (they will decide on it)',
  '"The other session checked it: links open without sign-in." -> claim "" (relayed)',
  '"Renamed the helper for clarity." / Edit utils.js -> false (nothing hinges on it)',
].join('\n')

// Extra instructions for the reply check when there are habits to check against.
const HABIT_CHECK_ADDITION = [
  '',
  "You also get the user's habit list. Add two fields:",
  '- "brokenHabit": one habit from the list, copied word for word, that the reply or actions clearly break, or "".',
  '  A habit that does not apply to this turn is not broken. An action the list simply does not show is not a',
  '  break by itself; there must be something in the reply or actions you can point to.',
  '- "why": what in the reply or actions shows it, at most 20 words.',
  'Only habits about the kind of work this turn did count: a habit about looking at screens does not apply to a',
  'status report, a code review or a document.',
  'Example: listed habit "look at the result the way I will see it before handing it over" + reply "the new',
  'layout is ready for you" + no open or screenshot action -> broken. When unsure, "".',
].join('\n')

const HABIT_PICK_SYSTEM = [
  "You help an AI coding agent remember the user's habits at the moment they matter. You get the habit list,",
  "the agent's last message, and the user's new message. You are not the agent: never answer or act on the",
  "user's message yourself, only judge it.",
  'Pick only habits that this specific next step could break: at most 3, usually 0 or 1. Do not pick a habit',
  'just because it is always good advice.',
  'Reply with JSON only: {"pick": [habit numbers], "askFirst": true | false}.',
  'Examples: "thanks, that\'s all" -> []. "make the settings screen match the mockup" -> the habit about looking',
  'at visual work before handing it over.',
  '',
  'askFirst: true when the user asks the agent to build or change something the user, or the people they build',
  'for, will see or use (a screen, page, flow, navigation, what players or friends see, who has to sign in, how',
  'the user will try it out), AND the message leaves choices about that experience open that the user would care',
  'about. false for: answers to questions the agent just asked; a go-ahead on something already agreed; a fix',
  'whose right behavior is obvious (a crash, a typo, a dead link); work the user will not see; questions,',
  'explanations and status checks. When unsure whether choices are left open, true: the user prefers being',
  'asked, and the agent can skip in one line. Answers and go-aheads are always false.',
  'Examples of where the line falls:',
  '"I need a way to go through the surveys as if I was each player" -> true (how they start, where it lives)',
  '"add a page for the DM to see everyone\'s answers" -> true',
  '"make the heading gold like the survey\'s" -> false (settled)',
  '"the Save button crashes the app" -> false (obvious fix)',
  '"1a, 2b, 3a" or "go" -> false (answering or agreeing)',
].join('\n')

// Added to a message that asks for something the user will see or use with choices left open. Agents guessed
// the experience and built it, and the user had to explain and wait for a rebuild (the user, 2026-10-20:
// "You agents are at your best when you ask clarifying questions first"). Not a plan review: only the choices
// the user would care about, quick to answer.
const ASK_FIRST_NOTE = [
  'Ask first (from the next-steps mod, not the user): this request looks like it adds or changes something the',
  'user, or the people they build for, will see or use, with choices about that experience still open. Before building, ask the questions only',
  'they can answer (what they will see and click, what happens next, who uses it or signs in, how they will try',
  'it), each with 2 to 4 multiple-choice answers and your pick first, using the AskUserQuestion tool if you have',
  'it. Follow the acaf-grill skill: one round for a change to something that exists, round by round for something new. Look facts up',
  'yourself. If the request already settles these choices, skip the questions and say so in a line.',
].join(' ')

const JUDGMENT_CODE_SYSTEM = [
  'You look at code an AI agent just wrote.',
  'Answer true only when the code decides something about the meaning of free text that people or models wrote',
  '(whether two texts mean the same, relevance, rudeness, on-topic, which category) using word lists, regexes,',
  'similarity or overlap scores, or a cut-off on such a score. A cheap model would judge that better.',
  'false for: exact checks (a field is present, a date format, a total, a file exists, a file extension, an HTTP',
  "status); limits on measured amounts (tokens, bytes, seconds); parsing structured text (JSON, CSV, a model's",
  'tagged output); matching a fixed set of exact commands; code that only gathers candidates for a model to judge.',
  'When unsure, false.',
  '',
  'Examples of where the line falls:',
  "if (['refund', 'angry', 'cancel'].some(w => msg.includes(w))) escalate()  -> true",
  'if (jaccard(a, b) > 0.6) markDuplicate()  -> true',
  "/^\\d{4}-\\d{2}-\\d{2}$/.test(date)  -> false",
  'if (tokens > 200000) warn()  -> false',
  '',
  'Reply with JSON only: {"judgesMeaning": true | false, "why": "at most 20 words"}',
].join('\n')

const CODE_FILE = /\.(js|jsx|ts|tsx|mjs|cjs|py|dart|kt|kts|java|swift|cs|go|rb|rs|php)$/i

// The prompt catch. Agents write instructions for other models (a product's system prompt, a rules file a
// model reads, a checker's prompt) the way they write notes to themselves: vague, missing what the reading
// model needs, and never run on that model before "it works" (the user, 2026-10-22, after a survey whose
// story writer leaked a secret it was told to keep and whose portrait prompts kept growing the hood's ears).
// After such an edit the agent is pointed at the acaf-prompt skill, once per file. Not for the agent's own
// standing rules and records (CLAUDE.md, lessons, skills, acaf/), which the documentation rule covers.
const PROMPT_FILE = /\.(js|jsx|ts|tsx|mjs|cjs|py|dart|kt|kts|java|swift|cs|go|rb|rs|php|md|txt|ya?ml|json|j2|hbs|tmpl)$/i
const NOT_PROMPT_FILE = /(^|[\\/])(CLAUDE\.md|SKILL\.md|MEMORY\.md|lessons[^\\/]*\.md|README\.md|CHANGELOG\.md)$|[\\/]acaf[\\/]|[\\/]\.claude[\\/]/i
// A cheap pre-filter that only gathers candidates for the model: words that instructions for a model use.
const MAYBE_PROMPT =
  /\b(you are (an?|given)|you will|your job|your task|reply with|respond with|answer with|return only|output only|json only|system prompt|the user'?s message|never mention|do not mention|don't mention|when unsure|you get the|write (a|the|one) [a-z ]{0,30}(story|prompt|description|summary))\b|\bsystem\s*:|system_?prompt|_SYS\b/i
const PROMPT_CATCH_SYSTEM = [
  'You look at text an AI coding agent just wrote or changed in a file.',
  'Answer true only when the text is, or contains, instructions that another AI model will read and act on: a',
  "system prompt or prompt template in code, a rules file the app sends to a model, a judge's or checker's",
  "instructions, a prompt for an image model. false for: documentation for people, code comments, tests that only",
  'assert on prompt text, config, and ordinary program logic. When unsure, false.',
  'Reply with JSON only: {"isPrompt": true | false, "what": "<at most 10 words: which model job>"}',
].join('\n')
// A cheap pre-filter that only gathers candidates for the model: regexes, matching calls, words
// like score or threshold, or a literal list of four or more quoted strings.
const MAYBE_JUDGMENT =
  /RegExp\(|re\.(compile|search|match|findall)|\.match\(|\.test\(|\b(similarity|threshold|score|keywords?|stopwords?|banned|forbidden|fuzzy|levenshtein|jaccard|overlap|sentiment)\b|\[\s*(['"][^'"\n]{2,}['"]\s*,\s*){3,}['"]/i

// The latest summary, or null when there is none to show; the last reply's text and Claude Code's
// next-prompt guess for it, so a late guess can be folded in; and the done check's state: a claim
// being checked (or that couldn't be sent for checking), and whether the next reply answers a
// done-check prompt (so it isn't checked again). Reset on reload.
let summary = null
let lastAnswer = ''
let suggestion = ''
let summarizedWithSuggestion = false
let doneNotice = null
let replyAnswersCheck = false
// Code files the judgment-in-code catch has already spoken about this session.
const judgedFiles = new Set()
// Files the prompt catch has already spoken about this session.
const promptFiles = new Set()

// Picture discipline (the user, 2026-10-24). Every picture an agent looks at stays in its conversation and is
// re-read on every later step. Re-reading the conversation is 80-90% of a session's cost, and a pile of pictures
// forces condensing every 15-20 minutes, after which the agent forgets details, sometimes the user's own words.
// Measured: one session took in 331 pictures and condensed 35 times in a day and a half. So every PICTURES_STEP
// pictures since the last condensing, the agent gets a reminder to keep pictures out of its main conversation.
// Framed as memory, never as money: cost talk makes agents cut corners on quality, which the user does not want.
// Pictures a helper agent looks at don't count: that is the habit working.
const PICTURES_STEP = 25
let picturesSinceCondense = 0
let picturesNoted = 0

// The big-output reminder (the user, 2026-10-24), for the same reason as pictures: one step that drops a huge
// result into the conversation (a whole log, a giant file, a long command output) is re-read on every later
// step. Past BIG_OUTPUT_TOKENS (estimated as characters / 4, pictures left out), the agent is reminded once
// per stretch between condensings. Framed as memory, never cost.
const BIG_OUTPUT_TOKENS = 20000
let bigOutputNoted = false
const BIG_OUTPUT_NOTE = (tool, tokens) =>
  'Big output check (from the next-steps mod, not the user): that ' + tool + ' result put about ' +
  Math.round(tokens / 1000) + ',000 tokens into this conversation, and it is re-read on every later step, which ' +
  'fills the conversation and forces condensing sooner; after that you work from a summary and forget details, ' +
  "sometimes the user's own words. From here: send big outputs to a file and read only the part you need (search " +
  'it, or read a range of lines); give long reading (whole logs, large files, many pages) to a helper agent that ' +
  'reports back what matters. Read in full whatever the task really needs. Carry on with your task.'
const PICTURES_NOTE = (n) =>
  'Pictures check (from the next-steps mod, not the user): about ' + n + ' pictures are in this conversation since ' +
  'it last condensed. Each one stays in your memory and is re-read on every step, which fills the conversation and ' +
  'forces condensing; after that you work from a summary and forget details, sometimes the user\'s own words. From ' +
  'here: compare frames side by side on one contact sheet instead of many screenshots; use a smaller screenshot ' +
  '(the screenshot tool\'s scale, such as 0.5) when only checking layout, and read text with get_page_text instead ' +
  'of a screenshot; hand frame-by-frame reviews to a helper agent, giving it the user\'s exact feedback and what to ' +
  'look for. Still look at the final result yourself, full size, before handing it over. Carry on with your task.'
// The struggle check (the user, 2026-10-25). An agent spent days on a path that wasn't working and never said so:
// about 31 hours of mostly green checks on a route planner, a third of it spent on faults in its own tests and
// 86-minute builds, while a faster route (C++) sat unasked. The user's rules already said to stop (habit 1: about
// twice as long as expected; habit 7: two failed tries), and a 30-minute self-check note (the gut check below)
// fired the whole time, but none of it worked, for three reasons: the agent can't feel time pass (its memory was
// condensed 69 times in two days, and each summary only knows the current step); every step "worked", so nothing
// counted as a failed try; and it judged itself ("at the expected pace, carry on"). So this check is an outside
// judge: after every STRUGGLE_EVERY_MS of work (time between steps, capped so idle hours don't count), Sonnet reads
// the last STRUGGLE_LOOK_MS of the work log (the user's messages and the agent's steps and messages) and its own
// earlier verdicts, and says whether the work is getting closer to what the user asked for or going in circles.
// Circling sends the agent a note to stop and tell the user, with options including a spike by a helper agent.
// It does NOT reset when the user speaks: a day of user fault reports, each answered by a patch, is circling too
// (the vine-wall day, 2026-10-17). Replayed on that session's history (2026-10-25): it flagged the vine-wall day
// in all 3 runs, about 2 hours before the user complained, and the planner's test-chasing stretch in 2 of 2
// continuous runs; it passed 4 of 4 checks of normal work in another session. Never framed as cost.
const STRUGGLE_EVERY_MS = 2 * 60 * 60 * 1000
const STRUGGLE_UNSURE_MS = 60 * 60 * 1000 // after an "unsure", look again sooner; two in a row count as circling
const STRUGGLE_LOOK_MS = 8 * 60 * 60 * 1000
const STRUGGLE_HISTORY_MS = 48 * 60 * 60 * 1000
const STEP_GAP_CAP_MS = 10 * 60 * 1000 // a gap between steps longer than this is idle time, counted as this much
// The work log: { at, line } for each of the agent's steps and the user's messages; the agent's own messages,
// gathered at each condensing and at check time; earlier verdicts; and the start of the latest condensed summary.
let workLog = []
let agentNotes = []
const seenAgentTexts = new Set()
let struggleChecks = []
let workedSinceCheck = 0
let lastStepAt = 0
let struggleRunning = false
let unsureInARow = 0
let pendingStruggleNote = ''
let latestCondensing = ''
// The time check: after a condensing, the agent is told how long it has worked since the user spoke, because the
// summary it now works from doesn't say.
let condensingsSincePerson = 0
let timeNoteDue = false
// Shorter stretches don't get it: on normal work at 1.4 hours, Opus read the note as "you ran long" and paused to
// offer options it didn't need (tested 2026-10-25).
const TIME_NOTE_MS = 2 * 60 * 60 * 1000

const STRUGGLE_SYSTEM = [
  'You check on an AI coding agent while it works, for a user who is often away for hours and relies on the agent to notice when it is stuck. Twice, an agent spent a day or more on a path that wasn\'t working and never stopped to say so; the user would rather have heard "this is taking longer than it should; can I step back and look at other ways?" Your answer decides whether the agent is asked to stop and tell the user that. You read its recent work: the user\'s messages, the agent\'s steps and messages, and a summary of its earlier work.',
  '',
  'Decide whether the work is still getting closer to what the user asked for, or is going in circles.',
  '',
  'Circling looks like:',
  '- the same problem, or the same few faults, worked on again and again in new forms;',
  '- failures blamed on the test, the tools or the setup, then fixed, then new ones of the same kind;',
  '- most of the time going into tests, measuring tools, rebuilds, restarts, fighting the tools or writing notes, rather than into what the user will see or use;',
  '- the user reporting the same kind of fault after each round of fixes;',
  '- the same open item named in two or more of the earlier checks, without clearly narrowing;',
  '- a plan or estimate run well past (about twice) with the end not in sight;',
  '- a known way out (a different tool or approach, or an earlier "revisit if..." note that has now come true) not taken and not put to the user.',
  '',
  'Progress looks like:',
  '- what the user will see or use getting closer to done: things working that didn\'t, and staying fixed;',
  '- a study or investigation narrowing down the options and producing findings, even before anything is built;',
  '- steady work through an agreed plan at roughly the planned pace.',
  '',
  'Look at the whole effort, not only the latest hours: the earlier checks show how long this goal has been running and what was still open at each one. Long is not circling by itself: a big job can take a day. Judge the direction, but the more hours have gone by, the more the work should show for them. The agent\'s own reports of success ("15 of 15 green", "gate passed") are not progress by themselves; ask whether the user\'s goal is closer.',
  '',
  'If the record is too thin to tell, answer unsure.',
  '',
  'Reply with JSON only, keys in this order:',
  '{"seen": "<the few facts from the record your verdict rests on, in a sentence or two>", "verdict": "progress" or "circling" or "unsure", "why": "<if circling or unsure: one or two plain sentences to the agent naming what keeps going round and roughly how long it has taken; otherwise empty>"}',
].join('\n')

// No "if this check is mistaken, carry on" here, on purpose: the agent judging itself is what failed.
const STRUGGLE_NOTE = (why, hours) =>
  'Struggle check (from the next-steps mod, not the user): an outside reviewer read your last several hours of ' +
  'work and judged that it is going in circles. ' + (why ? 'What it saw: ' + why + ' ' : '') +
  'Stop at the next safe point (let a running build or test finish, or stop it cleanly; leave nothing half-done) ' +
  'and write the user a short message:\n' +
  '1. What is taking longer than it should: about ' + hours + ' hours of work since the user last spoke, against ' +
  'what you expected.\n' +
  '2. Why, in plain words: what keeps going round.\n' +
  '3. Options, your pick first, each with what it gets them and what it costs in time, money and risk: (a) keep ' +
  'going, and what makes the next round different; (b) pause and spike: try other approaches small and fast, ' +
  'then report; (c) a helper agent spikes the other approaches while you keep working (on an ACAF project, the ' +
  'spike is the acaf-explore study).\n' +
  "A helper's spike is cheap and easy to undo, so don't wait for an answer to start it: start (c) now (the helper " +
  'researches and tries alternatives in a scratch copy, touching nothing the user has and spending no money), ' +
  'keep working, and when it reports back, end your turn with what it found and the options again. Anything ' +
  'costly or hard to undo (an install, a purchase, deleting, switching the approach for real) waits for the ' +
  "user's yes. If you already told the user about this and they chose to keep going, or a spike on it is already " +
  'running, tell them only what changed, and carry on.'

const TIME_NOTE = (hours, condensings, since) =>
  'Time check (from the next-steps mod, not the user): your conversation was just condensed. You have worked about ' +
  hours + ' hours since the user last spoke (at ' + since + '), and your memory has been condensed ' + condensings +
  ' time' + (condensings === 1 ? '' : 's') + ' in that stretch, so the summary you work from does not show how long ' +
  'this has taken. Compare it with what you expected this to take, or told the user. Only if it has clearly run ' +
  'past that (about twice as long), stop and tell the user in two lines what grew, with the quick version beside ' +
  "the thorough one (the user's habit 1). If it hasn't, or you had no estimate and the work is going as you'd " +
  'expect, say nothing about this to the user and carry on.'

// "10-25 15:42" in the machine's local time.
function stamp(ms) {
  const d = new Date(ms)
  const two = (n) => String(n).padStart(2, '0')
  return two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes())
}

function hoursText(ms) {
  return (Math.round((ms / 3600000) * 10) / 10).toFixed(1)
}

// Keeps the agent's own messages from a list of conversation messages, once each.
function gatherAgentNotes(messages, at) {
  for (const m of messages || []) {
    if (m.role !== 'assistant' || !m.text || !m.text.trim()) continue
    const key = m.text.slice(0, 200)
    if (seenAgentTexts.has(key)) continue
    if (seenAgentTexts.size > 3000) seenAgentTexts.clear()
    seenAgentTexts.add(key)
    agentNotes.push({ at, text: m.text.replace(/\s+/g, ' ').slice(0, 800) })
  }
}

// The judge's input: what happened in the last STRUGGLE_LOOK_MS, oldest first, and the earlier verdicts.
function strugglePrompt(at) {
  const look = workLog.filter((x) => x.at >= at - STRUGGLE_LOOK_MS)
  const start = look.length ? look[0].at : at
  let p =
    'Hours of work looked at: about ' + hoursText(at - start) + ' (from ' + stamp(start) + ' to ' + stamp(at) + '). ' +
    'The user last spoke ' + hoursText(at - lastPersonAt) + ' hours ago.' +
    (struggleChecks.length
      ? ' The earlier checks below go back ' + hoursText(at - struggleChecks[0].at) + ' hours (to ' + stamp(struggleChecks[0].at) + ').'
      : '') + '\n\n'
  if (latestCondensing) p += "Summary of earlier work, from the agent's latest condensing (cut to its start):\n" + latestCondensing + '\n\n'
  p +=
    'Earlier checks in this stretch:\n' +
    (struggleChecks.length ? struggleChecks.map((c) => '- ' + stamp(c.at) + ': ' + c.verdict + '. ' + c.seen).join('\n') : '(none)') +
    '\n\n'
  p +=
    'What happened, oldest first ("user:" lines are the user\'s own messages; the rest are the agent\'s steps):\n' +
    clip(look.map((x) => x.line).join('\n'), 24000) + '\n\n'
  const notes = agentNotes.filter((x) => x.at >= at - STRUGGLE_LOOK_MS).map((x) => x.text)
  p += "The agent's own messages, oldest first:\n" + clip(notes.join('\n---\n'), 12000)
  return p + '\n\nJudge it; do not continue the work. Reply with the JSON only.'
}

// Runs the outside judge once; a circling verdict leaves a note for the agent's next step. Never throws.
async function struggleCheck($, at) {
  try {
    gatherAgentNotes(await $.session.messages(), at)
    agentNotes = agentNotes.filter((x) => x.at >= at - STRUGGLE_LOOK_MS)
    const reply = await $.model.complete({
      model: 'sonnet',
      effort: 'low',
      system: STRUGGLE_SYSTEM,
      prompt: strugglePrompt(at),
      maxTokens: 400,
      timeoutMs: 45000,
    })
    const v = parseJson(replyText(reply)) || {}
    const verdict = ['progress', 'circling', 'unsure'].includes(v.verdict) ? v.verdict : 'unsure'
    const seen = typeof v.seen === 'string' ? v.seen.trim().slice(0, 400) : ''
    const why = typeof v.why === 'string' ? v.why.trim().slice(0, 600) : ''
    struggleChecks = [...struggleChecks.filter((c) => c.at >= at - STRUGGLE_HISTORY_MS), { at, verdict, seen }].slice(-12)
    const tokens = reply && reply.usage ? reply.usage.input_tokens + (reply.usage.cache_read_input_tokens || 0) : '?'
    await debugLog($, 'struggle check: ' + verdict + ' (' + tokens + ' tokens in): ' + seen + (why ? ' | ' + why : ''))
    const flagged = verdict === 'circling' || (verdict === 'unsure' && unsureInARow >= 1)
    unsureInARow = verdict === 'unsure' && !flagged ? unsureInARow + 1 : 0
    if (flagged) pendingStruggleNote = STRUGGLE_NOTE(why, hoursText(at - lastPersonAt))
  } catch {
    // A failed check never blocks the session.
  } finally {
    struggleRunning = false
  }
}

// The gut check: when the user last spoke (ms, 0 = not yet seen) and when the agent was last nudged.
let lastPersonAt = 0
let lastNudgeAt = 0

// How long an agent works without hearing from the user before it is asked to gut-check proportion,
// and how long between nudges after that.
const GUT_CHECK_MS = 30 * 60 * 1000

function clip(text, limit) {
  return text.length <= limit ? text : '...' + text.slice(text.length - limit)
}

// Keeps the last 2,000 lines of the checks' judgments in debug.log beside the mod, about two weeks of heavy use, so a
// review can look back past the last day or two (200 lines held only about two days). Never throws.
async function debugLog($, text) {
  try {
    const path = $.plugin.root + '/debug.log'
    const old = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
    const lines = (old + new Date().toISOString() + ' ' + text + '\n').split('\n').filter(Boolean).slice(-2000)
    await $.fs.write(path, lines.join('\n') + '\n')
  } catch {
    // Logging is best effort.
  }
}

// Reads the first JSON object in a model reply, or null.
function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function replyText(reply) {
  return typeof reply === 'string' ? reply : reply && reply.isAnswered ? reply.text : ''
}

// The numbered items of a "## <heading>" section of a markdown text, each joined into one line.
function sectionItems(text, heading) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase())
  if (start < 0) return []
  const items = []
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    const m = lines[i].match(/^\s*\d+\.\s+(.*)$/)
    if (m) items.push(m[1].trim())
    else if (items.length && lines[i].trim() && /^\s/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim()
  }
  return items
}

// The user's habits: the every-project list from ~/.claude/CLAUDE.md, then the project's own list
// from its acaf/lessons*.md file, if any. Never throws; an empty list means no reminders.
async function loadHabits($) {
  const habits = []
  try {
    const home = await $.env.get('USERPROFILE')
    const file = home ? home + '/.claude/CLAUDE.md' : ''
    if (file && (await $.fs.exists(file))) habits.push(...sectionItems(await $.fs.read(file), '## Top habits (every project)'))
  } catch {
    // No every-project list.
  }
  try {
    let dir = await $.session.cwd()
    for (let i = 0; dir && i < 6; i++) {
      if (await $.fs.exists(dir + '/acaf')) {
        const entries = await $.fs.list(dir + '/acaf')
        const lessons = entries.find((x) => /^lessons.*\.md$/i.test(x.name))
        if (lessons) habits.push(...sectionItems(await $.fs.read(dir + '/acaf/' + lessons.name), '## Top habits'))
        break
      }
      const parent = dir.replace(/[\\/][^\\/]*$/, '')
      if (!parent || parent === dir) break
      dir = parent
    }
  } catch {
    // No project list.
  }
  return habits
}

// The time in ms, or 0 when the clock can't be read.
async function nowMs($) {
  try {
    return await $.clock.now()
  } catch {
    return 0
  }
}

function numbered(items) {
  return items.map((h, i) => i + 1 + '. ' + h).join('\n')
}

// Prompts that are never the person talking: the summary a compaction submits.
function isCompactionSummary(text) {
  return text.startsWith('This session is being continued from a previous conversation')
}

// Picks the habits that fit the user's new message (none when none clearly apply), and judges whether the
// message asks for something the user will see or use with choices left open, so the agent asks first.
async function pickHabits($, text, habits) {
  try {
    const messages = await $.session.messages()
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.text)
    const reply = await $.model.complete({
      model: 'haiku',
      system: HABIT_PICK_SYSTEM,
      prompt:
        'Habits:\n' + numbered(habits) +
        "\n\nThe agent's last message:\n" + clip(last ? last.text : '(none)', 1500) +
        "\n\nThe user's new message:\n" + clip(text, 2000) +
        '\n\nJudge it; do not answer it. Reply with the JSON only.',
      maxTokens: 80,
      timeoutMs: 8000,
    })
    const verdict = parseJson(replyText(reply))
    const picks = verdict && Array.isArray(verdict.pick) ? verdict.pick : []
    return {
      picked: [...new Set(picks)].map((n) => habits[Number(n) - 1]).filter(Boolean).slice(0, 3),
      askFirst: Boolean(verdict && verdict.askFirst === true),
    }
  } catch {
    return { picked: [], askFirst: false }
  }
}

// Reads the panel summary from the model's reply, or null when it isn't usable.
function parseSummary(text) {
  const s = parseJson(text)
  if (!s || !['choose', 'wait', 'nothing'].includes(s.state)) return null
  const options = (Array.isArray(s.options) ? s.options : [])
    .filter((o) => o && typeof o.say === 'string' && o.say.trim())
    .slice(0, 4)
    .map((o) => ({ say: o.say.trim(), does: typeof o.does === 'string' ? o.does.trim() : '' }))
  return { state: s.state, headline: String(s.headline || '').trim(), waitFor: String(s.waitFor || '').trim(), options }
}

// How many background agents of this session are still at work.
async function runningAgents($) {
  try {
    const agents = await $.agent.list()
    return agents.filter((a) => a.status === 'running' || a.status === 'pending').length
  } catch {
    return 0
  }
}

// The actions of the turn that just ended, one short line each: the tool and the part of its
// input that says what it did (a command, a file, a URL).
async function turnActions($) {
  const messages = await $.session.messages()
  // Index of each message the person typed (not tool results), newest last.
  const prompts = []
  messages.forEach((m, i) => {
    if (m.role === 'user' && m.text && m.text.trim() && !(m.toolResults && m.toolResults.length)) prompts.push(i)
  })
  const thisTurn = prompts.length ? prompts[prompts.length - 1] + 1 : 0
  const from = prompts.length >= RECENT_TURNS ? prompts[prompts.length - RECENT_TURNS] + 1 : 0
  const lines = []
  messages.slice(from).forEach((m, k) => {
    const when = from + k >= thisTurn ? 'this turn' : 'earlier turn'
    for (const t of m.toolUses || []) {
      const input = t.input || {}
      const what = input.command || input.file_path || input.url || input.action || input.description || JSON.stringify(input)
      lines.push('- (' + when + ') ' + t.tool + ': ' + String(what).replace(/\s+/g, ' ').slice(0, 160) + (t.isError ? ' (failed)' : ''))
    }
  })
  return lines.slice(-60)
}

// Writes the panel summary for a finished reply, then redraws the panel. Never throws.
async function summarize($, answer) {
  const guess = suggestion
  summarizedWithSuggestion = Boolean(guess)
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: SUMMARY_SYSTEM,
      prompt:
        "The end of the agent's reply:\n" + clip(answer, 4000) +
        (guess ? "\n\nClaude Code's guess at what the person will type next:\n" + guess : ''),
      maxTokens: 400,
      timeoutMs: 15000,
    })
    if (answer !== lastAnswer) return // a newer reply has come in, or a done check took over
    const parsed = parseSummary(replyText(reply))
    const busy = await runningAgents($)
    if (parsed && busy > 0 && parsed.state !== 'wait') {
      parsed.state = 'wait'
      parsed.waitFor = busy === 1 ? 'a helper agent is still working' : busy + ' helper agents are still working'
    }
    summary = parsed
  } catch {
    summary = null
  }
  $.ui.invalidate('ui.render')
}

// Checks a finished reply for an untested claim, and against the user's habits. When the reply needs
// it, sends the agent back once: an untested claim comes first, then one clearly broken habit.
async function doneCheck($, answer) {
  try {
    const actions = await turnActions($)
    const habits = await loadHabits($)
    const reply = await $.model.complete({
      model: 'haiku',
      system: DONE_CHECK_SYSTEM + (habits.length ? HABIT_CHECK_ADDITION : ''),
      prompt:
        "The agent's final reply:\n" + clip(answer, 4000) +
        '\n\nActions it took this turn:\n' + (actions.length ? actions.join('\n') : '(none)') +
        (habits.length ? "\n\nThe user's habits:\n" + numbered(habits) : ''),
      maxTokens: 200,
      timeoutMs: 15000,
    })
    if (answer !== lastAnswer) return
    const verdict = parseJson(replyText(reply)) || {}
    const claim = typeof verdict.claim === 'string' ? verdict.claim.trim() : ''
    const needsCheck = Boolean(verdict.needsCheck && claim)
    const broken = typeof verdict.brokenHabit === 'string' ? verdict.brokenHabit.trim() : ''
    const why = typeof verdict.why === 'string' ? verdict.why.trim() : ''
    await debugLog(
      $,
      'reply check: ' + (needsCheck ? 'CHECK: ' + claim : claim ? 'ok: ' + claim : 'no claim') + (broken ? ' | HABIT: ' + broken + ' (' + why + ')' : ''),
    )
    if (!needsCheck && !broken) return
    let text, notice
    if (needsCheck) {
      text =
        'Done check: your last reply says "' + claim + '", but nothing you did this turn shows you tried it ' +
        'the way the user will. Check it now: run or open the real thing and look at the result. Then tell the ' +
        "user plainly whether it works. If it doesn't, fix it, or say it is changed but not yet checked. If you " +
        'already tried it earlier this session, or the reply made no such claim, say so in one line and carry on. ' +
        "If it can only be tried on the user's own device or account, say it is changed but not checked there."
      // A broken habit rides along in the same message, so a done check never hides it (one send-back per reply).
      if (broken) {
        text +=
          ' Also, your last reply or actions look like they break one of the user\'s habits: "' + broken + '". ' +
          (why ? 'What shows it: ' + why + '. ' : '') + 'Put that right too, or say in one line why it does not apply.'
      }
      notice = { kind: 'done', label: claim }
    } else {
      text =
        'Habit check: your last reply or actions look like they break one of the user\'s habits: "' + broken + '". ' +
        (why ? 'What shows it: ' + why + '. ' : '') +
        'Put it right now. If this check is mistaken, say so in one line and carry on.'
      notice = { kind: 'habit', label: broken }
    }
    // Frame the message so the agent can't take it for the user's words. The agent's answer becomes the last
    // message in the chat, the one the user reads. What the user needs there is what the check found and their
    // next options, so they never scroll up for them (the user, 2026-10-20). It is NOT a repeat of the whole last
    // reply: that made every checked reply appear twice (the user, 2026-10-24). Details go in a file, linked.
    const label = needsCheck ? 'done check' : 'habit check'
    text =
      '[Automatic ' + label + ' from the next-steps mod. This message is NOT from the user, who did not write or ' +
      'see it.]\n\n' + text + '\n\nYour answer becomes the last message the user reads, so write it for them, short:\n' +
      '1. One line: "The automatic ' + label + ' asked me to …", and what you found or changed.\n' +
      '2. If the check changed anything the user was told (a result, a number, a claim), say the corrected fact in ' +
      'a line or two. Don\'t repeat the rest of your last reply; it is still on screen above.\n' +
      '3. End with what the user can do next, if they have a choice: each option with what it gets them, what it ' +
      'costs (money, time, risk) and your pick, written for a technical product manager (outcomes and trade-offs, ' +
      'not code or engineering detail). If your last reply already asked them something, give that question and ' +
      'its options again here, updated, so they don\'t have to scroll up for it. If there is no choice, say ' +
      'what happens next in one line.\n' +
      'Longer findings (logs, measurements, file lists) go in a file in the project or session folder, linked in ' +
      'one line, not in the message.'
    lastAnswer = '' // the summary for this reply is now out of date: the agent is about to act on the check
    summary = null
    replyAnswersCheck = true
    doneNotice = { ...notice, isSent: true }
    $.ui.invalidate('ui.render')
    try {
      await $.prompt.submit({ text })
    } catch {
      replyAnswersCheck = false
      doneNotice = { ...notice, isSent: false }
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check never blocks the session.
  }
}

// After an edit to a code file, checks whether the new code judges meaning with keyword lists,
// patterns or thresholds. Returns a note for the agent, or '' when there is nothing to say.
async function judgmentCodeNote($, toolName, input) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(toolName) || !input) return ''
  const file = String(input.file_path || '')
  if (!CODE_FILE.test(file) || judgedFiles.has(file)) return ''
  const code =
    input.new_string || input.content || (Array.isArray(input.edits) ? input.edits.map((x) => x.new_string || '').join('\n') : '')
  if (!code || !MAYBE_JUDGMENT.test(code)) return ''
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: JUDGMENT_CODE_SYSTEM,
      prompt: 'File: ' + file + '\n\nCode:\n' + clip(String(code), 6000),
      maxTokens: 80,
      timeoutMs: 8000,
    })
    const verdict = parseJson(replyText(reply)) || {}
    await debugLog($, 'judgment-in-code: ' + (verdict.judgesMeaning ? 'YES' : 'no') + ': ' + file + (verdict.why ? ' (' + verdict.why + ')' : ''))
    if (!verdict.judgesMeaning) return ''
    judgedFiles.add(file)
    return (
      'Judgment-in-code check: the code you just wrote in ' + file + ' looks like it uses code to judge meaning' +
      (verdict.why ? ' (' + verdict.why + ')' : '') + '. The user\'s rule is to reach for a cheap model for that ' +
      '(for example Haiku, about a tenth of a cent per call) instead of keyword lists, patterns or thresholds. ' +
      'Before going further down this route, tell the user the model option: which model, its rough cost per call ' +
      'and per run, and what it does better. If the project already has a key for that model and the cost is ' +
      'tiny, you may switch and say so; if it needs a new service, key or real spend, ask first (in an ACAF ' +
      "project, through the direction check). If a model can't be used here (no key, no budget, a speed limit), " +
      'say that plainly. If this check is mistaken, say so in one line and carry on.'
    )
  } catch {
    return ''
  }
}

// The prompt catch (see PROMPT_FILE): after an edit to instructions another model reads, once per file.
async function promptNote($, toolName, input) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(toolName) || !input) return ''
  const file = String(input.file_path || '')
  if (!PROMPT_FILE.test(file) || NOT_PROMPT_FILE.test(file) || promptFiles.has(file)) return ''
  const text =
    input.new_string || input.content || (Array.isArray(input.edits) ? input.edits.map((x) => x.new_string || '').join('\n') : '')
  if (!text || !MAYBE_PROMPT.test(text)) return ''
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: PROMPT_CATCH_SYSTEM,
      prompt: 'File: ' + file + '\n\nText:\n' + clip(String(text), 6000) + '\n\nJudge it; do not answer it. Reply with the JSON only.',
      maxTokens: 60,
      timeoutMs: 8000,
    })
    const verdict = parseJson(replyText(reply)) || {}
    await debugLog($, 'prompt catch: ' + (verdict.isPrompt ? 'YES' : 'no') + ': ' + file + (verdict.what ? ' (' + verdict.what + ')' : ''))
    if (!verdict.isPrompt) return ''
    promptFiles.add(file)
    return (
      'Prompt check (from the next-steps mod, not the user): ' + file + ' holds instructions another model will ' +
      'follow' + (verdict.what ? ' (' + verdict.what + ')' : '') + '. Follow the acaf-prompt skill: give that model ' +
      'only what its job needs (withhold secrets instead of saying "never mention"), spell out words that could ' +
      'refer to two things, say what to do when information is missing, add no size or intensity words the person ' +
      'did not use, and put any line that must never be dropped in code. Before saying it works, run the real ' +
      'model on hard real cases, 2 or 3 runs each, and read the outputs the way the user will meet them; until ' +
      'then it is "changed, not yet checked". If this check is mistaken, say so in one line and carry on.'
    )
  } catch {
    return ''
  }
}

// Sends an option's words as the user's own next message. If the app refuses,
// puts them into the prompt box instead, ready to send.
async function sendOption($, text) {
  summary = null
  $.ui.invalidate('ui.render')
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    try {
      await $.prompt.fill({ text })
    } catch {
      // Nothing more to try; the user can type the words.
    }
  }
}

// True for another program's own call to Claude (`claude -p` or the Agent SDK), such as the debate app's judging
// calls on the user's plan. Nobody is at that prompt, so this mod's notes and checks would only rewrite that
// program's prompts and add a model call to each one (seen 2026-10-22: habit reminders attached to the app's
// "PARENT CLAIM" prompts).
// A person's session must never be skipped. The screen list alone is not enough: a Desktop session the user
// is not looking at can report no screen (2026-10-23: the panel and the done check went missing that way). So
// any sign of a person (a screen at any moment, the panel or a message being drawn, a typed message, an
// interactive start) marks the session as theirs for good, and only a session that has shown none of these
// and has no screen right now counts as a program's call. Environment variables can't tell them apart: a
// `claude -p` started inside a Desktop session inherits CLAUDE_CODE_ENTRYPOINT=claude-desktop.
let personSeen = false
async function isAppCall($) {
  if (personSeen) return false
  try {
    if ((await $.session.surfaces()).length) {
      personSeen = true
      return false
    }
    return true
  } catch {
    return false
  }
}
// A finished reply the mod held back because the session looked like a program's call; checked and summarized
// as soon as a sign of a person shows up (see the render hooks).
let heldAnswer = ''
function personArrived($) {
  if (personSeen) return
  personSeen = true
  if (!heldAnswer) return
  const answer = heldAnswer
  heldAnswer = ''
  lastAnswer = answer
  $.clock.after(0, () => doneCheck($, answer))
  $.clock.after(0, () => summarize($, answer))
}

export function register(on) {
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      summary = null
      suggestion = ''
      if (doneNotice && !doneNotice.isSent) doneNotice = null
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // A condensing empties the conversation of its pictures, so the picture count starts again.
  // It also loses the agent's own messages and its sense of how long it has worked: keep the messages for the
  // struggle check, and tell the agent the time at its next step.
  on('session.compact', async ($, e, next) => {
    gatherAgentNotes(e.messages, await nowMs($))
    const result = await next(e)
    if (!result || !result.skip) {
      picturesSinceCondense = 0
      bigOutputNoted = false
      picturesNoted = 0
      condensingsSincePerson += 1
      timeNoteDue = true
    }
    return result
  })

  // A terminal session starts interactive: a person is there from the start.
  on('session.start', async ($, e, next) => {
    if (e.isInteractive) personSeen = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.isAborted || !e.answer || !e.answer.trim()) return result
    if (await isAppCall($)) {
      heldAnswer = e.answer // checked and summarized if a person turns up (personArrived)
      return result
    }
    const answer = e.answer
    lastAnswer = answer
    if (replyAnswersCheck) {
      // This reply answers a done-check prompt: show it, but don't check it again.
      replyAnswersCheck = false
      doneNotice = null
    } else {
      doneNotice = null
      $.clock.after(0, () => doneCheck($, answer))
    }
    // Summarize a moment after the turn, so the reply isn't held up and the guess can arrive.
    $.clock.after(SUGGESTION_WAIT_MS, () => summarize($, answer))
    return result
  })

  // Habit reminders: attach the habits (0 to 3) that what the user just asked for could break.
  on('prompt.submit', async ($, e, next) => {
    const kind = e.origin && e.origin.kind
    const fromPerson =
      !kind || ['composer', 'bridge', 'sdk', 'unclassified'].includes(kind) || (kind === 'plugin' && e.origin.asUser)
    if (['composer', 'bridge'].includes(kind) || (kind === 'plugin' && e.origin.asUser)) personArrived($)
    if (e.text && isCompactionSummary(e.text)) latestCondensing = e.text.slice(0, 5000)
    if (!fromPerson || !e.text || !e.text.trim() || isCompactionSummary(e.text) || (await isAppCall($))) return next(e)
    lastPersonAt = await nowMs($)
    lastNudgeAt = 0
    condensingsSincePerson = 0
    workLog.push({ at: lastPersonAt, line: stamp(lastPersonAt) + ' user: ' + e.text.replace(/\s+/g, ' ').slice(0, 800) })
    const habits = await loadHabits($)
    if (!habits.length) return next(e)
    const { picked, askFirst } = await pickHabits($, e.text, habits)
    // The screen it ran on (e.g. "desktop"), so the log shows the no-screen skip is not catching real sessions.
    const screens = await $.session.surfaces().then((s) => s.join(','), () => '?')
    await debugLog($, 'habit reminder [' + screens + ']: ' + (picked.length ? picked.length + ' habit(s)' : 'none') + (askFirst ? ', ask first' : '') + ' for: ' + e.text.replace(/\s+/g, ' ').slice(0, 80))
    const notes = []
    if (askFirst) notes.push(ASK_FIRST_NOTE)
    if (picked.length) {
      notes.push(
        "Habits to keep in mind for this request (from the user's lessons, picked automatically: act on the ones " +
        "that fit and skip any that don't; don't recite them):\n" +
        picked.map((h) => '- ' + h).join('\n'),
      )
    }
    if (!notes.length) return next(e)
    return next({ ...e, context: [...(e.context ?? []), ...notes] })
  })

  // Judgment-in-code catch, after each edit to a code file.
  on('classic.PostToolUse', async ($, e, next) => {
    const result = (await next(e)) || {}
    if (e.agent_id || (await isAppCall($))) return result
    const notes = []
    const codeNote = await judgmentCodeNote($, e.tool_name, e.tool_input)
    if (codeNote) notes.push(codeNote)
    const promptCheck = await promptNote($, e.tool_name, e.tool_input)
    if (promptCheck) notes.push(promptCheck)
    // Count the pictures this step put into the conversation (a picture is an "image" part of the result).
    const response = JSON.stringify(e.tool_response || '')
    picturesSinceCondense += (response.match(/"type"\s*:\s*"image"/g) || []).length
    // The result's size in tokens, estimated, with picture data left out (pictures are counted above).
    const outputTokens = response.replace(/"(data|base64)"\s*:\s*"[^"]{200,}"/g, '""').length / 4
    if (!bigOutputNoted && outputTokens > BIG_OUTPUT_TOKENS) {
      bigOutputNoted = true
      await debugLog($, 'big output check: ' + e.tool_name + ' result about ' + Math.round(outputTokens) + ' tokens')
      notes.push(BIG_OUTPUT_NOTE(e.tool_name, outputTokens))
    }
    if (picturesSinceCondense - picturesNoted >= PICTURES_STEP) {
      picturesNoted = picturesSinceCondense
      await debugLog($, 'pictures check: ' + picturesSinceCondense + ' pictures since the last condensing')
      notes.push(PICTURES_NOTE(picturesSinceCondense))
    }
    const now = await nowMs($)
    if (now && !lastPersonAt) lastPersonAt = now // start counting from the first action after a (re)load
    if (now) {
      // The time check, at the first step after a condensing.
      if (timeNoteDue) {
        timeNoteDue = false
        if (now - lastPersonAt >= TIME_NOTE_MS) {
          await debugLog($, 'time check: ' + hoursText(now - lastPersonAt) + ' h since the user, ' + condensingsSincePerson + ' condensing(s)')
          notes.push(TIME_NOTE(hoursText(now - lastPersonAt), condensingsSincePerson, stamp(lastPersonAt)))
        }
      }
      // The struggle check: log this step, deliver a finished verdict's note, and start a check when one is due.
      const input = e.tool_input || {}
      const what = input.description || input.command || input.file_path || input.url || input.prompt || input.action || ''
      workLog.push({ at: now, line: stamp(now) + ' ' + String(e.tool_name).split('__').pop() + ': ' + String(what).replace(/\s+/g, ' ').slice(0, 160) })
      workLog = workLog.filter((x) => x.at >= now - STRUGGLE_LOOK_MS)
      if (lastStepAt) workedSinceCheck += Math.min(Math.max(now - lastStepAt, 0), STEP_GAP_CAP_MS)
      lastStepAt = now
      if (pendingStruggleNote) {
        notes.push(pendingStruggleNote)
        pendingStruggleNote = ''
      }
      if (!struggleRunning && workedSinceCheck >= (unsureInARow ? STRUGGLE_UNSURE_MS : STRUGGLE_EVERY_MS)) {
        workedSinceCheck = 0
        struggleRunning = true
        $.clock.after(0, () => struggleCheck($, now))
      }
    }
    if (now && now - Math.max(lastPersonAt, lastNudgeAt) >= GUT_CHECK_MS) {
      lastNudgeAt = now
      const minutes = Math.round((now - lastPersonAt) / 60000)
      await debugLog($, 'gut check: nudged after ' + minutes + ' minutes without the user')
      notes.push(
        'Gut check: you have worked about ' + minutes + ' minutes since the user last spoke. Has the user told ' +
          'you how big real use is (how many people, items, or how often)? If not, and you are handling cases ' +
          'bigger or rarer than plain use (worst cases, scale, polish), stop and ask: one question, 2 to 4 ' +
          'multiple-choice answers, and what each answer would mean for the work. Example: 40 minutes making ' +
          'uploads handle 10,000 images for an app three friends use -> ask. If they already told you the size, ' +
          'or you are working through an agreed plan at the expected pace, carry on without comment.',
      )
    }
    if (!notes.length) return result
    return { ...result, additionalContext: [...(result.additionalContext ?? []), ...notes] }
  })

  // Claude Code's guess at the next prompt. It stays in the box as it is; if it
  // arrives after the summary was written, the summary is written again with it.
  on('prompt.suggest', async ($, e, next) => {
    if (e.origin && e.origin.kind === 'suggestion' && e.text && e.text.trim()) {
      suggestion = e.text.trim()
      if (summary && !summarizedWithSuggestion && lastAnswer) {
        const answer = lastAnswer
        $.clock.after(0, () => summarize($, answer))
      }
    }
    return next(e)
  })

  // The Desktop app's next-step box (its wrap-up tool) is turned off, by the user's choice (2026-10-21).
  // Agents treated the box as their real reply and the chat as optional: one-line recaps instead of the steps
  // the user needed, even after a once-per-turn reminder to write in the chat first. The panel this mod draws
  // already shows the next options as buttons, so nothing is lost. Undo: delete these two hooks.
  on('tool.describe', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) =>
    next({
      ...e,
      description:
        "Turned off by the user. Don't call this tool. Write your whole reply in the chat, ending with what you " +
        'need from the user, if anything; a panel above the prompt shows them their next options.',
    }),
  )

  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e) => {
    await debugLog($, 'next-step box: refused (turned off by the user)')
    return {
      deny:
        'The next-step box is turned off by the user. Write your whole reply in the chat instead: the explanation, ' +
        'instructions or numbered steps they need, in full and in plain words, ending with any question for them. ' +
        'The panel above the prompt shows their next options; you do not need the box.',
    }
  })

  // The done and habit checks reach the agent as a prompt this mod submits, which Claude Code shows as a
  // message in the user's place. Draw it as one short grey line instead, so it isn't mistaken for something
  // the user typed. The full text still shows in the expanded transcript view (ctrl+o).
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    personArrived($) // something is drawing this session for a person
    const p = e.props || {}
    const o = p.origin || {}
    const text = String(p.text || '')
    const ours = (o.kind === 'plugin' && o.name === 'next-steps') || /next-steps plugin sent a message/.test(text)
    if (!ours || p.isExpanded || !/(Done check|Habit check):/.test(text)) return next(e)
    const { Text } = $.ui.resolve(e)
    const quoted = (text.match(/"([^"]{3,200})"/) || [])[1] || ''
    const line = /Habit check:/.test(text)
      ? '🔎 Habit check (automatic): asked the agent to put right a slip against your habit "' + quoted + '".'
      : '🔎 Done check (automatic): asked the agent to try "' + quoted + '" for real before you rely on it.'
    return Text({ dimColor: true, wrap: 'wrap', children: [line] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    personArrived($) // something is drawing this session for a person
    if (e.props && e.props.isWorking) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    if (doneNotice) {
      const n = doneNotice
      const line =
        n.kind === 'habit'
          ? n.isSent
            ? '🔎 Habit check: the agent may have broken "' + n.label + '". It is putting it right now.'
            : '⚠ Habit check: the agent may have broken "' + n.label + '".'
          : n.isSent
            ? '🔎 Checking: the agent said "' + n.label + '" without trying it. It is checking now.'
            : '⚠ Not checked yet: the agent said "' + n.label + '" but did not try it.'
      return Box({ borderStyle: 'round', paddingX: 1, paddingY: 1, children: [Text({ bold: true, wrap: 'wrap', children: [line] })] })
    }
    if (!summary) return next(e)
    const s = summary
    const title =
      s.state === 'wait'
        ? '⏳ Wait: ' + (s.waitFor || 'work is still running') + '. It will report back.'
        : s.state === 'choose'
          ? '👉 Your turn: ' + (s.headline || 'pick what happens next')
          : '✓ ' + (s.headline || 'Nothing needed from you')
    // The short phrase is the button and what it does sits beside it (the user's preference:
    // the whole-line button was not wanted). A mod can't set a button's height, so the panel
    // gets room instead: space between rows and padding inside, so it doesn't read as packed.
    const rows = s.options.map((o, i) =>
      Box({
        key: 'row-' + i,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 1,
        children: [
          Button({ key: 'opt-' + i, label: o.say, onPress: () => sendOption($, o.say) }),
          Text({ dimColor: true, wrap: 'wrap', children: [o.does] }),
        ],
      }),
    )
    return Box({
      flexDirection: 'column',
      borderStyle: 'round',
      paddingX: 1,
      paddingY: 1,
      rowGap: 1,
      children: [Text({ bold: true, wrap: 'wrap', children: [title] }), ...rows],
    })
  })
}
