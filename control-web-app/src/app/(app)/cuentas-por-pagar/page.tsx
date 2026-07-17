'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  TrendingDown, AlertTriangle, X, Check, Clock,
  Banknote, Building2, CreditCard,
} from 'lucide-react';
import type { OrdenCompra, PagoSuplidor } from '@/types';

const fmt = (v: string | number) =>
  `RD$${Number(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

const METODO_CONFIG: Record<PagoSuplidor['metodo'], { label: string; Icon: React.ElementType }> = {
  EFECTIVO:     { label: 'Efectivo',      Icon: Banknote },
  TRANSFERENCIA:{ label: 'Transferencia', Icon: Building2 },
  CHEQUE:       { label: 'Cheque',        Icon: CreditCard },
};

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente',    color: 'bg-amber-50 text-amber-700' },
  RECIBIDA:  { label: 'Recibida',     color: 'bg-blue-50 text-blue-700' },
  CANCELADA: { label: 'Cancelada',    color: 'bg-red-50 text-red-600' },
};

interface PagoForm { monto: string; metodo: PagoSuplidor['metodo']; referencia: string; nota: string; }
const PAGO_EMPTY: PagoForm = { monto: '', metodo: 'EFECTIVO', referencia: '', nota: '' };

export default function CuentasPorPagarPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [pagoModal, setPagoModal] = useState<OrdenCompra | null>(null);
  const [pago, setPago] = useState<PagoForm>(PAGO_EMPTY);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set('estado', filtroEstado);
      const { data } = await api.get(`/compras/ordenes/?${params}`);
      setOrdenes(data.results ?? data);
    } catch { toast.error('Error cargando cuentas por pagar'); }
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  async function registrarPago() {
    if (!pagoModal) return;
    if (!pago.monto || Number(pago.monto) <= 0) return toast.error('Monto inválido');
    setGuardando(true);
    try {
      await api.post('/compras/pagos/', { orden: pagoModal.id, ...pago });
      toast.success(`Pago de ${fmt(pago.monto)} registrado`);
      setPagoModal(null); setPago(PAGO_EMPTY);
      cargar();
    } catch { toast.error('Error al registrar el pago'); }
    setGuardando(false);
  }

  const totalPendiente = ordenes
    .filter(o => o.estado !== 'CANCELADA')
    .reduce((s, o) => s + Number(o.balance_pendiente), 0);

  const venceEstaSemana = ordenes.filter(o => {
    if (o.estado === 'CANCELADA' || !o.fecha) return false;
    const diasDesde = Math.abs((new Date().getTime() - new Date(o.fecha).getTime()) / 86400000);
    return diasDesde <= 7;
  }).length;

  const f = (k: keyof PagoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPago(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Cuentas por Pagar</h1>
          <p className="text-slate-400 text-sm mt-0.5">Facturas de compra pendientes de pago</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total por pagar</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{fmt(totalPendiente)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{ordenes.filter(o => o.estado !== 'CANCELADA').length} facturas</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <p className="text-xs text-amber-500 font-semibold uppercase tracking-wide flex items-center gap-1">
            <Clock size={11} /> Esta semana
          </p>
          <p className="text-2xl font-black text-amber-600 mt-1">{venceEstaSemana}</p>
          <p className="text-xs text-slate-400 mt-0.5">facturas recientes</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Canceladas</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{ordenes.filter(o => o.estado === 'CANCELADA').length}</p>
          <p className="text-xs text-slate-400 mt-0.5">pagadas al proveedor</p>
        </div>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2">
        {(['', 'PENDIENTE', 'RECIBIDA', 'CANCELADA'] as const).map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
              filtroEstado === e
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'
            }`}>
            {e === '' ? 'Todas' : ESTADO_CONFIG[e]?.label ?? e}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : ordenes.length === 0 ? (
          <div className="p-16 text-center">
            <TrendingDown size={44} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-400">No hay facturas{filtroEstado ? ` con estado "${ESTADO_CONFIG[filtroEstado]?.label}"` : ''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Proveedor', 'N° Factura', 'Fecha', 'Total', 'Pagado', 'Balance', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ordenes.map(o => {
                  const estado = ESTADO_CONFIG[o.estado] ?? { label: o.estado, color: 'bg-slate-100 text-slate-600' };
                  const balancePct = Number(o.total) > 0 ? (Number(o.total_pagado) / Number(o.total)) * 100 : 0;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{o.suplidor_nombre}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{o.numero_factura || `#${o.id}`}</td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1"><Clock size={11} /> {fmtFecha(o.fecha)}</span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700 tabular-nums">{fmt(o.total)}</td>
                      <td className="px-4 py-3.5 text-emerald-600 tabular-nums">
                        <div>
                          {fmt(o.total_pagado)}
                          {balancePct > 0 && (
                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1">
                              <div className="h-1 bg-emerald-400 rounded-full" style={{ width: `${Math.min(balancePct, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3.5 font-bold tabular-nums ${Number(o.balance_pendiente) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {Number(o.balance_pendiente) > 0
                          ? <span className="flex items-center gap-1"><AlertTriangle size={12} /> {fmt(o.balance_pendiente)}</span>
                          : fmt(0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${estado.color}`}>{estado.label}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {o.estado !== 'CANCELADA' && Number(o.balance_pendiente) > 0 && (
                          <button onClick={() => { setPagoModal(o); setPago(PAGO_EMPTY); }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal pago */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">Registrar pago</h2>
                <p className="text-xs text-slate-400 mt-0.5">{pagoModal.suplidor_nombre} · Balance: {fmt(pagoModal.balance_pendiente)}</p>
              </div>
              <button onClick={() => setPagoModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto (RD$)</label>
                <input type="number" value={pago.monto} onChange={f('monto')} placeholder="0.00" step="0.01" autoFocus
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(METODO_CONFIG) as [PagoSuplidor['metodo'], typeof METODO_CONFIG[PagoSuplidor['metodo']]][]).map(([k, v]) => {
                    const MIcon = v.Icon;
                    return (
                      <button key={k} type="button" onClick={() => setPago(p => ({ ...p, metodo: k }))}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          pago.metodo === k ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>
                        <MIcon size={16} /> {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Referencia</label>
                <input value={pago.referencia} onChange={f('referencia')} placeholder="N° cheque, transferencia..."
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota</label>
                <input value={pago.nota} onChange={f('nota')} placeholder="Observaciones (opcional)"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setPagoModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold">Cancelar</button>
              <button onClick={registrarPago} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
