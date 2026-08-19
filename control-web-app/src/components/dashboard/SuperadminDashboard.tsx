'use client';

import { useEffect, useState } from 'react';
import {
  Store, DollarSign, ShoppingBag, Users, Package, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Trophy, ArrowUpRight, BarChart2,
  Activity,
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

const BAR_GRADIENT = ['#818cf8', '#4338ca'];

const BAR_COLORS = [
  'var(--color-chart-1, #6366f1)',
  'var(--color-chart-2, #10b981)',
  'var(--color-chart-3, #f59e0b)',
  'var(--color-chart-4, #ef4444)',
  'var(--color-chart-5, #8b5cf6)',
  'var(--color-chart-6, #06b6d4)',
  'var(--color-chart-7, #f97316)',
];

const MEDAL_COLORS = [
  { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-300 dark:ring-amber-700' },
  { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-300 dark:ring-slate-600' },
  { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-600 dark:text-orange-300', ring: 'ring-orange-300 dark:ring-orange-700' },
];

function fmt(n: number) {
  if (n >= 1000000) return `RD$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `RD$${(n / 1000).toFixed(1)}k`;
  return `RD$${n.toFixed(2)}`;
}

/* ─── Hero KPI card (ventas hoy + tickets hoy) ─── */
interface HeroKpiProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  iconBg: string;
  loading?: boolean;
}

function HeroKpiCard({ icon: Icon, label, value, sub, gradient, iconBg, loading }: HeroKpiProps) {
  if (loading) return (
    <div className="rounded-2xl p-6 shadow-md border border-white/20 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <Skeleton className="w-12 h-12 rounded-2xl mb-5" />
      <Skeleton className="h-10 w-40 mb-2" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
  return (
    <div className={cn(
      'rounded-2xl p-6 shadow-md border border-white/20 relative overflow-hidden',
      'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
      gradient,
    )}>
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_80%_20%,white,transparent_60%)]" />
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-sm', iconBg)}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-4xl font-black text-white tabular-nums tracking-tight leading-none mb-2">
        {value}
      </p>
      <p className="text-sm font-bold text-white/80">{label}</p>
      {sub && <p className="text-xs text-white/60 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Secondary KPI card ─── */
interface SecKpiProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

function SecKpiCard({ icon: Icon, label, value, sub, accent, iconBg, iconColor, loading }: SecKpiProps) {
  if (loading) return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
      </div>
      <Skeleton className="h-7 w-28 mb-1.5" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
  return (
    <div className={cn(
      'bg-card rounded-2xl border border-border p-4 shadow-sm relative overflow-hidden group',
      'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
    )}>
      <div className={cn('absolute top-0 left-0 h-0.5 w-full', accent)} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shadow-sm', iconBg)}>
          <Icon size={16} className={iconColor} />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground tabular-nums tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</p>
      {sub && <p className="text-2xs text-muted-foreground mt-0.5">{sub}</p>}
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
      <div className="p-6 space-y-6 max-w-350 mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
                <Activity size={10} />
                Superadmin
              </span>
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Dashboard Global
            </h1>
            <p className="text-sm text-muted-foreground">
              Consolidado en tiempo real de todos los colmados
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={12} className={cn('text-indigo-500', refreshing && 'animate-spin')} />
            Actualizar
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">{error}</p>
          </div>
        )}

        {/* ── Hero KPIs (ventas hoy + tickets) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HeroKpiCard
            icon={DollarSign}
            label="Ventas hoy"
            value={data ? fmt(Number(data.ventas_hoy)) : '—'}
            gradient="bg-linear-to-br from-indigo-600 to-violet-700"
            iconBg="bg-white/20"
            loading={loading}
          />
          <HeroKpiCard
            icon={TrendingUp}
            label="Ventas totales"
            value={data ? fmt(Number(data.ventas_totales)) : '—'}
            sub="acumulado histórico"
            gradient="bg-linear-to-br from-emerald-500 to-teal-700"
            iconBg="bg-white/20"
            loading={loading}
          />
        </div>

        {/* ── Secondary KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SecKpiCard
            icon={ShoppingBag} label="Tickets hoy" loading={loading}
            value={data?.tickets_hoy ?? '—'}
            accent="bg-sky-500"
            iconBg="bg-sky-50 dark:bg-sky-950"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <SecKpiCard
            icon={Store} label="Colmados activos" loading={loading}
            value={data?.colmados_activos ?? '—'}
            accent="bg-violet-500"
            iconBg="bg-violet-50 dark:bg-violet-950"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <SecKpiCard
            icon={Users} label="Clientes activos" loading={loading}
            value={data?.clientes_activos ?? '—'}
            accent="bg-amber-500"
            iconBg="bg-amber-50 dark:bg-amber-950"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <SecKpiCard
            icon={Package} label="Productos" loading={loading}
            value={data?.productos_totales ?? '—'}
            accent="bg-cyan-500"
            iconBg="bg-cyan-50 dark:bg-cyan-950"
            iconColor="text-cyan-600 dark:text-cyan-400"
          />
          <SecKpiCard
            icon={AlertTriangle} label="Stock bajo" loading={loading}
            value={data?.productos_bajo_stock ?? '—'}
            accent="bg-rose-500"
            iconBg="bg-rose-50 dark:bg-rose-950"
            iconColor="text-rose-600 dark:text-rose-400"
          />
          <SecKpiCard
            icon={TrendingDown} label="Gastos hoy" loading={loading}
            value={data ? fmt(Number(data.gastos_hoy)) : '—'}
            accent="bg-orange-500"
            iconBg="bg-orange-50 dark:bg-orange-950"
            iconColor="text-orange-600 dark:text-orange-400"
          />
        </div>

        {/* ── Gráfica ventas por colmado ── */}
        {(loading || ventasColmado.length > 0) && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                  <BarChart2 size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Ventas por Colmado</p>
                  <p className="text-xs text-muted-foreground">Últimos 30 días</p>
                </div>
              </div>
              <span className="text-2xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full uppercase tracking-wide">
                30 días
              </span>
            </div>
            <div className="p-6">
              {loading ? (
                <Skeleton className="w-full h-56 rounded-xl" />
              ) : (
                <>
                  <svg width="0" height="0" style={{ position: 'absolute' }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={BAR_GRADIENT[0]} />
                        <stop offset="100%" stopColor={BAR_GRADIENT[1]} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <ResponsiveContainer width="100%" height={Math.max(200, ventasColmado.length * 56)}>
                    <BarChart
                      data={ventasColmado}
                      layout="vertical"
                      margin={{ top: 4, right: 90, left: 8, bottom: 4 }}
                      barCategoryGap="35%"
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
                      <Bar dataKey="total" radius={[0, 8, 8, 0]} name="Ventas (RD$)" label={{
                        position: 'right',
                        formatter: (v: unknown) => fmt(Number(v)),
                        fontSize: 10,
                        fill: 'hsl(var(--muted-foreground))',
                      }}>
                        {ventasColmado.map((row, i) => (
                          <Cell
                            key={i}
                            fill={Number(row.total) === 0 ? 'hsl(var(--muted))' : 'url(#barGradient)'}
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

        {/* ── Ranking + Tabla ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Ranking */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Trophy size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Ranking de ventas</p>
                <p className="text-xs text-muted-foreground">Últimos 30 días</p>
              </div>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : ventasColmado.length ? (
              <div className="divide-y divide-border">
                {ventasColmado.map((col, idx) => {
                  const medal = MEDAL_COLORS[idx] ?? MEDAL_COLORS[2];
                  return (
                    <div key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ring-1',
                          idx < 3 ? `${medal.bg} ${medal.text} ${medal.ring}` : 'bg-muted text-muted-foreground ring-border',
                        )}>
                          {idx + 1}
                        </span>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {col.colmado_nombre}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(Number(col.porcentaje), 100)}%`, background: BAR_COLORS[idx % BAR_COLORS.length] }}
                          />
                        </div>
                        <div className="text-right min-w-17.5">
                          <p className="text-sm font-black tabular-nums text-foreground">
                            {fmt(Number(col.total))}
                          </p>
                          <p className="text-2xs text-muted-foreground font-semibold flex items-center justify-end gap-0.5">
                            <ArrowUpRight size={9} />
                            {Number(col.porcentaje).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-36 text-sm text-muted-foreground font-medium">
                Sin datos de ventas
              </div>
            )}
          </div>

          {/* Stats por colmado */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-sm">
                <Store size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Stats por colmado</p>
                <p className="text-xs text-muted-foreground">Actividad de hoy</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5 space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : data?.colmados_stats.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-6 py-3 text-left text-2xs font-bold text-muted-foreground uppercase tracking-widest">Colmado</th>
                      <th className="px-4 py-3 text-right text-2xs font-bold text-muted-foreground uppercase tracking-widest">Ventas</th>
                      <th className="px-4 py-3 text-right text-2xs font-bold text-muted-foreground uppercase tracking-widest">Tickets</th>
                      <th className="px-4 py-3 text-right text-2xs font-bold text-muted-foreground uppercase tracking-widest">Usuarios</th>
                      <th className="px-4 py-3 text-right text-2xs font-bold text-muted-foreground uppercase tracking-widest">Prods</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.colmados_stats.map((col, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ background: BAR_COLORS[idx % BAR_COLORS.length] }}
                            />
                            <span className="font-semibold text-foreground truncate max-w-35">
                              {col.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-black tabular-nums text-foreground">
                          {fmt(Number(col.ventas_hoy))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold tabular-nums">{col.tickets_hoy}</td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold tabular-nums">{col.usuarios}</td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold tabular-nums">{col.productos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-36 text-sm text-muted-foreground font-medium">
                  Sin colmados registrados
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Alerta stock bajo ── */}
        {(data?.productos_bajo_stock ?? 0) > 0 && !loading && (
          <div className="flex items-start gap-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0 shadow-sm">
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
