"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search, Plus, X, Check, UserCheck, Wallet,
  History, AlertCircle, DollarSign, ChevronRight, Users, BarChart2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Cliente, AbonoFiado } from "@/types";

interface AgingCliente { id: number; nombre: string; telefono: string; saldo_deuda: number; dias: number; ultima_fecha: string; }
interface AgingBucket { label: string; clientes: AgingCliente[]; total: number; }
interface AgingData { buckets: Record<string, AgingBucket>; total: number; }

interface FormCliente { nombre: string; telefono: string; cedula: string; limite_credito: string; }
const FORM_EMPTY: FormCliente = { nombre: "", telefono: "", cedula: "", limite_credito: "0" };

const inputCls = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150 bg-white w-full";

const AGING_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  '0_30':   { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' },
  '31_60':  { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-600'   },
  '61_90':  { bar: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700',   text: 'text-orange-600'  },
  '90_mas': { bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700',         text: 'text-red-600'     },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'clientes' | 'aging'>('clientes');
  const [aging, setAging] = useState<AgingData | null>(null);
  const [loadingAging, setLoadingAging] = useState(false);
  const [modal, setModal] = useState<"crear" | "editar" | "abono" | "historial" | null>(null);
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormCliente>(FORM_EMPTY);
  const [montoAbono, setMontoAbono] = useState("");
  const [notaAbono, setNotaAbono] = useState("");
  const [historial, setHistorial] = useState<AbonoFiado[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = busqueda ? `?search=${encodeURIComponent(busqueda)}` : "";
      const { data } = await api.get(`/clientes/${params}`);
      setClientes(data.results ?? data);
    } catch { toast.error("Error cargando clientes"); }
    setLoading(false);
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cargarAging() {
    if (aging) return;
    setLoadingAging(true);
    try {
      const { data } = await api.get('/clientes/aging/');
      setAging(data);
    } catch { toast.error('Error cargando reporte de antigüedad'); }
    setLoadingAging(false);
  }

  function cambiarVista(v: 'clientes' | 'aging') {
    setVista(v);
    if (v === 'aging') cargarAging();
  }

  function abrirCrear() { setForm(FORM_EMPTY); setSeleccionado(null); setModal("crear"); }
  function abrirEditar(c: Cliente) {
    setForm({ nombre: c.nombre, telefono: c.telefono, cedula: c.cedula, limite_credito: c.limite_credito });
    setSeleccionado(c); setModal("editar");
  }
  async function abrirHistorial(c: Cliente) {
    setSeleccionado(c);
    const { data } = await api.get(`/clientes/abonos/?cliente=${c.id}`);
    setHistorial(data.results ?? data);
    setModal("historial");
  }
  function abrirAbono(c: Cliente) { setSeleccionado(c); setMontoAbono(""); setNotaAbono(""); setModal("abono"); }

  const f = (k: keyof FormCliente) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function guardar() {
    if (!form.nombre) return toast.error("El nombre es requerido.");
    setGuardando(true);
    try {
      if (modal === "crear") await api.post("/clientes/", form);
      else await api.patch(`/clientes/${seleccionado!.id}/`, form);
      toast.success(modal === "crear" ? "Cliente creado" : "Cliente actualizado");
      setModal(null); cargar();
    } catch { toast.error("Error al guardar"); }
    setGuardando(false);
  }

  async function registrarAbono() {
    const monto = Number(montoAbono);
    if (!monto || monto <= 0) return toast.error("Ingresa un monto válido.");
    if (monto > Number(seleccionado!.saldo_deuda)) return toast.error("El abono supera la deuda actual.");
    setGuardando(true);
    try {
      await api.post("/clientes/abonos/", { cliente: seleccionado!.id, monto, nota: notaAbono });
      toast.success(`Abono de RD$${monto.toFixed(2)} registrado`);
      setModal(null); cargar();
    } catch { toast.error("Error al registrar abono"); }
    setGuardando(false);
  }

  const totalDeudas = clientes.reduce((a, c) => a + Number(c.saldo_deuda), 0);
  const conDeuda = clientes.filter((c) => Number(c.saldo_deuda) > 0).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Clientes / Fiado</h1>
          <p className="text-slate-400 text-sm mt-0.5">{clientes.length} clientes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Pestañas */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => cambiarVista('clientes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${vista === 'clientes' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={13} /> Clientes
            </button>
            <button
              onClick={() => cambiarVista('aging')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${vista === 'aging' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart2 size={13} /> Antigüedad CxC
            </button>
          </div>
          {vista === 'clientes' && (
            <button onClick={abrirCrear}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 active:scale-95">
              <Plus size={16} /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Resumen fiados */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 hover:shadow-md transition-shadow duration-200">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
            <DollarSign size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total en fiados</p>
            <p className="text-xl font-black text-amber-600 tabular-nums">RD${totalDeudas.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 hover:shadow-md transition-shadow duration-200">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Clientes con deuda</p>
            <p className="text-xl font-black text-red-500">{conDeuda} de {clientes.length}</p>
          </div>
        </div>
      </div>

      {/* ===== VISTA AGING ===== */}
      {vista === 'aging' && (
        <div className="space-y-4">
          {loadingAging ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)
          ) : aging ? (
            <>
              {/* Total general */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <DollarSign size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Total cuentas por cobrar</p>
                  <p className="text-2xl font-black text-indigo-600 tabular-nums">{fmt(aging.total)}</p>
                </div>
              </div>

              {/* Buckets */}
              {Object.entries(aging.buckets).map(([key, bucket]) => {
                const colors = AGING_COLORS[key];
                if (bucket.clientes.length === 0) return null;
                return (
                  <div key={key} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors.bar}`} />
                        <span className="font-bold text-slate-800 text-sm">{bucket.label}</span>
                        <span className="text-xs text-slate-400">({bucket.clientes.length} cliente{bucket.clientes.length !== 1 ? 's' : ''})</span>
                      </div>
                      <span className={`font-bold tabular-nums text-sm ${colors.text}`}>{fmt(bucket.total)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {bucket.clientes.map((c: AgingCliente) => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-slate-800">{c.nombre}</p>
                              <p className="text-xs text-slate-400">{c.telefono || 'Sin teléfono'}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${colors.badge}`}>
                                {c.dias} días
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <p className={`font-bold tabular-nums ${colors.text}`}>{fmt(c.saldo_deuda)}</p>
                              <p className="text-xs text-slate-400">Desde {new Date(c.ultima_fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}</p>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => { setSeleccionado(clientes.find(cl => cl.id === c.id) ?? null); setMontoAbono(''); setNotaAbono(''); setModal('abono'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors active:scale-95"
                              >
                                <Wallet size={12} /> Abonar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      )}

      {/* ===== VISTA CLIENTES ===== */}
      {vista === 'clientes' && <>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Buscar por nombre, teléfono, cédula..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150" />
      </div>

      {/* Lista de clientes */}
      <div className="space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse h-20" />
          ))
        ) : clientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center text-slate-300 border border-slate-100">
            <UserCheck size={44} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-slate-400">No hay clientes</p>
            <p className="text-xs mt-1">Agrega el primero con el botón de arriba</p>
          </div>
        ) : clientes.map((c) => {
          const deuda = Number(c.saldo_deuda);
          const limite = Number(c.limite_credito);
          const pct = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
          const enRojo = deuda > 0 && deuda >= limite * 0.9;
          return (
            <div key={c.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-sm ${
                  deuda > 0 ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                }`}>
                  {c.nombre[0].toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 truncate">{c.nombre}</p>
                    {enRojo && (
                      <span className="shrink-0 text-xs bg-red-50 text-red-500 border border-red-100 rounded-full px-2 py-0.5 font-medium">Límite al tope</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{c.telefono || "Sin teléfono"}{c.cedula ? ` · ${c.cedula}` : ""}</p>
                  {deuda > 0 && limite > 0 && (
                    <div className="mt-2 w-48">
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${pct > 85 ? "bg-red-400" : pct > 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{pct.toFixed(0)}% del límite usado</p>
                    </div>
                  )}
                </div>
                {/* Deuda */}
                <div className="text-right shrink-0">
                  <p className={`font-black text-lg tabular-nums ${deuda > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    RD${deuda.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">Límite: RD${limite.toFixed(2)}</p>
                </div>
                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  {deuda > 0 && (
                    <button onClick={() => abrirAbono(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors duration-150 active:scale-95">
                      <Wallet size={13} /> Abonar
                    </button>
                  )}
                  <button onClick={() => abrirHistorial(c)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150">
                    <History size={15} />
                  </button>
                  <button onClick={() => abrirEditar(c)}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors duration-150">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      </> /* fin vista clientes */}

      {/* Modal crear/editar cliente */}
      {(modal === "crear" || modal === "editar") && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-bold text-slate-800">{modal === "crear" ? "Nuevo Cliente" : "Editar Cliente"}</h2>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              {[
                { key: "nombre" as const, label: "Nombre *", placeholder: "Nombre completo", type: "text" },
                { key: "telefono" as const, label: "Teléfono", placeholder: "809-000-0000", type: "tel" },
                { key: "cedula" as const, label: "Cédula", placeholder: "000-0000000-0", type: "text" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
                  <input type={type} value={form[key]} onChange={f(key)} placeholder={placeholder} className={inputCls} />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Límite de crédito (RD$)</label>
                <input type="number" value={form.limite_credito} onChange={f("limite_credito")} placeholder="0.00" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors duration-150 active:scale-95">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {guardando ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><Check size={15} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal abono */}
      {modal === "abono" && seleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Wallet size={15} className="text-emerald-600" />
                </div>
                <h2 className="font-bold text-slate-800">Registrar Abono</h2>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="font-semibold text-amber-800 text-sm">{seleccionado.nombre}</p>
                <p className="text-amber-600 text-sm">Deuda actual: <span className="font-bold tabular-nums">RD${Number(seleccionado.saldo_deuda).toFixed(2)}</span></p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto del abono (RD$)</label>
                <input type="number" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)}
                  placeholder="0.00" step="0.01" autoFocus
                  className="border border-slate-200 rounded-xl px-3 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all duration-150 tabular-nums" />
              </div>
              {/* Botones rápidos */}
              <div className="grid grid-cols-3 gap-2">
                {[100, 200, 500, 1000, Number(seleccionado.saldo_deuda)].slice(0, 6).map((v) => (
                  <button key={v} onClick={() => setMontoAbono(String(v))}
                    className={`text-xs rounded-xl py-2.5 font-semibold transition-all duration-150 active:scale-95 ${
                      Number(montoAbono) === v
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}>
                    RD${v}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota (opcional)</label>
                <input value={notaAbono} onChange={(e) => setNotaAbono(e.target.value)} placeholder="Ej: Pago en efectivo"
                  className={inputCls} />
              </div>
              {montoAbono && Number(montoAbono) > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700 flex items-center justify-between">
                  <span>Nuevo saldo:</span>
                  <span className="font-bold tabular-nums">
                    RD${Math.max(Number(seleccionado.saldo_deuda) - Number(montoAbono), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors duration-150 active:scale-95">
                Cancelar
              </button>
              <button onClick={registrarAbono} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {guardando ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><Check size={15} /> Registrar abono</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {modal === "historial" && seleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <History size={15} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Historial de abonos</h2>
                  <p className="text-xs text-slate-400">{seleccionado.nombre}</p>
                </div>
              </div>
              <button onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 divide-y divide-slate-50">
              {historial.length === 0 ? (
                <div className="text-center text-slate-300 py-10">
                  <History size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-400">Sin abonos registrados</p>
                </div>
              ) : historial.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">RD${Number(a.monto).toFixed(2)}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.fecha).toLocaleDateString("es-DO")} · {a.cajero_nombre}
                    </p>
                    {a.nota && <p className="text-xs text-slate-400 italic mt-0.5">{a.nota}</p>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check size={14} className="text-emerald-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
