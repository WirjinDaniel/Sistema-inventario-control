"use client";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Search, RefreshCw, Package,
  ArrowUpRight, ArrowDownRight, Minus, DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import type { Producto } from "@/types";

interface CambiosPrecio {
  id: number; producto: number; producto_nombre: string;
  campo: "precio_venta" | "precio_costo" | "precio_oferta";
  valor_anterior: string; valor_nuevo: string;
  usuario_nombre: string; fecha: string; motivo: string;
}

const CAMPO_LABELS: Record<string, string> = {
  precio_venta: "Precio venta", precio_costo: "Precio costo", precio_oferta: "Precio oferta",
};
const CAMPO_BADGE: Record<string, "info" | "secondary" | "warning"> = {
  precio_venta: "info", precio_costo: "secondary", precio_oferta: "warning",
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function HistorialPreciosPage() {
  const [historial, setHistorial] = useState<CambiosPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [busqProd, setBusqProd] = useState("");
  const [showSugg, setShowSugg] = useState(false);
  const [campo, setCampo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productoId) params.set("producto", String(productoId));
      if (campo) params.set("campo", campo);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      params.set("page_size", "200");
      const { data } = await api.get(`/historial-precios/?${params}`);
      setHistorial(data.results ?? data);
    } catch { setHistorial([]); }
    setLoading(false);
  }, [productoId, campo, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get("/productos/?page_size=200").then(({ data }) => setProductos(data.results ?? data)).catch(() => {});
  }, []);

  const prodFiltrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0, 8);

  function seleccionarProducto(p: Producto) {
    setProductoId(p.id); setBusqProd(p.nombre); setShowSugg(false);
  }

  function limpiarProducto() {
    setProductoId(null); setBusqProd(""); setShowSugg(false);
  }

  function calcularDelta(anterior: string, nuevo: string) {
    const a = Number(anterior); const n = Number(nuevo);
    if (a === 0) return null;
    return ((n - a) / a) * 100;
  }

  // Estadísticas del historial filtrado
  const subidas = historial.filter((h) => Number(h.valor_nuevo) > Number(h.valor_anterior)).length;
  const bajadas = historial.filter((h) => Number(h.valor_nuevo) < Number(h.valor_anterior)).length;
  const productosUnicos = new Set(historial.map((h) => h.producto)).size;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Historial de Precios"
        description="Seguimiento de cambios de precio por producto"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cambios registrados", value: historial.length, icon: DollarSign, color: "text-brand-500" },
          { label: "Aumentos", value: subidas, icon: ArrowUpRight, color: "text-rose-500" },
          { label: "Reducciones", value: bajadas, icon: ArrowDownRight, color: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {/* Búsqueda de producto */}
        <div className="relative min-w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por producto…"
            className="pl-8 h-8 text-sm pr-8"
            value={busqProd}
            onChange={(e) => { setBusqProd(e.target.value); setShowSugg(true); if (!e.target.value) limpiarProducto(); }}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          />
          {showSugg && busqProd && (
            <div className="absolute top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
              <button onClick={limpiarProducto} className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                Todos los productos
              </button>
              {prodFiltrados.map((p) => (
                <button key={p.id} onClick={() => seleccionarProducto(p)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted">{p.nombre}</button>
              ))}
            </div>
          )}
        </div>
        <select value={campo} onChange={(e) => setCampo(e.target.value)}
          className="h-8 text-sm border border-border rounded-md bg-background px-2 min-w-36">
          <option value="">Todos los campos</option>
          <option value="precio_venta">Precio venta</option>
          <option value="precio_costo">Precio costo</option>
          <option value="precio_oferta">Precio oferta</option>
        </select>
        <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-8 text-sm w-36" />
        <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-8 text-sm w-36" />
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={cargar}>
          <RefreshCw size={12} /> Actualizar
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : historial.length === 0 ? (
          <EmptyState icon={DollarSign} title="Sin cambios de precio"
            description="No hay cambios de precio registrados en este período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Fecha", "Producto", "Campo", "Anterior", "Nuevo", "Variación", "Usuario"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.map((h) => {
                  const delta = calcularDelta(h.valor_anterior, h.valor_nuevo);
                  const sube = delta !== null && delta > 0;
                  const baja = delta !== null && delta < 0;
                  return (
                    <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(h.fecha)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package size={11} className="text-muted-foreground" />
                          </div>
                          <span className="text-xs font-medium truncate max-w-40">{h.producto_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={CAMPO_BADGE[h.campo] ?? "secondary"} className="text-[10px]">
                          {CAMPO_LABELS[h.campo] ?? h.campo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground line-through">
                        {formatCurrency(Number(h.valor_anterior))}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold tabular-nums">
                        {formatCurrency(Number(h.valor_nuevo))}
                      </td>
                      <td className="px-4 py-3">
                        {delta === null ? (
                          <Minus size={13} className="text-muted-foreground" />
                        ) : (
                          <span className={cn("flex items-center gap-0.5 text-xs font-semibold",
                            sube ? "text-rose-600" : baja ? "text-emerald-600" : "text-muted-foreground")}>
                            {sube ? <ArrowUpRight size={12} /> : baja ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{h.usuario_nombre}</td>
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
