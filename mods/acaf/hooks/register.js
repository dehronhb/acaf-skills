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
  "matching acaf skill (don't follow a skill from memory). If no row fits, such as a quick question or chat, " +
  'just answer. At a fork in the road (a choice the user would notice, would pay for, or that is hard to undo; ' +
  "dropping an approach; concluding that something can't be done) follow the acaf-direction skill, which asks " +
  'the user through the direction tool when the choice is theirs.'

const LESSON_NOTE =
  'A quick model judged this message a correction of your direction. If it plainly is not one (a pick from ' +
  'your options, a new task, a question), ignore this note and do what was asked. Otherwise, before anything ' +
  'else, invoke acaf-lesson: check the work, say in one sentence what you assumed and what is actually true, ' +
  'find everywhere else that assumption shaped the work, and record the lesson. If the user found a bug, also ' +
  'work out why your own checks missed it: add a test or check to the project that would catch that kind of ' +
  'bug where one fits, and record the habit in the lessons file. Then continue on the corrected route.'

const REORIENT_NOTE =
  'This conversation was just compacted or resumed. Before continuing, re-read CLAUDE.md, run acaf-pickup, ' +
  'and take the state (what is built, what is next) from the acaf/ records. Use the summary, if there is one, ' +
  'only for what happened after the records were last updated, and write that into the records first.'

const PREPARE_NOTE =
  'This conversation is nearing 250k tokens and will be condensed soon. Within the next few actions (finish ' +
  "the current step; don't start a new slice), bring the acaf/ records up to date so nothing is lost: " +
  "change_log.md rows, the manifest's slice checkboxes, any DEV- or lesson entries, and handoff_summary.md " +
  'with where you are, what the user decided this session, and the exact next step.'

// Prompts that are never the person talking: the summary a compaction submits.
const NOT_TYPED_PREFIXES = ['This session is being continued from a previous conversation']

// The examples show where the line falls; they are not a list to match against. Judge by the rule.
const JUDGE_SYSTEM = [
  'You help an AI coding agent notice when the person it works for is steering it back.',
  "You get the agent's last message and the person's reply.",
  '',
  'CORRECTION: the reply shows the agent went, or is going, the wrong way: a wrong assumption; a misread ' +
    "request; questioning or rejecting the agent's own choice or approach; a limit or shortcut nobody asked for; " +
    'work handed back that the agent could do itself; rebuilding what already exists; calling something done or ' +
    "impossible that isn't; fixing one case when every case was wanted; or saying that something the agent built " +
    'or changed is broken or wrong, even when it is phrased as a request to fix it.',
  'NOT: picking or approving an option the agent offered (even one it did not recommend); a new task; a ' +
    'question asking for information; a requirement the agent had no way to know; a taste tweak to work that ' +
    'went as agreed; chat.',
  'If any part of the reply is a correction, answer CORRECTION.',
  '',
  'Examples of where the line falls:',
  '"the save button does nothing now, fix it" -> CORRECTION (their build is broken)',
  '"why did you add a second database? we already have one" -> CORRECTION (questions its choice)',
  '"yes go, but no paid services, I said free only" -> CORRECTION (part of it corrects)',
  '"no, go with B" when B was one of the options -> NOT (a pick)',
  '"what does the sync step do?" -> NOT (asks for information)',
  '"also add a dark mode" -> NOT (a new requirement)',
  '"it\'s asking if it should be saved. should I?" -> NOT (a question)',
  '"oh, do you mean this panel on the right?" -> NOT (checking what the agent meant)',
  '"never mind, raise it to 100" -> NOT (a change of mind)',
  '"what is taking so long? why are you struggling with that small thing?" -> CORRECTION (the approach is off)',
  '',
  'Reply with exactly one word: CORRECTION or NOT.',
].join('\n')

const DIRECTION_DESCRIPTION =
  "Show the user a direction check and wait for their choice. Use it when a move is costly (more than about $1 " +
  "they haven't approved, hard to undo, or a change they would notice in the product) and you are not sure it is " +
  "right, and always before dropping an approach or concluding that something can't be done, even when sure. " +
  "When a move is cheap or easy to undo, decide yourself and say what you did. Paying $40 for an untested " +
  "service -> use it. Choosing between two free, swappable libraries -> don't. Returns the user's choice."

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
    recommendation: { type: 'string', description: "Exactly one option's label, copied character for character." },
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
