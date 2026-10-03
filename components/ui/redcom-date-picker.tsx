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
            "group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-4 data-[state=open]:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70",
            accentClasses.trigger,
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-slate-400")}>
            {selected ? formatDisplayDate(selected) : placeholder}
          </span>
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-xl", accentClasses.icon)}>
            <CalendarDays className="h-4 w-4" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[240] w-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,.18)]"
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
          captionLayout="dropdown"
          classNames={{
            selected: accentClasses.selected,
            today: "rounded-lg bg-slate-100 text-slate-950",
          }}
        />

        <div className="flex items-center justify-between border-t border-slate-100 px-2 pb-1 pt-2">
          <button
            type="button"
            onClick={() => {
              onChange(formatIsoDate(new Date()));
              setOpen(false);
            }}
            className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
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
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
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
