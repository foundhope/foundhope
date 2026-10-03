import { defineArrayMember, defineField, defineType } from 'sanity'
import { ClockIcon } from '@sanity/icons/Clock'
import { timeField } from './shared'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const openingHours = defineType({
  name: 'openingHours',
  title: 'Opening hours',
  type: 'document',
  icon: ClockIcon,
  fields: [
    defineField({
      name: 'regular',
      title: 'Normal week',
      description: 'One row per group of days with the same hours. Shown on the home page and given to Google.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'hoursRow',
          fields: [
            defineField({
              name: 'days',
              title: 'How it reads on the site',
              type: 'string',
              description: 'e.g. "Wednesday to Saturday"',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'dayCodes',
              title: 'Which days',
              type: 'array',
              of: [{ type: 'string' }],
              options: { list: DAYS.map((d) => ({ title: d, value: d })), layout: 'grid' },
              validation: (rule) => rule.required().min(1),
            }),
            timeField('opens', 'Opens'),
            timeField('closes', 'Closes'),
          ],
          preview: {
            select: { title: 'days', opens: 'opens', closes: 'closes' },
            prepare: ({ title, opens, closes }) => ({ title, subtitle: `${opens ?? '?'} to ${closes ?? '?'}` }),
          },
        }),
      ],
    }),
    defineField({
      name: 'special',
      title: 'Special days',
      description: 'Bank holidays, Christmas, staff days. Each one disappears from the site after its date.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'specialDay',
          fields: [
            defineField({ name: 'date', title: 'Date', type: 'date', validation: (rule) => rule.required() }),
            defineField({ name: 'label', title: 'Name', type: 'string', description: 'e.g. "Christmas Eve" or "Staff training day"' }),
            defineField({ name: 'closed', title: 'Closed all day', type: 'boolean', initialValue: false }),
            { ...timeField('opens', 'Opens'), hidden: ({ parent }: any) => parent?.closed },
            { ...timeField('closes', 'Closes'), hidden: ({ parent }: any) => parent?.closed },
          ],
          preview: {
            select: { date: 'date', label: 'label', closed: 'closed', opens: 'opens', closes: 'closes' },
            prepare: ({ date, label, closed, opens, closes }) => ({
              title: [label, date].filter(Boolean).join(' · '),
              subtitle: closed ? 'Closed' : `${opens ?? '?'} to ${closes ?? '?'}`,
            }),
          },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Opening hours' }) },
})
