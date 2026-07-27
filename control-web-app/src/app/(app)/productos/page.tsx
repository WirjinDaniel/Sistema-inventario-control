"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Edit2, AlertTriangle, Package,
  Check, Filter, ScanBarcode, Sparkles, Camera,
  ScrollText, LayoutGrid, List, Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Producto, Categoria } from "@/types";
import CustomSelect from "@/components/CustomSelect";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const UNIDADES = ["unidad", "libra", "onza", "galón", "caja", "docena", "litro"];

interface FormData {
  nombre: string; sku: string; codigo_barras: string; categoria: string;
  tipo: string; unidad_medida: string; precio_costo: string;
  precio_venta: string; precio_oferta: string; oferta_inicio: string; oferta_fin: string;
  stock_actual: string; stock_minimo: string;
  fecha_vencimiento: string; activo: boolean; proveedor: string;
  unidades_por_caja: string; itbis_exento: boolean; notas: string;
  sin_vencimiento: boolean;
}

const FORM_EMPTY: FormData = {
  nombre: "", sku: "", codigo_barras: "", categoria: "",
  tipo: "UNIDAD", unidad_medida: "unidad", precio_costo: "",
  precio_oferta: "", oferta_inicio: "", oferta_fin: "",
  precio_venta: "", stock_actual: "0", stock_minimo: "0",
  fecha_vencimiento: "", activo: true, proveedor: "",
  unidades_por_caja: "", itbis_exento: false, notas: "",
  sin_vencimiento: false,
};

export default function ProductosPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [filtroCat, setFiltroCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"tabla" | "grid">("tabla");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormData>(FORM_EMPTY);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.append("search", busqueda);
      if (filtroStockBajo) params.append("stock_bajo", "true");
      if (filtroCat) params.append("categoria", filtroCat);
      const [{ data: p }, { data: c }] = await Promise.all([
        api.get(`/inventario/productos/?${params}`),
        api.get("/inventario/categorias/"),
      ]);
      setProductos(p.results ?? p);
      setCategorias(c.results ?? c);
    } catch { toast.error("Error cargando productos"); }
    setLoading(false);
  }, [busqueda, filtroStockBajo, filtroCat]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirCrear() {
    setForm(FORM_EMPTY); setEditando(null); setModal("crear"); setSheetOpen(true);
  }
  function abrirEditar(p: Producto) {
    setForm({
      nombre: p.nombre, sku: p.sku, codigo_barras: p.codigo_barras,
      categoria: String(p.categoria ?? ""), tipo: p.tipo,
      unidad_medida: p.unidad_medida, precio_costo: p.precio_costo,
      precio_venta: p.precio_venta, stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo, fecha_vencimiento: p.fecha_vencimiento ?? "",
      activo: p.activo, proveedor: p.proveedor ?? "",
      unidades_por_caja: p.unidades_por_caja != null ? String(p.unidades_por_caja) : "",
      itbis_exento: p.itbis_exento ?? false, notas: p.notas ?? "",
      sin_vencimiento: !p.fecha_vencimiento,
      precio_oferta: p.precio_oferta ?? "", oferta_inicio: p.oferta_inicio ?? "", oferta_fin: p.oferta_fin ?? "",
    });
    setEditando(p); setModal("editar"); setSheetOpen(true);
  }

  async function guardar() {
    if (!form.nombre || !form.precio_venta) return toast.error("Nombre y precio de venta son requeridos.");
    setGuardando(true);
    try {
      const payload = {
        ...form,
        categoria: form.categoria || null,
        fecha_vencimiento: form.sin_vencimiento ? null : (form.fecha_vencimiento || null),
        unidades_por_caja: form.unidades_por_caja ? Number(form.unidades_por_caja) : null,
        precio_oferta: form.precio_oferta || null,
        oferta_inicio: form.oferta_inicio || null,
        oferta_fin: form.oferta_fin || null,
        sin_vencimiento: undefined,
      };
      if (modal === "crear") await api.post("/inventario/productos/", payload);
      else await api.patch(`/inventario/productos/${editando!.id}/`, payload);
      toast.success(modal === "crear" ? "Producto creado" : "Producto actualizado");
      setSheetOpen(false); cargar();
    } catch { toast.error("Error al guardar el producto"); }
    setGuardando(false);
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const margen = form.precio_costo && form.precio_venta
    ? (((Number(form.precio_venta) - Number(form.precio_costo)) / Number(form.precio_costo)) * 100)
    : null;

  const stockBajoCount = productos.filter((p) => p.stock_bajo).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {productos.length} productos
            {stockBajoCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-rose-500 font-semibold">
                <AlertTriangle size={12} /> {stockBajoCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <Button onClick={abrirCrear} className="gap-2">
          <Plus size={15} /> Nuevo producto
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, SKU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="min-w-44">
          <CustomSelect
            value={filtroCat}
            onChange={setFiltroCat}
            placeholder="Todas las categorías"
            options={[
              { value: "", label: "Todas las categorías" },
              ...categorias.map((c) => ({ value: String(c.id), label: c.nombre })),
            ]}
          />
        </div>
        <Button
          variant={filtroStockBajo ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltroStockBajo((v) => !v)}
          className="gap-2"
        >
          <Filter size={13} /> Stock bajo
          {filtroStockBajo && stockBajoCount > 0 && (
            <Badge variant="danger" className="text-[10px] px-1 h-4 ml-1">{stockBajoCount}</Badge>
          )}
        </Button>
        {/* Vista toggle */}
        <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/50">
          <button
            onClick={() => setVista("tabla")}
            className={cn("p-1.5 rounded-md transition-colors", vista === "tabla" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setVista("grid")}
            className={cn("p-1.5 rounded-md transition-colors", vista === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Vista Tabla */}
      {vista === "tabla" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-right font-semibold">Costo</th>
                  <th className="px-4 py-3 text-right font-semibold">Precio</th>
                  <th className="px-4 py-3 text-right font-semibold">Margen</th>
                  <th className="px-4 py-3 text-center font-semibold">Stock</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {[...Array(8)].map((__, j) => (
                        <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : productos.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={Package}
                        title="No hay productos"
                        description="Crea el primero con el botón de arriba"
                        action={{ label: "Nuevo producto", onClick: abrirCrear }}
                      />
                    </td>
                  </tr>
                ) : productos.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0 text-brand-600 font-bold text-xs">
                          {p.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground">{p.nombre}</p>
                            {p.en_oferta && <Badge variant="danger" className="text-[10px] px-1.5 py-0">OFERTA</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{p.codigo_barras || p.sku || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.categoria_nombre ? (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Tag size={10} /> {p.categoria_nombre}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums font-mono text-xs">
                      {formatCurrency(p.precio_costo)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.en_oferta ? (
                        <div>
                          <p className="font-bold text-rose-500 font-mono text-xs">{formatCurrency(p.precio_vigente)}</p>
                          <p className="text-xs text-muted-foreground line-through font-mono">{formatCurrency(p.precio_venta)}</p>
                        </div>
                      ) : (
                        <p className="font-semibold font-mono text-xs">{formatCurrency(p.precio_venta)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "font-semibold text-xs px-2 py-0.5 rounded-full",
                        Number(p.margen_ganancia) >= 20
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {Number(p.margen_ganancia).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("font-bold tabular-nums text-sm font-mono", p.stock_bajo ? "text-rose-500" : "text-foreground")}>
                          {Number(p.stock_actual).toFixed(p.tipo === "GRANEL" ? 2 : 0)}
                          <span className="text-xs text-muted-foreground ml-1">{p.unidad_medida}</span>
                        </span>
                        {p.stock_bajo && (
                          <div className="flex items-center gap-1 text-[10px] text-rose-500">
                            <AlertTriangle size={9} /> Stock bajo
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.activo ? "ACTIVO" : "INACTIVO"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(p)}>
                          <Edit2 size={13} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/kardex?producto=${p.id}&nombre=${encodeURIComponent(p.nombre)}`)}>
                          <ScrollText size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Vista Grid */}
      {vista === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loading ? (
            [...Array(10)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-full h-32 rounded-lg mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-3" />
                  <Skeleton className="h-6 w-full" />
                </CardContent>
              </Card>
            ))
          ) : productos.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={Package} title="No hay productos" action={{ label: "Nuevo producto", onClick: abrirCrear }} />
            </div>
          ) : productos.map((p) => {
            const pct = Number(p.stock_minimo) > 0
              ? Math.min((Number(p.stock_actual) / Number(p.stock_minimo)) * 100, 100)
              : 100;
            return (
              <Card key={p.id} className="group hover:shadow-md transition-all overflow-hidden cursor-pointer" onClick={() => abrirEditar(p)}>
                <div className="h-28 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 flex items-center justify-center relative">
                  <span className="text-4xl font-black text-brand-200 dark:text-brand-800 select-none">
                    {p.nombre.charAt(0).toUpperCase()}
                  </span>
                  {p.en_oferta && (
                    <Badge variant="danger" className="absolute top-2 right-2 text-[10px]">OFERTA</Badge>
                  )}
                  {p.stock_bajo && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
                      <AlertTriangle size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">{p.nombre}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku || p.codigo_barras || "—"}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-brand-600">{formatCurrency(p.en_oferta ? p.precio_vigente : p.precio_venta)}</span>
                    {p.categoria_nombre && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">{p.categoria_nombre}</Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Stock: {Number(p.stock_actual).toFixed(0)} {p.unidad_medida}</span>
                      <span>Mín: {p.stock_minimo}</span>
                    </div>
                    <Progress value={pct} className={cn("h-1", p.stock_bajo ? "[&>div]:bg-rose-500" : pct < 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sheet drawer crear/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center">
                <Package size={17} className="text-brand-600" />
              </div>
              <SheetTitle>{modal === "crear" ? "Nuevo Producto" : "Editar Producto"}</SheetTitle>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="activo-switch" className="text-xs text-muted-foreground">
                  {form.activo ? "Activo" : "Inactivo"}
                </Label>
                <Switch
                  id="activo-switch"
                  checked={form.activo}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, activo: v }))}
                />
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs defaultValue="general">
              <TabsList className="w-full mb-5">
                <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                <TabsTrigger value="precios" className="flex-1">Precios & Stock</TabsTrigger>
                <TabsTrigger value="detalles" className="flex-1">Detalles</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-0">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:border-brand-400 hover:text-brand-500 transition-colors shrink-0 group">
                    <Camera size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] mt-1 font-medium">Foto</span>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs mb-1.5 block">Nombre *</Label>
                    <Input value={form.nombre} onChange={f("nombre")} placeholder="Ej: Arroz Cristal 1lb" autoFocus />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">SKU</Label>
                    <div className="relative">
                      <Input value={form.sku} onChange={f("sku")} placeholder="SKU-001" className="pr-20" />
                      <button type="button"
                        onClick={() => setForm((p) => ({ ...p, sku: `SKU-${Date.now().toString().slice(-5)}` }))}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold transition-colors">
                        <Sparkles size={10} /> Auto
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Código de barras</Label>
                    <div className="relative">
                      <Input value={form.codigo_barras} onChange={f("codigo_barras")} placeholder="7891234567890" className="pr-9" />
                      <ScanBarcode size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Categoría</Label>
                    <CustomSelect value={form.categoria} onChange={(v) => setForm((p) => ({ ...p, categoria: v }))}
                      placeholder="Sin categoría"
                      options={[{ value: "", label: "Sin categoría" }, ...categorias.map((c) => ({ value: String(c.id), label: c.nombre }))]} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Tipo</Label>
                    <CustomSelect value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
                      options={[{ value: "UNIDAD", label: "Por unidad" }, { value: "GRANEL", label: "A granel" }]} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs mb-1.5 block">Proveedor</Label>
                    <Input value={form.proveedor} onChange={f("proveedor")} placeholder="Nombre del proveedor (opcional)" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="precios" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Precio costo (RD$)</Label>
                    <Input type="number" value={form.precio_costo} onChange={f("precio_costo")} placeholder="0.00" step="0.01" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Precio venta (RD$) *</Label>
                    <Input type="number" value={form.precio_venta} onChange={f("precio_venta")} placeholder="0.00" step="0.01" />
                  </div>
                </div>

                {margen !== null && (
                  <div className={cn(
                    "rounded-xl px-4 py-3 flex items-center justify-between text-sm font-medium border",
                    margen >= 15
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                      : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900"
                  )}>
                    <span>Margen: <strong>{margen.toFixed(1)}%</strong></span>
                    <span>Ganancia: <strong>{formatCurrency(Number(form.precio_venta) - Number(form.precio_costo))}</strong></span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Unidad de medida</Label>
                    <CustomSelect value={form.unidad_medida} onChange={(v) => setForm((p) => ({ ...p, unidad_medida: v }))}
                      options={UNIDADES.map((u) => ({ value: u, label: u }))} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Unidades por caja</Label>
                    <Input type="number" min="1" value={form.unidades_por_caja} onChange={f("unidades_por_caja")} placeholder="Ej: 12" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Stock actual</Label>
                    <Input type="number" value={form.stock_actual} onChange={f("stock_actual")} step="0.001" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Stock mínimo</Label>
                    <Input type="number" value={form.stock_minimo} onChange={f("stock_minimo")} step="0.001" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">ITBIS (18%)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Activar si el producto está gravado</p>
                  </div>
                  <Switch
                    checked={!form.itbis_exento}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, itbis_exento: !v }))}
                  />
                </div>

                <div className="rounded-xl border border-dashed border-rose-200 dark:border-rose-800 p-4 space-y-3 bg-rose-50/30 dark:bg-rose-950/10">
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Precio de oferta (opcional)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] mb-1 block">Precio (RD$)</Label>
                      <Input type="number" value={form.precio_oferta} onChange={f("precio_oferta")} placeholder="0.00" step="0.01" className="border-rose-200" />
                    </div>
                    <div>
                      <Label className="text-[10px] mb-1 block">Desde</Label>
                      <Input type="date" value={form.oferta_inicio} onChange={f("oferta_inicio")} className="border-rose-200" />
                    </div>
                    <div>
                      <Label className="text-[10px] mb-1 block">Hasta</Label>
                      <Input type="date" value={form.oferta_fin} onChange={f("oferta_fin")} className="border-rose-200" />
                    </div>
                  </div>
                  {form.precio_oferta && form.precio_venta && (
                    <p className="text-xs text-rose-600 font-semibold">
                      Descuento: {(((Number(form.precio_venta) - Number(form.precio_oferta)) / Number(form.precio_venta)) * 100).toFixed(1)}% off
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="detalles" className="space-y-4 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Fecha de vencimiento</Label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <input type="checkbox" checked={form.sin_vencimiento}
                        onChange={(e) => setForm((p) => ({ ...p, sin_vencimiento: e.target.checked, fecha_vencimiento: e.target.checked ? "" : p.fecha_vencimiento }))}
                        className="w-3.5 h-3.5 accent-brand-600" />
                      No aplica
                    </label>
                  </div>
                  <Input type="date" value={form.fecha_vencimiento} onChange={f("fecha_vencimiento")}
                    disabled={form.sin_vencimiento} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Notas internas</Label>
                  <textarea
                    value={form.notas}
                    onChange={f("notas")}
                    rows={4}
                    placeholder="Observaciones internas (opcional)..."
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="flex-1 gap-2">
              {guardando
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Guardando...</>
                : <><Check size={14} /> Guardar</>
              }
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
