// The next-steps mod: a plain-language panel above the prompt, so the user can
// see at a glance what Claude is waiting on.
//   - When a reply ends, a cheap model reads it and writes a short summary: what
//     the user can do next and what each choice does, or that background work is
//     running and there is nothing to do but wait, or that nothing is needed.
//   - Background agents still running always show as "wait", whatever the reply says.
//   - Each option is a button that puts its words into the prompt box.
// The panel hides while Claude is working and comes back when the reply ends.

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
].join('\n')

// The latest summary, or null when there is none to show. Reset on reload.
let summary = null

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
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: SUMMARY_SYSTEM,
      prompt: "The end of the agent's reply:\n" + clip(answer, 4000),
      maxTokens: 400,
      timeoutMs: 15000,
    })
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

// Puts an option's words into the prompt box, ready to send.
async function fillPrompt($, text) {
  try {
    await $.prompt.fill({ text })
  } catch {
    // The words are on the panel anyway.
  }
}

export function register(on) {
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      summary = null
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.isAborted || !e.answer || !e.answer.trim()) return result
    const answer = e.answer
    // Summarize after the turn has finished drawing, so the reply isn't held up.
    $.clock.after(0, () => summarize($, answer))
    return result
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
    const rows = s.options.map((o, i) =>
      Box({
        key: 'row-' + i,
        flexDirection: 'row',
        columnGap: 1,
        children: [
          Button({ key: 'opt-' + i, label: o.say, onPress: () => fillPrompt($, o.say) }),
          Text({ dimColor: true, wrap: 'wrap', children: [o.does] }),
        ],
      }),
    )
    return Box({
      flexDirection: 'column',
      borderStyle: 'round',
      paddingX: 1,
      children: [Text({ bold: true, wrap: 'wrap', children: [title] }), ...rows],
    })
  })
}
