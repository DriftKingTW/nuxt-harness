import { describe, expect, it } from 'vitest'
import { checkAdrs } from '../src/adrs.js'

const adr = (num: string, title: string, extra = '') => `# ${num}: ${title}

Status: accepted · Date: 2026-09-27

## Context
c
## Options
o
## Decision
Uses \`zod\`. ${extra}
## Consequences
x
`

const valid = () => ({
  files: {
    'README.md': '| [0001](0001-first.md) | First | accepted |\n| [0002](0002-second.md) | Second | accepted |',
    '0001-first.md': adr('0001', 'First'),
    '0002-second.md': adr('0002', 'Second'),
  } as Record<string, string>,
  dependencies: ['zod'],
})

describe('checkAdrs', () => {
  it('accepts well-formed records', () => {
    expect(checkAdrs(valid())).toEqual([])
  })

  it('requires every dependency to be named in an ADR', () => {
    const input = { ...valid(), dependencies: ['zod', 'left-pad'] }
    expect(checkAdrs(input)).toEqual([expect.stringContaining('`left-pad` is not named in any ADR')])
  })

  it('requires the MADR-lite sections and a status line', () => {
    const input = valid()
    input.files['0002-second.md'] = '# 0002: Second\n\n## Context\nonly context\n'
    const errors = checkAdrs(input)
    expect(errors).toContainEqual(expect.stringContaining('needs a line "Status:'))
    expect(errors).toContainEqual(expect.stringContaining('missing section "## Options"'))
  })

  it('requires index entries and contiguous numbers', () => {
    const input = valid()
    input.files['0004-gap.md'] = adr('0004', 'Gap')
    const errors = checkAdrs(input)
    expect(errors).toContainEqual(expect.stringContaining('contiguous'))
    expect(errors).toContainEqual(expect.stringContaining('0004-gap.md: not listed'))
  })

  it('checks that a superseding ADR exists', () => {
    const input = valid()
    input.files['0001-first.md'] = adr('0001', 'First').replace('Status: accepted', 'Status: superseded by 0009')
    expect(checkAdrs(input)).toContainEqual(expect.stringContaining('superseded by 0009, which does not exist'))
  })
})
