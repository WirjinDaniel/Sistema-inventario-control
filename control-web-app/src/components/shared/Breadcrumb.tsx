"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  productos: "Productos",
  categorias: "Categorías",
  suplidores: "Suplidores",
  compras: "Compras",
  recepcion: "Recepción",
  movimientos: "Movimientos",
  kardex: "Kardex",
  pos: "POS",
  ventas: "Ventas",
  clientes: "Clientes",
  devoluciones: "Devoluciones",
  promociones: "Promociones",
  "cuentas-por-cobrar": "Cuentas x Cobrar",
  "cuentas-por-pagar": "Cuentas x Pagar",
  gastos: "Gastos",
  caja: "Caja",
  facturacion: "Facturación",
  reportes: "Reportes",
  "historial-precios": "Historial Precios",
  "devoluciones-suplidores": "Dev. Suplidores",
  usuarios: "Usuarios",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  superadmin: "Superadmin",
  colmados: "Colmados",
  suscripciones: "Suscripciones",
  planes: "Plantillas",
};

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center gap-1 text-xs", className)}>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="text-white/30 shrink-0" />}
          {crumb.isLast ? (
            <span className="text-white/90 font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-white/50 hover:text-white/80 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
