"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null);
  const [historial, setHistorial] = useState<SesionCaja[]>([]);
  const [resumen, setResumen] = useState<ResumenVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"apertura" | "cierre" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [efectivoInicial, setEfectivoInicial] = useState("");
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
  const [notaCierre, setNotaCierre] = useState("");

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

  async function abrir() {
    if (!efectivoInicial || Number(efectivoInicial) < 0) return toast.error("Ingresa el efectivo inicial");
    setSubmitting(true);
    try {
      await api.post("/ventas/sesiones/", { efectivo_inicial: efectivoInicial });
      toast.success("Caja abierta");
      setModal(null); setEfectivoInicial(""); cargar();
    } catch { toast.error("Error al abrir la caja"); }
    finally { setSubmitting(false); }
  }

  async function cerrar() {
    if (!sesionActiva) return;
    if (!efectivoDeclarado && efectivoDeclarado !== "0") return toast.error("Ingresa el efectivo contado");
    setSubmitting(true);
    try {
      await api.post(`/ventas/sesiones/${sesionActiva.id}/cerrar/`, {
        efectivo_final_declarado: efectivoDeclarado,
        nota_cierre: notaCierre,
      });
      toast.success("Caja cerrada");
      setModal(null); setEfectivoDeclarado(""); setNotaCierre(""); cargar();
    } catch { toast.error("Error al cerrar la caja"); }
    finally { setSubmitting(false); }
  }

  const esperadoEnCaja = sesionActiva && resumen
    ? Number(sesionActiva.efectivo_inicial) + resumen.efectivo
    : null;

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
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <LockKeyholeOpen size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Caja abierta</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {sesionActiva.cajero_nombre} · Desde {fmtFecha(sesionActiva.apertura)}
              </p>
            </div>
          </div>

          {/* KPIs del turno */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Efectivo inicial", value: formatCurrency(Number(sesionActiva.efectivo_inicial)), icon: Banknote, iconBg: "bg-muted", iconColor: "text-muted-foreground" },
              { label: "Ventas del turno", value: formatCurrency(resumen?.total ?? 0), icon: TrendingUp, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
              { label: "Esperado en caja", value: formatCurrency(esperadoEnCaja ?? 0), icon: DollarSign, iconBg: "bg-brand-50 dark:bg-brand-950/30", iconColor: "text-brand-600 dark:text-brand-400" },
              { label: "Cantidad de ventas", value: String(resumen?.cantidad ?? 0), icon: ShoppingCart, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400" },
            ].map((card) => (
              <div key={card.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.iconBg)}>
                    <card.icon size={16} className={card.iconColor} />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Desglose métodos de pago */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Ventas por método de pago</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Efectivo", value: resumen?.efectivo ?? 0, icon: Banknote, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Tarjeta", value: resumen?.tarjeta ?? 0, icon: CreditCard, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400", color: "text-blue-600 dark:text-blue-400" },
                { label: "Transferencia", value: resumen?.transferencia ?? 0, icon: ArrowLeftRight, iconBg: "bg-violet-100 dark:bg-violet-900/40", iconColor: "text-violet-600 dark:text-violet-400", color: "text-violet-600 dark:text-violet-400" },
                { label: "Fiado", value: resumen?.fiado ?? 0, icon: Clock, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400", color: "text-amber-600 dark:text-amber-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", row.iconBg)}>
                      <row.icon size={15} className={row.iconColor} />
                    </div>
                    <span className="text-sm text-foreground">{row.label}</span>
                  </div>
                  <span className={cn("font-bold tabular-nums text-sm", row.color)}>{formatCurrency(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3.5 bg-muted/50">
                <span className="text-sm font-semibold text-foreground">Total cobrado</span>
                <span className="font-bold text-lg text-foreground tabular-nums">{formatCurrency(resumen?.total ?? 0)}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-muted/50 border border-border rounded-xl p-12 text-center">
          <LockKeyhole size={44} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">La caja está cerrada</p>
          <p className="text-sm text-muted-foreground mt-1">Abre la caja para comenzar a registrar ventas</p>
          <Button className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setModal("apertura")}>
            <LockKeyholeOpen size={15} /> Abrir caja
          </Button>
        </div>
      )}

      {/* Historial de cierres */}
      {historial.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <History size={15} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Historial de cierres</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Apertura", "Cierre", "Cajero", "Ef. Inicial", "Calculado", "Declarado", "Diferencia"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
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
                      <td className={cn(
                        "px-4 py-3 tabular-nums text-sm font-bold",
                        diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      )}>
                        {s.diferencia_caja != null ? `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}` : "—"}
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
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <LockKeyholeOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              Apertura de caja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Efectivo en caja al abrir (RD$)</Label>
              <Input
                type="number" min="0" step="0.01" autoFocus
                value={efectivoInicial}
                onChange={(e) => setEfectivoInicial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && abrir()}
                className="text-center text-2xl font-bold h-14 tabular-nums"
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground text-center">Monto de cambio disponible al inicio</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000, 3000, 5000, 10000].map((v) => (
                <Button
                  key={v} variant={Number(efectivoInicial) === v ? "default" : "outline"}
                  size="sm" className="text-xs" onClick={() => setEfectivoInicial(String(v))}
                >
                  RD${v.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setModal(null); setEfectivoInicial(""); }}>Cancelar</Button>
            <Button onClick={abrir} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <LockKeyholeOpen size={14} />}
              Abrir caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal cierre */}
      <Dialog open={modal === "cierre"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <LockKeyhole size={14} className="text-rose-600 dark:text-rose-400" />
              </div>
              Cierre de caja
            </DialogTitle>
          </DialogHeader>
          {sesionActiva && (
            <div className="space-y-4 py-2">
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
                  value={efectivoDeclarado}
                  onChange={(e) => setEfectivoDeclarado(e.target.value)}
                  className="text-center text-2xl font-bold h-14 tabular-nums"
                  placeholder="0.00"
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
                  value={notaCierre}
                  onChange={(e) => setNotaCierre(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={cerrar} disabled={submitting} className="gap-2">
              {submitting ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <LockKeyhole size={14} />}
              Cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
