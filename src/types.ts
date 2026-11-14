export interface LyricWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface LyricLine {
  index: number;
  words: LyricWord[];
  start: number;
  end: number;
  text: string;
}

export interface LyricTrack {
  lines: LyricLine[];
  /** 'word' = every word has its own timestamps. 'line' = only whole lines are timed. */
  precision: 'word' | 'line';
  warnings: string[];
}

export interface Bands {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  /** short-lived transient on bass onsets, 0..1 */
  kick: number;
}

/** Every field is numeric so scenes can be cross-faded smoothly. */
export interface SceneParams {
  cx: number; cy: number; cz: number;       // camera position
  lx: number; ly: number; lz: number;       // camera look-at
  fog: number;                              // smoke density / brightness
  speed: number;                            // smoke flow speed
  light: number;                            // volumetric light strength
  lightX: number; lightY: number;           // light position in screen space (-1..1)
  orb: number;                              // orb scale (0 = hidden)
  orbX: number; orbY: number; orbZ: number;
  glow: number;                             // orb rim / halo strength
  ring: number;                             // particle ring strength
  rain: number;                             // glowing rain amount 0..1
  dust: number;                             // floating particles amount 0..1
  react: number;                            // audio reactivity multiplier
  sway: number;                             // slow camera drift amount
}

export type LyricLayout = 'center' | 'low' | 'high' | 'left' | 'right';
export type LyricType = 'black' | 'naskh' | 'vazir';

export interface LyricStyle {
  layout: LyricLayout;
  type: LyricType;
  scale: number;
  pop: number;
}
