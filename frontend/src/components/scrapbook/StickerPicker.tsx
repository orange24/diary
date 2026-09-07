"use client"

import { useState } from "react"
import { StickerOption, STICKER_PACKS } from "@/types/scrapbook"

interface StickerPickerProps {
  onSelect: (sticker: StickerOption) => void
}

// LINE-style sticker picker: a row of pack tabs up top, and a grid of that
// pack's stickers below — switching tabs swaps the grid, not the whole popover.
export function StickerPicker({ onSelect }: StickerPickerProps) {
  const [activePackId, setActivePackId] = useState(STICKER_PACKS[0].id)
  const activePack = STICKER_PACKS.find((p) => p.id === activePackId) ?? STICKER_PACKS[0]

  return (
    <div className="w-72">
      <div className="flex gap-1 border-b border-border pb-2 mb-2 overflow-x-auto">
        {STICKER_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setActivePackId(pack.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              pack.id === activePackId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {pack.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {activePack.stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={sticker.label}
            onClick={() => onSelect(sticker)}
            className="flex items-center justify-center rounded-lg border border-transparent p-1 hover:border-border hover:bg-accent transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sticker.src} alt={sticker.label} className="size-14 object-contain" />
          </button>
        ))}
      </div>
    </div>
  )
}
