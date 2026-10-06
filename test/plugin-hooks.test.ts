// The plugin's hooks, run the way Claude Code runs them: JSON on stdin, a decision on stdout.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const hook = (name: string) => join(import.meta.dirname, '..', 'plugin', 'hooks', name)

function run(name: string, input: object, env: Record<string, string> = {}) {
  const { HARNESS_MODES: _, CLAUDE_PROJECT_DIR: __, ...rest } = process.env
  return execFileSync('node', [hook(name)], { input: JSON.stringify(input), env: { ...rest, ...env }, encoding: 'utf8' }).trim()
}

function write(root: string, path: string, content: string, time?: Date) {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content)
  if (time) utimesSync(join(root, path), time, time)
}

/** A repo with an e2e script, `origin/main` at its first commit, and a feature branch. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-harness-hooks-'))
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'dev@example.com')
  git('config', 'user.name', 'Dev')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.hooksPath', '/dev/null')
  write(root, 'package.json', JSON.stringify({ scripts: { e2e: 'playwright test' } }))
  git('add', '-A')
  git('commit', '-q', '-m', 'chore: start')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('switch', '-q', '-c', 'feat/x')
  return { root, commit: (path: string, content = 'x', time?: Date) => {
    write(root, path, content, time)
    git('add', '-A')
    git('commit', '-q', '-m', `feat: ${path}`)
  } }
}

const prCreate = (cwd: string, command = 'gh pr create --fill') => ({ hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command } })
const earlier = new Date(Date.now() - 60_000)
const later = new Date(Date.now() + 60_000)

describe('e2e-gate', () => {
  it('stops a PR whose UI changed after the last passing run', () => {
    const { root, commit } = repo()
    commit('app/pages/index.vue', '<template />')
    expect(JSON.parse(run('e2e-gate.mjs', prCreate(root))).hookSpecificOutput.permissionDecision).toBe('deny')

    write(root, 'test-results/.last-run.json', JSON.stringify({ status: 'passed', failedTests: [] }), earlier)
    expect(run('e2e-gate.mjs', prCreate(root))).toContain('"deny"')

    write(root, 'test-results/.last-run.json', JSON.stringify({ status: 'failed', failedTests: ['a'] }), later)
    expect(run('e2e-gate.mjs', prCreate(root))).toContain('"deny"')
  })

  it('lets the PR through once a run passed after the change', () => {
    const { root, commit } = repo()
    commit('i18n/locales/en.json', '{}', earlier)
    write(root, 'test-results/.last-run.json', JSON.stringify({ status: 'passed', failedTests: [] }), later)
    expect(run('e2e-gate.mjs', prCreate(root))).toBe('')
  })

  it('counts uncommitted UI edits too', () => {
    const { root } = repo()
    write(root, 'e2e/home.spec.ts', 'test()')
    expect(run('e2e-gate.mjs', prCreate(root))).toContain('"deny"')
  })

  it('ignores changes outside the UI, other commands, and repos without e2e', () => {
    const { root, commit } = repo()
    commit('docs/notes.md')
    expect(run('e2e-gate.mjs', prCreate(root))).toBe('')
    commit('app/a.vue')
    expect(run('e2e-gate.mjs', prCreate(root, 'gh pr view'))).toBe('')
    write(root, 'package.json', '{}')
    expect(run('e2e-gate.mjs', prCreate(root))).toBe('')
  })

  it('ignores gh pr create inside a commit message or a quoted string', () => {
    const { root, commit } = repo()
    commit('app/a.vue')
    expect(run('e2e-gate.mjs', prCreate(root, `git commit -F - <<'EOF'\nfeat: add a gate before gh pr create\nEOF`))).toBe('')
    expect(run('e2e-gate.mjs', prCreate(root, 'git commit -m "run gh pr create later"'))).toBe('')
    expect(run('e2e-gate.mjs', prCreate(root, 'GH_PROMPT_DISABLED=1 gh pr create --fill'))).toContain('"deny"')
    expect(run('e2e-gate.mjs', prCreate(root, 'gh pr create --help'))).toBe('')
    expect(run('e2e-gate.mjs', prCreate(root, 'git push -u origin feat/x && gh pr create --fill'))).toContain('"deny"')
  })

  it('checks the repo a `cd … &&` points at', () => {
    const { root, commit } = repo()
    commit('app/a.vue')
    expect(run('e2e-gate.mjs', prCreate(tmpdir(), `cd "${root}" && gh pr create --fill`))).toContain('"deny"')
  })
})

describe('modes', () => {
  function project(modes?: string) {
    const root = mkdtempSync(join(tmpdir(), 'nuxt-harness-modes-'))
    if (modes !== undefined) write(root, '.claude/settings.json', JSON.stringify({ env: { HARNESS_MODES: modes } }))
    return root
  }
  const session = { hook_event_name: 'SessionStart', source: 'startup' }
  const after = (command: string, stdout = 'https://github.com/me/app/pull/3\n') => ({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr: '' } })

  it('says nothing when no mode is on', () => {
    expect(run('modes.mjs', session, { CLAUDE_PROJECT_DIR: project() })).toBe('')
    expect(run('modes.mjs', after('gh pr create'), { CLAUDE_PROJECT_DIR: project('') })).toBe('')
  })

  it('explains the modes at session start', () => {
    const out = run('modes.mjs', session, { CLAUDE_PROJECT_DIR: project('preview, fast-dev') })
    expect(out).toContain('- preview:')
    expect(out).toContain('- fast-dev:')
  })

  it('asks for a reminder after a PR is opened, and only then', () => {
    const root = project('fast-dev')
    const out = JSON.parse(run('modes.mjs', after('cd x && gh pr create --fill'), { CLAUDE_PROJECT_DIR: root }))
    expect(out.hookSpecificOutput.additionalContext).toContain('modes are on: fast-dev')
    expect(run('modes.mjs', after('gh pr merge 3 --squash'), { CLAUDE_PROJECT_DIR: root })).toBe('')
    expect(run('modes.mjs', after('git commit -m "before gh pr create"'), { CLAUDE_PROJECT_DIR: root })).toBe('')
    expect(run('modes.mjs', after('gh pr create --help', 'Create a pull request on GitHub.'), { CLAUDE_PROJECT_DIR: root })).toBe('')
  })

  it('prefers the session environment over the settings file', () => {
    expect(run('modes.mjs', session, { CLAUDE_PROJECT_DIR: project('fast-dev'), HARNESS_MODES: 'preview' })).not.toContain('fast-dev')
  })
})

/** A repo in the given modes: its main checkout (on feat/x) and a linked worktree. */
function modeRepo(modes: string) {
  const { root, commit } = repo()
  write(root, '.claude/settings.json', JSON.stringify({ env: { HARNESS_MODES: modes } }))
  write(root, '.gitignore', '.claude/settings.local.json\n')
  commit('app/a.vue')
  const linked = `${root}-wt`
  execFileSync('git', ['-C', root, 'worktree', 'add', '-q', '-b', 'feat/wt', linked], { stdio: 'ignore' })
  return { root, linked }
}

describe('worktree-guard', () => {
  const edit = (file: string) => ({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: file } })

  it('stops edits to tracked and new files in the main checkout', () => {
    const { root } = modeRepo('preview,worktree')
    expect(JSON.parse(run('worktree-guard.mjs', edit(join(root, 'app/a.vue')))).hookSpecificOutput.permissionDecision).toBe('deny')
    expect(run('worktree-guard.mjs', edit(join(root, 'app/pages/new.vue')))).toContain('"deny"')
  })

  it('lets edits through in a linked worktree, to ignored files, and without the mode', () => {
    const { root, linked } = modeRepo('worktree')
    expect(run('worktree-guard.mjs', edit(join(linked, 'app/a.vue')))).toBe('')
    expect(run('worktree-guard.mjs', edit(join(root, '.claude/settings.local.json')))).toBe('')
    expect(run('worktree-guard.mjs', edit(join(modeRepo('preview').root, 'app/a.vue')))).toBe('')
    expect(run('worktree-guard.mjs', edit(join(tmpdir(), 'not-a-repo', 'notes.md')))).toBe('')
  })
})

describe('modes: worktree', () => {
  const session = (cwd: string) => ({ hook_event_name: 'SessionStart', source: 'startup', cwd })

  it('tells a session in the main checkout to create a worktree first', () => {
    const { root, linked } = modeRepo('worktree')
    expect(run('modes.mjs', session(root), { CLAUDE_PROJECT_DIR: root })).toContain('started in the main checkout')
    const inWorktree = run('modes.mjs', session(linked), { CLAUDE_PROJECT_DIR: linked })
    expect(inWorktree).toContain('- worktree:')
    expect(inWorktree).not.toContain('started in the main checkout')
  })
})
