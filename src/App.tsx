import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import Controls from './components/Controls';
import Cursor from './components/Cursor';
import ErrorScreen from './components/ErrorScreen';
import Experience from './components/Experience';
import Intro from './components/Intro';
import { useAudioStatus } from './hooks/useAudioStatus';
import { useReducedMotion } from './hooks/useReducedMotion';
import { LyricsError, parseLyrics } from './lyrics/adapter';
import type { LyricTrack } from './types';

const BASE = import.meta.env.BASE_URL;
const AUDIO_SRC = `${BASE}audio/Amir_Tataloo_-_Navazesh__320_.mp3`;
const LYRICS_SRC = `${BASE}data/Amir_Tataloo_-_Navazesh__320_.json`;

type Phase = 'gate' | 'intro' | 'play';
interface LyricState {
  done: boolean;
  track: LyricTrack | null;
  error: string | null;
}

export default function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine(AUDIO_SRC);
  const engine = engineRef.current;

  const reduced = useReducedMotion();
  const status = useAudioStatus(engine);
  const [phase, setPhase] = useState<Phase>('gate');
  const [lyrics, setLyrics] = useState<LyricState>({ done: false, track: null, error: null });
  const [waited, setWaited] = useState(false);

  // lyrics: fetch + adapt (never blocks the music if it fails)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(LYRICS_SRC);
        if (!res.ok) throw new LyricsError(`Lyric file not found (${res.status}).`);
        const json: unknown = await res.json();
        const track = parseLyrics(json);
        track.warnings.forEach((w) => console.info('[NAVAZESH lyrics]', w));
        if (!cancelled) setLyrics({ done: true, track, error: null });
      } catch (err) {
        console.warn('[NAVAZESH] lyrics unavailable', err);
        const msg = err instanceof SyntaxError ? 'The lyric file is not valid JSON.' : err instanceof Error ? err.message : 'Lyrics failed to load.';
        if (!cancelled) setLyrics({ done: true, track: null, error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // some mobile browsers never fire metadata events before a gesture; don't wait forever
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => () => engine.dispose(), [engine]);

  const ready = lyrics.done && (status !== 'loading' || waited);

  const onEnter = useCallback(() => {
    setPhase('intro');
    void engine.unlock();
  }, [engine]);

  const onIntroDone = useCallback(() => {
    setPhase('play');
    void engine.play();
  }, [engine]);

  const toggle = useCallback(() => {
    void engine.toggle();
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'play') return;
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, toggle]);

  if (status === 'error') {
    return (
      <ErrorScreen
        titleFa="فایل صوتی بارگذاری نشد"
        title="The song could not be loaded"
        detail={engine.errorMessage ?? undefined}
      />
    );
  }

  return (
    <>
      <Experience engine={engine} track={lyrics.track} phase={phase} reducedMotion={reduced} />
      <Intro phase={phase} ready={ready} reducedMotion={reduced} onEnter={onEnter} onDone={onIntroDone} />
      <Controls status={status} visible={phase === 'play'} onToggle={toggle} />
      {phase === 'play' && lyrics.error && (
        <p className="notice" lang="en" dir="ltr">Lyrics unavailable — {lyrics.error}</p>
      )}
      <Cursor reducedMotion={reduced} />
    </>
  );
}
