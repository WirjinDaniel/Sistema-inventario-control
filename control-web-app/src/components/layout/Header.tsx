"use client";
import { useRouter } from "next/navigation";
import { Search, LogOut, Settings, PanelLeft, Keyboard } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  INVENTARIO: "Inventario",
  CAJERO: "Cajero",
  SUPERADMIN: "Superadmin",
};

export default function Header() {
  const router = useRouter();
  const { usuario, logout } = useAuthStore();
  const { toggle } = useSidebarStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const displayName = usuario?.nombre || usuario?.username || "Usuario";
  const rol = usuario?.rol ? (ROL_LABEL[usuario.rol] ?? usuario.rol) : "";

  return (
    <header className="h-14 bg-navy border-b border-white/8 flex items-center px-4 gap-3 shrink-0 z-30">

      {/* Logo + branding */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/compras.png"
          alt="Logo"
          className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-sm ring-1 ring-white/20"
        />
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-black text-white tracking-tight leading-tight">ComerSys</p>
          <p className="text-2xs text-brand-300 leading-none font-medium">Gestión Comercial</p>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-white/15 shrink-0" />

      {/* Sidebar toggle */}
      <button
        onClick={toggle}
        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        title="Colapsar menú"
      >
        <PanelLeft size={16} />
      </button>

      {/* Breadcrumb */}
      <Breadcrumb className="hidden sm:flex" />

      <div className="flex-1" />

      {/* Right group */}
      <div className="flex items-center gap-1.5">

        {/* Search trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-white/12 bg-white/6 hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 w-44 justify-between"
        >
          <span className="flex items-center gap-1.5 text-xs">
            <Search size={12} />
            Buscar...
          </span>
          <kbd className="text-2xs bg-white/10 px-1.5 py-0.5 rounded font-mono text-white/40">⌘K</kbd>
        </button>

        {/* Keyboard shortcuts */}
        <button
          className="hidden sm:flex p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Atajos de teclado (?)"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }))}
          aria-label="Atajos de teclado"
        >
          <Keyboard size={15} />
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-white/15 shrink-0 mx-0.5" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 hover:bg-white/10 rounded-xl px-2.5 py-1.5 transition-colors group">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-2xs font-black text-white bg-linear-to-br from-brand-500 to-indigo-600">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight text-white truncate max-w-28">
                  {displayName}
                </p>
                <p className="text-2xs text-brand-300 leading-tight">{rol}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
              <p className="text-2xs text-muted-foreground">{rol}</p>
            </div>
            <div className="py-1">
              <DropdownMenuItem onClick={() => router.push("/configuracion")} className="gap-2 text-xs">
                <Settings size={13} /> Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
              >
                <LogOut size={13} /> Cerrar sesión
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
