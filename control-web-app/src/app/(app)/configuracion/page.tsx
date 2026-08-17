"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Store, Bell, Shield, Save, MapPin, Phone, FileText,
  Percent, Package, Building2, Plus, X, Loader2, Lock,
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
import { AccessDenied } from "@/components/shared/AccessDenied";

const configSchema = z.object({
  nombre: z.string().optional(),
  ruc: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  moneda: z.string().optional(),
  itbis: z.string().optional(),
  stock_minimo_default: z.string().optional(),
  dias_vencimiento_alerta: z.string().optional(),
  limite_credito_default: z.string().optional(),
});
type ConfigForm = z.infer<typeof configSchema>;

const bancoSchema = z.object({
  banco: z.string().min(1, "El nombre del banco es requerido"),
  numero_cuenta: z.string().optional(),
  titular: z.string().optional(),
});
type BancoFormData = z.infer<typeof bancoSchema>;

const CONFIG_DEFAULTS: ConfigForm = {
  nombre: "", ruc: "", telefono: "", direccion: "",
  moneda: "RD$", itbis: "0", stock_minimo_default: "5",
  dias_vencimiento_alerta: "7", limite_credito_default: "500",
};

type Seccion = "negocio" | "alertas" | "credito" | "bancos";

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

function ReadonlyField({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {Icon && <Icon size={11} />}{label}
        <Lock size={10} className="text-muted-foreground/60 ml-1" />
      </Label>
      <div className="h-9 px-3 py-2 text-sm rounded-md border border-border bg-muted/40 text-muted-foreground flex items-center">
        {value || <span className="italic text-muted-foreground/50">Sin valor</span>}
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const { esAdmin, esSuperadmin, usuario } = useAuthStore();
  const isSuperadmin = esSuperadmin();
  const isAdmin = esAdmin();

  const [seccion, setSeccion] = useState<Seccion>("negocio");
  const [bancos, setBancos] = useState<BancoCuenta[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);
  const {
    register: regConfig, handleSubmit: handleConfig, reset: resetConfig, watch: watchConfig,
    formState: { isSubmitting: guardando },
  } = useForm<ConfigForm>({ resolver: zodResolver(configSchema), defaultValues: CONFIG_DEFAULTS });
  const cfg = watchConfig();
  const {
    register: regBanco, handleSubmit: handleBanco, reset: resetBanco,
    formState: { errors: errBanco, isSubmitting: savingBanco },
  } = useForm<BancoFormData>({ resolver: zodResolver(bancoSchema), defaultValues: { banco: "", numero_cuenta: "", titular: "" } });

  // Tabs disponibles según rol
  const SECCIONES: { key: Seccion; label: string; icon: React.ElementType; iconBg: string; iconColor: string }[] = [
    { key: "negocio", label: "Negocio",  icon: Store,    iconBg: "bg-brand-50 dark:bg-brand-950/30",    iconColor: "text-brand-600 dark:text-brand-400" },
    { key: "alertas", label: "Alertas",  icon: Bell,     iconBg: "bg-amber-50 dark:bg-amber-950/30",    iconColor: "text-amber-600 dark:text-amber-400" },
    { key: "credito" as Seccion, label: "Crédito", icon: Shield,    iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { key: "bancos"  as Seccion, label: "Bancos",  icon: Building2, iconBg: "bg-violet-50 dark:bg-violet-950/30",  iconColor: "text-violet-600 dark:text-violet-400" },
  ];

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
      resetConfig({
        nombre: data.nombre ?? "",
        ruc: data.ruc ?? "",
        telefono: data.telefono ?? "",
        direccion: data.direccion ?? "",
        moneda: data.config_json?.moneda ?? "RD$",
        itbis: data.config_json?.itbis ?? "0",
        stock_minimo_default: data.config_json?.stock_minimo_default ?? "5",
        dias_vencimiento_alerta: data.config_json?.dias_vencimiento_alerta ?? "7",
        limite_credito_default: data.config_json?.limite_credito_default ?? "500",
      });
    }).catch(() => {});
  }, []);

  const guardar = handleConfig(async (data) => {
    try {
      if (isSuperadmin) {
        if (!data.nombre) { toast.error("El nombre del negocio es requerido."); return; }
        await api.patch("/usuarios/colmado/", {
          nombre: data.nombre, ruc: data.ruc,
          telefono: data.telefono, direccion: data.direccion,
          config_json: {
            moneda: data.moneda, itbis: data.itbis,
            stock_minimo_default: data.stock_minimo_default,
            dias_vencimiento_alerta: data.dias_vencimiento_alerta,
            limite_credito_default: data.limite_credito_default,
          },
        });
      } else {
        await api.patch("/usuarios/colmado/", {
          config_json: {
            stock_minimo_default: data.stock_minimo_default,
            dias_vencimiento_alerta: data.dias_vencimiento_alerta,
            limite_credito_default: data.limite_credito_default,
          },
        });
      }
      toast.success("Configuración guardada");
    } catch { toast.error("Error al guardar la configuración"); }
  });

  const agregarBanco = handleBanco(async (data) => {
    try {
      const r = await api.post("/ventas/bancos/", data);
      setBancos((prev) => [...prev, r.data]);
      resetBanco({ banco: "", numero_cuenta: "", titular: "" });
      toast.success("Banco agregado");
    } catch { toast.error("Error al agregar banco"); }
  });

  async function eliminarBanco(id: number) {
    try {
      await api.delete(`/ventas/bancos/${id}/`);
      setBancos((prev) => prev.filter((b) => b.id !== id));
      toast.success("Banco eliminado");
    } catch { toast.error("Error al eliminar banco"); }
  }

  if (!isAdmin && !isSuperadmin) {
    return <AccessDenied mensaje="Solo los administradores pueden acceder a la configuración." />;
  }

  const activeSection = SECCIONES.find((s) => s.key === seccion);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        description={isSuperadmin ? "Ajustes completos del sistema y del negocio" : "Ajustes de alertas del negocio"}
        actions={
          <Button onClick={() => guardar()} disabled={guardando} className="gap-2">
            {guardando
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              : <Save size={14} />}
            Guardar cambios
          </Button>
        }
      />

      {/* Aviso de restricción para ADMIN */}
      {!isSuperadmin && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <Lock size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Como Administrador, puedes ver los datos del negocio pero solo puedes modificar las <strong>alertas de stock</strong>.
            Los datos fiscales (ITBIS, moneda, RNC) y las cuentas bancarias son administrados por el Superadministrador.
          </p>
        </div>
      )}

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
              {isSuperadmin ? (
                <>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5"><Store size={11} /> Nombre del negocio *</Label>
                    <Input placeholder="Mi Colmado El Éxito" {...regConfig("nombre")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5"><FileText size={11} /> RNC / RUC</Label>
                    <Input placeholder="1-23-45678-9" {...regConfig("ruc")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5"><Phone size={11} /> Teléfono</Label>
                    <Input placeholder="809-000-0000" {...regConfig("telefono")} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5"><MapPin size={11} /> Dirección</Label>
                    <Input placeholder="Calle Principal #1, Santo Domingo" {...regConfig("direccion")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5"><Percent size={11} /> ITBIS (%)</Label>
                    <Input type="number" placeholder="18" step="0.01" min="0" max="100" {...regConfig("itbis")} />
                    <p className="text-xs text-muted-foreground">Usa 0 si no aplica ITBIS</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Moneda</Label>
                    <select
                      className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      {...regConfig("moneda")}
                    >
                      <option value="RD$">RD$ — Peso Dominicano</option>
                      <option value="US$">US$ — Dólar Americano</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <ReadonlyField label="Nombre del negocio" value={cfg.nombre ?? ""} icon={Store} />
                  <ReadonlyField label="RNC / RUC" value={cfg.ruc ?? ""} icon={FileText} />
                  <ReadonlyField label="Teléfono" value={cfg.telefono ?? ""} icon={Phone} />
                  <ReadonlyField label="Dirección" value={cfg.direccion ?? ""} icon={MapPin} />
                  <ReadonlyField label="ITBIS (%)" value={cfg.itbis ? `${cfg.itbis}%` : "0%"} icon={Percent} />
                  <ReadonlyField label="Moneda" value={cfg.moneda ?? ""} />
                </>
              )}
            </div>
            <Separator />
            <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3">
              <div className="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0">
                {usuario?.nombre?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-800 dark:text-brand-300">Sesión activa: {usuario?.nombre}</p>
                <p className="text-xs text-brand-500 dark:text-brand-400">Rol: {isSuperadmin ? "Superadministrador" : usuario?.rol}</p>
              </div>
            </div>
          </div>
        )}

        {/* Alertas — disponible para ADMIN y SUPERADMIN */}
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
                type="number" min="0" placeholder="5" className="w-24 text-center font-bold"
                {...regConfig("stock_minimo_default")}
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
                type="number" min="1" placeholder="7" className="w-24 text-center font-bold"
                {...regConfig("dias_vencimiento_alerta")}
              />
            </ConfigRow>
          </div>
        )}

        {/* Crédito — ADMIN y SUPERADMIN */}
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
                  type="number" min="0" placeholder="500" className="w-28 text-center font-bold"
                  {...regConfig("limite_credito_default")}
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

        {/* Bancos — ADMIN y SUPERADMIN */}
        {seccion === "bancos" && (
          <div className="p-5 space-y-4">
            <form onSubmit={agregarBanco} className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Banco *</Label>
                <Input placeholder="Banreservas" aria-required="true" {...regBanco("banco")} />
                {errBanco.banco && <p className="text-xs text-destructive mt-1">{errBanco.banco.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Últimos 4 dígitos</Label>
                <Input placeholder="1234" maxLength={20} {...regBanco("numero_cuenta")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Titular</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nombre titular" {...regBanco("titular")} />
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
