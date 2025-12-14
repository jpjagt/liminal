import { useEffect, useState, useRef, useMemo } from "react"
import { AsciiNoiseEffect } from "./ascii.tsx"
import { getContentHeight, getGridPosition } from "./lib/char-pickers"
import type { TextItem } from "./lib/char-pickers"
import { IsoShape } from "./components/IsoShape"
import type { IsoView } from "./components/IsoShape"
import { ShapeScene, ScrollingIsoShape } from "@/components/ShapeScene"
import { getFlowerwall } from "@/lib/flowerwall"

const SPINE_TEXT = "lf  . ... .... . ... ...    . .      .   ".repeat(23)

// Fullscreen pattern config
const FULLSCREEN_Y_START = 920
const FULLSCREEN_FADE_IN = 50
const FULLSCREEN_VISIBLE = 1
const FULLSCREEN_FADE_OUT = 40
const X_OFFSET = 14 // cells from center
const MAX_WIDTH = 18 // Longest title "STARFLOWER PENDANT"

const FADE_CELLS = 28
const fadeCellsPieces = { fadeInCells: FADE_CELLS, fadeOutCells: FADE_CELLS }

const getLayout = (
  isMobile: boolean,
  cols: number,
  rows: number,
): TextItem[] => {
  // Desktop Layout (Original)
  return [
    // Spine
    {
      text: SPINE_TEXT,
      x: { pct: 0.5, px: 0 },
      y: 0,
      anchorX: "center",
      maxWidth: 1,
      opacity: 0.5,
      renderSpaces: false,
    },
    // Item 1 - MARIPOSA (original y ~54-57, range 34-94)
    {
      text: "MARIPOSA",
      x: { pct: 0.5, px: -X_OFFSET },
      y: { pct: 0.4 },
      anchorX: "right",
      maxWidth: MAX_WIDTH,
      fixed: { yStart: 0, yEnd: 0 + 80, ...fadeCellsPieces },
    },
    {
      text: `\
             WHEN IN THEIR
                    COCCOON,

      BUTTERFLIES LOSE ALL
  CELL STRUCTURE. YET

           THEY RETAIN
              THEIR MEMORIES...
      `,
      x: { pct: 0.5, px: -X_OFFSET },
      y: { pct: 0.4, px: 3 },
      anchorX: "right",
      renderSpaces: false,
      fixed: { yStart: 0, yEnd: 0 + 80, ...fadeCellsPieces },
    },
    // Item 2 - LITTLE DRAGON (original y ~126-132, range 106-166)
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
      x: { pct: 0.5, px: X_OFFSET },
      y: { pct: 0.4 },
      anchorX: "left",
      fixed: { yStart: 80, yEnd: 80 + 80, ...fadeCellsPieces },
    },
    // Item 3 - STARFLOWER PENDANT (original y ~198-204, range 178-238)
    {
      text: "STARFLOWER PENDANT",
      x: { pct: 0.5, px: -X_OFFSET },
      y: { pct: 0.4 },
      anchorX: "right",
      maxWidth: MAX_WIDTH,
      fixed: { yStart: 178, yEnd: 238, ...fadeCellsPieces },
    },
    {
      text: "A STARFLOWER IS A PERENNIAL HERB\nWITH WHITE FLOWERS THAT BLOOMS\nIN SPRING OR SUMMER IN MOIST WOODS.",
      x: { pct: 0.5, px: -X_OFFSET },
      y: { pct: 0.4, px: 6 },
      anchorX: "right",
      fixed: { yStart: 178, yEnd: 238, ...fadeCellsPieces },
    },
    // Fullscreen LIMINAL.FLOWERS pattern with starbouquet flower
    {
      text: getFlowerwall("dahlia", cols, rows, {
        leftText: "temporary.pleasures.",
        rightText: "temporary.pleasures.",
        marginTop: 10,
        paddingX: 3,
      }),
      x: 0,
      y: 0,
      anchorX: "left",
      anchorY: "top",
      maxWidth: cols, // Fill entire width
      fixed: {
        yStart: FULLSCREEN_Y_START,
        yEnd:
          FULLSCREEN_Y_START +
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

  console.log({ scrollYCells, FULLSCREEN_Y_START })

  if (scrollYCells < fadeInEnd + 2) {
    return 0.44 // Default
  } else {
    return 0
  }
}

function App() {
  const [gridOffset, setGridOffset] = useState<[number, number]>([0, 0])
  const [scrollYState, setScrollYState] = useState(0) // For ShapeScene
  const [bgOpacity, setBgOpacity] = useState(0.44)
  const { width, height, dpr } = useWindowSize()

  const smoothScrollY = useRef(0)
  const smoothVelocity = useRef(0)
  const lastTime = useRef(0)
  const prevScrollRef = useRef(0)
  const offsetRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const isMobile = width < 768
  const cols = Math.ceil((width * dpr) / CELL_SIZE)
  const rows = Math.ceil((height * dpr) / CELL_SIZE)

  const textItems = useMemo(
    () => getLayout(isMobile, cols, rows),
    [isMobile, cols, rows],
  )

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

  console.log({ bgOpacity })

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

      {/* Large decorative shapes that scroll past */}
      <ShapeScene scrollY={scrollYState}>
        <ScrollingIsoShape
          shapeId='mariposa'
          name='mariposa-main'
          scrollY={scrollYState}
          y={height * 0.6}
          x={500}
          enableControls={true}
          config={{ scale: 0.9, rotationX: 25, rotationY: -25, rotationZ: -2 }}
        />

        <ScrollingIsoShape
          shapeId='horned-circles'
          name='horned-circles-main'
          scrollY={scrollYState}
          y={height * 1.8}
          x={-400}
          z={-1}
          enableControls={true}
          config={{ scale: 1.4, rotationX: 20, rotationY: 40 }}
        />

        <ScrollingIsoShape
          shapeId='starflower-pendant'
          name='starflower-pendant-main'
          scrollY={scrollYState}
          y={height * 3.0} // Appears at 400vh
          x={600}
          enableControls={true}
          config={{ scale: 1.6, rotationX: 35, rotationY: -30 }}
        />

        <ScrollingIsoShape
          shapeId='mariposa'
          name='mariposa-big'
          scrollY={scrollYState}
          y={height * 6}
          x={-200}
          enableControls={true}
          config={{ scale: 3, rotationX: 35, rotationY: 45 }}
        />

        <ScrollingIsoShape
          shapeId='horned-circles'
          name='horned-circles-big'
          scrollY={scrollYState}
          y={height * 7.5}
          x={400}
          enableControls={true}
          config={{ scale: 2.8, rotationX: 20, rotationY: -35 }}
        />

        <ScrollingIsoShape
          shapeId='starflower-pendant'
          name='starflower-pendant-big'
          scrollY={scrollYState}
          y={height * 8.8}
          x={-300}
          enableControls={true}
          config={{ scale: 3.2, rotationX: 40, rotationY: 25 }}
        />

        <ScrollingIsoShape
          shapeId='mariposa'
          name='mariposa-huge'
          scrollY={scrollYState}
          y={height * 10.9}
          x={650}
          enableControls={true}
          config={{ scale: 2.5, rotationX: -15, rotationY: 50 }}
        />

        <ScrollingIsoShape
          shapeId='horned-circles'
          name='horned-circles-huge'
          scrollY={scrollYState}
          y={height * 10.2}
          x={-950}
          enableControls={true}
          config={{ scale: 3.5, rotationX: 30, rotationY: -20 }}
        />

        <ScrollingIsoShape
          shapeId='starflower-pendant'
          name='starflower-pendant-huge'
          scrollY={scrollYState}
          y={height * 10.6}
          x={500}
          enableControls={true}
          config={{ scale: 2.2, rotationX: 25, rotationY: 40 }}
        />

        <ScrollingIsoShape
          shapeId='mariposa'
          name='mariposa-giant'
          scrollY={scrollYState}
          y={height * 11.0}
          x={-400}
          enableControls={true}
          config={{ scale: 4, rotationX: 45, rotationY: -30 }}
        />

        <ScrollingIsoShape
          shapeId='horned-circles'
          name='horned-circles-giant'
          scrollY={scrollYState}
          y={height * 11.4}
          x={300}
          enableControls={true}
          config={{ scale: 3.8, rotationX: 15, rotationY: 55 }}
        />

        <ScrollingIsoShape
          shapeId='starflower-pendant'
          name='starflower-pendant-giant'
          scrollY={scrollYState}
          y={height * 11.8}
          x={-250}
          enableControls={true}
          config={{ scale: 3.0, rotationX: 50, rotationY: -15 }}
        />
      </ShapeScene>
    </div>
  )
}

export default App
