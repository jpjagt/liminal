import { useEffect, useState, useRef, useMemo } from "react"
import { AsciiNoiseEffect } from "./ascii.tsx"
import { getContentHeight, getGridPosition } from "./lib/char-pickers"
import type { TextItem } from "./lib/char-pickers"
import { IsoShape } from "./components/IsoShape"
import type { IsoView } from "./components/IsoShape" // Import IsoShape

const SPINE_TEXT = "lf  . ... .... . ... ...    . .      .   ".repeat(50)
const Y_GAP = 60
const Y_START = 40
const X_OFFSET = 4 // cells from center
const MAX_WIDTH = 18 // Longest title "STARFLOWER PENDANT"

// Card dimensions
const CARD_WIDTH = 15
const CARD_HEIGHT = 12 // 5:4 ratio -> 15:12

const ShapeCard = ({ shapeId, view }: { shapeId: string, view?: IsoView }) => (
  <div className='w-full h-full bg-black border border-white flex items-center justify-center p-2 overflow-hidden pointer-events-auto'>
    <IsoShape shapeId={shapeId} view={view || 'iso'} enableControls={false} />
  </div>
)

const getLayout = (isMobile: boolean, cols: number): TextItem[] => {
  if (isMobile) {
    // Mobile Layout
    const contentMaxWidth = Math.max(1, Math.min(18, cols - 6))

    return [
      // Left Spine
      {
        text: SPINE_TEXT,
        x: { px: 1 },
        y: 0,
        anchorX: "left",
        maxWidth: 1,
        opacity: 0.5,
        renderSpaces: false,
      },
      // Right Spine
      {
        text: SPINE_TEXT,
        x: { pct: 1, px: -2 }, 
        y: 0,
        anchorX: "left", 
        maxWidth: 1,
        opacity: 0.5,
        renderSpaces: false,
      },
      // Item 1
      {
        component: <ShapeCard shapeId='mariposa' view='iso' />,
        x: { pct: 0.5 },
        y: Y_START,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        anchorX: "center",
      },
      {
        text: "MARIPOSA",
        x: { pct: 0.5 },
        y: Y_START + CARD_HEIGHT + 2,
        anchorX: "center",
        maxWidth: contentMaxWidth,
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
        x: { pct: 0.5 },
        y: Y_START + CARD_HEIGHT + 7,
        anchorX: "center",
        maxWidth: contentMaxWidth,
        renderSpaces: false,
      },
      // Item 2
      {
        component: <ShapeCard shapeId='horned-circles' view='iso' />,
        x: { pct: 0.5 },
        y: Y_START + Y_GAP + CARD_HEIGHT,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        anchorX: "center",
      },
      {
        text: "HORNED CIRCLES",
        x: { pct: 0.5 },
        y: Y_START + Y_GAP + CARD_HEIGHT * 2 + 2,
        anchorX: "center",
        maxWidth: contentMaxWidth,
      },
      {
        text: "ECHOES OF CIRCLES IN SPIRALS.\nLITTLE HORNS TO REMIND\nGEOMETRY OF MISCHIEF.",
        x: { pct: 0.5 },
        y: Y_START + Y_GAP + CARD_HEIGHT * 2 + 8,
        anchorX: "center",
        maxWidth: contentMaxWidth,
      },
      // Item 3
      {
        component: <ShapeCard shapeId='starflower-pendant' view='iso' />,
        x: { pct: 0.5 },
        y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 2,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        anchorX: "center",
      },
      {
        text: "STARFLOWER PENDANT",
        x: { pct: 0.5 },
        y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 3 + 2,
        anchorX: "center",
        maxWidth: contentMaxWidth,
      },
      {
        text: "A STARFLOWER IS A PERENNIAL HERB\nWITH WHITE FLOWERS THAT BLOOMS\nIN SPRING OR SUMMER IN MOIST WOODS.",
        x: { pct: 0.5 },
        y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 3 + 8,
        anchorX: "center",
        maxWidth: contentMaxWidth,
      },
    ]
  }

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
    // Item 1
    {
      component: <ShapeCard shapeId='mariposa' view='iso' />,
      x: { pct: 0.5, px: -X_OFFSET },
      y: Y_START,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      anchorX: "right",
    },
    {
      text: "MARIPOSA",
      x: { pct: 0.5, px: -X_OFFSET },
      y: Y_START + CARD_HEIGHT + 2,
      anchorX: "right",
      maxWidth: MAX_WIDTH,
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
      y: Y_START + CARD_HEIGHT + 5,
      anchorX: "right",
      renderSpaces: false,
    },
    // Item 2
    {
      component: <ShapeCard shapeId='horned-circles' view='iso' />,
      x: { pct: 0.5, px: X_OFFSET },
      y: Y_START + Y_GAP + CARD_HEIGHT,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      anchorX: "left",
    },
    {
      text: "HORNED CIRCLES",
      x: { pct: 0.5, px: X_OFFSET },
      y: Y_START + Y_GAP + CARD_HEIGHT * 2 + 2,
      anchorX: "left",
      maxWidth: MAX_WIDTH,
    },
    {
      text: "ECHOES OF CIRCLES IN SPIRALS.\nLITTLE HORNS TO REMIND\nGEOMETRY OF MISCHIEF.",
      x: { pct: 0.5, px: X_OFFSET },
      y: Y_START + Y_GAP + CARD_HEIGHT * 2 + 8,
      anchorX: "left",
    },
    // Item 3
    {
      component: <ShapeCard shapeId='starflower-pendant' view='iso' />,
      x: { pct: 0.5, px: -X_OFFSET },
      y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      anchorX: "right",
    },
    {
      text: "STARFLOWER PENDANT",
      x: { pct: 0.5, px: -X_OFFSET },
      y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 3 + 2,
      anchorX: "right",
      maxWidth: MAX_WIDTH,
    },
    {
      text: "A STARFLOWER IS A PERENNIAL HERB\nWITH WHITE FLOWERS THAT BLOOMS\nIN SPRING OR SUMMER IN MOIST WOODS.",
      x: { pct: 0.5, px: -X_OFFSET },
      y: Y_START + Y_GAP * 2 + CARD_HEIGHT * 3 + 8,
      anchorX: "right",
    },
  ]
}

const SCROLL_CONFIG = {
  contentLag: 0.04,
  baseFlowSpeed: 2.0, 
  scrollFlowFactor: 0.2,
  flowAcceleration: 0.05,
}

const CELL_SIZE = 26

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

function App() {
  const [gridOffset, setGridOffset] = useState<[number, number]>([0, 0])
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
    () => getLayout(isMobile, cols),
    [isMobile, cols],
  )

  const contentHeightCells = getContentHeight(textItems, 100)
  const cssCellSize = CELL_SIZE / dpr
  const totalHeightPx = contentHeightCells * cssCellSize + height

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
          bgOpacity={0.4}
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
    </div>
  )
}

export default App
