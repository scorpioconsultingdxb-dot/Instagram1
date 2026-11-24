import { useId } from 'react';

export function VieworaMark({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `viewora-grad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7957FF" />
          <stop offset="55%" stopColor="#8B6CFF" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      {/* Rounded precision squircle container */}
      <rect x="2" y="2" width="36" height="36" rx="11" fill={`url(#${gradId})`} />
      {/* Subtle inner glass highlight border */}
      <rect
        x="2.75"
        y="2.75"
        width="34.5"
        height="34.5"
        rx="10.25"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      {/* Interlocking V-prism aperture representing 'See Beyond the Profile' */}
      <path
        d="M11.5 13.5L20 28.5L28.5 13.5"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="14.5" r="2.75" fill="#FFFFFF" />
    </svg>
  );
}

export function VieworaLogo({
  size = 32,
  showTagline = false,
  className = '',
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <VieworaMark size={size} className="shrink-0 shadow-sm rounded-[11px]" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Viewora
        </span>
        {showTagline ? (
          <span className="mt-0.5 text-[10px] font-medium tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Explore More. Discover More.
          </span>
        ) : null}
      </span>
    </span>
  );
}
