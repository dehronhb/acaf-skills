// The ACAF mod. Skills teach the thinking; this mod makes sure the key moments
// happen, in projects that have an acaf/ folder:
//   1. Each message gets a routing reminder, and a cheap model checks whether the
//      user is correcting course. If so, the agent runs acaf-lesson first.
//   2. After a compaction or a resume, the agent re-orients from the records.
//   3. A `direction` tool shows the user an options card before an unsure,
//      costly move, and logs the choice.
//   4. At about 200k tokens the agent is told to save its place in the records.
//      The condensing itself is Claude Code's own: each ACAF project sets
//      `autoCompactWindow: 250000` in .claude/settings.local.json. (A mod can't
//      condense in the Desktop app: $.session.compact is refused in SDK sessions.)

const PREPARE_AT = 200000

// Whether the agent has had the prepare note since the last condensing. Reset on reload.
let prepared = false

// One-step picks from a "What's next" menu. Exact matches only: these are never
// corrections, so they skip the model call.
const LOOP_COMMANDS = new Set([
  'review it', 're-review', 'review', 'accept', 'continue', 'go', 'push', 'done', 'yes', 'ok', 'okay',
  'yes go', 'yes, go', 'go ahead', 'yes, go ahead', 'all at once', 'one at a time', 'build all slices',
  'next', 'keep going', 'status', 'where were we',
])

const ROUTE_NOTE =
  'ACAF project: before acting, route this message through the routing table in CLAUDE.md and invoke the ' +
  "matching acaf skill (don't follow a skill from memory). At a fork in the road (choosing a route or a tool, " +
  "spending money, dropping an approach, or concluding that something can't be done) use acaf-direction."

const LESSON_NOTE =
  'The user is correcting course. Before anything else, invoke acaf-lesson: say in one sentence what you ' +
  'assumed and what is actually true, find everywhere else that assumption shaped the work, and record the ' +
  'lesson. If the user found a bug, also work out why your own checks missed it, and add the check that ' +
  'would catch that kind of bug before it reaches them. Then continue on the corrected route.'

const REORIENT_NOTE =
  'This conversation was just compacted or resumed. Before continuing, re-read CLAUDE.md and run ' +
  'acaf-pickup, and resume from the acaf/ records rather than from the summary.'

const PREPARE_NOTE =
  'This conversation is nearing 250k tokens and will be condensed soon. At your next stopping point, ' +
  'bring the acaf/ records up to date so nothing is lost: change_log.md rows, the manifest\'s slice ' +
  'checkboxes, any DEV- or lesson entries, and handoff_summary.md with where you are, what the user decided ' +
  'this session, and the exact next step.'

// Prompts that are never the person talking: the summary a compaction submits.
const NOT_TYPED_PREFIXES = ['This session is being continued from a previous conversation']

const JUDGE_SYSTEM = [
  'You help an AI coding agent notice when the person it works for is steering it back.',
  "You get the agent's last message and the person's reply.",
  '',
  'Answer CORRECTION when the reply shows the agent was heading the wrong way because of how it thought ' +
    'about the problem: a wrong assumption about the person, their product or the world; a misread request; ' +
    'an approach the person rejects or questions (why did you, are you sure, is this the right path); a limit ' +
    "or shortcut the person didn't ask for; work handed back that the agent could do itself; something built " +
    "from scratch that already exists; something called done or impossible that isn't; one instance fixed " +
    "where the person wanted every instance; or a bug or problem the person found in the agent's work, " +
    'such as something that broke or behaved wrongly when they tried it.',
  '',
  'Answer NOT when the reply picks, approves or goes with something the agent offered or recommended; asks ' +
    'the agent to do a task (open, run, set up, research, plan something); asks a question, including what the ' +
    'agent can see or do; adds a new idea or requirement the agent had no way to know; gives taste feedback on ' +
    'work that otherwise went the agreed way; or is unrelated chat.',
  '',
  'Reply with exactly one word: CORRECTION or NOT.',
].join('\n')

const DIRECTION_DESCRIPTION =
  'Show the user a direction check and wait for their choice. Use it before an unsure, costly move: spending ' +
  "real money on something not yet proven, a change that is hard to undo, or a change of direction the user " +
  "would notice in the product. Also use it before dropping an approach or concluding that something can't " +
  "be done. Don't use it for cheap choices or ones you are sure of: make those yourself and say what you did. " +
  "Returns the user's choice."

const DIRECTION_SCHEMA = {
  type: 'object',
  properties: {
    problem: { type: 'string', description: 'The problem in one or two plain sentences, as the user would put it.' },
    options: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'The option in 1 to 5 words.' },
          gets: { type: 'string', description: 'What the user gets with this option, in plain words (one or two sentences).' },
          givesUp: { type: 'string', description: 'What the user gives up or risks with this option, in plain words (one or two sentences).' },
          cost: { type: 'string', description: 'Money and time, e.g. "$0, about an hour" or "$8 once, then $0.40 a video".' },
          confidence: { type: 'string', description: 'How sure you are that it works, and why, in a few words.' },
        },
        required: ['label', 'gets', 'givesUp', 'cost', 'confidence'],
      },
    },
    recommendation: { type: 'string', description: 'The label of the option you recommend.' },
    why: { type: 'string', description: 'Why you recommend it, in one sentence.' },
  },
  required: ['problem', 'options', 'recommendation', 'why'],
}

// The project root holding acaf/, searching up from the session's directory, or null.
async function findAcafRoot($) {
  let dir = await $.session.cwd()
  for (let i = 0; dir && i < 6; i++) {
    if (await $.fs.exists(dir + '/acaf/initiative_manifest.md')) return dir
    const parent = dir.replace(/[\\/][^\\/]*$/, '')
    if (!parent || parent === dir) break
    dir = parent
  }
  return null
}

// Tokens in the live context, from the free status-line figures, or 0 when unknown.
async function contextTokens($) {
  try {
    const usage = await $.session.usage()
    return (usage && usage.context && usage.context.tokens) || 0
  } catch {
    return 0
  }
}

// Keeps the last 200 lines of what the mod did in debug.log beside the mod, so a
// silent failure can be found later. Never throws.
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

// True once per stretch of conversation, when it first passes PREPARE_AT in an ACAF project.
async function shouldPrepare($) {
  if (prepared || (await contextTokens($)) < PREPARE_AT) return false
  if (!(await findAcafRoot($))) return false
  prepared = true
  return true
}

// Only messages the person typed are judged: not notifications, scheduled prompts or other agents.
function isFromPerson(e) {
  const kind = e.origin && e.origin.kind
  return !kind || kind === 'composer' || kind === 'bridge' || kind === 'sdk' || kind === 'unclassified'
}

function isLoopCommand(text) {
  if (NOT_TYPED_PREFIXES.some((p) => text.startsWith(p))) return true
  const t = text.trim().toLowerCase().replace(/[.!\s]+$/, '')
  return t.startsWith('/') || LOOP_COMMANDS.has(t)
}

function clip(text, limit) {
  return text.length <= limit ? text : '...' + text.slice(text.length - limit)
}

// Asks a cheap model whether the person is correcting the agent's direction. Fails open (false).
async function isCorrection($, text) {
  try {
    const messages = await $.session.messages()
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.text)
    if (!last) return false
    const reply = await $.model.complete({
      model: 'haiku',
      system: JUDGE_SYSTEM,
      prompt: "The agent's last message:\n" + clip(last.text, 2000) + "\n\nThe person's reply:\n" + clip(text, 3000),
      maxTokens: 5,
      timeoutMs: 8000,
    })
    const answer = typeof reply === 'string' ? reply : reply && reply.isAnswered ? reply.text : ''
    const isIt = answer.trim().toUpperCase().startsWith('CORRECTION')
    await debugLog($, 'judge: ' + (isIt ? 'CORRECTION' : 'not') + ': ' + text.replace(/\s+/g, ' ').slice(0, 100))
    return isIt
  } catch {
    return false
  }
}

// Appends one line to acaf/decisions/direction_log.md. Never blocks the answer.
async function logDirection($, root, line) {
  try {
    const path = root + '/acaf/decisions/direction_log.md'
    const head = '# Direction log\n\nEach direction check the user answered, newest last.\n\n'
    const old = (await $.fs.exists(path)) ? await $.fs.read(path) : head
    await $.fs.write(path, old.replace(/\n*$/, '\n') + line + '\n')
  } catch {
    // The choice still reaches the agent, which records it in the skill's own records.
  }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    if (await findAcafRoot($)) {
      await $.tool.register({ name: 'direction', description: DIRECTION_DESCRIPTION, inputSchema: DIRECTION_SCHEMA })
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!(await findAcafRoot($))) return next(e)
    const notes = [ROUTE_NOTE]
    if (isFromPerson(e) && !isLoopCommand(e.text) && (await isCorrection($, e.text))) notes.push(LESSON_NOTE)
    if (await shouldPrepare($)) notes.push(PREPARE_NOTE)
    return next({ ...e, context: [...(e.context ?? []), ...notes] })
  })

  // Long autonomous runs get no new prompts, so the prepare note can also arrive after a tool call.
  on('classic.PostToolUse', async ($, e, next) => {
    const result = (await next(e)) || {}
    if (e.agent_id || !(await shouldPrepare($))) return result
    return { ...result, additionalContext: [...(result.additionalContext ?? []), PREPARE_NOTE] }
  })

  // Any condensing starts a new stretch of conversation.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (!result || !result.skip) prepared = false
    return result
  })

  on('classic.SessionStart', async ($, e, next) => {
    const result = (await next(e)) || {}
    if (e.source !== 'compact' && e.source !== 'resume') return result
    if (!(await findAcafRoot($))) return result
    if (e.source === 'compact') prepared = false
    return { ...result, additionalContext: [...(result.additionalContext ?? []), REORIENT_NOTE] }
  })

  on('tool.call', { tool: 'mcp__acaf__direction' }, async ($, e) => {
    const options = Array.isArray(e.options) ? e.options.slice(0, 4) : []
    if (options.length < 2) {
      return { result: 'A direction check needs 2 to 4 real options, each with its cost, how sure you are, and the trade-off.' }
    }
    // One block per option, with its trade-offs on separate bullet lines, so a skimming reader
    // can compare options line by line. (`tradeoff` is the field's older name, still accepted.)
    const blocks = options.map((o, i) => {
      const mark = o.label === e.recommendation ? ' (recommended)' : ''
      const bullets = [
        o.gets ? '   • You get: ' + o.gets : '',
        o.givesUp ? '   • You give up: ' + o.givesUp : '',
        !o.gets && !o.givesUp && o.tradeoff ? '   • Trade-off: ' + o.tradeoff : '',
        o.cost ? '   • Cost: ' + o.cost : '',
        o.confidence ? '   • How sure: ' + o.confidence : '',
      ].filter(Boolean)
      return `${i + 1}. ${o.label}${mark}\n${bullets.join('\n')}`
    })
    const question = `${e.problem}\n\n${blocks.join('\n\n')}\n\nMy pick: ${e.recommendation}, because ${e.why}\n\nWhich way?`
    const labels = options.map((o) => (o.label === e.recommendation ? o.label + ' (Recommended)' : o.label))

    let answer
    try {
      answer = await $.ui.ask(question, { header: 'Direction', options: labels })
    } catch {
      return {
        result:
          'The user dismissed the direction check, so no direction is approved. Start none of the options. ' +
          'End your turn with the options and their trade-offs, short, and wait for the user.',
      }
    }

    const picked = options.find((o, i) => labels[i] === answer || o.label === answer)
    const root = await findAcafRoot($)
    if (root) {
      const date = new Date().toISOString().slice(0, 10)
      const choice = picked ? picked.label : `in their own words: "${answer}"`
      await logDirection($, root, `- ${date}: ${e.problem} Chose ${choice} (recommended: ${e.recommendation}).`)
    }
    return {
      result: picked
        ? `The user chose "${picked.label}". Go ahead with it.`
        : `The user answered in their own words: "${answer}". Follow that. If the direction is still unclear, ask one plain question.`,
    }
  })
}
