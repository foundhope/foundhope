# Found Hope website

The website for [Found Hope](https://foundhope.store), a coffee, food and bottle shop in Hither Green.

Built with [Astro](https://astro.build) and hosted on Cloudflare Pages. Content will be edited in Sanity; until that's set up, it lives in the JSON files in `src/data`.

## Where things are

| Path | What it is |
|---|---|
| `src/data/` | Site content: contact details, hours, Christmas dates, home page text, suppliers, reviews. One file per thing the team will edit in Sanity |
| `src/assets/images/` | Photos. Referred to by file name in the data files. Resized and converted to WebP at build time |
| `src/pages/index.astro` | Home page (Concept C, v2) |
| `src/pages/[page].astro` | "Coming soon" placeholders for pages not built yet, so every menu link and redirect works |
| `src/lib/content.ts` | The one place pages read content from. Swaps to Sanity later |
| `public/_redirects` | Old WordPress addresses to new pages. Rebuild with `python3 scripts/build-redirects.py` |
| `public/_headers` | Keeps `*.pages.dev` previews out of Google |

## Run it locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/
```

## Cloudflare Pages settings

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`

## Christmas

Dates live in `src/data/christmas.json`. The home page Christmas band and the top banner show while `on` is `true`, and hide themselves after the last collection day (on the next build, so this relies on the planned nightly rebuild).
