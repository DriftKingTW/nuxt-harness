// Validates an app's architecture decision records in docs/decisions (MADR-lite, indexed in
// README.md), and that every dependency in package.json is named in one of them.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const FILE_RE = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const STATUS_RE = /^Status: (proposed|accepted|deprecated|superseded by (\d{4})) · Date: \d{4}-\d{2}-\d{2}$/m
const SECTIONS = ['## Context', '## Options', '## Decision', '## Consequences']
const HOW_TO = 'See docs/decisions/README.md for the template.'

export interface AdrInput {
  /** File name -> content, for every file in docs/decisions. */
  files: Record<string, string>
  /** Direct dependencies + devDependencies from package.json. */
  dependencies: string[]
}

export function checkAdrs({ files, dependencies }: AdrInput): string[] {
  const errors: string[] = []
  const index = files['README.md'] ?? ''
  if (!index) errors.push('docs/decisions/README.md (index) is missing.')

  const adrs = Object.keys(files).filter(f => f !== 'README.md').sort()

  for (const [i, name] of adrs.entries()) {
    const m = FILE_RE.exec(name)
    if (!m) {
      errors.push(`${name}: file name must be NNNN-kebab-title.md.`)
      continue
    }
    const num = m[1]!
    if (Number(num) !== i + 1) errors.push(`${name}: ADR numbers must be contiguous from 0001 (expected ${String(i + 1).padStart(4, '0')}).`)

    const body = files[name]!
    if (!body.startsWith(`# ${num}: `)) errors.push(`${name}: first line must be "# ${num}: <Title>".`)
    const status = STATUS_RE.exec(body)
    if (!status) errors.push(`${name}: needs a line "Status: proposed|accepted|deprecated|superseded by NNNN · Date: YYYY-MM-DD". ${HOW_TO}`)
    for (const section of SECTIONS) {
      if (!body.split('\n').includes(section)) errors.push(`${name}: missing section "${section}". ${HOW_TO}`)
    }
    if (!index.includes(`(${name})`)) errors.push(`${name}: not listed in docs/decisions/README.md index. Add a row linking (${name}).`)
    if (status?.[2]) {
      const target = status[2]
      if (!adrs.some(a => a.startsWith(`${target}-`))) errors.push(`${name}: superseded by ${target}, which does not exist.`)
    }
  }

  for (const link of index.matchAll(/\]\(([^)]+\.md)\)/g)) {
    if (!(link[1]! in files)) errors.push(`README.md links to ${link[1]}, which does not exist.`)
  }

  const allText = adrs.map(a => files[a]!).join('\n')
  for (const dep of dependencies) {
    if (!allText.includes(`\`${dep}\``)) {
      errors.push(`package.json dependency \`${dep}\` is not named in any ADR. Explain why it is needed: add it (in backticks) to the ADR that covers it, or write a new ADR. See ADR 0001.`)
    }
  }
  return errors
}

/** Reads docs/decisions and package.json under `root` for checkAdrs. */
export async function readAdrInput(root: string): Promise<AdrInput> {
  const dir = join(root, 'docs/decisions')
  const names = (await readdir(dir)).filter(f => f.endsWith('.md'))
  const files = Object.fromEntries(await Promise.all(names.map(async n => [n, await readFile(join(dir, n), 'utf8')] as const)))
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  return { files, dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }) }
}
