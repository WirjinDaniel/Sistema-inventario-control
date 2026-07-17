"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, LogOut, Store, ChevronRight,
  ShoppingCart, Package, Users, BarChart3,
  UserCog, Settings, Receipt, Truck, Vault, Layers, ShieldCheck,
  BookOpen, ClipboardList, Warehouse, ArrowLeftRight, ScrollText,
  Wallet, TrendingDown,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface NavItem { href: string; label: string; Icon: React.ElementType; }

const NAV_GENERAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
];

const NAV_CATALOGO: NavItem[] = [
  { href: "/productos",  label: "Productos",          Icon: Package },
  { href: "/categorias", label: "Categorías & Marcas", Icon: Layers },
];

const NAV_CADENA: NavItem[] = [
  { href: "/suplidores", label: "Proveedores",         Icon: Truck },
  { href: "/compras",    label: "Compras",             Icon: ClipboardList },
  { href: "/recepcion",  label: "Recepción mercancía", Icon: Warehouse },
];

const NAV_INVENTARIO: NavItem[] = [
  { href: "/movimientos", label: "Movimientos", Icon: ArrowLeftRight },
  { href: "/kardex",      label: "Kardex",       Icon: ScrollText },
];

const NAV_COMERCIAL: NavItem[] = [
  { href: "/pos",      label: "Punto de Venta",  Icon: ShoppingCart },
  { href: "/ventas",   label: "Ventas",           Icon: BookOpen },
  { href: "/clientes", label: "Clientes & Fiados", Icon: Users },
];

const NAV_FINANZAS: NavItem[] = [
  { href: "/cuentas-por-cobrar", label: "Cuentas por cobrar", Icon: Wallet },
  { href: "/cuentas-por-pagar", label: "Cuentas por pagar",   Icon: TrendingDown },
  { href: "/gastos",             label: "Gastos",              Icon: Receipt },
  { href: "/caja",               label: "Caja",                Icon: Vault },
];

const NAV_SISTEMA: NavItem[] = [
  { href: "/reportes",     label: "Reportes",           Icon: BarChart3 },
  { href: "/usuarios",     label: "Usuarios",           Icon: UserCog },
  { href: "/auditoria",    label: "Auditoría",          Icon: ShieldCheck },
  { href: "/configuracion",label: "Configuración",      Icon: Settings },
];

const SECCIONES = [
  { label: "General",             items: NAV_GENERAL,    roles: "all" },
  { label: "Catálogo",            items: NAV_CATALOGO,   roles: "catalogo" },
  { label: "Cadena de suministro",items: NAV_CADENA,     roles: "admin" },
  { label: "Inventario",          items: NAV_INVENTARIO, roles: "admin" },
  { label: "Comercial",           items: NAV_COMERCIAL,  roles: "all" },
  { label: "Finanzas",            items: NAV_FINANZAS,   roles: "admin" },
  { label: "Sistema",             items: NAV_SISTEMA,    roles: "admin" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, logout, esAdmin } = useAuthStore();
  const rol = usuario?.rol ?? "";
  const isAdmin = esAdmin();
  const isCatalogo = isAdmin || rol === "INVENTARIO";

  function handleLogout() { logout(); router.push("/login"); }

  function canSee(roles: string) {
    if (roles === "all") return true;
    if (roles === "admin") return isAdmin;
    if (roles === "catalogo") return isCatalogo;
    return false;
  }

  function NavLink({ href, label, Icon }: NavItem) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group ${
          active
            ? "bg-indigo-600/20 text-indigo-300"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
        }`}>
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-indigo-400 rounded-r-full" />
        )}
        <Icon size={15} className={active ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-300"} />
        <span className="flex-1 text-xs">{label}</span>
        <ChevronRight size={11} className={active ? "text-indigo-400 opacity-60" : "opacity-0 group-hover:opacity-25"} />
      </Link>
    );
  }

  return (
    <aside className="w-56 bg-slate-950 flex flex-col shrink-0 h-screen border-r border-white/5">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Store size={15} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">ColmadoOS</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Control Total</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0 overflow-y-auto">
        {SECCIONES.map(({ label, items, roles }) => {
          if (!canSee(roles)) return null;
          return (
            <div key={label} className="mb-3">
              <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest px-3 mb-1">{label}</p>
              {items.map((item) => <NavLink key={item.href} {...item} />)}
            </div>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-2 pb-3 border-t border-white/5 pt-3 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {usuario?.nombre?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{usuario?.nombre ?? "Usuario"}</p>
            <p className="text-slate-500 text-[10px] capitalize">{(usuario?.rol ?? "").toLowerCase()}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-all duration-150">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
