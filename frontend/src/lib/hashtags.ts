import { Entry } from "@/services/api"

// Matches Thai/Latin letters, digits, underscore, AND Thai combining marks
// (tone marks like ่ ้, vowel signs like ั ุ ึ — Unicode category M) so
// "#ออกกำลังกายลดหุ่น" isn't cut short at the first tone mark; \p{L} alone
// only covers base letters, not the combining marks stacked onto them.
const HASHTAG_PATTERN = /#([\p{L}\p{N}\p{M}_]+)/gu

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
    for (const match of text.matchAll(HASHTAG_PATTERN)) {
      tags.add(match[1])
    }
  }
  return Array.from(tags)
}
