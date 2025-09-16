export function IconAnalytics({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Ejes */}
      <path d="M3 19.5h18M3.5 5v14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Área bajo la curva (suave) */}
      <path
        d="M5 16L9 12L13 14.5L17 9L21 12V19.5H5V16Z"
        fill="currentColor"
        opacity=".12"
      />

      {/* Línea de tendencia */}
      <path
        d="M5 16L9 12L13 14.5L17 9L21 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Puntos de datos */}
      <circle cx="5" cy="16" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="13" cy="14.5" r="1" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
      <circle cx="21" cy="12" r="1" fill="currentColor" />

      {/* Barras sutiles (refuerzan el look de dashboard) */}
      <rect x="6"  y="13" width="1.8" height="6.5" rx=".9" fill="currentColor" opacity=".18" />
      <rect x="10" y="15" width="1.8" height="4.5" rx=".9" fill="currentColor" opacity=".18" />
      <rect x="14" y="11" width="1.8" height="8.5" rx=".9" fill="currentColor" opacity=".18" />
      <rect x="18" y="14" width="1.8" height="5.5" rx=".9" fill="currentColor" opacity=".18" />
    </svg>
  );
}
