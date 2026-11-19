/** Small illustrated shapes from the fundraising world. Pure SVG, colour via CSS vars. */

export function Coin({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="var(--gold)" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#071a33" strokeOpacity=".25" strokeWidth="2" />
      <path d="M24 13v22M29 17.5c-1-1.6-3-2.5-5-2.5-3 0-5 1.6-5 4s2 3.3 5 4 5 1.8 5 4.2-2.2 4-5 4c-2.3 0-4.3-1-5.2-2.7" fill="none" stroke="#071a33" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Envelope({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 56 40" aria-hidden>
      <rect x="1" y="1" width="54" height="38" rx="7" fill="var(--bg-raised)" stroke="var(--sky)" strokeWidth="2" />
      <path d="M3 5l25 18L53 5" fill="none" stroke="var(--sky)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="46" cy="8" r="6" fill="var(--gold)" />
    </svg>
  );
}

export function Rings({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 64 40" aria-hidden>
      <circle cx="22" cy="20" r="16" fill="none" stroke="var(--blue)" strokeWidth="4" />
      <circle cx="42" cy="20" r="16" fill="none" stroke="var(--mint)" strokeWidth="4" />
      <circle cx="32" cy="20" r="4" fill="var(--gold)" />
    </svg>
  );
}

export function Bars({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="28" width="9" height="16" rx="3" fill="var(--sky)" />
      <rect x="19" y="18" width="9" height="26" rx="3" fill="var(--blue)" />
      <rect x="34" y="6" width="9" height="38" rx="3" fill="var(--gold)" />
    </svg>
  );
}

export function Arrow({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill="var(--mint)" fillOpacity=".18" />
      <path d="M20 29V11M12 18l8-8 8 8" fill="none" stroke="var(--mint)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spark({ size = 26, color = "var(--sky)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" fill={color} />
    </svg>
  );
}

export function PointPill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="rounded-full px-3 py-1 font-display text-sm font-extrabold text-[#071a33] shadow-lg"
      style={{ background: color }}
    >
      {text}
    </span>
  );
}
