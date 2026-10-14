// Google reviews, fetched while the site builds (every night at 3am, and on every
// publish). Uses the Places API (New). It returns at most 5 reviews and Google
// picks which; we keep the 4 and 5 star ones and show the newest.
//
// Needs two build variables in Cloudflare (Workers & Pages > foundhope >
// Settings > Build > Variables and secrets):
//   GOOGLE_PLACES_API_KEY  the API key (required)
//   GOOGLE_PLACE_ID        the shop's Place ID (optional: if missing we search for it)
//
// If anything fails we fall back to the last good set, which every build
// publishes at /reviews.json, then to src/data/reviews.json. The build never
// fails because of reviews.

import fallback from '../data/reviews.json';

export type ShopReview = {
  name: string;
  stars: number;
  text: string;
  date?: string; // e.g. "October 2026"
  url?: string; // the review on Google
  pinned?: boolean;
};

export type ReviewData = {
  rating: number | null;
  count: number | null;
  googleUrl: string; // the shop on Google Maps
  reviewsUrl: string; // all reviews on Google
  reviews: ShopReview[];
};

const MAX_SHOWN = 3;
const LIVE_COPY = 'https://foundhope.store/reviews.json';

const env = (k: string): string => (typeof process !== 'undefined' ? process.env[k] : '') || (import.meta.env as any)[k] || '';

async function places(path: string, init: RequestInit, mask: string) {
  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env('GOOGLE_PLACES_API_KEY'),
      'X-Goog-FieldMask': mask,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<any>;
}

async function findPlaceId(): Promise<string> {
  const data = await places(
    'places:searchText',
    { method: 'POST', body: JSON.stringify({ textQuery: 'Found Hope, 216-218 Hither Green Lane, London SE13 6RT', maxResultCount: 1 }) },
    'places.id,places.displayName',
  );
  const hit = data.places?.[0];
  if (!hit || !/found hope/i.test(hit.displayName?.text ?? '')) throw new Error('Could not find the Found Hope place on Google');
  console.log(`[reviews] Found place "${hit.displayName.text}" (${hit.id}). Set GOOGLE_PLACE_ID to this to skip the search.`);
  return hit.id;
}

async function fromGoogle(): Promise<ReviewData> {
  if (!env('GOOGLE_PLACES_API_KEY')) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const placeId = env('GOOGLE_PLACE_ID') || (await findPlaceId());
  const p = await places(`places/${placeId}`, { method: 'GET' }, 'rating,userRatingCount,googleMapsUri,reviews');

  const reviews: ShopReview[] = (p.reviews ?? [])
    .filter((r: any) => r.rating >= 4 && (r.originalText?.text || r.text?.text))
    .sort((a: any, b: any) => (b.publishTime ?? '').localeCompare(a.publishTime ?? ''))
    .map((r: any) => ({
      name: r.authorAttribution?.displayName ?? 'A customer',
      stars: Math.round(r.rating),
      text: (r.originalText?.text ?? r.text.text).trim(),
      date: r.publishTime
        ? new Date(r.publishTime).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })
        : undefined,
      url: r.googleMapsUri,
    }));

  return {
    rating: typeof p.rating === 'number' ? Math.round(p.rating * 10) / 10 : null,
    count: p.userRatingCount ?? null,
    googleUrl: p.googleMapsUri ?? '',
    reviewsUrl: `https://search.google.com/local/reviews?placeid=${placeId}`,
    reviews,
  };
}

async function lastGoodCopy(): Promise<ReviewData | null> {
  try {
    const res = await fetch(LIVE_COPY, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = (await res.json()) as ReviewData;
    return Array.isArray(d.reviews) && d.reviews.length ? d : null;
  } catch {
    return null;
  }
}

export async function getGoogleReviews(): Promise<ReviewData> {
  try {
    const data = await fromGoogle();
    console.log(`[reviews] Google: ${data.rating} stars, ${data.count} reviews, ${data.reviews.length} usable (4-5 star)`);
    if (data.reviews.length || data.rating) return data;
  } catch (err: any) {
    console.warn(`[reviews] Google fetch failed, using last good set. ${err.message}`);
  }
  const live = await lastGoodCopy();
  if (live) return live;
  const f = fallback as any;
  return { rating: f.rating ?? null, count: f.count ?? null, googleUrl: f.googleUrl ?? '', reviewsUrl: f.reviewsUrl ?? f.googleUrl ?? '', reviews: f.reviews ?? [] };
}

// Pinned review first (if there is one), then the newest, up to MAX_SHOWN.
export function pickReviews(data: ReviewData, pinned?: { name?: string; stars?: number; text?: string; link?: string } | null): ReviewData {
  const list: ShopReview[] = [];
  if (pinned?.text && pinned?.name) {
    list.push({ name: pinned.name, stars: pinned.stars ?? 5, text: pinned.text.trim(), url: pinned.link || undefined, pinned: true });
  }
  const seen = (r: ShopReview) => list.some((x) => x.name === r.name || x.text.slice(0, 40) === r.text.slice(0, 40));
  for (const r of data.reviews) {
    if (list.length >= MAX_SHOWN) break;
    if (!seen(r)) list.push(r);
  }
  return { ...data, reviews: list };
}
