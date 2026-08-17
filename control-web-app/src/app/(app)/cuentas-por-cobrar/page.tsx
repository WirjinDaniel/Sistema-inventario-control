"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Wallet, AlertTriangle, Clock, Check } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const BUCKET_CONFIG: Record<string, { badge: "success" | "warning" | "danger"; dotColor: string }> = {
  "0_30":   { badge: "success", dotColor: "bg-emerald-500" },
  "31_60":  { badge: "warning", dotColor: "bg-amber-500" },
  "61_90":  { badge: "warning", dotColor: "bg-orange-500" },
  "90_mas": { badge: "danger",  dotColor: "bg-rose-500" },
};

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

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get("/clientes/aging/");
      setAging(data);
    } catch { toast.error("Error cargando cuentas por cobrar"); }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

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

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Cuentas por Cobrar"
        description="Antigüedad de saldos de clientes con fiado"
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total pendiente", value: formatCurrency(aging?.total ?? 0), sub: `${totalClientes} clientes con deuda`, color: "text-foreground" },
          { label: "Al día (0–30 días)", value: formatCurrency(buckets["0_30"]?.total ?? 0), sub: `${buckets["0_30"]?.clientes.length ?? 0} clientes`, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Vencido (+30 días)", value: formatCurrency(totalVencido), sub: "Requiere gestión inmediata", color: "text-rose-600 dark:text-rose-400", danger: true },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(
            "bg-card border rounded-xl p-4",
            kpi.danger ? "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/10" : "border-border"
          )}>
            <p className={cn("text-xs font-medium uppercase tracking-wide flex items-center gap-1", kpi.danger ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground")}>
              {kpi.danger && <AlertTriangle size={11} />} {kpi.label}
            </p>
            <p className={cn("text-2xl font-bold mt-1 tabular-nums", kpi.color)}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Buckets */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
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
              <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                    <span className="text-sm font-semibold text-foreground">{bucket.label}</span>
                    <Badge variant={cfg.badge} className="text-[10px] h-4">{bucket.clientes.length} clientes</Badge>
                  </div>
                  <span className="font-bold text-foreground tabular-nums text-sm">{formatCurrency(bucket.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Cliente", "Teléfono", "Último movimiento", "Días", "Saldo", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bucket.clientes.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{c.nombre}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.telefono || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock size={11} /> {c.ultima_fecha}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.badge} className="text-[10px]">{c.dias}d</Badge>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground tabular-nums">{formatCurrency(c.saldo_deuda)}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { setAbonoModal(c); resetAbono({ monto: "", nota: "" }); }}
                          >
                            Abonar
                          </Button>
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
            <DialogTitle>Registrar abono</DialogTitle>
          </DialogHeader>
          {abonoModal && (
            <form onSubmit={registrarAbono} className="space-y-4 py-2">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300">{abonoModal.nombre}</p>
                <p className="text-amber-600 dark:text-amber-400 mt-0.5">Saldo: <span className="font-bold tabular-nums">{formatCurrency(abonoModal.saldo_deuda)}</span></p>
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
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
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
