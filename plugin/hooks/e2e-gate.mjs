#!/usr/bin/env node
// PreToolUse (Bash) on `gh pr create`: a PR with UI changes needs an e2e run that passed after them.
// "After": Playwright's test-results/.last-run.json (written at the end of every run) says passed
// and is newer than every changed file under app/, e2e/ and i18n/. CI runs e2e too; this only
// moves the feedback before the PR. Repos without an `e2e` script are left alone.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runsGhPr } from './command.mjs'

const UI = ['app/', 'e2e/', 'i18n/']

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = input.tool_input?.command ?? ''
if (!runsGhPr(command, 'create')) process.exit(0)

// `cd <dir> && gh pr create` opens the PR for <dir>'s repo, not the session's.
const cd = /(?:^|&&|;)\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/.exec(command)
const cwd = resolve(input.cwd || process.cwd(), cd ? (cd[1] ?? cd[2] ?? cd[3]) : '.')
const git = (...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

let root
try {
  root = git('rev-parse', '--show-toplevel')
}
catch {
  process.exit(0)
}
try {
  if (!JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts?.e2e) process.exit(0)
}
catch {
  process.exit(0)
}

const base = ['origin/HEAD', 'origin/main', 'origin/master'].find((ref) => {
  try {
    git('rev-parse', '--verify', '--quiet', ref)
    return true
  }
  catch {
    return false
  }
})
const committed = base ? git('diff', '--name-only', `${base}...HEAD`).split('\n') : []
const uncommitted = git('status', '--porcelain', '--untracked-files=all').split('\n').map(line => line.slice(3).split(' -> ').pop())
const changed = [...new Set([...committed, ...uncommitted])]
  .filter(f => f && UI.some(dir => f.startsWith(dir)) && existsSync(join(root, f)))
if (!changed.length) process.exit(0)

const newest = changed.reduce((a, b) => (statSync(join(root, a)).mtimeMs >= statSync(join(root, b)).mtimeMs ? a : b))
const record = join(root, 'test-results', '.last-run.json')
let passed = false
try {
  passed = JSON.parse(readFileSync(record, 'utf8')).status === 'passed'
    && statSync(record).mtimeMs >= statSync(join(root, newest)).mtimeMs
}
catch {
  // No run recorded yet, or an unreadable record: not passed.
}
if (passed) process.exit(0)

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `This PR changes the UI (${changed.length} file(s) under ${UI.join(', ')}; newest: ${newest}) after the last passing e2e run. Run the whole \`yarn e2e\` and open the PR once it passes. If the owner explicitly wants to skip it, they can run the gh pr create command themselves with a leading "!".`,
  },
}))
