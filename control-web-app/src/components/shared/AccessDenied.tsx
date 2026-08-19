import { ShieldX, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface Props {
  mensaje?: string;
}

export function AccessDenied({ mensaje = "No tienes permisos para acceder a este módulo." }: Props) {
  return (
    <div className="p-6 flex items-center justify-center flex-1 py-24">
      <div className="text-center">
        <ShieldX size={48} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-400">Acceso restringido</h2>
        <p className="text-slate-400 text-sm mt-1">{mensaje}</p>
      </div>
    </div>
  );
}

export function SuperadminRedirect() {
  return (
    <div className="p-6 flex items-center justify-center flex-1 py-24">
      <div className="text-center max-w-sm">
        <LayoutDashboard size={48} className="mx-auto mb-3 text-brand-300" />
        <h2 className="text-lg font-bold text-slate-600 dark:text-slate-300">
          Módulo de operación de colmado
        </h2>
        <p className="text-slate-400 text-sm mt-1 mb-4">
          Este módulo es para la operación diaria del colmado. Como Superadministrador,
          usa el panel de administración global.
        </p>
        <Link
          href="/superadmin/dashboard"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <LayoutDashboard size={16} />
          Ir al Panel Superadmin
        </Link>
      </div>
    </div>
  );
}
