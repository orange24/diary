"use client"

import { useMemo, useRef, useState } from "react"
import Moveable from "react-moveable"
import {
  ScrapElement,
  TextScrapElement,
  ImageScrapElement,
  PAGE_WIDTH,
  PAGE_HEIGHT_MIN,
  newElementId,
} from "@/types/scrapbook"
import { TextElement } from "./TextElement"
import { ImageElement } from "./ImageElement"
import { Toolbar } from "./Toolbar"

interface ScrapbookEditorProps {
  elements: ScrapElement[]
  onChange: (elements: ScrapElement[]) => void
  editable: boolean
  token?: string
  scale?: number
}

export function ScrapbookEditor({ elements, onChange, editable, token, scale = 1 }: ScrapbookEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const elementRefs = useRef(new Map<string, HTMLDivElement>())

  const canvasHeight = useMemo(
    () => Math.max(PAGE_HEIGHT_MIN, ...elements.map((e) => e.y + e.height + 80)),
    [elements]
  )

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
      width: 220,
      height: 100,
      rotation: 0,
      zIndex: elements.length + 1,
      text: "พิมพ์ข้อความที่นี่...",
      color: "#222222",
      fontFamily: "Prompt",
      fontSize: 18,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
  }

  const handleAddImageFile = async (file: File) => {
    if (!token) return
    const formData = new FormData()
    formData.append("media", file)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) return
    const data = await res.json()
    const url: string | undefined = data.paths?.[0]
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

  const handleDeleteSelected = () => {
    if (!selectedId) return
    onChange(elements.filter((e) => e.id !== selectedId))
    setSelectedId(null)
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
    <div>
      {editable && (
        <Toolbar
          selectedElement={selectedElement}
          onAddText={handleAddText}
          onAddImageFile={handleAddImageFile}
          onUpdateSelected={(patch) => selectedId && updateElement(selectedId, patch)}
          onDeleteSelected={handleDeleteSelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
        />
      )}

      <div
        className="relative bg-white mx-auto overflow-hidden rounded-md border border-border"
        style={{
          width: PAGE_WIDTH * scale,
          height: canvasHeight * scale,
        }}
        onClick={(e) => {
          if (editable && e.target === e.currentTarget) setSelectedId(null)
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
              ref={(node) => {
                if (node) elementRefs.current.set(el.id, node)
                else elementRefs.current.delete(el.id)
              }}
              onMouseDown={() => editable && setSelectedId(el.id)}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                transform: `rotate(${el.rotation}deg)`,
                zIndex: el.zIndex,
                cursor: editable ? "move" : "default",
              }}
            >
              {el.type === "text" ? (
                <TextElement
                  element={el}
                  editable={editable}
                  onChangeText={(text) => updateElement(el.id, { text })}
                />
              ) : (
                <ImageElement element={el} />
              )}
            </div>
          ))}

          {editable && selectedId && elementRefs.current.get(selectedId) && (
            <Moveable
              target={elementRefs.current.get(selectedId)!}
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
