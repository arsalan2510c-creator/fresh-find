# FreshFind — Karachi Fresh Produce & Market Guide

A fully responsive, interactive and SEO-optimised website built from the FreshFind Figma design.
Pure **HTML5 + CSS3 + vanilla JavaScript** — no frameworks, no build step required to run.

## How to run
- **Easiest:** double-click `index.html` (works from disk — data falls back to `js/data-bundle.js`).
- **Recommended:** serve the folder, e.g. `python -m http.server` or VS Code *Live Server*, then open `http://localhost:8000`.
  JSON is then loaded live from `/data`.

## Pages (21)
| Page | File | Highlights |
|---|---|---|
| Home | `index.html` | Hero, feature badges, produce thumbnails → guides, auto-play sliders, top-rated markets with quick-view modal |
| Market Directory | `market.html` | **All 10 markets** from `data/markets.json`; live search, distance / open-now / sort filters, "Near me" geolocation, pagination |
| Market Detail ×10 | `markets/<slug>.html` | Live open/closed status (Karachi time), products from the market's own JSON with category/price/sort filters, gallery lightbox, map + directions, write-a-review, nearest related markets |
| Produce Guide | `produce.html` | 34 produce guides aggregated across all markets, category chips, market & availability filters, dynamic "in season this month" |
| Produce Detail | `product.html?item=<slug>` | Nutrition with %DV bars, benefits, 12-month season calendar, storage tips, **price comparison across markets (normalised Rs/kg)**, add to basket, share |
| Bookmarks | `bookmarks.html` | Saved markets & produce, sort, clear all |
| About | `about.html` | Story, mission/vision, animated counters, team |
| Contact | `contact.html` | Validated form with live errors & character counter, FAQ accordion |
| Login / Sign up | `login.html`, `signup.html` | Validation, show/hide password, strength meter, forgot-password modal, remember me |
| 404 | `404.html` | Friendly not-found page |

## Site-wide features
- "Home" in the navigation on every page; mobile off-canvas menu (ESC / backdrop to close).
- Global search overlay (press **/** or **Ctrl + K**) across markets and produce, keyboard navigable.
- Basket drawer: quantities, delivery fee / free-delivery threshold, checkout (requires sign-in).
- Bookmarks, basket, reviews, account and newsletter persist in `localStorage` (demo — no server).
- Scroll progress bar, back-to-top, reveal animations (respect `prefers-reduced-motion`), toasts.

## Accessibility
Semantic landmarks, skip link, one `h1` per page, labelled form controls, `aria-live` results,
`aria-pressed`/`aria-expanded`/`aria-current` states, focus-trapped modals & drawer, visible focus rings,
keyboard-operable sliders, lightbox and accordion, alt text on meaningful images.

## SEO
Unique titles & meta descriptions, canonical URLs, Open Graph + Twitter cards, JSON-LD
(Organization, WebSite + SearchAction, BreadcrumbList, GroceryStore per market, Product with AggregateOffer, FAQPage),
static crawlable market pages, `sitemap.xml`, `robots.txt`, web manifest.

## Compatibility & performance
Self-hosted fonts (woff2) and Font Awesome — works fully offline, no third-party requests.
Optimised progressive JPEGs, lazy loading, explicit image sizes, deferred scripts.
Broken/offline remote images automatically fall back to an on-brand SVG tile.
Tested in Chromium at 1280px and 390px; layout breakpoints at 1100 / 991 / 767 / 575 / 380px.

## Structure
```
index.html, market.html, produce.html, product.html, bookmarks.html, about.html, contact.html, login.html, signup.html, 404.html
markets/            10 static market pages (+ index redirect)
css/main.css        design system + inner pages      css/home.css   Home frame styles
css/fonts*.css      self-hosted @font-face rules
js/core.js          shared: data layer, cart, bookmarks, search, UI helpers (window.FF)
js/pages/*.js       one script per page
js/data-bundle.js   auto-generated copy of /data for file:// use
data/*.json         10 market product files (original) + markets.json + produce-info.json
assets/img          optimised images   assets/fonts   woff2   assets/vendor/fontawesome
```

## Data
- `data/<market>.json` — original product data (name, category, price, oldPrice, unit, discount, rating, reviews, stock, badge…).
- `data/markets.json` — market metadata (address, hours, coordinates, vendors, rating…).
- `data/produce-info.json` — guide content per produce (scientific name, nutrition per 100 g, peak months, benefits, storage).

Product images referenced in the JSON (`placehold.co`) need internet; curated local photos are used where available.
