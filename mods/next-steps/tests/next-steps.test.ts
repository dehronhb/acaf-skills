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
