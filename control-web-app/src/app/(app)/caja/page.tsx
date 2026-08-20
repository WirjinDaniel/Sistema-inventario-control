"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import toast from "react-hot-toast";
import type { SesionCaja } from "@/types";
import {
  LockKeyhole, LockKeyholeOpen, DollarSign, CreditCard,
  ArrowLeftRight, Clock, History, Banknote,
  TrendingUp, ShoppingCart, AlertCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

const aperturaSchema = z.object({
  efectivo_inicial: z.string().min(1, "Requerido").refine((v) => Number(v) >= 0, "Debe ser >= 0"),
});
const cierreSchema = z.object({
  efectivo_declarado: z.string().min(1, "Ingresa el efectivo contado").refine((v) => !isNaN(Number(v)), "Valor inválido"),
  nota_cierre: z.string().optional(),
});
type AperturaForm = z.infer<typeof aperturaSchema>;
type CierreForm = z.infer<typeof cierreSchema>;

interface ResumenVentas {
  efectivo: number; tarjeta: number;
  transferencia: number; fiado: number;
  total: number; cantidad: number;
}

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function CajaPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null);
  const [historial, setHistorial] = useState<SesionCaja[]>([]);
  const [resumen, setResumen] = useState<ResumenVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"apertura" | "cierre" | null>(null);
  const {
    register: regAp, handleSubmit: handleAp, watch: watchAp,
    setValue: setApVal, reset: resetAp, formState: { isSubmitting: submittingAp },
  } = useForm<AperturaForm>({ resolver: zodResolver(aperturaSchema), defaultValues: { efectivo_inicial: "" } });
  const {
    register: regCi, handleSubmit: handleCi, watch: watchCi,
    reset: resetCi, formState: { isSubmitting: submittingCi },
  } = useForm<CierreForm>({ resolver: zodResolver(cierreSchema), defaultValues: { efectivo_declarado: "", nota_cierre: "" } });
  const efectivoInicial = watchAp("efectivo_inicial") ?? "";
  const efectivoDeclarado = watchCi("efectivo_declarado") ?? "";

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [activaRes, historialRes] = await Promise.all([
        api.get("/ventas/sesiones/activa/").catch(() => null),
        api.get("/ventas/sesiones/"),
      ]);
      const activa: SesionCaja | null = activaRes?.data ?? null;
      setSesionActiva(activa);
      setHistorial((historialRes.data.results ?? historialRes.data).filter((s: SesionCaja) => s.cierre));
      if (activa) {
        const ventasRes = await api.get("/ventas/", { params: { sesion: activa.id } });
        const ventas: Array<{ metodo_pago: string; total: string; estado: string }> =
          ventasRes.data.results ?? ventasRes.data;
        const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
        const r: ResumenVentas = { efectivo: 0, tarjeta: 0, transferencia: 0, fiado: 0, total: 0, cantidad: completadas.length };
        for (const v of completadas) {
          const t = Number(v.total);
          r.total += t;
          if (v.metodo_pago === "EFECTIVO") r.efectivo += t;
          else if (v.metodo_pago === "TARJETA") r.tarjeta += t;
          else if (v.metodo_pago === "TRANSFERENCIA") r.transferencia += t;
          else if (v.metodo_pago === "FIADO") r.fiado += t;
        }
        setResumen(r);
      }
    } catch {
      toast.error("Error al cargar datos de caja");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const onAbrir = handleAp(async (data) => {
    try {
      await api.post("/ventas/sesiones/", { efectivo_inicial: data.efectivo_inicial });
      toast.success("Caja abierta");
      setModal(null); resetAp(); cargar();
    } catch { toast.error("Error al abrir la caja"); }
  });

  const onCerrar = handleCi(async (data) => {
    if (!sesionActiva) return;
    try {
      await api.post(`/ventas/sesiones/${sesionActiva.id}/cerrar/`, {
        efectivo_final_declarado: data.efectivo_declarado,
        nota_cierre: data.nota_cierre,
      });
      toast.success("Caja cerrada");
      setModal(null); resetCi(); cargar();
    } catch { toast.error("Error al cerrar la caja"); }
  });

  const esperadoEnCaja = sesionActiva && resumen
    ? Number(sesionActiva.efectivo_inicial) + resumen.efectivo
    : null;

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Caja"
        description="Control de apertura y cierre de turno"
        actions={
          sesionActiva ? (
            <Button variant="destructive" onClick={() => setModal("cierre")} className="gap-2">
              <LockKeyhole size={15} /> Cerrar caja
            </Button>
          ) : (
            <Button onClick={() => setModal("apertura")} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <LockKeyholeOpen size={15} /> Abrir caja
            </Button>
          )
        }
      />

      {/* Estado actual */}
      {sesionActiva ? (
        <>
          {/* Banner turno activo */}
          <div className="relative bg-linear-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/70 rounded-xl p-4 flex items-center gap-3 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/60 to-transparent" />
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <LockKeyholeOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-300">Caja abierta</p>
              <p className="text-sm text-emerald-700/70 dark:text-emerald-400">
                {sesionActiva.cajero_nombre} · Desde {fmtFecha(sesionActiva.apertura)}
              </p>
            </div>
          </div>

          {/* KPIs del turno */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Efectivo inicial",   value: formatCurrency(Number(sesionActiva.efectivo_inicial)), icon: Banknote,     gradient: "from-slate-500 to-slate-600",    accent: "bg-linear-to-r from-slate-400 to-slate-500",    valueColor: "text-foreground" },
              { label: "Ventas del turno",   value: formatCurrency(resumen?.total ?? 0),                   icon: TrendingUp,   gradient: "from-emerald-500 to-teal-600",   accent: "bg-linear-to-r from-emerald-400 to-teal-500",   valueColor: "text-emerald-700 dark:text-emerald-400" },
              { label: "Esperado en caja",   value: formatCurrency(esperadoEnCaja ?? 0),                   icon: DollarSign,   gradient: "from-brand-500 to-indigo-600",   accent: "bg-linear-to-r from-brand-400 to-indigo-500",   valueColor: "text-brand-700 dark:text-brand-400" },
              { label: "Cantidad de ventas", value: String(resumen?.cantidad ?? 0),                         icon: ShoppingCart, gradient: "from-amber-500 to-orange-600",   accent: "bg-linear-to-r from-amber-400 to-orange-500",   valueColor: "text-amber-700 dark:text-amber-400" },
            ].map((card) => (
              <div key={card.label} className="relative bg-card border border-border rounded-xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className={cn("absolute top-0 left-0 h-0.5 w-full", card.accent)} />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <div className={cn("w-8 h-8 rounded-lg bg-linear-to-br flex items-center justify-center shadow-sm", card.gradient)}>
                    <card.icon size={15} className="text-white" />
                  </div>
                </div>
                <p className={cn("text-xl font-black tabular-nums", card.valueColor)}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Desglose métodos de pago */}
          <div className="relative bg-card border border-border rounded-xl overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/60 to-transparent" />
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <DollarSign size={13} className="text-white" />
              </div>
              <p className="text-sm font-bold text-foreground">Ventas por método de pago</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Efectivo",      value: resumen?.efectivo ?? 0,      icon: Banknote,      gradient: "from-emerald-500 to-teal-600",   color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Tarjeta",       value: resumen?.tarjeta ?? 0,       icon: CreditCard,    gradient: "from-sky-500 to-blue-600",        color: "text-sky-600 dark:text-sky-400" },
                { label: "Transferencia", value: resumen?.transferencia ?? 0, icon: ArrowLeftRight, gradient: "from-violet-500 to-purple-600",  color: "text-violet-600 dark:text-violet-400" },
                { label: "Fiado",         value: resumen?.fiado ?? 0,         icon: Clock,         gradient: "from-amber-500 to-orange-600",    color: "text-amber-600 dark:text-amber-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-7 h-7 rounded-lg bg-linear-to-br flex items-center justify-center shadow-sm", row.gradient)}>
                      <row.icon size={13} className="text-white" />
                    </div>
                    <span className="text-sm text-foreground">{row.label}</span>
                  </div>
                  <span className={cn("font-black tabular-nums text-sm", row.color)}>{formatCurrency(row.value)}</span>
                </div>
              ))}
              <div className="relative flex items-center justify-between px-5 py-3.5 bg-linear-to-r from-emerald-50/60 to-teal-50/60 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/40 to-transparent" />
                <span className="text-sm font-bold text-foreground">Total cobrado</span>
                <span className="font-black text-lg text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(resumen?.total ?? 0)}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="relative bg-card border border-border rounded-xl p-12 text-center overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/40 to-transparent" />
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <LockKeyhole size={26} className="text-slate-500 dark:text-slate-400" />
          </div>
          <p className="font-bold text-foreground text-lg">La caja está cerrada</p>
          <p className="text-sm text-muted-foreground mt-1">Abre la caja para comenzar a registrar ventas</p>
          <Button className="mt-5 gap-2 bg-linear-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-sm" onClick={() => setModal("apertura")}>
            <LockKeyholeOpen size={15} /> Abrir caja
          </Button>
        </div>
      )}

      {/* Historial de cierres */}
      {historial.length > 0 && (
        <div className="relative bg-card border border-border rounded-xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <History size={13} className="text-white" />
            </div>
            <p className="text-sm font-bold text-foreground">Historial de cierres</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Apertura", "Cierre", "Cajero", "Ef. Inicial", "Calculado", "Declarado", "Diferencia"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.map((s) => {
                  const diff = Number(s.diferencia_caja ?? 0);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(s.apertura)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{s.cierre ? fmtFecha(s.cierre) : "—"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{s.cajero_nombre}</td>
                      <td className="px-4 py-3 tabular-nums text-sm text-muted-foreground">{formatCurrency(Number(s.efectivo_inicial))}</td>
                      <td className="px-4 py-3 tabular-nums text-sm text-muted-foreground">{s.efectivo_calculado ? formatCurrency(Number(s.efectivo_calculado)) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-sm text-muted-foreground">{s.efectivo_final_declarado ? formatCurrency(Number(s.efectivo_final_declarado)) : "—"}</td>
                      <td className="px-4 py-3">
                        {s.diferencia_caja != null ? (
                          <span className={cn(
                            "inline-flex text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums",
                            diff > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                            : diff < 0 ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800"
                            : "bg-muted text-muted-foreground border-border"
                          )}>
                            {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal apertura */}
      <Dialog open={modal === "apertura"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <LockKeyholeOpen size={13} className="text-white" />
              </div>
              Apertura de caja
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onAbrir} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Efectivo en caja al abrir (RD$)</Label>
              <Input
                type="number" min="0" step="0.01" autoFocus
                className="text-center text-2xl font-bold h-14 tabular-nums"
                placeholder="0.00"
                aria-required="true"
                {...regAp("efectivo_inicial")}
              />
              <p className="text-xs text-muted-foreground text-center">Monto de cambio disponible al inicio</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000, 3000, 5000, 10000].map((v) => (
                <Button
                  key={v} type="button"
                  variant={Number(efectivoInicial) === v ? "default" : "outline"}
                  size="sm" className="text-xs"
                  onClick={() => setApVal("efectivo_inicial", String(v))}
                >
                  RD${v.toLocaleString()}
                </Button>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => { setModal(null); resetAp(); }}>Cancelar</Button>
              <Button type="submit" disabled={submittingAp} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {submittingAp ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <LockKeyholeOpen size={14} />}
                Abrir caja
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal cierre */}
      <Dialog open={modal === "cierre"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
                <LockKeyhole size={13} className="text-white" />
              </div>
              Cierre de caja
            </DialogTitle>
          </DialogHeader>
          {sesionActiva && (
            <form onSubmit={onCerrar} className="space-y-4 py-2">
              {/* Resumen del sistema */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efectivo inicial</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(Number(sesionActiva.efectivo_inicial))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventas en efectivo</span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(resumen?.efectivo ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Esperado en caja</span>
                  <span className="font-bold tabular-nums text-brand-600 dark:text-brand-400">{formatCurrency(esperadoEnCaja ?? 0)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Efectivo contado físicamente (RD$)</Label>
                <Input
                  type="number" min="0" step="0.01" autoFocus
                  className="text-center text-2xl font-bold h-14 tabular-nums"
                  placeholder="0.00"
                  aria-required="true"
                  {...regCi("efectivo_declarado")}
                />
              </div>

              {efectivoDeclarado !== "" && esperadoEnCaja !== null && (() => {
                const diff = Number(efectivoDeclarado) - esperadoEnCaja;
                const isOk = Math.abs(diff) <= 100;
                return (
                  <div className={cn(
                    "rounded-lg p-3 flex items-center gap-2 text-sm border",
                    isOk
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                  )}>
                    <AlertCircle size={15} className="shrink-0" />
                    <span>
                      Diferencia: <span className="font-bold tabular-nums">{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span>
                      {isOk ? " — dentro del margen" : " — revisar antes de cerrar"}
                    </span>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nota de cierre (opcional)</Label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Observaciones del turno..."
                  {...regCi("nota_cierre")}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                <Button type="submit" variant="destructive" disabled={submittingCi} className="gap-2">
                  {submittingCi ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <LockKeyhole size={14} />}
                  Cerrar caja
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
