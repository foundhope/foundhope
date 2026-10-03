import { defineArrayMember, defineField, defineType } from 'sanity'
import { StarIcon } from '@sanity/icons/Star'
import { BasketIcon } from '@sanity/icons/Basket'
import { money, photoField } from './shared'

export const christmasSettings = defineType({
  name: 'christmasSettings',
  title: 'Christmas: dates and deposit',
  type: 'document',
  icon: StarIcon,
  groups: [
    { name: 'dates', title: 'Dates and deposit', default: true },
    { name: 'page', title: 'Page text' },
    { name: 'truffles', title: 'Truffle chocolates' },
  ],
  fields: [
    defineField({
      name: 'on',
      title: 'Christmas orders are open',
      description: 'Turns the Christmas page, the home page Christmas section and the top banner on or off. Everything also hides itself after the last collection day.',
      type: 'boolean',
      group: 'dates',
    }),
    defineField({ name: 'year', title: 'Year', type: 'number', group: 'dates', validation: (rule) => rule.required().integer() }),
    defineField({
      name: 'depositPercent',
      title: 'Deposit (%)',
      type: 'number',
      group: 'dates',
      description: 'Taken online to confirm an order. 50 means half.',
      validation: (rule) => rule.required().min(0).max(100).integer(),
    }),
    defineField({
      name: 'onlineOrderCutoff',
      title: 'Last day to order online',
      type: 'date',
      group: 'dates',
      description: 'The order form closes itself after this day.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'refundCutoff',
      title: 'Last day to cancel for a full refund',
      type: 'date',
      group: 'dates',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'inShopOrderCutoff', title: 'Last day to order in the shop', type: 'date', group: 'dates', validation: (rule) => rule.required() }),
    defineField({
      name: 'collectionDates',
      title: 'Collection days',
      type: 'array',
      group: 'dates',
      of: [defineArrayMember({ type: 'date' })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({ name: 'collectionBy', title: 'Collect by', type: 'string', group: 'dates', description: 'e.g. 4:30pm' }),
    defineField({ name: 'ordersEmail', title: 'Orders go to', type: 'string', group: 'dates', validation: (rule) => rule.required().email() }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 3,
      group: 'page',
      description: 'The first line on the Christmas page and the home page Christmas section.',
    }),
    { ...photoField('heroImage', 'Main photo', 'The big photo at the top of the Christmas page.'), group: 'page' },
    defineField({ name: 'truffleText', title: 'Truffles: description', type: 'string', group: 'truffles' }),
    defineField({ name: 'truffleFlavours', title: 'Truffles: flavours', type: 'array', of: [{ type: 'string' }], group: 'truffles' }),
    defineField({
      name: 'truffleFlavourCount',
      title: 'Truffles: how many flavours in total',
      type: 'number',
      group: 'truffles',
      description: 'While some flavours are still to be named, the page shows "+ 3 more coming".',
    }),
    { ...money('trufflePrice', 'Truffles: price per box', 'In pounds. Leave empty to show "Price coming soon".'), group: 'truffles' },
    { ...photoField('truffleImage', 'Truffles: photo'), group: 'truffles' },
  ],
  preview: { prepare: () => ({ title: 'Christmas: dates and deposit' }) },
})

export const christmasCategory = defineType({
  name: 'christmasCategory',
  title: 'Christmas list section',
  type: 'document',
  icon: BasketIcon,
  fields: [
    defineField({ name: 'title', title: 'Section name', type: 'string', description: 'e.g. Turkey, From our kitchen', validation: (rule) => rule.required() }),
    defineField({ name: 'source', title: 'Small line next to the name', type: 'string', description: 'e.g. Sladesdown Poultry, Devon' }),
    defineField({ name: 'blurb', title: 'Short description', type: 'text', rows: 2 }),
    photoField(),
    defineField({ name: 'order', title: 'Position on the page', type: 'number', description: 'Lower numbers show first', initialValue: 10 }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'christmasItem',
          fields: [
            defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'detail', title: 'Detail', type: 'string', description: 'e.g. "Serves 4" or "About 1.5kg per rib"' }),
            defineField({
              name: 'pricing',
              title: 'How is it priced?',
              type: 'string',
              options: {
                list: [
                  { title: 'Fixed price', value: 'fixed' },
                  { title: 'By weight, chosen by size', value: 'weight' },
                ],
                layout: 'radio',
              },
              initialValue: 'fixed',
              validation: (rule) => rule.required(),
            }),
            { ...money('price', 'Price'), hidden: ({ parent }: any) => parent?.pricing !== 'fixed' },
            { ...money('perKg', 'Price per kg', 'Shown as a guide, e.g. £24/kg'), hidden: ({ parent }: any) => parent?.pricing !== 'weight' },
            defineField({
              name: 'sizes',
              title: 'Sizes',
              description: 'Each size with its approximate price. The final price is worked out when it\'s weighed.',
              type: 'array',
              hidden: ({ parent }: any) => parent?.pricing !== 'weight',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'size',
                  fields: [
                    defineField({ name: 'label', title: 'Size', type: 'string', description: 'e.g. 4–5kg or 2 ribs (3kg)', validation: (rule) => rule.required() }),
                    { ...money('price', 'Approx price'), validation: (rule: any) => rule.required().min(0).precision(2) },
                  ],
                  preview: {
                    select: { title: 'label', price: 'price' },
                    prepare: ({ title, price }) => ({ title, subtitle: price != null ? `approx £${price}` : '' }),
                  },
                }),
              ],
            }),
            defineField({ name: 'available', title: 'Available to order', type: 'boolean', initialValue: true, description: 'Turn off when sold out.' }),
            defineField({
              name: 'checkPrice',
              title: 'Price still to confirm',
              type: 'boolean',
              initialValue: false,
              description: 'A reminder for us. Not shown on the site.',
            }),
          ],
          preview: {
            select: { title: 'name', pricing: 'pricing', price: 'price', perKg: 'perKg', available: 'available', check: 'checkPrice' },
            prepare: ({ title, pricing, price, perKg, available, check }) => ({
              title: `${available === false ? '[Sold out] ' : ''}${title}${check ? '  (check price)' : ''}`,
              subtitle: pricing === 'weight' ? `By size · £${perKg ?? '?'}/kg` : price != null ? `£${price}` : '',
            }),
          },
        }),
      ],
    }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: { title: 'title', subtitle: 'source', media: 'image' },
  },
})
