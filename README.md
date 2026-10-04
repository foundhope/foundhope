# Found Hope website

The website for [Found Hope](https://foundhope.store), a coffee, food and bottle shop in Hither Green.

Built with [Astro](https://astro.build) and hosted on Cloudflare (Workers, serving the static site). Editable content lives in [Sanity](https://www.sanity.io) (project `2opy1om7`, dataset `production`) and is read at build time. The editor (Sanity Studio) is part of this repo and is served at **/studio**.

## Where things are

| Path | What it is |
|---|---|
| `studio/` | The editor: what Nick and Johan can change, and how the menu is laid out. Config in `sanity.config.ts` |
| `src/data/` | Copy not yet in Sanity: home page text, Our Story, site name and description, reviews. `christmas.json` holds `paymentsLive` |
| `src/assets/images/` | Photos. Referred to by file name in the data files. Resized and converted to WebP at build time |
| `src/pages/index.astro` | Home page (Concept C, v2) |
| `src/pages/[page].astro` | "Coming soon" placeholders for pages not built yet, so every menu link and redirect works |
| `src/lib/content.ts` | The one place pages read content from. One Sanity query per build |
| `src/components/Photo.astro` | Shows either a local photo or one uploaded in Sanity |
| `worker/index.ts` | Tiny script: makes /studio links work, and triggers the nightly rebuild |
| `public/_redirects` | Old WordPress addresses to new pages. Rebuild with `python3 scripts/build-redirects.py` |
| `public/_headers` | Keeps preview addresses out of Google |
| `wrangler.jsonc` | Tells Cloudflare to serve the built site from `dist/` |

## Run it locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/
```

## Cloudflare settings

The site runs as a Cloudflare Worker called `foundhope`, connected to this repo. Every push to `main` builds and deploys.

- Build command: `npm run build` (builds the site, then the Studio into `dist/studio`)
- Deploy command: `npx wrangler deploy` (reads `wrangler.jsonc`)
- Preview address: https://foundhope.orders-dc8.workers.dev

## Editing content

The editors' guide is at **/help** (also the **How to** tab in the Studio). Its words live in `src/pages/help.md`. Update it when the Studio changes.

Go to **/studio** on the site (or `npm run studio` locally), sign in, edit, press **Publish**.

| In the Studio | What it changes |
|---|---|
| Notice banner and contact | The blue strip on every page, phone, email, address, social links |
| Opening hours | Normal week, plus special days (shown for 6 weeks before, gone after the day) |
| Events | What's On page and the home page band. Past events drop off by themselves |
| Food & Drink page | Every section of /food-and-drink: text, photos, coffee and food menus, the counters, wine picks, Made by us |
| Visit page | Intro, photo, Getting here and Good to know on /visit. Hours and contact details come from their own sections |
| Christmas > Dates, deposit and truffles | Open or closed, cut-off dates, collection days, deposit %, main photo, truffles |
| Christmas > The Christmas list | Sections, items, prices and sizes. "Available" off shows Sold out |
| Suppliers | The Suppliers page, each supplier's own page (about, a line from Nick, how we work together, what's in the shop), and the 3 cards on the home page. "Show on the website" off hides them and their page |

**Publishing rebuilds the site** through a Sanity webhook that calls the Cloudflare deploy hook. Changes are live about a minute later. The site also rebuilds itself every night (`triggers` in `wrangler.jsonc`, using the `DEPLOY_HOOK_URL` secret).

If Sanity can't be reached during a build, the build fails on purpose and the last good version stays live.

## Christmas

All dates, the deposit and the list are edited in the Studio. `paymentsLive` in `src/data/christmas.json` switches the order form from email to Stripe once deposits are connected.

