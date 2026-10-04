import { siteSettings } from './siteSettings'
import { openingHours } from './openingHours'
import { event } from './event'
import { supplier } from './supplier'
import { christmasSettings, christmasCategory } from './christmas'
import { foodAndDrink } from './foodAndDrink'
import { visitPage } from './visitPage'

export const schemaTypes = [siteSettings, openingHours, event, supplier, christmasSettings, christmasCategory, foodAndDrink, visitPage]

// One-of-a-kind documents, edited from a fixed menu item rather than a list.
export const SINGLETONS = ['siteSettings', 'openingHours', 'christmasSettings', 'foodAndDrink', 'visitPage']
