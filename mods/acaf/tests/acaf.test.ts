import { expect, mock, test } from 'claude-code/testing'

const USAGE = { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Stubs a session running in /work. With isAcaf, /work holds an acaf/ project.
function stubProject(on, isAcaf: boolean) {
  on('session.cwd', () => ({ value: '/work' }))
  on('fs.exists', ($, e) => ({ value: isAcaf && e.path.replace(/\\/g, '/').endsWith('/work/acaf/initiative_manifest.md') }))
}

function stubModel(on, answer: string, calls: string[]) {
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'I capped the summary at 6,000 words.', toolUses: [] }] }))
  on('model.complete', ($, e) => {
    calls.push(e.prompt)
    return { value: { isAnswered: true, text: answer, usage: USAGE } }
  })
}

function capturePrompt(on, seen: { context?: readonly string[] }[]) {
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })
}

test('outside an ACAF project, a prompt passes through untouched', async ($, on) => {
  const calls: string[] = []
  const seen = []
  stubProject(on, false)
  stubModel(on, 'CORRECTION', calls)
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'no, that is the wrong approach', wait: false, origin: { kind: 'composer' } })
  expect(seen[0].context).toBeUndefined()
  expect(calls.length).toBe(0)
})

test('a correction gets the routing note and the lesson note', async ($, on) => {
  const calls: string[] = []
  const seen = []
  stubProject(on, true)
  stubModel(on, 'CORRECTION', calls)
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'No length cap like that. It should be as long as the content needs.', wait: false, origin: { kind: 'composer' } })
  expect(calls.length).toBe(1)
  expect(calls[0]).toContain('6,000 words')
  expect(seen[0].context.length).toBe(2)
  expect(seen[0].context[0]).toContain('routing table')
  expect(seen[0].context[1]).toContain('acaf-lesson')
})

test('an ordinary message gets only the routing note', async ($, on) => {
  const calls: string[] = []
  const seen = []
  stubProject(on, true)
  stubModel(on, 'NOT', calls)
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'Add a dark mode toggle to settings.', wait: false, origin: { kind: 'composer' } })
  expect(calls.length).toBe(1)
  expect(seen[0].context.length).toBe(1)
})

test('a menu pick skips the model call', async ($, on) => {
  const calls: string[] = []
  const seen = []
  stubProject(on, true)
  stubModel(on, 'CORRECTION', calls)
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'Review it.', wait: false, origin: { kind: 'composer' } })
  expect(calls.length).toBe(0)
  expect(seen[0].context.length).toBe(1)
})

test('a failed model call fails open', async ($, on) => {
  const seen = []
  stubProject(on, true)
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'Done.', toolUses: [] }] }))
  on('model.complete', () => ({ deny: 'no network' }))
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'why did you do it that way?', wait: false, origin: { kind: 'composer' } })
  expect(seen[0].context.length).toBe(1)
})

test('after a compaction the agent is told to re-orient', async ($, on) => {
  stubProject(on, true)
  on('classic.SessionStart', () => ({}))

  const result = await $.classic.SessionStart({ source: 'compact' })
  expect(result.additionalContext[0]).toContain('acaf-pickup')
})

test('a fresh start gets no re-orient note', async ($, on) => {
  stubProject(on, true)
  on('classic.SessionStart', () => ({}))

  const result = await $.classic.SessionStart({ source: 'startup' })
  expect(result.additionalContext).toBeUndefined()
})

test('an ACAF session registers the direction tool', async ($, on) => {
  const names: string[] = []
  stubProject(on, true)
  on('session.start', () => ({ cwd: '/work' }))
  on('tool.register', ($, e) => {
    names.push(e.name)
    return { value: { tool: 'mcp__acaf__direction' } }
  })

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(names).toEqual(['direction'])
})

test('other sessions get no direction tool', async ($, on) => {
  const names: string[] = []
  stubProject(on, false)
  on('session.start', () => ({ cwd: '/work' }))
  on('tool.register', ($, e) => {
    names.push(e.name)
    return { value: { tool: 'mcp__acaf__direction' } }
  })

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(names).toEqual([])
})

const CHECK = {
  tool: 'mcp__acaf__direction',
  problem: 'The visual fix needs testing.',
  options: [
    { label: 'Whole videos', cost: '$8', confidence: 'sure it runs', tradeoff: 'Real conditions, but slow and costly.' },
    { label: 'One-minute clips', cost: '$0.40', confidence: 'fairly sure', tradeoff: 'Covers each case cheaply, misses long-video effects.' },
  ],
  recommendation: 'One-minute clips',
  why: 'Each case is covered for a twentieth of the cost.',
}

test('the direction check asks the user, returns the choice, and logs it', async ($, on) => {
  const questions: string[] = []
  const writes: string[] = []
  stubProject(on, true)
  on('fs.write', ($, e) => {
    writes.push(e.text)
    return { value: undefined }
  })
  on('tool.call', ($, e) => {
    questions.push(e.questions[0].question)
    return { result: { answers: { [e.questions[0].question]: 'One-minute clips (Recommended)' } } }
  })

  const out = await $.tool.call(CHECK)
  expect(questions[0]).toContain('$8')
  expect(questions[0]).toContain('Which way?')
  expect(out.result).toContain('chose "One-minute clips"')
  expect(writes[0]).toContain('Chose One-minute clips')
})

function stubTokens(on, tokens: number) {
  on('session.usage', () => ({ value: { context: { tokens, window: 1000000, percent: tokens / 10000 }, rateLimits: [] } }))
}

test('near 250k the agent is told once to save its place', async ($, on) => {
  const seen = []
  stubProject(on, true)
  stubTokens(on, 210000)
  capturePrompt(on, seen)

  await $.prompt.submit({ text: 'continue', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'continue', wait: false, origin: { kind: 'composer' } })
  expect(seen[0].context.length).toBe(2)
  expect(seen[0].context[1]).toContain('handoff_summary.md')
  expect(seen[1].context.length).toBe(1)
})

test('past 250k the conversation is condensed after the turn ends', async ($, on) => {
  const condensed: string[] = []
  const clock = mock.clock(on)
  stubProject(on, true)
  stubTokens(on, 260000)
  on('turn.complete', () => ({ text: '' }))
  on('session.compact', ($, e) => {
    condensed.push(e.instructions)
    return { messages: [{ role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }] }
  })

  await $.turn.complete({ turnId: 't1', answer: 'Done.', durationMs: 1000, isAborted: false, usage: null })
  expect(condensed.length).toBe(0)
  await clock.advance(1000)
  expect(condensed.length).toBe(1)
  expect(condensed[0]).toContain('every decision the user made')
})

test('under 250k nothing is condensed', async ($, on) => {
  const condensed: string[] = []
  const clock = mock.clock(on)
  stubProject(on, true)
  stubTokens(on, 120000)
  on('turn.complete', () => ({ text: '' }))
  on('session.compact', ($, e) => {
    condensed.push(e.instructions)
    return { messages: [{ role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }] }
  })

  await $.turn.complete({ turnId: 't1', answer: 'Done.', durationMs: 1000, isAborted: false, usage: null })
  await clock.advance(5000)
  expect(condensed.length).toBe(0)
})

test('a dismissed direction check approves nothing', async ($, on) => {
  stubProject(on, true)
  on('tool.call', () => ({ deny: 'dismissed' }))

  const out = await $.tool.call(CHECK)
  expect(out.result).toContain('no direction is approved')
})
