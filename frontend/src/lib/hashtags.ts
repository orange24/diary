import type { MouseEvent } from "react"
import { Entry } from "@/services/api"

// Matches Thai/Latin letters, digits, underscore, AND Thai combining marks
// (tone marks like ่ ้, vowel signs like ั ุ ึ — Unicode category M) so
// "#ออกกำลังกายลดหุ่น" isn't cut short at the first tone mark; \p{L} alone
// only covers base letters, not the combining marks stacked onto them.
const HASHTAG_SOURCE = "#([\\p{L}\\p{N}\\p{M}_]+)"

// A `g`-flagged RegExp is stateful (lastIndex), so every caller gets its own
// instance rather than sharing one that could be mid-iteration elsewhere.
function hashtagRegex() {
  return new RegExp(HASHTAG_SOURCE, "gu")
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ")
}

// Entries are scrapbook pages, so the text a user typed lives in each text
// element's `text` field, not `content` (kept for older non-scrapbook entries).
export function extractHashtags(entry: Pick<Entry, "content" | "layout">): string[] {
  const texts: string[] = []
  if (entry.content) texts.push(stripHtml(entry.content))
  for (const el of entry.layout?.elements ?? []) {
    if (el.type === "text") texts.push(stripHtml(el.text))
  }

  const tags = new Set<string>()
  for (const text of texts) {
    for (const match of text.matchAll(hashtagRegex())) {
      tags.add(match[1])
    }
  }
  return Array.from(tags)
}

export const HASHTAG_CLICK_CLASS =
  "cursor-pointer font-semibold text-logo hover:underline"

// Wraps every "#tag" occurrence in already-sanitized HTML with a clickable
// span carrying `data-hashtag`, so a card's own text can jump straight to
// that tag's filtered view instead of only being reachable via the Hashtag
// menu. Walks real DOM text nodes (rather than regexing the HTML string)
// so it can't be tricked by "#" appearing inside a tag's markup.
export function linkifyHashtags(html: string): string {
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
      const matches = Array.from(text.matchAll(hashtagRegex()))
      if (matches.length === 0) continue

      const frag = document.createDocumentFragment()
      let lastIndex = 0
      for (const match of matches) {
        const [full, tag] = match
        const index = match.index ?? 0
        if (index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, index)))

        const span = document.createElement("span")
        span.className = HASHTAG_CLICK_CLASS
        span.dataset.hashtag = tag
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

// Event-delegation helper: a card's content is rendered via
// dangerouslySetInnerHTML, so React can't attach a click handler to the
// hashtag spans directly — instead one handler on the container calls this
// to find out whether the click landed on a hashtag.
export function hashtagFromClick(e: MouseEvent): string | null {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-hashtag]")
  return el?.dataset.hashtag ?? null
}
