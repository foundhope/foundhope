// One place the pages read content from.
//
// Editable content (notice banner, contact details, opening hours, events,
// suppliers, Christmas) comes from Sanity, fetched once per build.
// Fixed copy that isn't edited in Sanity yet (home page text, Our Story) still
// lives in src/data. If Sanity can't be reached the build fails on purpose,
// so Cloudflare keeps the last good version of the site live.

import type { ImageMetadata } from 'astro';
import { createClient } from '@sanity/client';
import siteDefaults from '../data/settings.json';
import siteConfig from '../data/christmas.json';
import reviews from '../data/reviews.json';
import home from '../data/home.json';

export const sanity = createClient({
  projectId: '2opy1om7',
  dataset: 'production',
  apiVersion: '2025-02-19',
  useCdn: false,
  perspective: 'published',
});

// ---------- Types ----------

export type SanityImage = {
  _type?: 'image';
  alt?: string;
  asset?: { _id: string; metadata?: { dimensions?: { width: number; height: number }; lqip?: string } };
  hotspot?: { x: number; y: number; width: number; height: number };
  crop?: { top: number; bottom: number; left: number; right: number };
};

export type ShopEvent = {
  _id: string;
  title: string;
  date: string;
  start?: string;
  end?: string;
  description?: string;
  image?: SanityImage;
  price?: string;
  bookingUrl?: string;
  showOnHome?: boolean;
};

export type Supplier = {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  from?: string;
  teaser?: string;
  image?: SanityImage;
  website?: string;
  servedHere?: boolean;
  takeHome?: boolean;
  onHome?: boolean;
};

type SanityItem = {
  _key: string;
  name: string;
  detail?: string;
  pricing: 'fixed' | 'weight';
  price?: number;
  perKg?: number;
  sizes?: { _key: string; label: string; price: number }[];
  available?: boolean;
};

// ---------- Fetch everything once per build ----------

const IMAGE = `{ ..., asset->{ _id, metadata { dimensions, lqip } } }`;

const QUERY = `{
  "settings": *[_id == "siteSettings"][0],
  "hours": *[_id == "openingHours"][0],
  "christmas": *[_id == "christmasSettings"][0]{ ..., heroImage${IMAGE}, truffleImage${IMAGE} },
  "categories": *[_type == "christmasCategory"] | order(order asc) { _id, title, source, blurb, image${IMAGE}, items },
  "suppliers": *[_type == "supplier" && defined(slug.current)] | order(order asc) {
    _id, name, "slug": slug.current, type, from, teaser, image${IMAGE}, website, servedHere, takeHome, onHome
  },
  "events": *[_type == "event" && defined(date)] | order(date asc, start asc) {
    _id, title, date, start, end, description, image${IMAGE}, price, bookingUrl, showOnHome
  }
}`;

let cache: Promise<any> | null = null;
function load() {
  cache ??= sanity.fetch(QUERY).catch((err) => {
    throw new Error(`Couldn't load content from Sanity: ${err.message}`);
  });
  return cache;
}

// ---------- Small helpers ----------

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  return day(iso).toLocaleDateString('en-GB', { ...opts, timeZone: 'Europe/London' });
}

export function time12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

export const money = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
const pence = (pounds?: number | null) => Math.round((pounds ?? 0) * 100);

// Headlines use *word* for the italic bit, e.g. "Come and *say hello*".
export function emphasis(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// Local photos in src/assets/images, referred to by file name (no extension).
const imageFiles = import.meta.glob<{ default: ImageMetadata }>('../assets/images/*.{jpg,jpeg,png,webp}', { eager: true });

export function img(name: string): ImageMetadata {
  const hit = Object.entries(imageFiles).find(([path]) => path.split('/').pop()!.replace(/\.[^.]+$/, '') === name);
  if (!hit) throw new Error(`Image "${name}" not found in src/assets/images`);
  return hit[1].default;
}

// ---------- Site settings ----------

export async function getSettings() {
  const { settings: s } = await load();
  const phone: string = s?.phone || siteDefaults.phone;
  return {
    ...siteDefaults,
    phone,
    phoneIntl: '+44' + phone.replace(/\D/g, '').replace(/^0/, ''),
    email: s?.email || siteDefaults.email,
    address: { ...siteDefaults.address, ...(s?.address ?? {}) },
    socials: { ...siteDefaults.socials, ...(s?.socials ?? {}) },
    noticeBanner: { on: !!s?.noticeBanner?.on, message: s?.noticeBanner?.message ?? '', link: s?.noticeBanner?.link ?? '' },
  };
}

// ---------- Opening hours ----------

export async function getHours(today = new Date()) {
  const { hours } = await load();
  const regular = (hours?.regular ?? []).map((r: any) => ({
    days: r.days,
    dayCodes: r.dayCodes ?? [],
    opens: r.opens,
    closes: r.closes,
    label: `${time12(r.opens)} – ${time12(r.closes)}`,
  }));
  // Special days show from 6 weeks before until the day itself.
  const soon = new Date(today.getTime() + 42 * 864e5);
  const special = (hours?.special ?? [])
    .filter((x: any) => x.date && day(x.date) >= new Date(today.getTime() - 864e5) && day(x.date) <= soon)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((x: any) => ({
      date: x.date,
      label: x.label || formatDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' }),
      when: formatDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      text: x.closed ? 'Closed' : `${time12(x.opens)} – ${time12(x.closes)}`,
    }));
  return { regular, special };
}

// ---------- Home, reviews (still in src/data) ----------

export const getHome = () => home;
export const getReviews = () => reviews;

// ---------- Suppliers ----------

export async function getSuppliers(): Promise<Supplier[]> {
  return (await load()).suppliers ?? [];
}
export async function getHomeSuppliers() {
  return (await getSuppliers()).filter((s) => s.onHome).slice(0, 3);
}

// ---------- Events ----------
// Anything whose day has passed drops off. The page also re-checks in the
// visitor's browser, so a past event never shows even between rebuilds.

export function eventEnds(e: ShopEvent) {
  return `${e.date}T${e.end || '23:59'}:00`;
}

export async function getUpcomingEvents(today = new Date()): Promise<ShopEvent[]> {
  const events: ShopEvent[] = (await load()).events ?? [];
  return events.filter((e) => new Date(eventEnds(e)) >= today);
}

export function eventWhen(e: ShopEvent) {
  const d = formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = e.start ? (e.end ? `${time12(e.start)}–${time12(e.end)}` : time12(e.start)) : '';
  return time ? `${d} · ${time}` : d;
}

// ---------- Christmas ----------
// Shown from the day it's switched on until the last collection day.

export async function getChristmas(today = new Date()) {
  const c = (await load()).christmas;
  if (!c?.collectionDates?.length) {
    return { live: false, onlineOpen: false } as any;
  }
  const dates: string[] = [...c.collectionDates].sort();
  const last = dates[dates.length - 1];
  const collectionDays = dates.map((d) => formatDate(d, { day: 'numeric' }));
  const depositPercent: number = c.depositPercent ?? 50;
  return {
    year: c.year,
    intro: c.intro ?? '',
    ordersEmail: c.ordersEmail,
    collectionDates: dates,
    collectionBy: c.collectionBy ?? '',
    heroImage: c.heroImage as SanityImage | undefined,
    truffles: {
      text: c.truffleText ?? '',
      flavours: (c.truffleFlavours ?? []) as string[],
      flavourCount: (c.truffleFlavourCount ?? 0) as number,
      price: c.trufflePrice != null ? pence(c.trufflePrice) : null,
      image: c.truffleImage as SanityImage | undefined,
    },
    paymentsLive: siteConfig.paymentsLive,
    live: !!c.on && today <= day(last),
    onlineOpen: today <= day(c.onlineOrderCutoff),
    depositPercent,
    depositRate: depositPercent / 100,
    onlineCutoffText: formatDate(c.onlineOrderCutoff),
    inShopCutoffText: formatDate(c.inShopOrderCutoff),
    refundCutoffText: formatDate(c.refundCutoff),
    collectionText: `${collectionDays.slice(0, -1).join(', ')}${collectionDays.length > 1 ? ' or ' : ''}${collectionDays.at(-1)} ${formatDate(last, { month: 'long' })}${c.collectionBy ? `, by ${c.collectionBy}` : ''}`,
  };
}

// The Christmas list, in pence, with stable ids for the order form.
export async function getChristmasMenu() {
  const cats = (await load()).categories ?? [];
  return cats.map((c: any) => ({
    id: c._id,
    title: c.title,
    source: c.source ?? '',
    blurb: c.blurb ?? '',
    image: c.image as SanityImage | undefined,
    items: ((c.items ?? []) as SanityItem[]).map((it) => ({
      id: it._key,
      name: it.name,
      detail: it.detail ?? '',
      available: it.available !== false,
      price: it.pricing === 'fixed' ? pence(it.price) : null,
      perKg: it.pricing === 'weight' && it.perKg ? pence(it.perKg) : null,
      tiers:
        it.pricing === 'weight'
          ? (it.sizes ?? []).map((z) => ({ id: z._key, label: z.label, price: pence(z.price) }))
          : null,
    })),
  }));
}
