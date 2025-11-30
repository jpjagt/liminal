import { useEffect, useState, useRef } from "react"
import { AsciiNoiseEffect } from "./ascii.tsx"
import { getContentHeight } from "./lib/char-pickers"
import type { TextItem } from "./lib/char-pickers"

const SPINE_TEXT = "lf  . ... .... . ... ...    . .      .   ".repeat(50)
const Y_GAP = 60
const Y_START = 40
const X_OFFSET = 4 // cells from center
const MAX_WIDTH = 18 // Longest title "STARFLOWER PENDANT"

const textItems: TextItem[] = [
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
    text: "MARIPOSA",
    x: { pct: 0.5, px: -X_OFFSET },
    y: Y_START,
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
    y: Y_START + 3,
    anchorX: "right",
  },
  // Item 2

  {
    text: "HORNED CIRCLES",
    x: { pct: 0.5, px: X_OFFSET },
    y: Y_START + Y_GAP,
    anchorX: "left",
    maxWidth: MAX_WIDTH,
  },
  {
    text: "ECHOES OF CIRCLES IN SPIRALS.\nLITTLE HORNS TO REMIND\nGEOMETRY OF MISCHIEF.",
    x: { pct: 0.5, px: X_OFFSET },
    y: Y_START + Y_GAP + 6,
    anchorX: "left",
  },
  // Item 3
  {
    text: "STARFLOWER PENDANT",
    x: { pct: 0.5, px: -X_OFFSET },
    y: Y_START + Y_GAP * 2,
    anchorX: "right",
    maxWidth: MAX_WIDTH,
  },
  {
    text: "A STARFLOWER IS A PERENNIAL HERB\nWITH WHITE FLOWERS THAT BLOOMS\nIN SPRING OR SUMMER IN MOIST WOODS.",
    x: { pct: 0.5, px: -X_OFFSET },
    y: Y_START + Y_GAP * 2 + 6,
    anchorX: "right",
  },
]

const SCROLL_CONFIG = {
  // Content scrolling "lag" (0.01 - 1.0). Lower = more lag/heavier.
  contentLag: 0.04,

  // Background flow settings
  baseFlowSpeed: 2.0, // Constant movement (cells/sec)

  // How much the scroll velocity contributes to the flow speed
  scrollFlowFactor: 0.2,

  // How quickly the flow velocity changes (inertia). Lower = more "slide"/smooth acceleration.
  flowAcceleration: 0.05,
}

// Cell size is hardcoded in AsciiNoiseEffect as default 26
const CELL_SIZE = 26

function App() {
  const [gridOffset, setGridOffset] = useState<[number, number]>([0, 0])

  // Refs for physics state
  const smoothScrollY = useRef(0)
  const smoothVelocity = useRef(0)
  const lastTime = useRef(0)
  const prevScrollRef = useRef(0)
  const offsetRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const contentHeightCells = getContentHeight(textItems, 100)
  const totalHeightPx = contentHeightCells * CELL_SIZE + window.innerHeight

  useEffect(() => {
    let animId: number
    const animate = (time: number) => {
      if (lastTime.current === 0) {
        lastTime.current = time
        // Initialize physics state to avoid jump
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

      // 1. Smooth Scroll (Content)
      // Standard lerp: current + (target - current) * factor
      const targetScroll = window.scrollY
      // Adjust factor for dt (approximate frame independence)
      const lagFactor = SCROLL_CONFIG.contentLag * (dt * 60)
      smoothScrollY.current +=
        (targetScroll - smoothScrollY.current) * Math.min(lagFactor, 1)

      // 2. Background Flow Physics
      // Calculate raw scroll velocity (px/sec)
      const rawVelocity = Math.abs(targetScroll - prevScrollRef.current) / dt
      prevScrollRef.current = targetScroll

      // Target flow speed: Base speed + scroll influence
      const targetFlowSpeed =
        SCROLL_CONFIG.baseFlowSpeed +
        rawVelocity * SCROLL_CONFIG.scrollFlowFactor

      // Smooth the flow speed (acceleration/inertia)
      const accelFactor = SCROLL_CONFIG.flowAcceleration * (dt * 60)
      smoothVelocity.current +=
        (targetFlowSpeed - smoothVelocity.current) * Math.min(accelFactor, 1)

      // Integrate position
      offsetRef.current += smoothVelocity.current * dt

      setGridOffset([0, offsetRef.current])

      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div style={{ height: totalHeightPx, width: "100vw" }} ref={containerRef}>
      <div className='fixed top-0 left-0 w-full h-full'>
        <AsciiNoiseEffect
          className='h-full w-full'
          charset={3}
          bgOpacity={0.4}
          fgOpacity={1}
          textItems={textItems}
          scrollY={smoothScrollY.current / CELL_SIZE}
          gridOffset={gridOffset}
        />
      </div>
    </div>
  )
}

export default App
