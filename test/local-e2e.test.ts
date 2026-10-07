// `nuxt-harness e2e` and `require-local-e2e`, against a real git repo and stand-ins for gh and yarn.
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { localE2e, requireLocalE2e } from '../src/local-e2e.js'

function setup({ pushed = true, e2eExit = 0, dirtyDuringRun = false, state = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-harness-e2e-'))
  const bin = join(root, '.bin')
  const repo = join(root, 'app')
  const log = join(root, 'gh.log')
  mkdirSync(bin)
  mkdirSync(repo)
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash
echo "$*" >> "${log}"
case "$*" in
  *"--method POST"*) ;;
  *"/status --jq"*) printf '%s' "${state}" ;;
  *"--silent"*) exit ${pushed ? 0 : 1} ;;
esac
`)
  writeFileSync(join(bin, 'yarn'), `#!/usr/bin/env bash
${dirtyDuringRun ? 'echo x > during.txt' : ''}
exit ${e2eExit}
`)
  chmodSync(join(bin, 'gh'), 0o755)
  chmodSync(join(bin, 'yarn'), 0o755)
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'dev@example.com')
  git('config', 'user.name', 'Dev')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.hooksPath', '/dev/null')
  writeFileSync(join(repo, 'a.txt'), 'a')
  git('add', '-A')
  git('commit', '-q', '-m', 'chore: start')
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const lines: string[] = []
  const options = {
    cwd: repo,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'me/app' },
    log: (line: string) => lines.push(line),
    pollMs: 10,
  }
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '')
  return { repo, sha, options, lines, calls }
}

describe('nuxt-harness e2e', () => {
  it('sets a success status on the pushed commit after a passing run', () => {
    const { sha, options, calls } = setup()
    expect(localE2e(options)).toBe(0)
    expect(calls()).toContain(`api --method POST repos/me/app/statuses/${sha} -f state=success -f context=e2e (local)`)
  })

  it('records a failing run as a failure', () => {
    const { options, calls } = setup({ e2eExit: 3 })
    expect(localE2e(options)).toBe(3)
    expect(calls()).toContain('-f state=failure')
  })

  it('refuses uncommitted changes and unpushed commits, before running anything', () => {
    const dirty = setup()
    writeFileSync(join(dirty.repo, 'b.txt'), 'b')
    expect(localE2e(dirty.options)).toBe(1)
    expect(dirty.lines.join()).toContain('Uncommitted changes')
    expect(dirty.calls()).toBe('')

    const unpushed = setup({ pushed: false })
    expect(localE2e(unpushed.options)).toBe(1)
    expect(unpushed.lines.join()).toContain('not on GitHub yet')
    expect(unpushed.calls()).not.toContain('POST')
  })

  it('records nothing when the checkout changed during the run', () => {
    const { options, lines, calls } = setup({ dirtyDuringRun: true })
    expect(localE2e(options)).toBe(1)
    expect(lines.join()).toContain('changed during the run')
    expect(calls()).not.toContain('POST')
  })

  it('takes over a lock left by a process that is gone', () => {
    const { repo, options } = setup()
    const lock = join(repo, '.git', 'nuxt-harness-e2e.lock')
    mkdirSync(lock)
    writeFileSync(join(lock, 'owner'), '999999999\n/elsewhere\n')
    expect(localE2e(options)).toBe(0)
    expect(existsSync(lock)).toBe(false)
  })
})

describe('nuxt-harness require-local-e2e', () => {
  it('passes only when the commit has a successful local run', () => {
    const passed = setup({ state: 'success' })
    expect(requireLocalE2e(passed.sha, passed.options)).toBe(0)

    for (const state of ['failure', '']) {
      const { sha, options, lines } = setup({ state })
      expect(requireLocalE2e(sha, options)).toBe(1)
      expect(lines.join()).toContain('yarn nuxt-harness e2e')
    }
  })
})
