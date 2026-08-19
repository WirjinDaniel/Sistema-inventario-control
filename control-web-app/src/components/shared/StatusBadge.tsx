import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "violet" }> = {
  ACTIVO: { label: "Activo", variant: "success" },
  INACTIVO: { label: "Inactivo", variant: "secondary" },
  COMPLETADA: { label: "Completada", variant: "success" },
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  CANCELADA: { label: "Cancelada", variant: "danger" },
  BORRADOR: { label: "Borrador", variant: "secondary" },
  ENVIADA: { label: "Enviada", variant: "info" },
  CONFIRMADA: { label: "Confirmada", variant: "violet" },
  RECIBIDA: { label: "Recibida", variant: "success" },
  CERRADA: { label: "Cerrada", variant: "secondary" },
  ABIERTA: { label: "Abierta", variant: "success" },
  PAGADO: { label: "Pagado", variant: "success" },
  VENCIDO: { label: "Vencido", variant: "danger" },
  CRITICO: { label: "Crítico", variant: "danger" },
  BAJO: { label: "Bajo", variant: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status?.toUpperCase()] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
