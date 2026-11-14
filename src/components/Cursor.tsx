import { useEffect, useRef } from 'react';

/** Custom cinematic cursor for fine pointers (desktop) only. */
export default function Cursor({ reducedMotion }: { reducedMotion: boolean }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    document.body.classList.add('cursor-on');
    let x = window.innerWidth / 2, y = window.innerHeight / 2, rx = x, ry = y, raf = 0;
    let hover = false;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      const t = e.target as HTMLElement | null;
      hover = !!t?.closest('button, [data-cursor="hover"]');
      if (dot.current) dot.current.style.opacity = '1';
      if (ring.current) ring.current.style.opacity = '1';
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const k = reducedMotion ? 1 : 0.16;
      rx += (x - rx) * k; ry += (y - ry) * k;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%) scale(${hover ? 1.7 : 1})`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.body.classList.remove('cursor-on');
    };
  }, [reducedMotion]);

  return (
    <>
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
    </>
  );
}
