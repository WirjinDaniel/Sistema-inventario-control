"use client";
import { useEffect, useState } from "react";
import {
  Download, TrendingUp, ShoppingBag,
  DollarSign, Users, FileText, BarChart2,
} from "lucide-react";
import api from "@/lib/api";
import type { Venta } from "@/types";

type Rango = "hoy" | "semana" | "mes";

function fmt(n: number) {
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportesPage() {
  const [rango, setRango] = useState<Rango>("hoy");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [rango]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get("/ventas/?page_size=500");
      const lista: Venta[] = data.results ?? data;
      const ahora = new Date();
      const filtradas = lista.filter((v) => {
        const f = new Date(v.fecha);
        if (rango === "hoy") return f.toDateString() === ahora.toDateString();
        if (rango === "semana") return f >= new Date(ahora.getTime() - 7 * 86400000);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      });
      setVentas(filtradas);
    } catch {}
    setLoading(false);
  }

  const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
  const anuladas = ventas.filter((v) => v.estado === "ANULADA");
  const totalVentas = completadas.reduce((a, v) => a + Number(v.total), 0);

  const porMetodo = completadas.reduce<Record<string, number>>((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + Number(v.total);
    return acc;
  }, {});

  const etiquetas: Record<string, string> = {
    EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", FIADO: "Fiado",
  };
  const colores: Record<string, string> = {
    EFECTIVO: "bg-emerald-500", TARJETA: "bg-blue-500", TRANSFERENCIA: "bg-violet-500", FIADO: "bg-amber-500",
  };
  const bgColores: Record<string, string> = {
    EFECTIVO: "bg-emerald-50 text-emerald-700", TARJETA: "bg-blue-50 text-blue-700",
    TRANSFERENCIA: "bg-violet-50 text-violet-700", FIADO: "bg-amber-50 text-amber-700",
  };

  const maximo = Math.max(...Object.values(porMetodo), 1);

  const RANGOS: { key: Rango; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Últimos 7 días" },
    { key: "mes", label: "Este mes" },
  ];

  const STATS = [
    { Icon: DollarSign, label: "Total vendido", value: fmt(totalVentas), color: "bg-indigo-50", iconColor: "text-indigo-600" },
    { Icon: ShoppingBag, label: "Transacciones", value: String(completadas.length), color: "bg-sky-50", iconColor: "text-sky-600" },
    { Icon: TrendingUp, label: "Ticket promedio", value: completadas.length ? fmt(totalVentas / completadas.length) : "RD$0", color: "bg-emerald-50", iconColor: "text-emerald-600" },
    { Icon: Users, label: "Anuladas", value: String(anuladas.length), color: "bg-red-50", iconColor: "text-red-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Reportes</h1>
          <p className="text-slate-400 text-sm mt-0.5">Resumen de ventas y movimientos</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {RANGOS.map(({ key, label }) => (
            <button key={key} onClick={() => setRango(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                rango === key
                  ? "bg-white text-indigo-600 shadow-sm font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-28 animate-pulse border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-100" />
              <div className="h-7 bg-slate-100 rounded mt-3 w-20" />
              <div className="h-3 bg-slate-100 rounded mt-2 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(({ Icon, label, value, color, iconColor }) => (
              <div key={label}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <p className="text-2xl font-black text-slate-800 tabular-nums">{value}</p>
                <p className="text-sm text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Ventas por método de pago */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <BarChart2 size={16} className="text-indigo-500" />
              </div>
              <h2 className="font-bold text-slate-700">Ventas por método de pago</h2>
            </div>
            {Object.keys(porMetodo).length === 0 ? (
              <div className="text-center py-8">
                <BarChart2 size={36} className="mx-auto mb-2 text-slate-200" />
                <p className="text-slate-300 text-sm">Sin ventas en este período</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(porMetodo).sort((a, b) => b[1] - a[1]).map(([metodo, total]) => (
                  <div key={metodo}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${bgColores[metodo] ?? "bg-slate-100 text-slate-500"}`}>
                        {etiquetas[metodo] ?? metodo}
                      </span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt(total)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${colores[metodo] ?? "bg-slate-400"}`}
                        style={{ width: `${(total / maximo) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de ventas */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                <h2 className="font-bold text-slate-700">Detalle de ventas</h2>
                <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">{ventas.length}</span>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors duration-150">
                <Download size={13} /> Exportar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Fecha / Hora</th>
                    <th className="px-4 py-3 text-left">Cajero</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Método</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-300">
                      <FileText size={36} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Sin ventas en este período</p>
                    </td></tr>
                  ) : ventas.slice(0, 50).map((v) => (
                    <tr key={v.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors duration-100">
                      <td className="px-5 py-3 text-slate-600">
                        <p className="font-medium text-slate-700">{new Date(v.fecha).toLocaleDateString("es-DO")}</p>
                        <p className="text-xs text-slate-400">{new Date(v.fecha).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{v.cajero_nombre}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{v.cliente_nombre ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bgColores[v.metodo_pago] ?? "bg-slate-100 text-slate-500"}`}>
                          {etiquetas[v.metodo_pago] ?? v.metodo_pago}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmt(Number(v.total))}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.estado === "COMPLETADA" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                        }`}>
                          {v.estado === "COMPLETADA" ? "Completada" : "Anulada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
