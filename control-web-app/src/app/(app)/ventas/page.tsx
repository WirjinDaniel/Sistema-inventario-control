'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Search, Filter, ChevronDown, ChevronUp,
  ShoppingCart, CreditCard, Building2, Banknote, AlertTriangle, X, Check,
} from 'lucide-react';
import type { Venta } from '@/types';
import { useAuthStore } from '@/store/auth';

interface VentaItem {
  id: number;
  producto_nombre: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
}

interface VentaDetalle extends Venta {
  items: VentaItem[];
  itbis: string;
  descuento: string;
  nota: string;
}

const METODO_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  EFECTIVO:     { label: 'Efectivo',     color: 'bg-emerald-50 text-emerald-700', Icon: Banknote },
  TARJETA:      { label: 'Tarjeta',      color: 'bg-blue-50 text-blue-700',       Icon: CreditCard },
  TRANSFERENCIA:{ label: 'Transferencia',color: 'bg-violet-50 text-violet-700',   Icon: Building2 },
  FIADO:        { label: 'Fiado',        color: 'bg-amber-50 text-amber-700',     Icon: ShoppingCart },
};

const fmt = (v: string | number) =>
  `RD$${Number(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';

export default function VentasPage() {
  const { esAdmin } = useAuthStore();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set('search', busqueda);
      if (filtroMetodo) params.set('metodo_pago', filtroMetodo);
      if (filtroEstado) params.set('estado', filtroEstado);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      const { data } = await api.get(`/ventas/?${params}`);
      setVentas(data.results ?? data);
    } catch { toast.error('Error cargando ventas'); }
    setLoading(false);
  }, [busqueda, filtroMetodo, filtroEstado, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  async function verDetalle(id: number) {
    if (expandedId === id) { setExpandedId(null); setDetalle(null); return; }
    setExpandedId(id);
    setLoadingDetalle(true);
    try {
      const { data } = await api.get(`/ventas/${id}/`);
      setDetalle(data);
    } catch { toast.error('Error cargando detalle'); }
    setLoadingDetalle(false);
  }

  async function anular(id: number) {
    if (!confirm('¿Anular esta venta? Esta acción es irreversible.')) return;
    setAnulando(id);
    try {
      await api.post(`/ventas/${id}/anular/`);
      toast.success('Venta anulada');
      cargar();
      if (expandedId === id) { setExpandedId(null); setDetalle(null); }
    } catch { toast.error('Error al anular la venta'); }
    setAnulando(null);
  }

  const totalGeneral = ventas
    .filter(v => v.estado === 'COMPLETADA')
    .reduce((s, v) => s + Number(v.total), 0);

  const hayFiltros = busqueda || filtroMetodo || filtroEstado || fechaDesde || fechaHasta;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Ventas</h1>
          <p className="text-slate-400 text-sm mt-0.5">{ventas.length} registros · Total: {fmt(totalGeneral)}</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <BookOpen size={15} className="text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-600">{ventas.filter(v => v.estado === 'COMPLETADA').length} completadas</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="relative col-span-2 lg:col-span-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-8 w-full`} placeholder="Cliente, cajero..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los métodos</option>
            {Object.entries(METODO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los estados</option>
            <option value="COMPLETADA">Completada</option>
            <option value="ANULADA">Anulada</option>
          </select>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={`${inputCls} w-full`} />
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={`${inputCls} w-full`} />
        </div>
        {hayFiltros && (
          <button onClick={() => { setBusqueda(''); setFiltroMetodo(''); setFiltroEstado(''); setFechaDesde(''); setFechaHasta(''); }}
            className="text-xs text-red-500 font-semibold hover:underline flex items-center gap-1">
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : ventas.length === 0 ? (
          <div className="p-16 text-center">
            <Filter size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-400">No hay ventas{hayFiltros ? ' con estos filtros' : ''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Fecha / Hora', 'Cliente', 'Cajero', 'Método', 'Total', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ventas.map(v => {
                  const metodo = METODO_CONFIG[v.metodo_pago] ?? { label: v.metodo_pago, color: 'bg-slate-100 text-slate-600', Icon: ShoppingCart };
                  const MIcon = metodo.Icon;
                  const isExpanded = expandedId === v.id;
                  const anulada = v.estado === 'ANULADA';
                  const hoy = new Date().toDateString() === new Date(v.fecha).toDateString();

                  return (
                    <>
                      <tr key={v.id}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${anulada ? 'opacity-50' : ''}`}
                        onClick={() => verDetalle(v.id)}>
                        <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">{v.cliente_nombre ?? <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-5 py-3.5 text-slate-500">{v.cajero_nombre}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${metodo.color}`}>
                            <MIcon size={11} /> {metodo.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 tabular-nums">{fmt(v.total)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            anulada ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {anulada ? <><AlertTriangle size={10} /> Anulada</> : <><Check size={10} /> Completada</>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${v.id}-det`} className="bg-indigo-50/20">
                          <td colSpan={7} className="px-5 py-4">
                            {loadingDetalle ? (
                              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                            ) : detalle && detalle.id === v.id ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                  {detalle.items.map(item => (
                                    <div key={item.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center justify-between gap-2">
                                      <span className="text-slate-700 font-medium truncate">{item.producto_nombre}</span>
                                      <span className="text-slate-400 shrink-0">{item.cantidad} × {fmt(item.precio_unitario)}</span>
                                      <span className="font-semibold text-slate-800 shrink-0">{fmt(item.subtotal)}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-slate-500 space-x-4">
                                    {Number(detalle.descuento) > 0 && <span>Descuento: <strong className="text-red-500">-{fmt(detalle.descuento)}</strong></span>}
                                    {Number(detalle.itbis) > 0 && <span>ITBIS: <strong>{fmt(detalle.itbis)}</strong></span>}
                                    {detalle.nota && <span>Nota: <em>{detalle.nota}</em></span>}
                                  </div>
                                  {esAdmin() && !anulada && hoy && (
                                    <button onClick={(e) => { e.stopPropagation(); anular(v.id); }}
                                      disabled={anulando === v.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors disabled:opacity-50">
                                      <AlertTriangle size={12} /> {anulando === v.id ? 'Anulando...' : 'Anular venta'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : null}
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
    </div>
  );
}
