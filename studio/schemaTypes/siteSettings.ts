import { defineField, defineType } from 'sanity'
import { CogIcon } from '@sanity/icons/Cog'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Notice banner and contact details',
  type: 'document',
  icon: CogIcon,
  groups: [
    { name: 'banner', title: 'Notice banner', default: true },
    { name: 'contact', title: 'Contact details' },
  ],
  fields: [
    defineField({
      name: 'noticeBanner',
      title: 'Notice banner',
      description: 'The blue strip across the top of every page. Turn it on for things like "Closed Monday for a staff day". When it\'s off, the Christmas banner shows during the season instead.',
      type: 'object',
      group: 'banner',
      fields: [
        defineField({ name: 'on', title: 'Show the banner', type: 'boolean', initialValue: false }),
        defineField({
          name: 'message',
          title: 'Message',
          type: 'string',
          validation: (rule) => rule.max(90).warning('Keep it short, under 90 characters'),
        }),
        defineField({
          name: 'link',
          title: 'Link (optional)',
          type: 'string',
          description: 'A page on the site like /christmas, or a full web address',
        }),
      ],
    }),
    defineField({ name: 'phone', title: 'Phone number', type: 'string', group: 'contact' }),
    defineField({ name: 'email', title: 'Main email', type: 'string', group: 'contact', validation: (rule) => rule.email() }),
    defineField({
      name: 'address',
      title: 'Address',
      type: 'object',
      group: 'contact',
      fields: [
        defineField({ name: 'street', title: 'Street', type: 'string' }),
        defineField({ name: 'city', title: 'City', type: 'string' }),
        defineField({ name: 'postcode', title: 'Postcode', type: 'string' }),
      ],
    }),
    defineField({
      name: 'socials',
      title: 'Social media',
      type: 'object',
      group: 'contact',
      fields: [
        defineField({ name: 'instagram', title: 'Instagram link', type: 'url' }),
        defineField({ name: 'facebook', title: 'Facebook link', type: 'url' }),
        defineField({ name: 'x', title: 'X (Twitter) link', type: 'url' }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Notice banner and contact details' }) },
})
