"use client";
import { useState } from "react";
import { FileText, RefreshCw, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TIPOS_NCF = [
  { codigo: "01", nombre: "Crédito Fiscal (B01)" },
  { codigo: "02", nombre: "Consumo (B02)" },
  { codigo: "11", nombre: "Proveedores Informales (B11)" },
  { codigo: "14", nombre: "Régimen Especial (B14)" },
  { codigo: "15", nombre: "Gubernamental (B15)" },
];

interface EmitirNCFModalProps {
  ventaId: number;
  clienteNombre?: string | null;
  detalles?: {
    producto?: number | null;
    descripcion: string;
    codigo?: string;
    cantidad: string | number;
    unidad?: string;
    precio_unitario: string | number;
    descuento?: string | number;
    tasa_itbis?: string | number;
  }[];
  subtotal?: string | number;
  itbis?: string | number;
  total?: string | number;
  onSuccess: (ncf: string, tipo_nombre: string, cliente_nombre: string) => void;
  onClose: () => void;
}

export default function EmitirNCFModal({
  ventaId, clienteNombre, detalles, subtotal, itbis, total,
  onSuccess, onClose,
}: EmitirNCFModalProps) {
  const [tipo, setTipo] = useState("02");
  const [rnc, setRnc] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);

  async function emitir() {
    setEmitiendo(true);
    try {
      const body: Record<string, unknown> = {
        tipo,
        venta: ventaId,
        cliente_nombre: tipo === "15"
          ? (institucion || "Institución Gubernamental")
          : tipo === "01"
            ? (institucion || clienteNombre || "Consumidor Final")
            : (clienteNombre ?? "Consumidor Final"),
        cliente_rnc: rnc,
        datos_especificos: tipo === "15"
          ? { institucion_nombre: institucion || "Institución Gubernamental" }
          : {},
      };

      if (detalles?.length) {
        body.detalles = detalles;
      } else {
        // Legacy: solo totales (sin ítems)
        body.subtotal = subtotal;
        body.itbis = itbis ?? "0";
        body.total = total;
      }

      const { data } = await api.post("/facturacion/facturas/", body);
      toast.success("Comprobante fiscal emitido");
      onSuccess(data.ncf, data.tipo_nombre, data.cliente_nombre);
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      const d = err.response?.data;
      let msg = "Error al emitir el NCF";
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d[0] ?? msg;
      else if (d && typeof d === "object") {
        const obj = d as Record<string, unknown>;
        msg = (obj.non_field_errors as string[])?.[0]
          ?? (obj.detail as string)
          ?? Object.values(obj).flat().filter(Boolean)[0] as string
          ?? msg;
      }
      toast.error(msg, { duration: 7000 });
    }
    setEmitiendo(false);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={16} className="text-brand-500" /> Emitir comprobante fiscal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">Tipo de comprobante</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full h-8 text-sm border border-border rounded-md bg-background px-2"
            >
              {TIPOS_NCF.map((t) => (
                <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
              ))}
            </select>
          </div>
          {(tipo === "01") && (
            <div>
              <Label className="text-xs mb-1.5 block">
                Nombre / Razón social <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="Nombre del contribuyente"
                value={institucion}
                onChange={(e) => setInstitucion(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}
          {(tipo === "15") && (
            <div>
              <Label className="text-xs mb-1.5 block">
                Nombre de la institución <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="Ej: Ministerio de Educación"
                value={institucion}
                onChange={(e) => setInstitucion(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}
          {(tipo === "01" || tipo === "15") && (
            <div>
              <Label className="text-xs mb-1.5 block">
                RNC / Cédula {tipo === "01" && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                placeholder="000-00000-0"
                value={rnc}
                onChange={(e) => setRnc(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={emitir} disabled={emitiendo} className="gap-2">
            {emitiendo ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Emitir NCF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
