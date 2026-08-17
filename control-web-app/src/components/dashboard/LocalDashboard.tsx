"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, ShoppingBag, Users, AlertTriangle,
  TrendingUp, RefreshCw, ArrowUpRight,
  ArrowDownRight, Package, Clock, TrendingDown, BarChart2, Receipt,
  Layers, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";

interface Suscripcion {
  plan_nombre: string;
  estado: string;
  dias_restantes: number;
  fecha_vencimiento: string;
}

interface Venta { id: number; fecha: string; estado: string; total: string; cliente_nombre?: string; metodo_pago?: string; }
interface Cliente { saldo_deuda: string; }
interface Producto { nombre: string; stock_actual: number; stock_minimo: number; unidad?: string; }

interface Stats {
  ventas_hoy: number;
  total_hoy: number;
  total_ayer: number;
  clientes_con_deuda: number;
  productos_stock_bajo: number;
  ultimas_ventas: Venta[];
  ventas_por_hora: { hora: number; total: number }[];
  metodos_pago: { metodo: string; total: number; count: number }[];
  productos_bajo: Producto[];
  gastos_hoy: number;
  fiado_total: number;
  ticket_promedio: number;
}

const CHART_COLORS = {
  1: "var(--color-chart-1, #6366f1)",
  2: "var(--color-chart-2, #10b981)",
  3: "var(--color-chart-3, #f59e0b)",
  4: "var(--color-chart-4, #ef4444)",
  5: "var(--color-chart-5, #8b5cf6)",
} as const;

const METODO_COLORS: Record<string, string> = {
  EFECTIVO: CHART_COLORS[1],
  TARJETA: CHART_COLORS[2],
  TRANSFERENCIA: CHART_COLORS[3],
  FIADO: CHART_COLORS[4],
};

const PIE_COLORS = [CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[3], CHART_COLORS[4], CHART_COLORS[5]];

interface KpiConfig {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  accent: string;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, delta, accent, iconBg, iconColor, loading }: KpiConfig) {
  if (loading) return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
      <Skeleton className="w-11 h-11 rounded-xl mb-4" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
  const isPositive = delta === undefined || delta >= 0;
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl border-l-4 border-t border-r border-b p-5 shadow-sm",
      "hover:shadow-md transition-all duration-200 group cursor-default",
      "border-t-slate-100 border-r-slate-100 border-b-slate-100 dark:border-t-slate-800 dark:border-r-slate-800 dark:border-b-slate-800",
      accent
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm", iconBg)}>
          <Icon size={19} className={iconColor} />
        </div>
        {delta !== undefined && (
          <span className={cn(
            "flex items-center gap-0.5 text-xs font-bold px-2.5 py-1 rounded-full",
            isPositive
              ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400"
          )}>
            {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-slate-800 dark:text-slate-100 tabular-nums tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SecondaryKpi({ icon: Icon, label, value, iconBg, iconColor, valueColor, loading }: {
  icon: React.ElementType; label: string; value: string;
  iconBg: string; iconColor: string; valueColor?: string; loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon size={15} className={iconColor} />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      {loading
        ? <Skeleton className="h-7 w-28" />
        : <p className={cn("text-xl font-black tabular-nums tracking-tight", valueColor ?? "text-slate-800 dark:text-slate-100")}>{value}</p>
      }
    </div>
  );
}

export default function LocalDashboard() {
  const { esAdmin } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hora, setHora] = useState<Date | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);

  useEffect(() => {
    setHora(new Date());
    cargarStats();
    if (esAdmin()) cargarSuscripcion();
    const tick = setInterval(() => setHora(new Date()), 60000);
    const refresh = setInterval(cargarStats, 60000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarSuscripcion() {
    try {
      const r = await api.get("/suscripciones/mi-suscripcion/");
      setSuscripcion(r.data);
    } catch {
      // silencioso
    }
  }

  async function cargarStats(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const ayer = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      const [ventasRes, clientesRes, productosRes, gastosRes] = await Promise.all([
        api.get(`/ventas/?estado=COMPLETADA&page_size=200`),
        api.get("/clientes/"),
        api.get("/inventario/productos/?stock_bajo=true&page_size=50"),
        api.get(`/gastos/?fecha_desde=${hoy}&fecha_hasta=${hoy}&page_size=100`).catch(() => ({ data: [] })),
      ]);

      const lista: Venta[] = ventasRes.data.results ?? ventasRes.data;
      const ventasHoy = lista.filter((v) => v.fecha.startsWith(hoy));
      const ventasAyer = lista.filter((v) => v.fecha.startsWith(ayer));
      const totalHoy = ventasHoy.reduce((a, v) => a + Number(v.total), 0);
      const totalAyer = ventasAyer.reduce((a, v) => a + Number(v.total), 0);

      const listaClientes: Cliente[] = clientesRes.data.results ?? clientesRes.data;
      const conDeuda = listaClientes.filter((c) => Number(c.saldo_deuda) > 0).length;
      const fiado_total = listaClientes.reduce((a, c) => a + Number(c.saldo_deuda), 0);
      const listaGastos: { monto: string }[] = gastosRes.data.results ?? gastosRes.data ?? [];
      const gastos_hoy = listaGastos.reduce((a, g) => a + Number(g.monto), 0);
      const ticket_promedio = ventasHoy.length ? totalHoy / ventasHoy.length : 0;

      const prods: Producto[] = productosRes.data.results ?? productosRes.data;

      const porHora: Record<number, number> = {};
      ventasHoy.forEach((v) => {
        const h = new Date(v.fecha).getHours();
        porHora[h] = (porHora[h] ?? 0) + Number(v.total);
      });

      const metodos: Record<string, { total: number; count: number }> = {};
      ventasHoy.forEach((v) => {
        const m = (v as { metodo_pago?: string }).metodo_pago ?? "EFECTIVO";
        if (!metodos[m]) metodos[m] = { total: 0, count: 0 };
        metodos[m].total += Number(v.total);
        metodos[m].count += 1;
      });

      setStats({
        ventas_hoy: ventasHoy.length,
        total_hoy: totalHoy,
        total_ayer: totalAyer,
        clientes_con_deuda: conDeuda,
        productos_stock_bajo: prods.length,
        ultimas_ventas: lista.filter((v) => v.fecha.startsWith(hoy)).slice(0, 6),
        ventas_por_hora: Array.from({ length: 24 }, (_, i) => ({ hora: i, total: porHora[i] ?? 0 })),
        metodos_pago: Object.entries(metodos).map(([metodo, d]) => ({ metodo, ...d })),
        productos_bajo: prods.slice(0, 5),
        gastos_hoy,
        fiado_total,
        ticket_promedio,
      });
    } catch {
      toast.error("Error al cargar el dashboard. Intenta de nuevo.");
    }
    setLoading(false);
    if (manual) setRefreshing(false);
  }

  const trend = stats && stats.total_ayer > 0
    ? ((stats.total_hoy - stats.total_ayer) / stats.total_ayer) * 100
    : undefined;

  const totalMetodos = stats?.metodos_pago.reduce((a, m) => a + m.total, 0) ?? 0;

  const saludoHora = hora
    ? hora.getHours() < 12 ? "Buenos días" : hora.getHours() < 19 ? "Buenas tardes" : "Buenas noches"
    : "Dashboard";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {saludoHora} 👋
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
              {hora?.toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {hora && (
                <span className="ml-2 font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs">
                  {hora.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cargarStats(true)}
            disabled={refreshing}
            className="gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
          >
            <RefreshCw size={13} className={cn("text-slate-500", refreshing && "animate-spin")} />
            <span className="text-slate-600 dark:text-slate-300 font-medium text-xs">Actualizar</span>
          </Button>
        </div>

        {/* Banner suscripción */}
        {suscripcion && (() => {
          const vencida = suscripcion.estado === "VENCIDA" || suscripcion.estado === "SUSPENDIDA";
          const proxima = !vencida && suscripcion.dias_restantes <= 7;
          if (!vencida && !proxima) return null;
          return (
            <div className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              vencida
                ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50"
            )}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                vencida ? "bg-rose-100 dark:bg-rose-900/50" : "bg-amber-100 dark:bg-amber-900/50"
              )}>
                <Layers size={16} className={vencida ? "text-rose-600" : "text-amber-600"} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-bold", vencida ? "text-rose-800 dark:text-rose-300" : "text-amber-800 dark:text-amber-300")}>
                  {vencida
                    ? `Suscripción ${suscripcion.estado.toLowerCase()} — Plan ${suscripcion.plan_nombre}`
                    : `Tu suscripción vence en ${suscripcion.dias_restantes} día(s) — Plan ${suscripcion.plan_nombre}`}
                </p>
                <p className={cn("text-xs mt-0.5", vencida ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")}>
                  {vencida
                    ? "Contacta al administrador de la plataforma para renovar tu plan."
                    : `Vence el ${new Date(suscripcion.fecha_vencimiento).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })}.`}
                </p>
              </div>
            </div>
          );
        })()}

        {/* KPI Cards principales */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={DollarSign} label="Ventas del día" loading={loading}
            value={formatCurrency(stats?.total_hoy ?? 0)}
            sub={`vs ${formatCurrency(stats?.total_ayer ?? 0)} ayer`}
            delta={trend}
            accent="border-l-indigo-500"
            iconBg="bg-indigo-50 dark:bg-indigo-950"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            icon={ShoppingBag} label="Transacciones" loading={loading}
            value={String(stats?.ventas_hoy ?? 0)}
            sub="ventas completadas hoy"
            accent="border-l-sky-500"
            iconBg="bg-sky-50 dark:bg-sky-950"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <KpiCard
            icon={Users} label="Clientes con fiado" loading={loading}
            value={String(stats?.clientes_con_deuda ?? 0)}
            sub="deudas pendientes"
            accent="border-l-amber-500"
            iconBg="bg-amber-50 dark:bg-amber-950"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            icon={AlertTriangle} label="Stock bajo" loading={loading}
            value={String(stats?.productos_stock_bajo ?? 0)}
            sub="productos a reponer"
            accent="border-l-rose-500"
            iconBg="bg-rose-50 dark:bg-rose-950"
            iconColor="text-rose-600 dark:text-rose-400"
          />
        </div>

        {/* KPIs secundarios */}
        <div className="grid grid-cols-3 gap-4">
          <SecondaryKpi
            icon={BarChart2} label="Ticket promedio hoy"
            value={formatCurrency(stats?.ticket_promedio ?? 0)}
            iconBg="bg-purple-50 dark:bg-purple-950"
            iconColor="text-purple-600 dark:text-purple-400"
            loading={loading}
          />
          <SecondaryKpi
            icon={TrendingDown} label="Gastos del día"
            value={formatCurrency(stats?.gastos_hoy ?? 0)}
            iconBg="bg-rose-50 dark:bg-rose-950"
            iconColor="text-rose-600 dark:text-rose-400"
            valueColor="text-rose-600 dark:text-rose-400"
            loading={loading}
          />
          <SecondaryKpi
            icon={Receipt} label="Total fiado pendiente"
            value={formatCurrency(stats?.fiado_total ?? 0)}
            iconBg="bg-amber-50 dark:bg-amber-950"
            iconColor="text-amber-600 dark:text-amber-400"
            valueColor="text-amber-600 dark:text-amber-400"
            loading={loading}
          />
        </div>

        {/* Gráfica ventas por hora + Métodos de pago */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                  <TrendingUp size={15} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Ventas por hora</p>
                  <p className="text-xs text-slate-400">Actividad de hoy</p>
                </div>
              </div>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold px-3 py-1 rounded-full">
                Hoy
              </span>
            </div>
            <div className="px-5 pb-5">
              {loading ? (
                <Skeleton className="w-full h-44" />
              ) : stats && stats.ventas_por_hora.some((v) => v.total > 0) ? (
                <ResponsiveContainer width="100%" height={176}>
                  <AreaChart data={stats.ventas_por_hora} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVentasNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(h) => `${h}h`} interval={3} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      formatter={(v) => [formatCurrency(Number(v)), "Ventas"]}
                      labelFormatter={(h) => `${h}:00 hrs`}
                    />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5}
                      fill="url(#colorVentasNew)" dot={false} activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                  <TrendingUp size={40} className="mb-2 opacity-40" />
                  <p className="text-sm font-medium">Sin ventas registradas hoy</p>
                </div>
              )}
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 p-5 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <DollarSign size={15} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Métodos de pago</p>
                <p className="text-xs text-slate-400">Distribución de hoy</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : stats?.metodos_pago.length ? (
                <>
                  <div className="flex justify-center my-2">
                    <PieChart width={110} height={110}>
                      <Pie data={stats.metodos_pago} dataKey="total" cx={55} cy={55}
                        outerRadius={50} innerRadius={30} strokeWidth={2} stroke="#fff">
                        {stats.metodos_pago.map((m, i) => (
                          <Cell key={m.metodo} fill={METODO_COLORS[m.metodo] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="space-y-3">
                    {stats.metodos_pago.map((m) => (
                      <div key={m.metodo} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: METODO_COLORS[m.metodo] ?? "#94a3b8" }} />
                            {m.metodo}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {totalMetodos > 0 ? ((m.total / totalMetodos) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${totalMetodos > 0 ? (m.total / totalMetodos) * 100 : 0}%`,
                              background: METODO_COLORS[m.metodo] ?? "#94a3b8"
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-36 flex items-center justify-center text-sm text-slate-400 font-medium">
                  Sin ventas hoy
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Últimas ventas + Stock bajo */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Últimas ventas */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-5 pb-4 border-b border-slate-50 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950 flex items-center justify-center">
                <ShoppingBag size={15} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Últimas ventas</p>
                <p className="text-xs text-slate-400">Transacciones de hoy</p>
              </div>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : stats?.ultimas_ventas.length ? (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {stats.ultimas_ventas.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                        <ShoppingBag size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {v.cliente_nombre ?? "Cliente General"}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {formatDateTime(v.fecha)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                        {formatCurrency(v.total)}
                      </p>
                      <div className="mt-0.5 flex justify-end">
                        <StatusBadge status={v.estado} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-36 text-slate-300 dark:text-slate-700">
                <ShoppingBag size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">Sin ventas hoy</p>
              </div>
            )}
          </div>

          {/* Productos stock bajo */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                  <Package size={15} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Productos con stock bajo</p>
                  <p className="text-xs text-slate-400">Requieren atención</p>
                </div>
              </div>
              {(stats?.productos_stock_bajo ?? 0) > 5 && (
                <Badge variant="danger" className="text-xs font-bold">{stats?.productos_stock_bajo} total</Badge>
              )}
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : stats?.productos_bajo.length ? (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {stats.productos_bajo.map((p, i) => {
                  const pct = p.stock_minimo > 0 ? Math.min((p.stock_actual / p.stock_minimo) * 100, 100) : 0;
                  const isCritical = p.stock_actual === 0 || p.stock_actual < p.stock_minimo / 2;
                  return (
                    <div key={i} className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate flex-1 mr-3">{p.nombre}</p>
                        <span className={cn(
                          "text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0",
                          isCritical
                            ? "bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400"
                            : "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                        )}>
                          {p.stock_actual} {p.unidad ?? "uds"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: isCritical ? "#ef4444" : "#f59e0b"
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">mín: {p.stock_minimo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-36 text-slate-300 dark:text-slate-700">
                <Zap size={32} className="mb-2 opacity-40 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-500">Todos los productos con buen stock</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerta crítica */}
        {(stats?.productos_stock_bajo ?? 0) > 0 && !loading && (
          <div className="flex items-start gap-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                {stats?.productos_stock_bajo} producto(s) requieren reposición
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                Ve a Inventario → Movimientos y filtra por stock bajo para crear órdenes de compra.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
