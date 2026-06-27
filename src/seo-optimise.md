---
name: seo-optimise
description: |
  Audit a site's on-page SEO and discoverability (titles, meta
  descriptions, canonical URLs, Open Graph/Twitter cards, sitemap,
  robots.txt, JSON-LD structured data, breadcrumbs, IndexNow), report findings as a
  prioritised table, then fix them one area at a time. Framework-agnostic:
  detects the stack and adapts the injection mechanism.
argument-hint: "[--audit-only | --fix-only | <path>]"
---

# SEO & Discoverability Optimisation

Audit on-page SEO, report findings ranked by impact, then fix them one
area at a time. The metadata Google reads is identical on every stack —
only *where you inject it* changes. This skill audits generically, detects
the stack once, and adapts the mechanism.

## Flags

```text
/seo-optimise              # Full audit + interactive fix (default)
/seo-optimise --audit-only # Report findings, no changes
/seo-optimise --fix-only   # Skip audit, apply known pending fixes
/seo-optimise src/         # Scope audit to a specific path
```

---

## Phase 0 — Setup

### 0.1 Detect the stack
Identify how pages are produced so the fix phase targets the right place:

```bash
ls astro.config.* next.config.* nuxt.config.* gatsby-config.* \
   config.toml config.yaml _config.yml hugo.toml \
   composer.json wp-config.php Gemfile 2>/dev/null
ls package.json 2>/dev/null && cat package.json 2>/dev/null | grep -E '"(astro|next|nuxt|gatsby|@11ty|eleventy|svelte|vue)"'
```

Map the result to a mechanism (see the table in Phase 3.0). If nothing
matches, treat it as hand-authored static HTML.

### 0.2 Find the head chokepoint
Locate the single shared template/partial every page renders through —
this is where almost every fix belongs, driven by per-page values:

```bash
grep -rln "<head" --include="*.html" --include="*.php" --include="*.astro" \
  --include="*.jsx" --include="*.tsx" --include="*.vue" --include="*.erb" \
  --include="*.liquid" --include="*.njk" . | grep -vi node_modules
```

If there is no shared layout (loose `.html` files), note that fixes must be
applied per file or a shared include introduced.

### 0.3 List pages and their roles
Enumerate routes/pages. Tag each as **home**, **hub/listing**, or **leaf
content** — roles drive the JSON-LD `@type` and breadcrumb depth later.

### 0.4 Confirm the production origin
Ask the user for the canonical URL (e.g. `https://example.com`). Required
for `<link rel="canonical">`, the sitemap, and absolute OG image URLs.
**Do not guess it.**

### 0.5 Check available tools (for OG image generation)
If the stack has no build-time image pipeline, the OG image is generated
with a CLI tool. Detect what's present (mirrors `/img-optimise`):

```bash
python3 -c "from PIL import Image; print('pillow ok')" 2>/dev/null
which magick convert cwebp sips 2>/dev/null
```

---

## Phase 1 — Audit

Grep the layout and pages; record present/absent for each item. These are
stack-neutral (they inspect source or rendered HTML).

**Set `<scope>` to the rendered output for any site with a build step** —
point it at the build dir (`dist/`, `_site/`, `public/`, `.next/`), not the
source tree, so the audit reflects what crawlers actually receive. Build
first if the output is stale. Only audit source directly for hand-authored
static HTML with no build.

```bash
grep -rn "<title>\|name=\"description\"\|rel=\"canonical\"" <scope>
grep -rn "og:\|twitter:" <scope>
grep -rn "application/ld+json\|schema.org" <scope>
grep -rn "<html[^>]*lang=" <scope>
ls public/robots.txt static/robots.txt robots.txt 2>/dev/null
find . -name "sitemap*.xml" ! -path "*/node_modules/*" 2>/dev/null
grep -rln "lastmod" --include="sitemap*.xml" . 2>/dev/null        # sitemap freshness hints?
find . -maxdepth 3 -regextype posix-extended -regex '.*/[0-9a-fA-F]{8,}\.txt' \
  ! -path "*/node_modules/*" 2>/dev/null                          # IndexNow key file present?
```

If the site has a build step, also audit the **built output** (e.g.
`dist/`, `.next/`, `public/`, `_site/`) — source can look right while the
rendered HTML is missing values.

### Checklist

| Area | What "good" looks like |
|---|---|
| **Title** | Unique per page, descriptive, ~50–60 chars, brand suffix. No bare domain as the home title. |
| **Meta description** | Unique per page, ~140–160 chars, specific. Not duplicated, not missing. |
| **Canonical** | Absolute, self-referential, matches the served URL incl. trailing-slash convention. |
| **Open Graph** | `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (+`:width`/`:height`). Image is an **absolute** URL, 1200×630. |
| **Twitter** | `twitter:card=summary_large_image`, title, description, image. |
| **Sitemap** | Lists all indexable URLs, each with `<lastmod>`; uses an index file if paginated. |
| **robots.txt** | Allows crawling; points at the sitemap. |
| **IndexNow** | Key file at the web root + a post-deploy ping to `api.indexnow.org` (multi-engine: Bing, Yandex, Seznam, Naver). |
| **JSON-LD** | Valid schema.org graph: a stable entity (Person/Organization) + a per-page node, cross-referenced by `@id`. |
| **Breadcrumbs** | `BreadcrumbList` on inner pages (the one rich-result-eligible item here). |
| **`lang`** | `<html lang="…">` set. |
| **Headings/alt** | One `<h1>`/page; informative images have alt. (Defer deep a11y to `/a11y-audit`.) |

---

## Phase 2 — Prioritise

Present findings as a table before fixing. Suggested impact order:

| Priority | Area | Why |
|---|---|---|
| **High** | Titles, meta descriptions | Drive search click-through; biggest lever. |
| **High** | Canonicals (+ origin/base config) | Prevents duplicate-content ambiguity; unlocks the sitemap. |
| **High** | Open Graph / Twitter | Shared links render a card, not a blank box. |
| **Medium** | Sitemap + robots.txt | Helps engines discover and crawl all pages. |
| **Medium** | JSON-LD | Helps engines model the site as an entity. |
| **Low/Win** | BreadcrumbList | The only schema here yielding a *visible* rich result. |
| **Low/Win** | IndexNow | Multi-engine instant re-crawl (Bing/Yandex/…): one key file + a post-deploy ping. |

Dependency: **canonicals and the sitemap need the production origin
configured first.** Ask before proceeding to Phase 3.

---

## Phase 3 — Fix (one area at a time)

For each area: state what changes and why, make the smallest change, then
verify in the rendered HTML.

### 3.0 Pick the injection mechanism

The **markup to produce is identical everywhere** (sections 3.1–3.6). What
differs is where per-page values come from. Map the detected stack:

| Stack | Shared head lives in | Per-page values via |
|---|---|---|
| Static HTML | each file's `<head>` (or introduce an include) | edit each file / templating tool |
| PHP | `inc/head.php` (or similar include) | `$variables` set before the include |
| Astro | `src/layouts/*.astro` | component `Props` + `Astro.site` / `getImage()` |
| Next.js | root layout / `generateMetadata` | the Metadata API export |
| Nuxt | `app.vue` / `useHead()` | `useHead`/`useSeoMeta` per page |
| Hugo / Eleventy / Jekyll | base template partial | front-matter fields + site config |
| WordPress | theme `header.php` or an SEO plugin | the loop / plugin fields |

Centralise in the shared head; vary by per-page value. Resist per-page
`<head>` blocks unless the stack has no shared layout.

### 3.1 Title + description + canonical (target markup)

```html
<title>Page Title - Brand</title>
<meta name="description" content="Unique, specific, ~150 chars." />
<link rel="canonical" href="https://example.com/this-page/" />
```

Build the canonical as `origin + current path`, honouring the site's
trailing-slash convention. Set the production origin in the stack's site
config where one exists (`site` in Astro, `metadataBase` in Next, `baseURL`
in Hugo, `url` in Jekyll, `$basepath` in PHP).

### 3.2 Open Graph + Twitter (target markup)

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Brand" />
<meta property="og:title" content="Page Title - Brand" />
<meta property="og:description" content="Same as meta description." />
<meta property="og:url" content="https://example.com/this-page/" />
<meta property="og:image" content="https://example.com/og/this-page.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title - Brand" />
<meta name="twitter:description" content="Same as meta description." />
<meta name="twitter:image" content="https://example.com/og/this-page.jpg" />
```

**OG image must be an absolute URL, 1200×630.** Generate it from a
representative page image:

- **Build-time pipeline (Astro/Next/etc.):** use the framework's image API
  (e.g. Astro `getImage({ width:1200, height:630, fit:'cover' })`) and
  prefix the result with the origin.
- **No pipeline:** crop one with a detected CLI tool (see `/img-optimise`):

```python
# Pillow — cover-crop to 1200×630
from PIL import Image, ImageOps
img = Image.open("hero.jpg").convert("RGB")
ImageOps.fit(img, (1200, 630), Image.LANCZOS).save("og/this-page.jpg",
    "JPEG", quality=82, optimize=True)
```
```bash
# ImageMagick equivalent
magick hero.jpg -resize 1200x630^ -gravity center -extent 1200x630 \
  -quality 82 og/this-page.jpg
```

### 3.3 Sitemap

- **Has a sitemap plugin/integration** (Astro `@astrojs/sitemap`, Next
  `sitemap.ts`, Hugo built-in, Jekyll `jekyll-sitemap`): enable it; it
  reads the configured origin.
- **No plugin:** generate `sitemap.xml` from the page list, each URL with a
  `<lastmod>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2025-01-15</lastmod></url>
  <url><loc>https://example.com/about/</loc><lastmod>2025-01-15</lastmod></url>
</urlset>
```

`lastmod` helps engines prioritise re-crawl — but **only if accurate**; a
stale date can suppress re-crawling. Source it per page from
`git log -1 --format=%cs -- <file>`, or, when shared layouts/includes mean
any change re-renders every page, use a single site-wide date (the last
build/commit) for all URLs. Regenerate it on each build/deploy so it never
goes stale.

### 3.4 robots.txt

Place at the web root (`public/`, `static/`, or site root):

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap-index.xml
```

(Point at `sitemap-index.xml` if the generator produces an index, else
`sitemap.xml`.)

### 3.5 JSON-LD structured data (target markup)

One `@graph`: a stable entity referenced by `@id`, plus a page node whose
`@type` matches the page role (`WebSite` home, `CollectionPage` hub,
`ImageGallery`/`Article`/`Product`… leaf). Inject as a raw script in the
head — escape nothing the framework would reprocess (Astro: `is:inline`):

```html
<script type="application/ld+json">
{ "@context":"https://schema.org","@graph":[
  {"@type":"Person","@id":"https://example.com/#person","name":"…"},
  {"@type":"ImageGallery","@id":"https://example.com/page/#page",
   "url":"https://example.com/page/","name":"…","description":"…",
   "image":"https://example.com/og/page.jpg",
   "author":{"@id":"https://example.com/#person"}}
]}
</script>
```

### 3.6 BreadcrumbList (target markup)

Use explicit labels per page (cleaner than slug-derived). Home gets none:

```json
{"@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","position":1,"name":"Home","item":"https://example.com/"},
  {"@type":"ListItem","position":2,"name":"Section","item":"https://example.com/section/"},
  {"@type":"ListItem","position":3,"name":"This Page","item":"https://example.com/section/this/"}
]}
```

Fold it into the same `@graph` as 3.5.

### 3.7 IndexNow (multi-engine instant indexing)

A keyed ping that tells **Bing, Yandex, Seznam and Naver** to re-crawl
specific URLs immediately, instead of waiting for a scheduled crawl.
Stack-neutral: a static key file plus an HTTP POST. Three parts:

1. **Generate a key** (any 8–128 hex chars):
   ```bash
   openssl rand -hex 16
   ```
2. **Host the key file** at the web root so ownership verifies — a file
   named `{key}.txt` containing exactly the key. Same asset location as
   robots.txt (3.4): `public/`, `static/`, or the site root.
   ```bash
   printf '%s' "$KEY" > <web-root>/$KEY.txt
   ```
3. **Ping after deploy** — POST the URL list (reuse the sitemap's page
   list) to the aggregator, which fans out to every participating engine:
   ```bash
   curl -fsS -X POST "https://api.indexnow.org/indexnow" \
     -H "Content-Type: application/json; charset=utf-8" \
     -d '{"host":"example.com","key":"'"$KEY"'",
          "keyLocation":"https://example.com/'"$KEY"'.txt",
          "urlList":["https://example.com/","https://example.com/about/"]}'
   ```

Wire the ping to fire **after** content is live (the key file must be
reachable first) via whatever the stack uses to ship:

| Stack / deploy | Where the ping lives |
|---|---|
| Manual / FTP (static, LAMP, PHP) | a standalone `indexnow.sh` the user runs post-upload |
| Build + deploy script | a post-deploy step in that script |
| Host deploy hooks (Netlify/Vercel/Cloudflare) | a deploy-success webhook or function |
| Node/JS projects | a `postdeploy` npm script (`node indexnow.mjs`) |

Use `api.indexnow.org` (distributes to all engines), **not** a
single-engine endpoint. Submit the full URL list each time — it's cheap and
idempotent. **Don't** ping during the skill run (content isn't live yet) —
it belongs in the Phase 5 checklist.

---

## Phase 4 — Verify

Inspect the **rendered HTML**, not just source — a missing origin/base
config or a templating typo only shows there. Build first if the stack has
a build step, else open the served file:

```bash
# whichever applies: npm run build / hugo / jekyll build / (none)
grep -E 'canonical|name="description"|og:|twitter:|ld\+json' <output>/index.html
cat <output>/sitemap*.xml          # all URLs present?
sips -g pixelWidth -g pixelHeight <output>/og/<file>.jpg  # 1200×630?
```

---

## Phase 5 — Summary & deploy checklist

Output a status table (area | status | notes), then the steps that live
**outside** the codebase:

1. **Deploy the built output** — none of this is live until the new build
   ships (incl. sitemap + robots.txt + the IndexNow key file).
2. **Submit the sitemap index** (not a paginated child like
   `sitemap-0.xml`) in **Google Search Console** and **Bing Webmaster
   Tools** (Bing can one-click *import from GSC*, which also verifies it).
3. **Ping IndexNow** (3.7) once the deploy is live, so Bing/Yandex re-crawl
   on demand. Re-run it after every future deploy (an alias/`postdeploy`
   hook keeps it one step).
4. **Validate:**
   - `validator.schema.org` — confirms *all* JSON-LD, including
     non-rich-result types (Person, WebSite, ImageGallery…).
   - Rich Results Test — only detects rich-result-eligible types
     (BreadcrumbList, Article, Product…). "No items detected" for a
     Person/WebSite/Gallery page is **expected, not a bug**.
   - `opengraph.xyz` or a private chat paste — confirms the OG card.
5. **Patience note:** rich results only appear in live search after a
   re-crawl; the test tools confirm correctness immediately.

---

## Notes

- **Voice for prose:** titles and descriptions are published copy. Read the
  page before writing its description; keep the author's voice; make it
  specific to that page; avoid em-dashes.
- **One head, many values:** centralise in the shared layout/partial and
  vary by per-page value. Only fall back to per-file `<head>` edits when
  there is genuinely no shared template.
- **Identical markup, different mechanism:** when in doubt, write the exact
  tags from Phase 3 and wire the per-page values through whatever
  templating the detected stack uses.
- Related: `/a11y-audit` (headings, alt, lang), `/img-optimise` (the source
  images OG cards are generated from, and the tool-detection pattern).
