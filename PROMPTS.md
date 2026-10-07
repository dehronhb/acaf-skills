# The Prompt Playbook

Exactly what to type, at each stage, to run a project on the ACAF skills. Prompts you can paste are in code blocks.

## Stage 0 — set up (once per project)

Create the project folder, copy in the kit (see README §Install), open it in Claude Code.

**If your machine has more than one git account** (work + personal), set the repo-local identity BEFORE the first commit — the global identity may belong to the wrong account and git will use it silently: `git init -b main && git config user.email <the right email>`. Better: record the rule in a "Machine note" section of the project's CLAUDE.md so every future session enforces it. Then:

```
/acaf-onboard
```

Answer the interview in plain words. You don't need perfect answers — the brief is editable forever. For an existing codebase, say so and let it read the code; check the functionality index it writes and correct anything it got wrong **now** (an honest index is the foundation everything else stands on).

## Stage 1 — plan a piece of work

One initiative at a time. Ask for something bounded — a feature, a fix, a refactor — not "build the whole app":

```
/acaf-plan Add user accounts: email+password signup, login, logout. Sessions persist across restarts. No password reset yet.
```

What makes a good planning prompt (each of these earned its place the hard way):

- **Describe the outcome, not the implementation.** "Users can log in and stay logged in" beats "add a JWT middleware" — let the plan propose the how, with alternatives.
- **State what's OUT of scope** ("no password reset yet") — that's what keeps the initiative bounded.
- **Ask against the current state.** Don't ask for something that already exists ("add login" when login exists) — you'll get a confusing non-run. If you want an existing thing *changed*, say what's wrong with it now.
- If the plan ends with a go/no-go question, answer it plainly; if the scope was precise it won't stop, and:

```
continue
```

### When the challenge is new — explore before you plan

If nobody knows the right approach yet (a new capability, a quality or taste problem, or an approach that keeps getting worse), ask for the option study first:

```
/acaf-explore How should we build the character reference sheet? Try every option, whatever it costs, and report quality, cost and trade-offs for each.
```

It lists every option regardless of cost, maps each option's levers, tries them all on the same benchmark, and reports back like an architect to a product manager. You pick; then `/acaf-plan` plans the winner.

## Stage 2 — build

The default move, over and over:

```
continue
```

(or explicitly `/acaf-continue`, the router). `continue` reads the current state and advances the initiative by ONE step — usually the next slice (gates, records, one commit), but when slices are done it runs the review, then the acceptance walk, and when nothing's in flight it proposes directions to pick. It always stops after one step and tells you what's next. Things you can type at any point mid-initiative:

- Park an idea without derailing: `park this: dark mode for the settings page`
- Redirect within scope: `before the next slice — use SQLite, not a JSON file, for the session store` (expect it to record the deviation or amend the plan).
- Something looks wrong: `stop — the login test you just wrote would pass even if auth were broken. Fix the test to actually exercise a bad password.`

## Stage 3 — review (recommended before closing)

```
/acaf-review
```

A fresh-context reviewer agent adversarially checks the diff against the plan and criteria. If it returns findings, the next `continue` fixes them. For a risky slice you can review immediately after it instead of waiting for the end.

## Stage 4 — accept and close

```
/acaf-accept
```

It walks every acceptance criterion against real evidence, graduates the met ones into the functional contract, updates the as-built index, and hands you a **batched human checklist** — the things only your eyes can judge. Do that checklist in one sitting and reply with results, e.g.:

```
Human checklist results: 1 pass, 2 pass, 3 FAIL — the login error message shows raw JSON to the user.
```

A failure becomes a small planned fix; then accept again.

## Stage 5 — every new session

```
/acaf-pickup
```

(or just `continue` — CLAUDE.md tells Claude to do the pickup first). You get where-things-stand and typeable options. This is the payoff of the whole method: no re-explaining, ever.

## A worked example, end to end

```
/acaf-onboard
→ (answer: "A CLI tool that turns a folder of markdown notes into a static site. For me. v1: build command, index page, per-note pages, a watch mode. Node/TypeScript.")

/acaf-plan The build command: `notes build <dir>` reads all .md files and writes an HTML site to ./dist with an index page linking every note.
continue        ← builds slice 1 (the file scanner + tests)
continue        ← builds slice 2 (the HTML renderer + tests)
park this: syntax highlighting in code blocks
continue        ← builds slice 3 (the index page + wiring + tests)
/acaf-review    ← independent review; one finding; then:
continue        ← fixes the finding, commits
/acaf-accept    ← criteria walk, contract graduation, human checklist ("open dist/index.html — does it read cleanly?")
Human checklist results: pass.

-- next day, new session --
/acaf-pickup
/acaf-plan The watch mode: `notes watch <dir>` rebuilds on file change with a 300ms debounce.
continue ...
```

## If `/acaf-...` says "isn't a recognized command here"

Two causes, two fixes:

1. **The wrappers aren't installed.** The typed `/` picker (especially in the desktop app) reads `.claude/commands/`, not `.claude/skills/` — install the kit's `commands/` folder (README §Install step 3).
2. **The session predates the files.** Commands and skills are discovered at session start — start a NEW conversation after copying them in.

And the no-setup fallback that always works: don't type the slash — say it in plain language and name the skill: `Use the acaf-onboard skill: <your instructions>`. The model invokes skills directly; only the typed `/` shortcut needs the wrapper.

## The universal suffix (and why you rarely need it)

The project's CLAUDE.md carries a **routing table** (intent → skill), so plain messages route themselves: "where were we" runs the pickup, a new feature ask runs the plan, "continue" builds a slice. You do not need to name skills.

When you want to force it anyway — a long message, or Claude seems to have drifted off-method — append this to any message:

```
 — follow the ACAF method: route this through the right acaf skill per CLAUDE.md, and if it's new non-trivial work, plan before building.
```

That one suffix covers every case, because the routing decision itself lives in CLAUDE.md — the suffix just points back at it. If you find yourself needing it often, that's a signal to tighten the routing table instead.

## Prompts for when things go sideways

- **It claimed done but you doubt it:** `Show me the evidence: which files changed in that slice, and paste the test output.` (The records make this answerable; the no-silent-success rule makes it enforceable.)
- **It's building the wrong thing:** `Stop. Re-read acaf/decisions/<slug>.md — the plan says X, you're doing Y. Either follow the plan or record a DEV entry saying why the plan changed.`
- **A diagnosis smells wrong (a test "fails", a library is "broken"):** `Before you conclude that, verify the instrument: is the requirement real, and does your reproduction actually show it? Check the test/fixture first, then the layer in isolation.` (Two major misdiagnoses in the original project were the test's fault, not the code's.)
- **The records drifted from reality:** `Run /acaf-pickup and reconcile: the change log doesn't mention the last two commits. Fix the records before any new work.`
- **It keeps polishing an approach that isn't working:** `Stop. This is getting worse, not better. Run /acaf-explore: list every option regardless of cost, their levers, try them all, and report back with costs.`
- **You want to change a recorded promise:** `The contract says divide-by-zero returns Infinity; I now want it to throw. Update the criterion (record why), then plan the change.` — change the promise first, then the code, never the reverse silently.

## Hardening (optional but recommended)

Skills are instructions; hooks are enforcement. Once your project has real gate commands, add a hook so no commit can skip them — in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(git commit*)",
        "hooks": [{ "type": "command", "command": "npm test" }]
      }
    ]
  }
}
```

(Adjust the command to your project's gates — the same ones the contract's `<!-- verification -->` marker names. A failing hook blocks the commit, which is exactly the original system's pre-commit behavior.)

## The habits that make it work

1. **Small asks, finished fully.** One bounded initiative at a time; the backlog absorbs everything else.
2. **`continue` is your main key.** The skills carry the state; you steer at decision points.
3. **Read what it writes.** Skim the plan before the build and the criteria walk at accept — those two glances are where you catch drift cheapest.
4. **Never accept "done" without evidence.** The method's whole point is that "done" is checkable — so check it, in the records and the diff, until trust is earned.
5. **Correct the records, don't argue with them.** If a brief/criterion/principle is wrong, change the file (with a note why). The files are the project.
