'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { CategoriaGasto, Gasto } from '@/types';
import CustomSelect from '@/components/CustomSelect';
import toast from 'react-hot-toast';
import {
  Receipt, Plus, X, DollarSign, TrendingDown, AlertTriangle,
  Loader2, Search, ChevronDown, ChevronUp, Banknote, CreditCard, ArrowLeftRight, BookCheck,
} from 'lucide-react';

const METODOS_PAGO = [
  { value: 'EFECTIVO',      label: 'Efectivo',       icon: Banknote },
  { value: 'TARJETA',       label: 'Tarjeta',        icon: CreditCard },
  { value: 'TRANSFERENCIA', label: 'Transferencia',  icon: ArrowLeftRight },
  { value: 'CHEQUE',        label: 'Cheque',         icon: BookCheck },
];

const METODO_COLOR: Record<string, string> = {
  EFECTIVO:      'bg-emerald-100 text-emerald-700',
  TARJETA:       'bg-blue-100 text-blue-700',
  TRANSFERENCIA: 'bg-violet-100 text-violet-700',
  CHEQUE:        'bg-amber-100 text-amber-700',
};

const TIPOS_LABEL: Record<string, { label: string; color: string }> = {
  FIJO:          { label: 'Fijo',          color: 'bg-blue-100 text-blue-700' },
  VARIABLE:      { label: 'Variable',      color: 'bg-amber-100 text-amber-700' },
  FINANCIERO:    { label: 'Financiero',    color: 'bg-purple-100 text-purple-700' },
  PERDIDA:       { label: 'Pérdida',       color: 'bg-red-100 text-red-700' },
  ADMINISTRATIVO:{ label: 'Administrativo',color: 'bg-slate-100 text-slate-700' },
  RETIRO:        { label: 'Retiro',        color: 'bg-orange-100 text-orange-700' },
};

const PERIODOS = [
  { value: 'hoy',    label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes',    label: 'Este mes' },
];

interface Resumen {
  total: number;
  FIJO: number;
  VARIABLE: number;
  FINANCIERO: number;
  PERDIDA: number;
  ADMINISTRATIVO: number;
  RETIRO: number;
}

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    categoria: '',
    descripcion: '',
    monto: '',
    metodo_pago: 'EFECTIVO',
    comprobante: '',
    nota: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ periodo });
      if (filtroTipo) params.set('tipo', filtroTipo);

      const [gastosRes, resumenRes] = await Promise.all([
        api.get(`/gastos/?${params}`),
        api.get(`/gastos/resumen/?${params}`),
      ]);
      setGastos(gastosRes.data.results ?? gastosRes.data);
      setResumen(resumenRes.data);
    } catch {
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [periodo, filtroTipo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api.get('/gastos/categorias/').then(r => {
      const data: CategoriaGasto[] = r.data.results ?? r.data;
      if (data.length === 0) {
        api.post('/gastos/categorias/seed/').then(() =>
          api.get('/gastos/categorias/').then(r2 => setCategorias(r2.data.results ?? r2.data))
        );
      } else {
        setCategorias(data);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoria || !form.descripcion || !form.monto) {
      toast.error('Completa los campos requeridos');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/gastos/', {
        categoria: Number(form.categoria),
        descripcion: form.descripcion,
        monto: form.monto,
        metodo_pago: form.metodo_pago,
        comprobante: form.comprobante,
        nota: form.nota,
      });
      toast.success('Gasto registrado');
      setShowModal(false);
      setForm({ categoria: '', descripcion: '', monto: '', metodo_pago: 'EFECTIVO', comprobante: '', nota: '' });
      fetchData();
    } catch {
      toast.error('Error al registrar gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const categoriaOptions = categorias.map(c => ({
    value: String(c.id),
    label: c.nombre,
    description: TIPOS_LABEL[c.tipo]?.label,
  }));

  const tipoOptions = [
    { value: '', label: 'Todos los tipos' },
    ...Object.entries(TIPOS_LABEL).map(([v, { label }]) => ({ value: v, label })),
  ];

  const gastosFiltrados = gastos.filter(g => {
    if (!busqueda) return true;
    return (
      g.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      g.categoria_nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

  const statCards = [
    { label: 'Total gastos', value: resumen?.total ?? 0, icon: DollarSign, color: 'from-indigo-500 to-violet-600', light: 'bg-indigo-50 text-indigo-600' },
    { label: 'Gastos fijos', value: resumen?.FIJO ?? 0, icon: Receipt, color: 'from-blue-500 to-blue-600', light: 'bg-blue-50 text-blue-600' },
    { label: 'Variables', value: resumen?.VARIABLE ?? 0, icon: TrendingDown, color: 'from-amber-500 to-amber-600', light: 'bg-amber-50 text-amber-600' },
    { label: 'Pérdidas', value: resumen?.PERDIDA ?? 0, icon: AlertTriangle, color: 'from-red-500 to-red-600', light: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gastos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de egresos del negocio</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Registrar gasto
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">{card.label}</span>
              <div className={`p-2 rounded-xl ${card.light}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {loading ? <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" /> : fmt(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Buscar por descripción o categoría..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="w-48">
            <CustomSelect
              value={filtroTipo}
              onChange={v => setFiltroTipo(v as string)}
              options={tipoOptions}
              placeholder="Tipo de gasto"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodo === p.value
                    ? 'bg-white shadow text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Método</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobante</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : gastosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No hay gastos registrados</p>
                  </td>
                </tr>
              ) : (
                gastosFiltrados.map(g => {
                  const tipo = TIPOS_LABEL[g.categoria_tipo] ?? { label: g.categoria_tipo, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <>
                      <tr
                        key={g.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                      >
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {new Date(g.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-800">{g.categoria_nombre}</span>
                            <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-semibold ${tipo.color}`}>
                              {tipo.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{g.descripcion}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${METODO_COLOR[g.metodo_pago] ?? 'bg-slate-100 text-slate-700'}`}>
                            {METODOS_PAGO.find(m => m.value === g.metodo_pago)?.label ?? g.metodo_pago}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{g.comprobante || '—'}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                          {fmt(parseFloat(g.monto))}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {expandedId === g.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>
                      {expandedId === g.id && g.nota && (
                        <tr key={`${g.id}-note`} className="bg-indigo-50/40">
                          <td colSpan={6} className="px-5 py-3 text-sm text-slate-600 italic">
                            📝 {g.nota}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Registrar Gasto</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoría <span className="text-red-500">*</span></label>
                <CustomSelect
                  value={form.categoria}
                  onChange={v => setForm(f => ({ ...f, categoria: v as string }))}
                  options={categoriaOptions}
                  placeholder="Seleccionar categoría..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción <span className="text-red-500">*</span></label>
                <input
                  className={inputCls}
                  placeholder="Ej: Pago alquiler local mes de julio"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto (RD$) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-center"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, metodo_pago: m.value }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        form.metodo_pago === m.value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <m.icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">No. Comprobante</label>
                <input
                  className={inputCls}
                  placeholder="No. factura o recibo (opcional)"
                  value={form.comprobante}
                  onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nota</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="Observaciones adicionales (opcional)"
                  value={form.nota}
                  onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
