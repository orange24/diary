"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement, PAGE_WIDTH } from "@/types/scrapbook"
import { linkifyHashtags, hashtagFromClick } from "@/lib/hashtags"
import { linkifyMentions, MentionTarget } from "@/lib/mentions"
import { MentionAutocomplete } from "./MentionAutocomplete"
import { HashtagAutocomplete } from "./HashtagAutocomplete"

const ALLOWED_TAGS = ["b", "i", "em", "strong", "u", "br"]
const ALLOWED_ATTR: string[] = []

function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "TR", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE"])

function isBold(el: HTMLElement) {
  if (el.tagName === "B" || el.tagName === "STRONG") return true
  const weight = el.style.fontWeight
  if (!weight) return false
  const numeric = parseInt(weight, 10)
  return weight === "bold" || weight === "bolder" || (!Number.isNaN(numeric) && numeric >= 600)
}

function isItalic(el: HTMLElement) {
  return el.tagName === "I" || el.tagName === "EM" || el.style.fontStyle === "italic"
}

function isUnderline(el: HTMLElement) {
  if (el.tagName === "U") return true
  const decoration = el.style.textDecorationLine || el.style.textDecoration
  return !!decoration && decoration.includes("underline")
}

// Walks a pasted DOM tree, tracking which formatting is "active" (from tag
// names like <b> AND from inline styles like Word/Google Docs/ChatGPT's
// font-weight:700 spans), and re-emits each text run wrapped in the
// corresponding b/i/u tags — the only tags the editor's sanitizer allows.
// Block-level elements (p/div/li/...) become line breaks so paragraph
// structure survives even though nothing else about the block does.
function walkPastedNode(node: Node, active: { bold: boolean; italic: boolean; underline: boolean }): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/ /g, " ")
    if (!text) return ""
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    if (active.underline) escaped = `<u>${escaped}</u>`
    if (active.italic) escaped = `<i>${escaped}</i>`
    if (active.bold) escaped = `<b>${escaped}</b>`
    return escaped
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as HTMLElement
  if (el.tagName === "BR") return "<br>"
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return ""

  const next = {
    bold: active.bold || isBold(el),
    italic: active.italic || isItalic(el),
    underline: active.underline || isUnderline(el),
  }
  let out = ""
  el.childNodes.forEach((child) => {
    out += walkPastedNode(child, next)
  })
  if (BLOCK_TAGS.has(el.tagName) && out) out += "<br>"
  return out
}

// Converts clipboard HTML (rich text copied from another app) into the
// editor's own restricted-but-styled markup, so pasted bold/italic/
// underline survives instead of collapsing to plain text.
function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  let out = walkPastedNode(doc.body, { bold: false, italic: false, underline: false })
  out = out.replace(/(<br>)+$/, "")
  return sanitize(out)
}

function plainTextToHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML.replace(/\r\n|\r|\n/g, "<br>")
}

const MIN_TEXT_BOX_WIDTH = 160
const MIN_TEXT_BOX_HEIGHT = 44

function createMeasureProbe(fontFamily: string, fontSize: number): HTMLDivElement {
  const probe = document.createElement("div")
  probe.style.position = "fixed"
  probe.style.visibility = "hidden"
  probe.style.pointerEvents = "none"
  probe.style.top = "-9999px"
  probe.style.left = "-9999px"
  probe.style.fontFamily = fontFamily
  probe.style.fontSize = `${fontSize}px`
  probe.style.lineHeight = "normal"
  probe.style.margin = "0"
  probe.style.padding = "0"
  probe.style.border = "0"
  probe.style.boxSizing = "border-box"
  probe.style.whiteSpace = "pre-wrap"
  probe.style.wordBreak = "break-word"
  return probe
}

// How wide `html` would render if it were free to lay out on a single line
// (up to maxWidth) — used to decide whether a box needs to get WIDER, e.g.
// right after a paste.
function measureNaturalWidth(html: string, fontFamily: string, fontSize: number, maxWidth: number): number {
  const probe = createMeasureProbe(fontFamily, fontSize)
  probe.style.width = "max-content"
  probe.style.maxWidth = `${Math.max(MIN_TEXT_BOX_WIDTH, maxWidth)}px`
  probe.innerHTML = html || "&nbsp;"
  document.body.appendChild(probe)
  const width = Math.max(MIN_TEXT_BOX_WIDTH, Math.min(maxWidth, probe.scrollWidth))
  document.body.removeChild(probe)
  return width
}

// How tall `html` needs to be once wrapped at a fixed width — used to grow
// a box's height to fit its content without ever touching its width.
function measureHeightAtWidth(html: string, fontFamily: string, fontSize: number, width: number): number {
  const probe = createMeasureProbe(fontFamily, fontSize)
  probe.style.width = `${width}px`
  probe.innerHTML = html || "&nbsp;"
  document.body.appendChild(probe)
  const height = Math.max(MIN_TEXT_BOX_HEIGHT, probe.scrollHeight)
  document.body.removeChild(probe)
  return height
}

interface TriggerAnchor {
  node: Text
  start: number
  end: number
}

// Looks at the text immediately before the caret for an in-progress
// "<prefix>query" — the prefix at the start of the text node or right after
// whitespace, with no whitespace between it and the caret.
function matchTrigger(text: string, caretOffset: number, prefix: "@" | "#") {
  const before = text.slice(0, caretOffset)
  const re = prefix === "@" ? /(?:^|\s)@([\p{L}\p{N}_]*)$/u : /(?:^|\s)#([\p{L}\p{N}\p{M}_]*)$/u
  const match = before.match(re)
  if (!match) return null
  const matchStart = before.length - match[0].length
  const start = match[0].startsWith(prefix) ? matchStart : matchStart + 1
  return { query: match[1], start, end: caretOffset }
}

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  isEditing: boolean
  onChangeText: (text: string) => void
  onFinishEditing: () => void
  // Grows the box (never shrinks it) to fit whatever's currently typed/pasted.
  onResize?: (size: { width: number; height: number }) => void
  // Only wired up for read-only previews (editable=false) — inside an
  // open editor a hashtag is just text being typed, not a link to follow.
  onHashtagClick?: (tag: string) => void
  // Friends and/or placeholder Contacts to suggest when typing "@" — only
  // meaningful while editing.
  mentionTargets?: MentionTarget[]
  // Hashtags already used elsewhere, suggested when typing "#".
  hashtagSuggestions?: string[]
}

export function TextElement({
  element,
  editable,
  isEditing,
  onChangeText,
  onFinishEditing,
  onResize,
  onHashtagClick,
  mentionTargets,
  hashtagSuggestions,
}: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mentionAnchorRef = useRef<TriggerAnchor | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 })
  const hashtagAnchorRef = useRef<TriggerAnchor | null>(null)
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null)
  const [hashtagPos, setHashtagPos] = useState({ top: 0, left: 0 })

  // While editing, the div's content is intentionally uncontrolled (no
  // dangerouslySetInnerHTML below): committing on every keystroke so Save
  // never misses the latest text (see onInput) would otherwise feed back
  // into `element.text` -> a new `sanitized` string every render, and
  // re-applying dangerouslySetInnerHTML to already-live content resets the
  // browser's caret position on every character typed.
  useLayoutEffect(() => {
    if (!isEditing || !ref.current) return
    ref.current.innerHTML = sanitize(element.text)
    ref.current.focus()
    setMentionQuery(null)
    setHashtagQuery(null)
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    // Only select-all for the placeholder on a freshly added box, so the first
    // keystroke replaces it — re-editing existing text places the caret at
    // the end instead of arming a one-keystroke wipe of the whole paragraph.
    if (!element.isPlaceholder) range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // Correct sizing right away for content that was saved before autosizing
    // existed (or otherwise doesn't fit its stored box anymore).
    growToFitContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const commitText = () => {
    if (!editable || !ref.current) return
    onChangeText(sanitize(ref.current.innerHTML))
  }

  // Grows height to fit whatever's currently in the box, at its *current*
  // width — called on every keystroke. Never touches width and never
  // shrinks, so normal typing can't make the box jump around.
  const autosizeHeight = () => {
    if (!editable || !ref.current || !onResize) return
    const height = measureHeightAtWidth(ref.current.innerHTML, element.fontFamily, element.fontSize, element.width)
    if (height > element.height) {
      onResize({ width: element.width, height })
    }
  }

  // Grows BOTH width and height (never shrinks either) to fit content that
  // may already be too big for the box — used right after a paste, and
  // once when a box is opened for editing (in case it was saved before
  // autosizing existed).
  const growToFitContent = () => {
    if (!editable || !ref.current || !onResize) return
    const html = ref.current.innerHTML
    const maxWidth = PAGE_WIDTH - element.x - 40
    const naturalWidth = measureNaturalWidth(html, element.fontFamily, element.fontSize, maxWidth)
    const width = Math.max(element.width, naturalWidth)
    const height = Math.max(element.height, measureHeightAtWidth(html, element.fontFamily, element.fontSize, width))
    if (width !== element.width || height !== element.height) {
      onResize({ width, height })
    }
  }

  const detectTriggers = () => {
    if (!ref.current) return
    const clearAll = () => {
      setMentionQuery(null)
      setHashtagQuery(null)
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return clearAll()

    const range = selection.getRangeAt(0)
    if (!range.collapsed || !ref.current.contains(range.startContainer)) return clearAll()

    const container = range.startContainer
    if (container.nodeType !== Node.TEXT_NODE) return clearAll()

    const text = container.textContent ?? ""
    const rect = range.getBoundingClientRect()
    const pos = { top: rect.bottom + 4, left: rect.left }

    const mentionMatch =
      mentionTargets && mentionTargets.length > 0 ? matchTrigger(text, range.startOffset, "@") : null
    if (mentionMatch) {
      mentionAnchorRef.current = { node: container as Text, start: mentionMatch.start, end: mentionMatch.end }
      setMentionQuery(mentionMatch.query)
      setMentionPos(pos)
      setHashtagQuery(null)
      return
    }

    const hashtagMatch =
      hashtagSuggestions && hashtagSuggestions.length > 0 ? matchTrigger(text, range.startOffset, "#") : null
    if (hashtagMatch) {
      hashtagAnchorRef.current = { node: container as Text, start: hashtagMatch.start, end: hashtagMatch.end }
      setHashtagQuery(hashtagMatch.query)
      setHashtagPos(pos)
      setMentionQuery(null)
      return
    }

    clearAll()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!editable) return
    e.preventDefault()
    const html = e.clipboardData.getData("text/html")
    const cleaned = html.trim() ? cleanPastedHtml(html) : plainTextToHtml(e.clipboardData.getData("text/plain"))
    // execCommand mutates the DOM synchronously, so the box can be widened
    // for the pasted content's actual size right away, before the native
    // "input" event it also fires drives handleInput (commit + height).
    document.execCommand("insertHTML", false, cleaned)
    growToFitContent()
  }

  const handleInput = () => {
    commitText()
    autosizeHeight()
    detectTriggers()
  }

  const replaceAnchor = (anchor: TriggerAnchor, replacement: string) => {
    const text = anchor.node.textContent ?? ""
    const before = text.slice(0, anchor.start)
    const after = text.slice(anchor.end)
    anchor.node.textContent = before + replacement + after

    const newOffset = before.length + replacement.length
    const range = document.createRange()
    range.setStart(anchor.node, newOffset)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const insertMention = (target: MentionTarget) => {
    const anchor = mentionAnchorRef.current
    if (!anchor || !ref.current) return
    replaceAnchor(anchor, `@${target.insertText} `)
    setMentionQuery(null)
    ref.current.focus()
    commitText()
  }

  const insertHashtag = (tag: string) => {
    const anchor = hashtagAnchorRef.current
    if (!anchor || !ref.current) return
    replaceAnchor(anchor, `#${tag} `)
    setHashtagQuery(null)
    ref.current.focus()
    commitText()
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={ref}
        contentEditable={editable && isEditing}
        suppressContentEditableWarning
        // Commit on every input, not just blur: clicking a <button> (e.g. Save)
        // doesn't move focus away from a contentEditable in Firefox/Safari, so
        // onBlur alone can silently never fire before the form submits.
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={() => {
          commitText()
          setMentionQuery(null)
          setHashtagQuery(null)
          onFinishEditing()
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return
          if (mentionQuery !== null) setMentionQuery(null)
          if (hashtagQuery !== null) setHashtagQuery(null)
        }}
        onClick={(e) => {
          if (editable || !onHashtagClick) return
          const tag = hashtagFromClick(e)
          // Stop here so a hashtag click doesn't also bubble up into a
          // card's "open full view" click handler in the read-only feed.
          if (tag) {
            e.stopPropagation()
            onHashtagClick(tag)
          }
        }}
        className="w-full h-full overflow-hidden outline-none"
        style={{
          color: element.color,
          fontFamily: element.fontFamily,
          fontSize: element.fontSize,
          cursor: isEditing ? "text" : "inherit",
        }}
        {...(isEditing
          ? {}
          : { dangerouslySetInnerHTML: { __html: linkifyMentions(linkifyHashtags(sanitize(element.text))) } })}
      />
      {/* Portaled to <body>: the scrapbook canvas scales itself down via a
          CSS `transform`, and any transformed ancestor becomes the
          containing block for `position: fixed` descendants — without the
          portal these popovers would anchor to that scaled box instead of
          the real viewport, landing far from the caret. */}
      {mentionQuery !== null &&
        mentionTargets &&
        createPortal(
          <MentionAutocomplete
            query={mentionQuery}
            suggestions={mentionTargets}
            position={mentionPos}
            onSelect={insertMention}
          />,
          document.body
        )}
      {hashtagQuery !== null &&
        hashtagSuggestions &&
        createPortal(
          <HashtagAutocomplete
            query={hashtagQuery}
            hashtags={hashtagSuggestions}
            position={hashtagPos}
            onSelect={insertHashtag}
          />,
          document.body
        )}
    </div>
  )
}
