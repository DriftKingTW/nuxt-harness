#!/usr/bin/env node
// Workflow modes a repo turns on with HARNESS_MODES ("preview,fast-dev") in .claude/settings.json.
// SessionStart: tells Claude what each mode asks of it. PostToolUse (Bash) after `gh pr create`,
// the end of a feature: has Claude remind the owner which modes are on, since they change the pace.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runsGhPr } from './command.mjs'

const MODES = {
  'preview': 'preview: before opening a PR that changes what the owner sees, run the branch on a preview with a copy of the real data, give them the URL, and wait for their OK.',
  'fast-dev': 'fast-dev: open PRs as drafts; once `yarn check` and `yarn nuxt-harness e2e` pass on the pushed branch, mark the PR ready (`gh pr ready`), then merge it when CI is green, and deploy, without asking first.',
  'worktree': 'worktree: the main checkout stays on main for deploys; every change happens in a linked worktree (`orca worktree create`, then rename the branch to type/short-description). Remove the worktree once its PR is merged.',
}

function modesOn(projectDir, { env = true } = {}) {
  let value = env ? process.env.HARNESS_MODES : undefined
  for (const file of ['settings.local.json', 'settings.json']) {
    if (value !== undefined) break
    try {
      value = JSON.parse(readFileSync(join(projectDir, '.claude', file), 'utf8')).env?.HARNESS_MODES
    }
    catch {
      // No such settings file in this repo.
    }
  }
  return (value ?? '').split(',').map(m => m.trim()).filter(m => m in MODES)
}

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = input.tool_input?.command ?? ''

// The PR's repo: `cd <dir> && gh pr create` may open it in another repo than the session's.
function prRepo() {
  const cd = /(?:^|&&|;)\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/.exec(command)
  const dir = resolve(input.cwd || process.cwd(), cd ? (cd[1] ?? cd[2] ?? cd[3]) : '.')
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return dir
  }
}

const isPr = input.hook_event_name === 'PostToolUse'
const on = isPr
  ? modesOn(prRepo(), { env: false })
  : modesOn(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd())
if (!on.length) process.exit(0)

function inMainCheckout(dir) {
  try {
    const [gitDir, commonDir] = execFileSync('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')
    return Boolean(gitDir) && gitDir === commonDir
  }
  catch {
    return false
  }
}

if (input.hook_event_name === 'SessionStart') {
  const here = on.includes('worktree') && inMainCheckout(input.cwd || process.cwd())
    ? '\nThis session started in the main checkout: create a worktree before changing anything (edits, commits and branch switches here are blocked).'
    : ''
  console.log(`<workflow-modes>\nThis repo turns on these workflow modes (HARNESS_MODES in .claude/settings.json):\n${on.map(m => `- ${MODES[m]}`).join('\n')}${here}\n</workflow-modes>`)
}
// Only once a PR exists: its URL is in the output (not for --help, --dry-run or a failed create).
else if (isPr && runsGhPr(command, 'create')
  && /\/pull\/\d+/.test(JSON.stringify(input.tool_response ?? ''))) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `A feature just reached a PR. At the end of your reply, remind the owner in one line that these workflow modes are on: ${on.join(', ')}. They change the pace of work; the owner turns one off by editing HARNESS_MODES in .claude/settings.json (for everyone), or overrides it in .claude/settings.local.json (this checkout only).`,
    },
  }))
}
