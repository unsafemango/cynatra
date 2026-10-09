// Slot-machine reel shown while the picker works.
const FRAMES = ["🎬", "🍿", "📺", "👻", "🚀", "💘", "🐉", "🤠", "🕵️", "😂"];

export function SpinLoader() {
  return (
    <div className="rounded-2xl border border-border bg-surface h-[360px] grid place-items-center" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <div className="flex gap-3">
          {[0, 1, 2].map((col) => (
            <div key={col} className="h-20 w-16 overflow-hidden rounded-xl bg-surface-2 border border-border">
              <div className="animate-reel" style={{ animationDuration: `${0.45 + col * 0.15}s` }}>
                {/* Two copies so the -50% loop is seamless; offset per column. */}
                {Array.from({ length: FRAMES.length * 2 }, (_, i) => (
                  <div key={i} className="h-20 grid place-items-center text-3xl">
                    {FRAMES[(i + col * 3) % FRAMES.length]}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">Spinning…</p>
      </div>
    </div>
  );
}
