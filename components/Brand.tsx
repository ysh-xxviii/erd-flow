export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="6"
        width="12"
        height="9"
        rx="2.5"
        fill="#131a2b"
        stroke="#5aa6ff"
        strokeWidth="2"
      />
      <rect
        x="18"
        y="17"
        width="12"
        height="9"
        rx="2.5"
        fill="#131a2b"
        stroke="#ef8a52"
        strokeWidth="2"
      />
      <path
        d="M11 14.5 Q16 20 21 18.5"
        stroke="#8b7bff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <span className="text-lg font-semibold tracking-tight text-ink">
        ERD<span className="text-accent-blue">Flow</span>
      </span>
    </div>
  );
}
