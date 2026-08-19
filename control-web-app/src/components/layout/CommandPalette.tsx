"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Store,
  BarChart3, Settings, Banknote, TrendingDown, Tag, Truck,
  ArrowLeftRight, BookOpen, CreditCard, Wallet, ShieldCheck, ReceiptText,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Páginas" },
  { label: "Productos", href: "/productos", icon: Package, group: "Páginas" },
  { label: "POS — Punto de Venta", href: "/pos", icon: Store, group: "Páginas" },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart, group: "Páginas" },
  { label: "Clientes", href: "/clientes", icon: Users, group: "Páginas" },
  { label: "Categorías", href: "/categorias", icon: Tag, group: "Páginas" },
  { label: "Suplidores", href: "/suplidores", icon: Truck, group: "Páginas" },
  { label: "Compras", href: "/compras", icon: ShoppingCart, group: "Páginas" },
  { label: "Recepción", href: "/recepcion", icon: ReceiptText, group: "Páginas" },
  { label: "Movimientos", href: "/movimientos", icon: ArrowLeftRight, group: "Páginas" },
  { label: "Kardex", href: "/kardex", icon: BookOpen, group: "Páginas" },
  { label: "Cuentas por Cobrar", href: "/cuentas-por-cobrar", icon: CreditCard, group: "Páginas" },
  { label: "Cuentas por Pagar", href: "/cuentas-por-pagar", icon: Wallet, group: "Páginas" },
  { label: "Gastos", href: "/gastos", icon: TrendingDown, group: "Páginas" },
  { label: "Caja", href: "/caja", icon: Banknote, group: "Páginas" },
  { label: "Reportes", href: "/reportes", icon: BarChart3, group: "Páginas" },
  { label: "Usuarios", href: "/usuarios", icon: Users, group: "Sistema" },
  { label: "Auditoría", href: "/auditoria", icon: ShieldCheck, group: "Sistema" },
  { label: "Configuración", href: "/configuracion", icon: Settings, group: "Sistema" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = Array.from(new Set(PAGES.map((p) => p.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, módulos, acciones..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        {groups.map((group, i) => (
          <div key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {PAGES.filter((p) => p.group === group).map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem key={page.href} onSelect={() => navigate(page.href)}>
                    <Icon />
                    {page.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="border-t px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-2xs">↑↓</kbd> navegar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-2xs">↵</kbd> abrir</span>
        <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-2xs">Esc</kbd> cerrar</span>
      </div>
    </CommandDialog>
  );
}
