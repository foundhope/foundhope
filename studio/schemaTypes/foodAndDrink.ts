import { defineArrayMember, defineField, defineType } from 'sanity'
import { LemonIcon } from '@sanity/icons/Lemon'
import { money, photoField } from './shared'

const DIETARY = [
  { title: 'Vegetarian (V)', value: 'V' },
  { title: 'Vegan (VG)', value: 'VG' },
  { title: 'Gluten free (GF)', value: 'GF' },
]

// One line on a menu: name, a few words, price.
const menuItem = (withDietary = false) =>
  defineArrayMember({
    type: 'object',
    name: withDietary ? 'dish' : 'drink',
    fields: [
      defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
      defineField({ name: 'detail', title: 'Description (optional)', type: 'string' }),
      { ...money('price', 'Price (optional)', 'In pounds, e.g. 3.40. Leave empty to show no price.') },
      ...(withDietary
        ? [
            defineField({
              name: 'dietary',
              title: 'Dietary',
              type: 'array',
              of: [{ type: 'string' }],
              options: { list: DIETARY, layout: 'grid' },
            }),
          ]
        : []),
      defineField({ name: 'available', title: 'On the menu', type: 'boolean', initialValue: true, description: 'Turn off to hide it without deleting it.' }),
    ],
    preview: {
      select: { title: 'name', price: 'price', available: 'available' },
      prepare: ({ title, price, available }) => ({
        title: `${available === false ? '[Hidden] ' : ''}${title}`,
        subtitle: price != null ? `£${Number(price).toFixed(2)}` : '',
      }),
    },
  })

export const foodAndDrink = defineType({
  name: 'foodAndDrink',
  title: 'Food & Drink page',
  type: 'document',
  icon: LemonIcon,
  groups: [
    { name: 'intro', title: 'Intro', default: true },
    { name: 'coffee', title: 'Coffee' },
    { name: 'kitchen', title: 'Kitchen' },
    { name: 'counters', title: 'The counters' },
    { name: 'wine', title: 'Wine' },
    { name: 'madeByUs', title: 'Made by us' },
  ],
  fields: [
    defineField({ name: 'intro', title: 'Intro', type: 'text', rows: 3, group: 'intro' }),

    // Coffee
    defineField({ name: 'coffeeText', title: 'About the coffee', type: 'text', rows: 3, group: 'coffee' }),
    { ...photoField('coffeeImage', 'Coffee photo'), group: 'coffee' },
    defineField({ name: 'coffeeMenu', title: 'Drinks menu', type: 'array', of: [menuItem()], group: 'coffee' }),
    defineField({ name: 'coffeeNote', title: 'Small print under the menu', type: 'string', group: 'coffee', description: 'e.g. "Oat milk at no extra cost"' }),

    // Kitchen
    defineField({ name: 'kitchenText', title: 'About the kitchen', type: 'text', rows: 3, group: 'kitchen' }),
    defineField({ name: 'kitchenHours', title: 'When food is served', type: 'string', group: 'kitchen', description: 'e.g. "Breakfast till 11:30, lunch 12 till 3"' }),
    { ...photoField('kitchenImage', 'Kitchen photo'), group: 'kitchen' },
    defineField({
      name: 'kitchenMode',
      title: 'How to show the menu',
      type: 'string',
      group: 'kitchen',
      options: {
        list: [
          { title: 'Typed list (below)', value: 'list' },
          { title: 'Photo of the chalkboard', value: 'board' },
        ],
        layout: 'radio',
      },
      initialValue: 'list',
    }),
    defineField({
      name: 'kitchenMenu',
      title: 'Food menu',
      type: 'array',
      of: [menuItem(true)],
      group: 'kitchen',
      hidden: ({ document }) => document?.kitchenMode === 'board',
    }),
    {
      ...photoField('kitchenBoard', 'Chalkboard photo', 'Snap the board and upload it. Make sure it\'s readable.'),
      group: 'kitchen',
      hidden: ({ document }: any) => document?.kitchenMode !== 'board',
    },

    // Counters
    defineField({
      name: 'counters',
      title: 'The counters',
      description: 'Cheese, fruit and veg, meat, bakery, pantry: what people can buy to take home.',
      type: 'array',
      group: 'counters',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'counter',
          fields: [
            defineField({ name: 'title', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'text', title: 'Two lines about it', type: 'text', rows: 2, validation: (rule) => rule.max(180) }),
            photoField(),
            defineField({ name: 'supplier', title: 'Main supplier (optional)', type: 'reference', to: [{ type: 'supplier' }] }),
          ],
          preview: { select: { title: 'title', subtitle: 'supplier.name', media: 'image' } },
        }),
      ],
    }),

    // Wine
    defineField({ name: 'wineText', title: 'About the wine', type: 'text', rows: 3, group: 'wine' }),
    { ...photoField('wineImage', 'Wine photo'), group: 'wine' },
    defineField({
      name: 'picksOn',
      title: 'Show "Johan\'s picks"',
      type: 'boolean',
      group: 'wine',
      initialValue: false,
      description: 'Up to 3 bottles, changed each month. Leave off if nobody has time to keep it fresh.',
    }),
    defineField({
      name: 'picksTitle',
      title: 'Picks heading',
      type: 'string',
      group: 'wine',
      initialValue: "Johan's picks",
      hidden: ({ document }) => !document?.picksOn,
    }),
    defineField({
      name: 'picks',
      title: 'The bottles',
      type: 'array',
      group: 'wine',
      hidden: ({ document }) => !document?.picksOn,
      validation: (rule) => rule.max(3),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'bottle',
          fields: [
            defineField({ name: 'name', title: 'Wine', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'producer', title: 'Producer and region', type: 'string', description: 'e.g. "Domaine X, Loire"' }),
            defineField({ name: 'note', title: 'Why it\'s good', type: 'string', validation: (rule) => rule.max(140) }),
            money('price', 'Price (optional)'),
            photoField(),
          ],
          preview: { select: { title: 'name', subtitle: 'producer', media: 'image' } },
        }),
      ],
    }),

    // Made by us
    defineField({ name: 'madeByUsText', title: 'About what we make', type: 'text', rows: 2, group: 'madeByUs' }),
    defineField({
      name: 'products',
      title: 'Products',
      type: 'array',
      group: 'madeByUs',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'product',
          fields: [
            defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'detail', title: 'Description', type: 'string' }),
            defineField({
              name: 'varieties',
              title: 'Flavours or styles (optional)',
              type: 'array',
              of: [{ type: 'string' }],
              description: 'e.g. the five pickles, or cup and mug',
            }),
            money('price', 'Price (optional)'),
            defineField({ name: 'priceNote', title: 'Price note (optional)', type: 'string', description: 'e.g. "per jar" or "from"' }),
            photoField(),
            defineField({
              name: 'season',
              title: 'When it\'s available',
              type: 'string',
              options: { list: [{ title: 'All year', value: 'all' }, { title: 'Christmas only', value: 'christmas' }], layout: 'radio' },
              initialValue: 'all',
            }),
            defineField({ name: 'available', title: 'Show on the site', type: 'boolean', initialValue: true }),
          ],
          preview: { select: { title: 'name', subtitle: 'detail', media: 'image' } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Food & Drink page' }) },
})
