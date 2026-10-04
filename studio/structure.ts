import type { StructureResolver } from 'sanity/structure'
import { CogIcon } from '@sanity/icons/Cog'
import { ClockIcon } from '@sanity/icons/Clock'
import { CalendarIcon } from '@sanity/icons/Calendar'
import { StarIcon } from '@sanity/icons/Star'
import { BasketIcon } from '@sanity/icons/Basket'
import { UsersIcon } from '@sanity/icons/Users'
import { LemonIcon } from '@sanity/icons/Lemon'

export const structure: StructureResolver = (S) => {
  const single = (type: string, title: string, icon: any) =>
    S.listItem().title(title).id(type).icon(icon).child(S.document().schemaType(type).documentId(type).title(title))

  return S.list()
    .title('Found Hope website')
    .items([
      single('siteSettings', 'Notice banner and contact', CogIcon),
      single('openingHours', 'Opening hours', ClockIcon),
      S.listItem()
        .title('Events')
        .icon(CalendarIcon)
        .child(
          S.documentTypeList('event')
            .title('Events')
            .defaultOrdering([{ field: 'date', direction: 'desc' }]),
        ),
      S.divider(),
      single('foodAndDrink', 'Food & Drink page', LemonIcon),
      S.listItem()
        .title('Christmas')
        .icon(StarIcon)
        .child(
          S.list()
            .title('Christmas')
            .items([
              single('christmasSettings', 'Dates, deposit and truffles', StarIcon),
              S.listItem()
                .title('The Christmas list')
                .icon(BasketIcon)
                .child(
                  S.documentTypeList('christmasCategory')
                    .title('The Christmas list')
                    .defaultOrdering([{ field: 'order', direction: 'asc' }]),
                ),
            ]),
        ),
      S.divider(),
      S.listItem()
        .title('Suppliers')
        .icon(UsersIcon)
        .child(S.documentTypeList('supplier').title('Suppliers').defaultOrdering([{ field: 'order', direction: 'asc' }])),
    ])
}
