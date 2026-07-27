"use client";

import { useEffect, useState } from "react";
import {
  Store, Bell, Shield, Save, MapPin, Phone, FileText,
  Percent, Package, Building2, Plus, X, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { BancoCuenta } from "@/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface Config {
  nombre: string; ruc: string; telefono: string; direccion: string;
  moneda: string; itbis: string; stock_minimo_default: string;
  dias_vencimiento_alerta: string; limite_credito_default: string;
}

const CONFIG_EMPTY: Config = {
  nombre: "", ruc: "", telefono: "", direccion: "",
  moneda: "RD$", itbis: "0", stock_minimo_default: "5",
  dias_vencimiento_alerta: "7", limite_credito_default: "500",
};

type Seccion = "negocio" | "alertas" | "credito" | "bancos";

const SECCIONES: { key: Seccion; label: string; icon: React.ElementType; iconBg: string; iconColor: string }[] = [
  { key: "negocio", label: "Negocio",      icon: Store,    iconBg: "bg-brand-50 dark:bg-brand-950/30",    iconColor: "text-brand-600 dark:text-brand-400" },
  { key: "alertas", label: "Alertas",      icon: Bell,     iconBg: "bg-amber-50 dark:bg-amber-950/30",    iconColor: "text-amber-600 dark:text-amber-400" },
  { key: "credito", label: "Crédito",      icon: Shield,   iconBg: "bg-emerald-50 dark:bg-emerald-950/30",iconColor: "text-emerald-600 dark:text-emerald-400" },
  { key: "bancos",  label: "Bancos",       icon: Building2,iconBg: "bg-violet-50 dark:bg-violet-950/30",  iconColor: "text-violet-600 dark:text-violet-400" },
];

function ConfigRow({ icon: Icon, iconBg, iconColor, title, desc, children }: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", iconBg)}>
          <Icon size={16} className={iconColor} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const { esAdmin, usuario } = useAuthStore();
  const [config, setConfig] = useState<Config>(CONFIG_EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("negocio");
  const [bancos, setBancos] = useState<BancoCuenta[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);
  const [bancoForm, setBancoForm] = useState({ banco: "", numero_cuenta: "", titular: "" });
  const [savingBanco, setSavingBanco] = useState(false);

  useEffect(() => {
    if (seccion === "bancos") {
      setLoadingBancos(true);
      api.get("/ventas/bancos/")
        .then((r) => setBancos(r.data.results ?? r.data))
        .catch(() => {})
        .finally(() => setLoadingBancos(false));
    }
  }, [seccion]);

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
        nombre: config.nombre, ruc: config.ruc,
        telefono: config.telefono, direccion: config.direccion,
        config_json: {
          moneda: config.moneda, itbis: config.itbis,
          stock_minimo_default: config.stock_minimo_default,
          dias_vencimiento_alerta: config.dias_vencimiento_alerta,
          limite_credito_default: config.limite_credito_default,
        },
      });
      toast.success("Configuración guardada");
    } catch { toast.error("Error al guardar la configuración"); }
    setGuardando(false);
  }

  async function agregarBanco(e: React.FormEvent) {
    e.preventDefault();
    if (!bancoForm.banco) { toast.error("El nombre del banco es requerido"); return; }
    setSavingBanco(true);
    try {
      const r = await api.post("/ventas/bancos/", bancoForm);
      setBancos((prev) => [...prev, r.data]);
      setBancoForm({ banco: "", numero_cuenta: "", titular: "" });
      toast.success("Banco agregado");
    } catch { toast.error("Error al agregar banco"); }
    finally { setSavingBanco(false); }
  }

  async function eliminarBanco(id: number) {
    try {
      await api.delete(`/ventas/bancos/${id}/`);
      setBancos((prev) => prev.filter((b) => b.id !== id));
      toast.success("Banco eliminado");
    } catch { toast.error("Error al eliminar banco"); }
  }

  const setField = (k: keyof Config) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setConfig((p) => ({ ...p, [k]: e.target.value }));

  if (!esAdmin()) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={44} className="mx-auto mb-3 text-muted-foreground/20" />
          <h2 className="text-lg font-bold text-foreground">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground mt-1">Solo los administradores pueden modificar la configuración.</p>
        </div>
      </div>
    );
  }

  const activeSection = SECCIONES.find((s) => s.key === seccion);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes del sistema y del negocio"
        actions={
          <Button onClick={guardar} disabled={guardando} className="gap-2">
            {guardando
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              : <Save size={14} />}
            Guardar cambios
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {SECCIONES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSeccion(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              seccion === key
                ? "bg-background text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Panel contenido */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Cabecera sección */}
        {activeSection && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", activeSection.iconBg)}>
              <activeSection.icon size={15} className={activeSection.iconColor} />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              {seccion === "negocio" && "Datos del negocio"}
              {seccion === "alertas" && "Alertas y control de stock"}
              {seccion === "credito" && "Crédito y fiado"}
              {seccion === "bancos" && "Cuentas bancarias del negocio"}
            </h2>
          </div>
        )}

        {/* Negocio */}
        {seccion === "negocio" && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5"><Store size={11} /> Nombre del negocio *</Label>
                <Input value={config.nombre} onChange={setField("nombre")} placeholder="Mi Colmado El Éxito" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5"><FileText size={11} /> RNC / RUC</Label>
                <Input value={config.ruc} onChange={setField("ruc")} placeholder="1-23-45678-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5"><Phone size={11} /> Teléfono</Label>
                <Input value={config.telefono} onChange={setField("telefono")} placeholder="809-000-0000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5"><MapPin size={11} /> Dirección</Label>
                <Input value={config.direccion} onChange={setField("direccion")} placeholder="Calle Principal #1, Santo Domingo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5"><Percent size={11} /> ITBIS (%)</Label>
                <Input type="number" value={config.itbis} onChange={setField("itbis")} placeholder="18" step="0.01" min="0" max="100" />
                <p className="text-xs text-muted-foreground">Usa 0 si no aplica ITBIS</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Moneda</Label>
                <select
                  value={config.moneda}
                  onChange={setField("moneda")}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="RD$">RD$ — Peso Dominicano</option>
                  <option value="US$">US$ — Dólar Americano</option>
                </select>
              </div>
            </div>
            <Separator />
            {/* Sesión activa */}
            <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3">
              <div className="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0">
                {usuario?.nombre?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-800 dark:text-brand-300">Sesión activa: {usuario?.nombre}</p>
                <p className="text-xs text-brand-500 dark:text-brand-400">Rol: {usuario?.rol}</p>
              </div>
            </div>
          </div>
        )}

        {/* Alertas */}
        {seccion === "alertas" && (
          <div className="p-5 divide-y divide-border">
            <ConfigRow
              icon={Package}
              iconBg="bg-rose-50 dark:bg-rose-950/30"
              iconColor="text-rose-600 dark:text-rose-400"
              title="Stock mínimo predeterminado"
              desc="Cantidad mínima de unidades antes de generar alerta de reposición"
            >
              <Input
                type="number" value={config.stock_minimo_default} onChange={setField("stock_minimo_default")}
                min="0" placeholder="5" className="w-24 text-center font-bold"
              />
            </ConfigRow>
            <ConfigRow
              icon={Bell}
              iconBg="bg-amber-50 dark:bg-amber-950/30"
              iconColor="text-amber-600 dark:text-amber-400"
              title="Días de alerta por vencimiento"
              desc="Alertar cuando un producto vence en menos de N días"
            >
              <Input
                type="number" value={config.dias_vencimiento_alerta} onChange={setField("dias_vencimiento_alerta")}
                min="1" placeholder="7" className="w-24 text-center font-bold"
              />
            </ConfigRow>
          </div>
        )}

        {/* Crédito */}
        {seccion === "credito" && (
          <div className="p-5 space-y-4">
            <ConfigRow
              icon={Shield}
              iconBg="bg-emerald-50 dark:bg-emerald-950/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              title="Límite de crédito predeterminado"
              desc="Límite de fiado por defecto para nuevos clientes (RD$)"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">RD$</span>
                <Input
                  type="number" value={config.limite_credito_default} onChange={setField("limite_credito_default")}
                  min="0" placeholder="500" className="w-28 text-center font-bold"
                />
              </div>
            </ConfigRow>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Cómo funciona el fiado</p>
              <ul className="text-xs space-y-1.5 text-amber-600 dark:text-amber-400 list-disc list-inside">
                <li>El POS bloquea ventas al fiado si el cliente supera su límite individual</li>
                <li>Cada cliente puede tener un límite personalizado desde su perfil</li>
                <li>Este valor se aplica automáticamente a nuevos clientes</li>
              </ul>
            </div>
          </div>
        )}

        {/* Bancos */}
        {seccion === "bancos" && (
          <div className="p-5 space-y-4">
            <form onSubmit={agregarBanco} className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Banco *</Label>
                <Input placeholder="Banreservas" value={bancoForm.banco}
                  onChange={(e) => setBancoForm((p) => ({ ...p, banco: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Últimos 4 dígitos</Label>
                <Input placeholder="1234" maxLength={20} value={bancoForm.numero_cuenta}
                  onChange={(e) => setBancoForm((p) => ({ ...p, numero_cuenta: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Titular</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nombre titular" value={bancoForm.titular}
                    onChange={(e) => setBancoForm((p) => ({ ...p, titular: e.target.value }))} />
                  <Button type="submit" disabled={savingBanco} size="icon" className="shrink-0 h-9 w-9">
                    {savingBanco ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  </Button>
                </div>
              </div>
            </form>

            <Separator />

            {loadingBancos ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : bancos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay cuentas registradas</p>
            ) : (
              <div className="divide-y divide-border">
                {bancos.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                        <Building2 size={14} className="text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{b.banco}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.numero_cuenta ? `*${b.numero_cuenta}` : ""}{b.titular ? ` · ${b.titular}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      onClick={() => eliminarBanco(b.id)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
