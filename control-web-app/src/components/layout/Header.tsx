"use client";
import { useRouter } from "next/navigation";
import { Search, LogOut, Settings, PanelLeft, Keyboard } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb } from "@/components/shared/Breadcrumb";


export default function Header() {
  const router = useRouter();
  const { usuario, logout } = useAuthStore();
  const { toggle } = useSidebarStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="h-14 bg-navy flex items-center px-4 gap-3 shrink-0 z-30 shadow-lg">
      {/* Logo + branding */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/compras.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        <div className="hidden sm:block leading-tight">
          <p className="text-[14px] font-bold text-white leading-tight">ComerSys</p>
          <p className="text-[10px] text-blue-200 leading-none">Control Total</p>
        </div>
      </div>

      {/* Sidebar collapse toggle */}
      <button
        onClick={toggle}
        className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-22"
        title="Colapsar menú"
      >
        <PanelLeft size={17} />
      </button>

      {/* Breadcrumb */}
      <Breadcrumb className="hidden sm:flex" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right group: search + shortcuts + user */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-white/50 hover:text-white hover:bg-white/10 w-44 justify-between border border-white/15 rounded-lg h-8"
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
            window.dispatchEvent(e);
          }}
        >
          <span className="flex items-center gap-1.5 text-xs">
            <Search size={12} />
            Buscar...
          </span>
          <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-white/40">⌘K</kbd>
        </Button>

        {/* Keyboard shortcuts hint */}
        <button
          className="hidden sm:flex p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Atajos de teclado (?)"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }))}
          aria-label="Atajos de teclado"
        >
          <Keyboard size={15} />
        </button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="text-[10px] bg-blue-500/80 text-white font-semibold">
                {usuario ? getInitials(usuario.nombre || usuario.username) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight text-white">
                {usuario?.nombre || usuario?.username}
              </p>
              <p className="text-[10px] text-blue-200 leading-tight">{usuario?.rol}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Mi cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/configuracion")}>
            <Settings size={14} /> Configuración
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
          >
            <LogOut size={14} /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
