"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
  color?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ value, onChange, options, placeholder = "Seleccionar...", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm text-left transition-all duration-150 bg-white dark:bg-slate-900 ${
          open
            ? "border-brand-400 ring-2 ring-brand-200 dark:ring-brand-800"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
        }`}>
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selected ? (
            <>
              {selected.icon && (
                <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${selected.color ?? ""}`}>
                  <selected.icon size={13} />
                </span>
              )}
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors duration-100 ${
                  isSelected ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}>
                {opt.icon && (
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${opt.color ?? "bg-slate-100 text-slate-500"}`}>
                    <opt.icon size={13} />
                  </span>
                )}
                <span className="flex-1 font-medium">{opt.label}</span>
                {isSelected && <Check size={14} className="text-brand-600 dark:text-brand-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
