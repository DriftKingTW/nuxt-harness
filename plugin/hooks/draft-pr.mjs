#!/usr/bin/env node
// PreToolUse (Bash) on `gh pr create`: pull requests open as drafts. CI skips drafts (see ciBudget),
// so pushes while the work is still changing cost no Actions minutes; `gh pr ready` starts CI.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { codeOnly, runsGhPr } from './command.mjs'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = input.tool_input?.command ?? ''
if (!runsGhPr(command, 'create')) process.exit(0)
const code = codeOnly(command)
if (/\s(?:-h|--help|-d|--draft)(?:[\s=]|$)/.test(code)) process.exit(0)

// `cd <dir> && gh pr create` opens the PR for <dir>'s repo, not the session's.
const cd = /(?:^|&&|;)\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/.exec(command)
const cwd = resolve(input.cwd || process.cwd(), cd ? (cd[1] ?? cd[2] ?? cd[3]) : '.')
let modes = process.env.HARNESS_MODES
try {
  const top = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  for (const name of ['settings.local.json', 'settings.json']) {
    try {
      modes ??= JSON.parse(readFileSync(join(top, '.claude', name), 'utf8')).env?.HARNESS_MODES
    }
    catch {
      // No such settings file in this repo.
    }
  }
}
catch {
  // Not a git repo: gh will say so.
}
const fastDev = (modes ?? '').split(',').map(m => m.trim()).includes('fast-dev')

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `Open the pull request as a draft: add --draft. CI skips drafts, so pushes while the work still changes cost no Actions minutes. ${fastDev
      ? 'This repo is in fast-dev mode: once `yarn check` and `yarn nuxt-harness e2e` pass on the pushed branch, mark it ready with `gh pr ready` and merge when CI is green.'
      : 'Leave it as a draft and tell the owner it is done; they mark it ready (`gh pr ready`), which starts CI.'}`,
  },
}))
