// Order emails. When a payment goes through, Stripe calls POST /api/stripe/webhook.
// We check the call really came from Stripe, then email the order to the shop
// (and, for Christmas orders, a confirmation to the customer) through Resend.
//
// Secrets (Worker > Settings > Variables and secrets):
//   STRIPE_WEBHOOK_SECRET  whsec_... from the Stripe webhook page
//   RESEND_API_KEY         re_... from resend.com
// Optional plain variables:
//   ORDERS_EMAIL           where order emails go (default orders@foundhope.store)
//   MAIL_FROM              sender (default "Found Hope <orders@foundhope.store>")

export interface NotifyEnv {
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  ORDERS_EMAIL?: string;
  MAIL_FROM?: string;
}

export type Email = { to: string; subject: string; text: string; html: string; replyTo?: string; key: string };

const TOLERANCE_SECONDS = 300;

// ---- Stripe signature check -------------------------------------------------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSeconds - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = await signPayload(secret, `${t}.${rawBody}`);
  return sigs.some((s) => sameText(s, expected));
}

// ---- Building the emails ----------------------------------------------------

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const pounds = (p: unknown) => `£${(Number(p ?? 0) / 100).toFixed(2).replace(/\.00$/, '')}`;

function items(meta: Record<string, string>) {
  return Object.keys(meta)
    .filter((k) => k.startsWith('items_'))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))
    .flatMap((k) => String(meta[k]).split('\n'))
    .filter(Boolean);
}

function customField(session: any, key: string) {
  return String((session.custom_fields ?? []).find((f: any) => f.key === key)?.text?.value ?? '').trim();
}

function dashboardLink(session: any) {
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!pi) return '';
  return `https://dashboard.stripe.com/${session.livemode ? '' : 'test/'}payments/${pi}`;
}

type Row = [label: string, value: string];

function render(title: string, intro: string, rows: Row[], list: string[], footer: string[]) {
  const text = [
    title,
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(list.length ? ['', 'Order:', ...list.map((l) => `- ${l}`)] : []),
    ...(footer.length ? ['', ...footer] : []),
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
<p style="margin:0 0 20px;line-height:1.5">${esc(intro)}</p>
<table style="border-collapse:collapse;width:100%;font-size:15px">
${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`).join('\n')}
</table>
${list.length ? `<h2 style="font-size:16px;margin:24px 0 8px">Order</h2><ul style="margin:0;padding-left:20px;line-height:1.7">${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
${footer.map((f) => (/^https:\/\//.test(f) ? `<p style="margin:20px 0 0"><a href="${esc(f)}" style="color:#1a3cff">Open the payment in Stripe</a></p>` : `<p style="margin:20px 0 0;line-height:1.5">${esc(f)}</p>`)).join('\n')}
</div></body></html>`;

  return { text, html };
}

// Turns a paid Stripe Checkout session into the emails to send.
export function emailsFor(session: any, env: NotifyEnv): Email[] {
  const m: Record<string, string> = session.metadata ?? {};
  const shop = env.ORDERS_EMAIL || 'orders@foundhope.store';
  const link = dashboardLink(session);
  const testTag = session.livemode ? '' : '[TEST] ';
  const paid = pounds(session.amount_total);
  const customerEmail = String(session.customer_details?.email ?? m.email ?? '');
  const out: Email[] = [];

  if (m.kind === 'event-ticket') {
    const who = customField(session, 'attendee') || session.customer_details?.name || '';
    const body = render(
      `Tickets: ${m.event_title}`,
      `${who || 'Someone'} has booked ${m.tickets} ticket${m.tickets === '1' ? '' : 's'}.`,
      [
        ['Event', m.event_title],
        ['When', m.event_date],
        ['Tickets', m.tickets],
        ['Name', who],
        ['Email', customerEmail],
        ['Phone', String(session.customer_details?.phone ?? '')],
        ['Paid', paid],
      ],
      [],
      link ? [link] : [],
    );
    out.push({ to: shop, subject: `${testTag}Tickets: ${m.event_title}, ${m.tickets} for ${who}`.slice(0, 200), ...body, replyTo: customerEmail || undefined, key: `${session.id}-shop` });
    return out;
  }

  if (m.kind === 'shop') {
    const who = customField(session, 'collector') || session.customer_details?.name || '';
    const body = render(
      `Shop order: ${m.qty} x ${m.item}`,
      `${who || 'Someone'} has paid for an order to collect in the shop.`,
      [
        ['Collect', 'In the shop'],
        ['Name', who],
        ['Email', customerEmail],
        ['Phone', String(session.customer_details?.phone ?? '')],
        ['Paid', paid],
      ],
      [`${m.qty} x ${m.item}`],
      link ? [link] : [],
    );
    out.push({ to: shop, subject: `${testTag}Shop order: ${m.qty} x ${m.item} for ${who}`.slice(0, 200), ...body, replyTo: customerEmail || undefined, key: `${session.id}-shop` });
    return out;
  }

  // Christmas deposit (the original checkout has no "kind").
  if (!m.collection) return out;
  const list = items(m);
  const rows: Row[] = [
    ['Collect', m.collection],
    ['Name', m.name],
    ['Phone', m.phone],
    ['Email', m.email],
    ['Approx total', m.total],
    ['Deposit paid', m.deposit || paid],
    ['Balance on collection', m.balance],
    ['Notes', m.notes || 'None'],
  ];

  const shopBody = render(
    `Christmas order: ${m.name}`,
    `New Christmas order. Deposit paid online.`,
    rows,
    list,
    link ? [link] : [],
  );
  out.push({
    to: shop,
    subject: `${testTag}Christmas order: ${m.name}, ${m.collection}`.slice(0, 200),
    ...shopBody,
    replyTo: m.email || undefined,
    key: `${session.id}-shop`,
  });

  const to = m.email || customerEmail;
  if (to) {
    const first = String(m.name ?? '').split(' ')[0];
    const customerBody = render(
      'Your Christmas order is confirmed',
      `Thanks${first ? `, ${first}` : ''}. We've got your order and your deposit. Here's what you ordered.`,
      [
        ['Collect', m.collection],
        ['Approx total', m.total],
        ['Deposit paid', m.deposit || paid],
        ['Balance on collection', m.balance],
        ['Notes', m.notes || 'None'],
      ],
      list,
      [
        "Meat and poultry prices are approximate. We'll confirm the final weight and price before you collect, and you pay the balance in the shop.",
        'Need to change or cancel? Just reply to this email, or write to orders@foundhope.store. Full deposit terms: foundhope.store/christmas',
        'Found Hope, 216-218 Hither Green Lane, London SE13 6RT',
      ],
    );
    out.push({
      to,
      subject: `${testTag}Your Found Hope Christmas order, ${m.collection}`.slice(0, 200),
      ...customerBody,
      replyTo: shop,
      key: `${session.id}-customer`,
    });
  }
  return out;
}

// ---- Sending ----------------------------------------------------------------

async function send(env: NotifyEnv, e: Email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // Stripe can send the same event twice. Resend drops a repeat with the same key.
      'idempotency-key': e.key,
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Found Hope <orders@foundhope.store>',
      to: [e.to],
      subject: e.subject,
      text: e.text,
      html: e.html,
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// POST /api/stripe/webhook
export async function stripeWebhook(request: Request, env: NotifyEnv): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('Webhook not set up', { status: 503 });
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('Bad signature', { status: 400 });

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad body', { status: 400 });
  }

  // Card payments arrive as "completed" and paid. Slower methods arrive later as
  // "async_payment_succeeded". Anything else we just acknowledge.
  const type = event?.type;
  const session = event?.data?.object;
  const paidNow = type === 'checkout.session.completed' && session?.payment_status === 'paid';
  const paidLater = type === 'checkout.session.async_payment_succeeded';
  if (!paidNow && !paidLater) return new Response('Ignored', { status: 200 });

  if (!env.RESEND_API_KEY) {
    console.error('Order email skipped: no RESEND_API_KEY', session?.id);
    return new Response('Email not set up', { status: 500 });
  }

  try {
    for (const e of emailsFor(session, env)) await send(env, e);
  } catch (err) {
    // A 500 makes Stripe try again later. The idempotency keys stop doubles.
    console.error('Order email failed', session?.id, err);
    return new Response('Email failed', { status: 500 });
  }
  return new Response('OK', { status: 200 });
}
