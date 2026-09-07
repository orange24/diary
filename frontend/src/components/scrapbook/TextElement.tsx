"use client"

import { useEffect, useRef } from "react"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement } from "@/types/scrapbook"

const ALLOWED_TAGS = ["b", "i", "em", "strong", "u", "br"]
const ALLOWED_ATTR: string[] = []

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  isEditing: boolean
  onChangeText: (text: string) => void
  onFinishEditing: () => void
}

export function TextElement({ element, editable, isEditing, onChangeText, onFinishEditing }: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)
  const sanitized = DOMPurify.sanitize(element.text, { ALLOWED_TAGS, ALLOWED_ATTR })

  useEffect(() => {
    if (!isEditing || !ref.current) return
    ref.current.focus()
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [isEditing])

  return (
    <div
      ref={ref}
      contentEditable={editable && isEditing}
      suppressContentEditableWarning
      onBlur={() => {
        if (!editable || !ref.current) return
        onChangeText(DOMPurify.sanitize(ref.current.innerHTML, { ALLOWED_TAGS, ALLOWED_ATTR }))
        onFinishEditing()
      }}
      className="w-full h-full overflow-hidden outline-none"
      style={{
        color: element.color,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        cursor: editable && !isEditing ? "inherit" : "text",
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
