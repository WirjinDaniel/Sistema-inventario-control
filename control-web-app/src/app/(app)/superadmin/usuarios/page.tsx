"use client";
import { useEffect, useState } from "react";
import { UserCog, Plus, Search, Power, Edit2, X, Check, Lock, KeyRound } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Colmado { id: number; nombre: string; }
interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  colmado: number | null;
  colmado_nombre?: string;
  is_active: boolean;
  is_superuser: boolean;
  creado_en: string;
}

const ROL_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CAJERO: "Cajero",
  INVENTARIO: "Inventario",
};

const EMPTY_FORM = {
  username: "", nombre: "", rol: "CAJERO", colmado: "" as string | number, password: "",
};

const MODULOS_PERMS = [
  { key: "ver_reportes", label: "Ver reportes", grupo: "Reportes" },
  { key: "exportar_reportes", label: "Exportar reportes (CSV)", grupo: "Reportes" },
  { key: "ver_ventas", label: "Ver historial de ventas", grupo: "Ventas" },
  { key: "anular_ventas", label: "Anular ventas", grupo: "Ventas" },
  { key: "aplicar_descuentos", label: "Aplicar descuentos en POS", grupo: "Ventas" },
  { key: "ver_clientes", label: "Ver clientes", grupo: "Clientes" },
  { key: "crear_clientes", label: "Crear/editar clientes", grupo: "Clientes" },
  { key: "ver_productos", label: "Ver productos", grupo: "Inventario" },
  { key: "editar_productos", label: "Crear/editar productos", grupo: "Inventario" },
  { key: "ajustar_inventario", label: "Ajustar inventario", grupo: "Inventario" },
  { key: "ver_compras", label: "Ver compras", grupo: "Compras" },
  { key: "crear_compras", label: "Crear órdenes de compra", grupo: "Compras" },
  { key: "ver_gastos", label: "Ver gastos", grupo: "Finanzas" },
  { key: "crear_gastos", label: "Registrar gastos", grupo: "Finanzas" },
  { key: "ver_caja", label: "Ver movimientos de caja", grupo: "Finanzas" },
  { key: "cerrar_caja", label: "Cerrar sesión de caja", grupo: "Finanzas" },
  { key: "ver_devoluciones", label: "Ver devoluciones", grupo: "Devoluciones" },
  { key: "crear_devoluciones", label: "Registrar devoluciones", grupo: "Devoluciones" },
];

export default function UsuariosGlobalPage() {
  const { esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [colmados, setColmados] = useState<Colmado[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroColmado, setFiltroColmado] = useState("");
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permisos granulares
  const [permsTarget, setPermsTarget] = useState<Usuario | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [guardandoPerms, setGuardandoPerms] = useState(false);

  // Reset password
  const [resetTarget, setResetTarget] = useState<Usuario | null>(null);
  const [nuevaPass, setNuevaPass] = useState("");
  const [guardandoReset, setGuardandoReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!esSuperadmin()) { router.replace("/dashboard"); return; }
    Promise.all([cargarUsuarios(), cargarColmados()]);
  }, [hydrated]);

  useEffect(() => { if (!loading) cargarUsuarios(); }, [filtroColmado]);

  if (!hydrated || !esSuperadmin()) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Verificando permisos...</div>;
  }

  async function cargarUsuarios() {
    setLoading(true);
    try {
      const url = filtroColmado ? `/usuarios?colmado=${filtroColmado}` : "/usuarios";
      const { data } = await api.get(url);
      setUsuarios(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      // backend no disponible
    } finally {
      setLoading(false);
    }
  }

  async function cargarColmados() {
    try {
      const { data } = await api.get("/usuarios/colmados");
      setColmados(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      // backend no disponible
    }
  }

  function abrirCrear() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setError(null);
    setModal("crear");
  }

  function abrirEditar(u: Usuario) {
    setForm({ username: u.username, nombre: u.nombre, rol: u.rol, colmado: u.colmado ?? "", password: "" });
    setEditId(u.id);
    setError(null);
    setModal("editar");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const body: Record<string, unknown> = { username: form.username, nombre: form.nombre, rol: form.rol, colmado: form.colmado || null };
    if (form.password) body.password = form.password;
    try {
      if (editId) {
        await api.patch(`/usuarios/${editId}`, body);
      } else {
        await api.post("/usuarios", body);
      }
      setModal(null);
      cargarUsuarios();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      if (d && typeof d === "object") {
        const msg = Object.entries(d as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        setError(msg);
      } else {
        setError("No se pudo conectar con el servidor.");
      }
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    try {
      await api.post(`/usuarios/${u.id}/toggle-activo`);
      cargarUsuarios();
    } catch {
      // error manejado por interceptor
    }
  }

  async function abrirPermisos(u: Usuario) {
    setPermsTarget(u);
    try {
      const { data } = await api.get(`/usuarios/${u.id}/permisos`);
      setPerms(data);
    } catch {
      const defaults: Record<string, boolean> = {};
      MODULOS_PERMS.forEach(m => { defaults[m.key] = u.rol === "ADMIN"; });
      setPerms(defaults);
    }
  }

  async function guardarPermisos() {
    if (!permsTarget) return;
    setGuardandoPerms(true);
    try {
      await api.patch(`/usuarios/${permsTarget.id}/permisos`, perms);
      setPermsTarget(null);
    } finally {
      setGuardandoPerms(false);
    }
  }

  async function guardarResetPassword() {
    if (!resetTarget) return;
    if (nuevaPass.length < 6) { setResetError("Mínimo 6 caracteres"); return; }
    setGuardandoReset(true);
    setResetError(null);
    try {
      await api.post(`/usuarios/${resetTarget.id}/reset-password`, { password: nuevaPass });
      setResetTarget(null);
      setNuevaPass("");
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setResetError(d?.error ?? "Error al resetear");
    } finally {
      setGuardandoReset(false);
    }
  }

  const filtrados = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    u.username.toLowerCase().includes(buscar.toLowerCase())
  );

  const rolColor: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700",
    CAJERO: "bg-blue-100 text-blue-700",
    INVENTARIO: "bg-amber-100 text-amber-700",
  };

  const grupos = Array.from(new Set(MODULOS_PERMS.map(m => m.grupo)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog size={24} className="text-brand-600" />
            Usuarios Global
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de todos los usuarios del sistema</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: usuarios.length },
          { label: "Activos", value: usuarios.filter(u => u.is_active).length },
          { label: "Admins", value: usuarios.filter(u => u.rol === "ADMIN").length },
          { label: "Cajeros", value: usuarios.filter(u => u.rol === "CAJERO").length },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-border p-4 text-center">
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={filtroColmado}
          onChange={e => setFiltroColmado(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos los colmados</option>
          {colmados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
            <tr>
              {["Usuario", "Nombre", "Rol", "Colmado", "Estado", "Creado", "Acciones"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
            ) : filtrados.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{u.username}</p>
                    {u.is_superuser && <span className="text-[10px] text-purple-600 font-semibold">SUPERADMIN</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{u.nombre}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rolColor[u.rol] ?? "bg-slate-100 text-slate-600"}`}>
                    {ROL_LABELS[u.rol] ?? u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.colmado_nombre ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {u.is_active ? <Check size={10} /> : <X size={10} />}
                    {u.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(u.creado_en).toLocaleDateString("es-DO")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(u)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title="Editar">
                      <Edit2 size={14} className="text-muted-foreground" />
                    </button>
                    {!u.is_superuser && (
                      <>
                        <button onClick={() => abrirPermisos(u)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title="Permisos">
                          <Lock size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => { setResetTarget(u); setNuevaPass(""); setResetError(null); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title="Resetear contraseña">
                          <KeyRound size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => toggleActivo(u)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded" title={u.is_active ? "Desactivar" : "Activar"}>
                          <Power size={14} className={u.is_active ? "text-green-600" : "text-red-500"} />
                        </button>
                      </>
                    )}
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
                {modal === "crear" ? "Nuevo Usuario" : "Editar Usuario"}
              </h2>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: "username", label: "Username *", placeholder: "nombre_usuario" },
                { key: "nombre", label: "Nombre completo *", placeholder: "Juan Pérez" },
                { key: "password", label: modal === "crear" ? "Contraseña *" : "Contraseña (vacío = sin cambios)", placeholder: "••••••" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input
                    type={f.key === "password" ? "password" : "text"}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Rol</label>
                <select value={form.rol} onChange={e => setForm(prev => ({ ...prev, rol: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="ADMIN">Administrador</option>
                  <option value="CAJERO">Cajero</option>
                  <option value="INVENTARIO">Inventario</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Colmado</label>
                <select value={form.colmado} onChange={e => setForm(prev => ({ ...prev, colmado: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Sin colmado asignado</option>
                  {colmados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={guardar} disabled={!form.username || !form.nombre || (modal === "crear" && form.password.length < 6) || guardando}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {guardando ? "Guardando..." : modal === "crear" ? "Crear Usuario" : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal permisos granulares */}
      {permsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Permisos — {permsTarget.nombre}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{ROL_LABELS[permsTarget.rol] ?? permsTarget.rol} · {permsTarget.colmado_nombre ?? "Sin colmado"}</p>
              </div>
              <button onClick={() => setPermsTarget(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {grupos.map(grupo => (
                <div key={grupo}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{grupo}</p>
                  <div className="space-y-2">
                    {MODULOS_PERMS.filter(m => m.grupo === grupo).map(m => (
                      <label key={m.key} className="flex items-center justify-between gap-3 cursor-pointer">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{m.label}</span>
                        <button
                          onClick={() => setPerms(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${perms[m.key] ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-600"}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${perms[m.key] ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setPermsTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={guardarPermisos} disabled={guardandoPerms}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {guardandoPerms ? "Guardando..." : "Guardar Permisos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white">Resetear Contraseña</h2>
              <button onClick={() => setResetTarget(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Usuario: <strong className="text-slate-900 dark:text-white">{resetTarget.nombre}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nueva contraseña (mín. 6 caracteres)</label>
                <input
                  type="password"
                  value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {resetError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{resetError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={guardarResetPassword} disabled={nuevaPass.length < 6 || guardandoReset}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {guardandoReset ? "Reseteando..." : "Resetear Contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
