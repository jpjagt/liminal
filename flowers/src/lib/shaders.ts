
export const GLSL_NOISE = `
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
`

export const GLSL_COLOR_UTILS = `
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
float gray(vec3 color){return dot(color, vec3(0.3,0.59,0.11));}
`

export const GLSL_PICKERS = `
int pickCharFull(float grayscaleValue){
  if (grayscaleValue>0.9535) return 33061407; else if (grayscaleValue>0.9302) return 32045630; else if (grayscaleValue>0.9070) return 33081316; else if (grayscaleValue>0.8837) return 32045617; else if (grayscaleValue>0.8605) return 32032318; else if (grayscaleValue>0.8372) return 15255537; else if (grayscaleValue>0.8140) return 15022414; else if (grayscaleValue>0.7907) return 32575775; else if (grayscaleValue>0.7674) return 16267326; else if (grayscaleValue>0.7442) return 18667121; else if (grayscaleValue>0.7209) return 18732593; else if (grayscaleValue>0.6977) return 32540207; else if (grayscaleValue>0.6744) return 32641183; else if (grayscaleValue>0.6512) return 18415153; else if (grayscaleValue>0.6279) return 16272942; else if (grayscaleValue>0.6047) return 15018318; else if (grayscaleValue>0.5814) return 15022158; else if (grayscaleValue>0.5581) return 18405034; else if (grayscaleValue>0.5349) return 32045584; else if (grayscaleValue>0.5116) return 15255086; else if (grayscaleValue>0.4884) return 33061392; else if (grayscaleValue>0.4651) return 18400814; else if (grayscaleValue>0.4419) return 18444881; else if (grayscaleValue>0.4186) return 16269839; else if (grayscaleValue>0.3953) return 6566222; else if (grayscaleValue>0.3721) return 13177118; else if (grayscaleValue>0.3488) return 14954572; else if (grayscaleValue>0.3256) return 17463428; else if (grayscaleValue>0.3023) return 18157905; else if (grayscaleValue>0.2791) return 18393412; else if (grayscaleValue>0.2558) return 32641156; else if (grayscaleValue>0.2326) return 17318431; else if (grayscaleValue>0.2093) return 15239300; else if (grayscaleValue>0.1860) return 18393220; else if (grayscaleValue>0.1628) return 14749828; else if (grayscaleValue>0.1395) return 12652620; else if (grayscaleValue>0.1163) return 4611606; else if (grayscaleValue>0.0930) return 9439744; else if (grayscaleValue>0.0698) return 4329600; else if (grayscaleValue>0.0465) return 4202496; else if (grayscaleValue>0.0233) return 131200; else return 4096;
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

int pickCharSet(float grayscaleValue, int setId, vec2 pixelCoords){
  if (setId==1) return pickCharMinimal(grayscaleValue);
  if (setId==2) return pickCharMedium(grayscaleValue);
  // Note: setId=3 is specific to text layout which we omit here for simplicity or handle custom
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
`
