import { addPluginTemplate, defineNuxtModule } from '@nuxt/kit'

/**
 * Marks <html data-hydrated="true"> once Nuxt has hydrated, for gotoHydrated() in e2e: clicks before
 * that are silently lost. app:suspense:resolve is the hook that also ends nuxtApp.isHydrating; it
 * fires in server-rendered and client-only apps alike.
 */
export default defineNuxtModule({
  meta: { name: '@driftkingtw/nuxt-harness' },
  setup() {
    addPluginTemplate({
      filename: 'nuxt-harness-hydrated.client.mjs',
      mode: 'client',
      getContents: () => `import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    document.documentElement.dataset.hydrated = 'true'
  })
})
`,
    })
  },
})
