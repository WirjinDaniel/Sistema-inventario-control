'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Wallet, AlertTriangle, X, Check, Clock } from 'lucide-react';

interface AgingCliente {
  id: number;
  nombre: string;
  telefono: string;
  saldo_deuda: number;
  dias: number;
  ultima_fecha: string;
}

interface AgingBucket {
  label: string;
  clientes: AgingCliente[];
  total: number;
}

interface AgingData {
  buckets: Record<string, AgingBucket>;
  total: number;
}

const BUCKET_COLORS: Record<string, { header: string; badge: string; dot: string }> = {
  '0_30':  { header: 'bg-emerald-50 border-emerald-100', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  '31_60': { header: 'bg-amber-50 border-amber-100',     badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400' },
  '61_90': { header: 'bg-orange-50 border-orange-100',   badge: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400' },
  '90_mas':{ header: 'bg-red-50 border-red-100',         badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
};

const fmt = (v: number) => `RD$${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

export default function CuentasPorCobrarPage() {
  const [aging, setAging] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [abonoModal, setAbonoModal] = useState<AgingCliente | null>(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [notaAbono, setNotaAbono] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get('/clientes/aging/');
      setAging(data);
    } catch { toast.error('Error cargando cuentas por cobrar'); }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function registrarAbono() {
    if (!abonoModal) return;
    if (!montoAbono || Number(montoAbono) <= 0) return toast.error('Monto inválido');
    setGuardando(true);
    try {
      await api.post('/clientes/abonos/', { cliente: abonoModal.id, monto: montoAbono, nota: notaAbono });
      toast.success(`Abono de ${fmt(Number(montoAbono))} registrado`);
      setAbonoModal(null); setMontoAbono(''); setNotaAbono('');
      cargar();
    } catch { toast.error('Error al registrar el abono'); }
    setGuardando(false);
  }

  const buckets = aging?.buckets ?? {};
  const totalClientes = Object.values(buckets).reduce((s, b) => s + b.clientes.length, 0);
  const totalVencido = (buckets['31_60']?.total ?? 0) + (buckets['61_90']?.total ?? 0) + (buckets['90_mas']?.total ?? 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Cuentas por Cobrar</h1>
          <p className="text-slate-400 text-sm mt-0.5">Antigüedad de saldos de clientes con fiado</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total pendiente</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{fmt(aging?.total ?? 0)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalClientes} clientes con deuda</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Al día (0–30 días)</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{fmt(buckets['0_30']?.total ?? 0)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{buckets['0_30']?.clientes.length ?? 0} clientes</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 bg-red-50">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle size={11} /> Vencido (+30 días)
          </p>
          <p className="text-2xl font-black text-red-600 mt-1">{fmt(totalVencido)}</p>
          <p className="text-xs text-red-400 mt-0.5">Requiere gestión inmediata</p>
        </div>
      </div>

      {/* Buckets */}
      {loading ? (
        <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : totalClientes === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center shadow-sm">
          <Wallet size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-400">No hay clientes con saldo pendiente</p>
          <p className="text-sm text-slate-300 mt-1">¡Excelente cartera de cobros!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(['0_30', '31_60', '61_90', '90_mas'] as const).map(key => {
            const bucket = buckets[key];
            if (!bucket || bucket.clientes.length === 0) return null;
            const colors = BUCKET_COLORS[key];
            return (
              <div key={key} className={`bg-white border rounded-2xl shadow-sm overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${colors.header} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <span className="font-bold text-slate-700">{bucket.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{bucket.clientes.length} clientes</span>
                  </div>
                  <span className="font-bold text-slate-800">{fmt(bucket.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase">Cliente</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Teléfono</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Último movimiento</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Días</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Saldo</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bucket.clientes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-800">{c.nombre}</td>
                        <td className="px-4 py-3 text-slate-500">{c.telefono || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          <span className="flex items-center gap-1"><Clock size={11} /> {c.ultima_fecha}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{c.dias}d</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmt(c.saldo_deuda)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setAbonoModal(c); setMontoAbono(''); setNotaAbono(''); }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                            Abonar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal abono */}
      {abonoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">Registrar abono</h2>
                <p className="text-xs text-slate-400 mt-0.5">{abonoModal.nombre} · Saldo: {fmt(abonoModal.saldo_deuda)}</p>
              </div>
              <button onClick={() => setAbonoModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto (RD$)</label>
                <input type="number" value={montoAbono} onChange={e => setMontoAbono(e.target.value)}
                  placeholder="0.00" step="0.01" autoFocus
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota (opcional)</label>
                <input value={notaAbono} onChange={e => setNotaAbono(e.target.value)}
                  placeholder="Ej: Pago parcial"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full" />
              </div>
              {montoAbono && Number(montoAbono) >= abonoModal.saldo_deuda && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-700 font-semibold">
                  ✓ Este abono cancela la deuda completa
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAbonoModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors">Cancelar</button>
              <button onClick={registrarAbono} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
