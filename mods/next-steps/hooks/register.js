// The next-steps mod. It loads in every session (ACAF projects and others, Snugit included) and
// does two jobs at the end of each reply:
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
//    picks the 1 to 3 habits that fit what the agent is about to do and attaches them to the message.
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

const SUMMARY_SYSTEM = [
  "You summarize the end of an AI coding agent's reply for a busy person who only skims.",
  'Say what the person can do next, in plain words a smart 10-year-old would follow. No jargon, no file',
  'names, no internal IDs.',
  '',
  'Reply with JSON only, in this shape:',
  '{"state": "choose" | "wait" | "nothing", "headline": "...", "options": [{"say": "...", "does": "..."}], "waitFor": "..."}',
  '',
  '- "choose": the agent needs the person to decide or answer. headline: the decision, at most 12 words.',
  '  options: 1 to 4 choices the agent offered, best first. say: the exact words to send, at most 6 words',
  "  (use the agent's own suggested words when it gave some). does: what happens then, at most 14 words.",
  '- "wait": the agent says work is still running in the background (a test run, a build, a helper agent) and',
  '  it will report back, so the person should not reply yet. waitFor: what is running, at most 12 words.',
  '  options: [] unless the agent also offers something to do meanwhile.',
  '- "nothing": the reply needs nothing from the person. headline: what was done, at most 12 words.',
  '  options: at most 2 optional next steps the agent suggested.',
  '',
  "You may also get Claude Code's own guess at what the person will type next. If it is a sensible next step",
  'and does not mean the same as an option you already have, add it as an option with say set to its exact',
  'words. If it means the same as one of your options, keep one option, worded the clearer way.',
].join('\n')

const DONE_CHECK_SYSTEM = [
  "You check an AI coding agent's final reply for claims it has not checked. You get the reply and the list",
  'of actions the agent took during this turn.',
  '',
  'Reply with JSON only: {"claim": "...", "needsCheck": true | false}',
  '- claim: the most important thing the reply says is now fixed, working, built, done, sent or verified, in at',
  '  most 15 plain words. Use "" when the reply makes no such claim: questions, plans, explanations, and reports',
  '  of failures or of work not yet checked are not claims.',
  '- needsCheck: true only when there is a claim AND none of the actions show the agent tried that thing the way',
  '  a person would meet it: launching or running the app or the command that shows the result, opening or',
  '  screenshotting it, reading its real output, or confirming a message arrived. Editing files, and passing',
  '  unit tests, do not count as trying it. If the reply itself says the thing is not yet checked, use false.',
].join('\n')

// Extra instructions for the reply check when there are habits to check against.
const HABIT_CHECK_ADDITION = [
  '',
  'You also get the user\'s habit list. Add two fields: "brokenHabit": the exact text of one habit the reply or',
  'the actions clearly break, or "" if none; "why": what in the reply or actions shows it, at most 20 words.',
  'Only report a clear break you can point to (for example: handing over visual work with no look at it, or',
  'proposing three redesigns for a one-line tweak). When unsure, use "".',
].join('\n')

const HABIT_PICK_SYSTEM = [
  "You help an AI coding agent remember the user's habits at the moment they matter. You get the habit list,",
  "the agent's last message, and the user's new message. Pick the habits most likely to matter for what the",
  'agent will do next: at most 3, and none when nothing clearly applies.',
  'Reply with JSON only: {"pick": [habit numbers]}',
].join('\n')

const JUDGMENT_CODE_SYSTEM = [
  'You look at code an AI agent just wrote. Decide whether it uses code to judge meaning: whether two texts',
  'mean the same, whether something is relevant, accurate, well written, rude, on-topic, or what kind of thing',
  'it is, using keyword or phrase lists, patterns, similarity scores, overlap counts or thresholds. A cheap',
  'model would judge that better. Exact checks (a field is present, a format is valid, a total, a file exists)',
  'are fine as code, and so is code that only gathers candidates for a model to judge.',
  'Reply with JSON only: {"judgesMeaning": true | false, "why": "at most 20 words"}',
].join('\n')

const CODE_FILE = /\.(js|jsx|ts|tsx|mjs|cjs|py|dart|kt|kts|java|swift|cs|go|rb|rs|php)$/i
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
// The gut check: when the user last spoke (ms, 0 = not yet seen) and when the agent was last nudged.
let lastPersonAt = 0
let lastNudgeAt = 0

// How long an agent works without hearing from the user before it is asked to gut-check proportion,
// and how long between nudges after that.
const GUT_CHECK_MS = 30 * 60 * 1000

function clip(text, limit) {
  return text.length <= limit ? text : '...' + text.slice(text.length - limit)
}

// Keeps the last 200 lines of the done check's judgments in debug.log beside the mod. Never throws.
async function debugLog($, text) {
  try {
    const path = $.plugin.root + '/debug.log'
    const old = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
    const lines = (old + new Date().toISOString() + ' ' + text + '\n').split('\n').filter(Boolean).slice(-200)
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

// Picks the habits that fit the user's new message, or [] when none clearly apply.
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
        "\n\nThe user's new message:\n" + clip(text, 2000),
      maxTokens: 60,
      timeoutMs: 8000,
    })
    const verdict = parseJson(replyText(reply))
    const picks = verdict && Array.isArray(verdict.pick) ? verdict.pick : []
    return [...new Set(picks)].map((n) => habits[Number(n) - 1]).filter(Boolean).slice(0, 3)
  } catch {
    return []
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
  let start = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && m.text && m.text.trim() && !(m.toolResults && m.toolResults.length)) {
      start = i + 1
      break
    }
  }
  const lines = []
  for (const m of messages.slice(start)) {
    for (const t of m.toolUses || []) {
      const input = t.input || {}
      const what = input.command || input.file_path || input.url || input.action || input.description || JSON.stringify(input)
      lines.push('- ' + t.tool + ': ' + String(what).replace(/\s+/g, ' ').slice(0, 160) + (t.isError ? ' (failed)' : ''))
    }
  }
  return lines.slice(-40)
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
        "user plainly whether it works. If it doesn't, fix it, or say it is changed but not yet checked."
      notice = { kind: 'done', label: claim }
    } else {
      text =
        'Habit check: your last reply or actions look like they break one of the user\'s habits: "' + broken + '". ' +
        (why ? 'What shows it: ' + why + '. ' : '') +
        'Put it right now. If this check is mistaken, say so in one line and carry on.'
      notice = { kind: 'habit', label: broken }
    }
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
      'Tell the user that option and its cost now, before going further down this route; if a model is clearly ' +
      'cheap and better here, switch to it and say so. If this check is mistaken, say so in one line.'
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

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.isAborted || !e.answer || !e.answer.trim()) return result
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

  // Habit reminders: attach the 1 to 3 habits that fit what the user just asked for.
  on('prompt.submit', async ($, e, next) => {
    const kind = e.origin && e.origin.kind
    const fromPerson =
      !kind || ['composer', 'bridge', 'sdk', 'unclassified'].includes(kind) || (kind === 'plugin' && e.origin.asUser)
    if (!fromPerson || !e.text || !e.text.trim() || isCompactionSummary(e.text)) return next(e)
    lastPersonAt = await nowMs($)
    lastNudgeAt = 0
    const habits = await loadHabits($)
    if (!habits.length) return next(e)
    const picked = await pickHabits($, e.text, habits)
    await debugLog($, 'habit reminder: ' + (picked.length ? picked.length + ' habit(s)' : 'none') + ' for: ' + e.text.replace(/\s+/g, ' ').slice(0, 80))
    if (!picked.length) return next(e)
    const note =
      "Habits to keep in mind for this request (from the user's lessons; act on them, don't recite them):\n" +
      picked.map((h) => '- ' + h).join('\n')
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  // Judgment-in-code catch, after each edit to a code file.
  on('classic.PostToolUse', async ($, e, next) => {
    const result = (await next(e)) || {}
    if (e.agent_id) return result
    const notes = []
    const codeNote = await judgmentCodeNote($, e.tool_name, e.tool_input)
    if (codeNote) notes.push(codeNote)
    const now = await nowMs($)
    if (now && !lastPersonAt) lastPersonAt = now // start counting from the first action after a (re)load
    if (now && now - Math.max(lastPersonAt, lastNudgeAt) >= GUT_CHECK_MS) {
      lastNudgeAt = now
      const minutes = Math.round((now - lastPersonAt) / 60000)
      await debugLog($, 'gut check: nudged after ' + minutes + ' minutes without the user')
      notes.push(
        'Gut check: you have worked about ' + minutes + ' minutes since the user last spoke. Is this still in ' +
          'proportion to what they need? If one quick question about real use (how many people, how often, how ' +
          'big) could shrink or end this work, stop and ask it now: one question, 2 to 4 multiple-choice answers, ' +
          'and what each answer would mean for the work. If you are sure the work is in proportion, carry on.',
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
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
