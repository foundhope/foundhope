// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that exist only as "coming soon" placeholders stay out of the sitemap
// until they're built. Remove a path from this list when its page goes live.
const placeholderPages = [
  '/journal',
];

// Pages that should never be in Google, like the order thank-you page.
const privatePages = ['/christmas/thanks', '/whats-on/thanks', '/help'];

export default defineConfig({
  site: 'https://foundhope.store',
  trailingSlash: 'never',
  build: {
    // /our-story is served from our-story.html, matching the addresses in _redirects
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return ![...placeholderPages, ...privatePages].some((p) => path === p || path.startsWith(p + '/'));
      },
    }),
  ],
});
