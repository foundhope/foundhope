import { defineField, defineType } from 'sanity'
import { CalendarIcon } from '@sanity/icons/Calendar'
import { money, photoField, timeField } from './shared'

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
    defineField({
      name: 'sellTickets',
      title: 'Sell tickets on the website',
      type: 'boolean',
      initialValue: false,
      description: 'Customers pay by card on Stripe and the money goes to the shop. This replaces the booking link above.',
    }),
    {
      ...money('ticketPrice', 'Ticket price', 'In pounds, per ticket, e.g. 25'),
      hidden: ({ document }: any) => !document?.sellTickets,
      validation: (rule: any) =>
        rule.custom((value: number | undefined, ctx: any) =>
          ctx.document?.sellTickets && !(value > 0) ? 'Add the price of one ticket' : true,
        ).precision(2),
    },
    defineField({
      name: 'ticketsAvailable',
      title: 'How many tickets in total (optional)',
      type: 'number',
      hidden: ({ document }: any) => !document?.sellTickets,
      description: 'The site stops selling when they are gone. Leave empty for no limit.',
      validation: (rule) => rule.integer().min(1),
    }),
    defineField({ name: 'showOnHome', title: 'Show on the home page', type: 'boolean', initialValue: true }),
  ],
  orderings: [{ title: 'Date, soonest first', name: 'dateAsc', by: [{ field: 'date', direction: 'asc' }] }],
  preview: {
    select: { title: 'title', date: 'date', start: 'start', media: 'image' },
    prepare: ({ title, date, start, media }) => ({ title, subtitle: [date, start].filter(Boolean).join(' · '), media }),
  },
})
