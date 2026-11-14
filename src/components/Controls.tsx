import { useEffect, useRef, useState } from 'react';
import type { AudioStatus } from '../audio/AudioEngine';

interface Props {
  status: AudioStatus;
  visible: boolean;
  onToggle: () => void;
}

export default function Controls({ status, visible, onToggle }: Props) {
  const playing = status === 'playing';
  const [awake, setAwake] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const wake = () => {
      setAwake(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setAwake(false), 3200);
    };
    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = visible && (awake || !playing);
  const label = playing ? 'توقف · Pause' : status === 'ended' ? 'پخش دوباره · Replay' : 'پخش · Play';

  return (
    <button
      className="ctrl"
      data-show={show ? '1' : '0'}
      onClick={onToggle}
      aria-label={label}
      title={label}
      data-cursor="hover"
    >
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" strokeWidth="1" />
        {playing ? (
          <g fill="currentColor">
            <rect x="18" y="16" width="3" height="16" rx="0.5" />
            <rect x="27" y="16" width="3" height="16" rx="0.5" />
          </g>
        ) : (
          <path d="M20 15.5 L33 24 L20 32.5 Z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}
