'use client';

import { useAuthStore } from '@/store/auth';
import LocalDashboard from '@/components/dashboard/LocalDashboard';
import SuperadminDashboard from '@/components/dashboard/SuperadminDashboard';

export default function DashboardPage() {
  const usuario = useAuthStore((state) => state.usuario);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return (
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 h-32 animate-pulse border border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-slate-100" />
            <div className="h-7 bg-slate-100 rounded mt-3 w-24" />
            <div className="h-4 bg-slate-100 rounded mt-2 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (usuario?.is_superuser) {
    return <SuperadminDashboard />;
  }

  return <LocalDashboard />;
}
