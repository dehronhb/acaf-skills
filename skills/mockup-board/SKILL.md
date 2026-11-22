---
name: mockup-board
description: How to show the user a mockup - one zoomable board in a private artifact, like a Miro board, with a working prototype inside each section and switches to turn each option on and off. Use whenever you are about to show the user a mockup, a design option, a choice between looks or flows, or "show me both", for any screen, page, pop-up, panel or flow, in any project. The ask-first skills (acaf-grill, ask-first) decide WHEN a mockup is needed; this skill says what it must be. Not for finished pictures, films or store art (those follow ask-first's visual order), and not for a small change to a screen the user has already seen.
---

# Mockup board: how the user wants to see mockups

**Why this exists.** The user judges a design by using it, not by looking at it. In their words (2026-11-21), after
seeing the first board like this:

> "I kind of wish that it worked a little bit like Miro. And it'd be cool if it, like in Miro, it could zoom in and
> out by holding the control button on my computer and using the mouse wheel. And then also, I think there should
> be switches so that I could turn things on and off and interact with it like it's also a prototype. [...] have
> different sections of the board set up to show the different features and functionality. So almost like if you
> could prototype things in the Figma design view without having to go to the prototype view."

They called the result "the new way that I want to see mockups done". An earlier failure shows why: a mockup built
as pictures, with each state picked by typing a page address, was checked through 16 screenshots and a reviewer.
The user then tried Ctrl+wheel and clicking, nothing responded, and they could not judge the questions it asked.

**What this is not.** It is not a page of screenshots, a long scrolling page of options, or one state per page
address. Do not use the Claude "Design" artifact type: the user has said they dislike much of it. And it does not
decide whether a mockup is needed (the ask-first skills do) or what the options are (the user's answers and your
study do).

**Every project uses this skill for new mockups, including projects that showed designs another way before.** The
user (2026-11-21): "I want all of my projects to use the new skill." What that does and does not change:
- *A board or mockup page the user already has stays as it is.* Don't rebuild it in this style; answers and
  comments on it still count. In the user's words about one such board: "it doesn't need to redo the current design
  board. It can just do it going forward."
- *New mockup work is built this way*, even when the project's older mockups weren't: "if it's going to do a bunch
  more work that is similar to this, then it should ... use the new skill."
- *The project's own rules about which board and when still apply.* For example, a rule of one design board per
  release, or "the board holds only taste choices", stays; this skill changes how the board is built, not those
  rules. If the old way gave the user something they used (a place to leave comments, a "Settled" area for
  decided choices), the new board keeps it.

If a board like this one already exists in the project's files (search for `*board*.html`), reuse its zoom and
switch code rather than writing new code.

**Pictures, films and store art** (thumbnails, posters, illustrations) follow ask-first's visual order instead. You
may lay the samples side by side on a board, but they need no prototype.

## What the board must do

One HTML page, published as a private artifact (the claude-artifacts tools), that opens on a dotted canvas.

1. **Moves like Miro.** Ctrl+wheel zooms at the pointer (a trackpad pinch arrives as Ctrl+wheel in browsers, so it
   works too). The plain wheel and dragging the background pan. There are Fit, +, − and a zoom percentage. Escape or Fit returns to the
   whole board.
2. **A table of contents, top left.** A small panel in the top left corner lists every section by number and name
   ("1. Your projects", "2. While Claude works"). Clicking an entry glides the view to that section. It is open when
   the board loads, and only its own hide and show button changes that: clicking an entry, making a choice,
   zooming, Fit or a reset never hides it. When it is open, a jump and Fit frame the board in the space beside it,
   so no section sits under it. The user (2026-11-22): "I like it to be collapsible, but I will choose when it
   collapses. It shouldn't automatically collapse just because I make a choice." On a
   narrow window (under about 1500 px) it may start hidden, with the button in view. Why: the user (2026-11-22)
   liked "a cool little index or table of contents like in the top left corner" on the first board, as "a good way
   to shortcut to different sections of the board".
3. **Sections, one per thing to judge.** Each section is a titled frame showing one feature, one option or one
   state. A "Start here" section, top left, says in a few lines what the board is for, how to move ("hold Ctrl and
   use the mouse wheel to zoom; drag to move"), and lists each question with the section that answers it.

   **Every other section opens with a "Why this section" block**, right under its title, before any description
   of how the screen works. It is at most two short lines, in the same place and the same format on every
   section, with three parts:
   - *What it's for:* the story or need, in a person's terms ("Someone wants to understand her brother's view
     before a family dinner"), not what the screen does.
   - *Where it came from:* "you asked" with the user's words, "from the user stories", or "my own idea, not asked
     for". Flag the last one plainly.
   - *What to decide:* the question and its letters, or "nothing to decide, just try it".

   Two option sections that answer the same question (for example 4A and 4B) can share one purpose: the second
   says "Compare with 4A" instead of repeating it. Why this exists: a section that only said how its screen worked
   left the user asking "I don't really understand what the point of this section of the board is for" (2026-11-22).
   It was an idea nobody had asked for, and the section never said so.
4. **A working prototype inside each section.** Buttons, cards, menus, typing, sliders and opening and closing work
   the way the real screen will, using the gestures of the app it imitates. For the look:
   - an app with a built style sheet: copy it in;
   - an app with no style sheet to copy (a native desktop app, for example): match its look by hand from
     screenshots of the real app;
   - a project with no app yet: design the look from the bar and reference the user gave when asked first.
   Content is real-looking: the project's test data when it has some, otherwise content written to fit what the
   project is for. Never placeholder text ("lorem ipsum", "Item 1"). Mark anything written only for the mockup as
   sample text.
5. **Every choice you ask about can be tried on the board.** Label options with letters (A, B, C) so the user can
   answer in one line, for example "1: B, 2: A", and mark your pick. Which form an option takes:
   - Options that change one part of a screen (a colour, a wording, showing or hiding a feature) are a switch or a
     set of buttons inside that screen's section, labelled with what it changes and set to your pick.
   - Options that change a whole screen's layout get one section each, side by side (for example "Timeline A" and
     "Timeline B"), so both can be seen and used at once.
   - When the user asks to see two things ("show me both"), they always get their own sections, side by side, even
     when the difference is only a colour: their asking to compare wins over the switch rule above.
6. **Readable where it lands.** When the table of contents jumps to a section, the body text there reads at normal
   size (about 12 px on screen or larger), and the whole section fits in the window at 1280 and 1920 px wide. At
   Fit, every section name reads in full.
7. **Matches the app's themes.** If the app has light and dark, the board has a theme button and both look right.
8. **Always a reset.** Every section with a prototype has a "↺ Reset this screen" button in the same place (top
   right of the section). It puts that one prototype and its switches back to how they started, without reloading
   the page or touching other sections. The "Start here" section says where it is. Why: the user (2026-11-21) asked
   for "always offering a reset button" after clicking Approve inside a prototype left no way to try that screen
   again.

## Build it

- Keep the board's source in the project, beside the project's other mockups or design records (on an ACAF project,
  `acaf/mockups/`; with no such place yet, a `mockups/` folder at the project root), so later sessions can change it. When the published page must be one self-contained file,
  write a small build step that inlines the style sheet and data, and keep the parts separate in the source.
- Publish the built page as a private artifact. Pictures go in as files with it (publish_files); never hotlink.
- Each change the user asks for is a new version of the same artifact, not a new artifact.

## Check it before the user sees it

1. **Use it the way the user will.** Open it in the built-in browser and use real input: Ctrl+wheel over a card,
   drag the background, click each table-of-contents entry, every switch and every control inside the prototypes. Then
   press each section's reset and check it looks exactly as it did on first load. With the table of contents open,
   click several of its entries and make choices, and check it is still open. If a gesture the reference app
   has does nothing, the board is not ready.
2. **A fresh look.** Freeze screenshots of each section at the zoom its jump lands on, plus Fit, in each theme, at
   1280 and 1920 px wide, and send them to the `picky-reviewer` agent with the user's exact words. Fix what it finds
   at normal size and repeat until a round finds nothing at normal size. Then look at it yourself.

## Hand it over

Put the artifact's link in your message and open it beside the chat. Say in two lines how to move around it. Then
list the questions, each with its section, its options by letter, and your pick with the reason, so the user can
answer in one line. Wait for their answers before building the real thing.
