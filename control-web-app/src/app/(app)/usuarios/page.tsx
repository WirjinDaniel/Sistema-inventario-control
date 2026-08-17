"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, X, Check, Search, Shield, User2,
  ShoppingCart, Package, UserCog, Eye, EyeOff, KeyRound, Hash, Lock, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import CustomSelect from "@/components/CustomSelect";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type Rol = "ADMIN" | "CAJERO" | "INVENTARIO";

interface UsuarioAPI {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  is_active: boolean;
}

const usuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  username: z.string().min(1, "El nombre de usuario es requerido."),
  rol: z.enum(["CAJERO", "INVENTARIO", "ADMIN"] as const),
  password: z.string().optional(),
  pin_caja: z.string().optional(),
  is_active: z.boolean(),
}).refine((d) => !d.password || d.password.length >= 6, {
  message: "Mínimo 6 caracteres.", path: ["password"],
}).refine((d) => !d.pin_caja || /^\d{4,6}$/.test(d.pin_caja), {
  message: "El PIN debe tener 4 a 6 dígitos.", path: ["pin_caja"],
});

type FormUsuario = z.infer<typeof usuarioSchema>;

const ROL_CONFIG: Record<Rol, { label: string; color: string; Icon: React.ElementType }> = {
  ADMIN:      { label: "Administrador", color: "bg-violet-50 text-violet-700 border border-violet-100", Icon: Shield },
  CAJERO:     { label: "Cajero",        color: "bg-sky-50 text-sky-700 border border-sky-100",         Icon: ShoppingCart },
  INVENTARIO: { label: "Inventario",    color: "bg-emerald-50 text-emerald-700 border border-emerald-100", Icon: Package },
};


export default function UsuariosPage() {
  const { esAdmin } = useAuthStore();
  const [usuarios, setUsuarios] = useState<UsuarioAPI[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<UsuarioAPI | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<UsuarioAPI | null>(null);

  const {
    register, handleSubmit, control, watch, reset, setError,
    formState: { errors, isDirty },
  } = useForm<FormUsuario>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: { nombre: "", username: "", rol: "CAJERO", password: "", pin_caja: "", is_active: true },
  });

  const passwordValue = watch("password");
  const formDirty = !!(modal && isDirty);
  useUnsavedChanges(formDirty);

  // Permisos granulares
  const [permsTarget, setPermsTarget] = useState<UsuarioAPI | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [guardandoPerms, setGuardandoPerms] = useState(false);

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

  async function abrirPermisos(u: UsuarioAPI) {
    setPermsTarget(u);
    try {
      const { data } = await api.get(`/usuarios/${u.id}/permisos/`);
      setPerms(data);
    } catch {
      // Si no existe el endpoint, inicializar con permisos según rol
      const defaults: Record<string, boolean> = {};
      MODULOS_PERMS.forEach((m) => { defaults[m.key] = u.rol === "ADMIN"; });
      setPerms(defaults);
    }
  }

  async function guardarPermisos() {
    if (!permsTarget) return;
    setGuardandoPerms(true);
    try {
      await api.patch(`/usuarios/${permsTarget.id}/permisos/`, perms);
      toast.success("Permisos actualizados");
      setPermsTarget(null);
    } catch { toast.error("Error al guardar permisos"); }
    setGuardandoPerms(false);
  }

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

  function passwordStrength(p: string): { score: number; label: string; color: string } {
    if (!p) return { score: 0, label: "", color: "" };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score, label: "Muy débil", color: "bg-red-500" };
    if (score === 2) return { score, label: "Débil", color: "bg-orange-500" };
    if (score === 3) return { score, label: "Moderada", color: "bg-yellow-500" };
    if (score === 4) return { score, label: "Fuerte", color: "bg-green-500" };
    return { score, label: "Muy fuerte", color: "bg-emerald-500" };
  }

  function abrirCrear() {
    reset({ nombre: "", username: "", rol: "CAJERO", password: "", pin_caja: "", is_active: true });
    setEditando(null);
    setShowPass(false);
    setModal("crear");
  }

  function abrirEditar(u: UsuarioAPI) {
    reset({ username: u.username, nombre: u.nombre, rol: u.rol, password: "", pin_caja: "", is_active: u.is_active });
    setEditando(u);
    setShowPass(false);
    setModal("editar");
  }

  const guardar = handleSubmit(async (data) => {
    if (modal === "crear" && !data.password) {
      setError("password", { message: "La contraseña es requerida." });
      return;
    }
    setGuardando(true);
    try {
      const base = { username: data.username, nombre: data.nombre, rol: data.rol, is_active: data.is_active };
      const conPin = data.pin_caja ? { ...base, pin_caja: data.pin_caja } : base;
      const payload = modal === "editar" && !data.password ? conPin : { ...conPin, password: data.password };
      if (modal === "crear") await api.post("/usuarios/", payload);
      else await api.patch(`/usuarios/${editando!.id}/`, payload);
      toast.success(modal === "crear" ? "Usuario creado" : "Usuario actualizado");
      setModal(null); cargar();
    } catch { toast.error("Error al guardar el usuario"); }
    setGuardando(false);
  });

  async function toggleActivo(u: UsuarioAPI) {
    try {
      await api.post(`/usuarios/${u.id}/toggle-activo/`);
      toast.success(u.is_active ? "Usuario desactivado" : "Usuario activado");
      cargar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Error al actualizar estado");
    }
  }

  async function resetearPassword() {
    if (!resetTarget) return;
    if (!nuevaPass || nuevaPass.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    setReseteando(true);
    try {
      await api.post(`/usuarios/${resetTarget.id}/reset-password/`, { password: nuevaPass });
      toast.success(`Contraseña de ${resetTarget.nombre} restablecida`);
      setResetTarget(null);
      setNuevaPass("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Error al restablecer la contraseña");
    }
    setReseteando(false);
  }

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
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
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
                    <button onClick={() => u.is_active ? setConfirmToggle(u) : toggleActivo(u)}
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
                      <button onClick={() => abrirPermisos(u)} title="Permisos granulares"
                        className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-all duration-150 active:scale-90">
                        <Lock size={15} />
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
                  <Input
                    type={showNuevaPass ? "text" : "password"}
                    value={nuevaPass}
                    onChange={e => setNuevaPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
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

      {/* Modal permisos granulares */}
      {permsTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Lock size={15} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Permisos de {permsTarget.nombre}</h2>
                  <p className="text-xs text-slate-400">{ROL_CONFIG[permsTarget.rol]?.label}</p>
                </div>
              </div>
              <button onClick={() => setPermsTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5">
              <p className="text-xs text-slate-400">
                Los permisos granulares se suman a los permisos del rol. El administrador siempre tiene acceso total.
              </p>
              {Array.from(new Set(MODULOS_PERMS.map((m) => m.grupo))).map((grupo) => (
                <div key={grupo}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{grupo}</p>
                  <div className="space-y-2">
                    {MODULOS_PERMS.filter((m) => m.grupo === grupo).map((m) => (
                      <label key={m.key} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 cursor-pointer group">
                        <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">{m.label}</span>
                        <div
                          onClick={() => setPerms((p) => ({ ...p, [m.key]: !p[m.key] }))}
                          className={`relative rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${perms[m.key] ? "bg-indigo-500" : "bg-slate-200"}`}
                          style={{ width: 40, height: 22 }}>
                          <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200 ${perms[m.key] ? "translate-x-[18px]" : "translate-x-0"}`}
                            style={{ width: 18, height: 18 }} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setPermsTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={guardarPermisos} disabled={guardandoPerms}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {guardandoPerms ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><Check size={15} /> Guardar permisos</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación desactivar usuario */}
      <Dialog open={!!confirmToggle} onOpenChange={(o) => { if (!o) setConfirmToggle(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={16} /> Desactivar usuario
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Desactivar a <strong>{confirmToggle?.nombre}</strong>? El usuario no podrá iniciar sesión hasta que lo reactives.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmToggle(null)}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { if (confirmToggle) { toggleActivo(confirmToggle); setConfirmToggle(null); } }}
            >
              Sí, desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <form onSubmit={guardar}>
              <div className="px-6 py-4 flex flex-col gap-4">
                <FormField
                  label="Nombre completo"
                  required
                  autoFocus
                  placeholder="Ej: Juan Pérez"
                  error={errors.nombre?.message}
                  {...register("nombre")}
                />
                <FormField
                  label="Nombre de usuario"
                  required
                  placeholder="Ej: jperez"
                  error={errors.username?.message}
                  {...register("username")}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Rol</label>
                  <Controller
                    control={control}
                    name="rol"
                    render={({ field }) => (
                      <CustomSelect
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                        options={[
                          { value: "CAJERO",     label: "Cajero",         icon: ShoppingCart, color: "bg-sky-100 text-sky-600" },
                          { value: "INVENTARIO", label: "Inventario",     icon: Package,      color: "bg-emerald-100 text-emerald-600" },
                          { value: "ADMIN",      label: "Administrador",  icon: Shield,       color: "bg-violet-100 text-violet-600" },
                        ]}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">
                    Contraseña{" "}
                    {modal === "editar" && <span className="font-normal text-muted-foreground">(dejar vacío para no cambiar)</span>}
                    {modal === "crear" && <span className="text-destructive ml-0.5" aria-hidden="true"> *</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder={modal === "crear" ? "Contraseña segura" : "••••••••"}
                      aria-required={modal === "crear"}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      className={`pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      {...register("password")}
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                      {errors.password.message}
                    </p>
                  )}
                  {passwordValue && (() => {
                    const s = passwordStrength(passwordValue);
                    return (
                      <div className="space-y-1">
                        <div className="flex gap-0.5 h-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`flex-1 rounded-full transition-colors ${i <= s.score ? s.color : "bg-slate-200"}`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400">Seguridad: <span className="font-medium text-slate-600">{s.label}</span></p>
                      </div>
                    );
                  })()}
                </div>
                <FormField
                  label="PIN de Caja"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ej: 1234"
                  hint="4–6 dígitos, opcional"
                  error={errors.pin_caja?.message}
                  {...register("pin_caja")}
                />
                {modal === "editar" && (
                  <Controller
                    control={control}
                    name="is_active"
                    render={({ field }) => (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => field.onChange(!field.value)}
                          className={`relative rounded-full transition-colors duration-200 cursor-pointer ${field.value ? "bg-indigo-500" : "bg-slate-200"}`}
                          style={{ width: 40, height: 22 }}>
                          <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200 ${field.value ? "translate-x-[18px]" : "translate-x-0"}`}
                            style={{ width: 18, height: 18 }} />
                        </div>
                        <span className="text-sm text-slate-600 font-medium">Usuario activo</span>
                      </label>
                    )}
                  />
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors duration-150 active:scale-95">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                  {guardando ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : <><Check size={15} /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
