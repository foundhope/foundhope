// The last good set of Google reviews, published with every build so the next
// build can fall back to it if Google can't be reached. See src/lib/reviews.ts.
import { getReviews } from '../lib/content';

export async function GET() {
  const { reviews, ...rest } = await getReviews();
  return new Response(JSON.stringify({ ...rest, reviews: reviews.filter((r: any) => !r.pinned) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
