# Skills

Each section below is a self-contained skill. Read the one relevant to the current task.

## a11y-audit

_Run a WCAG 2.1 AA accessibility audit on the current project. Scans all pages/templates, prioritises findings by severity, and fixes them one at a time with visual regression checks._

# Accessibility Audit — WCAG 2.1 AA

Audit the project for accessibility issues, report findings ranked by severity,
then fix them one at a time while preserving visuals.

## Flags

```text
/a11y-audit              # Full audit + fix (default)
/a11y-audit --audit-only # Report findings, no changes
/a11y-audit --fix-only   # Skip audit, apply known pending fixes
/a11y-audit src/         # Scope audit to a specific path or glob
```

---

## Phase 0 — Scope

1. Identify all page templates (`.php`, `.html`, `.jsx`, `.tsx`, `.vue`, `.erb`, etc.) in the project.
2. Identify the single CSS file (or stylesheet entry point) used across pages.
3. Identify JS files that contain dynamic UI: modals, drawers, nav toggles, live regions.
4. Note the design token for brand/accent color — you'll need it for contrast checks.

---

## Phase 1 — Automated scan

Run these greps across the scoped files. Collect every match as a raw candidate.

```bash
# Heading hierarchy helpers
grep -rn "<h[1-6]" <scope>

# Redundant aria-level on native headings (e.g. <h3 aria-level="2">)
grep -rn "aria-level" <scope>

# Missing or misused ARIA
grep -rn "role=" <scope>
grep -rn "aria-labelledby\|aria-describedby" <scope>
grep -rn "aria-modal" <scope>

# Skip links
grep -rn "skip-link\|skip to\|skip nav" <scope>

# Focus management
grep -rn "inert\|aria-hidden\|tabindex" <scope>

# Motion — CSS
grep -n "animation\|transition\|@keyframes" css/main.css
grep -n "prefers-reduced-motion" css/main.css

# Motion — JS
grep -rn "animation\|transition\|setTimeout\|setInterval" js/main.js

# Modals / dialogs
grep -rn "role=\"dialog\"\|role='dialog'" <scope>

# Images
grep -rn "<img" <scope>

# Interactive elements without labels
grep -rn "<button\|<a " <scope> | grep -v "aria-label\|aria-labelledby\|>.\+<"

# Color contrast — find text-on-background combos in CSS
grep -n "color:\|background" css/main.css | grep -v "\/\*"
```

---

## Phase 2 — Manual checklist

Read each page template and check against this list. Log every issue found.

### 2.1 Heading structure (SC 1.3.1)
- Single `<h1>` per page, matches the page title
- No skipped levels (e.g. h1 → h3 with no h2)
- Native heading elements used (`<h2>`, not `<div role="heading" aria-level="2">`)
- `aria-level` absent on native `<h2>`–`<h6>` (it overrides the native level — wrong)

### 2.2 Landmarks (SC 1.3.1 / 4.1.2)
- `<header>`, `<nav>`, `<main>`, `<footer>` or equivalent `role=` attributes present
- `<nav>` elements have `aria-label` when more than one exists on a page
- `role="banner"` not nested inside `role="main"` (low priority but worth noting)

### 2.3 Skip link (SC 2.4.1)
- `<a href="#main-content" class="skip-link">` is the first focusable element
- Visible on keyboard focus (not permanently hidden)
- Text color has ≥4.5:1 contrast against its background
- The target anchor (`id="main-content"`) exists in the page

### 2.4 Color contrast (SC 1.4.3 / 1.4.11)
- Normal text (< 24px or < 18.67px bold): minimum **4.5:1**
- Large text (≥ 24px or ≥ 18.67px bold): minimum **3:1**
- UI components and focus indicators: minimum **3:1**
- Check muted/secondary text, placeholder text, and disabled states

### 2.5 Keyboard navigation (SC 2.1.1)
- All interactive elements (buttons, links, inputs) reachable by Tab
- Logical focus order matches visual order
- Focus is not trapped outside intentional modal contexts
- Custom components (nav toggles, accordions) operable with Enter/Space/Escape

### 2.6 Focus management (SC 2.4.3)
- Modals/dialogs: focus moves to first focusable element on open; returns to trigger on close
- `inert` or `aria-hidden="true"` applied to background content when modal is open
- Nav panels: `inert` + `aria-hidden` when closed; removed on open

### 2.7 Motion and animation (SC 2.3.3)
- CSS `animation` and `transition` rules are wrapped in:
  ```css
  @media (prefers-reduced-motion: reduce) { animation: none; transition: none; }
  ```
- JS animations (intervals, timeouts driving visual changes) are guarded:
  ```js
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ```
- Autoplaying `<video>` is paused under reduced-motion

### 2.8 Dialog / modal semantics (SC 4.1.2)
- `role="dialog"` and `aria-modal="true"` present
- `aria-labelledby` points to an **`<h2>`** (or equivalent heading), not a `<p>` or `<div>`
- Close button has `aria-label="Close"`
- Focus is trapped within the modal (Tab cycles only inside)

### 2.9 Images and icons (SC 1.1.1)
- Informative `<img>` elements have meaningful `alt` text
- Decorative images have `alt=""` and/or `aria-hidden="true"`
- Icon fonts (Font Awesome etc.) use `aria-hidden="true"` on the icon element;
  meaningful context provided by visually-hidden text or `aria-label` on the parent

### 2.10 Links and buttons (SC 4.1.2)
- Every `<a>` has visible text or `aria-label`
- `<button>` elements have visible text or `aria-label`
- Links that open in a new tab include `(opens in new tab)` visually or via `aria-label`
- `aria-current="page"` on the active nav link

### 2.11 Live regions (SC 4.1.3)
- Dynamic status messages (copy-to-clipboard feedback, form validation) use
  `aria-live="polite"` or `aria-live="assertive"` appropriately
- `aria-live` regions are in the DOM before content is injected (not dynamically created)

---

## Phase 3 — Prioritise findings

Group findings into four bands and present them to the user before fixing:

| Priority | Criteria | Examples from audit |
|---|---|---|
| **Critical** | Blocks a screen-reader user from core content | Missing skip link, missing `<main>`, trapped keyboard focus |
| **High** | Fails WCAG AA, likely caught by automated tools | Contrast failure, missing alt text, broken heading order |
| **Medium** | Fails WCAG AA but low user impact, or misuse of ARIA | `aria-level` on native heading, `<p>` as dialog label |
| **Low** | Best practice, minor semantic issue | Redundant role, nested landmarks |

Present the list with file:line references. Ask before proceeding to Phase 4.

---

## Phase 4 — Fix (one issue at a time)

For each finding, in priority order:

1. **State** what will change and why (one sentence).
2. **Verify visuals are unaffected** before committing — if the fix touches CSS, check that layout, colors, and spacing remain identical in the browser.
3. **Make the smallest change** that fully resolves the issue. No surrounding cleanup.
4. **Confirm with the user** before moving to the next finding.

### Common fixes reference

**Skip link contrast (color override by global `a:link`):**
```css
.skip-link,
.skip-link:link,
.skip-link:visited { color: #1A1A1A; }
```

**`aria-level` on native heading — just remove the attribute:**
```bash
sed -i '' 's/ aria-level="[0-9]"//g' path/to/file.php
```

**Dialog label from `<p>` to `<h2>` (JS-generated modal):**
```js
'<h2 id="modal-heading">Title</h2>'
```
And ensure CSS resets heading defaults so visuals don't shift:
```css
#modal-heading { margin: 0; padding: 0; font-size: 2rem; font-weight: 700; }
```

**prefers-reduced-motion guard in CSS:**
```css
@media (prefers-reduced-motion: reduce) {
  .animated-element { animation: none; transition: none; }
}
```

**prefers-reduced-motion guard in JS:**
```js
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

---

## Phase 5 — Summary report

After all fixes, output a table:

| # | Issue | File | WCAG SC | Status |
|---|---|---|---|---|
| 1 | Skip link contrast | css/main.css | 1.4.3 | Fixed |
| … | … | … | … | … |

Note any items that were **not fixed** (e.g. low priority, architectural change needed) and explain why.

---

## img-optimise

_Audit all images in the project for file size, dimensions, format appropriateness, orphaned files, and broken references. Returns a prioritised table then offers to fix any category interactively._

# Image Optimisation Audit

Scan every image in the project, identify what can be improved, report
findings as a structured table, then fix issues one category at a time
with the user's approval.

## Flags

```text
/img-optimise              # Full audit + interactive fix (default)
/img-optimise --audit-only # Report only — no changes made
/img-optimise --fix-only   # Skip audit, jump straight to fixing
/img-optimise img/sonos/   # Scope audit to a specific folder
```

---

## Phase 0 — Setup

### 0.1 Locate images
Find all image files (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`,
`.avif`) in the project, excluding `node_modules/`, `vendor/`, and
third-party asset folders.

```bash
find . -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \
  -o -iname "*.gif" -o -iname "*.webp" -o -iname "*.svg" -o -iname "*.avif" \) \
  ! -path "*/node_modules/*" ! -path "*/vendor/*" | sort
```

### 0.2 Locate source files that reference images
Collect all templates and stylesheets (`.php`, `.html`, `.htm`, `.jsx`,
`.tsx`, `.vue`, `.erb`, `.css`, `.scss`, `.js`, `.ts`) to cross-reference
against the image inventory.

### 0.3 Check available tools
Detect which optimisation tools are installed — the fix phase uses the
best available option:

```bash
python3 -c "from PIL import Image; print('pillow ok')" 2>/dev/null
which pngquant 2>/dev/null
which magick 2>/dev/null    # ImageMagick 7
which convert 2>/dev/null   # ImageMagick 6
which cwebp 2>/dev/null
```

Note results. If nothing is available beyond `sips` (macOS), flag it —
`sips` re-encodes JPEGs loosely and should be used only as a last resort
for resizing (not compression). Offer to `brew install` Pillow or pngquant
if missing.

---

## Phase 1 — Inventory

### 1.1 Sizes and dimensions
For every image file, collect:
- File path (relative to project root)
- File size (human-readable: KB / MB)
- Pixel dimensions (width × height)
- Format

```bash
# macOS
find . -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \
  -o -iname "*.gif" -o -iname "*.webp" \) \
  ! -path "*/node_modules/*" | while read f; do
  size=$(ls -lh "$f" | awk '{print $5}')
  dims=$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null \
    | grep pixel | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//')
  echo "$size | $dims | $f"
done | sort -rh
```

### 1.2 Cross-reference: used vs orphaned vs missing
Extract every image path referenced in source files:

```bash
grep -roh 'img/[^"'"'"' )>]*\|images/[^"'"'"' )>]*\|assets/[^"'"'"' )>]*' \
  --include="*.php" --include="*.html" --include="*.css" \
  --include="*.scss" --include="*.js" --include="*.ts" . \
  | sed 's/.*\(img\/\|images\/\|assets\/\)/\1/' | sort -u
```

Also check for absolute URLs with the production domain and `og:image`
meta tags — those reference images by full URL but the file still needs
to exist on disk.

Categorise each file:
- **In use** — referenced in at least one source file
- **Orphaned** — file exists on disk, no reference found anywhere
- **Missing** — referenced in source but file not on disk

Watch for duplicate format pairs (e.g. `hero.jpg` + `hero.png` where only
one is referenced — the other is an orphan).

---

## Phase 2 — Analysis

For each **in-use** image, apply these rules:

### Format
| Content type | Preferred format | Notes |
|---|---|---|
| Photograph / hero / background | JPEG or WebP | PNG wastes 3–5× on photos |
| UI screenshot / diagram with text | PNG | JPEG blurs sharp edges |
| Logo / icon with transparency | PNG or SVG | |
| Animated sequence | `<video>` MP4 | GIF is always the wrong choice above ~100KB |
| Open Graph (`og:image`) | JPEG | ~1200×630px, keep under 200KB |
| Profile / avatar | JPEG or PNG at 2× display size | e.g. displayed at 200px → save at 400px max |

### Size thresholds
| Weight | Status |
|---|---|
| < 100KB | OK |
| 100–300KB | Review — may be fine depending on image role |
| 300KB–1MB | Optimise |
| > 1MB | Critical — always optimise |

### Dimension rules
- Max serving width for most layouts: **1400px** (adjust if the project
  uses a wider max-width)
- Images wider than 1.5× the max display width should be resized
- Profile/avatar images: serving size should be max 2× the CSS display size
- `deepvsflat`-style diagrams exported at retina resolution (> 3000px):
  always resize

### Filenames
- Flag filenames with **spaces** — these must be URL-encoded in HTML and
  are error-prone. Note them for renaming.

---

## Phase 3 — Report

Output four clearly labelled tables.

### Table 1: Missing files
Files referenced in source that don't exist on disk — these are active
bugs (broken images or silent CSS failures).

| Reference | Found in | Action |
|---|---|---|
| `img/hero.png` | `index.php:14` | Restore file or remove reference |

### Table 2: In-use images — action needed
Sort by urgency: Critical (>1MB or broken format) → High → Medium.

| File | Size | Dimensions | Issue | Recommended action |
|---|---|---|---|---|
| `img/hero.png` | 1.8MB | 3000×1686 | PNG photo, 3× too wide | Convert to JPEG, resize to 1400px → ~150KB |

### Table 3: In-use images — OK
One line each: file, size, dimensions. No further action needed.

### Table 4: Orphaned files
Files on disk with no reference in any source file. Include size so the
user can see the total dead weight.

| File | Size | Notes |
|---|---|---|
| `img/old-hero.png` | 4.5MB | Superseded — no reference found |
| **Total** | **~22MB** | |

---

## Phase 4 — Fix

After presenting the tables, ask:

> "Which category would you like to tackle first?
> 1. Delete orphaned files (~XMB freed)
> 2. Fix broken references (remove or update)
> 3. Resize oversized images
> 4. Recompress without resizing
> 5. Convert format (e.g. PNG photo → JPEG)
> Or name a specific file."

Work through the chosen category. For each file, state the before/after
expectation, make the change, and confirm the result.

### Fix recipes

#### Check and install tools
```bash
# Prefer Pillow — best quality/control
python3 -c "from PIL import Image" 2>/dev/null || pip3 install Pillow

# pngquant for lossy PNG compression
which pngquant || brew install pngquant   # macOS
# or: apt install pngquant               # Linux
```

#### JPEG: resize + compress (Pillow — preferred)
```python
from PIL import Image
img = Image.open("input.jpg")
if img.width > 1400:
    ratio = 1400 / img.width
    img = img.resize((1400, int(img.height * ratio)), Image.LANCZOS)
img.convert('RGB').save("output.jpg", "JPEG", quality=78,
                         optimize=True, progressive=True)
```

#### PNG: lossy compression (pngquant — preferred)
```bash
pngquant --quality=70-85 --ext .png --force --strip input.png
```

#### PNG: lossless recompress (Pillow fallback)
```python
from PIL import Image
Image.open("input.png").save("output.png", "PNG", optimize=True)
```

#### Convert PNG photo → JPEG
```python
from PIL import Image
img = Image.open("input.png").convert("RGB")
img.save("output.jpg", "JPEG", quality=78, optimize=True, progressive=True)
# Then update the src reference in templates and delete the .png
```

#### Resize only (sips — macOS fallback, use sparingly)
`sips` re-encodes at its own quality and can make files larger.
Only use it for resizing when Pillow is unavailable, then recompress
with pngquant or Pillow immediately after.

```bash
sips --resampleWidth 1400 input.jpg --out output.jpg
```

### Broken CSS background references
When a CSS `background-image` or `background` url points to a missing
file, remove only the url value — keep the rule and any other properties:

```css
/* Before */
.lead { background-image: url("../img/missing.png"); height: 400px; }

/* After — class intact, broken reference removed */
.lead { height: 400px; }
```

### Filenames with spaces
Rename the file and update every reference in templates and CSS:

```bash
mv "img/my file.jpg" "img/my-file.jpg"
# Then sed-replace the old name in source files
```

---

## Phase 5 — Summary

After all fixes, output:

| File | Before | After | Action |
|---|---|---|---|
| `img/urra/urra-hero.jpg` | 1.0MB 3000px | 203KB 1400px | Resize + compress |
| `img/homeIA/` (4 files) | 15.5MB | deleted | Orphan removed |

Total saved: **X MB**

List any files skipped and why (user declined, needs manual source file
update, SVG animation too complex to auto-optimise, etc.).

---

## seo-optimise

_Audit a site's on-page SEO and discoverability (titles, meta descriptions, canonical URLs, Open Graph/Twitter cards, sitemap, robots.txt, JSON-LD structured data, breadcrumbs), report findings as a prioritised table, then fix them one area at a time. Framework-agnostic: detects the stack and adapts the injection mechanism._

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
| **Sitemap** | Lists all indexable URLs; uses an index file if paginated. |
| **robots.txt** | Allows crawling; points at the sitemap. |
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
- **No plugin:** generate `sitemap.xml` from the page list:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about/</loc></url>
</urlset>
```

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
   ships (incl. sitemap + robots.txt).
2. **Submit the sitemap index** (not a paginated child like
   `sitemap-0.xml`) in Google Search Console.
3. **Validate:**
   - `validator.schema.org` — confirms *all* JSON-LD, including
     non-rich-result types (Person, WebSite, ImageGallery…).
   - Rich Results Test — only detects rich-result-eligible types
     (BreadcrumbList, Article, Product…). "No items detected" for a
     Person/WebSite/Gallery page is **expected, not a bug**.
   - `opengraph.xyz` or a private chat paste — confirms the OG card.
4. **Patience note:** rich results only appear in live search after a
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

---
