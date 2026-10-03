// One place the pages read content from.
// Today it reads the JSON files in src/data. When Sanity is set up, these
// functions switch to Sanity queries and the pages don't need to change.

import type { ImageMetadata } from 'astro';
import settings from '../data/settings.json';
import hours from '../data/hours.json';
import christmas from '../data/christmas.json';
import suppliers from '../data/suppliers.json';
import reviews from '../data/reviews.json';
import home from '../data/home.json';
import christmasMenu from '../data/christmas-menu.json';

export const getSettings = () => settings;
export const getHours = () => hours;
export const getHome = () => home;
export const getReviews = () => reviews;
export const getSuppliers = () => suppliers;
export const getChristmasMenu = () => christmasMenu;
export const getHomeSuppliers = () => suppliers.filter((s) => s.onHome);

// Images live in src/assets/images and are referred to by file name (no extension).
const imageFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

export function img(name: string): ImageMetadata {
  const hit = Object.entries(imageFiles).find(([path]) =>
    path.split('/').pop()!.replace(/\.[^.]+$/, '') === name,
  );
  if (!hit) throw new Error(`Image "${name}" not found in src/assets/images`);
  return hit[1].default;
}

// Headlines use *word* for the italic bit, e.g. "Come and *say hello*".
export function emphasis(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  return day(iso).toLocaleDateString('en-GB', { ...opts, timeZone: 'Europe/London' });
}

// Christmas: shown from the day it's switched on until the last collection day.
export function getChristmas(today = new Date()) {
  const c = christmas;
  const lastCollection = c.collectionDates[c.collectionDates.length - 1];
  const live = c.on && today <= day(lastCollection);
  const onlineOpen = today <= day(c.onlineOrderCutoff);
  const depositPercent = Math.round(c.depositRate * 100);
  const collectionDays = c.collectionDates.map((d) => formatDate(d, { day: 'numeric' }));
  const collectionMonth = formatDate(lastCollection, { month: 'long' });
  return {
    ...c,
    live,
    onlineOpen,
    depositPercent,
    onlineCutoffText: formatDate(c.onlineOrderCutoff),
    inShopCutoffText: formatDate(c.inShopOrderCutoff),
    refundCutoffText: formatDate(c.refundCutoff),
    collectionText: `${collectionDays.slice(0, -1).join(', ')} or ${collectionDays.at(-1)} ${collectionMonth}, by ${c.collectionBy}`,
  };
}

export const money = (pence: number) =>
  `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
