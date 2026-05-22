export function ShieldLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 120"
        className="w-full h-full"
        aria-label="Cognivern Shield"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="innerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
          <filter id="shieldShadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3" />
          </filter>
        </defs>
        <path
          d="M50 5 L10 25 V55 C10 85 27 105 50 115 C73 105 90 85 90 55 V25 L50 5Z"
          fill="url(#shieldGrad)"
          filter="url(#shieldShadow)"
        />
        <path
          d="M50 10 L15 28 V55 C15 80 30 98 50 108"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="50" cy="55" r="35" fill="url(#innerGrad)" />
        <g transform="translate(50, 50)">
          <rect x="-12" y="-5" width="24" height="18" rx="3" fill="white" />
          <path
            d="M-8 -5 V-10 A8 8 0 0 1 8 -10 V-5"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="0" cy="5" r="3" fill="#0284c7" />
        </g>
      </svg>
    </div>
  );
}
