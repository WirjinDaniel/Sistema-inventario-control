"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search, Plus, UserCheck, Wallet, History,
  DollarSign, Users, BarChart2, Phone, CreditCard, TrendingDown,
  Check, Edit2, MoreHorizontal, BadgeCheck,
  UserX, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Cliente, AbonoFiado } from "@/types";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface AgingCliente {
  id: number; nombre: string; telefono: string;
  saldo_deuda: number; dias: number; ultima_fecha: string;
}
interface AgingBucket { label: string; clientes: AgingCliente[]; total: number; }
interface AgingData { buckets: Record<string, AgingBucket>; total: number; }
interface FormCliente { nombre: string; telefono: string; cedula: string; limite_credito: string; }

const FORM_EMPTY: FormCliente = { nombre: "", telefono: "", cedula: "", limite_credito: "0" };


function ClienteSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [aging, setAging] = useState<AgingData | null>(null);
  const [, setLoadingAging] = useState(false);
  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<AbonoFiado[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [modal, setModal] = useState<"crear" | "editar" | "abono" | null>(null);
  const [form, setForm] = useState<FormCliente>(FORM_EMPTY);
  const [montoAbono, setMontoAbono] = useState("");
  const [notaAbono, setNotaAbono] = useState("");
  const [guardando, setGuardando] = useState(false);

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

  async function cargarAging() {
    if (aging) return;
    setLoadingAging(true);
    try {
      const { data } = await api.get("/clientes/aging/");
      setAging(data);
    } catch {
      toast.error("Error cargando antigüedad");
    }
    setLoadingAging(false);
  }

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

  function abrirCrear() {
    setForm(FORM_EMPTY);
    setModal("crear");
  }

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
    if (!form.nombre.trim()) return toast.error("El nombre es requerido.");
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
      if (clienteActivo) seleccionarCliente({ ...clienteActivo, saldo_deuda: (Number(clienteActivo.saldo_deuda) - monto).toString() } as unknown as Cliente);
    } catch {
      toast.error("Error al registrar abono");
    }
    setGuardando(false);
  }

  const totalDeudas = clientes.reduce((a, c) => a + Number(c.saldo_deuda), 0);
  const conDeuda = clientes.filter((c) => Number(c.saldo_deuda) > 0).length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Panel izquierdo: lista ── */}
      <div className="w-80 flex flex-col border-r border-border bg-background shrink-0">
        {/* Header lista */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Clientes</h2>
            <Button size="sm" onClick={abrirCrear} className="h-7 text-xs gap-1.5">
              <Plus size={13} /> Nuevo
            </Button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-border">
          <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-2.5">
            <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wide">Total fiados</p>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300 tabular-nums mt-0.5">{formatCurrency(totalDeudas)}</p>
          </div>
          <div className="bg-muted rounded-lg p-2.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Con deuda</p>
            <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">{conDeuda} / {clientes.length}</p>
          </div>
        </div>

        {/* Lista scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-2 space-y-1">
              {Array.from({ length: 8 }).map((_, i) => <ClienteSkeleton key={i} />)}
            </div>
          ) : clientes.length === 0 ? (
            <EmptyState icon={Users} title="Sin clientes" description="Agrega el primer cliente." />
          ) : (
            <div className="p-2 space-y-0.5">
              {clientes.map((c) => {
                const deuda = Number(c.saldo_deuda);
                const limite = Number(c.limite_credito);
                const pct = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
                const activo = clienteActivo?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                      activo
                        ? "bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800"
                        : "hover:bg-muted"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      deuda > 0
                        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                        : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                    )}>
                      {getInitials(c.nombre)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-semibold truncate",
                        activo ? "text-brand-700 dark:text-brand-300" : "text-foreground"
                      )}>
                        {c.nombre}
                      </p>
                      {deuda > 0 && limite > 0 && (
                        <Progress value={pct} className="h-1 mt-1" />
                      )}
                    </div>
                    {/* Saldo */}
                    <div className="text-right shrink-0">
                      {deuda > 0 ? (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatCurrency(deuda)}
                        </span>
                      ) : (
                        <Badge variant="success" className="text-[10px] h-4">Al día</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: detalle / aging ── */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
        {!clienteActivo ? (
          /* Estado vacío — seleccionar cliente */
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <UserCheck size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Selecciona un cliente</p>
              <p className="text-sm text-muted-foreground mt-1">Haz clic en cualquier cliente para ver sus detalles</p>
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => { setModal(null); cargarAging(); }}>
                <BarChart2 size={14} /> Ver antigüedad CxC
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl mx-auto space-y-5">
            {/* Header del cliente */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold",
                  Number(clienteActivo.saldo_deuda) > 0
                    ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                )}>
                  {getInitials(clienteActivo.nombre)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{clienteActivo.nombre}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    {clienteActivo.telefono && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone size={11} /> {clienteActivo.telefono}
                      </span>
                    )}
                    {clienteActivo.cedula && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CreditCard size={11} /> {clienteActivo.cedula}
                      </span>
                    )}
                    <Badge variant={clienteActivo.activo ? "success" : "secondary"} className="text-[10px] h-4">
                      {clienteActivo.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-2">
                {Number(clienteActivo.saldo_deuda) > 0 && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                    onClick={() => abrirAbono(clienteActivo)}>
                    <Wallet size={14} /> Abonar
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal size={16} />
                    </Button>
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
            </div>

            {/* KPIs del cliente */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Deuda actual",
                  value: formatCurrency(Number(clienteActivo.saldo_deuda)),
                  icon: TrendingDown,
                  color: Number(clienteActivo.saldo_deuda) > 0
                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
                  iconBg: Number(clienteActivo.saldo_deuda) > 0
                    ? "bg-rose-100 dark:bg-rose-900/40"
                    : "bg-emerald-100 dark:bg-emerald-900/40",
                },
                {
                  label: "Límite de crédito",
                  value: formatCurrency(Number(clienteActivo.limite_credito)),
                  icon: DollarSign,
                  color: "bg-card text-foreground",
                  iconBg: "bg-brand-50 dark:bg-brand-950/30",
                },
                {
                  label: "Crédito disponible",
                  value: formatCurrency(Math.max(Number(clienteActivo.limite_credito) - Number(clienteActivo.saldo_deuda), 0)),
                  icon: BadgeCheck,
                  color: "bg-card text-foreground",
                  iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                },
              ].map((kpi) => (
                <div key={kpi.label} className={cn("rounded-xl p-4 border border-border", kpi.color)}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", kpi.iconBg)}>
                    <kpi.icon size={16} className="opacity-70" />
                  </div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Barra de crédito usado */}
            {Number(clienteActivo.limite_credito) > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Crédito usado</span>
                  <span className="font-medium text-foreground">
                    {Math.min(
                      (Number(clienteActivo.saldo_deuda) / Number(clienteActivo.limite_credito)) * 100,
                      100
                    ).toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    (Number(clienteActivo.saldo_deuda) / Number(clienteActivo.limite_credito)) * 100,
                    100
                  )}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>RD$0</span>
                  <span>{formatCurrency(Number(clienteActivo.limite_credito))}</span>
                </div>
              </div>
            )}

            {/* Historial de abonos */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Historial de abonos</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
                  onClick={() => seleccionarCliente(clienteActivo)}>
                  <RefreshCw size={12} /> Actualizar
                </Button>
              </div>

              {loadingHistorial ? (
                <div className="p-4 space-y-3">
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
                <div className="py-10 text-center">
                  <History size={28} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin abonos registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {historial.map((a, idx) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Timeline dot */}
                      <div className="relative flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {idx < historial.length - 1 && (
                          <div className="absolute top-8 w-px h-4 bg-border" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          Abono registrado
                          {(a as { cajero_nombre?: string }).cajero_nombre && (
                            <span className="font-normal text-muted-foreground"> · {(a as { cajero_nombre: string }).cajero_nombre}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.fecha).toLocaleDateString("es-DO", {
                            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        {a.nota && <p className="text-xs text-muted-foreground italic mt-0.5">{a.nota}</p>}
                      </div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                        +{formatCurrency(Number(a.monto))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Aging sheet (bottom sheet via Dialog) ── */}

      {/* ── Modal crear / editar ── */}
      <Dialog open={modal === "crear" || modal === "editar"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center">
                <Users size={14} className="text-brand-600 dark:text-brand-400" />
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
                  onChange={setField(key)}
                  placeholder={key === "nombre" ? "Ej: Juan Pérez" : key === "telefono" ? "809-000-0000" : "000-0000000-0"}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Límite de crédito (RD$)</Label>
              <Input
                type="number"
                value={form.limite_credito}
                onChange={setField("limite_credito")}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Check size={14} />}
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
              {/* Info cliente */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{clienteActivo.nombre}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Deuda actual:{" "}
                  <span className="font-bold tabular-nums">{formatCurrency(Number(clienteActivo.saldo_deuda))}</span>
                </p>
              </div>

              {/* Input monto */}
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

              {/* Botones rápidos */}
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

              {/* Nota */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nota (opcional)</Label>
                <Input
                  value={notaAbono}
                  onChange={(e) => setNotaAbono(e.target.value)}
                  placeholder="Ej: Pago en efectivo"
                />
              </div>

              {/* Preview nuevo saldo */}
              {Number(montoAbono) > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">Nuevo saldo:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatCurrency(Math.max(Number(clienteActivo.saldo_deuda) - Number(montoAbono), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button
              onClick={registrarAbono}
              disabled={guardando}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {guardando ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Check size={14} />}
              Registrar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
