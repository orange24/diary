"use client"

import { useLayoutEffect, useRef } from "react"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement } from "@/types/scrapbook"

const ALLOWED_TAGS = ["b", "i", "em", "strong", "u", "br"]
const ALLOWED_ATTR: string[] = []

function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  isEditing: boolean
  onChangeText: (text: string) => void
  onFinishEditing: () => void
}

export function TextElement({ element, editable, isEditing, onChangeText, onFinishEditing }: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={ref}
      contentEditable={editable && isEditing}
      suppressContentEditableWarning
      // Commit on every input, not just blur: clicking a <button> (e.g. Save)
      // doesn't move focus away from a contentEditable in Firefox/Safari, so
      // onBlur alone can silently never fire before the form submits.
      onInput={commitText}
      onBlur={() => {
        commitText()
        onFinishEditing()
      }}
      className="w-full h-full overflow-hidden outline-none"
      style={{
        color: element.color,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        cursor: isEditing ? "text" : "inherit",
      }}
      {...(isEditing ? {} : { dangerouslySetInnerHTML: { __html: sanitize(element.text) } })}
    />
  )
}
