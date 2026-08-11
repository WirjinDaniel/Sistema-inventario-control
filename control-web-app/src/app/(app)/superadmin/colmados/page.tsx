"use client";
import { useEffect, useState } from "react";
import {
  Building2, Plus, Edit2, Power, Search, X, Check,
  Settings, Save, Loader2, Percent, Bell, CreditCard,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Colmado {
  id: number;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  activo: boolean;
  creado_en: string;
  config_json?: Record<string, unknown>;
}

interface SuscripcionResumen {
  colmado: number;
  plan_nombre: string;
  estado: string;
  dias_restantes: number;
  esta_activa: boolean;
}

interface ColmadoConfig {
  itbis: string;
  moneda: string;
  stock_minimo_default: string;
  dias_vencimiento_alerta: string;
  limite_credito_default: string;
}

const CONFIG_EMPTY: ColmadoConfig = {
  itbis: "18",
  moneda: "RD$",
  stock_minimo_default: "5",
  dias_vencimiento_alerta: "7",
  limite_credito_default: "500",
};

const EMPTY: Omit<Colmado, "id" | "creado_en" | "config_json"> = {
  nombre: "", ruc: "", direccion: "", telefono: "", activo: true,
};

export default function ColmadosPage() {
  const { esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();
  const [colmados, setColmados] = useState<Colmado[]>([]);
  const [suscripciones, setSuscripciones] = useState<SuscripcionResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");

  // Modal crear/editar
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [form, setForm] = useState<Omit<Colmado, "id" | "creado_en" | "config_json">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal configuración
  const [configModal, setConfigModal] = useState<Colmado | null>(null);
  const [config, setConfig] = useState<ColmadoConfig>(CONFIG_EMPTY);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

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
      const [rCol, rSus] = await Promise.all([
        api.get("/usuarios/colmados/"),
        api.get("/suscripciones/"),
      ]);
      setColmados(Array.isArray(rCol.data) ? rCol.data : rCol.data.results ?? []);
      setSuscripciones(Array.isArray(rSus.data) ? rSus.data : rSus.data.results ?? []);
    } catch {
      // backend no disponible
    } finally {
      setLoading(false);
    }
  }

  function abrirCrear() {
    setForm(EMPTY);
    setEditId(null);
    setError(null);
    setModal("crear");
  }

  function abrirEditar(c: Colmado) {
    setForm({ nombre: c.nombre, ruc: c.ruc, direccion: c.direccion, telefono: c.telefono, activo: c.activo });
    setEditId(c.id);
    setError(null);
    setModal("editar");
  }

  async function abrirConfig(c: Colmado) {
    try {
      const { data } = await api.get(`/usuarios/colmados/${c.id}/`);
      const cfg = (data.config_json ?? {}) as Record<string, string>;
      setConfig({
        itbis: cfg.itbis ?? "18",
        moneda: cfg.moneda ?? "RD$",
        stock_minimo_default: cfg.stock_minimo_default ?? "5",
        dias_vencimiento_alerta: cfg.dias_vencimiento_alerta ?? "7",
        limite_credito_default: cfg.limite_credito_default ?? "500",
      });
      setConfigModal({ ...c, config_json: data.config_json });
    } catch {
      toast.error("Error al cargar la configuración");
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      if (editId) {
        await api.patch(`/usuarios/colmados/${editId}/`, form);
      } else {
        await api.post("/usuarios/colmados/", form);
      }
      setModal(null);
      cargar();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      setError(d ? JSON.stringify(d) : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarConfig() {
    if (!configModal) return;
    setGuardandoConfig(true);
    try {
      await api.patch(`/usuarios/colmados/${configModal.id}/`, {
        config_json: config,
      });
      toast.success(`Configuración de ${configModal.nombre} guardada`);
      setConfigModal(null);
      cargar();
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setGuardandoConfig(false);
    }
  }

  async function toggleActivo(c: Colmado) {
    try { await api.post(`/usuarios/colmados/${c.id}/toggle-activo/`); } catch {}
    cargar();
  }

  const setConfigField = (k: keyof ColmadoConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setConfig((p) => ({ ...p, [k]: e.target.value }));

  const susMap = new Map(suscripciones.map(s => [s.colmado, s]));

  function planBadge(colmadoId: number) {
    const s = susMap.get(colmadoId);
    if (!s) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Sin plan</span>;
    if (s.estado === "VENCIDA" || s.estado === "SUSPENDIDA")
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">{s.plan_nombre} · Vencida</span>;
    if (s.esta_activa && s.dias_restantes <= 7)
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{s.plan_nombre} · {s.dias_restantes}d</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{s.plan_nombre}</span>;
  }

  const filtrados = colmados.filter(c =>
    c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    c.ruc.includes(buscar) ||
    c.telefono.includes(buscar)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 size={24} className="text-brand-600" />
            Colmados / Sucursales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión global de todas las sucursales del sistema</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Nuevo Colmado
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: colmados.length, color: "text-slate-700" },
          { label: "Activos", value: colmados.filter(c => c.activo).length, color: "text-green-600" },
          { label: "Inactivos", value: colmados.filter(c => !c.activo).length, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-border p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Buscar */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar colmado..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {["ID", "Nombre", "RUC", "Teléfono", "Dirección", "Plan", "Estado", "Creado", "Acciones"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 text-muted-foreground">#{c.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.ruc || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.telefono || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{c.direccion || "—"}</td>
                <td className="px-4 py-3">{planBadge(c.id)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {c.activo ? <Check size={10} /> : <X size={10} />}
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.creado_en).toLocaleDateString("es-DO")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(c)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title="Editar datos">
                      <Edit2 size={14} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => abrirConfig(c)} className="p-1.5 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded" title="Configuración">
                      <Settings size={14} className="text-brand-500" />
                    </button>
                    <button
                      onClick={() => toggleActivo(c)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      title={c.activo ? "Desactivar" : "Activar"}
                    >
                      <Power size={14} className={c.activo ? "text-green-600" : "text-red-500"} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {modal === "crear" ? "Nuevo Colmado" : "Editar Colmado"}
              </h2>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: "nombre", label: "Nombre *", placeholder: "Ej: Colmado La Esquina" },
                { key: "ruc", label: "RUC", placeholder: "Número de registro" },
                { key: "telefono", label: "Teléfono", placeholder: "809-000-0000" },
                { key: "direccion", label: "Dirección", placeholder: "Calle, Sector, Ciudad" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input
                    value={(form as unknown as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="activo" className="text-sm text-slate-700 dark:text-slate-300">Activo</label>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!form.nombre || guardando}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? "Guardando..." : modal === "crear" ? "Crear Colmado" : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal configuración del colmado */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings size={16} className="text-brand-500" />
                  Configuración — {configModal.nombre}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Ajustes fiscales, alertas y crédito</p>
              </div>
              <button onClick={() => setConfigModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Fiscal */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <Percent size={11} /> Datos fiscales
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">ITBIS (%)</label>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={config.itbis} onChange={setConfigField("itbis")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="18"
                    />
                    <p className="text-[11px] text-muted-foreground mt-0.5">Usa 0 si no aplica ITBIS</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
                    <select
                      value={config.moneda} onChange={setConfigField("moneda")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="RD$">RD$ — Peso Dominicano</option>
                      <option value="US$">US$ — Dólar Americano</option>
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Alertas */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <Bell size={11} /> Alertas de inventario
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Stock mínimo predeterminado</label>
                    <input
                      type="number" min="0"
                      value={config.stock_minimo_default} onChange={setConfigField("stock_minimo_default")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Días alerta vencimiento</label>
                    <input
                      type="number" min="1"
                      value={config.dias_vencimiento_alerta} onChange={setConfigField("dias_vencimiento_alerta")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="7"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Crédito */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <CreditCard size={11} /> Crédito y fiado
                </p>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Límite de crédito predeterminado (RD$)</label>
                  <input
                    type="number" min="0"
                    value={config.limite_credito_default} onChange={setConfigField("limite_credito_default")}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="500"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Se aplica automáticamente a nuevos clientes</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setConfigModal(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={guardarConfig}
                disabled={guardandoConfig}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {guardandoConfig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
