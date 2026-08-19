"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const ncfSchema = z.object({
  tipo: z.string().min(1),
  rnc: z.string().optional(),
  institucion: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.tipo === "01" && !d.rnc?.trim()) {
    ctx.addIssue({ code: "custom", message: "El RNC/Cédula es requerido.", path: ["rnc"] });
  }
  if ((d.tipo === "01" || d.tipo === "15") && !d.institucion?.trim()) {
    ctx.addIssue({ code: "custom", message: "Este campo es requerido.", path: ["institucion"] });
  }
});

type NCFForm = z.infer<typeof ncfSchema>;

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
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } =
    useForm<NCFForm>({ resolver: zodResolver(ncfSchema), defaultValues: { tipo: "02", rnc: "", institucion: "" } });

  const tipoActual = watch("tipo");

  const onSubmit = handleSubmit(async (data) => {
    try {
      const body: Record<string, unknown> = {
        tipo: data.tipo,
        venta: ventaId,
        cliente_nombre: data.tipo === "15"
          ? (data.institucion || "Institución Gubernamental")
          : data.tipo === "01"
            ? (data.institucion || clienteNombre || "Consumidor Final")
            : (clienteNombre ?? "Consumidor Final"),
        cliente_rnc: data.rnc,
        datos_especificos: data.tipo === "15"
          ? { institucion_nombre: data.institucion || "Institución Gubernamental" }
          : {},
      };

      if (detalles?.length) {
        body.detalles = detalles;
      } else {
        body.subtotal = subtotal;
        body.itbis = itbis ?? "0";
        body.total = total;
      }

      const { data: res } = await api.post("/facturacion/facturas/", body);
      toast.success("Comprobante fiscal emitido");
      onSuccess(res.ncf, res.tipo_nombre, res.cliente_nombre);
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
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={16} className="text-brand-600" /> Emitir comprobante fiscal
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">Tipo de comprobante</Label>
            <Controller name="tipo" control={control} render={({ field }) => (
              <select
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="w-full h-8 text-sm border border-border rounded-md bg-background px-2"
              >
                {TIPOS_NCF.map((t) => (
                  <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                ))}
              </select>
            )} />
          </div>
          {(tipoActual === "01" || tipoActual === "15") && (
            <div>
              <Label className="text-xs mb-1.5 block">
                {tipoActual === "01" ? "Nombre / Razón social" : "Nombre de la institución"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={tipoActual === "01" ? "Nombre del contribuyente" : "Ej: Ministerio de Educación"}
                className="h-8 text-sm"
                aria-required="true"
                aria-invalid={!!errors.institucion}
                {...register("institucion")}
              />
              {errors.institucion && <p role="alert" className="text-xs text-destructive mt-1">{errors.institucion.message}</p>}
            </div>
          )}
          {(tipoActual === "01" || tipoActual === "15") && (
            <div>
              <Label className="text-xs mb-1.5 block">
                RNC / Cédula {tipoActual === "01" && <span className="text-destructive">*</span>}
              </Label>
              <Input
                placeholder="000-00000-0"
                className="h-8 text-sm font-mono"
                aria-required={tipoActual === "01"}
                aria-invalid={!!errors.rnc}
                {...register("rnc")}
              />
              {errors.rnc && <p role="alert" className="text-xs text-destructive mt-1">{errors.rnc.message}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Emitir NCF
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
