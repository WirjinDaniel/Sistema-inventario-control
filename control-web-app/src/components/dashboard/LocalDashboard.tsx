"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp, ShoppingBag, Users, AlertTriangle,
  DollarSign, ArrowUpRight, Clock,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Stats {
  ventas_hoy: number;
  total_hoy: number;
  total_ayer: number;
  clientes_con_deuda: number;
  productos_stock_bajo: number;
  top_productos: { nombre: string; cantidad: number }[];
  ventas_por_hora: { hora: number; total: number }[];
}

function StatCard({ icon: Icon, label, value, sub, color, iconColor, trend }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: string; iconColor: string; trend?: number;
}) {
  return (
    <div className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
            trend >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"
          }`}>
            <ArrowUpRight size={12} className={trend < 0 ? "rotate-180" : ""} />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-800 mt-3 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function LocalDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hora, setHora] = useState<Date | null>(null);

  useEffect(() => {
    setHora(new Date());
    cargarStats();
    const tick = setInterval(() => setHora(new Date()), 60000);
    const refresh = setInterval(cargarStats, 30000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarStats() {
    try {
      const { data: ventas } = await api.get("/ventas/?page_size=1000");
      const hoy = new Date().toISOString().split("T")[0];
      const ayer = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const lista: Venta[] = ventas.results ?? ventas;
      const ventasHoy = lista.filter((v: Venta) => v.fecha.startsWith(hoy) && v.estado === "COMPLETADA");
      const ventasAyer = lista.filter((v: Venta) => v.fecha.startsWith(ayer) && v.estado === "COMPLETADA");
      const totalHoy = ventasHoy.reduce((a: number, v: Venta) => a + Number(v.total), 0);
      const totalAyer = ventasAyer.reduce((a: number, v: Venta) => a + Number(v.total), 0);

      const { data: clientes } = await api.get("/clientes/");
      const listaClientes: Cliente[] = clientes.results ?? clientes;
      const conDeuda = listaClientes.filter((c: Cliente) => Number(c.saldo_deuda) > 0).length;

      const { data: productos } = await api.get("/inventario/productos/?stock_bajo=true&page_size=100");
      const stockBajo = (productos.results ?? productos).length;

      const porHora: Record<number, number> = {};
      ventasHoy.forEach((v: Venta) => {
        const h = new Date(v.fecha).getHours();
        porHora[h] = (porHora[h] ?? 0) + Number(v.total);
      });

      setStats({
        ventas_hoy: ventasHoy.length,
        total_hoy: totalHoy,
        total_ayer: totalAyer,
        clientes_con_deuda: conDeuda,
        productos_stock_bajo: stockBajo,
        top_productos: [],
        ventas_por_hora: Object.entries(porHora).map(([h, t]) => ({ hora: Number(h), total: t })),
      });
    } catch {
      toast.error("Error al cargar el dashboard. Intenta de nuevo.");
    }
    setLoading(false);
  }

  interface Venta { fecha: string; estado: string; total: string; }
  interface Cliente { saldo_deuda: string; }

  const trend = stats && stats.total_ayer > 0
    ? ((stats.total_hoy - stats.total_ayer) / stats.total_ayer) * 100
    : undefined;

  const maxHora = stats ? Math.max(...stats.ventas_por_hora.map((v) => v.total), 1) : 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {hora ? hora.toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
            {hora ? ` · ${hora.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
        <button onClick={cargarStats}
          className="flex items-center gap-2 text-sm text-indigo-600 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors duration-150">
          <Clock size={14} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-32 animate-pulse border border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-slate-100" />
              <div className="h-7 bg-slate-100 rounded mt-3 w-24" />
              <div className="h-4 bg-slate-100 rounded mt-2 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Ventas del día" color="bg-indigo-50" iconColor="text-indigo-600"
              value={`RD$${(stats?.total_hoy ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
              sub={`vs RD$${(stats?.total_ayer ?? 0).toFixed(2)} ayer`} trend={trend} />
            <StatCard icon={ShoppingBag} label="Transacciones" color="bg-sky-50" iconColor="text-sky-600"
              value={String(stats?.ventas_hoy ?? 0)} sub="ventas completadas hoy" />
            <StatCard icon={Users} label="Clientes con fiado" color="bg-amber-50" iconColor="text-amber-600"
              value={String(stats?.clientes_con_deuda ?? 0)} sub="deudas pendientes" />
            <StatCard icon={AlertTriangle} label="Stock bajo" color="bg-red-50" iconColor="text-red-500"
              value={String(stats?.productos_stock_bajo ?? 0)} sub="productos a reponer" />
          </div>

          {/* Gráfico de barras por hora */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <TrendingUp size={16} className="text-indigo-500" />
              </div>
              <h2 className="font-bold text-slate-700">Ventas por hora — hoy</h2>
            </div>
            {stats && stats.ventas_por_hora.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                  const item = stats.ventas_por_hora.find((v) => v.hora === h);
                  const pct = item ? (item.total / maxHora) * 100 : 0;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className={`w-full rounded-t-sm transition-all duration-500 ${pct > 0 ? "bg-indigo-200 group-hover:bg-indigo-400" : "bg-slate-100"}`}
                        style={{ height: `${Math.max(pct, 2)}%` }}>
                        {pct > 0 && (
                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                            RD${item?.total.toFixed(0) ?? 0}
                          </div>
                        )}
                      </div>
                      {h % 4 === 0 && (
                        <span className="text-xs text-slate-300">{h}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-300">
                <div className="text-center">
                  <TrendingUp size={36} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sin ventas registradas hoy</p>
                </div>
              </div>
            )}
          </div>

          {/* Alertas */}
          {(stats?.productos_stock_bajo ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-red-700 text-sm">
                  {stats?.productos_stock_bajo} producto(s) con stock bajo
                </p>
                <p className="text-red-500 text-xs mt-0.5">
                  Ve a Inventario y filtra por &ldquo;Stock bajo&rdquo; para ver cuáles necesitan reposición.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
