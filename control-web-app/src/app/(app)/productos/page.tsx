"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Edit2, AlertTriangle, Package,
  X, Check, Filter, ScanBarcode, Sparkles, Camera,
  ChevronRight, ScrollText,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Producto, Categoria } from "@/types";
import CustomSelect from "@/components/CustomSelect";

const UNIDADES = ["unidad", "libra", "onza", "galón", "caja", "docena", "litro"];

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

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

const inputCls = "border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150 bg-white";

export default function ProductosPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [filtroCat, setFiltroCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormData>(FORM_EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [tabModal, setTabModal] = useState<"general" | "precios" | "detalles">("general");

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

  function abrirCrear() { setForm(FORM_EMPTY); setEditando(null); setModal("crear"); }
  function abrirEditar(p: Producto) {
    setForm({
      nombre: p.nombre, sku: p.sku, codigo_barras: p.codigo_barras,
      categoria: String(p.categoria ?? ""), tipo: p.tipo,
      unidad_medida: p.unidad_medida, precio_costo: p.precio_costo,
      precio_venta: p.precio_venta, stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo, fecha_vencimiento: p.fecha_vencimiento ?? "",
      activo: p.activo, proveedor: p.proveedor ?? "",
      unidades_por_caja: p.unidades_por_caja != null ? String(p.unidades_por_caja) : "",
      itbis_exento: p.itbis_exento ?? false,
      notas: p.notas ?? "",
      sin_vencimiento: !p.fecha_vencimiento,
      precio_oferta: p.precio_oferta ?? "",
      oferta_inicio: p.oferta_inicio ?? "",
      oferta_fin: p.oferta_fin ?? "",
    });
    setEditando(p); setModal("editar");
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
      setModal(null); cargar();
    } catch { toast.error("Error al guardar el producto"); }
    setGuardando(false);
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const margen = form.precio_costo && form.precio_venta
    ? (((Number(form.precio_venta) - Number(form.precio_costo)) / Number(form.precio_costo)) * 100)
    : null;

  const stockBajoCount = productos.filter(p => p.stock_bajo).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Productos</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {productos.length} productos
            {stockBajoCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 font-semibold">
                <AlertTriangle size={12} /> {stockBajoCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Buscar por nombre, código, SKU..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150" />
        </div>
        <CustomSelect
          value={filtroCat}
          onChange={setFiltroCat}
          placeholder="Todas las categorías"
          options={[
            { value: "", label: "Todas las categorías" },
            ...categorias.map((c) => ({ value: String(c.id), label: c.nombre })),
          ]}
          className="min-w-44"
        />
        <button onClick={() => setFiltroStockBajo((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
            filtroStockBajo ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          }`}>
          <Filter size={14} /> Stock bajo
          {filtroStockBajo && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3.5 text-left">Producto</th>
                <th className="px-4 py-3.5 text-left">Categoría</th>
                <th className="px-4 py-3.5 text-right">Costo</th>
                <th className="px-4 py-3.5 text-right">Precio</th>
                <th className="px-4 py-3.5 text-right">Margen</th>
                <th className="px-4 py-3.5 text-center">Stock</th>
                <th className="px-4 py-3.5 text-center">Tipo</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(9)].map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded-lg animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : productos.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-slate-400">
                  <Package size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No hay productos</p>
                  <p className="text-xs text-slate-300 mt-1">Crea el primero con el botón de arriba</p>
                </td></tr>
              ) : productos.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors duration-150">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{p.nombre}</p>
                      {p.en_oferta && (
                        <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">OFERTA</span>
                      )}
                      {(p.reglas_descuento?.length ?? 0) > 0 && (
                        <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">Vol.</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{p.codigo_barras || p.sku || "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{p.categoria_nombre || "—"}</td>
                  <td className="px-4 py-3.5 text-right text-slate-500 tabular-nums">RD${Number(p.precio_costo).toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {p.en_oferta ? (
                      <div>
                        <p className="font-bold text-red-500">RD${Number(p.precio_vigente).toFixed(2)}</p>
                        <p className="text-xs text-slate-400 line-through">RD${Number(p.precio_venta).toFixed(2)}</p>
                      </div>
                    ) : (
                      <p className="font-semibold text-slate-800">RD${Number(p.precio_venta).toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                      Number(p.margen_ganancia) >= 20 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {Number(p.margen_ganancia).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`font-bold tabular-nums ${p.stock_bajo ? "text-red-500" : "text-slate-700"}`}>
                      {Number(p.stock_actual).toFixed(p.tipo === "GRANEL" ? 2 : 0)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">{p.unidad_medida}</span>
                    {p.stock_bajo && <AlertTriangle size={11} className="inline ml-1 text-red-400 animate-pulse" />}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge color={p.tipo === "GRANEL" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}>
                      {p.tipo === "GRANEL" ? "Granel" : "Unidad"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge color={p.activo ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEditar(p)} title="Editar"
                        className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-all duration-150 active:scale-90">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => router.push(`/kardex?producto=${p.id}&nombre=${encodeURIComponent(p.nombre)}`)} title="Ver Kardex"
                        className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-all duration-150 active:scale-90">
                        <ScrollText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Package size={17} className="text-indigo-600" />
              </div>
              <h2 className="font-bold text-slate-800 text-base flex-1">
                {modal === "crear" ? "Nuevo Producto" : "Editar Producto"}
              </h2>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, activo: !p.activo }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  form.activo ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-500"
                }`}>
                <span className={`w-2 h-2 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-slate-400"}`} />
                {form.activo ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => { setModal(null); setTabModal("general"); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-slate-100 shrink-0 px-2">
              {(["general", "precios", "detalles"] as const).map((t, i) => {
                const labels = ["General", "Precios & Stock", "Detalles"];
                return (
                  <button key={t} onClick={() => setTabModal(t)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                      tabModal === t ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
                    }`}>
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                      tabModal === t ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
                    }`}>{i + 1}</span>
                    {labels[i]}
                    {i < 2 && <ChevronRight size={12} className="text-slate-300 ml-1" />}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tabModal === "general" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 cursor-pointer hover:border-indigo-300 hover:text-indigo-400 transition-colors shrink-0 group">
                      <Camera size={22} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] mt-1 font-medium">Foto</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre *</label>
                      <input value={form.nombre} onChange={f("nombre")} placeholder="Ej: Arroz Cristal 1lb"
                        className={`${inputCls} w-full`} autoFocus />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</label>
                      <div className="relative">
                        <input value={form.sku} onChange={f("sku")} placeholder="SKU-001" className={`${inputCls} w-full pr-20`} />
                        <button type="button"
                          onClick={() => setForm((p) => ({ ...p, sku: `SKU-${Date.now().toString().slice(-5)}` }))}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold transition-colors">
                          <Sparkles size={11} /> Generar
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Código de barras</label>
                      <div className="relative">
                        <input value={form.codigo_barras} onChange={f("codigo_barras")} placeholder="7891234567890"
                          className={`${inputCls} w-full pr-10`} />
                        <button type="button" onClick={() => {}}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors">
                          <ScanBarcode size={17} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</label>
                      <CustomSelect value={form.categoria} onChange={(v) => setForm((p) => ({ ...p, categoria: v }))}
                        placeholder="Sin categoría"
                        options={[{ value: "", label: "Sin categoría" }, ...categorias.map((c) => ({ value: String(c.id), label: c.nombre }))]} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
                      <CustomSelect value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
                        options={[{ value: "UNIDAD", label: "Por unidad" }, { value: "GRANEL", label: "A granel" }]} />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proveedor</label>
                      <input value={form.proveedor} onChange={f("proveedor")} placeholder="Ej: Distribuidora El Sol (opcional)" className={`${inputCls} w-full`} />
                    </div>
                  </div>
                </div>
              )}

              {tabModal === "precios" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio costo (RD$)</label>
                      <input type="number" value={form.precio_costo} onChange={f("precio_costo")} placeholder="0.00" step="0.01" className={`${inputCls} w-full`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio venta (RD$) *</label>
                      <input type="number" value={form.precio_venta} onChange={f("precio_venta")} placeholder="0.00" step="0.01" className={`${inputCls} w-full`} />
                    </div>
                  </div>
                  {margen !== null && (
                    <div className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm font-medium ${
                      margen >= 15 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                    }`}>
                      <span>Margen: <strong>{margen.toFixed(1)}%</strong></span>
                      <span>Ganancia: <strong>RD${(Number(form.precio_venta) - Number(form.precio_costo)).toFixed(2)}</strong></span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidad de medida</label>
                      <CustomSelect value={form.unidad_medida} onChange={(v) => setForm((p) => ({ ...p, unidad_medida: v }))}
                        options={UNIDADES.map((u) => ({ value: u, label: u }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidades por caja/fardo</label>
                      <input type="number" min="1" value={form.unidades_por_caja} onChange={f("unidades_por_caja")} placeholder="Ej: 12" className={`${inputCls} w-full`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock actual</label>
                      <input type="number" value={form.stock_actual} onChange={f("stock_actual")} step="0.001" className={`${inputCls} w-full`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock mínimo</label>
                      <input type="number" value={form.stock_minimo} onChange={f("stock_minimo")} step="0.001" className={`${inputCls} w-full`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">ITBIS (18%)</p>
                      <p className="text-xs text-slate-400 mt-0.5">Activa si el producto es gravado con ITBIS</p>
                    </div>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, itbis_exento: !p.itbis_exento }))}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.itbis_exento ? "bg-slate-200" : "bg-indigo-500"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${form.itbis_exento ? "left-0.5" : "left-5"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 -mt-2 px-1">Estado actual: <span className="font-semibold">{form.itbis_exento ? "Exento de ITBIS" : "Gravado con ITBIS"}</span></p>

                  {/* Oferta temporal */}
                  <div className="border border-dashed border-red-200 rounded-xl p-4 space-y-3 bg-red-50/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Precio de oferta</span>
                      <span className="text-[10px] text-red-400 font-medium">(opcional — deja vacío para desactivar)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Precio oferta (RD$)</label>
                        <input type="number" value={form.precio_oferta} onChange={f("precio_oferta")}
                          placeholder="0.00" step="0.01"
                          className="border border-red-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Desde</label>
                        <input type="date" value={form.oferta_inicio} onChange={f("oferta_inicio")}
                          className="border border-red-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Hasta</label>
                        <input type="date" value={form.oferta_fin} onChange={f("oferta_fin")}
                          className="border border-red-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white w-full" />
                      </div>
                    </div>
                    {form.precio_oferta && form.precio_venta && (
                      <p className="text-xs text-red-600 font-semibold">
                        Descuento: {(((Number(form.precio_venta) - Number(form.precio_oferta)) / Number(form.precio_venta)) * 100).toFixed(1)}% off
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tabModal === "detalles" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha de vencimiento</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
                        <input type="checkbox" checked={form.sin_vencimiento}
                          onChange={(e) => setForm((p) => ({ ...p, sin_vencimiento: e.target.checked, fecha_vencimiento: e.target.checked ? "" : p.fecha_vencimiento }))}
                          className="w-3.5 h-3.5 accent-indigo-600" />
                        No aplica
                      </label>
                    </div>
                    <input type="date" value={form.fecha_vencimiento} onChange={f("fecha_vencimiento")}
                      disabled={form.sin_vencimiento}
                      className={`${inputCls} w-full disabled:opacity-40 disabled:cursor-not-allowed`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas internas</label>
                    <textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                      rows={4} placeholder="Observaciones internas (opcional)..."
                      className={`${inputCls} w-full resize-none`} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => { setModal(null); setTabModal("general"); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors duration-150 active:scale-95">
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
