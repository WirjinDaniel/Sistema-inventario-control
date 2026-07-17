'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ScrollText, ArrowLeft, TrendingUp, TrendingDown, RotateCcw, ShoppingCart,
  Search, Package,
} from 'lucide-react';

interface Movimiento {
  id: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA';
  cantidad: string;
  stock_antes: string;
  stock_despues: string;
  referencia: string;
  usuario_nombre: string;
  fecha: string;
  nota: string;
}

interface ProductoBasico { id: number; nombre: string; stock_actual: string; unidad_medida: string; }

const TIPO_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  ENTRADA: { label: 'Entrada', color: 'bg-emerald-50 text-emerald-700', Icon: TrendingUp },
  SALIDA:  { label: 'Salida',  color: 'bg-red-50 text-red-600',        Icon: TrendingDown },
  AJUSTE:  { label: 'Ajuste',  color: 'bg-amber-50 text-amber-700',    Icon: RotateCcw },
  VENTA:   { label: 'Venta',   color: 'bg-blue-50 text-blue-700',      Icon: ShoppingCart },
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function KardexContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productoId = searchParams.get('producto');
  const nombreParam = searchParams.get('nombre') ?? '';

  const [producto, setProducto] = useState<ProductoBasico | null>(null);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultados, setResultados] = useState<ProductoBasico[]>([]);
  const [buscando, setBuscando] = useState(false);

  const cargarMovimientos = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [{ data: p }, { data: m }] = await Promise.all([
        api.get(`/inventario/productos/${id}/`),
        api.get(`/inventario/movimientos/?producto=${id}&ordering=-fecha`),
      ]);
      setProducto(p);
      setMovs(m.results ?? m);
    } catch { toast.error('Error cargando kardex'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (productoId) cargarMovimientos(productoId);
  }, [productoId, cargarMovimientos]);

  useEffect(() => {
    if (!busquedaProducto.trim()) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(busquedaProducto)}`);
        setResultados((data.results ?? data).slice(0, 8));
      } catch { /* silencioso */ }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busquedaProducto]);

  function seleccionar(p: ProductoBasico) {
    setResultados([]);
    setBusquedaProducto('');
    router.push(`/kardex?producto=${p.id}&nombre=${encodeURIComponent(p.nombre)}`);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/productos')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Kardex</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {producto ? `${producto.nombre} · Stock actual: ${Number(producto.stock_actual).toFixed(2)} ${producto.unidad_medida}` : 'Selecciona un producto'}
          </p>
        </div>
      </div>

      {/* Buscador de producto */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Buscar producto</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busquedaProducto} onChange={e => setBusquedaProducto(e.target.value)}
            placeholder="Nombre, SKU, código de barras..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {resultados.length > 0 && (
          <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {resultados.map(p => (
              <button key={p.id} onClick={() => seleccionar(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-slate-50 last:border-0">
                <Package size={14} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 font-medium">{p.nombre}</span>
                <span className="ml-auto text-xs text-slate-400 tabular-nums">Stock: {Number(p.stock_actual).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla kardex */}
      {productoId && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : movs.length === 0 ? (
            <div className="p-16 text-center">
              <ScrollText size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="font-medium text-slate-400">Sin movimientos para {nombreParam || 'este producto'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Fecha', 'Tipo', 'Referencia', 'Entrada', 'Salida', 'Saldo', 'Usuario', 'Nota'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {movs.map(m => {
                    const cfg = TIPO_CONFIG[m.tipo] ?? { label: m.tipo, color: 'bg-slate-100 text-slate-600', Icon: RotateCcw };
                    const TIcon = cfg.Icon;
                    const entrada = m.tipo === 'ENTRADA' ? Number(m.cantidad) : null;
                    const salida = (m.tipo === 'SALIDA' || m.tipo === 'VENTA') ? Number(m.cantidad) : null;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                            <TIcon size={10} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">{m.referencia || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 tabular-nums">
                          {entrada != null ? `+${entrada.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-500 tabular-nums">
                          {salida != null ? `-${salida.toFixed(2)}` : m.tipo === 'AJUSTE' ? `±${Number(m.cantidad).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 tabular-nums">{Number(m.stock_despues).toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{m.usuario_nombre}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{m.nota || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KardexPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Cargando...</div>}>
      <KardexContent />
    </Suspense>
  );
}
