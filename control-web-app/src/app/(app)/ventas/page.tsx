"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  BookOpen, Search, ShoppingCart, CreditCard, Building2,
  Banknote, AlertTriangle, X, Check, ChevronDown, ChevronUp, FileText,
  TrendingUp, CalendarDays, User2, Receipt,
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

const METODO_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  gradient: string;
  accentBg: string;
  accentBorder: string;
  color: string;
}> = {
  EFECTIVO:      { label: "Efectivo",      icon: Banknote,    gradient: "from-emerald-500 to-teal-600",  accentBg: "bg-emerald-50 dark:bg-emerald-950/30", accentBorder: "border-emerald-200 dark:border-emerald-800/50", color: "text-emerald-700 dark:text-emerald-300" },
  TARJETA:       { label: "Tarjeta",       icon: CreditCard,  gradient: "from-sky-500 to-blue-600",      accentBg: "bg-sky-50 dark:bg-sky-950/30",         accentBorder: "border-sky-200 dark:border-sky-800/50",         color: "text-sky-700 dark:text-sky-300" },
  TRANSFERENCIA: { label: "Transferencia", icon: Building2,   gradient: "from-violet-500 to-purple-600", accentBg: "bg-violet-50 dark:bg-violet-950/30",   accentBorder: "border-violet-200 dark:border-violet-800/50",   color: "text-violet-700 dark:text-violet-300" },
  FIADO:         { label: "Fiado",         icon: ShoppingCart,gradient: "from-amber-500 to-orange-500",  accentBg: "bg-amber-50 dark:bg-amber-950/30",     accentBorder: "border-amber-200 dark:border-amber-800/50",     color: "text-amber-700 dark:text-amber-300" },
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
  const completadas = ventas.filter((v) => v.estado === "COMPLETADA").length;
  const anuladas = ventas.filter((v) => v.estado === "ANULADA").length;
  const hayFiltros = !!(busqueda || filtroMetodo || filtroEstado || fechaDesde || fechaHasta);
  const { paged: ventasPaged, page, setPage, totalPages, reset: resetPage } = usePagination(ventas, 20);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Ventas"
        description={
          <span className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50 px-2 py-0.5 rounded-full">
              <Receipt size={10} /> {ventas.length} registros
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-full">
              <Check size={10} /> {completadas} completada{completadas !== 1 ? "s" : ""}
            </span>
            {anuladas > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> {anuladas} anulada{anuladas !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 bg-linear-to-br from-brand-50 to-indigo-50 dark:from-brand-950/30 dark:to-indigo-950/20 border border-brand-200 dark:border-brand-800/50 rounded-xl px-3 py-2">
            <div className="w-6 h-6 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp size={12} className="text-white" />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground uppercase tracking-wide font-medium leading-none">Total período</p>
              <p className="text-sm font-black text-brand-700 dark:text-brand-300 tabular-nums leading-tight">{formatCurrency(totalGeneral)}</p>
            </div>
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
            className="h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos los métodos</option>
            {Object.entries(METODO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos los estados</option>
            <option value="COMPLETADA">Completada</option>
            <option value="ANULADA">Anulada</option>
          </select>
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
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
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Fecha / Hora", "Cliente", "Cajero", "Método", "Total", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ventasPaged.map((v) => {
                const metodo = METODO_CONFIG[v.metodo_pago] ?? { label: v.metodo_pago, icon: ShoppingCart, gradient: "from-slate-400 to-slate-500", accentBg: "bg-muted", accentBorder: "border-border", color: "text-muted-foreground" };
                const Icon = metodo.icon;
                const isExpanded = expandedId === v.id;
                const anulada = v.estado === "ANULADA";
                const hoy = new Date().toDateString() === new Date(v.fecha).toDateString();
                return (
                  <React.Fragment key={v.id}>
                    <tr
                      className={cn("hover:bg-muted/30 transition-colors cursor-pointer group", anulada && "opacity-50")}
                      onClick={() => verDetalle(v.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={11} className="opacity-50" />
                          {fmtFecha(v.fecha)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {v.cliente_nombre ?? <span className="text-muted-foreground/60 italic text-xs font-normal">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User2 size={11} className="opacity-50" />
                          {v.cajero_nombre}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                          metodo.accentBg, metodo.accentBorder, metodo.color
                        )}>
                          <Icon size={10} /> {metodo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-foreground tabular-nums text-base">{formatCurrency(Number(v.total))}</td>
                      <td className="px-4 py-3">
                        {anulada ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300">
                            <AlertTriangle size={10} /> Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
                            <Check size={10} /> Completada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {isExpanded
                          ? <ChevronUp size={14} className="group-hover:text-foreground transition-colors" />
                          : <ChevronDown size={14} className="group-hover:text-foreground transition-colors" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${v.id}-det`}>
                        <td colSpan={7} className="px-4 py-4 bg-muted/10 border-b border-border">
                          {loadingDetalle && !detalle ? (
                            <Skeleton className="h-16 w-full rounded-xl" />
                          ) : detalle && detalle.id === v.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {(detalle.items ?? []).map((item) => (
                                  <div key={item.id} className="relative bg-card rounded-xl border border-border px-3 py-2.5 flex items-center gap-3 text-xs overflow-hidden group/item hover:shadow-sm transition-shadow">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-brand-400 to-indigo-500 rounded-l-xl" />
                                    <span className="text-foreground font-semibold truncate flex-1 pl-1">{item.producto_nombre}</span>
                                    <span className="text-muted-foreground shrink-0 tabular-nums">{item.cantidad} × {formatCurrency(Number(item.precio_unitario))}</span>
                                    <span className="font-bold text-foreground shrink-0 tabular-nums">{formatCurrency(Number(item.subtotal))}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {Number(detalle.descuento) > 0 && (
                                    <span>Descuento: <strong className="text-rose-600 dark:text-rose-400">−{formatCurrency(Number(detalle.descuento))}</strong></span>
                                  )}
                                  {Number(detalle.itbis) > 0 && (
                                    <span>ITBIS: <strong className="text-foreground">{formatCurrency(Number(detalle.itbis))}</strong></span>
                                  )}
                                  {detalle.nota && <span className="italic opacity-70">{detalle.nota}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!anulada && (
                                    detalle.factura_ncf ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
                                        <FileText size={10} /> NCF: {detalle.factura_ncf}
                                      </span>
                                    ) : (
                                      <Button
                                        variant="ghost" size="sm"
                                        className="h-7 text-xs gap-1.5 text-brand-600 hover:bg-brand-50/80 dark:text-brand-400 dark:hover:bg-brand-950/30"
                                        onClick={(e) => { e.stopPropagation(); setNcfModal(detalle); }}
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
        <DialogContent className="max-w-sm overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-rose-400/70 to-transparent" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-white" />
              </div>
              <span className="text-rose-600 dark:text-rose-400">Anular venta</span>
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
