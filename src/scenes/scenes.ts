import type { LyricStyle, SceneParams } from '../types';

/**
 * Scene timeline. Start times are derived from the supplied lyric timing
 * (verse / chorus repetition and the instrumental gaps) and can be freely edited.
 * Every scene fully describes camera, light, particles and lyric typography;
 * the SceneDirector cross-fades between them.
 */
export interface SceneDef {
  id: string;
  start: number;
  /** seconds-ish blend speed; higher = quicker transition */
  rate?: number;
  params: SceneParams;
  lyric: LyricStyle;
}

const BASE: SceneParams = {
  cx: 0, cy: 0.2, cz: 9, lx: 0, ly: 0.3, lz: 0,
  fog: 0.8, speed: 0.07, light: 0.8, lightX: 0, lightY: 0.2,
  orb: 1, orbX: 0, orbY: 1.2, orbZ: -6, glow: 0.8,
  ring: 0, rain: 0, dust: 0.4, react: 1, sway: 0.5,
};
const P = (o: Partial<SceneParams>): SceneParams => ({ ...BASE, ...o });

export const SCENES: SceneDef[] = [
  {
    id: 'void', start: 0,
    params: P({ fog: 0.6, light: 0.5, lightY: 0.3, orb: 1.1, orbY: 1.6, orbZ: -7, glow: 0.45, dust: 0.25, react: 0.6, sway: 0.3 }),
    lyric: { layout: 'center', type: 'black', scale: 1, pop: 1.1 },
  },
  {
    id: 'verse-1', start: 20, rate: 0.8,
    params: P({ cx: -1.2, cy: 0, cz: 7.5, lx: 0.4, fog: 0.8, light: 0.85, lightX: -0.35, lightY: 0.15, orb: 1, orbX: 2.4, orbY: 1.1, orbZ: -5.5, glow: 0.8, rain: 0.15, dust: 0.45 }),
    lyric: { layout: 'center', type: 'naskh', scale: 1, pop: 1.1 },
  },
  {
    id: 'hook-1', start: 54.3, rate: 1.5,
    params: P({ cx: 0, cy: -0.7, cz: 6, lx: 0, ly: 1.2, fog: 1, light: 1.3, lightX: 0, lightY: 0.35, orb: 1.7, orbX: 0, orbY: 1.9, orbZ: -4.5, glow: 1.1, ring: 0.8, rain: 0.5, dust: 0.7, react: 1.2, sway: 0.6 }),
    lyric: { layout: 'center', type: 'black', scale: 1.1, pop: 1.2 },
  },
  {
    id: 'stillness', start: 91.7, rate: 0.7,
    params: P({ cx: 0, cy: 0.5, cz: 11, fog: 0.5, speed: 0.04, light: 0.3, lightY: 0.1, orb: 0.55, orbY: 0.4, orbZ: -9, glow: 0.4, dust: 0.9, rain: 0, react: 0.7, sway: 0.25 }),
    lyric: { layout: 'center', type: 'naskh', scale: 1, pop: 1.05 },
  },
  {
    id: 'verse-2', start: 106.9, rate: 0.9,
    params: P({ cx: 1.6, cy: 0.3, cz: 7, lx: -0.5, fog: 0.85, light: 0.9, lightX: 0.4, lightY: 0.1, orb: 1.1, orbX: -3, orbY: 0.6, orbZ: -6, glow: 0.8, rain: 0.25, dust: 0.5 }),
    lyric: { layout: 'high', type: 'naskh', scale: 1, pop: 1.12 },
  },
  {
    id: 'hook-2', start: 141.7, rate: 1.6,
    params: P({ cx: 0, cy: -1.2, cz: 5, ly: 0.9, fog: 1.05, light: 1.5, lightX: 0, lightY: 0.2, orb: 2.1, orbX: 0, orbY: 0.6, orbZ: -3.4, glow: 1.2, ring: 1, rain: 0.75, dust: 0.8, react: 1.3, sway: 0.7 }),
    lyric: { layout: 'center', type: 'black', scale: 1.12, pop: 1.22 },
  },
  {
    id: 'bridge', start: 159.2, rate: 1.4,
    params: P({ cx: 0.6, cy: 0.6, cz: 5.5, lx: 0, fog: 0.9, speed: 0.12, light: 1, lightX: -0.5, lightY: -0.1, orb: 1.3, orbX: 3, orbY: 0.4, orbZ: -4.5, glow: 0.9, ring: 0.5, rain: 0.35, dust: 1, react: 1.2, sway: 0.9 }),
    lyric: { layout: 'left', type: 'vazir', scale: 0.95, pop: 1.15 },
  },
  {
    id: 'hook-final', start: 194, rate: 1.8,
    params: P({ cx: 0, cy: 0, cz: 4.2, ly: 0.2, fog: 1.15, speed: 0.1, light: 1.8, lightX: 0, lightY: 0.15, orb: 2.4, orbX: 0, orbY: 0.2, orbZ: -3, glow: 1.4, ring: 1.3, rain: 1, dust: 1.2, react: 1.5, sway: 0.8 }),
    lyric: { layout: 'center', type: 'black', scale: 1.2, pop: 1.3 },
  },
  {
    id: 'outro', start: 229, rate: 0.6,
    params: P({ cx: 0, cy: 0.4, cz: 10, fog: 0.6, speed: 0.05, light: 0.5, lightY: 0.25, orb: 0.9, orbY: 2, orbZ: -8, glow: 0.5, rain: 0.1, dust: 0.6, react: 0.8, sway: 0.3 }),
    lyric: { layout: 'low', type: 'naskh', scale: 1, pop: 1.08 },
  },
];

export function sceneIndexAt(t: number): number {
  let idx = 0;
  for (let i = 0; i < SCENES.length; i++) if (SCENES[i].start <= t) idx = i;
  return idx;
}
export const lyricStyleAt = (t: number): LyricStyle => SCENES[sceneIndexAt(t)].lyric;
