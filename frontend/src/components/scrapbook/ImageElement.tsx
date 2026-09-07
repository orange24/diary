"use client"

import { ImageScrapElement } from "@/types/scrapbook"

interface ImageElementProps {
  element: ImageScrapElement
}

export function ImageElement({ element }: ImageElementProps) {
  return (
    <img
      src={element.src}
      alt=""
      draggable={false}
      className="w-full h-full object-cover select-none"
    />
  )
}
