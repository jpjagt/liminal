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
  text: string
  x: PositionSpec
  y: PositionSpec
  anchorX?: "left" | "center" | "right"
  anchorY?: "top" | "center" | "bottom"
  opacity?: number // 0..1, default 1
  maxWidth?: number // in characters
  renderSpaces?: boolean // default true
}

const resolvePos = (spec: PositionSpec, totalSize: number): number => {
  if (typeof spec === "number") return spec
  const pct = spec.pct ?? 0
  const px = spec.px ?? 0
  return pct * totalSize + px
}

export const getContentHeight = (items: TextItem[], rows: number): number => {
  let maxY = 0
  items.forEach((item) => {
    const absY = resolvePos(item.y, rows)
    const lines = item.text.split("\n").length
    const estimatedLines = item.maxWidth
      ? Math.ceil(item.text.length / item.maxWidth) * 1.5
      : lines
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

  items.forEach((item) => {
    const opacity = Math.floor(
      Math.max(0, Math.min(1, item.opacity ?? 1)) * 255,
    )

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
    const gridY = rows - 1 - (resolvePos(item.y, rows) - scrollYOffset)

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

        // Whitespace handling
        let mask = 0
        let charOpacity = 0

        if (char === " " && item.renderSpaces === false) {
          // Do nothing (default 0)
        } else if (char === " ") {
          // Render space (overwrite bg)
          mask = 0
          charOpacity = opacity
        } else {
          mask = (font as any)[char] || 0
          charOpacity = opacity
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
