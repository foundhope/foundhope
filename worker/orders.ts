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
    const orders = (await fetchPayments(env)).map(toOrder).filter((o): o is OrderRow => !!o);
    orders.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
    const days = [...new Set(orders.map((o) => o.collection))].sort((a, b) => dayNumber(a) - dayNumber(b));
    return json({
      signedInAs: who,
      updated: new Date().toISOString(),
      orders,
      prep: Object.fromEntries(days.map((d) => [d, prepList(orders.filter((o) => o.collection === d))])),
      prepAll: prepList(orders),
    });
  } catch (err) {
    console.error('Orders page failed', err);
    const msg = String((err as Error)?.message ?? '');
    return json({ error: /permission|restricted/i.test(msg) ? 'The Stripe key needs PaymentIntents: Read and Charges: Read.' : 'Couldn\'t load orders from Stripe. Try again in a minute.' }, 502);
  }
}
