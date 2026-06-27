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

## privacy-selfhost

_Find every third-party asset a site loads (web fonts, JS/CSS libraries, icon fonts, embeds, trackers) and self-host the ones that are safe to — so no visitor IP is shared with third parties. Classifies each asset as safe-to-self-host vs must-stay-remote, rewrites references, verifies zero external requests, and re-checks the cookie-banner/privacy posture. Framework-agnostic._

# Privacy: Self-Host Third-Party Assets

Remove third-party requests from a site by self-hosting the static assets
that are safe to host yourself, so no visitor IP is shared with external
services (Google Fonts, CDNs, etc.). **Not everything is safe to
self-host** — the skill classifies first and only touches the safe
category. Works on any stack (static HTML, LAMP/PHP, Astro, Next, Hugo,
WordPress…); only the asset location and verification step differ.

## Flags

```text
/privacy-selfhost              # Full audit + interactive self-hosting
/privacy-selfhost --audit-only # Report third-party requests + classification
/privacy-selfhost --fix-only   # Skip audit, self-host the known-safe assets
/privacy-selfhost src/         # Scope to a path
```

---

## Phase 0 — Setup

### 0.1 Detect the stack & asset location
Where self-hosted files go depends on the stack:

| Stack | Static assets live in | Served from |
|---|---|---|
| Static HTML | alongside pages, or `assets/` | site root |
| LAMP / PHP | `assets/` or web root (refs via relative or `$basepath`) | web root |
| Astro | `public/` | site root |
| Next | `public/` | site root |
| Hugo / Jekyll / Eleventy | `static/` / `assets/` / `public/` | site root |
| WordPress | the active theme dir (`wp-content/themes/<t>/assets/`) | theme URL |

Find the head chokepoint (shared include/layout/partial) where references
will be rewritten.

### 0.2 Confirm the production origin
Used to recognise "first-party" URLs (same origin = not third-party).

### 0.3 Check tools

```bash
which curl wget 2>/dev/null
python3 --version 2>/dev/null   # for parsing font CSS / rewriting refs
```

---

## Phase 1 — Inventory third-party requests

List every external resource the pages pull in. Grep source first, then —
if the site builds or runs — inspect the **rendered HTML** (the real list).

```bash
# External URLs in markup and CSS
grep -rnoE "https?://[^\"')> ]+" <scope> \
  --include="*.html" --include="*.php" --include="*.astro" \
  --include="*.jsx" --include="*.tsx" --include="*.vue" --include="*.erb" \
  --include="*.css" --include="*.scss" | grep -viE "<production-origin>"

# CSS @import and url() (fonts, icon fonts often hide here)
grep -rnoE "@import [^;]+|url\((https?:[^)]+)\)" <scope> --include="*.css" --include="*.scss"
```

Collapse to a list of **distinct external hosts** and what each serves
(font CSS, font files, JS lib, icon font, image, iframe, tracker…).

---

## Phase 2 — Classify (the safety core — never skip)

Sort every third-party asset into one of three buckets. **Only the first is
auto-self-hosted.**

### ✅ SAFE to self-host (static, redistributable)
- **Web fonts** from Google Fonts / Fontsource / Bunny (OFL/Apache/MIT).
- **Open-source JS/CSS libraries** from cdnjs / jsDelivr / unpkg (jQuery,
  Bootstrap, lightboxes, Swiper, Alpine…). Self-host a **pinned** version.
- **Icon fonts** (Bootstrap Icons, Font Awesome *Free*) — CSS + font files.
- **Static images / SVGs** served from a third party but freely usable.

### ⛔ DO NOT self-host (breaks, or violates terms, or pointless)
- **Payment SDKs** (Stripe.js, PayPal, Braintree) — must load from the
  vendor for PCI/security; they call home regardless.
- **CAPTCHA** (reCAPTCHA, hCaptcha, Turnstile) — must stay remote.
- **Maps / live-API loaders** (Google Maps JS, Mapbox GL) — the API calls
  home anyway; self-hosting the script is pointless. Consider a static map
  image instead.
- **Embeds / social widgets / iframes** (YouTube, Vimeo, Twitter/X,
  Instagram, Disqus, share buttons) — inherently third-party. Use a
  click-to-load "facade" or remove.
- **Analytics / tag managers / pixels** (GA, GTM, Meta Pixel) — this is a
  *tracking* decision, not an asset move. For a "no third parties / no
  cookie banner" goal, **remove** them (or gate behind consent).
- **Commercially licensed fonts** (Adobe Fonts/Typekit, Monotype, Hoefler)
  — the licence typically forbids redistribution. Keep remote, or replace
  with an openly licensed font.

### ⚠️ CASE-BY-CASE (ask the user)
- Anything whose **licence is unknown** — confirm before redistributing.
- Assets you rely on for **auto-security-updates** (self-hosting freezes the
  version — you take over patching).

Present the classification and get the user's confirmation before fixing.

---

## Phase 3 — Report

Output two tables, then ask which to proceed with.

**Third-party requests found**

| Host | Serves | Bucket | Recommended action |
|---|---|---|---|
| fonts.gstatic.com | Web font files | ✅ Safe | Self-host |
| cdn.jsdelivr.net | jQuery 3.6 | ✅ Safe | Self-host (pin 3.6.1) |
| www.googletagmanager.com | GA4 | ⛔ Tracker | Remove (or gate behind consent) |
| js.stripe.com | Payments | ⛔ Keep remote | Leave as-is |

**Privacy posture (current)** — what leaves the domain today, whether
cookies/localStorage are set, whether a cookie banner is currently required.

---

## Phase 4 — Self-host the SAFE assets (one at a time)

General recipe (stack-neutral — only the destination folder changes):

1. **Pin a version.** Never self-host "latest"; record the exact version.
2. **Verify the licence permits redistribution** (OFL / Apache / MIT / BSD
   = yes). If unknown or commercial → stop, move to ⚠️, ask.
3. **Download** to the stack's asset location (Phase 0.1) with `curl`/`wget`.
4. **Follow sub-resources.** CSS that references other files (`@font-face`
   `url()`, icon-font CSS) needs those files fetched too, and the `url()`
   rewritten to local **relative** paths. Preserve the original relative
   structure (e.g. keep `./fonts/…` next to the CSS) so little rewriting is
   needed.
5. **Rewrite every reference** in the head/templates from the remote URL to
   the local path.
6. **Remove dead hints**: `preconnect`/`dns-prefetch` to those hosts, and
   `integrity`/`crossorigin` SRI attrs that no longer apply.

### Recipe: Google Fonts → local

Fetch the CSS with a desktop-browser UA (so you get `woff2`), keep only the
needed subsets (usually `latin` + `latin-ext` — keep `latin-ext` if the
copy uses accented chars), download each font file, rewrite to local:

```python
import re, os, urllib.request
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
def fetch(u, b=False):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    d = urllib.request.urlopen(r).read(); return d if b else d.decode()
css = fetch("<google-fonts-css-url>")
keep = {"latin", "latin-ext"}; out = []
for blk in re.split(r"(?=/\*)", css):
    m = re.match(r"/\*\s*([\w-]+)\s*\*/", blk)
    if not m or m.group(1) not in keep: continue
    u = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", blk)
    if not u: out.append(blk); continue
    fam = re.search(r"font-family:\s*'([^']+)'", blk).group(1).replace(" ", "")
    wgt = (re.search(r"font-weight:\s*(\d+)", blk) or [None,"400"])[1]
    name = f"{fam}-{wgt}-{m.group(1)}.woff2"
    open(f"<dest>/files/{name}","wb").write(fetch(u.group(1), True))
    out.append(blk.replace(u.group(1), f"<public-path>/files/{name}"))
open("<dest>/fonts.css","w").write("".join(out))
```

> **Gotcha:** the legacy `css?` endpoint only honours **one** family per
> request unless families are `|`-separated (`family=A:...|B:...`); a
> repeated `&family=` is silently dropped. After fetching, **confirm every
> requested family/weight is present** — a missing family means it was
> never actually loaded (and may be unused dead config worth removing).

### Recipe: CDN JS/CSS library → local
```bash
curl -fsSL "https://cdn.jsdelivr.net/npm/<pkg>@<version>/<file>" -o "<dest>/<file>"
# then point the <script>/<link> at the local path
```

### Recipe: icon font → local
Download the CSS plus its font files, preserving the `./fonts/…` relative
layout so the CSS's own `url()`s resolve unchanged once served.

---

## Phase 5 — Verify

```bash
# Build if the stack builds; else load the served page.
# Expect ZERO external asset refs to the flagged hosts:
grep -rEo "https?://[^\"')> ]+" <output> --include="*.html" \
  | grep -iE "gstatic|googleapis|jsdelivr|unpkg|cdnjs|fonts.googleapis" | sort -u
# (User-clicked links and deliberately-kept ⛔ items are fine.)
```

Then a **functional** check: fonts render, icons render, scripts work. If a
build step exists, also confirm the assets were copied into the output dir.

---

## Phase 6 — Privacy posture summary

- **What now leaves the domain** — ideally nothing automatic except server
  access logs (standard, legitimate-interest).
- **Cookie banner** — required only if cookies/localStorage are set for
  non-essential purposes. If none are set, no banner is needed; say so.
- **Footer / claim wording** — suggest an accurate line. Prefer claims about
  behaviour you control: *"No tracking, no cookies, no ads, no third
  parties."* Avoid absolute "we store no data" if server logs or any
  ⛔ item remain.
- **Kept-remote items** — list anything left third-party (payments, etc.)
  and why.

> Not legal advice — this reports the technical facts a privacy review
> would examine.

---

## Notes

- **Safety first:** never auto-self-host payment, CAPTCHA, auth, analytics,
  or commercially-licensed assets. When a licence is unclear, ask.
- **Pinning freezes versions:** you take over security patching for anything
  self-hosted. Record the version; revisit on updates.
- **No-build stacks (LAMP/static):** assets go in the web root; verify
  against the live/served page, not the source tree.
- Related: `/seo-optimise` (head metadata), `/a11y-audit`, `/img-optimise`
  (the tool-detection and self-hosted-image patterns).

---

## seo-optimise

_Audit a site's on-page SEO and discoverability (titles, meta descriptions, canonical URLs, Open Graph/Twitter cards, sitemap, robots.txt, JSON-LD structured data, breadcrumbs, IndexNow), report findings as a prioritised table, then fix them one area at a time. Framework-agnostic: detects the stack and adapts the injection mechanism._

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

---
