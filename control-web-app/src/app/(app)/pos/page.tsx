"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search, ShoppingCart, Trash2, CreditCard, Banknote,
  Smartphone, UserCheck, Building2,
  DollarSign, Lock, LogOut, Plus, Minus, AlertCircle,
  Wifi, WifiOff, X, Tag, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { enqueueSale, getPendingSales, removeSale, countPending } from "@/lib/offline-queue";
import CustomSelect from "@/components/CustomSelect";
import TicketPrint from "@/components/TicketPrint";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ReglaDesc { id: number; cantidad_minima: string; tipo: "PORCENTAJE" | "MONTO_FIJO"; valor: string; nombre: string; }
interface Producto {
  id: number; nombre: string; codigo_barras: string; precio_venta: string;
  precio_vigente: string; precio_oferta: string | null; en_oferta: boolean;
  tipo: "UNIDAD" | "GRANEL"; unidad_medida: string; stock_actual: string;
  categoria?: number; categoria_nombre?: string; reglas_descuento?: ReglaDesc[]; itbis_exento: boolean;
}
interface PromocionSimple {
  id: number; nombre: string; tipo: string; valor: string;
  cantidad_minima: number; cantidad_paga: number; precio_especial: string;
  producto: number | null; categoria: number | null; vigente: boolean;
}
interface ItemCarrito { producto: Producto; cantidad: number; precio_unitario: number; descuento: number; }
interface Cliente { id: number; nombre: string; credito_disponible: string; saldo_deuda: string; }
interface BancoCuenta { id: number; banco: string; numero_cuenta: string; titular: string; }
interface VentaResponse {
  id: number; fecha: string; cajero_nombre: string; cliente_nombre?: string | null;
  metodo_pago: string; banco_nombre?: string | null; subtotal: string; descuento: string;
  itbis?: string; total: string; monto_pagado: string; cambio: string;
  detalles: { producto_nombre: string; cantidad: string; precio_unitario: string; descuento: string; subtotal: string; }[];
}

const aberturaSchema = z.object({
  efectivo_inicial: z.string().optional(),
});
type AberturaForm = z.infer<typeof aberturaSchema>;

const cierreSchema = z.object({
  efectivo_declarado: z.string().optional(),
  nota_cierre: z.string().optional(),
});
type CierreForm = z.infer<typeof cierreSchema>;

const ncfInlineSchema = z.object({
  tipo: z.string(),
  institucion: z.string().optional(),
  rnc: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.tipo === "01" && !d.rnc?.trim())
    ctx.addIssue({ code: "custom", message: "El RNC/Cédula es requerido para crédito fiscal.", path: ["rnc"] });
  if ((d.tipo === "01" || d.tipo === "15") && !d.institucion?.trim())
    ctx.addIssue({ code: "custom", message: "Este campo es requerido.", path: ["institucion"] });
});
type NCFInlineForm = z.infer<typeof ncfInlineSchema>;

const METODOS = [
  { key: "EFECTIVO", label: "Efectivo", Icon: Banknote },
  { key: "TARJETA", label: "Tarjeta", Icon: CreditCard },
  { key: "TRANSFERENCIA", label: "Transfer.", Icon: Smartphone },
  { key: "FIADO", label: "Fiado", Icon: UserCheck },
] as const;

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
  const [sinSesion, setSinSesion] = useState(false);
  const [showApertura, setShowApertura] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const { register: regApertura, handleSubmit: handleApertura, watch: watchApertura, setValue: setAperturaVal, reset: resetApertura } =
    useForm<AberturaForm>({ resolver: zodResolver(aberturaSchema), defaultValues: { efectivo_inicial: "" } });
  const efectivoInicial = watchApertura("efectivo_inicial") ?? "";

  const { register: regCierre, handleSubmit: handleCierre, reset: resetCierre } =
    useForm<CierreForm>({ resolver: zodResolver(cierreSchema), defaultValues: { efectivo_declarado: "", nota_cierre: "" } });

  const { register: regNcf, control: ctrlNcf, watch: watchNcf, reset: resetNcf, trigger: triggerNcf, getValues: getNcfValues, formState: { errors: errNcf } } =
    useForm<NCFInlineForm>({ resolver: zodResolver(ncfInlineSchema), defaultValues: { tipo: "02", institucion: "", rnc: "" } });
  const ncfTipo = watchNcf("tipo");
  const [resumenCierre, setResumenCierre] = useState<null | { efectivo_calculado: string; efectivo_final_declarado: string; diferencia_caja: string | null; apertura: string; }>(null);
  const [ultimaVenta, setUltimaVenta] = useState<VentaResponse | null>(null);
  const [ultimoNcf, setUltimoNcf] = useState<{ ncf: string; tipo_nombre: string; cliente_nombre: string } | null>(null);
  const [emitirNcf, setEmitirNcf] = useState(false);
  const [promoAplicada, setPromoAplicada] = useState<PromocionSimple | null>(null);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [promocionesActivas, setPromocionesActivas] = useState<PromocionSimple[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const barrasRef = useRef<HTMLInputElement>(null);

  const subtotal = carrito.reduce((a, i) => a + i.precio_unitario * i.cantidad, 0);
  const descuentoItems = carrito.reduce((a, i) => a + i.descuento, 0);
  const descuentoTotal = descuentoItems; // alias para compatibilidad con el payload
  const baseParaPromo = subtotal - descuentoItems;
  const descuentoPromo = (() => {
    if (!promoAplicada) return 0;
    if (promoAplicada.tipo === "PORCENTAJE" || promoAplicada.tipo === "CUPON")
      return baseParaPromo * Number(promoAplicada.valor) / 100;
    if (promoAplicada.tipo === "MONTO_FIJO")
      return Math.min(Number(promoAplicada.valor), baseParaPromo);
    return 0;
  })();
  const itbisTotal = carrito.reduce((a, i) => {
    if (i.producto.itbis_exento) return a;
    return a + (i.precio_unitario * i.cantidad - i.descuento) * 0.18;
  }, 0);
  const total = subtotal - descuentoItems - descuentoPromo;
  const cambio = Math.max(Number(montoPagado) - total, 0);
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null;

  useEffect(() => {
    cargarSesionActiva(); cargarClientes(); cargarBancos(); cargarColmado(); cargarPromos();
    barrasRef.current?.focus();
    // Restaurar borrador de venta no completada si existe
    const rawBorrador = localStorage.getItem("pos_borrador");
    if (rawBorrador) {
      try {
        const b = JSON.parse(rawBorrador);
        if (b.carrito?.length) {
          setCarrito(b.carrito);
          setMetodoPago(b.metodoPago ?? "EFECTIVO");
          if (b.clienteId) setClienteId(b.clienteId);
          if (b.bancoId) setBancoId(b.bancoId);
          toast("Se restauró una venta pendiente.", { icon: "⚠️", duration: 5000 });
        }
      } catch { localStorage.removeItem("pos_borrador"); }
    }
    countPending().then(setPendingCount).catch(() => {});

    const up = async () => {
      setOnline(true);
      await sincronizarCola();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  async function cargarColmado() {
    try { const { data } = await api.get("/usuarios/colmado/"); if (data.nombre) setColmadoNombre(data.nombre); } catch {}
  }
  async function cargarSesionActiva() {
    try { const { data } = await api.get("/ventas/sesiones/activa/"); setSesionId(data.id); setSinSesion(false); }
    catch { setSesionId(null); setSinSesion(true); setShowApertura(true); }
  }
  async function cargarClientes() { try { const { data } = await api.get("/clientes/"); setClientes(data.results ?? data); } catch {} }
  async function cargarBancos() { try { const { data } = await api.get("/ventas/bancos/"); setBancos(data.results ?? data); } catch {} }
  async function cargarPromos() { try { const { data } = await api.get("/promociones/?activo=true"); setPromocionesActivas(data.results ?? data); } catch {} }

  const onAbrirCaja = handleApertura(async (data) => {
    setAbriendo(true);
    try {
      const { data: res } = await api.post("/ventas/sesiones/", { efectivo_inicial: Number(data.efectivo_inicial) || 0 });
      setSesionId(res.id); setSinSesion(false); setShowApertura(false); resetApertura();
      toast.success("Caja abierta"); barrasRef.current?.focus();
    } catch { toast.error("Error al abrir la caja"); } finally { setAbriendo(false); }
  });

  const onCerrarCaja = handleCierre(async (data) => {
    if (!sesionId) return; setCerrando(true);
    try {
      const { data: res } = await api.post(`/ventas/sesiones/${sesionId}/cerrar/`, { efectivo_final_declarado: Number(data.efectivo_declarado) || 0, nota_cierre: data.nota_cierre });
      setResumenCierre(res); setSesionId(null); setSinSesion(true);
    } catch { toast.error("Error al cerrar la caja"); } finally { setCerrando(false); }
  });

  async function sincronizarCola() {
    const pending = await getPendingSales().catch(() => []);
    if (!pending.length) return;
    let ok = 0;
    for (const sale of pending) {
      try {
        await api.post("/ventas/", sale.payload);
        await removeSale(sale.id!);
        ok++;
      } catch { break; }
    }
    if (ok > 0) {
      toast.success(`${ok} venta${ok > 1 ? "s" : ""} sincronizada${ok > 1 ? "s" : ""} al reconectarse`);
      setPendingCount(await countPending().catch(() => 0));
    }
  }

  const buscarProducto = useCallback(async (q: string) => {
    if (!q.trim()) return setResultados([]);
    try { const { data } = await api.get(`/inventario/productos/?search=${encodeURIComponent(q)}`); setResultados(data.results ?? data); } catch {}
  }, []);

  async function escanearBarras(codigo: string) {
    try { const { data } = await api.get(`/inventario/productos/buscar-barras/?codigo=${codigo}`); agregarAlCarrito(data); setBusqueda(""); setResultados([]); }
    catch { toast.error(`Código no encontrado: ${codigo}`); }
  }

  async function aplicarCupon() {
    if (!codigoCupon.trim()) return;
    setCargandoCupon(true);
    try {
      const { data } = await api.get(`/promociones/por-cupon/?codigo=${codigoCupon.trim().toUpperCase()}`);
      setPromoAplicada(data);
      toast.success(`Cupón "${data.nombre}" aplicado`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Cupón inválido o expirado");
    }
    setCargandoCupon(false);
  }

  function calcularDescuentoVolumen(p: Producto, cantidad: number): number {
    const reglas = (p.reglas_descuento ?? []).filter(r => Number(r.cantidad_minima) <= cantidad).sort((a, b) => Number(b.cantidad_minima) - Number(a.cantidad_minima));
    if (!reglas.length) return 0;
    const regla = reglas[0]; const precioUnit = Number(p.precio_vigente ?? p.precio_venta);
    return regla.tipo === "PORCENTAJE" ? (precioUnit * cantidad * Number(regla.valor)) / 100 : Number(regla.valor) * cantidad;
  }

  function calcularDescuentoPromoItem(p: Producto, cantidad: number): number {
    const promo = promocionesActivas.find(pr =>
      pr.tipo !== "CUPON" && pr.vigente &&
      (pr.producto === p.id || (p.categoria != null && pr.categoria === p.categoria))
    );
    if (!promo) return 0;
    const precioUnit = Number(p.precio_vigente ?? p.precio_venta);
    if (promo.tipo === "PORCENTAJE") return precioUnit * cantidad * Number(promo.valor) / 100;
    if (promo.tipo === "MONTO_FIJO") return Math.min(Number(promo.valor), precioUnit * cantidad);
    if (promo.tipo === "2X1") return Math.floor(cantidad / (promo.cantidad_minima || 2)) * precioUnit;
    if (promo.tipo === "NXPRECIO" && cantidad >= promo.cantidad_minima) {
      const sets = Math.floor(cantidad / promo.cantidad_minima);
      return Math.max(0, precioUnit * cantidad - Number(promo.precio_especial) * sets);
    }
    return 0;
  }

  function calcularDescuento(p: Producto, cantidad: number): number {
    return calcularDescuentoVolumen(p, cantidad) + calcularDescuentoPromoItem(p, cantidad);
  }

  function agregarAlCarrito(p: Producto, qty = 1) {
    if (Number(p.stock_actual) < qty) { toast.error(`Stock insuficiente: ${p.stock_actual} ${p.unidad_medida}`); return; }
    const precioUnit = Number(p.precio_vigente ?? p.precio_venta);
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === p.id);
      if (idx >= 0) {
        const next = [...prev]; const nuevaCantidad = next[idx].cantidad + qty;
        next[idx] = { ...next[idx], cantidad: nuevaCantidad, descuento: calcularDescuento(p, nuevaCantidad) }; return next;
      }
      return [...prev, { producto: p, cantidad: qty, precio_unitario: precioUnit, descuento: calcularDescuento(p, qty) }];
    });
    setBusqueda(""); setResultados([]); barrasRef.current?.focus();
  }

  function ajustarCantidad(idx: number, delta: number) {
    setCarrito((prev) => {
      const next = [...prev]; const nueva = Math.round((next[idx].cantidad + delta) * 1000) / 1000;
      if (nueva <= 0) return prev.filter((_, i) => i !== idx);
      next[idx] = { ...next[idx], cantidad: nueva, descuento: calcularDescuento(next[idx].producto, nueva) }; return next;
    });
  }

  function setCantidad(idx: number, val: string) {
    const n = parseFloat(val); if (isNaN(n) || n <= 0) return;
    setCarrito((prev) => { const next = [...prev]; next[idx] = { ...next[idx], cantidad: n, descuento: calcularDescuento(next[idx].producto, n) }; return next; });
  }

  function limpiarCarrito() { setCarrito([]); setMontoPagado(""); setClienteId(null); setMetodoPago("EFECTIVO"); setBancoId(""); setEmitirNcf(false); resetNcf({ tipo: "02", institucion: "", rnc: "" }); setPromoAplicada(null); setCodigoCupon(""); barrasRef.current?.focus(); }

  async function procesarVenta() {
    if (!sesionId) return toast.error("Abre una sesión de caja primero.");
    if (!carrito.length) return toast.error("El carrito está vacío.");
    if (metodoPago === "FIADO" && !clienteId) return toast.error("Selecciona un cliente para fiado.");
    if (metodoPago === "FIADO" && clienteSeleccionado && Number(clienteSeleccionado.credito_disponible) < total)
      return toast.error(`Crédito insuficiente. Disponible: ${formatCurrency(clienteSeleccionado.credito_disponible)}`);
    if (metodoPago === "EFECTIVO" && montoPagado && Number(montoPagado) < total)
      return toast.error(`El monto recibido (${formatCurrency(Number(montoPagado))}) es menor al total (${formatCurrency(total)}).`);
    if (emitirNcf) {
      const ncfValid = await triggerNcf();
      if (!ncfValid) return;
    }
    setProcesando(true);
    const ventaPayload: Record<string, unknown> = {
      sesion_caja: sesionId, cliente: clienteId, metodo_pago: metodoPago,
      banco_cuenta: metodoPago === "TRANSFERENCIA" && bancoId ? Number(bancoId) : null,
      monto_pagado: metodoPago === "EFECTIVO" ? Number(montoPagado) : total,
      descuento: descuentoItems + descuentoPromo,
      detalles: carrito.map((i) => ({ producto: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario, descuento: i.descuento, subtotal: i.precio_unitario * i.cantidad - i.descuento })),
    };

    // Si está offline, encolar en IndexedDB y salir
    if (!online) {
      try {
        await enqueueSale(ventaPayload, carrito);
        setPendingCount((n) => n + 1);
        toast("Venta guardada offline. Se enviará al reconectarse.", { icon: "📶", duration: 6000 });
        localStorage.removeItem("pos_borrador");
        limpiarCarrito();
      } catch {
        toast.error("Error al guardar la venta offline.");
      }
      setProcesando(false);
      return;
    }

    // Guardar borrador antes del POST — si falla la conexión el carrito no se pierde
    const borrador = { carrito, metodoPago, clienteId, bancoId, descuentoTotal, total };
    localStorage.setItem("pos_borrador", JSON.stringify(borrador));
    try {
      const { data } = await api.post("/ventas/", ventaPayload);
      setUltimaVenta({ ...data, itbis: itbisTotal.toFixed(2) });
      setUltimoNcf(null);
      if (emitirNcf) {
        const ncf = getNcfValues();
        try {
          const ncfRes = await api.post("/facturacion/facturas/", {
            tipo: ncf.tipo,
            venta: data.id,
            cliente_nombre: ncf.tipo === "15" ? (ncf.institucion || "Institución Gubernamental")
              : ncf.tipo === "01" ? (ncf.institucion || data.cliente_nombre || "Consumidor Final")
              : (data.cliente_nombre ?? "Consumidor Final"),
            cliente_rnc: ncf.rnc,
            datos_especificos: ncf.tipo === "15" ? { institucion_nombre: ncf.institucion || "Institución Gubernamental" } : {},
            detalles: carrito.map((item) => ({
              producto: item.producto.id,
              descripcion: item.producto.nombre,
              codigo: item.producto.codigo_barras || "",
              cantidad: item.cantidad,
              unidad: item.producto.unidad_medida || "UND",
              precio_unitario: item.precio_unitario.toFixed(2),
              descuento: item.descuento.toFixed(2),
              tasa_itbis: item.producto.itbis_exento ? "0" : "18",
            })),
          });
          setUltimoNcf({
            ncf: ncfRes.data.ncf,
            tipo_nombre: ncfRes.data.tipo_nombre,
            cliente_nombre: ncfRes.data.cliente_nombre,
          });
          toast.success("Comprobante fiscal emitido");
        } catch (ncfErr: unknown) {
          const e = ncfErr as { response?: { data?: unknown } };
          const d = e.response?.data;
          let msg = "Error al emitir el NCF";
          if (typeof d === "string") {
            msg = d;
          } else if (Array.isArray(d)) {
            msg = d[0] ?? msg;
          } else if (d && typeof d === "object") {
            const obj = d as Record<string, unknown>;
            msg = (obj.non_field_errors as string[])?.[0]
              ?? (obj.detail as string)
              ?? Object.values(obj).flat().filter(Boolean)[0] as string
              ?? msg;
          }
          const esSecuencia = msg.toLowerCase().includes("secuencia");
          toast(
            (t) => (
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Venta guardada ✓ — NCF falló</span>
                <span className="text-xs text-muted-foreground">{msg}</span>
                {esSecuencia && (
                  <a
                    href="/facturacion"
                    className="text-xs font-semibold text-brand-600 underline mt-1"
                    onClick={() => toast.dismiss(t.id)}
                  >
                    Ir a Facturación &gt; Secuencias NCF →
                  </a>
                )}
              </div>
            ),
            { duration: 10000, icon: "⚠️" }
          );
        }
      }
      // Venta exitosa: registrar uso de promoción si aplica
      if (promoAplicada) {
        await api.post(`/promociones/${promoAplicada.id}/usar/`).catch(() => {});
      }
      localStorage.removeItem("pos_borrador");
      limpiarCarrito();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } };
      const d = e.response?.data;
      // No limpiar carrito en error — el borrador persiste para reintentar
      toast.error(d ? ((d.detail as string) ?? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")) : "Error al procesar la venta. El carrito se conservó para reintentar.");
    } finally { setProcesando(false); }
  }

  // Modal apertura de caja
  if (showApertura && !sesionId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center">
              <Lock size={18} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Abrir Caja</h2>
              <p className="text-xs text-muted-foreground">Ingresa el efectivo inicial del turno</p>
            </div>
            {!sinSesion && (
              <button onClick={() => { setShowApertura(false); resetApertura(); }} className="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <form onSubmit={onAbrirCaja} className="px-6 py-5 space-y-4">
            <input autoFocus type="number" min="0" step="0.01" placeholder="0.00"
              {...regApertura("efectivo_inicial")}
              onKeyDown={(e) => e.key === "Enter" && onAbrirCaja()}
              className="w-full border border-input bg-background rounded-xl px-4 py-3 text-3xl font-black text-center tabular-nums placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000, 3000, 5000, 10000].map((v) => (
                <button key={v} type="button" onClick={() => setAperturaVal("efectivo_inicial", String(v))}
                  className={cn("text-xs rounded-lg py-2 font-semibold transition-all",
                    Number(efectivoInicial) === v ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}>
                  RD${v.toLocaleString()}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={abriendo} className="w-full gap-2" size="lg">
              {abriendo ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <DollarSign size={16} />}
              Abrir Caja
            </Button>
            {sinSesion && <p className="text-center text-xs text-muted-foreground">No hay sesión activa. Abre la caja para comenzar.</p>}
          </form>
        </div>
      </div>
    );
  }

  // Modal cierre de caja
  if (showCierre) {
    if (resumenCierre) {
      const dif = resumenCierre.diferencia_caja != null ? Number(resumenCierre.diferencia_caja) : null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95">
            <div className="px-6 py-6 space-y-4">
              <h2 className="text-lg font-bold text-center">Corte Z — Caja Cerrada</h2>
              <div className="bg-muted/50 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Apertura</span>
                  <span className="font-medium text-foreground">{new Date(resumenCierre.apertura).toLocaleString("es-DO")}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Efectivo calculado</span><span className="font-bold">{formatCurrency(resumenCierre.efectivo_calculado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Efectivo declarado</span><span className="font-bold">{formatCurrency(resumenCierre.efectivo_final_declarado)}</span></div>
                {dif !== null && (
                  <div className={cn("flex justify-between font-bold rounded-lg p-2", dif === 0 ? "bg-emerald-50 text-emerald-700" : dif > 0 ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700")}>
                    <span>Diferencia</span><span>{dif >= 0 ? "+" : ""}{formatCurrency(dif)}</span>
                  </div>
                )}
              </div>
              <Button onClick={() => { setShowCierre(false); setResumenCierre(null); setShowApertura(true); }} className="w-full">Nueva sesión</Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-bold">Cerrar Caja</h2>
            <button onClick={() => { setShowCierre(false); resetCierre(); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
          </div>
          <form onSubmit={onCerrarCaja} className="px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Efectivo en caja (RD$)</label>
              <input autoFocus type="number" min="0" step="0.01" placeholder="0.00"
                {...regCierre("efectivo_declarado")}
                className="w-full border border-input bg-background rounded-xl px-4 py-3 text-2xl font-black text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nota de cierre</label>
              <textarea rows={2} placeholder="Observaciones (opcional)"
                {...regCierre("nota_cierre")}
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowCierre(false); resetCierre(); }} className="flex-1">Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={cerrando} className="flex-1 gap-2">
                {cerrando ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <LogOut size={14} />}
                Cerrar caja
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30 dark:bg-background overflow-hidden">

      {/* Panel izquierdo — productos */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header POS */}
        <header className="bg-background border-b border-border px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <ShoppingCart size={15} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Punto de Venta</h1>
              <p className="text-xs text-muted-foreground">{sesionId ? `Sesión #${sesionId} activa` : "Sin sesión"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
              online ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-50 text-rose-600")}>
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              {online ? "En línea" : "Sin conexión"}
            </span>
            {pendingCount > 0 && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={sincronizarCola}
                title="Haz clic para sincronizar ahora"
              >
                <AlertCircle size={11} /> {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
            {sesionId && (
              <Button variant="ghost" size="sm" onClick={() => { resetCierre(); setResumenCierre(null); setShowCierre(true); }}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 gap-1.5 text-xs">
                <LogOut size={12} /> Cerrar caja
              </Button>
            )}
          </div>
        </header>

        {/* Búsqueda */}
        <div className="px-5 pt-4 pb-3 shrink-0 relative">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={barrasRef}
              placeholder="Buscar producto o escanear código de barras... (Enter)"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); buscarProducto(e.target.value); }}
              onKeyDown={(e) => e.key === "Enter" && busqueda.trim() && escanearBarras(busqueda.trim())}
              className="w-full pl-9 pr-4 h-10 rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {resultados.length > 0 && (
            <div className="absolute z-20 mt-1.5 left-5 right-5 bg-card rounded-xl border border-border shadow-xl overflow-hidden max-h-80 overflow-y-auto">
              {resultados.map((p) => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 text-left transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0 font-bold text-xs text-brand-600">
                    {p.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.codigo_barras} · Stock: {p.stock_actual} {p.unidad_medida}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("font-bold text-sm tabular-nums", p.en_oferta ? "text-rose-500" : "text-brand-600")}>
                      {formatCurrency(p.en_oferta ? p.precio_vigente : p.precio_venta)}
                    </p>
                    {p.en_oferta && <Badge variant="danger" className="text-2xs">OFERTA</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 px-5 overflow-hidden flex flex-col gap-3 pb-4">
          {carrito.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 gap-3">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <ShoppingCart size={32} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Carrito vacío</p>
              <p className="text-xs text-muted-foreground/70">Escanea o busca un producto para comenzar</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
              {carrito.map((item, idx) => (
                <div key={item.producto.id}
                  className="bg-background rounded-xl border border-border shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm truncate">{item.producto.nombre}</p>
                      {item.producto.en_oferta && <Badge variant="danger" className="text-2xs px-1.5 shrink-0">OFERTA</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground font-mono">{formatCurrency(item.precio_unitario)} / {item.producto.unidad_medida}</p>
                      {item.descuento > 0 && (
                        <Badge variant="violet" className="text-2xs">−{formatCurrency(item.descuento)} desc.</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => ajustarCantidad(idx, item.producto.tipo === "GRANEL" ? -0.1 : -1)}
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
                      <Minus size={12} />
                    </button>
                    <input type="number" value={item.cantidad} onChange={(e) => setCantidad(idx, e.target.value)}
                      step={item.producto.tipo === "GRANEL" ? "0.1" : "1"} min={item.producto.tipo === "GRANEL" ? "0.1" : "1"}
                      className="w-14 text-center text-sm font-bold border border-input bg-background rounded-lg py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring tabular-nums" />
                    <button onClick={() => ajustarCantidad(idx, item.producto.tipo === "GRANEL" ? 0.1 : 1)}
                      className="w-7 h-7 rounded-lg bg-brand-100 hover:bg-brand-200 dark:bg-brand-900/40 dark:hover:bg-brand-900/60 flex items-center justify-center transition-colors">
                      <Plus size={12} className="text-brand-600" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 w-24">
                    <p className="font-bold text-sm tabular-nums font-mono">
                      {formatCurrency(item.precio_unitario * item.cantidad - item.descuento)}
                    </p>
                    <button onClick={() => setCarrito((p) => p.filter((_, i) => i !== idx))}
                      className="text-muted-foreground/40 hover:text-rose-400 transition-colors mt-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {carrito.length > 0 && (
            <div className="flex items-center justify-between bg-background rounded-xl border border-border px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag size={13} /> {carrito.length} producto(s)
              </div>
              <button onClick={limpiarCarrito} className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-600 font-medium transition-colors">
                <X size={12} /> Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho — cobro */}
      <div className="w-80 bg-background border-l border-border flex flex-col shrink-0">

        {/* Total */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total a cobrar</p>
          <p className="text-4xl font-black text-foreground leading-none tabular-nums">
            <span className="text-lg text-muted-foreground font-medium">RD$</span>
            <span className="text-brand-600">{total.toFixed(2)}</span>
          </p>
          {(descuentoItems > 0 || descuentoPromo > 0) && (
            <p className="text-xs text-muted-foreground mt-1">
              Subtotal {formatCurrency(subtotal)}
              {descuentoItems > 0 && ` · Desc. −${formatCurrency(descuentoItems)}`}
              {descuentoPromo > 0 && ` · Cupón −${formatCurrency(descuentoPromo)}`}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Cupón de descuento */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Tag size={11} /> Cupón de descuento
            </p>
            {promoAplicada ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2 border border-emerald-200 dark:border-emerald-900">
                <Tag size={13} className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">{promoAplicada.nombre}</p>
                  <p className="text-2xs text-emerald-600 dark:text-emerald-500">−{formatCurrency(descuentoPromo)}</p>
                </div>
                <button onClick={() => { setPromoAplicada(null); setCodigoCupon(""); }} className="text-emerald-400 hover:text-rose-500 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Código de cupón"
                  value={codigoCupon}
                  onChange={(e) => setCodigoCupon(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && aplicarCupon()}
                  className="h-8 text-xs font-mono flex-1"
                />
                <Button variant="outline" size="sm" className="h-8 text-xs px-3 shrink-0"
                  onClick={aplicarCupon} disabled={cargandoCupon || !codigoCupon.trim()}>
                  {cargandoCupon ? <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Método de pago */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setMetodoPago(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all",
                    metodoPago === key
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40 bg-muted/30"
                  )}>
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Banco para transferencia */}
          {metodoPago === "TRANSFERENCIA" && (
            <div className="space-y-2">
              <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={11} /> Banco destino
              </p>
              <CustomSelect value={bancoId} onChange={(v) => setBancoId(v as string)}
                options={[{ value: "", label: "Sin especificar" }, ...bancos.map((b) => ({ value: String(b.id), label: b.banco, description: b.numero_cuenta ? `*${b.numero_cuenta}` : undefined }))]}
                placeholder="Selecciona un banco..." />
            </div>
          )}

          {/* Cliente para fiado */}
          {metodoPago === "FIADO" && (
            <div className="space-y-2">
              <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Cliente</p>
              <select value={clienteId ?? ""} onChange={(e) => setClienteId(Number(e.target.value) || null)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Selecciona un cliente…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {clienteSeleccionado && (
                <div className={cn("rounded-xl p-3 text-xs flex items-start gap-2",
                  Number(clienteSeleccionado.credito_disponible) >= total
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                )}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{clienteSeleccionado.nombre}</p>
                    <p>Deuda: {formatCurrency(clienteSeleccionado.saldo_deuda)}</p>
                    <p>Disponible: {formatCurrency(clienteSeleccionado.credito_disponible)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Efectivo */}
          {metodoPago === "EFECTIVO" && (
            <div className="space-y-3">
              <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Monto recibido</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">RD$</span>
                <Input type="number" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)}
                  placeholder="0.00" className="pl-10 text-right font-bold tabular-nums" />
              </div>
              {Number(montoPagado) >= total && total > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center border border-emerald-100 dark:border-emerald-900">
                  <p className="text-xs text-emerald-600 font-medium">Cambio a devolver</p>
                  <p className="text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(cambio)}</p>
                </div>
              )}
              {total > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from(new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500])).map((v) => (
                    <button key={v} onClick={() => setMontoPagado(String(v))}
                      className="text-xs bg-muted hover:bg-muted/80 rounded-lg py-1.5 font-semibold text-muted-foreground transition-colors tabular-nums">
                      RD${v.toFixed(0)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comprobante fiscal */}
        {carrito.length > 0 && (
          <div className="px-5 py-3 border-t border-border space-y-2">
            <button
              onClick={() => setEmitirNcf((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                emitirNcf
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40 bg-muted/30"
              )}
            >
              <FileText size={15} />
              <span className="flex-1 text-left">Emitir comprobante fiscal</span>
              <span className={cn("w-8 h-4 rounded-full transition-colors relative shrink-0", emitirNcf ? "bg-brand-600" : "bg-muted-foreground/30")}>
                <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", emitirNcf ? "left-4" : "left-0.5")} />
              </span>
            </button>
            {emitirNcf && (
              <div className="space-y-2 pl-1">
                <Controller name="tipo" control={ctrlNcf} render={({ field }) => (
                  <select value={field.value} onChange={(e) => field.onChange(e.target.value)}
                    className="w-full h-8 text-xs border border-border rounded-lg bg-background px-2">
                    <option value="02">B02 — Consumo (consumidor final)</option>
                    <option value="01">B01 — Crédito Fiscal (empresa con RNC)</option>
                    <option value="15">B15 — Gubernamental</option>
                  </select>
                )} />
                {(ncfTipo === "01" || ncfTipo === "15") && (
                  <>
                    <Input placeholder={ncfTipo === "01" ? "Nombre / Razón social *" : "Nombre de la institución *"}
                      className="h-8 text-xs" aria-invalid={!!errNcf.institucion} {...regNcf("institucion")} />
                    {errNcf.institucion && <p role="alert" className="text-2xs text-destructive">{errNcf.institucion.message}</p>}
                    <Input placeholder={ncfTipo === "01" ? "RNC / Cédula *" : "RNC de la institución (opcional)"}
                      className="h-8 text-xs font-mono" aria-invalid={!!errNcf.rnc} {...regNcf("rnc")} />
                    {errNcf.rnc && <p role="alert" className="text-2xs text-destructive">{errNcf.rnc.message}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cobrar */}
        <div className="px-5 pb-5 pt-3 border-t border-border">
          <button onClick={procesarVenta}
            disabled={procesando || !carrito.length || !sesionId}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-base transition-all",
              procesando || !carrito.length || !sesionId
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white shadow-lg shadow-brand-600/20"
            )}>
            {procesando
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Procesando…
                </span>
              : `Cobrar ${formatCurrency(total)}`
            }
          </button>
          {!sesionId && (
            <button onClick={() => setShowApertura(true)} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center justify-center gap-1.5">
              <Lock size={11} /> Abrir caja para vender
            </button>
          )}
        </div>
      </div>

      {ultimaVenta && <TicketPrint venta={ultimaVenta} colmadoNombre={colmadoNombre} ncf={ultimoNcf ?? undefined} onClose={() => { setUltimaVenta(null); setUltimoNcf(null); }} />}
    </div>
  );
}
