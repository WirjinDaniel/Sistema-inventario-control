"use client";
import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
}

interface Group {
  title: string;
  shortcuts: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Navegación global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Abrir búsqueda / paleta de comandos" },
      { keys: ["?"], description: "Mostrar esta guía de atajos" },
      { keys: ["Esc"], description: "Cerrar modal o panel activo" },
    ],
  },
  {
    title: "POS — Punto de Venta",
    shortcuts: [
      { keys: ["Enter"], description: "Escanear código de barras ingresado" },
      { keys: ["F2"], description: "Enfocar campo de búsqueda de producto" },
      { keys: ["+"], description: "Aumentar cantidad del último item" },
      { keys: ["-"], description: "Disminuir cantidad del último item" },
      { keys: ["Del"], description: "Eliminar último item del carrito" },
    ],
  },
  {
    title: "Formularios",
    shortcuts: [
      { keys: ["Tab"], description: "Avanzar al siguiente campo" },
      { keys: ["Shift", "Tab"], description: "Retroceder al campo anterior" },
      { keys: ["⌘", "Enter"], description: "Guardar formulario activo" },
    ],
  },
  {
    title: "Tablas y listas",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navegar entre filas" },
      { keys: ["←", "→"], description: "Cambiar página (paginación)" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-7 h-6 px-1.5 rounded-md bg-muted border border-border text-xs font-mono font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Guía de atajos de teclado"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90svh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center">
              <Keyboard size={15} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Atajos de teclado</h2>
              <p className="text-xs text-muted-foreground">Presiona <Kbd>?</Kbd> para abrir / cerrar</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.shortcuts.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-lg",
                      "hover:bg-muted/50 transition-colors"
                    )}
                  >
                    <span className="text-sm text-foreground">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && <span className="text-2xs text-muted-foreground">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            Los atajos están disponibles cuando no hay ningún campo de texto activo.
          </p>
        </div>
      </div>
    </div>
  );
}
