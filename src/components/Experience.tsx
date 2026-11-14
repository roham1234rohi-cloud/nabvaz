import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { World } from '../effects/World';
import { LyricsRenderer } from '../lyrics/LyricsRenderer';
import { SceneDirector } from '../scenes/SceneDirector';
import { lyricStyleAt } from '../scenes/scenes';
import type { LyricTrack } from '../types';
import { detectQuality } from '../utils/device';
import FallbackBackdrop from './FallbackBackdrop';

interface Props {
  engine: AudioEngine;
  track: LyricTrack | null;
  phase: 'gate' | 'intro' | 'play';
  reducedMotion: boolean;
}

/** Owns the single animation loop: audio clock -> analysis -> scenes -> 3D world + lyrics + progress. */
export default function Experience({ engine, track, phase, reducedMotion }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LyricsRenderer | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [fallback, setFallback] = useState(false);

  // lyric stage: created once the parsed track arrives (the JSON loads after mount)
  useEffect(() => {
    if (!track || !lyricsRef.current) return;
    const renderer = new LyricsRenderer(lyricsRef.current, track, lyricStyleAt, reducedMotion);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [track, reducedMotion]);

  useEffect(() => {
    const stage = stageRef.current!;
    let world: World | null = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        world = new World({
          canvas,
          quality: detectQuality(),
          reducedMotion,
          onContextLost: () => setFallback(true),
        });
      } catch (err) {
        console.warn('[NAVAZESH] WebGL unavailable, using the CSS fallback backdrop.', err);
        world = null;
        setFallback(true);
      }
    }

    const director = new SceneDirector();

    const resize = () => {
      const r = stage.getBoundingClientRect();
      world?.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = (now - last) / 1000;
      last = now;
      const safeDt = Math.min(0.1, dt);
      const t = engine.currentTime;
      engine.analyse(safeDt);
      const bands = engine.bands;
      const params = director.update(t, safeDt);
      world?.update(dt, bands, params, director.flash, pointer.current);
      rendererRef.current?.update(t, safeDt, reducedMotion ? 0 : bands.kick, bands.energy);
      if (barRef.current) barRef.current.style.transform = `scaleX(${engine.progress.toFixed(4)})`;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      world?.dispose();
    };
    // the world and the loop are built once; the engine never changes for the lifetime of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stage" ref={stageRef}>
      {fallback ? <FallbackBackdrop /> : <canvas ref={canvasRef} className="world" aria-hidden="true" />}
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="lyrics-wrap" data-phase={phase}>
        <div className="lyrics" ref={lyricsRef} data-layout="center" role="region" aria-label="Lyrics" />
      </div>
      <div className="progress" aria-hidden="true">
        <div className="bar" ref={barRef} />
      </div>
    </div>
  );
}
