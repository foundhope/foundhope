import { defineField, defineType } from 'sanity'
import { CalendarIcon } from '@sanity/icons/Calendar'
import { photoField, timeField } from './shared'

export const event = defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({ name: 'title', title: 'Name of the event', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description: 'The event drops off the site by itself after this day.',
      validation: (rule) => rule.required(),
    }),
    { ...timeField('start', 'Starts'), validation: (rule: any) => rule.required() },
    timeField('end', 'Finishes (optional)'),
    defineField({ name: 'description', title: 'What it is', type: 'text', rows: 3, validation: (rule) => rule.required().max(300) }),
    photoField(),
    defineField({ name: 'price', title: 'Price (optional)', type: 'string', description: 'e.g. "£25" or "Free"' }),
    defineField({
      name: 'bookingUrl',
      title: 'Booking link (optional)',
      type: 'url',
      description: 'Leave empty and the site says "Just turn up. No need to book."',
    }),
    defineField({ name: 'showOnHome', title: 'Show on the home page', type: 'boolean', initialValue: true }),
  ],
  orderings: [{ title: 'Date, soonest first', name: 'dateAsc', by: [{ field: 'date', direction: 'asc' }] }],
  preview: {
    select: { title: 'title', date: 'date', start: 'start', media: 'image' },
    prepare: ({ title, date, start, media }) => ({ title, subtitle: [date, start].filter(Boolean).join(' · '), media }),
  },
})
