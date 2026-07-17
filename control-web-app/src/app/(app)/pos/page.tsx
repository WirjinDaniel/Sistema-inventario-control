"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, ShoppingCart, Trash2, CreditCard, Banknote,
  Smartphone, UserCheck, X, Plus, Minus, Tag,
  AlertCircle, Wifi, WifiOff, Package, Building2,
  DollarSign, Lock, ChevronRight, LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import CustomSelect from "@/components/CustomSelect";
import TicketPrint from "@/components/TicketPrint";

interface ReglaDesc {
  id: number;
  cantidad_minima: string;
  tipo: 'PORCENTAJE' | 'MONTO_FIJO';
  valor: string;
  nombre: string;
}

interface Producto {
  id: number;
  nombre: string;
  codigo_barras: string;
  precio_venta: string;
  precio_vigente: string;
  precio_oferta: string | null;
  en_oferta: boolean;
  tipo: "UNIDAD" | "GRANEL";
  unidad_medida: string;
  stock_actual: string;
  categoria_nombre?: string;
  reglas_descuento?: ReglaDesc[];
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
}

interface Cliente {
  id: number;
  nombre: string;
  credito_disponible: string;
  saldo_deuda: string;
}

interface BancoCuenta {
  id: number;
  banco: string;
  numero_cuenta: string;
  titular: string;
}

interface VentaResponse {
  id: number;
  fecha: string;
  cajero_nombre: string;
  cliente_nombre?: string | null;
  metodo_pago: string;
  banco_nombre?: string | null;
  subtotal: string;
  descuento: string;
  total: string;
  monto_pagado: string;
  cambio: string;
  detalles: {
    producto_nombre: string;
    cantidad: string;
    precio_unitario: string;
    descuento: string;
    subtotal: string;
  }[];
}

const METODOS_PAGO = [
  { key: "EFECTIVO", label: "Efectivo", Icon: Banknote, color: "emerald" },
  { key: "TARJETA", label: "Tarjeta", Icon: CreditCard, color: "blue" },
  { key: "TRANSFERENCIA", label: "Transfer.", Icon: Smartphone, color: "violet" },
  { key: "FIADO", label: "Fiado", Icon: UserCheck, color: "amber" },
] as const;

const COLOR_MAP: Record<string, string> = {
  emerald: "border-emerald-500 bg-emerald-50 text-emerald-700",
  blue: "border-blue-500 bg-blue-50 text-blue-700",
  violet: "border-violet-500 bg-violet-50 text-violet-700",
  amber: "border-amber-500 bg-amber-50 text-amber-700",
};

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition";

export default function POSPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [montoPagado, setMontoPagado] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [bancos, setBancos] = useState<BancoCuenta[]>([]);
  const [bancoId, setBancoId] = useState<string>("");
  const [procesando, setProcesando] = useState(false);
  const [sesionId, setSesionId] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [colmadoNombre, setColmadoNombre] = useState("Colmado POS");

  // Apertura de caja
  const [sinSesion, setSinSesion] = useState(false);
  const [showApertura, setShowApertura] = useState(false);
  const [efectivoInicial, setEfectivoInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  // Cierre de caja
  const [showCierre, setShowCierre] = useState(false);
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
  const [notaCierre, setNotaCierre] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<null | {
    efectivo_calculado: string; efectivo_final_declarado: string; diferencia_caja: string | null; apertura: string;
  }>(null);

  // Ticket
  const [ultimaVenta, setUltimaVenta] = useState<VentaResponse | null>(null);

  const barrasRef = useRef<HTMLInputElement>(null);

  const subtotal = carrito.reduce((a, i) => a + i.precio_unitario * i.cantidad, 0);
  const descuentoTotal = carrito.reduce((a, i) => a + i.descuento, 0);
  const total = subtotal - descuentoTotal;
  const cambio = Math.max(Number(montoPagado) - total, 0);
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null;

  useEffect(() => {
    cargarSesionActiva();
    cargarClientes();
    cargarBancos();
    cargarColmado();
    barrasRef.current?.focus();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  async function cargarColmado() {
    try {
      const { data } = await api.get("/usuarios/colmado/");
      if (data.nombre) setColmadoNombre(data.nombre);
    } catch {}
  }

  async function cargarSesionActiva() {
    try {
      const { data } = await api.get("/ventas/sesiones/activa/");
      setSesionId(data.id);
      setSinSesion(false);
    } catch {
      setSesionId(null);
      setSinSesion(true);
      setShowApertura(true);
    }
  }

  async function cargarClientes() {
    try {
      const { data } = await api.get("/clientes/");
      setClientes(data.results ?? data);
    } catch {}
  }

  async function cargarBancos() {
    try {
      const { data } = await api.get("/ventas/bancos/");
      setBancos(data.results ?? data);
    } catch {}
  }

  async function abrirCaja() {
    setAbriendo(true);
    try {
      const { data } = await api.post("/ventas/sesiones/", {
        efectivo_inicial: Number(efectivoInicial) || 0,
      });
      setSesionId(data.id);
      setSinSesion(false);
      setShowApertura(false);
      setEfectivoInicial("");
      toast.success("Caja abierta correctamente");
      barrasRef.current?.focus();
    } catch {
      toast.error("Error al abrir la caja");
    } finally {
      setAbriendo(false);
    }
  }

  async function cerrarCaja() {
    if (!sesionId) return;
    setCerrando(true);
    try {
      const { data } = await api.post(`/ventas/sesiones/${sesionId}/cerrar/`, {
        efectivo_final_declarado: Number(efectivoDeclarado) || 0,
        nota_cierre: notaCierre,
      });
      setResumenCierre(data);
      setSesionId(null);
      setSinSesion(true);
    } catch {
      toast.error("Error al cerrar la caja");
    } finally {
      setCerrando(false);
    }
  }

  const buscarProducto = useCallback(async (q: string) => {
    if (!q.trim()) return setResultados([]);
    try {
      const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`);
      setResultados(data.results ?? data);
    } catch {}
  }, []);

  async function escanearBarras(codigo: string) {
    try {
      const { data } = await api.get(`/inventario/productos/buscar-barras/?codigo=${codigo}`);
      agregarAlCarrito(data);
      setBusqueda("");
      setResultados([]);
    } catch {
      toast.error(`Código no encontrado: ${codigo}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && busqueda.trim()) escanearBarras(busqueda.trim());
  }

  function calcularDescuentoVolumen(p: Producto, cantidad: number): number {
    const reglas = (p.reglas_descuento ?? [])
      .filter(r => Number(r.cantidad_minima) <= cantidad)
      .sort((a, b) => Number(b.cantidad_minima) - Number(a.cantidad_minima));
    if (!reglas.length) return 0;
    const regla = reglas[0];
    const precioUnit = Number(p.precio_vigente ?? p.precio_venta);
    if (regla.tipo === 'PORCENTAJE') return (precioUnit * cantidad * Number(regla.valor)) / 100;
    return Number(regla.valor) * cantidad;
  }

  function agregarAlCarrito(p: Producto, qty = 1) {
    if (Number(p.stock_actual) < qty) {
      toast.error(`Stock insuficiente. Disponible: ${p.stock_actual} ${p.unidad_medida}`);
      return;
    }
    const precioUnit = Number(p.precio_vigente ?? p.precio_venta);
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        const nuevaCantidad = next[idx].cantidad + qty;
        next[idx] = {
          ...next[idx],
          cantidad: nuevaCantidad,
          descuento: calcularDescuentoVolumen(p, nuevaCantidad),
        };
        return next;
      }
      return [...prev, { producto: p, cantidad: qty, precio_unitario: precioUnit, descuento: calcularDescuentoVolumen(p, qty) }];
    });
    setBusqueda(""); setResultados([]); barrasRef.current?.focus();
  }

  function ajustarCantidad(idx: number, delta: number) {
    setCarrito((prev) => {
      const next = [...prev];
      const nueva = Math.round((next[idx].cantidad + delta) * 1000) / 1000;
      if (nueva <= 0) return prev.filter((_, i) => i !== idx);
      next[idx] = {
        ...next[idx],
        cantidad: nueva,
        descuento: calcularDescuentoVolumen(next[idx].producto, nueva),
      };
      return next;
    });
  }

  function setCantidad(idx: number, val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return;
    setCarrito((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], cantidad: n, descuento: calcularDescuentoVolumen(next[idx].producto, n) };
      return next;
    });
  }

  function limpiarCarrito() {
    setCarrito([]); setMontoPagado(""); setClienteId(null);
    setMetodoPago("EFECTIVO"); setBancoId("");
    barrasRef.current?.focus();
  }

  async function procesarVenta() {
    if (!sesionId) return toast.error("Abre una sesión de caja primero.");
    if (!carrito.length) return toast.error("El carrito está vacío.");
    if (metodoPago === "FIADO" && !clienteId) return toast.error("Selecciona un cliente para fiado.");
    if (metodoPago === "FIADO" && clienteSeleccionado && Number(clienteSeleccionado.credito_disponible) < total) {
      return toast.error(`Crédito insuficiente. Disponible: RD$${Number(clienteSeleccionado.credito_disponible).toFixed(2)}`);
    }
    setProcesando(true);
    try {
      const { data } = await api.post("/ventas/", {
        sesion_caja: sesionId, cliente: clienteId, metodo_pago: metodoPago,
        banco_cuenta: metodoPago === "TRANSFERENCIA" && bancoId ? Number(bancoId) : null,
        monto_pagado: metodoPago === "EFECTIVO" ? Number(montoPagado) : total,
        descuento: descuentoTotal,
        detalles: carrito.map((i) => ({
          producto: i.producto.id, cantidad: i.cantidad,
          precio_unitario: i.precio_unitario, descuento: i.descuento,
          subtotal: i.precio_unitario * i.cantidad - i.descuento,
        })),
      });
      setUltimaVenta(data);
      limpiarCarrito();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; non_field_errors?: string[] } } };
      toast.error(e.response?.data?.detail ?? e.response?.data?.non_field_errors?.[0] ?? "Error al procesar la venta");
    } finally { setProcesando(false); }
  }

  // ── MODAL Apertura de Caja ──────────────────────────────────────────────
  if (showApertura && !sesionId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
          {/* Header con botón cerrar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Lock size={18} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 leading-tight">Abrir Caja</h2>
                <p className="text-xs text-slate-400">Ingresa el efectivo inicial del turno</p>
              </div>
            </div>
            {!sinSesion && (
              <button
                onClick={() => { setShowApertura(false); setEfectivoInicial(""); }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Cerrar sin abrir caja"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Efectivo inicial (RD$)
              </label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={efectivoInicial}
                onChange={(e) => setEfectivoInicial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && abrirCaja()}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-3xl font-bold text-gray-800 text-center placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            {/* Atajos de monto */}
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000, 3000, 5000, 10000].map((v) => (
                <button key={v} onClick={() => setEfectivoInicial(String(v))}
                  className={`text-xs rounded-xl py-2 font-semibold transition-all ${
                    Number(efectivoInicial) === v
                      ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}>
                  RD${v.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              {!sinSesion && (
                <button
                  onClick={() => { setShowApertura(false); setEfectivoInicial(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                >
                  <X size={14} /> Cancelar
                </button>
              )}
              <button
                onClick={abrirCaja}
                disabled={abriendo}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm hover:shadow-md transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {abriendo ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <DollarSign size={16} />}
                Abrir caja
              </button>
            </div>

            {sinSesion && (
              <p className="text-center text-xs text-slate-400">
                No hay sesión activa. Abre caja para comenzar a vender.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MODAL Cierre de Caja ────────────────────────────────────────────────
  if (showCierre) {
    // Mostrar resumen tras cerrar
    if (resumenCierre) {
      const dif = resumenCierre.diferencia_caja != null ? Number(resumenCierre.diferencia_caja) : null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 text-center">Corte Z — Caja Cerrada</h2>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Apertura</span>
                  <span className="font-medium text-slate-700">
                    {new Date(resumenCierre.apertura).toLocaleString("es-DO")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo calculado</span>
                  <span className="font-bold text-slate-800">RD${Number(resumenCierre.efectivo_calculado).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo declarado</span>
                  <span className="font-bold text-slate-800">RD${Number(resumenCierre.efectivo_final_declarado).toFixed(2)}</span>
                </div>
                {dif !== null && (
                  <div className={`flex justify-between font-bold rounded-lg p-2 ${
                    dif === 0 ? "bg-emerald-50 text-emerald-700" :
                    dif > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                  }`}>
                    <span>Diferencia</span>
                    <span>{dif >= 0 ? "+" : ""}RD${dif.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setShowCierre(false); setResumenCierre(null); setShowApertura(true); }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:shadow-md transition"
              >
                Abrir nueva caja
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Cerrar Caja</h2>
            <button onClick={() => setShowCierre(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
              <X size={17} />
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Efectivo en caja (RD$)
              </label>
              <input
                autoFocus type="number" min="0" step="0.01"
                value={efectivoDeclarado}
                onChange={(e) => setEfectivoDeclarado(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold text-gray-800 text-center placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Nota de cierre</label>
              <textarea
                rows={2}
                value={notaCierre}
                onChange={(e) => setNotaCierre(e.target.value)}
                placeholder="Observaciones (opcional)"
                className={inputCls}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCierre(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={cerrarCaja} disabled={cerrando}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
                {cerrando ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : <LogOut size={14} />}
                Cerrar caja
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans">

      {/* ── Panel izquierdo ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">Punto de Venta</h1>
              <p className="text-xs text-slate-400">{sesionId ? `Sesión #${sesionId} activa` : "Sin sesión"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${online ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? "En línea" : "Sin conexión"}
            </span>
            {sesionId && (
              <button
                onClick={() => { setEfectivoDeclarado(""); setNotaCierre(""); setResumenCierre(null); setShowCierre(true); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                <LogOut size={11} /> Cerrar caja
              </button>
            )}
          </div>
        </header>

        {/* Búsqueda */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={barrasRef}
              placeholder="Buscar producto o escanear código de barras..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); buscarProducto(e.target.value); }}
              onKeyDown={onKeyDown}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {resultados.length > 0 && (
            <div className="absolute z-10 mt-1 w-[calc(100%-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto">
              {resultados.map((p) => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 text-left transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{p.nombre}</p>
                    <p className="text-xs text-slate-400">{p.codigo_barras} · Stock: {p.stock_actual} {p.unidad_medida}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.en_oferta ? (
                      <div>
                        <p className="font-black text-red-500 text-sm">RD${Number(p.precio_vigente).toFixed(2)}</p>
                        <p className="text-xs text-slate-400 line-through">RD${Number(p.precio_venta).toFixed(2)}</p>
                      </div>
                    ) : (
                      <p className="font-bold text-indigo-600 text-sm">RD${Number(p.precio_venta).toFixed(2)}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {p.en_oferta && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 rounded-full">OFERTA</span>}
                      {p.tipo === "GRANEL" && <span className="text-[10px] text-amber-500 font-medium">Granel</span>}
                      {(p.reglas_descuento ?? []).length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 font-bold px-1.5 rounded-full">Vol.</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 px-5 overflow-hidden flex flex-col gap-3 pb-4">
          {carrito.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
                <ShoppingCart size={36} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium">El carrito está vacío</p>
              <p className="text-xs">Escanea un código o busca un producto</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
              {carrito.map((item, idx) => (
                <div key={item.producto.id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm truncate">{item.producto.nombre}</p>
                      {item.producto.en_oferta && (
                        <span className="shrink-0 text-[10px] bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-bold">OFERTA</span>
                      )}
                      {item.producto.tipo === "GRANEL" && (
                        <span className="shrink-0 text-[10px] bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 font-medium">Granel</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400">RD${item.precio_unitario.toFixed(2)} / {item.producto.unidad_medida}</p>
                      {item.descuento > 0 && (
                        <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">
                          −RD${item.descuento.toFixed(2)} desc.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => ajustarCantidad(idx, item.producto.tipo === "GRANEL" ? -0.1 : -1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <Minus size={12} className="text-slate-600" />
                    </button>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => setCantidad(idx, e.target.value)}
                      step={item.producto.tipo === "GRANEL" ? "0.1" : "1"}
                      min={item.producto.tipo === "GRANEL" ? "0.1" : "1"}
                      className="w-16 text-center text-sm font-semibold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button onClick={() => ajustarCantidad(idx, item.producto.tipo === "GRANEL" ? 0.1 : 1)}
                      className="w-7 h-7 rounded-lg bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition-colors">
                      <Plus size={12} className="text-indigo-600" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 w-24">
                    <p className="font-bold text-slate-800 text-sm">
                      RD${(item.precio_unitario * item.cantidad - item.descuento).toFixed(2)}
                    </p>
                    <button onClick={() => setCarrito((p) => p.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-400 transition-colors mt-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {carrito.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Tag size={14} />
                <span>{carrito.length} producto(s)</span>
              </div>
              <button onClick={limpiarCarrito}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                <X size={13} /> Limpiar todo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho — Cobro ────────────────────────────────────── */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">

        {/* Total */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Total a cobrar</p>
          <p className="text-5xl font-black text-slate-800 leading-none">
            RD$<span className="text-indigo-600">{total.toFixed(2)}</span>
          </p>
          {descuentoTotal > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              Subtotal RD${subtotal.toFixed(2)} · Descuento −RD${descuentoTotal.toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Método de pago */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS_PAGO.map(({ key, label, Icon, color }) => (
                <button key={key} onClick={() => setMetodoPago(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    metodoPago === key ? COLOR_MAP[color] : "border-slate-100 text-slate-400 hover:border-slate-200 bg-slate-50"
                  }`}>
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Selector banco — transferencia */}
          {metodoPago === "TRANSFERENCIA" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={12} /> Banco destino
              </p>
              <CustomSelect
                value={bancoId}
                onChange={v => setBancoId(v as string)}
                options={[
                  { value: "", label: "Sin especificar" },
                  ...bancos.map(b => ({
                    value: String(b.id),
                    label: b.banco,
                    description: b.numero_cuenta ? `*${b.numero_cuenta}` : undefined,
                  })),
                ]}
                placeholder="Selecciona un banco..."
              />
              {bancos.length === 0 && (
                <p className="text-xs text-slate-400">
                  Agrega cuentas en <span className="font-semibold">Configuración → Bancos</span>
                </p>
              )}
            </div>
          )}

          {/* Selector cliente — fiado */}
          {metodoPago === "FIADO" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Cliente</p>
              <select value={clienteId ?? ""} onChange={(e) => setClienteId(Number(e.target.value) || null)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50 text-slate-700">
                <option value="">Selecciona un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {clienteSeleccionado && (
                <div className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
                  Number(clienteSeleccionado.credito_disponible) >= total
                    ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                }`}>
                  {Number(clienteSeleccionado.credito_disponible) >= total
                    ? <ChevronRight size={14} className="mt-0.5 shrink-0" />
                    : <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  }
                  <div>
                    <p className="font-semibold">{clienteSeleccionado.nombre}</p>
                    <p>Deuda: RD${Number(clienteSeleccionado.saldo_deuda).toFixed(2)}</p>
                    <p>Disponible: RD${Number(clienteSeleccionado.credito_disponible).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Efectivo — monto y cambio */}
          {metodoPago === "EFECTIVO" && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Monto recibido</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">RD$</span>
                  <input type="number" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-300 text-right" />
                </div>
              </div>
              {Number(montoPagado) >= total && total > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium">Cambio a devolver</p>
                  <p className="text-3xl font-black text-emerald-600">RD${cambio.toFixed(2)}</p>
                </div>
              )}
              {total > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                    <button key={v} onClick={() => setMontoPagado(String(v))}
                      className="text-xs bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 font-medium text-slate-600 transition-colors">
                      RD${v.toFixed(0)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botón cobrar */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100">
          <button onClick={procesarVenta}
            disabled={procesando || !carrito.length || !sesionId}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all shadow-lg ${
              procesando || !carrito.length || !sesionId
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200"
            }`}>
            {procesando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Procesando…
              </span>
            ) : (
              `Cobrar RD$${total.toFixed(2)}`
            )}
          </button>
        </div>
      </div>

      {/* Ticket de impresión */}
      {ultimaVenta && (
        <TicketPrint
          venta={ultimaVenta}
          colmadoNombre={colmadoNombre}
          onClose={() => setUltimaVenta(null)}
        />
      )}
    </div>
  );
}
