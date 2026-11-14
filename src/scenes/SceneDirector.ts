import type { SceneParams } from '../types';
import { damp } from '../utils/math';
import { SCENES, sceneIndexAt } from './scenes';

const KEYS = Object.keys(SCENES[0].params) as (keyof SceneParams)[];

/** Cross-fades numeric scene parameters; emits a short "flash" on every scene change. */
export class SceneDirector {
  readonly state: SceneParams = { ...SCENES[0].params };
  index = 0;
  flash = 0;

  update(t: number, dt: number) {
    const idx = sceneIndexAt(t);
    if (idx !== this.index) {
      this.index = idx;
      this.flash = 1;
    }
    const def = SCENES[idx];
    const rate = def.rate ?? 1;
    for (const k of KEYS) this.state[k] = damp(this.state[k], def.params[k], rate, dt);
    this.flash *= Math.exp(-dt * 1.3);
    return this.state;
  }

  reset() {
    Object.assign(this.state, SCENES[0].params);
    this.index = 0;
    this.flash = 0;
  }
}
