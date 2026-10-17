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
  await clock.settle()
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

test('pressing an option puts its words in the prompt box', async ($, on) => {
  const clock = mock.clock(on)
  const filled: string[] = []
  stubBand(on)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
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
