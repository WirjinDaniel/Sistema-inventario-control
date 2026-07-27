"use client";

import { useEffect, useState } from "react";
import { Download, TrendingUp, ShoppingBag, DollarSign, Users, FileText, BarChart2 } from "lucide-react";
import api from "@/lib/api";
import type { Venta } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

type Rango = "hoy" | "semana" | "mes";

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", FIADO: "Fiado",
};
const METODO_BADGE: Record<string, "success" | "info" | "purple" | "warning"> = {
  EFECTIVO: "success", TARJETA: "info", TRANSFERENCIA: "purple", FIADO: "warning",
};

const RANGOS: { key: Rango; label: string }[] = [
  { key: "hoy",    label: "Hoy" },
  { key: "semana", label: "7 días" },
  { key: "mes",    label: "Este mes" },
];

export default function ReportesPage() {
  const [rango, setRango] = useState<Rango>("hoy");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [rango]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get("/ventas/?page_size=500");
      const lista: Venta[] = data.results ?? data;
      const ahora = new Date();
      const filtradas = lista.filter((v) => {
        const f = new Date(v.fecha);
        if (rango === "hoy") return f.toDateString() === ahora.toDateString();
        if (rango === "semana") return f >= new Date(ahora.getTime() - 7 * 86400000);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      });
      setVentas(filtradas);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
  const anuladas = ventas.filter((v) => v.estado === "ANULADA");
  const totalVentas = completadas.reduce((a, v) => a + Number(v.total), 0);
  const ticketPromedio = completadas.length ? totalVentas / completadas.length : 0;

  const porMetodo = completadas.reduce<Record<string, number>>((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + Number(v.total);
    return acc;
  }, {});
  const maximo = Math.max(...Object.values(porMetodo), 1);

  const STATS = [
    { icon: DollarSign, label: "Total vendido", value: formatCurrency(totalVentas), iconBg: "bg-brand-50 dark:bg-brand-950/30", iconColor: "text-brand-600 dark:text-brand-400" },
    { icon: ShoppingBag, label: "Transacciones", value: String(completadas.length), iconBg: "bg-sky-50 dark:bg-sky-950/30", iconColor: "text-sky-600 dark:text-sky-400" },
    { icon: TrendingUp, label: "Ticket promedio", value: formatCurrency(ticketPromedio), iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { icon: Users, label: "Anuladas", value: String(anuladas.length), iconBg: "bg-rose-50 dark:bg-rose-950/30", iconColor: "text-rose-600 dark:text-rose-400" },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Reportes"
        description="Resumen de ventas y movimientos"
        actions={
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {RANGOS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRango(key)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  rango === key
                    ? "bg-background text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map(({ icon: Icon, label, value, iconBg, iconColor }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 hover:-translate-y-0.5 transition-transform">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", iconBg)}>
                  <Icon size={17} className={iconColor} />
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Ventas por método */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center">
                <BarChart2 size={15} className="text-brand-500 dark:text-brand-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Ventas por método de pago</h3>
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
                      <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(total)}</span>
                    </div>
                    <Progress value={(total / maximo) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla detalle */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Detalle de ventas</h3>
                <Badge variant="secondary" className="text-[10px] h-4">{ventas.length}</Badge>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Download size={12} /> Exportar
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
                    {ventas.slice(0, 50).map((v) => (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">
                            {new Date(v.fecha).toLocaleDateString("es-DO")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(v.fecha).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{v.cajero_nombre}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{v.cliente_nombre ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={METODO_BADGE[v.metodo_pago] ?? "secondary"} className="text-[10px]">
                            {METODO_LABELS[v.metodo_pago] ?? v.metodo_pago}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground tabular-nums text-sm">
                          {formatCurrency(Number(v.total))}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={v.estado === "COMPLETADA" ? "success" : "danger"} className="text-[10px]">
                            {v.estado === "COMPLETADA" ? "Completada" : "Anulada"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ventas.length > 50 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground text-center border-t border-border bg-muted/20">
                    Mostrando 50 de {ventas.length} ventas
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
