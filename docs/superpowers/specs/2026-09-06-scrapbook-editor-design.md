# Scrapbook-style diary entry editor

## Problem

The diary's entry editor is a linear Tiptap rich-text field. The user wants a
free-form "scrapbook" editor instead: text and photos placed anywhere on a
page, styled like decorating a physical sheet of paper — because a future
feature will compile entries into a printable diary book. Printing itself is
out of scope for this spec; the editor just needs to produce a layout that
printing can use later.

## Decisions

- **Replaces** the existing Tiptap editor entirely for new entries (not an
  additional mode).
- Per-element capabilities: drag (move), resize, rotate, layer order
  (bring to front / send to back), per-text-box styling (color, font,
  size).
- Canvas is a **fixed-width, auto-growing-height** page (A4 proportion for
  width), not a fixed-height A4 sheet with manual "add page." Pagination for
  printing is deferred to whenever printing is actually built — freeform,
  absolutely-positioned, possibly-rotated content doesn't reflow cleanly, so
  slicing it into print pages is a print-time concern, not an editor-time one.
- **Legacy entries** (existing Tiptap/HTML `content`) remain viewable exactly
  as today, but become **not editable** — the "แก้ไข" button is disabled with
  an explanatory tooltip. No migration path from HTML to scrapbook layout.
- Title stays a plain text field above the canvas (unchanged from today) —
  only the entry *body* becomes the scrapbook canvas.

## Approach: `react-moveable` on real DOM elements

Considered three approaches:

1. **`react-moveable` on real DOM elements (chosen).** Drag/resize/rotate is
   a well-solved but genuinely tricky interaction problem (rotation + resize
   combined has many edge cases) — a proven library avoids weeks of subtle
   bugs. Elements stay real DOM/HTML, which is what makes future print/PDF
   export tractable (`@media print` or html2canvas work naturally on real
   markup, not on rasterized canvas pixels).
2. Hand-rolled pointer-event math. No new dependency, but reinvents a solved
   problem with high bug risk (touch support, rotation trig, resize handles).
3. Canvas-based (Fabric.js/Konva). Good for general design tools, but text
   becomes rendered pixels rather than real text, actively working against
   the print/export goal, and needs an awkward DOM-overlay for text editing.

## Data model

New nullable Postgres column: `entries.layout jsonb`.

```json
{
  "pageWidth": 794,
  "elements": [
    { "id": "el_1", "type": "text", "x": 40, "y": 60, "width": 300, "height": 80,
      "rotation": -4, "zIndex": 2, "text": "<p>...</p>", "color": "#222222",
      "fontFamily": "Prompt", "fontSize": 18 },
    { "id": "el_2", "type": "image", "x": 380, "y": 120, "width": 220, "height": 220,
      "rotation": 8, "zIndex": 1, "src": "https://res.cloudinary.com/..." }
  ]
}
```

- `entries.images` (existing `text[]` column) stays populated — derived
  automatically from the layout's image elements on save — so the existing
  card lightbox/gallery feature keeps working unchanged.
- `entries.content` stays empty for new scrapbook entries; old entries keep
  their existing HTML in it, untouched.
- No migration tooling exists in this repo (just an ad-hoc `diary_backup.sql`
  dump) — apply `ALTER TABLE entries ADD COLUMN layout jsonb;` directly to
  the local DB; the same statement needs manual application against Supabase
  before this ships to production.

## Components

`frontend/src/components/scrapbook/`:
- `ScrapbookEditor.tsx` — the canvas: fixed-width page container (A4
  proportion, 794px reference width), height auto-grows to fit content.
  Renders child elements and, when `editable`, wires up `react-moveable`
  drag/resize/rotate handles on the selected element.
- `TextElement.tsx` — a text box: `contentEditable` content, `color`,
  `fontFamily`, `fontSize`.
- `ImageElement.tsx` — an image box: `<img src>`, resize/rotate only (no
  content editing).
- `Toolbar.tsx` — floating toolbar: add-text, add-image (reuses the existing
  `/upload` Cloudinary flow), and — when an element is selected — its style
  controls plus bring-to-front / send-to-back / delete.

The same `ScrapbookEditor` (in `editable={false}` mode, scaled down via CSS
transform) renders the read-only preview inside `diary-grid.tsx`'s card, so
the list preview always matches the real page pixel-for-pixel — and this is
the same code path printing will eventually reuse.

`diary-form.tsx` keeps its `Title` input and Save button; its body editor
becomes `ScrapbookEditor` instead of Tiptap. On save, the canvas state
serializes to the `layout` JSON shape above and is sent alongside `title` to
the existing `createEntry`/`updateEntry` API functions (extended to include
`layout` in the request body).

## Legacy entry handling

`diary-grid.tsx`: if `entry.layout` is present, render the scrapbook preview;
otherwise render the existing HTML `content` exactly as today (unchanged
code path). The "แก้ไข" button is disabled (with a tooltip, "บันทึกเก่า
ไม่รองรับการแก้ไข — กรุณาลบแล้วสร้างใหม่") when `entry.layout` is absent.

## Out of scope

- Printing / PDF export itself.
- Multi-page entries / pagination.
- Migrating old HTML entries into scrapbook layouts.
- Multi-select / group transform of elements.
- Decorative assets (stickers, washi tape, paper textures/backgrounds) beyond
  per-text-box color/font/size — can be added later without changing the
  data model (just new element types or `background` field usage).
