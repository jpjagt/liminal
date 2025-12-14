import React, { Suspense, createContext, useContext } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrthographicCamera, Center } from "@react-three/drei"
import { useControls, folder } from "leva"
import * as THREE from "three"
import { useRef } from "react"
import { IsoShapeGeometry, type IsoShapeConfig } from "@/components/IsoShape"
import type {
  ScrollingIsoShapeProps,
  ShapeSceneProps,
} from "@/types/shape-scene"

// Context to pass scroll position into the Three.js scene
const ScrollContext = createContext<{ scrollY: number }>({ scrollY: 0 })

// Default isometric rotation in degrees
const ISO_ROTATION_X_DEG = Math.atan(1 / Math.sqrt(2)) * (180 / Math.PI) // ~35.26
const ISO_ROTATION_Y_DEG = 45

// A single scrolling shape that positions itself based on scroll
const ScrollingShape: React.FC<{
  shapeId: string
  name: string
  targetY: number // scroll position where shape centers in view (px)
  x: number // horizontal offset in world units
  z: number // z-index for layering
  enableControls: boolean
  config?: IsoShapeConfig
}> = ({ shapeId, name, targetY, x, z, enableControls, config }) => {
  const groupRef = useRef<THREE.Group>(null)
  const { scrollY } = useContext(ScrollContext)
  const { viewport } = useThree()

  // Leva controls for this shape
  const controls = useControls(
    name,
    {
      Transform: folder({
        scale: { value: config?.scale ?? 3, min: 0.1, max: 20, step: 0.1 },
        rotationX: {
          value: config?.rotationX ?? ISO_ROTATION_X_DEG,
          min: -180,
          max: 180,
          step: 1,
        },
        rotationY: {
          value: config?.rotationY ?? ISO_ROTATION_Y_DEG,
          min: -180,
          max: 180,
          step: 1,
        },
        rotationZ: {
          value: config?.rotationZ ?? 0,
          min: -180,
          max: 180,
          step: 1,
        },
      }),
      Appearance: folder({
        layerThickness: {
          value: config?.layerThickness ?? 0.5,
          min: 0.1,
          max: 20,
        },
        layerGap: { value: config?.layerGap ?? 0, min: 0, max: 20 },
        fillColor: { value: config?.fillColor ?? "#000000" },
        strokeColor: { value: config?.strokeColor ?? "#ffffff" },
        strokeWidth: { value: config?.strokeWidth ?? 1, min: 0, max: 5 },
      }),
      _copyConfig: {
        value: false,
        label: "Copy Config",
        onChange: (v: boolean) => {
          if (v) {
            const currentConfig: IsoShapeConfig = {
              scale: controls.scale,
              rotationX: controls.rotationX,
              rotationY: controls.rotationY,
              rotationZ: controls.rotationZ,
              layerThickness: controls.layerThickness,
              layerGap: controls.layerGap,
              fillColor: controls.fillColor,
              strokeColor: controls.strokeColor,
              strokeWidth: controls.strokeWidth,
            }
            const configStr = JSON.stringify(currentConfig, null, 2)
            navigator.clipboard.writeText(`config={${configStr}}`)
            console.log(`[${name}] Config copied:\nconfig={${configStr}}`)
          }
        },
      },
    },
    { collapsed: true, render: () => enableControls },
  )

  // Convert degrees to radians
  const rotX = (controls.rotationX * Math.PI) / 180
  const rotY = (controls.rotationY * Math.PI) / 180
  const rotZ = (controls.rotationZ * Math.PI) / 180

  // Calculate Y position in world units based on scroll
  // When scrollY === targetY, shape should be centered vertically (y = 0)
  // Scroll goes from top to bottom, so higher scrollY means content moves up
  const viewportHeightPx =
    typeof window !== "undefined" ? window.innerHeight : 800

  // Convert pixel-based scroll position to world units
  // Shape's Y position in world = (targetY - scrollY) mapped to viewport
  const scrollDelta = targetY - scrollY
  // Map pixel offset to world units (viewport.height is world height)
  const worldY = -(scrollDelta / viewportHeightPx) * viewport.height

  // Map x from pixels to world units as well
  const worldX = (x / viewportHeightPx) * viewport.height

  return (
    <group ref={groupRef} position={[worldX, worldY, z]}>
      <Center>
        <group rotation={[rotX, rotY, rotZ]} scale={controls.scale}>
          <IsoShapeGeometry
            shapeId={shapeId}
            fillColor={controls.fillColor}
            strokeColor={controls.strokeColor}
            strokeWidth={controls.strokeWidth}
            layerThickness={controls.layerThickness}
            layerGap={controls.layerGap}
          />
        </group>
      </Center>
    </group>
  )
}

// Public component for declaring a scrolling shape
export const ScrollingIsoShape: React.FC<ScrollingIsoShapeProps> = ({
  shapeId,
  name,
  scrollY: _scrollY, // Ignored here, we use context
  y,
  x = 0,
  z = 0,
  enableControls = false,
  config,
}) => {
  return (
    <ScrollingShape
      shapeId={shapeId}
      name={name}
      targetY={y}
      x={x}
      z={z}
      enableControls={enableControls}
      config={config}
    />
  )
}

// Inner scene component that renders all scrolling shapes
const ShapeSceneInner: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={40} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      <Suspense fallback={null}>{children}</Suspense>
    </>
  )
}

// Main ShapeScene component with a single fixed Canvas
export const ShapeScene: React.FC<ShapeSceneProps> = ({
  scrollY,
  children,
}) => {
  return (
    <ScrollContext.Provider value={{ scrollY }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 10, // Above ASCII but below UI elements
        }}
      >
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
        >
          <ShapeSceneInner>{children}</ShapeSceneInner>
        </Canvas>
      </div>
    </ScrollContext.Provider>
  )
}

export default ShapeScene
