"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement } from "@/types/scrapbook"
import { linkifyHashtags, hashtagFromClick } from "@/lib/hashtags"
import { linkifyMentions } from "@/lib/mentions"
import { FriendUser } from "@/services/friends"
import { MentionAutocomplete } from "./MentionAutocomplete"

const ALLOWED_TAGS = ["b", "i", "em", "strong", "u", "br"]
const ALLOWED_ATTR: string[] = []

function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

interface MentionAnchor {
  node: Text
  start: number
  end: number
}

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  isEditing: boolean
  onChangeText: (text: string) => void
  onFinishEditing: () => void
  // Only wired up for read-only previews (editable=false) — inside an
  // open editor a hashtag is just text being typed, not a link to follow.
  onHashtagClick?: (tag: string) => void
  // Friends to suggest when typing "@" — only meaningful while editing.
  friends?: FriendUser[]
}

export function TextElement({
  element,
  editable,
  isEditing,
  onChangeText,
  onFinishEditing,
  onHashtagClick,
  friends,
}: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mentionAnchorRef = useRef<MentionAnchor | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 })

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
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    // Only select-all for the placeholder on a freshly added box, so the first
    // keystroke replaces it — re-editing existing text places the caret at
    // the end instead of arming a one-keystroke wipe of the whole paragraph.
    if (!element.isPlaceholder) range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const commitText = () => {
    if (!editable || !ref.current) return
    onChangeText(sanitize(ref.current.innerHTML))
  }

  // Looks at the text immediately before the caret for an in-progress
  // "@query" — an "@" at the start of the text node or right after
  // whitespace, with no whitespace between it and the caret.
  const detectMention = () => {
    if (!friends || friends.length === 0 || !ref.current) {
      setMentionQuery(null)
      return
    }
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setMentionQuery(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !ref.current.contains(range.startContainer)) {
      setMentionQuery(null)
      return
    }
    const container = range.startContainer
    if (container.nodeType !== Node.TEXT_NODE) {
      setMentionQuery(null)
      return
    }

    const text = container.textContent ?? ""
    const before = text.slice(0, range.startOffset)
    const match = before.match(/(?:^|\s)@([\p{L}\p{N}_]*)$/u)
    if (!match) {
      setMentionQuery(null)
      return
    }

    const matchStart = before.length - match[0].length
    const atIndex = match[0].startsWith("@") ? matchStart : matchStart + 1
    mentionAnchorRef.current = { node: container as Text, start: atIndex, end: range.startOffset }
    setMentionQuery(match[1])

    const rect = range.getBoundingClientRect()
    setMentionPos({ top: rect.bottom + 4, left: rect.left })
  }

  const handleInput = () => {
    commitText()
    detectMention()
  }

  const insertMention = (friend: FriendUser) => {
    const anchor = mentionAnchorRef.current
    if (!anchor || !ref.current) return

    const text = anchor.node.textContent ?? ""
    const before = text.slice(0, anchor.start)
    const after = text.slice(anchor.end)
    const mentionText = `@${friend.username} `
    anchor.node.textContent = before + mentionText + after

    const newOffset = before.length + mentionText.length
    const range = document.createRange()
    range.setStart(anchor.node, newOffset)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    setMentionQuery(null)
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
        onBlur={() => {
          commitText()
          setMentionQuery(null)
          onFinishEditing()
        }}
        onKeyDown={(e) => {
          if (mentionQuery !== null && e.key === "Escape") setMentionQuery(null)
        }}
        onClick={(e) => {
          if (editable || !onHashtagClick) return
          const tag = hashtagFromClick(e)
          if (tag) onHashtagClick(tag)
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
      {mentionQuery !== null &&
        friends &&
        // Portaled to <body>: the scrapbook canvas scales itself down via a
        // CSS `transform`, and any transformed ancestor becomes the
        // containing block for `position: fixed` descendants — without the
        // portal this popover would anchor to that scaled box instead of
        // the real viewport, landing far from the caret.
        createPortal(
          <MentionAutocomplete
            query={mentionQuery}
            friends={friends}
            position={mentionPos}
            onSelect={insertMention}
          />,
          document.body
        )}
    </div>
  )
}
