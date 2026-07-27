"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Tag, Truck, ShoppingCart, ReceiptText,
  Users, Banknote, TrendingDown, TrendingUp, BarChart3, Settings,
  ShieldCheck, ArrowLeftRight, BookOpen, CreditCard, Wallet,
  Store, ChevronLeft, ChevronRight, Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/hooks/use-theme";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  roles?: ("all" | "admin" | "catalogo" | "cajero")[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
  roles?: ("all" | "admin" | "catalogo" | "cajero")[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "General",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["all"] },
    ],
  },
  {
    title: "Catálogo",
    roles: ["admin", "catalogo"],
    items: [
      { label: "Productos", href: "/productos", icon: Package, roles: ["admin", "catalogo"] },
      { label: "Categorías", href: "/categorias", icon: Tag, roles: ["admin", "catalogo"] },
    ],
  },
  {
    title: "Suministros",
    roles: ["admin"],
    items: [
      { label: "Suplidores", href: "/suplidores", icon: Truck, roles: ["admin"] },
      { label: "Compras", href: "/compras", icon: ShoppingCart, roles: ["admin"] },
      { label: "Recepción", href: "/recepcion", icon: ReceiptText, roles: ["admin"] },
    ],
  },
  {
    title: "Inventario",
    roles: ["admin", "catalogo"],
    items: [
      { label: "Movimientos", href: "/movimientos", icon: ArrowLeftRight, roles: ["admin", "catalogo"] },
      { label: "Kardex", href: "/kardex", icon: BookOpen, roles: ["admin", "catalogo"] },
    ],
  },
  {
    title: "Comercial",
    items: [
      { label: "POS", href: "/pos", icon: Store, roles: ["all"] },
      { label: "Ventas", href: "/ventas", icon: TrendingUp, roles: ["all"] },
      { label: "Clientes", href: "/clientes", icon: Users, roles: ["all"] },
    ],
  },
  {
    title: "Finanzas",
    roles: ["admin"],
    items: [
      { label: "Cuentas x Cobrar", href: "/cuentas-por-cobrar", icon: CreditCard, roles: ["admin"] },
      { label: "Cuentas x Pagar", href: "/cuentas-por-pagar", icon: Wallet, roles: ["admin"] },
      { label: "Gastos", href: "/gastos", icon: TrendingDown, roles: ["admin"] },
      { label: "Caja", href: "/caja", icon: Banknote, roles: ["admin"] },
    ],
  },
  {
    title: "Sistema",
    roles: ["admin"],
    items: [
      { label: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin"] },
      { label: "Usuarios", href: "/usuarios", icon: Users, roles: ["admin"] },
      { label: "Auditoría", href: "/auditoria", icon: ShieldCheck, roles: ["admin"] },
      { label: "Configuración", href: "/configuracion", icon: Settings, roles: ["admin"] },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { usuario, esAdmin, esSuperadmin } = useAuthStore();
  const { theme, toggle } = useTheme();

  const userRole = esAdmin() || esSuperadmin() ? "admin"
    : usuario?.rol === "INVENTARIO" ? "catalogo"
    : "cajero";

  function canSeeGroup(group: NavGroup): boolean {
    if (!group.roles) return true;
    return group.roles.includes("all") || group.roles.includes(userRole as "admin" | "catalogo" | "cajero");
  }

  function canSeeItem(item: NavItem): boolean {
    if (!item.roles) return true;
    return item.roles.includes("all") || item.roles.includes(userRole as "admin" | "catalogo" | "cajero");
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col h-screen border-r border-border bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 px-4 py-4 border-b border-border", collapsed && "justify-center px-2")}>
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Store size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">Colmado POS</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Control Total</p>
            </div>
          )}
        </div>

        {/* Toggle collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[60px] z-10 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
          {NAV_GROUPS.filter(canSeeGroup).map((group) => {
            const visibleItems = group.items.filter(canSeeItem);
            if (!visibleItems.length) return null;
            return (
              <div key={group.title}>
                {!collapsed && (
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    const navItem = (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group relative",
                          isActive
                            ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-950 dark:text-brand-300"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-600 rounded-r-full" />
                        )}
                        <Icon size={16} className={cn("shrink-0", isActive ? "text-brand-600 dark:text-brand-400" : "")} />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <Badge variant="danger" className="text-[10px] px-1.5 py-0 h-4">{item.badge}</Badge>
                        )}
                      </Link>
                    );
                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return navItem;
                  })}
                </div>
                {!collapsed && <Separator className="mt-3" />}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2 space-y-1">
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center"
            )}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
          </button>

        </div>
      </aside>
    </TooltipProvider>
  );
}
