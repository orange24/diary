import DOMPurify from "isomorphic-dompurify"

// Font sizes are produced by execCommand("fontSize"), which still emits
// <font size="1".."7"> no matter what styleWithCSS is set to. Those tags
// are mapped to classes on the way out (see serializeEditorHtml) so the
// stored HTML carries no presentational tags and the sanitizer below never
// has to allow a `style` attribute.
export const FONT_SIZE_LEVELS = [
  { label: "Small", execValue: "2", className: "ps-text-sm" },
  { label: "Normal", execValue: "3", className: "ps-text-md" },
  { label: "Large", execValue: "5", className: "ps-text-lg" },
  { label: "Huge", execValue: "7", className: "ps-text-xl" },
] as const

const CLASS_BY_EXEC_VALUE = new Map<string, string>(
  FONT_SIZE_LEVELS.map((l) => [l.execValue, l.className])
)

// One allowlist for entry HTML, shared by the editor that writes it and
// every view that renders it. The grid's own list lived inline in
// diary-grid.tsx and didn't allow <img>, so an inline emoji was silently
// dropped on render. Keeping the list next to the editor that produces the
// markup is what stops the two drifting apart again.
const ALLOWED_TAGS = [
  "b", "i", "em", "strong", "u", "a", "p", "br", "div", "ul", "ol", "li",
  "h1", "h2", "h3", "code", "pre", "span", "blockquote", "img",
]

// No `style`: every size and every emoji dimension comes from a class in
// globals.css, so user content can never inject arbitrary CSS.
const ALLOWED_ATTR = ["href", "target", "class", "src", "alt"]

export function sanitizeEntryContent(html: string): string {
  return DOMPurify.sanitize(html ?? "", { ALLOWED_TAGS, ALLOWED_ATTR })
}

// Reads the editable DOM into the HTML that gets stored. Works on a clone so
// rewriting <font> doesn't disturb the live selection the user is typing in.
export function serializeEditorHtml(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll("font[size]").forEach((font) => {
    const span = document.createElement("span")
    span.className = CLASS_BY_EXEC_VALUE.get(font.getAttribute("size") ?? "") ?? "ps-text-md"
    span.innerHTML = font.innerHTML
    font.replaceWith(span)
  })
  return sanitizeEntryContent(clone.innerHTML)
}

// True when the HTML carries nothing a reader would see — used to keep an
// entry holding only <br> or stray empty tags from counting as written text.
export function hasRenderableContent(html: string | null | undefined): boolean {
  if (!html) return false
  if (/<img\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0
}
