---
name: img-optimise
description: |
  Audit all images in the project for file size, dimensions, format
  appropriateness, orphaned files, and broken references. Returns a
  prioritised table then offers to fix any category interactively.
argument-hint: '[--audit-only | --fix-only | <path>]'
---

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
