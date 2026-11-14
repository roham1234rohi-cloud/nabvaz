/** Used only when WebGL is unavailable: slow CSS smoke so the lyrics still sit on a cinematic backdrop. */
export default function FallbackBackdrop() {
  return (
    <div className="fallback" aria-hidden="true">
      <i /><i /><i />
    </div>
  );
}
