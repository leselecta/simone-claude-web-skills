---
name: privacy-selfhost
description: |
  Find every third-party asset a site loads (web fonts, JS/CSS libraries,
  icon fonts, embeds, trackers) and self-host the ones that are safe to —
  so no visitor IP is shared with third parties. Classifies each asset as
  safe-to-self-host vs must-stay-remote, rewrites references, verifies zero
  external requests, and re-checks the cookie-banner/privacy posture.
  Framework-agnostic.
argument-hint: '[--audit-only | --fix-only | <path>]'
---

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
