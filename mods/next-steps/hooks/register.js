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

// Checks a finished reply for an untested claim and, when there is one, asks the agent to test it.
async function doneCheck($, answer) {
  try {
    const actions = await turnActions($)
    const reply = await $.model.complete({
      model: 'haiku',
      system: DONE_CHECK_SYSTEM,
      prompt:
        "The agent's final reply:\n" + clip(answer, 4000) +
        '\n\nActions it took this turn:\n' + (actions.length ? actions.join('\n') : '(none)'),
      maxTokens: 150,
      timeoutMs: 15000,
    })
    if (answer !== lastAnswer) return
    const verdict = parseJson(replyText(reply))
    const claim = verdict && typeof verdict.claim === 'string' ? verdict.claim.trim() : ''
    const needsCheck = Boolean(verdict && verdict.needsCheck && claim)
    await debugLog($, 'done check: ' + (needsCheck ? 'CHECK' : 'ok') + (claim ? ': ' + claim : ''))
    if (!needsCheck) return
    lastAnswer = '' // the summary for this reply is now out of date: the agent is about to check
    summary = null
    replyAnswersCheck = true
    doneNotice = { claim, isSent: true }
    $.ui.invalidate('ui.render')
    try {
      await $.prompt.submit({
        text:
          'Done check: your last reply says "' + claim + '", but nothing you did this turn shows you tried it ' +
          'the way the user will. Check it now: run or open the real thing and look at the result. Then tell the ' +
          "user plainly whether it works. If it doesn't, fix it, or say it is changed but not yet checked.",
      })
    } catch {
      replyAnswersCheck = false
      doneNotice = { claim, isSent: false }
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check never blocks the session.
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
      const line = doneNotice.isSent
        ? '🔎 Checking: the agent said "' + doneNotice.claim + '" without trying it. It is checking now.'
        : '⚠ Not checked yet: the agent said "' + doneNotice.claim + '" but did not try it.'
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
