"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const ENHANCED_ATTR = "data-ccc-radix-select";

type Binding = {
  key: string;
  select: HTMLSelectElement;
  host: HTMLSpanElement;
};

type NativeOption = {
  value: string;
  label: string;
  disabled: boolean;
};

function readNativeOptions(select: HTMLSelectElement): NativeOption[] {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent || option.label || option.value,
    disabled: option.disabled,
  }));
}

function NativeSelectProxy({ select }: { select: HTMLSelectElement }) {
  const [value, setValue] = useState(select.value);
  const [disabled, setDisabled] = useState(select.disabled);
  const [options, setOptions] = useState<NativeOption[]>(() => readNativeOptions(select));

  useEffect(() => {
    const sync = () => {
      setValue(select.value);
      setDisabled(select.disabled);
      setOptions(readNativeOptions(select));
    };

    sync();
    select.addEventListener("change", sync);
    select.addEventListener("input", sync);

    const observer = new MutationObserver(sync);
    observer.observe(select, {
      attributes: true,
      attributeFilter: ["disabled", "value"],
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      select.removeEventListener("change", sync);
      select.removeEventListener("input", sync);
    };
  }, [select]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || "Seleccionar…",
    [options, value],
  );

  const choose = (nextValue: string) => {
    if (select.value === nextValue) return;
    select.value = nextValue;
    setValue(nextValue);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <Select.Root value={value} onValueChange={choose} disabled={disabled}>
      <Select.Trigger
        aria-label={select.getAttribute("aria-label") || select.title || selectedLabel}
        title={select.title || undefined}
        className="group inline-flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-xs font-semibold text-slate-800 shadow-sm outline-none transition hover:border-slate-400 hover:bg-slate-50 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10 data-[disabled]:cursor-not-allowed data-[disabled]:bg-slate-100 data-[disabled]:text-slate-400 data-[disabled]:opacity-70"
      >
        <Select.Value aria-label={selectedLabel}>
          <span className="block min-w-0 flex-1 truncate">{selectedLabel}</span>
        </Select.Value>
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100000] min-w-[var(--radix-select-trigger-width)] max-w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
        >
          <Select.Viewport className="max-h-[300px] overflow-y-auto p-1">
            {options.map((option, index) => (
              <Select.Item
                key={`${option.value}:${index}`}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-xs font-medium text-slate-700 outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 data-[state=checked]:font-semibold"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex items-center justify-center text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function CccSelectEnhancer() {
  const [bindings, setBindings] = useState<Binding[]>([]);

  useEffect(() => {
    let frame = 0;
    let sequence = 0;

    const scan = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>(".ccc-page");
      if (!root) {
        setBindings([]);
        return;
      }

      root.querySelectorAll<HTMLSelectElement>(`select:not([${ENHANCED_ATTR}])`).forEach((select) => {
        const host = document.createElement("span");
        const key = `ccc-select-${Date.now()}-${sequence++}`;
        host.dataset.cccRadixHost = key;
        host.className = "ccc-radix-select-host block min-w-0 w-full";
        select.insertAdjacentElement("beforebegin", host);
        select.setAttribute(ENHANCED_ATTR, "true");
        select.dataset.cccPreviousDisplay = select.style.display || "";
        select.style.setProperty("display", "none", "important");
      });

      const next: Binding[] = [];
      root.querySelectorAll<HTMLSelectElement>(`select[${ENHANCED_ATTR}="true"]`).forEach((select) => {
        const host = select.previousElementSibling as HTMLSpanElement | null;
        if (!host?.dataset.cccRadixHost) return;
        next.push({ key: host.dataset.cccRadixHost, select, host });
      });
      setBindings(next);
    };

    const scheduleScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("ccc:selects-refresh", scheduleScan);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("ccc:selects-refresh", scheduleScan);

      document.querySelectorAll<HTMLSelectElement>(`select[${ENHANCED_ATTR}="true"]`).forEach((select) => {
        const host = select.previousElementSibling as HTMLSpanElement | null;
        if (host?.dataset.cccRadixHost) host.remove();
        const previousDisplay = select.dataset.cccPreviousDisplay || "";
        select.style.display = previousDisplay;
        select.removeAttribute(ENHANCED_ATTR);
        delete select.dataset.cccPreviousDisplay;
      });
    };
  }, []);

  return (
    <>
      {bindings.map(({ key, select, host }) =>
        host.isConnected ? createPortal(<NativeSelectProxy select={select} />, host, key) : null,
      )}
    </>
  );
}
