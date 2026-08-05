"use client";
import { useState, useEffect, useCallback } from "react";
import {
  RotateCcw, Search, Plus, Check, X, ChevronDown, ChevronUp,
  Package, AlertTriangle, RefreshCw, DollarSign,
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
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [metodoDevolucion, setMetodoDevolucion] = useState("EFECTIVO");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

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

  async function guardarDevolucion() {
    if (!ventaSeleccionada) return;
    const items = ventaSeleccionada.items
      .filter((it) => (itemsSeleccionados[it.id] ?? 0) > 0)
      .map((it) => ({ venta_item: it.id, cantidad: itemsSeleccionados[it.id], precio_unitario: it.precio_unitario }));
    if (items.length === 0) { toast.error("Selecciona al menos un producto a devolver"); return; }
    setGuardando(true);
    try {
      await api.post("/devoluciones/", {
        venta: ventaSeleccionada.id, motivo, metodo_devolucion: metodoDevolucion,
        nota, items,
      });
      toast.success("Devolución registrada");
      setModalOpen(false);
      resetModal();
      cargar();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Error al registrar devolución");
    }
    setGuardando(false);
  }

  function resetModal() {
    setStep("buscar"); setBusqVenta(""); setVentas([]);
    setVentaSeleccionada(null); setItemsSeleccionados({});
    setMotivo(MOTIVOS[0]); setMetodoDevolucion("EFECTIVO"); setNota("");
  }

  const estadoBadge = (e: string) =>
    e === "APROBADA" ? "success" : e === "PENDIENTE" ? "warning" : "danger";

  const STATS = [
    { label: "Total devoluciones", value: devoluciones.length, icon: RotateCcw, color: "text-brand-500" },
    { label: "Monto devuelto", value: formatCurrency(devoluciones.reduce((a, d) => a + Number(d.monto_devuelto), 0)), icon: DollarSign, color: "text-emerald-500" },
    { label: "Pendientes", value: devoluciones.filter((d) => d.estado === "PENDIENTE").length, icon: AlertTriangle, color: "text-amber-500" },
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
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
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
            {devoluciones.map((d) => (
              <div key={d.id}>
                <button
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                    <RotateCcw size={15} className="text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {d.cliente_nombre || "Cliente general"} — Venta #{d.venta}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtFecha(d.fecha)} · {d.cajero_nombre}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={estadoBadge(d.estado) as any} className="text-[10px]">{d.estado}</Badge>
                    <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(Number(d.monto_devuelto))}</span>
                    {expandedId === d.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>
                {expandedId === d.id && (
                  <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-3">
                      <div><span className="text-muted-foreground">Motivo:</span> <span className="font-medium">{d.motivo}</span></div>
                      <div><span className="text-muted-foreground">Método:</span> <span className="font-medium">{METODO_LABELS[d.metodo_devolucion] ?? d.metodo_devolucion}</span></div>
                      {d.nota && <div><span className="text-muted-foreground">Nota:</span> <span className="font-medium">{d.nota}</span></div>}
                    </div>
                    {d.items?.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-1.5">Producto</th>
                            <th className="text-right py-1.5">Cant.</th>
                            <th className="text-right py-1.5">Precio</th>
                            <th className="text-right py-1.5">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {d.items.map((it, i) => (
                            <tr key={i}>
                              <td className="py-1.5">{it.producto_nombre}</td>
                              <td className="text-right">{it.cantidad}</td>
                              <td className="text-right">{formatCurrency(Number(it.precio_unitario))}</td>
                              <td className="text-right font-medium">{formatCurrency(it.cantidad * Number(it.precio_unitario))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nueva devolución */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetModal(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw size={16} className="text-rose-500" /> Nueva devolución
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
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Venta #{v.id} — {v.cliente_nombre ?? "General"}</span>
                        <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(v.total))}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(v.fecha)} · {v.cajero_nombre}</p>
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
                        <p className="text-[11px] text-muted-foreground">{formatCurrency(Number(it.precio_unitario))} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCantidad(it.id, Number(it.cantidad), -1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">-</button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums">{itemsSeleccionados[it.id] ?? 0}</span>
                        <button onClick={() => toggleCantidad(it.id, Number(it.cantidad), 1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">+</button>
                        <span className="text-[10px] text-muted-foreground">/ {it.cantidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivo y método */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Motivo</Label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    className="w-full h-8 text-sm border border-border rounded-md bg-background px-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Método devolución</Label>
                  <select value={metodoDevolucion} onChange={(e) => setMetodoDevolucion(e.target.value)}
                    className="w-full h-8 text-sm border border-border rounded-md bg-background px-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {METODOS.map((m) => <option key={m} value={m}>{METODO_LABELS[m]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Nota (opcional)</Label>
                <Input value={nota} onChange={(e) => setNota(e.target.value)} className="h-8 text-sm" placeholder="Observaciones adicionales…" />
              </div>

              {totalDevolver > 0 && (
                <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 rounded-lg px-4 py-3 border border-rose-200 dark:border-rose-900">
                  <span className="text-sm font-medium text-rose-700 dark:text-rose-400">Total a devolver</span>
                  <span className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(totalDevolver)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
            {step === "form" && (
              <Button size="sm" onClick={guardarDevolucion} disabled={guardando || totalDevolver === 0} className="gap-2">
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
