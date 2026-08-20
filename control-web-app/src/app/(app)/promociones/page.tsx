"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Tag, Plus, Search, RefreshCw, Check, Edit2,
  Percent, DollarSign, Gift, Layers, ToggleLeft, ToggleRight, Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { Categoria, Producto } from "@/types";
import { useAuthStore } from "@/store/auth";
import { AccessDenied } from "@/components/shared/AccessDenied";

type TipoPromo = "PORCENTAJE" | "MONTO_FIJO" | "2X1" | "NXPRECIO" | "CUPON";

const promocionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  descripcion: z.string().optional(),
  tipo: z.enum(["PORCENTAJE", "MONTO_FIJO", "2X1", "NXPRECIO", "CUPON"] as const),
  valor: z.string().optional(),
  cantidad_minima: z.number().min(1),
  cantidad_paga: z.number().min(1),
  precio_especial: z.string().optional(),
  codigo_cupon: z.string().optional(),
  producto: z.number().nullable().optional(),
  categoria: z.number().nullable().optional(),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
  activo: z.boolean(),
  limite_usos: z.string().optional(),
});

type PromocionForm = z.infer<typeof promocionSchema>;

interface Promocion {
  id: number; nombre: string; descripcion: string; tipo: TipoPromo;
  valor: string; cantidad_minima: number; cantidad_paga: number;
  precio_especial: string; codigo_cupon: string;
  producto: number | null; producto_nombre: string;
  categoria: number | null; categoria_nombre: string;
  fecha_inicio: string; fecha_fin: string;
  activo: boolean; usos: number; limite_usos: number | null;
}

const TIPO_INFO: Record<TipoPromo, { label: string; icon: React.ElementType; gradient: string; accentBg: string; accentBorder: string; color: string; desc: string }> = {
  PORCENTAJE: { label: "% Descuento", icon: Percent,    gradient: "from-brand-500 to-indigo-600",   accentBg: "bg-brand-50",   accentBorder: "border-brand-200",   color: "text-brand-700",   desc: "Descuento porcentual sobre el precio" },
  MONTO_FIJO: { label: "$ Descuento", icon: DollarSign, gradient: "from-emerald-500 to-teal-600",   accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", color: "text-emerald-700", desc: "Descuento de monto fijo" },
  "2X1":      { label: "2×1",         icon: Gift,       gradient: "from-rose-500 to-red-600",        accentBg: "bg-rose-50",    accentBorder: "border-rose-200",    color: "text-rose-700",    desc: "Lleva 2, paga 1" },
  NXPRECIO:   { label: "N×Precio",    icon: Layers,     gradient: "from-violet-500 to-purple-600",   accentBg: "bg-violet-50",  accentBorder: "border-violet-200",  color: "text-violet-700",  desc: "N unidades por precio especial" },
  CUPON:      { label: "Cupón",       icon: Tag,        gradient: "from-amber-500 to-orange-600",    accentBg: "bg-amber-50",   accentBorder: "border-amber-200",   color: "text-amber-700",   desc: "Código de descuento" },
};

const FORM_EMPTY: PromocionForm = {
  nombre: "", descripcion: "", tipo: "PORCENTAJE",
  valor: "", cantidad_minima: 1, cantidad_paga: 1, precio_especial: "",
  codigo_cupon: "", producto: null, categoria: null,
  fecha_inicio: "", fecha_fin: "", activo: true, limite_usos: "",
};

const fmtFecha = (s: string) => s ? new Date(s).toLocaleDateString("es-DO") : "—";

export default function PromocionesPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [tab, setTab] = useState<"activas" | "vencidas" | "todas">("activas");
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqProd, setBusqProd] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Promocion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } =
    useForm<PromocionForm>({ resolver: zodResolver(promocionSchema), defaultValues: FORM_EMPTY });
  const tipoActual = watch("tipo");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("search", busqueda);
      if (tab === "activas") params.set("activo", "true");
      if (tab === "vencidas") params.set("activo", "false");
      const { data } = await api.get(`/promociones/?${params}`);
      setPromociones(data.results ?? data);
    } catch { setPromociones([]); }
    setLoading(false);
  }, [busqueda, tab]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get("/inventario/categorias/?page_size=100").then(({ data }) => setCategorias(data.results ?? data)).catch(() => {});
    api.get("/inventario/productos/?page_size=100").then(({ data }) => setProductos(data.results ?? data)).catch(() => {});
  }, []);

  function abrirNueva() {
    setEditando(null); setBusqProd(""); reset(FORM_EMPTY); setModalOpen(true);
  }

  function abrirEditar(p: Promocion) {
    setEditando(p); setBusqProd(p.producto_nombre ?? "");
    reset({
      nombre: p.nombre, descripcion: p.descripcion, tipo: p.tipo,
      valor: p.valor, cantidad_minima: p.cantidad_minima, cantidad_paga: p.cantidad_paga,
      precio_especial: p.precio_especial, codigo_cupon: p.codigo_cupon,
      producto: p.producto, categoria: p.categoria,
      fecha_inicio: p.fecha_inicio?.slice(0, 10) ?? "",
      fecha_fin: p.fecha_fin?.slice(0, 10) ?? "",
      activo: p.activo, limite_usos: p.limite_usos?.toString() ?? "",
    });
    setModalOpen(true);
  }

  async function toggleActivo(p: Promocion) {
    try {
      await api.patch(`/promociones/${p.id}/`, { activo: !p.activo });
      toast.success(p.activo ? "Promoción desactivada" : "Promoción activada");
      cargar();
    } catch { toast.error("Error al actualizar"); }
  }

  function generarCupon() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setValue("codigo_cupon", code, { shouldDirty: true });
  }

  const onSubmit = handleSubmit(async (data) => {
    setGuardando(true);
    const payload = {
      ...data,
      limite_usos: data.limite_usos ? Number(data.limite_usos) : null,
      precio_especial: data.precio_especial || "0",
      valor: data.valor || "0",
      fecha_inicio: data.fecha_inicio || null,
      fecha_fin: data.fecha_fin || null,
    };
    try {
      if (editando) {
        await api.patch(`/promociones/${editando.id}/`, payload);
        toast.success("Promoción actualizada");
      } else {
        await api.post("/promociones/", payload);
        toast.success("Promoción creada");
      }
      setModalOpen(false); cargar();
    } catch (e: any) {
      const errData = e?.response?.data;
      if (errData && typeof errData === "object") {
        const msgs = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ");
        toast.error(msgs || "Error al guardar");
      } else { toast.error("Error al guardar"); }
    }
    setGuardando(false);
  });

  const prodFiltrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0, 8);

  const ahora = new Date();
  const stats = {
    activas: promociones.filter((p) => p.activo && new Date(p.fecha_fin) >= ahora).length,
    usosTotales: promociones.reduce((a, p) => a + p.usos, 0),
    cupones: promociones.filter((p) => p.tipo === "CUPON").length,
  };

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <Tag size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Promociones</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Cupones, descuentos y ofertas especiales</p>
          </div>
        </div>
        <button onClick={abrirNueva}
          className="flex items-center gap-2 bg-linear-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nueva promoción
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Activas",       value: stats.activas,      gradient: "from-rose-500 to-pink-600",     via: "via-rose-400/60",    Icon: Tag },
          { label: "Usos totales",  value: stats.usosTotales,  gradient: "from-emerald-500 to-teal-600",  via: "via-emerald-400/60", Icon: Percent },
          { label: "Cupones",       value: stats.cupones,      gradient: "from-amber-500 to-orange-600",  via: "via-amber-400/60",   Icon: Gift },
        ].map(({ label, value, gradient, via, Icon }) => (
          <div key={label} className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${via} to-transparent`} />
            <div className="flex items-start gap-3">
              <div className={`relative w-9 h-9 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-black text-foreground">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs y búsqueda */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(["activas", "vencidas", "todas"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all",
                tab === t ? "bg-card text-brand-600 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Buscar promoción…"
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={cargar}>
          <RefreshCw size={12} /> Actualizar
        </Button>
      </div>

      {/* Lista */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-rose-400/60 to-transparent" />
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted/60 rounded-xl animate-pulse" />)}
          </div>
        ) : promociones.length === 0 ? (
          <EmptyState icon={Tag} title="Sin promociones" description="Crea tu primera promoción para comenzar." />
        ) : (
          <div className="divide-y divide-border">
            {promociones.map((p) => {
              const info = TIPO_INFO[p.tipo] ?? TIPO_INFO.PORCENTAJE;
              const Icon = info.icon;
              const vencida = p.fecha_fin && new Date(p.fecha_fin) < ahora;
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className={`relative w-10 h-10 rounded-xl bg-linear-to-br ${info.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                    <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
                    <Icon size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">{p.nombre}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${info.accentBg} ${info.accentBorder} ${info.color}`}>
                        {info.label}
                      </span>
                      {vencida && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border bg-rose-50 border-rose-200 text-rose-700">
                          Vencida
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {p.producto_nombre && <span className="flex items-center gap-1">📦 {p.producto_nombre}</span>}
                      {p.categoria_nombre && <span>🏷 {p.categoria_nombre}</span>}
                      {p.codigo_cupon && (
                        <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded-lg text-foreground">
                          {p.codigo_cupon}
                        </span>
                      )}
                      <span>{fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}</span>
                      <span>{p.usos} usos{p.limite_usos ? ` / ${p.limite_usos}` : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-foreground tabular-nums">
                      {p.tipo === "PORCENTAJE" ? `${p.valor}%`
                        : p.tipo === "MONTO_FIJO" ? formatCurrency(Number(p.valor))
                        : p.tipo === "2X1" ? "2×1"
                        : p.tipo === "NXPRECIO" ? `${p.cantidad_minima}×${formatCurrency(Number(p.precio_especial))}`
                        : "Cupón"}
                    </p>
                    <button onClick={() => toggleActivo(p)} className="transition-colors">
                      {p.activo
                        ? <ToggleRight size={22} className="text-brand-500" />
                        : <ToggleLeft size={22} className="text-muted-foreground/50" />}
                    </button>
                    <button onClick={() => abrirEditar(p)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-lg bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                <div className="absolute inset-x-0 top-0 h-px rounded-t-lg bg-linear-to-r from-transparent via-white/40 to-transparent" />
                <Tag size={13} className="text-white" />
              </div>
              {editando ? "Editar promoción" : "Nueva promoción"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block" htmlFor="promo-nombre">Nombre <span className="text-destructive">*</span></Label>
              <Input id="promo-nombre" aria-required="true" aria-invalid={!!errors.nombre}
                className="text-sm" placeholder="Ej: Descuento fin de semana" {...register("nombre")} />
              {errors.nombre && <p role="alert" className="text-xs text-destructive mt-1">{errors.nombre.message}</p>}
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-xs mb-1.5 block">Tipo de promoción</Label>
              <Controller name="tipo" control={control} render={({ field }) => (
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(TIPO_INFO) as TipoPromo[]).map((t) => {
                    const { label, icon: Icon, gradient, accentBg, accentBorder, color } = TIPO_INFO[t];
                    const sel = field.value === t;
                    return (
                      <button key={t} type="button" onClick={() => field.onChange(t)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all",
                          sel ? `${accentBg} ${accentBorder}` : "border-border hover:bg-muted/40"
                        )}>
                        {sel ? (
                          <div className={`relative w-6 h-6 rounded-lg bg-linear-to-br ${gradient} flex items-center justify-center`}>
                            <Icon size={12} className="text-white" />
                          </div>
                        ) : (
                          <Icon size={14} className="text-muted-foreground" />
                        )}
                        <span className={cn("text-2xs font-semibold leading-tight", sel ? color : "text-muted-foreground")}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )} />
            </div>

            {/* Valor según tipo */}
            {(tipoActual === "PORCENTAJE" || tipoActual === "MONTO_FIJO") && (
              <div>
                <Label className="text-xs mb-1.5 block">
                  {tipoActual === "PORCENTAJE" ? "Porcentaje de descuento (%)" : "Monto de descuento (RD$)"}
                </Label>
                <Input type="number" min="0" className="text-sm"
                  placeholder={tipoActual === "PORCENTAJE" ? "Ej: 10" : "Ej: 50"} {...register("valor")} />
              </div>
            )}
            {tipoActual === "NXPRECIO" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Cantidad mínima</Label>
                  <Input type="number" min="1" className="text-sm" {...register("cantidad_minima", { valueAsNumber: true })} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Precio especial (RD$)</Label>
                  <Input type="number" min="0" className="text-sm" placeholder="Ej: 100" {...register("precio_especial")} />
                </div>
              </div>
            )}
            {tipoActual === "CUPON" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Código del cupón</Label>
                  <div className="flex gap-2">
                    <Controller name="codigo_cupon" control={control} render={({ field }) => (
                      <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        className="text-sm font-mono flex-1" placeholder="DESCUENTO10" />
                    )} />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={generarCupon}>
                      <Copy size={12} /> Generar
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Valor del cupón</Label>
                  <Input type="number" min="0" className="text-sm" placeholder="10" {...register("valor")} />
                </div>
              </div>
            )}

            {/* Aplica a */}
            <div>
              <Label className="text-xs mb-1.5 block">Aplica a</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Producto específico</Label>
                  <div className="relative">
                    <Input placeholder="Buscar producto…" value={busqProd}
                      onChange={(e) => setBusqProd(e.target.value)} className="text-sm" />
                    {busqProd && (
                      <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                        {prodFiltrados.length > 0 ? prodFiltrados.map((p) => (
                          <button key={p.id} type="button"
                            onClick={() => { setValue("producto", p.id, { shouldDirty: true }); setValue("categoria", null); setBusqProd(p.nombre); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors text-foreground">
                            {p.nombre}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Categoría</Label>
                  <Controller name="categoria" control={control} render={({ field }) => (
                    <select value={field.value ?? ""}
                      onChange={(e) => { field.onChange(e.target.value ? Number(e.target.value) : null); setValue("producto", null); setBusqProd(""); }}
                      className="w-full h-9 text-sm border border-border rounded-xl bg-card text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="">Todas las categorías</option>
                      {categorias.map((c) => <option key={c.id} value={c.id.toString()}>{c.nombre}</option>)}
                    </select>
                  )} />
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Fecha inicio</Label>
                <Controller name="fecha_inicio" control={control} render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} className="text-sm w-full" />
                )} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Fecha fin</Label>
                <Controller name="fecha_fin" control={control} render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} className="text-sm w-full" />
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Límite de usos (opcional)</Label>
                <Input type="number" min="1" className="text-sm" placeholder="Sin límite" {...register("limite_usos")} />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Controller name="activo" control={control} render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )} />
                  <Label className="text-xs">Activa</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={guardando} className="gap-2">
                {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {editando ? "Guardar cambios" : "Crear promoción"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
