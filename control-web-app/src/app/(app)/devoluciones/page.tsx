"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  RotateCcw, Search, Plus, Check, X, ChevronDown, ChevronUp,
  Package, AlertTriangle, RefreshCw, DollarSign,
  CalendarDays, User2, Receipt,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";

interface VentaItem {
  id: number; producto_nombre: string;
  cantidad: string; precio_unitario: string; subtotal: string;
}
interface Venta {
  id: number; fecha: string; total: string; estado: string;
  cajero_nombre: string; cliente_nombre: string | null; metodo_pago: string;
  items: VentaItem[];
}
interface Devolucion {
  id: number; fecha: string; venta: number; venta_ref: string;
  cliente_nombre: string; cajero_nombre: string;
  motivo: string; monto_devuelto: string; metodo_devolucion: string;
  estado: string; nota: string;
  items: { producto_nombre: string; cantidad: number; precio_unitario: string }[];
}

const MOTIVOS = ["Producto dañado", "Producto vencido", "Error en pedido", "Cliente insatisfecho", "Producto incorrecto", "Otro"];

const devolucionSchema = z.object({
  motivo: z.string().min(1),
  metodo_devolucion: z.enum(["EFECTIVO", "CREDITO_CUENTA", "CAMBIO_PRODUCTO"]),
  nota: z.string().optional(),
});
type DevolucionForm = z.infer<typeof devolucionSchema>;
const METODOS = ["EFECTIVO", "CREDITO_CUENTA", "CAMBIO_PRODUCTO"];
const METODO_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", CREDITO_CUENTA: "Crédito en cuenta", CAMBIO_PRODUCTO: "Cambio de producto",
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function DevolucionesPage() {
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal nueva devolución
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<"buscar" | "seleccionar" | "form">("buscar");
  const [busqVenta, setBusqVenta] = useState("");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [buscandoVentas, setBuscandoVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Record<number, number>>({});
  const [guardando, setGuardando] = useState(false);

  const { register: regDev, handleSubmit: handleDev, reset: resetDev, formState: { errors: errDev } } =
    useForm<DevolucionForm>({ resolver: zodResolver(devolucionSchema), defaultValues: { motivo: MOTIVOS[0], metodo_devolucion: "EFECTIVO", nota: "" } });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const { data } = await api.get(`/devoluciones/?${params}`);
      setDevoluciones(data.results ?? data);
    } catch {
      setDevoluciones([]);
    }
    setLoading(false);
  }, [busqueda, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  async function buscarVentas() {
    if (!busqVenta.trim()) return;
    setBuscandoVentas(true);
    try {
      const { data } = await api.get(`/ventas/?search=${busqVenta}&estado=COMPLETADA&page_size=10`);
      const lista: Venta[] = data.results ?? data;
      // Enrich with items
      const enriched = await Promise.all(
        lista.map(async (v) => {
          try {
            const { data: det } = await api.get(`/ventas/${v.id}/`);
            return { ...v, items: det.items ?? [] };
          } catch { return { ...v, items: [] }; }
        })
      );
      setVentas(enriched);
      setStep("seleccionar");
    } catch { toast.error("Error buscando ventas"); }
    setBuscandoVentas(false);
  }

  function seleccionarVenta(v: Venta) {
    setVentaSeleccionada(v);
    const sel: Record<number, number> = {};
    v.items.forEach((it) => { sel[it.id] = 0; });
    setItemsSeleccionados(sel);
    setStep("form");
  }

  function toggleCantidad(itemId: number, max: number, delta: number) {
    setItemsSeleccionados((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(max, (prev[itemId] ?? 0) + delta)),
    }));
  }

  const totalDevolver = ventaSeleccionada
    ? ventaSeleccionada.items.reduce((acc, it) => {
        const qty = itemsSeleccionados[it.id] ?? 0;
        return acc + qty * Number(it.precio_unitario);
      }, 0)
    : 0;

  const onGuardarDevolucion = handleDev(async (data) => {
    if (!ventaSeleccionada) return;
    const items = ventaSeleccionada.items
      .filter((it) => (itemsSeleccionados[it.id] ?? 0) > 0)
      .map((it) => ({ venta_item: it.id, cantidad: itemsSeleccionados[it.id], precio_unitario: it.precio_unitario }));
    if (items.length === 0) { toast.error("Selecciona al menos un producto a devolver"); return; }
    setGuardando(true);
    try {
      await api.post("/devoluciones/", {
        venta: ventaSeleccionada.id, motivo: data.motivo,
        metodo_devolucion: data.metodo_devolucion, nota: data.nota, items,
      });
      toast.success("Devolución registrada");
      setModalOpen(false);
      resetModal();
      cargar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Error al registrar devolución");
    }
    setGuardando(false);
  });

  function resetModal() {
    setStep("buscar"); setBusqVenta(""); setVentas([]);
    setVentaSeleccionada(null); setItemsSeleccionados({});
    resetDev({ motivo: MOTIVOS[0], metodo_devolucion: "EFECTIVO", nota: "" });
  }

  const estadoConfig = (e: string) =>
    e === "APROBADA"
      ? { accentBg: "bg-emerald-50 dark:bg-emerald-950/30", accentBorder: "border-emerald-200 dark:border-emerald-800/50", color: "text-emerald-700 dark:text-emerald-300" }
      : e === "PENDIENTE"
      ? { accentBg: "bg-amber-50 dark:bg-amber-950/30", accentBorder: "border-amber-200 dark:border-amber-800/50", color: "text-amber-700 dark:text-amber-300" }
      : { accentBg: "bg-rose-50 dark:bg-rose-950/30", accentBorder: "border-rose-200 dark:border-rose-800/50", color: "text-rose-700 dark:text-rose-300" };

  const STATS = [
    { label: "Total devoluciones", value: String(devoluciones.length), icon: RotateCcw, gradient: "from-brand-500 to-indigo-600", accentBg: "bg-brand-50 dark:bg-brand-950/30", accentBorder: "border-brand-200 dark:border-brand-800/50", valueColor: "text-brand-700 dark:text-brand-300" },
    { label: "Monto devuelto", value: formatCurrency(devoluciones.reduce((a, d) => a + Number(d.monto_devuelto), 0)), icon: DollarSign, gradient: "from-emerald-500 to-teal-600", accentBg: "bg-emerald-50 dark:bg-emerald-950/30", accentBorder: "border-emerald-200 dark:border-emerald-800/50", valueColor: "text-emerald-700 dark:text-emerald-300" },
    { label: "Pendientes", value: String(devoluciones.filter((d) => d.estado === "PENDIENTE").length), icon: AlertTriangle, gradient: "from-amber-500 to-orange-500", accentBg: "bg-amber-50 dark:bg-amber-950/30", accentBorder: "border-amber-200 dark:border-amber-800/50", valueColor: "text-amber-700 dark:text-amber-300" },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Devoluciones"
        description="Gestión de devoluciones de clientes"
        actions={
          <Button size="sm" className="gap-2" onClick={() => { resetModal(); setModalOpen(true); }}>
            <Plus size={15} /> Nueva devolución
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {STATS.map(({ label, value, icon: Icon, gradient, accentBg, accentBorder, valueColor }) => (
          <div key={label} className={cn("relative border rounded-xl p-4 overflow-hidden", accentBg, accentBorder)}>
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-current/40 to-transparent opacity-60" />
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl bg-linear-to-br flex items-center justify-center shrink-0 shadow-sm", gradient)}>
                <Icon size={17} className="text-white" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wide leading-none">{label}</p>
                <p className={cn("text-2xl font-black tabular-nums leading-tight mt-0.5", valueColor)}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por cliente o venta…" className="pl-8 h-8 text-sm"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-8 text-sm w-36" />
        <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-8 text-sm w-36" />
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={cargar}>
          <RefreshCw size={12} /> Actualizar
        </Button>
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : devoluciones.length === 0 ? (
          <EmptyState icon={RotateCcw} title="Sin devoluciones" description="No hay devoluciones registradas." />
        ) : (
          <div className="divide-y divide-border">
            {devoluciones.map((d) => {
              const eCfg = estadoConfig(d.estado);
              return (
              <div key={d.id}>
                <button
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0 shadow-sm">
                    <RotateCcw size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {d.cliente_nombre || "Cliente general"}
                      <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                        <Receipt size={10} className="inline mr-0.5 opacity-60" />Venta #{d.venta}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <CalendarDays size={10} className="opacity-60" />{fmtFecha(d.fecha)}
                      <span className="opacity-40">·</span>
                      <User2 size={10} className="opacity-60" />{d.cajero_nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "inline-flex items-center text-2xs font-bold px-2 py-0.5 rounded-full border",
                      eCfg.accentBg, eCfg.accentBorder, eCfg.color
                    )}>{d.estado}</span>
                    <span className="text-base font-black text-foreground tabular-nums">{formatCurrency(Number(d.monto_devuelto))}</span>
                    {expandedId === d.id
                      ? <ChevronUp size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                      : <ChevronDown size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />}
                  </div>
                </button>
                {expandedId === d.id && (
                  <div className="px-4 pb-4 bg-muted/10 border-t border-border">
                    <div className="mt-3 flex items-center gap-4 flex-wrap mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-lg border border-border">
                        <span className="text-muted-foreground">Motivo:</span>
                        <span className="font-semibold text-foreground">{d.motivo}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-lg border border-border">
                        <span className="text-muted-foreground">Método:</span>
                        <span className="font-semibold text-foreground">{METODO_LABELS[d.metodo_devolucion] ?? d.metodo_devolucion}</span>
                      </span>
                      {d.nota && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-lg border border-border italic text-muted-foreground">
                          {d.nota}
                        </span>
                      )}
                    </div>
                    {d.items?.length > 0 && (
                      <table className="w-full text-xs rounded-xl overflow-hidden">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                            <th className="text-left px-3 py-2 text-2xs font-bold uppercase tracking-widest">Producto</th>
                            <th className="text-right px-3 py-2 text-2xs font-bold uppercase tracking-widest">Cant.</th>
                            <th className="text-right px-3 py-2 text-2xs font-bold uppercase tracking-widest">Precio</th>
                            <th className="text-right px-3 py-2 text-2xs font-bold uppercase tracking-widest">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {d.items.map((it, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-2 font-medium text-foreground">{it.producto_nombre}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{it.cantidad}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(Number(it.precio_unitario))}</td>
                              <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">{formatCurrency(it.cantidad * Number(it.precio_unitario))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva devolución */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetModal(); } }}>
        <DialogContent className="max-w-xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-rose-400/70 to-transparent" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0 shadow-sm">
                <RotateCcw size={14} className="text-white" />
              </div>
              Nueva devolución
            </DialogTitle>
          </DialogHeader>

          {step === "buscar" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs mb-1.5 block">Buscar venta (ID, cliente o cajero)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: 1023 o nombre del cliente…"
                    value={busqVenta}
                    onChange={(e) => setBusqVenta(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarVentas()}
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" className="h-8" onClick={buscarVentas} disabled={buscandoVentas}>
                    {buscandoVentas ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Ingresa el número de venta o nombre del cliente para buscar</p>
            </div>
          )}

          {step === "seleccionar" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Ventas encontradas</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStep("buscar")}>← Volver</Button>
              </div>
              {ventas.length === 0 ? (
                <EmptyState icon={Package} title="Sin resultados" description="No se encontraron ventas completadas." />
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {ventas.map((v) => (
                    <button key={v.id} onClick={() => seleccionarVenta(v)}
                      className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/40 hover:border-brand-200 dark:hover:border-brand-800/50 transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                          {v.cliente_nombre ?? "General"}
                          <span className="text-muted-foreground font-normal ml-1.5 text-xs">Venta #{v.id}</span>
                        </span>
                        <span className="text-sm font-black tabular-nums">{formatCurrency(Number(v.total))}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <CalendarDays size={10} className="opacity-60" />{fmtFecha(v.fecha)}
                        <span className="opacity-40">·</span>
                        <User2 size={10} className="opacity-60" />{v.cajero_nombre}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "form" && ventaSeleccionada && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Venta #{ventaSeleccionada.id} — {ventaSeleccionada.cliente_nombre ?? "General"}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStep("seleccionar")}>← Volver</Button>
              </div>

              {/* Items */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">Selecciona los productos a devolver</div>
                <div className="divide-y divide-border">
                  {ventaSeleccionada.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{it.producto_nombre}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Number(it.precio_unitario))} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCantidad(it.id, Number(it.cantidad), -1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">-</button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums">{itemsSeleccionados[it.id] ?? 0}</span>
                        <button onClick={() => toggleCantidad(it.id, Number(it.cantidad), 1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">+</button>
                        <span className="text-2xs text-muted-foreground">/ {it.cantidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivo y método */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Motivo</Label>
                  <select {...regDev("motivo")}
                    className="w-full h-8 text-sm border border-border rounded-md bg-background px-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Método devolución</Label>
                  <select {...regDev("metodo_devolucion")}
                    className="w-full h-8 text-sm border border-border rounded-md bg-background px-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {METODOS.map((m) => <option key={m} value={m}>{METODO_LABELS[m]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Nota (opcional)</Label>
                <Input className="h-8 text-sm" placeholder="Observaciones adicionales…" {...regDev("nota")} />
              </div>

              {totalDevolver > 0 && (
                <div className="relative flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 rounded-xl px-4 py-3 border border-rose-200 dark:border-rose-800/50 overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-rose-400/70 to-transparent" />
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">Total a devolver</span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(totalDevolver)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
            {step === "form" && (
              <Button size="sm" onClick={onGuardarDevolucion} disabled={guardando || totalDevolver === 0} className="gap-2">
                {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Registrar devolución
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
