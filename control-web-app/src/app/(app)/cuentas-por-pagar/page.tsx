"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { TrendingDown, AlertTriangle, Clock, Check, Banknote, Building2, CreditCard } from "lucide-react";
import type { OrdenCompra, PagoSuplidor } from "@/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

const pagoSchema = z.object({
  monto: z.string().min(1, "Requerido").refine((v) => Number(v) > 0, "Monto inválido"),
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE"]),
  referencia: z.string().optional(),
  nota: z.string().optional(),
});
type PagoFormData = z.infer<typeof pagoSchema>;

const METODO_CONFIG: Record<PagoSuplidor["metodo"], { label: string; icon: React.ElementType }> = {
  EFECTIVO:      { label: "Efectivo",      icon: Banknote },
  TRANSFERENCIA: { label: "Transferencia", icon: Building2 },
  CHEQUE:        { label: "Cheque",        icon: CreditCard },
};

const ESTADO_CONFIG = {
  PENDIENTE: { label: "Pendiente", variant: "warning" as const },
  RECIBIDA:  { label: "Recibida",  variant: "info"    as const },
  CANCELADA: { label: "Cancelada", variant: "success" as const },
};


export default function CuentasPorPagarPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTE");
  const [pagoModal, setPagoModal] = useState<OrdenCompra | null>(null);
  const {
    register: regPago, handleSubmit: handlePago, watch: watchPago,
    setValue: setPagoVal, reset: resetPago, formState: { isSubmitting: guardando },
  } = useForm<PagoFormData>({ resolver: zodResolver(pagoSchema), defaultValues: { monto: "", metodo: "EFECTIVO", referencia: "", nota: "" } });
  const metodoPago = watchPago("metodo");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      const { data } = await api.get(`/compras/ordenes/?${params}`);
      setOrdenes(data.results ?? data);
    } catch { toast.error("Error cargando cuentas por pagar"); }
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const registrarPago = handlePago(async (data) => {
    if (!pagoModal) return;
    try {
      await api.post("/compras/pagos/", { orden: pagoModal.id, ...data });
      toast.success(`Pago de ${formatCurrency(Number(data.monto))} registrado`);
      setPagoModal(null); resetPago(); cargar();
    } catch { toast.error("Error al registrar el pago"); }
  });

  const totalPendiente = ordenes
    .filter((o) => o.estado !== "CANCELADA")
    .reduce((s, o) => s + Number(o.balance_pendiente), 0);

  const venceEstaSemana = ordenes.filter((o) => {
    if (o.estado === "CANCELADA" || !o.fecha) return false;
    const diasDesde = Math.abs((new Date().getTime() - new Date(o.fecha).getTime()) / 86400000);
    return diasDesde <= 7;
  }).length;

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Cuentas por Pagar"
        description="Facturas de compra pendientes de pago a proveedores"
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total por pagar", value: formatCurrency(totalPendiente), sub: `${ordenes.filter((o) => o.estado !== "CANCELADA").length} facturas`, color: "text-foreground" },
          { label: "Esta semana", value: String(venceEstaSemana), sub: "facturas recientes", color: "text-amber-600 dark:text-amber-400", warn: true },
          { label: "Canceladas", value: String(ordenes.filter((o) => o.estado === "CANCELADA").length), sub: "pagadas al proveedor", color: "text-emerald-600 dark:text-emerald-400" },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(
            "bg-card border rounded-xl p-4",
            kpi.warn ? "border-amber-200 dark:border-amber-800" : "border-border"
          )}>
            <p className={cn("text-xs font-medium uppercase tracking-wide flex items-center gap-1", kpi.warn ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground")}>
              {kpi.warn && <Clock size={11} />} {kpi.label}
            </p>
            <p className={cn("text-2xl font-bold mt-1 tabular-nums", kpi.color)}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["", "PENDIENTE", "RECIBIDA", "CANCELADA"] as const).map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              filtroEstado === e
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {e === "" ? "Todas" : ESTADO_CONFIG[e]?.label ?? e}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : ordenes.length === 0 ? (
          <EmptyState icon={TrendingDown} title="Sin facturas" description={filtroEstado ? `No hay facturas con estado "${ESTADO_CONFIG[filtroEstado as keyof typeof ESTADO_CONFIG]?.label}"` : "Sin cuentas por pagar"} />
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
              <tr className="border-b border-border bg-muted/50">
                {["Proveedor", "N° Factura", "Fecha", "Total", "Pagado", "Balance", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordenes.map((o) => {
                const estado = ESTADO_CONFIG[o.estado as keyof typeof ESTADO_CONFIG] ?? { label: o.estado, variant: "secondary" as const };
                const balancePct = Number(o.total) > 0 ? (Number(o.total_pagado) / Number(o.total)) * 100 : 0;
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{o.suplidor_nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.numero_factura || `#${o.id}`}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(o.fecha)}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{formatCurrency(Number(o.total))}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(Number(o.total_pagado))}</p>
                      {balancePct > 0 && <Progress value={Math.min(balancePct, 100)} className="h-1 w-16 mt-1" />}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(o.balance_pendiente) > 0 ? (
                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-sm">
                          <AlertTriangle size={11} /> {formatCurrency(Number(o.balance_pendiente))}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {o.estado !== "CANCELADA" && Number(o.balance_pendiente) > 0 && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setPagoModal(o); resetPago({ monto: "", metodo: "EFECTIVO", referencia: "", nota: "" }); }}
                        >
                          Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal pago */}
      <Dialog open={!!pagoModal} onOpenChange={(o) => !o && setPagoModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          {pagoModal && (
            <form onSubmit={registrarPago} className="space-y-4 py-2">
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
                <p className="font-semibold text-foreground">{pagoModal.suplidor_nombre}</p>
                <p className="text-muted-foreground mt-0.5">Balance: <span className="font-bold tabular-nums text-foreground">{formatCurrency(Number(pagoModal.balance_pendiente))}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="monto-pago">Monto (RD$)</Label>
                <Input
                  id="monto-pago" type="number" step="0.01" autoFocus
                  className="text-center text-xl font-bold h-12 tabular-nums"
                  placeholder="0.00"
                  aria-required="true"
                  {...regPago("monto")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Método de pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(METODO_CONFIG) as [PagoSuplidor["metodo"], (typeof METODO_CONFIG)[PagoSuplidor["metodo"]]][]).map(([k, v]) => (
                    <button
                      key={k} type="button"
                      onClick={() => setPagoVal("metodo", k)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all",
                        metodoPago === k
                          ? "border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <v.icon size={16} /> {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="referencia-pago">Referencia</Label>
                <Input id="referencia-pago" placeholder="N° cheque, transferencia..." {...regPago("referencia")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="nota-pago">Nota (opcional)</Label>
                <Input id="nota-pago" placeholder="Observaciones..." {...regPago("nota")} />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setPagoModal(null)}>Cancelar</Button>
                <Button type="submit" disabled={guardando} className="gap-2">
                  {guardando
                    ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    : <Check size={14} />}
                  Confirmar pago
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
