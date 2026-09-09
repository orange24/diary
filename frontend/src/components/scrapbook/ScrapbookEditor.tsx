"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Moveable from "react-moveable"
import {
  ScrapElement,
  TextScrapElement,
  ImageScrapElement,
  StickerOption,
  PAGE_WIDTH,
  PAGE_HEIGHT_MIN,
  PAGE_HEIGHT_STEP,
  NEW_TEXT_PLACEHOLDER,
  newElementId,
} from "@/types/scrapbook"
import { TextElement } from "./TextElement"
import { ImageElement } from "./ImageElement"
import { Toolbar } from "./Toolbar"
import { FriendUser } from "@/services/friends"

interface ScrapbookEditorProps {
  elements: ScrapElement[]
  onChange: (elements: ScrapElement[]) => void
  editable: boolean
  token?: string
  scale?: number
  onGalleryImageAdded?: (url: string) => void
  onHashtagClick?: (tag: string) => void
  // Friends to suggest when typing "@" inside a text box.
  friends?: FriendUser[]
  // Hashtags already used elsewhere, suggested when typing "#".
  hashtagSuggestions?: string[]
}

export function ScrapbookEditor({
  elements,
  onChange,
  editable,
  token,
  scale: scaleProp,
  onGalleryImageAdded,
  onHashtagClick,
  friends,
  hashtagSuggestions,
}: ScrapbookEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [extraHeight, setExtraHeight] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScale, setAutoScale] = useState(1)

  // Callers that already know the target width (e.g. the read-only card
  // preview) pass `scale` explicitly. Otherwise — notably the editable
  // dialog — fit the canvas to whatever width the container actually has,
  // so a wider modal doesn't leave the page stranded at a fixed 794px.
  useLayoutEffect(() => {
    if (scaleProp !== undefined) return
    const el = containerRef.current
    if (!el) return
    setAutoScale(el.getBoundingClientRect().width / PAGE_WIDTH)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setAutoScale(entry.contentRect.width / PAGE_WIDTH)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [scaleProp])

  const scale = scaleProp ?? autoScale

  // A brand-new entry opens with its seeded placeholder text box already
  // armed for typing, so the user doesn't have to double-click it first.
  useEffect(() => {
    const placeholder = elements.find((e) => e.type === "text" && e.isPlaceholder)
    if (placeholder) {
      setSelectedId(placeholder.id)
      setEditingId(placeholder.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canvasHeight = useMemo(
    () => Math.max(PAGE_HEIGHT_MIN, PAGE_HEIGHT_MIN + extraHeight, ...elements.map((e) => e.y + e.height + 80)),
    [elements, extraHeight]
  )

  const handleAddSpace = () => setExtraHeight((h) => h + PAGE_HEIGHT_STEP)
  const handleRemoveSpace = () => setExtraHeight((h) => Math.max(0, h - PAGE_HEIGHT_STEP))

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null

  const updateElement = (id: string, patch: Partial<ScrapElement>) => {
    onChange(elements.map((e) => (e.id === id ? ({ ...e, ...patch } as ScrapElement) : e)))
  }

  const handleAddText = () => {
    const offset = (elements.length % 5) * 20
    const newElement: TextScrapElement = {
      id: newElementId(),
      type: "text",
      x: 40 + offset,
      y: 40 + offset,
      width: 360,
      height: 44,
      rotation: 0,
      zIndex: elements.length + 1,
      text: NEW_TEXT_PLACEHOLDER,
      color: "#222222",
      fontFamily: "Prompt",
      fontSize: 18,
      isPlaceholder: true,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
    setEditingId(newElement.id)
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!token) return null
    const formData = new FormData()
    formData.append("media", file)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.paths?.[0] ?? null
  }

  const handleAddImageFile = async (file: File) => {
    const url = await uploadFile(file)
    if (!url) return
    const offset = (elements.length % 5) * 20
    const newElement: ImageScrapElement = {
      id: newElementId(),
      type: "image",
      x: 40 + offset,
      y: 40 + offset,
      width: 240,
      height: 240,
      rotation: 0,
      zIndex: elements.length + 1,
      src: url,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
  }

  // Unlike handleAddImageFile, this doesn't touch the canvas at all — the
  // photo goes straight into the entry's full-size viewable gallery list.
  const handleAddGalleryImage = async (file: File) => {
    const url = await uploadFile(file)
    if (url) onGalleryImageAdded?.(url)
  }

  const handleAddSticker = (sticker: StickerOption) => {
    const offset = (elements.length % 5) * 20
    const width = 140
    const newElement: ImageScrapElement = {
      id: newElementId(),
      type: "image",
      x: 40 + offset,
      y: 40 + offset,
      width,
      height: Math.round(width / sticker.aspect),
      rotation: 0,
      zIndex: elements.length + 1,
      src: sticker.src,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return
    onChange(elements.filter((e) => e.id !== selectedId))
    setSelectedId(null)
    setEditingId(null)
  }

  const handleBringToFront = () => {
    if (!selectedId) return
    const maxZ = Math.max(0, ...elements.map((e) => e.zIndex))
    updateElement(selectedId, { zIndex: maxZ + 1 })
  }

  const handleSendToBack = () => {
    if (!selectedId) return
    const minZ = Math.min(0, ...elements.map((e) => e.zIndex))
    updateElement(selectedId, { zIndex: minZ - 1 })
  }

  return (
    <div ref={containerRef}>
      {editable && (
        <Toolbar
          selectedElement={selectedElement}
          isEditingSelectedText={selectedId !== null && selectedId === editingId}
          onAddText={handleAddText}
          onAddImageFile={handleAddImageFile}
          onAddGalleryImage={handleAddGalleryImage}
          onAddSticker={handleAddSticker}
          onUpdateSelected={(patch) => selectedId && updateElement(selectedId, patch)}
          onDeleteSelected={handleDeleteSelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onAddSpace={handleAddSpace}
          onRemoveSpace={handleRemoveSpace}
          canRemoveSpace={extraHeight > 0}
        />
      )}

      <div
        className="relative bg-white mx-auto overflow-hidden rounded-md border border-border shadow-[0_12px_32px_-6px_var(--canvas-frame-shadow)]"
        style={{
          width: PAGE_WIDTH * scale,
          height: canvasHeight * scale,
        }}
        onClick={(e) => {
          if (editable && e.target === e.currentTarget) {
            setSelectedId(null)
            setEditingId(null)
          }
        }}
      >
        <div
          style={{
            width: PAGE_WIDTH,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          {elements.map((el) => (
            <div
              key={el.id}
              // Only give the element a DOM id in editable mode: a read-only card
              // preview can render the same element ids as an open editor for the
              // same entry, and react-moveable resolves string targets with
              // document.querySelector, which would silently bind to whichever
              // one appears first in the DOM instead of the intended editor node.
              id={editable ? `scrapbook-el-${el.id}` : undefined}
              onMouseDown={() => editable && setSelectedId(el.id)}
              onDoubleClick={() => editable && el.type === "text" && setEditingId(el.id)}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                transform: `rotate(${el.rotation}deg)`,
                zIndex: el.zIndex,
                cursor: editable ? "move" : "default",
                // Not yet selected (Moveable isn't attached until the first click's
                // state update re-renders), so a click-and-drag in one motion would
                // otherwise fall through to the browser's native text-selection drag.
                // WebkitUserSelect covers Safari < 17, which ignores unprefixed user-select.
                userSelect: editable && editingId !== el.id ? "none" : "auto",
                WebkitUserSelect: editable && editingId !== el.id ? "none" : "auto",
              }}
            >
              {el.type === "text" ? (
                <TextElement
                  element={el}
                  editable={editable}
                  isEditing={editingId === el.id}
                  onChangeText={(text) => updateElement(el.id, { text, isPlaceholder: false })}
                  onFinishEditing={() => setEditingId(null)}
                  onHashtagClick={onHashtagClick}
                  friends={friends}
                  hashtagSuggestions={hashtagSuggestions}
                />
              ) : (
                <ImageElement element={el} />
              )}
            </div>
          ))}

          {editable && selectedId && selectedId !== editingId && (
            <Moveable
              target={`#scrapbook-el-${CSS.escape(selectedId)}`}
              draggable
              resizable
              rotatable
              onDrag={({ target, left, top }) => {
                ;(target as HTMLElement).style.left = `${left}px`
                ;(target as HTMLElement).style.top = `${top}px`
                updateElement(selectedId, { x: left, y: top })
              }}
              onResize={({ target, width, height, drag }) => {
                ;(target as HTMLElement).style.width = `${width}px`
                ;(target as HTMLElement).style.height = `${height}px`
                ;(target as HTMLElement).style.left = `${drag.left}px`
                ;(target as HTMLElement).style.top = `${drag.top}px`
                updateElement(selectedId, { width, height, x: drag.left, y: drag.top })
              }}
              onRotate={({ target, rotation }) => {
                ;(target as HTMLElement).style.transform = `rotate(${rotation}deg)`
                updateElement(selectedId, { rotation })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
