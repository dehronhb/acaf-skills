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

test('a reply that ends while no screen is attached still gets its band once the session is drawn', async ($, on) => {
  const clock = mock.clock(on)
  stubBand(on)
  on('session.surfaces', () => ({ value: [] }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('model.complete', ($, e) => {
    const text = e.system.includes('never tried')
      ? JSON.stringify({ claim: '', needsCheck: false })
      : JSON.stringify({ state: 'choose', headline: 'Ship it now or test first?', options: [{ say: '1', does: 'I ship it.' }] })
    return { value: { isAnswered: true, text, usage: USAGE } }
  })

  await finishTurn($, clock)
  const ui = await $.ui.mount(BAND('desktop'))
  await clock.advance(10)
  await ui.unmount()
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Text', text: /Your turn: Ship it now/ })).toBeDefined()
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
    if (e.system.includes('never tried')) {
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
  expect(sent[0]).toContain('NOT from the user')
  expect(sent[0]).toContain('The automatic done check asked me to')
  expect(sent[0]).toContain("Don't repeat the rest of your last reply")
  expect(sent[0]).toContain('technical product manager')
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

test('a request for something the user will see, with choices open, tells the agent to ask first', async ($, on) => {
  const seen = []
  let answer = '{"pick": [], "askFirst": true}'
  stubHabitFiles(on)
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'The DM page is live.', toolUses: [] }] }))
  on('model.complete', () => ({ value: { isAnswered: true, text: answer, usage: USAGE } }))
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'I need a way to test the survey as each player.', wait: false, origin: { kind: 'composer' } })
  expect(seen[0].context.length).toBe(1)
  expect(seen[0].context[0]).toContain('Ask first (from the next-steps mod, not the user)')
  expect(seen[0].context[0]).toContain('acaf-grill')

  answer = '{"pick": [], "askFirst": false}'
  await $.prompt.submit({ text: '1a, 2b', wait: false, origin: { kind: 'composer' } })
  expect(seen[1].context ?? []).toEqual([])
})

test("another program's claude -p call (no screen) gets no notes and no model call", async ($, on) => {
  const seen = []
  let modelCalls = 0
  stubHabitFiles(on)
  on('session.surfaces', () => ({ value: [] }))
  on('session.messages', () => ({ value: [] }))
  on('model.complete', () => {
    modelCalls++
    return { value: { isAnswered: true, text: '{"pick": [1], "askFirst": true}', usage: USAGE } }
  })
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'PARENT CLAIM: find what bears on this claim.', wait: false, origin: { kind: 'sdk' } })
  expect(seen[0].context ?? []).toEqual([])
  expect(modelCalls).toBe(0)
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
    const text = e.system.includes('never tried')
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

test('a done check and a broken habit go back together in one message', async ($, on) => {
  const clock = mock.clock(on)
  const sent: string[] = []
  stubBand(on)
  stubHabitFiles(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Make draft 3.', toolUses: [] }] }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('model.complete', ($, e) => {
    const text = e.system.includes('never tried')
      ? JSON.stringify({ claim: 'Draft 3 fixes the elbow', needsCheck: true, brokenHabit: 'Look at the result the way I will see it before handing it over.', why: 'no link and nothing opened' })
      : JSON.stringify({ state: 'nothing', headline: 'Draft 3 ready.', options: [] })
    return { value: { isAnswered: true, text, usage: USAGE } }
  })

  await finishTurn($, clock, 'Draft 3 is ready; it fixes the elbow.')
  expect(sent.length).toBe(1)
  expect(sent[0]).toContain('Done check')
  expect(sent[0]).toContain('no link and nothing opened')
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

test('instructions another model reads get the acaf-prompt pointer, once per file; CLAUDE.md never does', async ($, on) => {
  let calls = 0
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('classic.PostToolUse', () => ({}))
  on('model.complete', ($, e) => {
    calls += 1
    const text = e.system.includes('another AI model will read')
      ? '{"isPrompt": true, "what": "the story writer\'s rules"}'
      : '{"judgesMeaning": false}'
    return { value: { isAnswered: true, text, usage: USAGE } }
  })
  const rules = { file_path: '/work/app/story_rules.md', old_string: 'x', new_string: 'You write a short story about the hero. Never mention the secret. Reply with the story only.' }

  const first = await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: rules })
  expect(first.additionalContext[0]).toContain('acaf-prompt')
  expect(first.additionalContext[0]).toContain('the story writer')
  const again = await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: rules })
  expect(again.additionalContext).toBeUndefined()
  const before = calls
  await $.classic.PostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/work/CLAUDE.md', new_string: 'You are working in this repo. Never mention secrets.' } })
  expect(calls).toBe(before)
})

test('every 25 pictures since the last condensing, the agent gets the pictures reminder; a condensing resets it', async ($, on) => {
  on('classic.PostToolUse', () => ({}))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  const shot = { tool_name: 'mcp__Claude_Browser__computer', tool_input: { action: 'screenshot' }, tool_response: [{ type: 'image', source: { data: 'x' } }] }

  const notes: string[] = []
  for (let i = 0; i < 26; i++) {
    const r = await $.classic.PostToolUse(shot)
    notes.push(...((r && r.additionalContext) || []))
  }
  expect(notes.filter((n) => n.includes('Pictures check')).length).toBe(1)
  expect(notes[0]).toContain('about 25 pictures')

  await $.session.compact({ messages: [{ role: 'user', text: 'a', toolUses: [] }] })
  const after = await $.classic.PostToolUse(shot)
  expect((after && after.additionalContext) || []).toEqual([])
})

test('a huge step result gets the big-output reminder once; small results and picture data do not count', async ($, on) => {
  on('classic.PostToolUse', () => ({}))
  const small = { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'a\nb\n' } }
  const picture = { tool_name: 'Read', tool_input: { file_path: '/a.png' }, tool_response: { type: 'image', file: { base64: 'x'.repeat(200000) } } }
  const big = { tool_name: 'Bash', tool_input: { command: 'cat big.log' }, tool_response: { stdout: 'line\n'.repeat(30000) } }

  const notes = async (step) => (((await $.classic.PostToolUse(step)) || {}).additionalContext || []).filter((n: string) => n.includes('Big output check'))
  expect(await notes(small)).toEqual([])
  expect(await notes(picture)).toEqual([])
  const first = await notes(big)
  expect(first.length).toBe(1)
  expect(first[0]).toContain('about 45,000 tokens')
  expect(await notes(big)).toEqual([])
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

// Steps every 5 minutes for the given minutes; returns the notes they got back.
async function work($, clock, minutes: number) {
  const notes: string[] = []
  for (let m = 0; m < minutes; m += 5) {
    await clock.advance(5 * 60 * 1000)
    const r = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'run the gate', description: 'Run the pool gate' } })
    notes.push(...((r && r.additionalContext) || []))
    await clock.advance(0)
  }
  return notes
}

function stubJudge(on, verdicts: string[], seen: { calls: any[] }) {
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'Gate run 4: 60 of 62 green.', toolUses: [] }] }))
  on('model.complete', ($, e) => {
    seen.calls.push(e)
    const verdict = verdicts[Math.min(seen.calls.length - 1, verdicts.length - 1)]
    return { value: { isAnswered: true, text: JSON.stringify({ seen: 'the east-ramp pause again', verdict, why: 'the same east-ramp pause for 4 hours' }), usage: USAGE } }
  })
}

test('after two hours of work an outside judge looks; circling sends the agent the stop-and-offer-options note', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('classic.PostToolUse', () => ({}))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const seen = { calls: [] as any[] }
  stubJudge(on, ['circling'], seen)

  await $.prompt.submit({ text: 'Get the swim fix ready for me to test.', wait: false, origin: { kind: 'composer' } })
  const first = await work($, clock, 115)
  expect(seen.calls.length).toBe(0)
  const notes = [...first, ...(await work($, clock, 15))].filter((n) => n.includes('Struggle check'))
  expect(seen.calls.length).toBe(1)
  expect(seen.calls[0].model).toBe('sonnet')
  expect(seen.calls[0].prompt).toContain('user: Get the swim fix ready for me to test.')
  expect(seen.calls[0].prompt).toContain('Bash: Run the pool gate')
  expect(seen.calls[0].prompt).toContain('Gate run 4: 60 of 62 green.')
  expect(notes.length).toBe(1)
  expect(notes[0]).toContain('the same east-ramp pause for 4 hours')
  expect(notes[0]).toContain('a helper agent spikes the other approaches')
  expect(notes[0]).not.toContain('mistaken')
})

test('progress says nothing to the agent; idle hours do not count as work; a user message does not reset the clock', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('classic.PostToolUse', () => ({}))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const seen = { calls: [] as any[] }
  stubJudge(on, ['progress'], seen)

  await work($, clock, 60)
  await clock.advance(6 * 60 * 60 * 1000) // the agent sat idle
  await work($, clock, 30)
  expect(seen.calls.length).toBe(0)
  await $.prompt.submit({ text: 'He still swims sideways.', wait: false, origin: { kind: 'composer' } })
  const notes = await work($, clock, 40)
  expect(seen.calls.length).toBe(1)
  expect(seen.calls[0].prompt).toContain('user: He still swims sideways.')
  expect(notes.filter((n) => n.includes('Struggle check'))).toEqual([])
})

test('two unsure verdicts in a row count as circling, and the second look comes sooner', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('classic.PostToolUse', () => ({}))
  const seen = { calls: [] as any[] }
  stubJudge(on, ['unsure', 'unsure'], seen)

  const notes = (await work($, clock, 195)).filter((n) => n.includes('Struggle check'))
  expect(seen.calls.length).toBe(2)
  expect(seen.calls[1].prompt).toContain(': unsure. the east-ramp pause again')
  expect(notes.length).toBe(1)
})

test('after a condensing, an agent two hours or more past the user is told how long it has worked', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('classic.PostToolUse', () => ({}))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  const step = { tool_name: 'Bash', tool_input: { command: 'ls' } }
  const timeNotes = async () => (((await $.classic.PostToolUse(step)) || {}).additionalContext || []).filter((n: string) => n.includes('Time check'))

  await $.prompt.submit({ text: 'Fix the swim.', wait: false, origin: { kind: 'composer' } })
  await clock.advance(90 * 60 * 1000)
  await $.session.compact({ messages: [{ role: 'assistant', text: 'Working on the swim.', toolUses: [] }] })
  expect(await timeNotes()).toEqual([])
  await clock.advance(3 * 60 * 60 * 1000)
  await $.session.compact({ messages: [{ role: 'assistant', text: 'Still on the swim.', toolUses: [] }] })
  const notes = await timeNotes()
  expect(notes.length).toBe(1)
  expect(notes[0]).toContain('about 4.5 hours')
  expect(notes[0]).toContain('condensed 2 times')
  expect(await timeNotes()).toEqual([])
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

test('the next-step box is turned off: every call is refused with a pointer to the chat', async ($, on) => {
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('tool.call', () => ({ result: [{ type: 'text', text: 'Shown in the next-step box.' }] }))

  const out = await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Click Create new policy.' })
  expect(out.deny).toContain('turned off by the user')
  expect(out.deny).toContain('Write your whole reply in the chat')
})

test("the next-step box's description says it is turned off", async ($, on) => {
  on('tool.describe', ($, e) => ({ description: e.description }))
  const out = await $.tool.describe({ tool: 'mcp__ccd_turn__wrap_up', description: 'Show a next-step box.', provider: { plugin: 'engine', tier: 'core' } })
  expect(out.description).toContain("Turned off by the user. Don't call this tool.")
})

test('the reply check sees actions from earlier turns, marked as such', async ($, on) => {
  const clock = mock.clock(on)
  const prompts: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.write', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [
    { role: 'user', text: 'Fix the back button.', toolUses: [] },
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'a', tool: 'Bash', input: { command: 'flutter build windows' } }] },
    { role: 'user', text: 'Looks good to me.', toolUses: [] },
    { role: 'assistant', text: 'The back button now works.', toolUses: [] },
  ] }))
  on('model.complete', ($, e) => {
    if (e.system.includes('never tried')) prompts.push(e.prompt)
    return { value: { isAnswered: true, text: JSON.stringify({ claim: 'the back button works', needsCheck: false, state: 'nothing', headline: 'Done.', options: [] }), usage: USAGE } }
  })

  await finishTurn($, clock, 'The back button now works.')
  expect(prompts[0]).toContain('(earlier turn) Bash: flutter build windows')
})
