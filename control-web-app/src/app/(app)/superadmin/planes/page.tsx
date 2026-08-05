"use client";
import { useEffect, useState } from "react";
import { Layers, Plus, Edit2, X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

interface Plan {
  id: number;
  nombre: string;
  precio_mensual: string;
  max_usuarios: number;
  max_productos: number;
  descripcion: string;
  activo: boolean;
}

const EMPTY: Omit<Plan, "id"> = {
  nombre: "", precio_mensual: "", max_usuarios: 5,
  max_productos: 500, descripcion: "", activo: true,
};

export default function PlanesPage() {
  const { token, esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [form, setForm] = useState<Omit<Plan, "id">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!esSuperadmin()) { router.replace("/dashboard"); return; }
    cargar();
  }, [hydrated]);

  if (!hydrated || !esSuperadmin()) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Verificando permisos...</div>;
  }

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch("/api/suscripciones/planes/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setPlanes(Array.isArray(d) ? d : d.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function abrirCrear() {
    setForm(EMPTY);
    setEditId(null);
    setError(null);
    setModal("crear");
  }

  function abrirEditar(p: Plan) {
    setForm({ nombre: p.nombre, precio_mensual: p.precio_mensual, max_usuarios: p.max_usuarios, max_productos: p.max_productos, descripcion: p.descripcion, activo: p.activo });
    setEditId(p.id);
    setError(null);
    setModal("editar");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const url = editId ? `/api/suscripciones/planes/${editId}/` : "/api/suscripciones/planes/";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(JSON.stringify(d));
      } else {
        setModal(null);
        cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={24} className="text-brand-600" />
            Planes de Suscripción
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Define los planes disponibles para los colmados</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Nuevo Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-muted-foreground text-sm col-span-3">Cargando...</p>
        ) : planes.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-3">No hay planes creados todavía.</p>
        ) : planes.map(p => (
          <div key={p.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 space-y-3 ${p.activo ? "border-border" : "border-slate-200 dark:border-slate-700 opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{p.nombre}</h3>
                {!p.activo && <span className="text-xs text-slate-400">Inactivo</span>}
              </div>
              <button onClick={() => abrirEditar(p)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
                <Edit2 size={14} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-2xl font-bold text-brand-600">
              RD${parseFloat(p.precio_mensual).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mes</span>
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>👥 Hasta {p.max_usuarios} usuarios</p>
              <p>📦 Hasta {p.max_productos.toLocaleString()} productos</p>
            </div>
            {p.descripcion && <p className="text-xs text-muted-foreground border-t border-border pt-2">{p.descripcion}</p>}
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {modal === "crear" ? "Nuevo Plan" : "Editar Plan"}
              </h2>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: "nombre", label: "Nombre del plan *", placeholder: "Ej: Básico, Pro, Enterprise" },
                { key: "precio_mensual", label: "Precio mensual (RD$) *", placeholder: "0.00", type: "number" },
                { key: "max_usuarios", label: "Máx. usuarios", placeholder: "5", type: "number" },
                { key: "max_productos", label: "Máx. productos", placeholder: "500", type: "number" },
                { key: "descripcion", label: "Descripción", placeholder: "Descripción breve del plan" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input
                    type={f.type ?? "text"}
                    value={(form as Record<string, string | number>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} className="rounded" />
                <label htmlFor="activo" className="text-sm text-slate-700 dark:text-slate-300">Plan activo</label>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={guardar} disabled={!form.nombre || guardando}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? "Guardando..." : modal === "crear" ? "Crear Plan" : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
