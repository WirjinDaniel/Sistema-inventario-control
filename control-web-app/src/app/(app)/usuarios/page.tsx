"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, X, Check, Search, Shield, User2,
  ShoppingCart, Package, UserCog, Eye, EyeOff, KeyRound, Hash, Lock, AlertTriangle, Users,
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

const ROL_CONFIG: Record<Rol, { label: string; accentBg: string; accentBorder: string; color: string; gradient: string; Icon: React.ElementType }> = {
  ADMIN:      { label: "Administrador", accentBg: "bg-violet-50",  accentBorder: "border-violet-200", color: "text-violet-700",  gradient: "from-violet-500 to-purple-600",  Icon: Shield },
  CAJERO:     { label: "Cajero",        accentBg: "bg-sky-50",     accentBorder: "border-sky-200",    color: "text-sky-700",     gradient: "from-sky-500 to-blue-600",       Icon: ShoppingCart },
  INVENTARIO: { label: "Inventario",    accentBg: "bg-emerald-50", accentBorder: "border-emerald-200",color: "text-emerald-700", gradient: "from-emerald-500 to-teal-600",   Icon: Package },
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
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield size={26} className="text-muted-foreground/30" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Acceso restringido</h2>
          <p className="text-muted-foreground text-sm mt-1">Solo los administradores pueden gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{activos} activos de {usuarios.length} registrados</p>
          </div>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 bg-linear-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Stats roles */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(ROL_CONFIG) as [Rol, typeof ROL_CONFIG[Rol]][]).map(([rol, cfg]) => {
          const count = usuarios.filter((u) => u.rol === rol).length;
          return (
            <div key={rol} className="relative bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/40 to-transparent" />
              <div className={`relative w-10 h-10 rounded-xl bg-linear-to-br ${cfg.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <cfg.Icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xl font-black text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input placeholder="Buscar por nombre o usuario..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all duration-150" />
      </div>

      {/* Lista */}
      <div className="relative bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              {['Usuario', 'Nombre', 'Rol', 'Estado', 'Acciones'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((__, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-muted/60 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <User2 size={26} className="text-muted-foreground/30" />
                </div>
                <p className="font-bold text-foreground">No hay usuarios</p>
                <p className="text-sm text-muted-foreground mt-1">Crea el primer usuario con el botón de arriba</p>
              </td></tr>
            ) : usuarios.map((u) => {
              const cfg = ROL_CONFIG[u.rol] ?? ROL_CONFIG.CAJERO;
              return (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors duration-100">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`relative w-8 h-8 rounded-full bg-linear-to-br ${u.is_active ? "from-brand-500 to-indigo-600" : "from-slate-400 to-slate-500"} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm`}>
                        {u.nombre[0]?.toUpperCase()}
                      </div>
                      <span className="font-mono text-xs bg-muted border border-border px-2 py-0.5 rounded-lg text-foreground">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-foreground">{u.nombre}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold border ${cfg.accentBg} ${cfg.accentBorder} ${cfg.color}`}>
                      <cfg.Icon size={10} /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => u.is_active ? setConfirmToggle(u) : toggleActivo(u)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold border transition-all duration-150 ${
                        u.is_active
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      {u.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEditar(u)} title="Editar usuario"
                        className="p-1.5 rounded-lg hover:bg-brand-50 text-muted-foreground hover:text-brand-600 transition-all duration-150 active:scale-90">
                        <UserCog size={15} />
                      </button>
                      <button onClick={() => { setResetTarget(u); setNuevaPass(""); setShowNuevaPass(false); }} title="Restablecer contraseña"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-muted-foreground hover:text-amber-600 transition-all duration-150 active:scale-90">
                        <KeyRound size={15} />
                      </button>
                      <button onClick={() => abrirPermisos(u)} title="Permisos granulares"
                        className="p-1.5 rounded-lg hover:bg-violet-50 text-muted-foreground hover:text-violet-600 transition-all duration-150 active:scale-90">
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
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/60 to-transparent" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-lg bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                  <KeyRound size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm">Restablecer contraseña</h2>
                  <p className="text-xs text-muted-foreground">{resetTarget.nombre}</p>
                </div>
              </div>
              <button onClick={() => setResetTarget(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">Nueva contraseña</label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showNuevaPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setResetTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors duration-150">
                Cancelar
              </button>
              <button onClick={resetearPassword} disabled={reseteando}
                className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
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
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/60 to-transparent rounded-t-2xl" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                  <Lock size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm">Permisos de {permsTarget.nombre}</h2>
                  <p className="text-xs text-muted-foreground">{ROL_CONFIG[permsTarget.rol]?.label}</p>
                </div>
              </div>
              <button onClick={() => setPermsTarget(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5">
              <p className="text-xs text-muted-foreground">
                Los permisos granulares se suman a los permisos del rol. El administrador siempre tiene acceso total.
              </p>
              {Array.from(new Set(MODULOS_PERMS.map((m) => m.grupo))).map((grupo) => (
                <div key={grupo}>
                  <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-2">{grupo}</p>
                  <div className="space-y-1">
                    {MODULOS_PERMS.filter((m) => m.grupo === grupo).map((m) => (
                      <label key={m.key} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/60 cursor-pointer group">
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{m.label}</span>
                        <div
                          onClick={() => setPerms((p) => ({ ...p, [m.key]: !p[m.key] }))}
                          className={`relative rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${perms[m.key] ? "bg-brand-500" : "bg-muted-foreground/30"}`}
                          style={{ width: 40, height: 22 }}>
                          <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200 ${perms[m.key] ? "translate-x-4.5" : "translate-x-0"}`}
                            style={{ width: 18, height: 18 }} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
              <button onClick={() => setPermsTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={guardarPermisos} disabled={guardandoPerms}
                className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
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
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                  <UserCog size={14} className="text-white" />
                </div>
                <h2 className="font-bold text-foreground">{modal === "crear" ? "Nuevo Usuario" : "Editar Usuario"}</h2>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
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
                            <div key={i} className={`flex-1 rounded-full transition-colors ${i <= s.score ? s.color : "bg-muted"}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Seguridad: <span className="font-medium text-foreground">{s.label}</span></p>
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
                          className={`relative rounded-full transition-colors duration-200 cursor-pointer ${field.value ? "bg-brand-500" : "bg-muted-foreground/30"}`}
                          style={{ width: 40, height: 22 }}>
                          <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200 ${field.value ? "translate-x-4.5" : "translate-x-0"}`}
                            style={{ width: 18, height: 18 }} />
                        </div>
                        <span className="text-sm text-muted-foreground font-medium">Usuario activo</span>
                      </label>
                    )}
                  />
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-border">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors duration-150 active:scale-95">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
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
