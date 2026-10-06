#!/usr/bin/env node
// `yarn nuxt-harness <command>`, run from an app's root (its `yarn check` script calls it).
import { checkAdrs, readAdrInput } from './adrs.js'

const [command] = process.argv.slice(2)

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
else {
  console.error('Usage: nuxt-harness check-adrs')
  process.exit(2)
}
