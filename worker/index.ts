// The website is static files. This small script only runs for:
// - the paths listed in wrangler.jsonc (run_worker_first), and
// - a nightly schedule that rebuilds the site.
// Everything else goes straight to the files.

interface Env {
  ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
  // Cloudflare deploy hook URL, added as a secret in the Worker's settings.
  DEPLOY_HOOK_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
