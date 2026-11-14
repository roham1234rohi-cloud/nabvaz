export const FOG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

export const FOG_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform float uFog;
uniform float uSpeed;
uniform float uLight;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uFlash;
uniform vec2 uLightPos;
uniform vec2 uCam;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < OCT; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;
  vec2 p = uv * 0.9 + uCam;
  float t = uTime * uSpeed;

  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.7, 0.0)));
  vec2 r = vec2(fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.5), fbm(p + 2.6 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p + 2.6 * r + uMid * 0.5);
  float smoke = smoothstep(0.22, 0.95, f);

  vec2 lp = vec2(uLightPos.x * uAspect, uLightPos.y);
  vec2 dv = uv - lp;
  float d = length(dv);
  float pool = exp(-d * 1.35);
  float ang = atan(dv.y, dv.x);
  float rays = pow(clamp(fbm(vec2(ang * 5.0, t * 0.8)) * 1.6 - 0.25, 0.0, 1.0), 2.0) * exp(-d * 0.9);
  float lightAmt = uLight * (0.9 + uBass * 0.7);

  float lit = smoke * (0.05 + pool * lightAmt * 1.25) + rays * smoke * lightAmt * 0.55;
  lit += pool * pool * uFlash * 0.55;
  lit += (1.0 - smoke) * 0.012 + uHigh * 0.02 * smoke;
  lit *= uFog;
  lit *= smoothstep(2.1, 0.25, length(uv * vec2(0.8, 1.0)));
  lit += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.018;
  lit = clamp(lit, 0.0, 1.0);
  gl_FragColor = vec4(vec3(lit), 1.0);
}`;

export const ORB_VERT = /* glsl */ `
uniform float uTime;
uniform float uBass;
uniform float uMid;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 p = position;
  float n = sin(p.x * 3.0 + uTime * 0.8) * sin(p.y * 3.0 - uTime * 0.6) * sin(p.z * 3.0 + uTime * 0.5);
  float disp = n * (0.05 + uBass * 0.22) + uMid * 0.03 * sin(p.y * 12.0 + uTime * 3.0);
  p += normal * disp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

export const ORB_FRAG = /* glsl */ `
uniform float uGlow;
uniform float uEnergy;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
  float rim = pow(f, 3.5);
  vec3 c = vec3(0.012 + rim * (0.9 + uEnergy * 1.4)) * uGlow;
  gl_FragColor = vec4(c, 1.0);
}`;

export const RING_VERT = /* glsl */ `
attribute float aAngle;
attribute float aRad;
attribute float aSeed;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uScale;
uniform float uPR;
varying float vSeed;
void main() {
  float a = aAngle + uTime * (0.04 + aSeed * 0.05);
  float wave = sin(aAngle * 5.0 + uTime * 1.1) * uMid * 0.55 + sin(aAngle * 13.0 - uTime * 2.3) * uHigh * 0.4;
  float r = (aRad + wave + uBass * 0.5 * aSeed) * uScale;
  vec3 pos = vec3(cos(a) * r, (aSeed - 0.5) * (0.35 + uBass * 1.4) * uScale + sin(aAngle * 3.0 + uTime * 0.7) * 0.12, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((1.2 + aSeed * 2.4 + uHigh * 3.0) * uPR * (26.0 / max(0.5, -mv.z)), 1.0, 14.0 * uPR);
  vSeed = aSeed;
}`;

export const RING_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(1.0), a * uOpacity * (0.4 + 0.6 * vSeed));
}`;

export const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uAmount;
uniform float uBurst;
uniform float uHigh;
uniform float uPR;
varying float vA;
void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.12 + aSeed * 0.3) + 9.0, 18.0) - 9.0;
  p.x += sin(uTime * 0.17 + aSeed * 40.0) * 0.7;
  p.z += cos(uTime * 0.13 + aSeed * 31.0) * 0.7;
  p += normalize(p + vec3(0.001)) * uBurst * (0.5 + aSeed) * 1.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 60.0);
  gl_PointSize = clamp((1.0 + aSeed * 2.2 + uHigh * 2.0) * uPR * (22.0 / max(0.5, -mv.z)), 1.0, 10.0 * uPR);
  vA = step(aSeed, uAmount) * tw * (0.25 + 0.5 * aSeed);
}`;

export const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vec3(1.0), a * vA);
}`;

export const RAIN_VERT = /* glsl */ `
attribute float aEnd;
attribute float aSeed;
uniform float uTime;
uniform float uAmount;
uniform float uBass;
varying float vA;
void main() {
  float H = 22.0;
  float spd = 7.0 + aSeed * 8.0;
  float y = mod(position.y - uTime * spd, H) - H * 0.5;
  float len = (0.4 + aSeed * 0.9) * (1.0 + uBass * 0.8);
  vec3 p = vec3(position.x + y * 0.06, y + aEnd * len, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vA = (1.0 - aEnd) * step(aSeed, uAmount) * (0.25 + 0.55 * aSeed);
}`;

export const RAIN_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vA;
void main() {
  gl_FragColor = vec4(vec3(1.0), vA * uOpacity);
}`;
