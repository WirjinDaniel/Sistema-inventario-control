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
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ESTADO_CONFIG: Record<string, { label: string; accentBg: string; accentBorder: string; color: string }> = {
  PENDIENTE: { label: "Pendiente", accentBg: "bg-amber-50",   accentBorder: "border-amber-200",   color: "text-amber-700" },
  RECIBIDA:  { label: "Recibida",  accentBg: "bg-sky-50",     accentBorder: "border-sky-200",     color: "text-sky-700" },
  CANCELADA: { label: "Cancelada", accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", color: "text-emerald-700" },
};

const FILTROS = ["", "PENDIENTE", "RECIBIDA", "CANCELADA"] as const;

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

  const kpis = [
    { label: "Total por pagar", value: formatCurrency(totalPendiente), sub: `${ordenes.filter((o) => o.estado !== "CANCELADA").length} facturas`, gradient: "from-rose-500 to-red-600", via: "via-rose-400/60", Icon: TrendingDown },
    { label: "Esta semana",     value: String(venceEstaSemana),        sub: "facturas recientes",        gradient: "from-amber-500 to-orange-600", via: "via-amber-400/60", Icon: Clock },
    { label: "Canceladas",      value: String(ordenes.filter((o) => o.estado === "CANCELADA").length), sub: "pagadas al proveedor", gradient: "from-emerald-500 to-teal-600", via: "via-emerald-400/60", Icon: Check },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm shrink-0">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
          <TrendingDown size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Facturas de compra pendientes de pago a proveedores</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${kpi.via} to-transparent`} />
            <div className="flex items-start gap-3">
              <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${kpi.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <kpi.Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className="text-xl font-black text-foreground tabular-nums mt-0.5">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all duration-150",
              filtroEstado === e
                ? "bg-linear-to-r from-brand-500 to-indigo-600 text-white border-transparent shadow-sm"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {e === "" ? "Todas" : ESTADO_CONFIG[e]?.label ?? e}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-rose-400/60 to-transparent" />
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : ordenes.length === 0 ? (
          <EmptyState icon={TrendingDown} title="Sin facturas" description={filtroEstado ? `No hay facturas con estado "${ESTADO_CONFIG[filtroEstado]?.label}"` : "Sin cuentas por pagar"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Proveedor", "N° Factura", "Fecha", "Total", "Pagado", "Balance", "Estado", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ordenes.map((o) => {
                  const estado = ESTADO_CONFIG[o.estado] ?? { label: o.estado, accentBg: "bg-muted", accentBorder: "border-border", color: "text-muted-foreground" };
                  const balancePct = Number(o.total) > 0 ? (Number(o.total_pagado) / Number(o.total)) * 100 : 0;
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-semibold text-foreground">{o.suplidor_nombre}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{o.numero_factura || `#${o.id}`}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(o.fecha)}</span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-foreground tabular-nums">{formatCurrency(Number(o.total))}</td>
                      <td className="px-5 py-3 tabular-nums">
                        <p className="text-emerald-600 text-sm">{formatCurrency(Number(o.total_pagado))}</p>
                        {balancePct > 0 && <Progress value={Math.min(balancePct, 100)} className="h-1 w-16 mt-1" />}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {Number(o.balance_pendiente) > 0 ? (
                          <span className="flex items-center gap-1 text-rose-600 font-black text-sm">
                            <AlertTriangle size={11} /> {formatCurrency(Number(o.balance_pendiente))}
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-sm">{formatCurrency(0)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold border ${estado.accentBg} ${estado.accentBorder} ${estado.color}`}>
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {o.estado !== "CANCELADA" && Number(o.balance_pendiente) > 0 && (
                          <button
                            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                            onClick={() => { setPagoModal(o); resetPago({ monto: "", metodo: "EFECTIVO", referencia: "", nota: "" }); }}
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal pago */}
      <Dialog open={!!pagoModal} onOpenChange={(o) => !o && setPagoModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-lg bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Banknote size={13} className="text-white" />
              </div>
              Registrar pago
            </DialogTitle>
          </DialogHeader>
          {pagoModal && (
            <form onSubmit={registrarPago} className="space-y-4 py-2">
              <div className="bg-muted/50 border border-border rounded-xl p-3 text-sm">
                <p className="font-semibold text-foreground">{pagoModal.suplidor_nombre}</p>
                <p className="text-muted-foreground mt-0.5">Balance: <span className="font-black tabular-nums text-foreground">{formatCurrency(Number(pagoModal.balance_pendiente))}</span></p>
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
                        "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                        metodoPago === k
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
