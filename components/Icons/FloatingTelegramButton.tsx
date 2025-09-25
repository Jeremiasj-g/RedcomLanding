'use client';

export default function FloatingTelegramButton() {
  const href = "https://t.me/redcom_sa_bot";

  return (
    <div className="tg-wrapper">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatea con nuestro RedcomBot en Telegram"
        className="tg-fab"
      >
        {/* Pulsos detrás del icono */}
        <span className="tg-pulse" aria-hidden="true"></span>
        <span className="tg-pulse tg-delay" aria-hidden="true"></span>

        {/* Leyenda */}
        <span className="tg-label">
          Chatea con <strong>RedcomBot</strong>
        </span>

        {/* Botón redondo con icono */}
        <span className="tg-btn" aria-hidden="true">
          {/* Icono Telegram en SVG (sin dependencias) */}
          <svg viewBox="0 0 24 24" className="tg-icon" fill="none">
            <path
              d="M21.543 5.49a1.5 1.5 0 0 0-2.03-.56L3.82 13.29c-.95.48-.8 1.9.22 2.18l3.9 1.09 1.38 4.09c.33.98 1.62 1.1 2.1.2l2.12-3.92 4.22 3.08c.86.63 2.08.16 2.32-.9l2.17-10.02a1.5 1.5 0 0 0-.61-1.58Z"
              fill="currentColor"
              opacity=".92"
            />
            <path
              d="M9.2 15.22 18.1 8.5c.22-.17 0-.5-.24-.37l-9.9 5.22c-.19.1-.28.33-.2.54l1.44 3.77c.07.18.33.2.43.04l1.68-2.5c.07-.11.06-.26-.02-.36-.25-.33-.67-.29-.99-.12Z"
              fill="white"
              opacity=".9"
            />
          </svg>
        </span>
      </a>
    </div>
  );
}
