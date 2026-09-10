"use client"

import { useRef, useState } from "react"
import { Type, ImagePlus, Images, Trash2, BringToFront, SendToBack, ArrowDownToLine, ArrowUpToLine, Sticker, Bold, Italic, Underline } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrapElement, StickerOption, FONT_OPTIONS } from "@/types/scrapbook"
import { StickerPicker } from "./StickerPicker"

interface ToolbarProps {
  selectedElement: ScrapElement | null
  // Whether the selected element is the text box currently being typed
  // into — bold/italic/underline act on document.execCommand, which only
  // has an effect while a contentEditable is focused with a selection.
  isEditingSelectedText: boolean
  onAddText: () => void
  onAddImageFile: (file: File) => void
  onAddGalleryImage: (file: File) => void
  onAddSticker: (sticker: StickerOption) => void
  onUpdateSelected: (patch: Partial<ScrapElement>) => void
  onDeleteSelected: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onAddSpace: () => void
  onRemoveSpace: () => void
  canRemoveSpace: boolean
}

export function Toolbar({
  selectedElement,
  isEditingSelectedText,
  onAddText,
  onAddImageFile,
  onAddGalleryImage,
  onAddSticker,
  onUpdateSelected,
  onDeleteSelected,
  onBringToFront,
  onSendToBack,
  onAddSpace,
  onRemoveSpace,
  canRemoveSpace,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 mb-3 rounded-xl border border-border bg-muted/50">
      <Button type="button" variant="ghost" size="sm" onClick={onAddText}>
        <Type className="size-4 mr-1.5" /> Text
      </Button>

      <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus className="size-4 mr-1.5" /> Insert Image
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddImageFile(file)
          e.target.value = ""
        }}
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => galleryFileInputRef.current?.click()}
        title="Add a photo to view in full, without inserting it into the page"
      >
        <Images className="size-4 mr-1.5" /> Add to Gallery
      </Button>
      <input
        ref={galleryFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddGalleryImage(file)
          e.target.value = ""
        }}
      />

      <Popover open={stickerPickerOpen} onOpenChange={setStickerPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <Sticker className="size-4 mr-1.5" /> Stickers
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto" align="start">
          <StickerPicker
            onSelect={(sticker) => {
              onAddSticker(sticker)
              setStickerPickerOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <Button type="button" variant="ghost" size="sm" onClick={onAddSpace} title="Add more working space below">
        <ArrowDownToLine className="size-4 mr-1.5" /> Add Space
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemoveSpace}
        disabled={!canRemoveSpace}
        title="Reduce working space below"
      >
        <ArrowUpToLine className="size-4 mr-1.5" /> Reduce Space
      </Button>

      {selectedElement && (
        <>
          <div className="w-[1px] h-6 bg-border mx-1" />

          {selectedElement.type === "text" && (
            <>
              <input
                type="color"
                value={selectedElement.color}
                onChange={(e) => onUpdateSelected({ color: e.target.value })}
                className="size-8 rounded cursor-pointer border border-border"
                title="Text color"
              />
              <select
                value={selectedElement.fontFamily}
                onChange={(e) => onUpdateSelected({ fontFamily: e.target.value })}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={8}
                max={96}
                value={selectedElement.fontSize}
                onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
                className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm"
                title="Font size"
              />

              {isEditingSelectedText && (
                <>
                  {/* onMouseDown preventDefault keeps focus (and the current
                      text selection) inside the contentEditable box instead
                      of moving it to the button — execCommand only affects
                      whatever is currently selected there. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("bold")}
                    title="Bold"
                  >
                    <Bold className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("italic")}
                    title="Italic"
                  >
                    <Italic className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("underline")}
                    title="Underline"
                  >
                    <Underline className="size-4" />
                  </Button>
                </>
              )}
            </>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={onBringToFront} title="Bring to front">
            <BringToFront className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSendToBack} title="Send to back">
            <SendToBack className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}
