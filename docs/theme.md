# Theme tokens

Every color, radius, shadow and font lives in [`app/globals.css`](../app/globals.css) as a CSS variable, named by role. Tailwind v4 maps them to utilities in the `@theme inline` block in the same file, so there is no `tailwind.config.ts`. To change the theme, edit that one file.

The current values are a **placeholder theme** (neutral surfaces with UT orange). They get replaced when a `DESIGN.md` is chosen.

| Token | Tailwind utility | Placeholder | Used for |
|---|---|---|---|
| `--bg` | `bg-bg` | `#f7f7f5` | Page background |
| `--surface` | `bg-surface` | `#ffffff` | Cards, sheets, tab bar |
| `--surface-2` | `bg-surface-2` | `#f0efeb` | Inputs, chips, skeletons, nested cards |
| `--text` | `text-text` | `#1c1c1a` | Body text, headings |
| `--text-muted` | `text-muted` | `#6b6a65` | Secondary text, inactive tabs |
| `--border` | `border-border` (default border color) | `#e3e2dd` | Dividers, card outlines |
| `--primary` | `bg-primary`, `text-primary` | `#ff8200` | Main buttons, Log tab, focus ring |
| `--primary-fg` | `text-primary-fg` | `#1c1c1a` | Text and icons on primary |
| `--accent` | `bg-accent`, `text-accent` | `#58595b` | Secondary emphasis |
| `--success` | `text-success` | `#1f6f43` | "Fits your macros" badges, confirmations |
| `--warning` | `text-warning` | `#8a5a10` | "Over your remaining", low balance |
| `--danger` | `text-danger` | `#c53030` | Errors, delete |
| `--calories` | `text-calories`, `stroke-calories` | `#ff8200` | Calorie ring |
| `--protein` | `text-protein` | `#3b6fd8` | Protein ring, bars, labels |
| `--carbs` | `text-carbs` | `#2f9e8f` | Carbs ring, bars, labels |
| `--fat` | `text-fat` | `#b9852f` | Fat ring, bars, labels |
| `--radius-sm` | `rounded-sm` | `8px` | Chips, small buttons |
| `--radius-md` | `rounded-md` | `12px` | Inputs, buttons |
| `--radius-lg` | `rounded-lg` | `20px` | Cards, bottom sheets |
| `--shadow-card` | `shadow-card` | soft 2-layer | Cards |
| `--app-font-sans` | `font-sans` | DM Sans (next/font) | All text |
| `--app-font-display` | `font-display` | Bricolage Grotesque (next/font) | Headings, big numbers, logo wordmark |
| `--tab-bar-height` | `h-(--tab-bar-height)` | `64px` | Bottom tab bar, page bottom padding |
| `--content-max` | `max-w-(--content-max)` | `480px` | Centered content column |

**Rules:** components never use raw hex values, `rounded-[…]`, arbitrary shadows or fixed font sizes outside Tailwind's type scale. Macro colors always appear with a text label, so color is never the only signal.
