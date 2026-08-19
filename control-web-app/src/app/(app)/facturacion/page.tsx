"use client";
import { useState, useEffect, useCallback } from "react";
import React from "react";
import {
  FileText, Plus, Search, RefreshCw, Check, AlertTriangle,
  Download, Shield, XCircle, CreditCard, Banknote, ChevronDown, ChevronUp,
  Pencil, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Progress } from "@/components/ui/progress";

const TIPOS_NCF = [
  { codigo: "01", nombre: "Crédito Fiscal", descripcion: "Para ventas a empresas que deducen ITBIS. Requiere RNC del cliente." },
  { codigo: "02", nombre: "Consumo", descripcion: "Para ventas a consumidor final." },
  { codigo: "03", nombre: "Nota de Débito", descripcion: "Corrección que aumenta el monto. Requiere NCF original." },
  { codigo: "04", nombre: "Nota de Crédito", descripcion: "Corrección que reduce el monto. Requiere NCF original." },
  { codigo: "11", nombre: "Proveedores Informales", descripcion: "Para gastos sin comprobante del proveedor." },
  { codigo: "13", nombre: "Gastos Menores", descripcion: "Gastos menores sin comprobante." },
  { codigo: "14", nombre: "Régimen Especial", descripcion: "Para empresas en régimen especial de tributación." },
  { codigo: "15", nombre: "Gubernamental", descripcion: "Para entidades del gobierno." },
];

const TIPOS_REQUIEREN_RELACIONADO = new Set(["03", "04"]);

interface SecuenciaNCF {
  id: number; tipo: string; tipo_nombre: string;
  secuencia_desde: number; secuencia_hasta: number;
  secuencia_actual: number; activo: boolean;
  fecha_inicio: string; fecha_vencimiento: string;
  agotada: boolean; vencida: boolean; disponibles: number; proxima_a_agotar: boolean;
}

interface FacturaDetalle {
  id: number; descripcion: string; codigo: string;
  cantidad: string; unidad: string; precio_unitario: string;
  descuento: string; tasa_itbis: string; itbis_monto: string;
  subtotal: string; total: string; producto?: number | null;
  producto_nombre?: string | null;
}

interface PagoFactura {
  id: number; metodo: string; metodo_nombre: string;
  monto: string; referencia: string; notas: string; fecha: string;
}

interface Factura {
  id: number; ncf: string; tipo: string; tipo_nombre: string;
  fecha: string; fecha_vencimiento_pago?: string | null;
  cliente_nombre: string; cliente_rnc: string; cliente_direccion: string;
  ncf_relacionado?: number | null; ncf_relacionado_ncf?: string | null;
  motivo_nota: string; forma_pago: string; forma_pago_nombre: string;
  moneda: string; subtotal: string; descuento: string;
  itbis: string; total: string; monto_pagado: string; saldo_pendiente: string;
  estado: "BORRADOR" | "EMITIDA" | "PAGADA" | "PENDIENTE" | "PARCIAL" | "ANULADA";
  estado_nombre: string; motivo_anulacion: string;
  datos_especificos: Record<string, string>;
  detalles: FacturaDetalle[]; pagos: PagoFactura[];
  venta?: number | null;
}

interface DashboardData {
  por_tipo: { tipo: string; cantidad: number; total_monto: string; total_itbis: string }[];
  totales: { total_facturas: number; total_ventas: string; total_itbis: string };
  pendientes: { cantidad: number; total: string };
  alertas: { tipo: string; mensaje: string; nivel: "error" | "warning" }[];
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: "secondary", EMITIDA: "default", PAGADA: "success",
  PENDIENTE: "warning", PARCIAL: "warning", ANULADA: "danger",
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

const DETALLE_EMPTY = {
  descripcion: "", codigo: "", cantidad: "1", unidad: "UND",
  precio_unitario: "0", descuento: "0", tasa_itbis: "0",
};

export default function FacturacionPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [tab, setTab] = useState("dashboard");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [secuencias, setSecuencias] = useState<SecuenciaNCF[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal anulación
  const [anularModal, setAnularModal] = useState<Factura | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);

  // Modal registrar pago
  const [pagoModal, setPagoModal] = useState<Factura | null>(null);
  const [pagoForm, setPagoForm] = useState({ metodo: "EFECTIVO", monto: "", referencia: "", notas: "" });
  const [guardandoPago, setGuardandoPago] = useState(false);

  // Modal nueva/editar secuencia
  const [secModal, setSecModal] = useState(false);
  const [secEditando, setSecEditando] = useState<SecuenciaNCF | null>(null);
  const [secForm, setSecForm] = useState({
    tipo: "01", secuencia_desde: 1, secuencia_hasta: 1000, fecha_vencimiento: "",
  });
  const [guardandoSec, setGuardandoSec] = useState(false);

  // Modal confirmar borrado secuencia
  const [secBorrarModal, setSecBorrarModal] = useState<SecuenciaNCF | null>(null);
  const [borrando, setBorrando] = useState(false);

  // Modal nueva factura
  const [nuevaModal, setNuevaModal] = useState(false);
  const [facForm, setFacForm] = useState({
    tipo: "02",
    cliente_nombre: "Consumidor Final",
    cliente_rnc: "",
    cliente_direccion: "",
    ncf_relacionado: "",
    motivo_nota: "",
    forma_pago: "EFECTIVO",
    datos_especificos: {} as Record<string, string>,
  });
  const [detalles, setDetalles] = useState([{ ...DETALLE_EMPTY }]);
  const [creandoFac, setCreandoFac] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroTipo) params.set("tipo", filtroTipo);

      const requests: Promise<any>[] = [
        api.get(`/facturacion/facturas/?${params}`),
        api.get("/facturacion/secuencias/"),
      ];
      if (esAdmin() || esSuperadmin()) requests.push(api.get("/facturacion/facturas/dashboard/"));

      const [facRes, secRes, dashRes] = await Promise.all(requests);
      setFacturas(facRes.data.results ?? facRes.data);
      setSecuencias(secRes.data.results ?? secRes.data);
      if (dashRes) setDashboard(dashRes.data);
    } catch {
      setFacturas([]); setSecuencias([]);
    }
    setLoading(false);
  }, [busqueda, fechaDesde, fechaHasta, filtroEstado, filtroTipo, esAdmin, esSuperadmin]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarSecuencia() {
    if (!secForm.fecha_vencimiento) { toast.error("La fecha de vencimiento es requerida"); return; }
    if (!secEditando && secForm.secuencia_desde >= secForm.secuencia_hasta) {
      toast.error("La secuencia hasta debe ser mayor que desde"); return;
    }
    setGuardandoSec(true);
    try {
      if (secEditando) {
        await api.patch(`/facturacion/secuencias/${secEditando.id}/`, {
          fecha_vencimiento: secForm.fecha_vencimiento,
          secuencia_hasta: secForm.secuencia_hasta,
          activo: true,
        });
        toast.success("Secuencia actualizada");
      } else {
        await api.post("/facturacion/secuencias/", {
          tipo: secForm.tipo,
          secuencia_desde: secForm.secuencia_desde,
          secuencia_hasta: secForm.secuencia_hasta,
          fecha_vencimiento: secForm.fecha_vencimiento,
        });
        toast.success("Secuencia NCF creada");
      }
      setSecModal(false);
      setSecEditando(null);
      cargar();
    } catch (e: any) {
      const err = e?.response?.data;
      toast.error(
        typeof err === "string" ? err
          : err?.detail ?? err?.non_field_errors?.[0] ?? "Error al guardar secuencia",
        { duration: 6000 }
      );
    }
    setGuardandoSec(false);
  }

  async function borrarSecuencia() {
    if (!secBorrarModal) return;
    setBorrando(true);
    try {
      await api.delete(`/facturacion/secuencias/${secBorrarModal.id}/`);
      toast.success(`Secuencia B${secBorrarModal.tipo} eliminada`);
      setSecBorrarModal(null);
      cargar();
    } catch {
      toast.error("No se pudo eliminar la secuencia");
    }
    setBorrando(false);
  }

  async function confirmarAnulacion() {
    if (!anularModal) return;
    setAnulando(true);
    try {
      await api.post(`/facturacion/facturas/${anularModal.id}/anular/`, { motivo });
      toast.success(`Factura ${anularModal.ncf} anulada`);
      setAnularModal(null); setMotivo("");
      cargar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Error al anular la factura");
    }
    setAnulando(false);
  }

  async function registrarPago() {
    if (!pagoModal) return;
    if (!pagoForm.monto || Number(pagoForm.monto) <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    setGuardandoPago(true);
    try {
      await api.post(`/facturacion/facturas/${pagoModal.id}/registrar-pago/`, pagoForm);
      toast.success("Pago registrado");
      setPagoModal(null);
      setPagoForm({ metodo: "EFECTIVO", monto: "", referencia: "", notas: "" });
      cargar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Error al registrar pago");
    }
    setGuardandoPago(false);
  }

  // Calculate totals from detalles
  const calcTotales = () => {
    let subtotal = 0, itbis = 0;
    for (const d of detalles) {
      const qty = Number(d.cantidad) || 0;
      const precio = Number(d.precio_unitario) || 0;
      const desc = Number(d.descuento) || 0;
      const tasa = Number(d.tasa_itbis) || 0;
      const sub = qty * precio - desc;
      subtotal += sub;
      itbis += sub * (tasa / 100);
    }
    return { subtotal, itbis, total: subtotal + itbis };
  };

  async function crearFactura() {
    if (detalles.length === 0 || !detalles[0].descripcion) {
      toast.error("Agrega al menos un ítem a la factura");
      return;
    }
    setCreandoFac(true);
    try {
      const { subtotal, itbis, total } = calcTotales();
      const body: any = {
        ...facForm,
        ncf_relacionado: facForm.ncf_relacionado ? Number(facForm.ncf_relacionado) : null,
        detalles: detalles.map((d) => ({
          descripcion: d.descripcion,
          codigo: d.codigo,
          cantidad: d.cantidad,
          unidad: d.unidad,
          precio_unitario: d.precio_unitario,
          descuento: d.descuento,
          tasa_itbis: d.tasa_itbis,
        })),
        subtotal, itbis, total,
      };
      await api.post("/facturacion/facturas/", body);
      toast.success("Factura emitida correctamente");
      setNuevaModal(false);
      setFacForm({
        tipo: "02", cliente_nombre: "Consumidor Final", cliente_rnc: "",
        cliente_direccion: "", ncf_relacionado: "", motivo_nota: "",
        forma_pago: "EFECTIVO", datos_especificos: {},
      });
      setDetalles([{ ...DETALLE_EMPTY }]);
      cargar();
    } catch (e: any) {
      const err = e?.response?.data;
      const msg = typeof err === "string" ? err
        : err?.detail ?? err?.non_field_errors?.[0]
        ?? (Object.values(err ?? {}) as string[][])?.[0]?.[0]
        ?? "Error al emitir factura";
      toast.error(msg, { duration: 8000 });
    }
    setCreandoFac(false);
  }

  function exportarCSV() {
    const headers = ["NCF", "Tipo", "Fecha", "Cliente", "RNC", "Subtotal", "ITBIS", "Total", "Estado"];
    const rows = facturas.map((f) => [
      f.ncf, f.tipo, fmtFecha(f.fecha), f.cliente_nombre, f.cliente_rnc,
      Number(f.subtotal).toFixed(2), Number(f.itbis).toFixed(2), Number(f.total).toFixed(2), f.estado,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "facturas-ncf.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const totales = calcTotales();

  if (!esAdmin() && !esSuperadmin()) {
    return <AccessDenied />;
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Facturación Fiscal"
        description="Gestión de Números de Comprobante Fiscal (NCF) — DGII República Dominicana"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportarCSV}>
              <Download size={13} /> Exportar 606
            </Button>
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setNuevaModal(true)}>
              <Plus size={13} /> Nueva factura
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          {(esAdmin() || esSuperadmin()) && <TabsTrigger value="dashboard" className="text-xs h-6">Dashboard</TabsTrigger>}
          <TabsTrigger value="facturas" className="text-xs h-6">Facturas NCF</TabsTrigger>
          <TabsTrigger value="secuencias" className="text-xs h-6">Secuencias NCF</TabsTrigger>
          <TabsTrigger value="tipos" className="text-xs h-6">Tipos de NCF</TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ── */}
        {(esAdmin() || esSuperadmin()) && (
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : dashboard ? (
              <>
                {/* Alertas */}
                {dashboard.alertas.length > 0 && (
                  <div className="space-y-2">
                    {dashboard.alertas.map((a, i) => (
                      <div key={i} className={cn(
                        "flex items-start gap-3 rounded-xl border p-3",
                        a.nivel === "error"
                          ? "border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30"
                          : "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30"
                      )}>
                        <AlertTriangle size={15} className={cn("mt-0.5 shrink-0", a.nivel === "error" ? "text-rose-500" : "text-amber-500")} />
                        <p className={cn("text-sm", a.nivel === "error" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300")}>
                          {a.mensaje}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Facturas emitidas", value: dashboard.totales.total_facturas ?? 0, icon: FileText, color: "text-brand-500" },
                    { label: "Total facturado", value: formatCurrency(Number(dashboard.totales.total_ventas ?? 0)), icon: Banknote, color: "text-emerald-500" },
                    { label: "ITBIS recolectado", value: formatCurrency(Number(dashboard.totales.total_itbis ?? 0)), icon: Shield, color: "text-purple-500" },
                    { label: "Por cobrar", value: formatCurrency(Number(dashboard.pendientes?.total ?? 0)), icon: CreditCard, color: "text-amber-500" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={color} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Por tipo */}
                {dashboard.por_tipo.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3">Facturación por tipo NCF</h3>
                    <div className="space-y-2">
                      {dashboard.por_tipo.map((pt) => {
                        const tipoInfo = TIPOS_NCF.find((t) => t.codigo === pt.tipo);
                        return (
                          <div key={pt.tipo} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-2xs font-mono">B{pt.tipo}</Badge>
                              <span className="text-xs text-muted-foreground">{tipoInfo?.nombre ?? `Tipo ${pt.tipo}`}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">{pt.cantidad} facturas</span>
                              <span className="font-semibold tabular-nums">{formatCurrency(Number(pt.total_monto ?? 0))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={FileText} title="Sin datos" description="No hay datos de facturación aún." />
            )}
          </TabsContent>
        )}

        {/* ── FACTURAS ── */}
        <TabsContent value="facturas" className="mt-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar NCF o cliente…" className="pl-8 h-8 text-sm"
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-8 text-sm border border-border rounded-md bg-background px-2 text-foreground">
              <option value="">Todos los estados</option>
              {["BORRADOR", "EMITIDA", "PAGADA", "PENDIENTE", "PARCIAL", "ANULADA"].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-8 text-sm border border-border rounded-md bg-background px-2 text-foreground">
              <option value="">Todos los tipos</option>
              {TIPOS_NCF.map((t) => <option key={t.codigo} value={t.codigo}>B{t.codigo} — {t.nombre}</option>)}
            </select>
            <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="h-8 text-sm w-36" />
            <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="h-8 text-sm w-36" />
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={cargar}>
              <RefreshCw size={12} /> Actualizar
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : facturas.length === 0 ? (
              <EmptyState icon={FileText} title="Sin facturas" description="No hay facturas NCF en este período." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                    <tr className="border-b border-border bg-muted/50">
                      {["", "NCF", "Tipo", "Fecha", "Cliente / RNC", "Total", "Saldo", "Estado", ...((esAdmin() || esSuperadmin()) ? [""] : [])].map((h, i) => (
                        <th key={i} className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {facturas.map((f) => (
                      <React.Fragment key={f.id}>
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        >
                          <td className="px-3 py-3 text-muted-foreground">
                            {expandedId === f.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs font-medium whitespace-nowrap">{f.ncf}</td>
                          <td className="px-3 py-3">
                            <Badge variant="secondary" className="text-2xs">B{f.tipo}</Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(f.fecha)}</td>
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium truncate max-w-36">{f.cliente_nombre || "Consumidor Final"}</p>
                            {f.cliente_rnc && <p className="text-2xs text-muted-foreground font-mono">{f.cliente_rnc}</p>}
                          </td>
                          <td className="px-3 py-3 font-bold tabular-nums text-sm whitespace-nowrap">{formatCurrency(Number(f.total))}</td>
                          <td className="px-3 py-3 text-xs tabular-nums whitespace-nowrap">
                            {Number(f.saldo_pendiente) > 0 ? (
                              <span className="text-amber-600 font-medium">{formatCurrency(Number(f.saldo_pendiente))}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={ESTADO_BADGE[f.estado] as any} className="text-2xs">
                              {f.estado_nombre ?? f.estado}
                            </Badge>
                          </td>
                          {(esAdmin() || esSuperadmin()) && (
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {f.estado !== "ANULADA" && f.estado !== "PAGADA" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPagoModal(f); setPagoForm({ metodo: "EFECTIVO", monto: String(f.saldo_pendiente), referencia: "", notas: "" }); }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                                  >
                                    + Pago
                                  </button>
                                )}
                                {f.estado !== "ANULADA" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAnularModal(f); setMotivo(""); }}
                                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
                                  >
                                    <XCircle size={12} /> Anular
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>

                        {expandedId === f.id && (
                          <tr>
                            <td colSpan={(esAdmin() || esSuperadmin()) ? 9 : 8} className="px-4 py-3 bg-muted/20">
                              <div className="grid md:grid-cols-2 gap-4 text-xs">
                                {/* Detalles ítems */}
                                <div>
                                  <p className="font-semibold mb-2 text-muted-foreground">Ítems</p>
                                  {f.detalles.length > 0 ? (
                                    <table className="w-full text-xs">
                                      <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                                        <tr className="text-muted-foreground">
                                          <th className="text-left pb-1">Descripción</th>
                                          <th className="text-right pb-1">Cant</th>
                                          <th className="text-right pb-1">Precio</th>
                                          <th className="text-right pb-1">ITBIS</th>
                                          <th className="text-right pb-1">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                        {f.detalles.map((d) => (
                                          <tr key={d.id}>
                                            <td className="py-1">{d.descripcion}</td>
                                            <td className="text-right py-1">{d.cantidad}</td>
                                            <td className="text-right py-1 tabular-nums">{formatCurrency(Number(d.precio_unitario))}</td>
                                            <td className="text-right py-1 tabular-nums text-purple-600">{formatCurrency(Number(d.itbis_monto))}</td>
                                            <td className="text-right py-1 tabular-nums font-medium">{formatCurrency(Number(d.total))}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-muted-foreground italic">Sin detalles de ítem</p>
                                  )}
                                </div>

                                {/* Pagos y totales */}
                                <div className="space-y-3">
                                  <div>
                                    <p className="font-semibold mb-2 text-muted-foreground">Resumen</p>
                                    <div className="space-y-1">
                                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(Number(f.subtotal))}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">ITBIS</span><span className="tabular-nums text-purple-600">{formatCurrency(Number(f.itbis))}</span></div>
                                      <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Total</span><span className="tabular-nums">{formatCurrency(Number(f.total))}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Pagado</span><span className="tabular-nums text-emerald-600">{formatCurrency(Number(f.monto_pagado))}</span></div>
                                      {Number(f.saldo_pendiente) > 0 && (
                                        <div className="flex justify-between font-semibold"><span className="text-amber-600">Saldo pendiente</span><span className="tabular-nums text-amber-600">{formatCurrency(Number(f.saldo_pendiente))}</span></div>
                                      )}
                                    </div>
                                  </div>

                                  {f.pagos.length > 0 && (
                                    <div>
                                      <p className="font-semibold mb-1.5 text-muted-foreground">Pagos registrados</p>
                                      {f.pagos.map((p) => (
                                        <div key={p.id} className="flex justify-between py-0.5">
                                          <span className="text-muted-foreground">{p.metodo_nombre} {p.referencia && `(${p.referencia})`}</span>
                                          <span className="tabular-nums font-medium">{formatCurrency(Number(p.monto))}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {f.ncf_relacionado_ncf && (
                                    <p className="text-muted-foreground">NCF relacionado: <span className="font-mono">{f.ncf_relacionado_ncf}</span></p>
                                  )}
                                  {f.motivo_anulacion && (
                                    <p className="text-rose-600">Motivo anulación: {f.motivo_anulacion}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── SECUENCIAS ── */}
        <TabsContent value="secuencias" className="mt-4 space-y-3">
          {(esAdmin() || esSuperadmin()) && (
            <div className="flex items-center justify-between gap-2">
              {(() => {
                const tiposFaltantes = ["02", "01"].filter(
                  (t) => !secuencias.some((s) => s.tipo === t && s.activo && !s.agotada && !s.vencida)
                );
                if (tiposFaltantes.length === 0 || secuencias.length === 0) return null;
                return (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    Sin secuencia activa para: {tiposFaltantes.map((t) => `B${t}`).join(", ")}
                  </p>
                );
              })()}
              <Button size="sm" className="gap-2 h-8 ml-auto" onClick={() => setSecModal(true)}>
                <Plus size={13} /> Nueva secuencia
              </Button>
            </div>
          )}

          <div className="grid gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : secuencias.length === 0 ? (
              <div className="bg-card border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
                  <AlertTriangle size={24} className="text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-base">No hay secuencias NCF configuradas</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Para emitir comprobantes fiscales desde el POS necesitas al menos una secuencia activa.
                    <br />El tipo más común para ventas al consumidor es <span className="font-mono font-bold">B02 — Consumo</span>.
                  </p>
                </div>
                {(esAdmin() || esSuperadmin()) && (
                  <Button
                    size="sm"
                    className="gap-2 mx-auto"
                    onClick={() => {
                      setSecForm({ tipo: "02", secuencia_desde: 1, secuencia_hasta: 1000, fecha_vencimiento: "" });
                      setSecModal(true);
                    }}
                  >
                    <Plus size={13} /> Crear secuencia B02 (Consumo)
                  </Button>
                )}
              </div>
            ) : (
              secuencias.map((s) => {
                const total = s.secuencia_hasta - s.secuencia_desde;
                const usado = s.secuencia_actual - s.secuencia_desde;
                const pct = total > 0 ? Math.min((usado / total) * 100, 100) : 0;
                const critica = s.proxima_a_agotar || pct >= 90;
                return (
                  <div key={s.id} className={cn("bg-card border rounded-xl p-4",
                    s.agotada || s.vencida ? "border-rose-200 dark:border-rose-900" : critica ? "border-amber-200 dark:border-amber-900" : "border-border")}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold">B{s.tipo}XXXXXXXX</span>
                          <Badge variant={s.agotada || s.vencida ? "danger" : s.activo ? "success" : "secondary"} className="text-2xs">
                            {s.agotada ? "Agotada" : s.vencida ? "Vencida" : s.activo ? "Activa" : "Inactiva"}
                          </Badge>
                          {s.proxima_a_agotar && !s.agotada && !s.vencida && (
                            <Badge variant="warning" className="text-2xs">⚠ Solo {s.disponibles} disponibles</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {TIPOS_NCF.find((t) => t.codigo === s.tipo)?.nombre ?? `Tipo ${s.tipo}`}
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Vence: {fmtFecha(s.fecha_vencimiento)}</p>
                          <p className="mt-0.5 tabular-nums">{s.secuencia_actual} / {s.secuencia_hasta}</p>
                          <p className="mt-0.5">{s.disponibles.toLocaleString("es-DO")} disponibles</p>
                        </div>
                        {(esAdmin() || esSuperadmin()) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setSecEditando(s);
                                setSecForm({ tipo: s.tipo, secuencia_desde: s.secuencia_desde, secuencia_hasta: s.secuencia_hasta, fecha_vencimiento: s.fecha_vencimiento });
                                setSecModal(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setSecBorrarModal(s)}
                              className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-muted-foreground hover:text-rose-600"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={cn("h-2", critica ? "[&>div]:bg-rose-500" : "[&>div]:bg-brand-500")}
                    />
                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{s.secuencia_desde.toString().padStart(8, "0")}</span>
                      <span>{pct.toFixed(0)}% usado</span>
                      <span>{s.secuencia_hasta.toString().padStart(8, "0")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── TIPOS NCF ── */}
        <TabsContent value="tipos" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {TIPOS_NCF.map((t) => (
              <div key={t.codigo} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand-600">B{t.codigo}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.descripcion}</p>
                  {TIPOS_REQUIEREN_RELACIONADO.has(t.codigo) && (
                    <Badge variant="secondary" className="text-2xs mt-1.5">Requiere NCF relacionado</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal anulación ── */}
      <Dialog open={!!anularModal} onOpenChange={(o) => { if (!o) { setAnularModal(null); setMotivo(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle size={16} /> Anular factura
            </DialogTitle>
          </DialogHeader>
          {anularModal && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground text-xs">NCF:</span> <span className="font-mono font-bold">{anularModal.ncf}</span></p>
                <p><span className="text-muted-foreground text-xs">Cliente:</span> {anularModal.cliente_nombre || "Consumidor Final"}</p>
                <p><span className="text-muted-foreground text-xs">Total:</span> <span className="font-bold">{formatCurrency(Number(anularModal.total))}</span></p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-lg p-3">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                  Esta acción no se puede deshacer. El NCF quedará registrado como anulado en el reporte 606.
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Motivo de anulación (opcional)</Label>
                <Input placeholder="Ej: Error en monto, cliente incorrecto..."
                  value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setAnularModal(null); setMotivo(""); }}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={confirmarAnulacion} disabled={anulando} className="gap-2">
              {anulando ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={13} />}
              Confirmar anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal registrar pago ── */}
      <Dialog open={!!pagoModal} onOpenChange={(o) => { if (!o) setPagoModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={16} className="text-emerald-500" /> Registrar pago
            </DialogTitle>
          </DialogHeader>
          {pagoModal && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Factura <span className="font-mono font-bold">{pagoModal.ncf}</span> — Saldo: <span className="text-amber-600 font-semibold">{formatCurrency(Number(pagoModal.saldo_pendiente))}</span>
              </p>
              <div>
                <Label className="text-xs mb-1.5 block">Método de pago</Label>
                <select value={pagoForm.metodo} onChange={(e) => setPagoForm((p) => ({ ...p, metodo: e.target.value }))}
                  className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                  {["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE", "CREDITO"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Monto (RD$)</Label>
                <Input type="number" min="0.01" step="0.01"
                  value={pagoForm.monto} onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                  className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Referencia (opcional)</Label>
                <Input placeholder="# cheque, transferencia..."
                  value={pagoForm.referencia} onChange={(e) => setPagoForm((p) => ({ ...p, referencia: e.target.value }))}
                  className="h-8 text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPagoModal(null)}>Cancelar</Button>
            <Button size="sm" onClick={registrarPago} disabled={guardandoPago} className="gap-2">
              {guardandoPago ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal nueva/editar secuencia ── */}
      <Dialog open={secModal} onOpenChange={(o) => { if (!o) { setSecModal(false); setSecEditando(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={16} className="text-brand-500" />
              {secEditando ? `Editar secuencia B${secEditando.tipo}` : "Nueva secuencia NCF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Tipo de NCF</Label>
              <select value={secForm.tipo} onChange={(e) => setSecForm((f) => ({ ...f, tipo: e.target.value }))}
                className="w-full h-8 text-sm border border-border rounded-md bg-background px-2"
                disabled={!!secEditando}>
                {TIPOS_NCF.map((t) => <option key={t.codigo} value={t.codigo}>B{t.codigo} — {t.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Desde</Label>
                <Input type="number" min="1" value={secForm.secuencia_desde}
                  onChange={(e) => setSecForm((f) => ({ ...f, secuencia_desde: Number(e.target.value) }))}
                  className="h-8 text-sm" disabled={!!secEditando} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Hasta</Label>
                <Input type="number" min="1" value={secForm.secuencia_hasta}
                  onChange={(e) => setSecForm((f) => ({ ...f, secuencia_hasta: Number(e.target.value) }))}
                  className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Fecha de vencimiento</Label>
              <DatePicker value={secForm.fecha_vencimiento}
                onChange={(v) => setSecForm((f) => ({ ...f, fecha_vencimiento: v }))}
                className="h-8 text-sm w-full" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Vista previa:</p>
              <p className="font-mono text-foreground">
                B{secForm.tipo}{secForm.secuencia_desde.toString().padStart(8, "0")} → B{secForm.tipo}{secForm.secuencia_hasta.toString().padStart(8, "0")}
              </p>
              <p className="mt-1">Disponibles: {(secForm.secuencia_hasta - secForm.secuencia_desde + 1).toLocaleString("es-DO")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setSecModal(false); setSecEditando(null); }}>Cancelar</Button>
            <Button size="sm" onClick={guardarSecuencia} disabled={guardandoSec} className="gap-2">
              {guardandoSec ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              {secEditando ? "Guardar cambios" : "Crear secuencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal confirmar borrado secuencia ── */}
      <Dialog open={!!secBorrarModal} onOpenChange={(o) => { if (!o) setSecBorrarModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 size={16} /> Eliminar secuencia
            </DialogTitle>
          </DialogHeader>
          {secBorrarModal && (
            <div className="space-y-3">
              <p className="text-sm">
                ¿Estás seguro que deseas eliminar la secuencia <span className="font-mono font-bold">B{secBorrarModal.tipo}</span>?
              </p>
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Tipo:</span> {TIPOS_NCF.find((t) => t.codigo === secBorrarModal.tipo)?.nombre}</p>
                <p><span className="text-muted-foreground">Rango:</span> {secBorrarModal.secuencia_desde} – {secBorrarModal.secuencia_hasta}</p>
                <p><span className="text-muted-foreground">Vencimiento:</span> {fmtFecha(secBorrarModal.fecha_vencimiento)}</p>
              </div>
              {secBorrarModal.secuencia_actual > secBorrarModal.secuencia_desde && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Esta secuencia ya tiene NCF emitidos. Las facturas existentes no se afectarán, pero no podrás recuperar la secuencia.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSecBorrarModal(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={borrarSecuencia} disabled={borrando} className="gap-2">
              {borrando ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal nueva factura ── */}
      <Dialog open={nuevaModal} onOpenChange={(o) => { if (!o) setNuevaModal(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={16} className="text-brand-500" /> Nueva factura fiscal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Tipo NCF */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Tipo de comprobante</Label>
                <select value={facForm.tipo} onChange={(e) => setFacForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                  {TIPOS_NCF.map((t) => <option key={t.codigo} value={t.codigo}>B{t.codigo} — {t.nombre}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">{TIPOS_NCF.find((t) => t.codigo === facForm.tipo)?.descripcion}</p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Forma de pago</Label>
                <select value={facForm.forma_pago} onChange={(e) => setFacForm((f) => ({ ...f, forma_pago: e.target.value }))}
                  className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                  {["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE", "CREDITO", "MIXTO"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs mb-1.5 block">Nombre / Razón social</Label>
                  <Input value={facForm.cliente_nombre} onChange={(e) => setFacForm((f) => ({ ...f, cliente_nombre: e.target.value }))}
                    className="h-8 text-sm" placeholder="Consumidor Final" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">
                    RNC / Cédula {facForm.tipo === "01" && <span className="text-rose-500">*</span>}
                  </Label>
                  <Input value={facForm.cliente_rnc} onChange={(e) => setFacForm((f) => ({ ...f, cliente_rnc: e.target.value }))}
                    className="h-8 text-sm" placeholder="000-00000-0" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Dirección (opcional)</Label>
                  <Input value={facForm.cliente_direccion} onChange={(e) => setFacForm((f) => ({ ...f, cliente_direccion: e.target.value }))}
                    className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* NCF relacionado (B03/B04) */}
            {TIPOS_REQUIEREN_RELACIONADO.has(facForm.tipo) && (
              <div className="border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 space-y-3 bg-amber-50 dark:bg-amber-950/20">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">NCF relacionado obligatorio</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">ID de la factura original</Label>
                    <Input type="number" value={facForm.ncf_relacionado}
                      onChange={(e) => setFacForm((f) => ({ ...f, ncf_relacionado: e.target.value }))}
                      className="h-8 text-sm" placeholder="ID de la factura" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Motivo</Label>
                    <Input value={facForm.motivo_nota}
                      onChange={(e) => setFacForm((f) => ({ ...f, motivo_nota: e.target.value }))}
                      className="h-8 text-sm" placeholder="Razón de la nota" />
                  </div>
                </div>
              </div>
            )}

            {/* Campos específicos por tipo */}
            {facForm.tipo === "11" && (
              <div>
                <Label className="text-xs mb-1.5 block">Nombre del proveedor <span className="text-rose-500">*</span></Label>
                <Input value={facForm.datos_especificos.proveedor_nombre ?? ""}
                  onChange={(e) => setFacForm((f) => ({ ...f, datos_especificos: { ...f.datos_especificos, proveedor_nombre: e.target.value } }))}
                  className="h-8 text-sm" placeholder="Nombre del proveedor informal" />
              </div>
            )}
            {facForm.tipo === "13" && (
              <div>
                <Label className="text-xs mb-1.5 block">Concepto del gasto <span className="text-rose-500">*</span></Label>
                <Input value={facForm.datos_especificos.concepto ?? ""}
                  onChange={(e) => setFacForm((f) => ({ ...f, datos_especificos: { ...f.datos_especificos, concepto: e.target.value } }))}
                  className="h-8 text-sm" placeholder="Ej: Papelería, transporte..." />
              </div>
            )}
            {facForm.tipo === "15" && (
              <div>
                <Label className="text-xs mb-1.5 block">Nombre de la institución <span className="text-rose-500">*</span></Label>
                <Input value={facForm.datos_especificos.institucion_nombre ?? ""}
                  onChange={(e) => setFacForm((f) => ({ ...f, datos_especificos: { ...f.datos_especificos, institucion_nombre: e.target.value } }))}
                  className="h-8 text-sm" placeholder="Nombre de la entidad gubernamental" />
              </div>
            )}

            {/* Ítems */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Ítems / Servicios</p>
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
                  onClick={() => setDetalles((d) => [...d, { ...DETALLE_EMPTY }])}>
                  <Plus size={11} /> Agregar línea
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-2 pr-2 min-w-40">Descripción</th>
                      <th className="text-right pb-2 pr-2 w-16">Cant</th>
                      <th className="text-right pb-2 pr-2 w-24">Precio</th>
                      <th className="text-right pb-2 pr-2 w-20">Desc</th>
                      <th className="text-right pb-2 pr-2 w-20">ITBIS %</th>
                      <th className="text-right pb-2 w-24">Total</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detalles.map((d, i) => {
                      const qty = Number(d.cantidad) || 0;
                      const precio = Number(d.precio_unitario) || 0;
                      const desc = Number(d.descuento) || 0;
                      const tasa = Number(d.tasa_itbis) || 0;
                      const sub = qty * precio - desc;
                      const lineTotal = sub + sub * (tasa / 100);
                      return (
                        <tr key={i}>
                          <td className="py-1.5 pr-2">
                            <Input value={d.descripcion}
                              onChange={(e) => setDetalles((ds) => ds.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                              className="h-7 text-xs" placeholder="Descripción" />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input type="number" min="0" step="0.01" value={d.cantidad}
                              onChange={(e) => setDetalles((ds) => ds.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
                              className="h-7 text-xs text-right" />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input type="number" min="0" step="0.01" value={d.precio_unitario}
                              onChange={(e) => setDetalles((ds) => ds.map((x, j) => j === i ? { ...x, precio_unitario: e.target.value } : x))}
                              className="h-7 text-xs text-right" />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input type="number" min="0" step="0.01" value={d.descuento}
                              onChange={(e) => setDetalles((ds) => ds.map((x, j) => j === i ? { ...x, descuento: e.target.value } : x))}
                              className="h-7 text-xs text-right" />
                          </td>
                          <td className="py-1.5 pr-2">
                            <select value={d.tasa_itbis}
                              onChange={(e) => setDetalles((ds) => ds.map((x, j) => j === i ? { ...x, tasa_itbis: e.target.value } : x))}
                              className="h-7 w-full text-xs border border-border rounded-md bg-background px-1">
                              <option value="0">0%</option>
                              <option value="16">16%</option>
                              <option value="18">18%</option>
                            </select>
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="py-1.5 pl-1">
                            {detalles.length > 1 && (
                              <button onClick={() => setDetalles((ds) => ds.filter((_, j) => j !== i))}
                                className="text-muted-foreground hover:text-rose-500 transition-colors">
                                <XCircle size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="flex justify-end pt-2 border-t border-border">
                <div className="space-y-1 text-xs min-w-44">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(totales.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-purple-600">
                    <span>ITBIS</span>
                    <span className="tabular-nums">{formatCurrency(totales.itbis)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-bold text-sm border-t border-border pt-1">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(totales.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNuevaModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearFactura} disabled={creandoFac} className="gap-2">
              {creandoFac ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Emitir factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
