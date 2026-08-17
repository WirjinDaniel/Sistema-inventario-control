"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";
import toast from "react-hot-toast";
import {
  ScrollText, TrendingUp, TrendingDown, RotateCcw,
  ShoppingCart, Search, Package, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Movimiento {
  id: number;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE" | "VENTA";
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  referencia: string;
  usuario_nombre: string;
  fecha: string;
  nota: string;
}

interface ProductoBasico { id: number; nombre: string; stock_actual: string; unidad_medida: string; }

const TIPO_CONFIG = {
  ENTRADA: { label: "Entrada", icon: TrendingUp,    badge: "success" as const },
  SALIDA:  { label: "Salida",  icon: TrendingDown,  badge: "danger"  as const },
  AJUSTE:  { label: "Ajuste",  icon: RotateCcw,     badge: "warning" as const },
  VENTA:   { label: "Venta",   icon: ShoppingCart,  badge: "info"    as const },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

function KardexContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productoId = searchParams.get("producto");
  const nombreParam = searchParams.get("nombre") ?? "";

  const [producto, setProducto] = useState<ProductoBasico | null>(null);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [resultados, setResultados] = useState<ProductoBasico[]>([]);
  const [buscando, setBuscando] = useState(false);

  const cargarMovimientos = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [{ data: p }, { data: m }] = await Promise.all([
        api.get(`/inventario/productos/${id}/`),
        api.get(`/inventario/movimientos/?producto=${id}&ordering=-fecha`),
      ]);
      setProducto(p);
      setMovs(m.results ?? m);
    } catch {
      toast.error("Error cargando kardex");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (productoId) cargarMovimientos(productoId);
  }, [productoId, cargarMovimientos]);

  useEffect(() => {
    if (!busquedaProducto.trim()) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(busquedaProducto)}`);
        setResultados((data.results ?? data).slice(0, 8));
      } catch { /* silencioso */ }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busquedaProducto]);

  function seleccionar(p: ProductoBasico) {
    setResultados([]);
    setBusquedaProducto("");
    router.push(`/kardex?producto=${p.id}&nombre=${encodeURIComponent(p.nombre)}`);
  }

  // Summary totals
  const totalEntradas = movs.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + Number(m.cantidad), 0);
  const totalSalidas = movs.filter((m) => m.tipo === "SALIDA" || m.tipo === "VENTA").reduce((s, m) => s + Number(m.cantidad), 0);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Kardex"
        description={producto
          ? `${producto.nombre} · Stock actual: ${Number(producto.stock_actual).toFixed(2)} ${producto.unidad_medida}`
          : "Libro de movimientos por producto"}
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push("/productos")}>
            <ArrowLeft size={14} /> Productos
          </Button>
        }
      />

      {/* Selector de producto */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Seleccionar producto</p>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            placeholder="Nombre, SKU, código de barras..."
            className="pl-8"
          />
          {buscando && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {resultados.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => seleccionar(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left transition-colors border-b border-border last:border-0"
              >
                <Package size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1">{p.nombre}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Stock: {Number(p.stock_actual).toFixed(2)} {p.unidad_medida}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resumen cuando hay producto */}
      {producto && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Stock actual", value: `${Number(producto.stock_actual).toFixed(2)} ${producto.unidad_medida}`, color: "text-foreground", bg: "bg-card" },
            { label: "Total entradas", value: `+${totalEntradas.toFixed(2)}`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
            { label: "Total salidas", value: `-${totalSalidas.toFixed(2)}`, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/20" },
          ].map((kpi) => (
            <div key={kpi.label} className={cn("rounded-xl p-4 border border-border", kpi.bg)}>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={cn("text-xl font-bold tabular-nums mt-0.5", kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla kardex */}
      {productoId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16" />
                  <div className="flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : movs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Sin movimientos"
              description={`No hay registros para ${nombreParam || "este producto"}.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                  <tr className="border-b border-border bg-muted/50">
                    {["Fecha", "Tipo", "Referencia", "Entrada", "Salida", "Saldo", "Usuario", "Nota"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movs.map((m) => {
                    const cfg = TIPO_CONFIG[m.tipo] ?? TIPO_CONFIG.AJUSTE;
                    const Icon = cfg.icon;
                    const entrada = m.tipo === "ENTRADA" ? Number(m.cantidad) : null;
                    const salida = (m.tipo === "SALIDA" || m.tipo === "VENTA") ? Number(m.cantidad) : null;
                    return (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtFecha(m.fecha)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.badge} className="gap-1 text-xs">
                            <Icon size={10} /> {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {m.referencia || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                          {entrada != null ? `+${entrada.toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-sm">
                          {salida != null
                            ? <span className="text-rose-600 dark:text-rose-400">-{salida.toFixed(2)}</span>
                            : m.tipo === "AJUSTE"
                            ? <span className="text-amber-600 dark:text-amber-400">±{Number(m.cantidad).toFixed(2)}</span>
                            : <span className="text-muted-foreground/40">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground tabular-nums text-sm">
                          {Number(m.stock_despues).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{m.usuario_nombre}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                          {m.nota || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer totals */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                      Totales del período
                    </td>
                    <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{totalEntradas.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      -{totalSalidas.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-foreground tabular-nums">
                      {producto ? Number(producto.stock_actual).toFixed(2) : "—"}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KardexPage() {
  const { esAdmin, esSuperadmin, usuario } = useAuthStore();
  if (!esAdmin() && !esSuperadmin() && usuario?.rol !== "INVENTARIO") return <AccessDenied />;
  return (
    <Suspense fallback={
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
      </div>
    }>
      <KardexContent />
    </Suspense>
  );
}
