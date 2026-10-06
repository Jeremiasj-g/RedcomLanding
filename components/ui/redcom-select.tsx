"use client";

import * as Popover from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Command } from "cmdk";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export type RedcomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string[];
};

type SelectAccent = "red" | "indigo" | "teal";
type TriggerTone = "neutral" | "blue" | "green" | "amber" | "red";

const darkTriggerToneStyles: Record<TriggerTone, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-[#f5f5f7]",
  blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  red: "border-rose-400/20 bg-rose-400/10 text-rose-200",
};

const accentStyles: Record<
  SelectAccent,
  {
    trigger: string;
    icon: string;
    openIcon: string;
    item: string;
    indicator: string;
  }
> = {
  red: {
    trigger:
      "hover:border-slate-300 hover:bg-slate-50/70 focus-visible:border-slate-950 focus-visible:ring-slate-950/5 data-[state=open]:border-slate-950 data-[state=open]:ring-slate-950/5",
    icon: "group-hover:bg-red-50 group-hover:text-red-600",
    openIcon: "group-data-[state=open]:bg-slate-950 group-data-[state=open]:text-white",
    item:
      "data-[highlighted]:bg-slate-950 data-[highlighted]:text-white",
    indicator:
      "bg-red-50 text-red-600 data-[highlighted]:bg-white/10 data-[highlighted]:text-white",
  },
  indigo: {
    trigger:
      "hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/10 data-[state=open]:border-indigo-600 data-[state=open]:ring-indigo-600/10",
    icon: "group-hover:bg-indigo-50 group-hover:text-indigo-600",
    openIcon: "group-data-[state=open]:bg-indigo-600 group-data-[state=open]:text-white",
    item:
      "data-[highlighted]:bg-indigo-600 data-[highlighted]:text-white",
    indicator:
      "bg-indigo-50 text-indigo-600 data-[highlighted]:bg-white/[0.15] data-[highlighted]:text-white",
  },
  teal: {
    trigger:
      "hover:border-teal-300 hover:bg-teal-50/40 focus-visible:border-teal-600 focus-visible:ring-teal-600/10 data-[state=open]:border-teal-600 data-[state=open]:ring-teal-600/10",
    icon: "group-hover:bg-teal-50 group-hover:text-teal-600",
    openIcon: "group-data-[state=open]:bg-teal-600 group-data-[state=open]:text-white",
    item:
      "data-[highlighted]:bg-teal-600 data-[highlighted]:text-white",
    indicator:
      "bg-teal-50 text-teal-600 data-[highlighted]:bg-white/[0.15] data-[highlighted]:text-white",
  },
};

type RedcomSelectProps = {
  value?: string;
  options: readonly RedcomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  accent?: SelectAccent;
  surface?: "light" | "dark";
  triggerTone?: TriggerTone;
  "aria-label"?: string;
};

export function RedcomSelect({
  value,
  options,
  onValueChange,
  placeholder = "Seleccionar una opción",
  disabled = false,
  className,
  contentClassName,
  accent = "red",
  surface = "light",
  triggerTone = "neutral",
  "aria-label": ariaLabel,
}: RedcomSelectProps) {
  const styles = accentStyles[accent];

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 text-left text-sm font-medium outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-4 data-[state=open]:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
          surface === "dark"
            ? cn(darkTriggerToneStyles[triggerTone], "shadow-none disabled:bg-white/[0.03] disabled:text-white/[0.65]")
            : "border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] disabled:bg-slate-100 disabled:text-slate-400",
          surface === "dark"
            ? "hover:border-white/[0.15] hover:bg-white/[0.055] focus-visible:border-[#0a84ff]/60 focus-visible:ring-[#0a84ff]/10 data-[state=open]:border-[#0a84ff]/60 data-[state=open]:ring-[#0a84ff]/10"
            : styles.trigger,
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-xl transition-colors",
              surface === "dark"
                ? triggerTone === "blue"
                  ? "bg-sky-400/[0.14] text-sky-200"
                  : triggerTone === "green"
                    ? "bg-emerald-400/[0.14] text-emerald-200"
                    : triggerTone === "amber"
                      ? "bg-amber-400/[0.14] text-amber-200"
                      : triggerTone === "red"
                        ? "bg-rose-400/[0.14] text-rose-200"
                        : "bg-white/[0.06] text-white/[0.76]"
                : "bg-slate-100 text-slate-600",
              surface === "dark"
                ? "group-hover:bg-white/[0.08] group-hover:text-white/[0.82] group-data-[state=open]:bg-[#0a84ff] group-data-[state=open]:text-white"
                : cn(styles.icon, styles.openIcon),
            )}
          >
            <ChevronDown className="h-4 w-4 transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[220] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.28)]",
            surface === "dark"
              ? "border-white/10 bg-[#1c1c1e] text-[#f5f5f7]"
              : "border-slate-200 bg-white text-slate-900",
            contentClassName,
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-slate-500">
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="max-h-[19rem] overflow-y-auto">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-10 text-sm font-medium outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[state=checked]:font-semibold",
                  surface === "dark" ? "text-white/[0.88] data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-white" : "text-slate-700",
                  surface === "dark" ? null : styles.item,
                )}
              >
                <span className="min-w-0 truncate">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </span>
                <SelectPrimitive.ItemIndicator
                  className={cn(
                    "absolute right-3 grid h-6 w-6 place-items-center rounded-lg",
                    surface === "dark"
                      ? "bg-[#0a84ff]/[0.15] text-[#5ac8fa] data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      : styles.indicator,
                  )}
                >
                  <Check className="h-4 w-4" strokeWidth={2.6} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-slate-500">
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

type RedcomSearchableSelectProps = {
  value?: string;
  options: readonly RedcomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  accent?: SelectAccent;
  surface?: "light" | "dark";
  triggerTone?: TriggerTone;
  "aria-label"?: string;
};

export function RedcomSearchableSelect({
  value,
  options,
  onValueChange,
  placeholder = "Seleccionar una opción",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
  className,
  accent = "red",
  surface = "light",
  triggerTone = "neutral",
  "aria-label": ariaLabel,
}: RedcomSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const styles = accentStyles[accent];

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 text-left text-sm font-medium outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-4 data-[state=open]:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
            surface === "dark"
              ? cn(darkTriggerToneStyles[triggerTone], "shadow-none disabled:bg-white/[0.03] disabled:text-white/[0.65]")
              : "border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] disabled:bg-slate-100 disabled:text-slate-400",
            surface === "dark"
              ? "hover:border-white/[0.15] hover:bg-white/[0.055] focus-visible:border-[#0a84ff]/60 focus-visible:ring-[#0a84ff]/10 data-[state=open]:border-[#0a84ff]/60 data-[state=open]:ring-[#0a84ff]/10"
              : styles.trigger,
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selectedOption && (surface === "dark" ? "text-white/[0.65]" : "text-slate-400"))}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-xl transition-colors",
              surface === "dark"
                ? triggerTone === "blue"
                  ? "bg-sky-400/[0.14] text-sky-200"
                  : triggerTone === "green"
                    ? "bg-emerald-400/[0.14] text-emerald-200"
                    : triggerTone === "amber"
                      ? "bg-amber-400/[0.14] text-amber-200"
                      : triggerTone === "red"
                        ? "bg-rose-400/[0.14] text-rose-200"
                        : "bg-white/[0.06] text-white/[0.76]"
                : "bg-slate-100 text-slate-600",
              surface === "dark"
                ? "group-hover:bg-white/[0.08] group-hover:text-white/[0.82] group-data-[state=open]:bg-[#0a84ff] group-data-[state=open]:text-white"
                : cn(styles.icon, styles.openIcon),
            )}
          >
            <ChevronsUpDown className="h-4 w-4" strokeWidth={2.3} />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[220] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.28)]",
            surface === "dark"
              ? "border-white/10 bg-[#1c1c1e] text-[#f5f5f7]"
              : "border-slate-200 bg-white text-slate-900",
          )}
        >
          <Command loop>
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <Command.Input
                autoFocus
                placeholder={searchPlaceholder}
                className={cn(
                  "h-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none",
                  surface === "dark" ? "text-white placeholder:text-white/[0.65]" : "text-slate-900 placeholder:text-slate-400",
                )}
              />
            </div>

            <Command.List id={listboxId} className="max-h-72 overflow-y-auto py-1">
              <Command.Empty className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                {emptyMessage}
              </Command.Empty>

              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  keywords={[option.value, ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-10 text-sm font-medium outline-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
                    surface === "dark" ? "text-white/[0.88]" : "text-slate-700",
                    surface === "dark"
                      ? "data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-white"
                      : accent === "indigo"
                        ? "data-[selected=true]:bg-indigo-600 data-[selected=true]:text-white"
                        : accent === "teal"
                          ? "data-[selected=true]:bg-teal-600 data-[selected=true]:text-white"
                          : "data-[selected=true]:bg-slate-950 data-[selected=true]:text-white",
                  )}
                >
                  <span className={cn("truncate", option.value === value && "font-semibold")}>
                    {option.label}
                  </span>
                  {option.value === value ? (
                    <span
                      className={cn(
                        "absolute right-3 grid h-6 w-6 place-items-center rounded-lg",
                        surface === "dark"
                          ? "bg-[#0a84ff]/[0.15] text-[#5ac8fa]"
                          : styles.indicator,
                      )}
                    >
                      <Check className="h-4 w-4" strokeWidth={2.6} />
                    </span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
