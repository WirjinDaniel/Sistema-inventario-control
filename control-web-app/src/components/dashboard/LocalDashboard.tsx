"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, ShoppingBag, Users, AlertTriangle,
  TrendingUp, RefreshCw, ArrowUpRight,
  ArrowDownRight, Package, Clock, TrendingDown, BarChart2, Receipt,
  Layers,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie,
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

const METODO_COLORS: Record<string, string> = {
  EFECTIVO: "#6366f1",
  TARJETA: "#10b981",
  TRANSFERENCIA: "#f59e0b",
  FIADO: "#ef4444",
};

function KpiCard({ icon: Icon, label, value, sub, delta, color, loading }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  delta?: number; color: string; loading?: boolean;
}) {
  if (loading) return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="w-10 h-10 rounded-xl mb-3" />
        <Skeleton className="h-7 w-28 mb-1" />
        <Skeleton className="h-4 w-36" />
      </CardContent>
    </Card>
  );
  const isPositive = delta === undefined || delta >= 0;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon size={18} />
          </div>
          {delta !== undefined && (
            <span className={cn("flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full",
              isPositive ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400"
            )}>
              {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-black text-foreground tabular-nums tracking-tight">{value}</p>
        <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </CardContent>
    </Card>
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
      // No suscripción activa o endpoint no disponible — silencioso
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

      // Ventas por hora
      const porHora: Record<number, number> = {};
      ventasHoy.forEach((v) => {
        const h = new Date(v.fecha).getHours();
        porHora[h] = (porHora[h] ?? 0) + Number(v.total);
      });

      // Métodos de pago
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

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {hora ? `Buenos ${hora.getHours() < 12 ? "días" : hora.getHours() < 19 ? "tardes" : "noches"}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hora?.toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {hora && ` · ${hora.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => cargarStats(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Actualizar
        </Button>
      </div>

      {/* Banner de suscripción */}
      {suscripcion && (() => {
        const vencida = suscripcion.estado === "VENCIDA" || suscripcion.estado === "SUSPENDIDA";
        const proxima = !vencida && suscripcion.dias_restantes <= 7;
        if (!vencida && !proxima) return null;
        return (
          <div className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            vencida
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50"
          )}>
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              vencida ? "bg-rose-100 dark:bg-rose-900/50" : "bg-amber-100 dark:bg-amber-900/50"
            )}>
              <Layers size={16} className={vencida ? "text-rose-600" : "text-amber-600"} />
            </div>
            <div className="flex-1">
              <p className={cn(
                "text-sm font-semibold",
                vencida ? "text-rose-800 dark:text-rose-300" : "text-amber-800 dark:text-amber-300"
              )}>
                {vencida
                  ? `Suscripción ${suscripcion.estado.toLowerCase()} — Plan ${suscripcion.plan_nombre}`
                  : `Tu suscripción vence en ${suscripcion.dias_restantes} día(s) — Plan ${suscripcion.plan_nombre}`}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                vencida ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
              )}>
                {vencida
                  ? "Contacta al administrador de la plataforma para renovar tu plan."
                  : `Vence el ${new Date(suscripcion.fecha_vencimiento).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })}.`}
              </p>
            </div>
          </div>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign} label="Ventas del día" loading={loading}
          value={formatCurrency(stats?.total_hoy ?? 0)}
          sub={`vs ${formatCurrency(stats?.total_ayer ?? 0)} ayer`}
          delta={trend} color="bg-brand-50 dark:bg-brand-950 text-brand-600"
        />
        <KpiCard
          icon={ShoppingBag} label="Transacciones" loading={loading}
          value={String(stats?.ventas_hoy ?? 0)}
          sub="ventas completadas hoy"
          color="bg-sky-50 dark:bg-sky-950 text-sky-600"
        />
        <KpiCard
          icon={Users} label="Clientes con fiado" loading={loading}
          value={String(stats?.clientes_con_deuda ?? 0)}
          sub="deudas pendientes"
          color="bg-amber-50 dark:bg-amber-950 text-amber-600"
        />
        <KpiCard
          icon={AlertTriangle} label="Stock bajo" loading={loading}
          value={String(stats?.productos_stock_bajo ?? 0)}
          sub="productos a reponer"
          color="bg-rose-50 dark:bg-rose-950 text-rose-600"
        />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
              <BarChart2 size={14} className="text-purple-600" />
            </div>
            <span className="text-xs text-muted-foreground">Ticket promedio hoy</span>
          </div>
          {loading ? <Skeleton className="h-6 w-24" /> : (
            <p className="text-lg font-bold tabular-nums">{formatCurrency(stats?.ticket_promedio ?? 0)}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
              <TrendingDown size={14} className="text-rose-600" />
            </div>
            <span className="text-xs text-muted-foreground">Gastos del día</span>
          </div>
          {loading ? <Skeleton className="h-6 w-24" /> : (
            <p className="text-lg font-bold tabular-nums text-rose-600">{formatCurrency(stats?.gastos_hoy ?? 0)}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <Receipt size={14} className="text-amber-600" />
            </div>
            <span className="text-xs text-muted-foreground">Total fiado pendiente</span>
          </div>
          {loading ? <Skeleton className="h-6 w-24" /> : (
            <p className="text-lg font-bold tabular-nums text-amber-600">{formatCurrency(stats?.fiado_total ?? 0)}</p>
          )}
        </div>
      </div>

      {/* Gráfica + Métodos de pago */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfica de ventas por hora */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center">
                <TrendingUp size={15} className="text-brand-600" />
              </div>
              <CardTitle className="text-sm">Ventas por hora — hoy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-40" />
            ) : stats && stats.ventas_por_hora.some((v) => v.total > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={stats.ventas_por_hora} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(h) => `${h}h`} interval={3} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }}
                    formatter={(v) => [formatCurrency(Number(v)), "Ventas"]}
                    labelFormatter={(h) => `${h}:00 hrs`}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2}
                    fill="url(#colorVentas)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground/50">
                <TrendingUp size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Sin ventas registradas hoy</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Métodos de pago */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              <CardTitle className="text-sm">Métodos de pago</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : stats?.metodos_pago.length ? (
              <>
                <div className="flex justify-center mb-2">
                  <PieChart width={100} height={100}>
                    <Pie
                      data={stats.metodos_pago}
                      dataKey="total"
                      cx={50} cy={50}
                      outerRadius={45} innerRadius={28}
                      strokeWidth={0}
                      fill="#6366f1"
                    />
                  </PieChart>
                </div>
                {stats.metodos_pago.map((m) => (
                  <div key={m.metodo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: METODO_COLORS[m.metodo] ?? "#94a3b8" }} />
                        {m.metodo}
                      </span>
                      <span className="font-semibold">{totalMetodos > 0 ? ((m.total / totalMetodos) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <Progress
                      value={totalMetodos > 0 ? (m.total / totalMetodos) * 100 : 0}
                      className="h-1.5"
                    />
                  </div>
                ))}
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Sin ventas hoy
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas ventas + Stock bajo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Últimas ventas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950 flex items-center justify-center">
                <ShoppingBag size={15} className="text-sky-600" />
              </div>
              <CardTitle className="text-sm">Últimas ventas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 pb-5 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : stats?.ultimas_ventas.length ? (
              <div className="divide-y divide-border">
                {stats.ultimas_ventas.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
                        <ShoppingBag size={13} className="text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.cliente_nombre ?? "Cliente General"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={10} />
                          {formatDateTime(v.fecha)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(v.total)}</p>
                      <StatusBadge status={v.estado} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 pb-5 flex items-center justify-center h-32 text-sm text-muted-foreground">
                Sin ventas hoy
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productos stock bajo */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                  <Package size={15} className="text-rose-600" />
                </div>
                <CardTitle className="text-sm">Productos con stock bajo</CardTitle>
              </div>
              {(stats?.productos_stock_bajo ?? 0) > 5 && (
                <Badge variant="danger" className="text-xs">{stats?.productos_stock_bajo} total</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 pb-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : stats?.productos_bajo.length ? (
              <div className="divide-y divide-border">
                {stats.productos_bajo.map((p, i) => {
                  const pct = p.stock_minimo > 0 ? Math.min((p.stock_actual / p.stock_minimo) * 100, 100) : 0;
                  const isCritical = p.stock_actual === 0 || p.stock_actual < p.stock_minimo / 2;
                  return (
                    <div key={i} className="px-5 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium truncate flex-1 mr-2">{p.nombre}</p>
                        <Badge variant={isCritical ? "danger" : "warning"} className="text-[10px] shrink-0">
                          {p.stock_actual} {p.unidad ?? "uds"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={pct}
                          className={cn("h-1.5 flex-1", isCritical ? "[&>div]:bg-rose-500" : "[&>div]:bg-amber-500")}
                        />
                        <span className="text-[10px] text-muted-foreground">mín: {p.stock_minimo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 pb-5 flex flex-col items-center justify-center h-32 text-sm text-muted-foreground">
                <TrendingUp size={24} className="mb-2 text-emerald-500" />
                Todos los productos con buen stock
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerta crítica */}
      {(stats?.productos_stock_bajo ?? 0) > 0 && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              {stats?.productos_stock_bajo} producto(s) requieren reposición
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
              Ve a Inventario → Movimientos y filtra por stock bajo para crear órdenes de compra.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
