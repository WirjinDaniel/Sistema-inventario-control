"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeftRight, Search, TrendingUp, TrendingDown, RotateCcw,
  ShoppingCart, X, SlidersHorizontal, CalendarDays, User2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

interface Movimiento {
  id: number;
  producto: number;
  producto_nombre: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE" | "VENTA";
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  referencia: string;
  usuario_nombre: string;
  fecha: string;
  nota: string;
}

const TIPO_CONFIG = {
  ENTRADA: {
    label: "Entrada",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-600",
    accentBg: "bg-emerald-50 dark:bg-emerald-950/30",
    accentBorder: "border-emerald-200 dark:border-emerald-800/50",
    accentLine: "via-emerald-400/70",
    badge: "success" as const,
    sign: "+",
    valueColor: "text-emerald-600 dark:text-emerald-400",
    rowBar: "bg-emerald-400",
  },
  SALIDA: {
    label: "Salida",
    icon: TrendingDown,
    gradient: "from-rose-500 to-red-600",
    accentBg: "bg-rose-50 dark:bg-rose-950/30",
    accentBorder: "border-rose-200 dark:border-rose-800/50",
    accentLine: "via-rose-400/70",
    badge: "danger" as const,
    sign: "−",
    valueColor: "text-rose-600 dark:text-rose-400",
    rowBar: "bg-rose-400",
  },
  AJUSTE: {
    label: "Ajuste",
    icon: RotateCcw,
    gradient: "from-amber-500 to-orange-500",
    accentBg: "bg-amber-50 dark:bg-amber-950/30",
    accentBorder: "border-amber-200 dark:border-amber-800/50",
    accentLine: "via-amber-400/70",
    badge: "warning" as const,
    sign: "±",
    valueColor: "text-amber-600 dark:text-amber-400",
    rowBar: "bg-amber-400",
  },
  VENTA: {
    label: "Venta",
    icon: ShoppingCart,
    gradient: "from-sky-500 to-blue-600",
    accentBg: "bg-sky-50 dark:bg-sky-950/30",
    accentBorder: "border-sky-200 dark:border-sky-800/50",
    accentLine: "via-sky-400/70",
    badge: "info" as const,
    sign: "−",
    valueColor: "text-sky-600 dark:text-sky-400",
    rowBar: "bg-sky-400",
  },
} as const;

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function MovimientosPage() {
  const { esAdmin, esSuperadmin, usuario } = useAuthStore();
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const { data } = await api.get(`/inventario/movimientos/?${params}`);
      setMovs(data.results ?? data);
    } catch {
      toast.error("Error cargando movimientos");
    }
    setLoading(false);
  }, [busqueda, filtroTipo, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const limpiarFiltros = () => {
    setBusqueda(""); setFiltroTipo(""); setFechaDesde(""); setFechaHasta("");
  };
  const hayFiltros = !!(busqueda || filtroTipo || fechaDesde || fechaHasta);

  const kpis = {
    ENTRADA: movs.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + Number(m.cantidad), 0),
    SALIDA:  movs.filter((m) => m.tipo === "SALIDA").reduce((s, m) => s + Number(m.cantidad), 0),
    AJUSTE:  movs.filter((m) => m.tipo === "AJUSTE").length,
    VENTA:   movs.filter((m) => m.tipo === "VENTA").reduce((s, m) => s + Number(m.cantidad), 0),
  };

  if (!esAdmin() && !esSuperadmin() && usuario?.rol !== "INVENTARIO") return <AccessDenied />;

  const totalMovs = movs.length;
  const tiposUnicos = new Set(movs.map(m => m.tipo)).size;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Movimientos de inventario"
        description={
          <span className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50 px-2 py-0.5 rounded-full">
              <ArrowLeftRight size={10} /> {totalMovs} registros
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-full">
              <SlidersHorizontal size={10} /> {tiposUnicos} tipo{tiposUnicos !== 1 ? "s" : ""}
            </span>
          </span>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, (typeof TIPO_CONFIG)[keyof typeof TIPO_CONFIG]][]).map(([tipo, cfg]) => {
          const Icon = cfg.icon;
          const val = kpis[tipo];
          const isActive = filtroTipo === tipo;
          return (
            <div
              key={tipo}
              onClick={() => setFiltroTipo(isActive ? "" : tipo)}
              className={cn(
                "relative bg-card border rounded-xl p-4 cursor-pointer transition-all duration-200 overflow-hidden group",
                "hover:shadow-md hover:-translate-y-0.5",
                isActive
                  ? cn("shadow-sm", cfg.accentBg, cfg.accentBorder)
                  : "border-border hover:border-border"
              )}
            >
              {/* Top accent line */}
              <div className={cn(
                "absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent to-transparent transition-opacity duration-200",
                cfg.accentLine,
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
              )} />

              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br shadow-sm",
                  cfg.gradient
                )}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <p className={cn("text-2xl font-black tabular-nums leading-tight", cfg.valueColor)}>
                    {Number(val).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">{cfg.label}s</p>
                </div>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-60" style={{ color: cfg.valueColor.includes("emerald") ? "#10b981" : cfg.valueColor.includes("rose") ? "#f43f5e" : cfg.valueColor.includes("amber") ? "#f59e0b" : "#0ea5e9" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto, referencia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={13} className="text-muted-foreground" />
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" />
          <span className="text-xs text-muted-foreground">—</span>
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={limpiarFiltros}>
            <X size={12} /> Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : movs.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sin movimientos"
            description="No hay movimientos que coincidan con los filtros aplicados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Fecha", "Producto", "Tipo", "Cantidad", "Antes → Después", "Referencia", "Usuario"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movs.map((m) => {
                  const cfg = TIPO_CONFIG[m.tipo] ?? TIPO_CONFIG.AJUSTE;
                  const Icon = cfg.icon;
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors group relative">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={11} className="opacity-50" />
                          {fmtFecha(m.fecha)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-1.5 h-8 rounded-full shrink-0 opacity-60",
                            cfg.rowBar
                          )} />
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">{m.producto_nombre}</p>
                            {m.nota && <p className="text-xs text-muted-foreground truncate max-w-48 mt-0.5">{m.nota}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                          cfg.accentBg, cfg.accentBorder, cfg.valueColor
                        )}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 font-black tabular-nums text-base", cfg.valueColor)}>
                        {cfg.sign}{Number(m.cantidad).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{Number(m.stock_antes).toFixed(2)}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span className="font-bold text-foreground">{Number(m.stock_despues).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {m.referencia
                          ? <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/70">{m.referencia}</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User2 size={11} className="opacity-50" />
                          {m.usuario_nombre}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
