// Newsletter sign-up: adds people to the Found Hope audience in Mailchimp as
// "pending", so Mailchimp emails them to confirm first (double opt-in).
// Needs the MAILCHIMP_API_KEY secret (ends in -us21 or similar).

export interface SubscribeEnv {
  MAILCHIMP_API_KEY?: string;
  // Optional: pin a specific audience. If not set, the first (only) audience is used.
  MAILCHIMP_AUDIENCE_ID?: string;
}

type Result = { status: number; body: Record<string, unknown> };

let cachedAudience: string | null = null;

async function md5(text: string) {
  const buf = await crypto.subtle.digest('MD5', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function subscribe(body: any, env: SubscribeEnv): Promise<Result> {
  // Bots fill in every field, people can't see this one.
  if (body?.website) return { status: 200, body: { ok: true, message: 'Thanks! Check your inbox to confirm.' } };

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : '';
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
  const name = clean(body?.name);
  const surname = clean(body?.surname);
  if (!name || !surname) return { status: 400, body: { error: 'Please add your first name and surname.' } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { error: 'Please check your email address.' } };

  const key = env.MAILCHIMP_API_KEY;
  if (!key) return { status: 503, body: { error: 'Sign-up is not switched on yet.', fallback: true } };
  const dc = key.split('-').pop();
  const api = (path: string, init: RequestInit = {}) =>
    fetch(`https://${dc}.api.mailchimp.com/3.0/${path}`, {
      ...init,
      headers: { authorization: `Basic ${btoa(`fh:${key}`)}`, 'content-type': 'application/json' },
    });

  try {
    let audience = env.MAILCHIMP_AUDIENCE_ID || cachedAudience;
    if (!audience) {
      const res = await api('lists?count=1&fields=lists.id');
      const data: any = await res.json();
      audience = data?.lists?.[0]?.id ?? null;
      if (!audience) throw new Error('No Mailchimp audience found');
      cachedAudience = audience;
    }

    const hash = await md5(email);
    const member = `lists/${audience}/members/${hash}`;
    const res = await api(member, {
      method: 'PUT',
      body: JSON.stringify({
        email_address: email,
        status_if_new: 'pending',
        merge_fields: { FNAME: name, LNAME: surname },
      }),
    });
    const data: any = await res.json();

    if (!res.ok) {
      // e.g. someone who unsubscribed and Mailchimp won't let us re-add them directly
      if (String(data?.title ?? '').toLowerCase().includes('compliance')) {
        return { status: 200, body: { ok: true, message: "You've unsubscribed before, so Mailchimp needs you to rejoin from their page. Email us and we'll send you the link." } };
      }
      console.error('Mailchimp error', data?.title, data?.detail);
      return { status: 502, body: { error: "We couldn't sign you up just now. Please try again." } };
    }

    // Someone who unsubscribed in the past: ask Mailchimp to send a fresh confirmation.
    if (data.status === 'unsubscribed') {
      await api(member, { method: 'PATCH', body: JSON.stringify({ status: 'pending' }) });
    }

    // Tag website sign-ups so they're easy to find in Mailchimp.
    await api(`${member}/tags`, { method: 'POST', body: JSON.stringify({ tags: [{ name: 'Website', status: 'active' }] }) });

    if (data.status === 'subscribed') {
      return { status: 200, body: { ok: true, message: "You're already on our list. Thanks for being with us!" } };
    }
    return { status: 200, body: { ok: true, message: "Nearly there! Check your inbox and tap the link to confirm. If it's not there, look in your junk folder." } };
  } catch (err) {
    console.error('Mailchimp sign-up failed', err);
    return { status: 502, body: { error: "We couldn't sign you up just now. Please try again." } };
  }
}

// Health check for the sign-up: is the key working, and which audience will
// people join? Adds nobody. GET /api/subscribe/status
export async function subscribeStatus(env: SubscribeEnv): Promise<Result> {
  const key = env.MAILCHIMP_API_KEY;
  if (!key) return { status: 200, body: { on: false } };
  const dc = key.split('-').pop();
  try {
    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists?count=5&fields=lists.id,lists.name,lists.stats.member_count`, {
      headers: { authorization: `Basic ${btoa(`fh:${key}`)}` },
    });
    if (!res.ok) return { status: 200, body: { on: true, ok: false, error: `Mailchimp said ${res.status}` } };
    const data: any = await res.json();
    const lists = (data.lists ?? []).map((l: any) => ({ name: l.name, members: l.stats?.member_count }));
    const using = env.MAILCHIMP_AUDIENCE_ID
      ? (data.lists ?? []).find((l: any) => l.id === env.MAILCHIMP_AUDIENCE_ID)?.name
      : lists[0]?.name;
    return { status: 200, body: { on: true, ok: true, using, audiences: lists.length } };
  } catch {
    return { status: 200, body: { on: true, ok: false } };
  }
}

