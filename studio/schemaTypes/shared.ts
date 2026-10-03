import { defineField } from 'sanity'

// A photo with focal point and a description for screen readers and Google.
export const photoField = (name = 'image', title = 'Photo', description?: string) =>
  defineField({
    name,
    title,
    type: 'image',
    description,
    options: { hotspot: true },
    fields: [
      defineField({
        name: 'alt',
        title: 'Describe the photo',
        type: 'string',
        description: 'A few words, e.g. "Sourdough loaves on the counter". Helps blind visitors and Google.',
        validation: (rule) => rule.required().warning('Add a short description of the photo'),
      }),
    ],
  })

// Times as 24-hour HH:MM, e.g. 07:00 or 19:30
export const timeField = (name: string, title: string, description?: string) =>
  defineField({
    name,
    title,
    type: 'string',
    description: description ?? '24-hour clock, e.g. 07:00 or 19:30',
    validation: (rule) =>
      rule.regex(/^([01]\d|2[0-3]):[0-5]\d$/, { name: 'time' }).error('Use the 24-hour clock, e.g. 07:00 or 19:30'),
  })

export const money = (name: string, title: string, description?: string) =>
  defineField({
    name,
    title,
    type: 'number',
    description: description ?? 'In pounds, e.g. 24 or 52.50',
    validation: (rule) => rule.min(0).precision(2),
  })
