"use client";

import { useEffect } from "react";

const COMPETITION_END = new Date("2026-10-01T00:00:00-03:00").getTime();

function toneForRemaining() {
  const remaining = Math.max(0, COMPETITION_END - Date.now());
  const days = remaining / 86_400_000;
  if (remaining <= 0 || days <= 4) return "red";
  if (days <= 7) return "yellow";
  return "green";
}

function decorate() {
  const host = document.getElementById("ccc-alfajores-competition-panel-host");
  if (!host) return;

  host.dataset.countdownTone = toneForRemaining();

  host.querySelectorAll<HTMLElement>(".font-mono").forEach((value) => {
    value.classList.add("ccc-comp-count-value");
    const box = value.parentElement;
    box?.classList.add("ccc-comp-count-box");
    const grid = box?.parentElement;
    grid?.classList.add("ccc-comp-count-grid");
    grid?.parentElement?.classList.add("ccc-comp-count-wrap");
  });
}

export default function CccCompetitionCountdownPolish() {
  useEffect(() => {
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(decorate, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <style>{`
      #ccc-alfajores-competition-panel-host .ccc-comp-count-wrap {
        min-width: min(100%, 520px);
        gap: 10px !important;
      }

      #ccc-alfajores-competition-panel-host .ccc-comp-count-grid {
        gap: 10px !important;
      }

      #ccc-alfajores-competition-panel-host .ccc-comp-count-box {
        min-width: 94px !important;
        min-height: 92px !important;
        padding: 14px 16px !important;
        border-radius: 16px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255,255,255,.055) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }

      #ccc-alfajores-competition-panel-host .ccc-comp-count-value {
        font-size: clamp(2rem, 3vw, 2.85rem) !important;
        line-height: 1 !important;
        letter-spacing: -0.04em !important;
        font-weight: 850 !important;
        transition: color .25s ease, text-shadow .25s ease;
      }

      #ccc-alfajores-competition-panel-host .ccc-comp-count-box > div:last-child {
        margin-top: 8px !important;
        font-size: 10px !important;
        letter-spacing: .1em !important;
      }

      #ccc-alfajores-competition-panel-host[data-countdown-tone="green"] .ccc-comp-count-value {
        color: #34d399 !important;
        text-shadow: 0 0 24px rgba(52,211,153,.18);
      }
      #ccc-alfajores-competition-panel-host[data-countdown-tone="green"] .ccc-comp-count-box {
        border-color: rgba(52,211,153,.18) !important;
      }

      #ccc-alfajores-competition-panel-host[data-countdown-tone="yellow"] .ccc-comp-count-value {
        color: #fbbf24 !important;
        text-shadow: 0 0 24px rgba(251,191,36,.2);
      }
      #ccc-alfajores-competition-panel-host[data-countdown-tone="yellow"] .ccc-comp-count-box {
        border-color: rgba(251,191,36,.22) !important;
      }

      #ccc-alfajores-competition-panel-host[data-countdown-tone="red"] .ccc-comp-count-value {
        color: #fb7185 !important;
        text-shadow: 0 0 24px rgba(251,113,133,.2);
      }
      #ccc-alfajores-competition-panel-host[data-countdown-tone="red"] .ccc-comp-count-box {
        border-color: rgba(251,113,133,.22) !important;
      }

      @media (max-width: 720px) {
        #ccc-alfajores-competition-panel-host .ccc-comp-count-box {
          min-width: 0 !important;
          min-height: 80px !important;
          padding: 11px 8px !important;
        }
        #ccc-alfajores-competition-panel-host .ccc-comp-count-value {
          font-size: 1.8rem !important;
        }
      }
    `}</style>
  );
}
