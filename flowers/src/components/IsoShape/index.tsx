import React, { Suspense, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Center,
  OrbitControls,
  OrthographicCamera,
  Bounds,
  useBounds,
} from "@react-three/drei"
import { useControls, folder } from "leva"
import { ShapeLayer } from "./ShapeLayer"
import { SHAPES } from "../../lib/shapes"
import * as THREE from "three"

export type IsoView = "top" | "left" | "right" | "iso"

export interface IsoShapeConfig {
  layerThickness?: number
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  layerGap?: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
  scale?: number
}

interface IsoShapeProps {
  shapeId: string
  name?: string
  enableControls?: boolean
  view?: IsoView
  config?: IsoShapeConfig
}

// VIEW_ROTATIONS kept for reference but not currently used
// const VIEW_ROTATIONS: Record<IsoView, [number, number, number]> = {
//   top: [Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0],
//   left: [Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0],
//   right: [Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0],
//   iso: [Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0],
// }

// Animation component to fit bounds and animate entry
const ShapeContent: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const groupRef = useRef<THREE.Group>(null)
  const bounds = useBounds()
  const [animated, setAnimated] = useState(false)

  // Initial Fit
  useFrame(() => {
    if (!animated) {
      bounds.refresh(groupRef.current!).clip().fit()
      setAnimated(true)
    }
  })

  return <group ref={groupRef}>{children}</group>
}

// Wrapper to handle the scaling animation independent of Bounds calculation
const AnimatedWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ref = useRef<THREE.Group>(null)
  const progress = useRef(0)

  useFrame((_, delta) => {
    if (ref.current && progress.current < 1) {
      progress.current += delta * 2 // Speed
      if (progress.current > 1) progress.current = 1

      // Elastic/Overshoot ease or simple ease-out
      const t = progress.current
      const ease = 1 - Math.pow(1 - t, 3) // Cubic ease out

      ref.current.scale.setScalar(ease)
    }
  })

  return (
    <group ref={ref} scale={0}>
      {children}
    </group>
  )
}

export const IsoShapeGeometry: React.FC<{
  shapeId: string
  fillColor: string
  strokeColor: string
  strokeWidth: number
  layerThickness: number
  layerGap: number
}> = ({
  shapeId,
  fillColor,
  strokeColor,
  strokeWidth,
  layerThickness,
  layerGap,
}) => {
  const shapeConfig = SHAPES[shapeId]
  if (!shapeConfig) return null

  return (
    <>
      {shapeConfig.layers.map((layer, index) => (
        <ShapeLayer
          key={layer.id}
          svgUrl={layer.svgPath}
          color={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          thickness={layerThickness}
          zOffset={-index * (layerThickness + layerGap)}
        />
      ))}
    </>
  )
}

// Default isometric rotation in degrees
const ISO_ROTATION_X_DEG = Math.atan(1 / Math.sqrt(2)) * (180 / Math.PI) // ~35.26
const ISO_ROTATION_Y_DEG = 45

const IsoShapeScene: React.FC<{
  shapeId: string
  name: string
  enableControls: boolean
  config?: IsoShapeConfig
}> = ({ shapeId, name, enableControls, config }) => {
  const shapeConfig = SHAPES[shapeId]

  if (!shapeConfig) {
    return (
      <group>
        <text>Shape not found</text>
      </group>
    )
  }

  // Leva Controls - always use controls, values come from config or defaults
  const controls = useControls(
    name,
    {
      Transform: folder({
        scale: { value: config?.scale ?? 1, min: 0.01, step: 0.1 },
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
        rotationZ: { value: config?.rotationZ ?? 0, min: -180, max: 180, step: 1 },
      }),
      Appearance: folder({
        layerThickness: { value: config?.layerThickness ?? 1.3, min: 0.1, max: 20 },
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

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={40} />
      {enableControls && <OrbitControls enableZoom={true} makeDefault />}

      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      <Bounds fit clip observe margin={1.2}>
        <ShapeContent>
          <AnimatedWrapper>
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
          </AnimatedWrapper>
        </ShapeContent>
      </Bounds>
    </>
  )
}

export const IsoShape: React.FC<IsoShapeProps> = ({
  shapeId,
  name,
  enableControls = false,
  view: _view = "top", // kept for API compat
  config,
}) => {
  const effectiveName = name || shapeId

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas>
        <Suspense fallback={null}>
          <IsoShapeScene
            shapeId={shapeId}
            name={effectiveName}
            enableControls={enableControls}
            config={config}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
