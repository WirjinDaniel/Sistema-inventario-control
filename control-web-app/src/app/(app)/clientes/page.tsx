"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search, Plus, Wallet, History,
  DollarSign, Users, Phone, CreditCard, TrendingDown,
  Check, Edit2, MoreHorizontal, BadgeCheck,
  UserX, RefreshCw, X, AlertTriangle, ChevronRight,
  LayoutList, LayoutGrid, ArrowUpDown, UserCheck, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Cliente, AbonoFiado } from "@/types";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface FormCliente { nombre: string; telefono: string; cedula: string; limite_credito: string; }
const FORM_EMPTY: FormCliente = { nombre: "", telefono: "", cedula: "", limite_credito: "0" };

type Filtro = "todos" | "con_deuda" | "al_dia";
type Orden = "deuda" | "nombre" | "disponible";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("deuda");
  const [vistaLista, setVistaLista] = useState(true);
  const [loading, setLoading] = useState(true);
  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<AbonoFiado[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [modal, setModal] = useState<"crear" | "editar" | "abono" | null>(null);
  const [form, setForm] = useState<FormCliente>(FORM_EMPTY);
  const [montoAbono, setMontoAbono] = useState("");
  const [notaAbono, setNotaAbono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = busqueda ? `?search=${encodeURIComponent(busqueda)}` : "";
      const { data } = await api.get(`/clientes/${params}`);
      setClientes(data.results ?? data);
    } catch {
      toast.error("Error cargando clientes");
    }
    setLoading(false);
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  async function seleccionarCliente(c: Cliente) {
    setClienteActivo(c);
    setLoadingHistorial(true);
    try {
      const { data } = await api.get(`/clientes/abonos/?cliente=${c.id}`);
      setHistorial(data.results ?? data);
    } catch {
      setHistorial([]);
    }
    setLoadingHistorial(false);
  }

  function abrirCrear() { setForm(FORM_EMPTY); setFormErrors({}); setModal("crear"); }
  function abrirEditar(c: Cliente) {
    setForm({ nombre: c.nombre, telefono: c.telefono, cedula: c.cedula, limite_credito: c.limite_credito });
    setClienteActivo(c);
    setModal("editar");
  }
  function abrirAbono(c: Cliente) {
    setClienteActivo(c);
    setMontoAbono("");
    setNotaAbono("");
    setModal("abono");
  }

  const setField = (k: keyof FormCliente) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function guardar() {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (form.telefono && !/^[\d\s()\-+]{7,15}$/.test(form.telefono)) errs.telefono = "Formato inválido (ej: 809-000-0000).";
    if (form.cedula && !/^\d{3}-\d{7}-\d$/.test(form.cedula)) errs.cedula = "Formato inválido (ej: 001-0000000-0).";
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});
    setGuardando(true);
    try {
      if (modal === "crear") {
        await api.post("/clientes/", form);
        toast.success("Cliente creado exitosamente");
      } else {
        await api.patch(`/clientes/${clienteActivo!.id}/`, form);
        toast.success("Cliente actualizado");
      }
      setModal(null);
      cargar();
    } catch {
      toast.error("Error al guardar");
    }
    setGuardando(false);
  }

  async function registrarAbono() {
    const monto = Number(montoAbono);
    if (!monto || monto <= 0) return toast.error("Ingresa un monto válido.");
    if (monto > Number(clienteActivo!.saldo_deuda)) return toast.error("El abono supera la deuda.");
    setGuardando(true);
    try {
      await api.post("/clientes/abonos/", { cliente: clienteActivo!.id, monto, nota: notaAbono });
      toast.success(`Abono de ${formatCurrency(monto)} registrado`);
      setModal(null);
      cargar();
      if (clienteActivo) {
        seleccionarCliente({ ...clienteActivo, saldo_deuda: (Number(clienteActivo.saldo_deuda) - monto).toString() } as unknown as Cliente);
      }
    } catch {
      toast.error("Error al registrar abono");
    }
    setGuardando(false);
  }

  // Stats calculados
  const totalDeudas = clientes.reduce((a, c) => a + Number(c.saldo_deuda), 0);
  const conDeuda = clientes.filter((c) => Number(c.saldo_deuda) > 0).length;
  const promedioDeuda = conDeuda > 0 ? totalDeudas / conDeuda : 0;
  const pctAlDia = clientes.length > 0 ? ((clientes.length - conDeuda) / clientes.length) * 100 : 0;

  // Filtro + orden
  const clientesFiltrados = clientes
    .filter((c) => {
      if (filtro === "con_deuda") return Number(c.saldo_deuda) > 0;
      if (filtro === "al_dia") return Number(c.saldo_deuda) === 0;
      return true;
    })
    .sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre);
      if (orden === "disponible") return Number(a.credito_disponible) - Number(b.credito_disponible);
      return Number(b.saldo_deuda) - Number(a.saldo_deuda); // mayor deuda primero
    });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0">
        <div className="max-w-full mx-auto space-y-4">

          {/* Fila 1: título + botón */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Clientes</h1>
              <p className="text-xs text-slate-400 mt-0.5">Gestiona clientes y cuentas por cobrar</p>
            </div>
            <Button onClick={abrirCrear} className="gap-2 rounded-xl shadow-sm font-semibold">
              <Plus size={15} /> Nuevo cliente
            </Button>
          </div>

          {/* Fila 2: KPI chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-xl px-4 py-2">
              <AlertTriangle size={13} className="text-rose-500" />
              <div>
                <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide leading-none">Total fiados</p>
                <p className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">{formatCurrency(totalDeudas)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2">
              <Users size={13} className="text-slate-500" />
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-none">Con deuda</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 tabular-nums">{conDeuda} / {clientes.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl px-4 py-2">
              <TrendingDown size={13} className="text-amber-500" />
              <div>
                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide leading-none">Promedio deuda</p>
                <p className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums">{formatCurrency(promedioDeuda)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl px-4 py-2">
              <Check size={13} className="text-emerald-500" />
              <div>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide leading-none">Al día</p>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{pctAlDia.toFixed(0)}%</p>
              </div>
            </div>

            <div className="flex-1" />

            {/* Búsqueda */}
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Fila 3: filtros + orden + toggle vista */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              {([
                { key: "todos", label: "Todos" },
                { key: "con_deuda", label: "Con deuda" },
                { key: "al_dia", label: "Al día" },
              ] as { key: Filtro; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                    filtro === f.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <ArrowUpDown size={12} className="text-slate-400" />
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-2 py-1 font-medium focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="deuda">Mayor deuda</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="disponible">Menor crédito disponible</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Toggle vista */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setVistaLista(true)}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center transition-all",
                  vistaLista ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutList size={14} />
              </button>
              <button
                onClick={() => setVistaLista(false)}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center transition-all",
                  !vistaLista ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Área principal ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            vistaLista ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-9 h-9 rounded-xl" />
                      <Skeleton className="h-4 w-36 flex-1" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="w-11 h-11 rounded-xl" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            )
          ) : clientesFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 dark:text-slate-700">
              <Users size={48} className="mb-3 opacity-40" />
              <p className="text-sm font-semibold text-slate-400">No hay clientes</p>
              <p className="text-xs text-slate-400 mt-1">
                {busqueda ? `Sin resultados para "${busqueda}"` : "Agrega el primer cliente"}
              </p>
            </div>
          ) : vistaLista ? (
            /* ── Vista tabla ── */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Cédula</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wide">Deuda</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Límite</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide w-28 hidden lg:table-cell">Uso</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">Estado</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {clientesFiltrados.map((c) => {
                    const deuda = Number(c.saldo_deuda);
                    const limite = Number(c.limite_credito);
                    const pct = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
                    const activo = clienteActivo?.id === c.id;
                    const tieneDeuda = deuda > 0;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => seleccionarCliente(c)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          activo
                            ? "bg-indigo-50 dark:bg-indigo-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                              tieneDeuda
                                ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                            )}>
                              {getInitials(c.nombre)}
                            </div>
                            <span className={cn(
                              "font-semibold truncate max-w-40",
                              activo ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"
                            )}>
                              {c.nombre}
                            </span>
                          </div>
                        </td>
                        {/* Teléfono */}
                        <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                          {c.telefono || <span className="italic">—</span>}
                        </td>
                        {/* Cédula */}
                        <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                          {c.cedula || <span className="italic">—</span>}
                        </td>
                        {/* Deuda */}
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "font-black tabular-nums text-sm",
                            tieneDeuda ? "text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600"
                          )}>
                            {tieneDeuda ? formatCurrency(deuda) : "—"}
                          </span>
                        </td>
                        {/* Límite */}
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs font-medium hidden md:table-cell">
                          {limite > 0 ? formatCurrency(limite) : <span className="italic text-slate-300">—</span>}
                        </td>
                        {/* Barra uso */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {limite > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-500",
                                    pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-400" : "bg-indigo-500"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 w-7 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-[10px] text-slate-300 italic">sin límite</span>}
                        </td>
                        {/* Estado */}
                        <td className="px-4 py-3 text-center">
                          {tieneDeuda ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                              Con deuda
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                              <Check size={9} /> Al día
                            </span>
                          )}
                        </td>
                        {/* Acción rápida */}
                        <td className="px-2 py-3">
                          <ChevronRight size={14} className={cn(
                            "transition-colors",
                            activo ? "text-indigo-400" : "text-slate-200 dark:text-slate-700"
                          )} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Footer de la tabla */}
              <div className="px-4 py-2.5 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
                  {filtro !== "todos" && ` · filtro: ${filtro === "con_deuda" ? "con deuda" : "al día"}`}
                </p>
                {conDeuda > 0 && (
                  <p className="text-xs text-rose-500 font-semibold">
                    Total por cobrar: {formatCurrency(totalDeudas)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ── Vista grid ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesFiltrados.map((c) => {
                const deuda = Number(c.saldo_deuda);
                const limite = Number(c.limite_credito);
                const disponible = Number(c.credito_disponible ?? Math.max(limite - deuda, 0));
                const pct = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
                const activo = clienteActivo?.id === c.id;
                const tieneDeuda = deuda > 0;

                return (
                  <button
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm text-left",
                      "hover:shadow-md transition-all duration-200 group",
                      activo
                        ? "border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-100 dark:ring-indigo-900/40"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0",
                          tieneDeuda
                            ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                            : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {getInitials(c.nombre)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.nombre}</p>
                          {c.telefono && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {c.telefono}
                            </p>
                          )}
                          {c.cedula && (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <CreditCard size={10} /> {c.cedula}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className={cn(
                        "text-slate-300 shrink-0 transition-transform group-hover:translate-x-0.5",
                        activo && "text-indigo-400"
                      )} />
                    </div>

                    {tieneDeuda ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-medium">Deuda</span>
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(deuda)}
                          </span>
                        </div>
                        {limite > 0 && (
                          <>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-500",
                                  pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-400" : "bg-indigo-500"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>{pct.toFixed(0)}% usado</span>
                              <span>Disponible: <strong className="text-slate-600 dark:text-slate-300">{formatCurrency(disponible)}</strong></span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Al día</span>
                        </div>
                        {limite > 0 && (
                          <span className="text-[10px] text-slate-400">Límite: {formatCurrency(limite)}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Panel lateral de detalle (siempre visible) ── */}
        <div className="w-88 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 overflow-y-auto flex flex-col">
          {!clienteActivo ? (
            /* Estado vacío del panel */
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <UserCheck size={28} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Selecciona un cliente</p>
              <p className="text-xs text-slate-400 mt-1 mb-6">Haz clic en cualquier fila para ver los detalles y el historial de abonos</p>
              <div className="w-full space-y-2">
                <button
                  onClick={abrirCrear}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors"
                >
                  <Plus size={13} /> Nuevo cliente
                </button>
                <button
                  onClick={() => setFiltro("con_deuda")}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl transition-colors border border-rose-100 dark:border-rose-900/50"
                >
                  <AlertTriangle size={13} /> Ver clientes con deuda
                </button>
              </div>

              {/* Mini resumen */}
              {clientes.length > 0 && !loading && (
                <div className="mt-8 w-full space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left mb-3">Resumen del portafolio</p>
                  {[
                    { label: "Total clientes", value: String(clientes.length), color: "text-slate-700 dark:text-slate-200" },
                    { label: "Con deuda", value: `${conDeuda}`, color: "text-rose-600" },
                    { label: "Al día", value: `${clientes.length - conDeuda}`, color: "text-emerald-600" },
                    { label: "Cartera total", value: formatCurrency(totalDeudas), color: "text-rose-700" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <span className="text-xs text-slate-400">{row.label}</span>
                      <span className={cn("text-xs font-black tabular-nums", row.color)}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Header del panel */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 dark:border-slate-800 shrink-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle del cliente</p>
                <button
                  onClick={() => setClienteActivo(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={13} className="text-slate-500" />
                </button>
              </div>

              <div className="p-5 space-y-5 flex-1">
                {/* Info cliente */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black",
                      Number(clienteActivo.saldo_deuda) > 0
                        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600"
                        : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                    )}>
                      {getInitials(clienteActivo.nombre)}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-800 dark:text-slate-100">{clienteActivo.nombre}</h2>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {clienteActivo.telefono && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Phone size={10} /> {clienteActivo.telefono}
                          </span>
                        )}
                        {clienteActivo.cedula && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <CreditCard size={10} /> {clienteActivo.cedula}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <MoreHorizontal size={15} className="text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => abrirEditar(clienteActivo)} className="gap-2">
                        <Edit2 size={14} /> Editar cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-muted-foreground">
                        <UserX size={14} /> Desactivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Botón abonar */}
                {Number(clienteActivo.saldo_deuda) > 0 && (
                  <button
                    onClick={() => abrirAbono(clienteActivo)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                  >
                    <Wallet size={15} /> Registrar abono
                  </button>
                )}

                {/* KPI cards */}
                <div className="space-y-3">
                  <div className={cn(
                    "rounded-xl p-4 border",
                    Number(clienteActivo.saldo_deuda) > 0
                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50"
                      : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Deuda actual</p>
                        <p className={cn("text-2xl font-black tabular-nums mt-0.5",
                          Number(clienteActivo.saldo_deuda) > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"
                        )}>
                          {formatCurrency(Number(clienteActivo.saldo_deuda))}
                        </p>
                      </div>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                        Number(clienteActivo.saldo_deuda) > 0 ? "bg-rose-100 dark:bg-rose-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
                      )}>
                        <TrendingDown size={17} className={Number(clienteActivo.saldo_deuda) > 0 ? "text-rose-600" : "text-emerald-600"} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Límite</p>
                      <p className="text-base font-black text-slate-700 dark:text-slate-200 tabular-nums mt-0.5">
                        {formatCurrency(Number(clienteActivo.limite_credito))}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Disponible</p>
                      <p className="text-base font-black text-slate-700 dark:text-slate-200 tabular-nums mt-0.5">
                        {formatCurrency(Math.max(Number(clienteActivo.limite_credito) - Number(clienteActivo.saldo_deuda), 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barra de crédito */}
                {Number(clienteActivo.limite_credito) > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>Crédito usado</span>
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        {Math.min((Number(clienteActivo.saldo_deuda) / Number(clienteActivo.limite_credito)) * 100, 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-indigo-500"
                        style={{ width: `${Math.min((Number(clienteActivo.saldo_deuda) / Number(clienteActivo.limite_credito)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>RD$0</span>
                      <span>{formatCurrency(Number(clienteActivo.limite_credito))}</span>
                    </div>
                  </div>
                )}

                {/* Historial de abonos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-slate-400" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Historial de abonos</p>
                    </div>
                    <button
                      onClick={() => seleccionarCliente(clienteActivo)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <RefreshCw size={11} /> Actualizar
                    </button>
                  </div>

                  {loadingHistorial ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : historial.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-700">
                      <History size={28} className="mb-2 opacity-40" />
                      <p className="text-xs font-medium text-slate-400">Sin abonos registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {historial.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                            <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              Abono registrado
                              {(a as { cajero_nombre?: string }).cajero_nombre && (
                                <span className="font-normal text-slate-400"> · {(a as { cajero_nombre: string }).cajero_nombre}</span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(a.fecha).toLocaleDateString("es-DO", {
                                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                            {a.nota && <p className="text-[10px] text-slate-400 italic mt-0.5">{a.nota}</p>}
                          </div>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                            +{formatCurrency(Number(a.monto))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal crear / editar ── */}
      <Dialog open={modal === "crear" || modal === "editar"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
                <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              {modal === "crear" ? "Nuevo cliente" : "Editar cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {(["nombre", "telefono", "cedula"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs font-medium capitalize">
                  {key === "nombre" ? "Nombre completo *" : key === "telefono" ? "Teléfono" : "Cédula"}
                </Label>
                <Input
                  value={form[key]}
                  onChange={(e) => { setField(key)(e); setFormErrors((p) => ({ ...p, [key]: "" })); }}
                  placeholder={key === "nombre" ? "Ej: Juan Pérez" : key === "telefono" ? "809-000-0000" : "001-0000000-0"}
                  className={formErrors[key] ? "border-red-400 focus-visible:ring-red-300" : ""}
                />
                {formErrors[key] && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{formErrors[key]}</p>}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Límite de crédito (RD$)</Label>
              <Input type="number" value={form.limite_credito} onChange={setField("limite_credito")} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando
                ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <Check size={14} />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal abono ── */}
      <Dialog open={modal === "abono"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <Wallet size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              Registrar abono
            </DialogTitle>
          </DialogHeader>
          {clienteActivo && (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{clienteActivo.nombre}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Deuda actual: <span className="font-black tabular-nums">{formatCurrency(Number(clienteActivo.saldo_deuda))}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Monto del abono (RD$)</Label>
                <Input
                  type="number"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  placeholder="0.00"
                  className="text-center text-xl font-bold h-12 tabular-nums"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[100, 200, 500, 1000, 2000, Number(clienteActivo.saldo_deuda)].slice(0, 6).map((v) => (
                  <Button
                    key={v}
                    variant={Number(montoAbono) === v ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setMontoAbono(String(v))}
                  >
                    {formatCurrency(v)}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nota (opcional)</Label>
                <Input value={notaAbono} onChange={(e) => setNotaAbono(e.target.value)} placeholder="Ej: Pago en efectivo" />
              </div>
              {Number(montoAbono) > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Nuevo saldo:</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatCurrency(Math.max(Number(clienteActivo.saldo_deuda) - Number(montoAbono), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={registrarAbono} disabled={guardando} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {guardando
                ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <Check size={14} />}
              Registrar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
