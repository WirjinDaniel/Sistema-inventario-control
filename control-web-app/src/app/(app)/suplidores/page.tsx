'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { Suplidor, OrdenCompra, Producto } from '@/types';
import { useAuthStore } from '@/store/auth';
import { AccessDenied } from '@/components/shared/AccessDenied';
import { Skeleton } from '@/components/ui/skeleton';
import CustomSelect from '@/components/CustomSelect';
import toast from 'react-hot-toast';
import {
  Truck, Plus, X, Search, ChevronRight, ArrowLeft,
  Loader2, Package, CreditCard, Info, ShoppingCart, DollarSign, Trash2, FileText
} from 'lucide-react';
import { FormField } from '@/components/shared/FormField';

interface OrdenItem {
  producto: Producto | null;
  busqueda: string;
  resultados: Producto[];
  buscando: boolean;
  cantidad: string;
  precio_costo: string;
}

const itemVacio = (): OrdenItem => ({
  producto: null, busqueda: '', resultados: [], buscando: false, cantidad: '1', precio_costo: '',
});

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

const TIPO_PAGO_OPTS = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
];
const FRECUENCIA_OPTS = [
  { value: '',          label: 'Sin frecuencia' },
  { value: 'DIARIO',    label: 'Diario' },
  { value: 'SEMANAL',   label: 'Semanal' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'MENSUAL',   label: 'Mensual' },
];
const METODO_OPTS = [
  { value: 'EFECTIVO',      label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE',        label: 'Cheque' },
];
const ESTADO_OPTS = [
  { value: '',          label: 'Todos los estados' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'RECIBIDA',  label: 'Recibida' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const suplidorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido.'),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido.').optional().or(z.literal('')),
  rnc: z.string().optional(),
  direccion: z.string().optional(),
  tipo_pago: z.enum(['CONTADO', 'CREDITO']),
  dias_credito: z.string().optional(),
  limite_credito: z.string().optional(),
  descuento_habitual: z.string().optional(),
  frecuencia_entrega: z.string().optional(),
  notas: z.string().optional(),
});

const pagoSchema = z.object({
  monto: z.string().min(1, 'El monto es requerido.').refine((v) => Number(v) > 0, { message: 'Debe ser mayor a 0.' }),
  metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE']),
  referencia: z.string().optional(),
  nota: z.string().optional(),
});

type SuplidorForm = z.infer<typeof suplidorSchema>;
type PagoForm = z.infer<typeof pagoSchema>;

const FORM_EMPTY: SuplidorForm = {
  nombre: '', contacto: '', telefono: '', email: '', rnc: '',
  direccion: '', tipo_pago: 'CONTADO', dias_credito: '30',
  limite_credito: '0', descuento_habitual: '0', frecuencia_entrega: '', notas: '',
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

export default function SuplidoresPage() {
  const { esAdmin, esSuperadmin } = useAuthStore();
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Suplidor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register: regSup, handleSubmit: handleSup, control: ctrlSup,
    watch: watchSup, reset: resetSup, formState: { errors: errSup },
  } = useForm<SuplidorForm>({ resolver: zodResolver(suplidorSchema), defaultValues: FORM_EMPTY });
  const tipoPago = watchSup('tipo_pago');

  // Detail view
  const [detalle, setDetalle] = useState<Suplidor | null>(null);
  const [tab, setTab] = useState<'info' | 'compras' | 'cuenta'>('info');

  // Compras in detail
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');

  // Nueva orden modal
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [ordenForm, setOrdenForm] = useState({ suplidor: '', numero_factura: '', notas: '' });
  const [ordenItems, setOrdenItems] = useState<OrdenItem[]>([itemVacio()]);
  const [submittingOrden, setSubmittingOrden] = useState(false);

  // Payment modal
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null);
  const [submittingPago, setSubmittingPago] = useState(false);

  const {
    register: regPago, handleSubmit: handlePago, control: ctrlPago,
    reset: resetPago, formState: { errors: errPago },
  } = useForm<PagoForm>({ resolver: zodResolver(pagoSchema), defaultValues: { monto: '', metodo: 'EFECTIVO', referencia: '', nota: '' } });

  const buscarProducto = async (idx: number, q: string) => {
    setOrdenItems(prev => prev.map((it, i) => i === idx ? { ...it, busqueda: q, buscando: !!q } : it));
    if (!q) { setOrdenItems(prev => prev.map((it, i) => i === idx ? { ...it, resultados: [], buscando: false } : it)); return; }
    try {
      const r = await api.get('/inventario/productos/', { params: { search: q, activo: true } });
      const lista: Producto[] = r.data.results ?? r.data;
      setOrdenItems(prev => prev.map((it, i) => i === idx ? { ...it, resultados: lista, buscando: false } : it));
    } catch {
      setOrdenItems(prev => prev.map((it, i) => i === idx ? { ...it, buscando: false } : it));
    }
  };

  const seleccionarProducto = (idx: number, prod: Producto) => {
    setOrdenItems(prev => prev.map((it, i) => i === idx ? {
      ...it, producto: prod, busqueda: prod.nombre, resultados: [],
      precio_costo: prod.precio_costo,
    } : it));
  };

  const actualizarItem = (idx: number, campo: 'cantidad' | 'precio_costo', valor: string) => {
    setOrdenItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  };

  const eliminarItem = (idx: number) => {
    setOrdenItems(prev => prev.length === 1 ? [itemVacio()] : prev.filter((_, i) => i !== idx));
  };

  const totalOrden = ordenItems.reduce((sum, it) => {
    const cant = parseFloat(it.cantidad) || 0;
    const precio = parseFloat(it.precio_costo) || 0;
    return sum + cant * precio;
  }, 0);

  const handleOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsValidos = ordenItems.filter(it => it.producto && parseFloat(it.cantidad) > 0);
    if (!ordenForm.suplidor) { toast.error('Selecciona un suplidor'); return; }
    if (itemsValidos.length === 0) { toast.error('Agrega al menos un producto'); return; }
    setSubmittingOrden(true);
    try {
      const r = await api.post('/compras/ordenes/', {
        suplidor: parseInt(ordenForm.suplidor),
        numero_factura: ordenForm.numero_factura,
        notas: ordenForm.notas,
        items: itemsValidos.map(it => ({
          producto: it.producto!.id,
          cantidad: parseFloat(it.cantidad),
          precio_costo: parseFloat(it.precio_costo),
        })),
      });
      toast.success(`Orden #${r.data.id} creada exitosamente`);
      setShowOrdenModal(false);
      setOrdenForm({ suplidor: '', numero_factura: '', notas: '' });
      setOrdenItems([itemVacio()]);
      fetchSuplidores();
    } catch {
      toast.error('Error al crear la orden');
    } finally {
      setSubmittingOrden(false);
    }
  };

  const fetchSuplidores = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/compras/suplidores/', { params: busqueda ? { search: busqueda } : {} });
      setSuplidores(r.data.results ?? r.data);
    } catch {
      toast.error('Error al cargar suplidores');
    } finally {
      setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(fetchSuplidores, 300);
    return () => clearTimeout(t);
  }, [fetchSuplidores]);

  const fetchOrdenes = useCallback(async (supId: number) => {
    setLoadingOrdenes(true);
    try {
      const r = await api.get('/compras/ordenes/', { params: { suplidor: supId } });
      setOrdenes(r.data.results ?? r.data);
    } catch {
      toast.error('Error al cargar órdenes');
    } finally {
      setLoadingOrdenes(false);
    }
  }, []);

  useEffect(() => {
    if (detalle && (tab === 'compras' || tab === 'cuenta')) {
      fetchOrdenes(detalle.id);
    }
  }, [detalle, tab, fetchOrdenes]);

  const openCreate = () => { setEditando(null); resetSup(FORM_EMPTY); setShowModal(true); };
  const openEdit = (s: Suplidor) => {
    setEditando(s);
    resetSup({
      nombre: s.nombre, contacto: s.contacto, telefono: s.telefono, email: s.email,
      rnc: s.rnc, direccion: s.direccion, tipo_pago: s.tipo_pago as 'CONTADO' | 'CREDITO',
      dias_credito: String(s.dias_credito), limite_credito: s.limite_credito,
      descuento_habitual: s.descuento_habitual, frecuencia_entrega: s.frecuencia_entrega,
      notas: s.notas,
    });
    setShowModal(true);
  };

  const onSubmitSuplidor = handleSup(async (data) => {
    setSubmitting(true);
    try {
      const payload = { ...data, dias_credito: Number(data.dias_credito) };
      if (editando) {
        await api.patch(`/compras/suplidores/${editando.id}/`, payload);
        toast.success('Suplidor actualizado');
      } else {
        await api.post('/compras/suplidores/', payload);
        toast.success('Suplidor creado');
      }
      setShowModal(false);
      fetchSuplidores();
    } catch {
      toast.error('Error al guardar suplidor');
    } finally {
      setSubmitting(false);
    }
  });

  const onSubmitPago = handlePago(async (data) => {
    if (!ordenSeleccionada) return;
    setSubmittingPago(true);
    try {
      await api.post('/compras/pagos/', {
        orden: ordenSeleccionada.id,
        monto: data.monto, metodo: data.metodo,
        referencia: data.referencia, nota: data.nota,
      });
      toast.success('Pago registrado');
      setShowPagoModal(false);
      resetPago();
      setOrdenSeleccionada(null);
      if (detalle) {
        fetchOrdenes(detalle.id);
        const r = await api.get(`/compras/suplidores/${detalle.id}/`);
        setDetalle(r.data);
      }
    } catch {
      toast.error('Error al registrar pago');
    } finally {
      setSubmittingPago(false);
    }
  });

  const recibirOrden = async (orden: OrdenCompra) => {
    try {
      await api.post(`/compras/ordenes/${orden.id}/recibir/`);
      toast.success('Orden marcada como recibida y stock actualizado');
      if (detalle) fetchOrdenes(detalle.id);
    } catch {
      toast.error('Error al recibir orden');
    }
  };

  const ordenesFiltradas = ordenes.filter(o => !filtroEstado || o.estado === filtroEstado);
  const ordenesPendientes = ordenes.filter(o => o.estado === 'RECIBIDA' && parseFloat(o.balance_pendiente) > 0);

  // === DETAIL VIEW ===
  if (detalle) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDetalle(null)}
            className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{detalle.nombre}</h1>
            <p className="text-sm text-slate-500">{detalle.telefono} · {detalle.tipo_pago}</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => openEdit(detalle)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Editar
            </button>
          </div>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total comprado', value: detalle.total_comprado, color: 'text-slate-800' },
            { label: 'Total pagado', value: detalle.total_pagado, color: 'text-green-600' },
            { label: 'Balance pendiente', value: detalle.balance_pendiente, color: detalle.balance_pendiente > 0 ? 'text-red-600' : 'text-slate-400' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{fmt(c.value)}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {([['info', 'Información', Info], ['compras', 'Historial compras', ShoppingCart], ['cuenta', 'Estado de cuenta', CreditCard]] as [string, string, React.ElementType][]).map(([t, label, Icon]) => (
              <button
                key={t}
                onClick={() => setTab(t as typeof tab)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* INFO TAB */}
            {tab === 'info' && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  ['Nombre', detalle.nombre], ['Contacto', detalle.contacto],
                  ['Teléfono', detalle.telefono], ['Email', detalle.email],
                  ['RNC', detalle.rnc || '—'], ['Dirección', detalle.direccion || '—'],
                  ['Tipo pago', detalle.tipo_pago], ['Días crédito', detalle.tipo_pago === 'CREDITO' ? String(detalle.dias_credito) : '—'],
                  ['Límite crédito', detalle.tipo_pago === 'CREDITO' ? fmt(Number(detalle.limite_credito)) : '—'],
                  ['Descuento habitual', detalle.descuento_habitual !== '0.00' ? `${detalle.descuento_habitual}%` : '—'],
                  ['Frecuencia entrega', detalle.frecuencia_entrega || '—'],
                  ['Última compra', detalle.ultima_compra ? fmtDate(detalle.ultima_compra) : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="text-slate-400 text-xs">{k}</span>
                    <p className="font-medium text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
                {detalle.notas && (
                  <div className="col-span-2">
                    <span className="text-slate-400 text-xs">Notas</span>
                    <p className="font-medium text-slate-800 mt-0.5">{detalle.notas}</p>
                  </div>
                )}
              </div>
            )}

            {/* COMPRAS TAB */}
            {tab === 'compras' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-44">
                    <CustomSelect
                      value={filtroEstado}
                      onChange={v => setFiltroEstado(v as string)}
                      options={ESTADO_OPTS}
                      placeholder="Estado"
                    />
                  </div>
                </div>
                {loadingOrdenes ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                  </div>
                ) : ordenesFiltradas.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No hay órdenes de compra</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ordenesFiltradas.map(o => (
                      <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            #{o.id} {o.numero_factura ? `— Factura ${o.numero_factura}` : ''}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{fmtDate(o.fecha)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            o.estado === 'RECIBIDA' ? 'bg-green-100 text-green-700' :
                            o.estado === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{o.estado}</span>
                          <span className="font-bold text-slate-800 text-sm">{fmt(o.total)}</span>
                          {o.estado === 'PENDIENTE' && (
                            <button
                              onClick={() => recibirOrden(o)}
                              className="px-3 py-1 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition"
                            >
                              Recibir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CUENTA TAB */}
            {tab === 'cuenta' && (
              <div className="space-y-4">
                {loadingOrdenes ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                  </div>
                ) : ordenesPendientes.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No hay facturas pendientes de pago</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ordenesPendientes.map(o => (
                      <div key={o.id} className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              #{o.id} {o.numero_factura ? `— Factura ${o.numero_factura}` : ''}
                            </p>
                            <p className="text-xs text-slate-400">{fmtDate(o.fecha)}</p>
                          </div>
                          <button
                            onClick={() => { setOrdenSeleccionada(o); setShowPagoModal(true); }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
                          >
                            Registrar pago
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <p className="text-slate-400">Total</p>
                            <p className="font-bold text-slate-700">{fmt(o.total)}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2">
                            <p className="text-slate-400">Pagado</p>
                            <p className="font-bold text-green-700">{fmt(o.total_pagado)}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-slate-400">Pendiente</p>
                            <p className="font-bold text-red-700">{fmt(o.balance_pendiente)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pago modal */}
        {showPagoModal && ordenSeleccionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Registrar Pago</h2>
                <button onClick={() => setShowPagoModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={onSubmitPago} className="p-6 space-y-4">
                <p className="text-sm text-slate-500">
                  Orden #{ordenSeleccionada.id} · Pendiente: <span className="font-bold text-red-600">{fmt(ordenSeleccionada.balance_pendiente)}</span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Monto (RD$) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-center"
                    placeholder="0.00"
                    aria-required="true"
                    aria-invalid={!!errPago.monto}
                    {...regPago('monto')}
                  />
                  {errPago.monto && <p role="alert" className="text-xs text-destructive mt-1">{errPago.monto.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Método</label>
                  <Controller
                    name="metodo"
                    control={ctrlPago}
                    render={({ field }) => (
                      <CustomSelect value={field.value} onChange={v => field.onChange(v)} options={METODO_OPTS} placeholder="Método de pago" />
                    )}
                  />
                </div>
                <FormField label="Referencia" placeholder="No. cheque, transferencia, etc." {...regPago('referencia')} />
                <FormField label="Nota" placeholder="Opcional" {...regPago('nota')} />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPagoModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold text-sm transition">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submittingPago} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
                    {submittingPago && <Loader2 className="w-4 h-4 animate-spin" />}
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

  if (!esAdmin() && !esSuperadmin()) return <AccessDenied />;

  // === LIST VIEW ===
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suplidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de proveedores y cuentas por pagar</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setOrdenForm({ suplidor: '', numero_factura: '', notas: '' }); setOrdenItems([itemVacio()]); setShowOrdenModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition"
          >
            <FileText className="w-4 h-4" />
            Nueva orden
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo suplidor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="Buscar por nombre, RNC, teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Suplidor</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Tipo pago</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Última compra</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Balance</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : suplidores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No hay suplidores registrados</p>
                  </td>
                </tr>
              ) : (
                suplidores.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setDetalle(s)}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800">{s.nombre}</p>
                        {s.contacto && <p className="text-xs text-slate-400">{s.contacto}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{s.telefono || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.tipo_pago === 'CREDITO' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>{s.tipo_pago}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {s.ultima_compra ? fmtDate(s.ultima_compra) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {s.balance_pendiente > 0 ? (
                        <span className="font-bold text-red-600">{fmt(s.balance_pendiente)}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Al día</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nueva Orden Modal */}
      {showOrdenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Nueva Orden de Compra</h2>
              </div>
              <button onClick={() => setShowOrdenModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrden} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Header fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Suplidor <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={ordenForm.suplidor}
                      onChange={v => setOrdenForm(f => ({ ...f, suplidor: v as string }))}
                      options={suplidores.map(s => ({ value: String(s.id), label: s.nombre }))}
                      placeholder="Seleccionar suplidor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nº Factura</label>
                    <input
                      className={inputCls}
                      placeholder="FAC-0001"
                      value={ordenForm.numero_factura}
                      onChange={e => setOrdenForm(f => ({ ...f, numero_factura: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
                    <input
                      className={inputCls}
                      placeholder="Observaciones..."
                      value={ordenForm.notas}
                      onChange={e => setOrdenForm(f => ({ ...f, notas: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">Productos</p>
                    <button
                      type="button"
                      onClick={() => setOrdenItems(prev => [...prev, itemVacio()])}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar línea
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide w-1/2">Producto</th>
                          <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide w-24">Cantidad</th>
                          <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide w-32">Precio costo</th>
                          <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide w-28">Subtotal</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ordenItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2.5">
                              <div className="relative">
                                <div className="relative flex items-center">
                                  <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                  <input
                                    className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    placeholder="Buscar producto..."
                                    value={item.busqueda}
                                    onChange={e => buscarProducto(idx, e.target.value)}
                                  />
                                  {item.buscando && <Loader2 className="absolute right-2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                                </div>
                                {item.resultados.length > 0 && (
                                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                                    {item.resultados.map(p => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => seleccionarProducto(idx, p)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                                      >
                                        <p className="text-sm font-medium text-slate-800">{p.nombre}</p>
                                        <p className="text-xs text-slate-400">{p.sku} · RD${parseFloat(p.precio_costo).toFixed(2)}</p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number" min="0.01" step="0.01"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                value={item.cantidad}
                                onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">RD$</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  className="w-full border border-slate-200 rounded-lg pl-9 pr-2 py-1.5 text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                  value={item.precio_costo}
                                  onChange={e => actualizarItem(idx, 'precio_costo', e.target.value)}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-semibold text-slate-700 text-sm">
                                {((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_costo) || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                type="button"
                                onClick={() => eliminarItem(idx)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer con total */}
              <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">TOTAL ORDEN</p>
                  <p className="text-2xl font-bold text-slate-900">RD${totalOrden.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOrdenModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrden}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:shadow-md transition disabled:opacity-60"
                  >
                    {submittingOrden ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Crear orden
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {editando ? 'Editar Suplidor' : 'Nuevo Suplidor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmitSuplidor} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormField label="Nombre" required placeholder="Nombre del suplidor" error={errSup.nombre?.message} {...regSup('nombre')} />
                </div>
                <FormField label="Contacto" placeholder="Persona de contacto" {...regSup('contacto')} />
                <FormField label="Teléfono" placeholder="809-000-0000" {...regSup('telefono')} />
                <FormField label="Email" type="email" placeholder="correo@empresa.com" error={errSup.email?.message} {...regSup('email')} />
                <FormField label="RNC" placeholder="000-00000-0" {...regSup('rnc')} />
                <div className="col-span-2">
                  <FormField label="Dirección" placeholder="Dirección física" {...regSup('direccion')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Tipo de pago</label>
                  <Controller
                    name="tipo_pago"
                    control={ctrlSup}
                    render={({ field }) => (
                      <CustomSelect value={field.value} onChange={v => field.onChange(v)} options={TIPO_PAGO_OPTS} placeholder="Tipo" />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Frecuencia de entrega</label>
                  <Controller
                    name="frecuencia_entrega"
                    control={ctrlSup}
                    render={({ field }) => (
                      <CustomSelect value={field.value ?? ''} onChange={v => field.onChange(v)} options={FRECUENCIA_OPTS} placeholder="Frecuencia" />
                    )}
                  />
                </div>
                {tipoPago === 'CREDITO' && (
                  <>
                    <FormField label="Días de crédito" type="number" min="0" placeholder="30" {...regSup('dias_credito')} />
                    <FormField label="Límite de crédito (RD$)" type="number" min="0" placeholder="0.00" {...regSup('limite_credito')} />
                  </>
                )}
                <FormField label="Descuento habitual (%)" type="number" min="0" max="100" step="0.01" placeholder="0" {...regSup('descuento_habitual')} />
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Notas</label>
                  <textarea rows={2} className={inputCls} placeholder="Observaciones adicionales" {...regSup('notas')} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editando ? 'Actualizar' : 'Crear suplidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
