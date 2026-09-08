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
  // True until the first edit — lets the editor select-all on focus so the
  // first keystroke wipes the seed text instead of appending to it.
  isPlaceholder?: boolean
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
// Floor for the canvas height — kept to about 4 lines' worth of space so a
// brand-new entry opens compact, not with a wall of empty white below the
// first text box. The canvas still auto-grows to fit content that extends
// past this, and the user can add more room explicitly (see
// PAGE_HEIGHT_STEP) without needing to add content first.
export const PAGE_HEIGHT_MIN = 200
export const PAGE_HEIGHT_STEP = 300
export const FONT_OPTIONS = ["Prompt", "Georgia", "Courier New"] as const
export const NEW_TEXT_PLACEHOLDER = "พิมพ์ข้อความที่นี่..."

export interface StickerOption {
  id: string
  label: string
  src: string
  aspect: number // width / height, so a placed sticker keeps its natural proportions
}

export interface StickerPack {
  id: string
  name: string
  stickers: StickerOption[]
}

// Built-in decorative stickers shipped with the app (frontend/public/stickers/),
// grouped into LINE-style packs the user switches between in the picker.
// Unlike uploaded photos, these are static assets — no backend/Cloudinary upload needed.
export const STICKER_PACKS: StickerPack[] = [
  {
    id: "diary-moments",
    name: "Diary Moments",
    stickers: [
      { id: "beary-happy", label: "Beary Happy", src: "/stickers/pack1/beary-happy.png", aspect: 317 / 400 },
      { id: "sweet-dreams", label: "Sweet Dreams", src: "/stickers/pack1/sweet-dreams.png", aspect: 360 / 400 },
      { id: "rawr-fun-day", label: "Rawr! Fun Day", src: "/stickers/pack1/rawr-fun-day.png", aspect: 366 / 400 },
      { id: "sweet", label: "Sweet!", src: "/stickers/pack1/sweet.png", aspect: 293 / 400 },
      { id: "cosy-vibe", label: "Cosy Vibe", src: "/stickers/pack1/cosy-vibe.png", aspect: 400 / 396 },
      { id: "stay-sharp", label: "Stay Sharp", src: "/stickers/pack1/stay-sharp.png", aspect: 334 / 400 },
      { id: "happy-rain", label: "Happy Rain", src: "/stickers/pack1/happy-rain.png", aspect: 374 / 400 },
      { id: "study-time", label: "Study Time", src: "/stickers/pack1/study-time.png", aspect: 400 / 385 },
      { id: "yum-day", label: "Yum Day", src: "/stickers/pack1/yum-day.png", aspect: 356 / 400 },
      { id: "beach-day", label: "Beach Day", src: "/stickers/pack1/beach-day.png", aspect: 389 / 400 },
      { id: "capture-moments", label: "Capture Moments", src: "/stickers/pack1/capture-moments.png", aspect: 400 / 340 },
      { id: "todays-bloom", label: "Today's Bloom", src: "/stickers/pack1/todays-bloom.png", aspect: 352 / 400 },
    ],
  },
  {
    id: "cute-everyday",
    name: "Cute Everyday",
    stickers: [
      { id: "good-boy", label: "Good Boy", src: "/stickers/pack2/good-boy.png", aspect: 276 / 400 },
      { id: "bubble-boba", label: "Bubble Boba", src: "/stickers/pack2/bubble-boba.png", aspect: 354 / 400 },
      { id: "guac-on", label: "Guac On", src: "/stickers/pack2/guac-on.png", aspect: 288 / 400 },
      { id: "perfect-pair", label: "Perfect Pair", src: "/stickers/pack2/perfect-pair.png", aspect: 352 / 400 },
      { id: "cosmic-cutie", label: "Cosmic Cutie", src: "/stickers/pack2/cosmic-cutie.png", aspect: 400 / 346 },
      { id: "comfy-toes", label: "Comfy Toes", src: "/stickers/pack2/comfy-toes.png", aspect: 378 / 400 },
      { id: "matcha-love", label: "Matcha Love", src: "/stickers/pack2/matcha-love.png", aspect: 400 / 387 },
      { id: "snapshot", label: "Snapshot!", src: "/stickers/pack2/snapshot.png", aspect: 368 / 400 },
      { id: "socks-appeal", label: "Socks Appeal", src: "/stickers/pack2/socks-appeal.png", aspect: 367 / 400 },
      { id: "daily-bread", label: "Daily Bread", src: "/stickers/pack2/daily-bread.png", aspect: 392 / 400 },
      { id: "wistful-star", label: "Wistful Star", src: "/stickers/pack2/wistful-star.png", aspect: 400 / 332 },
      { id: "ocean-pal", label: "Ocean Pal", src: "/stickers/pack2/ocean-pal.png", aspect: 381 / 400 },
    ],
  },
]

export function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createPlaceholderTextElement(text: string): TextScrapElement {
  return {
    id: newElementId(),
    type: "text",
    x: 40,
    y: 40,
    width: 220,
    height: 100,
    rotation: 0,
    zIndex: 1,
    text,
    color: "#222222",
    fontFamily: "Prompt",
    fontSize: 18,
    isPlaceholder: true,
  }
}
