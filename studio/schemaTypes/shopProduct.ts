import { defineField, defineType } from 'sanity'
import { TagIcon } from '@sanity/icons/Tag'
import { money, photoField } from './shared'

// Things sold online and collected from the shop, e.g. tote bags.
export const shopProduct = defineType({
  name: 'shopProduct',
  title: 'Shop item',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', description: 'e.g. Found Hope tote bag', validation: (rule) => rule.required() }),
    { ...money('price', 'Price', 'In pounds, e.g. 25'), validation: (rule: any) => rule.required().min(0.5).precision(2) },
    defineField({ name: 'description', title: 'What it is', type: 'text', rows: 3, validation: (rule) => rule.max(300) }),
    photoField(),
    defineField({
      name: 'available',
      title: 'Available to buy',
      type: 'boolean',
      initialValue: true,
      description: 'Turn off when sold out. The site shows "Sold out" and no Buy button.',
    }),
    defineField({
      name: 'show',
      title: 'Show on the website',
      type: 'boolean',
      initialValue: true,
      description: 'Off hides it from the Shop page completely.',
    }),
    defineField({ name: 'order', title: 'Position on the page', type: 'number', description: 'Lower numbers show first', initialValue: 10 }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: { title: 'name', price: 'price', available: 'available', media: 'image' },
    prepare: ({ title, price, available, media }) => ({
      title: `${available === false ? '[Sold out] ' : ''}${title}`,
      subtitle: price != null ? `£${price}` : '',
      media,
    }),
  },
})
