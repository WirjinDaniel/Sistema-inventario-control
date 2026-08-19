"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Tag, Plus, Search, RefreshCw, Check, X, Edit2,
  Percent, DollarSign, Gift, Layers, ToggleLeft, ToggleRight, Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

const TIPO_INFO: Record<TipoPromo, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  PORCENTAJE:  { label: "% Descuento",   icon: Percent,    color: "text-brand-500",   desc: "Descuento porcentual sobre el precio" },
  MONTO_FIJO:  { label: "$ Descuento",   icon: DollarSign, color: "text-emerald-500", desc: "Descuento de monto fijo" },
  "2X1":       { label: "2×1",           icon: Gift,       color: "text-rose-500",    desc: "Lleva 2, paga 1" },
  NXPRECIO:    { label: "N×Precio",      icon: Layers,     color: "text-purple-500",  desc: "N unidades por precio especial" },
  CUPON:       { label: "Cupón",         icon: Tag,        color: "text-amber-500",   desc: "Código de descuento" },
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

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Promocion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } =
    useForm<PromocionForm>({ resolver: zodResolver(promocionSchema), defaultValues: FORM_EMPTY });
  const tipoActual = watch("tipo");
  const productoActual = watch("producto");

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
    setEditando(null);
    setBusqProd("");
    reset(FORM_EMPTY);
    setModalOpen(true);
  }

  function abrirEditar(p: Promocion) {
    setEditando(p);
    setBusqProd(p.producto_nombre ?? "");
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
      setModalOpen(false);
      cargar();
    } catch (e: any) {
      const data = e?.response?.data;
      if (data && typeof data === "object") {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        toast.error(msgs || "Error al guardar");
      } else {
        toast.error("Error al guardar");
      }
    }
    setGuardando(false);
  });

  const prodFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  ).slice(0, 8);

  const ahora = new Date();
  const stats = {
    activas: promociones.filter((p) => p.activo && new Date(p.fecha_fin) >= ahora).length,
    usosTotales: promociones.reduce((a, p) => a + p.usos, 0),
    cupones: promociones.filter((p) => p.tipo === "CUPON").length,
  };

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Promociones"
        description="Cupones, descuentos y ofertas especiales"
        actions={
          <Button size="sm" className="gap-2" onClick={abrirNueva}>
            <Plus size={15} /> Nueva promoción
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Activas", value: stats.activas, icon: Tag, color: "text-brand-500" },
          { label: "Usos totales", value: stats.usosTotales, icon: Percent, color: "text-emerald-500" },
          { label: "Cupones", value: stats.cupones, icon: Gift, color: "text-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs y búsqueda */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["activas", "vencidas", "todas"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all",
                tab === t ? "bg-background text-brand-600 dark:text-brand-400 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar promoción…" className="pl-8 h-8 text-sm"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={cargar}>
          <RefreshCw size={12} /> Actualizar
        </Button>
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
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
                <div key={p.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    "bg-muted/60")}>
                    <Icon size={16} className={info.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{p.nombre}</span>
                      <Badge variant="secondary" className="text-2xs h-4">{info.label}</Badge>
                      {vencida && <Badge variant="danger" className="text-2xs h-4">Vencida</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {p.producto_nombre && <span>📦 {p.producto_nombre}</span>}
                      {p.categoria_nombre && <span>🏷 {p.categoria_nombre}</span>}
                      {p.codigo_cupon && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{p.codigo_cupon}</span>}
                      <span>{fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}</span>
                      <span>{p.usos} usos{p.limite_usos ? ` / ${p.limite_usos}` : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {p.tipo === "PORCENTAJE" ? `${p.valor}%`
                          : p.tipo === "MONTO_FIJO" ? formatCurrency(Number(p.valor))
                          : p.tipo === "2X1" ? "2×1"
                          : p.tipo === "NXPRECIO" ? `${p.cantidad_minima}×${formatCurrency(Number(p.precio_especial))}`
                          : `Cupón`}
                      </p>
                    </div>
                    <button onClick={() => toggleActivo(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {p.activo ? <ToggleRight size={20} className="text-brand-500" /> : <ToggleLeft size={20} />}
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(p)}>
                      <Edit2 size={13} />
                    </Button>
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
              <Tag size={16} className="text-brand-500" />
              {editando ? "Editar promoción" : "Nueva promoción"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <Label className="text-xs mb-1.5 block" htmlFor="promo-nombre">Nombre <span className="text-destructive">*</span></Label>
              <Input id="promo-nombre" aria-required="true" aria-invalid={!!errors.nombre}
                className="h-8 text-sm" placeholder="Ej: Descuento fin de semana" {...register("nombre")} />
              {errors.nombre && <p role="alert" className="text-xs text-destructive mt-1">{errors.nombre.message}</p>}
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-xs mb-1.5 block">Tipo de promoción</Label>
              <Controller name="tipo" control={control} render={({ field }) => (
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(TIPO_INFO) as TipoPromo[]).map((t) => {
                    const { label, icon: Icon, color } = TIPO_INFO[t];
                    return (
                      <button key={t} type="button" onClick={() => field.onChange(t)}
                        className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all",
                          field.value === t ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-border hover:bg-muted/40")}>
                        <Icon size={14} className={field.value === t ? color : "text-muted-foreground"} />
                        <span className="text-2xs font-medium leading-tight">{label}</span>
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
                <Input type="number" min="0" className="h-8 text-sm"
                  placeholder={tipoActual === "PORCENTAJE" ? "Ej: 10" : "Ej: 50"} {...register("valor")} />
              </div>
            )}
            {tipoActual === "NXPRECIO" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Cantidad mínima</Label>
                  <Input type="number" min="1" className="h-8 text-sm"
                    {...register("cantidad_minima", { valueAsNumber: true })} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Precio especial (RD$)</Label>
                  <Input type="number" min="0" className="h-8 text-sm" placeholder="Ej: 100" {...register("precio_especial")} />
                </div>
              </div>
            )}
            {tipoActual === "CUPON" && (
              <div>
                <Label className="text-xs mb-1.5 block">Código del cupón</Label>
                <div className="flex gap-2">
                  <Controller name="codigo_cupon" control={control} render={({ field }) => (
                    <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="h-8 text-sm font-mono flex-1" placeholder="DESCUENTO10" />
                  )} />
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={generarCupon}>
                    <Copy size={12} /> Generar
                  </Button>
                </div>
                <div className="mt-2">
                  <Label className="text-xs mb-1.5 block">Valor del cupón</Label>
                  <Input type="number" min="0" className="h-8 text-sm" placeholder="10" {...register("valor")} />
                </div>
              </div>
            )}

            {/* Aplicar a */}
            <div>
              <Label className="text-xs mb-1.5 block">Aplica a</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Producto específico</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar producto…"
                      value={busqProd}
                      onChange={(e) => setBusqProd(e.target.value)}
                      className="h-8 text-sm"
                    />
                    {busqProd && (
                      <div className="absolute top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                        {prodFiltrados.length > 0 ? prodFiltrados.map((p) => (
                          <button key={p.id} type="button"
                            onClick={() => { setValue("producto", p.id, { shouldDirty: true }); setValue("categoria", null); setBusqProd(p.nombre); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors">
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
                      className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
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
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} className="h-8 text-sm w-full" />
                )} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Fecha fin</Label>
                <Controller name="fecha_fin" control={control} render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} className="h-8 text-sm w-full" />
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Límite de usos (opcional)</Label>
                <Input type="number" min="1" className="h-8 text-sm" placeholder="Sin límite" {...register("limite_usos")} />
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
