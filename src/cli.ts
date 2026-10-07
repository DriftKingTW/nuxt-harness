#!/usr/bin/env node
// `yarn nuxt-harness <command>`, run from an app's root (its `yarn check` script calls it).
import { checkAdrs, readAdrInput } from './adrs.js'
import { localE2e, requireLocalE2e } from './local-e2e.js'

const [command, ...args] = process.argv.slice(2)
const usage = 'Usage: nuxt-harness check-adrs | e2e | require-local-e2e --sha <commit>'

if (command === 'check-adrs') {
  const input = await readAdrInput(process.cwd()).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
    console.error(`✘ ${error.path} is missing. Run this from the app's root; ADRs live in docs/decisions/ with a README.md index (see the nuxt-harness README).`)
    process.exit(1)
  })
  const errors = checkAdrs(input)
  if (errors.length) {
    console.error(`✘ ${errors.length} ADR problem(s):`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`ADRs ok (${Object.keys(input.files).length - 1} records, ${input.dependencies.length} dependencies covered)`)
}
else if (command === 'e2e' && !args.length) {
  process.exit(localE2e({ cwd: process.cwd() }))
}
else if (command === 'require-local-e2e' && args[0] === '--sha' && args[1]) {
  process.exit(requireLocalE2e(args[1], { cwd: process.cwd() }))
}
else {
  // e2e takes no arguments: a filtered run (--grep, one spec) must not mark the commit as passed.
  console.error(usage)
  process.exit(2)
}
