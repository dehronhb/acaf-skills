// The next-steps mod: a plain-language panel above the prompt, so the user can
// see at a glance what Claude is waiting on.
//   - When a reply ends, a cheap model reads it and writes a short summary: what
//     the user can do next and what each choice does, or that background work is
//     running and there is nothing to do but wait, or that nothing is needed.
//   - Background agents still running always show as "wait", whatever the reply says.
//   - Claude Code's own guess at the user's next prompt (the dim text in the empty
//     prompt box) is passed to the model too, so a real next step it names is not
//     missing from the panel. The model decides whether it is new or a repeat of an
//     option in other words; code can't judge that.
//   - Each option's short phrase is a button; pressing it sends those words as the
//     user's next message. If sending is
//     refused, the words go into the prompt box instead.
// The panel hides while Claude is working and comes back when the reply ends.

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

// The latest summary, or null when there is none to show; the last reply's text and
// Claude Code's next-prompt guess for it, so a late guess can be folded in. Reset on reload.
let summary = null
let lastAnswer = ''
let suggestion = ''
let summarizedWithSuggestion = false

function clip(text, limit) {
  return text.length <= limit ? text : '...' + text.slice(text.length - limit)
}

// Reads the model's JSON reply, or null when it isn't usable.
function parseSummary(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const s = JSON.parse(text.slice(start, end + 1))
    if (!['choose', 'wait', 'nothing'].includes(s.state)) return null
    const options = (Array.isArray(s.options) ? s.options : [])
      .filter((o) => o && typeof o.say === 'string' && o.say.trim())
      .slice(0, 4)
      .map((o) => ({ say: o.say.trim(), does: typeof o.does === 'string' ? o.does.trim() : '' }))
    return { state: s.state, headline: String(s.headline || '').trim(), waitFor: String(s.waitFor || '').trim(), options }
  } catch {
    return null
  }
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

// Writes the summary for a finished reply, then redraws the panel. Never throws.
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
    if (answer !== lastAnswer) return // a newer reply has come in since
    const text = typeof reply === 'string' ? reply : reply && reply.isAnswered ? reply.text : ''
    const parsed = parseSummary(text)
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
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.isAborted || !e.answer || !e.answer.trim()) return result
    const answer = e.answer
    lastAnswer = answer
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
    if (!summary || (e.props && e.props.isWorking)) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
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
