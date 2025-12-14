import { useEffect, useState, useRef, useMemo } from "react"
import { AsciiNoiseEffect } from "./ascii.tsx"
import { getContentHeight, getGridPosition } from "./lib/char-pickers"
import type { TextItem } from "./lib/char-pickers"

import { ShapeScene, ScrollingIsoShape } from "@/components/ShapeScene"
import { getFlowerwall } from "@/lib/flowerwall"
import { LF_WORDMARK } from "@/constants"

const SPINE_TEXT = "lf  . ... .... . ... ...    . .      .   ".repeat(23)

// =============================================================================
// ZONE-BASED LAYOUT SYSTEM
// =============================================================================
// All vertical positions use GRID ROWS as the single source of truth.
// Zones are defined with `offset` (gap from previous) + `height` so you can
// insert/adjust zones without updating all subsequent ones.
//
// How it works:
// - Define zones with offset + height (relative positioning)
// - buildZones() computes absolute start/end values
// - Text: uses start/end directly (grid rows)
// - Shapes: convert via zoneToShapeY()
// =============================================================================

interface CornerTextConfig {
  topLeft: string // Text for top-left corner (e.g., "MARIPOSA" or "LIMINAL FLOWERS")
  topRight: string // Text for top-right corner
  bottomLeft: string // Text for bottom-left corner
  bottomRight: string // Text for bottom-right corner
}

interface ZoneConfig {
  offset: number // Gap from previous zone's end (in grid rows)
  height: number // Duration of this zone (in grid rows)
  textX: number // Horizontal offset from center (in cells, negative = left)
  textY?: number // Vertical offset tweak (in cells, added to px of y position)
  shapeX: number // Horizontal offset from center (in pixels, negative = left)
  shapeY?: number // Vertical offset tweak (in pixels, negative = up)
  textAnchor: "left" | "right"
  cornerTexts?: CornerTextConfig // Optional corner texts for this zone
}

interface Zone extends ZoneConfig {
  start: number // Computed: absolute grid row where zone starts
  end: number // Computed: absolute grid row where zone ends
}

// Zone definitions - offset is gap from previous zone, height is duration
// Order matters! Zones stack sequentially.
const ZONE_CONFIG: Record<string, ZoneConfig> = {
  mariposa: {
    offset: 4,
    height: 80,
    textX: -18,
    textY: 8,
    shapeX: 500,
    shapeY: -300,
    textAnchor: "right",
    cornerTexts: {
      topLeft: "M A R I P O S A",
      topRight: LF_WORDMARK,
      bottomLeft: LF_WORDMARK,
      bottomRight: "M A R I P O S A",
    },
  },
  littleDragon: {
    offset: 16,
    height: 80,
    textX: 20,
    shapeX: -400,
    shapeY: -300,
    textAnchor: "left",
    cornerTexts: {
      topLeft: "LITTLE DRAGON",
      topRight: "LIMINAL FLOWERS",
      bottomLeft: "LIMINAL FLOWERS",
      bottomRight: "LITTLE DRAGON",
    },
  },
  starflower: {
    offset: 10,
    height: 80,
    textX: -14,
    shapeX: 550,
    shapeY: -300,
    textAnchor: "right",
    cornerTexts: {
      topLeft: "STARFLOWER PENDANT",
      topRight: "LIMINAL FLOWERS",
      bottomLeft: "LIMINAL FLOWERS",
      bottomRight: "STARFLOWER PENDANT",
    },
  },
  // Decorative shapes (no text, just shapes)
  mariposaLarge: {
    offset: 90,
    height: 80,
    textX: 0,
    shapeX: -200,
    textAnchor: "left",
  },
  hornedLarge: {
    offset: 0,
    height: 80,
    textX: 0,
    shapeX: 400,
    shapeY: 800,
    textAnchor: "right",
  },
  starflowerLarge: {
    offset: 0,
    height: 80,
    textX: 0,
    shapeX: -600,
    shapeY: 700,
    textAnchor: "left",
  },
  mariposaHuge: {
    offset: 80,
    height: 80,
    textX: 0,
    shapeX: 1200,
    textAnchor: "right",
  },
  hornedHuge: {
    offset: 0,
    height: 80,
    textX: 0,
    shapeX: -950,
    textAnchor: "left",
  },
  starflowerHuge: {
    offset: 0,
    height: 80,
    textX: 0,
    shapeX: 500,
    textAnchor: "right",
  },
  mariposaGiant: {
    offset: 0,
    height: 80,
    textX: 0,
    shapeX: -400,
    textAnchor: "left",
  },
  /* hornedGiant: {
   *   offset: 0,
   *   height: 80,
   *   textX: 0,
   *   shapeX: 300,
   *   textAnchor: "right",
   * },
   * starflowerGiant: {
   *   offset: 0,
   *   height: 80,
   *   textX: 0,
   *   shapeX: -250,
   *   textAnchor: "left",
   * }, */
  fullscreen: {
    offset: 68,
    height: 170,
    textX: 0,
    shapeX: 0,
    textAnchor: "left",
  },
}

// Build zones with computed start/end from sequential offset+height
const buildZones = (
  config: Record<string, ZoneConfig>,
): Record<string, Zone> => {
  const zones: Record<string, Zone> = {}
  let cursor = 0

  for (const [name, zoneConfig] of Object.entries(config)) {
    const start = cursor + zoneConfig.offset
    const end = start + zoneConfig.height
    zones[name] = { ...zoneConfig, start, end }
    cursor = end
  }

  return zones
}

const ZONES = buildZones(ZONE_CONFIG)

// Convert zone position to pixel scroll position for shapes
// offsetInZone: 0 = zone start, 0.5 = middle, 1 = zone end (default: 0.5)
// screenOffset: where on screen shape appears (0 = top, 0.5 = center, default: 0.3)
const zoneToShapeY = (
  zone: Zone,
  cssCellSize: number,
  viewportHeight: number,
  offsetInZone: number = 0.5,
  screenOffset: number = 0.3,
): number => {
  const zonePosition = zone.start + (zone.end - zone.start) * offsetInZone
  const shapeYOffset = zone.shapeY ?? 0
  return (
    zonePosition * cssCellSize + viewportHeight * screenOffset + shapeYOffset
  )
}

// Layout constants
const FADE_CELLS = 28
const fadeCellsPieces = { fadeInCells: FADE_CELLS, fadeOutCells: FADE_CELLS }
const CORNER_MARGIN = 3 // Margin from viewport edge in grid cells

/**
 * Generate L-shaped corner text for a zone.
 * Each corner has text going in two directions forming an L:
 * - Top-left: horizontal right + vertical down (first letter at corner)
 * - Top-right: horizontal left + vertical down (first letter at corner)
 * - Bottom-left: horizontal right + vertical up (first letter at corner)
 * - Bottom-right: horizontal left + vertical up (first letter at corner)
 *
 * Example for "MARIPOSA" in top-left:
 * M A R I P O S A  (horizontal)
 * A
 * R
 * I
 * P
 * O
 * S
 * A                (vertical)
 *
 * For RTL and bottom-up arms, text is reversed so it reads correctly,
 * and fadeReverse is set so animation flows from corner outward.
 * fadeTotalChars is set to sync both arms of each corner.
 */
const generateCornerTexts = (
  zone: Zone,
  cornerConfig: CornerTextConfig,
): TextItem[] => {
  const items: TextItem[] = []
  const margin = Math.ceil(CORNER_MARGIN) // Round up as requested

  // Helper to create vertical text (one char per line)
  const toVertical = (text: string): string => text.split("").join("\n")
  // Helper to reverse a string
  const reverse = (text: string): string => text.split("").reverse().join("")

  // Top-left corner: first letter at corner, rest goes right AND down
  // Both arms animate forward (corner outward), no reverse needed
  const topLeftLen = cornerConfig.topLeft.length
  // Vertical arm (full text going down)
  items.push({
    text: toVertical(cornerConfig.topLeft),
    x: margin,
    y: { pct: 0, px: margin },
    anchorX: "left",
    anchorY: "top",
    fixed: {
      yStart: zone.start,
      yEnd: zone.end,
      fadeEffect: "sequential",
      fadeTotalChars: topLeftLen,
      ...fadeCellsPieces,
    },
  })
  // Horizontal arm (skip first char, starts 1 cell right of corner)
  if (topLeftLen > 1) {
    items.push({
      text: cornerConfig.topLeft.slice(1),
      x: margin + 1,
      y: { pct: 0, px: margin },
      anchorX: "left",
      anchorY: "top",
      fixed: {
        yStart: zone.start,
        yEnd: zone.end,
        fadeEffect: "sequential",
        fadeTotalChars: topLeftLen,
        ...fadeCellsPieces,
      },
    })
  }

  // Top-right corner: first letter at corner, rest goes left AND down
  // Horizontal arm is RTL - needs reversed text and reversed animation
  const topRightLen = cornerConfig.topRight.length
  // Vertical arm (full text going down) - forward direction
  items.push({
    text: toVertical(cornerConfig.topRight),
    x: { pct: 1, px: -margin },
    y: { pct: 0, px: margin },
    anchorX: "right",
    anchorY: "top",
    fixed: {
      yStart: zone.start,
      yEnd: zone.end,
      fadeEffect: "sequential",
      fadeTotalChars: topRightLen,
      ...fadeCellsPieces,
    },
  })
  // Horizontal arm going left - reversed text, reversed animation
  if (topRightLen > 1) {
    items.push({
      text: reverse(cornerConfig.topRight.slice(1)),
      x: { pct: 1, px: -margin - 1 },
      y: { pct: 0, px: margin },
      anchorX: "right",
      anchorY: "top",
      fixed: {
        yStart: zone.start,
        yEnd: zone.end,
        fadeEffect: "sequential",
        fadeReverse: true,
        fadeTotalChars: topRightLen,
        ...fadeCellsPieces,
      },
    })
  }

  // Bottom-left corner: first letter at corner, rest goes right AND up
  // Vertical arm is bottom-up - needs reversed text and reversed animation
  const bottomLeftLen = cornerConfig.bottomLeft.length
  // Vertical arm going up - reversed text, reversed animation
  items.push({
    text: toVertical(reverse(cornerConfig.bottomLeft)),
    x: margin,
    y: { pct: 1, px: -margin },
    anchorX: "left",
    anchorY: "bottom",
    fixed: {
      yStart: zone.start,
      yEnd: zone.end,
      fadeEffect: "sequential",
      fadeReverse: true,
      fadeTotalChars: bottomLeftLen,
      ...fadeCellsPieces,
    },
  })
  // Horizontal arm (skip first char) - forward direction
  if (bottomLeftLen > 1) {
    items.push({
      text: cornerConfig.bottomLeft.slice(1),
      x: margin + 1,
      y: { pct: 1, px: -margin },
      anchorX: "left",
      anchorY: "bottom",
      fixed: {
        yStart: zone.start,
        yEnd: zone.end,
        fadeEffect: "sequential",
        fadeTotalChars: bottomLeftLen,
        ...fadeCellsPieces,
      },
    })
  }

  // Bottom-right corner: first letter at corner, rest goes left AND up
  // Both arms need reversed text and reversed animation
  const bottomRightLen = cornerConfig.bottomRight.length
  // Vertical arm going up - reversed text, reversed animation
  items.push({
    text: toVertical(reverse(cornerConfig.bottomRight)),
    x: { pct: 1, px: -margin },
    y: { pct: 1, px: -margin },
    anchorX: "right",
    anchorY: "bottom",
    fixed: {
      yStart: zone.start,
      yEnd: zone.end,
      fadeEffect: "sequential",
      fadeReverse: true,
      fadeTotalChars: bottomRightLen,
      ...fadeCellsPieces,
    },
  })
  // Horizontal arm going left - reversed text, reversed animation
  if (bottomRightLen > 1) {
    items.push({
      text: reverse(cornerConfig.bottomRight.slice(1)),
      x: { pct: 1, px: -margin - 1 },
      y: { pct: 1, px: -margin },
      anchorX: "right",
      anchorY: "bottom",
      fixed: {
        yStart: zone.start,
        yEnd: zone.end,
        fadeEffect: "sequential",
        fadeReverse: true,
        fadeTotalChars: bottomRightLen,
        ...fadeCellsPieces,
      },
    })
  }

  return items
}

// Fullscreen pattern config (derived from zone)
const FULLSCREEN_Y_START = ZONES.fullscreen.start
const FULLSCREEN_FADE_IN = 50
const FULLSCREEN_VISIBLE = 20
const FULLSCREEN_FADE_OUT = 10

const getLayout = (cols: number, rows: number): TextItem[] => {
  const z = ZONES // shorthand

  // Generate corner texts for all zones that have them
  const cornerTextItems: TextItem[] = []
  for (const [, zone] of Object.entries(ZONES)) {
    if (zone.cornerTexts) {
      cornerTextItems.push(...generateCornerTexts(zone, zone.cornerTexts))
    }
  }

  return [
    // Spine (always visible)
    {
      text: SPINE_TEXT,
      x: { pct: 0.5, px: 0 },
      y: 0,
      anchorX: "center",
      maxWidth: 1,
      opacity: 0.5,
      renderSpaces: false,
    },

    // Corner texts for all zones
    ...cornerTextItems,

    // === MARIPOSA ZONE ===
    {
      text: `\
         MARIPOSA




             WHEN IN THEIR
                    COCCOON,

      BUTTERFLIES LOSE ALL
  CELL STRUCTURE. YET

           THEY RETAIN
              THEIR MEMORIES...
      `,
      x: { pct: 0.5, px: z.mariposa.textX },
      y: { pct: 0.4, px: z.mariposa.textY ?? 0 },
      anchorX: z.mariposa.textAnchor,
      renderSpaces: false,
      fixed: {
        yStart: z.mariposa.start,
        yEnd: z.mariposa.end,
        fadeEffect: "random",
        ...fadeCellsPieces,
      },
    },

    // === LITTLE DRAGON ZONE ===
    {
      text: `\
 LITTLE DRAGON




             ECHOES
      OF CIRCLES
         IN SPIRALS.


LITTLE HORNS TO REMIND
  AN ACROBAT
      OF MISCHIEF.


      `,
      x: { pct: 0.5, px: z.littleDragon.textX },
      y: { pct: 0.4, px: z.littleDragon.textY ?? 0 },
      anchorX: z.littleDragon.textAnchor,
      fixed: {
        yStart: z.littleDragon.start,
        yEnd: z.littleDragon.end,
        ...fadeCellsPieces,
      },
    },

    // === STARFLOWER ZONE ===
    {
      text: `\
STARFLOWER PENDANT




        A STARFLOWER IS A
             PERENNIAL HERB WITH
         WHITE FLOWERS


           THAT BLOOMS IN
      SPRING OR SUMMER
           IN MOIST WOODS.
      `,
      x: { pct: 0.5, px: z.starflower.textX },
      y: { pct: 0.4, px: z.starflower.textY ?? 0 },
      anchorX: z.starflower.textAnchor,
      renderSpaces: false,
      fixed: {
        yStart: z.starflower.start,
        yEnd: z.starflower.end,
        ...fadeCellsPieces,
      },
    },

    // === FULLSCREEN FINALE ===
    {
      text: getFlowerwall("dahlia", cols, rows, {
        /* leftText: "TEMPUS.FUGIT.",
         * rightText: "TEMPUS.FUGIT.", */
        leftText: ".     ..    ...   ....  ..... ..... ...... .......",
        rightText: ".     ..    ...   ....  ..... ..... ...... .......",
        marginTop: 10,
        paddingX: 3,
      }),
      x: 0,
      y: 0,
      anchorX: "left",
      anchorY: "top",
      maxWidth: cols,
      fixed: {
        yStart: z.fullscreen.start,
        yEnd:
          z.fullscreen.start +
          FULLSCREEN_FADE_IN +
          FULLSCREEN_VISIBLE +
          FULLSCREEN_FADE_OUT,
        fadeInCells: FULLSCREEN_FADE_IN,
        fadeOutCells: FULLSCREEN_FADE_OUT,
      },
    },
  ]
}

const SCROLL_CONFIG = {
  contentLag: 0.04,
  baseFlowSpeed: 2.0,
  scrollFlowFactor: 0.2,
  flowAcceleration: 0.05,
}

const CELL_SIZE = 28

const useWindowSize = () => {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1000,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return size
}

const DomOverlay = ({
  items,
  scrollY,
  cols,
  rows,
  cssCellSize,
}: {
  items: TextItem[]
  scrollY: number
  cols: number
  rows: number
  cssCellSize: number
}) => {
  return (
    <div className='absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden'>
      {items
        .map((item, idx) => {
          if (!item.component) return null
          const { x, y, width, height } = getGridPosition(
            item,
            cols,
            rows,
            scrollY,
          )
          const topPx = Math.floor(y) * cssCellSize
          const leftPx = Math.floor(x) * cssCellSize
          const widthPx = width * cssCellSize
          const heightPx = height * cssCellSize

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: leftPx,
                top: topPx,
                width: widthPx,
                height: heightPx,
                pointerEvents: "auto",
              }}
            >
              {item.component}
            </div>
          )
        })
        .filter(Boolean)}
    </div>
  )
}

// Calculate bgOpacity based on scroll position for fullscreen pattern blackout
const computeBgOpacity = (scrollYCells: number): number => {
  const fadeInEnd = FULLSCREEN_Y_START + FULLSCREEN_FADE_IN
  const fadeOutEnd = fadeInEnd + FULLSCREEN_VISIBLE + FULLSCREEN_FADE_OUT
  const offsetStartFadeOut = -5
  const startBgFadeOut = fadeInEnd + offsetStartFadeOut

  if (scrollYCells < startBgFadeOut) {
    return 0.44 // Default
  }

  const opacity = Math.max(
    0.1,
    1 - (scrollYCells - startBgFadeOut) / (fadeOutEnd - startBgFadeOut),
  )

  return opacity
}

function App() {
  const [gridOffset, setGridOffset] = useState<[number, number]>([0, 0])
  const [scrollYState, setScrollYState] = useState(0) // For ShapeScene
  const [bgOpacity, setBgOpacity] = useState(0.44)
  const [showShapes, setShowShapes] = useState(false)
  const { width, height, dpr } = useWindowSize()

  const smoothScrollY = useRef(0)
  const smoothVelocity = useRef(0)
  const lastTime = useRef(0)
  const prevScrollRef = useRef(0)
  const offsetRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const cols = Math.ceil((width * dpr) / CELL_SIZE)
  const rows = Math.ceil((height * dpr) / CELL_SIZE)

  const textItems = useMemo(() => getLayout(cols, rows), [cols, rows])

  const contentHeightCells = getContentHeight(textItems, 100)
  const cssCellSize = CELL_SIZE / dpr
  // Ensure we can scroll far enough for the fullscreen pattern
  const minHeightForFullscreen =
    FULLSCREEN_Y_START +
    FULLSCREEN_FADE_IN +
    FULLSCREEN_VISIBLE +
    FULLSCREEN_FADE_OUT +
    20
  const effectiveContentHeight = Math.max(
    contentHeightCells,
    minHeightForFullscreen,
  )
  const totalHeightPx = effectiveContentHeight * cssCellSize + height

  // Delay showing 3D shapes to let ASCII renderer stabilize first
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowShapes(true)
    }, 500)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    let animId: number
    const animate = (time: number) => {
      if (lastTime.current === 0) {
        lastTime.current = time
        smoothScrollY.current = window.scrollY
        prevScrollRef.current = window.scrollY
        animId = requestAnimationFrame(animate)
        return
      }

      const dt = (time - lastTime.current) / 1000
      lastTime.current = time

      if (dt <= 0 || dt > 0.2) {
        animId = requestAnimationFrame(animate)
        return
      }

      const targetScroll = window.scrollY
      const lagFactor = SCROLL_CONFIG.contentLag * (dt * 60)

      smoothScrollY.current +=
        (targetScroll - smoothScrollY.current) * Math.min(lagFactor, 1)

      const rawVelocity = Math.abs(targetScroll - prevScrollRef.current) / dt
      prevScrollRef.current = targetScroll

      const targetFlowSpeed =
        SCROLL_CONFIG.baseFlowSpeed +
        rawVelocity * SCROLL_CONFIG.scrollFlowFactor

      const accelFactor = SCROLL_CONFIG.flowAcceleration * (dt * 60)
      smoothVelocity.current +=
        (targetFlowSpeed - smoothVelocity.current) * Math.min(accelFactor, 1)

      offsetRef.current += smoothVelocity.current * dt

      setGridOffset([0, -offsetRef.current])
      setScrollYState(smoothScrollY.current)

      // Update bgOpacity based on scroll position (in cells)
      const scrollYCells = smoothScrollY.current / cssCellSize
      setBgOpacity(computeBgOpacity(scrollYCells))

      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [cssCellSize])

  return (
    <div style={{ height: totalHeightPx, width: "100vw" }} ref={containerRef}>
      <div className='fixed top-0 left-0 w-full h-full'>
        <AsciiNoiseEffect
          className='h-full w-full'
          charset={3}
          bgOpacity={bgOpacity}
          fgOpacity={1}
          textItems={textItems}
          cell={CELL_SIZE}
          scrollY={smoothScrollY.current / cssCellSize}
          gridOffset={gridOffset}
        />
        <DomOverlay
          items={textItems}
          scrollY={smoothScrollY.current / cssCellSize}
          cols={cols}
          rows={rows}
          cssCellSize={cssCellSize}
        />
      </div>

      {/* Shapes positioned by zones - y is derived from zone grid position */}
      {/* Delayed render to let ASCII renderer stabilize first */}
      {showShapes && (
        <ShapeScene scrollY={scrollYState}>
          {/* === PRIMARY SHAPES (with text) === */}
          <ScrollingIsoShape
            shapeId='mariposa'
            name='mariposa-main'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.mariposa, cssCellSize, height)}
            x={ZONES.mariposa.shapeX}
            enableControls={true}
            config={{
              scale: 0.9,
              rotationX: 25,
              rotationY: -25,
              rotationZ: -2,
            }}
          />

          <ScrollingIsoShape
            shapeId='horned-circles'
            name='horned-circles-main'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.littleDragon, cssCellSize, height)}
            x={ZONES.littleDragon.shapeX}
            z={-1}
            enableControls={true}
            config={{ scale: 1.4, rotationX: 20, rotationY: 40 }}
          />

          <ScrollingIsoShape
            shapeId='starflower-pendant'
            name='starflower-pendant-main'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.starflower, cssCellSize, height)}
            x={ZONES.starflower.shapeX}
            enableControls={true}
            config={{
              scale: 1.6,
              rotationX: -11,
              rotationY: -19,
              rotationZ: -7,
            }}
          />

          {/* === DECORATIVE SHAPES (no text) === */}
          <ScrollingIsoShape
            shapeId='mariposa'
            name='mariposa-large'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.mariposaLarge, cssCellSize, height)}
            x={ZONES.mariposaLarge.shapeX}
            enableControls={true}
            config={{ scale: 3, rotationX: 35, rotationY: 45 }}
          />

          <ScrollingIsoShape
            shapeId='horned-circles'
            name='horned-circles-large'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.hornedLarge, cssCellSize, height)}
            x={ZONES.hornedLarge.shapeX}
            enableControls={true}
            config={{ scale: 2.8, rotationX: 20, rotationY: -35 }}
          />

          <ScrollingIsoShape
            shapeId='starflower-pendant'
            name='starflower-pendant-large'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.starflowerLarge, cssCellSize, height)}
            x={ZONES.starflowerLarge.shapeX}
            enableControls={true}
            config={{ scale: 3.2, rotationX: 40, rotationY: 25 }}
          />

          <ScrollingIsoShape
            shapeId='mariposa'
            name='mariposa-huge'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.mariposaHuge, cssCellSize, height)}
            x={ZONES.mariposaHuge.shapeX}
            enableControls={true}
            config={{ scale: 2.5, rotationX: -15, rotationY: 50 }}
          />

          <ScrollingIsoShape
            shapeId='horned-circles'
            name='horned-circles-huge'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.hornedHuge, cssCellSize, height)}
            x={ZONES.hornedHuge.shapeX}
            enableControls={true}
            config={{ scale: 3.5, rotationX: 30, rotationY: -20 }}
          />

          <ScrollingIsoShape
            shapeId='starflower-pendant'
            name='starflower-pendant-huge'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.starflowerHuge, cssCellSize, height)}
            x={ZONES.starflowerHuge.shapeX}
            enableControls={true}
            config={{ scale: 2.2, rotationX: 25, rotationY: 40 }}
          />

          <ScrollingIsoShape
            shapeId='mariposa'
            name='mariposa-giant'
            scrollY={scrollYState}
            y={zoneToShapeY(ZONES.mariposaGiant, cssCellSize, height)}
            x={ZONES.mariposaGiant.shapeX}
            enableControls={true}
            config={{ scale: 4, rotationX: 45, rotationY: -30 }}
          />

          {/* <ScrollingIsoShape
              shapeId='horned-circles'
              name='horned-circles-giant'
              scrollY={scrollYState}
              y={zoneToShapeY(ZONES.hornedGiant, cssCellSize, height)}
              x={ZONES.hornedGiant.shapeX}
              enableControls={true}
              config={{ scale: 3.8, rotationX: 15, rotationY: 55 }}
              />

              <ScrollingIsoShape
              shapeId='starflower-pendant'
              name='starflower-pendant-giant'
              scrollY={scrollYState}
              y={zoneToShapeY(ZONES.starflowerGiant, cssCellSize, height)}
              x={ZONES.starflowerGiant.shapeX}
              enableControls={true}
              config={{ scale: 3.0, rotationX: 50, rotationY: -15 }}
              /> */}
        </ShapeScene>
      )}
    </div>
  )
}

export default App
