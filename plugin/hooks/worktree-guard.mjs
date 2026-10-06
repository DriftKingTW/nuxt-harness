#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): in a repo whose .claude/settings.json turns on
// HARNESS_MODES=worktree, the main checkout stays on main for deploys, so files git tracks (or
// would track) there are not edited; work happens in a linked worktree. Ignored files (such as
// .claude/settings.local.json) stay editable. Branch switches and commits are the Bash guard's job.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path
if (!file) process.exit(0)

let dir = dirname(file)
while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir)
const git = (...args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return null
  }
}

const top = git('rev-parse', '--show-toplevel')
if (!top) process.exit(0)
let modes
for (const name of ['settings.local.json', 'settings.json']) {
  try {
    modes ??= JSON.parse(readFileSync(join(top, '.claude', name), 'utf8')).env?.HARNESS_MODES
  }
  catch {
    // No such settings file in this repo.
  }
}
if (!(modes ?? '').split(',').map(m => m.trim()).includes('worktree')) process.exit(0)

const [gitDir, commonDir] = (git('rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir') ?? '').split('\n')
if (!gitDir || gitDir !== commonDir) process.exit(0) // a linked worktree: edit away
if (git('check-ignore', '-q', file) !== null) process.exit(0) // ignored by git: not part of the work

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `${top} is the main checkout of a repo that works in worktrees (HARNESS_MODES=worktree); it stays on main for deploys. Create a worktree and edit the file there: \`orca worktree create --repo path:${top} --name <task> --no-parent --setup skip --json\`, then rename its branch to type/short-description (or \`git worktree add ../<repo>-<task> -b type/short-description origin/main\`), and run \`yarn install\` in it.`,
  },
}))
