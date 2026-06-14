---
name: a11y-audit
description: |
  Run a WCAG 2.1 AA accessibility audit on the current project.
  Scans all pages/templates, prioritises findings by severity, and fixes
  them one at a time with visual regression checks.
argument-hint: '[--audit-only|--fix-only|<file-or-glob>]'
---

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
