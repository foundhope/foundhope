"""Builds public/_redirects from the lists below.

Each old WordPress address is written twice (with and without the trailing
slash). Emoji in old addresses stay percent-encoded, as WordPress served them.
Source: found-hope-build/redirect-map.md and the Search Console export (2 Oct 2026).
Run: python3 scripts/build-redirects.py
"""
from pathlib import Path

N = '/news/'
groups = {
    '/': ['/mailing-list'],
    '/our-story': ['/about-found-hope'],
    '/journal': ['/blog', '/found-hope-news'] + [N + s for s in """
found-hope drink-at-bobs-to-reopen hot-sauce our-favourite-things-mission-works-coffee
our-favourite-things-caravan-coffee-roasters two-brews-for-fathers-day new-seasonal-produce-available
lets-celebrate-national-bbq-week our-favourite-things-autumn-produce we-jammin
so-tasty-its-terrifying-%f0%9f%98%b1 magical-meat-menu everybody-say-cheese-%f0%9f%93%b8%f0%9f%a7%80
terrific-truffles radical-rhubarb chef-nicks-tips-for-a-succulent-steaks-%f0%9f%91%8c%f0%9f%8f%bc
chefs-top-tips-for-the-perfect-pork its-cocktail-time add-joy-to-your-dish-with-asian-flavours
chefs-easter-favourite its-chocolate-truffle-time magnificent-mangoes bbq-menu-is-back
%f0%9f%87%ac%f0%9f%87%a7-jubilee-jollies-%f0%9f%87%ac%f0%9f%87%a7 malling-centenary-sensational-strawberries
easter-lamb-shank-special fresh-family-friendly-produce-in-hither-green
crispy-roast-potatoes-a-step-by-step-guide-by-chef-nick kimchi-delights-in-hither-green
found-hope-stores-2023-journey-and-beyond welcoming-2024-with-our-non-alcoholic-delights
citrus-bliss-for-winter-mornings%f0%9f%8d%8a forced-rhubarb-season-is-here-and-we-cannot-keep-calm
love-is-in-the-air-found-hope-stores-valentines-day-special%f0%9f%92%97 special-feast-for-valentines-day%f0%9f%92%9d
new-flavourful-experiences-with-the-lazy-scientist special-feijoada-recipe-for-rainy-february
mastering-the-art-of-homemade-eccles-cake%e2%9c%a8%e2%9c%a8 hope-into-found-hope-stores-exciting-easter-specials%f0%9f%aa%ba
make-mothers-day-special-with-our-exclusive-pie congee-adventure-at-found-hope-store
art-of-beer-pickled-onions-with-macintosh-ales taste-of-traditional-herdwick-lamb-stew-at-found-hope-store
easter-lamb-delights-chef-nicks-roasting-tips-and-pot-roast-secrets-for-you good-friday-tradition-of-hot-cross-buns
indulge-in-traditional-simnel-cake sicilian-lemon-wonders-await-at-the-store-this-spring%f0%9f%8d%8b
tangy-and-crunchy-pickled-radishes wittenham-taste-english-artisanal-tradition
tangy-crunchy-and-savoury-dill-pickles-at-the-found-hope-store introducing-botrees-single-origin-spices-at-found-hope-store
groundbreaking-kombucha-collaboration-weve-been-waiting-for preserving-the-tradition-of-savoury-pickled-red-cabbage
twist-to-tradition-with-found-hope-stores-zesty-giardiniera found-hope-store-introduces-homemade-hummus
spoonful-of-delight-with-our-homemade-quince-jam detour-from-the-traditional-with-our-unique-chutney
delightful-yet-luxurious-butterscotch-truffles tropical-vibes-with-banana-and-passion-fruit-truffles
fresh-almond-rocket-pesto-from-our-kitchen-to-yours%f0%9f%8c%bf spice-up-your-summer-with-our-ultimate-bbq-sauce
found-hope-store-got-a-snack-to-savour magic-of-bourbon-and-brown-sugar-truffles%e2%9c%a8
mango-mania-takes-over-our-store-in-hither-green%f0%9f%a5%ad-%e2%9c%a8 discover-the-tangy-delight-of-sauerkraut-in-hither-green
sip-brinks-new-non-alcoholic-negroni-and-margarita
""".split()] + ['/recipes/recipe-of-the-month-octopus-with-paprika-dressing'],
    '/food-and-drink': [N + s for s in """
new-wines-in-store more-of-our-favourite-wines talking-wine-with-found-hopes-manager wine-at-found-hope
meet-our-wine-consultant-johan found-hope-stores-fine-wines-to-welcome-2024%f0%9f%a5%82
""".split()] + ['/category/produce'],
    '/whats-on': [N + s for s in """
cheese-tasting-at-its-finest wine-tasting-at-found-hope spring-wine-tasting-event our-first-supper-club
ultimate-wine-tasting-experience-of-2023 unveil-flavours-at-spring-easter-wine-tasting%f0%9f%8d%b7
sip-savour-and-celebrate-spring-wine-tasting-2024%f0%9f%a5%82 christmaswine-tasting-2024
""".split()],
    '/visit': [N + s for s in """
summer-break welcome-back easter-opening-times more-hours-to-brew-and-browse-at-found-hope
new-opening-hours-for-christmas-and-new-year%f0%9f%95%b0%ef%b8%8f
""".split()],
    '/christmas': [N + s for s in """
hamper-holidays loveable-hampers-%e2%9d%a4%ef%b8%8f what-will-mum-find-in-her-mothers-day-hamper
hither-greens-christmas-meat-delight found-hope-store-unveils-christmas-hampers-2023
premium-christmas-tree-await-you%f0%9f%8e%84 unwrap-joy-with-found-hope-stores-christmas-hamper%f0%9f%8e%81
found-hope-store-reveals-christmas-cheese-hamper-2023 save-the-dates-christmas-sandwich-is-back%f0%9f%a5%99
toast-to-the-holidays-with-our-exclusive-wine-hamper%f0%9f%a5%82 ultimate-vegan-christmas-delight-for-your-guests
galup-panettone-a-festive-delight-in-hither-green found-hope-store-your-christmas-ham-destination
jingle-bells-in-vegan-wonderland%f0%9f%8e%84%f0%9f%8e%85%f0%9f%8f%bc
""".split()],
    '/suppliers/natoora': [N + 'our-favourite-things-natoora-ravioli'],
    '/suppliers/scenery-coffee': [N + 'scenery-coffee-in-hither-green-brewing-quality-coffee-in-every-cup'],
}

lines = [
    '# Found Hope: old WordPress addresses -> new site. Built by scripts/build-redirects.py',
    '# Specific rules first, catch-alls last. Cloudflare uses the first match.',
    '# Cloudflare limits: 2000 exact rules, 100 pattern rules (with *). Every rule after',
    '# the first pattern rule counts as a pattern rule, so keep all * rules at the end.',
    '',
]
count = 0
for target, olds in groups.items():
    lines.append(f'# -> {target}')
    for old in olds:
        lines.append(f'{old}/ {target} 301')
        lines.append(f'{old} {target} 301')
        count += 1
    lines.append('')

lines += [
    '# Old files',
    '/wp-content/uploads/2020/11/Catering-Found_Hope.pdf /food-and-drink 301',
    '/wp-sitemap.xml /sitemap-index.xml 301',
    '',
    '# Archive and feed pages',
    '/news /journal 301', '/news/ /journal 301',
    '/recipes /journal 301', '/recipes/ /journal 301',
    '/feed /journal 301', '/feed/ /journal 301',
    '/category/* /journal 301',
    '/tag/* /journal 301',
    '/author/* /our-story 301',
    '/page/* /journal 301',
    '',
    '# Safety nets. Keep last so the rules above win.',
    '/news/* /journal 301',
    '/recipes/* /journal 301',
    '/wp-content/* / 301',
    '/wp-admin/* / 301',
    '/wp-login.php / 301',
    '',
]
out = Path(__file__).resolve().parent.parent / 'public' / '_redirects'
out.write_text('\n'.join(lines))
print(f'{count} old addresses, {sum(1 for l in lines if l and not l.startswith("#"))} rules -> {out}')
