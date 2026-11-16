---
name: ui
description: How screens and UI copy are designed in the owner's Nuxt apps — layout, components and icons explain, text is the last resort. Use before designing or changing a page or component, before adding strings to i18n/locales, and when longCopy() fails.
---

# Screens that explain themselves

The apps are for ordinary users, who look rather than read. A screen should make sense from its
headings, labels and layout alone; a hint is the exception, not the default.

## 1. Show it without words

Try these first, in order:

1. **Layout**: group related things, order them by use, and let a heading name the group.
2. **Components and states**: a chip or badge for a status or count, an empty state (an icon, one
   line, and the action that fills the space), a disabled control, a progress bar, a preview of
   the result, a confirmation on the destructive action.
3. **Icons**: the app's own `AppIcon` (no icon library); draw a new one there when none fits. A
   universal action (search, close, edit, delete) can be icon-only with an `aria-label`; others get
   an icon and a short label.
4. **Details on demand**: rules and edge cases go behind a disclosure the user opens, not on the
   screen by default.

Use the simplest component that carries the meaning. Don't add a component, animation or
illustration only to avoid a word: a plain label is fine.

## 2. Fit the space

- A component that opens in more than one place (a page, a side pane, a half-width card) sets its
  columns by its own width: `@container` on it and `@lg:` / `@2xl:` on its grids, not the
  viewport's `sm:` / `lg:`, which give a half-width card the full-width layout.
- Text in a column of fixed width (a date, an amount, a short label) can outgrow it in another
  language, a larger font or a two-digit day, and CJK text breaks between any two characters. Give
  the column `min-w-*` and `whitespace-nowrap` rather than `w-*`.
- Before showing a change (the preview or the PR), look at the screen at phone width (360px) and
  in every place it opens, with its longest real value (`2026年11月15日`, a long name, a large
  amount). An e2e spec at phone width keeps it so: `layoutOverflow(page)` finds a page that
  scrolls sideways and controls sticking out of their card; it can't see text that wraps badly.

## 3. Text

### Secondary text

Secondary text is the smaller, muted line beside something that already has a name: a description
under a page or section heading, a helper line under a field or a toggle, a caption under a chart
or a card. Cut it first: the heading, the label and the layout around it usually say the same.

- A heading names the group, and the controls under it, in the order they are used, show what to
  do. Don't add a line that restates either.
- When a heading and the button under it say the same, keep one. Drop a lead-in ending in a colon.
- What a field takes (a format, a currency, a unit) goes in its label, a unit beside it or an
  example in the placeholder, not in a helper line.

### Does it need to be there at all?

Ask this before shortening any hint: would a user without it make a mistake or be unable to act?
If not, delete it. A short hint that need not exist is still noise. Usually not needed:

- How standard gestures work: drag, scroll or pinch to move or zoom, click a marker or a box, drag
  to reorder.
- What a chart's labels, legend or tooltip already show.
- How a tool works when its preview or result shows it (a list of changes, a live preview, a count
  of skipped items).
- What a button's own label says, e.g. "empty clears it" next to a button that says "Clear 3 items".
- How a number is calculated, and which filters it ignores.
- What users already know, and how the app works inside.

Usually needed, in one short line:

- A side effect on data the user is not looking at (other items of the same model change too).
- Who can see what (privacy).
- What cannot be undone or changed later.
- What a filter or scope with an ambiguous name includes.
- A data source its licence requires to be named, and a note an ADR asks for.

### Length and wording

- At most one hint per section, one line, 40 characters at most in the default language.
  `longCopy()` from `@driftkingtw/nuxt-harness/vitest` enforces the length.
- Write in the terms apps use, the way a settings screen or a permission dialog says it, not the
  way people talk: in zh-TW 唯讀 rather than 不能修改, 啟用 rather than 打開…的開關, 僅限區域網路
  rather than 只有區域網路連得到, 僅顯示一次 rather than 只會顯示這一次，請現在複製; in English
  "Read-only", "Enable", "Shown only once". A conversational voice is the exception: words the
  user would say themselves (an example question to an AI), or an app whose `AGENTS.md` says it
  speaks that way.
- Reuse the app's terms and shared strings (search the locale files for how the app already says
  it).
- List what is supported, not what is not.
- Errors: one line that says what to do.
