"use client";
import { useEffect, useState } from "react";
import {
  BadgeDollarSign, RefreshCw, Search, X, ChevronDown,
  Plus, Building2, AlertTriangle, SlidersHorizontal,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Suscripcion {
  id: number;
  colmado: number;
  colmado_nombre: string;
  plan: number | null;
  plan_nombre: string | null;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: "ACTIVA" | "PENDIENTE" | "VENCIDA" | "SUSPENDIDA" | "CANCELADA";
  precio_pagado: string;
  precio_mensual: string;
  max_productos: number;
  max_usuarios: number;
  esta_activa: boolean;
  dias_restantes: number;
  nota: string;
  pagos: Pago[];
}

interface Plan {
  id: number;
  nombre: string;
  precio_mensual: string;
  max_usuarios: number;
  max_productos: number;
  activo: boolean;
}

interface Colmado {
  id: number;
  nombre: string;
  activo: boolean;
}

interface Pago {
  id: number;
  monto: string;
  fecha: string;
  metodo: string;
  referencia: string;
}

const ESTADO_COLORS: Record<string, string> = {
  ACTIVA:     "bg-green-100 text-green-700",
  PENDIENTE:  "bg-yellow-100 text-yellow-700",
  VENCIDA:    "bg-red-100 text-red-600",
  SUSPENDIDA: "bg-orange-100 text-orange-700",
  CANCELADA:  "bg-slate-100 text-slate-500",
};

const METODOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"];
const ESTADOS = ["ACTIVA", "PENDIENTE", "VENCIDA", "SUSPENDIDA", "CANCELADA"];

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500";

export default function SuscripcionesPage() {
  const { esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();

  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [colmados, setColmados] = useState<Colmado[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [verSinPlan, setVerSinPlan] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal renovar
  const [modalRenovar, setModalRenovar] = useState<Suscripcion | null>(null);
  const [renovarForm, setRenovarForm] = useState({ dias: 30, monto: "", metodo: "EFECTIVO", referencia: "", nota: "" });

  // Modal cambiar estado
  const [modalEstado, setModalEstado] = useState<Suscripcion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

  // Modal ajustar capacidad
  const [modalCapacidad, setModalCapacidad] = useState<Suscripcion | null>(null);
  const [capacidadForm, setCapacidadForm] = useState({
    max_productos: "",
    max_usuarios: "",
    precio_mensual: "",
    pago_monto: "",
    pago_metodo: "EFECTIVO",
    pago_referencia: "",
    nota: "",
  });

  // Modal nueva suscripción
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState({
    colmado: "",
    plan: "",
    fecha_inicio: hoy(),
    dias: 30,
    precio_pagado: "",
    precio_mensual: "",
    max_productos: "300",
    max_usuarios: "2",
    metodo: "EFECTIVO",
    referencia: "",
    nota: "",
  });
  const [creando, setCreando] = useState(false);
  const [errorNueva, setErrorNueva] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!esSuperadmin()) { router.replace("/dashboard"); return; }
    cargar();
  }, [hydrated]);

  if (!hydrated || !esSuperadmin()) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Verificando permisos...</div>;
  }

  async function cargar() {
    setLoading(true);
    try {
      const [rSus, rPlanes, rColmados] = await Promise.all([
        api.get("/suscripciones/"),
        api.get("/suscripciones/planes/"),
        api.get("/usuarios/colmados/"),
      ]);
      setSuscripciones(Array.isArray(rSus.data) ? rSus.data : rSus.data.results ?? []);
      setPlanes(Array.isArray(rPlanes.data) ? rPlanes.data : rPlanes.data.results ?? []);
      setColmados(Array.isArray(rColmados.data) ? rColmados.data : rColmados.data.results ?? []);
    } catch {
      // backend no disponible
    } finally {
      setLoading(false);
    }
  }

  async function renovar() {
    if (!modalRenovar) return;
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/suscripciones/${modalRenovar.id}/renovar/`, {
        dias: renovarForm.dias,
        monto: parseFloat(renovarForm.monto) || parseFloat(modalRenovar.precio_pagado),
        metodo: renovarForm.metodo,
        referencia: renovarForm.referencia,
        nota: renovarForm.nota,
      });
      toast.success(`Suscripción de ${modalRenovar.colmado_nombre} renovada`);
      setModalRenovar(null);
      cargar();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      setError(d ? JSON.stringify(d) : "Error al renovar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado() {
    if (!modalEstado || !nuevoEstado) return;
    setGuardando(true);
    try {
      await api.patch(`/suscripciones/${modalEstado.id}/cambiar-estado/`, { estado: nuevoEstado });
      toast.success("Estado actualizado");
      setModalEstado(null);
      cargar();
    } catch {
      toast.error("Error al cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  async function ajustarCapacidad() {
    if (!modalCapacidad) return;
    setGuardando(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (capacidadForm.max_productos) payload.max_productos = parseInt(capacidadForm.max_productos);
      if (capacidadForm.max_usuarios)  payload.max_usuarios  = parseInt(capacidadForm.max_usuarios);
      if (capacidadForm.precio_mensual) payload.precio_mensual = capacidadForm.precio_mensual;
      if (capacidadForm.pago_monto && parseFloat(capacidadForm.pago_monto) > 0) {
        payload.pago_monto      = capacidadForm.pago_monto;
        payload.pago_metodo     = capacidadForm.pago_metodo;
        payload.pago_referencia = capacidadForm.pago_referencia;
      }
      if (capacidadForm.nota) payload.nota = capacidadForm.nota;

      await api.post(`/suscripciones/${modalCapacidad.id}/ajustar-capacidad/`, payload);
      toast.success(`Capacidad de ${modalCapacidad.colmado_nombre} actualizada`);
      setModalCapacidad(null);
      cargar();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = (d as Record<string, unknown>)?.error as string ?? JSON.stringify(d) ?? "Error al ajustar capacidad";
      setError(msg);
    } finally {
      setGuardando(false);
    }
  }

  async function crearSuscripcion() {
    if (!nuevaForm.colmado) {
      setErrorNueva("Selecciona un colmado.");
      return;
    }
    setCreando(true);
    setErrorNueva(null);
    try {
      const fechaVenc = sumarDias(nuevaForm.fecha_inicio, nuevaForm.dias);
      const body: Record<string, unknown> = {
        colmado:           Number(nuevaForm.colmado),
        fecha_inicio:      nuevaForm.fecha_inicio,
        fecha_vencimiento: fechaVenc,
        precio_pagado:     nuevaForm.precio_pagado || "0",
        precio_mensual:    nuevaForm.precio_mensual || nuevaForm.precio_pagado || "0",
        max_productos:     parseInt(nuevaForm.max_productos) || 300,
        max_usuarios:      parseInt(nuevaForm.max_usuarios) || 2,
        nota:              nuevaForm.nota,
      };
      if (nuevaForm.plan) body.plan = Number(nuevaForm.plan);

      const { data } = await api.post("/suscripciones/", body);

      if (nuevaForm.precio_pagado && parseFloat(nuevaForm.precio_pagado) > 0) {
        await api.post("/suscripciones/pagos/", {
          suscripcion: data.id,
          monto:       nuevaForm.precio_pagado,
          metodo:      nuevaForm.metodo,
          referencia:  nuevaForm.referencia,
          nota:        nuevaForm.nota,
          fecha:       nuevaForm.fecha_inicio,
        });
      }
      toast.success("Suscripción creada correctamente");
      setModalNueva(false);
      resetNuevaForm();
      cargar();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      const dd = d as Record<string, string[]> | null;
      const msg = typeof d === "string" ? d
        : dd?.colmado?.[0]
        ?? dd?.non_field_errors?.[0]
        ?? JSON.stringify(d)
        ?? "Error al crear la suscripción";
      setErrorNueva(msg);
    } finally {
      setCreando(false);
    }
  }

  function resetNuevaForm() {
    setNuevaForm({ colmado: "", plan: "", fecha_inicio: hoy(), dias: 30, precio_pagado: "", precio_mensual: "", max_productos: "300", max_usuarios: "2", metodo: "EFECTIVO", referencia: "", nota: "" });
  }

  function abrirNueva(colmadoId?: string) {
    resetNuevaForm();
    if (colmadoId) setNuevaForm(p => ({ ...p, colmado: colmadoId }));
    setErrorNueva(null);
    setModalNueva(true);
  }

  function abrirCapacidad(s: Suscripcion) {
    setCapacidadForm({
      max_productos:  String(s.max_productos),
      max_usuarios:   String(s.max_usuarios),
      precio_mensual: s.precio_mensual,
      pago_monto:     "",
      pago_metodo:    "EFECTIVO",
      pago_referencia: "",
      nota:           "",
    });
    setError(null);
    setModalCapacidad(s);
  }

  const colmadosConSus = new Set(suscripciones.map(s => s.colmado));
  const colmadosSinPlan = colmados.filter(c => c.activo && !colmadosConSus.has(c.id));
  const planSeleccionado = planes.find(p => String(p.id) === nuevaForm.plan);

  const filtradas = suscripciones.filter(s => {
    const matchBuscar = s.colmado_nombre.toLowerCase().includes(buscar.toLowerCase()) ||
      (s.plan_nombre ?? "").toLowerCase().includes(buscar.toLowerCase());
    const matchEstado = !filtroEstado || s.estado === filtroEstado;
    return matchBuscar && matchEstado;
  });

  const stats = {
    total:    suscripciones.length,
    activas:  suscripciones.filter(s => s.estado === "ACTIVA").length,
    vencidas: suscripciones.filter(s => s.estado === "VENCIDA").length,
    porVencer: suscripciones.filter(s => s.estado === "ACTIVA" && s.dias_restantes <= 7).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BadgeDollarSign size={24} className="text-brand-600" />
            Suscripciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de suscripciones y capacidades de los colmados</p>
        </div>
        <button
          onClick={() => abrirNueva()}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Nueva Suscripción
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",           value: stats.total,    color: "text-slate-700" },
          { label: "Activas",         value: stats.activas,  color: "text-green-600" },
          { label: "Vencidas",        value: stats.vencidas, color: "text-red-500" },
          { label: "Por vencer (≤7d)", value: stats.porVencer, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-border p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Colmados sin suscripción */}
      {colmadosSinPlan.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setVerSinPlan(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {colmadosSinPlan.length} colmado{colmadosSinPlan.length > 1 ? "s" : ""} sin suscripción asignada
              </span>
            </div>
            <ChevronDown size={14} className={`text-amber-600 transition-transform ${verSinPlan ? "rotate-180" : ""}`} />
          </button>
          {verSinPlan && (
            <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900/50">
              {colmadosSinPlan.map(c => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-amber-600" />
                    <span className="text-sm text-amber-900 dark:text-amber-200 font-medium">{c.nombre}</span>
                  </div>
                  <button
                    onClick={() => abrirNueva(String(c.id))}
                    className="text-xs px-3 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    Asignar suscripción
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar colmado..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {["Colmado", "Productos", "Usuarios", "Mensualidad", "Vencimiento", "Días", "Estado", "Acciones"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
            ) : filtradas.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 dark:text-white">{s.colmado_nombre}</p>
                  {s.plan_nombre && <p className="text-xs text-muted-foreground">{s.plan_nombre}</p>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {s.max_productos.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {s.max_usuarios}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  RD${parseFloat(s.precio_mensual || "0").toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.fecha_vencimiento}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${s.dias_restantes <= 7 ? "text-red-500" : s.dias_restantes <= 15 ? "text-orange-500" : "text-slate-700 dark:text-slate-300"}`}>
                    {s.dias_restantes}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado] ?? ""}`}>
                    {s.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => { setModalRenovar(s); setRenovarForm({ dias: 30, monto: s.precio_mensual || s.precio_pagado, metodo: "EFECTIVO", referencia: "", nota: "" }); setError(null); }}
                      className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors whitespace-nowrap"
                    >
                      Renovar
                    </button>
                    <button
                      onClick={() => abrirCapacidad(s)}
                      className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <SlidersHorizontal size={10} /> Capacidad
                    </button>
                    <button
                      onClick={() => { setModalEstado(s); setNuevoEstado(s.estado); }}
                      className="px-2 py-1 text-xs border border-border rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                    >
                      Estado <ChevronDown size={10} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal Nueva Suscripción ── */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white dark:bg-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={16} className="text-brand-500" /> Nueva Suscripción
              </h2>
              <button onClick={() => setModalNueva(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Colmado *">
                <select
                  value={nuevaForm.colmado}
                  onChange={e => setNuevaForm(p => ({ ...p, colmado: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Seleccionar colmado...</option>
                  {colmados.filter(c => c.activo).map(c => {
                    const yaTiene = colmadosConSus.has(c.id);
                    return (
                      <option key={c.id} value={c.id} disabled={yaTiene}>
                        {c.nombre}{yaTiene ? " (ya tiene suscripción)" : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field label="Plantilla base (opcional)">
                <select
                  value={nuevaForm.plan}
                  onChange={e => {
                    const plan = planes.find(p => String(p.id) === e.target.value);
                    setNuevaForm(p => ({
                      ...p,
                      plan:          e.target.value,
                      precio_pagado:  plan ? plan.precio_mensual : p.precio_pagado,
                      precio_mensual: plan ? plan.precio_mensual : p.precio_mensual,
                      max_productos:  plan ? String(plan.max_productos) : p.max_productos,
                      max_usuarios:   plan ? String(plan.max_usuarios)  : p.max_usuarios,
                    }));
                  }}
                  className={inputCls}
                >
                  <option value="">Sin plantilla — definir límites manualmente</option>
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — RD${parseFloat(p.precio_mensual).toLocaleString()}/mes
                      {!p.activo ? " (Inactivo)" : ""}
                    </option>
                  ))}
                </select>
                {planSeleccionado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pre-llenado con los límites de <span className="font-medium">{planSeleccionado.nombre}</span>. Puedes ajustarlos abajo.
                  </p>
                )}
              </Field>

              <hr className="border-border" />

              {/* Límites personalizados */}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Límites del colmado</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Máx. productos *">
                  <input
                    type="number" min="1" value={nuevaForm.max_productos}
                    onChange={e => setNuevaForm(p => ({ ...p, max_productos: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Máx. usuarios *">
                  <input
                    type="number" min="1" value={nuevaForm.max_usuarios}
                    onChange={e => setNuevaForm(p => ({ ...p, max_usuarios: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <hr className="border-border" />

              {/* Fechas */}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Período</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha inicio">
                  <input
                    type="date" value={nuevaForm.fecha_inicio}
                    onChange={e => setNuevaForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Duración">
                  <select
                    value={nuevaForm.dias}
                    onChange={e => setNuevaForm(p => ({ ...p, dias: parseInt(e.target.value) }))}
                    className={inputCls}
                  >
                    {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} días</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vence: {sumarDias(nuevaForm.fecha_inicio || hoy(), nuevaForm.dias)}
                  </p>
                </Field>
              </div>

              <hr className="border-border" />

              {/* Pago */}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cobro</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mensualidad acordada (RD$)">
                  <input
                    type="number" min="0" value={nuevaForm.precio_mensual}
                    onChange={e => setNuevaForm(p => ({ ...p, precio_mensual: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="Pago inicial (RD$)">
                  <input
                    type="number" min="0" value={nuevaForm.precio_pagado}
                    onChange={e => setNuevaForm(p => ({ ...p, precio_pagado: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Método de pago">
                  <select
                    value={nuevaForm.metodo}
                    onChange={e => setNuevaForm(p => ({ ...p, metodo: e.target.value }))}
                    className={inputCls}
                  >
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Referencia / comprobante">
                  <input
                    value={nuevaForm.referencia}
                    onChange={e => setNuevaForm(p => ({ ...p, referencia: e.target.value }))}
                    placeholder="Ej: TRF-001"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Nota (opcional)">
                <input
                  value={nuevaForm.nota}
                  onChange={e => setNuevaForm(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Observaciones..."
                  className={inputCls}
                />
              </Field>
              {errorNueva && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{errorNueva}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-white dark:bg-slate-800">
              <button onClick={() => setModalNueva(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={crearSuscripcion}
                disabled={creando || !nuevaForm.colmado}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {creando ? <><RefreshCw size={14} className="animate-spin" /> Creando...</> : "Crear Suscripción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ajustar Capacidad ── */}
      {modalCapacidad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-emerald-500" />
                Ajustar Capacidad
              </h2>
              <button onClick={() => setModalCapacidad(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{modalCapacidad.colmado_nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actual: {modalCapacidad.max_productos.toLocaleString()} productos · {modalCapacidad.max_usuarios} usuarios · RD${parseFloat(modalCapacidad.precio_mensual || "0").toLocaleString()}/mes
                </p>
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nuevos límites</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Máx. productos">
                  <input
                    type="number" min="1" value={capacidadForm.max_productos}
                    onChange={e => setCapacidadForm(p => ({ ...p, max_productos: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Máx. usuarios">
                  <input
                    type="number" min="1" value={capacidadForm.max_usuarios}
                    onChange={e => setCapacidadForm(p => ({ ...p, max_usuarios: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Nueva mensualidad (RD$)">
                <input
                  type="number" min="0" value={capacidadForm.precio_mensual}
                  onChange={e => setCapacidadForm(p => ({ ...p, precio_mensual: e.target.value }))}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>

              <hr className="border-border" />

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pago por esta compra (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monto (RD$)">
                  <input
                    type="number" min="0" value={capacidadForm.pago_monto}
                    onChange={e => setCapacidadForm(p => ({ ...p, pago_monto: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="Método">
                  <select
                    value={capacidadForm.pago_metodo}
                    onChange={e => setCapacidadForm(p => ({ ...p, pago_metodo: e.target.value }))}
                    className={inputCls}
                  >
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Referencia">
                <input
                  value={capacidadForm.pago_referencia}
                  onChange={e => setCapacidadForm(p => ({ ...p, pago_referencia: e.target.value }))}
                  placeholder="Ej: TRF-2026-08-10"
                  className={inputCls}
                />
              </Field>
              <Field label="Nota (opcional)">
                <input
                  value={capacidadForm.nota}
                  onChange={e => setCapacidadForm(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Ej: Compra de 200 productos extra"
                  className={inputCls}
                />
              </Field>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModalCapacidad(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={ajustarCapacidad} disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : "Confirmar Ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Renovar ── */}
      {modalRenovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Renovar — {modalRenovar.colmado_nombre}
              </h2>
              <button onClick={() => setModalRenovar(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Días a extender">
                <select
                  value={renovarForm.dias}
                  onChange={e => setRenovarForm(p => ({ ...p, dias: parseInt(e.target.value) }))}
                  className={inputCls}
                >
                  {[7, 15, 30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
              </Field>
              <Field label="Monto cobrado (RD$)">
                <input
                  type="number" value={renovarForm.monto}
                  onChange={e => setRenovarForm(p => ({ ...p, monto: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Método de pago">
                <select
                  value={renovarForm.metodo}
                  onChange={e => setRenovarForm(p => ({ ...p, metodo: e.target.value }))}
                  className={inputCls}
                >
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Referencia / comprobante">
                <input
                  value={renovarForm.referencia}
                  onChange={e => setRenovarForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="Ej: TRF-20240815-001"
                  className={inputCls}
                />
              </Field>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModalRenovar(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={renovar} disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? <><RefreshCw size={14} className="animate-spin" /> Renovando...</> : "Confirmar Renovación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cambiar Estado ── */}
      {modalEstado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white">Cambiar Estado</h2>
              <button onClick={() => setModalEstado(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">{modalEstado.colmado_nombre}</p>
              <select
                value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
                className={inputCls}
              >
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModalEstado(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={cambiarEstado} disabled={guardando || nuevoEstado === modalEstado.estado}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
