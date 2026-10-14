import { defineField, defineType } from 'sanity'
import { StarIcon } from '@sanity/icons/Star'

export const reviewSettings = defineType({
  name: 'reviewSettings',
  title: 'Reviews',
  type: 'document',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'pinned',
      title: 'Pinned review',
      description:
        'The latest 4 and 5 star Google reviews show on the home page by themselves. Fill this in to always show one you love first. Copy the words exactly as the customer wrote them. Leave the text empty to turn it off.',
      type: 'object',
      fields: [
        defineField({ name: 'name', title: 'Customer name', type: 'string' }),
        defineField({ name: 'stars', title: 'Stars', type: 'number', initialValue: 5, validation: (r) => r.min(1).max(5).integer() }),
        defineField({ name: 'text', title: 'Review text', type: 'text', rows: 5 }),
        defineField({ name: 'link', title: 'Link to the review on Google (optional)', type: 'url' }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Reviews' }) },
})
