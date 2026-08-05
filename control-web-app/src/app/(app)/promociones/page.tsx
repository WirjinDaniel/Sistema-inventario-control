"use client";
import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import type { Categoria, Producto } from "@/types";

type TipoPromo = "PORCENTAJE" | "MONTO_FIJO" | "2X1" | "NXPRECIO" | "CUPON";

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

const FORM_EMPTY = {
  nombre: "", descripcion: "", tipo: "PORCENTAJE" as TipoPromo,
  valor: "", cantidad_minima: 1, cantidad_paga: 1, precio_especial: "",
  codigo_cupon: "", producto: null as number | null, categoria: null as number | null,
  fecha_inicio: "", fecha_fin: "", activo: true, limite_usos: "" as string,
};

const fmtFecha = (s: string) => s ? new Date(s).toLocaleDateString("es-DO") : "—";

export default function PromocionesPage() {
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
  const [form, setForm] = useState({ ...FORM_EMPTY });
  const [guardando, setGuardando] = useState(false);

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
    api.get("/categorias/?page_size=100").then(({ data }) => setCategorias(data.results ?? data)).catch(() => {});
    api.get("/productos/?page_size=100").then(({ data }) => setProductos(data.results ?? data)).catch(() => {});
  }, []);

  function abrirNueva() {
    setEditando(null);
    setForm({ ...FORM_EMPTY });
    setModalOpen(true);
  }

  function abrirEditar(p: Promocion) {
    setEditando(p);
    setForm({
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
    setForm((f) => ({ ...f, codigo_cupon: code }));
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    setGuardando(true);
    const payload = {
      ...form,
      limite_usos: form.limite_usos ? Number(form.limite_usos) : null,
      precio_especial: form.precio_especial || "0",
      valor: form.valor || "0",
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
      toast.error(e?.response?.data?.detail ?? "Error al guardar");
    }
    setGuardando(false);
  }

  const prodFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  ).slice(0, 8);

  const ahora = new Date();
  const stats = {
    activas: promociones.filter((p) => p.activo && new Date(p.fecha_fin) >= ahora).length,
    usosTotales: promociones.reduce((a, p) => a + p.usos, 0),
    cupones: promociones.filter((p) => p.tipo === "CUPON").length,
  };

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
                      <Badge variant="secondary" className="text-[10px] h-4">{info.label}</Badge>
                      {vencida && <Badge variant="danger" className="text-[10px] h-4">Vencida</Badge>}
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

          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <Label className="text-xs mb-1.5 block">Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="h-8 text-sm" placeholder="Ej: Descuento fin de semana" />
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-xs mb-1.5 block">Tipo de promoción</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(TIPO_INFO) as TipoPromo[]).map((t) => {
                  const { label, icon: Icon, color } = TIPO_INFO[t];
                  return (
                    <button key={t} onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                      className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all",
                        form.tipo === t ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-border hover:bg-muted/40")}>
                      <Icon size={14} className={form.tipo === t ? color : "text-muted-foreground"} />
                      <span className="text-[10px] font-medium leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Valor según tipo */}
            {(form.tipo === "PORCENTAJE" || form.tipo === "MONTO_FIJO") && (
              <div>
                <Label className="text-xs mb-1.5 block">
                  {form.tipo === "PORCENTAJE" ? "Porcentaje de descuento (%)" : "Monto de descuento (RD$)"}
                </Label>
                <Input type="number" min="0" value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  className="h-8 text-sm" placeholder={form.tipo === "PORCENTAJE" ? "Ej: 10" : "Ej: 50"} />
              </div>
            )}
            {form.tipo === "NXPRECIO" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Cantidad mínima</Label>
                  <Input type="number" min="1" value={form.cantidad_minima}
                    onChange={(e) => setForm((f) => ({ ...f, cantidad_minima: Number(e.target.value) }))}
                    className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Precio especial (RD$)</Label>
                  <Input type="number" min="0" value={form.precio_especial}
                    onChange={(e) => setForm((f) => ({ ...f, precio_especial: e.target.value }))}
                    className="h-8 text-sm" placeholder="Ej: 100" />
                </div>
              </div>
            )}
            {form.tipo === "CUPON" && (
              <div>
                <Label className="text-xs mb-1.5 block">Código del cupón</Label>
                <div className="flex gap-2">
                  <Input value={form.codigo_cupon}
                    onChange={(e) => setForm((f) => ({ ...f, codigo_cupon: e.target.value.toUpperCase() }))}
                    className="h-8 text-sm font-mono flex-1" placeholder="DESCUENTO10" />
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={generarCupon}>
                    <Copy size={12} /> Generar
                  </Button>
                </div>
                <div className="mt-2">
                  <Label className="text-xs mb-1.5 block">Valor del cupón</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={form.valor}
                      onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                      className="h-8 text-sm flex-1" placeholder="10" />
                    <select value={form.tipo === "CUPON" ? "PORCENTAJE" : "MONTO_FIJO"}
                      className="h-8 text-sm border border-border rounded-md bg-background px-2">
                      <option value="PORCENTAJE">%</option>
                      <option value="MONTO_FIJO">RD$</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Aplicar a */}
            <div>
              <Label className="text-xs mb-1.5 block">Aplica a</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Producto específico</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar producto…"
                      value={busqProd}
                      onChange={(e) => setBusqProd(e.target.value)}
                      className="h-8 text-sm"
                    />
                    {busqProd && (
                      <div className="absolute top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                        {prodFiltrados.map((p) => (
                          <button key={p.id} onClick={() => { setForm((f) => ({ ...f, producto: p.id, categoria: null })); setBusqProd(p.nombre); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors">
                            {p.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Categoría</Label>
                  <select value={form.categoria ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value ? Number(e.target.value) : null, producto: null }))}
                    className="w-full h-8 text-sm border border-border rounded-md bg-background px-2">
                    <option value="">Todas las categorías</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Fecha inicio</Label>
                <DatePicker value={form.fecha_inicio} onChange={(v) => setForm((f) => ({ ...f, fecha_inicio: v }))} className="h-8 text-sm w-full" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Fecha fin</Label>
                <DatePicker value={form.fecha_fin} onChange={(v) => setForm((f) => ({ ...f, fecha_fin: v }))} className="h-8 text-sm w-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Límite de usos (opcional)</Label>
                <Input type="number" min="1" value={form.limite_usos}
                  onChange={(e) => setForm((f) => ({ ...f, limite_usos: e.target.value }))}
                  className="h-8 text-sm" placeholder="Sin límite" />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={form.activo} onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))} />
                  <Label className="text-xs">Activa</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              {editando ? "Guardar cambios" : "Crear promoción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
