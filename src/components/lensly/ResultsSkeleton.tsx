export const ResultsSkeleton = () => (
  <div className="space-y-6 animate-fade-up" aria-live="polite" aria-busy="true">
    <div className="grid md:grid-cols-[2fr,3fr] gap-6">
      <div className="aspect-square rounded-3xl bg-secondary/60 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent bg-[length:200%_100%] animate-shimmer" />
      </div>
      <div className="space-y-4">
        <div className="h-8 w-2/3 rounded-lg bg-secondary/60 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent bg-[length:200%_100%] animate-shimmer" />
        </div>
        <div className="h-4 w-full rounded bg-secondary/60" />
        <div className="h-4 w-5/6 rounded bg-secondary/60" />
        <div className="h-4 w-4/6 rounded bg-secondary/60" />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-secondary/60" />
          ))}
        </div>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      <div className="h-48 rounded-3xl bg-secondary/40" />
      <div className="h-48 rounded-3xl bg-secondary/40" />
    </div>
  </div>
);