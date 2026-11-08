// The ACAF mod. Skills teach the thinking; this mod makes sure the key moments
// happen, in projects that have an acaf/ folder:
//   1. Each message gets a routing reminder, and a cheap model checks whether the
//      user is correcting course. If so, the agent runs acaf-lesson first.
//   2. After a compaction or a resume, the agent re-orients from the records.
//   3. A `direction` tool shows the user an options card before an unsure,
//      costly move, and logs the choice.
//   4. At about 340k tokens the agent is told to save its place in the records.
//      The condensing itself is Claude Code's own: each ACAF project sets
//      `autoCompactWindow: 400000` in .claude/settings.local.json, so it condenses at about 368k.
//      (250000 left only about 80k of room after each restart, and agents condensed every 20 to 30
//      minutes; raised on the user's go-ahead, 2026-11-07.) (A mod can't
//      condense in the Desktop app: $.session.compact is refused in SDK sessions.)

const PREPARE_AT = 340000

// Whether the agent has had the prepare note since the last condensing. Reset on reload.
let prepared = false

// The lessons audit trigger. A lessons file that only grows stops being read (one project's reached 51,000
// words), so past this size the agent is told, once per session, to run acaf-lessons-audit at its next natural
// break. A word count is exact, so code makes this call. The archive (lessons_archive.md) doesn't count.
const LESSONS_AUDIT_WORDS = 6000
let auditNoted = false

// The note, or '' when the lessons file is under the size or can't be read.
async function lessonsAuditNote($, root) {
  try {
    const files = await $.fs.list(root + '/acaf')
    const names = files
      .filter((f) => f.kind === 'file' && /^lessons.*\.md$/i.test(f.name) && !/archive/i.test(f.name))
      .map((f) => f.name)
    let biggest = { name: '', words: 0 }
    for (const name of names) {
      const text = String(await $.fs.read(root + '/acaf/' + name))
      // Another session has claimed the audit (acaf-lessons-audit Step 0): don't start a second one.
      if (/<!--\s*Lessons audit in progress/i.test(text.slice(0, 2000))) return ''
      const words = text.split(/\s+/).filter(Boolean).length
      if (words > biggest.words) biggest = { name, words }
    }
    if (biggest.words <= LESSONS_AUDIT_WORDS) return ''
    return (
      'Lessons audit due (from the ACAF mod, not the user): acaf/' + biggest.name + ' is about ' +
      Math.round(biggest.words / 1000) + ',000 words, past the ~6,000 an agent can read before acting. Mention it ' +
      'to the user in one line, and run the acaf-lessons-audit skill at the next natural break (when the current ' +
      'task is done, before new work). Don\'t stop the current task for it. If an audit is already under way, ignore this.'
    )
  } catch {
    return ''
  }
}

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
  'This conversation is nearing 400k tokens and will be condensed soon. Within the next few actions (finish ' +
  "the current step; don't start a new slice), bring the acaf/ records up to date so nothing is lost: " +
  "change_log.md rows, the manifest's slice checkboxes, any DEV- or lesson entries, and handoff_summary.md " +
  'with where you are, what the user decided this session, and the exact next step.'

// Prompts that are never the person talking: the summary a compaction submits.
const NOT_TYPED_PREFIXES = ['This session is being continued from a previous conversation']

// The examples show where the line falls; they are not a list to match against. Judge by the rule.
// Tightened 2026-10-22 at the user's request: the earlier one-word judge flagged about 45% of the user's D&D
// messages, most of them new requests, picks, changes of mind and questions. The line is the user's own: a
// correction shows a mistake the agent should have caught without being told (a bug, a fault it would see by
// looking, a misread, a shortcut, its route questioned). Measured on 36 real labeled messages: the old judge on
// Haiku 23/36; this one on Sonnet about 32/36. Naming the kind before the verdict is what made it steady.
const JUDGE_SYSTEM = [
  'You help an AI coding agent notice when the person it works for is steering it back, so it can learn from',
  "its own mistakes. You get the agent's last message and the person's reply. You are not the agent: never answer",
  'the reply, only judge it.',
  '',
  'The test: does the reply show the agent got something wrong that it should have got right without being told?',
  '',
  'CORRECTION, when the reply shows any of these:',
  '- something the agent built or changed is broken, does nothing, looks wrong, or slipped back ("the button does',
  '  nothing", "the page loads blank at first", "the fix still looks off");',
  '- a plain fault the agent should have seen by looking at its own work: wrong size or shape, text that makes no',
  '  sense, a wrong fact, a missing rule the request implied;',
  '- the agent misread what was asked, or assumed something untrue;',
  '- a shortcut nobody asked for: a limit or smaller version, work handed back that the agent could do itself,',
  '  rebuilding what already exists, calling something done or impossible that is not, fixing one case when',
  '  every case was wanted;',
  "- the person questions or rejects the agent's route or claim (\"why can't you…\", \"there must be a way…\", \"we",
  '  already have…", "why did you…", "why is this taking so long?");',
  "- the person could not follow the agent's explanation or steps and is frustrated by it.",
  '',
  'NOT, when the reply moves the work forward without showing a mistake:',
  '- a pick, approval, go-ahead or "lock it in", including choosing several offered options ("do both");',
  '- a new idea or requirement, even worded as "should", "need", "let them" or "I just realized";',
  '- a change of mind about something the person set earlier ("never mind, make it 50", "drop the limits");',
  '- a question asking for information, for a simpler explanation, or whether to click something;',
  '- checking what the agent meant ("this panel?"), or asking it to do a task ("open that link");',
  '- a taste tweak to work that matched the request.',
  'If any part of the reply is a correction, answer CORRECTION. When unsure, NOT.',
  '',
  'Examples of where the line falls:',
  '"the export button stopped working after your change" -> CORRECTION (broken)',
  '"the photos are tiny and cropped sideways, why?" -> CORRECTION (a fault it should have seen)',
  '"why are you paying for that API when my plan covers it?" -> CORRECTION (questions its route)',
  '"I followed your steps and I still don\'t know where to click!" -> CORRECTION (its steps failed)',
  '"go with the second one, and also do the cleanup" -> NOT (picks)',
  '"players should also be able to rename their character" -> NOT (a new requirement)',
  '"forget the cap, let them make as many as they like" -> NOT (a change of mind)',
  '"is that cost only for the search part?" -> NOT (asks for information)',
  '',
  'First name the one kind from the lists above that fits the reply best, in a few words, then the verdict.',
  'Reply with one line only, in this form: KIND: <a few words> | CORRECTION  or  KIND: <a few words> | NOT',
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
      model: 'sonnet',
      effort: 'low',
      system: JUDGE_SYSTEM,
      prompt: "The agent's last message:\n" + clip(last.text, 2000) + "\n\nThe person's reply:\n" + clip(text, 3000),
      maxTokens: 60,
      timeoutMs: 15000,
    })
    const answer = typeof reply === 'string' ? reply : reply && reply.isAnswered ? reply.text : ''
    const verdict = answer.match(/\|\s*(CORRECTION|NOT)\b/i)
    const isIt = verdict ? verdict[1].toUpperCase() === 'CORRECTION' : answer.trim().toUpperCase().startsWith('CORRECTION')
    const kind = (answer.match(/KIND:\s*([^|\n]{1,80})/i) || [])[1] || ''
    await debugLog($, 'judge: ' + (isIt ? 'CORRECTION' : 'not') + (kind ? ' (' + kind.trim() + ')' : '') + ': ' + text.replace(/\s+/g, ' ').slice(0, 100))
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

// True for another program's own call to Claude (`claude -p` or the Agent SDK, with no screen attached), such as
// the debate app's judging calls on the user's plan. Nobody is at that prompt, so this mod's notes and checks
// would only rewrite that program's prompts and add a model call to each one (seen 2026-10-22: habit
// reminders attached to the app's "PARENT CLAIM" prompts). The Desktop app and the terminal attach a screen,
// so a person's session is never skipped. If the screen list can't be read, the mod runs as before.
// A screen list alone is not enough: a Desktop session the user isn't looking at, or one just starting, can
// report no screen (2026-10-23). So any sign of a person (a screen at any moment, the panel being drawn, a typed
// message, an interactive start) marks the session as theirs for good; only a session that has shown none of
// these and has no screen right now counts as a program's call.
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

export function register(on) {
  // Registered whatever the screen: at the start of a Desktop session no screen is attached yet, and the tool
  // is harmless in a program's call (it only appears in ACAF projects).
  on('session.start', async ($, e, next) => {
    if (e.isInteractive) personSeen = true
    if (await findAcafRoot($)) {
      await $.tool.register({ name: 'direction', description: DIRECTION_DESCRIPTION, inputSchema: DIRECTION_SCHEMA })
    }
    return next(e)
  })

  // Something is drawing this session for a person.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    personSeen = true
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const kind = e.origin && e.origin.kind
    if (kind === 'composer' || kind === 'bridge' || (kind === 'plugin' && e.origin.asUser)) personSeen = true
    const root = (await isAppCall($)) ? null : await findAcafRoot($)
    if (!root) return next(e)
    const notes = [ROUTE_NOTE]
    if (isFromPerson(e) && !isLoopCommand(e.text) && (await isCorrection($, e.text))) notes.push(LESSON_NOTE)
    if (await shouldPrepare($)) notes.push(PREPARE_NOTE)
    if (!auditNoted && isFromPerson(e)) {
      const auditNote = await lessonsAuditNote($, root)
      auditNoted = true // checked once per session, whatever the answer
      if (auditNote) notes.push(auditNote)
    }
    return next({ ...e, context: [...(e.context ?? []), ...notes] })
  })

  // Long autonomous runs get no new prompts, so the prepare note can also arrive after a tool call.
  on('classic.PostToolUse', async ($, e, next) => {
    const result = (await next(e)) || {}
    if (e.agent_id || (await isAppCall($)) || !(await shouldPrepare($))) return result
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
    if ((await isAppCall($)) || !(await findAcafRoot($))) return result
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
