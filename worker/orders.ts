// GET /api/orders: every paid Christmas order this season, for the private
// orders page at /orders. Read straight from Stripe, so it is always up to date.
//
// Locked twice:
// 1. Cloudflare Access sits in front of /orders and /api/orders (email login code).
// 2. This script checks the Access login token itself, so the data can't be
//    reached any other way (for example a workers.dev address).
//
// Needs (Worker > Settings > Variables and secrets):
//   ACCESS_TEAM_DOMAIN  e.g. foundhope.cloudflareaccess.com  (plain text is fine)
//   ACCESS_AUD          the "Application Audience (AUD) Tag" from the Access app
// And the Stripe key needs PaymentIntents: Read and Charges: Read.

export interface OrdersEnv {
  STRIPE_SECRET_KEY?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export type OrderRow = {
  id: string;
  created: number;
  name: string;
  phone: string;
  email: string;
  collection: string;
  day: number;
  total: string;
  deposit: string;
  balance: string;
  notes: string;
  items: string[];
  refund: 'none' | 'part' | 'full';
  link: string;
};

export type PrepLine = { item: string; qty: number };

// ---- Cloudflare Access token check -----------------------------------------

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const jsonPart = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

let certCache: { at: number; keys: any[] } | null = null;

async function accessKeys(team: string) {
  if (certCache && Date.now() - certCache.at < 10 * 60 * 1000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs ${res.status}`);
  const keys = ((await res.json()) as any).keys ?? [];
  certCache = { at: Date.now(), keys };
  return keys;
}

// Returns the signed-in email, or null if the token is missing or wrong.
export async function checkAccess(request: Request, env: OrdersEnv, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string | null> {
  const team = (env.ACCESS_TEAM_DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!team || !env.ACCESS_AUD) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = jsonPart(h);
    const payload = jsonPart(p);
    if (header.alg !== 'RS256') return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (!(payload.exp > nowSeconds)) return null;
    const jwk = (await accessKeys(team)).find((k: any) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    return ok ? String(payload.email ?? 'signed in') : null;
  } catch {
    return null;
  }
}

// ---- Turning Stripe payments into orders ------------------------------------

// "Tuesday 22 December, by 4:30pm" -> 22 (used to sort the days)
export const dayNumber = (label: string) => Number(/\b(\d{1,2})\b/.exec(label)?.[1] ?? 99);

export function toOrder(pi: any): OrderRow | null {
  const m = pi?.metadata ?? {};
  if (pi?.status !== 'succeeded' || !m.collection || m.kind) return null;
  const items = Object.keys(m)
    .filter((k) => k.startsWith('items_'))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))
    .flatMap((k) => String(m[k]).split('\n'))
    .filter(Boolean);
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const refunded = Number(charge?.amount_refunded ?? 0);
  const refund = charge?.refunded || (refunded > 0 && refunded >= Number(pi.amount_received ?? pi.amount)) ? 'full' : refunded > 0 ? 'part' : 'none';
  return {
    id: pi.id,
    created: pi.created,
    name: m.name ?? '',
    phone: m.phone ?? '',
    email: m.email ?? '',
    collection: m.collection,
    day: dayNumber(m.collection),
    total: m.total ?? '',
    deposit: m.deposit ?? '',
    balance: m.balance ?? '',
    notes: m.notes && m.notes !== 'None' ? m.notes : '',
    items,
    refund,
    link: `https://dashboard.stripe.com/${pi.livemode ? '' : 'test/'}payments/${pi.id}`,
  };
}

// "2 x Turkey, 5–6kg: approx £230" -> { qty: 2, item: "Turkey, 5–6kg" }
export function parseItem(line: string): PrepLine | null {
  const match = /^(\d+) x (.+)$/.exec(line.trim());
  if (!match) return null;
  const rest = match[2];
  const cut = rest.lastIndexOf(': ');
  return { qty: Number(match[1]), item: (cut > 0 ? rest.slice(0, cut) : rest).trim() };
}

export function prepList(orders: OrderRow[]): PrepLine[] {
  const totals = new Map<string, number>();
  for (const o of orders) {
    if (o.refund === 'full') continue;
    for (const line of o.items) {
      const p = parseItem(line);
      if (p) totals.set(p.item, (totals.get(p.item) ?? 0) + p.qty);
    }
  }
  return [...totals].map(([item, qty]) => ({ item, qty })).sort((a, b) => a.item.localeCompare(b.item));
}

// Christmas season starts 1 September (or the year before, in January and February).
export function seasonStart(now = new Date()) {
  const year = now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return Math.floor(Date.UTC(year, 8, 1) / 1000);
}

// ---- Event tickets ----------------------------------------------------------

export type Booking = {
  id: string;
  created: number;
  name: string;
  email: string;
  phone: string;
  tickets: number;
  paid: string;
  refund: 'none' | 'part' | 'full';
  link: string;
};

export type EventSummary = {
  id: string;
  title: string;
  when: string;
  date: string;
  capacity: number | null;
  sold: number;
  bookings: Booking[];
};

const pounds = (p: unknown) => `£${(Number(p ?? 0) / 100).toFixed(2).replace(/\.00$/, '')}`;

function refundOf(pi: any): 'none' | 'part' | 'full' {
  const charge = pi && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const refunded = Number(charge?.amount_refunded ?? 0);
  if (charge?.refunded || (refunded > 0 && refunded >= Number(pi.amount_received ?? pi.amount))) return 'full';
  return refunded > 0 ? 'part' : 'none';
}

// A paid Stripe Checkout session for event tickets -> one booking.
export function toBooking(s: any): (Booking & { eventId: string; title: string; when: string }) | null {
  const m = s?.metadata ?? {};
  if (m.kind !== 'event-ticket' || s.payment_status !== 'paid') return null;
  const pi = typeof s.payment_intent === 'object' ? s.payment_intent : null;
  const piId = pi?.id ?? s.payment_intent ?? '';
  const attendee = String((s.custom_fields ?? []).find((f: any) => f.key === 'attendee')?.text?.value ?? '').trim();
  return {
    id: s.id,
    created: s.created,
    eventId: m.event ?? '',
    title: m.event_title ?? '',
    when: m.event_date ?? '',
    name: attendee || s.customer_details?.name || '',
    email: s.customer_details?.email ?? '',
    phone: s.customer_details?.phone ?? '',
    tickets: parseInt(m.tickets, 10) || 0,
    paid: m.total || pounds(s.amount_total),
    refund: refundOf(pi),
    link: piId ? `https://dashboard.stripe.com/${s.livemode ? '' : 'test/'}payments/${piId}` : '',
  };
}

export function groupEvents(
  bookings: NonNullable<ReturnType<typeof toBooking>>[],
  events: { _id: string; title?: string; date?: string; ticketsAvailable?: number | null }[],
): EventSummary[] {
  const map = new Map<string, EventSummary>();
  for (const e of events) {
    map.set(e._id, { id: e._id, title: e.title ?? '', when: '', date: e.date ?? '', capacity: e.ticketsAvailable ?? null, sold: 0, bookings: [] });
  }
  for (const b of bookings) {
    let e = map.get(b.eventId);
    if (!e) {
      e = { id: b.eventId, title: b.title, when: b.when, date: '', capacity: null, sold: 0, bookings: [] };
      map.set(b.eventId, e);
    }
    if (!e.when) e.when = b.when;
    if (!e.title) e.title = b.title;
    const { eventId, title, when, ...booking } = b;
    e.bookings.push(booking);
    if (b.refund !== 'full') e.sold += b.tickets;
  }
  return [...map.values()]
    .map((e) => ({ ...e, bookings: e.bookings.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
}

async function fetchTicketSessions(env: OrdersEnv) {
  const all: any[] = [];
  let after = '';
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ limit: '100', status: 'complete', 'created[gte]': String(seasonStart()) });
    q.append('expand[]', 'data.payment_intent.latest_charge');
    if (after) q.set('starting_after', after);
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${q}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
    all.push(...(data.data ?? []));
    if (!data.has_more || !data.data?.length) break;
    after = data.data[data.data.length - 1].id;
  }
  return all;
}

// Upcoming events selling tickets, so the page can show "3 of 8 sold" even before the first booking.
async function fetchTicketEvents() {
  const q = encodeURIComponent('*[_type == "event" && sellTickets == true && date >= $today] | order(date asc){ _id, title, date, ticketsAvailable }');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const res = await fetch(`https://2opy1om7.api.sanity.io/v2025-02-19/data/query/production?query=${q}&$today=${encodeURIComponent(JSON.stringify(today))}&perspective=published`);
  if (!res.ok) return [];
  return (((await res.json()) as any).result ?? []) as { _id: string; title?: string; date?: string; ticketsAvailable?: number | null }[];
}

async function fetchPayments(env: OrdersEnv) {
  const all: any[] = [];
  let after = '';
  for (let page = 0; page < 30; page++) {
    const q = new URLSearchParams({ limit: '100', 'created[gte]': String(seasonStart()) });
    q.append('expand[]', 'data.latest_charge');
    if (after) q.set('starting_after', after);
    const res = await fetch(`https://api.stripe.com/v1/payment_intents?${q}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
    all.push(...(data.data ?? []));
    if (!data.has_more || !data.data?.length) break;
    after = data.data[data.data.length - 1].id;
  }
  return all;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

export async function ordersApi(request: Request, env: OrdersEnv): Promise<Response> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json({ error: 'The orders page is not switched on yet.' }, 503);
  const who = await checkAccess(request, env);
  if (!who) return json({ error: 'Please sign in again.' }, 403);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe is not connected.' }, 503);

  try {
    const [payments, sessions, ticketEvents] = await Promise.all([
      fetchPayments(env),
      fetchTicketSessions(env).catch((err) => { console.error('Ticket bookings failed', err); return null; }),
      fetchTicketEvents().catch(() => []),
    ]);
    const orders = payments.map(toOrder).filter((o): o is OrderRow => !!o);
    const events = sessions ? groupEvents(sessions.map(toBooking).filter((b): b is NonNullable<ReturnType<typeof toBooking>> => !!b), ticketEvents) : null;
    orders.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
    const days = [...new Set(orders.map((o) => o.collection))].sort((a, b) => dayNumber(a) - dayNumber(b));
    return json({
      signedInAs: who,
      updated: new Date().toISOString(),
      orders,
      prep: Object.fromEntries(days.map((d) => [d, prepList(orders.filter((o) => o.collection === d))])),
      prepAll: prepList(orders),
      events,
    });
  } catch (err) {
    console.error('Orders page failed', err);
    const msg = String((err as Error)?.message ?? '');
    return json({ error: /permission|restricted/i.test(msg) ? 'The Stripe key needs PaymentIntents: Read and Charges: Read.' : 'Couldn\'t load orders from Stripe. Try again in a minute.' }, 502);
  }
}
