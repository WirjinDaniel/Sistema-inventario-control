'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AccessDenied } from '@/components/shared/AccessDenied';
import toast from 'react-hot-toast';
import {
  Warehouse, ArrowLeft, Package, Truck,
  Plus, X, Search, AlertTriangle,
} from 'lucide-react';
import type { OrdenCompra, Suplidor, Producto } from '@/types';

const fmt = (v: string | number) =>
  `RD$${Number(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const recepcionSchema = z.object({
  suplidor_id: z.string().optional(),
  numero_factura: z.string().optional(),
  notas: z.string().optional(),
});
type RecepcionForm = z.infer<typeof recepcionSchema>;

const inputCls = 'border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-card';

interface LineaRecepcion {
  producto_id: string;
  producto_nombre: string;
  cantidad_esperada: string;
  cantidad_recibida: string;
  precio_costo: string;
}

function RecepcionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ordenId = searchParams.get('orden');

  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [lineas, setLineas] = useState<LineaRecepcion[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    register: regRec, handleSubmit: handleRec, watch: watchRec,
    setValue: setRecVal, formState: { isSubmitting: guardando },
  } = useForm<RecepcionForm>({ resolver: zodResolver(recepcionSchema), defaultValues: { suplidor_id: '', numero_factura: '', notas: '' } });
  const suplidorId = watchRec('suplidor_id') ?? '';

  // Para recepción directa (sin orden previa)
  const [modoDirecto, setModoDirecto] = useState(!ordenId);
  const [busqProd, setBusqProd] = useState<Record<number, string>>({});
  const [resultsProd, setResultsProd] = useState<Record<number, Producto[]>>({});

  const cargarOrden = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/compras/ordenes/${id}/`);
      setOrden(data);
      setRecVal('suplidor_id', String(data.suplidor));
      setRecVal('numero_factura', data.numero_factura ?? '');
      setLineas((data.items ?? []).map((item: OrdenCompra['items'][0]) => ({
        producto_id: String(item.producto),
        producto_nombre: item.producto_nombre,
        cantidad_esperada: item.cantidad,
        cantidad_recibida: item.cantidad,
        precio_costo: item.precio_costo,
      })));
    } catch { toast.error('Error cargando la orden'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    api.get('/compras/suplidores/').then(({ data }) => setSuplidores(data.results ?? data)).catch(() => {});
    if (ordenId) cargarOrden(ordenId);
    else setLineas([{ producto_id: '', producto_nombre: '', cantidad_esperada: '', cantidad_recibida: '1', precio_costo: '' }]);
  }, [ordenId, cargarOrden]);

  async function buscarProducto(idx: number, q: string) {
    setBusqProd(p => ({ ...p, [idx]: q }));
    if (!q.trim()) { setResultsProd(p => ({ ...p, [idx]: [] })); return; }
    try {
      const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`);
      setResultsProd(p => ({ ...p, [idx]: (data.results ?? data).slice(0, 6) }));
    } catch { /* silencioso */ }
  }

  function seleccionarProducto(idx: number, prod: Producto) {
    setLineas(ls => ls.map((l, i) => i === idx
      ? { ...l, producto_id: String(prod.id), producto_nombre: prod.nombre, precio_costo: prod.precio_costo }
      : l));
    setBusqProd(p => ({ ...p, [idx]: '' }));
    setResultsProd(p => ({ ...p, [idx]: [] }));
  }

  const confirmarRecepcion = handleRec(async (data) => {
    const lineasValidas = lineas.filter(l => l.producto_id && Number(l.cantidad_recibida) > 0);
    if (!lineasValidas.length) return toast.error('Ingresa al menos un producto con cantidad > 0');
    if (!data.suplidor_id && modoDirecto) return toast.error('Selecciona un proveedor');
    try {
      if (ordenId && orden) {
        await api.patch(`/compras/ordenes/${orden.id}/`, {
          estado: 'RECIBIDA',
          fecha_recepcion: new Date().toISOString().split('T')[0],
          notas: data.notas,
        });
        for (const linea of lineasValidas) {
          await api.post('/inventario/movimientos/', {
            producto: linea.producto_id,
            tipo: 'ENTRADA',
            cantidad: linea.cantidad_recibida,
            referencia: `Compra #${orden.id}`,
            nota: `Recepción de ${orden.suplidor_nombre}`,
          });
        }
        toast.success(`Recepción confirmada — stock actualizado para ${lineasValidas.length} producto(s)`);
      } else {
        const { data: nuevaOrden } = await api.post('/compras/ordenes/', {
          suplidor: data.suplidor_id,
          numero_factura: data.numero_factura,
          notas: data.notas,
          items: lineasValidas.map(l => ({ producto: l.producto_id, cantidad: l.cantidad_recibida, precio_costo: l.precio_costo })),
        });
        await api.patch(`/compras/ordenes/${nuevaOrden.id}/`, { estado: 'RECIBIDA', fecha_recepcion: new Date().toISOString().split('T')[0] });
        for (const linea of lineasValidas) {
          await api.post('/inventario/movimientos/', {
            producto: linea.producto_id,
            tipo: 'ENTRADA',
            cantidad: linea.cantidad_recibida,
            referencia: `Compra #${nuevaOrden.id}`,
            nota: `Recepción directa — ${suplidores.find(s => String(s.id) === data.suplidor_id)?.nombre ?? ''}`,
          });
        }
        toast.success('Mercancía recibida y stock actualizado');
      }
      router.push('/compras');
    } catch { toast.error('Error al confirmar la recepción'); }
  });

  const totalRecibido = lineas.reduce((s, l) => s + Number(l.cantidad_recibida || 0) * Number(l.precio_costo || 0), 0);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted/60 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/compras')} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-linear-to-r from-transparent via-white/40 to-transparent" />
            <Warehouse size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Recepción de Mercancía</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {orden ? `Orden #${orden.id} — ${orden.suplidor_nombre}` : 'Entrada directa al inventario'}
            </p>
          </div>
        </div>
      </div>

      {/* Modo selector (solo sin orden previa) */}
      {!ordenId && (
        <div className="flex gap-2">
          <button onClick={() => setModoDirecto(false)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${!modoDirecto ? 'bg-linear-to-br from-brand-500 to-indigo-600 text-white border-brand-500 shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-brand-300 hover:text-foreground'}`}>
            Desde orden de compra
          </button>
          <button onClick={() => setModoDirecto(true)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${modoDirecto ? 'bg-linear-to-br from-brand-500 to-indigo-600 text-white border-brand-500 shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-brand-300 hover:text-foreground'}`}>
            Entrada directa
          </button>
        </div>
      )}

      <div className="relative bg-card border border-border rounded-2xl shadow-sm p-6 space-y-5 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
        {/* Proveedor y factura */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Truck size={12} /> Proveedor</label>
            {orden ? (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-xl bg-muted/40 text-sm text-foreground">
                <div className="w-5 h-5 rounded-md bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Truck size={10} className="text-white" />
                </div>
                {orden.suplidor_nombre}
              </div>
            ) : (
              <select className={`${inputCls} w-full`} {...regRec('suplidor_id')}>
                <option value="">Seleccionar proveedor...</option>
                {suplidores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">N° Factura</label>
            <input placeholder="Ej: B15001234" className={`${inputCls} w-full`}
              disabled={!!orden} {...regRec('numero_factura')} />
          </div>
        </div>

        {/* Líneas */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
              <Package size={9} className="text-white" />
            </div>
            Productos recibidos
          </label>
          {lineas.map((linea, idx) => (
            <div key={idx} className={`grid gap-2 items-start rounded-xl border p-3 transition-colors ${
              orden ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto_auto]'
            } ${linea.producto_nombre ? 'border-border bg-card' : 'border-dashed border-border bg-muted/30'}`}>
              {/* Producto */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1.5">
                  <Package size={11} className="text-white" />
                </div>
                {linea.producto_nombre ? (
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{linea.producto_nombre}</p>
                    {linea.cantidad_esperada && (
                      <p className="text-xs text-muted-foreground">Esperado: {linea.cantidad_esperada}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={busqProd[idx] ?? ''} onChange={e => buscarProducto(idx, e.target.value)}
                      placeholder="Buscar producto..."
                      className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-card text-foreground placeholder:text-muted-foreground" />
                    {(resultsProd[idx] ?? []).length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-border rounded-xl shadow-lg bg-card overflow-hidden">
                        {(resultsProd[idx] ?? []).map(p => (
                          <button key={p.id} type="button" onClick={() => seleccionarProducto(idx, p)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left text-sm text-foreground border-b border-border/50 last:border-0">
                            <span className="flex-1">{p.nombre}</span>
                            <span className="text-xs text-muted-foreground">{fmt(p.precio_costo)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cantidad recibida */}
              <div className="flex flex-col gap-0.5">
                <label className="text-2xs text-muted-foreground font-semibold uppercase tracking-widest">Cantidad</label>
                <input type="number" value={linea.cantidad_recibida} min="0" step="0.01"
                  onChange={e => setLineas(ls => ls.map((l, i) => i === idx ? { ...l, cantidad_recibida: e.target.value } : l))}
                  className="w-20 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-card text-foreground" />
              </div>

              {/* Precio costo */}
              <div className="flex flex-col gap-0.5">
                <label className="text-2xs text-muted-foreground font-semibold uppercase tracking-widest">Costo unit.</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <input type="number" value={linea.precio_costo} step="0.01"
                    onChange={e => setLineas(ls => ls.map((l, i) => i === idx ? { ...l, precio_costo: e.target.value } : l))}
                    className="w-28 pl-5 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-card text-foreground" />
                </div>
              </div>

              {/* Subtotal */}
              <div className="flex flex-col gap-0.5 text-right">
                <label className="text-2xs text-muted-foreground font-semibold uppercase tracking-widest">Subtotal</label>
                <span className="text-sm font-black text-foreground pt-1.5">
                  {fmt(Number(linea.cantidad_recibida || 0) * Number(linea.precio_costo || 0))}
                </span>
              </div>

              {/* Alerta diferencia */}
              {linea.cantidad_esperada && linea.cantidad_recibida !== linea.cantidad_esperada && (
                <div className="col-span-full flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle size={12} /> Diferencia: esperado {linea.cantidad_esperada}, recibido {linea.cantidad_recibida}
                </div>
              )}

              {/* Eliminar (modo directo) */}
              {modoDirecto && !orden && lineas.length > 1 && (
                <button onClick={() => setLineas(ls => ls.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground/40 hover:text-rose-500 transition-colors self-center">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {(modoDirecto || !orden) && (
            <button onClick={() => setLineas(ls => [...ls, { producto_id: '', producto_nombre: '', cantidad_esperada: '', cantidad_recibida: '1', precio_costo: '' }])}
              className="flex items-center gap-1.5 text-sm text-brand-600 font-semibold hover:text-brand-700 hover:underline mt-1 transition-colors">
              <Plus size={14} /> Agregar producto
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Notas</label>
          <input placeholder="Observaciones de la recepción" className={`${inputCls} w-full`} {...regRec('notas')} />
        </div>

        {/* Total */}
        <div className="relative flex items-center justify-between bg-linear-to-r from-brand-50/60 to-indigo-50/60 border border-brand-200/60 rounded-xl px-5 py-3.5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Warehouse size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-brand-700">Total mercancía recibida</span>
          </div>
          <span className="text-xl font-black text-brand-700">{fmt(totalRecibido)}</span>
        </div>
      </div>

      {/* Botón confirmar */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/compras')} className="px-6 py-2.5 rounded-xl border border-border bg-card text-muted-foreground text-sm font-semibold hover:bg-muted/50 transition-colors">
          Cancelar
        </button>
        <button onClick={confirmarRecepcion} disabled={guardando}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-semibold shadow-sm shadow-emerald-500/30 transition-all duration-200 disabled:opacity-60 active:scale-95">
          {guardando
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Warehouse size={16} /> Confirmar recepción</>}
        </button>
      </div>
    </div>
  );
}

export default function RecepcionPage() {
  const { esAdmin, esSuperadmin, usuario } = useAuthStore();
  if (!esAdmin() && !esSuperadmin() && usuario?.rol !== "INVENTARIO") return <AccessDenied />;
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Cargando...</div>}>
      <RecepcionContent />
    </Suspense>
  );
}
