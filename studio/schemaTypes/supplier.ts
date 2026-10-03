import { defineField, defineType } from 'sanity'
import { UsersIcon } from '@sanity/icons/Users'
import { photoField } from './shared'

export const supplier = defineType({
  name: 'supplier',
  title: 'Supplier',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'slug',
      title: 'Web address',
      type: 'slug',
      description: 'Click Generate. Their page will be foundhope.store/suppliers/this-bit',
      options: { source: 'name', maxLength: 60 },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'type', title: 'What they do', type: 'string', description: 'e.g. Coffee, Bakery, Wine' }),
    defineField({ name: 'from', title: 'Where they\'re from', type: 'string', description: 'e.g. Southwark, Cumbria' }),
    defineField({ name: 'teaser', title: 'One line about them', type: 'string', validation: (rule) => rule.max(90) }),
    photoField(),
    defineField({ name: 'website', title: 'Their website', type: 'url' }),
    defineField({ name: 'servedHere', title: 'Used in our kitchen or coffee bar', type: 'boolean', initialValue: false }),
    defineField({ name: 'takeHome', title: 'Sold in the shop to take home', type: 'boolean', initialValue: true }),
    defineField({ name: 'onHome', title: 'Show on the home page', type: 'boolean', initialValue: false, description: 'Up to 3 show on the home page.' }),
    defineField({ name: 'order', title: 'Position', type: 'number', description: 'Lower numbers show first', initialValue: 10 }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: { title: 'name', type: 'type', from: 'from', media: 'image' },
    prepare: ({ title, type, from, media }) => ({ title, subtitle: [type, from].filter(Boolean).join(' · '), media }),
  },
})
