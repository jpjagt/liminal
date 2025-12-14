import quinque5 from "../fonts/quinque5.json"
import quinque5f from "../fonts/quinque5f.json"

export const fonts = {
  quinque5,
  quinque5f,
}

export const DEFAULT_FONT = fonts.quinque5f

export const stringToBitmasks = (
  text: string,
  font: Record<string, number> = DEFAULT_FONT,
): number[] => {
  return text.split("").map((char) => {
    // The json file keys are strings.
    // We treat the font object as a dictionary.
    const val = (font as any)[char]
    return typeof val === "number" ? val : 0
  })
}

// --- Layout Engine ---

export type PositionSpec = number | { pct?: number; px?: number }

export interface TextItem {
  text?: string
  component?: React.ReactNode
  x: PositionSpec
  y: PositionSpec
  anchorX?: "left" | "center" | "right"
  anchorY?: "top" | "center" | "bottom"
  opacity?: number // 0..1, default 1
  maxWidth?: number // in characters
  width?: number // for components (in cells)
  height?: number // for components (in cells)
  renderSpaces?: boolean // default true
  shapeId?: string
  shapeView?: string
  // Fixed position mode: text stays fixed on screen and fades in/out based on scroll position
  fixed?: {
    yStart: number // scroll position (in cells) where text starts appearing
    yEnd: number // scroll position (in cells) where text disappears
    fadeInCells?: number // number of cells over which to fade in (default 4)
    fadeOutCells?: number // number of cells over which to fade out (default same as fadeInCells)
  }
}

const resolvePos = (spec: PositionSpec, totalSize: number): number => {
  if (typeof spec === "number") return spec
  const pct = spec.pct ?? 0
  const px = spec.px ?? 0
  return pct * totalSize + px
}

export const getGridPosition = (
  item: TextItem,
  cols: number,
  rows: number,
  scrollYOffset: number = 0,
): { x: number; y: number; width: number; height: number } => {
  const gridX = resolvePos(item.x, cols)
  // In the texture buffer, y=0 is bottom. But for screen coordinates (DOM), y=0 is top.
  // computeTextLayer uses: rows - 1 - (resolvePos(item.y, rows) - scrollYOffset)
  // This seems to map "y=0" in item config to the bottom of the screen?
  // Let's check App.tsx items.
  // Item 1: y = Y_START (40).
  // If y=0 is top, increasing y goes down.
  // In computeTextLayer: gridY = rows - 1 - (resolvePos(item.y, rows) - scrollYOffset)
  // If resolvePos returns 40. gridY = rows - 1 - (40 - scrollY).
  // If scrollY increases (scrolling down), gridY increases (moves up visually?).
  // Wait. standard scrolling: content moves UP.
  // If scrollY increases, (40 - scrollY) decreases.
  // rows - 1 - (smaller number) => larger number (higher in texture = top of screen?).
  // Let's verify coordinate system of texture.
  // computeTextLayer writes to buffer.
  // row 0 is usually bottom in GL?
  // In ascii.tsx:
  // int pickCharText...
  // vec2 pos = pixelCoords + uTextOffset
  // int gridY = int(floor(pos.y / cellSize))
  // pixelCoords (0,0) is usually bottom-left in standard GL, but top-left in generic 2D?
  // In vs: gl_Position = vec4(aPosition, 0.0, 1.0). aPosition is -1..1.
  // vUv = (aPosition+1)*0.5. (0..1).
  // fragmentCoordinates = vUv * uResolution.
  // usually vUv (0,0) is bottom-left.
  // So pixelCoords.y=0 is bottom.
  // So gridY=0 is bottom row.
  // If App.tsx defines Y_START=40 (which is positive).
  // In computeTextLayer: gridY = rows - 1 - (40 - scroll).
  // If scroll=0, gridY = rows - 1 - 40.
  // If rows=100, gridY = 99 - 40 = 59. (Middle-ish).
  // If scroll increases (scrolling down), gridY increases. Moves UP the texture (towards top).
  // This matches standard scroll behavior (content moves up).

  // For DOM elements, we want TOP-LEFT coordinates.
  // DOM Y = (resolvePos(item.y, rows) - scrollYOffset) * CELL_SIZE?
  // Wait. If y=40, and scroll=0. content is at 40 cells from... top?
  // If computeTextLayer maps it to (rows-1) - 40.
  // If texture Y=0 is bottom, then texture Y=rows-1 is TOP.
  // So gridY is measured from bottom.
  // So item at y=40 is 40 cells from the TOP.
  // So for DOM, Y = 40.
  // If scroll increases, we subtract scroll.
  // DOM Y = 40 - scrollYOffset.

  let width = 0
  let height = 0

  if (item.component) {
    width = item.width || 0
    height = item.height || 0
  } else if (item.text) {
    // For simplicity in this helper, we might need to duplicate the wrapping logic
    // or just trust the user provided width/height for components?
    // The helper is mostly for DOM components, so we can assume width/height are provided or irrelevant for text here.
    // But for precise anchor calculation we need width.
    // Let's assume for DOM components, width is explicit.
  }

  let startX = gridX
  let startY = resolvePos(item.y, rows) - scrollYOffset // This is in "cells from top"

  if (item.anchorX === "center") startX -= width / 2
  if (item.anchorX === "right") startX -= width

  if (item.anchorY === "center") startY -= height / 2
  if (item.anchorY === "bottom") startY -= height

  return { x: startX, y: startY, width, height }
}

export const getContentHeight = (items: TextItem[], rows: number): number => {
  let maxY = 0
  items.forEach((item) => {
    // Fixed items don't contribute to content height (they're viewport-fixed)
    if (item.fixed) return

    const absY = resolvePos(item.y, rows)
    let estimatedLines = 0
    if (item.component) {
      estimatedLines = item.height || 0
    } else if (item.text) {
      const lines = item.text.split("\n").length
      estimatedLines = item.maxWidth
        ? Math.ceil(item.text.length / item.maxWidth) * 1.1
        : lines
    }
    maxY = Math.max(maxY, absY + estimatedLines)
  })
  return maxY
}

/**
 * Computes the text texture for the current viewport.
 * @param scrollYOffset - The vertical scroll offset in GRID CELLS (rows).
 */
export const computeTextLayer = (
  items: TextItem[],
  cols: number,
  rows: number,
  scrollYOffset: number = 0,
  font: Record<string, number> = DEFAULT_FONT,
): Uint32Array => {
  // 2 channels per cell: R=Bitmask, G=Opacity(0-255)
  // WebGL2 RG32UI texture uses Uint32Array.
  // Stride = 2.
  const size = cols * rows * 2
  const buffer = new Uint32Array(size)

  // Fill with 0
  buffer.fill(0)

  // Simple deterministic hash for consistent random values per grid position
  const hash = (x: number, y: number): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return n - Math.floor(n)
  }

  items.forEach((item) => {
    if (item.component) return
    if (!item.text) return

    // Calculate fade state for fixed items
    // fadeProgress: 0 = fully hidden, 1 = fully visible
    // fadeDirection: 'in' | 'out' | 'full' | 'hidden'
    let fadeProgress = 1
    let fadeDirection: "in" | "out" | "full" | "hidden" = "full"

    const baseOpacity = item.opacity ?? 1

    if (item.fixed) {
      const {
        yStart,
        yEnd,
        fadeInCells = 4,
        fadeOutCells = fadeInCells,
      } = item.fixed

      // scrollYOffset is in cells
      if (scrollYOffset < yStart) {
        fadeProgress = 0
        fadeDirection = "hidden"
      } else if (scrollYOffset < yStart + fadeInCells) {
        fadeProgress = (scrollYOffset - yStart) / fadeInCells
        fadeDirection = "in"
      } else if (scrollYOffset <= yEnd - fadeOutCells) {
        fadeProgress = 1
        fadeDirection = "full"
      } else if (scrollYOffset < yEnd) {
        fadeProgress = (yEnd - scrollYOffset) / fadeOutCells
        fadeDirection = "out"
      } else {
        fadeProgress = 0
        fadeDirection = "hidden"
      }
    }

    // Skip rendering if completely hidden
    if (fadeDirection === "hidden") return

    // Split keeping delimiters to preserve spaces if needed, but here simple split by char for font mapping.
    // We need words for wrapping.
    const words = item.text.split(/(\s+)/).filter(Boolean)

    const lines: string[] = []
    if (item.maxWidth) {
      let currentLine = ""
      words.forEach((word) => {
        if (word.includes("\n")) {
          const parts = word.split("\n")
          parts.forEach((part, i) => {
            if (i > 0) {
              lines.push(currentLine)
              currentLine = ""
            }
            if (part.length > item.maxWidth!) {
              for (let j = 0; j < part.length; j += item.maxWidth!) {
                const sub = part.slice(j, j + item.maxWidth!)
                if (currentLine.length + sub.length > item.maxWidth!) {
                  if (currentLine) lines.push(currentLine)
                  currentLine = sub
                } else {
                  currentLine += sub
                }
              }
            } else {
              if (currentLine.length + part.length > item.maxWidth!) {
                lines.push(currentLine)
                currentLine = part
              } else {
                currentLine += part
              }
            }
          })
          return
        }

        if (word.length > item.maxWidth!) {
          for (let j = 0; j < word.length; j += item.maxWidth!) {
            const sub = word.slice(j, j + item.maxWidth!)
            if (currentLine.length + sub.length > item.maxWidth!) {
              if (currentLine) lines.push(currentLine)
              currentLine = sub
            } else {
              currentLine += sub
            }
          }
        } else {
          if (currentLine.length + word.length > item.maxWidth!) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine += word
          }
        }
      })
      if (currentLine) lines.push(currentLine)
    } else {
      lines.push(...item.text.split("\n"))
    }

    const gridX = resolvePos(item.x, cols)
    // For fixed items, y position is fixed on screen (not affected by scroll)
    // For regular items, y position scrolls with content
    const gridY = item.fixed
      ? rows - 1 - resolvePos(item.y, rows)
      : rows - 1 - (resolvePos(item.y, rows) - scrollYOffset)

    let startX = gridX
    let startY = gridY

    const maxLineLen = Math.max(...lines.map((l) => l.length))
    const totalHeight = lines.length

    if (item.anchorX === "center") startX -= maxLineLen / 2
    if (item.anchorX === "right") startX -= maxLineLen

    if (item.anchorY === "center") startY += (totalHeight - 1) / 2
    if (item.anchorY === "bottom") startY += totalHeight - 1

    // Rasterize
    lines.forEach((line, lineIdx) => {
      const row = Math.floor(startY - lineIdx)
      if (row < 0 || row >= rows) return

      for (let i = 0; i < line.length; i++) {
        const col = Math.floor(startX + i)
        if (col < 0 || col >= cols) continue

        const char = line[i]

        // Calculate per-character opacity for fixed items with flicker effect
        let charOpacityMultiplier = 1

        if (item.fixed && fadeDirection !== "full") {
          // Use grid position to get a consistent random threshold for this character
          const charRandom = hash(col, row)

          // 3 opacity levels: 0, 0.5, 1
          // Each character has a random "appear threshold" (0-1)
          // As fadeProgress increases, more characters appear
          // Characters first appear at 0.5 opacity, then full opacity

          if (fadeProgress < charRandom * 0.5) {
            // Character hasn't started appearing yet
            charOpacityMultiplier = 0
          } else if (fadeProgress < charRandom) {
            // Character is at half opacity (flickering stage)
            charOpacityMultiplier = 0.5
          } else {
            // Character is fully visible
            charOpacityMultiplier = 1
          }
        }

        // Whitespace handling
        let mask = 0
        let charOpacity = 0

        if (char === " " && item.renderSpaces === false) {
          // Do nothing (default 0)
        } else if (char === " ") {
          // Render space (overwrite bg)
          mask = 0
          charOpacity = Math.floor(baseOpacity * charOpacityMultiplier * 255)
        } else {
          mask = (font as any)[char] || 0
          charOpacity = Math.floor(baseOpacity * charOpacityMultiplier * 255)
        }

        const idx = (row * cols + col) * 2
        buffer[idx] = mask
        buffer[idx + 1] = charOpacity
      }
    })
  })

  return buffer
}

// GLSL snippet to be injected
export const PICKER_TEXT_GLSL = `
uniform int uTextValues[128];
uniform int uTextLength;
uniform vec2 uTextOffset;
uniform float uLineOffsetIncrease;

int pickCharText(vec2 pixelCoords, float grayscaleValue, float cellSize) {
  if (grayscaleValue < 0.01) return 0;
  if (uTextLength == 0) return 0;

  // Apply offset to pixel coordinates
  vec2 pos = pixelCoords + uTextOffset;

  // Convert to grid coordinates (cell indices)
  int gridX = int(floor(pos.x / cellSize));
  int gridY = int(floor(pos.y / cellSize));

  // Calculate index
  // index = gridX + gridY * lineOffsetIncrease
  int index = gridX + int(float(gridY) * uLineOffsetIncrease);

  // Wrap index to text length
  int wrappedIndex = index % uTextLength;
  if (wrappedIndex < 0) wrappedIndex += uTextLength;

  return uTextValues[wrappedIndex];
}
`
