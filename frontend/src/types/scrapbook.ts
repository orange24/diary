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
export const PAGE_HEIGHT_MIN = 1123
export const FONT_OPTIONS = ["Prompt", "Georgia", "Courier New"] as const

export function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
