"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeftRight, Search, TrendingUp, TrendingDown, RotateCcw,
  ShoppingCart, X,
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
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badge: "success" as const,
    sign: "+",
    valueColor: "text-emerald-600 dark:text-emerald-400",
  },
  SALIDA: {
    label: "Salida",
    icon: TrendingDown,
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    badge: "danger" as const,
    sign: "-",
    valueColor: "text-rose-600 dark:text-rose-400",
  },
  AJUSTE: {
    label: "Ajuste",
    icon: RotateCcw,
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    badge: "warning" as const,
    sign: "±",
    valueColor: "text-amber-600 dark:text-amber-400",
  },
  VENTA: {
    label: "Venta",
    icon: ShoppingCart,
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    badge: "info" as const,
    sign: "-",
    valueColor: "text-blue-600 dark:text-blue-400",
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

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Movimientos de inventario"
        description={`${movs.length} registros en el período seleccionado`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, (typeof TIPO_CONFIG)[keyof typeof TIPO_CONFIG]][]).map(([tipo, cfg]) => {
          const Icon = cfg.icon;
          const val = kpis[tipo];
          return (
            <div
              key={tipo}
              onClick={() => setFiltroTipo(filtroTipo === tipo ? "" : tipo)}
              className={cn(
                "bg-card border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all hover:shadow-sm",
                filtroTipo === tipo ? "border-brand-300 dark:border-brand-700 ring-1 ring-brand-200 dark:ring-brand-800" : "border-border"
              )}
            >
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", cfg.iconBg)}>
                <Icon size={18} className={cfg.iconColor} />
              </div>
              <div>
                <p className={cn("text-xl font-bold tabular-nums", cfg.valueColor)}>
                  {Number(val).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">{cfg.label}s</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
          className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" />
          <span className="text-xs text-muted-foreground">—</span>
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={limpiarFiltros}>
            <X size={12} /> Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-12" />
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
              <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                <tr className="border-b border-border bg-muted/50">
                  {["Fecha", "Producto", "Tipo", "Cantidad", "Antes → Después", "Referencia", "Usuario"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movs.map((m) => {
                  const cfg = TIPO_CONFIG[m.tipo] ?? TIPO_CONFIG.AJUSTE;
                  const Icon = cfg.icon;
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtFecha(m.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{m.producto_nombre}</p>
                        {m.nota && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{m.nota}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.badge} className="gap-1 text-xs">
                          <Icon size={10} /> {cfg.label}
                        </Badge>
                      </td>
                      <td className={cn("px-4 py-3 font-bold tabular-nums text-sm", cfg.valueColor)}>
                        {cfg.sign}{Number(m.cantidad).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        <span>{Number(m.stock_antes).toFixed(2)}</span>
                        <span className="mx-1.5 text-border">→</span>
                        <span className="font-semibold text-foreground">{Number(m.stock_despues).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {m.referencia || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.usuario_nombre}</td>
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
