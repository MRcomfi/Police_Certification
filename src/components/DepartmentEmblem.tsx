/** Эмблема ПД: щит со звездой и полосой в цветах полиции. */
export function DepartmentEmblem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <path
        d="M24 2 44 9v17c0 14-9 24-20 28C13 50 4 40 4 26V9L24 2Z"
        fill="#12203d"
        stroke="#c7d4ec"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 7.5 39 13v13c0 10.5-6.6 18.4-15 21.8C15.6 44.4 9 36.5 9 26V13l15-5.5Z"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.2"
        opacity="0.7"
      />
      <polygon
        points="24,16 26.47,22.6 33.51,22.91 27.99,27.3 29.88,34.09 24,30.2 18.12,34.09 20.01,27.3 14.49,22.91 21.53,22.6"
        fill="#e9eef7"
      />
      <rect x="14" y="38.5" width="10" height="3" fill="#ef4444" />
      <rect x="24" y="38.5" width="10" height="3" fill="#3b82f6" />
    </svg>
  );
}
