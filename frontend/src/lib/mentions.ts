// Matches Thai/Latin letters, digits, and underscore — same charset as
// hashtags, kept in its own file since mentions resolve against friends
// (not free text) and aren't click-navigable.
const MENTION_SOURCE = "@([\\p{L}\\p{N}_]+)"

function mentionRegex() {
  return new RegExp(MENTION_SOURCE, "gu")
}

// text-logo (not text-primary) — primary is a plain grayscale token in this
// theme and would be visually indistinguishable from regular body text.
export const MENTION_STYLE_CLASS = "font-semibold text-logo"

// Wraps every "@name" occurrence in already-sanitized HTML with a styled
// (non-interactive) span, walking real DOM text nodes — mirrors
// linkifyHashtags in @/lib/hashtags, just without the click behavior since
// there's no per-mention destination to navigate to.
export function linkifyMentions(html: string): string {
  if (typeof document === "undefined") return html

  const container = document.createElement("div")
  container.innerHTML = html

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child)
        continue
      }
      if (child.nodeType !== Node.TEXT_NODE) continue

      const text = child.textContent ?? ""
      const matches = Array.from(text.matchAll(mentionRegex()))
      if (matches.length === 0) continue

      const frag = document.createDocumentFragment()
      let lastIndex = 0
      for (const match of matches) {
        const [full] = match
        const index = match.index ?? 0
        if (index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, index)))

        const span = document.createElement("span")
        span.className = MENTION_STYLE_CLASS
        span.textContent = full
        frag.appendChild(span)

        lastIndex = index + full.length
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)))

      node.replaceChild(frag, child)
    }
  }
  walk(container)
  return container.innerHTML
}
