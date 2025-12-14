import React, { useMemo, useRef, useState, useEffect } from "react"
import {
  Canvas,
  useFrame,
  useThree,
  createPortal,
  extend,
  ReactThreeFiber,
} from "@react-three/fiber"
import {
  useFBO,
  shaderMaterial,
  OrthographicCamera,
  OrbitControls,
} from "@react-three/drei"
import { useControls } from "leva"
import * as THREE from "three"
import { IsoShapeGeometry } from "./IsoShape/index"
import { GLSL_NOISE, GLSL_COLOR_UTILS, GLSL_PICKERS } from "../lib/shaders"
import {
  PICKER_TEXT_GLSL,
  computeTextLayer,
  stringToBitmasks,
} from "../lib/char-pickers"
import type { TextItem } from "../lib/char-pickers"

// Define the shader material
const AsciiFluidMaterial = shaderMaterial(
  {
    uTime: 0,
    uResolution: new THREE.Vector2(0, 0),
    uShapeTexture: null,
    uShapeDepth: null,
    uNoiseStrength: 0.42,
    uNoiseScale: 0.0006,
    uSpeed: 0.2,
    uTintColor: new THREE.Vector3(0.788, 1, 1),
    uBgColor: new THREE.Vector3(0.096, 0.064, 0.069),
    uCharSetId: 3,
    uCellSize: 24,
    uIsBlackAndWhite: 0,
    uSeedA: 8.35,
    uSeedB: 4.85,
    uDistortionAmplitude: 0.6,
    uFrequency: 16.4,

    // New / Updated
    uZAxisEvolutionRate: 0.0,
    uFluidMultiplier: 1.0,
    uShapeMultiplier: 1.0,
    uDepthStart: 0.0,
    uDepthEnd: 0.5,
    uGlyphSharpness: 0.04,

    // Text / Char Picker Uniforms
    uTextMap: null,
    uBgOpacity: 0.4,
    uFgOpacity: 1.0,
    uTextValues: new Int32Array(128),
    uTextLength: 0,
    uTextOffset: new THREE.Vector2(0, 0),
    uLineOffsetIncrease: 5,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform sampler2D uShapeTexture;
    uniform sampler2D uShapeDepth;
    uniform float uNoiseStrength;
    uniform float uNoiseScale;
    uniform float uSpeed;
    uniform vec3 uTintColor;
    uniform vec3 uBgColor;
    uniform float uCellSize;
    uniform int uIsBlackAndWhite;
    uniform int uCharSetId;
    uniform float uSeedA;
    uniform float uSeedB;
    uniform float uDistortionAmplitude;
    uniform float uFrequency;

    uniform float uZAxisEvolutionRate;
    uniform float uFluidMultiplier;
    uniform float uShapeMultiplier;
    uniform float uDepthStart;
    uniform float uDepthEnd;
    uniform float uGlyphSharpness;

    // Text Uniforms
    uniform highp usampler2D uTextMap;
    uniform float uBgOpacity;
    uniform float uFgOpacity;

    varying vec2 vUv;

    ${GLSL_NOISE}
    ${GLSL_COLOR_UTILS}
    ${GLSL_PICKERS}
    ${PICKER_TEXT_GLSL}

    void main() {
      vec2 pixelCoords = vUv * uResolution;
      vec2 cellSizeVec = vec2(uCellSize);
      vec2 gridBlock = floor(pixelCoords / cellSizeVec) * cellSizeVec;
      vec2 blockUvCenter = (gridBlock + 0.5) / uResolution;

      float timeScaled = uTime * uSpeed;

      // Noise Displacement
      vec2 noiseCoords = pixelCoords;
      float noiseValue = snoise(vec3(
        (noiseCoords.x - uResolution.x * 0.5) * uNoiseScale,
        (noiseCoords.y - uResolution.y * 0.5) * uNoiseScale,
        timeScaled
      ));

      vec2 distortedUv = blockUvCenter;
      // Consistent with ascii.tsx which adds to normalized uv
      distortedUv.x += uNoiseStrength * sin(noiseValue * TWOPI);
      distortedUv.y += uNoiseStrength * cos(noiseValue * TWOPI);

      // Fluid Loop
      vec3 colorAccumulator = vec3(0.0);
      float distanceFromCenter = 0.0;
      float zCoordinate = uTime;
      vec2 uvCurrent = distortedUv;

      for(int i=0; i<3; i++){
        vec2 uvLoop = uvCurrent;
        vec2 uvCentered = uvCurrent - 0.5;
        uvCentered.x *= uResolution.x / uResolution.y;

        zCoordinate += uZAxisEvolutionRate;
        distanceFromCenter = length(uvCentered);

        uvLoop += uvCentered/distanceFromCenter * (sin(zCoordinate+uSeedA)+1.0) * uDistortionAmplitude * abs(sin(distanceFromCenter*uFrequency - zCoordinate - zCoordinate + uSeedB));

        colorAccumulator[i] = uGlyphSharpness / length(mod(uvLoop, 1.0) - 0.5);
      }

      vec3 finalColor = colorAccumulator / distanceFromCenter;
      float fluidIntensity = gray(finalColor);
      fluidIntensity = clamp(fluidIntensity * uFluidMultiplier, 0.0, 1.0);

      // Shape
      vec4 shapeColor = texture2D(uShapeTexture, distortedUv);
      float shapeLuma = gray(shapeColor.rgb);

      // Depth
      float depthVal = texture2D(uShapeDepth, distortedUv).r;
      
      // Depth Mapping: 
      // depthVal is 0.0 (Near) to 1.0 (Far).
      // We want items closer than uDepthStart to be max intensity (1.0).
      // Items further than uDepthEnd to be min intensity (0.0).
      // smoothstep(edge0, edge1, x) returns 0 if x < edge0, 1 if x > edge1.
      // We want inverted behavior (Near = High Intensity).
      
      float depthFactor = 1.0 - smoothstep(uDepthStart, uDepthEnd, depthVal);
      
      float shapeIntensity = shapeLuma * shapeColor.a * depthFactor * uShapeMultiplier;

      float finalValue = fluidIntensity + shapeIntensity;
      finalValue = clamp(finalValue, 0.0, 1.0);

      // Text Map (Layout)
      uvec2 textData = texture(uTextMap, blockUvCenter).xy;
      uint mask = textData.r;
      float textOpacity = float(textData.g) / 255.0;

      vec4 outputColor = vec4(0.0);

      if (textOpacity > 0.0) {
        // Render Static Text
        int charMapValue = int(mask);
        vec2 charPixelUv = mod(pixelCoords / (uCellSize * 0.5), 2.0) - vec2(1.0);
        float charVal = character(charMapValue, charPixelUv);

        vec3 textColor = uTintColor * charVal;
        outputColor = vec4(textColor * uFgOpacity * textOpacity, 1.0);
      } else {
        // Render Fluid / Background
        int charMapValue;
        if (uCharSetId == 3) {
           charMapValue = pickCharText(pixelCoords, finalValue, uCellSize);
        } else {
           charMapValue = pickCharSet(finalValue, uCharSetId, pixelCoords);
        }

        vec2 charPixelUv = mod(pixelCoords / (uCellSize * 0.5), 2.0) - vec2(1.0);
        float charVal = character(charMapValue, charPixelUv);

        vec3 fluidColor = (uIsBlackAndWhite==1) ? vec3(charVal) : (uTintColor * finalValue * charVal);

        // Tint with shape if shape is strong
        if (shapeColor.a > 0.0) {
            float shapeRatio = shapeIntensity / (finalValue + 0.001);
            fluidColor = mix(fluidColor, shapeColor.rgb * charVal, clamp(shapeRatio, 0.0, 1.0));
        }

        outputColor = vec4(fluidColor * uBgOpacity, 1.0);
      }

      // Background color mix
      outputColor.rgb = mix(uBgColor, outputColor.rgb, outputColor.a);
      outputColor.a = 1.0;

      gl_FragColor = outputColor;
    }
  `,
)

extend({ AsciiFluidMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      asciiFluidMaterial: ReactThreeFiber.Object3DNode<
        THREE.ShaderMaterial,
        typeof AsciiFluidMaterial
      >
    }
  }
}

const AsciiScene = ({
  textItems,
  scrollY,
}: {
  textItems: TextItem[]
  scrollY: number
}) => {
  const { size, gl } = useThree()

  // Controls
  const {
    viewMode,
    noiseStrength,
    fluidMultiplier,
    shapeMultiplier,
    depthStart,
    depthEnd,
    glyphSharpness,
    zRate,
  } = useControls({
    viewMode: { options: ["ascii", "normal"] },
    noiseStrength: { value: 0.42, min: 0, max: 1 },
    fluidMultiplier: { value: 1.0, min: 0, max: 2 },
    shapeMultiplier: { value: 1.0, min: 0, max: 2 },
    depthStart: { value: 0.0, min: 0, max: 1 },
    depthEnd: { value: 0.5, min: 0, max: 1 },
    glyphSharpness: { value: 0.04, min: 0.01, max: 0.2 },
    zRate: { value: 0.01, min: 0, max: 0.1 },
  })

  // Shape FBO
  const shapeFbo = useFBO(size.width, size.height, {
    multisample: false,
    depthBuffer: true,
    stencilBuffer: false,
  })

  // Attach Depth Texture
  useMemo(() => {
    if (!shapeFbo.depthTexture) {
      const depthTexture = new THREE.DepthTexture(size.width, size.height)
      shapeFbo.depthTexture = depthTexture
    }
  }, [shapeFbo, size.width, size.height])

  // Shape Scene & Camera
  const shapeScene = useMemo(() => {
    const s = new THREE.Scene()
    s.background = null // Transparent background
    return s
  }, [])
  const shapeCameraRef = useRef<THREE.OrthographicCamera>(null)
  const [cameraReady, setCameraReady] = useState(false)

  // Text Map Texture
  const texTextMap = useMemo(() => {
    const t = new THREE.DataTexture(
      new Uint32Array(1 * 1 * 4), // Dummy initial
      1,
      1,
      THREE.RGIntegerFormat,
      THREE.UnsignedIntType,
    )
    t.internalFormat = "RG32UI"
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [])

  // Bitmasks for background pattern
  const textBitmasks = useMemo(() => stringToBitmasks("LIMINal.flOWERS "), [])

  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Layout & Shape Content
  const shapeItem = textItems.find((item) => item.shapeId === "mariposa")

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // 1. Render Shape
    if (shapeCameraRef.current) {
      // Update camera frustum to match viewport (pixel units)
      const cam = shapeCameraRef.current

      // Keep bounds updated with window size
      cam.left = -size.width / 2
      cam.right = size.width / 2
      cam.top = size.height / 2
      cam.bottom = -size.height / 2
      cam.updateProjectionMatrix()

      gl.setRenderTarget(shapeFbo)
      gl.clear()
      gl.render(shapeScene, shapeCameraRef.current)
      gl.setRenderTarget(null)
    }

    // 2. Update Text Texture
    // Calculate cols/rows based on current size
    const cell = 24 // Should match uniform
    const cols = Math.ceil(size.width / cell)
    const rows = Math.ceil(size.height / cell)

    if (cols !== texTextMap.image.width || rows !== texTextMap.image.height) {
      // Resize texture buffer
      texTextMap.image.width = cols
      texTextMap.image.height = rows
      // Data will be replaced
      texTextMap.dispose()
    }

    // Compute Text Layer
    const textBuffer = computeTextLayer(textItems, cols, rows, scrollY)

    // Update texture data
    texTextMap.image.data = textBuffer
    texTextMap.needsUpdate = true

    // 3. Update Material Uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time
      materialRef.current.uniforms.uResolution.value.set(
        size.width,
        size.height,
      )
      materialRef.current.uniforms.uShapeTexture.value = shapeFbo.texture
      materialRef.current.uniforms.uShapeDepth.value = shapeFbo.depthTexture

      // Text Uniforms
      materialRef.current.uniforms.uTextMap.value = texTextMap
      materialRef.current.uniforms.uTextLength.value = textBitmasks.length
      materialRef.current.uniforms.uTextValues.value = textBitmasks

      // Control Uniforms
      materialRef.current.uniforms.uNoiseStrength.value = noiseStrength
      materialRef.current.uniforms.uFluidMultiplier.value = fluidMultiplier
      materialRef.current.uniforms.uShapeMultiplier.value = shapeMultiplier
      materialRef.current.uniforms.uDepthStart.value = depthStart
      materialRef.current.uniforms.uDepthEnd.value = depthEnd
      materialRef.current.uniforms.uGlyphSharpness.value = glyphSharpness
      materialRef.current.uniforms.uZAxisEvolutionRate.value = zRate
    }
  })

  const shapeContent = createPortal(
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <group
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={20}
      >
        {/* Only render if we found the item? Or render all?
             For this step, let's force render Mariposa at center to verify visibility */}
        <IsoShapeGeometry
          shapeId='mariposa'
          fillColor='#ffffff'
          strokeColor='#ffffff'
          strokeWidth={1}
          layerThickness={1.5}
          layerGap={0.5}
        />
      </group>
    </>,
    shapeScene,
  )

  return (
    <>
      <OrthographicCamera
        ref={(cam) => {
          shapeCameraRef.current = cam
          if (cam) setCameraReady(true)
        }}
        position={[0, 0, 100]}
        zoom={1}
        near={0.1}
        far={1000}
        makeDefault={false}
      />
      {/* Attach controls to the shape camera */}
      {cameraReady && (
        <OrbitControls
          camera={shapeCameraRef.current!}
          domElement={gl.domElement}
          enableZoom={true}
          zoomSpeed={1.0}
        />
      )}

      {shapeContent}

      {/* Fullscreen Quad */}
      <mesh>
        <planeGeometry args={[size.width, size.height]} />
        {viewMode === "normal" ? (
          <meshBasicMaterial map={shapeFbo.texture} transparent />
        ) : (
          /* @ts-ignore */
          <asciiFluidMaterial
            ref={materialRef}
            transparent
            uResolution={[size.width, size.height]}
          />
        )}
      </mesh>
    </>
  )
}


export const AsciiShapeViewer = ({
  textItems,
  scrollY,
}: {
  textItems: TextItem[]
  scrollY: number
}) => {
  return (
    <div className='w-full h-screen bg-black'>
      <Canvas orthographic camera={{ position: [0, 0, 1], zoom: 1 }}>
        <AsciiScene textItems={textItems} scrollY={scrollY} />
      </Canvas>
    </div>
  )
}
