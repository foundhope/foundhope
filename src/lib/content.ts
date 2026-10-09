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
  sellTickets?: boolean;
  ticketPrice?: number;
  ticketsAvailable?: number;
  showOnHome?: boolean;
};

export type SupplierProduct = { key: string; name: string; detail: string; price: number | null; image?: SanityImage };

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
  about: string[];
  quote: string;
  quoteBy: string;
  story: string[];
  products: SupplierProduct[];
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
  "christmas": *[_id == "christmasSettings"][0]{ ..., heroImage${IMAGE}, truffleImage${IMAGE}, sandwichImage${IMAGE} },
  "categories": *[_type == "christmasCategory"] | order(order asc) { _id, title, source, blurb, image${IMAGE}, items },
  "suppliers": *[_type == "supplier" && defined(slug.current) && show != false] | order(order asc) {
    _id, name, "slug": slug.current, type, from, teaser, image${IMAGE}, website, servedHere, takeHome, onHome,
    about, quote, quoteBy, story, products[]{ ..., image${IMAGE} }
  },
  "events": *[_type == "event" && defined(date)] | order(date asc, start asc) {
    _id, title, date, start, end, description, image${IMAGE}, price, bookingUrl, sellTickets, ticketPrice, ticketsAvailable, showOnHome
  },
  "visit": *[_id == "visitPage"][0]{ ..., image${IMAGE} },
  "foodAndDrink": *[_id == "foodAndDrink"][0]{
    ..., coffeeImage${IMAGE}, kitchenImage${IMAGE}, wineImage${IMAGE},
    counters[]{ ..., image${IMAGE}, supplier->{ name, "slug": slug.current, show } },
    picks[]{ ..., image${IMAGE} },
    products[]{ ..., image${IMAGE} }
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
      closed: !!x.closed,
      opens: x.opens as string | undefined,
      closes: x.closes as string | undefined,
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

// Text fields split into paragraphs on blank lines.
const paras = (t?: string | null) => (t ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export async function getSuppliers(): Promise<Supplier[]> {
  return ((await load()).suppliers ?? []).map((s: any) => ({
    ...s,
    about: paras(s.about),
    quote: (s.quote ?? '').trim(),
    quoteBy: s.quoteBy || 'Nick, Found Hope',
    story: paras(s.story),
    products: ((s.products ?? []) as any[])
      .filter((p) => p.available !== false)
      .map((p) => ({ key: p._key, name: p.name, detail: p.detail ?? '', price: p.price != null ? pence(p.price) : null, image: p.image })),
  }));
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
    return { live: false, onlineOpen: false, comingSoon: false } as any;
  }
  const dates: string[] = [...c.collectionDates].sort();
  const last = dates[dates.length - 1];
  const collectionDays = dates.map((d) => formatDate(d, { day: 'numeric' }));
  const depositPercent: number = c.depositPercent ?? 50;
  // "Order online coming soon" until the switch in Sanity is turned on.
  const comingSoon = c.onlineOrderingOpen !== true;
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
    sandwich: {
      on: c.sandwichOn !== false && !!c.sandwichText,
      title: (c.sandwichTitle || 'The turkey sandwich') as string,
      text: (c.sandwichText ?? '') as string,
      when: (c.sandwichWhen ?? '') as string,
      image: c.sandwichImage as SanityImage | undefined,
    },
    paymentsLive: siteConfig.paymentsLive,
    live: !!c.on && today <= day(last),
    comingSoon,
    onlineOpen: !comingSoon && today <= day(c.onlineOrderCutoff),
    depositPercent,
    depositRate: depositPercent / 100,
    onlineCutoffText: formatDate(c.onlineOrderCutoff),
    inShopCutoffText: formatDate(c.inShopOrderCutoff),
    refundCutoffText: formatDate(c.refundCutoff),
    collectionText: `${collectionDays.slice(0, -1).join(', ')}${collectionDays.length > 1 ? ' or ' : ''}${collectionDays.at(-1)} ${formatDate(last, { month: 'long' })}${c.collectionBy ? `, by ${c.collectionBy}` : ''}`,
  };
}

// ---------- Visit page ----------

export async function getVisit() {
  const v = (await load()).visit ?? {};
  return {
    intro: (v.intro ?? '') as string,
    image: v.image as SanityImage | undefined,
    gettingHere: ((v.gettingHere ?? []) as any[]).filter((r) => r.text).map((r) => ({ key: r._key as string, mode: r.mode as string, text: r.text as string })),
    goodToKnow: ((v.goodToKnow ?? []) as string[]).filter(Boolean),
  };
}

// ---------- Food & Drink page ----------
// Anything switched off in Sanity is left out. Prices are in pence (null = no price shown).
// Christmas-only products show only while the Christmas page is live.

export async function getFoodAndDrink() {
  const f = (await load()).foodAndDrink ?? {};
  const christmasLive = (await getChristmas()).live;
  const on = (x: any) => x?.available !== false;
  const price = (p?: number | null) => (p != null ? pence(p) : null);
  const menu = (items: any[] = []) =>
    items.filter(on).map((m) => ({
      key: m._key as string,
      name: m.name as string,
      detail: (m.detail ?? '') as string,
      price: price(m.price),
      dietary: (m.dietary ?? []) as string[],
    }));
  return {
    intro: (f.intro ?? '') as string,
    coffee: {
      text: (f.coffeeText ?? '') as string,
      image: f.coffeeImage as SanityImage | undefined,
      menu: menu(f.coffeeMenu),
      note: (f.coffeeNote ?? '') as string,
    },
    kitchen: {
      text: (f.kitchenText ?? '') as string,
      hours: (f.kitchenHours ?? '') as string,
      image: f.kitchenImage as SanityImage | undefined,
      menu: menu(f.kitchenMenu),
    },
    counters: ((f.counters ?? []) as any[]).map((c) => ({
      key: c._key as string,
      title: c.title as string,
      text: (c.text ?? '') as string,
      image: c.image as SanityImage | undefined,
      supplier: c.supplier?.slug && c.supplier.show !== false ? { name: c.supplier.name as string, slug: c.supplier.slug as string } : null,
    })),
    wine: {
      text: (f.wineText ?? '') as string,
      image: f.wineImage as SanityImage | undefined,
      picksTitle: (f.picksTitle || "Johan's picks this month") as string,
      picks: f.picksOn
        ? ((f.picks ?? []) as any[]).slice(0, 3).map((b) => ({
            key: b._key as string,
            name: b.name as string,
            producer: (b.producer ?? '') as string,
            note: (b.note ?? '') as string,
            price: price(b.price),
            image: b.image as SanityImage | undefined,
          }))
        : [],
    },
    madeByUs: {
      text: (f.madeByUsText ?? '') as string,
      products: ((f.products ?? []) as any[])
        .filter(on)
        .filter((p) => p.season !== 'christmas' || christmasLive)
        .map((p) => ({
          key: p._key as string,
          name: p.name as string,
          detail: (p.detail ?? '') as string,
          varieties: (p.varieties ?? []) as string[],
          price: price(p.price),
          priceNote: (p.priceNote ?? '') as string,
          image: p.image as SanityImage | undefined,
          christmas: p.season === 'christmas',
        })),
    },
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
