import { defineArrayMember, defineField, defineType } from 'sanity'
import { PinIcon } from '@sanity/icons/Pin'
import { photoField } from './shared'

// The Visit page. Address, phone and email come from "Notice banner and contact",
// and the hours from "Opening hours", so they only ever need changing in one place.
export const visitPage = defineType({
  name: 'visitPage',
  title: 'Visit page',
  type: 'document',
  icon: PinIcon,
  fields: [
    defineField({ name: 'intro', title: 'Intro', type: 'text', rows: 3 }),
    photoField('image', 'Photo of the shop'),
    defineField({
      name: 'gettingHere',
      title: 'Getting here',
      type: 'array',
      description: 'One card per way of getting here. Hidden if empty.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'route',
          fields: [
            defineField({
              name: 'mode',
              title: 'How',
              type: 'string',
              options: {
                list: [
                  { title: 'Train', value: 'train' },
                  { title: 'Bus', value: 'bus' },
                  { title: 'Walking', value: 'walk' },
                  { title: 'Bike', value: 'bike' },
                  { title: 'Car', value: 'car' },
                ],
                layout: 'radio',
                direction: 'horizontal',
              },
              validation: (rule) => rule.required(),
            }),
            defineField({ name: 'text', title: 'What to say', type: 'text', rows: 2, validation: (rule) => rule.required().max(200) }),
          ],
          preview: {
            select: { title: 'mode', subtitle: 'text' },
            prepare: ({ title, subtitle }) => ({ title: title ? title[0].toUpperCase() + title.slice(1) : 'Route', subtitle }),
          },
        }),
      ],
    }),
    defineField({
      name: 'goodToKnow',
      title: 'Good to know',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Short lines, e.g. "Dogs welcome" or "Step-free entrance". Hidden if empty.',
    }),
  ],
  preview: { prepare: () => ({ title: 'Visit page' }) },
})
