export interface TextScrapElement {
  id: string
  type: "text"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  text: string
  color: string
  fontFamily: string
  fontSize: number
}

export interface ImageScrapElement {
  id: string
  type: "image"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  src: string
}

export type ScrapElement = TextScrapElement | ImageScrapElement

export interface ScrapbookLayout {
  pageWidth: number
  elements: ScrapElement[]
}

export const PAGE_WIDTH = 794
// Floor for the canvas height — kept compact so a brand-new entry fits on
// screen without scrolling. The canvas still auto-grows to fit content that
// extends past this, and the user can add more room explicitly (see
// PAGE_HEIGHT_STEP) without needing to add content first.
export const PAGE_HEIGHT_MIN = 500
export const PAGE_HEIGHT_STEP = 300
export const FONT_OPTIONS = ["Prompt", "Georgia", "Courier New"] as const
export const NEW_TEXT_PLACEHOLDER = "พิมพ์ข้อความที่นี่..."

export interface StickerOption {
  id: string
  label: string
  src: string
  aspect: number // width / height, so a placed sticker keeps its natural proportions
}

// Built-in decorative stickers shipped with the app (frontend/public/stickers/).
// Unlike uploaded photos, these are static assets — no backend/Cloudinary upload needed.
export const STICKERS: StickerOption[] = [
  { id: "beary-happy", label: "Beary Happy", src: "/stickers/beary-happy.png", aspect: 321 / 400 },
  { id: "sweet-dreams", label: "Sweet Dreams", src: "/stickers/sweet-dreams.png", aspect: 380 / 400 },
  { id: "rawr-fun-day", label: "Rawr! Fun Day", src: "/stickers/rawr-fun-day.png", aspect: 378 / 400 },
  { id: "sweet", label: "Sweet!", src: "/stickers/sweet.png", aspect: 266 / 400 },
  { id: "cosy-vibe", label: "Cosy Vibe", src: "/stickers/cosy-vibe.png", aspect: 328 / 400 },
  { id: "stay-sharp", label: "Stay Sharp", src: "/stickers/stay-sharp.png", aspect: 387 / 400 },
  { id: "happy-rain", label: "Happy Rain", src: "/stickers/happy-rain.png", aspect: 362 / 400 },
  { id: "study-time", label: "Study Time", src: "/stickers/study-time.png", aspect: 400 / 387 },
  { id: "yum-day", label: "Yum Day", src: "/stickers/yum-day.png", aspect: 291 / 400 },
  { id: "beach-day", label: "Beach Day", src: "/stickers/beach-day.png", aspect: 387 / 400 },
  { id: "capture-moments", label: "Capture Moments", src: "/stickers/capture-moments.png", aspect: 400 / 366 },
  { id: "todays-bloom", label: "Today's Bloom", src: "/stickers/todays-bloom.png", aspect: 331 / 400 },
]

export function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
