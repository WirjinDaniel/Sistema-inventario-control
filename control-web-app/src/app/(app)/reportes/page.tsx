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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";

type Rango = "hoy" | "semana" | "mes" | "personalizado";

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", FIADO: "Fiado",
};
const METODO_BADGE: Record<string, "success" | "info" | "purple" | "warning"> = {
  EFECTIVO: "success", TARJETA: "info", TRANSFERENCIA: "purple", FIADO: "warning",
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
    { icon: DollarSign, label: "Total vendido", value: formatCurrency(totalVentas), bg: "bg-brand-50 dark:bg-brand-950/30", ic: "text-brand-600 dark:text-brand-400" },
    { icon: ShoppingBag, label: "Transacciones", value: String(completadas.length), bg: "bg-sky-50 dark:bg-sky-950/30", ic: "text-sky-600 dark:text-sky-400" },
    { icon: TrendingUp, label: "Ticket promedio", value: formatCurrency(ticketPromedio), bg: "bg-emerald-50 dark:bg-emerald-950/30", ic: "text-emerald-600 dark:text-emerald-400" },
    { icon: Users, label: "Anuladas", value: String(anuladas.length), bg: "bg-rose-50 dark:bg-rose-950/30", ic: "text-rose-600 dark:text-rose-400" },
  ];

  const rangoLabel = rango === "hoy" ? "hoy" : rango === "semana" ? "7-dias" : rango === "mes" ? "mes" : "personalizado";

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
            {STATS.map(({ icon: Icon, label, value, bg, ic }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 hover:-translate-y-0.5 transition-transform">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", bg)}>
                  <Icon size={17} className={ic} />
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
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
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center">
                    <BarChart2 size={15} className="text-brand-500" />
                  </div>
                  <h3 className="text-sm font-semibold">Ventas por método de pago</h3>
                </div>
                {Object.keys(porMetodo).length === 0 ? (
                  <EmptyState icon={BarChart2} title="Sin ventas" description="No hay ventas en este período." />
                ) : (
                  <div className="space-y-3">
                    {Object.entries(porMetodo).sort((a, b) => b[1] - a[1]).map(([metodo, total]) => (
                      <div key={metodo} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge variant={METODO_BADGE[metodo] ?? "secondary"} className="text-xs">
                            {METODO_LABELS[metodo] ?? metodo}
                          </Badge>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{((total / totalVentas) * 100).toFixed(1)}%</span>
                            <span className="text-sm font-bold tabular-nums">{formatCurrency(total)}</span>
                          </div>
                        </div>
                        <Progress value={(total / maximo) * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tendencia diaria */}
            <TabsContent value="tendencia" className="mt-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Ventas por día</h3>
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
                            <span className="text-[10px] text-white font-medium tabular-nums">{formatCurrency(total)}</span>
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
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Star size={15} className="text-amber-500" />
                    <h3 className="text-sm font-semibold">Análisis ABC de productos</h3>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      A=80% ventas · B=95% · C=resto
                    </Badge>
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
                        <tr className="border-b border-border bg-muted/50">
                          {["Clase", "Producto", "Qty vendida", "Total", "% del total"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {abcData.slice(0, 50).map((p, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5">
                              <Badge variant={p.clase === "A" ? "success" : p.clase === "B" ? "info" : "secondary"} className="text-[10px] w-6 justify-center">
                                {p.clase}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-medium">{p.nombre}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{p.qty.toFixed(0)}</td>
                            <td className="px-4 py-2.5 text-sm font-bold tabular-nums">{formatCurrency(p.total)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Progress value={p.pctTotal} className="h-1.5 flex-1" />
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
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Detalle de ventas</h3>
                    <Badge variant="secondary" className="text-[10px] h-4">{ventas.length}</Badge>
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
                        <tr className="border-b border-border bg-muted/50">
                          {["Fecha / Hora", "Cajero", "Cliente", "Método", "Total", "Estado"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ventas.slice(0, 100).map((v) => (
                          <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium">{new Date(v.fecha).toLocaleDateString("es-DO")}</p>
                              <p className="text-[11px] text-muted-foreground">{new Date(v.fecha).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.cajero_nombre}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.cliente_nombre ?? "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant={METODO_BADGE[v.metodo_pago] ?? "secondary"} className="text-[10px]">
                                {METODO_LABELS[v.metodo_pago] ?? v.metodo_pago}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-bold tabular-nums text-sm">{formatCurrency(Number(v.total))}</td>
                            <td className="px-4 py-3">
                              <Badge variant={v.estado === "COMPLETADA" ? "success" : "danger"} className="text-[10px]">
                                {v.estado === "COMPLETADA" ? "Completada" : "Anulada"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
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
