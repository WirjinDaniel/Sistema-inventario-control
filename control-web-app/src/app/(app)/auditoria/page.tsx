'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Search, Filter,
  ShoppingCart, Wallet, Package, Store, LogIn, AlertTriangle,
  CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuthStore } from '@/store/auth';
import { AccessDenied } from '@/components/shared/AccessDenied';

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

const ACCION_CONFIG: Record<string, { label: string; accentBg: string; accentBorder: string; color: string; gradient: string; icon: React.ElementType }> = {
  VENTA:   { label: 'Venta',         accentBg: 'bg-emerald-50', accentBorder: 'border-emerald-200', color: 'text-emerald-700', gradient: 'from-emerald-500 to-teal-600',   icon: ShoppingCart },
  ANULAR:  { label: 'Anulación',     accentBg: 'bg-rose-50',    accentBorder: 'border-rose-200',    color: 'text-rose-700',    gradient: 'from-rose-500 to-red-600',       icon: AlertTriangle },
  ABONO:   { label: 'Abono',         accentBg: 'bg-sky-50',     accentBorder: 'border-sky-200',     color: 'text-sky-700',     gradient: 'from-sky-500 to-blue-600',       icon: Wallet },
  COMPRA:  { label: 'Compra',        accentBg: 'bg-violet-50',  accentBorder: 'border-violet-200',  color: 'text-violet-700',  gradient: 'from-violet-500 to-purple-600',  icon: CreditCard },
  AJUSTE:  { label: 'Ajuste inv.',   accentBg: 'bg-amber-50',   accentBorder: 'border-amber-200',   color: 'text-amber-700',   gradient: 'from-amber-500 to-orange-600',   icon: Package },
  CREAR:   { label: 'Creación',      accentBg: 'bg-brand-50',   accentBorder: 'border-brand-200',   color: 'text-brand-700',   gradient: 'from-brand-500 to-indigo-600',   icon: Store },
  EDITAR:  { label: 'Edición',       accentBg: 'bg-muted',      accentBorder: 'border-border',      color: 'text-muted-foreground', gradient: 'from-slate-400 to-slate-500', icon: Store },
  ELIMINAR:{ label: 'Eliminación',   accentBg: 'bg-rose-50',    accentBorder: 'border-rose-200',    color: 'text-rose-600',    gradient: 'from-rose-500 to-red-600',       icon: AlertTriangle },
  LOGIN:   { label: 'Inicio sesión', accentBg: 'bg-teal-50',    accentBorder: 'border-teal-200',    color: 'text-teal-700',    gradient: 'from-teal-500 to-emerald-600',   icon: LogIn },
  CAJA:    { label: 'Caja',          accentBg: 'bg-amber-50',   accentBorder: 'border-amber-200',   color: 'text-amber-700',   gradient: 'from-amber-500 to-orange-600',   icon: Store },
};

const MODULO_LABEL: Record<string, string> = {
  ventas: 'Ventas', clientes: 'Clientes', compras: 'Compras',
  inventario: 'Inventario', gastos: 'Gastos', caja: 'Caja', usuarios: 'Usuarios',
};

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditoriaPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
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

  const inputCls = 'border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400 transition bg-card';

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Auditoría</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Registro completo de todas las acciones del sistema</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-50 border border-brand-200 text-brand-700 px-3 py-1.5 rounded-full">
          <ShieldCheck size={12} /> {logs.length} registros
        </span>
      </div>

      {/* Filtros */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm p-4 space-y-3 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/50 to-transparent" />
        <div className="flex items-center gap-2 text-2xs font-bold text-muted-foreground uppercase tracking-widest">
          <Filter size={11} /> Filtros
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative col-span-2 lg:col-span-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inputCls} pl-8 w-full`} placeholder="Buscar acción, usuario..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los módulos</option>
            {Object.entries(MODULO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" className="w-full" />
          <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" className="w-full" />
        </div>
        {(busqueda || filtroAccion || filtroModulo || filtroUsuario || fechaDesde || fechaHasta) && (
          <button onClick={() => { setBusqueda(''); setFiltroAccion(''); setFiltroModulo(''); setFiltroUsuario(''); setFechaDesde(''); setFechaHasta(''); }}
            className="text-xs text-rose-500 font-semibold hover:text-rose-600 hover:underline transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-muted/60 rounded-xl animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={26} className="text-muted-foreground/30" />
            </div>
            <p className="font-bold text-foreground">No hay registros de auditoría</p>
            <p className="text-sm text-muted-foreground mt-1">Los eventos del sistema aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Fecha / Hora', 'Usuario', 'Acción', 'Módulo', 'Descripción', 'IP', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-2xs font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => {
                  const accion = ACCION_CONFIG[log.accion] ?? { label: log.accion, accentBg: 'bg-muted', accentBorder: 'border-border', color: 'text-muted-foreground', gradient: 'from-slate-400 to-slate-500', icon: Store };
                  const AIcon = accion.icon;
                  const hasExtra = log.extra && Object.keys(log.extra).length > 0;
                  return (
                    <>
                      <tr key={log.id}
                        className={`hover:bg-muted/30 transition-colors ${hasExtra ? 'cursor-pointer' : ''}`}
                        onClick={() => hasExtra && setExpandedId(expandedId === log.id ? null : log.id)}>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-xs">{fmtFecha(log.fecha)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                              {log.usuario_nombre?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="font-semibold text-foreground whitespace-nowrap">{log.usuario_nombre ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold border ${accion.accentBg} ${accion.accentBorder} ${accion.color}`}>
                            <AIcon size={10} />
                            {accion.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border capitalize">
                            {MODULO_LABEL[log.modulo] ?? log.modulo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-foreground max-w-xs truncate text-xs">{log.descripcion}</td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono">
                          {log.ip ? <span className="bg-muted px-1.5 py-0.5 rounded">{log.ip}</span> : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {hasExtra && (expandedId === log.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                        </td>
                      </tr>
                      {expandedId === log.id && hasExtra && (
                        <tr key={`${log.id}-extra`} className="bg-muted/20">
                          <td colSpan={7} className="px-5 py-3">
                            <pre className="text-xs text-foreground font-mono bg-card rounded-lg border border-border p-3 overflow-auto max-h-40">
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
