"use client";
import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Search, RefreshCw, Check, AlertTriangle,
  ChevronDown, ChevronUp, Download, Shield,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Progress } from "@/components/ui/progress";

// Tipos de comprobante fiscal DGII República Dominicana
const TIPOS_NCF = [
  { codigo: "01", nombre: "Facturas de Crédito Fiscal", descripcion: "Para ventas a empresas que deducen ITBIS" },
  { codigo: "02", nombre: "Facturas de Consumo", descripcion: "Para ventas a consumidor final" },
  { codigo: "03", nombre: "Notas de Débito", descripcion: "Correcciones que aumentan el monto" },
  { codigo: "04", nombre: "Notas de Crédito", descripcion: "Correcciones que reducen el monto" },
  { codigo: "11", nombre: "Proveedores Informales", descripcion: "Para gastos sin comprobante del proveedor" },
  { codigo: "13", nombre: "Gastos Menores", descripcion: "Gastos menores sin necesidad de comprobante" },
  { codigo: "14", nombre: "Régimen Especial de Tributación", descripcion: "Para empresas en régimen especial" },
  { codigo: "15", nombre: "Gubernamental", descripcion: "Para entidades del gobierno" },
];

interface SecuenciaNCF {
  id: number; tipo: string; tipo_nombre: string;
  secuencia_desde: number; secuencia_hasta: number;
  secuencia_actual: number; activo: boolean;
  fecha_vencimiento: string; agotada: boolean;
}

interface Factura {
  id: number; ncf: string; tipo: string; fecha: string;
  cliente_nombre: string; cliente_rnc: string;
  subtotal: string; itbis: string; total: string;
  estado: "VALIDA" | "ANULADA"; venta: number | null;
}

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

export default function FacturacionPage() {
  const [tab, setTab] = useState("facturas");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [secuencias, setSecuencias] = useState<SecuenciaNCF[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal nueva secuencia
  const [secModal, setSecModal] = useState(false);
  const [secForm, setSecForm] = useState({
    tipo: "01", secuencia_desde: 1, secuencia_hasta: 1000, fecha_vencimiento: "",
  });
  const [guardandoSec, setGuardandoSec] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      const [facRes, secRes] = await Promise.all([
        api.get(`/facturacion/facturas/?${params}`),
        api.get("/facturacion/secuencias/"),
      ]);
      setFacturas(facRes.data.results ?? facRes.data);
      setSecuencias(secRes.data.results ?? secRes.data);
    } catch {
      setFacturas([]); setSecuencias([]);
    }
    setLoading(false);
  }, [busqueda, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarSecuencia() {
    if (!secForm.fecha_vencimiento) { toast.error("La fecha de vencimiento es requerida"); return; }
    if (secForm.secuencia_desde >= secForm.secuencia_hasta) { toast.error("La secuencia hasta debe ser mayor que desde"); return; }
    setGuardandoSec(true);
    try {
      await api.post("/facturacion/secuencias/", {
        tipo: secForm.tipo,
        secuencia_desde: secForm.secuencia_desde,
        secuencia_hasta: secForm.secuencia_hasta,
        fecha_vencimiento: secForm.fecha_vencimiento,
      });
      toast.success("Secuencia NCF creada");
      setSecModal(false);
      cargar();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Error al crear secuencia");
    }
    setGuardandoSec(false);
  }

  function exportarCSV() {
    const headers = ["NCF", "Tipo", "Fecha", "Cliente", "RNC", "Subtotal", "ITBIS", "Total", "Estado"];
    const rows = facturas.map((f) => [
      f.ncf, f.tipo, fmtFecha(f.fecha), f.cliente_nombre, f.cliente_rnc,
      Number(f.subtotal).toFixed(2), Number(f.itbis).toFixed(2), Number(f.total).toFixed(2), f.estado,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "facturas-ncf.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    total: facturas.filter((f) => f.estado === "VALIDA").length,
    itbis: facturas.filter((f) => f.estado === "VALIDA").reduce((a, f) => a + Number(f.itbis), 0),
    ventas: facturas.filter((f) => f.estado === "VALIDA").reduce((a, f) => a + Number(f.total), 0),
    agotadas: secuencias.filter((s) => s.agotada || (s.fecha_vencimiento && new Date(s.fecha_vencimiento) < new Date())).length,
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Facturación Fiscal"
        description="Gestión de Números de Comprobante Fiscal (NCF) — DGII"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportarCSV}>
              <Download size={13} /> Exportar 606
            </Button>
          </div>
        }
      />

      {/* Alerta secuencias agotadas */}
      {stats.agotadas > 0 && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {stats.agotadas} secuencia(s) NCF agotada(s) o vencida(s)
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Ve a la pestaña "Secuencias NCF" y crea nuevas secuencias para continuar facturando.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Facturas válidas", value: stats.total, icon: FileText, color: "text-brand-500" },
          { label: "Total facturado", value: formatCurrency(stats.ventas), icon: FileText, color: "text-emerald-500" },
          { label: "ITBIS recolectado", value: formatCurrency(stats.itbis), icon: Shield, color: "text-purple-500" },
          { label: "Seq. activas", value: secuencias.filter((s) => s.activo).length, icon: FileText, color: "text-sky-500" },
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="facturas" className="text-xs h-6">Facturas NCF</TabsTrigger>
          <TabsTrigger value="secuencias" className="text-xs h-6">Secuencias NCF</TabsTrigger>
          <TabsTrigger value="tipos" className="text-xs h-6">Tipos de NCF</TabsTrigger>
        </TabsList>

        {/* Facturas */}
        <TabsContent value="facturas" className="mt-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar NCF o cliente…" className="pl-8 h-8 text-sm"
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
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
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {["NCF", "Tipo", "Fecha", "Cliente / RNC", "ITBIS", "Total", "Estado"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {facturas.map((f) => (
                      <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{f.ncf}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">B{f.tipo}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(f.fecha)}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium truncate max-w-36">{f.cliente_nombre || "Consumidor Final"}</p>
                          {f.cliente_rnc && <p className="text-[10px] text-muted-foreground font-mono">{f.cliente_rnc}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-purple-600 font-medium">{formatCurrency(Number(f.itbis))}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-sm">{formatCurrency(Number(f.total))}</td>
                        <td className="px-4 py-3">
                          <Badge variant={f.estado === "VALIDA" ? "success" : "danger"} className="text-[10px]">{f.estado}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Secuencias */}
        <TabsContent value="secuencias" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2 h-8" onClick={() => setSecModal(true)}>
              <Plus size={13} /> Nueva secuencia
            </Button>
          </div>

          <div className="grid gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : secuencias.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8">
                <EmptyState icon={FileText} title="Sin secuencias NCF" description="Agrega una secuencia NCF para comenzar a facturar." />
              </div>
            ) : (
              secuencias.map((s) => {
                const pct = s.secuencia_hasta > s.secuencia_desde
                  ? ((s.secuencia_actual - s.secuencia_desde) / (s.secuencia_hasta - s.secuencia_desde)) * 100
                  : 0;
                const vencida = s.fecha_vencimiento && new Date(s.fecha_vencimiento) < new Date();
                const critica = pct >= 90;
                return (
                  <div key={s.id} className={cn("bg-card border rounded-xl p-4",
                    s.agotada || vencida ? "border-rose-200 dark:border-rose-900" : critica ? "border-amber-200 dark:border-amber-900" : "border-border")}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold">B{s.tipo}XXXXXXXX</span>
                          <Badge variant={s.agotada || vencida ? "danger" : s.activo ? "success" : "secondary"} className="text-[10px]">
                            {s.agotada ? "Agotada" : vencida ? "Vencida" : s.activo ? "Activa" : "Inactiva"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {TIPOS_NCF.find((t) => t.codigo === s.tipo)?.nombre ?? `Tipo ${s.tipo}`}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Vence: {fmtFecha(s.fecha_vencimiento)}</p>
                        <p className="mt-0.5 tabular-nums">{s.secuencia_actual} / {s.secuencia_hasta}</p>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={cn("h-2", critica ? "[&>div]:bg-rose-500" : "[&>div]:bg-brand-500")}
                    />
                    <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
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

        {/* Tipos de NCF */}
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
                  <Badge variant="secondary" className="text-[10px] mt-1.5">Tipo {t.codigo}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal nueva secuencia */}
      <Dialog open={secModal} onOpenChange={setSecModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={16} className="text-brand-500" /> Nueva secuencia NCF
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Tipo de NCF</Label>
              <select value={secForm.tipo} onChange={(e) => setSecForm((f) => ({ ...f, tipo: e.target.value }))}
                className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                {TIPOS_NCF.map((t) => <option key={t.codigo} value={t.codigo}>B{t.codigo} — {t.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Desde (número)</Label>
                <Input type="number" min="1" value={secForm.secuencia_desde}
                  onChange={(e) => setSecForm((f) => ({ ...f, secuencia_desde: Number(e.target.value) }))}
                  className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Hasta (número)</Label>
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
              <p className="font-medium mb-1">Vista previa del NCF:</p>
              <p className="font-mono text-foreground">
                B{secForm.tipo}{secForm.secuencia_desde.toString().padStart(8, "0")} →  B{secForm.tipo}{secForm.secuencia_hasta.toString().padStart(8, "0")}
              </p>
              <p className="mt-1">Total disponibles: {(secForm.secuencia_hasta - secForm.secuencia_desde + 1).toLocaleString("es-DO")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSecModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardarSecuencia} disabled={guardandoSec} className="gap-2">
              {guardandoSec ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Crear secuencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
