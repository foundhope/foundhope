import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes, SINGLETONS } from './studio/schemaTypes'
import { structure } from './studio/structure'
import { helpTool } from './studio/helpTool'

export const projectId = '2opy1om7'
export const dataset = 'production'

export default defineConfig({
  name: 'default',
  title: 'Found Hope',
  projectId,
  dataset,
  plugins: [structureTool({ structure })],
  // "How to" tab: the editors' guide, also at /help on the website
  tools: (prev) => [...prev, helpTool],
  schema: {
    types: schemaTypes,
    // Hide one-of-a-kind documents from the "create new" menu
    templates: (templates) => templates.filter(({ schemaType }) => !SINGLETONS.includes(schemaType)),
  },
  document: {
    // No duplicate or delete on one-of-a-kind documents
    actions: (input, context) =>
      SINGLETONS.includes(context.schemaType)
        ? input.filter(({ action }) => action && ['publish', 'discardChanges', 'restore'].includes(action))
        : input,
  },
})
