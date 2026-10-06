// @ts-check
// The same style as the Nuxt apps that use this package (@nuxt/eslint with stylistic).
import { createConfigForNuxt } from '@nuxt/eslint-config'

export default createConfigForNuxt({ features: { stylistic: true } })
  .prepend({ ignores: ['dist/**'] })
