"use client"

import { useCallback, useEffect, useRef } from "react"

// Defines a type alias for the WebGL2 Context to save typing.
type Gl = WebGL2RenderingContext

interface AsciiNoiseEffectProps {
  // ... (Props definition skipped for brevity, they match the uniforms below) ...
  className?: string
  noiseStrength?: number
  // ...
  bg?: [number, number, number]
}

// =================================================================================
// 1. THE VERTEX SHADER
// =================================================================================
// This runs once for every vertex. We are drawing a "Quad" (2 triangles) that
// covers the entire screen. We have 6 vertices total.
const vs = `#version 300 es
// 'layout(location=0)' matches the buffer attribute 0 we enable in the JS code.
// 'in vec2 aPos' is the position of the vertex in Clip Space (-1.0 to +1.0).
layout(location=0) in vec2 aPos;

// 'out' variables are passed to the Fragment shader.
// The GPU interpolates these values for every pixel between vertices.
out vec2 vUV;

void main(){
  // Transform Clip Space (-1 to 1) to UV Space (0 to 1).
  // e.g. -1 becomes 0, 0 becomes 0.5, 1 becomes 1.
  // This tells the fragment shader where it is on the texture surface.
  vUV = (aPos + 1.0) * 0.5;

  // Set the final position of the vertex. z=0.0 (flat), w=1.0 (standard).
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// =================================================================================
// 2. THE NOISE FRAGMENT SHADER (PASS 1)
// =================================================================================
// This generates the colorful, swirling plasma image.
// It creates the "source material" that the ASCII shader will later read.
const fsNoise = `#version 300 es
precision highp float; // High precision for smooth gradients.

out vec4 fragColor; // The final color of this pixel.
in vec2 vUV;        // The 0.0-1.0 coordinate of this pixel.

// Uniforms: Read-only global variables passed from React.
uniform vec2 uResolution; // Canvas width/height in pixels.
uniform float uTime;      // Time in seconds (drivers animation).
uniform float uNoiseStrength; // How much the noise distorts the coordinates.
uniform float uNoiseScale;    // The zoom level of the noise texture.
uniform float uSpeed;         // Speed multiplier for uTime.
uniform vec3 uTint;           // RGB color vector to multiply the result by.
uniform float uDistortAmp;    // Amplitude of the sine wave ripples.
uniform float uFrequency;     // Frequency of the sine wave ripples.
uniform float uZRate;         // How fast the noise evolves in the Z-dimension.
uniform float uBrightness;    // Multiplier for final color intensity.
uniform float uContrast;      // Contrast adjustment.
uniform float uSeed1;         // Random offset for sine phase.
uniform float uSeed2;         // Random offset for sine pattern.
uniform float uHue;           // Hue rotation in degrees.
uniform float uSaturation;    // Saturation multiplier.
uniform float uGamma;         // Gamma correction value.
uniform float uVignette;      // Strength of dark corners.
uniform float uVignetteSoftness; // How gradual the vignette is.
uniform float uGlyphSharpness;   // Determines how thin the light bands are.
uniform vec3 uBg;             // Background color added at the end.

#define TWOPI 6.28318530718

// ... (snoise and helper functions omitted) ...

// Helper: HSV to RGB conversion
vec3 rgb2hsv(vec3 c){ /* ... */ }
vec3 hsv2rgb(vec3 c){ /* ... */ }

void main(){
  // Calculate absolute pixel coordinates (e.g., x=960, y=540)
  vec2 fragCoord = vUV * uResolution;
  vec2 r = uResolution;

  // uv0 is a working coordinate system we will distort.
  vec2 uv0 = fragCoord / r;

  // -- STEP 1: GENERATE NOISE --
  float speed = uSpeed;
  float noiseTime = uTime * speed;

  // Get a noise value (-1 to 1) based on position and time.
  // We offset position by r*0.5 to make scaling happen from the center.
  float n = snoise(vec3(
    (fragCoord.x - r.x * 0.5) * uNoiseScale,
    (fragCoord.y - r.y * 0.5) * uNoiseScale,
    noiseTime
  ));

  // -- STEP 2: DOMAIN WARPING --
  // We don't just use the noise as color. We use it to warp the coordinate system.
  // 'fract' keeps coordinates in 0-1 range (infinite tiling).
  // We add circular motion (sin/cos) based on the noise value 'n'.
  uv0.x = fract(uv0.x) + uNoiseStrength * sin(n * TWOPI);
  uv0.y = fract(uv0.y) + uNoiseStrength * cos(n * TWOPI);

  // -- STEP 3: THE "LIGHT RINGS" LOOP --
  vec3 c;         // Will hold our R, G, B values.
  float l;        // Will hold distance from center.
  float z = uTime;
  vec2 p = uv0;   // Start with our warped coordinates.

  // Run 3 times (once for Red, Green, Blue) to create chromatic aberration.
  // The 'z' (time) increments slightly differently for each channel in the loop logic (z+=uZRate).
  for(int i=0; i<3; i++){
    vec2 uv = p;
    vec2 q = p;

    // Center the coordinate system so (0,0) is in the middle of the screen
    q -= 0.5;

    // Aspect Ratio Correction:
    // If we didn't do this, our circular ripples would look like ovals on wide screens.
    q.x *= r.x / r.y;

    // Increment Z so Red, Green, and Blue are slightly out of sync (trippy effect)
    z += uZRate;

    // Calculate distance from center
    l = length(q);

    // THE RIPPLE EQUATION:
    // This is the core visual pattern.
    // uv += direction(q/l) * oscillation * amplitude * pattern
    uv += q/l * (sin(z + uSeed1) + 1.0) * uDistortAmp * abs(sin(l * uFrequency - z - z + uSeed2));

    // GLOW CALCULATION:
    // length(mod(uv,1.0)-0.5) creates a grid of points that approaches 0.0 at the center of cells.
    // dividing sharpness by this distance creates a bright spike (glow) where distance is near 0.
    c[i] = uGlyphSharpness / length(mod(uv, 1.0) - 0.5);
  }

  // -- STEP 4: COLOR GRADING --
  // Normalize by distance 'l' so center is brighter.
  vec3 col = c / l;

  // Apply Contrast
  col = (col - 0.5) * uContrast + 0.5;

  // Apply Brightness and Tint
  col *= uBrightness;
  col *= uTint;

  // Hue Shift / Saturation / Gamma (Standard color processing)
  vec3 hsv = rgb2hsv(max(col, 0.0));
  hsv.x = fract(hsv.x + (uHue/360.0));      // Rotate Hue
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 2.0); // Adjust Saturation
  col = hsv2rgb(hsv);
  col = pow(max(col, 0.0), vec3(uGamma));   // Gamma correction

  // -- STEP 5: VIGNETTE --
  // Darken the edges.
  vec2 uvn = vUV - 0.5;
  uvn.x *= uResolution.x / uResolution.y; // Aspect correct distance
  float vr = length(uvn);
  // smoothstep creates a smooth gradient between 0.0 and softness
  float vig = pow(1.0 - smoothstep(0.0, uVignetteSoftness, vr), 1.0);
  col *= mix(1.0, vig, clamp(uVignette, 0.0, 1.0));

  // Add Background and output
  col = clamp(uBg + col, 0.0, 1.0);
  fragColor = vec4(col, 1.0);
}
`

// =================================================================================
// 3. THE ASCII FRAGMENT SHADER (PASS 2)
// =================================================================================
// This takes the output of Pass 1 (uTexture) and converts it to characters.
const fsAscii = `#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUV;

uniform vec2 uResolution;       // Screen size.
uniform sampler2D uTexture;     // The texture generated by fsNoise.
uniform vec2 uSourceResolution; // The resolution the noise was rendered at.
uniform float uCell;            // Size of ASCII cell in pixels (e.g., 20px).
uniform int uBW;                // Boolean flag: Black&White vs Color.
uniform int uCharset;           // Integer flag: Which set of chars to use.
uniform float uBrightness;      // Post-ascii brightness.
uniform float uContrast;        // Post-ascii contrast.
uniform float uTint;            // (Unused in main logic, seemingly legacy).
uniform float uTime;            // Time.
uniform float uDistortAmp;      // Jitter amount.
uniform float uFrequency;       // Jitter frequency.
uniform float uZRate;           // Jitter speed.
uniform float uSeed1;           // Jitter seed 1.
uniform float uSeed2;           // Jitter seed 2.

// Standard helper to get luminance from RGB.
float gray(vec3 c){return dot(c, vec3(0.3,0.59,0.11));}

// ... (pickChar functions omitted) ...

// THE BITWISE CHARACTER DRAWING FUNCTION
// n = Integer representing the character bitmap (25 bits for 5x5 grid).
// p = Current pixel position within the cell (-1 to 1).
float character(int n, vec2 p){
  // Map p from [-1, 1] to the integer grid coordinate [0, 5].
  // floor(... + 2.5) centers the grid.
  p = floor(p * vec2(-4.0, 4.0) + 2.5);

  // Check if we are inside the 5x5 grid boundaries
  if (clamp(p.x, 0.0, 4.0) == p.x){
    if (clamp(p.y, 0.0, 4.0) == p.y){
      // Calculate bit index (0 to 24)
      int a = int(round(p.x) + 5.0 * round(p.y));
      // Shift 'n' by 'a' bits and check if the last bit is 1.
      if (((n >> a) & 1) == 1) return 1.0;
    }
  }
  return 0.0;
}

void main(){
  vec2 fragCoord = vUV * uResolution;
  vec2 cellSize = vec2(uCell);

  // SNAP TO GRID:
  // 'block' becomes the coordinate of the top-left corner of the current cell.
  // e.g., if uCell is 10, pixels 0-9 all get block=0.
  vec2 block = floor(fragCoord / cellSize) * cellSize;

  // -- STEP 1: READ SOURCE TEXTURE --
  // We need to sample the noise texture.
  // We handle Aspect Ratio Scaling (Fit/Fill logic) here.

  vec2 src = uSourceResolution;
  float srcAspect = src.x / src.y;
  float dstAspect = uResolution.x / uResolution.y;

  // We want to sample the center of the block.
  vec2 uvBlock = (block + 0.5) / uResolution;
  vec2 uvSource;

  // This if/else logic behaves like CSS "object-fit: cover"
  // It crops the texture so it doesn't stretch.
  if (srcAspect > dstAspect) {
    float scale = dstAspect / srcAspect;
    uvSource = vec2(uvBlock.x * scale + (1.0 - scale) * 0.5, uvBlock.y);
  } else {
    float scale = srcAspect / dstAspect;
    uvSource = vec2(uvBlock.x, uvBlock.y * scale + (1.0 - scale) * 0.5);
  }

  // -- STEP 2: JITTER (Distortion) --
  // We add a tiny bit of movement to the texture lookup coordinate 'uvSource'.
  // This makes the ASCII characters appear to "dance" slightly.
  vec2 dispP = uvSource - 0.5;
  float l = length(dispP) + 1e-5; // +1e-5 prevents divide by zero
  vec2 uvJitter = uvSource + (dispP / l) * (sin(uTime + uSeed1) + 1.0) * uDistortAmp * abs(sin(l * uFrequency - uTime - uTime + uSeed2)) * 0.002;

  // Sample the color from the noise texture
  vec3 col = texture(uTexture, clamp(uvJitter, 0.0, 1.0)).rgb;

  // Adjust brightness/contrast of the sampled color
  col = (col - 0.5) * uContrast + 0.5;
  col *= uBrightness;

  // -- STEP 3: PICK CHARACTER --
  float g = gray(col);
  int n = pickCharSet(g, uCharset); // Returns the bitmap integer

  // Calculate relative position 'p' inside the specific cell (-1 to 1)
  // This allows the 'character' function to draw the shape.
  vec2 p = mod(fragCoord / (uCell * 0.5), 2.0) - vec2(1.0);

  // -- STEP 4: COMPOSITE --
  // If BW mode: just output white char on black bg.
  // Else: Multiply the character shape (0 or 1) by the original color.
  vec3 outCol = (uBW == 1) ? vec3(character(n, p)) : col * character(n, p);

  fragColor = vec4(outCol, 1.0);
}
`

// ... (makeShader, makeProgram, quad functions omitted) ...

export const AsciiNoiseEffect = ({
  // ... props omitted ...
}: AsciiNoiseEffectProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Stores WebGL objects. Using a Ref instead of State because we don't
  // want to trigger React re-renders when these update (which they won't, but still).
  const resRef = useRef<{
    gl: Gl
    vao: WebGLVertexArrayObject
    vbo: WebGLBuffer
    progNoise: WebGLProgram // The compiled shader program for Pass 1
    progAscii: WebGLProgram // The compiled shader program for Pass 2
    uNoise: Record<string, WebGLUniformLocation> // Pointers to variables in shader 1
    uAscii: Record<string, WebGLUniformLocation> // Pointers to variables in shader 2
    texScene: WebGLTexture // The texture we render Pass 1 into
    fbScene: WebGLFramebuffer // The framebuffer object holding texScene
  } | null>(null)

  const rafRef = useRef<number | null>(null) // Handle for requestAnimationFrame
  const startRef = useRef<number>(0) // Time when animation started

  // Initialize WebGL context (runs once on mount)
  const init = useCallback((gl: Gl, w: number, h: number) => {
    // Compile shaders and create quad (boilerplate)
    const progNoise = makeProgram(gl, vs, fsNoise)
    const progAscii = makeProgram(gl, vs, fsAscii)
    const { vao, vbo } = quad(gl)

    // Get memory addresses (locations) for all the shader variables (uniforms)
    const uNoise = {
      uResolution: gl.getUniformLocation(progNoise, "uResolution")!,
      // ... others ...
    } as const
    const uAscii = {
      // ... others ...
    } as const

    // Create the Off-Screen Texture (Pass 1 Output)
    const texScene = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texScene)
    // GL_LINEAR means it blurs slightly if scaled (smooths noise)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )

    // Create Framebuffer and attach the texture to it
    const fbScene = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texScene,
      0,
    )

    // Cleanup bindings
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)

    return {
      gl,
      vao,
      vbo,
      progNoise,
      progAscii,
      uNoise,
      uAscii,
      texScene,
      fbScene,
    }
  }, [])

  // The Render Loop (Runs ~60fps)
  const render = useCallback(
    (tMs: number) => {
      const res = resRef.current
      const canvas = canvasRef.current
      if (!res || !canvas) return

      const {
        gl,
        vao,
        progNoise,
        progAscii,
        uNoise,
        uAscii,
        texScene,
        fbScene,
      } = res

      // Calculate normalized time
      if (startRef.current === 0) startRef.current = tMs
      const t = (tMs - startRef.current) / 1000
      const w = canvas.width
      const h = canvas.height

      // --- PASS 1: RENDER NOISE TO FRAMEBUFFER ---

      // Bind our hidden framebuffer. Drawing now happens to 'texScene', not the screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene)
      gl.viewport(0, 0, w, h)
      gl.useProgram(progNoise)
      gl.bindVertexArray(vao)

      // Upload current JS values to Shader Uniforms
      gl.uniform2f(uNoise.uResolution, w, h)
      gl.uniform1f(uNoise.uTime, t)
      // ... (uploading all noise props) ...

      // Draw the 6 vertices (2 triangles)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // --- PASS 2: RENDER ASCII TO SCREEN ---

      // Unbind framebuffer. Drawing now happens to the visible Canvas.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.useProgram(progAscii)
      gl.bindVertexArray(vao)

      // Bind the texture we just drew into (texScene) to Texture Slot 0
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texScene)

      // Tell shader that 'uTexture' is found in Slot 0
      gl.uniform1i(uAscii.uTexture, 0)

      // Upload ASCII specific props
      gl.uniform2f(uAscii.uSourceResolution, w, h)
      gl.uniform2f(uAscii.uResolution, w, h)
      gl.uniform1f(uAscii.uCell, cell) // Determines grid size
      // ... (uploading rest of props) ...

      // Draw the 6 vertices again, but with the ASCII shader active
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Schedule next frame
      rafRef.current = window.requestAnimationFrame(render)
    },
    // Dependency array ensures render function updates if props change
    [
      /* ...dependencies... */
    ],
  )

  // Setup Effect (Mount/Unmount)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false })
    if (!gl) return

    // Handle High-DPI screens (Retina)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(canvas.clientWidth * dpr)
    canvas.height = Math.floor(canvas.clientHeight * dpr)

    resRef.current = init(gl, canvas.width, canvas.height)
    rafRef.current = window.requestAnimationFrame(render)

    const onResize = () => {
      // ... Resize logic: updates canvas dimensions and resizes internal texture ...
    }

    window.addEventListener("resize", onResize)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", onResize)
    }
  }, [init, render])

  return (
    <div className={"relative h-dvh w-full bg-black " + (className ?? "")}>
      <canvas ref={canvasRef} className='w-full h-full block' />
    </div>
  )
}
