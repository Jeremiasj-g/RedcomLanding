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

type RedcomSelectProps = {
  value?: string;
  options: readonly RedcomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
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
  "aria-label": ariaLabel,
}: RedcomSelectProps) {
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
          "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-slate-300 hover:bg-slate-50/70 focus-visible:border-slate-950 focus-visible:ring-4 focus-visible:ring-slate-950/5 data-[state=open]:border-slate-950 data-[state=open]:ring-4 data-[state=open]:ring-slate-950/5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-red-50 group-hover:text-red-600 group-data-[state=open]:bg-slate-950 group-data-[state=open]:text-white">
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
            "z-[220] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,.16)]",
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
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-slate-950 data-[highlighted]:text-white data-[state=checked]:font-black"
              >
                <span className="min-w-0 truncate">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-3 grid h-6 w-6 place-items-center rounded-lg bg-red-50 text-red-600 data-[highlighted]:bg-white/10 data-[highlighted]:text-white">
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
  "aria-label": ariaLabel,
}: RedcomSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);

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
            "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-slate-300 hover:bg-slate-50/70 focus-visible:border-slate-950 focus-visible:ring-4 focus-visible:ring-slate-950/5 data-[state=open]:border-slate-950 data-[state=open]:ring-4 data-[state=open]:ring-slate-950/5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selectedOption && "text-slate-400")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-red-50 group-hover:text-red-600 group-data-[state=open]:bg-slate-950 group-data-[state=open]:text-white">
            <ChevronsUpDown className="h-4 w-4" strokeWidth={2.3} />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[220] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,.16)]"
        >
          <Command loop>
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <Command.Input
                autoFocus
                placeholder={searchPlaceholder}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <Command.List
              id={listboxId}
              className="max-h-72 overflow-y-auto py-1"
            >
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
                  className="relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 data-[selected=true]:bg-slate-950 data-[selected=true]:text-white"
                >
                  <span className={cn("truncate", option.value === value && "font-black")}>
                    {option.label}
                  </span>
                  {option.value === value ? (
                    <span className="absolute right-3 grid h-6 w-6 place-items-center rounded-lg bg-red-50 text-red-600">
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
