import type { Bands } from '../types';
import { clamp, damp } from '../utils/math';

export type AudioStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
type Listener = () => void;

interface BandTrack {
  avg: number;
  peak: number;
  prevNorm: number;
}

/**
 * Wraps one HTMLAudioElement and a Web Audio AnalyserNode.
 * `el.currentTime` is the single clock used by lyrics and scenes.
 */
export class AudioEngine {
  readonly el: HTMLAudioElement;
  readonly bands: Bands = { bass: 0, mid: 0, high: 0, energy: 0, kick: 0 };
  status: AudioStatus = 'loading';
  errorMessage: string | null = null;
  analyserAvailable = false;

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freq = new Uint8Array(1024);
  private listeners = new Set<Listener>();
  private priming: Promise<void> | null = null;
  private tracks: Record<'bass' | 'mid' | 'high', BandTrack> = {
    bass: { avg: 0.4, peak: 0.5, prevNorm: 0 },
    mid: { avg: 0.3, peak: 0.4, prevNorm: 0 },
    high: { avg: 0.1, peak: 0.2, prevNorm: 0 },
  };

  constructor(src: string) {
    const el = new Audio();
    el.preload = 'auto';
    el.loop = false;
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    this.el = el;

    el.addEventListener('loadedmetadata', () => this.setStatus(this.status === 'loading' ? 'ready' : this.status));
    el.addEventListener('canplay', () => this.setStatus(this.status === 'loading' ? 'ready' : this.status));
    el.addEventListener('playing', () => this.setStatus('playing'));
    el.addEventListener('pause', () => {
      if (!el.ended && this.status !== 'error') this.setStatus(this.status === 'loading' ? 'loading' : 'paused');
    });
    el.addEventListener('ended', () => this.setStatus('ended'));
    el.addEventListener('error', () => {
      const code = el.error?.code;
      this.errorMessage =
        code === 4
          ? 'The audio file is missing or its format is not supported.'
          : 'The audio could not be loaded.';
      this.setStatus('error');
    });
    el.src = src;
    el.load();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setStatus(s: AudioStatus) {
    if (this.status === s) return;
    this.status = s;
    this.listeners.forEach((l) => l());
  }

  get currentTime() {
    return this.el.currentTime || 0;
  }
  get duration() {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }
  get progress() {
    const d = this.duration;
    return d > 0 ? clamp(this.currentTime / d) : 0;
  }
  get isPlaying() {
    return !this.el.paused && !this.el.ended;
  }

  /** Must be called from a user gesture: creates the AudioContext and primes the element (iOS/Safari). */
  unlock(): Promise<void> {
    if (this.priming) return this.priming;
    this.priming = (async () => {
      if (!this.ctx) {
        try {
          const AC: typeof AudioContext | undefined =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AC) {
            const ctx = new AC();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.7;
            const source = ctx.createMediaElementSource(this.el);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            this.ctx = ctx;
            this.analyser = analyser;
            this.freq = new Uint8Array(analyser.frequencyBinCount);
            this.analyserAvailable = true;
          }
        } catch (err) {
          console.warn('[NAVAZESH] Web Audio analysis unavailable, playing without reactivity.', err);
          this.analyserAvailable = false;
        }
      }
      try {
        await this.ctx?.resume();
      } catch {
        /* ignore */
      }
      try {
        this.el.muted = true;
        await this.el.play();
        this.el.pause();
        this.el.currentTime = 0;
      } catch {
        /* priming is best effort */
      } finally {
        this.el.muted = false;
      }
    })();
    return this.priming;
  }

  async play(): Promise<boolean> {
    try {
      if (this.priming) await this.priming;
      if (this.el.ended || (this.duration > 0 && this.currentTime >= this.duration - 0.05)) this.el.currentTime = 0;
      await this.ctx?.resume();
      await this.el.play();
      return true;
    } catch (err) {
      console.warn('[NAVAZESH] play() was blocked or failed', err);
      return false;
    }
  }

  pause() {
    this.el.pause();
  }

  toggle() {
    return this.isPlaying ? (this.pause(), Promise.resolve(false)) : this.play();
  }

  /** Reads the analyser and updates smoothed band values. Call once per frame. */
  analyse(dt: number) {
    const b = this.bands;
    const an = this.analyser;
    if (!an || !this.ctx || this.el.paused) {
      const k = Math.exp(-dt * 4);
      b.bass *= k; b.mid *= k; b.high *= k; b.energy *= k; b.kick *= k;
      return;
    }
    an.getByteFrequencyData(this.freq);
    const binHz = this.ctx.sampleRate / 2 / this.freq.length;
    const avg = (lo: number, hi: number) => {
      const a = Math.max(0, Math.floor(lo / binHz));
      const z = Math.min(this.freq.length - 1, Math.ceil(hi / binHz));
      let s = 0;
      for (let i = a; i <= z; i++) s += this.freq[i];
      return s / ((z - a + 1) * 255);
    };
    const raw = { bass: avg(30, 160), mid: avg(160, 2200), high: avg(2200, 12000) };

    // Adaptive normalisation so loud, compressed masters still show dynamics.
    const norm = (key: 'bass' | 'mid' | 'high') => {
      const t = this.tracks[key];
      const r = raw[key];
      t.avg = damp(t.avg, r, 0.3, dt);
      t.peak = Math.max(r, t.peak * Math.exp(-dt * 0.05), 0.05);
      const floor = t.avg * 0.7;
      return clamp((r - floor) / (t.peak - floor + 0.001));
    };
    const nb = norm('bass');
    const nm = norm('mid');
    const nh = norm('high');

    const smooth = (cur: number, target: number) => damp(cur, target, target > cur ? 18 : 5, dt);
    b.bass = smooth(b.bass, nb);
    b.mid = smooth(b.mid, nm);
    b.high = smooth(b.high, nh);
    b.energy = b.bass * 0.5 + b.mid * 0.3 + b.high * 0.2;

    const flux = Math.max(0, nb - this.tracks.bass.prevNorm);
    this.tracks.bass.prevNorm = nb;
    b.kick = clamp(Math.max(b.kick * Math.exp(-dt * 6), flux * 3));
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    this.listeners.clear();
    void this.ctx?.close().catch(() => undefined);
  }
}
