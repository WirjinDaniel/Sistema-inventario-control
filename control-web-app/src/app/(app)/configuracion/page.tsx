"use client";
import { useEffect, useState } from "react";
import {
  Store, Bell, Shield, Save, ChevronRight,
  MapPin, Phone, FileText, Percent, Package, Building2, Plus, X, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BancoCuenta } from "@/types";

interface Config {
  nombre: string;
  ruc: string;
  telefono: string;
  direccion: string;
  moneda: string;
  itbis: string;
  stock_minimo_default: string;
  dias_vencimiento_alerta: string;
  limite_credito_default: string;
}

const CONFIG_EMPTY: Config = {
  nombre: "",
  ruc: "",
  telefono: "",
  direccion: "",
  moneda: "RD$",
  itbis: "0",
  stock_minimo_default: "5",
  dias_vencimiento_alerta: "7",
  limite_credito_default: "500",
};

const inputCls = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150 bg-white w-full";

type Seccion = "negocio" | "alertas" | "credito" | "bancos";

export default function ConfiguracionPage() {
  const { esAdmin, usuario } = useAuthStore();
  const [config, setConfig] = useState<Config>(CONFIG_EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("negocio");

  // Bancos state
  const [bancos, setBancos] = useState<BancoCuenta[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);
  const [bancoForm, setBancoForm] = useState({ banco: "", numero_cuenta: "", titular: "" });
  const [savingBanco, setSavingBanco] = useState(false);

  useEffect(() => {
    if (seccion === "bancos") {
      setLoadingBancos(true);
      api.get("/ventas/bancos/").then(r => setBancos(r.data.results ?? r.data)).catch(() => {}).finally(() => setLoadingBancos(false));
    }
  }, [seccion]);

  async function agregarBanco(e: React.FormEvent) {
    e.preventDefault();
    if (!bancoForm.banco) { toast.error("El nombre del banco es requerido"); return; }
    setSavingBanco(true);
    try {
      const r = await api.post("/ventas/bancos/", bancoForm);
      setBancos(prev => [...prev, r.data]);
      setBancoForm({ banco: "", numero_cuenta: "", titular: "" });
      toast.success("Banco agregado");
    } catch { toast.error("Error al agregar banco"); }
    finally { setSavingBanco(false); }
  }

  async function eliminarBanco(id: number) {
    try {
      await api.delete(`/ventas/bancos/${id}/`);
      setBancos(prev => prev.filter(b => b.id !== id));
      toast.success("Banco eliminado");
    } catch { toast.error("Error al eliminar banco"); }
  }

  useEffect(() => {
    api.get("/usuarios/colmado/").then(({ data }) => {
      setConfig((prev) => ({
        ...prev,
        nombre: data.nombre ?? "",
        ruc: data.ruc ?? "",
        telefono: data.telefono ?? "",
        direccion: data.direccion ?? "",
        ...data.config_json,
      }));
    }).catch(() => {});
  }, []);

  async function guardar() {
    if (!config.nombre) return toast.error("El nombre del negocio es requerido.");
    setGuardando(true);
    try {
      await api.patch("/usuarios/colmado/", {
        nombre: config.nombre,
        ruc: config.ruc,
        telefono: config.telefono,
        direccion: config.direccion,
        config_json: {
          moneda: config.moneda,
          itbis: config.itbis,
          stock_minimo_default: config.stock_minimo_default,
          dias_vencimiento_alerta: config.dias_vencimiento_alerta,
          limite_credito_default: config.limite_credito_default,
        },
      });
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar la configuración");
    }
    setGuardando(false);
  }

  const f = (k: keyof Config) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setConfig((p) => ({ ...p, [k]: e.target.value }));

  const SECCIONES: { key: Seccion; label: string; Icon: React.ElementType }[] = [
    { key: "negocio", label: "Datos del negocio", Icon: Store },
    { key: "alertas", label: "Alertas y stock", Icon: Bell },
    { key: "credito", label: "Crédito y fiado", Icon: Shield },
    { key: "bancos", label: "Bancos / Cuentas", Icon: Building2 },
  ];

  if (!esAdmin()) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-3 text-slate-200" />
          <h2 className="text-lg font-bold text-slate-400">Acceso restringido</h2>
          <p className="text-slate-300 text-sm mt-1">Solo los administradores pueden modificar la configuración.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Configuración</h1>
          <p className="text-slate-400 text-sm mt-0.5">Ajustes del sistema y del negocio</p>
        </div>
        <button onClick={guardar} disabled={guardando}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 active:scale-95 disabled:opacity-60">
          {guardando ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : <Save size={15} />}
          Guardar cambios
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
        {SECCIONES.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setSeccion(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              seccion === key
                ? "bg-white text-indigo-600 shadow-sm font-semibold"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Sección: Negocio */}
      {seccion === "negocio" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Store size={15} className="text-indigo-600" />
            </div>
            <h2 className="font-bold text-slate-700">Datos del negocio</h2>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Store size={12} /> Nombre del negocio *
              </label>
              <input value={config.nombre} onChange={f("nombre")} placeholder="Mi Colmado El Éxito" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={12} /> RNC / RUC
              </label>
              <input value={config.ruc} onChange={f("ruc")} placeholder="1-23-45678-9" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={12} /> Teléfono
              </label>
              <input value={config.telefono} onChange={f("telefono")} placeholder="809-000-0000" className={inputCls} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin size={12} /> Dirección
              </label>
              <input value={config.direccion} onChange={f("direccion")} placeholder="Calle Principal #1, Santo Domingo" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Percent size={12} /> ITBIS (%)
              </label>
              <input type="number" value={config.itbis} onChange={f("itbis")} placeholder="18" step="0.01" min="0" max="100" className={inputCls} />
              <p className="text-xs text-slate-400">Usa 0 si no aplica ITBIS</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Moneda</label>
              <select value={config.moneda} onChange={f("moneda")} className={inputCls}>
                <option value="RD$">RD$ — Peso Dominicano</option>
                <option value="US$">US$ — Dólar Americano</option>
              </select>
            </div>
          </div>
          {/* Info usuario logueado */}
          <div className="mx-6 mb-5 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold">
              {usuario?.nombre?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-800">Sesión activa: {usuario?.nombre}</p>
              <p className="text-xs text-indigo-500">Rol: {usuario?.rol}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sección: Alertas */}
      {seccion === "alertas" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Bell size={15} className="text-amber-600" />
            </div>
            <h2 className="font-bold text-slate-700">Alertas y control de stock</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-5">
            <ConfigRow
              Icon={Package}
              title="Stock mínimo predeterminado"
              desc="Cantidad mínima de unidades antes de generar alerta de reposición"
              color="bg-red-50 text-red-600">
              <input type="number" value={config.stock_minimo_default} onChange={f("stock_minimo_default")}
                min="0" placeholder="5" className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-28 text-right font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </ConfigRow>
            <ConfigRow
              Icon={Bell}
              title="Días de alerta por vencimiento"
              desc="Alertar cuando un producto vence en menos de N días"
              color="bg-amber-50 text-amber-600">
              <input type="number" value={config.dias_vencimiento_alerta} onChange={f("dias_vencimiento_alerta")}
                min="1" placeholder="7" className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-28 text-right font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </ConfigRow>
          </div>
        </div>
      )}

      {/* Sección: Crédito */}
      {seccion === "credito" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield size={15} className="text-emerald-600" />
            </div>
            <h2 className="font-bold text-slate-700">Crédito y fiado</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-5">
            <ConfigRow
              Icon={Shield}
              title="Límite de crédito predeterminado"
              desc="Límite de fiado por defecto para nuevos clientes (RD$)"
              color="bg-emerald-50 text-emerald-600">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">RD$</span>
                <input type="number" value={config.limite_credito_default} onChange={f("limite_credito_default")}
                  min="0" placeholder="500" className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-28 text-right font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </ConfigRow>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
              <p className="font-semibold mb-1">Cómo funciona el fiado</p>
              <ul className="text-xs space-y-1 text-amber-600 list-disc list-inside">
                <li>El POS bloquea ventas al fiado si el cliente supera su límite individual</li>
                <li>Cada cliente puede tener un límite personalizado desde su perfil</li>
                <li>Este valor es el que se aplica automáticamente a nuevos clientes</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* Sección: Bancos */}
      {seccion === "bancos" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Building2 size={15} className="text-violet-600" />
            </div>
            <h2 className="font-bold text-slate-700">Cuentas bancarias del negocio</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            {/* Add form */}
            <form onSubmit={agregarBanco} className="grid grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Banco *</label>
                <input className={inputCls} placeholder="Banreservas" value={bancoForm.banco} onChange={e => setBancoForm(p => ({ ...p, banco: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Últimos 4 dígitos</label>
                <input className={inputCls} placeholder="1234" maxLength={20} value={bancoForm.numero_cuenta} onChange={e => setBancoForm(p => ({ ...p, numero_cuenta: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Titular</label>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Nombre titular" value={bancoForm.titular} onChange={e => setBancoForm(p => ({ ...p, titular: e.target.value }))} />
                  <button type="submit" disabled={savingBanco} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60">
                    {savingBanco ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
              </div>
            </form>

            {/* List */}
            {loadingBancos ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin" /> Cargando...
              </div>
            ) : bancos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay cuentas registradas</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {bancos.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{b.banco}</p>
                      <p className="text-xs text-slate-400">
                        {b.numero_cuenta ? `*${b.numero_cuenta}` : ''}{b.titular ? ` · ${b.titular}` : ''}
                      </p>
                    </div>
                    <button onClick={() => eliminarBanco(b.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ Icon, title, desc, color, children }: {
  Icon: React.ElementType; title: string; desc: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            {title} <ChevronRight size={13} className="text-slate-300" />
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
