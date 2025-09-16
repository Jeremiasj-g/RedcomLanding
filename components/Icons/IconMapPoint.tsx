export function IconMapPoint({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Forma de pin */}
      <path
        d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Círculo interior */}
      <circle
        cx="12"
        cy="9"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
      />
    </svg>
  );
}
