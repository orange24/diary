"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { ScrapElement, PAGE_WIDTH } from "@/types/scrapbook"
import { ScrapbookEditor } from "./ScrapbookEditor"

interface ScrapbookPreviewProps {
  elements: ScrapElement[]
  maxHeight?: number
  onHashtagClick?: (tag: string) => void
}

// Read-only scrapbook preview that scales to fill whatever width its
// container gives it, instead of a fixed pixel size — so the collage looks
// right whether the card is narrow (phone) or wide (desktop).
export function ScrapbookPreview({ elements, maxHeight, onHashtagClick }: ScrapbookPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Measure synchronously on mount (before paint) instead of waiting for
    // ResizeObserver's first callback, which can take multiple seconds to
    // fire and would otherwise leave the card blank for that whole window.
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    // No border/rounded here: ScrapbookEditor's own canvas already draws
    // those, and since it's sized to exactly fill this container's width,
    // an outer border would just double up on top of it.
    <div ref={containerRef} className="w-full overflow-hidden" style={{ maxHeight }}>
      {width !== null && width > 0 && (
        <ScrapbookEditor
          elements={elements}
          onChange={() => {}}
          editable={false}
          scale={width / PAGE_WIDTH}
          onHashtagClick={onHashtagClick}
        />
      )}
    </div>
  )
}
