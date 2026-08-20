"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Download, TrendingUp, ShoppingBag, DollarSign, Users, FileText,
  BarChart2, Package, Percent, RefreshCw, Star,
} from "lucide-react";
import api from "@/lib/api";
import type { Venta } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

type Rango = "hoy" | "semana" | "mes" | "personalizado";

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", FIADO: "Fiado",
};
const METODO_CONFIG: Record<string, { accentBg: string; accentBorder: string; color: string; bar: string }> = {
  EFECTIVO:      { accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", color: "text-emerald-700", bar: "bg-emerald-500" },
  TARJETA:       { accentBg: "bg-sky-50",     accentBorder: "border-sky-200",     color: "text-sky-700",     bar: "bg-sky-500" },
  TRANSFERENCIA: { accentBg: "bg-violet-50",  accentBorder: "border-violet-200",  color: "text-violet-700",  bar: "bg-violet-500" },
  FIADO:         { accentBg: "bg-amber-50",   accentBorder: "border-amber-200",   color: "text-amber-700",   bar: "bg-amber-500" },
};
const RANGOS: { key: Rango; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "7 días" },
  { key: "mes", label: "Este mes" },
  { key: "personalizado", label: "Personalizado" },
];

interface VentaItem { id: number; producto_nombre: string; cantidad: string; precio_unitario: string; subtotal: string; }
interface VentaDetalle extends Venta { items: VentaItem[]; }

function exportarCSV(ventas: Venta[], nombre: string) {
  const headers = ["ID", "Fecha", "Cajero", "Cliente", "Método", "Total", "Estado"];
  const rows = ventas.map((v) => [
    v.id,
    new Date(v.fecha).toLocaleString("es-DO"),
    v.cajero_nombre,
    v.cliente_nombre ?? "",
    METODO_LABELS[v.metodo_pago] ?? v.metodo_pago,
    Number(v.total).toFixed(2),
    v.estado,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${nombre}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function calcularABC(ventasDetalle: VentaDetalle[]) {
  const mapa: Record<string, { nombre: string; total: number; qty: number }> = {};
  for (const v of ventasDetalle) {
    for (const it of (v.items ?? [])) {
      if (!mapa[it.producto_nombre]) mapa[it.producto_nombre] = { nombre: it.producto_nombre, total: 0, qty: 0 };
      mapa[it.producto_nombre].total += Number(it.subtotal);
      mapa[it.producto_nombre].qty += Number(it.cantidad);
    }
  }
  const lista = Object.values(mapa).sort((a, b) => b.total - a.total);
  const totalGlobal = lista.reduce((a, p) => a + p.total, 0);
  let acum = 0;
  return lista.map((p) => {
    acum += p.total;
    const pct = totalGlobal ? (acum / totalGlobal) * 100 : 0;
    return { ...p, clase: pct <= 80 ? "A" : pct <= 95 ? "B" : "C", pctTotal: totalGlobal ? (p.total / totalGlobal) * 100 : 0 };
  });
}

export default function ReportesPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [rango, setRango] = useState<Rango>("hoy");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasDetalle, setVentasDetalle] = useState<VentaDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [cargandoABC, setCargandoABC] = useState(false);
  const [tab, setTab] = useState("resumen");

  const filtrar = useCallback((lista: Venta[]) => {
    const ahora = new Date();
    return lista.filter((v) => {
      const f = new Date(v.fecha);
      if (rango === "hoy") return f.toDateString() === ahora.toDateString();
      if (rango === "semana") return f >= new Date(ahora.getTime() - 7 * 86400000);
      if (rango === "mes") return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      if (rango === "personalizado") {
        if (fechaDesde && f < new Date(fechaDesde)) return false;
        if (fechaHasta && f > new Date(fechaHasta + "T23:59:59")) return false;
        return true;
      }
      return true;
    });
  }, [rango, fechaDesde, fechaHasta]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ventas/?page_size=1000");
      const lista: Venta[] = data.results ?? data;
      setVentas(filtrar(lista));
    } catch { setVentas([]); }
    setLoading(false);
  }, [filtrar]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cargarABC() {
    if (ventasDetalle.length > 0) return;
    setCargandoABC(true);
    try {
      const { data } = await api.get("/ventas/?page_size=200");
      const lista: Venta[] = data.results ?? data;
      const filtradas = filtrar(lista);
      const det = await Promise.all(
        filtradas.slice(0, 100).map(async (v) => {
          try { const { data: d } = await api.get(`/ventas/${v.id}/`); return { ...v, items: d.items ?? [] }; }
          catch { return { ...v, items: [] }; }
        })
      );
      setVentasDetalle(det);
    } catch { setVentasDetalle([]); }
    setCargandoABC(false);
  }

  useEffect(() => { if (tab === "abc") cargarABC(); }, [tab]);

  const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
  const anuladas = ventas.filter((v) => v.estado === "ANULADA");
  const totalVentas = completadas.reduce((a, v) => a + Number(v.total), 0);
  const ticketPromedio = completadas.length ? totalVentas / completadas.length : 0;
  const porMetodo = completadas.reduce<Record<string, number>>((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + Number(v.total);
    return acc;
  }, {});
  const maximo = Math.max(...Object.values(porMetodo), 1);

  // Comparativa por día
  const ventasPorDia = completadas.reduce<Record<string, number>>((acc, v) => {
    const dia = new Date(v.fecha).toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
    acc[dia] = (acc[dia] ?? 0) + Number(v.total);
    return acc;
  }, {});
  const diasOrdenados = Object.entries(ventasPorDia).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).slice(-14);
  const maxDia = Math.max(...diasOrdenados.map((d) => d[1]), 1);

  const abcData = calcularABC(ventasDetalle);

  const STATS = [
    { icon: DollarSign,  label: "Total vendido",  value: formatCurrency(totalVentas),        gradient: "from-brand-500 to-indigo-600",   accent: "bg-linear-to-r from-brand-400 to-indigo-500",   valueColor: "text-foreground" },
    { icon: ShoppingBag, label: "Transacciones",  value: String(completadas.length),          gradient: "from-sky-500 to-blue-600",        accent: "bg-linear-to-r from-sky-400 to-blue-500",       valueColor: "text-sky-700 dark:text-sky-400" },
    { icon: TrendingUp,  label: "Ticket promedio", value: formatCurrency(ticketPromedio),     gradient: "from-emerald-500 to-teal-600",    accent: "bg-linear-to-r from-emerald-400 to-teal-500",   valueColor: "text-emerald-700 dark:text-emerald-400" },
    { icon: Users,       label: "Anuladas",        value: String(anuladas.length),            gradient: "from-rose-500 to-red-600",        accent: "bg-linear-to-r from-rose-400 to-red-500",       valueColor: "text-rose-600 dark:text-rose-400" },
  ];

  const rangoLabel = rango === "hoy" ? "hoy" : rango === "semana" ? "7-dias" : rango === "mes" ? "mes" : "personalizado";

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Reportes"
        description="Análisis de ventas, productos y tendencias"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {RANGOS.map(({ key, label }) => (
                <button key={key} onClick={() => setRango(key)}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    rango === key ? "bg-background text-brand-600 dark:text-brand-400 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5"
              onClick={() => exportarCSV(ventas, `ventas-${rangoLabel}`)}>
              <Download size={13} /> CSV
            </Button>
          </div>
        }
      />

      {rango === "personalizado" && (
        <div className="flex gap-3 items-center">
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-8 text-sm w-36" />
          <span className="text-xs text-muted-foreground">→</span>
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-8 text-sm w-36" />
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={cargar}>
            <RefreshCw size={12} /> Aplicar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map(({ icon: Icon, label, value, gradient, accent, valueColor }) => (
              <div key={label} className="relative bg-card border border-border rounded-xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className={cn("absolute top-0 left-0 h-0.5 w-full", accent)} />
                <div className={cn("w-9 h-9 rounded-lg bg-linear-to-br flex items-center justify-center mb-3 shadow-sm", gradient)}>
                  <Icon size={16} className="text-white" />
                </div>
                <p className={cn("text-xl font-black tabular-nums", valueColor)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v)}>
            <TabsList className="h-8">
              <TabsTrigger value="resumen" className="text-xs h-6">Resumen</TabsTrigger>
              <TabsTrigger value="tendencia" className="text-xs h-6">Tendencia diaria</TabsTrigger>
              <TabsTrigger value="abc" className="text-xs h-6">Análisis ABC</TabsTrigger>
              <TabsTrigger value="detalle" className="text-xs h-6">Detalle</TabsTrigger>
            </TabsList>

            {/* Resumen */}
            <TabsContent value="resumen" className="mt-4">
              <div className="relative bg-card border border-border rounded-xl p-5 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <BarChart2 size={14} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Ventas por método de pago</h3>
                </div>
                {Object.keys(porMetodo).length === 0 ? (
                  <EmptyState icon={BarChart2} title="Sin ventas" description="No hay ventas en este período." />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(porMetodo).sort((a, b) => b[1] - a[1]).map(([metodo, total]) => {
                      const cfg = METODO_CONFIG[metodo] ?? { accentBg: "bg-muted", accentBorder: "border-border", color: "text-muted-foreground", bar: "bg-brand-500" };
                      return (
                        <div key={metodo} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className={cn("inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border", cfg.accentBg, cfg.accentBorder, cfg.color)}>
                              {METODO_LABELS[metodo] ?? metodo}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{((total / totalVentas) * 100).toFixed(1)}%</span>
                              <span className="text-sm font-black tabular-nums">{formatCurrency(total)}</span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-500", cfg.bar)} style={{ width: `${(total / maximo) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tendencia diaria */}
            <TabsContent value="tendencia" className="mt-4">
              <div className="relative bg-card border border-border rounded-xl p-5 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/60 to-transparent" />
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <TrendingUp size={14} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Ventas por día</h3>
                </div>
                {diasOrdenados.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Sin datos" description="No hay ventas en este período." />
                ) : (
                  <div className="space-y-2">
                    {diasOrdenados.map(([dia, total]) => (
                      <div key={dia} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{dia}</span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-brand-500 dark:bg-brand-400 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max((total / maxDia) * 100, 4)}%` }}
                          >
                            <span className="text-2xs text-white font-medium tabular-nums">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Análisis ABC */}
            <TabsContent value="abc" className="mt-4">
              <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/60 to-transparent" />
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                      <Star size={12} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Análisis ABC de productos</h3>
                    <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      A=80% · B=95% · C=resto
                    </span>
                  </div>
                  {cargandoABC && <RefreshCw size={13} className="animate-spin text-muted-foreground" />}
                </div>
                {abcData.length === 0 ? (
                  <div className="p-8">
                    <EmptyState icon={Package} title="Sin datos" description="Cargando análisis de productos…" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["Clase", "Producto", "Qty vendida", "Total", "% del total"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {abcData.slice(0, 50).map((p, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                "inline-flex w-6 h-6 items-center justify-center rounded-md text-2xs font-black border",
                                p.clase === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : p.clase === "B" ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-muted text-muted-foreground border-border"
                              )}>
                                {p.clase}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-foreground">{p.nombre}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{p.qty.toFixed(0)}</td>
                            <td className="px-4 py-2.5 text-sm font-black tabular-nums">{formatCurrency(p.total)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${p.pctTotal}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums w-10">{p.pctTotal.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Detalle */}
            <TabsContent value="detalle" className="mt-4">
              <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/60 to-transparent" />
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-linear-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                      <FileText size={12} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Detalle de ventas</h3>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{ventas.length}</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                    onClick={() => exportarCSV(ventas, `ventas-detalle-${rangoLabel}`)}>
                    <Download size={12} /> Exportar CSV
                  </Button>
                </div>
                {ventas.length === 0 ? (
                  <EmptyState icon={FileText} title="Sin ventas en este período" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["Fecha / Hora", "Cajero", "Cliente", "Método", "Total", "Estado"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ventas.slice(0, 100).map((v) => {
                          const mCfg = METODO_CONFIG[v.metodo_pago] ?? { accentBg: "bg-muted", accentBorder: "border-border", color: "text-muted-foreground" };
                          return (
                          <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-foreground">{new Date(v.fecha).toLocaleDateString("es-DO")}</p>
                              <p className="text-xs text-muted-foreground">{new Date(v.fecha).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.cajero_nombre}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.cliente_nombre ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex text-2xs font-semibold px-1.5 py-0.5 rounded-full border", mCfg.accentBg, mCfg.accentBorder, mCfg.color)}>
                                {METODO_LABELS[v.metodo_pago] ?? v.metodo_pago}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-black tabular-nums text-sm">{formatCurrency(Number(v.total))}</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex text-2xs font-semibold px-1.5 py-0.5 rounded-full border",
                                v.estado === "COMPLETADA"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-600 border-rose-200"
                              )}>
                                {v.estado === "COMPLETADA" ? "Completada" : "Anulada"}
                              </span>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {ventas.length > 100 && (
                      <div className="px-4 py-3 text-xs text-muted-foreground text-center border-t border-border bg-muted/20">
                        Mostrando 100 de {ventas.length} ventas · Exporta CSV para verlas todas
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
