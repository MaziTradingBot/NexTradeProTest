import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="nxp-g" x1="0" y1="0" x2="40" y2="40">
            <stop stopColor="#0B6EFF" />
            <stop offset="1" stopColor="#00C896" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#nxp-g)" />
        <path
          d="M12 27V13l8 9 8-9v14"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="28" cy="13" r="2.4" fill="#F5B301" />
      </svg>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-white">
          NexTrade<span className="text-brand-blue">Pro</span>
        </span>
      )}
    </div>
  );
}
