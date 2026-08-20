"use client";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Search, RefreshCw, Package,
  ArrowUpRight, ArrowDownRight, Minus, DollarSign, History,
} from "lucide-react";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import type { Producto } from "@/types";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

interface CambiosPrecio {
  id: number; producto: number; producto_nombre: string;
  campo: "precio_venta" | "precio_costo" | "precio_oferta";
  valor_anterior: string; valor_nuevo: string;
  usuario_nombre: string; fecha: string; motivo: string;
}

const CAMPO_CONFIG: Record<string, { label: string; accentBg: string; accentBorder: string; color: string }> = {
  precio_venta:   { label: "Precio venta",   accentBg: "bg-sky-50",    accentBorder: "border-sky-200",    color: "text-sky-700" },
  precio_costo:   { label: "Precio costo",   accentBg: "bg-muted",     accentBorder: "border-border",     color: "text-muted-foreground" },
  precio_oferta:  { label: "Precio oferta",  accentBg: "bg-amber-50",  accentBorder: "border-amber-200",  color: "text-amber-700" },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function HistorialPreciosPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
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

  const subidas = historial.filter((h) => Number(h.valor_nuevo) > Number(h.valor_anterior)).length;
  const bajadas = historial.filter((h) => Number(h.valor_nuevo) < Number(h.valor_anterior)).length;

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  const inputCls = "border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 transition bg-card";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
          <History size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Historial de Precios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento de cambios de precio por producto</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cambios registrados", value: historial.length, gradient: "from-violet-500 to-purple-600", via: "via-violet-400/60", Icon: DollarSign },
          { label: "Aumentos",            value: subidas,          gradient: "from-rose-500 to-red-600",      via: "via-rose-400/60",   Icon: ArrowUpRight },
          { label: "Reducciones",         value: bajadas,          gradient: "from-emerald-500 to-teal-600",  via: "via-emerald-400/60", Icon: ArrowDownRight },
        ].map(({ label, value, gradient, via, Icon }) => (
          <div key={label} className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${via} to-transparent`} />
            <div className="flex items-start gap-3">
              <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm p-4 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/50 to-transparent" />
        <div className="flex gap-2 flex-wrap">
          <div className="relative min-w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Filtrar por producto…"
              className={`${inputCls} pl-8 pr-8 w-full`}
              value={busqProd}
              onChange={(e) => { setBusqProd(e.target.value); setShowSugg(true); if (!e.target.value) limpiarProducto(); }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            />
            {showSugg && busqProd && (
              <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                <button onClick={limpiarProducto} className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                  Todos los productos
                </button>
                {prodFiltrados.map((p) => (
                  <button key={p.id} onClick={() => seleccionarProducto(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted text-foreground">{p.nombre}</button>
                ))}
              </div>
            )}
          </div>
          <select value={campo} onChange={(e) => setCampo(e.target.value)} className={inputCls}>
            <option value="">Todos los campos</option>
            <option value="precio_venta">Precio venta</option>
            <option value="precio_costo">Precio costo</option>
            <option value="precio_oferta">Precio oferta</option>
          </select>
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-9 text-sm w-36" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-9 text-sm w-36" />
          <Button variant="outline" size="sm" className="gap-1" onClick={cargar}>
            <RefreshCw size={12} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/60 to-transparent" />
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted/60 rounded-xl animate-pulse" />)}
          </div>
        ) : historial.length === 0 ? (
          <EmptyState icon={DollarSign} title="Sin cambios de precio"
            description="No hay cambios de precio registrados en este período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Fecha", "Producto", "Campo", "Anterior", "Nuevo", "Variación", "Usuario"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.map((h) => {
                  const delta = calcularDelta(h.valor_anterior, h.valor_nuevo);
                  const sube = delta !== null && delta > 0;
                  const baja = delta !== null && delta < 0;
                  const campoConf = CAMPO_CONFIG[h.campo] ?? CAMPO_CONFIG.precio_costo;
                  return (
                    <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(h.fecha)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                            <Package size={11} className="text-white" />
                          </div>
                          <span className="text-xs font-semibold text-foreground truncate max-w-40">{h.producto_nombre}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold border ${campoConf.accentBg} ${campoConf.accentBorder} ${campoConf.color}`}>
                          {campoConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground line-through">
                        {formatCurrency(Number(h.valor_anterior))}
                      </td>
                      <td className="px-5 py-3 text-sm font-black tabular-nums text-foreground">
                        {formatCurrency(Number(h.valor_nuevo))}
                      </td>
                      <td className="px-5 py-3">
                        {delta === null ? (
                          <Minus size={13} className="text-muted-foreground" />
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-2xs font-semibold border",
                            sube ? "bg-rose-50 border-rose-200 text-rose-700" : baja ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"
                          )}>
                            {sube ? <ArrowUpRight size={10} /> : baja ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{h.usuario_nombre}</td>
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
