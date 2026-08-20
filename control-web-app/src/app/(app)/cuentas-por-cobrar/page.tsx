"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Wallet, AlertTriangle, Clock, Check, TrendingUp } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

const abonoSchema = z.object({
  monto: z.string().min(1, "Requerido").refine((v) => Number(v) > 0, "Monto inválido"),
  nota: z.string().optional(),
});
type AbonoForm = z.infer<typeof abonoSchema>;

interface AgingCliente {
  id: number; nombre: string; telefono: string;
  saldo_deuda: number; dias: number; ultima_fecha: string;
}
interface AgingBucket { label: string; clientes: AgingCliente[]; total: number; }
interface AgingData { buckets: Record<string, AgingBucket>; total: number; }

const BUCKET_CONFIG: Record<string, {
  accentBg: string; accentBorder: string; color: string;
  headerBg: string; dotColor: string; via: string;
}> = {
  "0_30":   { accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", color: "text-emerald-700", headerBg: "bg-emerald-50/60", dotColor: "bg-emerald-500", via: "via-emerald-400/60" },
  "31_60":  { accentBg: "bg-amber-50",   accentBorder: "border-amber-200",   color: "text-amber-700",   headerBg: "bg-amber-50/60",   dotColor: "bg-amber-500",   via: "via-amber-400/60" },
  "61_90":  { accentBg: "bg-orange-50",  accentBorder: "border-orange-200",  color: "text-orange-700",  headerBg: "bg-orange-50/60",  dotColor: "bg-orange-500",  via: "via-orange-400/60" },
  "90_mas": { accentBg: "bg-rose-50",    accentBorder: "border-rose-200",    color: "text-rose-700",    headerBg: "bg-rose-50/60",    dotColor: "bg-rose-500",    via: "via-rose-400/60" },
};

const KPI_GRADIENTS = [
  { gradient: "from-brand-500 to-indigo-600",   via: "via-brand-400/60",   Icon: Wallet },
  { gradient: "from-emerald-500 to-teal-600",   via: "via-emerald-400/60", Icon: TrendingUp },
  { gradient: "from-rose-500 to-red-600",       via: "via-rose-400/60",    Icon: AlertTriangle },
];

export default function CuentasPorCobrarPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [aging, setAging] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [abonoModal, setAbonoModal] = useState<AgingCliente | null>(null);
  const {
    register: regAbono, handleSubmit: handleAbono, watch: watchAbono,
    reset: resetAbono, formState: { isSubmitting: guardando },
  } = useForm<AbonoForm>({ resolver: zodResolver(abonoSchema), defaultValues: { monto: "", nota: "" } });
  const montoAbono = watchAbono("monto") ?? "";

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clientes/aging/");
      setAging(data);
    } catch { toast.error("Error cargando cuentas por cobrar"); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const registrarAbono = handleAbono(async (data) => {
    if (!abonoModal) return;
    try {
      await api.post("/clientes/abonos/", { cliente: abonoModal.id, monto: data.monto, nota: data.nota });
      toast.success(`Abono de ${formatCurrency(Number(data.monto))} registrado`);
      setAbonoModal(null); resetAbono({ monto: "", nota: "" });
      cargar();
    } catch { toast.error("Error al registrar el abono"); }
  });

  const buckets = aging?.buckets ?? {};
  const totalClientes = Object.values(buckets).reduce((s, b) => s + b.clientes.length, 0);
  const totalVencido = (buckets["31_60"]?.total ?? 0) + (buckets["61_90"]?.total ?? 0) + (buckets["90_mas"]?.total ?? 0);

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  const kpis = [
    { label: "Total pendiente",    value: formatCurrency(aging?.total ?? 0),     sub: `${totalClientes} clientes con deuda` },
    { label: "Al día (0–30 días)", value: formatCurrency(buckets["0_30"]?.total ?? 0), sub: `${buckets["0_30"]?.clientes.length ?? 0} clientes` },
    { label: "Vencido (+30 días)", value: formatCurrency(totalVencido),           sub: "Requiere gestión inmediata" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
          <Wallet size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Cuentas por Cobrar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Antigüedad de saldos de clientes con fiado</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi, idx) => {
          const { gradient, via, Icon } = KPI_GRADIENTS[idx];
          return (
            <div key={kpi.label} className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${via} to-transparent`} />
              <div className="flex items-start gap-3">
                <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                  <Icon size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-xl font-black text-foreground tabular-nums mt-0.5">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buckets */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-muted/60 rounded-2xl animate-pulse" />)}
        </div>
      ) : totalClientes === 0 ? (
        <EmptyState icon={Wallet} title="Sin clientes con deuda" description="¡Excelente cartera de cobros!" />
      ) : (
        <div className="space-y-3">
          {(["0_30", "31_60", "61_90", "90_mas"] as const).map((key) => {
            const bucket = buckets[key];
            if (!bucket || bucket.clientes.length === 0) return null;
            const cfg = BUCKET_CONFIG[key];
            return (
              <div key={key} className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${cfg.via} to-transparent`} />
                <div className={`px-5 py-3 border-b border-border flex items-center justify-between ${cfg.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                    <span className="text-sm font-bold text-foreground">{bucket.label}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${cfg.accentBg} ${cfg.accentBorder} ${cfg.color}`}>
                      {bucket.clientes.length} clientes
                    </span>
                  </div>
                  <span className="font-black text-foreground tabular-nums text-sm">{formatCurrency(bucket.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {["Cliente", "Teléfono", "Último movimiento", "Días", "Saldo", ""].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bucket.clientes.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-foreground">{c.nombre}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{c.telefono || "—"}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(c.ultima_fecha)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${cfg.accentBg} ${cfg.accentBorder} ${cfg.color}`}>
                            {c.dias}d
                          </span>
                        </td>
                        <td className="px-5 py-3 font-black text-foreground tabular-nums">{formatCurrency(c.saldo_deuda)}</td>
                        <td className="px-5 py-3">
                          <button
                            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                            onClick={() => { setAbonoModal(c); resetAbono({ monto: "", nota: "" }); }}
                          >
                            Abonar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal abono */}
      <Dialog open={!!abonoModal} onOpenChange={(o) => !o && setAbonoModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-lg bg-linear-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Wallet size={13} className="text-white" />
              </div>
              Registrar abono
            </DialogTitle>
          </DialogHeader>
          {abonoModal && (
            <form onSubmit={registrarAbono} className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-amber-800">{abonoModal.nombre}</p>
                <p className="text-amber-600 mt-0.5">Saldo: <span className="font-black tabular-nums">{formatCurrency(abonoModal.saldo_deuda)}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="monto-abono">Monto (RD$)</Label>
                <Input
                  id="monto-abono" type="number" step="0.01" autoFocus
                  className="text-center text-xl font-bold h-12 tabular-nums"
                  placeholder="0.00"
                  aria-required="true"
                  {...regAbono("monto")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="nota-abono">Nota (opcional)</Label>
                <Input id="nota-abono" placeholder="Ej: Pago parcial" {...regAbono("nota")} />
              </div>
              {montoAbono && Number(montoAbono) >= abonoModal.saldo_deuda && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                  <Check size={13} /> Este abono cancela la deuda completa
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setAbonoModal(null)}>Cancelar</Button>
                <Button type="submit" disabled={guardando} className="gap-2">
                  {guardando
                    ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    : <Check size={14} />}
                  Confirmar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
