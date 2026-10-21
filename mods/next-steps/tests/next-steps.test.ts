import { expect, mock, test } from 'claude-code/testing'

const USAGE = { input_tokens: 10, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const BAND = (surface: 'terminal' | 'desktop', isWorking = false) => ({
  plugin: 'next-steps',
  component: 'AbovePrompt',
  requestId: 'band',
  surface,
  viewport: { columns: 100, rows: 30 },
  props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 90, scroll: { offset: 0, bodyRows: 10 }, view: {} },
}) as const

function stubModel(on, json: object) {
  on('model.complete', () => ({ value: { isAnswered: true, text: JSON.stringify(json), usage: USAGE } }))
}

function stubBand(on) {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
}

async function finishTurn($, clock, answer = 'Say "1" to build it, or "2" to test first.') {
  await $.turn.complete({ turnId: 't1', answer, durationMs: 1000, isAborted: false, usage: null })
  await clock.advance(2500)
}

test('after a reply that needs a choice, the band shows the decision and each option', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  stubModel(on, {
    state: 'choose',
    headline: 'Build the climb fix now or test first?',
    options: [{ say: '1', does: 'I build the fix and show you.' }, { say: '2', does: 'I test the current version first.' }],
  })

  await finishTurn($, clock)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    expect(await ui.find({ type: 'Text', text: /Your turn: Build the climb fix/ })).toBeDefined()
    expect(await ui.find({ key: 'opt-1' })).toBeDefined()
    await ui.unmount()
  }
})

test('a running helper agent turns the band into a wait, whatever the reply said', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'tests', type: 'general-purpose', status: 'running' }] }))
  stubModel(on, { state: 'nothing', headline: 'Started the tests.', options: [] })

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Wait: a helper agent is still working/ })).toBeDefined()
})

test('while Claude is working the band shows nothing of ours', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  stubModel(on, { state: 'choose', headline: 'Pick one', options: [{ say: 'A', does: 'x' }] })

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('terminal', true))
  expect(await ui.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Your turn/ })).toBeUndefined()
})

test('a new turn clears the old summary', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('agent.list', () => ({ value: [] }))
  stubModel(on, { state: 'choose', headline: 'Pick one', options: [{ say: 'A', does: 'x' }] })

  await finishTurn($, clock)
  await $.turn.start({ turnId: 't2' })
  const ui = await $.ui.mount(BAND('terminal'))
  expect(await ui.find({ type: 'Text', text: /Your turn/ })).toBeUndefined()
})

test('an unusable model reply shows nothing rather than something wrong', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'not json at all', usage: USAGE } }))

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('terminal'))
  expect(await ui.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
})

test('pressing an option sends its words as the user', async ($, on) => {
  const clock = mock.clock(on)
  const sent: { text: string; asUser?: boolean }[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', ($, e) => {
    sent.push({ text: e.text, asUser: e.origin && e.origin.asUser })
    return { text: e.text }
  })
  stubModel(on, { state: 'choose', headline: 'Pick one', options: [{ say: 'review it', does: 'I run the reviewer.' }] })

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ key: 'opt-0' })).toBeDefined()
  await ui.press({ key: 'opt-0' })
  expect(sent).toEqual([{ text: 'review it', asUser: true }])
})

test('if sending is refused, the words go into the prompt box', async ($, on) => {
  const clock = mock.clock(on)
  const filled: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', () => {
    throw new Error('not here')
  })
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  stubModel(on, { state: 'choose', headline: 'Pick one', options: [{ say: 'review it', does: 'I run the reviewer.' }] })

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'opt-0' })
  expect(filled).toEqual(['review it'])
})

test("Claude Code's next-prompt guess is given to the summary model", async ($, on) => {
  const clock = mock.clock(on)
  const prompts: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.suggest', () => ({ isShown: true }))
  on('model.complete', ($, e) => {
    prompts.push(e.prompt)
    return { value: { isAnswered: true, text: JSON.stringify({ state: 'nothing', headline: 'Done.', options: [] }), usage: USAGE } }
  })

  await $.turn.complete({ turnId: 't1', answer: 'All done.', durationMs: 1000, isAborted: false, usage: null })
  await $.prompt.suggest({ text: "Close the prototype, I'm done testing", origin: { kind: 'suggestion' } })
  await clock.advance(2500)
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain("Close the prototype, I'm done testing")
})

test('a guess that arrives after the summary gets the summary rewritten once', async ($, on) => {
  const clock = mock.clock(on)
  const prompts: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.suggest', () => ({ isShown: true }))
  on('model.complete', ($, e) => {
    prompts.push(e.prompt)
    return { value: { isAnswered: true, text: JSON.stringify({ state: 'nothing', headline: 'Done.', options: [] }), usage: USAGE } }
  })

  await $.turn.complete({ turnId: 't1', answer: 'All done.', durationMs: 1000, isAborted: false, usage: null })
  await clock.advance(2500)
  await $.prompt.suggest({ text: 'Run the tests', origin: { kind: 'suggestion' } })
  await clock.advance(100)
  await $.prompt.suggest({ text: 'Run the tests again', origin: { kind: 'suggestion' } })
  await clock.advance(100)
  expect(prompts.length).toBe(2)
  expect(prompts[1]).toContain('Run the tests')
})

// The done check: the model stub answers the done-check call and the summary call differently.
function stubDoneCheck(on, verdict: object, calls: { done: number }) {
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Fix the login bug.', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 't', tool: 'Edit', input: { file_path: 'login.ts' } }] },
    ],
  }))
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('model.complete', ($, e) => {
    if (e.system.includes('claims it has not checked')) {
      calls.done += 1
      return { value: { isAnswered: true, text: JSON.stringify(verdict), usage: USAGE } }
    }
    return { value: { isAnswered: true, text: JSON.stringify({ state: 'nothing', headline: 'Fixed the login bug.', options: [] }), usage: USAGE } }
  })
}

test('an untested "fixed" claim sends the agent back to check, and the panel says so', async ($, on) => {
  const clock = mock.clock(on)
  const calls = { done: 0 }
  const sent: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  stubDoneCheck(on, { claim: 'the login bug is fixed', needsCheck: true }, calls)

  await finishTurn($, clock, 'Fixed the login bug.')
  expect(calls.done).toBe(1)
  expect(sent.length).toBe(1)
  expect(sent[0]).toContain('the login bug is fixed')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Checking: the agent said "the login bug is fixed"/ })).toBeDefined()
})

test('a checked claim passes and the normal panel shows', async ($, on) => {
  const clock = mock.clock(on)
  const calls = { done: 0 }
  const sent: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  stubDoneCheck(on, { claim: 'the login bug is fixed', needsCheck: false }, calls)

  await finishTurn($, clock, 'Fixed the login bug.')
  expect(calls.done).toBe(1)
  expect(sent.length).toBe(0)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Fixed the login bug/ })).toBeDefined()
})

test("the reply to a done-check prompt is not checked again, so it can't loop", async ($, on) => {
  const clock = mock.clock(on)
  const calls = { done: 0 }
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  stubDoneCheck(on, { claim: 'the login bug is fixed', needsCheck: true }, calls)

  await finishTurn($, clock, 'Fixed the login bug.')
  await $.turn.complete({ turnId: 't2', answer: 'I tried it: login works now.', durationMs: 1000, isAborted: false, usage: null })
  await clock.advance(2500)
  expect(calls.done).toBe(1)
})

test('if the check prompt cannot be sent, the panel says the claim is not checked', async ($, on) => {
  const clock = mock.clock(on)
  const calls = { done: 0 }
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('prompt.submit', () => {
    throw new Error('not here')
  })
  stubDoneCheck(on, { claim: 'the login bug is fixed', needsCheck: true }, calls)

  await finishTurn($, clock, 'Fixed the login bug.')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Not checked yet: the agent said "the login bug is fixed"/ })).toBeDefined()
})

// Habit reminders, the habit check, and the judgment-in-code catch.
const CLAUDE_MD = [
  '# Machine notes',
  '## Top habits (every project)',
  '',
  '1. Size the fix to what I flagged.',
  '2. Look at the result the way I will see it',
  '   before handing it over.',
  '## Write documentation',
].join('\n')
const LESSONS = ['# Lessons', '## Top habits', '', '1. Run every click through the real mouse.', '## Older'].join('\n')

function stubHabitFiles(on) {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.cwd', () => ({ value: '/work' }))
  on('fs.exists', ($, e) => ({ value: /CLAUDE\.md$|\/work\/acaf$/.test(e.path.split(String.fromCharCode(92)).join('/')) }))
  on('fs.list', () => ({ value: [{ name: 'change_log.md', kind: 'file' }, { name: 'lessons_learned.md', kind: 'file' }] }))
  on('fs.read', ($, e) => ({ value: e.path.endsWith('CLAUDE.md') ? CLAUDE_MD : LESSONS }))
  on('fs.write', () => ({ value: undefined }))
}

test('a message gets the habits that fit it, from both lists', async ($, on) => {
  const seen = []
  const prompts: string[] = []
  stubHabitFiles(on)
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'Build 7 is ready for you.', toolUses: [] }] }))
  on('model.complete', ($, e) => {
    prompts.push(e.prompt)
    return { value: { isAnswered: true, text: '{"pick": [2, 3]}', usage: USAGE } }
  })
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'Fix the floating lamp.', wait: false, origin: { kind: 'composer' } })
  expect(prompts[0]).toContain('2. Look at the result the way I will see it before handing it over.')
  expect(prompts[0]).toContain('3. Run every click through the real mouse.')
  expect(seen[0].context[0]).toContain('- Look at the result the way I will see it before handing it over.')
  expect(seen[0].context[0]).toContain('- Run every click through the real mouse.')
})

test('a clearly broken habit sends the agent back once', async ($, on) => {
  const clock = mock.clock(on)
  const sent: string[] = []
  stubBand(on)
  stubHabitFiles(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Fix the floor.', toolUses: [] }] }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('model.complete', ($, e) => {
    const text = e.system.includes('claims it has not checked')
      ? JSON.stringify({ claim: '', needsCheck: false, brokenHabit: 'Look at the result the way I will see it before handing it over.', why: 'handed over build 7 with no pictures' })
      : JSON.stringify({ state: 'nothing', headline: 'Build 7 ready.', options: [] })
    return { value: { isAnswered: true, text, usage: USAGE } }
  })

  await finishTurn($, clock, 'Build 7 is ready for you to walk.')
  expect(sent.length).toBe(1)
  expect(sent[0]).toContain('Habit check')
  expect(sent[0]).toContain('handed over build 7 with no pictures')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Habit check: the agent may have broken/ })).toBeDefined()
})

test('code that judges meaning with a word list gets the model option, once per file', async ($, on) => {
  let calls = 0
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('classic.PostToolUse', () => ({}))
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: true, text: '{"judgesMeaning": true, "why": "a banned-word list decides if text is rude"}', usage: USAGE } }
  })
  const input = { file_path: '/work/src/check.ts', old_string: 'x', new_string: "const BANNED = ['damn', 'heck', 'darn', 'crap']\nexport const rude = (t: string) => BANNED.some((w) => t.includes(w))" }

  const first = await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: input })
  expect(first.additionalContext[0]).toContain('cheap model')
  const again = await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: input })
  expect(again.additionalContext).toBeUndefined()
  expect(calls).toBe(1)
})

test('edits to non-code files, or code with no sign of judging, cost nothing', async ($, on) => {
  let calls = 0
  on('classic.PostToolUse', () => ({}))
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: true, text: '{"judgesMeaning": true}', usage: USAGE } }
  })

  await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/work/notes.md', new_string: "['a', 'b', 'c', 'd']" } })
  await $.classic.PostToolUse({ tool_name: 'Write', tool_input: { file_path: '/work/sum.ts', content: 'export const add = (a: number, b: number) => a + b' } })
  expect(calls).toBe(0)
})

test('after 30 minutes without the user, the agent is asked once to gut-check proportion', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('classic.PostToolUse', () => ({}))
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await $.prompt.submit({ text: 'Make the survey site safe on cost.', wait: false, origin: { kind: 'composer' } })
  const early = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
  expect(early.additionalContext).toBeUndefined()
  await clock.advance(31 * 60 * 1000)
  const late = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
  expect(late.additionalContext[0]).toContain('Gut check')
  expect(late.additionalContext[0]).toContain('multiple-choice')
  const right_after = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
  expect(right_after.additionalContext).toBeUndefined()
})

const ROW = (text: string, origin: object, isExpanded = false) => ({
  plugin: 'next-steps',
  component: 'UserMessage',
  requestId: 'm1',
  surface: 'desktop',
  viewport: { columns: 100, rows: 30 },
  props: { text, origin, isExpanded },
}) as const

test("the mod's own check messages are drawn as one short grey line", async ($, on) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  const msg = 'The next-steps plugin sent a message: Done check: your last reply says "The Back button now works.", but nothing you did...'
  const ui = await $.ui.mount(ROW(msg, { kind: 'plugin', name: 'next-steps' }))
  expect(await ui.find({ type: 'Text', text: /Done check \(automatic\): asked the agent to try "The Back button now works\."/ })).toBeDefined()
})

test("the user's own messages, and the expanded view, are left as Claude Code draws them", async ($, on) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  const mine = await $.ui.mount(ROW('Done check: is this right?', { kind: 'composer' }))
  expect(await mine.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  await mine.unmount()
  const expanded = await $.ui.mount(ROW('Done check: your last reply says "X"', { kind: 'plugin', name: 'next-steps' }, true))
  expect(await expanded.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
})
