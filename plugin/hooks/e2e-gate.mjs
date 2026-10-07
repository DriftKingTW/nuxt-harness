#!/usr/bin/env node
// PreToolUse (Bash).
// - `gh pr ready` (the PR is done; CI starts): a PR that changes more than docs needs the commit
//   status "e2e (local)" = success on its head, which `yarn nuxt-harness e2e` sets after a passing
//   run, and which the app's CI checks with `nuxt-harness require-local-e2e`. Apps on a package
//   version without `nuxt-harness e2e` get the older check instead: Playwright's
//   test-results/.last-run.json says passed and is newer than every changed file under the UI dirs.
// - Writing a commit status any other way (`gh api repos/…/statuses/…`) is denied: the status
//   stands for a run that happened.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { codeOnly, runsGhPr } from './command.mjs'

const CONTEXT = 'e2e (local)'
const UI = ['app/', 'e2e/', 'i18n/']
const DOCS = /^(?:docs\/|\.claude\/)|\.md$/

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = input.tool_input?.command ?? ''

function deny(reason) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }))
  process.exit(0)
}

if (/repos\/[^\s/'"]+\/[^\s/'"]+\/statuses\//.test(command))
  deny(`Commit statuses are set only by \`yarn nuxt-harness e2e\`, after a passing run of the whole e2e suite on that commit; CI trusts "${CONTEXT}" to mean exactly that. Run it instead. If the owner explicitly wants to set a status by hand, they can run the command themselves with a leading "!".`)

const code = codeOnly(command)
if (!runsGhPr(command, 'ready') || /\s(?:--undo|-h|--help)\b/.test(code)) process.exit(0)
const selector = /gh\s+pr\s+ready\s+([^\s;&|-][^\s;&|]*)/.exec(code)?.[1]

// `cd <dir> && gh pr ready` acts on <dir>'s repo, not the session's.
const cd = /(?:^|&&|;)\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/.exec(command)
const cwd = resolve(input.cwd || process.cwd(), cd ? (cd[1] ?? cd[2] ?? cd[3]) : '.')
const run = (cmd, ...args) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

let root
try {
  root = run('git', 'rev-parse', '--show-toplevel')
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

const uncommitted = run('git', 'status', '--porcelain', '--untracked-files=all').split('\n').map(line => line.slice(3).split(' -> ').pop()).filter(Boolean)
if (uncommitted.length && !selector)
  deny(`Uncommitted changes (${uncommitted.slice(0, 5).join(', ')}${uncommitted.length > 5 ? ', …' : ''}). Commit and push them, run \`yarn nuxt-harness e2e\`, then mark the PR ready.`)

if (existsSync(join(root, 'node_modules', '@driftkingtw', 'nuxt-harness', 'dist', 'local-e2e.js'))) {
  let pr
  try {
    pr = JSON.parse(run('gh', 'pr', 'view', ...(selector ? [selector] : []), '--json', 'headRefOid,files,statusCheckRollup'))
  }
  catch {
    process.exit(0) // No PR, or no network: gh pr ready will report it.
  }
  const files = (pr.files ?? []).map(f => f.path)
  if (files.length && files.every(f => DOCS.test(f))) process.exit(0)
  const head = pr.headRefOid
  if (!selector && run('git', 'rev-parse', 'HEAD') !== head)
    deny(`The local branch is not the PR's head (${head.slice(0, 7)}): push (or pull) first, run \`yarn nuxt-harness e2e\` on the pushed commit, then mark the PR ready.`)
  const status = (pr.statusCheckRollup ?? []).find(c => c.context === CONTEXT)
  if (status?.state === 'SUCCESS') process.exit(0)
  deny(`The PR head ${head.slice(0, 7)} has no passing "${CONTEXT}" (${status ? status.state.toLowerCase() : 'none'}). e2e runs on this machine, not in CI: run \`yarn nuxt-harness e2e\` (the whole suite; it sets the status on the pushed commit), then mark the PR ready. If the owner explicitly wants to skip it, they can run the gh pr ready command themselves with a leading "!".`)
}

// Older package: no commit status yet, so compare the last local run with the changed UI files.
const base = ['origin/HEAD', 'origin/main', 'origin/master'].find((ref) => {
  try {
    run('git', 'rev-parse', '--verify', '--quiet', ref)
    return true
  }
  catch {
    return false
  }
})
const committed = base ? run('git', 'diff', '--name-only', `${base}...HEAD`).split('\n') : []
const changed = committed.filter(f => f && UI.some(dir => f.startsWith(dir)) && existsSync(join(root, f)))
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
deny(`This PR changes the UI (${changed.length} file(s) under ${UI.join(', ')}; newest: ${newest}) after the last passing e2e run. Run the whole \`yarn e2e\` and mark the PR ready once it passes. If the owner explicitly wants to skip it, they can run the gh pr ready command themselves with a leading "!".`)
