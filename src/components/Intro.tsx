import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface Props {
  phase: 'gate' | 'intro' | 'play';
  ready: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
  onDone: () => void;
}

/** Gate (needed for the browser's audio gesture) followed by a ~4.5 s cinematic title reveal. */
export default function Intro({ phase, ready, reducedMotion, onEnter, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (phase !== 'intro') return;
    const ctx = gsap.context(() => {
      const R = reducedMotion ? 0.6 : 1;
      const tl = gsap.timeline({ onComplete: () => doneRef.current() });
      tl.to(gateRef.current, { opacity: 0, duration: 0.5 * R, ease: 'power2.out' }, 0)
        .to(veilRef.current, { opacity: 0.1, duration: 3 * R, ease: 'power1.inOut' }, 0.2 * R)
        .fromTo(
          titleRef.current,
          { opacity: 0, letterSpacing: '0.95em', filter: 'blur(14px)' },
          { opacity: 1, letterSpacing: '0.52em', filter: 'blur(0px)', duration: 2.2 * R, ease: 'power3.out' },
          0.7 * R,
        )
        .fromTo(titleRef.current, { '--lx': '-30%' }, { '--lx': '130%', duration: 3 * R, ease: 'power1.inOut' }, 0.6 * R)
        .fromTo(subRef.current, { opacity: 0, y: 12 }, { opacity: 0.85, y: 0, duration: 1.1 * R, ease: 'power2.out' }, 2.1 * R)
        .to([titleRef.current, subRef.current], { opacity: 0, duration: 0.7 * R, ease: 'power2.in' }, 3.9 * R)
        .to(veilRef.current, { opacity: 0, duration: 0.7 * R, ease: 'power1.in' }, 3.9 * R);
    }, rootRef);
    return () => ctx.revert();
  }, [phase, reducedMotion]);

  if (phase === 'play') return null;

  return (
    <div className="intro" ref={rootRef}>
      <div className="intro-veil" ref={veilRef} />
      <h1 className="intro-title" ref={titleRef} lang="en" dir="ltr">NAVAZESH</h1>
      <p className="intro-sub" ref={subRef} lang="en" dir="ltr">Navaesh by Amir Tataloo</p>
      <button
        ref={gateRef}
        className="gate"
        onClick={onEnter}
        disabled={!ready || phase !== 'gate'}
        aria-label="Enter — ورود"
      >
        <span className="gate-line" />
        <span className="gate-en">{ready ? 'ENTER' : '···'}</span>
        <span className="gate-fa">ورود</span>
      </button>
    </div>
  );
}
