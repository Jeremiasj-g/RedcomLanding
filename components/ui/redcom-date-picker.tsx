"use client";

import { CalendarDays, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Accent = "indigo" | "teal";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  accent?: Accent;
  surface?: "light" | "dark";
  clearable?: boolean;
  "aria-label"?: string;
};

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return undefined;
  }

  return date;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function RedcomDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  accent = "indigo",
  surface = "light",
  clearable = true,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const accentClasses =
    accent === "teal"
      ? {
          trigger:
            "hover:border-teal-300 hover:bg-teal-50/40 focus-visible:border-teal-600 focus-visible:ring-teal-600/10 data-[state=open]:border-teal-600 data-[state=open]:ring-teal-600/10",
          icon: "bg-teal-50 text-teal-700",
          selected: "bg-teal-600 text-white hover:bg-teal-600 hover:text-white",
        }
      : {
          trigger:
            "hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:border-indigo-600 focus-visible:ring-indigo-600/10 data-[state=open]:border-indigo-600 data-[state=open]:ring-indigo-600/10",
          icon: "bg-indigo-50 text-indigo-700",
          selected: "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white",
        };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left text-sm font-medium outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-4 data-[state=open]:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
            surface === "dark"
              ? "border-white/10 bg-white/[0.04] text-[#f5f5f7] shadow-none disabled:bg-white/[0.03] disabled:text-white/[0.65]"
              : "border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] disabled:bg-slate-100 disabled:text-slate-400",
            accentClasses.trigger,
            className,
          )}
        >
          <span className={cn("truncate", !selected && (surface === "dark" ? "text-white/[0.65]" : "text-slate-400"))}>
            {selected ? formatDisplayDate(selected) : placeholder}
          </span>
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-xl",
              surface === "dark"
                ? "bg-[#0a84ff]/15 text-[#5ac8fa]"
                : accentClasses.icon,
            )}
          >
            <CalendarDays className="h-4 w-4" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          "z-[240] w-auto rounded-3xl border p-2 shadow-[0_22px_60px_rgba(0,0,0,.28)]",
          surface === "dark"
            ? "border-white/10 bg-[#1c1c1e] text-[#f5f5f7]"
            : "border-slate-200 bg-white",
        )}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatIsoDate(date));
            setOpen(false);
          }}
          defaultMonth={selected}
          captionLayout="label"
          className={cn(
            surface === "dark"
              ? "bg-transparent text-[#f5f5f7] [--cell-size:2.15rem]"
              : "",
          )}
          classNames={{
            month_caption:
              surface === "dark"
                ? "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size] text-sm font-medium text-white/[0.90]"
                : undefined,
            caption_label:
              surface === "dark"
                ? "select-none text-sm font-medium text-white/[0.90]"
                : undefined,
            weekday:
              surface === "dark"
                ? "flex-1 select-none rounded-md text-[0.78rem] font-normal text-white/[0.65]"
                : undefined,
            day:
              surface === "dark"
                ? "group/day relative aspect-square h-full w-full select-none p-0 text-center text-white/[0.84]"
                : undefined,
            today:
              surface === "dark"
                ? "rounded-lg bg-white/[0.07] text-white"
                : "rounded-lg bg-slate-100 text-slate-950",
            outside:
              surface === "dark"
                ? "text-white/18 aria-selected:text-white/[0.65]"
                : undefined,
            disabled:
              surface === "dark"
                ? "text-white/[0.35] opacity-40"
                : undefined,
            button_previous:
              surface === "dark"
                ? "h-[--cell-size] w-[--cell-size] select-none rounded-lg border border-white/[0.08] bg-white/[0.04] p-0 text-white/[0.78] hover:bg-white/[0.08] hover:text-white"
                : undefined,
            button_next:
              surface === "dark"
                ? "h-[--cell-size] w-[--cell-size] select-none rounded-lg border border-white/[0.08] bg-white/[0.04] p-0 text-white/[0.78] hover:bg-white/[0.08] hover:text-white"
                : undefined,
            selected:
              surface === "dark"
                ? "rounded-lg bg-[#0a84ff] text-white"
                : accentClasses.selected,
          }}
        />

        <div className={cn(
          "flex items-center justify-between border-t px-2 pb-1 pt-2",
          surface === "dark" ? "border-white/10" : "border-slate-100",
        )}>
          <button
            type="button"
            onClick={() => {
              onChange(formatIsoDate(new Date()));
              setOpen(false);
            }}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium transition",
              surface === "dark"
                ? "text-white/[0.80] hover:bg-white/[0.06] hover:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            Hoy
          </button>

          {clearable ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              disabled={!value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35",
                surface === "dark"
                  ? "text-white/[0.75] hover:bg-white/[0.06] hover:text-white"
                  : "text-slate-500 hover:bg-rose-50 hover:text-rose-600",
              )}
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
