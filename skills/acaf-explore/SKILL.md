---
name: acaf-explore
description: "The option study — when a challenge is new (no proven approach in the records) or the current approach has stopped getting better, stop building and study it the way a software architect reports to a product manager: enumerate every technical option regardless of cost, map each option's levers, TRY every option (turning its levers before calling it), and report quality, cost and trade-offs for each so the user chooses. Use when a problem has no proven approach, when an approach fails the goal twice or its results get worse, when you catch yourself adding machinery to rescue an approach, or when the user says \"what are our options / explore this / try everything\"."
---

# ACAF Explore — the option study (the architect's report)

Why this exists — a founder directive, given after a day in which every step passed its own test while the results got worse:

> *"You are thinking of certain ways you could do it that you immediately dismiss as not ideal for one reason or another (cost, user experience, etc.), and then you go with some shittier approach and you do everything you can to make the shittier approach work, but it has a ceiling for how good it can be. You need to consider all approaches, and you need to consider the levers/controls that each approach offers… If you have a new challenge to address, you need to go back to plan mode to think of the options, regardless of cost, and then try them all, and report back on cost for each one, explaining trade-offs — just like what a software architect would go do to report back to a product manager."*

The failure this prevents has three parts, and they compound:

1. **Dismissal by assumption.** An option is ruled out in the head — too expensive, too complex, worse UX — without ever being tried. The user never learns it existed.
2. **Polishing a low ceiling.** The option that survived gets rescued with more and more machinery. Each addition passes its own check; the outcome gets worse.
3. **Judging the approach by its own metric** (a count, a ratio, a green test) instead of by the outcome the user actually cares about.

## When to explore (the triggers)

- **A new challenge:** the capability has no proven approach in the records (`functionality_index.md`, `decisions/`).
- **An approach has failed the user's goal twice, or its results are getting WORSE** — even with every gate green.
- **You notice you are building a fix for a fix** to keep an approach alive.
- **The outcome is judged by quality or taste** (how something looks, reads or feels), where an approach's ceiling matters more than its cost.
- The user asks: "what are our options", "explore this", "try everything".

`acaf-plan` routes here before writing a decision record for such a problem; `acaf-build` routes here when a slice's approach is failing its purpose; `acaf-continue` routes here when the next step is one of these.

## Step 1 — frame the problem in the user's terms

- **The goal**, as the user would judge it. For anything the user will look at, how it looks to them comes first.
- **The person and their steps:** who meets this result, and what they're doing when they do. A study framed around the mechanism ("which model is cheapest") instead of the person ("a parent hears a story that sounds like their child's world") compares the wrong things.
- **What's at stake:** roughly what a good answer is worth (the cost it saves, the quality it buys). The study's budget has to be in proportion to it.
- **The rubric, written BEFORE any trial:** the qualities that decide it, in priority order, each with how it is judged — by eye against named references, measured, or both. A rubric written after seeing the results bends to them.
- **Constraints — split them honestly.** REAL constraints: safety, privacy, law, and decisions the user has already made. PREFERENCES: cost, speed, effort, integration work, UX friction. **Preferences are reported for every option; they never remove an option at this stage.**
- **The benchmark:** the hardest real case, plus one easy case. Every option is tried on the same benchmark, so the results can be compared.
- **Check the yardstick before trusting it.** Before comparing options, show that each instrument in the rubric — a measurement, a judge, your own eye — tells a known-good result from a known-bad one, and measure its noise by judging the same result twice. An instrument whose noise is as large as the differences between options cannot rank them: a blind judge that scores the same unchanged result 24/35 and then 19/35 has told you nothing about two options 5 points apart.

## Step 2 — enumerate the option space: breadth first, regardless of cost

- **Walk the families, not only the ones you already know:**
  - **what already exists**: a project, asset set, library or service that solves the whole problem, or most of it (search before assuming there is none);
  - single-pass tools / models / vendors;
  - pipelines (per-part, then assemble; multi-stage);
  - control and conditioning (give the tool a layout, a structure, a reference, a mask);
  - **editing a good result instead of regenerating it**;
  - training / fine-tuning;
  - selection (generate several, choose with a judge);
  - buy vs build (services, other vendors, other models);
  - human-made / hand-made;
  - **reframing the requirement** — is there a different artifact that serves the same goal better?
- **Research what exists NOW.** The market moves; check current offerings, limits and prices on their real pages, not from memory, and record the source of every price and limit.
- **For each option:** how it works; what it is good at; its known ceiling; its cost per unit and at scale; what it needs to be tried (a key, an account, data). An option that cannot be tried now is still listed — with exactly what would unblock it.

## Step 3 — map every option's levers (and recurse)

- **A lever is any control the option exposes:** inputs and references (which, how many, in what order, packed how), wording, parameters (guidance, seed, strength, steps, resolution), model tier, pipeline structure, selection and retries, training data and settings, post-processing.
- **For each lever, name the failure it addresses.**
- **No option is abandoned until the levers that address its failure have been turned.** When turning a lever needs its own design, that is a sub-study: recurse — Steps 1–3 on the smaller problem.

## Step 4 — design the trials, and the budget

- Every option is listed. Every viable option gets at least its cheapest real run on the smallest hard case: a real run produces an output you judge against the rubric; reading about it doesn't count. An option you can't run now gets one line on exactly what blocks it ("fine-tuning: needs 200 labelled examples we don't have"). Then lever trials, for options that ran and fell short on something a lever addresses.
- **Smallest hard test first.** Run every option on the smallest benchmark that still contains the hard part (the hardest few cases, a one-minute clip rather than a whole video, one page rather than a whole story) before anything bigger. Free trials come first: running it yourself, local tools, free tiers. Scale up only for the options that win small.
- **A cost estimate per trial, and the total. Cost never removes an option from the list,** but spending is a direction choice (`acaf-direction`, Step 4). Trials whose total stays within the spend line (the project's threshold, or about $1 the user hasn't already approved) just run. Above that, for options you aren't sure about, show the user the framing and the options with each trial's cost, and wait for their choice: they should see that you understand the problem before they pay to explore it. A study whose total is out of proportion to what's at stake is the wrong study; design a smaller one. Once the user approves a budget, run the approved set without further interruption.
- **Write the study plan to `acaf/explorations/<slug>.md` before running anything:** the framing, the rubric, every option with its levers, the trials, the budget.

## Step 5 — run every trial, and look

- Record for each: inputs, settings, cost, latency, and whether it worked at all.
- **Judge every result by the rubric, outcome first.** For anything visual: put it beside its references and compare by eye before measuring anything. A trial that passes its own metric and fails the user's eye has failed.
- **When a result disappoints:** name the failure, turn the lever that addresses it, try again (within the budget) — and only then call the option. Log which levers were turned and which remain.
- **Credit a result to the whole option, not to one lever.** A result belongs to the whole combination — method, inputs, wording, model, settings — unless the trial varied ONLY that one lever. "Model X is bad at this" is a claim the run never isolated if the method and the wording were held fixed; to conclude about one lever, vary only that lever.
- Don't show the user an internal artifact as if it were a deliverable.

## Step 6 — report like an architect to a product manager

- **One table:** option · what was tried (which levers) · the result (shown) · verdict against the rubric · cost per unit and at scale · latency · reliability · its ceiling · what it would take to go further.
- **Show the results side by side, with the references.**
- **A recommendation in plain words, with the trade-off it makes — and the runner-up.** Exhaustive in the exploration, curated in the recommendation.
- **The user chooses.** The choice goes to `acaf-plan`, where the decision record's "alternatives considered" IS this study.

## Step 7 — record

- `acaf/explorations/<slug>.md` — the plan, then the results (the report). Kept, never rewritten; a later study cites it.
- A `change_log.md` row; a `DEV-<n>` for any re-plan it causes; the spend in the project's ledger if it keeps one.

## What this skill will not do

- Decide for the user between options with different trade-offs — it presents them, with a recommendation.
- Skip an option because it "probably won't work" — it tries it, or says exactly what blocks the trial.
- Build production code for every option — trials are spikes. The chosen option is built properly through `acaf-plan` and `acaf-build`.
- Become the way the product gets built. A study answers a question about which route to take. When there is no open question, or a run of "trials" is really the product taking shape, stop and plan it.
