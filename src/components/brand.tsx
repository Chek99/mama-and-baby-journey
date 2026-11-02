/** Logo and illustrations as inline SVG (fast on slow networks). Colours come from design tokens. */

export function Logo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="var(--teal-deep)" />
      <circle cx="19" cy="17" r="6" fill="var(--cream)" />
      <path d="M8.5 37c1.6-8 6-12.5 10.5-12.5S27.5 28 29 33" fill="none" stroke="var(--cream)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="31" cy="27" r="4.2" fill="var(--sunny)" />
      <path d="M25 38c1-4.6 3.4-7 6-7s5 2.4 6 7" fill="var(--sunny)" />
    </svg>
  );
}

export function BrandMark({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="text-xl font-extrabold tracking-tight text-foreground">{name}</span>
    </span>
  );
}

/** Mother holding a baby, with a vaccine shield and a growing plant. */
export function MotherBabyIllustration({ className = "w-full max-w-[320px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={className} role="img" aria-hidden="true">
      <ellipse cx="160" cy="236" rx="130" ry="14" fill="var(--teal-soft)" />
      <circle cx="160" cy="118" r="98" fill="var(--mint)" />
      <circle cx="248" cy="52" r="20" fill="var(--sunny)" opacity="0.9" />
      {/* plant */}
      <path d="M60 232c0-30 2-52 6-70" stroke="var(--success)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M64 190c-16-4-24-16-24-28 14 0 24 10 24 28Z" fill="var(--success)" />
      <path d="M66 170c14-6 26-2 32 8-12 6-24 4-32-8Z" fill="var(--success)" opacity="0.8" />
      {/* mother */}
      <path d="M112 236c0-52 20-86 52-86s52 34 52 86Z" fill="var(--lavender)" />
      <circle cx="164" cy="104" r="30" fill="var(--warning-ink)" />
      <path d="M134 98c0-22 14-36 32-36 20 0 30 16 30 30-10-8-26-12-42-6-8 3-14 8-20 12Z" fill="var(--navy)" />
      <path d="M152 112c4 4 12 4 16 0" stroke="var(--navy)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* baby */}
      <path d="M128 186c10-18 30-26 52-22 14 2 26 10 30 22-20 14-58 16-82 0Z" fill="var(--cream)" />
      <circle cx="184" cy="168" r="15" fill="var(--warning-ink)" />
      <path d="M172 162c4-8 16-10 24-2" stroke="var(--navy)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* shield */}
      <path d="M244 140l26 10v20c0 18-12 30-26 36-14-6-26-18-26-36v-20Z" fill="var(--coral)" />
      <path d="M233 172l8 8 14-16" stroke="var(--cream)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* hearts */}
      <path d="M96 76c-4-6 4-12 8-6 4-6 12 0 8 6l-8 8Z" fill="var(--coral)" />
      <path d="M220 96c-3-4 3-9 6-5 3-4 9 1 6 5l-6 6Z" fill="var(--lavender-ink)" />
    </svg>
  );
}

export function SuccessIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto size-28 animate-tick" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="var(--success-soft)" />
      <circle cx="60" cy="60" r="38" fill="var(--success)" />
      <path d="M42 61l12 12 24-26" stroke="var(--cream)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="98" cy="22" r="6" fill="var(--sunny)" />
      <circle cx="18" cy="96" r="4" fill="var(--sunny)" />
      <circle cx="104" cy="92" r="3" fill="var(--lavender)" />
    </svg>
  );
}
