'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight, Search, TrendingUp, TrendingDown, RotateCcw, ShoppingCart,
} from 'lucide-react';

interface Movimiento {
  id: number;
  producto: number;
  producto_nombre: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA';
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  referencia: string;
  usuario_nombre: string;
  fecha: string;
  nota: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  ENTRADA: { label: 'Entrada',  color: 'bg-emerald-50 text-emerald-700', Icon: TrendingUp },
  SALIDA:  { label: 'Salida',   color: 'bg-red-50 text-red-600',         Icon: TrendingDown },
  AJUSTE:  { label: 'Ajuste',   color: 'bg-amber-50 text-amber-700',     Icon: RotateCcw },
  VENTA:   { label: 'Venta',    color: 'bg-blue-50 text-blue-700',       Icon: ShoppingCart },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';

export default function MovimientosPage() {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set('search', busqueda);
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      const { data } = await api.get(`/inventario/movimientos/?${params}`);
      setMovs(data.results ?? data);
    } catch { toast.error('Error cargando movimientos'); }
    setLoading(false);
  }, [busqueda, filtroTipo, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const kpis = {
    ENTRADA: movs.filter(m => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.cantidad), 0),
    SALIDA:  movs.filter(m => m.tipo === 'SALIDA').reduce((s, m) => s + Number(m.cantidad), 0),
    AJUSTE:  movs.filter(m => m.tipo === 'AJUSTE').length,
    VENTA:   movs.filter(m => m.tipo === 'VENTA').reduce((s, m) => s + Number(m.cantidad), 0),
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Movimientos</h1>
          <p className="text-slate-400 text-sm mt-0.5">{movs.length} registros en el período</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(TIPO_CONFIG) as [string, typeof TIPO_CONFIG[string]][]).map(([tipo, cfg]) => {
          const TIcon = cfg.Icon;
          const val = kpis[tipo as keyof typeof kpis];
          return (
            <div key={tipo} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.color}`}>
                <TIcon size={18} />
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">{Number(val).toFixed(0)}</p>
                <p className="text-xs text-slate-400">{cfg.label}{tipo !== 'AJUSTE' ? 's' : 's'}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Buscar producto, referencia..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={`${inputCls} min-w-36`}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={`${inputCls}`} />
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={`${inputCls}`} />
        {(busqueda || filtroTipo || fechaDesde || fechaHasta) && (
          <button onClick={() => { setBusqueda(''); setFiltroTipo(''); setFechaDesde(''); setFechaHasta(''); }}
            className="text-xs text-red-500 font-semibold hover:underline px-2">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : movs.length === 0 ? (
          <div className="p-16 text-center">
            <ArrowLeftRight size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-400">No hay movimientos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock Antes', 'Stock Después', 'Referencia', 'Usuario'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movs.map(m => {
                  const cfg = TIPO_CONFIG[m.tipo] ?? { label: m.tipo, color: 'bg-slate-100 text-slate-600', Icon: ArrowLeftRight };
                  const TIcon = cfg.Icon;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.producto_nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                          <TIcon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-bold tabular-nums ${m.tipo === 'ENTRADA' ? 'text-emerald-600' : m.tipo === 'SALIDA' || m.tipo === 'VENTA' ? 'text-red-500' : 'text-amber-600'}`}>
                        {m.tipo === 'ENTRADA' ? '+' : m.tipo === 'AJUSTE' ? '±' : '-'}{Number(m.cantidad).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{Number(m.stock_antes).toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700 tabular-nums">{Number(m.stock_despues).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{m.referencia || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{m.usuario_nombre}</td>
                    </tr>
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
