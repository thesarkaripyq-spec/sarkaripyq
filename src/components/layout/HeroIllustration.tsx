// Original geometric illustration (no traced/copied artwork) - a stylized
// quiz-card mockup for the homepage hero: a question with four options, one
// marked correct, plus a floating "verified" badge.
export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 420 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label="A practice question card showing four options with the correct one checked"
    >
      <circle cx="210" cy="180" r="170" fill="#EFF6FF" />

      {/* floating decorative shapes */}
      <circle cx="55" cy="70" r="10" fill="#BFDBFE" />
      <circle cx="375" cy="290" r="14" fill="#93C5FD" />
      <rect x="330" y="45" width="22" height="22" rx="6" fill="#DBEAFE" transform="rotate(18 341 56)" />

      {/* card */}
      <rect x="55" y="55" width="310" height="250" rx="20" fill="white" />
      <rect x="55" y="55" width="310" height="250" rx="20" stroke="#E4E4E7" strokeWidth="1.5" />

      {/* window chrome dots */}
      <circle cx="80" cy="80" r="4.5" fill="#E4E4E7" />
      <circle cx="96" cy="80" r="4.5" fill="#E4E4E7" />
      <circle cx="112" cy="80" r="4.5" fill="#E4E4E7" />
      <rect x="300" y="75" width="45" height="10" rx="5" fill="#F4F4F5" />

      {/* question label */}
      <rect x="80" y="102" width="36" height="14" rx="4" fill="#2563EB" />
      <text x="86" y="112" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="white">
        Q42
      </text>

      {/* question text lines */}
      <rect x="80" y="128" width="250" height="9" rx="4.5" fill="#1F2937" />
      <rect x="80" y="144" width="190" height="9" rx="4.5" fill="#1F2937" />

      {/* option rows */}
      <g>
        <rect x="80" y="172" width="250" height="30" rx="8" fill="#F4F4F5" />
        <circle cx="96" cy="187" r="7" fill="white" stroke="#A1A1AA" strokeWidth="1.5" />
        <rect x="112" y="183" width="150" height="8" rx="4" fill="#71717A" />
      </g>

      <g>
        <rect x="80" y="210" width="250" height="30" rx="8" fill="#EFF6FF" />
        <circle cx="96" cy="225" r="7" fill="#2563EB" />
        <path d="M92.5 225l2.5 2.5 5-5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="112" y="221" width="170" height="8" rx="4" fill="#1D4ED8" />
      </g>

      <g>
        <rect x="80" y="248" width="250" height="30" rx="8" fill="#F4F4F5" />
        <circle cx="96" cy="263" r="7" fill="white" stroke="#A1A1AA" strokeWidth="1.5" />
        <rect x="112" y="259" width="130" height="8" rx="4" fill="#71717A" />
      </g>

      {/* floating verified badge */}
      <g transform="translate(300 250)">
        <circle cx="0" cy="0" r="34" fill="white" stroke="#E4E4E7" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="22" fill="#2563EB" />
        <path d="M-9 0l6 6 12-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
