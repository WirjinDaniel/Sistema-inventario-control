'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ClipboardList, Plus, X, Check, Search, Clock,
  ChevronDown, ChevronUp, Truck, Package, AlertTriangle,
} from 'lucide-react';
import type { OrdenCompra, Suplidor, Producto } from '@/types';

const fmt = (v: string | number) =>
  `RD$${Number(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700' },
  RECIBIDA:  { label: 'Recibida',  color: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-50 text-red-600' },
};

interface LineaOrden { producto_id: string; producto_nombre: string; cantidad: string; precio_costo: string; }

const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';

export default function ComprasPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  // Formulario nueva orden
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [suplidorId, setSuplidorId] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaOrden[]>([{ producto_id: '', producto_nombre: '', cantidad: '1', precio_costo: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [busqProd, setBusqProd] = useState<Record<number, string>>({});
  const [resultsProd, setResultsProd] = useState<Record<number, Producto[]>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      const { data } = await api.get(`/compras/ordenes/?${params}`);
      setOrdenes(data.results ?? data);
    } catch { toast.error('Error cargando compras'); }
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (modal) {
      api.get('/compras/suplidores/').then(({ data }) => setSuplidores(data.results ?? data)).catch(() => {});
    }
  }, [modal]);

  async function buscarProducto(idx: number, q: string) {
    setBusqProd(p => ({ ...p, [idx]: q }));
    if (!q.trim()) { setResultsProd(p => ({ ...p, [idx]: [] })); return; }
    try {
      const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`);
      setResultsProd(p => ({ ...p, [idx]: (data.results ?? data).slice(0, 6) }));
    } catch { /* silencioso */ }
  }

  function seleccionarProducto(idx: number, prod: Producto) {
    setLineas(ls => ls.map((l, i) => i === idx
      ? { ...l, producto_id: String(prod.id), producto_nombre: prod.nombre, precio_costo: prod.precio_costo }
      : l));
    setBusqProd(p => ({ ...p, [idx]: '' }));
    setResultsProd(p => ({ ...p, [idx]: [] }));
  }

  function agregarLinea() {
    setLineas(ls => [...ls, { producto_id: '', producto_nombre: '', cantidad: '1', precio_costo: '' }]);
  }

  function eliminarLinea(idx: number) {
    setLineas(ls => ls.filter((_, i) => i !== idx));
  }

  const totalOrden = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio_costo || 0), 0);

  async function crearOrden() {
    if (!suplidorId) return toast.error('Selecciona un proveedor');
    const lineasValidas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!lineasValidas.length) return toast.error('Agrega al menos un producto');
    setGuardando(true);
    try {
      await api.post('/compras/ordenes/', {
        suplidor: suplidorId,
        numero_factura: numeroFactura,
        notas,
        items: lineasValidas.map(l => ({
          producto: l.producto_id,
          cantidad: l.cantidad,
          precio_costo: l.precio_costo,
        })),
      });
      toast.success('Orden de compra creada');
      setModal(false); setSuplidorId(''); setNumeroFactura(''); setNotas('');
      setLineas([{ producto_id: '', producto_nombre: '', cantidad: '1', precio_costo: '' }]);
      cargar();
    } catch { toast.error('Error al crear la orden'); }
    setGuardando(false);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Compras</h1>
          <p className="text-slate-400 text-sm mt-0.5">{ordenes.length} órdenes</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 transition-all duration-200 active:scale-95">
          <Plus size={16} /> Nueva orden
        </button>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2">
        {(['', 'PENDIENTE', 'RECIBIDA', 'CANCELADA'] as const).map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
              filtroEstado === e ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'
            }`}>
            {e === '' ? 'Todas' : ESTADO_CONFIG[e]?.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : ordenes.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardList size={44} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-400">No hay órdenes de compra</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Proveedor', 'N° Factura', 'Fecha', 'Total', 'Balance', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ordenes.map(o => {
                  const estado = ESTADO_CONFIG[o.estado] ?? { label: o.estado, color: 'bg-slate-100 text-slate-600' };
                  const isExp = expandedId === o.id;
                  return (
                    <>
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExp ? null : o.id)}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Truck size={14} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800">{o.suplidor_nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{o.numero_factura || `#${o.id}`}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">
                          <span className="flex items-center gap-1"><Clock size={11} /> {fmtFecha(o.fecha)}</span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700 tabular-nums">{fmt(o.total)}</td>
                        <td className={`px-4 py-3.5 font-bold tabular-nums ${Number(o.balance_pendiente) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {Number(o.balance_pendiente) > 0
                            ? <span className="flex items-center gap-1"><AlertTriangle size={11} /> {fmt(o.balance_pendiente)}</span>
                            : '✓ Pagado'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${estado.color}`}>{estado.label}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {o.estado === 'PENDIENTE' && (
                              <button onClick={e => { e.stopPropagation(); router.push(`/recepcion?orden=${o.id}`); }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
                                Recibir
                              </button>
                            )}
                            {isExp ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                          </div>
                        </td>
                      </tr>
                      {isExp && o.items && (
                        <tr key={`${o.id}-items`} className="bg-slate-50/50">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="grid grid-cols-3 gap-2">
                              {o.items.map(item => (
                                <div key={item.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-2 text-xs">
                                  <Package size={12} className="text-slate-400 shrink-0" />
                                  <span className="text-slate-700 font-medium truncate">{item.producto_nombre}</span>
                                  <span className="ml-auto text-slate-400 shrink-0">{item.cantidad} × {fmt(item.precio_costo)}</span>
                                </div>
                              ))}
                            </div>
                            {o.notas && <p className="text-xs text-slate-400 mt-2 italic">{o.notas}</p>}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nueva orden */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <ClipboardList size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-bold text-slate-800">Nueva Orden de Compra</h2>
              </div>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proveedor *</label>
                  <select value={suplidorId} onChange={e => setSuplidorId(e.target.value)} className={`${inputCls} w-full`}>
                    <option value="">Seleccionar...</option>
                    {suplidores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">N° Factura</label>
                  <input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)}
                    placeholder="Ej: B15001234" className={`${inputCls} w-full`} />
                </div>
              </div>

              {/* Líneas de productos */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos *</label>
                {lineas.map((linea, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 relative">
                      {linea.producto_nombre ? (
                        <div className="flex items-center gap-2 border border-indigo-300 rounded-xl px-3 py-2 bg-indigo-50">
                          <Package size={13} className="text-indigo-500 shrink-0" />
                          <span className="text-sm text-indigo-700 font-medium flex-1">{linea.producto_nombre}</span>
                          <button type="button" onClick={() => setLineas(ls => ls.map((l, i) => i === idx ? { ...l, producto_id: '', producto_nombre: '' } : l))}
                            className="text-indigo-400 hover:text-indigo-600"><X size={13} /></button>
                        </div>
                      ) : (
                        <>
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={busqProd[idx] ?? ''}
                            onChange={e => buscarProducto(idx, e.target.value)}
                            placeholder="Buscar producto..."
                            className={`${inputCls} w-full pl-8`}
                          />
                          {(resultsProd[idx] ?? []).length > 0 && (
                            <div className="absolute z-10 w-full mt-1 border border-slate-100 rounded-xl shadow-lg bg-white overflow-hidden">
                              {(resultsProd[idx] ?? []).map(p => (
                                <button key={p.id} type="button" onClick={() => seleccionarProducto(idx, p)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-left text-sm text-slate-700 border-b border-slate-50 last:border-0">
                                  <Package size={12} className="text-slate-400" />
                                  <span className="flex-1">{p.nombre}</span>
                                  <span className="text-xs text-slate-400">{fmt(p.precio_costo)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <input type="number" value={linea.cantidad} min="0.01" step="0.01"
                      onChange={e => setLineas(ls => ls.map((l, i) => i === idx ? { ...l, cantidad: e.target.value } : l))}
                      className={`${inputCls} w-20`} placeholder="Cant." />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">RD$</span>
                      <input type="number" value={linea.precio_costo} step="0.01"
                        onChange={e => setLineas(ls => ls.map((l, i) => i === idx ? { ...l, precio_costo: e.target.value } : l))}
                        className={`${inputCls} w-full pl-9`} placeholder="Costo" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 min-w-[80px] pt-2.5 text-right">
                      {fmt(Number(linea.cantidad || 0) * Number(linea.precio_costo || 0))}
                    </span>
                    {lineas.length > 1 && (
                      <button onClick={() => eliminarLinea(idx)} className="p-2 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors mt-0.5">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={agregarLinea}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:underline mt-1">
                  <Plus size={14} /> Agregar producto
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas</label>
                <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones (opcional)" className={`${inputCls} w-full`} />
              </div>

              <div className={`rounded-xl px-4 py-3 flex items-center justify-between font-semibold ${
                totalOrden > 0 ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400'
              }`}>
                <span className="text-sm">Total orden</span>
                <span className="text-lg">{fmt(totalOrden)}</span>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold">Cancelar</button>
              <button onClick={crearOrden} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Crear orden</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
