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

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de categorías y marcas de productos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['categorias', 'marcas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'categorias' ? <Layers size={13} /> : <Tag size={13} />}
                {t === 'categorias' ? 'Categorías' : 'Marcas'}
              </button>
            ))}
          </div>
          <button
            onClick={tab === 'categorias' ? abrirCrearCat : abrirCrearMarca}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
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
            <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-14 text-center text-slate-300">
              <Layers size={44} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-400">Sin categorías</p>
            </div>
          ) : categorias.map(c => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: c.color }}>
                  <Package size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => abrirEditarCat(c)}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Pencil size={13} />
                  </button>
                  {esSuperadmin() && (
                  <button onClick={() => eliminarCat(c)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                  )}
                </div>
              </div>
              <p className="font-bold text-slate-800 text-sm">{c.nombre}</p>
              <p className="text-xs text-slate-400 mt-0.5">{(c as Categoria & { total_productos?: number }).total_productos ?? 0} productos</p>
              <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: c.color + '33' }}>
                <div className="h-1 rounded-full w-full" style={{ backgroundColor: c.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MARCAS ── */}
      {tab === 'marcas' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          {loadingMarca ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : marcas.length === 0 ? (
            <div className="p-14 text-center text-slate-300">
              <Tag size={44} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-400">Sin marcas registradas</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Marca</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">País de origen</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Productos</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {marcas.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Tag size={13} className="text-indigo-600" />
                        </div>
                        <span className="font-semibold text-slate-800">{m.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {m.pais_origen ? (
                        <div className="flex items-center gap-1.5">
                          <Globe size={13} className="text-slate-400" />
                          {m.pais_origen}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        {m.total_productos}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEditarMarca(m)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {esSuperadmin() && (
                        <button onClick={() => eliminarMarca(m)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{modalCat === 'crear' ? 'Nueva categoría' : 'Editar categoría'}</h2>
              <button onClick={() => setModalCat(null)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <form onSubmit={onGuardarCat} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre *</label>
                <input className={inputCls} placeholder="Ej: Bebidas, Lácteos, Abarrotes..."
                  aria-required="true" aria-invalid={!!errCat.nombre} {...regCat('nombre')} />
                {errCat.nombre && <p role="alert" className="text-xs text-red-500 mt-1">{errCat.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_PRESET.map(color => (
                    <button type="button" key={color} onClick={() => setCatVal('color', color, { shouldDirty: true })}
                      className={`w-8 h-8 rounded-lg transition-all ${formCat.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                  <input type="color" value={formCat.color}
                    onChange={e => setCatVal('color', e.target.value, { shouldDirty: true })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ícono (nombre Lucide)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ICONOS_PRESET.map(ic => (
                    <button type="button" key={ic} onClick={() => setCatVal('icono', ic, { shouldDirty: true })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${formCat.icono === ic ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
                <input className={inputCls} placeholder="O escribe un ícono lucide personalizado"
                  {...regCat('icono')} />
              </div>
              {/* Preview */}
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: formCat.color }}>
                  <Package size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{formCat.nombre || 'Vista previa'}</p>
                  <p className="text-xs text-slate-400">Icono: {formCat.icono}</p>
                </div>
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalCat(null)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoCat}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{modalMarca === 'crear' ? 'Nueva marca' : 'Editar marca'}</h2>
              <button onClick={() => setModalMarca(null)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <form onSubmit={onGuardarMarca} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre *</label>
                <input className={inputCls} placeholder="Ej: Presidente, Selecto, Rica..."
                  aria-required="true" aria-invalid={!!errMarca.nombre} {...regMarca('nombre')} />
                {errMarca.nombre && <p role="alert" className="text-xs text-red-500 mt-1">{errMarca.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">País de origen</label>
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-slate-400 shrink-0" />
                  <input className={inputCls} placeholder="Ej: República Dominicana, EE.UU...." {...regMarca('pais_origen')} />
                </div>
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalMarca(null)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoMarca}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
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
