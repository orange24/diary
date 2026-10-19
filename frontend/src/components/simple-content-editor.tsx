"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Italic, Underline, Smile, ImagePlus, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StickerPicker } from "@/components/scrapbook/StickerPicker"
import { StickerOption } from "@/types/scrapbook"
import { uploadMedia } from "@/services/api"
import { toast } from "sonner"
import {
  FONT_SIZE_LEVELS,
  hasRenderableContent,
  sanitizeEntryContent,
  serializeEditorHtml,
} from "@/lib/entry-content"

// A plain run of text people can type straight into, the way the composer
// on any social app works — as opposed to the scrapbook canvas, where every
// word has to be placed in a box first. Formatting and emoji flow inline
// with the writing instead of becoming separately positioned objects.

const QUICK_EMOJI = [
  "😀", "😂", "🥹", "😊", "😍", "🤔", "😴", "😭",
  "😤", "🥳", "😇", "🫠", "👍", "🙏", "👏", "💪",
  "❤️", "💔", "✨", "🔥", "🌙", "☀️", "🌧️", "🌈",
  "🍜", "☕", "🍰", "🍺", "✈️", "🏠", "🐱", "🐶",
]

interface SimpleContentEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  // Needed to upload a picked photo; without it the photo button is hidden.
  token?: string
  // Photos attach to the entry rather than landing in the run of text (the
  // way a social composer handles them) — the form shows them as removable
  // thumbnails underneath and sends them as the entry's images.
  onImageUploaded?: (url: string) => void
}

export function SimpleContentEditor({
  value,
  onChange,
  placeholder,
  token,
  onImageUploaded,
}: SimpleContentEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Where the caret was before the emoji popover stole focus, so the pick
  // lands mid-sentence where the user left off rather than always at the end.
  const savedRange = useRef<Range | null>(null)
  // Writing `value` back on every render would reset the caret to the start
  // on each keystroke, so only sync when the incoming HTML is genuinely
  // different from what the box already holds (i.e. an edit loaded from
  // elsewhere, not the change this box just emitted).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (serializeEditorHtml(el) !== value) el.innerHTML = sanitizeEntryContent(value)
  }, [value])

  // Derived, not state: every keystroke is pushed up through onChange and
  // comes straight back as `value`, so the placeholder follows the box
  // without a second copy of "is there anything in here" to keep in sync.
  const isEmpty = !hasRenderableContent(value)

  const emitChange = () => {
    const el = ref.current
    if (!el) return
    onChange(serializeEditorHtml(el))
  }

  // execCommand only acts on a focused contentEditable with a live
  // selection, and a plain click on a toolbar button blurs the box before
  // the handler runs — so every button suppresses its own mousedown.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault()

  const runCommand = (command: string, argument?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, argument)
    emitChange()
  }

  const rememberSelection = () => {
    const el = ref.current
    const selection = window.getSelection()
    if (!el || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }

  const insertInline = (html: string) => {
    const el = ref.current
    if (!el) return
    el.focus()
    const selection = window.getSelection()
    const range = savedRange.current
    if (selection && range && el.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges()
      selection.addRange(range)
    } else if (selection) {
      // Never typed in the box yet (or the caret was lost): append at the end.
      const atEnd = document.createRange()
      atEnd.selectNodeContents(el)
      atEnd.collapse(false)
      selection.removeAllRanges()
      selection.addRange(atEnd)
    }
    document.execCommand("insertHTML", false, html)
    savedRange.current = null
    emitChange()
  }

  const insertSticker = (sticker: StickerOption) =>
    insertInline(`<img src="${sticker.src}" alt="${sticker.label}" class="ps-emoji" />`)

  const insertEmoji = (emoji: string) =>
    insertInline(`<span class="ps-emoji-char">${emoji}</span>`)

  const handlePickedFile = async (file: File | undefined) => {
    if (!file || !token) return
    setUploading(true)
    try {
      onImageUploaded?.(await uploadMedia(file, token))
    } catch (error) {
      toast.error("Couldn't add that photo", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setUploading(false)
      // Clear it so picking the same file twice in a row still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="rounded-xl border border-border focus-within:border-primary/60 transition-colors">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <button
          type="button"
          title="Bold"
          onMouseDown={keepSelection}
          onClick={() => runCommand("bold")}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={keepSelection}
          onClick={() => runCommand("italic")}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Italic className="size-4" />
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={keepSelection}
          onClick={() => runCommand("underline")}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Underline className="size-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-border" />

        {FONT_SIZE_LEVELS.map((level, index) => (
          <button
            key={level.className}
            type="button"
            title={`${level.label} text`}
            onMouseDown={keepSelection}
            onClick={() => runCommand("fontSize", level.execValue)}
            className="rounded-md px-2 py-1 font-semibold leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            style={{ fontSize: `${11 + index * 3}px` }}
          >
            A
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        {token && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handlePickedFile(e.target.files?.[0])}
            />
            <button
              type="button"
              title="Add a photo"
              disabled={uploading}
              onMouseDown={keepSelection}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            </button>
          </>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Emoji and stickers"
              onMouseDown={rememberSelection}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Smile className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <div className="mb-3 grid grid-cols-8 gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="rounded-md p-1 text-xl leading-none hover:bg-accent transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <StickerPicker onSelect={insertSticker} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative">
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-4 top-3 text-muted-foreground">{placeholder}</p>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Entry content"
          onInput={emitChange}
          onBlur={() => {
            rememberSelection()
            emitChange()
          }}
          className="ps-entry-content min-h-40 w-full px-4 py-3 text-base outline-none"
        />
      </div>
    </div>
  )
}
