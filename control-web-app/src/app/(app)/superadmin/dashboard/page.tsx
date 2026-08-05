"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import SuperadminDashboard from "@/components/dashboard/SuperadminDashboard";

export default function SuperadminDashboardPage() {
  const { esSuperadmin, hydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!esSuperadmin()) router.replace("/dashboard");
  }, [hydrated]);

  if (!hydrated || !esSuperadmin()) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Verificando permisos...</div>;
  }

  return <SuperadminDashboard />;
}
