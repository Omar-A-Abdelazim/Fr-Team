/** Slow-drifting light pools + dot grid behind a section. Pure CSS, no JS. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="animate-drift absolute -left-32 -top-32 size-[520px] rounded-full bg-blue/25 blur-[120px]" />
      <div
        className="animate-drift absolute -right-40 top-1/3 size-[460px] rounded-full bg-gold/15 blur-[130px]"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="animate-drift absolute bottom-[-200px] left-1/3 size-[420px] rounded-full bg-sky/15 blur-[120px]"
        style={{ animationDelay: "-14s" }}
      />
    </div>
  );
}
