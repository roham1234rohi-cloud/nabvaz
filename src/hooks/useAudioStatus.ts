import { useSyncExternalStore } from 'react';
import type { AudioEngine, AudioStatus } from '../audio/AudioEngine';

export function useAudioStatus(engine: AudioEngine): AudioStatus {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.status,
  );
}
