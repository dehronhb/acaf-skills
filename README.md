# ACAF Skills for Claude Code

A port of the **ACAF method** — the discipline behind the ACAF IDE — into a set of Claude Code skills, so you can build a new project with the same accountability, memory, and verification, without the Electron app.

## Quick start

```
# in your project, after copying the kit in (see Install)
/acaf-onboard          # interview + build the acaf/ memory from the real code
/acaf-plan <feature>   # bounded initiative: criteria, decision record, slice plan
continue               # build — one slice at a time, or all at once (plan asks which)
/acaf-review           # independent, fresh-context review of the diff
/acaf-accept           # verify criteria, graduate the contract, get the human checklist
```
New session later? `/acaf-pickup` (or just `continue`) resumes from the records — no re-explaining.

## The thesis: what ACAF actually is

The ACAF IDE is two things layered together:

1. **An app** — an Electron shell with a chat stream, a multi-provider model router, settings, a cost meter, diff viewers, a run graph.
2. **A method** — a way of making an LLM build software *accountably*: durable file-based project memory, a phased judgment loop, honest verification, and records that survive any single conversation.

The app does not port to Claude Code (and doesn't need to — Claude Code already has a chat, a model, diffs, and git). **The method ports completely.** The proof: the ACAF IDE itself was built inside Claude Code by an agent following exactly this method — the `acaf/` records folder and an `AGENTS.md` of standing rules were the whole system. These skills are that method, packaged.

## The ten pillars (what these skills preserve)

1. **Files are the memory, not the chat.** Everything the project knows lives in an `acaf/` folder: what the project is for (`intent_brief.md`), what it promises (`functional_contract.md`), what actually exists (`functionality_index.md`), what's in flight (`initiative_manifest.md`), what changed and why (`change_log.md`, `decisions/`, `deviation_log.md`), and what's parked (`follow_up_backlog.md`). A new session picks up from disk, not from a stale summary.
2. **Onboard before you build.** No feature work until the foundation files exist. On an existing codebase, the functionality index is built by *reading the real code* — never by guessing. On an empty project, the index honestly says "nothing built yet."
3. **Acceptance criteria come first, in present tense.** Before building, write what "done" looks like as testable present-tense statements ("`divide(a, 0)` throws `RangeError`"). They graduate into the functional contract only after the work is accepted — keeping *what should be* separate from *what is*.
4. **Work happens in bounded initiatives, one at a time.** A request becomes an initiative with a decision record (context, alternatives considered, principles cross-check) and a slice plan. Mid-work discoveries never silently replace the work in flight: a small, obvious fix gets done right after the slice as its own recorded change, and anything bigger is **parked** to the backlog.
5. **Every slice declares its writes and has a definition of done.** A slice names the files it will change — **source files first**, then tests, then records. After building, every declared file must exist *and have actually changed*; a step that changed nothing is a **failure**, never a quiet success. (This exact rule caught real silent no-ops in the IDE.)
6. **Verification is honest and mechanical.** Run the project's *real* gate commands (read them from `package.json`/`Makefile` — never invent them). Report failures with the actual output. Record deviations from the plan as numbered `DEV-` entries instead of hiding them. When a diagnosis turns out wrong, correct the record — don't paper over it. Every check uses the right tool: code for questions with exact answers, a cheap model under a written rule for anything about meaning.
7. **Independent review.** A fresh-context reviewer (a subagent that hasn't seen the implementation conversation) checks the diff against the plan and the criteria, adversarially. The builder grading their own homework was a failure mode the IDE explicitly engineered away.
8. **Human judgment is batched at the end.** Things only a person can judge (does it look right, does it feel right) collect into one checklist at acceptance time — the user is never interrupted mid-build for them.
9. **Explore before you commit.** A new challenge gets an option study (`/acaf-explore`) — every option regardless of cost, each option's levers turned before it is dropped, every option tried and reported with its cost and trade-offs, the way an architect reports to a product manager. The expensive failure is rarely a wrong guess; it is a low-ceiling approach polished for days while better options were dismissed in the head.
10. **Choose the route on purpose, and learn from every correction.** An audit of ~600 course corrections across 15 projects found that agents rarely fail at mechanics: they take the nearest path at a fork. That might be the one flagged bug instead of every bug like it, a cheaper version the user never asked for, their own guess about the world, or their own tests instead of the real app. At every fork, `/acaf-direction` makes the agent understand the problem in the user's terms, find what already exists, and lay out real options. Then it decides by *how sure × how costly*: cheap or certain choices are the agent's, and unsure, costly ones go to the user as a short options card. When the user steers an agent back, `/acaf-lesson` names the wrong assumption, finds everywhere else it applied, and records the thinking habit in `acaf/lessons.md` for every future session.

## The skill set

| Skill | What it does | When you use it |
|---|---|---|
| **`/acaf-onboard`** | Interviews you, then writes the full `acaf/` scaffold — including an *honest* functionality index built from the real code | Once per project, before any feature work |
| **`/acaf-plan`** | Turns a request into an initiative: decision record, upfront present-tense acceptance criteria, slice plan with definitions of done | At the start of any non-trivial piece of work |
| **`/acaf-build`** | Executes slices: declare writes → implement → gates → honest DoD check → records → one commit — **one at a time (default) or all at once**, per the initiative's build-mode (plan asks which) | Repeatedly, or once in all-at-once mode, until the slices are done |
| **`/acaf-continue`** | The router (the ported **Orchestrator** role): reads the state, advances the active initiative by one step — build / review / accept — or, if nothing's in flight, proposes sourced directions to pick | Your main key — "continue", "next", or "what now?" |
| **`/acaf-explore`** | The option study: every technical option for a new challenge regardless of cost, each option's levers, a trial of each, and an architect's report of quality, cost and trade-offs | When a challenge has no proven approach, or an approach keeps failing or getting worse |
| **`/acaf-direction`** | The direction check: understand the problem in the user's terms, find what exists, lay out options with cost and confidence, then act, test small, or ask, by how sure × how costly | At any fork: choosing a route or a tool, spending money, changing scope, dropping an approach, or about to say "I can't" |
| **`/acaf-lesson`** | Turns a course correction into a lesson: the wrong assumption, everywhere it applied, the corrected route, and an `L-<n>` thinking habit in `acaf/lessons.md` | Whenever the user steers the agent back |
| **`/acaf-lessons-audit`** | Condenses the lessons file into broad principles an agent can read before acting: merges lessons with a shared cause, asks you about conflicting ones, moves tool facts into topic notes (`acaf/notes/`), and moves the old entries word for word to `acaf/lessons_archive.md` | When the ACAF mod says the file passed about 6,000 words, at the end of an initiative if it grew, or when you ask |
| **`/acaf-prompt`** | Instructions another model will follow (a product prompt, a checker, a rules file a model reads, a subagent brief): design what the model gets and must not get, write around the known traps (secrets named to forbid them, words read two ways, added size words, copied examples), then test on the real model with hard real cases | Whenever an agent writes or changes a prompt; the next-steps mod also points agents at it after such an edit |
| **`/acaf-grill`** | Ask first: before building anything you'll see or use, the agent asks the questions only you can answer about the experience you expect, multiple-choice with its pick first; one round for a small change, round by round for a new feature | Before building or changing a screen, flow, navigation, who signs in, or how you'll test it, when your request leaves those choices open; or when you say "grill me" |
| **`/acaf-review`** | Spawns a fresh-context reviewer agent to adversarially check the slice diff against plan + criteria | After a slice (the build skill asks for it on risky slices) |
| **`/acaf-accept`** | Walks every acceptance criterion against real evidence, graduates them into the contract, updates the as-built index, writes the handoff, and hands you the batched human checklist | At the end of an initiative |
| **`/acaf-pickup`** | Reads the records and reports where things stand + the exact next step | First thing in every new session |
| **`/acaf-brief`** | A one-screen brief, for you only (agents never run it on their own): where the project stands, 2–4 real options, and what each gets you, costs, and gives up, in plain words | Whenever you want to decide quickly without reading the history |

Plus these supporting pieces:

- **`skills/acaf-onboard/CLAUDE.md.template`** — the ambient standing rules (the `AGENTS.md` role in the IDE repo): the routing table, how to think about a problem, session-start pickup, one-initiative-at-a-time, the no-silent-success rule, the reporting format. Skills are invoked; this is always on. `/acaf-onboard` installs it into each project as `CLAUDE.md`.
- **`agents/lead-reviewer.md`** — the independent reviewer subagent definition used by `/acaf-review`.
- **`mods/acaf/`** — a Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) (v2.1.287+, or v2.1.286+ in the Desktop app) that makes the method's key moments happen in any project with an `acaf/` folder. It adds a routing note to every message. A model (Sonnet, at low effort, about half a cent per message) reads each message you type and, when it shows a mistake the agent should have caught without being told (a bug, a fault it would see by looking, a misread, a shortcut, its route questioned), tells the agent to run `acaf-lesson` first. New requests, picks, changes of mind and questions are left alone. Sonnet replaced Haiku on 2026-10-22: on 36 real labeled messages it scored about 32 against the old judge's 23. After a compaction or a resume, it re-orients the agent from the records. It also adds a `direction` tool that shows you an options card, and logs your choice, before an unsure, costly move. Once per session, if the lessons file is past about 6,000 words, it tells the agent to run `acaf-lessons-audit` at the next natural break. At about 200k tokens it tells the agent to save its place in the records; the condensing itself is Claude Code's own, set per project by `"autoCompactWindow": 250000` in `.claude/settings.local.json` (`/acaf-onboard` adds it; a mod can't condense in the Desktop app). The mod keeps `mods/acaf/debug.log` of each correction judgment, for checking how well it catches corrections. Tests: `claude plugin test mods/acaf`.
- **`mods/next-steps/`**: a second mod, useful in any project, ACAF or not. After each reply, a cheap model (Haiku) writes a plain-language panel above the prompt: what you can do next and what each choice does, or "wait: a test run is still going" when background work is running. Each option's short phrase is a button that sends its words as your next message (falling back to filling the prompt box). Claude Code's own next-prompt guess (the dim text in the empty prompt box) is given to the summary model, which adds it as an option when it is a real next step not already listed. It hides while Claude works. It also runs a **done check**: Sonnet reads the reply beside the agent's steps of the last 8 hours, with what each returned, and sorts its claims. A claim a step's output contradicts (a failing test, a different number) sends the agent back to check it (once per claim, so it can't loop). A claim no step shows becomes a "Not checked" line in the panel, with no message in the chat. It stays out of turns started by a comment on an artifact page, and a send-back doesn't make the agent repeat its open questions. The mod also turns off the Desktop app's own next-step box, which agents were using in place of a real reply. The same call checks the reply against your top habits (from `~/.claude/CLAUDE.md` and the project's lessons file). When you send a message, a cheap model attaches the 1 to 3 habits that fit it, and, when you ask for something you'll see or use without settling how it should work, tells the agent to ask you first (the `acaf-grill` skill). After an edit to instructions another model reads (a rules file, a prompt in code; not CLAUDE.md, skills or records), the agent is pointed at `acaf-prompt` and told to test on the real model before saying it works, once per file. After an edit that looks like code judging meaning (word lists, patterns, thresholds), the agent is told to propose a cheap model instead, once per file. When one step drops a huge result into the conversation (over about 20,000 tokens), the agent is reminded once per stretch to send big outputs to a file and read only what it needs. Every 25 pictures since the conversation last condensed, the agent is reminded to keep pictures out of its main conversation (contact sheets, smaller screenshots, helper agents for frame-by-frame reviews), framed as keeping its memory clear, not as cost. After 30 minutes without hearing from you, the agent is asked to gut-check proportion and, if one multiple-choice question about real use could shrink the work, ask it. After every 2 hours of work (idle time doesn't count, and your messages don't reset it), a **struggle check** has an outside judge (Sonnet) read the last 8 hours of the work log and its own earlier verdicts and say whether the work is getting closer to what you asked for or going in circles; circling tells the agent to stop, tell you what is taking long and why, offer options (keep going, a spike, or a helper agent's spike while it keeps working), and start the helper's spike, which is cheap and easy to undo. After a condensing, an agent 2 or more hours past your last message is told how long it has worked, since its summary doesn't say. After a message goes to other people through the Slack connector or the `slack-bot` script, a **send check** warns (it never blocks, since the message has gone): the agent is told if it hasn't read that channel in the last hour, and Haiku lists stated facts that no step or message of yours backs, for the agent to check against their records and report to you. The panel shows the same warning. It can't see helper agents' sends or other routes (GitHub comments, email, a browser), and the message text is never logged. Each Haiku call costs about 0.02 to 0.08 cents (Haiku 5.5 prices, 2026-10-22); each struggle check (about 11,000 tokens in) about 2.5 cents at Sonnet 5.5 prices, so about 20 cents on a heavy day; each done check (about 17,000 tokens in at most) about 3.5 cents. Neither mod acts in a session with no screen attached, such as another program's own `claude -p` calls. Load it alongside the ACAF mod (`;`-separated in `CLAUDE_CODE_PLUGIN_DIRS`).
- **`hooks/acaf-route-reminder.ps1`** — the older, routing-only reminder, for clients that can't run mods (see Install).

## What maps to native Claude Code features (deliberately NOT ported)

| ACAF IDE feature | In Claude Code |
|---|---|
| Multi-provider routing, model presets, safety floors, the Model Steward, local models | Claude Code owns the model. Dropped. |
| The Orchestrator's **next-step routing** (read project state → decide the next move) | Ported as **`/acaf-continue`**. Only the model-routing half of the Orchestrator was dropped; this half is the point of the method and is preserved. |
| The chat stream UI, actor icons, collapse/expand, follow-the-work | Claude Code's transcript. Dropped. |
| Question cards | The native question tool — Claude asks you directly. |
| Pre-build confirm gate | Plan mode, plus `/acaf-plan` ends with an explicit go/no-go on ambiguous scope. |
| Restore points / rewind | Git. Each slice is one commit; `git revert`/`reset` is the rewind. |
| Cost meter | Claude Code's own usage display. Dropped. |
| The run loop's hard postcondition enforcement (code) | Skill *instructions* + optionally a Claude Code **hook** that runs your gates before every commit (see PROMPTS.md §Hardening). Skills are instructions, not code — a hook is how you make a gate mechanical. |
| Parallel worktree fan-out | Native worktrees/subagents; treat as advanced, not in the core skills. |

## Install

**Recommended — install once, for every project.** Keep this repo as the single source of truth and link it into your user-level Claude folder; editing the repo then updates every project immediately. On Windows (PowerShell; directory junctions need no admin rights):

```powershell
$kit = "C:\path\to\acaf-skills"   # wherever you cloned https://github.com/dehronhb/acaf-skills
Get-ChildItem "$kit\skills" -Directory | ForEach-Object { New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\$($_.Name)" -Target $_.FullName }
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\agents" | Out-Null
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\agents\acaf" -Target "$kit\agents"
```

(macOS/Linux: `ln -s` the same folders.) Then each project only needs its `CLAUDE.md`, which `/acaf-onboard` installs. Don't also copy the skills or the agent into a project: a user-level skill wins over a same-named project copy, but a project's agent copy wins over the user-level one — so stale copies quietly shadow your updates. In the `/` picker, a skill loaded this way shows `(user)` in its tooltip.

**Recommended: the ACAF mod.** Skills and `CLAUDE.md` only *suggest*; the mod makes the key moments happen (see the skill set above). Load it in every session, including the Desktop app, by pointing Claude Code at the folder in `~/.claude/settings.json`. Edits to the folder reload on save, so it stays in sync like the junctions:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\acaf-skills\\mods\\acaf" }
```

(Separate several folders with `;` on Windows, `:` elsewhere.) In a new session, `/plugin` should show `1 mod active · acaf`. The correction check costs one small Haiku call per message you type in an ACAF project, on your plan, and adds a second or two before the agent starts.

**Fallback: routing reminder hook,** for clients that can't run mods. Don't use it alongside the mod, which already adds the same note. Over a long session a model can drift into doing method work freehand. This hook adds one line to every prompt in a folder that has an `acaf/` folder (and prints nothing anywhere else), reminding the session to route through the skills. Add this under `hooks` in `~/.claude/settings.json`:

```json
"UserPromptSubmit": [
  { "hooks": [ { "type": "command", "command": "powershell",
      "args": ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:\\path\\to\\acaf-skills\\hooks\\acaf-route-reminder.ps1"],
      "timeout": 10 } ] }
]
```

**Per-project install (copies — these drift from the repo over time):**

1. Create your new project folder and open it in Claude Code (desktop or CLI).
2. Copy the contents of `skills/` into `<your-project>/.claude/skills/` (each skill keeps its own folder: `.claude/skills/acaf-onboard/SKILL.md`, …). To use them across *all* projects instead, copy into `~/.claude/skills/`.
3. Copy the contents of `commands/` into `<your-project>/.claude/commands/` — these thin wrappers make each skill a **typeable slash command** (`/acaf-onboard`, …). The desktop app's `/` picker reads `.claude/commands/`, not `.claude/skills/`, so without them a typed `/acaf-…` can come back "isn't a recognized command here."
4. Copy `agents/lead-reviewer.md` into `<your-project>/.claude/agents/`.
5. Copy `skills/acaf-onboard/CLAUDE.md.template` to `<your-project>/CLAUDE.md`, or let `/acaf-onboard` install it (it merges into an existing one).
6. Start with the prompts in **PROMPTS.md** — begin with `/acaf-onboard`. (New commands/skills are discovered at session start — after copying, start a fresh conversation.)

## Honest limits of a skills port

- **Skills are instructions, not enforcement.** The IDE *refused* an undeclared code step in code; a skill can only insist. If Claude drifts, the records make the drift visible — and the optional pre-commit hook in PROMPTS.md restores mechanical enforcement of the gates. Skill *use* is likewise a suggestion: a long session can drift into doing method work freehand, which the ACAF mod (Install) nudges against on every turn. The mod makes the important moments happen (a correction gets a lesson, an unsure and costly move gets an options card), but it can't make the thinking good: that still comes from the skills.
- **One context, not true actor isolation.** In the IDE, each actor got a scoped prompt. Here, phases share the main context; the place isolation genuinely pays — review — is preserved via the subagent.
- **Keep the records small.** The method's cost is upkeep. The skills write terse records on purpose; resist turning every log into an essay.

## License

MIT. See [LICENSE](LICENSE).
