"use client";
import { useEffect, useState } from "react";
import { Building2, Plus, Edit2, Power, Search, X, Check } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

interface Colmado {
  id: number;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  activo: boolean;
  creado_en: string;
}

const EMPTY: Omit<Colmado, "id" | "creado_en"> = {
  nombre: "", ruc: "", direccion: "", telefono: "", activo: true,
};

export default function ColmadosPage() {
  const { token, esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();
  const [colmados, setColmados] = useState<Colmado[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [form, setForm] = useState<Omit<Colmado, "id" | "creado_en">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const r = await fetch("/api/usuarios/colmados", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setColmados(Array.isArray(data) ? data : data.results ?? []);
      }
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

  async function guardar() {
    setGuardando(true);
    setError(null);
    const url = editId ? `/api/usuarios/colmados/${editId}` : "/api/usuarios/colmados";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        let msg = `Error ${r.status}`;
        try { const d = await r.json(); msg = JSON.stringify(d); } catch {}
        setError(msg);
      } else {
        setModal(null);
        cargar();
      }
    } catch (e) {
      setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.");
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(c: Colmado) {
    await fetch(`/api/usuarios/colmados/${c.id}/toggle-activo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    cargar();
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
              {["ID", "Nombre", "RUC", "Teléfono", "Dirección", "Estado", "Creado", "Acciones"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 text-muted-foreground">#{c.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.ruc || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.telefono || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{c.direccion || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {c.activo ? <Check size={10} /> : <X size={10} />}
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.creado_en).toLocaleDateString("es-DO")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(c)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title="Editar">
                      <Edit2 size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => toggleActivo(c)}
                      className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded`}
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
                    value={(form as Record<string, string>)[f.key]}
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
    </div>
  );
}
