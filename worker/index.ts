// The website is static files. This small script only runs for:
// - the paths listed in wrangler.jsonc (run_worker_first): /studio and /api,
// - a nightly schedule that rebuilds the site.
// Everything else goes straight to the files.

import { subscribe, subscribeStatus, type SubscribeEnv } from './subscribe';
import { buildTicketOrder, type TicketEvent } from './tickets';
import { buildOrder, lineText, money, orderMetadata, type Category, type ChristmasSettings } from './order';

interface Env extends SubscribeEnv {
  ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
  // Cloudflare deploy hook URL, added as a secret in the Worker's settings.
  DEPLOY_HOOK_URL?: string;
  // Stripe secret key (sk_test_... first, then sk_live_...), added as a secret by Tom.
  STRIPE_SECRET_KEY?: string;
}

const SANITY_QUERY = encodeURIComponent(`{
  "settings": *[_id == "christmasSettings"][0]{ on, onlineOrderingOpen, depositPercent, onlineOrderCutoff, collectionDates, collectionBy, ordersEmail, trufflePrice, truffleFlavours },
  "categories": *[_type == "christmasCategory"]{ items[]{ _key, name, pricing, price, sizes[]{ _key, label, price }, available } }
}`);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function stripe(env: Env, path: string, init: { method?: string; body?: URLSearchParams } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: init.body,
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

// POST /api/checkout: check the order against Sanity, then open a Stripe
// payment page for the deposit. Returns { url } to send the customer to.
async function createCheckout(request: Request, env: Env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Online payments are not switched on yet.', fallback: true }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Something went wrong. Please try again.' }, 400);
  }

  const sanity = await fetch(`https://2opy1om7.api.sanity.io/v2025-02-19/data/query/production?query=${SANITY_QUERY}&perspective=published`);
  if (!sanity.ok) return json({ error: 'We couldn\'t load the Christmas list. Please try again in a minute.' }, 502);
  const { result } = (await sanity.json()) as { result: { settings: ChristmasSettings | null; categories: Category[] } };

  const built = buildOrder(body, result.settings, result.categories ?? []);
  if (!built.ok) return json({ error: built.error }, 400);
  const o = built.order;

  const origin = new URL(request.url).origin;
  const summary = o.lines.map(lineText).join('; ');
  const meta = orderMetadata(o);

  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('locale', 'en-GB');
  p.set('customer_email', o.email);
  p.set('success_url', `${origin}/christmas/thanks?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/christmas?cancelled=1#your-order`);
  p.set('line_items[0][quantity]', '1');
  p.set('line_items[0][price_data][currency]', 'gbp');
  p.set('line_items[0][price_data][unit_amount]', String(o.deposit));
  p.set('line_items[0][price_data][product_data][name]', `Christmas order deposit (${o.depositPercent}%)`);
  p.set(
    'line_items[0][price_data][product_data][description]',
    `Collect ${o.collectionLabel}. Approx total ${money(o.total)}, balance ${money(o.balance)} on collection. ${summary}`.slice(0, 1000),
  );
  p.set('payment_intent_data[description]', `Christmas deposit: ${o.name}, collect ${o.collectionLabel}`.slice(0, 1000));
  p.set('payment_intent_data[statement_descriptor_suffix]', 'CHRISTMAS');
  p.set('payment_intent_data[receipt_email]', o.email);
  for (const [k, v] of Object.entries(meta)) {
    p.set(`metadata[${k}]`, v);
    p.set(`payment_intent_data[metadata][${k}]`, v);
  }

  try {
    const session = await stripe(env, 'checkout/sessions', { method: 'POST', body: p });
    return json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout failed', err);
    return json({ error: 'We couldn\'t open the payment page. Please try again, or call the shop.' }, 502);
  }
}

// GET /api/checkout/session?id=cs_...: what the thank-you page shows.
async function checkoutSummary(url: URL, env: Env) {
  const id = url.searchParams.get('id') ?? '';
  if (!env.STRIPE_SECRET_KEY || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: 'Not found' }, 404);
  try {
    const s = await stripe(env, `checkout/sessions/${id}`);
    const m = s.metadata ?? {};
    const items = Object.keys(m)
      .filter((k) => k.startsWith('items_'))
      .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))
      .flatMap((k) => String(m[k]).split('\n'));
    return json({
      paid: s.payment_status === 'paid',
      firstName: String(m.name ?? '').split(' ')[0],
      email: m.email,
      collection: m.collection,
      items,
      total: m.total,
      deposit: m.deposit,
      balance: m.balance,
    });
  } catch {
    return json({ error: 'Not found' }, 404);
  }
}

// POST /api/tickets: check the event and how many tickets are left, then open a
// Stripe payment page. Stripe collects the email, phone and the name on the booking.
async function createTicketCheckout(request: Request, env: Env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Online tickets are not switched on yet.', fallback: true }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Something went wrong. Please try again.' }, 400);
  }
  const eventId = typeof body?.eventId === 'string' ? body.eventId.slice(0, 80) : '';
  if (!/^[A-Za-z0-9_.-]+$/.test(eventId) || eventId.startsWith('drafts.')) return json({ error: 'We couldn\'t find that event.' }, 400);

  const q = encodeURIComponent('*[_type == "event" && _id == $id][0]{ _id, title, date, start, sellTickets, ticketPrice, ticketsAvailable }');
  const sanity = await fetch(`https://2opy1om7.api.sanity.io/v2025-02-19/data/query/production?query=${q}&$id=${encodeURIComponent(JSON.stringify(eventId))}&perspective=published`);
  if (!sanity.ok) return json({ error: 'We couldn\'t load the event. Please try again in a minute.' }, 502);
  const event = ((await sanity.json()) as { result: TicketEvent | null }).result;

  // Tickets already sold, from paid Stripe payments tagged with this event.
  let sold = 0;
  if (event?.ticketsAvailable != null) {
    try {
      const search = new URLSearchParams({ query: `metadata['event']:'${eventId}' AND status:'succeeded'`, limit: '100' });
      const found = await stripe(env, `payment_intents/search?${search}`);
      sold = (found.data ?? []).reduce((n: number, pi: any) => n + (parseInt(pi.metadata?.tickets, 10) || 0), 0);
    } catch (err) {
      console.error('Ticket count failed', err);
      return json({ error: 'We couldn\'t check what\'s left. Please try again in a minute.' }, 502);
    }
  }

  const built = buildTicketOrder({ eventId, qty: body?.qty }, event, sold);
  if (!built.ok) return json({ error: built.error }, 400);
  const o = built.order;

  const origin = new URL(request.url).origin;
  const meta: Record<string, string> = { kind: 'event-ticket', event: o.eventId, event_title: o.title, event_date: o.dateLabel, tickets: String(o.qty), total: money(o.total) };

  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('locale', 'en-GB');
  p.set('success_url', `${origin}/whats-on/thanks?session_id={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/whats-on?cancelled=1`);
  p.set('line_items[0][quantity]', String(o.qty));
  p.set('line_items[0][price_data][currency]', 'gbp');
  p.set('line_items[0][price_data][unit_amount]', String(o.unit));
  p.set('line_items[0][price_data][product_data][name]', `Ticket: ${o.title}`.slice(0, 250));
  p.set('line_items[0][price_data][product_data][description]', o.dateLabel);
  p.set('phone_number_collection[enabled]', 'true');
  p.set('custom_fields[0][key]', 'attendee');
  p.set('custom_fields[0][label][type]', 'custom');
  p.set('custom_fields[0][label][custom]', 'Name for the booking');
  p.set('custom_fields[0][type]', 'text');
  p.set('payment_intent_data[description]', `Tickets: ${o.title} (${o.qty})`.slice(0, 1000));
  p.set('payment_intent_data[statement_descriptor_suffix]', 'EVENT');
  for (const [k, v] of Object.entries(meta)) {
    p.set(`metadata[${k}]`, v);
    p.set(`payment_intent_data[metadata][${k}]`, v);
  }

  try {
    const session = await stripe(env, 'checkout/sessions', { method: 'POST', body: p });
    return json({ url: session.url });
  } catch (err) {
    console.error('Stripe ticket checkout failed', err);
    return json({ error: 'We couldn\'t open the payment page. Please try again, or call the shop.' }, 502);
  }
}

// GET /api/tickets/session?id=cs_...: what the ticket thank-you page shows.
async function ticketSummary(url: URL, env: Env) {
  const id = url.searchParams.get('id') ?? '';
  if (!env.STRIPE_SECRET_KEY || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: 'Not found' }, 404);
  try {
    const s = await stripe(env, `checkout/sessions/${id}`);
    const m = s.metadata ?? {};
    if (m.kind !== 'event-ticket') return json({ error: 'Not found' }, 404);
    const attendee = (s.custom_fields ?? []).find((f: any) => f.key === 'attendee')?.text?.value ?? '';
    return json({
      paid: s.payment_status === 'paid',
      firstName: String(attendee).trim().split(' ')[0],
      email: s.customer_details?.email ?? '',
      event: m.event_title,
      when: m.event_date,
      tickets: m.tickets,
      total: m.total,
    });
  } catch {
    return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/tickets' && request.method === 'POST') return createTicketCheckout(request, env);
    if (url.pathname === '/api/tickets/session' && request.method === 'GET') return ticketSummary(url, env);
    if (url.pathname === '/api/checkout' && request.method === 'POST') return createCheckout(request, env);
    if (url.pathname === '/api/checkout/session' && request.method === 'GET') return checkoutSummary(url, env);
    // Lets the Christmas page show "Test mode" while the Stripe test key is in.
    if (url.pathname === '/api/checkout/status') {
      const key = env.STRIPE_SECRET_KEY ?? '';
      return json({ on: !!key, test: /^(sk|rk)_test_/.test(key) });
    }
    if (url.pathname === '/api/subscribe/status') {
      const out = await subscribeStatus(env);
      return json(out.body, out.status);
    }
    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const out = await subscribe(body, env);
      return json(out.body, out.status);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);

    // Sanity Studio is a single-page app. Serve its real files (code, images)
    // as normal, and send every other /studio address to the Studio home page
    // so links like /studio/structure/openingHours work on refresh.
    if (url.pathname === '/studio' || url.pathname.startsWith('/studio/')) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
      return env.ASSETS.fetch(new URL('/studio/', url));
    }

    return env.ASSETS.fetch(request);
  },

  // Nightly rebuild: drops past events and special days, and closes Christmas
  // after the season, even if nobody has edited anything.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    if (!env.DEPLOY_HOOK_URL) return;
    ctx.waitUntil(fetch(env.DEPLOY_HOOK_URL, { method: 'POST' }));
  },
};
