"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, X, Check, Search, Shield, User2,
  ShoppingCart, Package, UserCog, Eye, EyeOff, KeyRound, Hash,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import CustomSelect from "@/components/CustomSelect";

type Rol = "ADMIN" | "CAJERO" | "INVENTARIO";

interface UsuarioAPI {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  is_active: boolean;
}

interface FormUsuario {
  username: string;
  nombre: string;
  rol: Rol;
  password: string;
  pin_caja: string;
  is_active: boolean;
}

const FORM_EMPTY: FormUsuario = {
  username: "", nombre: "", rol: "CAJERO", password: "", pin_caja: "", is_active: true,
};

const ROL_CONFIG: Record<Rol, { label: string; color: string; Icon: React.ElementType }> = {
  ADMIN:      { label: "Administrador", color: "bg-violet-50 text-violet-700 border border-violet-100", Icon: Shield },
  CAJERO:     { label: "Cajero",        color: "bg-sky-50 text-sky-700 border border-sky-100",         Icon: ShoppingCart },
  INVENTARIO: { label: "Inventario",    color: "bg-emerald-50 text-emerald-700 border border-emerald-100", Icon: Package },
};

const inputCls = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150 bg-white w-full";

export default function UsuariosPage() {
  const { esAdmin } = useAuthStore();
  const [usuarios, setUsuarios] = useState<UsuarioAPI[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<UsuarioAPI | null>(null);
  const [form, setForm] = useState<FormUsuario>(FORM_EMPTY);
  const [showPass, setShowPass] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Reset contraseña
  const [resetTarget, setResetTarget] = useState<UsuarioAPI | null>(null);
  const [nuevaPass, setNuevaPass] = useState("");
  const [showNuevaPass, setShowNuevaPass] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = busqueda ? `?search=${encodeURIComponent(busqueda)}` : "";
      const { data } = await api.get(`/usuarios/${params}`);
      setUsuarios(data.results ?? data);
    } catch { toast.error("Error cargando usuarios"); }
    setLoading(false);
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirCrear() {
    setForm(FORM_EMPTY);
    setEditando(null);
    setShowPass(false);
    setModal("crear");
  }

  function abrirEditar(u: UsuarioAPI) {
    setForm({ username: u.username, nombre: u.nombre, rol: u.rol, password: "", pin_caja: "", is_active: u.is_active });
    setEditando(u);
    setShowPass(false);
    setModal("editar");
  }

  async function guardar() {
    if (!form.username || !form.nombre) return toast.error("Usuario y nombre son requeridos.");
    if (modal === "crear" && !form.password) return toast.error("La contraseña es requerida.");
    if (form.pin_caja && !/^\d{4,6}$/.test(form.pin_caja)) return toast.error("El PIN debe tener 4 a 6 dígitos.");
    setGuardando(true);
    try {
      const base = { username: form.username, nombre: form.nombre, rol: form.rol, is_active: form.is_active };
      const conPin = form.pin_caja ? { ...base, pin_caja: form.pin_caja } : base;
      const payload = modal === "editar" && !form.password ? conPin : { ...conPin, password: form.password };
      if (modal === "crear") await api.post("/usuarios/", payload);
      else await api.patch(`/usuarios/${editando!.id}/`, payload);
      toast.success(modal === "crear" ? "Usuario creado" : "Usuario actualizado");
      setModal(null); cargar();
    } catch { toast.error("Error al guardar el usuario"); }
    setGuardando(false);
  }

  async function toggleActivo(u: UsuarioAPI) {
    try {
      await api.patch(`/usuarios/${u.id}/`, { is_active: !u.is_active });
      toast.success(u.is_active ? "Usuario desactivado" : "Usuario activado");
      cargar();
    } catch { toast.error("Error al actualizar estado"); }
  }

  async function resetearPassword() {
    if (!resetTarget) return;
    if (!nuevaPass || nuevaPass.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    setReseteando(true);
    try {
      await api.patch(`/usuarios/${resetTarget.id}/`, { password: nuevaPass });
      toast.success(`Contraseña de ${resetTarget.nombre} restablecida`);
      setResetTarget(null);
      setNuevaPass("");
    } catch { toast.error("Error al restablecer la contraseña"); }
    setReseteando(false);
  }

  const f = (k: keyof FormUsuario) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const activos = usuarios.filter((u) => u.is_active).length;

  if (!esAdmin()) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-3 text-slate-200" />
          <h2 className="text-lg font-bold text-slate-400">Acceso restringido</h2>
          <p className="text-slate-300 text-sm mt-1">Solo los administradores pueden gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Usuarios</h1>
          <p className="text-slate-400 text-sm mt-0.5">{activos} activos de {usuarios.length} registrados</p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Stats roles */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(ROL_CONFIG) as [Rol, typeof ROL_CONFIG[Rol]][]).map(([rol, { label, color, Icon }]) => {
          const count = usuarios.filter((u) => u.rol === rol).length;
          return (
            <div key={rol} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 hover:shadow-md transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">{count}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Buscar por nombre o usuario..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150" />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 tracking-wide">
              <th className="px-5 py-3.5 text-left">Usuario</th>
              <th className="px-4 py-3.5 text-left">Nombre</th>
              <th className="px-4 py-3.5 text-center">Rol</th>
              <th className="px-4 py-3.5 text-center">Estado</th>
              <th className="px-4 py-3.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {[...Array(5)].map((__, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded-lg animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-14 text-slate-300">
                <User2 size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-slate-400">No hay usuarios</p>
              </td></tr>
            ) : usuarios.map((u) => {
              const { label, color, Icon } = ROL_CONFIG[u.rol] ?? ROL_CONFIG.CAJERO;
              return (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors duration-100">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.is_active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                        {u.nombre[0]?.toUpperCase()}
                      </div>
                      <span className="font-mono text-slate-600 text-xs bg-slate-100 px-2 py-0.5 rounded-lg">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-700">{u.nombre}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
                      <Icon size={11} /> {label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button onClick={() => toggleActivo(u)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                        u.is_active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
                      {u.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEditar(u)} title="Editar usuario"
                        className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-all duration-150 active:scale-90">
                        <UserCog size={15} />
                      </button>
                      <button onClick={() => { setResetTarget(u); setNuevaPass(""); setShowNuevaPass(false); }} title="Restablecer contraseña"
                        className="p-1.5 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-all duration-150 active:scale-90">
                        <KeyRound size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal reset contraseña */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <KeyRound size={15} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Restablecer contraseña</h2>
                  <p className="text-xs text-slate-400">{resetTarget.nombre}</p>
                </div>
              </div>
              <button onClick={() => setResetTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNuevaPass ? "text" : "password"}
                    value={nuevaPass}
                    onChange={e => setNuevaPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={inputCls + " pr-10"}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNuevaPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showNuevaPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setResetTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors duration-150">
                Cancelar
              </button>
              <button onClick={resetearPassword} disabled={reseteando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {reseteando ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><Check size={15} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <UserCog size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-bold text-slate-800">{modal === "crear" ? "Nuevo Usuario" : "Editar Usuario"}</h2>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre completo *</label>
                <input value={form.nombre} onChange={f("nombre")} placeholder="Ej: Juan Pérez" className={inputCls} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre de usuario *</label>
                <input value={form.username} onChange={f("username")} placeholder="Ej: jperez" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</label>
                <CustomSelect
                  value={form.rol}
                  onChange={(v) => setForm((p) => ({ ...p, rol: v as Rol }))}
                  options={[
                    { value: "CAJERO",     label: "Cajero",         icon: ShoppingCart, color: "bg-sky-100 text-sky-600" },
                    { value: "INVENTARIO", label: "Inventario",     icon: Package,      color: "bg-emerald-100 text-emerald-600" },
                    { value: "ADMIN",      label: "Administrador",  icon: Shield,       color: "bg-violet-100 text-violet-600" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Contraseña {modal === "editar" && <span className="normal-case font-normal text-slate-400">(dejar vacío para no cambiar)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={f("password")}
                    placeholder={modal === "crear" ? "Contraseña segura" : "••••••••"}
                    className={inputCls + " pr-10"}
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Hash size={12} /> PIN de Caja <span className="normal-case font-normal text-slate-400">(4–6 dígitos, opcional)</span>
                </label>
                <input
                  type="number"
                  value={form.pin_caja}
                  onChange={f("pin_caja")}
                  placeholder="Ej: 1234"
                  maxLength={6}
                  className={inputCls}
                />
              </div>
              {modal === "editar" && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                    className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 cursor-pointer ${form.is_active ? "bg-indigo-500" : "bg-slate-200"}`}
                    style={{ width: 40, height: 22 }}>
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${form.is_active ? "translate-x-[18px]" : "translate-x-0"}`}
                      style={{ width: 18, height: 18 }} />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">Usuario activo</span>
                </label>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors duration-150 active:scale-95">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {guardando ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><Check size={15} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
