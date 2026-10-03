import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: { projectId: '2opy1om7', dataset: 'production' },
  // Served from the website itself at foundhope.store/studio
  project: { basePath: '/studio' },
  // Don't copy the website's public/ files (redirects, robots) into the Studio
  vite: (config) => ({ ...config, publicDir: false }),
})
