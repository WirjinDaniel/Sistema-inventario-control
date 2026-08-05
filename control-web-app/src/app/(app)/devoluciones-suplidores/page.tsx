"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Truck, Plus, Search, RefreshCw, Check, ChevronDown, ChevronUp,
  Package, DollarSign, AlertTriangle, FileText,
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
import type { Suplidor, OrdenCompra } from "@/types";

interface DevolucionSuplidor {
  id: number; fecha: string; suplidor: number; suplidor_nombre: string;
  orden_compra: number | null; usuario_nombre: string;
  motivo: string; nota: string; estado: string; monto_credito: string;
  items: { producto_nombre: string; cantidad: number; precio_unitario: string; motivo_item: string }[];
}

const MOTIVOS = [
  "Producto dañado al recibir", "Producto vencido", "Cantidad incorrecta",
  "Producto incorrecto", "Calidad no aceptable", "Otro",
];
const ESTADOS_BADGE: Record<string, "warning" | "success" | "danger"> = {
  PENDIENTE: "warning", APROBADA: "success", RECHAZADA: "danger",
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

export default function DevolucionesSuplidoresPage() {
  const [devoluciones, setDevoluciones] = useState<DevolucionSuplidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [suplidorId, setSuplidorId] = useState<number | null>(null);
  const [ordenId, setOrdenId] = useState<number | null>(null);
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenCompra | null>(null);
  const [items, setItems] = useState<{ producto: number; producto_nombre: string; cantidad_max: number; cantidad: number; precio_unitario: string; motivo_item: string }[]>([]);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const { data } = await api.get(`/devoluciones-suplidores/?${params}`);
      setDevoluciones(data.results ?? data);
    } catch { setDevoluciones([]); }
    setLoading(false);
  }, [busqueda, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get("/suplidores/?page_size=100").then(({ data }) => setSuplidores(data.results ?? data)).catch(() => {});
  }, []);

  async function cargarOrdenes(sid: number) {
    setSuplidorId(sid);
    setOrdenId(null); setOrdenDetalle(null); setItems([]);
    try {
      const { data } = await api.get(`/compras/?suplidor=${sid}&estado=RECIBIDA&page_size=50`);
      setOrdenes(data.results ?? data);
    } catch { setOrdenes([]); }
  }

  async function cargarOrdenDetalle(oid: number) {
    setOrdenId(oid);
    try {
      const { data } = await api.get(`/compras/${oid}/`);
      setOrdenDetalle(data);
      setItems(data.items.map((it: any) => ({
        producto: it.producto, producto_nombre: it.producto_nombre,
        cantidad_max: Number(it.cantidad),
        cantidad: 0, precio_unitario: it.precio_costo, motivo_item: "",
      })));
    } catch { toast.error("Error cargando orden"); }
  }

  const totalCredito = items.reduce((a, it) => a + it.cantidad * Number(it.precio_unitario), 0);

  function resetModal() {
    setSuplidorId(null); setOrdenId(null); setOrdenDetalle(null);
    setItems([]); setMotivo(MOTIVOS[0]); setNota(""); setOrdenes([]);
  }

  async function guardar() {
    const itemsValidos = items.filter((it) => it.cantidad > 0);
    if (itemsValidos.length === 0) { toast.error("Selecciona al menos un producto a devolver"); return; }
    setGuardando(true);
    try {
      await api.post("/devoluciones-suplidores/", {
        suplidor: suplidorId, orden_compra: ordenId,
        motivo, nota,
        items: itemsValidos.map((it) => ({
          producto: it.producto, cantidad: it.cantidad,
          precio_unitario: it.precio_unitario, motivo_item: it.motivo_item,
        })),
      });
      toast.success("Devolución a suplidor registrada");
      setModalOpen(false); resetModal(); cargar();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Error al guardar");
    }
    setGuardando(false);
  }

  const stats = {
    total: devoluciones.length,
    pendientes: devoluciones.filter((d) => d.estado === "PENDIENTE").length,
    monto: devoluciones.reduce((a, d) => a + Number(d.monto_credito), 0),
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Devoluciones a Suplidores"
        description="Registro de mercancía rechazada o devuelta a proveedores"
        actions={
          <Button size="sm" className="gap-2" onClick={() => { resetModal(); setModalOpen(true); }}>
            <Plus size={15} /> Nueva devolución
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total registradas", value: stats.total, icon: Truck, color: "text-brand-500" },
          { label: "Pendientes", value: stats.pendientes, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Crédito total", value: formatCurrency(stats.monto), icon: DollarSign, color: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por suplidor…" className="pl-8 h-8 text-sm"
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
          <EmptyState icon={Truck} title="Sin devoluciones" description="No hay devoluciones a suplidores registradas." />
        ) : (
          <div className="divide-y divide-border">
            {devoluciones.map((d) => (
              <div key={d.id}>
                <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                    <Truck size={15} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.suplidor_nombre}</p>
                    <p className="text-xs text-muted-foreground">{fmtFecha(d.fecha)} · {d.usuario_nombre}
                      {d.orden_compra && ` · Orden #${d.orden_compra}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={ESTADOS_BADGE[d.estado] ?? "secondary"} className="text-[10px]">{d.estado}</Badge>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(d.monto_credito))}</span>
                    {expandedId === d.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>
                {expandedId === d.id && (
                  <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Motivo:</span> <span className="font-medium">{d.motivo}</span></div>
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

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetModal(); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck size={16} className="text-amber-500" /> Nueva devolución a suplidor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Suplidor */}
            <div>
              <Label className="text-xs mb-1.5 block">Suplidor</Label>
              <select
                value={suplidorId ?? ""}
                onChange={(e) => cargarOrdenes(Number(e.target.value))}
                className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                <option value="">Seleccionar suplidor…</option>
                {suplidores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            {/* Orden de compra */}
            {suplidorId && (
              <div>
                <Label className="text-xs mb-1.5 block">Orden de compra (opcional)</Label>
                <select
                  value={ordenId ?? ""}
                  onChange={(e) => e.target.value ? cargarOrdenDetalle(Number(e.target.value)) : (setOrdenId(null), setOrdenDetalle(null), setItems([]))}
                  className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                  <option value="">Sin orden asociada</option>
                  {ordenes.map((o) => <option key={o.id} value={o.id}>Orden #{o.id} — {fmtFecha(o.fecha)} — {formatCurrency(Number(o.total))}</option>)}
                </select>
              </div>
            )}

            {/* Items de la orden */}
            {ordenDetalle && items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Productos a devolver
                </div>
                <div className="divide-y divide-border">
                  {items.map((it, i) => (
                    <div key={i} className="px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-medium">{it.producto_nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{formatCurrency(Number(it.precio_unitario))} c/u · máx {it.cantidad_max}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setItems((prev) => prev.map((x, j) => j === i ? { ...x, cantidad: Math.max(0, x.cantidad - 1) } : x))}
                            className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">-</button>
                          <span className="w-8 text-center text-sm font-medium tabular-nums">{it.cantidad}</span>
                          <button onClick={() => setItems((prev) => prev.map((x, j) => j === i ? { ...x, cantidad: Math.min(x.cantidad_max, x.cantidad + 1) } : x))}
                            className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted text-xs font-bold">+</button>
                        </div>
                      </div>
                      {it.cantidad > 0 && (
                        <Input
                          placeholder="Motivo específico (opcional)"
                          value={it.motivo_item}
                          onChange={(e) => setItems((prev) => prev.map((x, j) => j === i ? { ...x, motivo_item: e.target.value } : x))}
                          className="h-7 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Motivo general */}
            <div>
              <Label className="text-xs mb-1.5 block">Motivo general</Label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
                className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Nota (opcional)</Label>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} className="h-8 text-sm" placeholder="Observaciones adicionales…" />
            </div>

            {totalCredito > 0 && (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 rounded-lg px-4 py-3 border border-amber-200 dark:border-amber-900">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Crédito a recuperar</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(totalCredito)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !suplidorId} className="gap-2">
              {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Registrar devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
