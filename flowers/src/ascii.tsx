"use client"

import { useCallback, useEffect, useRef, useMemo } from "react"
import {
  stringToBitmasks,
  PICKER_TEXT_GLSL,
  computeTextLayer,
} from "./lib/char-pickers"
import type { TextItem } from "./lib/char-pickers"
import { LF_WORDMARK } from "./constants"

type Gl = WebGL2RenderingContext
type RGB = [number, number, number]
type RGBInput = RGB | string

/** Parse CSS color string like 'rgb(56.9% 23.8% 17.5%)' or 'rgb(255, 128, 0)' to [0-1, 0-1, 0-1] */
const parseColor = (input: RGBInput): RGB => {
  if (Array.isArray(input)) return input
  const match = input.match(/rgb\(\s*([^\s,]+)[,\s]+([^\s,]+)[,\s]+([^\s,)]+)/)
  if (!match) return [1, 1, 1]
  const parse = (v: string) => {
    if (v.endsWith("%")) return parseFloat(v) / 100
    return parseFloat(v) / 255
  }
  return [parse(match[1]), parse(match[2]), parse(match[3])]
}

interface AsciiNoiseEffectProps {
  className?: string
  noiseStrength?: number
  noiseScale?: number
  speed?: number
  cell?: number
  bw?: boolean
  charset?: 0 | 1 | 2 | 3
  text?: string
  textOffset?: [number, number]
  lineOffsetIncrease?: number
  textItems?: TextItem[]
  bgOpacity?: number
  fgOpacity?: number
  bgTint?: RGBInput
  fgTint?: RGBInput
  scrollY?: number
  gridOffset?: [number, number]
  distortAmp?: number
  frequency?: number
  zRate?: number
  brightness?: number
  contrast?: number
  seed1?: number
  seed2?: number
  hue?: number
  sat?: number
  gamma?: number
  vignette?: number
  vignetteSoftness?: number
  glyphSharpness?: number
  bg?: RGBInput
}

const vs = `#version 300 es
layout(location=0) in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv=(aPosition+1.0)*0.5;
  gl_Position=vec4(aPosition,0.0,1.0);
}`

const fsNoise = `#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uNoiseStrength;
uniform float uNoiseScale;
uniform float uSpeed;
uniform vec3 uTintColor;
uniform float uDistortionAmplitude;
uniform float uFrequency;
uniform float uZAxisEvolutionRate;
uniform float uBrightness;
uniform float uContrast;
uniform float uSeedA;
uniform float uSeedB;
uniform float uHueAngle; // degrees
uniform vec2 uGridOffset; // Grid offset for background noise
uniform float uSaturation; // 0..2
uniform float uGammaCorrection; // 0.5..2
uniform float uVignetteStrength; // 0..1
uniform float uVignetteSoftness; // 0.1..2
uniform float uGlyphSharpness; // 0.01..0.2
uniform vec3 uBackgroundColor;

#define TWOPI 6.28318530718

vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=vec3(1.0)-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=vec4(1.0)-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

vec3 rgb2hsv(vec3 rgbColor){
  vec4 K_constants = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p_mix = mix(vec4(rgbColor.bg, K_constants.wz), vec4(rgbColor.gb, K_constants.xy), step(rgbColor.b, rgbColor.g));
  vec4 q_mix = mix(vec4(p_mix.xyw, rgbColor.r), vec4(rgbColor.r, p_mix.yzx), step(p_mix.x, rgbColor.r));
  float chroma = q_mix.x - min(q_mix.w, q_mix.y);
  float epsilon = 1.0e-10;
  return vec3(abs(q_mix.z + (q_mix.w - q_mix.y)/(6.0*chroma + epsilon)), chroma/(q_mix.x + epsilon), q_mix.x);
}
vec3 hsv2rgb(vec3 hsvColor){
  vec4 K_constants = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p_mix = abs(fract(hsvColor.xxx + K_constants.xyz) * 6.0 - K_constants.www);
  return hsvColor.z * mix(K_constants.xxx, clamp(p_mix - K_constants.xxx, 0.0, 1.0), hsvColor.y);
}

void main(){
  vec2 fragmentCoordinates=vUv*uResolution;
  vec2 canvasSize=uResolution;
  vec2 normalizedUv=fragmentCoordinates/canvasSize;
  float animationSpeed=uSpeed;
  float timeScaled=uTime*animationSpeed;
  // Offset the coordinate space for noise generation
  vec2 offsetCoords = fragmentCoordinates + uGridOffset;

  float noiseValue=snoise(vec3((offsetCoords.x - canvasSize.x*0.5)*uNoiseScale,(offsetCoords.y - canvasSize.y*0.5)*uNoiseScale,timeScaled));
  normalizedUv.x=(normalizedUv.x)+uNoiseStrength*sin(noiseValue*TWOPI);
  normalizedUv.y=(normalizedUv.y)+uNoiseStrength*cos(noiseValue*TWOPI);

  vec3 colorAccumulator; float distanceFromCenter; float zCoordinate=uTime;
  vec2 uvCurrent = normalizedUv;
  for(int i=0;i<3;i++){
    vec2 uvDistorted=uvCurrent; vec2 uvCentered=uvCurrent; uvCentered-=0.5; uvCentered.x*=canvasSize.x/canvasSize.y; zCoordinate+=uZAxisEvolutionRate; distanceFromCenter=length(uvCentered);
    uvDistorted+=uvCentered/distanceFromCenter*(sin(zCoordinate+uSeedA)+1.0)*uDistortionAmplitude*abs(sin(distanceFromCenter*uFrequency - zCoordinate - zCoordinate + uSeedB));
    colorAccumulator[i]=uGlyphSharpness/length(mod(uvDistorted,1.0)-0.5);
  }
  vec3 finalColor = colorAccumulator/distanceFromCenter;
  finalColor = (finalColor - 0.5) * uContrast + 0.5;
  finalColor *= uBrightness;
  finalColor *= uTintColor;

  vec3 hsvColor = rgb2hsv(max(finalColor, 0.0));
  hsvColor.x = fract(hsvColor.x + (uHueAngle/360.0));
  hsvColor.y = clamp(hsvColor.y * uSaturation, 0.0, 2.0);
  finalColor = hsv2rgb(hsvColor);
  finalColor = pow(max(finalColor, 0.0), vec3(uGammaCorrection));

  vec2 uvNormalizedVignette = vUv - 0.5; uvNormalizedVignette.x *= uResolution.x/uResolution.y;
  float vignetteRadius = length(uvNormalizedVignette);
  float vignetteFactor = pow(1.0 - smoothstep(0.0, uVignetteSoftness, vignetteRadius), 1.0);
  finalColor *= mix(1.0, vignetteFactor, clamp(uVignetteStrength, 0.0, 1.0));

  finalColor = clamp(uBackgroundColor + finalColor, 0.0, 1.0);
  fragColor=vec4(finalColor,1.0);
}
`
const fsAscii = `#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;

uniform vec2 uResolution;
uniform sampler2D uInputTexture;
uniform vec2 uInputResolution;
uniform float uCellSize; // cell size (px)
uniform int uIsBlackAndWhite; // 1=BW, 0=color multiply
uniform int uCharSetId; // 0=full,1=minimal,2=medium
uniform float uBrightness;
uniform float uContrast;
uniform vec3 uTintColor;
uniform float uTime;
uniform float uDistortionAmplitude;
uniform float uFrequency;
uniform float uZAxisEvolutionRate;
uniform float uSeedA;
uniform float uSeedB;
uniform mediump usampler2D uTextMap; // R=bitmask, G=opacity
uniform float uBgOpacity;
uniform float uFgOpacity;
uniform vec3 uFgTintColor;

float gray(vec3 color){return dot(color, vec3(0.3,0.59,0.11));}

int pickCharFull(float grayscaleValue){
  int charMapValue = 4096;
  if (grayscaleValue>0.9535) charMapValue=33061407; else if (grayscaleValue>0.9302) charMapValue=32045630; else if (grayscaleValue>0.9070) charMapValue=33081316; else if (grayscaleValue>0.8837) charMapValue=32045617; else if (grayscaleValue>0.8605) charMapValue=32032318; else if (grayscaleValue>0.8372) charMapValue=15255537; else if (grayscaleValue>0.8140) charMapValue=15022414; else if (grayscaleValue>0.7907) charMapValue=32575775; else if (grayscaleValue>0.7674) charMapValue=16267326; else if (grayscaleValue>0.7442) charMapValue=18667121; else if (grayscaleValue>0.7209) charMapValue=18732593; else if (grayscaleValue>0.6977) charMapValue=32540207; else if (grayscaleValue>0.6744) charMapValue=32641183; else if (grayscaleValue>0.6512) charMapValue=18415153; else if (grayscaleValue>0.6279) charMapValue=16272942; else if (grayscaleValue>0.6047) charMapValue=15018318; else if (grayscaleValue>0.5814) charMapValue=15022158; else if (grayscaleValue>0.5581) charMapValue=18405034; else if (grayscaleValue>0.5349) charMapValue=32045584; else if (grayscaleValue>0.5116) charMapValue=15255086; else if (grayscaleValue>0.4884) charMapValue=33061392; else if (grayscaleValue>0.4651) charMapValue=18400814; else if (grayscaleValue>0.4419) charMapValue=18444881; else if (grayscaleValue>0.4186) charMapValue=16269839; else if (grayscaleValue>0.3953) charMapValue=6566222; else if (grayscaleValue>0.3721) charMapValue=13177118; else if (grayscaleValue>0.3488) charMapValue=14954572; else if (grayscaleValue>0.3256) charMapValue=17463428; else if (grayscaleValue>0.3023) charMapValue=18157905; else if (grayscaleValue>0.2791) charMapValue=18393412; else if (grayscaleValue>0.2558) charMapValue=32641156; else if (grayscaleValue>0.2326) charMapValue=17318431; else if (grayscaleValue>0.2093) charMapValue=15239300; else if (grayscaleValue>0.1860) charMapValue=18393220; else if (grayscaleValue>0.1628) charMapValue=14749828; else if (grayscaleValue>0.1395) charMapValue=12652620; else if (grayscaleValue>0.1163) charMapValue=4591748; else if (grayscaleValue>0.0930) charMapValue=459200; else if (grayscaleValue>0.0698) charMapValue=4329476; else if (grayscaleValue>0.0465) charMapValue=131200; else if (grayscaleValue>0.0233) charMapValue=4096; else charMapValue=4096; return charMapValue;
}

int pickCharMinimal(float grayscaleValue){

  if (grayscaleValue>0.8) return 11512810; // '#'
  if (grayscaleValue>0.7) return 13195790; // '@'
  if (grayscaleValue>0.6) return 15252014; // '8'
  if (grayscaleValue>0.5) return 13121101; // '&'
  if (grayscaleValue>0.4) return 15255086; // 'o'
  if (grayscaleValue>0.3) return 163153;   // '*'
  if (grayscaleValue>0.2) return 65600;    // ':'
  return 4096;
}

int pickCharMedium(float grayscaleValue){

  if (grayscaleValue>0.9) return 33061407; // dense
  if (grayscaleValue>0.8) return 32045630;
  if (grayscaleValue>0.7) return 18732593;
  if (grayscaleValue>0.6) return 15022158;
  if (grayscaleValue>0.5) return 15255086;
  if (grayscaleValue>0.4) return 17463428;
  if (grayscaleValue>0.3) return 18157905;
  if (grayscaleValue>0.2) return 131200;
  return 4096;
}

${PICKER_TEXT_GLSL}

int pickCharSet(float grayscaleValue, int setId, vec2 pixelCoords){
  if (setId==1) return pickCharMinimal(grayscaleValue);
  if (setId==2) return pickCharMedium(grayscaleValue);
  if (setId==3) return pickCharText(pixelCoords, grayscaleValue, uCellSize);
  return pickCharFull(grayscaleValue);
}

float character(int charMapValue, vec2 pixelPos){
  pixelPos=floor(pixelPos*vec2(-4.0,4.0)+2.5);
  if (clamp(pixelPos.x,0.0,4.0)==pixelPos.x){
    if (clamp(pixelPos.y,0.0,4.0)==pixelPos.y){
      int bitIndex=int(round(pixelPos.x)+5.0*round(pixelPos.y));
      if (((charMapValue>>bitIndex)&1)==1) return 1.0;
    }
  }
  return 0.0;
}

void main(){
  vec2 fragmentCoordinates=vUv*uResolution;
  vec2 cellSizeVec=vec2(uCellSize);
  vec2 gridBlock=floor(fragmentCoordinates/cellSizeVec)*cellSizeVec;

  vec2 inputRes = uInputResolution;
  float inputAspect = inputRes.x/inputRes.y;
  float outputAspect = uResolution.x/uResolution.y;
  vec2 blockUvCenter = (gridBlock+0.5)/uResolution;
  vec2 sourceUv;
  if (inputAspect > outputAspect) {

    float aspectRatioCorrection = outputAspect/inputAspect;
    sourceUv = vec2(blockUvCenter.x*aspectRatioCorrection + (1.0-aspectRatioCorrection)*0.5, blockUvCenter.y);
  } else {

    float aspectRatioCorrection = inputAspect/outputAspect;
    sourceUv = vec2(blockUvCenter.x, blockUvCenter.y*aspectRatioCorrection + (1.0-aspectRatioCorrection)*0.5);
  }


  vec2 displacementVector = sourceUv - 0.5;
  float displacementLength = length(displacementVector)+1e-5;
  vec2 jitteredSourceUv = sourceUv + (displacementVector/displacementLength) * (sin(uTime+uSeedA)+1.0) * uDistortionAmplitude * abs(sin(displacementLength*uFrequency - uTime - uTime + uSeedB)) * 0.002;
  vec3 sampledColor=texture(uInputTexture, clamp(jitteredSourceUv, 0.0, 1.0)).rgb;
  sampledColor = (sampledColor - 0.5) * uContrast + 0.5;
  sampledColor *= uBrightness;
  sampledColor *= uTintColor;
  float grayscaleValue=gray(sampledColor);

  // Static text layer lookup
  vec2 cellUv = floor(fragmentCoordinates / uCellSize) + 0.5;
  // We need to map grid coord to texture coord. uTextMap has size of gridCols, gridRows.
  // We can just use texture(uTextMap, blockUvCenter).
  vec2 gridBlockCenter = (floor(fragmentCoordinates/uCellSize)*uCellSize + 0.5) / uResolution;

  // Note: texture coordinates 0..1 map to 0..gridDim.
  // Ideally, if we upload a texture of size WxH, and sample at uv, we get the nearest texel.
  // We used GL_NEAREST.

  uvec2 textData = texture(uTextMap, gridBlockCenter).xy;
  uint mask = textData.r;
  float textOpacity = float(textData.g) / 255.0; // 0..1

  // Decide character and mix factor
  // If mask != 0, we have text.
  // Actually, even if mask is 0, if opacity > 0 it might mean "space" (empty char).
  // But our layout engine writes 0 for empty space unless user put space char which has 0 mask?
  // Quinque5 space has mask 0.
  // So we check opacity.

  // Note: user requested "add +1 ... to final color intensity * fgOpacity".
  // This implies the text color should be (TintColor * Brightness) * FgOpacity * TextOpacity
  // And it should overwrite the fluid where text is present.

  if (textOpacity > 0.0) {
    int charMapValue = int(mask);
    vec2 charPixelUv = mod(fragmentCoordinates/(uCellSize*0.5), 2.0) - vec2(1.0);
    float charVal = character(charMapValue, charPixelUv);

    // We render the text color.
    // Base text color is uFgTintColor * uBrightness.
    vec3 textColor = uFgTintColor * uBrightness * charVal;

    // Final text contribution:
    // If we simply return this color, it overwrites.
    // We scale by uFgOpacity and textOpacity (per-item opacity).

    fragColor = vec4(textColor * uFgOpacity * textOpacity, 1.0);
  } else {
    int charMapValue = pickCharSet(grayscaleValue, uCharSetId, fragmentCoordinates);
    vec2 charPixelUv = mod(fragmentCoordinates/(uCellSize*0.5), 2.0) - vec2(1.0);
    float charVal = character(charMapValue, charPixelUv);

    // Fluid color
    vec3 fluidColor = (uIsBlackAndWhite==1)? vec3(charVal) : sampledColor*charVal;

    // Apply bgOpacity
    fragColor = vec4(fluidColor * uBgOpacity, 1.0);
  }
}
`

const makeShader = (gl: Gl, type: number, src: string) => {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader error")
  }
  return sh
}
const makeProgram = (gl: Gl, vsSrc: string, fsSrc: string) => {
  const p = gl.createProgram()!
  const v = makeShader(gl, gl.VERTEX_SHADER, vsSrc)
  const f = makeShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "link error")
  }
  return p
}
const quad = (gl: Gl) => {
  const vao = gl.createVertexArray()!
  const vbo = gl.createBuffer()!
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  return { vao, vbo }
}

export const AsciiNoiseEffect = ({
  /* noiseStrength = 0.39,
   * noiseScale = 0.0005,
   * speed = 0.78,
   * cell = 24,
   * bw = true,
   * charset = 1,
   * tint = [1, 0.3, 0.8702524358137375],
   * distortAmp = 1.11,
   * frequency = 17.99,
   * zRate = 0.007,
   * brightness = 0.92,
   * contrast = 1.53,
   * seed1 = 4.880335500734461,
   * seed2 = 4.368472774461116,
   * hue = 343.1,
   * sat = 0.97,
   * gamma = 1.15,
   * vignette = 0.65,
   * vignetteSoftness = 1.92,
   * glyphSharpness = 0.134,
   * bg = [0.02912780619892277, 0.017622800436411148, 0.09389556161243275], */

  // quite minimalist
  // pickCharText min grayscaleValue = 0.01
  /* noiseStrength = 0.46,
   * noiseScale = 0.0002,
   * speed = 0.14,
   * cell = 17,
   * bw = true,
   * charset = 2,
   * tint = [0.45046742915750615, 1, 0.3],
   * distortAmp = 1.31,
   * frequency = 8.4,
   * zRate = 0.026,
   * brightness = 0.85,
   * contrast = 1.46,
   * seed1 = 2.0991707676867186,
   * seed2 = 2.840680582023043,
   * hue = 122.9,
   * sat = 2,
   * gamma = 1.34,
   * vignette = 0.4,
   * vignetteSoftness = 0.86,
   * glyphSharpness = 0.032,
   * bg = [0.05431432520581089, 0.023780997229068845, 0.03282002079918472], */

  // og nice noise pattern
  noiseStrength = 0.42,
  noiseScale = 0.0006,
  speed = 0,
  cell = 30,
  bw = false,
  charset = 3,
  bgTint = [1, 0.3, 0.3],
  fgTint = [1, 0.99, 0.99],
  bg = [0, 0, 0],

  /* fgTint = "rgb(100% 86.4% 58.3%)",
   * bgTint = "rgb(56.9% 23.8% 17.5%)",
   * bg = "rgb(30.3% 10.5% 5.64%)", */

  /* fgTint = "rgb(98.5% 38% 68.7%)",
   * bgTint = "rgb(60.4% 43.2% 100%)",
   * bg = "rgb(43.2% 26.2% 80.8%)", */

  /* fgTint = "rgb(98.5% 38% 68.7%)",
   * bgTint = "rgb(60.4% 43.2% 100%)",
   * bg = "rgb(0% 0% 0%)", */

  distortAmp = 0.6,
  // distortAmp = 0.2,
  frequency = 16.4,
  zRate = 0,
  brightness = 1,
  contrast = 1,
  seed1 = 8.359534820706298,
  seed2 = 4.8518677112236395,
  hue = 337.2,
  sat = 0.0,
  gamma = 1.46,
  vignette = 0.02,
  vignetteSoftness = 1.39,
  glyphSharpness = 0.04,
  // bg = [0.0960355316732419, 0.0642024569325834, 0.06926603172039973],
  className,

  textItems,
  bgOpacity = 1,
  fgOpacity = 1,
  scrollY = 0, // In grid units (cells)
  gridOffset = [0, 0], // Background translation in grid units
  text = LF_WORDMARK,
  textOffset = [0, 0],
  lineOffsetIncrease = 5,
}: AsciiNoiseEffectProps) => {
  const textBitmasks = useMemo(
    () => (text ? stringToBitmasks(text) : []),
    [text],
  )
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Ref to hold current props to avoid re-initializing shaders/textures on every render
  const propsRef = useRef({
    noiseStrength,
    noiseScale,
    speed,
    cell,
    bw,
    charset,
    textItems,
    bgOpacity,
    fgOpacity,
    bgTint,
    fgTint,
    scrollY,
    gridOffset,
    distortAmp,
    frequency,
    zRate,
    brightness,
    contrast,
    seed1,
    seed2,
    hue,
    sat,
    gamma,
    vignette,
    vignetteSoftness,
    glyphSharpness,
    bg,
    textBitmasks,
    textOffset,
    lineOffsetIncrease,
  })

  // Update ref when props change
  useEffect(() => {
    propsRef.current = {
      noiseStrength,
      noiseScale,
      speed,
      cell,
      bw,
      charset,
      textItems,
      bgOpacity,
      fgOpacity,
      bgTint,
      fgTint,
      scrollY,
      gridOffset,
      distortAmp,
      frequency,
      zRate,
      brightness,
      contrast,
      seed1,
      seed2,
      hue,
      sat,
      gamma,
      vignette,
      vignetteSoftness,
      glyphSharpness,
      bg,
      textBitmasks,
      textOffset,
      lineOffsetIncrease,
    }
  }, [
    noiseStrength,
    noiseScale,
    speed,
    cell,
    bw,
    charset,
    textItems,
    bgOpacity,
    fgOpacity,
    bgTint,
    fgTint,
    scrollY,
    gridOffset,
    distortAmp,
    frequency,
    zRate,
    brightness,
    contrast,
    seed1,
    seed2,
    hue,
    sat,
    gamma,
    vignette,
    vignetteSoftness,
    glyphSharpness,
    bg,
    textBitmasks,
    textOffset,
    lineOffsetIncrease,
  ])

  const resRef = useRef<{
    gl: Gl
    vao: WebGLVertexArrayObject
    vbo: WebGLBuffer
    progNoise: WebGLProgram
    progAscii: WebGLProgram
    uNoise: Record<string, WebGLUniformLocation>
    uAscii: Record<string, WebGLUniformLocation>
    texScene: WebGLTexture
    texTextMap: WebGLTexture
    fbScene: WebGLFramebuffer
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  const init = useCallback((gl: Gl, w: number, h: number) => {
    const progNoise = makeProgram(gl, vs, fsNoise)
    const progAscii = makeProgram(gl, vs, fsAscii)
    const { vao, vbo } = quad(gl)
    const uNoise = {
      uResolution: gl.getUniformLocation(progNoise, "uResolution")!,
      uTime: gl.getUniformLocation(progNoise, "uTime")!,
      uNoiseStrength: gl.getUniformLocation(progNoise, "uNoiseStrength")!,
      uNoiseScale: gl.getUniformLocation(progNoise, "uNoiseScale")!,
      uSpeed: gl.getUniformLocation(progNoise, "uSpeed")!,
      uTintColor: gl.getUniformLocation(progNoise, "uTintColor")!,
      uDistortionAmplitude: gl.getUniformLocation(
        progNoise,
        "uDistortionAmplitude",
      )!,
      uFrequency: gl.getUniformLocation(progNoise, "uFrequency")!,
      uZAxisEvolutionRate: gl.getUniformLocation(
        progNoise,
        "uZAxisEvolutionRate",
      )!,
      uBrightness: gl.getUniformLocation(progNoise, "uBrightness")!,
      uContrast: gl.getUniformLocation(progNoise, "uContrast")!,
      uSeedA: gl.getUniformLocation(progNoise, "uSeedA")!,
      uSeedB: gl.getUniformLocation(progNoise, "uSeedB")!,
      uGridOffset: gl.getUniformLocation(progNoise, "uGridOffset")!,
      uHueAngle: gl.getUniformLocation(progNoise, "uHueAngle")!,
      uSaturation: gl.getUniformLocation(progNoise, "uSaturation")!,
      uGammaCorrection: gl.getUniformLocation(progNoise, "uGammaCorrection")!,
      uVignetteStrength: gl.getUniformLocation(progNoise, "uVignetteStrength")!,
      uVignetteSoftness: gl.getUniformLocation(progNoise, "uVignetteSoftness")!,
      uGlyphSharpness: gl.getUniformLocation(progNoise, "uGlyphSharpness")!,
      uBackgroundColor: gl.getUniformLocation(progNoise, "uBackgroundColor")!,
    } as const
    const uAscii = {
      uResolution: gl.getUniformLocation(progAscii, "uResolution")!,
      uInputTexture: gl.getUniformLocation(progAscii, "uInputTexture")!,
      uInputResolution: gl.getUniformLocation(progAscii, "uInputResolution")!,
      uCellSize: gl.getUniformLocation(progAscii, "uCellSize")!,
      uIsBlackAndWhite: gl.getUniformLocation(progAscii, "uIsBlackAndWhite")!,
      uCharSetId: gl.getUniformLocation(progAscii, "uCharSetId")!,
      uBrightness: gl.getUniformLocation(progAscii, "uBrightness")!,
      uContrast: gl.getUniformLocation(progAscii, "uContrast")!,
      uTintColor: gl.getUniformLocation(progAscii, "uTintColor")!,
      uTime: gl.getUniformLocation(progAscii, "uTime")!,
      uDistortionAmplitude: gl.getUniformLocation(
        progAscii,
        "uDistortionAmplitude",
      )!,
      uFrequency: gl.getUniformLocation(progAscii, "uFrequency")!,
      uZAxisEvolutionRate: gl.getUniformLocation(
        progAscii,
        "uZAxisEvolutionRate",
      )!,
      uSeedA: gl.getUniformLocation(progAscii, "uSeedA")!,
      uSeedB: gl.getUniformLocation(progAscii, "uSeedB")!,
      uTextValues: gl.getUniformLocation(progAscii, "uTextValues")!,
      uTextLength: gl.getUniformLocation(progAscii, "uTextLength")!,
      uTextOffset: gl.getUniformLocation(progAscii, "uTextOffset")!,
      uLineOffsetIncrease: gl.getUniformLocation(
        progAscii,
        "uLineOffsetIncrease",
      )!,
      uTextMap: gl.getUniformLocation(progAscii, "uTextMap")!,
      uBgOpacity: gl.getUniformLocation(progAscii, "uBgOpacity")!,
      uFgOpacity: gl.getUniformLocation(progAscii, "uFgOpacity")!,
      uFgTintColor: gl.getUniformLocation(progAscii, "uFgTintColor")!,
    } as const

    const texTextMap = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texTextMap)
    // R32UI or RG32UI.
    // For integer textures, filtering must be NEAREST.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const texScene = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texScene)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
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

    const fbScene = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texScene,
      0,
    )
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
      texTextMap,
      fbScene,
    }
  }, [])

  const render = useCallback(
    (tMs: number) => {
      const res = resRef.current
      const canvas = canvasRef.current
      if (!res || !canvas) return

      // Get current props from ref
      const {
        noiseStrength,
        noiseScale,
        speed,
        cell,
        bw,
        charset,
        textItems,
        bgOpacity,
        fgOpacity,
        bgTint,
        fgTint,
        scrollY,
        gridOffset,
        distortAmp,
        frequency,
        zRate,
        brightness,
        contrast,
        seed1,
        seed2,
        hue,
        sat,
        gamma,
        vignette,
        vignetteSoftness,
        glyphSharpness,
        bg,
        textBitmasks,
        textOffset,
        lineOffsetIncrease,
      } = propsRef.current

      // Parse color inputs
      const bgTintRgb = parseColor(bgTint!)
      const fgTintRgb = parseColor(fgTint!)
      const bgRgb = parseColor(bg!)

      const {
        gl,
        vao,
        progNoise,
        progAscii,
        uNoise,
        uAscii,
        texScene,
        texTextMap,
        fbScene,
      } = res
      if (startRef.current === 0) startRef.current = tMs
      const t = (tMs - startRef.current) / 1000
      const w = canvas.width,
        h = canvas.height
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene)
      gl.viewport(0, 0, w, h)
      gl.useProgram(progNoise)
      gl.bindVertexArray(vao)
      gl.uniform2f(uNoise.uResolution, w, h)
      gl.uniform1f(uNoise.uTime, t)
      gl.uniform1f(uNoise.uNoiseStrength, noiseStrength!)
      gl.uniform1f(uNoise.uNoiseScale, noiseScale!)
      gl.uniform1f(uNoise.uSpeed, speed!)
      gl.uniform3f(uNoise.uTintColor, bgTintRgb[0], bgTintRgb[1], bgTintRgb[2])
      gl.uniform1f(uNoise.uDistortionAmplitude, distortAmp!)
      gl.uniform1f(uNoise.uFrequency, frequency!)
      gl.uniform1f(uNoise.uZAxisEvolutionRate, zRate!)
      gl.uniform1f(uNoise.uBrightness, brightness!)
      gl.uniform1f(uNoise.uContrast, contrast!)
      gl.uniform1f(uNoise.uSeedA, seed1!)
      gl.uniform1f(uNoise.uSeedB, seed2!)
      // Grid offset in pixels. Passed in grid units.
      gl.uniform2f(
        uNoise.uGridOffset,
        (gridOffset?.[0] || 0) * cell!,
        (gridOffset?.[1] || 0) * cell!,
      )
      gl.uniform1f(uNoise.uHueAngle, hue!)
      gl.uniform1f(uNoise.uSaturation, sat!)
      gl.uniform1f(uNoise.uGammaCorrection, gamma!)
      gl.uniform1f(uNoise.uVignetteStrength, vignette!)
      gl.uniform1f(uNoise.uVignetteSoftness, vignetteSoftness!)
      gl.uniform1f(uNoise.uGlyphSharpness, glyphSharpness!)
      gl.uniform3f(uNoise.uBackgroundColor, bgRgb[0], bgRgb[1], bgRgb[2])
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.useProgram(progAscii)
      gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texScene)

      // Update Text Map Texture
      // We need grid dimensions.
      // uCellSize is uniform, but we have it as prop 'cell'.
      const cols = Math.ceil(w / cell!)
      const rows = Math.ceil(h / cell!)

      // Compute layout
      // Note: this might be heavy to do every frame if textItems is large,
      // but typical use case is static or slow changing.
      // To optimize, we could useMemo the buffer, but layout depends on cols/rows which change on resize.
      // We can check if text buffer needs update? For now just do it.

      // If we have no items, we still need a valid texture bound?
      // Or we can just bind a 1x1 empty texture.
      // But computeTextLayer handles empty items returning zeroed buffer.

      const textBuffer = computeTextLayer(
        textItems || [],
        cols,
        rows,
        scrollY,
        undefined,
        t,
      )

      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texTextMap)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG32UI,
        cols,
        rows,
        0,
        gl.RG_INTEGER,
        gl.UNSIGNED_INT,
        textBuffer,
      )

      gl.uniform2f(uAscii.uInputResolution, w, h)
      gl.uniform1i(uAscii.uInputTexture, 0)
      gl.uniform1i(uAscii.uTextMap, 1) // Texture unit 1
      gl.uniform2f(uAscii.uResolution, w, h)
      gl.uniform1f(uAscii.uCellSize, cell!)
      gl.uniform1i(uAscii.uIsBlackAndWhite, bw ? 1 : 0)
      gl.uniform1i(uAscii.uCharSetId, charset!)
      gl.uniform1f(uAscii.uBrightness, brightness!)
      gl.uniform1f(uAscii.uContrast, contrast!)
      gl.uniform3f(uAscii.uTintColor, bgTintRgb[0], bgTintRgb[1], bgTintRgb[2])
      gl.uniform3f(
        uAscii.uFgTintColor,
        fgTintRgb[0],
        fgTintRgb[1],
        fgTintRgb[2],
      )
      gl.uniform1f(uAscii.uTime, t)
      gl.uniform1f(uAscii.uDistortionAmplitude, distortAmp!)
      gl.uniform1f(uAscii.uFrequency, frequency!)
      gl.uniform1f(uAscii.uZAxisEvolutionRate, zRate!)
      gl.uniform1f(uAscii.uSeedA, seed1!)
      gl.uniform1f(uAscii.uSeedB, seed2!)
      gl.uniform1f(uAscii.uBgOpacity, bgOpacity!)
      gl.uniform1f(uAscii.uFgOpacity, fgOpacity!)
      const len = Math.min(textBitmasks.length, 128)
      gl.uniform1i(uAscii.uTextLength, len)
      if (len > 0) {
        gl.uniform1iv(
          uAscii.uTextValues,
          new Int32Array(textBitmasks.slice(0, len)),
        )
      }
      gl.uniform2f(uAscii.uTextOffset, textOffset[0], textOffset[1])
      gl.uniform1f(uAscii.uLineOffsetIncrease, lineOffsetIncrease!)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      rafRef.current = window.requestAnimationFrame(render)
    },
    [], // No dependencies, reads from ref
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false })
    if (!gl) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(canvas.clientWidth * dpr)
    canvas.height = Math.floor(canvas.clientHeight * dpr)
    resRef.current = init(gl, canvas.width, canvas.height)
    rafRef.current = window.requestAnimationFrame(render)
    const onResize = () => {
      const c = canvasRef.current
      const rr = resRef.current
      if (!c || !rr) return
      const d = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.floor(c.clientWidth * d),
        H = Math.floor(c.clientHeight * d)
      if (W === c.width && H === c.height) return
      c.width = W
      c.height = H
      gl.viewport(0, 0, W, H)
      gl.bindTexture(gl.TEXTURE_2D, rr.texScene)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        W,
        H,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
    window.addEventListener("resize", onResize)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", onResize)
    }
  }, [init]) // Only run on mount/unmount since render is stable now

  return (
    <div className={"relative h-dvh w-full bg-black " + (className ?? "")}>
      <canvas ref={canvasRef} className='w-full h-full block' />
    </div>
  )
}
