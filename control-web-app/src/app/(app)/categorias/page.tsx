'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, X, Check, Pencil, Trash2, Loader2,
  Tag, Globe, Package, Layers,
} from 'lucide-react';
import type { Categoria } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth';
import { AccessDenied } from '@/components/shared/AccessDenied';

interface Marca {
  id: number;
  nombre: string;
  pais_origen: string;
  activo: boolean;
  total_productos: number;
}

const COLORES_PRESET = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#1c1e1b',
];

const ICONOS_PRESET = [
  'package', 'shopping-cart', 'coffee', 'beef', 'milk', 'fish',
  'apple', 'cookie', 'beer', 'wine', 'flame', 'sparkles',
  'shirt', 'pill', 'droplets', 'zap', 'truck', 'box',
];

const inputCls = 'w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 bg-card transition';

const catSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido.'),
  color: z.string(),
  icono: z.string(),
});
type CatForm = z.infer<typeof catSchema>;

const marcaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido.'),
  pais_origen: z.string().optional(),
});
type MarcaForm = z.infer<typeof marcaSchema>;

export default function CategoriasPage() {
  const { esAdmin, esSuperadmin, usuario } = useAuthStore();
  const [tab, setTab] = useState<'categorias' | 'marcas'>('categorias');

  // ── Categorías ──────────────────────────────────────
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [modalCat, setModalCat] = useState<'crear' | 'editar' | null>(null);
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null);
  const [guardandoCat, setGuardandoCat] = useState(false);

  const { register: regCat, handleSubmit: handleCat, watch: watchCat, setValue: setCatVal, reset: resetCat, formState: { errors: errCat } } =
    useForm<CatForm>({ resolver: zodResolver(catSchema), defaultValues: { nombre: '', color: '#6366f1', icono: 'package' } });
  const formCat = { color: watchCat('color'), icono: watchCat('icono'), nombre: watchCat('nombre') };

  const cargarCategorias = useCallback(async () => {
    setLoadingCat(true);
    try {
      const { data } = await api.get('/inventario/categorias/');
      setCategorias(data.results ?? data);
    } catch { toast.error('Error cargando categorías'); }
    setLoadingCat(false);
  }, []);

  useEffect(() => { cargarCategorias(); }, [cargarCategorias]);

  function abrirCrearCat() {
    resetCat({ nombre: '', color: '#6366f1', icono: 'package' });
    setEditandoCat(null);
    setModalCat('crear');
  }
  function abrirEditarCat(c: Categoria) {
    resetCat({ nombre: c.nombre, color: c.color, icono: c.icono });
    setEditandoCat(c);
    setModalCat('editar');
  }
  const onGuardarCat = handleCat(async (data) => {
    setGuardandoCat(true);
    try {
      if (modalCat === 'crear') await api.post('/inventario/categorias/', data);
      else await api.patch(`/inventario/categorias/${editandoCat!.id}/`, data);
      toast.success(modalCat === 'crear' ? 'Categoría creada' : 'Categoría actualizada');
      setModalCat(null);
      cargarCategorias();
    } catch { toast.error('Error al guardar'); }
    setGuardandoCat(false);
  });
  async function eliminarCat(c: Categoria) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    try {
      await api.patch(`/inventario/categorias/${c.id}/`, { activo: false });
      toast.success('Categoría eliminada');
      cargarCategorias();
    } catch { toast.error('Error al eliminar'); }
  }

  // ── Marcas ──────────────────────────────────────────
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loadingMarca, setLoadingMarca] = useState(true);
  const [modalMarca, setModalMarca] = useState<'crear' | 'editar' | null>(null);
  const [editandoMarca, setEditandoMarca] = useState<Marca | null>(null);
  const [guardandoMarca, setGuardandoMarca] = useState(false);

  const { register: regMarca, handleSubmit: handleMarca, reset: resetMarca, formState: { errors: errMarca } } =
    useForm<MarcaForm>({ resolver: zodResolver(marcaSchema), defaultValues: { nombre: '', pais_origen: '' } });

  const cargarMarcas = useCallback(async () => {
    setLoadingMarca(true);
    try {
      const { data } = await api.get('/inventario/marcas/');
      setMarcas(data.results ?? data);
    } catch { toast.error('Error cargando marcas'); }
    setLoadingMarca(false);
  }, []);

  useEffect(() => { if (tab === 'marcas') cargarMarcas(); }, [tab, cargarMarcas]);

  function abrirCrearMarca() {
    resetMarca({ nombre: '', pais_origen: '' });
    setEditandoMarca(null);
    setModalMarca('crear');
  }
  function abrirEditarMarca(m: Marca) {
    resetMarca({ nombre: m.nombre, pais_origen: m.pais_origen });
    setEditandoMarca(m);
    setModalMarca('editar');
  }
  const onGuardarMarca = handleMarca(async (data) => {
    setGuardandoMarca(true);
    try {
      if (modalMarca === 'crear') await api.post('/inventario/marcas/', data);
      else await api.patch(`/inventario/marcas/${editandoMarca!.id}/`, data);
      toast.success(modalMarca === 'crear' ? 'Marca creada' : 'Marca actualizada');
      setModalMarca(null);
      cargarMarcas();
    } catch { toast.error('Error al guardar'); }
    setGuardandoMarca(false);
  });
  async function eliminarMarca(m: Marca) {
    if (!confirm(`¿Eliminar la marca "${m.nombre}"?`)) return;
    try {
      await api.patch(`/inventario/marcas/${m.id}/`, { activo: false });
      toast.success('Marca eliminada');
      cargarMarcas();
    } catch { toast.error('Error al eliminar'); }
  }

  if (!esAdmin() && !esSuperadmin() && usuario?.rol !== "INVENTARIO") return <AccessDenied />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <Layers size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Catálogo</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestión de categorías y marcas de productos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {(['categorias', 'marcas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-card shadow text-brand-600' : 'text-muted-foreground hover:text-foreground'}`}>
                {t === 'categorias' ? <Layers size={13} /> : <Tag size={13} />}
                {t === 'categorias' ? 'Categorías' : 'Marcas'}
              </button>
            ))}
          </div>
          <button
            onClick={tab === 'categorias' ? abrirCrearCat : abrirCrearMarca}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-brand-600 to-indigo-600 text-white text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <Plus size={15} />
            {tab === 'categorias' ? 'Nueva categoría' : 'Nueva marca'}
          </button>
        </div>
      </div>

      {/* ── CATEGORÍAS ── */}
      {tab === 'categorias' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loadingCat ? (
            [...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))
          ) : categorias.length === 0 ? (
            <div className="col-span-full bg-card rounded-2xl border border-border p-14 text-center">
              <Layers size={44} className="mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-medium text-muted-foreground">Sin categorías</p>
            </div>
          ) : categorias.map(c => (
            <div key={c.id} className="relative bg-card border border-border rounded-2xl p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent"
                style={{ backgroundImage: `linear-gradient(to right, transparent, ${c.color}99, transparent)` }} />
              <div className="flex items-start justify-between mb-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: c.color }}>
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/30 to-transparent" />
                  <Package size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => abrirEditarCat(c)}
                    className="p-1.5 rounded-lg hover:bg-brand-50 text-muted-foreground hover:text-brand-600 transition-colors">
                    <Pencil size={13} />
                  </button>
                  {esSuperadmin() && (
                  <button onClick={() => eliminarCat(c)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                  )}
                </div>
              </div>
              <p className="font-bold text-foreground text-sm">{c.nombre}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(c as Categoria & { total_productos?: number }).total_productos ?? 0} productos</p>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full w-full" style={{ backgroundColor: c.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MARCAS ── */}
      {tab === 'marcas' && (
        <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
          {loadingMarca ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : marcas.length === 0 ? (
            <div className="p-14 text-center">
              <Tag size={44} className="mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-medium text-muted-foreground">Sin marcas registradas</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">Marca</th>
                  <th className="text-left px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">País de origen</th>
                  <th className="text-center px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">Productos</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {marcas.map(m => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                          <Tag size={12} className="text-white" />
                        </div>
                        <span className="font-semibold text-foreground">{m.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {m.pais_origen ? (
                        <div className="flex items-center gap-1.5">
                          <Globe size={13} className="text-muted-foreground/60" />
                          {m.pais_origen}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                        {m.total_productos}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEditarMarca(m)}
                          className="p-1.5 rounded-lg hover:bg-brand-50 text-muted-foreground hover:text-brand-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {esSuperadmin() && (
                        <button onClick={() => eliminarMarca(m)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODAL CATEGORÍA ── */}
      {modalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Layers size={15} className="text-white" />
                </div>
                <h2 className="font-bold text-foreground">{modalCat === 'crear' ? 'Nueva categoría' : 'Editar categoría'}</h2>
              </div>
              <button onClick={() => setModalCat(null)} className="text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
            </div>
            <form onSubmit={onGuardarCat} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Nombre *</label>
                <input className={inputCls} placeholder="Ej: Bebidas, Lácteos, Abarrotes..."
                  aria-required="true" aria-invalid={!!errCat.nombre} {...regCat('nombre')} />
                {errCat.nombre && <p role="alert" className="text-xs text-rose-500 mt-1">{errCat.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_PRESET.map(color => (
                    <button type="button" key={color} onClick={() => setCatVal('color', color, { shouldDirty: true })}
                      className={`w-8 h-8 rounded-lg transition-all shadow-sm ${formCat.color === color ? 'ring-2 ring-offset-2 ring-brand-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                  <input type="color" value={formCat.color}
                    onChange={e => setCatVal('color', e.target.value, { shouldDirty: true })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Ícono (nombre Lucide)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ICONOS_PRESET.map(ic => (
                    <button type="button" key={ic} onClick={() => setCatVal('icono', ic, { shouldDirty: true })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${formCat.icono === ic ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
                <input className={inputCls} placeholder="O escribe un ícono lucide personalizado"
                  {...regCat('icono')} />
              </div>
              {/* Preview */}
              <div className="bg-muted/40 border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: formCat.color }}>
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/30 to-transparent" />
                  <Package size={18} />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{formCat.nombre || 'Vista previa'}</p>
                  <p className="text-xs text-muted-foreground">Icono: {formCat.icono}</p>
                </div>
              </div>
              <div className="flex gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setModalCat(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-card text-muted-foreground font-semibold text-sm hover:bg-muted/50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoCat}
                  className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-brand-600 to-indigo-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {guardandoCat ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL MARCA ── */}
      {modalMarca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Tag size={14} className="text-white" />
                </div>
                <h2 className="font-bold text-foreground">{modalMarca === 'crear' ? 'Nueva marca' : 'Editar marca'}</h2>
              </div>
              <button onClick={() => setModalMarca(null)} className="text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
            </div>
            <form onSubmit={onGuardarMarca} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Nombre *</label>
                <input className={inputCls} placeholder="Ej: Presidente, Selecto, Rica..."
                  aria-required="true" aria-invalid={!!errMarca.nombre} {...regMarca('nombre')} />
                {errMarca.nombre && <p role="alert" className="text-xs text-rose-500 mt-1">{errMarca.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">País de origen</label>
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-muted-foreground/60 shrink-0" />
                  <input className={inputCls} placeholder="Ej: República Dominicana, EE.UU...." {...regMarca('pais_origen')} />
                </div>
              </div>
              <div className="flex gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setModalMarca(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-card text-muted-foreground font-semibold text-sm hover:bg-muted/50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoMarca}
                  className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-brand-600 to-indigo-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {guardandoMarca ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
