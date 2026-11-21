// Tests for the memory keeper (hooks/memory.js), driven through the mod the way a real message reaches it.
import { expect, mock, test } from 'claude-code/testing'

const USAGE = { input_tokens: 10, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// An in-memory file system, keyed by path with forward slashes and no drive letter (the harness hands paths over as
// absolute Windows paths, "/home/x" arriving as "C:\home\x").
function memoryFs(on, files: Record<string, string>) {
  const key = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  const store = new Map(Object.entries(files).map(([k, v]) => [key(k), v]))
  on('fs.exists', ($, e) => ({ value: store.has(key(e.path)) }))
  on('fs.read', ($, e) => ({ value: store.get(key(e.path)) ?? '' }))
  on('fs.write', ($, e) => {
    store.set(key(e.path), e.text)
    return { value: undefined }
  })
  return store
}

const MEM = '/home/.claude/projects/C--dev-work-app/memory'
const LOG = '/home/.claude/memory-keeper/saved.jsonl'
const KEEPER_CONFIG = {
  '/home/.claude/memory-keeper.json': JSON.stringify({ projects: ['C:\\dev\\work\\app'], userName: 'Sam', pronouns: 'he/him' }),
}
const INDEX =
  '# Memory Index\n\n## Now\n- [Deploys](deploys.md) — which deploy job a change needs\n\n' +
  '## How to work (HARD rules)\n- [Ask first](ask-first.md) — ask before building screens\n'

function keeperModel(on, answers: { spot?: object; write?: object; recall?: object }, calls: string[] = []) {
  on('model.complete', ($, e) => {
    const job = e.system.includes('You write entries')
      ? 'write'
      : e.system.includes('point the agent to the saved notes')
        ? 'recall'
        : e.system.includes('worth saving to')
          ? 'spot'
          : 'habit'
    calls.push(job)
    const json = job === 'habit' ? { pick: [], askFirst: false } : (answers[job] ?? (job === 'recall' ? { files: [] } : { save: false }))
    return { value: { isAnswered: true, text: JSON.stringify(json), usage: USAGE } }
  })
  return calls
}

const NEW_ENTRY = {
  quote: 'we never send push notifications after 9pm',
  fact: 'The app sends no push notifications after 9pm local time.',
  means: 'A reminder due at 9:30pm waits until the morning.',
  notMeans: 'It does not stop in-app messages.',
  notSettled: '',
  why: '',
  apply: 'When scheduling any push notification, check the local time first.',
  type: 'project',
  action: 'new',
  file: 'no-push-after-9pm.md',
  section: '## How to work (HARD rules)',
  title: 'No late pushes',
  hook: 'no push notifications after 9pm local time',
  description: 'No push notifications after 9pm local time',
}

const send = ($, text) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

test('the memory keeper saves a lasting fact with the exact words, and the agent is told to say so', async ($, on) => {
  const seen = []
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-a' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\work\\app\\.claude\\worktrees\\calm-owl' }))
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'Should reminders go out at any hour?' }] }))
  const store = memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX, [MEM + '/deploys.md']: 'deploy notes' })
  keeperModel(on, {
    spot: { kind: 'standing product rule', save: true, items: [{ gist: 'no pushes after 9pm', updates: '' }] },
    write: { save: true, reason: 'standing rule', entries: [NEW_ENTRY] },
  })
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await send($, 'No, we never send push notifications after 9pm. Carry on.')
  // The writer runs in the background; its note reaches the agent once, with this message if it is already done (as
  // with these instant stub models), else at the next tool step or message.
  await send($, 'Thanks.')
  const note = store.get(MEM + '/no-push-after-9pm.md') || ''
  expect(note).toContain('name: no-push-after-9pm')
  expect(note).toContain("Sam's words (")
  expect(note).toContain('"we never send push notifications after 9pm"')
  expect(note).toContain('**What it does not mean:** It does not stop in-app messages.')
  expect(note).toContain('**Why:** not stated.')
  const index = store.get(MEM + '/MEMORY.md') || ''
  // The new line sits at the end of its own section, not at the bottom of the file.
  expect(index).toContain(
    '- [Ask first](ask-first.md) — ask before building screens\n- [No late pushes](no-push-after-9pm.md) — no push notifications after 9pm local time',
  )
  const context = seen.map((s) => (s.context || []).join('\n')).join('\n')
  expect(context.split('Saved to memory:').length - 1).toBe(1)
  expect(context).toContain('No push notifications after 9pm local time')
  expect(store.get(LOG) || '').toContain('no-push-after-9pm.md')
  expect([...store.keys()].some((k) => k.includes('/memory-keeper/backups/'))).toBe(true)
})

test('a quote the writer did not copy exactly is replaced by the whole message', async ($, on) => {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-q' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\work\\app' }))
  on('session.messages', () => ({ value: [] }))
  const store = memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX })
  keeperModel(on, {
    spot: { kind: 'rule', save: true, items: [{ gist: 'late pushes', updates: '' }] },
    write: { save: true, entries: [{ ...NEW_ENTRY, quote: 'We will never send pushes late at night' }] },
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await send($, 'no pushes after 9pm please, ever')
  await send($, 'ok')
  const note = store.get(MEM + '/no-push-after-9pm.md') || ''
  expect(note).toContain('"no pushes after 9pm please, ever" (the whole message')
  expect(note).not.toContain('late at night')
})

test('an update goes at the top of the existing note, keeps the old text, and refreshes the index line', async ($, on) => {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-u' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\work\\app' }))
  on('session.messages', () => ({ value: [] }))
  const old = '---\nname: deploys\ndescription: "Two deploy jobs"\nmetadata:\n  type: project\n---\n\nThere are two deploy jobs.\n'
  const store = memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX, [MEM + '/deploys.md']: old })
  keeperModel(on, {
    spot: { kind: 'correction', save: true, items: [{ gist: 'three deploy jobs now', updates: 'deploys.md' }] },
    write: {
      save: true,
      entries: [{
        ...NEW_ENTRY,
        action: 'update',
        file: 'deploys.md',
        quote: 'there are three deploy jobs now',
        fact: 'There are three deploy jobs.',
        hook: 'three deploy jobs and which a change needs',
        description: 'Three deploy jobs',
      }],
    },
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await send($, 'fyi there are three deploy jobs now')
  await send($, 'ok')
  const note = store.get(MEM + '/deploys.md') || ''
  expect(note).toContain('description: "Three deploy jobs"')
  expect(note.indexOf('**Latest,')).toBeGreaterThan(0)
  expect(note.indexOf('**Latest,')).toBeLessThan(note.indexOf('There are two deploy jobs.'))
  expect(store.get(MEM + '/MEMORY.md') || '').toContain('- [Deploys](deploys.md) — three deploy jobs and which a change needs')
})

test('recall brings a needed note back once per chat, and other chats hear what was saved', async ($, on) => {
  const seen = []
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-b' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\work\\app' }))
  on('session.messages', () => ({ value: [] }))
  const store = memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX, [MEM + '/deploys.md']: '---\nname: deploys\ndescription: "Run the web job for page changes."\n---\n\nDetails.\n' })
  keeperModel(on, { recall: { files: ['deploys.md', 'not-in-index.md'], why: 'deploy question' } })
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await send($, 'Which deploy does the banner change need?')
  const first = (seen[0].context || []).join('\n')
  expect(first).toContain('Run the web job for page changes.')
  expect(first).not.toContain('not-in-index')
  await send($, 'And the footer?')
  expect((seen[1].context || []).join('\n')).not.toContain('Run the web job')

  // Another chat in the same project saved something; this chat hears it on its next message.
  const later = new Date(Date.now() + 60000).toISOString()
  store.set(LOG, (store.get(LOG) || '') + JSON.stringify({ at: later, dir: MEM, session: 'chat-z', file: 'x.md', description: 'Pat owns the store account' }) + '\n')
  await send($, 'ok')
  expect((seen[2].context || []).join('\n')).toContain('Pat owns the store account')
})

test('the memory keeper does nothing in a project its config does not name', async ($, on) => {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-c' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\other\\thing' }))
  on('session.messages', () => ({ value: [] }))
  const store = memoryFs(on, { ...KEEPER_CONFIG, '/home/.claude/projects/C--dev-other-thing/memory/MEMORY.md': INDEX })
  const calls = keeperModel(on, { spot: { save: true, items: [] } })
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await send($, 'We never ship on Fridays.')
  expect(calls.filter((c) => c !== 'habit')).toEqual([])
  expect(store.has(LOG)).toBe(false)
})

test('a background save that finishes mid-turn reaches the agent at its next tool step, once', async ($, on) => {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-t' }))
  on('session.cwd', () => ({ value: 'C:\\dev\\work\\app' }))
  on('session.messages', () => ({ value: [] }))
  on('classic.PostToolUse', () => ({}))
  memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX })
  // A writer that answers only when released, like a real one that is still working when the turn starts.
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  on('model.complete', async ($, e) => {
    const job = e.system.includes('You write entries') ? 'write' : e.system.includes('worth saving') ? 'spot' : 'other'
    if (job === 'write') await held
    const json = job === 'write' ? { save: true, entries: [NEW_ENTRY] }
      : job === 'spot' ? { kind: 'rule', save: true, items: [{ gist: 'late pushes', updates: '' }] }
      : { files: [], pick: [], askFirst: false }
    return { value: { isAnswered: true, text: JSON.stringify(json), usage: USAGE } }
  })
  const seen = []
  on('prompt.submit', ($, e) => {
    seen.push(e)
    return { text: e.text }
  })

  await send($, 'No, we never send push notifications after 9pm. Carry on.')
  expect((seen[0].context || []).join(' ')).not.toContain('Saved to memory:')
  const before = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  expect((before.additionalContext || []).join(' ')).not.toContain('Saved to memory:')
  release()
  await new Promise((r) => setTimeout(r, 200))
  const step = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  expect((step.additionalContext || []).join(' ')).toContain('Saved to memory:')
  const again = await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  expect((again.additionalContext || []).join(' ')).not.toContain('Saved to memory:')
})

test('the checker step corrects a draft before it is saved, and a failed checker keeps the draft', async ($, on) => {
  mock.env(on, { USERPROFILE: '/home' })
  on('session.id', () => ({ value: 'chat-r' }))
  on('session.cwd', () => ({ value: 'C:/dev/work/app' }))
  on('session.messages', () => ({ value: [] }))
  const store = memoryFs(on, { ...KEEPER_CONFIG, [MEM + '/MEMORY.md']: INDEX })
  let checkerWorks = true
  on('model.complete', ($, e) => {
    const job = e.system.includes('You check draft entries') ? 'check'
      : e.system.includes('You write entries') ? 'write'
      : e.system.includes('worth saving') ? 'spot' : 'other'
    const json = job === 'spot' ? { kind: 'rule', save: true, items: [{ gist: 'late pushes', updates: '' }] }
      : job === 'write' ? { save: true, entries: [{ ...NEW_ENTRY, apply: 'Never send anything at night.' }] }
      : job === 'check' ? (checkerWorks ? { entries: [{ ...NEW_ENTRY, apply: 'When scheduling a push notification, check the local time.' }], changes: ['No late pushes, 1, narrowed apply'] } : 'not json')
      : { files: [], pick: [], askFirst: false }
    return { value: { isAnswered: true, text: typeof json === 'string' ? json : JSON.stringify(json), usage: USAGE } }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await send($, 'No, we never send push notifications after 9pm.')
  await send($, 'ok')
  const note = store.get(MEM + '/no-push-after-9pm.md') || ''
  expect(note).toContain('When scheduling a push notification, check the local time.')
  expect(note).not.toContain('Never send anything at night.')

  checkerWorks = false
  store.delete(MEM + '/no-push-after-9pm.md')
  store.set(MEM + '/MEMORY.md', INDEX)
  await send($, 'Again: no push notifications after 9pm.')
  await send($, 'ok')
  expect(store.get(MEM + '/no-push-after-9pm.md') || '').toContain('Never send anything at night.')
})
