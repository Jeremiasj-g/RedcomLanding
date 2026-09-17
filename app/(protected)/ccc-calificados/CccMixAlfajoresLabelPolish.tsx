"use client";

import { useEffect } from "react";

function updateLabels() {
  const host = document.getElementById("ccc-mix-alfajores-panel-host");
  if (!host) return;

  host
    .querySelectorAll<HTMLElement>("span.rounded-full.border-red-200")
    .forEach((badge) => {
      const text = String(badge.textContent || "").trim();
      if (!text.startsWith("MIX ")) return;
      badge.textContent = text.replace(/^MIX\s+/, "COMBOS VENDIDOS ");
    });
}

export default function CccMixAlfajoresLabelPolish() {
  useEffect(() => {
    updateLabels();
    const observer = new MutationObserver(updateLabels);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
