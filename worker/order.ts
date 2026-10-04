// Works out a Christmas order from what the customer picked, using the prices
// in Sanity, never the prices sent by the browser. Pure functions, so they can
// be tested without Stripe or the network.

export type ChristmasSettings = {
  on?: boolean;
  depositPercent?: number;
  onlineOrderCutoff?: string;
  collectionDates?: string[];
  collectionBy?: string;
  ordersEmail?: string;
};

type Size = { _key: string; label: string; price: number };
type SanityItem = {
  _key: string;
  name: string;
  pricing: 'fixed' | 'weight';
  price?: number;
  sizes?: Size[];
  available?: boolean;
};
export type Category = { items?: SanityItem[] };

export type OrderRequest = {
  lines?: { id?: unknown; tier?: unknown; qty?: unknown }[];
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  collection?: unknown;
  notes?: unknown;
  agree?: unknown;
};

export type OrderLine = { name: string; size: string | null; qty: number; unit: number; approx: boolean };

export type Order = {
  lines: OrderLine[];
  total: number;
  deposit: number;
  balance: number;
  depositPercent: number;
  name: string;
  email: string;
  phone: string;
  collection: string;
  collectionLabel: string;
  notes: string;
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pence = (pounds?: number) => Math.round((pounds ?? 0) * 100);

// "2026-12-22" -> "Tuesday 22 December"
export function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  });
}

// Today's date in London, as YYYY-MM-DD.
export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
}

export const money = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, '')}`;

export function lineText(l: OrderLine) {
  return `${l.qty} x ${l.name}${l.size ? ` (${l.size})` : ''}: ${l.approx ? 'approx ' : ''}${money(l.unit * l.qty)}`;
}

export function buildOrder(
  req: OrderRequest,
  settings: ChristmasSettings | null,
  categories: Category[],
  now = new Date(),
): { ok: true; order: Order } | { ok: false; error: string } {
  if (!settings?.on) return { ok: false, error: 'Christmas orders are closed.' };
  if (settings.onlineOrderCutoff && londonToday(now) > settings.onlineOrderCutoff) {
    return { ok: false, error: 'Online orders have closed. Please call or pop into the shop.' };
  }

  const items = new Map<string, SanityItem>();
  for (const c of categories) for (const it of c.items ?? []) items.set(it._key, it);

  const lines: OrderLine[] = [];
  for (const l of (req.lines ?? []).slice(0, 60)) {
    const id = str(l.id, 64);
    const qty = Number(l.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 20) return { ok: false, error: 'Something in your order looks wrong. Please refresh the page and try again.' };
    const item = items.get(id);
    if (!item) return { ok: false, error: 'Something in your order is no longer on the list. Please refresh the page.' };
    if (item.available === false) return { ok: false, error: `Sorry, ${item.name} has sold out. Please refresh the page.` };

    if (item.pricing === 'weight') {
      const sizes = item.sizes ?? [];
      const size = sizes.length === 1 ? sizes[0] : sizes.find((z) => z._key === str(l.tier, 64));
      if (!size) return { ok: false, error: `Please choose a size for ${item.name}.` };
      lines.push({ name: item.name, size: sizes.length > 1 ? size.label : null, qty, unit: pence(size.price), approx: true });
    } else {
      lines.push({ name: item.name, size: null, qty, unit: pence(item.price), approx: false });
    }
  }
  if (!lines.length) return { ok: false, error: 'Your order is empty.' };

  const name = str(req.name, 80);
  const email = str(req.email, 120);
  const phone = str(req.phone, 30);
  const collection = str(req.collection, 10);
  if (!name) return { ok: false, error: 'Please add your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please add a valid email.' };
  if (phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Please add a phone number.' };
  if (!(settings.collectionDates ?? []).includes(collection)) return { ok: false, error: 'Please choose a collection day.' };
  if (req.agree !== true) return { ok: false, error: 'Please tick to say you have read how deposits work.' };

  const total = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  const depositPercent = settings.depositPercent ?? 50;
  const deposit = Math.round((total * depositPercent) / 100);
  if (deposit < 30) return { ok: false, error: 'Your order is too small for an online deposit. Please pop in to the shop.' };

  return {
    ok: true,
    order: {
      lines, total, deposit, balance: total - deposit, depositPercent,
      name, email, phone, collection,
      collectionLabel: dayLabel(collection) + (settings.collectionBy ? `, by ${settings.collectionBy}` : ''),
      notes: str(req.notes, 450),
    },
  };
}

// Stripe allows 50 metadata values of up to 500 characters each.
// Long orders are split across items_1, items_2, ...
export function orderMetadata(o: Order) {
  const meta: Record<string, string> = {
    name: o.name,
    email: o.email,
    phone: o.phone,
    collection: o.collectionLabel,
    total: money(o.total),
    deposit: money(o.deposit),
    balance: money(o.balance),
    notes: o.notes || 'None',
  };
  let chunk = '';
  let n = 1;
  for (const t of o.lines.map(lineText)) {
    if (chunk && (chunk + '\n' + t).length > 490) {
      meta[`items_${n++}`] = chunk;
      chunk = t;
    } else {
      chunk = chunk ? `${chunk}\n${t}` : t;
    }
  }
  if (chunk) meta[`items_${n}`] = chunk;
  return meta;
}
