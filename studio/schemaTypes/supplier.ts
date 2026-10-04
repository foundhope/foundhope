import { defineArrayMember, defineField, defineType } from 'sanity'
import { UsersIcon } from '@sanity/icons/Users'
import { money, photoField } from './shared'

export const supplier = defineType({
  name: 'supplier',
  title: 'Supplier',
  type: 'document',
  icon: UsersIcon,
  groups: [
    { name: 'card', title: 'Card and basics', default: true },
    { name: 'page', title: 'Their page' },
  ],
  fields: [
    // Card and basics
    defineField({ name: 'name', title: 'Name', type: 'string', group: 'card', validation: (rule) => rule.required() }),
    defineField({
      name: 'slug',
      title: 'Web address',
      type: 'slug',
      group: 'card',
      description: 'Click Generate. Their page will be foundhope.store/suppliers/this-bit. Don\'t change it once the page is live.',
      options: { source: 'name', maxLength: 60 },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'type', title: 'What they do', type: 'string', group: 'card', description: 'e.g. Coffee roaster, Bakery, Wine importer' }),
    defineField({ name: 'from', title: 'Where they\'re from', type: 'string', group: 'card', description: 'e.g. Southwark, Cumbria' }),
    defineField({ name: 'teaser', title: 'One line about them', type: 'string', group: 'card', validation: (rule) => rule.max(90) }),
    { ...photoField(), group: 'card' },
    defineField({ name: 'website', title: 'Their website', type: 'url', group: 'card' }),
    defineField({ name: 'servedHere', title: 'Used in our kitchen or coffee bar', type: 'boolean', group: 'card', initialValue: false }),
    defineField({ name: 'takeHome', title: 'Sold in the shop to take home', type: 'boolean', group: 'card', initialValue: true }),
    defineField({ name: 'onHome', title: 'Show on the home page', type: 'boolean', group: 'card', initialValue: false, description: 'Up to 3 show on the home page.' }),
    defineField({ name: 'order', title: 'Position', type: 'number', group: 'card', description: 'Lower numbers show first', initialValue: 10 }),
    defineField({
      name: 'show',
      title: 'Show on the website',
      type: 'boolean',
      group: 'card',
      initialValue: true,
      description: 'Turn off to hide them and their page without deleting anything.',
    }),

    // Their page
    defineField({
      name: 'about',
      title: 'About them',
      type: 'text',
      rows: 6,
      group: 'page',
      description: 'Who they are and what they make. Leave a blank line between paragraphs.',
    }),
    defineField({
      name: 'quote',
      title: 'A line from Nick (optional)',
      type: 'text',
      rows: 2,
      group: 'page',
      description: 'In Nick\'s own words: why they\'re in the shop. Shown big.',
      validation: (rule) => rule.max(160),
    }),
    defineField({ name: 'quoteBy', title: 'Who said it', type: 'string', group: 'page', initialValue: 'Nick, Found Hope' }),
    defineField({
      name: 'story',
      title: 'How we work with them',
      type: 'text',
      rows: 4,
      group: 'page',
      description: 'How long, what we use, what you can take home. Leave a blank line between paragraphs.',
    }),
    defineField({
      name: 'products',
      title: 'In the shop now (optional)',
      type: 'array',
      group: 'page',
      description: 'Up to 6 things of theirs you can buy. Hidden if empty.',
      validation: (rule) => rule.max(6),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'supplierProduct',
          fields: [
            defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'detail', title: 'A few words (optional)', type: 'string' }),
            money('price', 'Price (optional)'),
            photoField(),
            defineField({ name: 'available', title: 'In stock', type: 'boolean', initialValue: true }),
          ],
          preview: { select: { title: 'name', subtitle: 'detail', media: 'image' } },
        }),
      ],
    }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: { title: 'name', type: 'type', from: 'from', media: 'image', show: 'show' },
    prepare: ({ title, type, from, media, show }) => ({
      title: `${show === false ? '[Hidden] ' : ''}${title}`,
      subtitle: [type, from].filter(Boolean).join(' · '),
      media,
    }),
  },
})
