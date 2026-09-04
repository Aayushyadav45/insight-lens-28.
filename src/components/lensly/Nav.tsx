import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Nav = () => {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60">
      <div className="container max-w-6xl flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="relative size-8 rounded-xl bg-aurora flex items-center justify-center shadow-elegant">
            <Sparkles className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-xl">Lensly</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {[
            { to: '/', label: 'Analyze' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'px-3 py-1.5 rounded-full transition',
                pathname === l.to ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};