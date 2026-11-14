import type { LyricLine, LyricStyle, LyricTrack } from '../types';
import { damp } from '../utils/math';

type Role = 'past' | 'active' | 'future';

interface LineView {
  el: HTMLElement;
  words: HTMLElement[];
  states: number[];
  role: Role;
  /** measured vertical centre of the line inside the track, px (layout only) */
  center: number;
}

const LEAD = 0.35; // a line activates this long before its first word...
const HOLD = 2.8; // ...and keeps the active look this long after its last word
const WORD_GRACE = 0.25;
const ANCHOR = 0.46; // the sung line rests slightly above the vertical centre
const SCROLL_RATE = 3.6; // exponential damping rate of the auto-scroll
const SNAP_VIEWPORTS = 1.25; // jump instantly when the target is this far away (seek/replay)

/**
 * Continuous, auto-scrolling lyric track. Every line lives permanently in one
 * column that glides so the sung line always rests at a comfortable anchor
 * (a karaoke/Spotify-style experience rendered entirely in the project's own
 * cinematic language — no external player UI). Everything is derived from the
 * audio clock every frame (no timers), so pausing, seeking, replaying and tab
 * switches stay in sync.
 *
 * Word states (data-s): 0 upcoming (dimmed) · 1 currently sung (bright + glow)
 * · 2 already sung (bright, slightly quieter). Line-precision tracks (adapter
 * precision 'line') have one span per line, so the whole line brightens at
 * once — word-level timing is never faked.
 */
export class LyricsRenderer {
  private trackEl: HTMLElement;
  private views: LineView[] = [];
  private enters: number[];
  private roleKey = '';
  private lastLayout = '';
  private scrollY = 0;
  private viewportH = 0;
  private maxScroll = 0;
  private disposed = false;
  private onResize = () => this.measure();

  constructor(
    private root: HTMLElement,
    private track: LyricTrack,
    private styleAt: (t: number) => LyricStyle,
    private reducedMotion = false,
  ) {
    this.trackEl = document.createElement('div');
    this.trackEl.className = 'lyrics-track';
    this.trackEl.dir = 'rtl';
    root.appendChild(this.trackEl);

    const lines = track.lines;
    this.enters = lines.map((l, i) => (i === 0 ? l.start - 0.6 : Math.max(lines[i - 1].end, l.start - LEAD)));
    lines.forEach((line) => this.views.push(this.createView(line)));

    this.measure();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!this.disposed) this.measure(); // real metrics once the Persian font lands
      });
    }
    window.addEventListener('resize', this.onResize);
  }

  private findActive(t: number): number {
    const e = this.enters;
    let lo = 0, hi = e.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (e[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  update(t: number, dt: number, kick: number, energy: number) {
    const lines = this.track.lines;
    const idx = this.findActive(t);
    const held = idx >= 0 && t > lines[idx].end + HOLD;

    const key = `${idx}|${held ? 1 : 0}`;
    if (key !== this.roleKey) {
      this.roleKey = key;
      this.applyRoles(idx, held, t);
    }

    // the sung line refines its word states every frame
    if (idx >= 0 && !held) this.updateWords(this.views[idx], lines[idx], t);

    // layout follows the scene at the current time
    const style = this.styleAt(t);
    if (style.layout !== this.lastLayout) {
      this.lastLayout = style.layout;
      this.root.dataset.layout = style.layout;
    }

    this.scroll(idx, dt);

    this.root.style.setProperty('--kick', kick.toFixed(3));
    this.root.style.setProperty('--energy', energy.toFixed(3));
  }

  private updateWords(v: LineView, line: LyricLine, t: number) {
    let act = -1;
    for (let j = 0; j < line.words.length; j++) if (line.words[j].start <= t) act = j;
    for (let j = 0; j < line.words.length; j++) {
      let s: number;
      if (j < act) s = 2;
      else if (j === act) s = t < line.words[j].end + WORD_GRACE ? 1 : 2;
      else s = 0;
      this.setState(v, j, s);
    }
  }

  private setState(v: LineView, j: number, s: number) {
    if (v.states[j] === s) return;
    v.states[j] = s;
    v.words[j].dataset.s = String(s);
  }

  private setAll(v: LineView, s: number) {
    for (let j = 0; j < v.words.length; j++) this.setState(v, j, s);
  }

  private applyRoles(idx: number, held: boolean, t: number) {
    this.views.forEach((v, i) => {
      const role: Role = i < idx ? 'past' : i === idx && !held ? 'active' : 'future';
      if (v.role !== role) {
        v.role = role;
        v.el.dataset.role = role;
      }
      // static lines own their whole word colouring; the active one is stepped per word
      if (role === 'past') this.setAll(v, 2);
      else if (role === 'future') this.setAll(v, 0);
    });
    if (idx >= 0 && !held) this.updateWords(this.views[idx], this.track.lines[idx], t);
  }

  private createView(line: LyricLine): LineView {
    const style = this.styleAt(line.start);
    const el = document.createElement('div');
    el.className = 'line';
    el.lang = 'fa';
    el.dir = 'rtl';
    el.dataset.type = style.type;
    el.dataset.role = 'future';
    el.style.setProperty('--lscale', String(style.scale));
    el.style.setProperty('--pop', String(style.pop));
    const words = line.words.map((w) => {
      const s = document.createElement('span');
      s.className = 'word';
      s.textContent = w.text;
      s.dataset.s = '0';
      el.appendChild(s);
      return s;
    });
    this.trackEl.appendChild(el);
    return { el, words, states: words.map(() => 0), role: 'future', center: 0 };
  }

  private measure() {
    if (this.disposed || !this.views.length) return;
    this.viewportH = this.root.clientHeight || 1;
    for (const v of this.views) v.center = v.el.offsetTop + v.el.offsetHeight / 2;
    this.maxScroll = Math.max(0, this.trackEl.offsetHeight - this.viewportH);
  }

  private scroll(idx: number, dt: number) {
    if (!this.views.length) return;
    const anchor = this.views[Math.max(0, idx)];
    const target = Math.min(Math.max(anchor.center - this.viewportH * ANCHOR, 0), this.maxScroll);
    const diff = target - this.scrollY;
    if (Math.abs(diff) > this.viewportH * SNAP_VIEWPORTS) this.scrollY = target; // seek: arrive at once
    else this.scrollY = damp(this.scrollY, target, this.reducedMotion ? 14 : SCROLL_RATE, dt);
    this.trackEl.style.transform = `translate3d(0, ${(-this.scrollY).toFixed(2)}px, 0)`;
  }

  destroy() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.trackEl.remove();
    this.views = [];
  }
}
