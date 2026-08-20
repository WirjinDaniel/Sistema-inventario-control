"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Truck, Plus, Search, RefreshCw, Check, ChevronDown, ChevronUp,
  Package, DollarSign, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { Suplidor, OrdenCompra } from "@/types";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

interface DevolucionSuplidor {
  id: number; fecha: string; suplidor: number; suplidor_nombre: string;
  orden_compra: number | null; usuario_nombre: string;
  motivo: string; nota: string; estado: string; monto_credito: string;
  items: { producto_nombre: string; cantidad: number; precio_unitario: string; motivo_item: string }[];
}

const devSchema = z.object({
  motivo: z.string().min(1),
  nota: z.string().optional(),
});
type DevForm = z.infer<typeof devSchema>;

const MOTIVOS = [
  "Producto dañado al recibir", "Producto vencido", "Cantidad incorrecta",
  "Producto incorrecto", "Calidad no aceptable", "Otro",
];

const ESTADO_CONFIG: Record<string, { accentBg: string; accentBorder: string; color: string; gradient: string }> = {
  PENDIENTE: { accentBg: "bg-amber-50",   accentBorder: "border-amber-200",   color: "text-amber-700",   gradient: "from-amber-500 to-orange-600" },
  APROBADA:  { accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", color: "text-emerald-700", gradient: "from-emerald-500 to-teal-600" },
  RECHAZADA: { accentBg: "bg-rose-50",    accentBorder: "border-rose-200",    color: "text-rose-700",    gradient: "from-rose-500 to-red-600" },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

export default function DevolucionesSuplidoresPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [devoluciones, setDevoluciones] = useState<DevolucionSuplidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [suplidorId, setSuplidorId] = useState<number | null>(null);
  const [ordenId, setOrdenId] = useState<number | null>(null);
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenCompra | null>(null);
  const [items, setItems] = useState<{ producto: number; producto_nombre: string; cantidad_max: number; cantidad: number; precio_unitario: string; motivo_item: string }[]>([]);
  const {
    register: regDev, handleSubmit: handleDev, reset: resetDev,
    formState: { isSubmitting: guardando },
  } = useForm<DevForm>({ resolver: zodResolver(devSchema), defaultValues: { motivo: MOTIVOS[0], nota: "" } });

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
    setItems([]); resetDev({ motivo: MOTIVOS[0], nota: "" }); setOrdenes([]);
  }

  const guardar = handleDev(async (data) => {
    const itemsValidos = items.filter((it) => it.cantidad > 0);
    if (itemsValidos.length === 0) { toast.error("Selecciona al menos un producto a devolver"); return; }
    try {
      await api.post("/devoluciones-suplidores/", {
        suplidor: suplidorId, orden_compra: ordenId,
        motivo: data.motivo, nota: data.nota,
        items: itemsValidos.map((it) => ({
          producto: it.producto, cantidad: it.cantidad,
          precio_unitario: it.precio_unitario, motivo_item: it.motivo_item,
        })),
      });
      toast.success("Devolución a suplidor registrada");
      setModalOpen(false); resetModal(); cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Error al guardar");
    }
  });

  const stats = {
    total: devoluciones.length,
    pendientes: devoluciones.filter((d) => d.estado === "PENDIENTE").length,
    monto: devoluciones.reduce((a, d) => a + Number(d.monto_credito), 0),
  };

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  const inputCls = "border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 transition bg-card";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Devoluciones a Suplidores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Registro de mercancía rechazada o devuelta a proveedores</p>
          </div>
        </div>
        <button
          onClick={() => { resetModal(); setModalOpen(true); }}
          className="flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nueva devolución
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total registradas", value: stats.total,               gradient: "from-amber-500 to-orange-600",  via: "via-amber-400/60",   Icon: Truck },
          { label: "Pendientes",        value: stats.pendientes,           gradient: "from-rose-500 to-red-600",      via: "via-rose-400/60",    Icon: AlertTriangle },
          { label: "Crédito total",     value: formatCurrency(stats.monto), gradient: "from-emerald-500 to-teal-600", via: "via-emerald-400/60", Icon: DollarSign },
        ].map(({ label, value, gradient, via, Icon }) => (
          <div key={label} className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${via} to-transparent`} />
            <div className="flex items-start gap-3">
              <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm p-4 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Buscar por suplidor…" className={`${inputCls} pl-8 w-full`}
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-9 text-sm w-36" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-9 text-sm w-36" />
          <Button variant="outline" size="sm" className="gap-1" onClick={cargar}>
            <RefreshCw size={12} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/60 to-transparent" />
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted/60 rounded-xl animate-pulse" />)}
          </div>
        ) : devoluciones.length === 0 ? (
          <EmptyState icon={Truck} title="Sin devoluciones" description="No hay devoluciones a suplidores registradas." />
        ) : (
          <div className="divide-y divide-border">
            {devoluciones.map((d) => {
              const cfg = ESTADO_CONFIG[d.estado] ?? ESTADO_CONFIG.PENDIENTE;
              return (
                <div key={d.id}>
                  <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left">
                    <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${cfg.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                      <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                      <Truck size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{d.suplidor_nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(d.fecha)} · {d.usuario_nombre}
                        {d.orden_compra && ` · Orden #${d.orden_compra}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold border ${cfg.accentBg} ${cfg.accentBorder} ${cfg.color}`}>
                        {d.estado}
                      </span>
                      <span className="text-sm font-black tabular-nums text-foreground">{formatCurrency(Number(d.monto_credito))}</span>
                      <span className="text-muted-foreground">
                        {expandedId === d.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>
                  </button>
                  {expandedId === d.id && (
                    <div className="px-5 pb-4 bg-muted/20 border-t border-border">
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs mb-3">
                        <div><span className="text-muted-foreground">Motivo:</span> <span className="font-semibold text-foreground">{d.motivo}</span></div>
                        {d.nota && <div><span className="text-muted-foreground">Nota:</span> <span className="font-semibold text-foreground">{d.nota}</span></div>}
                      </div>
                      {d.items?.length > 0 && (
                        <div className="rounded-xl border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/40 border-b border-border">
                                {["Producto", "Cant.", "Precio", "Subtotal"].map((h) => (
                                  <th key={h} className={`py-2 px-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest ${h === "Producto" ? "text-left" : "text-right"}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {d.items.map((it, i) => (
                                <tr key={i} className="hover:bg-muted/20">
                                  <td className="py-2 px-3 font-medium text-foreground">{it.producto_nombre}</td>
                                  <td className="py-2 px-3 text-right text-muted-foreground">{it.cantidad}</td>
                                  <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(Number(it.precio_unitario))}</td>
                                  <td className="py-2 px-3 text-right font-semibold tabular-nums">{formatCurrency(it.cantidad * Number(it.precio_unitario))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); resetModal(); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-lg bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Truck size={13} className="text-white" />
              </div>
              Nueva devolución a suplidor
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Suplidor</Label>
              <select
                value={suplidorId ?? ""}
                onChange={(e) => cargarOrdenes(Number(e.target.value))}
                className="w-full h-9 text-sm border border-border rounded-xl bg-card text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Seleccionar suplidor…</option>
                {suplidores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            {suplidorId && (
              <div>
                <Label className="text-xs mb-1.5 block">Orden de compra (opcional)</Label>
                <select
                  value={ordenId ?? ""}
                  onChange={(e) => e.target.value ? cargarOrdenDetalle(Number(e.target.value)) : (setOrdenId(null), setOrdenDetalle(null), setItems([]))}
                  className="w-full h-9 text-sm border border-border rounded-xl bg-card text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">Sin orden asociada</option>
                  {ordenes.map((o) => <option key={o.id} value={o.id}>Orden #{o.id} — {fmtFecha(o.fecha)} — {formatCurrency(Number(o.total))}</option>)}
                </select>
              </div>
            )}

            {ordenDetalle && items.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">
                  Productos a devolver
                </div>
                <div className="divide-y divide-border">
                  {items.map((it, i) => (
                    <div key={i} className="px-3 py-2.5 space-y-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-foreground">{it.producto_nombre}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(Number(it.precio_unitario))} c/u · máx {it.cantidad_max}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setItems((prev) => prev.map((x, j) => j === i ? { ...x, cantidad: Math.max(0, x.cantidad - 1) } : x))}
                            className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-sm font-bold transition-colors">-</button>
                          <span className="w-8 text-center text-sm font-black tabular-nums text-foreground">{it.cantidad}</span>
                          <button type="button" onClick={() => setItems((prev) => prev.map((x, j) => j === i ? { ...x, cantidad: Math.min(x.cantidad_max, x.cantidad + 1) } : x))}
                            className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-sm font-bold transition-colors">+</button>
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

            <div>
              <Label className="text-xs mb-1.5 block">Motivo general</Label>
              <select
                className="w-full h-9 text-sm border border-border rounded-xl bg-card text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-brand-400"
                {...regDev("motivo")}
              >
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Nota (opcional)</Label>
              <Input className="text-sm" placeholder="Observaciones adicionales…" {...regDev("nota")} />
            </div>

            {totalCredito > 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-sm font-semibold text-amber-700">Crédito a recuperar</span>
                <span className="text-lg font-black text-amber-600 tabular-nums">{formatCurrency(totalCredito)}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={guardando || !suplidorId} className="gap-2">
                {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Registrar devolución
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
