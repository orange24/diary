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

export function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
