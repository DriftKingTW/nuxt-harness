// e2e on the developer's machine instead of CI, reported as a commit status that CI checks.
// `nuxt-harness e2e` runs the app's `e2e` script for the pushed, clean HEAD and sets the status
// `e2e (local)` on that commit; `nuxt-harness require-local-e2e` fails a CI job unless the commit
// has it. Both call the GitHub API through `gh`.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const E2E_CONTEXT = 'e2e (local)'

export interface RunOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  log?: (line: string) => void
  /** Milliseconds between checks while another checkout holds the lock. */
  pollMs?: number
}

const out = (cmd: string, args: string[], { cwd, env }: RunOptions) =>
  execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function repoSlug(options: RunOptions) {
  return options.env?.GITHUB_REPOSITORY || out('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], options)
}

function state(options: RunOptions) {
  return {
    sha: out('git', ['rev-parse', 'HEAD'], options),
    dirty: out('git', ['status', '--porcelain', '--untracked-files=all'], options),
  }
}

function alive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * One e2e run at a time per repository: its worktrees share one local database stack, so two runs
 * would see each other's data. A lock left by a process that died is taken over.
 */
function lock(options: RunOptions) {
  const dir = join(out('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], options), 'nuxt-harness-e2e.lock')
  let told = false
  for (;;) {
    try {
      mkdirSync(dir)
      writeFileSync(join(dir, 'owner'), `${process.pid}\n${options.cwd}\n`)
      return () => rmSync(dir, { recursive: true, force: true })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    let owner: string[] = []
    try {
      owner = readFileSync(join(dir, 'owner'), 'utf8').split('\n')
    }
    catch {
      // Just created by another process, owner not written yet.
    }
    const pid = Number(owner[0])
    if (pid && !alive(pid)) {
      rmSync(dir, { recursive: true, force: true })
      continue
    }
    if (!told) options.log?.(`Waiting for the e2e run in ${owner[1] || 'another checkout'} to finish…`)
    told = true
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, options.pollMs ?? 5000)
  }
}

/** Runs `yarn e2e` for HEAD and records the result on the commit. Returns the exit code. */
export function localE2e(options: RunOptions): number {
  const log = options.log ?? console.log
  const before = state(options)
  if (before.dirty) {
    log(`✘ Uncommitted changes. The result is recorded for a commit, so commit (or stash) them first:\n${before.dirty}`)
    return 1
  }
  const slug = repoSlug(options)
  try {
    out('gh', ['api', `repos/${slug}/commits/${before.sha}`, '--silent'], options)
  }
  catch {
    log(`✘ ${before.sha.slice(0, 7)} is not on GitHub yet. Push the branch first (git push -u origin HEAD): the status is set on the pushed commit.`)
    return 1
  }

  const unlock = lock({ ...options, log })
  let code: number
  try {
    code = spawnSync('yarn', ['e2e'], { cwd: options.cwd, env: options.env, stdio: 'inherit' }).status ?? 1
  }
  finally {
    unlock()
  }

  const after = state(options)
  if (after.sha !== before.sha || after.dirty) {
    log(`✘ The checkout changed during the run (HEAD ${after.sha.slice(0, 7)}, ${after.dirty ? 'uncommitted changes' : 'clean'}), so the result describes no commit. Nothing recorded; run it again.`)
    return 1
  }
  const passed = code === 0
  out('gh', ['api', '--method', 'POST', `repos/${slug}/statuses/${before.sha}`,
    '-f', `state=${passed ? 'success' : 'failure'}`,
    '-f', `context=${E2E_CONTEXT}`,
    '-f', `description=yarn e2e ${passed ? 'passed' : 'failed'} locally (nuxt-harness e2e)`], options)
  log(passed
    ? `✔ e2e passed; "${E2E_CONTEXT}" set on ${before.sha.slice(0, 7)}.`
    : `✘ e2e failed (exit ${code}); "${E2E_CONTEXT}" set to failure on ${before.sha.slice(0, 7)}.`)
  return code
}

/** For CI: 0 when `sha` has a passing local e2e run, otherwise 1 with what to do. */
export function requireLocalE2e(sha: string, options: RunOptions): number {
  const log = options.log ?? console.log
  const slug = repoSlug(options)
  const result = out('gh', ['api', `repos/${slug}/commits/${sha}/status`, '--jq', `.statuses[] | select(.context == "${E2E_CONTEXT}") | .state`], options)
  if (result === 'success') {
    log(`✔ "${E2E_CONTEXT}" passed for ${sha.slice(0, 7)}.`)
    return 0
  }
  log(`✘ No passing "${E2E_CONTEXT}" for ${sha.slice(0, 7)} (${result || 'none'}). e2e runs on the developer's machine, not in CI: check out this commit, push it, run \`yarn nuxt-harness e2e\`, then re-run this job (\`gh run rerun <run-id> --failed\`). If no local run is possible, add the label ci:e2e to run e2e in CI instead.`)
  return 1
}
