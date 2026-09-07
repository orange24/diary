"use client"

import { useRef } from "react"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement } from "@/types/scrapbook"

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  onChangeText: (text: string) => void
}

export function TextElement({ element, editable, onChangeText }: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)
  const sanitized = DOMPurify.sanitize(element.text, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "br"],
    ALLOWED_ATTR: [],
  })

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={() => {
        if (!editable || !ref.current) return
        onChangeText(ref.current.innerHTML)
      }}
      className="w-full h-full overflow-hidden outline-none"
      style={{
        color: element.color,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
