"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Tag, Truck, ShoppingCart, ReceiptText,
  Users, Banknote, TrendingDown, TrendingUp, BarChart3, Settings,
  ShieldCheck, ArrowLeftRight, BookOpen, CreditCard, Wallet,
  Store, ChevronDown, Sun, Moon,
  RotateCcw, Gift, FileText, DollarSign, History,
  Building2, Globe, UserCog, BadgeDollarSign, Layers, Archive,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";
import { useTheme } from "@/hooks/use-theme";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  roles?: ("all" | "admin" | "catalogo" | "cajero")[];
  superadminOnly?: boolean;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  roles?: ("all" | "admin" | "catalogo" | "cajero")[];
  superadminOnly?: boolean;
  adminColmadoOnly?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "General",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["all"] },
    ],
  },
  {
    title: "Catálogo",
    icon: Package,
    roles: ["admin", "catalogo"],
    items: [
      { label: "Productos", href: "/productos", icon: Package, roles: ["admin", "catalogo"] },
      { label: "Categorías", href: "/categorias", icon: Tag, roles: ["admin", "catalogo"] },
    ],
  },
  {
    title: "Suministros",
    icon: Truck,
    roles: ["admin"],
    items: [
      { label: "Suplidores", href: "/suplidores", icon: Truck, roles: ["admin"] },
      { label: "Compras", href: "/compras", icon: ShoppingCart, roles: ["admin"] },
      { label: "Recepción", href: "/recepcion", icon: ReceiptText, roles: ["admin"] },
    ],
  },
  {
    title: "Inventario",
    icon: Archive,
    roles: ["admin", "catalogo"],
    items: [
      { label: "Movimientos", href: "/movimientos", icon: ArrowLeftRight, roles: ["admin", "catalogo"] },
      { label: "Kardex", href: "/kardex", icon: BookOpen, roles: ["admin", "catalogo"] },
    ],
  },
  {
    title: "Comercial",
    icon: Store,
    items: [
      { label: "Caja", href: "/pos", icon: Store, roles: ["all"] },
      { label: "Ventas", href: "/ventas", icon: TrendingUp, roles: ["all"] },
      { label: "Clientes", href: "/clientes", icon: Users, roles: ["all"] },
      { label: "Devoluciones", href: "/devoluciones", icon: RotateCcw, roles: ["all"] },
      { label: "Promociones", href: "/promociones", icon: Gift, roles: ["admin"] },
    ],
  },
  {
    title: "Finanzas",
    icon: Banknote,
    roles: ["admin"],
    items: [
      { label: "Cuentas x Cobrar", href: "/cuentas-por-cobrar", icon: CreditCard, roles: ["admin"] },
      { label: "Cuentas x Pagar", href: "/cuentas-por-pagar", icon: Wallet, roles: ["admin"] },
      { label: "Gastos", href: "/gastos", icon: TrendingDown, roles: ["admin"] },
      { label: "Caja", href: "/caja", icon: Banknote, roles: ["admin"] },
      { label: "Facturación", href: "/facturacion", icon: FileText, roles: ["admin"] },
    ],
  },
  {
    title: "Análisis",
    icon: BarChart3,
    roles: ["admin"],
    items: [
      { label: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin"] },
      { label: "Historial Precios", href: "/historial-precios", icon: History, roles: ["admin"] },
      { label: "Dev. Suplidores", href: "/devoluciones-suplidores", icon: DollarSign, roles: ["admin"] },
    ],
  },
  {
    title: "Sistema",
    icon: Settings,
    roles: ["admin"],
    adminColmadoOnly: true,
    items: [
      { label: "Usuarios", href: "/usuarios", icon: Users, roles: ["admin"] },
      { label: "Auditoría", href: "/auditoria", icon: ShieldCheck, roles: ["admin"] },
      { label: "Configuración", href: "/configuracion", icon: Settings, roles: ["admin"] },
    ],
  },
  {
    title: "Superadmin",
    icon: Globe,
    superadminOnly: true,
    items: [
      { label: "Dashboard Global", href: "/superadmin/dashboard", icon: Globe, superadminOnly: true },
      { label: "Colmados", href: "/superadmin/colmados", icon: Building2, superadminOnly: true },
      { label: "Usuarios Global", href: "/superadmin/usuarios", icon: UserCog, superadminOnly: true },
      { label: "Suscripciones", href: "/superadmin/suscripciones", icon: BadgeDollarSign, superadminOnly: true },
      { label: "Plantillas", href: "/superadmin/planes", icon: Layers, superadminOnly: true },
    ],
  },
];

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  INVENTARIO: "Inventario",
  CAJERO: "Cajero",
  SUPERADMIN: "Superadmin",
};

export default function Sidebar() {
  const { collapsed, openGroups, toggleGroup: storeToggleGroup, setGroupOpen } = useSidebarStore();
  const pathname = usePathname();
  const { usuario, esAdmin, esSuperadmin, logout } = useAuthStore();
  const { theme, toggle } = useTheme();

  const userRole = esAdmin() || esSuperadmin() ? "admin"
    : usuario?.rol === "INVENTARIO" ? "catalogo"
    : "cajero";

  const isSuperadmin = esSuperadmin();

  function canSeeGroup(group: NavGroup): boolean {
    if (group.superadminOnly) return isSuperadmin;
    if (group.adminColmadoOnly && isSuperadmin) return false;
    if (isSuperadmin) return true;
    if (!group.roles) return true;
    return group.roles.includes("all") || group.roles.includes(userRole as "admin" | "catalogo" | "cajero");
  }

  function canSeeItem(item: NavItem): boolean {
    if (item.superadminOnly) return isSuperadmin;
    if (isSuperadmin) return true;
    if (!item.roles) return true;
    return item.roles.includes("all") || item.roles.includes(userRole as "admin" | "catalogo" | "cajero");
  }

  function isGroupOpen(title: string, hasActiveItem: boolean): boolean {
    if (title in openGroups) return openGroups[title];
    if (hasActiveItem) { setGroupOpen(title, true); return true; }
    return false;
  }

  function toggleGroup(title: string) { storeToggleGroup(title); }

  const initials = usuario?.nombre
    ? usuario.nombre.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out",
        "bg-brand-50 border-r border-slate-200",
        "dark:bg-navy-dark dark:border-slate-700/50",
        collapsed ? "w-16" : "w-60"
      )}>

        {/* ── Brand header ── */}
        <div className={cn(
          "flex items-center gap-3 px-3 py-4 border-b border-slate-200 dark:border-slate-700/50 shrink-0",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-brand-600 to-indigo-700 flex items-center justify-center shadow-sm shrink-0">
            <Store size={15} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-black text-sm text-foreground leading-tight tracking-tight">ComerSys</p>
              <p className="text-2xs text-muted-foreground font-medium">Gestión Comercial</p>
            </div>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 scrollbar-hide">
          {NAV_GROUPS.filter(canSeeGroup).map((group) => {
            const visibleItems = group.items.filter(canSeeItem);
            if (!visibleItems.length) return null;

            const hasActiveItem = visibleItems.some(
              item => pathname === item.href || pathname.startsWith(item.href + "/")
            );

            /* Single-item group — direct link */
            if (visibleItems.length === 1) {
              const item = visibleItems[0];
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const GroupIcon = group.icon;
              const row = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 relative group/item",
                    isActive
                      ? "bg-white dark:bg-white/10 text-brand-700 dark:text-brand-300 font-semibold shadow-sm"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-600 dark:bg-brand-400 rounded-r-full" />
                  )}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isActive
                      ? "bg-brand-100 dark:bg-brand-900/50"
                      : "group-hover/item:bg-slate-100 dark:group-hover/item:bg-white/8"
                  )}>
                    <GroupIcon size={15} className={isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"} />
                  </div>
                  {!collapsed && <span className="flex-1 truncate">{group.title}</span>}
                </Link>
              );
              if (collapsed) {
                return (
                  <Tooltip key={group.title}>
                    <TooltipTrigger asChild>{row}</TooltipTrigger>
                    <TooltipContent side="right">{group.title}</TooltipContent>
                  </Tooltip>
                );
              }
              return row;
            }

            /* Multi-item group — collapsible */
            const open = isGroupOpen(group.title, hasActiveItem);
            const GroupIcon = group.icon;

            const groupHeader = (
              <button
                onClick={() => !collapsed && toggleGroup(group.title)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 relative group/header",
                  hasActiveItem
                    ? "text-slate-800 dark:text-slate-100 font-semibold"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white",
                  collapsed && "justify-center px-2"
                )}
              >
                {hasActiveItem && !open && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-600 dark:bg-brand-400 rounded-r-full" />
                )}
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  hasActiveItem
                    ? "bg-brand-100 dark:bg-brand-900/50"
                    : "group-hover/header:bg-slate-100 dark:group-hover/header:bg-white/8"
                )}>
                  <GroupIcon size={15} className={hasActiveItem ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{group.title}</span>
                    <ChevronDown
                      size={13}
                      className={cn(
                        "text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0",
                        open ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </>
                )}
              </button>
            );

            return (
              <div key={group.title}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{groupHeader}</TooltipTrigger>
                    <TooltipContent side="right" className="p-0 w-44">
                      <div className="py-1.5">
                        <p className="text-2xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 px-3 py-1">
                          {group.title}
                        </p>
                        {visibleItems.map(item => {
                          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                                isActive
                                  ? "text-brand-700 bg-brand-50 dark:text-brand-300 dark:bg-brand-900/30 font-medium"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/8"
                              )}
                            >
                              <Icon size={13} />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  groupHeader
                )}

                {/* Sub-items */}
                {!collapsed && (
                  <div className={cn(
                    "overflow-hidden transition-all duration-200 ease-in-out",
                    open ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                  )}>
                    <div className="ml-5 pl-3 border-l-2 border-slate-200 dark:border-slate-700/70 space-y-0.5 pb-1">
                      {visibleItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-150 relative",
                              isActive
                                ? "bg-white dark:bg-white/10 text-brand-700 dark:text-brand-300 font-semibold shadow-sm"
                                : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white"
                            )}
                          >
                            {isActive && (
                              <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-400 border-2 border-brand-50 dark:border-navy-dark" />
                            )}
                            <Icon size={14} className={cn("shrink-0", isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500")} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <Badge variant="danger" className="text-2xs px-1.5 py-0 h-4">{item.badge}</Badge>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="border-t border-slate-200 dark:border-slate-700/50 p-2 space-y-1 shrink-0">

          {/* Usuario */}
          {!collapsed && usuario && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/8">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-2xs font-black text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{usuario.nombre}</p>
                <p className="text-2xs text-muted-foreground">{ROL_LABEL[usuario.rol] ?? usuario.rol}</p>
              </div>
            </div>
          )}

          {/* Tema */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors",
                  "text-slate-500 hover:bg-white/70 hover:text-slate-800",
                  "dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white",
                  collapsed && "justify-center"
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                </div>
                {!collapsed && <span className="text-xs">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</TooltipContent>}
          </Tooltip>

          {/* Cerrar sesión */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center justify-center px-2 py-2 rounded-xl text-sm transition-colors text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center">
                    <LogOut size={14} />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                <LogOut size={14} />
              </div>
              <span className="text-xs">Cerrar sesión</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
