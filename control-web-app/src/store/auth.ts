import { create } from "zustand";

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: "ADMIN" | "CAJERO" | "INVENTARIO";
  colmado: number | null;
  is_superuser?: boolean;
}

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (token: string, refresh: string, usuario: Usuario) => void;
  logout: () => void;
  hydrate: () => void;
  esAdmin: () => boolean;
  esCajero: () => boolean;
  esSuperadmin: () => boolean;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  token: null,
  hydrated: false,

  setAuth: (token, refresh, usuario) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("usuario", JSON.stringify(usuario));
    setCookie("access_token", token, 1);
    set({ token, usuario });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("usuario");
    deleteCookie("access_token");
    set({ token: null, usuario: null });
  },

  hydrate: () => {
    if (get().hydrated) return;
    const token = localStorage.getItem("access_token");
    const raw = localStorage.getItem("usuario");
    if (token && raw) {
      try {
        const usuario = JSON.parse(raw) as Usuario;
        set({ token, usuario });
      } catch {
        localStorage.removeItem("usuario");
      }
    }
    set({ hydrated: true });
  },

  esAdmin: () => get().usuario?.rol === "ADMIN",
  esCajero: () => ["ADMIN", "CAJERO"].includes(get().usuario?.rol ?? ""),
  esSuperadmin: () => get().usuario?.is_superuser === true,
}));
