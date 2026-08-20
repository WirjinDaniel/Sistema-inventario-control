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
  CalendarDays, User2, BookOpen, Layers,
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
  ENTRADA: {
    label: "Entrada", icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-600",
    accentBg: "bg-emerald-50 dark:bg-emerald-950/30",
    accentBorder: "border-emerald-200 dark:border-emerald-800/50",
    color: "text-emerald-600 dark:text-emerald-400",
    rowBar: "bg-emerald-400",
  },
  SALIDA: {
    label: "Salida", icon: TrendingDown,
    gradient: "from-rose-500 to-red-600",
    accentBg: "bg-rose-50 dark:bg-rose-950/30",
    accentBorder: "border-rose-200 dark:border-rose-800/50",
    color: "text-rose-600 dark:text-rose-400",
    rowBar: "bg-rose-400",
  },
  AJUSTE: {
    label: "Ajuste", icon: RotateCcw,
    gradient: "from-amber-500 to-orange-500",
    accentBg: "bg-amber-50 dark:bg-amber-950/30",
    accentBorder: "border-amber-200 dark:border-amber-800/50",
    color: "text-amber-600 dark:text-amber-400",
    rowBar: "bg-amber-400",
  },
  VENTA: {
    label: "Venta", icon: ShoppingCart,
    gradient: "from-sky-500 to-blue-600",
    accentBg: "bg-sky-50 dark:bg-sky-950/30",
    accentBorder: "border-sky-200 dark:border-sky-800/50",
    color: "text-sky-600 dark:text-sky-400",
    rowBar: "bg-sky-400",
  },
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
        description={
          producto ? (
            <span className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50 px-2 py-0.5 rounded-full">
                <Package size={10} /> {producto.nombre}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-full">
                <Layers size={10} /> Stock: {Number(producto.stock_actual).toFixed(2)} {producto.unidad_medida}
              </span>
            </span>
          ) : "Libro de movimientos por producto"
        }
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push("/productos")}>
            <ArrowLeft size={14} /> Productos
          </Button>
        }
      />

      {/* Selector de producto */}
      <div className="relative bg-card border border-border rounded-xl p-4 space-y-3 overflow-hidden">
        {/* top accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen size={13} className="text-white" />
          </div>
          <p className="text-xs font-bold text-foreground uppercase tracking-widest">Seleccionar producto</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => seleccionar(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 text-left transition-colors border-b border-border last:border-0 group"
              >
                <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-50 to-indigo-100 dark:from-brand-950/40 dark:to-indigo-900/30 border border-brand-100 dark:border-brand-800/30 flex items-center justify-center shrink-0">
                  <Package size={13} className="text-brand-500 dark:text-brand-400" />
                </div>
                <span className="text-sm font-medium text-foreground flex-1 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{p.nombre}</span>
                <span className="text-xs text-muted-foreground tabular-nums bg-muted px-2 py-0.5 rounded-full">
                  {Number(p.stock_actual).toFixed(2)} {p.unidad_medida}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resumen cuando hay producto */}
      {producto && (
        <div className="grid grid-cols-3 gap-3">
          {/* Stock actual */}
          <div className="relative bg-card border border-border rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                <Layers size={16} className="text-white" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">Stock actual</p>
                <p className="text-xl font-black tabular-nums text-foreground leading-tight">
                  {Number(producto.stock_actual).toFixed(2)}
                  <span className="text-xs font-medium text-muted-foreground ml-1">{producto.unidad_medida}</span>
                </p>
              </div>
            </div>
          </div>
          {/* Entradas */}
          <div className="relative bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-emerald-400/70 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <TrendingUp size={16} className="text-white" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">Total entradas</p>
                <p className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">+{totalEntradas.toFixed(2)}</p>
              </div>
            </div>
          </div>
          {/* Salidas */}
          <div className="relative bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-rose-400/70 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0 shadow-sm">
                <TrendingDown size={16} className="text-white" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">Total salidas</p>
                <p className="text-xl font-black tabular-nums text-rose-600 dark:text-rose-400 leading-tight">−{totalSalidas.toFixed(2)}</p>
              </div>
            </div>
          </div>
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
                  <Skeleton className="h-5 w-16 rounded-full" />
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
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Fecha", "Tipo", "Referencia", "Entrada", "Salida", "Saldo", "Usuario", "Nota"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
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
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays size={11} className="opacity-50" />
                            {fmtFecha(m.fecha)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                            cfg.accentBg, cfg.accentBorder, cfg.color
                          )}>
                            <Icon size={10} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {m.referencia
                            ? <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/70">{m.referencia}</span>
                            : <span className="text-muted-foreground/40">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                          {entrada != null
                            ? <span>+{entrada.toFixed(2)}</span>
                            : <span className="text-muted-foreground/30 font-normal">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-sm">
                          {salida != null
                            ? <span className="text-rose-600 dark:text-rose-400">−{salida.toFixed(2)}</span>
                            : m.tipo === "AJUSTE"
                            ? <span className="text-amber-600 dark:text-amber-400">±{Number(m.cantidad).toFixed(2)}</span>
                            : <span className="text-muted-foreground/30 font-normal">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 tabular-nums text-sm">
                          <span className="font-black text-foreground">{Number(m.stock_despues).toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <User2 size={11} className="opacity-50" />
                            {m.usuario_nombre}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-40 truncate">
                          {m.nota || <span className="text-muted-foreground/30">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td colSpan={3} className="px-4 py-2.5 text-2xs font-black text-foreground uppercase tracking-widest">
                      Totales del período
                    </td>
                    <td className="px-4 py-2.5 font-black text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                      +{totalEntradas.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-black text-rose-600 dark:text-rose-400 tabular-nums text-sm">
                      −{totalSalidas.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-black text-foreground tabular-nums text-sm">
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
