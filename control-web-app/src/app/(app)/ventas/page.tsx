"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  BookOpen, Search, ShoppingCart, CreditCard, Building2,
  Banknote, AlertTriangle, X, Check, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import type { Venta } from "@/types";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/use-pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmitirNCFModal from "@/components/EmitirNCFModal";

interface VentaItem {
  id: number; producto_nombre: string;
  cantidad: string; precio_unitario: string; subtotal: string;
}
interface VentaDetalle extends Venta {
  items: VentaItem[]; itbis: string; descuento: string; nota: string;
  factura_ncf?: string | null;
}

const METODO_CONFIG: Record<string, { label: string; badge: "success" | "info" | "purple" | "warning"; icon: React.ElementType }> = {
  EFECTIVO:      { label: "Efectivo",      badge: "success", icon: Banknote },
  TARJETA:       { label: "Tarjeta",       badge: "info",    icon: CreditCard },
  TRANSFERENCIA: { label: "Transferencia", badge: "purple",  icon: Building2 },
  FIADO:         { label: "Fiado",         badge: "warning", icon: ShoppingCart },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function VentasPage() {
  const { esAdmin } = useAuthStore();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [ncfModal, setNcfModal] = useState<VentaDetalle | null>(null);
  const [confirmAnularId, setConfirmAnularId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (filtroMetodo) params.set("metodo_pago", filtroMetodo);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const { data } = await api.get(`/ventas/?${params}`);
      setVentas(data.results ?? data);
    } catch { toast.error("Error cargando ventas"); }
    setLoading(false);
  }, [busqueda, filtroMetodo, filtroEstado, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); resetPage(); }, [cargar]);

  async function verDetalle(id: number) {
    if (expandedId === id) { setExpandedId(null); setDetalle(null); return; }
    setExpandedId(id);
    setLoadingDetalle(true);
    try {
      const { data } = await api.get(`/ventas/${id}/`);
      setDetalle(data);
    } catch { toast.error("Error cargando detalle"); }
    setLoadingDetalle(false);
  }

  async function anular(id: number) {
    setAnulando(id);
    try {
      await api.post(`/ventas/${id}/anular/`);
      toast.success("Venta anulada");
      cargar();
      if (expandedId === id) { setExpandedId(null); setDetalle(null); }
    } catch { toast.error("Error al anular la venta"); }
    setAnulando(null);
  }

  async function onNcfSuccess(_ncf: string, _tipoNombre: string, _clienteNombre: string) {
    setNcfModal(null);
    if (expandedId && detalle?.id === expandedId) {
      const { data } = await api.get(`/ventas/${expandedId}/`);
      setDetalle(data);
    }
    cargar();
  }

  const totalGeneral = ventas.filter((v) => v.estado === "COMPLETADA").reduce((s, v) => s + Number(v.total), 0);
  const hayFiltros = !!(busqueda || filtroMetodo || filtroEstado || fechaDesde || fechaHasta);
  const { paged: ventasPaged, page, setPage, totalPages, reset: resetPage } = usePagination(ventas, 20);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Ventas"
        description={`${ventas.length} registros · Total: ${formatCurrency(totalGeneral)}`}
        actions={
          <div className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-lg px-3 py-1.5">
            <BookOpen size={14} className="text-brand-500 dark:text-brand-400" />
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              {ventas.filter((v) => v.estado === "COMPLETADA").length} completadas
              {ventas.filter((v) => v.estado === "ANULADA").length > 0 && (
                <span className="font-normal text-rose-500 dark:text-rose-400 ml-1">
                  · {ventas.filter((v) => v.estado === "ANULADA").length} anulada{ventas.filter((v) => v.estado === "ANULADA").length !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
        }
      />

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
          <div className="relative col-span-2 lg:col-span-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Cliente, cajero..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <select value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos los métodos</option>
            {Object.entries(METODO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos los estados</option>
            <option value="COMPLETADA">Completada</option>
            <option value="ANULADA">Anulada</option>
          </select>
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground"
            onClick={() => { setBusqueda(""); setFiltroMetodo(""); setFiltroEstado(""); setFechaDesde(""); setFechaHasta(""); }}>
            <X size={12} /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24 flex-1" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : ventas.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sin ventas" description={hayFiltros ? "No hay ventas con estos filtros." : "Las ventas registradas aparecerán aquí."} />
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
              <tr className="border-b border-border bg-muted/50">
                {["Fecha / Hora", "Cliente", "Cajero", "Método", "Total", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ventasPaged.map((v) => {
                const metodo = METODO_CONFIG[v.metodo_pago] ?? { label: v.metodo_pago, badge: "secondary" as const, icon: ShoppingCart };
                const Icon = metodo.icon;
                const isExpanded = expandedId === v.id;
                const anulada = v.estado === "ANULADA";
                const hoy = new Date().toDateString() === new Date(v.fecha).toDateString();
                return (
                  <React.Fragment key={v.id}>
                    <tr
                      className={cn("hover:bg-muted/30 transition-colors cursor-pointer", anulada && "opacity-50")}
                      onClick={() => verDetalle(v.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {v.cliente_nombre ?? <span className="text-muted-foreground italic text-xs">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{v.cajero_nombre}</td>
                      <td className="px-4 py-3">
                        <Badge variant={metodo.badge} className="gap-1 text-xs">
                          <Icon size={10} /> {metodo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground tabular-nums">{formatCurrency(Number(v.total))}</td>
                      <td className="px-4 py-3">
                        <Badge variant={anulada ? "danger" : "success"} className="gap-1 text-xs">
                          {anulada ? <><AlertTriangle size={10} /> Anulada</> : <><Check size={10} /> Completada</>}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${v.id}-det`} className="bg-muted/10">
                        <td colSpan={7} className="px-4 py-4">
                          {loadingDetalle && !detalle ? (
                            <Skeleton className="h-16 w-full rounded-lg" />
                          ) : detalle && detalle.id === v.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {(detalle.items ?? []).map((item) => (
                                  <div key={item.id} className="bg-card rounded-lg border border-border px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                    <span className="text-foreground font-medium truncate flex-1">{item.producto_nombre}</span>
                                    <span className="text-muted-foreground shrink-0">{item.cantidad} × {formatCurrency(Number(item.precio_unitario))}</span>
                                    <span className="font-semibold text-foreground shrink-0">{formatCurrency(Number(item.subtotal))}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {Number(detalle.descuento) > 0 && (
                                    <span>Descuento: <strong className="text-rose-600 dark:text-rose-400">-{formatCurrency(Number(detalle.descuento))}</strong></span>
                                  )}
                                  {Number(detalle.itbis) > 0 && (
                                    <span>ITBIS: <strong className="text-foreground">{formatCurrency(Number(detalle.itbis))}</strong></span>
                                  )}
                                  {detalle.nota && <span className="italic">{detalle.nota}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!anulada && (
                                    detalle.factura_ncf ? (
                                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                        <FileText size={12} /> NCF: {detalle.factura_ncf}
                                      </span>
                                    ) : (
                                      <Button
                                        variant="ghost" size="sm"
                                        className="h-7 text-xs gap-1.5 text-brand-600 hover:bg-brand-50/80 dark:text-brand-400 dark:hover:bg-brand-950/30"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setNcfModal(detalle);
                                        }}
                                      >
                                        <FileText size={12} /> Emitir comprobante
                                      </Button>
                                    )
                                  )}
                                  {esAdmin() && !anulada && hoy && (
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 text-xs gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                      disabled={anulando === v.id}
                                      onClick={(e) => { e.stopPropagation(); setConfirmAnularId(v.id); }}
                                    >
                                      <AlertTriangle size={12} />
                                      {anulando === v.id ? "Anulando..." : "Anular venta"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && ventas.length > 0 && (
          <div className="border-t border-border px-4">
            <Pagination page={page} totalPages={totalPages} total={ventas.length} pageSize={20} onPage={setPage} />
          </div>
        )}
      </div>

      <Dialog open={!!confirmAnularId} onOpenChange={(o) => { if (!o) setConfirmAnularId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle size={16} /> Anular venta
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro que deseas anular esta venta? Esta acción es irreversible y restaurará el stock de los productos.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmAnularId(null)}>Cancelar</Button>
            <Button
              variant="destructive" size="sm"
              disabled={anulando === confirmAnularId}
              onClick={() => {
                if (confirmAnularId) { anular(confirmAnularId); setConfirmAnularId(null); }
              }}
            >
              {anulando === confirmAnularId ? "Anulando..." : "Sí, anular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ncfModal && (
        <EmitirNCFModal
          ventaId={ncfModal.id}
          clienteNombre={ncfModal.cliente_nombre}
          subtotal={ncfModal.subtotal}
          itbis={ncfModal.itbis}
          total={ncfModal.total}
          onSuccess={onNcfSuccess}
          onClose={() => setNcfModal(null)}
        />
      )}
    </div>
  );
}
