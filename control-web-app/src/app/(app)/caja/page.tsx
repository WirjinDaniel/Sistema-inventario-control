'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { SesionCaja } from '@/types';
import {
  LockKeyhole, LockKeyholeOpen, DollarSign, CreditCard,
  ArrowLeftRight, Clock, History, X, Loader2, Banknote,
  TrendingUp, ShoppingCart, AlertCircle,
} from 'lucide-react';

interface ResumenVentas {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  fiado: number;
  total: number;
  cantidad: number;
}

const fmt = (n: number | string) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 2 }).format(Number(n));

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function CajaPage() {
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null);
  const [historial, setHistorial] = useState<SesionCaja[]>([]);
  const [resumen, setResumen] = useState<ResumenVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'apertura' | 'cierre' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Apertura
  const [efectivoInicial, setEfectivoInicial] = useState('');

  // Cierre
  const [efectivoDeclarado, setEfectivoDeclarado] = useState('');
  const [notaCierre, setNotaCierre] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [activaRes, historialRes] = await Promise.all([
        api.get('/ventas/sesiones/activa/').catch(() => null),
        api.get('/ventas/sesiones/'),
      ]);

      const activa: SesionCaja | null = activaRes?.data ?? null;
      setSesionActiva(activa);
      setHistorial((historialRes.data.results ?? historialRes.data).filter((s: SesionCaja) => s.cierre));

      if (activa) {
        const ventasRes = await api.get('/ventas/', { params: { sesion: activa.id } });
        const ventas: Array<{ metodo_pago: string; total: string; estado: string }> =
          ventasRes.data.results ?? ventasRes.data;
        const completadas = ventas.filter(v => v.estado === 'COMPLETADA');
        const r: ResumenVentas = { efectivo: 0, tarjeta: 0, transferencia: 0, fiado: 0, total: 0, cantidad: completadas.length };
        for (const v of completadas) {
          const t = Number(v.total);
          r.total += t;
          if (v.metodo_pago === 'EFECTIVO') r.efectivo += t;
          else if (v.metodo_pago === 'TARJETA') r.tarjeta += t;
          else if (v.metodo_pago === 'TRANSFERENCIA') r.transferencia += t;
          else if (v.metodo_pago === 'FIADO') r.fiado += t;
        }
        setResumen(r);
      }
    } catch {
      toast.error('Error al cargar datos de caja');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function abrir() {
    if (!efectivoInicial || Number(efectivoInicial) < 0) {
      toast.error('Ingresa el efectivo inicial');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/ventas/sesiones/', { efectivo_inicial: efectivoInicial });
      toast.success('Caja abierta');
      setModal(null);
      setEfectivoInicial('');
      cargar();
    } catch {
      toast.error('Error al abrir la caja');
    } finally {
      setSubmitting(false);
    }
  }

  async function cerrar() {
    if (!sesionActiva) return;
    if (!efectivoDeclarado && efectivoDeclarado !== '0') {
      toast.error('Ingresa el efectivo contado en caja');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/ventas/sesiones/${sesionActiva.id}/cerrar/`, {
        efectivo_final_declarado: efectivoDeclarado,
        nota_cierre: notaCierre,
      });
      toast.success('Caja cerrada correctamente');
      setModal(null);
      setEfectivoDeclarado('');
      setNotaCierre('');
      cargar();
    } catch {
      toast.error('Error al cerrar la caja');
    } finally {
      setSubmitting(false);
    }
  }

  const esperadoEnCaja = sesionActiva && resumen
    ? Number(sesionActiva.efectivo_inicial) + resumen.efectivo
    : null;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caja</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de apertura y cierre de turno</p>
        </div>
        {sesionActiva ? (
          <button
            onClick={() => setModal('cierre')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow transition-all"
          >
            <LockKeyhole className="w-4 h-4" />
            Cerrar caja
          </button>
        ) : (
          <button
            onClick={() => setModal('apertura')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <LockKeyholeOpen className="w-4 h-4" />
            Abrir caja
          </button>
        )}
      </div>

      {/* Estado actual */}
      {sesionActiva ? (
        <>
          {/* Banner turno activo */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <LockKeyholeOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800">Caja abierta</p>
              <p className="text-sm text-emerald-600">
                {sesionActiva.cajero_nombre} · Desde {fmtFecha(sesionActiva.apertura)}
              </p>
            </div>
          </div>

          {/* KPIs del turno */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Efectivo inicial', value: sesionActiva.efectivo_inicial, icon: Banknote, color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Ventas del turno', value: resumen?.total ?? 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Esperado en caja', value: esperadoEnCaja ?? 0, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Cantidad de ventas', value: resumen?.cantidad ?? 0, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50', raw: true },
            ].map(card => (
              <div key={card.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>
                  {card.raw ? card.value : fmt(card.value)}
                </p>
              </div>
            ))}
          </div>

          {/* Desglose por método de pago */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-800 text-sm">Ventas por método de pago</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { label: 'Efectivo', value: resumen?.efectivo ?? 0, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Tarjeta', value: resumen?.tarjeta ?? 0, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Transferencia', value: resumen?.transferencia ?? 0, icon: ArrowLeftRight, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Fiado', value: resumen?.fiado ?? 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${row.bg} flex items-center justify-center`}>
                      <row.icon className={`w-4 h-4 ${row.color}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{row.label}</span>
                  </div>
                  <span className={`font-bold tabular-nums ${row.color}`}>{fmt(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50">
                <span className="text-sm font-bold text-slate-800">Total cobrado</span>
                <span className="font-bold text-lg text-slate-800 tabular-nums">{fmt(resumen?.total ?? 0)}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
          <LockKeyhole className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500">La caja está cerrada</p>
          <p className="text-sm text-slate-400 mt-1">Abre la caja para comenzar a registrar ventas</p>
        </div>
      )}

      {/* Historial de cierres */}
      {historial.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h2 className="font-bold text-slate-800 text-sm">Historial de cierres</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Apertura</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cierre</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cajero</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Efectivo inicial</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Calculado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Declarado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historial.map(s => {
                  const diff = Number(s.diferencia_caja ?? 0);
                  const diffColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{fmtFecha(s.apertura)}</td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{s.cierre ? fmtFecha(s.cierre) : '—'}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{s.cajero_nombre}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{fmt(s.efectivo_inicial)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{s.efectivo_calculado ? fmt(s.efectivo_calculado) : '—'}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{s.efectivo_final_declarado ? fmt(s.efectivo_final_declarado) : '—'}</td>
                      <td className={`px-5 py-3.5 text-right tabular-nums font-bold ${diffColor}`}>
                        {s.diferencia_caja != null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal apertura */}
      {modal === 'apertura' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <LockKeyholeOpen className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Apertura de caja</h2>
              </div>
              <button
                onClick={() => { setModal(null); setEfectivoInicial(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 text-xs font-semibold transition-all duration-150"
              >
                <X className="w-3.5 h-3.5" /> Cerrar
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Efectivo en caja al abrir (RD$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold text-center text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  placeholder="0.00"
                  value={efectivoInicial}
                  onChange={e => setEfectivoInicial(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && abrir()}
                />
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Este es el monto de cambio disponible al inicio del turno
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 2000, 3000, 5000, 10000].map(v => (
                  <button
                    key={v}
                    onClick={() => setEfectivoInicial(String(v))}
                    className={`text-xs rounded-xl py-2.5 font-semibold transition-all ${
                      Number(efectivoInicial) === v
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    RD${v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => { setModal(null); setEfectivoInicial(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-sm transition flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" /> No abrir
              </button>
              <button
                onClick={abrir}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyholeOpen className="w-4 h-4" />}
                Abrir caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cierre */}
      {modal === 'cierre' && sesionActiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <LockKeyhole className="w-4 h-4 text-red-500" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Cierre de caja</h2>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Resumen del sistema */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo inicial</span>
                  <span className="font-semibold tabular-nums">{fmt(sesionActiva.efectivo_inicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ventas en efectivo</span>
                  <span className="font-semibold tabular-nums text-emerald-600">{fmt(resumen?.efectivo ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700">Esperado en caja</span>
                  <span className="font-bold tabular-nums text-indigo-600">{fmt(esperadoEnCaja ?? 0)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Efectivo contado físicamente (RD$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold text-center text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="0.00"
                  value={efectivoDeclarado}
                  onChange={e => setEfectivoDeclarado(e.target.value)}
                />
              </div>

              {efectivoDeclarado !== '' && esperadoEnCaja !== null && (
                (() => {
                  const diff = Number(efectivoDeclarado) - esperadoEnCaja;
                  const isOk = Math.abs(diff) <= 100;
                  return (
                    <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${
                      isOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Diferencia: <span className="font-bold tabular-nums">
                          {diff >= 0 ? '+' : ''}{fmt(diff)}
                        </span>
                        {isOk ? ' — dentro del margen' : ' — revisar antes de cerrar'}
                      </span>
                    </div>
                  );
                })()
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Nota de cierre (opcional)
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="Observaciones del turno..."
                  value={notaCierre}
                  onChange={e => setNotaCierre(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={cerrar}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
                Cerrar caja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
