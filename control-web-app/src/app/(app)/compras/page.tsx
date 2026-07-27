"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  ClipboardList, Plus, X, Check, Search,
  Truck, Package, AlertTriangle, ChevronDown, ChevronUp,
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

const ESTADO_CONFIG = {
  PENDIENTE: { label: "Pendiente", variant: "warning" as const },
  RECIBIDA:  { label: "Recibida",  variant: "success" as const },
  CANCELADA: { label: "Cancelada", variant: "danger"  as const },
};

interface LineaOrden {
  producto_id: string;
  producto_nombre: string;
  cantidad: string;
  precio_costo: string;
}

export default function ComprasPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [suplidorId, setSuplidorId] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<LineaOrden[]>([
    { producto_id: "", producto_nombre: "", cantidad: "1", precio_costo: "" },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [busqProd, setBusqProd] = useState<Record<number, string>>({});
  const [resultsProd, setResultsProd] = useState<Record<number, Producto[]>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      const { data } = await api.get(`/compras/ordenes/?${params}`);
      setOrdenes(data.results ?? data);
    } catch {
      toast.error("Error cargando compras");
    }
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (modal) {
      api.get("/compras/suplidores/")
        .then(({ data }) => setSuplidores(data.results ?? data))
        .catch(() => {});
    }
  }, [modal]);

  async function buscarProducto(idx: number, q: string) {
    setBusqProd((p) => ({ ...p, [idx]: q }));
    if (!q.trim()) { setResultsProd((p) => ({ ...p, [idx]: [] })); return; }
    try {
      const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`);
      setResultsProd((p) => ({ ...p, [idx]: (data.results ?? data).slice(0, 6) }));
    } catch { /* silencioso */ }
  }

  function seleccionarProducto(idx: number, prod: Producto) {
    setLineas((ls) =>
      ls.map((l, i) => i === idx
        ? { ...l, producto_id: String(prod.id), producto_nombre: prod.nombre, precio_costo: prod.precio_costo }
        : l)
    );
    setBusqProd((p) => ({ ...p, [idx]: "" }));
    setResultsProd((p) => ({ ...p, [idx]: [] }));
  }

  const totalOrden = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio_costo || 0), 0);

  async function crearOrden() {
    if (!suplidorId) return toast.error("Selecciona un proveedor");
    const lineasValidas = lineas.filter((l) => l.producto_id && Number(l.cantidad) > 0);
    if (!lineasValidas.length) return toast.error("Agrega al menos un producto");
    setGuardando(true);
    try {
      await api.post("/compras/ordenes/", {
        suplidor: suplidorId,
        numero_factura: numeroFactura,
        notas,
        items: lineasValidas.map((l) => ({
          producto: l.producto_id,
          cantidad: l.cantidad,
          precio_costo: l.precio_costo,
        })),
      });
      toast.success("Orden de compra creada");
      setModal(false);
      setSuplidorId(""); setNumeroFactura(""); setNotas("");
      setLineas([{ producto_id: "", producto_nombre: "", cantidad: "1", precio_costo: "" }]);
      cargar();
    } catch {
      toast.error("Error al crear la orden");
    }
    setGuardando(false);
  }

  const pendientes = ordenes.filter((o) => o.estado === "PENDIENTE").length;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Órdenes de compra"
        description={`${ordenes.length} órdenes${pendientes > 0 ? ` · ${pendientes} pendientes` : ""}`}
        actions={
          <Button onClick={() => setModal(true)} className="gap-2">
            <Plus size={15} /> Nueva orden
          </Button>
        }
      />

      {/* Filtro estado */}
      <div className="flex gap-2 flex-wrap">
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
            <thead>
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
                  <>
                    <tr
                      key={o.id}
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                              onClick={(e) => { e.stopPropagation(); router.push(`/recepcion?orden=${o.id}`); }}
                            >
                              Recibir
                            </Button>
                          )}
                          {isExp
                            ? <ChevronUp size={14} className="text-muted-foreground" />
                            : <ChevronDown size={14} className="text-muted-foreground" />
                          }
                        </div>
                      </td>
                    </tr>
                    {isExp && o.items && (
                      <tr key={`${o.id}-items`} className="bg-muted/20">
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
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Proveedor + Factura */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Proveedor *</Label>
                <select
                  value={suplidorId}
                  onChange={(e) => setSuplidorId(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Seleccionar...</option>
                  {suplidores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">N° Factura</Label>
                <Input
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej: B15001234"
                />
              </div>
            </div>

            <Separator />

            {/* Líneas */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Productos *
              </Label>
              {lineas.map((linea, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  {/* Búsqueda producto */}
                  <div className="flex-1 relative">
                    {linea.producto_nombre ? (
                      <div className="flex items-center gap-2 border border-brand-200 dark:border-brand-800 rounded-md px-3 py-2 bg-brand-50 dark:bg-brand-950/30 h-9">
                        <Package size={13} className="text-brand-500 dark:text-brand-400 shrink-0" />
                        <span className="text-sm text-brand-700 dark:text-brand-300 font-medium flex-1 truncate">{linea.producto_nombre}</span>
                        <button
                          type="button"
                          onClick={() => setLineas((ls) => ls.map((l, i) => i === idx ? { ...l, producto_id: "", producto_nombre: "" } : l))}
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
                    value={linea.cantidad}
                    min="0.01"
                    step="0.01"
                    onChange={(e) => setLineas((ls) => ls.map((l, i) => i === idx ? { ...l, cantidad: e.target.value } : l))}
                    className="w-20 text-center"
                    placeholder="Cant."
                  />
                  {/* Costo */}
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RD$</span>
                    <Input
                      type="number"
                      value={linea.precio_costo}
                      step="0.01"
                      onChange={(e) => setLineas((ls) => ls.map((l, i) => i === idx ? { ...l, precio_costo: e.target.value } : l))}
                      className="pl-9"
                      placeholder="Costo"
                    />
                  </div>
                  {/* Subtotal */}
                  <span className="text-sm font-semibold text-foreground min-w-[80px] pt-2 text-right tabular-nums shrink-0">
                    {formatCurrency(Number(linea.cantidad || 0) * Number(linea.precio_costo || 0))}
                  </span>
                  {lineas.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-500"
                      onClick={() => setLineas((ls) => ls.filter((_, i) => i !== idx))}
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700"
                onClick={() => setLineas((ls) => [...ls, { producto_id: "", producto_nombre: "", cantidad: "1", precio_costo: "" }])}
              >
                <Plus size={14} /> Agregar producto
              </Button>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notas (opcional)</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones..."
              />
            </div>

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
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={crearOrden} disabled={guardando} className="gap-2">
              {guardando ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Check size={14} />}
              Crear orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
