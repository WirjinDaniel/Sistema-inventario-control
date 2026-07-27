"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseValue(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(value: string): string {
  const d = parseValue(value);
  if (!d) return "";
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder = "Seleccionar fecha", className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  const selected = parseValue(value);
  const [viewYear, setViewYear] = React.useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selected?.getMonth() ?? today.getMonth());
  const [showMonths, setShowMonths] = React.useState(false);
  const [showYears, setShowYears] = React.useState(false);

  const years = Array.from({ length: 20 }, (_, i) => today.getFullYear() - 5 + i);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; month: "prev" | "cur" | "next" }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, month: "prev" });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, month: "cur" });
  const rem = 42 - cells.length;
  for (let i = 1; i <= rem; i++) cells.push({ day: i, month: "next" });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number, monthType: "prev" | "cur" | "next") {
    let m = viewMonth, y = viewYear;
    if (monthType === "prev") { m--; if (m < 0) { m = 11; y--; } }
    if (monthType === "next") { m++; if (m > 11) { m = 0; y++; } }
    const d = new Date(y, m, day);
    onChange(toIso(d));
    setOpen(false);
  }

  function isSelected(day: number, monthType: "prev" | "cur" | "next") {
    if (!selected || monthType !== "cur") return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  }

  function isToday(day: number, monthType: "prev" | "cur" | "next") {
    if (monthType !== "cur") return false;
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
            !value && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarDays size={12} className="text-muted-foreground shrink-0" />
          <span>{value ? formatDisplay(value) : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 select-none w-64">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded-md hover:bg-muted transition-colors">
              <ChevronLeft size={14} className="text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1">
              {/* Month selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowMonths(!showMonths); setShowYears(false); }}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-md hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  {MONTHS[viewMonth]} <ChevronDown size={11} />
                </button>
                {showMonths && (
                  <div className="absolute top-full mt-1 left-0 z-10 bg-popover border border-border rounded-lg shadow-lg p-1 grid grid-cols-3 gap-0.5 w-44">
                    {MONTHS.map((m, i) => (
                      <button key={m} onClick={() => { setViewMonth(i); setShowMonths(false); }}
                        className={cn("text-[10px] px-1 py-1 rounded hover:bg-muted text-foreground transition-colors",
                          i === viewMonth && "bg-brand-600 text-white hover:bg-brand-700"
                        )}>
                        {m.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Year selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowYears(!showYears); setShowMonths(false); }}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-md hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  {viewYear} <ChevronDown size={11} />
                </button>
                {showYears && (
                  <div className="absolute top-full mt-1 right-0 z-10 bg-popover border border-border rounded-lg shadow-lg p-1 overflow-y-auto max-h-40 w-20">
                    {years.map((y) => (
                      <button key={y} onClick={() => { setViewYear(y); setShowYears(false); }}
                        className={cn("w-full text-xs px-2 py-1 rounded hover:bg-muted text-foreground transition-colors",
                          y === viewYear && "bg-brand-600 text-white hover:bg-brand-700"
                        )}>
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={nextMonth} className="p-1 rounded-md hover:bg-muted transition-colors">
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((cell, i) => {
              const sel = isSelected(cell.day, cell.month);
              const tod = isToday(cell.day, cell.month);
              return (
                <button
                  key={i}
                  onClick={() => selectDay(cell.day, cell.month)}
                  className={cn(
                    "h-8 w-full flex items-center justify-center text-xs rounded-lg transition-colors",
                    cell.month !== "cur" && "text-muted-foreground/40",
                    cell.month === "cur" && !sel && !tod && "text-foreground hover:bg-muted",
                    tod && !sel && "font-bold text-brand-600 dark:text-brand-400",
                    sel && "bg-brand-600 text-white font-semibold hover:bg-brand-700",
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-2 border-t border-border">
            <button onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Borrar
            </button>
            <button onClick={() => { onChange(toIso(today)); setOpen(false); }}
              className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">
              Hoy
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
