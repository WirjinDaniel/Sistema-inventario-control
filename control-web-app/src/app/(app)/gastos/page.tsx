"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import type { CategoriaGasto, Gasto } from "@/types";
import toast from "react-hot-toast";
import {
  Receipt, Plus, DollarSign, TrendingDown, AlertTriangle,
  Search, ChevronDown, ChevronUp, Banknote, CreditCard,
  ArrowLeftRight, BookCheck, X, Check,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/FormField";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

const gastoSchema = z.object({
  categoria: z.string().min(1, "Selecciona una categoría."),
  descripcion: z.string().min(1, "La descripción es requerida."),
  monto: z.string().min(1, "El monto es requerido.").refine((v) => Number(v) > 0, { message: "Debe ser mayor a 0." }),
  metodo_pago: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE"]),
  comprobante: z.string().optional(),
  nota: z.string().optional(),
});

type GastoForm = z.infer<typeof gastoSchema>;

const METODOS_PAGO = [
  { value: "EFECTIVO",      label: "Efectivo",      icon: Banknote },
  { value: "TARJETA",       label: "Tarjeta",       icon: CreditCard },
  { value: "TRANSFERENCIA", label: "Transferencia", icon: ArrowLeftRight },
  { value: "CHEQUE",        label: "Cheque",        icon: BookCheck },
];

const TIPOS_LABEL: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "secondary" }> = {
  FIJO:          { label: "Fijo",           variant: "info" },
  VARIABLE:      { label: "Variable",       variant: "warning" },
  FINANCIERO:    { label: "Financiero",     variant: "purple" },
  PERDIDA:       { label: "Pérdida",        variant: "danger" },
  ADMINISTRATIVO:{ label: "Administrativo", variant: "secondary" },
  RETIRO:        { label: "Retiro",         variant: "default" },
};

const PERIODOS = [
  { value: "hoy",    label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes",    label: "Mes" },
];

interface Resumen {
  total: number; FIJO: number; VARIABLE: number;
  FINANCIERO: number; PERDIDA: number; ADMINISTRATIVO: number; RETIRO: number;
}

export default function GastosPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting: submitting },
  } = useForm<GastoForm>({
    resolver: zodResolver(gastoSchema),
    defaultValues: { categoria: "", descripcion: "", monto: "", metodo_pago: "EFECTIVO", comprobante: "", nota: "" },
  });

  const metodoPago = watch("metodo_pago");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ periodo });
      if (filtroTipo) params.set("tipo", filtroTipo);
      const [gastosRes, resumenRes] = await Promise.all([
        api.get(`/gastos/?${params}`),
        api.get(`/gastos/resumen/?${params}`),
      ]);
      setGastos(gastosRes.data.results ?? gastosRes.data);
      setResumen(resumenRes.data);
    } catch { toast.error("Error al cargar gastos"); }
    finally { setLoading(false); }
  }, [periodo, filtroTipo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get("/gastos/categorias/").then((r) => {
      const data: CategoriaGasto[] = r.data.results ?? r.data;
      if (data.length === 0) {
        api.post("/gastos/categorias/seed/").then(() =>
          api.get("/gastos/categorias/").then((r2) => setCategorias(r2.data.results ?? r2.data))
        );
      } else { setCategorias(data); }
    });
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await api.post("/gastos/", {
        categoria: Number(data.categoria), descripcion: data.descripcion,
        monto: data.monto, metodo_pago: data.metodo_pago,
        comprobante: data.comprobante, nota: data.nota,
      });
      toast.success("Gasto registrado");
      setShowModal(false);
      reset();
      fetchData();
    } catch { toast.error("Error al registrar gasto"); }
  });

  const gastosFiltrados = gastos.filter((g) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return g.descripcion.toLowerCase().includes(q) || g.categoria_nombre.toLowerCase().includes(q);
  });

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Gastos"
        description="Control de egresos del negocio"
        actions={
          <Button onClick={() => setShowModal(true)} className="gap-2">
            <Plus size={15} /> Registrar gasto
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total gastos", value: resumen?.total ?? 0, icon: DollarSign, iconBg: "bg-brand-50 dark:bg-brand-950/30", iconColor: "text-brand-600 dark:text-brand-400" },
          { label: "Gastos fijos", value: resumen?.FIJO ?? 0, icon: Receipt, iconBg: "bg-blue-50 dark:bg-blue-950/30", iconColor: "text-blue-600 dark:text-blue-400" },
          { label: "Variables", value: resumen?.VARIABLE ?? 0, icon: TrendingDown, iconBg: "bg-amber-50 dark:bg-amber-950/30", iconColor: "text-amber-600 dark:text-amber-400" },
          { label: "Pérdidas", value: resumen?.PERDIDA ?? 0, icon: AlertTriangle, iconBg: "bg-rose-50 dark:bg-rose-950/30", iconColor: "text-rose-600 dark:text-rose-400" },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.iconBg)}>
                <card.icon size={16} className={card.iconColor} />
              </div>
            </div>
            {loading
              ? <Skeleton className="h-7 w-28" />
              : <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(card.value)}</p>
            }
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar descripción o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {/* Período toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                periodo === p.value
                  ? "bg-background shadow text-brand-600 dark:text-brand-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {(busqueda || filtroTipo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground"
            onClick={() => { setBusqueda(""); setFiltroTipo(""); }}>
            <X size={12} /> Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Sin gastos registrados"
            description="Registra el primer gasto con el botón de arriba."
            action={{ label: "Registrar gasto", onClick: () => setShowModal(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
              <tr className="border-b border-border bg-muted/50">
                {["Fecha", "Categoría", "Descripción", "Método", "Comprobante", "Monto", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gastosFiltrados.map((g) => {
                const tipo = TIPOS_LABEL[g.categoria_tipo] ?? { label: g.categoria_tipo, variant: "secondary" as const };
                const isExp = expandedId === g.id;
                return (
                  <React.Fragment key={g.id}>
                    <tr
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExp ? null : g.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(g.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{g.categoria_nombre}</p>
                        <Badge variant={tipo.variant} className="mt-0.5 text-[10px] h-4">{tipo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{g.descripcion}</td>
                      <td className="px-4 py-3">
                        {(() => { const m = METODOS_PAGO.find((m) => m.value === g.metodo_pago); return m ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <m.icon size={13} /> {m.label}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">{g.metodo_pago}</span>; })()}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {g.comprobante || "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground tabular-nums text-sm">
                        {formatCurrency(Number(g.monto))}
                      </td>
                      <td className="px-4 py-3">
                        {isExp ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${g.id}-det`} className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {g.comprobante && (
                              <span>Comprobante: <span className="font-mono text-foreground">{g.comprobante}</span></span>
                            )}
                            {g.nota && <span className="italic">"{g.nota}"</span>}
                            {!g.comprobante && !g.nota && (
                              <span className="italic">Sin información adicional</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal registrar gasto */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <Receipt size={14} className="text-rose-600 dark:text-rose-400" />
              </div>
              Registrar Gasto
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Categoría <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <select
                {...register("categoria")}
                aria-required
                aria-invalid={!!errors.categoria}
                className={cn(
                  "w-full h-9 px-3 text-sm rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                  errors.categoria ? "border-destructive" : "border-input"
                )}
              >
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({TIPOS_LABEL[c.tipo]?.label ?? c.tipo})
                  </option>
                ))}
              </select>
              {errors.categoria && <p role="alert" className="text-xs text-destructive">{errors.categoria.message}</p>}
            </div>

            <FormField
              label="Descripción"
              required
              placeholder="Ej: Pago alquiler local"
              error={errors.descripcion?.message}
              {...register("descripcion")}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Monto (RD$) <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                type="number" min="0" step="0.01"
                placeholder="0.00"
                aria-invalid={!!errors.monto}
                className={cn("text-center text-2xl font-bold h-14 tabular-nums", errors.monto ? "border-destructive" : "")}
                {...register("monto")}
              />
              {errors.monto && <p role="alert" className="text-xs text-destructive">{errors.monto.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Método de pago</Label>
              <div className="grid grid-cols-2 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue("metodo_pago", m.value as GastoForm["metodo_pago"], { shouldDirty: true })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all",
                      metodoPago === m.value
                        ? "border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                    )}
                  >
                    <m.icon size={15} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <FormField
              label="No. Comprobante"
              hint="Opcional"
              placeholder="No. factura o recibo"
              {...register("comprobante")}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <textarea
                rows={2}
                {...register("nota")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Observaciones adicionales..."
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => { setShowModal(false); reset(); }}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  : <Check size={14} />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
