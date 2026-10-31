---
name: ui
description: How screens and UI copy are designed in the owner's Nuxt apps — layout, components and icons explain, text is the last resort. Use before designing or changing a page or component, before adding strings to i18n/locales, and when longCopy() fails.
---

# Screens that explain themselves

The apps are for ordinary users, who look rather than read. A screen should make sense without its
hints, so explanatory text is the exception, not the default.

## Before writing a hint

Try these first, in order:

1. **Layout**: group related things, order them by use, and let a heading name the group. Don't
   say in words what the layout already shows.
2. **Components and states**: a chip or badge for a status or count, an empty state, a disabled
   control, a progress bar, a preview of the result, a confirmation on the destructive action.
3. **Icons**: the app's own `AppIcon` (no icon library); draw a new one there when none fits. A
   universal action (search, close, edit, delete) can be icon-only with an `aria-label`; others get
   an icon and a short label.
4. **Details on demand**: rules and edge cases go behind a disclosure the user opens, not on the
   screen by default.

What is left as text is only what the user needs in order to act and cannot see: at most one hint
per section, one line, 40 characters at most in the default language. `longCopy()` from
`@driftkingtw/nuxt-harness/vitest` enforces the length.

## Wording

- Reuse the app's terms and shared strings (search the locale files for how the app already says
  it).
- Leave out what users already know and how the app works inside.
- Errors: one line that says what to do.
- Empty states: an icon, one line, and the action that fills the space.

## Don't over-design

Use the simplest component that carries the meaning. Don't add a component, animation or
illustration only to avoid a word: a plain label is fine.

## Older long strings

An app lists the strings it had before this rule in `longCopy({ allowKeys })`. When changing a
screen, rework its listed strings the same way and remove them from the list; `longCopy()` reports
entries that are no longer long.
