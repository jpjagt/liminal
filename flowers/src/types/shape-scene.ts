import type { IsoShapeConfig } from "@/components/IsoShape"

export interface ScrollingIsoShapeProps {
  shapeId: string
  name: string
  scrollY: number // Current scroll position in pixels
  y: number // Target scroll position where shape appears (px)
  x?: number // Horizontal offset in viewport units (default 0)
  z?: number // Z-index/depth for layering (default 0)
  enableControls?: boolean
  config?: IsoShapeConfig
}

export interface ShapeSceneProps {
  scrollY: number
  children: React.ReactNode
}
