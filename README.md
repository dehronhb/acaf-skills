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
| **`/acaf-review`** | Spawns a fresh-context reviewer agent to adversarially check the slice diff against plan + criteria | After a slice (the build skill asks for it on risky slices) |
| **`/acaf-accept`** | Walks every acceptance criterion against real evidence, graduates them into the contract, updates the as-built index, writes the handoff, and hands you the batched human checklist | At the end of an initiative |
| **`/acaf-pickup`** | Reads the records and reports where things stand + the exact next step | First thing in every new session |

Plus these supporting pieces:

- **`skills/acaf-onboard/CLAUDE.md.template`** — the ambient standing rules (the `AGENTS.md` role in the IDE repo): the routing table, how to think about a problem, session-start pickup, one-initiative-at-a-time, the no-silent-success rule, the reporting format. Skills are invoked; this is always on. `/acaf-onboard` installs it into each project as `CLAUDE.md`.
- **`agents/lead-reviewer.md`** — the independent reviewer subagent definition used by `/acaf-review`.
- **`mods/acaf/`** — a Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) (v2.1.287+, or v2.1.286+ in the Desktop app) that makes the method's key moments happen in any project with an `acaf/` folder. It adds a routing note to every message. A cheap model (Haiku) reads each message you type and, when it's a course correction, tells the agent to run `acaf-lesson` first. After a compaction or a resume, it re-orients the agent from the records. It also adds a `direction` tool that shows you an options card, and logs your choice, before an unsure, costly move. Tests: `claude plugin test mods/acaf`.
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
