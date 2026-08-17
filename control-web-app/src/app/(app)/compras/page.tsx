"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import React from "react";
import {
  ClipboardList, Plus, X, Check, Search,
  Truck, Package, AlertTriangle, ChevronDown, ChevronUp, Ban, CalendarDays,
} from "lucide-react";
import type { OrdenCompra, Suplidor, Producto } from "@/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/shared/FormField";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

const ESTADO_CONFIG = {
  PENDIENTE: { label: "Pendiente", variant: "warning" as const },
  RECIBIDA:  { label: "Recibida",  variant: "success" as const },
  CANCELADA: { label: "Cancelada", variant: "danger"  as const },
};

const lineaSchema = z.object({
  producto_id: z.string().optional(),
  producto_nombre: z.string().optional(),
  cantidad: z.string(),
  precio_costo: z.string().optional(),
});

const compraSchema = z.object({
  suplidor_id: z.string().min(1, "Selecciona un proveedor."),
  numero_factura: z.string().optional(),
  notas: z.string().optional(),
  lineas: z.array(lineaSchema),
}).refine(
  (d) => d.lineas.some((l) => l.producto_id && Number(l.cantidad) > 0),
  { message: "Agrega al menos un producto válido.", path: ["lineas"] }
);

type CompraForm = z.infer<typeof compraSchema>;

const LINEA_EMPTY = { producto_id: "", producto_nombre: "", cantidad: "1", precio_costo: "" };

export default function ComprasPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [confirmCancelarId, setConfirmCancelarId] = useState<number | null>(null);

  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [busqProd, setBusqProd] = useState<Record<number, string>>({});
  const [resultsProd, setResultsProd] = useState<Record<number, Producto[]>>({});

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isSubmitting: guardando },
  } = useForm<CompraForm>({
    resolver: zodResolver(compraSchema),
    defaultValues: { suplidor_id: "", numero_factura: "", notas: "", lineas: [LINEA_EMPTY] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineas" });
  const watchedLineas = watch("lineas");
  const totalOrden = (watchedLineas ?? []).reduce(
    (s, l) => s + Number(l.cantidad || 0) * Number(l.precio_costo || 0), 0
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const { data } = await api.get(`/compras/ordenes/?${params}`);
      setOrdenes(data.results ?? data);
    } catch {
      toast.error("Error cargando compras");
    }
    setLoading(false);
  }, [filtroEstado, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (modal) {
      reset({ suplidor_id: "", numero_factura: "", notas: "", lineas: [LINEA_EMPTY] });
      setBusqProd({});
      setResultsProd({});
      api.get("/compras/suplidores/")
        .then(({ data }) => setSuplidores(data.results ?? data))
        .catch(() => {});
    }
  }, [modal, reset]);

  async function buscarProducto(idx: number, q: string) {
    setBusqProd((p) => ({ ...p, [idx]: q }));
    if (!q.trim()) { setResultsProd((p) => ({ ...p, [idx]: [] })); return; }
    try {
      const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`);
      setResultsProd((p) => ({ ...p, [idx]: (data.results ?? data).slice(0, 6) }));
    } catch { /* silencioso */ }
  }

  function seleccionarProducto(idx: number, prod: Producto) {
    setValue(`lineas.${idx}.producto_id`, String(prod.id), { shouldDirty: true });
    setValue(`lineas.${idx}.producto_nombre`, prod.nombre, { shouldDirty: true });
    setValue(`lineas.${idx}.precio_costo`, prod.precio_costo, { shouldDirty: true });
    setBusqProd((p) => ({ ...p, [idx]: "" }));
    setResultsProd((p) => ({ ...p, [idx]: [] }));
  }

  const crearOrden = handleSubmit(async (data) => {
    try {
      const lineasValidas = data.lineas.filter((l) => l.producto_id && Number(l.cantidad) > 0);
      await api.post("/compras/ordenes/", {
        suplidor: data.suplidor_id,
        numero_factura: data.numero_factura,
        notas: data.notas,
        items: lineasValidas.map((l) => ({
          producto: l.producto_id,
          cantidad: l.cantidad,
          precio_costo: l.precio_costo,
        })),
      });
      toast.success("Orden de compra creada");
      setModal(false);
      cargar();
    } catch {
      toast.error("Error al crear la orden");
    }
  });

  async function cancelarOrden(id: number) {
    try {
      await api.patch(`/compras/ordenes/${id}/`, { estado: "CANCELADA" });
      toast.success("Orden cancelada");
      cargar();
    } catch {
      toast.error("Error al cancelar la orden");
    }
  }

  const pendientes = ordenes.filter((o) => o.estado === "PENDIENTE").length;
  const totalOrdenes = ordenes.reduce((s, o) => s + Number(o.total), 0);

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Órdenes de compra"
        description={`${ordenes.length} órdenes${pendientes > 0 ? ` · ${pendientes} pendientes` : ""} · Total: ${formatCurrency(totalOrdenes)}`}
        actions={
          <Button onClick={() => setModal(true)} className="gap-2">
            <Plus size={15} /> Nueva orden
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["", "PENDIENTE", "RECIBIDA", "CANCELADA"] as const).map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              filtroEstado === e
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-brand-300"
            )}
          >
            {e === "" ? "Todas" : ESTADO_CONFIG[e].label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <CalendarDays size={13} className="text-muted-foreground shrink-0" />
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-8 text-sm w-36" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-8 text-sm w-36" />
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-card transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : ordenes.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin órdenes de compra"
            description="Crea la primera orden con el botón de arriba."
            action={{ label: "Nueva orden", onClick: () => setModal(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
              <tr className="border-b border-border bg-muted/50">
                {["Proveedor", "N° Factura", "Fecha", "Total", "Balance", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordenes.map((o) => {
                const estado = ESTADO_CONFIG[o.estado as keyof typeof ESTADO_CONFIG] ?? { label: o.estado, variant: "secondary" as const };
                const isExp = expandedId === o.id;
                return (
                  <React.Fragment key={o.id}>
                    <tr
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExp ? null : o.id)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Truck size={13} className="text-muted-foreground" />
                          </div>
                          <span className="font-medium text-foreground">{o.suplidor_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                        {o.numero_factura || `#${o.id}`}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatDate(o.fecha)}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-foreground tabular-nums">
                        {formatCurrency(Number(o.total))}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {Number(o.balance_pendiente) > 0 ? (
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-xs">
                            <AlertTriangle size={11} /> {formatCurrency(Number(o.balance_pendiente))}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <Check size={11} /> Pagado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {o.estado === "PENDIENTE" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                                onClick={(e) => { e.stopPropagation(); router.push(`/recepcion?orden=${o.id}`); }}
                              >
                                Recibir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={(e) => { e.stopPropagation(); setConfirmCancelarId(o.id); }}
                              >
                                <Ban size={11} /> Cancelar
                              </Button>
                            </>
                          )}
                          {isExp
                            ? <ChevronUp size={14} className="text-muted-foreground" />
                            : <ChevronDown size={14} className="text-muted-foreground" />
                          }
                        </div>
                      </td>
                    </tr>
                    {isExp && o.items && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {o.items.map((item) => (
                              <div key={item.id} className="bg-card rounded-lg border border-border px-3 py-2 flex items-center gap-2 text-xs">
                                <Package size={12} className="text-muted-foreground shrink-0" />
                                <span className="font-medium text-foreground truncate flex-1">{item.producto_nombre}</span>
                                <span className="text-muted-foreground shrink-0 tabular-nums">
                                  {item.cantidad} × {formatCurrency(Number(item.precio_costo))}
                                </span>
                              </div>
                            ))}
                          </div>
                          {o.notas && (
                            <p className="text-xs text-muted-foreground mt-2 italic">{o.notas}</p>
                          )}
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

      {/* Confirm cancelar orden */}
      <Dialog open={!!confirmCancelarId} onOpenChange={(o) => { if (!o) setConfirmCancelarId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban size={16} /> Cancelar orden
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro que deseas cancelar esta orden de compra? Esta acción es irreversible.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmCancelarId(null)}>Volver</Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => { if (confirmCancelarId) { cancelarOrden(confirmCancelarId); setConfirmCancelarId(null); } }}
            >
              Sí, cancelar orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal nueva orden */}
      <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center">
                <ClipboardList size={14} className="text-brand-600 dark:text-brand-400" />
              </div>
              Nueva Orden de Compra
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={crearOrden} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Proveedor + Factura */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Proveedor <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <select
                    {...register("suplidor_id")}
                    aria-required
                    aria-invalid={!!errors.suplidor_id}
                    className={cn(
                      "w-full h-9 px-3 text-sm rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                      errors.suplidor_id ? "border-destructive" : "border-input"
                    )}
                  >
                    <option value="">Seleccionar...</option>
                    {suplidores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  {errors.suplidor_id && (
                    <p role="alert" className="text-xs text-destructive">{errors.suplidor_id.message}</p>
                  )}
                </div>
                <FormField
                  label="N° Factura"
                  placeholder="Ej: B15001234"
                  {...register("numero_factura")}
                />
              </div>

              <Separator />

              {/* Líneas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Productos <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  {errors.lineas?.root && (
                    <p role="alert" className="text-xs text-destructive">{errors.lineas.root.message}</p>
                  )}
                </div>
                {fields.map((field, idx) => {
                  const lineaNombre = watchedLineas?.[idx]?.producto_nombre ?? "";
                  const lineaCantidad = watchedLineas?.[idx]?.cantidad ?? "1";
                  const lineaCosto = watchedLineas?.[idx]?.precio_costo ?? "";
                  return (
                    <div key={field.id} className="flex gap-2 items-start">
                      {/* Búsqueda producto */}
                      <div className="flex-1 relative">
                        {lineaNombre ? (
                          <div className="flex items-center gap-2 border border-brand-200 dark:border-brand-800 rounded-md px-3 py-2 bg-brand-50 dark:bg-brand-950/30 h-9">
                            <Package size={13} className="text-brand-500 dark:text-brand-400 shrink-0" />
                            <span className="text-sm text-brand-700 dark:text-brand-300 font-medium flex-1 truncate">{lineaNombre}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setValue(`lineas.${idx}.producto_id`, "", { shouldDirty: true });
                                setValue(`lineas.${idx}.producto_nombre`, "", { shouldDirty: true });
                              }}
                              className="text-brand-400 hover:text-brand-600"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={busqProd[idx] ?? ""}
                              onChange={(e) => buscarProducto(idx, e.target.value)}
                              placeholder="Buscar producto..."
                              className="pl-8"
                            />
                            {(resultsProd[idx] ?? []).length > 0 && (
                              <div className="absolute z-20 w-full mt-1 border border-border rounded-lg shadow-lg bg-popover overflow-hidden">
                                {(resultsProd[idx] ?? []).map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => seleccionarProducto(idx, p)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted text-left text-sm border-b border-border last:border-0"
                                  >
                                    <Package size={12} className="text-muted-foreground" />
                                    <span className="flex-1 text-foreground">{p.nombre}</span>
                                    <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(Number(p.precio_costo))}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {/* Cantidad */}
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Cant."
                        className="w-20 text-center"
                        {...register(`lineas.${idx}.cantidad`)}
                      />
                      {/* Costo */}
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RD$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Costo"
                          className="pl-9"
                          {...register(`lineas.${idx}.precio_costo`)}
                        />
                      </div>
                      {/* Subtotal */}
                      <span className="text-sm font-semibold text-foreground min-w-20 pt-2 text-right tabular-nums shrink-0">
                        {formatCurrency(Number(lineaCantidad || 0) * Number(lineaCosto || 0))}
                      </span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-500"
                          onClick={() => remove(idx)}
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700"
                  onClick={() => append(LINEA_EMPTY)}
                >
                  <Plus size={14} /> Agregar producto
                </Button>
              </div>

              {/* Notas */}
              <FormField
                label="Notas"
                hint="Opcional"
                placeholder="Observaciones..."
                {...register("notas")}
              />

              {/* Total */}
              <div className={cn(
                "rounded-xl px-4 py-3 flex items-center justify-between border",
                totalOrden > 0
                  ? "bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800"
                  : "bg-muted border-border"
              )}>
                <span className="text-sm font-medium text-muted-foreground">Total orden</span>
                <span className={cn("text-xl font-bold tabular-nums", totalOrden > 0 ? "text-brand-700 dark:text-brand-300" : "text-muted-foreground")}>
                  {formatCurrency(totalOrden)}
                </span>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border shrink-0 gap-2">
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando} className="gap-2">
                {guardando ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <Check size={14} />}
                Crear orden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
