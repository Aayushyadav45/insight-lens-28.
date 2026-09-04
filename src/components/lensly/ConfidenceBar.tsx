interface Props { value: number; label: string }

export const ConfidenceBar = ({ value, label }: Props) => {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 80 ? 'bg-aurora' : v >= 50 ? 'bg-primary/70' : 'bg-muted-foreground/50';
  return (
    <div className="group flex items-center gap-3 rounded-2xl glass px-4 py-2.5">
      <span className="text-sm font-medium flex-1 truncate">{label}</span>
      <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground tabular-nums w-9 text-right">{v}%</span>
    </div>
  );
};