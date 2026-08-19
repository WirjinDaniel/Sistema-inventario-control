'use client';

import { useEffect, useState } from 'react';
import {
  Store, DollarSign, ShoppingBag, Users, Package, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Trophy, ArrowUpRight, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ColmadoStats {
  id: number;
  nombre: string;
  ventas_hoy: number;
  tickets_hoy: number;
  usuarios: number;
  productos: number;
}

interface DashboardData {
  periodo: string;
  colmados_activos: number;
  ventas_totales: number;
  ventas_hoy: number;
  tickets_totales: number;
  tickets_hoy: number;
  clientes_activos: number;
  productos_totales: number;
  productos_bajo_stock: number;
  gastos_totales: number;
  gastos_hoy: number;
  colmados_stats: ColmadoStats[];
}

interface VentasPorColmado {
  colmado_nombre: string;
  total: number;
  porcentaje: number;
  tickets: number;
}

const BAR_COLORS = [
  'var(--color-chart-1, #6366f1)',
  'var(--color-chart-2, #10b981)',
  'var(--color-chart-3, #f59e0b)',
  'var(--color-chart-4, #ef4444)',
  'var(--color-chart-5, #8b5cf6)',
  'var(--color-chart-6, #06b6d4)',
  'var(--color-chart-7, #f97316)',
];

function fmt(n: number) {
  if (n >= 1000000) return `RD$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `RD$${(n / 1000).toFixed(1)}k`;
  return `RD$${n.toFixed(2)}`;
}

interface KpiProps {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  accent: string; iconBg: string; iconColor: string; loading?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, accent, iconBg, iconColor, loading }: KpiProps) {
  if (loading) return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <Skeleton className="w-11 h-11 rounded-xl mb-4" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
  return (
    <div className={cn(
      'bg-card rounded-2xl border-l-4 border-t border-r border-b p-5 shadow-sm',
      'hover:shadow-md transition-all duration-200',
      'border-t-border border-r-border border-b-border',
      accent
    )}>
      <div className="mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shadow-sm', iconBg)}>
          <Icon size={19} className={iconColor} />
        </div>
      </div>
      <p className="text-3xl font-black text-foreground tabular-nums tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  );
}

export default function SuperadminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [ventasColmado, setVentasColmado] = useState<VentasPorColmado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const [statsRes, ventasRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/ventas-por-colmado'),
      ]);
      setData(statsRes.data);
      setVentasColmado(ventasRes.data.results ?? ventasRes.data);
      setError(null);
    } catch {
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Dashboard Global
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Consolidado de todos los colmados
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn('text-muted-foreground', refreshing && 'animate-spin')} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">{error}</p>
          </div>
        )}

        {/* KPIs fila 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={DollarSign} label="Ventas hoy" loading={loading}
            value={data ? fmt(Number(data.ventas_hoy)) : '—'}
            accent="border-l-indigo-500"
            iconBg="bg-indigo-50 dark:bg-indigo-950"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            icon={ShoppingBag} label="Tickets hoy" loading={loading}
            value={data?.tickets_hoy ?? '—'}
            accent="border-l-sky-500"
            iconBg="bg-sky-50 dark:bg-sky-950"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <KpiCard
            icon={Store} label="Colmados activos" loading={loading}
            value={data?.colmados_activos ?? '—'}
            accent="border-l-violet-500"
            iconBg="bg-violet-50 dark:bg-violet-950"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <KpiCard
            icon={TrendingUp} label="Ventas totales" loading={loading}
            value={data ? fmt(Number(data.ventas_totales)) : '—'}
            sub="acumulado histórico"
            accent="border-l-emerald-500"
            iconBg="bg-emerald-50 dark:bg-emerald-950"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* KPIs fila 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users} label="Clientes activos" loading={loading}
            value={data?.clientes_activos ?? '—'}
            accent="border-l-amber-500"
            iconBg="bg-amber-50 dark:bg-amber-950"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            icon={Package} label="Productos" loading={loading}
            value={data?.productos_totales ?? '—'}
            accent="border-l-cyan-500"
            iconBg="bg-cyan-50 dark:bg-cyan-950"
            iconColor="text-cyan-600 dark:text-cyan-400"
          />
          <KpiCard
            icon={AlertTriangle} label="Stock bajo" loading={loading}
            value={data?.productos_bajo_stock ?? '—'}
            accent="border-l-rose-500"
            iconBg="bg-rose-50 dark:bg-rose-950"
            iconColor="text-rose-600 dark:text-rose-400"
          />
          <KpiCard
            icon={TrendingDown} label="Gastos hoy" loading={loading}
            value={data ? fmt(Number(data.gastos_hoy)) : '—'}
            accent="border-l-orange-500"
            iconBg="bg-orange-50 dark:bg-orange-950"
            iconColor="text-orange-600 dark:text-orange-400"
          />
        </div>

        {/* Gráfica ventas por colmado */}
        {(loading || ventasColmado.length > 0) && (
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                  <BarChart2 size={15} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Ventas por Colmado</p>
                  <p className="text-xs text-muted-foreground">Últimos 30 días</p>
                </div>
              </div>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold px-3 py-1 rounded-full">
                30 días
              </span>
            </div>
            <div className="px-5 pb-5">
              {loading ? (
                <Skeleton className="w-full h-56" />
              ) : (
                <>
                  <svg width="0" height="0" style={{ position: 'absolute' }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4338ca" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <ResponsiveContainer width="100%" height={Math.max(180, ventasColmado.length * 52)}>
                    <BarChart
                      data={ventasColmado}
                      layout="vertical"
                      margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="colmado_nombre"
                        width={160}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as VentasPorColmado;
                          const totalGlobal = ventasColmado.reduce((s, c) => s + Number(c.total), 0);
                          const pct = totalGlobal > 0 ? ((Number(d.total) / totalGlobal) * 100).toFixed(1) : '0.0';
                          return (
                            <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-xl text-xs space-y-1 border border-white/10">
                              <p className="font-bold text-sm">{d.colmado_nombre}</p>
                              <p className="text-indigo-300 font-semibold">{fmt(Number(d.total))}</p>
                              <p className="text-slate-400">{pct}% del total</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="total" radius={[0, 10, 10, 0]} name="Ventas (RD$)" label={{
                        position: 'right',
                        formatter: (v: unknown) => fmt(Number(v)),
                        fontSize: 10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}>
                        {ventasColmado.map((row, i) => (
                          <Cell
                            key={i}
                            fill={Number(row.total) === 0 ? '#eef0f9' : 'url(#barGradient)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
        )}

        {/* Ranking + Tabla */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ranking de ventas */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-5 pb-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                <Trophy size={15} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Ranking de ventas</p>
                <p className="text-xs text-muted-foreground">Últimos 30 días</p>
              </div>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : ventasColmado.length ? (
              <div className="divide-y divide-border">
                {ventasColmado.map((col, idx) => (
                  <div key={idx} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                        idx === 0 ? 'bg-amber-50 dark:bg-amber-950 text-amber-600' :
                        idx === 1 ? 'bg-muted text-muted-foreground' :
                        idx === 2 ? 'bg-orange-50 dark:bg-orange-950 text-orange-500' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {idx + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {col.colmado_nombre}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(Number(col.porcentaje), 100)}%`, background: BAR_COLORS[idx % BAR_COLORS.length] }}
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black tabular-nums text-foreground">
                          {fmt(Number(col.total))}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-end gap-0.5">
                          <ArrowUpRight size={9} />
                          {Number(col.porcentaje).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground font-medium">
                Sin datos de ventas
              </div>
            )}
          </div>

          {/* Stats por colmado */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-5 pb-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                <Store size={15} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Stats por colmado</p>
                <p className="text-xs text-muted-foreground">Actividad de hoy</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5 space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : data?.colmados_stats.length ? (
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#EEF0FF' }} className="dark:bg-slate-700/50">
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wide">Colmado</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wide">Ventas</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wide">Tickets</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wide">Usuarios</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wide">Prods</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.colmados_stats.map((col, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BAR_COLORS[idx % BAR_COLORS.length] }} />
                            <span className="font-semibold text-foreground truncate max-w-35">{col.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums text-foreground">
                          {fmt(Number(col.ventas_hoy))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold">{col.tickets_hoy}</td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold">{col.usuarios}</td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold">{col.productos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground font-medium">
                  Sin colmados registrados
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerta stock bajo */}
        {(data?.productos_bajo_stock ?? 0) > 0 && !loading && (
          <div className="flex items-start gap-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                {data?.productos_bajo_stock} producto(s) con stock bajo en la red
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                Revisa el inventario de cada colmado para gestionar las reposiciones pendientes.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
