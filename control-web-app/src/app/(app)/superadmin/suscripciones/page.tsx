"use client";
import { useEffect, useState } from "react";
import { BadgeDollarSign, RefreshCw, Search, X, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

interface Suscripcion {
  id: number;
  colmado: number;
  colmado_nombre: string;
  plan: number;
  plan_nombre: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: "ACTIVA" | "PENDIENTE" | "VENCIDA" | "SUSPENDIDA" | "CANCELADA";
  precio_pagado: string;
  esta_activa: boolean;
  dias_restantes: number;
  nota: string;
  pagos: Pago[];
}

interface Plan {
  id: number;
  nombre: string;
  precio_mensual: string;
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

export default function SuscripcionesPage() {
  const { token, esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();

  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modal renovar
  const [modalRenovar, setModalRenovar] = useState<Suscripcion | null>(null);
  const [renovarForm, setRenovarForm] = useState({ dias: 30, monto: "", metodo: "EFECTIVO", referencia: "", nota: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal cambiar estado
  const [modalEstado, setModalEstado] = useState<Suscripcion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

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
      const [rSus, rPlanes] = await Promise.all([
        fetch("/api/suscripciones/", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/suscripciones/planes/", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rSus.ok) {
        const d = await rSus.json();
        setSuscripciones(Array.isArray(d) ? d : d.results ?? []);
      }
      if (rPlanes.ok) {
        const d = await rPlanes.json();
        setPlanes(Array.isArray(d) ? d : d.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function renovar() {
    if (!modalRenovar) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/suscripciones/${modalRenovar.id}/renovar/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dias: renovarForm.dias,
          monto: parseFloat(renovarForm.monto) || parseFloat(modalRenovar.precio_pagado),
          metodo: renovarForm.metodo,
          referencia: renovarForm.referencia,
          nota: renovarForm.nota,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(JSON.stringify(d));
      } else {
        setModalRenovar(null);
        cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado() {
    if (!modalEstado || !nuevoEstado) return;
    setGuardando(true);
    try {
      await fetch(`/api/suscripciones/${modalEstado.id}/cambiar-estado/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setModalEstado(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  const filtradas = suscripciones.filter(s => {
    const matchBuscar = s.colmado_nombre.toLowerCase().includes(buscar.toLowerCase()) ||
      s.plan_nombre.toLowerCase().includes(buscar.toLowerCase());
    const matchEstado = !filtroEstado || s.estado === filtroEstado;
    return matchBuscar && matchEstado;
  });

  const stats = {
    total: suscripciones.length,
    activas: suscripciones.filter(s => s.estado === "ACTIVA").length,
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
          <p className="text-sm text-muted-foreground mt-1">Gestión de suscripciones y pagos de todos los colmados</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700" },
          { label: "Activas", value: stats.activas, color: "text-green-600" },
          { label: "Vencidas", value: stats.vencidas, color: "text-red-500" },
          { label: "Por vencer (≤7d)", value: stats.porVencer, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-border p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar colmado o plan..."
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
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {["Colmado", "Plan", "Inicio", "Vencimiento", "Días", "Estado", "Precio", "Acciones"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
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
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.colmado_nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.plan_nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.fecha_inicio}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.fecha_vencimiento}</td>
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
                <td className="px-4 py-3 text-muted-foreground">RD${parseFloat(s.precio_pagado).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setModalRenovar(s); setRenovarForm({ dias: 30, monto: s.precio_pagado, metodo: "EFECTIVO", referencia: "", nota: "" }); setError(null); }}
                      className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors"
                    >
                      Renovar
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

      {/* Modal Renovar */}
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Días a extender</label>
                <select
                  value={renovarForm.dias}
                  onChange={e => setRenovarForm(p => ({ ...p, dias: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {[7, 15, 30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Monto cobrado (RD$)</label>
                <input
                  type="number" value={renovarForm.monto}
                  onChange={e => setRenovarForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Método de pago</label>
                <select
                  value={renovarForm.metodo}
                  onChange={e => setRenovarForm(p => ({ ...p, metodo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Referencia / comprobante</label>
                <input
                  value={renovarForm.referencia}
                  onChange={e => setRenovarForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="Ej: TRF-20240815-001"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModalRenovar(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={renovar} disabled={guardando}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {guardando ? <><RefreshCw size={14} className="animate-spin" /> Renovando...</> : "Confirmar Renovación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
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
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
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
