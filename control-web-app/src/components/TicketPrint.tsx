"use client";
import { useRef } from "react";
import { X, Printer, CheckCircle2 } from "lucide-react";

interface DetalleTicket {
  producto_nombre: string;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento: number | string;
  subtotal: number | string;
}

interface VentaTicket {
  id: number;
  fecha: string;
  cajero_nombre: string;
  cliente_nombre?: string | null;
  metodo_pago: string;
  banco_nombre?: string | null;
  subtotal: number | string;
  descuento: number | string;
  total: number | string;
  monto_pagado: number | string;
  cambio: number | string;
  detalles: DetalleTicket[];
}

interface NcfInfo {
  ncf: string;
  tipo_nombre: string;
  cliente_nombre: string;
}

interface Props {
  venta: VentaTicket;
  colmadoNombre: string;
  ncf?: NcfInfo;
  onClose: () => void;
}

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Fiado / Crédito",
};

export default function TicketPrint({ venta, colmadoNombre, ncf, onClose }: Props) {
  const ticketRef = useRef<HTMLDivElement>(null);

  function imprimir() {
    const contenido = ticketRef.current?.innerHTML ?? "";
    const ventana = window.open("", "_blank", "width=400,height=600");
    if (!ventana) return;
    ventana.document.write(`
      <html>
        <head>
          <title>Ticket #${venta.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4px; }
            .centro { text-align: center; }
            .negrita { font-weight: bold; }
            .grande { font-size: 16px; }
            .linea { border-top: 1px dashed #000; margin: 6px 0; }
            .fila { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-fila { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
            .pie { text-align: center; margin-top: 8px; font-size: 10px; }
          </style>
        </head>
        <body>${contenido}</body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 300);
  }

  const fmt = (n: number | string) =>
    `RD$${Number(n).toFixed(2)}`;

  const fecha = new Date(venta.fecha);
  const fechaStr = fecha.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaStr = fecha.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">

        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={20} />
            <span className="font-bold text-slate-800">¡Venta completada!</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={17} />
          </button>
        </div>

        {/* Ticket preview */}
        <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
          <div
            ref={ticketRef}
            className="bg-white text-black font-mono text-xs leading-relaxed"
            style={{ width: "100%" }}
          >
            {/* Cabecera */}
            <div className="centro negrita grande">{colmadoNombre.toUpperCase()}</div>
            <div className="centro" style={{ fontSize: 10, marginTop: 2 }}>Recibo de venta</div>
            <div className="linea" />

            <div className="fila">
              <span>Fecha:</span><span>{fechaStr} {horaStr}</span>
            </div>
            <div className="fila">
              <span>Ticket #:</span><span>{String(venta.id).padStart(5, "0")}</span>
            </div>
            <div className="fila">
              <span>Cajero:</span><span>{venta.cajero_nombre}</span>
            </div>
            {venta.cliente_nombre && (
              <div className="fila">
                <span>Cliente:</span><span>{venta.cliente_nombre}</span>
              </div>
            )}

            {ncf && (
              <>
                <div className="linea" />
                <div className="centro negrita" style={{ fontSize: 11 }}>COMPROBANTE FISCAL</div>
                <div className="centro" style={{ fontSize: 10, letterSpacing: 1 }}>{ncf.ncf}</div>
                <div className="centro" style={{ fontSize: 10 }}>{ncf.tipo_nombre}</div>
                {ncf.cliente_nombre && ncf.cliente_nombre !== "Consumidor Final" && (
                  <div className="centro" style={{ fontSize: 10 }}>{ncf.cliente_nombre}</div>
                )}
              </>
            )}

            <div className="linea" />

            {/* Items */}
            <div className="negrita" style={{ marginBottom: 4 }}>ARTÍCULOS</div>
            {venta.detalles.map((d, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <div>{d.producto_nombre}</div>
                <div className="fila" style={{ paddingLeft: 8 }}>
                  <span>{Number(d.cantidad).toFixed(2)} x {fmt(d.precio_unitario)}</span>
                  <span>{fmt(d.subtotal)}</span>
                </div>
              </div>
            ))}

            <div className="linea" />

            {/* Totales */}
            <div className="fila"><span>Subtotal:</span><span>{fmt(venta.subtotal)}</span></div>
            {Number(venta.descuento) > 0 && (
              <div className="fila"><span>Descuento:</span><span>-{fmt(venta.descuento)}</span></div>
            )}
            <div className="total-fila" style={{ marginTop: 4 }}>
              <span>TOTAL:</span><span>{fmt(venta.total)}</span>
            </div>

            <div className="linea" />

            <div className="fila">
              <span>Método:</span>
              <span>{METODO_LABEL[venta.metodo_pago] ?? venta.metodo_pago}
                {venta.banco_nombre ? ` (${venta.banco_nombre})` : ""}
              </span>
            </div>
            {venta.metodo_pago === "EFECTIVO" && (
              <>
                <div className="fila"><span>Recibido:</span><span>{fmt(venta.monto_pagado)}</span></div>
                <div className="fila negrita"><span>Cambio:</span><span>{fmt(venta.cambio)}</span></div>
              </>
            )}

            <div className="linea" />
            <div className="pie">¡Gracias por su compra!</div>
            <div className="pie">Vuelva pronto.</div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold transition active:scale-95"
          >
            Cerrar
          </button>
          <button
            onClick={imprimir}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:shadow-md transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
