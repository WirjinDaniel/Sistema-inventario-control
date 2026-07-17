'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Search, Filter, User, Calendar,
  ShoppingCart, Wallet, Package, Store, LogIn, AlertTriangle,
  CreditCard, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AuditoriaEntry {
  id: number;
  usuario_nombre: string;
  accion: string;
  modulo: string;
  objeto_id: number | null;
  descripcion: string;
  ip: string | null;
  fecha: string;
  extra: Record<string, unknown>;
}

interface UsuarioOpt { id: number; nombre: string; }

const ACCION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  VENTA:   { label: 'Venta',           color: 'bg-emerald-100 text-emerald-700', icon: ShoppingCart },
  ANULAR:  { label: 'Anulación',       color: 'bg-red-100 text-red-700',         icon: AlertTriangle },
  ABONO:   { label: 'Abono',           color: 'bg-blue-100 text-blue-700',        icon: Wallet },
  COMPRA:  { label: 'Compra',          color: 'bg-violet-100 text-violet-700',    icon: CreditCard },
  AJUSTE:  { label: 'Ajuste inv.',     color: 'bg-amber-100 text-amber-700',      icon: Package },
  CREAR:   { label: 'Creación',        color: 'bg-indigo-100 text-indigo-700',    icon: Store },
  EDITAR:  { label: 'Edición',         color: 'bg-slate-100 text-slate-700',      icon: Store },
  ELIMINAR:{ label: 'Eliminación',     color: 'bg-red-100 text-red-600',          icon: AlertTriangle },
  LOGIN:   { label: 'Inicio sesión',   color: 'bg-teal-100 text-teal-700',        icon: LogIn },
  CAJA:    { label: 'Caja',            color: 'bg-amber-100 text-amber-700',      icon: Store },
};

const MODULO_LABEL: Record<string, string> = {
  ventas: 'Ventas', clientes: 'Clientes', compras: 'Compras',
  inventario: 'Inventario', gastos: 'Gastos', caja: 'Caja', usuarios: 'Usuarios',
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditoriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set('search', busqueda);
      if (filtroAccion) params.set('accion', filtroAccion);
      if (filtroModulo) params.set('modulo', filtroModulo);
      if (filtroUsuario) params.set('usuario', filtroUsuario);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);

      const { data } = await api.get(`/usuarios/auditoria/?${params}`);
      setLogs(data.results ?? data);
    } catch { toast.error('Error cargando auditoría'); }
    setLoading(false);
  }, [busqueda, filtroAccion, filtroModulo, filtroUsuario, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get('/usuarios/').then(({ data }) => setUsuarios(data.results ?? data)).catch(() => {});
  }, []);

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition bg-white';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auditoría</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro completo de todas las acciones del sistema</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <ShieldCheck size={15} className="text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-600">{logs.length} registros</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <Filter size={12} /> Filtros
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Búsqueda */}
          <div className="relative col-span-2 lg:col-span-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-8 w-full`} placeholder="Buscar acción, usuario..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          {/* Acción */}
          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Módulo */}
          <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los módulos</option>
            {Object.entries(MODULO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {/* Usuario */}
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          {/* Fechas */}
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={`${inputCls} w-full`} />
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={`${inputCls} w-full`} />
        </div>
        {(busqueda || filtroAccion || filtroModulo || filtroUsuario || fechaDesde || fechaHasta) && (
          <button onClick={() => { setBusqueda(''); setFiltroAccion(''); setFiltroModulo(''); setFiltroUsuario(''); setFechaDesde(''); setFechaHasta(''); }}
            className="text-xs text-red-500 font-semibold hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldCheck size={44} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-400">No hay registros de auditoría</p>
            <p className="text-sm text-slate-300 mt-1">Los eventos del sistema aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Módulo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => {
                  const accion = ACCION_CONFIG[log.accion] ?? { label: log.accion, color: 'bg-slate-100 text-slate-600', icon: Store };
                  const AIcon = accion.icon;
                  const hasExtra = log.extra && Object.keys(log.extra).length > 0;
                  return (
                    <>
                      <tr key={log.id}
                        className={`hover:bg-slate-50 transition-colors ${hasExtra ? 'cursor-pointer' : ''}`}
                        onClick={() => hasExtra && setExpandedId(expandedId === log.id ? null : log.id)}>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">{fmtFecha(log.fecha)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                              {log.usuario_nombre?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="font-medium text-slate-800 whitespace-nowrap">{log.usuario_nombre ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${accion.color}`}>
                            <AIcon size={11} />
                            {accion.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 capitalize">
                          {MODULO_LABEL[log.modulo] ?? log.modulo}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 max-w-xs truncate">{log.descripcion}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">{log.ip ?? '—'}</td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {hasExtra && (expandedId === log.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                        </td>
                      </tr>
                      {expandedId === log.id && hasExtra && (
                        <tr key={`${log.id}-extra`} className="bg-indigo-50/30">
                          <td colSpan={7} className="px-5 py-3">
                            <pre className="text-xs text-slate-600 font-mono bg-white rounded-lg border border-slate-100 p-3 overflow-auto max-h-40">
                              {JSON.stringify(log.extra, null, 2)}
                            </pre>
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
