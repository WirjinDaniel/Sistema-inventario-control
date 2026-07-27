"use client";
import { usePathname, useRouter } from "next/navigation";
import { Search, LogOut, Settings, ChevronRight } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  productos: "Productos",
  categorias: "Categorías y Marcas",
  suplidores: "Suplidores",
  compras: "Compras",
  recepcion: "Recepción de Mercancía",
  movimientos: "Movimientos",
  kardex: "Kardex",
  pos: "Punto de Venta",
  ventas: "Ventas",
  clientes: "Clientes",
  "cuentas-por-cobrar": "Cuentas por Cobrar",
  "cuentas-por-pagar": "Cuentas por Pagar",
  gastos: "Gastos",
  caja: "Caja",
  reportes: "Reportes",
  usuarios: "Usuarios",
  auditoria: "Auditoría",
  configuracion: "Configuración",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, logout } = useAuthStore();

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-5 gap-4 sticky top-0 z-30">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
            <span
              className={cn(
                "truncate",
                crumb.isLast
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              )}
              onClick={() => !crumb.isLast && router.push(crumb.href)}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Command palette trigger */}
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:flex items-center gap-2 text-muted-foreground w-48 justify-between"
        onClick={() => {
          const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
          window.dispatchEvent(e);
        }}
      >
        <span className="flex items-center gap-1.5 text-xs">
          <Search size={13} />
          Buscar...
        </span>
        <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </Button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="text-[10px]">
                {usuario ? getInitials(usuario.nombre || usuario.username) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight">{usuario?.nombre || usuario?.username}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{usuario?.rol}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Mi cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/configuracion")}>
            <Settings size={14} /> Configuración
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50">
            <LogOut size={14} /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
