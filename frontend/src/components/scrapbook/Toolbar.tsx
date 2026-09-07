"use client"

import { useRef, useState } from "react"
import { Type, ImagePlus, Trash2, BringToFront, SendToBack, ArrowDownToLine, ArrowUpToLine, Sticker } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrapElement, StickerOption, FONT_OPTIONS, STICKERS } from "@/types/scrapbook"

interface ToolbarProps {
  selectedElement: ScrapElement | null
  onAddText: () => void
  onAddImageFile: (file: File) => void
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
  onAddText,
  onAddImageFile,
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
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 mb-3 rounded-xl border border-border bg-muted/50">
      <Button type="button" variant="ghost" size="sm" onClick={onAddText}>
        <Type className="size-4 mr-1.5" /> ข้อความ
      </Button>

      <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus className="size-4 mr-1.5" /> รูปภาพ
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

      <Popover open={stickerPickerOpen} onOpenChange={setStickerPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <Sticker className="size-4 mr-1.5" /> สติกเกอร์
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="grid grid-cols-4 gap-2">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                title={sticker.label}
                onClick={() => {
                  onAddSticker(sticker)
                  setStickerPickerOpen(false)
                }}
                className="flex items-center justify-center rounded-lg border border-transparent p-1 hover:border-border hover:bg-accent transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sticker.src} alt={sticker.label} className="size-14 object-contain" />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button type="button" variant="ghost" size="sm" onClick={onAddSpace} title="เพิ่มพื้นที่ทำงานด้านล่าง">
        <ArrowDownToLine className="size-4 mr-1.5" /> เพิ่มพื้นที่
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemoveSpace}
        disabled={!canRemoveSpace}
        title="ลดพื้นที่ทำงานด้านล่าง"
      >
        <ArrowUpToLine className="size-4 mr-1.5" /> ลดพื้นที่
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
                title="สีข้อความ"
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
                title="ขนาดตัวอักษร"
              />
            </>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={onBringToFront} title="เอาไว้หน้าสุด">
            <BringToFront className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSendToBack} title="เอาไว้หลังสุด">
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
